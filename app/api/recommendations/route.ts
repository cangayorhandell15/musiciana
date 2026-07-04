import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    // 1. Lakihan ang limit (hal. 200) para mas malawak ang pool ng kanta na pwedeng pagpilian mula sa DB cache
    const { data: cachedSongs, error } = await supabase
      .from('songs')
      .select('title')
      .limit(200);

    // Kung nag-error o walang laman ang database, magbalik ng empty array
    if (error || !cachedSongs || cachedSongs.length === 0) {
      return NextResponse.json({
        content: [{ type: "text", text: JSON.stringify([]) }]
      });
    }

    // 2. Gumawa ng shallow copy at i-shuffle gamit ang isang mas agresibong random sorter
    const shuffled = [...cachedSongs]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4); // Kumuha ng 4 na random na kanta
    
    // 3. I-format ang output para tugma sa inaasahan ng useKaraokeSearch hook
    const formattedSongs = shuffled.map(song => ({
      title: song.title, // Buong pamagat na galing sa YouTube na may detalye
      artist: ""         // Iwanang blanko dahil kasama na sa pamagat ang pangalan ng singer
    }));

    // 4. Ibalik ang JSON string sa loob ng content array (sinusunod ang nakaraang LLM component string format)
    return NextResponse.json({
      content: [{ type: "text", text: JSON.stringify(formattedSongs) }]
    });

  } catch (error) {
    console.error("Recommendations API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}