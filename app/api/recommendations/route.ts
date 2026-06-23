import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    // Kukuha ng hanggang 30 na kanta mula sa database cache mo
    const { data: cachedSongs, error } = await supabase
      .from('songs')
      .select('title')
      .limit(30);

    // Kung nag-error o walang laman ang database, magbalik ng empty array sa page.tsx
    if (error || !cachedSongs || cachedSongs.length === 0) {
      return NextResponse.json({
        content: [{ type: "text", text: JSON.stringify([]) }]
      });
    }

    // I-shuffle ang mga kanta mula sa DB at kumuha ng 4
    const shuffled = cachedSongs.sort(() => 0.5 - Math.random()).slice(0, 4);
    
    // Ibalik ang buong orihinal na pamagat para mahanap ulit nang tumpak sa YouTube search
    const formattedSongs = shuffled.map(song => ({
      title: song.title, // Buong pamagat na galing mismo sa YouTube dati
      artist: ""         // Iwanang blanko dahil kasama na sa title ang detalye
    }));

    return NextResponse.json({
      content: [{ type: "text", text: JSON.stringify(formattedSongs) }]
    });

  } catch (error) {
    console.error("Recommendations API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}