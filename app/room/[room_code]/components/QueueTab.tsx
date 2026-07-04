"use client";

import type { PresenceUser, QueueEntry, YouTubeVideo } from "../types";

type Recommendation = { title: string; artist: string };

type Props = {
  isHost: boolean;
  users: Map<string, PresenceUser>;
  queue: QueueEntry[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: YouTubeVideo[];
  isLoading: boolean;
  recommendations: Recommendation[];
  isFetchingRecs: boolean;
  isAddingRec: boolean;
  onAddVideo: (v: YouTubeVideo) => void;
  onAddRecommended: (r: Recommendation) => void;
  onRefreshRecommendations: () => void;
  onRemoveFromQueue: (id: string) => void;
};

/**
 * Attribution: prefer the name saved on the row itself
 * (`added_by_name`) so it survives the adder going offline; only fall
 * back to a live presence lookup for older rows that predate the
 * column.
 */
function getAddedByLabel(entry: QueueEntry, users: Map<string, PresenceUser>) {
  if (entry.added_by_name) return entry.added_by_name;
  if (entry.added_by) return users.get(entry.added_by)?.display_name ?? "Unknown";
  return "Unknown";
}

export function QueueTab({
  isHost,
  users,
  queue,
  searchQuery,
  setSearchQuery,
  searchResults,
  isLoading,
  recommendations,
  isFetchingRecs,
  isAddingRec,
  onAddVideo,
  onAddRecommended,
  onRefreshRecommendations,
  onRemoveFromQueue,
}: Props) {
  return (
    <>
      <input
        placeholder="Search karaoke…"
        className="w-full bg-black border border-white/10 p-2 rounded text-xs"
        onChange={(e) => setSearchQuery(e.target.value)}
        value={searchQuery}
      />
      {isLoading && <p className="text-[10px] text-zinc-500 mt-2">Searching…</p>}

      {searchResults.map((v) => (
        <div
          key={v.id.videoId}
          onClick={() => onAddVideo(v)}
          className="p-2 bg-zinc-800 hover:bg-pink-500/20 cursor-pointer rounded mt-2 flex items-center gap-2 min-w-0"
        >
          <img
            src={v.snippet?.thumbnails?.default?.url || "https://via.placeholder.com/40"}
            className="w-8 h-8 rounded flex-shrink-0"
            alt={v.snippet?.title || "Karaoke video"}
          />
          <p className="text-[10px] break-words whitespace-normal leading-tight min-w-0">
            {v.snippet?.title || "Untitled"}
          </p>
        </div>
      ))}

      {!searchQuery && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-pink-500 font-bold tracking-widest uppercase">✨ Recommended</p>
            <button
              onClick={onRefreshRecommendations}
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
                onClick={() => !isAddingRec && onAddRecommended(rec)}
                className={`flex items-center gap-2 p-2 bg-pink-500/5 border border-pink-500/20 rounded transition-colors min-w-0 ${
                  isAddingRec ? "cursor-not-allowed opacity-50" : "hover:bg-pink-500/15 cursor-pointer"
                }`}
              >
                <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center text-xs flex-shrink-0">
                  🎵
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-200 break-words whitespace-normal leading-tight">{rec.title}</p>
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
          <p className="text-[10px] text-zinc-600 text-center py-4">Queue is empty — search for a song!</p>
        )}
        {queue.map((s, i) => (
          <div key={s.id} className="p-2 bg-zinc-800/50 rounded flex items-center gap-2 min-w-0">
            {s.thumbnail && <img src={s.thumbnail} className="w-8 h-8 rounded flex-shrink-0" alt="" />}
            <div className="flex-1 min-w-0">
              <p className="text-[9px] text-pink-400/80 font-medium truncate">
                Added by {getAddedByLabel(s, users)}
              </p>
              <p className="text-[10px] break-words whitespace-normal leading-tight">{s.title}</p>
              <p className="text-[9px] text-zinc-500">#{i + 1}</p>
            </div>
            {isHost && (
              <button
                onClick={() => onRemoveFromQueue(s.id)}
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
  );
}