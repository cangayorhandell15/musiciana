import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { room_code } = await request.json();

    if (!room_code) {
      return NextResponse.json({ error: "Missing room code" }, { status: 400 });
    }

    // 1. Delete room_presence entries
    const { error: presenceError } = await supabase
      .from("room_presence")
      .delete()
      .eq("room_code", room_code);

    if (presenceError) {
      return NextResponse.json({ error: presenceError.message }, { status: 500 });
    }

    // 2. Delete queue entries
    const { error: queueError } = await supabase
      .from("queue")
      .delete()
      .eq("room_code", room_code);

    if (queueError) {
      return NextResponse.json({ error: queueError.message }, { status: 500 });
    }

    // 3. Delete the room
    const { error: roomError } = await supabase
      .from("rooms")
      .delete()
      .eq("room_code", room_code);

    if (roomError) {
      return NextResponse.json({ error: roomError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Room ${room_code} deleted successfully.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}