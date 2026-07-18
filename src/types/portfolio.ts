export type WorkCategory = "beauty" | "3dprint";

export type PortfolioItem = {
  id: string;
  category: WorkCategory | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  video_url: string | null;
  media_type: "video" | "image" | null;
  tags: string[] | null;
  is_published: boolean;
  sort_order: number;
  view_count: number;
};
