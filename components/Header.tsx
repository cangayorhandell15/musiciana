"use client";

import { createClient } from "@/utils/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const NAV_ITEMS = ["Home", "About", "Feedback", "Contact"];
const NAV_TARGET_PATH = "/dashboard";
const LEADERBOARD_PATH = "/leaderboard";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [nickname, setNickname] = useState<string>("User");
  const [scrolled, setScrolled] = useState(false);
  
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient();
  }, []);

  useEffect(() => {
    const updateUser = (sessionUser: User | null) => {
      setUser(sessionUser);
      if (sessionUser) {
        const name = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || sessionUser.email || "User";
        setNickname(name);
      }
    };

    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);

    if (!supabase) {
      return () => window.removeEventListener("scroll", onScroll);
    }

    supabase.auth.getUser().then(({ data }) => updateUser(data.user));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("scroll", onScroll);
    };
  }, [supabase]);

  const handleNavClick = (item: string) => {
    setIsMobileMenuOpen(false);
    if (pathname !== NAV_TARGET_PATH) {
      router.push(`${NAV_TARGET_PATH}#${item}`);
      return;
    }

    document.getElementById(item)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <>
      <header
        className={`fixed top-0 w-full z-50 px-6 transition-all duration-300 ${
          scrolled || isMobileMenuOpen
            ? "border-b border-white/5 bg-[#050505]/80 backdrop-blur-2xl py-2" // Mas manipis kapag nag-scroll
            : "bg-transparent py-3 md:py-4" // Nabawasan ang padding para hindi mataba
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo Section - Ginawang square ratio base sa itsura ng logo mo */}
          {/* Logo Section */}
          <div
            className="flex items-center cursor-pointer group relative w-20 h-10 md:w-28 md:h-12"
            onClick={() => router.push("/")}
          >
            <div className="absolute top-1/2 left-0 -translate-y-1/2 flex items-center justify-center">
              <Image 
                src="/music1.png" 
                alt="Musiciana Logo" 
                width={180} 
                height={180} 
                priority 
                // Naka-absolute at lumulutang na ang laki nito kaya hindi na niya tatabaan ang header mo!
                className="object-contain group-hover:opacity-80 transition-opacity duration-300 min-w-[70px] min-h-[70px] w-20 h-20 md:w-28 md:h-28"
              />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                onClick={() => handleNavClick(item)}
                className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-500 hover:text-pink-500 transition-colors duration-300"
              >
                {item}
              </button>
            ))}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-4">
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
                            setIsDropdownOpen(false);
                            if (!supabase || !user) { router.push("/"); return; }
                            const newRoomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                            const { error } = await supabase
                              .from("rooms")
                              .insert([{ room_code: newRoomCode, host_id: user.id, is_playing: false }]);

                            if (!error) { router.push(`/room/${newRoomCode}`); } 
                            else { alert("Error creating room!"); }
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                          ✨ CREATE ROOM
                        </button>

                        <button
                          onClick={() => { router.push("/join_room"); setIsDropdownOpen(false); }}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                          🔗 JOIN ROOM
                        </button>

                        <button
                          onClick={() => { router.push(LEADERBOARD_PATH); setIsDropdownOpen(false); }}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                        >
                          🏆 LEADERBOARD
                        </button>
                        
                        <hr className="border-white/5 my-1" />
                        
                        <button
                          onClick={async () => {
                            await supabase?.auth.signOut();
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
                  className="px-5 py-1.5 bg-white text-black text-[10px] font-black rounded-full hover:bg-pink-500 hover:text-white transition-all duration-300"
                >
                  LOGIN
                </button>
              )}
            </div>

            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex md:hidden flex-col justify-center items-center w-8 h-8 space-y-1 z-50 text-white"
              aria-label="Toggle Menu"
            >
              <span className={`block w-5 h-0.5 bg-current transition-transform duration-300 ${isMobileMenuOpen ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`block w-5 h-0.5 bg-current transition-opacity duration-300 ${isMobileMenuOpen ? "opacity-0" : ""}`} />
              <span className={`block w-5 h-0.5 bg-current transition-transform duration-300 ${isMobileMenuOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 top-[56px] bg-[#050505] z-40 md:hidden flex flex-col items-center justify-start pt-12 space-y-6"
          >
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                onClick={() => handleNavClick(item)}
                className="text-sm font-black tracking-[0.2em] uppercase text-zinc-400 hover:text-pink-500 transition-colors duration-300"
              >
                {item}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}