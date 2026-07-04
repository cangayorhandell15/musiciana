"use client";

import { createClient } from "@/utils/supabase/client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(hasSupabaseConfig);
  
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        router.push("/dashboard");
      } else {
        setLoading(false);
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) router.push("/dashboard");
    });
    return () => subscription.unsubscribe();
  }, [router, supabase]);

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
        }
      }
    });
  };

  if (loading) return <div className="flex-1 bg-[#050505]" />;

  return (
    /* 🌟 PINALITAN: Inalis ang 'min-h-screen' at ginawang 'flex-1 py-12 md:py-16' para sumunod sa Layout Flexbox */
    <div className="flex-1 w-full bg-[#050505] px-5 py-12 md:py-16 selection:bg-pink-500/30 flex items-center justify-center relative overflow-y-auto">
      
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
                &quot;Musiciana is a dedicated space built for anyone who loves to sing. Named after my girlfriend, Diana, and inspired by her beautiful singing voice, this platform was created to bring people together through song. Welcome, and enjoy the music.&quot;
              </p>
            </div>
          </div>
        </motion.div>

        {/* RIGHT SIDE: Auth Form */}
        <div className="w-full flex flex-col items-center justify-center">
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
              <div className="flex flex-col space-y-4">
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-black font-semibold text-sm py-2.5 px-4 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-md"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.53-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-8.58z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.11-6.68-4.96H1.21v3.15C3.18 21.88 7.31 24 12 24z" />
                    <path fill="#FBBC05" d="M5.32 14.24A7.16 7.16 0 0 1 5 12c0-.79.13-1.57.32-2.34V6.51H1.21A11.94 11.94 0 0 0 0 12c0 1.92.45 3.74 1.21 5.39l4.11-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.18 2.12 1.21 5.61l4.11 3.15c.94-2.85 3.57-4.96 6.68-4.96z" />
                  </svg>
                  Sign in with Google
                </button>
                
                <div className="flex items-center my-1 text-zinc-600 text-[10px] font-bold tracking-widest uppercase">
                  <div className="flex-1 h-[1px] bg-zinc-800" />
                  <span className="px-3">or use email</span>
                  <div className="flex-1 h-[1px] bg-zinc-800" />
                </div>

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
                    providers={[]}
                    view="sign_in"
                    redirectTo={typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined}
                  />
                </div>
              </div>
            ) : (
              <p className="text-center text-sm leading-relaxed text-zinc-400">
                Supabase is not configured yet. Add the public URL and anon key to continue.
              </p>
            )}
          </motion.div>

          {/* IMPLIED CONSENT TEXT */}
          <p className="mt-4 text-center text-[11px] text-zinc-500 max-w-xs leading-normal font-sans">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-pink-500/80 hover:text-pink-400 underline transition-colors">Terms of Service</Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-pink-500/80 hover:text-pink-400 underline transition-colors">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div> /* 🌟 PINALITAN: Ginawang <div> imbes na <main> para iwas conflict sa <main> ng layout.tsx */
  );
}