"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const [activeTab, setActiveTab] = useState<"queue" | "users">("queue");
  const [currentTrackTitle, setCurrentTrackTitle] = useState("");
  const [latestScore, setLatestScore] = useState<{ title: string; score: number } | null>(null);
  const [scoreOverlayVisible, setScoreOverlayVisible] = useState(false);
  const scoreTimeoutRef = useRef<number | null>(null);
  const playNextRef = useRef<(() => Promise<void>) | null>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [qrSize, setQrSize] = useState(240);

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
  } = useRoomRealtime(roomCode, () => markPlayerNotReady());

  const currentVideoId = room?.current_video_id?.trim() ?? "";
  const canPlayCurrentVideo = YOUTUBE_VIDEO_ID_PATTERN.test(currentVideoId);

  useEffect(() => {
    return () => {
      if (scoreTimeoutRef.current) {
        window.clearTimeout(scoreTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setLatestScore(null);
    setScoreOverlayVisible(false);
    if (scoreTimeoutRef.current) {
      window.clearTimeout(scoreTimeoutRef.current);
      scoreTimeoutRef.current = null;
    }
  }, [currentVideoId]);

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
    [currentTrackTitle, isHost]
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
  canPlayCurrentVideo,
  isHost,
  isTransferringHost,
  onEnded: handleSongEnded,
  onError: () => void handlePlayerError(),
  // 🎤 INTEGRATION: Dito natin ipinapasa ang metadata para sa scoring ng Mic ng Host
  currentSongData: queue[0]
    ? {
        room_code: queue[0].room_code,
        video_id: queue[0].video_id,
        title: queue[0].title || currentTrackTitle || "Unknown Title",
        added_by: queue[0].added_by,
      }
    : null,
});
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
});

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

  // Reset + fetch the "now playing" title via noembed whenever the video changes.
  useEffect(() => {
    setCurrentTrackTitle("");
  }, [currentVideoId]);

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
          </div>
        </div>
      </div>
    </main>
  );
}