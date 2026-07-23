import Image from "next/image";
import { Brush, Gem, MessageCircle, Printer, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/ui/site-header";
import Hero from "@/components/motion/hero";
import Reveal from "@/components/motion/reveal";
import TiltCard from "@/components/motion/tilt-card";
import HorizontalGallery, {
  type GalleryWork,
} from "@/components/motion/horizontal-gallery";

const SERVICES = [
  {
    icon: Brush,
    title: "半永久紋繡",
    description: "眉、眼線、唇的自然妝感,依臉型與膚色量身設計。",
  },
  {
    icon: Sparkles,
    title: "美睫設計",
    description: "根根分明到濃密混血款,打造你的日常電眼。",
  },
  {
    icon: Gem,
    title: "美甲藝術",
    description: "手繪、貓眼、鏡面,每一雙手都是行走的作品。",
  },
  {
    icon: Printer,
    title: "3D 列印客製",
    description: "把你的想法變成實體,客製飾品與紀念小物。",
  },
];

// 客戶好評:佔位假資料,之後改為真實回饋
const TESTIMONIALS = [
  {
    name: "陳小姐",
    service: "半永久紋繡",
    text: "眉型設計得非常自然,同事都以為我天生眉毛就這麼漂亮,補色也很細心。",
  },
  {
    name: "林小姐",
    service: "美睫設計",
    text: "第一次做睫毛就選對店!完全不刺眼不悶重,兩個月了還是很有型。",
  },
  {
    name: "張先生",
    service: "3D 列印客製",
    text: "訂做了求婚小物,細節做得超乎想像,女友感動到哭,大推!",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;

  const supabase = await createClient();
  const { data: creator } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "creator")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: works } = await supabase
    .from("portfolio_items")
    .select("id, title, category, description, cover_url, video_url")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .limit(24);

  const beautyWorks = (works ?? [])
    .filter((w) => w.category === "beauty")
    .slice(0, 8);
  const printWorks = (works ?? [])
    .filter((w) => w.category === "3dprint")
    .slice(0, 8);

  const name: string = creator?.display_name || "RUMORE BEAUTY";
  const bio: string =
    creator?.bio ||
    "以細節詮釋美。從半永久紋繡、美睫美甲到客製 3D 列印,每一件作品都為你量身打造。";
  const tagline = bio.split("\n")[0];
  const brandColor: string | undefined = creator?.brand_color;
  // Hero 背景影片:站主於後台單獨上傳指定
  const heroVideo: string | null = creator?.hero_video_url ?? null;
  const lineUrl: string | null = creator?.line_url ?? null;

  const socials = [
    { label: "Instagram", href: creator?.instagram_url },
    { label: "Facebook", href: creator?.facebook_url },
    { label: "Threads", href: creator?.threads_url },
    { label: "YouTube", href: creator?.youtube_url },
    { label: "LINE", href: lineUrl },
  ].filter((s): s is { label: string; href: string } => Boolean(s.href));

  return (
    <div
      className="min-h-dvh"
      style={brandColor ? ({ "--brand": brandColor } as React.CSSProperties) : undefined}
    >
      <SiteHeader />

      {notice === "studio_only" && (
        <div className="mx-auto mt-4 w-full max-w-5xl px-4">
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            此區僅限站主使用
          </p>
        </div>
      )}

      {/* 1. Hero */}
      <Hero name={name} tagline={tagline} videoUrl={heroVideo} />

      {/* 2. 關於 */}
      <section className="mx-auto grid max-w-5xl gap-10 px-4 py-20 md:grid-cols-[2fr_3fr] md:items-center md:py-28">
        <Reveal>
          <div className="relative mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-2xl border border-white/10">
            {creator?.avatar_url ? (
              <Image
                src={creator.avatar_url}
                alt={name}
                fill
                sizes="(min-width: 768px) 320px, 80vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/30 via-background to-[#7a5ab7]/20">
                <span className="font-serif text-6xl text-foreground/30">
                  {name.charAt(0)}
                </span>
              </div>
            )}
          </div>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mb-3 text-xs tracking-[0.35em] text-brand">ABOUT</p>
          <h2 className="font-serif text-3xl leading-snug sm:text-4xl">
            關於 {name}
          </h2>
          <p className="mt-6 whitespace-pre-line text-sm leading-loose text-foreground/65 sm:text-base">
            {bio}
          </p>
        </Reveal>
      </section>

      {/* 3. 精選作品:美容與 3D 列印各一個橫向滾動區塊 */}
      <HorizontalGallery
        works={beautyWorks as GalleryWork[]}
        category="beauty"
        eyebrow="PORTFOLIO・BEAUTY"
        title="美容作品集"
        moreHref="/works/beauty"
      />
      <HorizontalGallery
        works={printWorks as GalleryWork[]}
        category="3dprint"
        eyebrow="PORTFOLIO・3D PRINT"
        title="3D 列印作品集"
        moreHref="/works/3dprint"
      />

      {/* 4. 服務項目 */}
      <section className="mx-auto max-w-5xl px-4 py-20 md:py-28">
        <Reveal>
          <p className="mb-2 text-xs tracking-[0.35em] text-brand">SERVICES</p>
          <h2 className="font-serif text-3xl sm:text-4xl">服務項目</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service, i) => (
            <Reveal key={service.title} delay={i * 0.08}>
              <TiltCard className="h-full rounded-2xl border border-white/10 bg-white/5 p-6">
                <service.icon className="size-6 text-brand" />
                <h3 className="mt-5 font-medium">{service.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/55">
                  {service.description}
                </p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* 5. 客戶好評(佔位資料) */}
      <section className="border-y border-white/5 bg-white/[0.02] py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <Reveal>
            <p className="mb-2 text-xs tracking-[0.35em] text-brand">
              TESTIMONIALS
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl">客戶好評</h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.1}>
                <figure className="h-full rounded-2xl border border-white/10 bg-background/60 p-6">
                  <p className="text-brand" aria-hidden>
                    ★★★★★
                  </p>
                  <blockquote className="mt-4 text-sm leading-loose text-foreground/70">
                    「{t.text}」
                  </blockquote>
                  <figcaption className="mt-5 text-xs text-foreground/45">
                    {t.name}・{t.service}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 6. CTA:預約諮詢 */}
      <section className="relative overflow-hidden py-24 text-center md:py-32">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,var(--brand),transparent_70%)] opacity-15"
          aria-hidden
        />
        <Reveal className="relative mx-auto max-w-xl px-4">
          <h2 className="font-serif text-3xl leading-snug sm:text-4xl">
            準備好變得更美了嗎?
          </h2>
          <p className="mt-4 text-sm text-foreground/55 sm:text-base">
            透過 LINE 聊聊你的需求,為你安排最適合的服務。
          </p>
          {lineUrl ? (
            <a
              href={lineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-brand px-8 py-3.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              <MessageCircle className="size-4" />
              預約諮詢
            </a>
          ) : (
            <p className="mt-8 inline-block rounded-full border border-white/15 px-6 py-3 text-sm text-foreground/40">
              線上預約即將開放
            </p>
          )}
        </Reveal>
      </section>

      {/* 7. Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 sm:flex-row sm:justify-between">
          <p className="font-serif tracking-widest">{name}</p>
          {socials.length > 0 && (
            <nav className="flex gap-5" aria-label="社群連結">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs tracking-[0.2em] text-foreground/50 transition hover:text-brand"
                >
                  {s.label.toUpperCase()}
                </a>
              ))}
            </nav>
          )}
          <p className="text-xs text-foreground/35">
            © {new Date().getFullYear()} {name}
          </p>
        </div>
      </footer>
    </div>
  );
}
