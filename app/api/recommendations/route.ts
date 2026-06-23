import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Kuhain ang context na pinasa mula sa frontend (page.tsx)
    const { context } = await request.json();

    // Buuin ang prompt depende kung may kasalukuyang kanta o queue
    const prompt = context
      ? `Given this karaoke session context — ${context} — suggest 4 karaoke songs that would fit well. Reply ONLY with a JSON array of objects like [{"title":"Song Name","artist":"Artist"}]. No explanation.`
      : `Suggest 4 popular karaoke songs. Reply ONLY with a JSON array of objects like [{"title":"Song Name","artist":"Artist"}]. No explanation.`;

    // Native fetch gamit ang URL at headers na tinatanggap ng Anthropic API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "", 
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic API failed with status ${response.status}`);

    const data = await response.json();
    
    // Ibalik ang nakuha nating data pabalik sa iyong page.tsx
    return NextResponse.json(data);

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}