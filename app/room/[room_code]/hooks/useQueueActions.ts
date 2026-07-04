import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MutableRefObject } from "react";
import { YOUTUBE_VIDEO_ID_PATTERN, type QueueEntry, type Room, type YouTubeVideo } from "../types";

type Params = {
  roomCode: string;
  supabase: SupabaseClient;
  currentUserId: string | undefined;
  currentUserDisplayName: string;
  queueRef: MutableRefObject<QueueEntry[]>;
  setQueue: (updater: (prev: QueueEntry[]) => QueueEntry[]) => void;
  setRoom: (updater: (prev: Room | null) => Room | null) => void;
  setCurrentTrackTitle: (title: string) => void;
  refreshQueue: () => Promise<void>;
  isHost: boolean;
  isTransferringHost: boolean;
  currentVideoId: string;
  markPlayerNotReady: () => void;
  markPlayerReady: () => void; // 1. Idinagdag ito rito
  markVideoRestricted: (videoId: string) => void;
};

/**
 * `added_by_name` is written at insert time so attribution survives a
 * user going offline — we no longer depend on presence data still
 * having that user's display_name when the queue item is rendered.
 */
export function useQueueActions({
  roomCode,
  supabase,
  currentUserId,
  currentUserDisplayName,
  queueRef,
  setQueue,
  setRoom,
  setCurrentTrackTitle,
  refreshQueue,
  isHost,
  isTransferringHost,
  currentVideoId,
  markPlayerNotReady,
  markPlayerReady, // 2. I-destructure ito rito
  markVideoRestricted,
}: Params) {
  const addToQueue = useCallback(
    async (video: YouTubeVideo) => {
      if (!YOUTUBE_VIDEO_ID_PATTERN.test(video.id.videoId)) {
        alert("This video cannot be queued.");
        return;
      }

      const newEntry = {
        room_code: roomCode,
        video_id: video.id.videoId,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails.default.url,
        added_by: currentUserId ?? null,
        added_by_name: currentUserDisplayName,
      };

      const tempId = `temp-${video.id.videoId}-${Date.now()}`;
      setQueue((prev) => [...prev, { ...newEntry, id: tempId }]);

      const { error, data } = await supabase.from("queue").insert([newEntry]).select().single();

      if (error) {
        console.error("Add to queue error:", error);
        setQueue((prev) => prev.filter((s) => s.id !== tempId));
        alert("Failed to add song: " + error.message);
      } else {
        setQueue((prev) => prev.map((s) => (s.id === tempId ? data : s)));
      }
    },
    [roomCode, supabase, currentUserId, currentUserDisplayName, setQueue]
  );

  const removeFromQueue = useCallback(
    async (id: string) => {
      setQueue((prev) => prev.filter((s) => s.id !== id));
      const { error } = await supabase.from("queue").delete().eq("id", id);
      if (error) {
        console.error("Remove error:", error);
        await refreshQueue();
      }
    },
    [supabase, setQueue, refreshQueue]
  );

  const playNext = useCallback(async () => {
    const nextSong = queueRef.current.find((s) => !s.id.startsWith("temp-"));

    if (!nextSong) {
      // 3. Ginamit ang markPlayerReady() para alisin ang loading overlay
      markPlayerReady(); 
      await supabase.from("rooms").update({ current_video_id: null, is_playing: false }).eq("room_code", roomCode);
      await refreshQueue();
      return;
    }

    markPlayerNotReady();
    setRoom((prev) => (prev ? { ...prev, current_video_id: nextSong.video_id, is_playing: true } : prev));
    setQueue((prev) => prev.filter((s) => String(s.id) !== String(nextSong.id)));
    setCurrentTrackTitle(nextSong.title);

    const { error: roomErr } = await supabase
      .from("rooms")
      .update({ current_video_id: nextSong.video_id, is_playing: true })
      .eq("room_code", roomCode);

    const { error: queueErr } = await supabase.from("queue").delete().eq("id", nextSong.id);

    if (roomErr || queueErr) {
      console.error("Database update failed:", roomErr || queueErr);
      alert("Nagka-error sa pag-play ng kanta.");
      await refreshQueue();
    }
  }, [queueRef, supabase, roomCode, refreshQueue, markPlayerReady, markPlayerNotReady, setRoom, setQueue, setCurrentTrackTitle]);

  const handlePlayerError = useCallback(async () => {
    markPlayerNotReady();
    if (currentVideoId) markVideoRestricted(currentVideoId);

    if (isHost && !isTransferringHost) {
      if (queueRef.current.length > 0) {
        void playNext();
      } else {
        await supabase.from("rooms").update({ current_video_id: null }).eq("room_code", roomCode);
      }
    }
  }, [markPlayerNotReady, markVideoRestricted, currentVideoId, isHost, isTransferringHost, queueRef, playNext, supabase, roomCode]);

  return { addToQueue, removeFromQueue, playNext, handlePlayerError };
}