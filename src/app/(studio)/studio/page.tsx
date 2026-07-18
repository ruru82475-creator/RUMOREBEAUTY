import Link from "next/link";
import { Clapperboard, Images, Send, Users } from "lucide-react";

export const metadata = { title: "後台總覽 | GlowStudio" };

const sections = [
  {
    icon: Images,
    title: "作品集管理",
    description: "上傳與整理美容、3D 列印作品",
    href: "/studio/works",
  },
  {
    icon: Users,
    title: "客戶管理",
    description: "客戶名單、備註與通知設定",
    href: null,
  },
  {
    icon: Clapperboard,
    title: "影片工作室",
    description: "選樣板、AI 引導拍攝、自動剪輯",
    href: null,
  },
  {
    icon: Send,
    title: "社群發布",
    description: "一鍵發布到 IG、FB、Threads",
    href: null,
  },
];

export default function StudioPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-serif text-2xl">後台總覽</h1>
      <p className="mt-2 text-sm text-foreground/50">
        歡迎回來,從這裡管理你的品牌。
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map(({ icon: Icon, title, description, href }) =>
          href ? (
            <Link
              key={title}
              href={href}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-brand/50 hover:bg-white/10"
            >
              <Icon className="size-6 text-brand" />
              <h2 className="mt-4 font-medium">{title}</h2>
              <p className="mt-1 text-sm text-foreground/50">{description}</p>
              <p className="mt-4 inline-block rounded-full bg-brand px-3 py-1 text-xs text-white">
                進入管理 →
              </p>
            </Link>
          ) : (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <Icon className="size-6 text-brand" />
              <h2 className="mt-4 font-medium">{title}</h2>
              <p className="mt-1 text-sm text-foreground/50">{description}</p>
              <p className="mt-4 inline-block rounded-full border border-white/10 px-3 py-1 text-xs text-foreground/40">
                即將推出
              </p>
            </div>
          )
        )}
      </div>
    </main>
  );
}
