import { useCallback, useEffect, useRef, useState } from "react";
import type { YTPlayerInstance } from "../types";
import { useMicScoring } from "./useMicScoring"; // I-import ang ginawa nating mic engine

// Gumawa ng structure para sa kasalukuyang kanta mula sa queue table mo
type CurrentSongProps = {
  room_code: string;
  video_id: string;
  title: string;
  added_by: string;
  added_by_name?: string | null;
};

type Params = {
  currentVideoId: string;
  playToken?: number;
  canPlayCurrentVideo: boolean;
  isHost: boolean;
  isTransferringHost: boolean;
  onEnded: (score?: number) => void;
  onError: () => void;
  currentSongData: CurrentSongProps | null; // Idinagdag para may access ang hook sa added_by ng queue
};

/**
 * Everything about the actual <iframe> YouTube player: loading the
 * IFrame API script once, creating/recreating the player when the
 * video or host changes, mute/unmute, and detecting videos that never
 * fire onReady (restricted/region-locked/etc).
 */
export function useYouTubePlayer({
  currentVideoId,
  playToken = 0,
  canPlayCurrentVideo,
  isHost,
  isTransferringHost,
  onEnded,
  onError,
  currentSongData, // Tinanggap ang data ng kanta rito
}: Params) {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [restrictedVideoIds, setRestrictedVideoIds] = useState<Set<string>>(new Set());

  // Kuhanin ang microphone functions mula sa scoring engine hook
  const { startHostMicrophone, stopHostMicrophoneAndSave } = useMicScoring();

  const isVideoRestricted = restrictedVideoIds.has(currentVideoId);

  // A single key that changes on EVERY new "play" attempt, even when the
  // same video_id is queued back-to-back (e.g. the same song added twice).
  // currentVideoId alone doesn't change in that case, which used to leave
  // the player-creation effect skipped entirely -> isPlayerReady stuck at
  // false forever after playNext() called markPlayerNotReady().
  const playKey = `${currentVideoId}::${playToken}`;

  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytApiReadyRef = useRef(false);
  const testedVideoRef = useRef<string | null>(null);
  const readyFallbackTimeoutRef = useRef<number | null>(null);
  const readyFallbackTriggeredRef = useRef(false);

  const clearReadyFallbackTimeout = useCallback(() => {
    if (readyFallbackTimeoutRef.current) {
      window.clearTimeout(readyFallbackTimeoutRef.current);
      readyFallbackTimeoutRef.current = null;
    }
  }, []);

  const setPlayerReadyWithFallbackClear = useCallback(() => {
    clearReadyFallbackTimeout();
    readyFallbackTriggeredRef.current = false;
    setIsPlayerReady(true);
  }, [clearReadyFallbackTimeout]);

  const resetPlayerReadyWithFallback = useCallback(() => {
    clearReadyFallbackTimeout();
    setIsPlayerReady(false);
  }, [clearReadyFallbackTimeout]);

  const prevIsHostRef = useRef(isHost);
  useEffect(() => {
    prevIsHostRef.current = isHost;
  }, [isHost]);

  // Keep the latest callbacks in refs so the player-creation effect
  // below doesn't need onEnded/onError in its dependency array.
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onEndedRef.current = onEnded;
    onErrorRef.current = onError;
  }, [onEnded, onError]);

  const onPlayerReadyRef = useRef<() => void>(() => {});
  const onPlayerStateChangeRef = useRef<(state: number) => void>(() => {});

  useEffect(() => {
    onPlayerReadyRef.current = () => {
      if (!isTransferringHost) {
        setPlayerReadyWithFallbackClear();
        testedVideoRef.current = null;
      }
    };

    // --- INTEGRATION NG AUDIO ANALYZER SA PLAYER STATE CHANGES ---
    onPlayerStateChangeRef.current = (state: number) => {
      if (isTransferringHost) return;

      if (state === window.YT.PlayerState.ENDED) {
        setPlayerReadyWithFallbackClear();

        // 🎤 TAPOS NA ANG KANTA: Patayin ang mic ng host at awtomatikong i-save sa database
        if (isHost && currentSongData) {
          void stopHostMicrophoneAndSave({
            room_code: currentSongData.room_code,
            video_id: currentSongData.video_id,
            title: currentSongData.title,
            added_by: currentSongData.added_by, // Dito natin tinatali sa kung sino ang nag-queue
            added_by_name: currentSongData.added_by_name,
          }).then((score) => {
            onEndedRef.current(score);
          });
        } else {
          onEndedRef.current();
        }
      } else if (state === window.YT.PlayerState.PLAYING) {
        setPlayerReadyWithFallbackClear();
        testedVideoRef.current = null;

        // 🎤 NAGSIMULA ANG KANTA: Pagka-play na pagka-play ng YouTube, makikinig na ang mic ng Host
        if (isHost) {
          startHostMicrophone();
        }
      } else if (
        state === window.YT.PlayerState.BUFFERING ||
        state === window.YT.PlayerState.CUED
      ) {
        setPlayerReadyWithFallbackClear();
        testedVideoRef.current = null;
      }
    };
    // Isinama sa dependency array ang currentSongData para laging updated ang reference ng user id
  }, [currentVideoId, isTransferringHost, isHost, currentSongData, startHostMicrophone, stopHostMicrophoneAndSave, setPlayerReadyWithFallbackClear]);

  // Safety net: onReady/onStateChange skip updating isPlayerReady while
  // isTransferringHost is true (to avoid acting on a stale hand-off).
  useEffect(() => {
    if (!isTransferringHost && ytPlayerRef.current) {
      setIsPlayerReady(true);
    }
  }, [isTransferringHost]);

  // Load the IFrame API script once.
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      ytApiReadyRef.current = true;
      return;
    }
    if (!document.getElementById("youtube-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    window.onYouTubeIframeAPIReady = () => {
      ytApiReadyRef.current = true;
    };
  }, []);

  const createOrReloadPlayer = () => {
    if (!ytContainerRef.current) return;

    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.destroy();
      } catch {
        // ignore
      }
      ytPlayerRef.current = null;
    }

    resetPlayerReadyWithFallback();

    ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
      videoId: currentVideoId,
      playerVars: {
        modestbranding: 1,
        rel: 0,
        autoplay: 1,
        controls: 0,
        disablekb: 1,
      },
      events: {
        onReady: (event) => {
          try {
            event.target.mute();
          } catch (error) {
            console.warn("YouTube mute failed:", error);
          }
          try {
            event.target.playVideo();
          } catch (error) {
            console.warn("YouTube autoplay blocked or failed:", error);
          }
          onPlayerReadyRef.current();
        },
        onStateChange: (event) => onPlayerStateChangeRef.current(event.data),
        onError: () => onErrorRef.current(),
      },
    });
  };

  // Create / reload the player whenever the video changes.
  // Polls for BOTH the YT IFrame API *and* the container div, since the
  // container only exists once VideoPlayerPanel (gated on isHost) has
  // mounted — on the very first song these can flip true in the same
  // tick that currentVideoId first becomes non-empty, so a single
  // "container missing -> silently give up" check isn't enough.
  useEffect(() => {
    if (!canPlayCurrentVideo || isVideoRestricted || !currentVideoId) return;

    let cancelled = false;
    let pollId: number | undefined;

    const tryCreate = () => {
      if (cancelled) return false;
      if (!ytApiReadyRef.current || !ytContainerRef.current) return false;
      createOrReloadPlayer();
      return true;
    };

    if (!tryCreate()) {
      pollId = window.setInterval(() => {
        if (tryCreate() && pollId) {
          window.clearInterval(pollId);
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (pollId) window.clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideoId, playKey, canPlayCurrentVideo, isVideoRestricted, isHost]);

  // Independent safety-net timer: forces the loading overlay to clear
  // after 1.5s no matter what happened above (API never loaded, container
  // was slow to mount, event never fired, etc). Kept in its own effect,
  // separate from the polling/creation effect, so it can't get silently
  // dropped by an unrelated cleanup, and it reads isPlayerReady live via
  // the functional setState form instead of a stale closure.
  useEffect(() => {
    let initReadyTimer: number | undefined;

    if (!canPlayCurrentVideo || isVideoRestricted || !currentVideoId) {
      // KUNG WALANG KANTA, DAPAT READY ANG PLAYER (WALANG LOADING OVERLAY)
      clearReadyFallbackTimeout();
      readyFallbackTriggeredRef.current = false;
      initReadyTimer = window.setTimeout(() => {
        setIsPlayerReady(true);
      }, 0);
      return () => {
        if (initReadyTimer) {
          window.clearTimeout(initReadyTimer);
        }
      };
    }

    readyFallbackTriggeredRef.current = false;
    clearReadyFallbackTimeout();

    readyFallbackTimeoutRef.current = window.setTimeout(() => {
      setIsPlayerReady((ready) => {
        if (ready) return ready;
        readyFallbackTriggeredRef.current = true;
        console.warn("YouTube player ready fallback triggered for", currentVideoId);
        return true;
      });
    }, 1500);

    return () => {
      clearReadyFallbackTimeout();
      if (initReadyTimer) {
        window.clearTimeout(initReadyTimer);
      }
    };
  }, [currentVideoId, playKey, canPlayCurrentVideo, isVideoRestricted, clearReadyFallbackTimeout]);

  // Mute / unmute the live player when isMuted toggles.
  useEffect(() => {
    if (!ytPlayerRef.current) return;
    try {
      if (isMuted) {
        ytPlayerRef.current.mute();
      } else {
        ytPlayerRef.current.unMute();
      }
    } catch (e) {
      console.warn("[yt-player] mute/unmute call failed (safe to ignore):", e);
    }
  }, [isMuted]);

  // Destroy the player on unmount.
  useEffect(() => {
    return () => {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          console.warn("[yt-player] destroy on unmount failed (safe to ignore):", e);
        }
        ytPlayerRef.current = null;
      }
    };
  }, []);

  // Reset the "loading" title whenever the video changes (or replays).
  useEffect(() => {
    testedVideoRef.current = null;
  }, [playKey]);

  // A video that never calls onReady/onStateChange within 12s gets marked restricted
  useEffect(() => {
    if (!currentVideoId || isVideoRestricted) {
      testedVideoRef.current = null;
      return;
    }
    if (testedVideoRef.current === playKey) return;

    testedVideoRef.current = playKey;

    const timeoutId = window.setTimeout(() => {
      setIsPlayerReady((ready) => {
        if (ready) return ready;
        setRestrictedVideoIds((prev) => new Set(prev).add(currentVideoId));
        return ready;
      });
    }, 12000);

    return () => clearTimeout(timeoutId);
  }, [currentVideoId, playKey, isVideoRestricted]);

  const markPlayerNotReady = useCallback(() => setIsPlayerReady(false), []);
  const markVideoRestricted = useCallback(
    (videoId: string) => setRestrictedVideoIds((prev) => new Set(prev).add(videoId)),
    []
  );
  const markPlayerReady = useCallback(() => setIsPlayerReady(true), []);

  return {
    ytContainerRef,
    isPlayerReady,
    isMuted,
    setIsMuted,
    isVideoRestricted,
    markPlayerNotReady,
    markVideoRestricted,
    markPlayerReady,
  };
}