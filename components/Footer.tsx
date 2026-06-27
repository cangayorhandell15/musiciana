export default function Footer() {
  return (
    <footer className="w-full bg-zinc-950 border-t border-zinc-900/60 px-6 py-4 text-center text-xs text-zinc-600 font-mono">
      © {new Date().getFullYear()} MUSICIANA. Vibe responsibly. Keep the music playing. 🎧
    </footer>
  );
}