"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;

    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.push("/dashboard");
      else setLoading(false);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) router.push("/dashboard");
    });
    return () => subscription.unsubscribe();
  }, [router, supabase]);

  if (loading) return <div className="flex-1 bg-[#050505]" />;

  return (
    // Binalot natin sa isang parent section na may sapat na top padding (pt-24) para ligtas sa kahit anong sticky/fixed header sa mobile.
    <main className="flex-1 min-h-screen relative w-full overflow-y-auto bg-[#050505] px-5 pt-28 pb-12 md:py-6 selection:bg-pink-500/30 flex items-center justify-center">
      
      {/* GLOW WRAPPER */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-pink-600/15 rounded-full blur-[100px] md:blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] md:w-[600px] md:h-[600px] bg-indigo-600/15 rounded-full blur-[100px] md:blur-[150px]" />
        <div className="absolute top-[40%] right-[10%] w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[120px] hidden md:block" />
      </div>

      {/* CONTENT CONTAINER */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 md:grid-cols-[1fr_400px] lg:gap-16">
        
       {/* LEFT SIDE: Story & Welcome */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }}
          className="relative max-w-xl text-center md:text-left space-y-4"
        >
          <div className="absolute -left-6 top-1 bottom-1 w-1 bg-gradient-to-b from-pink-500 to-violet-500 rounded-full hidden md:block shadow-[0_0_15px_rgba(236,72,153,0.5)]" />
          
          <div className="space-y-2">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black bg-gradient-to-r from-pink-500 via-purple-400 to-indigo-500 bg-clip-text text-transparent tracking-tight">
              Musiciana
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base md:text-lg font-medium tracking-wide">Sync the vibe, sing the heart out.</p>
          </div>

          <p className="text-zinc-400 leading-relaxed text-sm md:text-base max-w-md mx-auto md:mx-0">
            Experience karaoke with family, friends, and anyone, anywhere. No downloads, just pure rhythm and connection.
          </p>

          <div className="relative group p-[1px] bg-gradient-to-br from-pink-500/20 to-violet-500/20 rounded-2xl border border-zinc-800/50 shadow-[0_0_20px_rgba(236,72,153,0.05)] text-left">
            <div className="p-4 sm:p-5 bg-[#09090b]/60 backdrop-blur-md rounded-2xl">
              <h3 className="font-bold text-pink-500 text-sm sm:text-base mb-2 flex items-center gap-2">
                <span>🎵</span> The Story Behind
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed italic font-normal">
                &quot;Musiciana is a labor of love dedicated to my girlfriend, Diana. Inspired by her beautiful voice, I blended &apos;Music&apos; and &apos;Diana&apos; to create a space that celebrates her talent. I’m sharing this platform with you all, hoping you find the same joy in music and singing that she brings into my life.&quot;
              </p>
            </div>
          </div>
        </motion.div>

        {/* RIGHT SIDE: Auth Form */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md justify-self-center bg-[#09090b]/70 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-zinc-800/80 shadow-[0_0_50px_rgba(0,0,0,0.6)]"
        >
          <div className="text-center mb-6">
             <span className="text-[10px] text-pink-400 border border-pink-500/20 bg-pink-500/5 px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(236,72,153,0.1)] tracking-widest uppercase font-semibold">
               Welcome to Musiciana
             </span>
          </div>
          
          {supabase ? (
            <div className="supabase-auth-custom-style">
              <Auth
                supabaseClient={supabase}
                appearance={{ 
                  theme: ThemeSupa,
                  variables: {
                    default: { 
                      colors: { 
                        brand: '#ec4899', 
                        brandAccent: '#d946ef',
                        inputBackground: '#141416',
                        inputBorder: '#27272a',
                        inputText: '#f4f4f5',
                        inputPlaceholder: '#71717a'
                      },
                      radii: { borderRadiusButton: '12px', buttonBorderRadius: '12px', inputBorderRadius: '12px' }
                    }
                  }
                }}
                theme="dark"
                providers={["google"]}
                view="sign_in"
                redirectTo={typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined}
              />
            </div>
          ) : (
            <p className="text-center text-sm leading-relaxed text-zinc-400">
              Supabase is not configured yet. Add the public URL and anon key to continue.
            </p>
          )}
        </motion.div>
      </div>
    </main>
  );
}