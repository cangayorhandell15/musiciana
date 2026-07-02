import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-zinc-950 border-t border-zinc-900/60 px-6 py-4 text-center text-xs text-zinc-600 font-mono flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
      <span>
        © {new Date().getFullYear()} MUSICIANA. Vibe responsibly. Keep the music playing. 🎧
      </span>
      <span className="hidden sm:inline text-zinc-800">|</span>
      <div className="flex gap-3">
        <Link href="/terms" className="hover:text-zinc-400 underline decoration-zinc-800 transition-colors">
          Terms
        </Link>
        <Link href="/privacy" className="hover:text-zinc-400 underline decoration-zinc-800 transition-colors">
          Privacy
        </Link>
      </div>
    </footer>
  );
}