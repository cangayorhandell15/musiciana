"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";

export default function JoinRoomPage() {
  const [roomCode, setRoomCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const normalizeRoomCode = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return "";

    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split("/").filter(Boolean);
      const roomIndex = segments.findIndex((segment) => segment.toLowerCase() === "room");
      if (roomIndex !== -1 && segments[roomIndex + 1]) {
        return segments[roomIndex + 1];
      }
    } catch {
      // not a valid URL, continue with fallback
    }

    const match = trimmed.match(/room\/([A-Za-z0-9_-]+)/i);
    if (match) return match[1];

    return trimmed;
  };

  const handleJoinRoom = (code: string) => {
    const cleanedCode = normalizeRoomCode(code);
    if (!cleanedCode) {
      setError("Please enter or scan a valid room code.");
      return;
    }

    stopScanner();
    router.push(`/room/${cleanedCode}`);
  };

  // Hiwalay na function para sa pagpapatay ng camera stream cleanly
  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
    }
    setIsScanning(false);
  };

  const startScanner = async () => {
    setError("");
    setIsScanning(true);

    // Bigyan ng konting milisegundo ang DOM para mag-render muna yung target div container
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader-container");
        html5QrCodeRef.current = scanner;

        // I-start ang camera gamit ang 'environment' (back camera sa mobile, default sa PC)
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // Success! May nahanap na valid QR code
            setRoomCode(decodedText);
            scanner.stop().then(() => {
              setIsScanning(false);
              handleJoinRoom(decodedText);
            });
          },
          (errorMessage) => {
            // verbose parsing errors habang nag-scan (pwedeng i-ignore lang)
          }
        );
      } catch (err: any) {
        console.error("Camera access error:", err);
        setError("Could not access camera. Please check permissions or use HTTPS.");
        setIsScanning(false);
      }
    }, 300);
  };

  // Siguraduhing patay ang cam kapag biglang umalis ng page ang user
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((err) => console.error(err));
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-4">
      <div className="w-full max-w-md p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold text-center mb-6 flex items-center justify-center gap-2">
          🔗 Join a Room
        </h1>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4 bg-red-950/50 p-2 rounded-lg border border-red-900">
            {error}
          </p>
        )}

        {isScanning ? (
          <div className="flex flex-col items-center mb-6">
            {/* Dito sa loob lalabas ang live feed ng camera mo nang malinis */}
            <div 
              id="qr-reader-container" 
              className="w-full overflow-hidden rounded-lg border border-zinc-700 bg-black aspect-video"
            ></div>
            <button
              onClick={stopScanner}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel Scan
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Enter Room Code
              </label>
              <input
                type="text"
                placeholder="e.g. ROOM-1234"
                value={roomCode}
                onChange={(e) => {
                  setError("");
                  setRoomCode(e.target.value);
                }}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-white placeholder-zinc-500"
              />
            </div>

            <button
              onClick={() => handleJoinRoom(roomCode)}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-black font-semibold rounded-xl transition-colors shadow-lg shadow-orange-500/20"
            >
              Join with Code
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink mx-4 text-zinc-500 text-sm">or</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            <button
              onClick={startScanner}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              ✨ Scan QR Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}