"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Animation variant para sa smooth reveal
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

export default function LandingPage() {
  const router = useRouter();

  // FIX: Scroll to section kung may hash sa URL (halimbawa: /#About)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.replace("#", "");
      const element = document.getElementById(id);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#050505] text-white flex flex-col items-center overflow-x-hidden relative">
      
      {/* BACKGROUND NEON GLOWS */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-pink-600/10 rounded-full blur-[200px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-violet-600/10 rounded-full blur-[200px]" />
      </div>

      {/* HERO SECTION */}
      <section id="Home" className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-6">
        <motion.div 
          initial="hidden" animate="visible" variants={fadeInUp} 
          className="max-w-4xl text-center"
        >
          <span className="px-4 py-1.5 rounded-full border border-pink-500/30 text-pink-500 text-xs font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(236,72,153,0.3)]">
            The Future of Karaoke
          </span>
          <h1 className="text-7xl md:text-9xl font-black mt-8 mb-6 bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
            MUSICIANA
          </h1>
          <p className="text-xl md:text-2xl text-zinc-400 mb-12 max-w-2xl mx-auto">
            Sync the vibe, sing your heart out. Real-time karaoke rooms, shared queues, and pure rhythm with friends.
          </p>
          <button 
            onClick={() => router.push("/login")} 
            className="px-10 py-4 bg-white text-black font-black rounded-full hover:bg-pink-500 hover:text-white transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            START SINGING
          </button>
        </motion.div>
      </section>

      {/* ABOUT SECTION */}
      <motion.section 
        id="About" 
        initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={fadeInUp}
        className="relative z-10 py-24 px-6 w-full max-w-4xl"
      >
        <div className="bg-[#09090b]/40 backdrop-blur-xl p-12 rounded-[2rem] border border-white/5 text-center">
          <h2 className="text-4xl font-bold mb-6">About Musiciana</h2>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Musiciana is a passion project built to bring people together through music. Designed for seamless real-time syncing, 
            it allows you to manage song queues with friends effortlessly using a simple QR code scan. No clutter, just pure karaoke fun.
          </p>
        </div>
      </motion.section>

      {/* FEEDBACK & CONTACT SECTION */}
      <motion.section 
        initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={fadeInUp}
        className="relative z-10 py-20 px-6 w-full max-w-5xl grid md:grid-cols-2 gap-8"
      >
        <div id="Feedback" className="bg-[#09090b]/40 backdrop-blur-xl p-8 rounded-3xl border border-white/5">
          <h3 className="text-2xl font-bold mb-6">Feedback</h3>
          <textarea className="w-full bg-black/50 p-4 rounded-xl border border-white/5 mb-4 focus:border-pink-500 outline-none" placeholder="Your thoughts..." rows={3}></textarea>
          <button className="w-full bg-white/5 py-3 rounded-xl font-bold hover:bg-white/10 transition">Submit</button>
        </div>

        <div id="Contact" className="bg-[#09090b]/40 backdrop-blur-xl p-8 rounded-3xl border border-white/5">
          <h3 className="text-2xl font-bold mb-6">Contact Me</h3>
          <input className="w-full bg-black/50 p-4 rounded-xl border border-white/5 mb-4 outline-none" placeholder="Your Email" />
          <button className="w-full bg-violet-600/20 py-3 rounded-xl font-bold hover:bg-violet-600/40 transition">Send Message</button>
        </div>
      </motion.section>

    </main>
  );
}