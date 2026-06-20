import { NextRequest, NextResponse } from 'next/server';
import ytDlp, { YtResponse } from 'yt-dlp-exec';
import path from 'path';

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get('id');
  
  if (!videoId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  try {
    process.env.YTDLP_PATH = path.join(process.cwd(), 'yt-dlp.exe');

    // Dito natin i-type ang data bilang YtResponse
    const data: YtResponse = await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpSingleJson: true,
      format: 'best',
    });

    // Sa YtResponse, ang 'url' ay nasa loob ng object
    const url = data.url;

    if (!url) {
      return NextResponse.json({ error: 'Could not extract stream URL' }, { status: 404 });
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("yt-dlp error:", error);
    return NextResponse.json({ error: 'Failed to fetch stream' }, { status: 500 });
  }
}