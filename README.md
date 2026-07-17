# LINE 對話製造機 line-chat-maker

免費、免註冊、**完全離線**的 LINE 風格對話截圖產生器。

**線上用：https://yazelin.github.io/line-chat-maker/**

![icon](icons/icon-192.png)

## 60 秒示範

給一句主題 → AI 編劇寫劇本（評審打分，不及格退稿）→ 一鍵做成對話 → AI 補圖一次生成貼圖/照片/頭像：

<video src="https://github.com/yazelin/line-chat-maker/raw/master/examples/demo-workflow.mp4" controls width="700" muted playsinline></video>

兩部用本工具做出來的作品（播放動畫錄影），與線上版一起看：**[示範與作品頁](https://yazelin.github.io/line-chat-maker/demo.html)**

<video src="https://github.com/yazelin/line-chat-maker/raw/master/examples/showcase-1.mp4" controls width="340" muted playsinline></video> <video src="https://github.com/yazelin/line-chat-maker/raw/master/examples/showcase-2.mp4" controls width="340" muted playsinline></video>

## 能做什麼

- 所見即所得：泡泡文字、暱稱、時間、已讀數，點了直接改
- 頭像上傳自動裁圓（圖片只存在你的瀏覽器，不上傳任何伺服器）
- LINE 元件齊全：引用回覆、表情回應（emoji 或自傳小圖）、「⋯⋯（略）⋯⋯」分隔、日期分隔、連續訊息自動省頭像
- 手機外框（瀏海、SVG 狀態列、home 條）可開關；群組/1對1 模式切換
- 系統切換：iOS 風/**Android 精刻**（狀態列、表頭、輸入列 icon 依真機截圖手繪 SVG 重製，群組與 1對1 的表頭 icon 組不同）+ **LINE 深色主題** + AI 懸浮鈕開關
- 換字體：內建圓體/楷書/明體等，或直接選你電腦裡裝的任何字體（Chrome/Edge），整支手機畫面同步換，重現「朋友手機用特殊字體」的截圖感
- 畫面高度兩種：依訊息內容，或固定高度（px 可調，訊息貼底像真的聊天室）
- 一鍵匯出 PNG（2x 解析度）；「嵌入」複製一段 scoped HTML，貼進部落格/CMS 直接顯示；浮水印可開關、文字可自訂(預設「LINE 對話製造機」)
- 對話腳本 JSON 匯入/匯出：存檔、分享，或讓 AI 直接生成整段對話
- **內建 AI 助手**：「AI」分頁下指令（例：生成一段媽媽提醒兒子帶傘的對話），AI 直接改畫面，可一鍵還原；自帶 API Key（Groq/OpenAI/Gemini/OpenRouter/Ollama/自訂）或選「刷亞澤的信用卡」免費體驗（每日限量，經站長的 [worker 代理](worker/README.md) 轉發，不儲存對話內容；fork 可自架）；編劇/評審與執行可分別設不同模型
- 多草稿：創作自動即時保存在本機（IndexedDB）；開別人的分享連結或匯入 JSON 會開成**新草稿**，不會覆蓋你的創作
- PWA：安裝後飛航模式照用

## AI 也能用

三條路，同一份腳本 JSON：

1. **內建 AI 助手**（`ai.js`，「AI」分頁）——一個小劇組：
   - **兩段式創作**：第 1 段「劇本強化」由編劇 AI 寫劇本（善用已讀不回、時間跳躍、draft、貼圖等 LINE 形式），評審 AI 六項評分（劇情弧/角色聲音/形式運用/節奏/真實感/傳播力，總分 ≥48/60 且無單項 <6 才過，最多修 3 輪）；劇本落在可編輯欄位，人和 AI 反覆改到滿意。第 2 段「開始製作」由執行 AI 忠實填入腳本 JSON，不得自改劇情（tool-calling 迴圈：首輪強制工具＋反偷懶＋自審；迴圈上限可調，預設 10）。
   - **AI 補圖**：美術指導 AI 依腳本產出每格繪圖 prompt（人物跨格一致、貼圖綠底），格盤**單次生圖呼叫**＋程式自動排格切回＋綠幕去背；單張可重生、prompt 可手改。
   - **AI 微調**：預覽下方一句話直改畫面（只動指定處）；所有 AI 修改都推進多步還原堆疊。
   - 圖片以 `@imgN` 佔位符進出模型不會弄丟；設定與 Key 只存 localStorage。
2. **WebMCP**：同一組工具會註冊到 `navigator.modelContext`（瀏覽器支援才生效），ZeroType Agent 等 WebMCP-aware 的 agent 擴充套件可直接以結構化工具操作本頁，不必戳 DOM。
3. **外部 Agent skill**：repo 內附 [skills/line-chat-maker/SKILL.md](skills/line-chat-maker/SKILL.md)：腳本 JSON schema 與交付方式（檔案匯入/`#s=` 一鍵連結/Playwright 自動匯出）。把 skill 目錄 symlink 進你的 agent skills 資料夾即可。

### AI 來源與額度

| 用途 | 來源選項（連線設定） | 預設 model | 免費額度 |
|---|---|---|---|
| 文字（編劇/評審/執行/微調） | 「刷亞澤的信用卡」（站長代理）/ Groq / OpenAI / Gemini / OpenRouter / Ollama / 自訂 | 站長代理與 Groq＝`openai/gpt-oss-120b`；OpenAI＝`gpt-5-mini`；Gemini＝`gemini-3.1-flash-lite`（編劇選 Gemini 自動帶 `gemini-3.1-pro-preview`） | 站長代理：每 IP 每日 60 次呼叫（約 3 個作品），全站每日 1200 次熔斷；自帶 key 不限 |
| 編劇/評審可另設 | 同上任一（與執行分開設定） | 同上 | 同上 |
| 圖像（AI 補圖/重生） | 站長贊助 / 自帶 Gemini key / 自架 [codex-image-service](https://github.com/yazelin/codex-image-service)（服務端要開 CORS）/ OpenAI 繪圖 API | Gemini＝`gemini-3.1-flash-image`；OpenAI＝`gpt-image-2`（gpt-image-1 於 2026-10 退場） | 站長贊助：每 IP 每日 2 次、全站每日 20 次；自帶 key 不限 |

右上角徽章顯示「今日剩：AI N/60・圖 N/2」；額度 UTC 換日（台北早上 8 點重置）。站長側全部參數在 `worker/wrangler.toml`。

## 本機開發

沒有 build step。`git clone` 後直接開 `index.html`，或任何靜態伺服器。

## 聲明與防濫用

- 產出**僅供創作示意**（部落格配圖、教學、行銷素材）。請勿用於詐騙、毀謗、偽造證據等誤導用途。
- 匯出的 PNG 除了可開關、文字可自訂的浮水印，**一律嵌入三層隱形識別標記**（無開關）:PNG iTXt metadata、alpha 通道藏碼、±2/255 平滑藍場紋（肉眼不可見；截圖、JPEG 重壓縮、裁切後仍可統計驗出，縮放後不保證）。原理與實測數據見 [docs/watermark.md]（docs/watermark.md）。
- 任何人都可以用 [verify.html](https://yazelin.github.io/line-chat-maker/verify.html) 拖圖驗證「這張圖是否由本工具產生」，分析全在瀏覽器本機。
- 誠實說明界限：本專案開源，標記擋不住有心人 fork 移除，別的工具做的假圖也驗不出來。標記的目的是提高順手濫用的成本、給受害者與平台一個識別線索，不是防偽保證。
- 非官方工具；LINE 為 LY Corporation 之商標，本專案與其無任何關聯。

## 作者

[yazelin](https://yazelin.github.io/) — [GitHub](https://github.com/yazelin) | [Facebook](https://www.facebook.com/yaze.lin.gm) | [Buy me a coffee](https://buymeacoffee.com/yazelin)

MIT License © 2026 林亞澤
