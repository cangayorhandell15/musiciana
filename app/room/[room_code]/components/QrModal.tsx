"use client";

import { QRCodeSVG } from "qrcode.react";

type Props = {
  roomCode: string;
  roomUrl: string;
  qrSize: number;
  onClose: () => void;
};

export function QrModal({ roomCode, roomUrl, qrSize, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950 border border-white/10 p-8 rounded-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center relative shadow-2xl shadow-pink-500/10 scale-up-animation"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white text-lg transition-colors"
        >
          ✕
        </button>

        <div>
          <h2 className="text-xl font-black text-white tracking-wide">JOIN THE ROOM</h2>
          <p className="text-xs text-zinc-400 mt-1">Scan the QR code below to jump in</p>
        </div>

        <div className="bg-white p-3 rounded-xl shadow-inner flex justify-center">
          <QRCodeSVG value={roomUrl} size={qrSize} />
        </div>

        <div className="bg-zinc-900 border border-white/5 px-6 py-3 rounded-xl w-full">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Room Code</p>
          <p className="text-2xl font-black text-pink-500 tracking-wider mt-0.5">{roomCode}</p>
        </div>

        <p className="text-[11px] text-zinc-500">Click anywhere outside or ✕ to close</p>
      </div>
    </div>
  );
}