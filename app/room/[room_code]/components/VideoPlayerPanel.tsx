"use client";

import type { MutableRefObject } from "react";

type Props = {
  ytContainerRef: MutableRefObject<HTMLDivElement | null>;
  currentVideoId: string;
  canPlayCurrentVideo: boolean;
  isVideoRestricted: boolean;
  isPlayerReady: boolean;
  isMuted: boolean;
  onUnmute: () => void;
};

export function VideoPlayerPanel({
  ytContainerRef,
  currentVideoId,
  canPlayCurrentVideo,
  isVideoRestricted,
  isPlayerReady,
  isMuted,
  onUnmute,
}: Props) {
  return (
    <div className="md:col-span-2 h-[280px] sm:h-[360px] md:h-[500px] bg-black rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center relative">
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
                onUnmute();
              }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3 group"
            >
              <span className="text-4xl group-hover:scale-110 transition-transform">🔇</span>
              <span className="text-xs text-zinc-300 font-bold tracking-widest uppercase">Click to unmute</span>
            </button>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <p className="text-zinc-500 text-sm">Search for a song to get started 🎤</p>
        </div>
      )}
    </div>
  );
}