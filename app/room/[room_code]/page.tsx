"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { useRoomRealtime } from "./hooks/useRoomRealtime";
import { useYouTubePlayer } from "./hooks/useYouTubePlayer";
import { useQueueActions } from "./hooks/useQueueActions";
import { useKaraokeSearch } from "./hooks/useKaraokeSearch";

import { RoomHeader } from "./components/RoomHeader";
import { QrModal } from "./components/QrModal";
import { VideoPlayerPanel } from "./components/VideoPlayerPanel";
import { QueueTab } from "./components/QueueTab";
import { UsersTab } from "./components/UsersTab";

import { YOUTUBE_VIDEO_ID_PATTERN } from "./types";

function displayNameFor(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  if (!user) return "Guest";
  const meta = user.user_metadata ?? {};
  return (
    (meta.display_name as string) ||
    (meta.full_name as string) ||
    (meta.name as string) ||
    (user.email ? user.email.split("@")[0].replace(/[._\-+]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Guest")
  );
}

export default function RoomPage() {
  const { room_code } = useParams();
  const roomCode = (Array.isArray(room_code) ? room_code[0] : room_code) ?? "";
  const roomUrl =
    typeof window !== "undefined" ? `${window.location.origin}/room/${roomCode}` : `https://musiciana.vercel.app/room/${roomCode}`;

  const [activeTab, setActiveTab] = useState<"queue" | "users" | "leaderboard">("queue");
  const [currentTrackTitle, setCurrentTrackTitle] = useState("");
  const [latestScore, setLatestScore] = useState<{ title: string; score: number } | null>(null);
  const [scoreOverlayVisible, setScoreOverlayVisible] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<"overall" | "songs">("overall");
  const [overallLeaderboardEntries, setOverallLeaderboardEntries] = useState<Array<{ id?: string; user_id: string; total_score: number; songs: number; displayName: string }>>([]);
  const [songLeaderboardEntries, setSongLeaderboardEntries] = useState<Array<{ id?: string; title: string; user_id: string; total_score: number; displayName: string }>>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const scoreTimeoutRef = useRef<number | null>(null);
  const playNextRef = useRef<(() => Promise<void>) | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrSize, setQrSize] = useState(240);
  const markPlayerNotReadyRef = useRef<() => void>(() => {});
  const handlePlayerErrorRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // Bumped every time playNext() advances to a new song. currentVideoId
  // alone doesn't change when the same video_id is queued back-to-back
  // (e.g. same song added twice), which used to leave the player stuck
  // showing "Loading video..." forever. This forces useYouTubePlayer to
  // treat it as a fresh play attempt regardless.
  const [playToken, setPlayToken] = useState(0);
  const bumpPlayToken = useCallback(() => setPlayToken((t) => t + 1), []);

  // ── Room / queue / presence (realtime + heartbeat) ──────────────────────
  const {
    supabase,
    room,
    setRoom,
    isHost,
    queue,
    setQueue,
    queueRef,
    users,
    currentUser,
    isTransferringHost,
    transferHost,
    refreshQueue,
    leaveRoom,
  } = useRoomRealtime(roomCode, () => markPlayerNotReadyRef.current());

  const currentVideoId = room?.current_video_id?.trim() ?? "";
  const canPlayCurrentVideo = YOUTUBE_VIDEO_ID_PATTERN.test(currentVideoId);

  useEffect(() => {
    return () => {
      if (scoreTimeoutRef.current) {
        window.clearTimeout(scoreTimeoutRef.current);
      }
    };
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLatestScore(null);
    setScoreOverlayVisible(false);
    if (scoreTimeoutRef.current) {
      window.clearTimeout(scoreTimeoutRef.current);
      scoreTimeoutRef.current = null;
    }
  }, [currentVideoId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSongEnded = useCallback(
    (score?: number) => {
      const completedSongTitle = queueRef.current[0]?.title || currentTrackTitle || "Last song";
      if (typeof score === "number") {
        setLatestScore({ title: completedSongTitle, score });
        setScoreOverlayVisible(true);
        if (scoreTimeoutRef.current) {
          window.clearTimeout(scoreTimeoutRef.current);
        }
        scoreTimeoutRef.current = window.setTimeout(() => {
          setScoreOverlayVisible(false);
          scoreTimeoutRef.current = null;
          if (isHost && playNextRef.current) {
            void playNextRef.current();
          }
        }, 3000);
      } else if (isHost && playNextRef.current) {
        void playNextRef.current();
      }
    },
    [currentTrackTitle, isHost, queueRef]
  );

// ── YouTube player ───────────────────────────────────────────────────────
// KUMPLETO AT REFACTOR-ED NA CODE PARA SA page.tsx:
const {
  ytContainerRef,
  isPlayerReady,
  isMuted,
  setIsMuted,
  isVideoRestricted,
  markPlayerNotReady,
  markPlayerReady,
  markVideoRestricted,
} = useYouTubePlayer({
  currentVideoId,
  playToken,
  canPlayCurrentVideo,
  isHost,
  isTransferringHost,
  onEnded: handleSongEnded,
  onError: () => handlePlayerErrorRef.current(),
  // 🎤 INTEGRATION: Dito natin ipinapasa ang metadata para sa scoring ng Mic ng Host
  currentSongData:
    queue[0] && typeof queue[0].added_by === "string"
      ? {
          room_code: queue[0].room_code,
          video_id: queue[0].video_id,
          title: queue[0].title || currentTrackTitle || "Unknown Title",
          added_by: queue[0].added_by,
          added_by_name:
            queue[0].added_by_name || users.get(queue[0].added_by)?.display_name || "Guest",
        }
      : null,
});

  useEffect(() => {
    markPlayerNotReadyRef.current = markPlayerNotReady;
  }, [markPlayerNotReady]);

  // ── Queue mutations (add / remove / play next) ──────────────────────────
// ── Queue mutations (add / remove / play next) ──────────────────────────
const { addToQueue, removeFromQueue, playNext, handlePlayerError } = useQueueActions({
  roomCode,
  supabase,
  currentUserId: currentUser?.id,
  currentUserDisplayName: displayNameFor(currentUser),
  queueRef,
  setQueue,
  setRoom,
  setCurrentTrackTitle,
  refreshQueue,
  isHost,
  isTransferringHost,
  currentVideoId,
  markPlayerNotReady,
  markPlayerReady, // <--- DIRETSO MO NANG IPASA NA GANITO (Mawawala na ang ReferenceError!)
  markVideoRestricted,
  bumpPlayToken,
});

useEffect(() => {
  markPlayerNotReadyRef.current = markPlayerNotReady;
}, [markPlayerNotReady]);

useEffect(() => {
  handlePlayerErrorRef.current = handlePlayerError;
}, [handlePlayerError]);

useEffect(() => {
  playNextRef.current = playNext;
}, [playNext]);

  // ── Search + recommendations ────────────────────────────────────────────
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isLoading,
    recommendations,
    isFetchingRecs,
    isAddingRec,
    fetchRecommendations,
    addRecommendedToQueue,
  } = useKaraokeSearch(queue, currentVideoId, addToQueue);

  const handleAddVideo = useCallback(
    (v: Parameters<typeof addToQueue>[0]) => {
      void addToQueue(v);
      setSearchResults([]);
      setSearchQuery("");
    },
    [addToQueue, setSearchResults, setSearchQuery]
  );

  useEffect(() => {
    if (activeTab === "queue" && recommendations.length === 0) {
      void fetchRecommendations();
    }
  }, [activeTab, recommendations.length, fetchRecommendations]);

  useEffect(() => {
    if (activeTab !== "leaderboard" || !supabase || !roomCode) return;

    let ignore = false;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

    type ScoreRow = {
      id?: string;
      user_id: string;
      total_score: string | number | null;
      title?: string | null;
      added_by_name?: string | null;
    };

    const displayName = (row: ScoreRow) =>
      row.added_by_name || `Player ${String(row.user_id).slice(0, 6).toUpperCase()}`;

    const loadLeaderboard = async () => {
      setLeaderboardLoading(true);
      setLeaderboardError(null);

      const { data, error } = await supabase
        .from("scores")
        .select("id, user_id, total_score, added_by_name, title")
        .eq("room_code", roomCode)
        .order("total_score", { ascending: false })
        .limit(100);

      if (ignore) return;

      if (error) {
        console.error("Room leaderboard load error:", error);
        setLeaderboardError("Failed to load leaderboard.");
        setOverallLeaderboardEntries([]);
        setSongLeaderboardEntries([]);
      } else {
        const rows = (data ?? []) as ScoreRow[];
        const perSong = rows.map((row) => ({
          id: row.id,
          title: row.title ?? "Unknown song",
          user_id: row.user_id,
          total_score: Number(row.total_score ?? 0),
          displayName: displayName(row),
        }));

        const grouped = new Map<string, { id?: string; user_id: string; total_score: number; songs: number; displayName: string }>();

        for (const row of rows) {
          const userId = row.user_id;
          const existing = grouped.get(userId);
          const score = Number(row.total_score ?? 0);
          if (existing) {
            existing.total_score += score;
            existing.songs += 1;
          } else {
            grouped.set(userId, {
              id: row.id,
              user_id: userId,
              total_score: score,
              songs: 1,
              displayName: displayName(row),
            });
          }
        }

        const aggregated = Array.from(grouped.values()).sort((a, b) => b.total_score - a.total_score);

        setOverallLeaderboardEntries(aggregated);
        setSongLeaderboardEntries(perSong);
      }
      setLeaderboardLoading(false);
    };

    void loadLeaderboard();

    try {
      activeChannel = supabase.channel(`room:${roomCode}:scores`);
      activeChannel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "scores", filter: `room_code=eq.${roomCode}` },
          () => {
            if (!ignore) void loadLeaderboard();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "scores", filter: `room_code=eq.${roomCode}` },
          () => {
            if (!ignore) void loadLeaderboard();
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "scores", filter: `room_code=eq.${roomCode}` },
          () => {
            if (!ignore) void loadLeaderboard();
          }
        )
        .subscribe();
    } catch (error) {
      console.warn("Failed to subscribe to leaderboard updates:", error);
    }

    return () => {
      ignore = true;
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [activeTab, roomCode, supabase]);

  // Responsive QR size for the modal.
  useEffect(() => {
    const updateQrSize = () => {
      const width = window.innerWidth || 320;
      setQrSize(Math.min(240, Math.max(160, Math.floor(width * 0.65))));
    };
    updateQrSize();
    window.addEventListener("resize", updateQrSize);
    return () => window.removeEventListener("resize", updateQrSize);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  // Reset + fetch the "now playing" title via noembed whenever the video changes.
  useEffect(() => {
    setCurrentTrackTitle("");
  }, [currentVideoId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!currentVideoId || currentTrackTitle || isVideoRestricted) return;
    let canceled = false;
    (async () => {
      try {
        const response = await fetch(
          `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${encodeURIComponent(currentVideoId)}`
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!canceled && data?.title) setCurrentTrackTitle(data.title);
      } catch (error) {
        console.warn("[current-track] title fetch failed:", error);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [currentVideoId, currentTrackTitle, isVideoRestricted]);

  // Auto-play the next queued song once a host has an empty player + non-empty queue.
  useEffect(() => {
    if (!isHost || room?.current_video_id || queue.length === 0) return;
    const allTemp = queue.every((song) => song.id.startsWith("temp-"));
    const timer = window.setTimeout(() => void playNext(), allTemp ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [isHost, playNext, queue, room?.current_video_id]);

  return (
    <main className="min-h-screen bg-[#050505] text-white p-3 sm:p-6">
      <RoomHeader
        roomCode={roomCode}
        isHost={isHost}
        hasQueue={queue.length > 0}
        currentTrackTitle={currentTrackTitle}
        currentVideoId={currentVideoId}
        onPlayNext={() => void playNext()}
        onLeave={() => void leaveRoom()}
        onOpenQr={() => setIsQrOpen(true)}
      />

      {isQrOpen && (
        <QrModal roomCode={roomCode} roomUrl={roomUrl} qrSize={qrSize} onClose={() => setIsQrOpen(false)} />
      )}


      <div className={`grid gap-4 sm:gap-8 ${isHost ? "md:grid-cols-3" : "max-w-lg mx-auto"}`}>
        {isHost && (
          <VideoPlayerPanel
            ytContainerRef={ytContainerRef}
            currentVideoId={currentVideoId}
            canPlayCurrentVideo={canPlayCurrentVideo}
            isVideoRestricted={isVideoRestricted}
            isPlayerReady={isPlayerReady}
            isMuted={isMuted}
            onUnmute={() => {
              setIsMuted(false);
              void supabase.from("rooms").update({ is_playing: true }).eq("room_code", roomCode);
            }}
            scoreData={latestScore}
            showScoreOverlay={scoreOverlayVisible}
          />
        )}

        <div
          className={`bg-zinc-900/30 rounded-2xl border border-white/5 p-3 sm:p-4 flex flex-col ${
            isHost ? "min-h-[320px] md:h-[500px]" : "min-h-[320px] md:min-h-[500px]"
          }`}
        >
          {!isHost && (
            <div
              className={`mb-4 px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                currentVideoId && canPlayCurrentVideo && !isVideoRestricted
                  ? "bg-pink-500/10 border-pink-500/20 text-pink-300"
                  : "bg-zinc-800/50 border-white/5 text-zinc-500"
              }`}
            >
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
              className={`min-w-0 pb-2 text-xs font-bold ${activeTab === "queue" ? "text-pink-500" : "text-zinc-500"}`}
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
              className={`min-w-0 pb-2 text-xs font-bold ${activeTab === "users" ? "text-pink-500" : "text-zinc-500"}`}
            >
              <span className="truncate inline-block max-w-full">USERS</span>
              {users.size > 0 && (
                <span className="ml-1 inline-block bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded-full">
                  {users.size}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`min-w-0 pb-2 text-xs font-bold ${activeTab === "leaderboard" ? "text-pink-500" : "text-zinc-500"}`}
            >
              <span className="truncate inline-block max-w-full">LEADERBOARD</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "queue" && (
              <QueueTab
                isHost={isHost}
                users={users}
                queue={queue}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                isLoading={isLoading}
                recommendations={recommendations}
                isFetchingRecs={isFetchingRecs}
                isAddingRec={isAddingRec}
                onAddVideo={handleAddVideo}
                onAddRecommended={addRecommendedToQueue}
                onRefreshRecommendations={fetchRecommendations}
                onRemoveFromQueue={removeFromQueue}
              />
            )}

            {activeTab === "users" && (
              <UsersTab
                users={users}
                currentUserId={currentUser?.id}
                isHost={isHost}
                isTransferringHost={isTransferringHost}
                onTransferHost={(id) => void transferHost(id)}
              />
            )}

            {activeTab === "leaderboard" && (
              <div className="space-y-3">
                {leaderboardLoading ? (
                  <p className="text-[10px] text-zinc-400 text-center py-4">Loading leaderboard…</p>
                ) : leaderboardError ? (
                  <p className="text-[10px] text-red-400 text-center py-4">{leaderboardError}</p>
                ) : overallLeaderboardEntries.length === 0 && songLeaderboardEntries.length === 0 ? (
                  <p className="text-[10px] text-zinc-400 text-center py-4">No leaderboard data yet.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-3 mb-4">
                      <button
                        type="button"
                        onClick={() => setLeaderboardMode("overall")}
                        className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.25em] ${
                          leaderboardMode === "overall"
                            ? "bg-pink-500 text-black border-pink-500"
                            : "bg-zinc-800 text-zinc-300 border-white/10"
                        }`}
                      >
                        Overall
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaderboardMode("songs")}
                        className={`rounded-full border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.25em] ${
                          leaderboardMode === "songs"
                            ? "bg-pink-500 text-black border-pink-500"
                            : "bg-zinc-800 text-zinc-300 border-white/10"
                        }`}
                      >
                        Songs
                      </button>
                    </div>

                    {leaderboardMode === "overall" ? (
                      <div className="space-y-2">
                        {overallLeaderboardEntries.map((entry, index) => (
                          <div
                            key={entry.id ?? `${entry.user_id}-${entry.total_score}-${index}`}
                            className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-800/60 border border-white/10"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">#{index + 1}</p>
                                <p className="text-sm font-bold text-white truncate">{entry.displayName}</p>
                              </div>
                              <p className="text-sm font-black text-pink-400">{entry.total_score}</p>
                            </div>
                            <p className="text-[10px] text-zinc-400">{entry.songs} song{entry.songs !== 1 ? "s" : ""}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {songLeaderboardEntries.map((entry, index) => (
                          <div
                            key={entry.id ?? `${entry.user_id}-${entry.title}-${entry.total_score}-${index}`}
                            className="flex flex-col gap-2 p-3 rounded-xl bg-zinc-800/60 border border-white/10"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">#{index + 1}</p>
                                <p className="text-sm font-bold text-white truncate">{entry.title}</p>
                              </div>
                              <p className="text-sm font-black text-pink-400">{entry.total_score}</p>
                            </div>
                            <p className="text-[10px] text-zinc-400">{entry.displayName}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}