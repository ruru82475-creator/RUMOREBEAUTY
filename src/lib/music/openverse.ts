import "server-only";

// Openverse:WordPress 基金會維運的開放授權素材搜尋(CC 授權,免 API 金鑰)
// 文件:https://api.openverse.org/v1/
const API = "https://api.openverse.org/v1/audio/";

export type FreeTrack = {
  id: string;
  title: string;
  creator: string;
  license: string;
  durationSec: number | null;
  url: string; // 音檔位址
  detailUrl: string; // 來源頁(標示出處用)
};

export async function searchFreeMusic(
  query: string,
  limit = 12
): Promise<FreeTrack[]> {
  const params = new URLSearchParams({
    q: query || "background music",
    page_size: String(limit),
    // 僅取可自由使用(含商用)的授權,避免授權疑慮
    license: "cc0,pdm,by",
    mature: "false",
  });

  const res = await fetch(`${API}?${params}`, {
    headers: { "User-Agent": "GlowStudio/1.0 (creator video tool)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error("音樂搜尋服務暫時無法使用,請稍後再試");
  }

  const data = (await res.json()) as {
    results?: {
      id: string;
      title?: string;
      creator?: string;
      license?: string;
      duration?: number;
      url?: string;
      foreign_landing_url?: string;
    }[];
  };

  return (data.results ?? [])
    .filter((item) => Boolean(item.url))
    .map((item) => ({
      id: item.id,
      title: item.title?.trim() || "未命名曲目",
      creator: item.creator?.trim() || "未知創作者",
      license: (item.license ?? "cc").toUpperCase(),
      durationSec: item.duration ? Math.round(item.duration / 1000) : null,
      url: item.url!,
      detailUrl: item.foreign_landing_url ?? "",
    }));
}
