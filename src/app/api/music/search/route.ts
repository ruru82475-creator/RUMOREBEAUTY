import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchFreeMusic } from "@/lib/music/openverse";

// 搜尋開放授權免費音樂(Openverse,CC0 / 公眾領域 / CC-BY)
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const tracks = await searchFreeMusic(query.slice(0, 60));
    return NextResponse.json({ tracks });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "音樂搜尋失敗,請稍後再試",
      },
      { status: 502 }
    );
  }
}
