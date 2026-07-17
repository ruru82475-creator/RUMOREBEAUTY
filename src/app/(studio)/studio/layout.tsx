import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/ui/site-header";

// 創作者後台守衛(middleware 已擋一層,這裡是第二層防護)
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/studio");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "creator") redirect("/?notice=studio_only");

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      {children}
    </div>
  );
}
