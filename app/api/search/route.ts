import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface YouTubeItem {
  id: { videoId: string };
  snippet: {
    title: string;
    thumbnails: { default: { url: string } };
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query) return NextResponse.json({ error: "Query is required" }, { status: 400 });

  try {
    // 1. Check Cache
    const { data: cachedSongs } = await supabase
      .from('songs')
      .select('video_id, title, thumbnail')
      .ilike('search_term', `%${query}%`)
      .limit(5);

    if (cachedSongs && cachedSongs.length > 0) {
      const normalized = cachedSongs.map((song) => ({
        id: { videoId: song.video_id },
        snippet: {
          title: song.title,
          thumbnails: { default: { url: song.thumbnail } },
        },
      }));
      return NextResponse.json(normalized);
    }

    // 2. Fetch YouTube
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&key=${process.env.YOUTUBE_API_KEY}&type=video&videoEmbeddable=true&maxResults=5`
    );

    if (!response.ok) throw new Error("Failed to fetch from YouTube");

    const data = await response.json();
    const items: YouTubeItem[] = data.items || [];

    // 3. Save sa DB (Upsert)
    if (items.length > 0) {
      const songsToInsert = items.map((item) => ({
        video_id: item.id.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.default.url,
        search_term: query,
        last_fetched: new Date().toISOString()
      }));

      // Gamit ang onConflict + ignoreDuplicates, kung existing na ang video_id, 
      // i-o-omit nito ang insert para maiwasan ang duplicate keys o unnecessary updates.
      const { error: upsertError } = await supabase
        .from('songs')
        .upsert(songsToInsert, { 
          onConflict: 'video_id',
          ignoreDuplicates: true 
        });

      if (upsertError) {
        console.error("Upsert Error:", upsertError);
        // Hindi natin kailangang i-fail ang request kung nag-error lang ang caching
      }
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}