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
  const roomUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${roomCode}`
    : `https://musiciana.vercel.app/room/${roomCode}`;
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
  const [isTransferringHost, setIsTransferringHost] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const queueRef = useRef<QueueEntry[]>([]);
  const testedVideoRef = useRef<string | null>(null);
  const currentVideoId = room?.current_video_id?.trim() ?? "";
  const canPlayCurrentVideo = YOUTUBE_VIDEO_ID_PATTERN.test(currentVideoId);
  const shouldPlay = Boolean(canPlayCurrentVideo);
  const isVideoRestricted = restrictedVideoIds.has(currentVideoId);
  const [isQrOpen, setIsQrOpen] = useState(false);

  // ─── YouTube IFrame Player API refs ─────────────────────────────────────
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytApiReadyRef = useRef(false);
  const emptyRoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const onPlayerEndedRef = useRef<() => void>(() => {});
  const onPlayerErrorRef = useRef<() => void>(() => {});
  const [recommendations, setRecommendations] = useState<{ title: string; artist: string }[]>([]);
  const [isFetchingRecs, setIsFetchingRecs] = useState(false);
  const [isAddingRec, setIsAddingRec] = useState(false); // ANTI-TADTAD GUARD STATE

  const refreshQueue = useCallback(async () => {
    if (!roomCode) return;
    const { data } = await supabase
      .from("queue")
      .select("*")
      .eq("room_code", roomCode)
      .order("created_at", { ascending: true });

    if (data) {
      setQueue(data);
    }
  }, [roomCode, supabase]);

  const transferHost = useCallback(async (newHostId: string) => {
    if (!roomCode || !room?.host_id || room.host_id === newHostId) return;
    setIsTransferringHost(true);

    const { error } = await supabase
      .from("rooms")
      .update({ host_id: newHostId })
      .eq("room_code", roomCode)
      .eq("host_id", room.host_id);

    if (error) {
      console.error("Host transfer failed:", error);
    } else {
      setRoom((prev) => prev ? { ...prev, host_id: newHostId } : prev);
      setIsHost(currentUser?.id === newHostId);
      setUsers((prev) => {
        const next = new Map(prev);
        next.forEach((user, id) => {
          next.set(id, { ...user, is_host: id === newHostId });
        });
        return next;
      });
    }

    setIsTransferringHost(false);
  }, [roomCode, room?.host_id, supabase, currentUser?.id]);

  useEffect(() => {
    if (!roomCode) return;

    let isMounted = true;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      const channel = supabase.channel(`room:${roomCode}`, {
        config: { presence: { key: user?.id ?? "anon" } },
      });

      activeChannel = channel;

      channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "queue", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const newEntry = payload.new as QueueEntry;
          setQueue((prev) => {
            if (prev.find((s) => String(s.id) === String(newEntry.id))) return prev;
            return [...prev, newEntry];
          });
        }
      );

      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "queue", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const updatedEntry = payload.new as QueueEntry;
          setQueue((prev) => {
            const exists = prev.some((s) => String(s.id) === String(updatedEntry.id));
            if (!exists) {
              void refreshQueue();
              return prev;
            }
            return prev.map((s) => String(s.id) === String(updatedEntry.id) ? updatedEntry : s);
          });
        }
      );
      channel.on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "queue", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const oldEntry = payload.old as Pick<QueueEntry, "id"> | null;
          if (!oldEntry?.id) {
            void refreshQueue();
            return;
          }
          setQueue((prev) => prev.filter((s) => String(s.id) !== String(oldEntry.id)));
        }
      );

      channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const newRoom = payload.new as Room;
          setRoom((prevRoom) => {
            const videoChanged =
              (prevRoom?.current_video_id ?? null) !== (newRoom?.current_video_id ?? null);
            if (videoChanged) {
              setIsPlayerReady(false);
              void refreshQueue();
            }
            return newRoom;
          });
        }
      );

      channel.on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "rooms", filter: `room_code=eq.${roomCode}` },
        () => {
          router.push("/dashboard");
        }
      );

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

        const totalUsers = Object.values(state).flat().length;
        if (totalUsers === 0) {
          if (!emptyRoomTimerRef.current) {
            emptyRoomTimerRef.current = setTimeout(async () => {
              const latestState = channel.presenceState();
              const latestCount = Object.values(latestState).flat().length;
              if (latestCount === 0) {
                try {
                  await fetch("/api/delete-room", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ room_code: roomCode }),
                  });
                  console.log(`[auto-delete] Room ${roomCode} deleted.`);
                } catch (err) {
                  console.error("[auto-delete] Failed:", err);
                }
              }
              emptyRoomTimerRef.current = null;
            }, 5000);
          }
        } else {
          if (emptyRoomTimerRef.current) {
            clearTimeout(emptyRoomTimerRef.current);
            emptyRoomTimerRef.current = null;
          }
        }
      });

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

      channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
        setUsers((prev) => {
          const next = new Map(prev);
          let hostLeft = false;

          leftPresences.forEach((p) => {
            const presence = p as unknown as PresenceUser;
            if (presence.is_host) {
              hostLeft = true;
            }
            next.delete(presence.user_id);
          });

          if (hostLeft && next.size > 0) {
            const nextHost = Array.from(next.values())[0];
            void transferHost(nextHost.user_id);
          }

          return next;
        });
      });

      channel.subscribe(async (status) => {
        console.log("[subscribe] status:", status);
        
        if (status === "SUBSCRIBED" && user && roomData && isMounted) {
          console.log("[subscribe] user found, tracking presence...");
          
          await channel.track({
            user_id: user.id,
            email: user.email || "",
            display_name:
              user.user_metadata?.display_name ||
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              (user.email
                ? user.email.split("@")[0].replace(/[._\-+]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                : "Guest"),
            is_host: user.id === roomData.host_id,
          });
          
          const upsertPresence = async () => {
            const { error } = await supabase.from("room_presence").upsert({
              room_code: roomCode,
              user_id: user.id,
              last_seen_at: new Date().toISOString(),
            });
            if (error) {
              console.error("[heartbeat] failed:", error.message);
            } else {
              console.log("[heartbeat] success:", roomCode);
            }
          };

          await upsertPresence();
          heartbeatInterval = setInterval(upsertPresence, 30000);
        }
      });
    };

    fetchData();

    return () => {
      isMounted = false;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (emptyRoomTimerRef.current) {
        clearTimeout(emptyRoomTimerRef.current);
        emptyRoomTimerRef.current = null;
      }
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
    };
  }, [roomCode, supabase, router]);

  const fetchRecommendations = useCallback(async () => {
    setIsFetchingRecs(true);
    try {
      const context = [
        room?.current_video_id ? `Currently playing: ${queue[0]?.title ?? "unknown"}` : null,
        queue.length > 0 ? `Queue: ${queue.map(s => s.title).join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(". ");

      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });

      if (!response.ok) throw new Error("Failed to fetch recommendations from server");

      const data = await response.json();
      const text = data.content?.map((b: { type: string; text?: string }) => b.text ?? "").join("") ?? "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setRecommendations(parsed);
    } catch (e) {
      console.error("[recommendations] failed:", e);
    }
    setIsFetchingRecs(false);
  }, [queue, room?.current_video_id]);

  useEffect(() => {
    if (activeTab === "queue" && recommendations.length === 0) {
      void fetchRecommendations();
    }
  }, [activeTab, recommendations.length, fetchRecommendations]);

  const addRecommendedToQueue = async (rec: { title: string; artist: string }) => {
    if (isAddingRec) return; // ANTI-TADTAD LOCK

    setIsAddingRec(true);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(rec.title + " " + rec.artist + " karaoke")}`);
      const results: YouTubeVideo[] = await res.json();
      if (results?.[0]) {
        await addToQueue(results[0]);
      }
    } catch (e) {
      console.error("[rec-add] failed:", e);
    }
    setIsLoading(false);
    setIsAddingRec(false); // RELEASE LOCK
  };

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

  const addToQueue = async (video: YouTubeVideo) => {
    if (!YOUTUBE_VIDEO_ID_PATTERN.test(video.id.videoId)) {
      alert("This video cannot be queued.");
      return;
    }

    const newEntry = {
      room_code: roomCode,
      video_id: video.id.videoId,
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails.default.url,
      added_by: currentUser?.id ?? null,
    };

    const tempId = `temp-${video.id.videoId}-${Date.now()}`;
    setQueue((prev) => [...prev, { ...newEntry, id: tempId }]);
    setSearchResults([]);
    setSearchQuery("");

    const { error, data } = await supabase
      .from("queue")
      .insert([newEntry])
      .select()
      .single();

    if (error) {
      console.error("Add to queue error:", error);
      setQueue((prev) => prev.filter((s) => s.id !== tempId));
      alert("Failed to add song: " + error.message);
    } else {
      setQueue((prev) =>
        prev.map((s) => (s.id === tempId ? data : s))
      );
    }
  };

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const playNext = useCallback(async () => {
    const nextSong = queueRef.current.find(s => !s.id.startsWith("temp-"));

    if (!nextSong) {
      console.log("[playNext] Queue empty, clearing player");
      await supabase.from("rooms").update({ current_video_id: null, is_playing: false }).eq("room_code", roomCode);
      await refreshQueue();
      return;
    }

    console.log("[playNext] Playing:", nextSong.title);

    setIsPlayerReady(false);
    setRoom((prev) => (prev ? { ...prev, current_video_id: nextSong.video_id, is_playing: true } : prev));
    setQueue((prev) => prev.filter((s) => String(s.id) !== String(nextSong.id)));

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
      alert("Nagka-error sa pag-play ng kanta.");
      await refreshQueue();
    }
  }, [roomCode, supabase, refreshQueue]);

  const handlePlayerError = useCallback(async () => {
    console.warn("YouTube video unavailable (restricted/not found):", currentVideoId);

    setIsPlayerReady(false);

    if (currentVideoId) {
      setRestrictedVideoIds((prev) => new Set(prev).add(currentVideoId));
    }

    if (isHost) {
      if (queue.length > 0) {
        void playNext();
      } else {
        await supabase
          .from("rooms")
          .update({ current_video_id: null })
          .eq("room_code", roomCode);
      }
    }
  }, [currentVideoId, isHost, playNext, queue.length, roomCode, supabase]);

  useEffect(() => {
    onPlayerEndedRef.current = () => {
      if (isHost) void playNext();
    };
    onPlayerErrorRef.current = () => {
      void handlePlayerError();
    };
  }, [isHost, playNext, handlePlayerError]);

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

      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.loadVideoById(currentVideoId);
          return;
        } catch (e) {
          console.warn("[yt-player] loadVideoById failed, recreating player:", e);
          try {
            ytPlayerRef.current.destroy();
          } catch {
            // ignore
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
  }, [currentVideoId, canPlayCurrentVideo, isVideoRestricted, isHost, isMuted]);

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

  useEffect(() => {
    if (!ytPlayerRef.current || !canPlayCurrentVideo) return;
    try {
      if (!isHost && room?.current_video_id && !isMuted) {
        ytPlayerRef.current.unMute();
      }
    } catch (e) {
      console.warn("[yt-player] forced unmute failed:", e);
    }
  }, [canPlayCurrentVideo, currentVideoId, isHost, isMuted, room?.current_video_id]);

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

  useEffect(() => {
    if (!currentVideoId || isVideoRestricted) {
      testedVideoRef.current = null;
      return;
    }

    if (testedVideoRef.current === currentVideoId) return;

    console.log("[timeout-detector] Starting test for video:", currentVideoId);
    testedVideoRef.current = currentVideoId;

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

    const allTemp = queue.every((song) => song.id.startsWith("temp-"));
    const delay = allTemp ? 300 : 0;

    console.log("[autoplay-trigger] will call playNext in", delay, "ms. allTemp:", allTemp);

    const timer = window.setTimeout(() => {
      console.log("[autoplay-trigger] calling playNext now");
      void playNext();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isHost, playNext, queue, room?.current_video_id]);

  const removeFromQueue = async (id: string) => {
    setQueue((prev) => prev.filter((s) => s.id !== id));
    const { error } = await supabase.from("queue").delete().eq("id", id);
    if (error) {
      console.error("Remove error:", error);
      const { data } = await supabase
        .from("queue")
        .select("*")
        .eq("room_code", roomCode)
        .order("created_at", { ascending: true });
      if (data) setQueue(data);
    }
  };

  const leaveRoom = async () => {
    if (isHost && room?.host_id) {
      const otherUsers = Array.from(users.values()).filter((u) => u.user_id !== currentUser?.id);
      if (otherUsers.length > 0) {
        await transferHost(otherUsers[0].user_id);
      }
    }
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white p-6">
<header className="w-full border-b border-white/10 pb-4 mb-6">
  {/* MAIN HEADER CONTAINER */}
  <div className="grid grid-cols-2 md:flex md:items-center md:justify-between gap-4 items-center w-full">
    
    {/* LEFT/TOP-LEFT — BRAND (Mas magandang unahin ito para sa natural reading hierarchy) */}
    <h1 className="text-base md:text-xl font-black text-white tracking-[0.2em] uppercase order-1">
      MUSICIANA
    </h1>

    {/* RIGHT/TOP-RIGHT — ACTIONS */}
    <div className="flex items-center justify-end gap-2 order-2 md:order-3 flex-shrink-0">
      {isHost && queue.length > 0 && (
        <button
          onClick={playNext}
          className="text-[11px] font-bold text-green-400 hover:bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20 transition-colors flex items-center gap-1"
        >
          <span>▶</span> <span>Next</span>
        </button>
      )}
      <button
        onClick={leaveRoom}
        className="text-[11px] font-bold text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors flex items-center gap-1"
      >
        <span>Leave</span> <span>🚪</span>
      </button>
    </div>

    {/* BOTTOM ROW (Mobile) / CENTER-LEFT (Desktop) — QR + Room Code */}
    <div className="col-span-2 md:col-span-1 flex items-center gap-3 bg-zinc-900/50 md:bg-transparent p-2 md:p-0 rounded-xl border border-white/5 md:border-0 order-3 md:order-2 min-w-0">
      {/* QR Code Trigger */}
      <div
        onClick={() => setIsQrOpen(true)}
        className="cursor-pointer p-1.5 bg-white rounded-lg hover:scale-105 active:scale-95 transition-transform flex-shrink-0 group relative shadow-md"
        title="Click to enlarge"
      >
        <QRCodeSVG value={`https://musiciana.vercel.app/room/${roomCode}`} size={32} />
        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[9px] text-white font-bold">🔍</span>
        </div>
      </div>
      
      {/* Code Text & Copy */}
      <div className="min-w-0">
        <p className="text-[9px] text-zinc-500 uppercase tracking-widest leading-none mb-1 font-semibold">
          Room Code
        </p>
        <button
          onClick={() => navigator.clipboard.writeText(roomCode)}
          className="flex items-center gap-1.5 group active:scale-95 transition-transform"
          title="Copy code"
        >
          <span className="text-sm md:text-base font-black text-pink-500 tracking-wider font-mono">
            {roomCode}
          </span>
          <span className="text-zinc-600 group-hover:text-zinc-300 transition-colors text-xs">
            ⎘
          </span>
        </button>
      </div>
    </div>

  </div>

  {/* ─── QR CODE PREVIEW MODAL (Walang binago rito dahil goods na ito) ─── */}
  {isQrOpen && (
    <div 
      onClick={() => setIsQrOpen(false)} 
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 animate-fade-in"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-zinc-950 border border-white/10 p-8 rounded-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center relative shadow-2xl shadow-pink-500/10 scale-up-animation"
      >
        <button 
          onClick={() => setIsQrOpen(false)}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white text-lg transition-colors"
        >
          ✕
        </button>

        <div>
          <h2 className="text-xl font-black text-white tracking-wide">JOIN THE ROOM</h2>
          <p className="text-xs text-zinc-400 mt-1">Scan the QR code below to jump in</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-inner">
          <QRCodeSVG value={roomUrl} size={240} />
        </div>

        <div className="bg-zinc-900 border border-white/5 px-6 py-3 rounded-xl w-full">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Room Code</p>
          <p className="text-2xl font-black text-pink-500 tracking-wider mt-0.5">{roomCode}</p>
        </div>

        <p className="text-[11px] text-zinc-500">Click anywhere outside or ✕ to close</p>
      </div>
    </div>
  )}
</header>

      <div className={`grid gap-8 ${isHost ? "md:grid-cols-3" : "max-w-lg mx-auto"}`}>
        {/* Video player — host only */}
        {isHost && (
          <div className="md:col-span-2 h-[500px] bg-black rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center relative">
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
                {canPlayCurrentVideo && !isVideoRestricted && isMuted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(false);
                      supabase.from("rooms").update({ is_playing: true }).eq("room_code", roomCode);
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
                <p className="text-zinc-500 text-sm">Search for a song to get started 🎤</p>
              </div>
            )}
          </div>
        )}

        {/* Queue panel — visible to everyone */}
        <div className={`bg-zinc-900/30 rounded-2xl border border-white/5 p-4 flex flex-col ${isHost ? "h-[500px]" : "min-h-[500px]"}`}>
          {/* Non-host: show now playing status */}
          {!isHost && (
            <div className={`mb-4 px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              currentVideoId && canPlayCurrentVideo && !isVideoRestricted
                ? "bg-pink-500/10 border-pink-500/20 text-pink-300"
                : "bg-zinc-800/50 border-white/5 text-zinc-500"
            }`}>
              {currentVideoId && canPlayCurrentVideo && !isVideoRestricted ? (
                <>
                  <span className="animate-pulse">♪</span>
                  <span className="truncate">Now playing — add your song below!</span>
                </>
              ) : (
                <span className="w-full text-center">Waiting for host to play a song… 🎤</span>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-4 mb-4 border-b border-white/5">
            <button
              onClick={() => setActiveTab("queue")}
              className={`min-w-0 pb-2 text-xs font-bold ${
                activeTab === "queue" ? "text-pink-500" : "text-zinc-500"
              }`}
            >
              <span className="truncate inline-block max-w-full">SONG QUEUE</span>
              {queue.length > 0 && (
                <span className="ml-1 inline-block bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-full">
                  {queue.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`min-w-0 pb-2 text-xs font-bold ${
                activeTab === "users" ? "text-pink-500" : "text-zinc-500"
              }`}
            >
              <span className="truncate inline-block max-w-full">USERS</span>
              {users.size > 0 && (
                <span className="ml-1 inline-block bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">
                  {users.size}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "queue" && (
              <>
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

                {/* Recommendations Section */}
                {!searchQuery && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-pink-500 font-bold tracking-widest uppercase">
                        ✨ Recommended
                      </p>
                      <button
                        onClick={fetchRecommendations}
                        disabled={isFetchingRecs}
                        className="text-[9px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                      >
                        {isFetchingRecs ? "Loading…" : "↻ Refresh"}
                      </button>
                    </div>

                    {isFetchingRecs && recommendations.length === 0 && (
                      <p className="text-[10px] text-zinc-600 text-center py-2">Getting suggestions…</p>
                    )}

                    <div className="flex flex-col gap-1.5">
                      {recommendations.map((rec, i) => (
                        <div
                          key={i}
                          onClick={() => !isAddingRec && addRecommendedToQueue(rec)}
                          className={`flex items-center gap-2 p-2 bg-pink-500/5 border border-pink-500/20 rounded transition-colors ${
                            isAddingRec 
                              ? "cursor-not-allowed opacity-50" 
                              : "hover:bg-pink-500/15 cursor-pointer"
                          }`}
                        >
                          <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-xs flex-shrink-0">
                            🎵
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-zinc-200 truncate">{rec.title}</p>
                            <p className="text-[9px] text-zinc-500">{rec.artist}</p>
                          </div>
                          <span className="text-pink-400 text-xs font-bold flex-shrink-0 min-w-[14px] text-center">
                            {isAddingRec ? "⏳" : "+"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

            {activeTab === "users" && (
              <div className="space-y-2 pt-1">
                {users.size === 0 && (
                  <p className="text-[10px] text-zinc-600 text-center py-4">
                    No users in room yet.
                  </p>
                )}
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
                      {isHost && !u.is_host && (
                        <button
                          onClick={() => transferHost(u.user_id)}
                          disabled={isTransferringHost}
                          className="text-[10px] bg-white/5 border border-white/10 text-white px-2 py-1 rounded-xl hover:bg-white/10 disabled:opacity-50"
                        >
                          {isTransferringHost ? "Transferring…" : "Make Host"}
                        </button>
                      )}
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