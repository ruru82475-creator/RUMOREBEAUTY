// AI 引擎煙霧測試
// 執行方式:npx tsx src/lib/ai/__test__/smoke.ts
import fs from "node:fs";
import path from "node:path";
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

async function main() {
  const ai = getAIProvider();
  console.log("AI 引擎已就緒,送出測試訊息…");

  const reply = await ai.generateText({
    systemPrompt: "你是 GlowStudio 美業創作平台的 AI 助手。",
    userPrompt: "你好,請用繁體中文回答你是誰",
  });

  console.log("--- AI 回覆 ---");
  console.log(reply);
  console.log("--- 煙霧測試通過 ✓ ---");
}

main().catch((error) => {
  console.error("煙霧測試失敗:", error);
  process.exit(1);
});
