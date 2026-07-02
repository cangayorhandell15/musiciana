export default function PrivacyPage() {
  return (
    <div className="flex-1 w-full bg-[#050505] text-zinc-300 px-5 py-12 md:py-20 font-sans selection:bg-pink-500/30">
      <div className="max-w-2xl mx-auto">
        
        {/* Header Block */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-zinc-500">Last updated: July 2, 2026</p>
        </div>

        {/* Casual Card Container */}
        <div className="bg-[#09090b]/40 border border-zinc-800/80 rounded-2xl p-6 md:p-8 space-y-6 text-[15px] leading-relaxed text-zinc-400">
          
          <p>
            Musiciana is a real-time web application built for synchronized karaoke entertainment. We care deeply about online privacy, which is why we practice strict data minimization—meaning we only ask for the absolute bare minimum needed to run the app securely.
          </p>

          {/* What We Collect Section */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Information we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-zinc-200">Account sessions.</strong> We utilize Google secure login. When you authenticate, we receive your email address, display name, and public profile photo from Google. Your Google password remains completely invisible to us.
              </li>
              <li>
                <strong className="text-zinc-200">Temporary room data.</strong> The music tracks you look up or add to the playlist queue are strictly used to keep everyone in the session synchronized.
              </li>
              <li>
                <strong className="text-zinc-200">Cookies.</strong> We use a basic, secure session token strictly to remember your login status. We do not drop any tracking code or marketing cookies onto your machine.
              </li>
            </ul>
          </div>

          {/* How We Use It Section */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">How we use it</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To safely sign you into our application framework.</li>
              <li>To render your identification card inside active room queues so other users know who added the current track.</li>
              <li>To receive and read your direct feedback or technical bug reports without passing it through third-party platforms.</li>
            </ul>
          </div>

          <p className="pt-2 text-zinc-200 font-medium">
            We do not lease, trade, or sell your personal data to any corporate ad-networks.
          </p>

          {/* Dynamic Link papunta sa main Dashboard Sections mo */}
          <div className="pt-5 border-t border-zinc-800 text-sm text-zinc-500">
            <span className="font-bold text-zinc-400 block mb-1">Contact & Support</span>
            Questions about this policy or want to report a bug? Reach out directly through the{" "}
            <a 
              href="/#Feedback" 
              className="text-pink-500 hover:text-pink-400 font-medium underline underline-offset-4 transition-colors"
            >
              Feedback Section
            </a>{" "}
            or open the{" "}
            <a 
              href="/#Contact" 
              className="text-violet-500 hover:text-violet-400 font-medium underline underline-offset-4 transition-colors"
            >
              Contact Form
            </a>{" "}
            on your main dashboard page.
          </div>

        </div>
      </div>
    </div>
  );
}