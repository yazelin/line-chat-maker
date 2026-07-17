# lcm-ai-proxy — 免費體驗代理（「刷作者的信用卡」）

讓 line-chat-maker 的訪客不用申請 API Key 就能體驗 AI 功能：前端打這個 Cloudflare Worker，Worker 拿站長的 Groq Key 轉發。**Key 只存在 Cloudflare secret，絕不出現在前端。**

## 防濫用五道閘

1. **Origin 白名單**（`ALLOWED_ORIGINS`）：只服務指定網域，其他一律 403
2. **model 鎖定＋欄位白名單**（`MODEL`）：不接受前端指定其他 model，只轉發 `messages/tools/tool_choice`，不當萬用 LLM 代理
3. **每 IP 每日額度**（`IP_DAILY`，預設 60 次呼叫 ≈ 3 個作品）：超過回 429，訊息引導使用者填自己的免費 Key
4. **全站每日熔斷**（`GLOBAL_DAILY`，預設 1200 次）：成本天花板 ≈ 每日 US$1.2、每月 US$36 封頂；實際流量通常遠低於此
5. **max_tokens 上限**：單次輸出封頂 4096

額度計數存 D1（`lcm_quota` 表，首次請求自動建表），UTC 日界（台北時間早上 8 點重置）。只記「日期＋IP＋次數」，**不儲存任何對話內容**。

## 部署（站長）

```bash
cd worker
npx wrangler secret put GROQ_API_KEY   # 貼上你的 Groq API Key
npx wrangler deploy
```

部署後網址即 `https://lcm-ai-proxy.<你的子網域>.workers.dev`，前端連線設定的「刷作者的信用卡」preset 指向它。

之後改 `worker/` 內容 push 到 master 會由 GitHub Actions 自動部署（需在 repo secrets 設 `CLOUDFLARE_API_TOKEN`，權限含 Workers 編輯；沒設 secret 就手動 `npx wrangler deploy`）。

## 自架（clone / fork 的人）

整個 repo 是 MIT，歡迎自架自己的免費代理：

```bash
cd worker
npx wrangler login
npx wrangler d1 create my-lcm-quota          # 建自己的 D1 庫
# 把輸出的 database_id 與名稱填進 wrangler.toml 的 [[d1_databases]]
# 把 ALLOWED_ORIGINS 改成你的網站網域
npx wrangler secret put GROQ_API_KEY          # 你自己的 Groq Key（groq.com 免費申請）
npx wrangler deploy
```

然後把前端 `ai.js` 裡 `PROVIDERS.free.base` 改成你的 worker 網址即可。額度、model、成本天花板都在 `wrangler.toml` 的 `[vars]` 自己調。

## 成本粗估

gpt-oss-120b 在 Groq 約 US$0.15/M input、US$0.75/M output（以主控台為準）。一個完整作品（劇本強化＋開始製作＋兩次微調）約 70k input＋14k output ≈ **US$0.02／作品**。預設熔斷下最壞情況每月約 US$36，一般流量多在 US$5-30 之間。

## 後續強化（還沒做）

- Turnstile 人機驗證換短效 token（擋偽造 Origin 的純腳本刷量）；Invisible mode 有螢幕外 render 的坑，見站長筆記
- 依 usage tokens 計費而非次數
