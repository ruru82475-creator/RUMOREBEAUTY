import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// (studio) 路由群組不會出現在 URL 中,因此以 /studio 路徑前綴作為保護範圍
// 慣例:創作者後台頁面一律放在 src/app/(studio)/studio/ 底下
const STUDIO_PREFIX = "/studio";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 不可在 createServerClient 與 getUser 之間執行其他邏輯,否則 session 可能失效
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith(STUDIO_PREFIX)) {
    // 未登入 → 導向登入頁,並帶上原目的地
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", request.nextUrl.pathname);
      return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
    }

    // 已登入但非 creator → 導回首頁
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "creator") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      url.searchParams.set("notice", "studio_only"); // 首頁顯示「此區僅限站主使用」
      return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
    }
  }

  return supabaseResponse;
}

// redirect 回應必須帶上 Supabase 剛刷新的 session cookie,否則 session 會斷
function withSupabaseCookies(
  redirectResponse: NextResponse,
  supabaseResponse: NextResponse
) {
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}
