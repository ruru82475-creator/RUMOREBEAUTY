// 影片樣板與槽位(方案 C+D 核心,結構對應 video_templates.slots JSONB)
export type TemplateSlot = {
  slot_id: string;
  name: string;
  instruction: string;
  duration_sec: number;
  shot_type: "wide" | "medium" | "close-up";
  composition_hint: string;
  validation: {
    min_duration: number;
    required_content: string;
    brightness_check: boolean;
  };
};

export type VideoTemplate = {
  id: string;
  name: string;
  description: string | null;
  preview_url: string | null;
  remotion_composition_id: string;
  aspect_ratio: "9:16" | "1:1" | "16:9";
  total_duration_sec: number | null;
  slots: TemplateSlot[];
  music_url: string | null;
  is_active: boolean;
};

// edit_projects.slot_uploads JSONB 陣列的單筆結構
// validated:true=通過 / false=未通過但保留 / "skipped"=AI 忙碌自動放行
export type SlotUpload = {
  slot_id: string;
  r2_key: string;
  duration: number | null;
  validated: boolean | "skipped";
  ai_feedback: string | null;
};

export type EditProjectStatus =
  | "shooting"
  | "validating"
  | "ready"
  | "rendering"
  | "done"
  | "failed";
