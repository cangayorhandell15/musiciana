"use client";

import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

type VideoScore = {
  title: string;
  score: number;
};

type Props = {
  ytContainerRef: MutableRefObject<HTMLDivElement | null>;
  currentVideoId: string;
  canPlayCurrentVideo: boolean;
  isVideoRestricted: boolean;
  isPlayerReady: boolean;
  isMuted: boolean;
  onUnmute: () => void;
  scoreData?: VideoScore | null;
  showScoreOverlay?: boolean;
};

export function VideoPlayerPanel({
  ytContainerRef,
  currentVideoId,
  canPlayCurrentVideo,
  isVideoRestricted,
  isPlayerReady,
  isMuted,
  onUnmute,
  scoreData,
  showScoreOverlay = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const loadingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlayerReady) {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setShowLoadingOverlay(false);
      return;
    }

    if (!currentVideoId || !canPlayCurrentVideo || isVideoRestricted) {
      setShowLoadingOverlay(false);
      return;
    }

    loadingTimeoutRef.current = window.setTimeout(() => {
      setShowLoadingOverlay(true);
      loadingTimeoutRef.current = null;
    }, 300);

    return () => {
      if (loadingTimeoutRef.current) {
        window.clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [currentVideoId, canPlayCurrentVideo, isVideoRestricted, isPlayerReady]);

  const handleToggleFullscreen = async () => {
    if (!panelRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await panelRef.current.requestFullscreen();
    }
  };

  return (
    <div ref={panelRef} className="md:col-span-2 h-[280px] sm:h-[360px] md:h-[500px] bg-black rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center relative">
      <div className="absolute right-3 top-3 z-20">
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="rounded-full border border-white/10 bg-black/70 p-2 text-xs text-white transition hover:border-pink-500/40 hover:bg-pink-500/15"
          title="Fullscreen"
        >
          ⛶
        </button>
      </div>
      <div className="w-full h-full">
        <div ref={ytContainerRef} className="w-full h-full" />
      </div>

      {scoreData && showScoreOverlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 p-6">
          <div className="max-w-md rounded-[2rem] border border-pink-500/30 bg-zinc-950/95 p-6 text-center shadow-[0_0_50px_rgba(255,0,128,0.2)]">
            <div className="text-5xl animate-pulse">🥁</div>
            <p className="mt-4 text-sm uppercase tracking-[0.3em] text-pink-300">your score is...</p>
            <p className="mt-2 text-6xl font-black text-white">{scoreData.score}</p>
            <p className="mt-2 text-sm text-zinc-400">{scoreData.title}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.3em] text-emerald-300">Congratulations!</p>
          </div>
        </div>
      )}

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
            !isPlayerReady && showLoadingOverlay && (
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