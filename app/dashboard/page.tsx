"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

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

  // Helper para sa magandang notification
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
      if (session?.user?.email) {setContactData(prev => ({ ...prev, email: session.user.email!, name: session.user.user_metadata?.full_name || 'User' // Depende sa metadata mo
  }));
}
    };
    init();
  }, []);

  const handleFeedbackSubmit = async () => {
  if (!feedback.message) return showToast("Please enter your feedback!", "error");
  
  setIsSubmitting(true);
  // DITO ANG MALI: Gamitin ang tamang variable name
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
  // Magdagdag tayo ng validation
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
    setContactData({ ...contactData, message: '' }); // Linisin ang textarea pagkatapos
  } catch {
    showToast("Error sending message. Try again.", "error");
  } finally {
    setIsSubmitting(false);
  }
};
  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center overflow-x-hidden relative">
      
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

      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-pink-600/10 rounded-full blur-[200px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-violet-600/10 rounded-full blur-[200px]" />
      </div>

      {/* Hero Section */}
      <section id="Home" className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="max-w-4xl text-center">
          <span className="px-4 py-1.5 rounded-full border border-pink-500/30 text-pink-500 text-xs font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(236,72,153,0.3)]">The Future of Karaoke</span>
          <h1 className="text-7xl md:text-9xl font-black mt-8 mb-6 bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">MUSICIANA</h1>
          <p className="text-xl md:text-2xl text-zinc-400 mb-12 max-w-2xl mx-auto">Sync the vibe, sing your heart out. Real-time karaoke rooms, shared queues, and pure rhythm with friends.</p>
          <button onClick={() => router.push("/")} className="px-10 py-4 bg-white text-black font-black rounded-full hover:bg-pink-500 hover:text-white transition-all">START SINGING</button>
        </motion.div>
      </section>

      {/* About Section */}
      <motion.section id="About" className="relative z-10 py-24 px-6 w-full max-w-5xl">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-6xl font-black mb-6">About Musiciana</h2>
            <p className="text-zinc-400 text-lg mb-8">Musiciana is a passion project dedicated to bringing people together through the power of music.</p>
            <div className="flex gap-4">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10"><div className="text-4xl font-black">{activeUsers.toLocaleString()}+</div><p className="text-xs uppercase text-zinc-400">Users</p></div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10"><div className="text-4xl font-black">{activeRooms.toLocaleString()}+</div><p className="text-xs uppercase text-zinc-400">Rooms</p></div>
            </div>
          </div>
          <div className="bg-[#09090b]/40 backdrop-blur-xl p-8 rounded-3xl border border-white/5">
            <h3 className="text-xl font-bold mb-4 text-pink-500">How it works:</h3>
            <ul className="space-y-3 text-zinc-300">
              <li><span className="font-bold text-white">1.</span> Create a room or join a room.</li>
              <li><span className="font-bold text-white">2.</span> Grab a mic or hairbrush and enjoy!</li>
              <li><span className="font-bold text-white">3.</span> Send a feedback.</li>
            </ul>
          </div>
        </div>
      </motion.section>

      {/* Feedback Section */}
      <motion.section 
  id="Feedback" 
  className="relative z-10 py-24 px-6 w-full max-w-3xl"
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
>
  <div className="text-center mb-12">
    <h2 className="text-5xl font-black mb-4">We Love Your Input!</h2>
    <p className="text-zinc-400 text-lg max-w-lg mx-auto">
      Help us make Musiciana better. Your feedback goes directly to our development team. 
      Share your thoughts, report a bug, or suggest a new feature!
    </p>
  </div>

  <div className="bg-[#09090b]/60 backdrop-blur-2xl p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
    {user ? (
      <div className="space-y-8">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-pink-500 mb-3">Rate your experience</p>
          <div className="flex gap-3 justify-center text-4xl">
            {[1, 2, 3, 4, 5].map((star) => (
              <button 
                key={star} 
                onClick={() => setFeedback({...feedback, rating: star})}
                className={`transition-all duration-300 ${star <= feedback.rating ? "text-yellow-400 hover:scale-110" : "text-zinc-700 hover:text-zinc-500"}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <textarea 
          className="w-full bg-black/40 p-4 rounded-2xl border border-white/10 outline-none focus:border-pink-500 transition-colors placeholder:text-zinc-600" 
          placeholder="How can we improve Musiciana for you?" 
          rows={4} 
          value={feedback.message} 
          onChange={(e) => setFeedback({...feedback, message: e.target.value})} 
        />

        <button 
          onClick={handleFeedbackSubmit} 
          disabled={isSubmitting}
          className="w-full bg-white text-black py-4 rounded-2xl font-black text-lg hover:bg-pink-500 hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Sending..." : "Submit Feedback"}
        </button>
      </div>
    ) : (
      <div className="text-center py-8">
        <p className="text-zinc-400 mb-6">You need to be logged in to share your thoughts.</p>
        <button 
          onClick={() => router.push("/")} 
          className="bg-white/5 px-8 py-3 rounded-full font-bold hover:bg-white/10 transition-all border border-white/10"
        >
          Log in to continue
        </button>
      </div>
    )}
  </div>
</motion.section>

      {/* Contact Section */}
  <motion.section id="Contact" className="relative z-10 py-20 px-6 w-full max-w-3xl">
  <h2 className="text-4xl font-black mb-8 text-center">Contact Me</h2>
  
  <div className="bg-[#09090b]/40 backdrop-blur-xl p-8 rounded-3xl border border-white/5 space-y-6">
    {user ? (
      <>
        {/* Info display (optional, para alam nila na naka-login sila) */}
        <div className="text-sm text-zinc-400 bg-white/5 p-4 rounded-xl border border-white/5">
          <p>Sending as: <span className="text-white font-bold">{user.email}</span></p>
        </div>

        <textarea 
          placeholder="What's on your mind? Tell me your suggestions or questions..." 
          rows={4}
          className="w-full bg-black/50 p-4 rounded-xl border border-white/5 outline-none focus:border-violet-500 transition-all"
          value={contactData.message}
          onChange={(e) => setContactData({...contactData, message: e.target.value})}
        />
        
        <button 
          onClick={handleContactSubmit}
          disabled={isSubmitting}
          className="w-full bg-violet-600 py-4 rounded-xl font-black hover:bg-violet-700 transition disabled:opacity-50"
        >
          {isSubmitting ? "Sending..." : "Send Message"}
        </button>
      </>
    ) : (
      <div className="text-center py-4">
        <p className="text-zinc-400 mb-6">Please log in to send a message directly to me.</p>
        <button 
          onClick={() => router.push("/")} 
          className="bg-white/5 px-8 py-3 rounded-full font-bold hover:bg-white/10 transition-all border border-white/10"
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
