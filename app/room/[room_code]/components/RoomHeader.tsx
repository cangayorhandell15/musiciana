"use client";

import { QRCodeSVG } from "qrcode.react";

type Props = {
  roomCode: string;
  isHost: boolean;
  hasQueue: boolean;
  currentTrackTitle: string;
  currentVideoId: string;
  onPlayNext: () => void;
  onLeave: () => void;
  onOpenQr: () => void;
};

export function RoomHeader({
  roomCode,
  isHost,
  hasQueue,
  currentTrackTitle,
  currentVideoId,
  onPlayNext,
  onLeave,
  onOpenQr,
}: Props) {
  return (
    <header className="w-full border-b border-white/5 pb-4 mb-4 sm:mb-6">
      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-row items-center justify-between w-full">
          <h1 className="text-sm sm:text-base md:text-xl font-black text-white tracking-[0.2em] uppercase">
            MUSICIANA
          </h1>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isHost && hasQueue && (
              <button
                onClick={onPlayNext}
                className="text-[11px] font-bold text-green-400 hover:bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20 transition-colors flex items-center gap-1"
              >
                <span>▶</span> <span>Next</span>
              </button>
            )}
            <button
              onClick={onLeave}
              className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              title="Leave room"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M3 3.75A2.25 2.25 0 0 1 5.25 1.5h7.5A2.25 2.25 0 0 1 15 3.75v16.5A2.25 2.25 0 0 1 12.75 22.5h-7.5A2.25 2.25 0 0 1 3 20.25V3.75Zm2.25-.75a.75.75 0 0 0-.75.75v16.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-7.5ZM18.28 12.53l-3.22 3.22a.75.75 0 0 1-1.06-1.06l1.47-1.47H9.75a.75.75 0 0 1 0-1.5h5.72l-1.47-1.47a.75.75 0 1 1 1.06-1.06l3.22 3.22a.75.75 0 0 1 0 1.06Z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
          <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-2 flex items-center gap-3 min-w-0">
            <div
              onClick={onOpenQr}
              className="cursor-pointer bg-white rounded-md p-1 hover:scale-105 active:scale-95 transition-transform flex-shrink-0 shadow-md"
              title="Enlarge QR"
            >
              <QRCodeSVG value={`https://musiciana.vercel.app/room/${roomCode}`} size={36} />
            </div>

            <div className="flex flex-col min-w-0">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider leading-none mb-0.5 font-bold">
                Room Code
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(roomCode)}
                className="text-sm font-black text-pink-500 hover:text-pink-400 tracking-wider font-mono text-left group flex items-center gap-1 transition-colors"
                title="Copy"
              >
                <span className="break-all">{roomCode}</span>
                <span className="text-[10px] text-zinc-600 group-hover:text-zinc-400">⎘</span>
              </button>
            </div>
          </div>

          <div className="sm:col-span-2 bg-zinc-900/40 border border-white/5 rounded-xl p-2 flex flex-col justify-center px-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-pink-500/10 text-pink-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest scale-90 origin-left">
                Now Playing
              </span>
            </div>
            <p className="text-xs font-bold text-zinc-200 mt-1 break-words whitespace-normal leading-snug">
              {currentTrackTitle || (currentVideoId ? "Loading track details…" : "Queue is empty — add a song! 🎤")}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}