"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const NAV_ITEMS = ["Home", "About", "Feedback", "Contact"];
const NAV_TARGET_PATH = "/dashboard";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [nickname, setNickname] = useState<string>("User");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
  
    // Pinagsamang logic para laging updated ang user at nickname
    const updateUser = (sessionUser: User | null) => {
      setUser(sessionUser);
      if (sessionUser) {
        const name = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || sessionUser.email || "User";
        setNickname(name);
      }
    };

    // Initial load
    supabase.auth.getUser().then(({ data }) => updateUser(data.user));

    // Real-time listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user ?? null);
    });

    // Scroll effect
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("scroll", onScroll);
    };

    
  }, []);

  return (
    <header
      className={`fixed top-0 w-full z-50 px-6 py-4 flex items-center justify-between transition-all duration-500 ${
        scrolled
          ? "border-b border-white/5 bg-[#050505]/80 backdrop-blur-2xl"
          : "bg-transparent"
      }`}
    >
      {/* Logo */}
      <div
        className="flex items-center space-x-2 cursor-pointer group"
        onClick={() => router.push("/")}
      >
        <span className="text-xl">🎧</span>
        <span className="text-lg font-black tracking-widest text-white group-hover:text-pink-500 transition-colors duration-300">
          MUSICIANA
        </span>
      </div>

      {/* Navigation */}
      <nav className="hidden md:flex items-center space-x-8">
        {NAV_ITEMS.map((item) => (
          <button
            key={item}
            onClick={() => {
              if (pathname !== NAV_TARGET_PATH) {
                router.push(`${NAV_TARGET_PATH}#${item}`);
                return;
              }

              document.getElementById(item)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-500 hover:text-pink-500 transition-colors duration-300"
          >
            {item}
          </button>
        ))}
      </nav>

      {/* Auth Section */}
      <div className="relative">
        {user ? (
          <>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-8 h-8 rounded-full border border-zinc-700 overflow-hidden ring-2 ring-transparent hover:ring-pink-500 transition-all"
            >
              <img
                src={
                  user.user_metadata?.avatar_url ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`
                }
                alt="Avatar"
              />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-48 bg-[#09090b] border border-white/10 rounded-xl py-2 shadow-2xl z-50"
                >
                  <p className="px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-500 font-bold truncate">
                    {nickname}
                  </p>
                  <hr className="border-white/5 my-1" />
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setIsDropdownOpen(false);
                      router.push("/");
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    SIGN OUT 🚪
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 bg-white text-black text-[10px] font-black rounded-full hover:bg-pink-500 hover:text-white transition-all duration-300"
          >
            LOGIN
          </button>
        )}
      </div>
    </header>
  );
}
