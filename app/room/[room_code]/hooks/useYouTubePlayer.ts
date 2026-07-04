import { useEffect, useRef, useState } from "react";
import type { YTPlayerInstance } from "../types";

type Params = {
  currentVideoId: string;
  canPlayCurrentVideo: boolean;
  isHost: boolean;
  isTransferringHost: boolean;
  onEnded: () => void;
  onError: () => void;
};

/**
 * Everything about the actual <iframe> YouTube player: loading the
 * IFrame API script once, creating/recreating the player when the
 * video or host changes, mute/unmute, and detecting videos that never
 * fire onReady (restricted/region-locked/etc).
 */
export function useYouTubePlayer({
  currentVideoId,
  canPlayCurrentVideo,
  isHost,
  isTransferringHost,
  onEnded,
  onError,
}: Params) {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [restrictedVideoIds, setRestrictedVideoIds] = useState<Set<string>>(new Set());

  const isVideoRestricted = restrictedVideoIds.has(currentVideoId);

  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytApiReadyRef = useRef(false);
  const testedVideoRef = useRef<string | null>(null);

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
        setIsPlayerReady(true);
        testedVideoRef.current = null;
      }
    };
   // BAGONG CODE - Ipalit sa onPlayerStateChangeRef.current
onPlayerStateChangeRef.current = (state: number) => {
  if (isTransferringHost) return;
  
  if (state === window.YT.PlayerState.ENDED) {
    // Siguraduhing burado ang loading overlay kapag tapos na
    setIsPlayerReady(true); 
    onEndedRef.current();
  } else if (
    state === window.YT.PlayerState.PLAYING || 
    state === window.YT.PlayerState.BUFFERING ||
    state === window.YT.PlayerState.CUED
  ) {
    setIsPlayerReady(true);
    testedVideoRef.current = null;
  }
};
  }, [currentVideoId, isTransferringHost]);

  // Safety net: onReady/onStateChange skip updating isPlayerReady while
  // isTransferringHost is true (to avoid acting on a stale hand-off).
  // If that window closes while a player already exists, the video is
  // almost certainly already playing underneath — don't leave the
  // "Loading..." overlay stuck forever waiting for an event that may
  // never fire again during smooth playback.
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

  // Create / reload the player whenever the video changes.
  useEffect(() => {
    if (!canPlayCurrentVideo || isVideoRestricted || !currentVideoId) return;

    let pollId: number | undefined;

    const loadOrCreate = () => {
      if (!ytContainerRef.current) return;

      if (ytPlayerRef.current) {
        const hostChanged = prevIsHostRef.current !== isHost;
        if (!hostChanged) {
          try {
            ytPlayerRef.current.loadVideoById(currentVideoId);
            return;
          } catch (e) {
            console.warn("[yt-player] loadVideoById failed, recreating player:", e);
          }
        }
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }

      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        videoId: currentVideoId,
        playerVars: {
          modestbranding: 1,
          rel: 0,
          autoplay: 1,
          controls: isHost ? 1 : 0,
        },
        events: {
          onReady: (event) => {
            if (isMuted) event.target.mute();
            event.target.playVideo();
            onPlayerReadyRef.current();
          },
          onStateChange: (event) => onPlayerStateChangeRef.current(event.data),
          onError: () => onErrorRef.current(),
        },
      });
    };

    if (ytApiReadyRef.current) {
      loadOrCreate();
    } else {
      pollId = window.setInterval(() => {
        if (ytApiReadyRef.current) {
          window.clearInterval(pollId);
          loadOrCreate();
        }
      }, 100);
    }

    return () => {
      if (pollId) window.clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideoId, canPlayCurrentVideo, isVideoRestricted, isHost]);

  // Mute / unmute the live player when isMuted toggles.
  useEffect(() => {
    if (!ytPlayerRef.current || !isPlayerReady) return;
    try {
      if (isMuted) {
        ytPlayerRef.current.mute();
      } else {
        ytPlayerRef.current.unMute();
      }
    } catch (e) {
      console.warn("[yt-player] mute/unmute call failed (safe to ignore):", e);
    }
  }, [isMuted, isPlayerReady]);

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

  // Reset the "loading" title whenever the video changes.
  useEffect(() => {
    testedVideoRef.current = null;
  }, [currentVideoId]);

  // A video that never calls onReady/onStateChange within 12s gets
  // marked restricted so the host's queue can move on.
  useEffect(() => {
    if (!currentVideoId || isVideoRestricted) {
      testedVideoRef.current = null;
      return;
    }
    if (testedVideoRef.current === currentVideoId) return;

    testedVideoRef.current = currentVideoId;

    const timeoutId = window.setTimeout(() => {
      setIsPlayerReady((ready) => {
        if (ready) return ready;
        setRestrictedVideoIds((prev) => new Set(prev).add(currentVideoId));
        return ready;
      });
    }, 12000);

    return () => clearTimeout(timeoutId);
  }, [currentVideoId, isVideoRestricted]);

// ...iyong mga dating useEffect sa itaas nito...

  const markPlayerNotReady = () => setIsPlayerReady(false);
  const markVideoRestricted = (videoId: string) =>
    setRestrictedVideoIds((prev) => new Set(prev).add(videoId));

  // 1. IDAGDAG ITONG LINYA NA ITO RITO:
  const markPlayerReady = () => setIsPlayerReady(true); 

  return {
    ytContainerRef,
    isPlayerReady,
    isMuted,
    setIsMuted,
    isVideoRestricted,
    markPlayerNotReady,
    markVideoRestricted,
    markPlayerReady, // 2. ISAMA ITONG LINYA NA ITO SA RETURN OBJECT
  };
}