"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

// Ito ang susi para matandaan ng browser na napanood na niya ang loading screen
const SPLASH_STORAGE_KEY = "musiciana_has_seen_splash";

export default function GlobalSplash() {
  const [showSplash, setShowSplash] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // I-tsek kung nakita na ng user ang splash screen noon
    const hasSeenSplash = window.localStorage.getItem(SPLASH_STORAGE_KEY);
    
    // Kung HINDI pa niya nakikita, doon lang natin ipapakita
    if (hasSeenSplash !== "true") {
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
      // Pagkatapos ng 2.5 seconds, i-save sa browser na "true" (nakita na niya)
      window.localStorage.setItem(SPLASH_STORAGE_KEY, "true");
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
          className="fixed inset-0 z-[9999] h-screen w-screen overflow-hidden bg-[#0a0a0c]"
        >
          <div className="absolute inset-0 h-full w-full">
            <Image
              src="/splash/music2.gif"
              alt="Musiciana Loading"
              fill
              priority
              unoptimized
              className="object-cover object-center"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}