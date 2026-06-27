"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

const supabase = createClient();

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

export default function LandingPage() {
  const router = useRouter();
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [activeRooms, setActiveRooms] = useState<number>(0);
  const [user, setUser] = useState<User | null>(null);
  const [feedback, setFeedback] = useState({ email: '', rating: 5, message: '' });
  const [contactData, setContactData] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const init = async () => {
      const { data: userCount } = await supabase.rpc('get_user_count');
      const { data: roomCount } = await supabase.rpc('get_room_count');
      if (userCount !== null) setActiveUsers(userCount);
      if (roomCount !== null) setActiveRooms(roomCount);

      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      if (session?.user?.email) setFeedback(prev => ({ ...prev, email: session.user.email! }));
      if (session?.user?.email) {
        setContactData(prev => ({ 
          ...prev, 
          email: session.user.email!, 
          name: session.user.user_metadata?.full_name || 'User' 
        }));
      }
    };
    init();
  }, []);

  const handleFeedbackSubmit = async () => {
    if (!feedback.message) return showToast("Please enter your feedback!", "error");
    
    setIsSubmitting(true);
    const SPREADSHEET_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL!; 
    
    try {
      await fetch(SPREADSHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...feedback, type: "feedback" })
      });
      showToast("Thank you for your feedback!", "success");
      setFeedback({ ...feedback, message: '' });
    } catch {
      showToast("Failed to send feedback. Try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleContactSubmit = async () => {
    if (!contactData.message) return showToast("Please enter a message!", "error");
    
    setIsSubmitting(true);
    const SPREADSHEET_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_URL!;
    
    try {
      await fetch(SPREADSHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contactData, type: "contact" })
      });
      showToast("Message sent! Thanks for reaching out.", "success");
      setContactData({ ...contactData, message: '' }); 
    } catch {
      showToast("Error sending message. Try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center overflow-x-hidden relative selection:bg-pink-500 selection:text-white">
      
      {/* TOAST NOTIFICATION UI */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 20 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-0 z-50 px-6 py-3 rounded-2xl border ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* BACKGROUND GLOWS */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-pink-600/5 rounded-full blur-[160px] md:blur-[200px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-violet-600/5 rounded-full blur-[160px] md:blur-[200px]" />
      </div>

      {/* Hero Section */}
      <section id="Home" className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-6 border-b border-white/[0.02]">
        <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="max-w-4xl text-center flex flex-col items-center">
          <span className="px-4 py-1.5 rounded-full border border-pink-500/20 text-pink-500 text-[10px] md:text-xs font-bold tracking-widest uppercase bg-pink-500/[0.02] shadow-[0_0_30px_rgba(236,72,153,0.1)]">
            The Future of Karaoke
          </span>
          <h1 className="text-6xl sm:text-7xl md:text-[9.5rem] font-black mt-6 mb-4 tracking-tighter bg-gradient-to-b from-white via-white to-zinc-600 bg-clip-text text-transparent leading-none select-none">
            MUSICIANA
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 mb-12 max-w-2xl mx-auto font-medium leading-relaxed">
            Sync the vibe, sing your heart out. Real-time karaoke rooms, shared queues, and pure rhythm with friends and family.
          </p>
        </motion.div>
      </section>

      {/* About Section */}
      <AboutComponent activeUsers={activeUsers} />

      {/* Feedback Section */}
      <motion.section 
        id="Feedback" 
        className="relative z-10 py-32 px-6 w-full max-w-2xl border-b border-white/[0.02]"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="text-center mb-10">
          <span className="text-[10px] uppercase font-black tracking-widest text-pink-500 bg-pink-500/10 px-3 py-1 rounded-full border border-pink-500/20">
            Reviews & Suggestions
          </span>
          <h2 className="text-4xl font-black mt-4 mb-3 tracking-tight">We Love Your Feedback!</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
            Got ideas for Musiciana?
Help me make this app better for you. Drop your suggestions, feature requests, or bugs below!
          </p>
        </div>

        <div className="bg-[#09090b]/40 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
          {user ? (
            <div className="space-y-6">
              <div className="text-center bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Rate your experience</p>
                <div className="flex gap-2.5 justify-center text-3xl">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star} 
                      onClick={() => setFeedback({...feedback, rating: star})}
                      className={`transition-all duration-200 ${star <= feedback.rating ? "text-yellow-400 scale-110 drop-shadow-[0_0_10px_rgba(250,204,21,0.2)]" : "text-zinc-700 hover:text-zinc-500"}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <textarea 
                className="w-full bg-black/40 p-4 text-sm rounded-2xl border border-white/5 outline-none focus:border-pink-500/50 transition-colors placeholder:text-zinc-600 resize-none" 
                placeholder="How can we improve Musiciana for you?" 
                rows={4} 
                value={feedback.message} 
                onChange={(e) => setFeedback({...feedback, message: e.target.value})} 
              />

              <button 
                onClick={handleFeedbackSubmit} 
                disabled={isSubmitting}
                className="w-full bg-white text-black py-3.5 rounded-2xl font-black text-sm hover:bg-pink-500 hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Sending..." : "Submit Feedback"}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-zinc-400 text-sm mb-4">You need to be logged in to share your thoughts.</p>
              <button 
                onClick={() => router.push("/")} 
                className="bg-white/5 px-6 py-2.5 text-xs rounded-full font-bold hover:bg-white/10 transition-all border border-white/10"
              >
                Log in to continue
              </button>
            </div>
          )}
        </div>
      </motion.section>

      {/* Contact Section */}
      <motion.section 
        id="Contact" 
        className="relative z-10 py-32 px-6 w-full max-w-2xl"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <div className="text-center mb-10">
          <span className="text-[10px] uppercase font-black tracking-widest text-violet-500 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">
            Get In Touch
          </span>
          <h2 className="text-4xl font-black mt-4 mb-3 tracking-tight">Contact Me</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
            Have any professional inquiries, partnerships, or business collaborations in mind? Hit me up.
          </p>
        </div>
        
        <div className="bg-[#09090b]/40 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
          {user ? (
            <div className="space-y-5">
              <div className="text-xs text-zinc-400 bg-white/[0.02] p-4 rounded-xl border border-white/5 flex items-center justify-between">
                <span>Sending email as:</span>
                <span className="text-zinc-200 font-semibold">{user.email}</span>
              </div>

              <textarea 
                placeholder="What's on your mind? Tell me your suggestions or questions..." 
                rows={5}
                className="w-full bg-black/40 p-4 text-sm rounded-2xl border border-white/5 outline-none focus:border-violet-500/50 transition-all placeholder:text-zinc-600 resize-none"
                value={contactData.message}
                onChange={(e) => setContactData({...contactData, message: e.target.value})}
              />
              
              <button 
                onClick={handleContactSubmit}
                disabled={isSubmitting}
                className="w-full bg-violet-600 text-white py-3.5 rounded-2xl font-black text-sm hover:bg-violet-700 transition duration-300 shadow-lg shadow-violet-600/10 disabled:opacity-50"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-zinc-400 text-sm mb-4">Please log in to send a message directly to me.</p>
              <button 
                onClick={() => router.push("/")} 
                className="bg-white/5 px-6 py-2.5 text-xs rounded-full font-bold hover:bg-white/10 transition-all border border-white/10"
              >
                Log in to continue
              </button>
            </div>
          )}
        </div>
      </motion.section>
    </main>
  );
}

function AboutComponent({ activeUsers }: { activeUsers: number }) {
  const [activeImage, setActiveImage] = useState<"/s1.png" | "/s2.png">("/s1.png");

  return (
    <motion.section 
      id="About" 
      className="relative z-10 py-32 px-4 md:px-6 w-full max-w-5xl mx-auto border-b border-white/[0.02]"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="grid md:grid-cols-5 gap-12 items-center">
        
        {/* Left Column: Info & Dynamic Screenshot Preview */}
        <div className="md:col-span-2 space-y-6 flex flex-col justify-between h-full">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-400">
              About Musiciana
            </h2>
            <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
              Musiciana is a passion project dedicated to bringing people together through the power of music.
            </p>
            
            {/* Minimalist Live Badge instead of a heavy block container */}
            <div className="inline-flex items-center gap-2 bg-zinc-900/60 border border-white/5 px-3 py-1.5 rounded-full backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-black text-zinc-300 tracking-wide">
                {activeUsers.toLocaleString()}+ Active Users
              </span>
            </div>
          </div>

          {/* DYNAMIC SCREENSHOT PREVIEW */}
          <div className="relative w-full aspect-[16/10] rounded-[2rem] border border-white/5 bg-zinc-950 overflow-hidden shadow-2xl group/img">
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10 opacity-30" />
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeImage}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.04 }}
                transition={{ duration: 0.25 }}
                className="w-full h-full relative"
              >
                <Image
                  src={activeImage}
                  alt="Musiciana App Preview"
                  fill
                  priority
                  className="object-cover group-hover/img:scale-105 transition-transform duration-700"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Interactive How It Works Steps */}
        <div className="md:col-span-3 space-y-4">
          <div className="inline-block px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-500 text-[10px] font-black uppercase tracking-widest mb-2">
            How It Works
          </div>
          
          {/* Step 1 */}
          <div 
            onMouseEnter={() => setActiveImage("/s1.png")}
            className="group flex gap-5 bg-zinc-900/10 hover:bg-zinc-900/30 border border-white/[0.03] hover:border-pink-500/10 p-5 rounded-2xl cursor-pointer transition-all duration-300"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 group-hover:bg-pink-500/10 border border-white/10 group-hover:border-pink-500/20 flex items-center justify-center font-black text-sm text-zinc-400 group-hover:text-pink-500 transition-colors">
              01
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1 group-hover:text-pink-400 transition-colors">Create or Join</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Set up your own private lounge or enter a friend's room instantly via code.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div 
            onMouseEnter={() => setActiveImage("/s2.png")}
            className="group flex gap-5 bg-zinc-900/10 hover:bg-zinc-900/30 border border-white/[0.03] hover:border-pink-500/10 p-5 rounded-2xl cursor-pointer transition-all duration-300"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 group-hover:bg-pink-500/10 border border-white/10 group-hover:border-pink-500/20 flex items-center justify-center font-black text-sm text-zinc-400 group-hover:text-pink-500 transition-colors">
              02
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1 group-hover:text-pink-400 transition-colors">Vibe & Sing Along</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Grab your microphone, hit play, and experience karaoke with friends or family!.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div 
            onMouseEnter={() => setActiveImage("/s1.png")}
            className="group flex gap-5 bg-zinc-900/10 hover:bg-zinc-900/30 border border-white/[0.03] hover:border-pink-500/10 p-5 rounded-2xl cursor-pointer transition-all duration-300"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 group-hover:bg-pink-500/10 border border-white/10 group-hover:border-pink-500/20 flex items-center justify-center font-black text-sm text-zinc-400 group-hover:text-pink-500 transition-colors">
              03
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1 group-hover:text-pink-400 transition-colors">Share Feedback</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Help me fine-tune the rhythm. Let me know how can i make your session better.
              </p>
            </div>
          </div>
        </div>

      </div>
    </motion.section>
  );
}