// AI 引擎煙霧測試
// 執行方式:npx tsx src/lib/ai/__test__/smoke.ts
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { getAIProvider } from "../index";

// tsx 不會自動載入 .env.local,自行解析
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

/** 用 ffmpeg 產生一張測試圖(粉色漸層),用來驗證影像分析路徑 */
function makeTestImage(): { base64: string; mimeType: string } {
  const file = path.join(process.cwd(), "tmp-smoke-frame.jpg");
  execFileSync(
    ffmpegPath as string,
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "gradients=size=512x512:c0=pink:c1=white:duration=1",
      "-frames:v",
      "1",
      file,
    ],
    { stdio: "ignore" }
  );
  const base64 = fs.readFileSync(file).toString("base64");
  fs.unlinkSync(file);
  return { base64, mimeType: "image/jpeg" };
}

async function main() {
  const ai = getAIProvider();

  // 1. 純文字生成
  console.log("[1/2] generateText — 送出測試訊息…");
  const reply = await ai.generateText({
    systemPrompt: "你是 GlowStudio 美業創作平台的 AI 助手。",
    userPrompt: "你好,請用繁體中文回答你是誰",
  });
  console.log("--- AI 回覆 ---");
  console.log(reply);

  // 2. 影像分析 + 風格推薦
  console.log("\n[2/2] analyzeAndRecommend — 分析測試畫面…");
  const frame = makeTestImage();
  const recommendation = await ai.analyzeAndRecommend({
    images: [frame, frame, frame],
    templates: [
      { id: "t-cream", name: "奶油肌特寫", description: "溫潤柔和的膚色" },
      { id: "t-peach", name: "蜜桃甜心", description: "粉嫩甜美色調" },
      { id: "t-mono", name: "黑白質感", description: "純黑白強調線條" },
    ],
    filters: [
      { id: "cream", name: "奶茶色", description: "溫潤柔和" },
      { id: "peach", name: "粉嫩", description: "粉嫩甜美" },
      { id: "noir", name: "黑金", description: "近黑白的高反差" },
    ],
    decorations: [
      { id: "none", name: "不加裝飾", description: "保持畫面乾淨" },
      { id: "frame-elegant", name: "優雅邊框", description: "金色雙線圓角框" },
    ],
    subtitleStyles: [
      { id: "classic-white", name: "經典白條", description: "白字加黑底條" },
      { id: "elegant-serif", name: "優雅金明體", description: "香檳金明體" },
    ],
  });
  console.log("--- AI 風格建議 ---");
  console.log(JSON.stringify(recommendation, null, 2));

  console.log("\n--- 煙霧測試通過 ✓ ---");
}

main().catch((error) => {
  console.error("煙霧測試失敗:", error);
  process.exit(1);
});
