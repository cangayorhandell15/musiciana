"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

export default function GlobalSplash() {
  const [showSplash, setShowSplash] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const hasSeenSplash = window.sessionStorage.getItem("hasSeenSplash");
    if (!hasSeenSplash) {
      setShowSplash(true);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    if (showSplash) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    if (!showSplash) return;

    const timer = window.setTimeout(() => {
      setShowSplash(false);
      window.sessionStorage.setItem("hasSeenSplash", "true");
    }, 2500);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isMounted, showSplash]);

  if (!isMounted) return null;

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
          className="fixed inset-0 z-[9999] overflow-hidden bg-black"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_rgba(34,211,238,0.08),_transparent_25%),radial-gradient(circle_at_80%_20%,_rgba(236,72,153,0.08),_transparent_30%),radial-gradient(circle_at_50%_85%,_rgba(168,85,247,0.08),_transparent_35%)]" />
          <div className="absolute inset-0 bg-black/70 sm:bg-black/60" />

          <div className="relative z-10 flex h-full w-full items-center justify-center px-0 sm:px-4">
            <div className="relative h-full w-full max-w-[100vw] max-h-[100vh]">
              <Image
                src="/splash/splash2.gif"
                alt="Musiciana Loading"
                fill
                priority
                unoptimized
                className="object-contain md:object-cover"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}