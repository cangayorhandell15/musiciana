import { useCallback, useEffect, useState } from "react";
import type { QueueEntry, YouTubeVideo } from "../types";

type Recommendation = { title: string; artist: string };

/**
 * The search box (debounced YouTube search) and the "Recommended"
 * panel. Takes `addToQueue` as a dependency so it can add the first
 * search hit for a recommended track without knowing anything about
 * Supabase.
 */
export function useKaraokeSearch(
  queue: QueueEntry[],
  currentVideoId: string,
  addToQueue: (video: YouTubeVideo) => Promise<void>
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isFetchingRecs, setIsFetchingRecs] = useState(false);
  const [isAddingRec, setIsAddingRec] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsLoading(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery + " karaoke")}`);
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

  const fetchRecommendations = useCallback(async () => {
    setIsFetchingRecs(true);
    try {
      const context = [
        currentVideoId ? `Currently playing: ${queue[0]?.title ?? "unknown"}` : null,
        queue.length > 0 ? `Queue: ${queue.map((s) => s.title).join(", ")}` : null,
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
      setRecommendations(JSON.parse(clean));
    } catch (e) {
      console.error("[recommendations] failed:", e);
    }
    setIsFetchingRecs(false);
  }, [queue, currentVideoId]);

  const addRecommendedToQueue = useCallback(
    async (rec: Recommendation) => {
      if (isAddingRec) return; // anti-double-tap guard
      setIsAddingRec(true);
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(rec.title + " " + rec.artist + " karaoke")}`);
        const results: YouTubeVideo[] = await res.json();
        if (results?.[0]) await addToQueue(results[0]);
      } catch (e) {
        console.error("[rec-add] failed:", e);
      }
      setIsLoading(false);
      setIsAddingRec(false);
    },
    [isAddingRec, addToQueue]
  );

  return {
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
  };
}