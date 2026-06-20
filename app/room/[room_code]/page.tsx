"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import type { User } from "@supabase/supabase-js";

type Room = {
  room_code: string;
  host_id: string;
  current_video_id?: string | null;
  is_playing?: boolean;
};

type QueueEntry = {
  id: string;
  room_code: string;
  video_id: string;
  title: string;
  thumbnail?: string | null;
  added_by?: string | null;
  created_at?: string;
};

type PresenceUser = {
  user_id: string;
  email: string;
  display_name: string;
  is_host: boolean;
};

type YouTubeVideo = {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails: {
      default: { url: string };
    };
  };
};

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// ─── YouTube IFrame Player API types (minimal) ──────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId: string;
          host?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayerInstance {
  destroy: () => void;
  mute: () => void;
  unMute: () => void;
  playVideo: () => void;
  loadVideoById: (videoId: string) => void;
}

export default function RoomPage() {
  const { room_code } = useParams();
  const roomCode = (Array.isArray(room_code) ? room_code[0] : room_code) ?? "";
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"queue" | "users">("queue");
  const [room, setRoom] = useState<Room | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [users, setUsers] = useState<Map<string, PresenceUser>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [badVideoIds, setBadVideoIds] = useState<Set<string>>(new Set());
  const [restrictedVideoIds, setRestrictedVideoIds] = useState<Set<string>>(new Set());
  const supabase = useMemo(() => createClient(), []);
  const queueRef = useRef<QueueEntry[]>([]);
  const testedVideoRef = useRef<string | null>(null);
  const currentVideoId = room?.current_video_id?.trim() ?? "";
  const canPlayCurrentVideo = YOUTUBE_VIDEO_ID_PATTERN.test(currentVideoId);
  const shouldPlay = Boolean(canPlayCurrentVideo);
  const isVideoRestricted = restrictedVideoIds.has(currentVideoId);

  // ─── YouTube IFrame Player API refs ─────────────────────────────────────
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytApiReadyRef = useRef(false);
  // Always-current callback refs so the YT event handlers (set up once)
  // never call stale closures.
  const onPlayerEndedRef = useRef<() => void>(() => {});
  const onPlayerErrorRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!roomCode) return;

    let isMounted = true;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Bail out if this effect instance was already cleaned up
      // (React Strict Mode double-invokes effects in dev)
      if (!isMounted) return;
      setCurrentUser(user);

      const { data: roomData } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", roomCode)
        .single();

      const { data: queueData } = await supabase
        .from("queue")
        .select("*")
        .eq("room_code", roomCode)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (roomData) {
        setRoom(roomData);
        setIsHost(user?.id === roomData.host_id);
      }
      if (queueData) setQueue(queueData);

      // ─── Realtime channel (queue + room + presence) ──────────────────────
      const channel = supabase.channel(`room:${roomCode}`, {
        config: { presence: { key: user?.id ?? "anon" } },
      });

      // Store the channel immediately so cleanup can always find it,
      // even if this effect instance gets cancelled mid-setup.
      activeChannel = channel;

      // Queue: INSERT
      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "queue", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setQueue((prev) => {
            const newEntry = payload.new as QueueEntry;
            if (prev.find((s) => s.id === newEntry.id)) return prev;
            return [...prev, newEntry];
          });
        }
      );

      // Queue: DELETE
      channel.on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "queue", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const oldEntry = payload.old as Pick<QueueEntry, "id">;
          setQueue((prev) => prev.filter((s) => s.id !== oldEntry.id));
        }
      );

      // Room: UPDATE (host changed current video)
      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const newRoom = payload.new as Room;
          setRoom((prevRoom) => {
            // Only reset the player-ready/mute state when the video itself
            // actually changed. Without this guard, ANY room update — like
            // the realtime echo of the host's own playNext() write, or an
            // unrelated is_playing toggle — would reset isPlayerReady back
            // to false even after the video had already loaded fine,
            // causing the 8/12s timeout to fire on a working video.
            const videoChanged =
              (prevRoom?.current_video_id ?? null) !== (newRoom?.current_video_id ?? null);
            if (videoChanged) {
              setIsPlayerReady(false);
              // Note: isMuted is intentionally NOT reset here — once the
              // user unmutes, it should stay unmuted across subsequent
              // songs instead of re-muting on every video change.
            }
            return newRoom;
          });
        }
      );

      // Presence: sync → rebuild users map
      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          user_id: string;
          email: string;
          display_name: string;
          is_host: boolean;
        }>();
        const map = new Map<string, PresenceUser>();
        Object.values(state).forEach((presences) => {
          presences.forEach((p) => map.set(p.user_id, p));
        });
        setUsers(map);
      });

      // Presence: join → add user
      channel.on("presence", { event: "join" }, ({ newPresences }) => {
        setUsers((prev) => {
          const next = new Map(prev);
          newPresences.forEach((p) => {
            const presence = p as unknown as PresenceUser;
            next.set(presence.user_id, presence);
          });
          return next;
        });
      });

      // Presence: leave → remove user
      channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
        setUsers((prev) => {
          const next = new Map(prev);
          leftPresences.forEach((p) => {
            const presence = p as unknown as PresenceUser;
            next.delete(presence.user_id);
          });
          return next;
        });
      });

      // If cleanup already ran before we got here, don't subscribe at all
      if (!isMounted) {
        supabase.removeChannel(channel);
        activeChannel = null;
        return;
      }

      await channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user) {
          // Broadcast this user's presence info
          await channel.track({
            user_id: user.id,
            email: user.email ?? "",
            display_name:
              user.user_metadata?.full_name ??
              user.user_metadata?.name ??
              user.email?.split("@")[0] ??
              "Guest",
            is_host: user.id === roomData?.host_id,
          });
        }
      });
    };

    fetchData();

    return () => {
      isMounted = false;
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
    };
  }, [roomCode, supabase]);

  // ─── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsLoading(true);
        try {
          const res = await fetch(
            `/api/search?q=${encodeURIComponent(searchQuery + " karaoke")}`
          );
          const data = await res.json();
          setSearchResults(data);
        } catch (e) {
          console.error(e);
        }
        setIsLoading(false);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ─── Add to queue ──────────────────────────────────────────────────────────
  const addToQueue = async (video: YouTubeVideo) => {
    // 1. Authentication check
    if (!currentUser) {
      alert("Please log in to add songs.");
      return;
    }

    // 2. Authorization check: Host lang ang pwedeng mag-add
    if (!isHost) {
      alert("Only the host can add songs to the queue.");
      return;
    }

    // 3. Validation
    if (!YOUTUBE_VIDEO_ID_PATTERN.test(video.id.videoId)) {
      alert("This video cannot be queued.");
      return;
    }

    // 4. Ihanda ang data (Wala nang upsert dito para iwas RLS error)
    // Tandaan: Ang pag-sync sa 'songs' table ay nasa /api/search/route.ts na
    const newEntry = {
      room_code: roomCode,
      video_id: video.id.videoId,
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails.default.url,
      added_by: currentUser.id,
    };

    // 5. Optimistic update (para ramdam agad ang bilis sa UI)
    const tempId = `temp-${video.id.videoId}-${Date.now()}`;
    setQueue((prev) => [...prev, { ...newEntry, id: tempId }]);
    setSearchResults([]);
    setSearchQuery("");

    // 6. Insert sa queue table
    const { error, data } = await supabase
      .from("queue")
      .insert([newEntry])
      .select()
      .single();

    if (error) {
      console.error("Add to queue error:", error);
      // Roll back UI kung may error
      setQueue((prev) => prev.filter((s) => s.id !== tempId));
      alert("Failed to add song: " + error.message);
    } else {
      // I-replace ang temp entry ng data galing sa DB
      setQueue((prev) =>
        prev.map((s) => (s.id === tempId ? data : s))
      );
    }
  };

  // Keep queueRef always current so playNext never reads stale closure
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // ─── Play next (host only) ─────────────────────────────────────────────────
  const playNext = useCallback(async () => {
    // 1. Kuhanin ang pinaka-unang kanta sa queue
    const nextSong = queueRef.current.find(s => !s.id.startsWith("temp-"));

    if (!nextSong) {
      console.log("[playNext] Queue empty, clearing player");
      // Walang susunod na kanta, i-clear ang player sa DB
      await supabase.from("rooms").update({ current_video_id: null, is_playing: false }).eq("room_code", roomCode);
      return;
    }

    console.log("[playNext] Playing:", nextSong.title);

    // 2. I-update ang UI state para ramdam agad (Optimistic)
    setIsPlayerReady(false);
    setRoom((prev) => (prev ? { ...prev, current_video_id: nextSong.video_id, is_playing: true } : prev));
    
    // Tanggalin na sa local queue
    setQueue((prev) => prev.filter((s) => s.id !== nextSong.id));

    // 3. I-update ang DB (Room at Queue sa iisang batch kung kaya, pero sige isa-isa para safe)
    const { error: roomErr } = await supabase
      .from("rooms")
      .update({ 
        current_video_id: nextSong.video_id,
        is_playing: true 
      })
      .eq("room_code", roomCode);

    const { error: queueErr } = await supabase
      .from("queue")
      .delete()
      .eq("id", nextSong.id);

    if (roomErr || queueErr) {
      console.error("Database update failed:", roomErr || queueErr);
      // Optional: Mag-re-fetch kung nag-fail
      alert("Nagka-error sa pag-play ng kanta.");
    }
  }, [roomCode, supabase]);

  const handlePlayerError = useCallback(async () => {
    console.warn("YouTube video unavailable (restricted/not found):", currentVideoId);

    setIsPlayerReady(false);

    if (currentVideoId) {
      // Mark video as restricted
      setRestrictedVideoIds((prev) => new Set(prev).add(currentVideoId));
    }

    if (isHost) {
      if (queue.length > 0) {
        // Go directly to next song — playNext will update current_video_id in DB
        void playNext();
      } else {
        // No songs left, just clear the player
        await supabase
          .from("rooms")
          .update({ current_video_id: null })
          .eq("room_code", roomCode);
      }
    }
  }, [currentVideoId, isHost, playNext, queue.length, roomCode, supabase]);

  // Keep the always-current refs in sync so YT event handlers (registered
  // once per player instance) never read a stale playNext/handlePlayerError.
  useEffect(() => {
    onPlayerEndedRef.current = () => {
      if (isHost) void playNext();
    };
    onPlayerErrorRef.current = () => {
      void handlePlayerError();
    };
  }, [isHost, playNext, handlePlayerError]);

  // ─── Load the YouTube IFrame Player API script once ────────────────────
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

  // ─── Create / recreate the YT player whenever the video changes ───────────
  // Always-current handlers for ready/state-change, set fresh on every
  // render so the listeners registered once at player construction time
  // never read a stale `currentVideoId` or a `cancelled` flag from a
  // previous effect run (that was the root cause of swapped videos via
  // loadVideoById going silently unacknowledged).
  const onPlayerReadyRef = useRef<() => void>(() => {});
  const onPlayerStateChangeRef = useRef<(state: number) => void>(() => {});

  useEffect(() => {
    onPlayerReadyRef.current = () => {
      console.log("[player-ready] Video loaded successfully:", currentVideoId);
      setIsPlayerReady(true);
      testedVideoRef.current = null;
    };
    onPlayerStateChangeRef.current = (state: number) => {
      console.log("[player-state-change]", currentVideoId, "state:", state);
      if (state === window.YT.PlayerState.ENDED) {
        onPlayerEndedRef.current();
      } else if (
        state === window.YT.PlayerState.PLAYING ||
        state === window.YT.PlayerState.BUFFERING
      ) {
        setIsPlayerReady(true);
        testedVideoRef.current = null;
      }
    };
  }, [currentVideoId]);

  useEffect(() => {
    if (!canPlayCurrentVideo || isVideoRestricted || !currentVideoId) return;

    let pollId: number | undefined;

    const loadOrCreate = () => {
      if (!ytContainerRef.current) return;

      // If a player instance already exists, just swap the video in place —
      // far faster than destroying and rebuilding the iframe from scratch.
      // Its event listeners (registered once below) stay attached and
      // delegate to the always-current refs above, so this swap is picked
      // up correctly regardless of which effect run originally created it.
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.loadVideoById(currentVideoId);
          return;
        } catch (e) {
          console.warn("[yt-player] loadVideoById failed, recreating player:", e);
          try {
            ytPlayerRef.current.destroy();
          } catch {
            // ignore — instance was already broken
          }
          ytPlayerRef.current = null;
        }
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
          onStateChange: (event) => {
            onPlayerStateChangeRef.current(event.data);
          },
          onError: () => {
            onPlayerErrorRef.current();
          },
        },
      });
    };

    if (ytApiReadyRef.current) {
      loadOrCreate();
    } else {
      // Poll until the IFrame API script has finished loading.
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
  }, [currentVideoId, canPlayCurrentVideo, isVideoRestricted]);

  // ─── Keep mute state in sync with the live player ──────────────────────
  useEffect(() => {
    // Guard on isPlayerReady (set by the real YT onReady event), not just
    // ref existence — the ref is assigned synchronously when we call
    // `new window.YT.Player(...)`, but the instance's methods aren't
    // actually callable until its internal iframe has finished initializing.
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

  // ─── Tear down the player fully on unmount ─────────────────────────────
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

  // ─── Detect stuck/restricted videos with timeout (once per video) ─────────────
  useEffect(() => {
    if (!currentVideoId || isVideoRestricted) {
      testedVideoRef.current = null;
      return;
    }

    // Only test once per video
    if (testedVideoRef.current === currentVideoId) return;

    console.log("[timeout-detector] Starting test for video:", currentVideoId);
    testedVideoRef.current = currentVideoId;

    // Set timeout to detect if video doesn't load within 8 seconds.
    // We check isPlayerReady at fire-time (not just at schedule-time) because
    // this effect intentionally only runs once per video — it does NOT re-run
    // when onReady later flips isPlayerReady to true, so the timeout must
    // self-check rather than rely on a cleanup re-run to cancel it.
    const timeoutId = window.setTimeout(() => {
      setIsPlayerReady((ready) => {
        if (ready) {
          console.log("[timeout-detector] Video already ready, skipping timeout:", currentVideoId);
          return ready;
        }
        console.warn(
          "[timeout-detector] Video timed out:", currentVideoId,
          "| ytPlayer exists:", Boolean(ytPlayerRef.current),
          "| testedVideoRef:", testedVideoRef.current
        );
        setRestrictedVideoIds((prev) => new Set(prev).add(currentVideoId));
        return ready;
      });
    }, 12000);

    return () => clearTimeout(timeoutId);
  }, [currentVideoId, isVideoRestricted]);

  // ─── Auto-skip restricted videos ──────────────────────────────────────────────
  useEffect(() => {
    if (!isVideoRestricted || !isHost) return;

    const skipTimer = window.setTimeout(() => {
      if (queueRef.current.length > 0) {
        void playNext();
      } else {
        void supabase
          .from("rooms")
          .update({ current_video_id: null })
          .eq("room_code", roomCode);
      }
    }, 500);

    return () => clearTimeout(skipTimer);
  }, [isVideoRestricted, isHost, playNext, roomCode, supabase]);

  useEffect(() => {
    console.log("[autoplay-check]", {
      isHost,
      current_video_id: room?.current_video_id,
      queueLength: queue.length,
      queueIds: queue.map((s) => s.id),
    });

    if (!isHost || room?.current_video_id || queue.length === 0) return;

    // If every entry currently in the queue is still a temp (optimistic)
    // entry, the DB insert hasn't resolved yet — playNext would no-op.
    // Retry shortly until a real entry shows up instead of giving up silently.
    const allTemp = queue.every((song) => song.id.startsWith("temp-"));
    const delay = allTemp ? 300 : 0;

    console.log("[autoplay-trigger] will call playNext in", delay, "ms. allTemp:", allTemp);

    const timer = window.setTimeout(() => {
      console.log("[autoplay-trigger] calling playNext now");
      void playNext();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isHost, playNext, queue, room?.current_video_id]);

  // ─── Remove from queue (host only) ────────────────────────────────────────
  const removeFromQueue = async (id: string) => {
    setQueue((prev) => prev.filter((s) => s.id !== id));
    const { error } = await supabase.from("queue").delete().eq("id", id);
    if (error) {
      console.error("Remove error:", error);
      // Re-fetch on failure
      const { data } = await supabase
        .from("queue")
        .select("*")
        .eq("room_code", roomCode)
        .order("created_at", { ascending: true });
      if (data) setQueue(data);
    }
  };

  // ─── Leave room ────────────────────────────────────────────────────────────
  const leaveRoom = () => {
    // Presence auto-untrack when channel is removed on unmount
    router.push("/dashboard");
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#050505] text-white p-6">
    {/* Header */}
<header className="grid grid-cols-3 items-center pb-6 border-b border-white/10 mb-8 w-full">
  
  {/* KALIWA: QR Code at Room Code Info */}
  <div className="flex items-center gap-6 justify-self-start">
    <QRCodeSVG
      value={`https://musiciana.vercel.app/room/${roomCode}`}
      size={50}
    />
    <div>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
        Room Code
      </p>
      <h1 className="text-xl font-black text-pink-500">{roomCode}</h1>
    </div>
  </div>

  {/* GITNA: Main System Title (MUSICIANA) */}
  <div className="text-center justify-self-center">
    <h1 className="text-3xl font-black text-white tracking-[0.2em] uppercase">
      MUSICIANA
    </h1>

  </div>

  {/* KANAN: Mga Buttons / Actions */}
  <div className="flex items-center gap-3 justify-self-end">
    {isHost && queue.length > 0 && (
      <button
        onClick={playNext}
        className="text-xs font-bold text-green-400 hover:bg-green-500/10 px-4 py-2 rounded-lg border border-green-500/20"
      >
        ▶ PLAY NEXT
      </button>
    )}
    <button
      onClick={leaveRoom}
      className="text-xs font-bold text-red-400 hover:bg-red-500/10 px-4 py-2 rounded-lg"
    >
      LEAVE ROOM 🚪
    </button>
  </div>

</header>

      {/* Main layout */}
      <div className="grid md:grid-cols-3 gap-8">
        {/* Video player */}
        <div
          className="md:col-span-2 h-[500px] bg-black rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center relative"
        >
          {/* The YT container div is ALWAYS mounted — never conditionally
              removed — so the player instance never gets orphaned from its
              DOM node. All other states (loading / restricted / invalid)
              render as overlays on top of it instead of replacing it. */}
          <div className="w-full h-full">
            <div ref={ytContainerRef} className="w-full h-full" />
          </div>

          {currentVideoId ? (
            <>
              {!canPlayCurrentVideo ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                  <p className="text-zinc-500 text-sm">Invalid video. Loading next song...</p>
                </div>
              ) : isVideoRestricted ? (
                // ─── Auto-skip: video unavailable/restricted ────────────
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black z-10">
                  <div className="text-3xl animate-pulse">⏭️</div>
                  <p className="text-xs text-zinc-500">Skipping unavailable video...</p>
                </div>
              ) : (
                !isPlayerReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-2">
                    <div className="text-4xl animate-pulse">⏳</div>
                    <p className="text-xs text-zinc-400">Loading video...</p>
                  </div>
                )
              )}
              {/* Unmute overlay — shown until user clicks */}
              {canPlayCurrentVideo && !isVideoRestricted && isMuted && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(false);
                    if(isHost) supabase.from("rooms").update({ is_playing: true }).eq("room_code", roomCode);
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3 group"
                >
                  <span className="text-4xl group-hover:scale-110 transition-transform">🔇</span>
                  <span className="text-xs text-zinc-300 font-bold tracking-widest uppercase">
                    Click to unmute
                  </span>
                </button>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <p className="text-zinc-500 text-sm">
                {isHost ? "Search for a song to get started 🎤" : "Waiting for host to play a song…"}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="bg-zinc-900/30 rounded-2xl border border-white/5 p-4 h-[500px] flex flex-col">
          {/* Tabs */}
          <div className="flex gap-4 mb-4 border-b border-white/5">
            <button
              onClick={() => setActiveTab("queue")}
              className={`pb-2 text-xs font-bold ${
                activeTab === "queue" ? "text-pink-500" : "text-zinc-500"
              }`}
            >
              SONG QUEUE{" "}
              {queue.length > 0 && (
                <span className="ml-1 bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-full">
                  {queue.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`pb-2 text-xs font-bold ${
                activeTab === "users" ? "text-pink-500" : "text-zinc-500"
              }`}
            >
              USERS{" "}
              {users.size > 0 && (
                <span className="ml-1 bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">
                  {users.size}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* ── Queue tab ── */}
            {activeTab === "queue" && (
              <>
                {/* Search */}
                <input
                  placeholder="Search karaoke…"
                  className="w-full bg-black border border-white/10 p-2 rounded text-xs"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  value={searchQuery}
                />
                {isLoading && (
                  <p className="text-[10px] text-zinc-500 mt-2">
                    Searching…
                  </p>
                )}

                {/* Search results */}
                {searchResults.map((v) => (
                  <div
                    key={v.id.videoId}
                    onClick={() => addToQueue(v)}
                    className="p-2 bg-zinc-800 hover:bg-pink-500/20 cursor-pointer rounded mt-2 flex items-center gap-2"
                  >
                    <img
                      src={v.snippet?.thumbnails?.default?.url || "https://via.placeholder.com/40"}
                      className="w-8 h-8 rounded"
                      alt={v.snippet?.title || "Karaoke video"}
                    />
                    <p className="text-[10px] truncate">{v.snippet?.title || "Untitled"}</p>
                  </div>
                ))}

                {/* Queue list */}
                <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  {queue.length === 0 && (
                    <p className="text-[10px] text-zinc-600 text-center py-4">
                      Queue is empty — search for a song!
                    </p>
                  )}
                  {queue.map((s, i) => (
                    <div
                      key={s.id}
                      className="p-2 bg-zinc-800/50 rounded flex items-center gap-2"
                    >
                      {s.thumbnail && (
                        <img
                          src={s.thumbnail}
                          className="w-8 h-8 rounded flex-shrink-0"
                          alt=""
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] truncate">{s.title}</p>
                        <p className="text-[9px] text-zinc-500">
                          #{i + 1}
                        </p>
                      </div>
                      {isHost && (
                        <button
                          onClick={() => removeFromQueue(s.id)}
                          className="text-zinc-600 hover:text-red-400 text-xs ml-1 flex-shrink-0"
                          title="Remove"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Users tab ── */}
            {activeTab === "users" && (
              <div className="space-y-2 pt-1">
                {users.size === 0 && (
                  <p className="text-[10px] text-zinc-600 text-center py-4">
                    No users in room yet.
                  </p>
                )}
                {/* Host always first */}
                {Array.from(users.values())
                  .sort((a, b) => (b.is_host ? 1 : 0) - (a.is_host ? 1 : 0))
                  .map((u) => (
                    <div
                      key={u.user_id}
                      className={`flex items-center gap-3 p-2 rounded ${
                        u.is_host
                          ? "bg-pink-500/10 border border-pink-500/20"
                          : "bg-zinc-800/50"
                      }`}
                    >
                      {/* Avatar initial */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          u.is_host
                            ? "bg-pink-500/30 text-pink-300"
                            : "bg-zinc-700 text-zinc-300"
                        }`}
                      >
                        {(u.display_name?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate font-medium">
                          {u.display_name}
                          {u.user_id === currentUser?.id && (
                            <span className="ml-1 text-zinc-500">(you)</span>
                          )}
                        </p>
                        {u.is_host && (
                          <p className="text-[9px] text-pink-400 font-bold uppercase tracking-wider">
                            👑 Host
                          </p>
                        )}
                      </div>
                      {/* Online dot */}
                      <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}