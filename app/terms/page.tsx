export default function TermsPage() {
  return (
    <div className="flex-1 w-full bg-[#050505] text-zinc-300 px-5 py-12 md:py-20 font-sans selection:bg-pink-500/30">
      <div className="max-w-2xl mx-auto">
        
        {/* Header Block */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-zinc-500">Last updated: July 2, 2026</p>
        </div>

        {/* Casual Card Container */}
        <div className="bg-[#09090b]/40 border border-zinc-800/80 rounded-2xl p-6 md:p-8 space-y-6 text-[15px] leading-relaxed text-zinc-400">
          
          <p>
            Welcome to Musiciana! By signing into the app and hosting or joining a room, you agree to these simple rules. Musiciana is just a fun side-project made for synchronized karaoke entertainment, and we want to keep it simple and safe for everyone.
          </p>

          {/* Rules Section */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Rules of the platform</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-zinc-200">Account safety.</strong> We use Google secure sign-in to authenticate your entry. This ensures that only active and verified sessions can interact inside the KTV room queues.
              </li>
              <li>
                <strong className="text-zinc-200">Strictly free entertainment.</strong> Musiciana is built for non-commercial use. There are zero premium access fees, subscription models, or hidden costs required to sing.
              </li>
              <li>
                <strong className="text-zinc-200">Audio and video playback.</strong> Musiciana does not host, stream, or store any audio or video tracks on its own infrastructure. The system relies on the free, official YouTube Embedded API to load and sync publicly available link requests. All copyrights belong entirely to YouTube and their respective content creators.
              </li>
            </ul>
          </div>

          {/* How it Works Section */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">How it works behind the scenes</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To align real-time lyrics and playlist data precisely for every person inside a room.</li>
              <li>To allow anyone in the room to add or handle their own song requests seamlessly.</li>
              <li>To keep track of immediate feedback loops and quickly clean up empty rooms once sessions end.</li>
            </ul>
          </div>

          {/* Connected Contact Links */}
          <div className="pt-5 border-t border-zinc-800 text-sm text-zinc-500">
            <span className="font-bold text-zinc-400 block mb-1">Feedback & Suggestions</span>
            Found a bug or have a suggestion to improve the synchronization? Drop a note directly on the{" "}
            <a 
              href="/#Feedback" 
              className="text-pink-500 hover:text-pink-400 font-medium underline underline-offset-4 transition-colors"
            >
              Feedback Section
            </a>{" "}
            or use the{" "}
            <a 
              href="/#Contact" 
              className="text-violet-500 hover:text-violet-400 font-medium underline underline-offset-4 transition-colors"
            >
              Contact Form
            </a>{" "}
            located right on your dashboard.
          </div>

        </div>
      </div>
    </div>
  );
}