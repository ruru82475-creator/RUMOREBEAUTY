// 背景音樂資源庫的共用定義(前後端共用,不可引用 Node 專用模組)
//
// 註:Pixabay 的公開 API 只涵蓋圖片與影片,沒有音樂端點,
//     因此音樂採「站主自行匯入 → 存於 R2 + music_library 資料表」的方式管理。
export type MusicMood =
  | "chill"
  | "upbeat"
  | "elegant"
  | "energetic"
  | "cinematic";

export type MoodDef = {
  id: MusicMood;
  label: string;
  description: string;
  /** Pixabay 的分類下載連結(依授權可商用、免標註出處) */
  pixabayUrl: string;
};

export const MUSIC_MOODS: MoodDef[] = [
  {
    id: "elegant",
    label: "典雅",
    description: "水晶音樂、鋼琴、療癒風 — 紋繡、護膚、質感作品",
    pixabayUrl: "https://pixabay.com/music/search/spa%20music/",
  },
  {
    id: "chill",
    label: "輕柔",
    description: "輕鬆不搶戲 — 施作過程、沙龍日常",
    pixabayUrl: "https://pixabay.com/music/search/relaxing/",
  },
  {
    id: "upbeat",
    label: "活潑",
    description: "明亮愉快 — 美甲彩繪、成品展示",
    pixabayUrl: "https://pixabay.com/music/search/upbeat/",
  },
  {
    id: "energetic",
    label: "動感",
    description: "節奏感強 — 縮時影片、快速剪輯",
    pixabayUrl: "https://pixabay.com/music/search/energetic/",
  },
  {
    id: "cinematic",
    label: "電影感",
    description: "戲劇張力 — 品牌形象、前後對比",
    pixabayUrl: "https://pixabay.com/music/search/cinematic/",
  },
];

export type MusicTrack = {
  id: string;
  title: string;
  artist: string | null;
  mood: MusicMood;
  genre: string | null;
  duration_sec: number | null;
  file_url: string;
  tags: string[] | null;
  bpm: number | null;
  is_active: boolean;
};

export function moodById(id: string): MoodDef {
  return MUSIC_MOODS.find((m) => m.id === id) ?? MUSIC_MOODS[1];
}

/** 從同 mood 的曲目中隨機挑一首(排除指定曲目,用於「換一首」) */
export function pickRandomTrack(
  tracks: MusicTrack[],
  mood: string,
  excludeId?: string | null
): MusicTrack | null {
  const pool = tracks.filter(
    (t) => t.mood === mood && t.is_active && t.id !== excludeId
  );
  const fallback = tracks.filter((t) => t.is_active && t.id !== excludeId);
  const source = pool.length > 0 ? pool : fallback;
  if (source.length === 0) return null;
  return source[Math.floor(Math.random() * source.length)];
}

/** 秒數 → 3:05 */
export function formatDuration(sec: number | null): string {
  if (!sec || !Number.isFinite(sec)) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
