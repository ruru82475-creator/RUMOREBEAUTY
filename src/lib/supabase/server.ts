import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 伺服器端 client:用於 Server Component、Server Action、Route Handler
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component 內無法寫 cookie;session 刷新由 middleware 負責
          }
        },
      },
    }
  );
}
