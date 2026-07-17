import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SiteHeader from "@/components/ui/site-header";
import AccountForm, { type ClientAccount } from "./account-form";

export const metadata = { title: "我的資料 | GlowStudio" };

const CLIENT_FIELDS =
  "id, name, phone, email, birthday, notify_email, notify_sms, notify_line";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/account");

  let { data: clientRow } = await supabase
    .from("clients")
    .select(CLIENT_FIELDS)
    .eq("auth_user_id", user.id)
    .limit(1)
    .maybeSingle();

  // 首次進入:以「已驗證的登入 Email」自動綁定站主先前建立的客戶資料
  if (!clientRow && user.email) {
    const admin = createAdminClient();
    const { data: match } = await admin
      .from("clients")
      .select("id")
      .is("auth_user_id", null)
      .eq("email", user.email)
      .limit(1)
      .maybeSingle();

    if (match) {
      await admin
        .from("clients")
        .update({ auth_user_id: user.id })
        .eq("id", match.id);

      ({ data: clientRow } = await supabase
        .from("clients")
        .select(CLIENT_FIELDS)
        .eq("auth_user_id", user.id)
        .limit(1)
        .maybeSingle());
    }
  }

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="font-serif text-2xl">我的資料</h1>
        <p className="mt-2 text-sm text-foreground/50">
          管理你的聯絡資料與通知偏好。
        </p>

        {clientRow ? (
          <AccountForm client={clientRow as ClientAccount} />
        ) : (
          <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-5 py-8 text-sm leading-relaxed text-foreground/70">
            目前沒有與此帳號綁定的客戶資料。
            <br />
            若你是本店客戶,請聯絡你的美容師,確認預留的 Email
            與登入使用的 Email 相同,下次登入即會自動綁定。
          </p>
        )}
      </main>
    </div>
  );
}
