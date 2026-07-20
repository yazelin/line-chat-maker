# 玩樂行銷風改版:多 skin + 反真實 設計(2026-07-20)

## 背景與動機

現況把 LINE 畫面刻得太真,難以避免被拿去做以假亂真的詐騙素材。本改版的初衷是:讓每一份輸出都「一眼看得出是刻意做出來的圖」,同時保留原本對行銷、梗圖、教學示意的實用性。

反真實的手段**不是拆掉結構**,而是**誇張、玩樂化的表現**:傾斜(歪斜)、玩具般不寫實的對話泡泡感、訊息冒出時的動態。手機殼保留(它是熟悉又好用的行銷容器),移除的只有「忠實還原真機」這一種樣式。

## 拍板範圍(方案:純風格改版,data-driven skin registry)

- **In**:新增 4 款玩樂行銷 skin(預設 Memo)當公開 UI 唯一提供的樣式;既有真實渲染**不移除**,降為**隱藏 gated skin**(見下節);保留手機/對話容器;每款玩樂 skin 各有進場動態 + 傾斜;浮水印/verify 完全不動。
- **Out(留給後續分支)**:更廣的「行銷工具箱」、Phase B 的 Actions 自動產圖 repo。本分支**只做風格**,四款玩樂 skin 渲染 + 匯出都乾淨、真實 skin 閘門正確後即 merge 回 main。
- `archive/realistic-line-v1`(本機)留作 pre-pivot 紀念快照,非必要保存路徑(真實渲染在新 code 裡以隱藏 skin 續存)。

## Skin 架構:data-driven registry

- 新增 `SKINS` registry,每個項目 = `{ id, label, className, tokens{ --c-* 調色 }, tilt, entrance, decorations }`。
- 渲染 = 把 `className` 掛到 `#phone` + 設定 CSS 自訂屬性(tokens)。skin 選單由 registry 生成;腳本 JSON 只要寫 `"skin":"jelly"`。
- 選這個形狀的理由:
  1. 「之後加更多風格」= 加一個物件,成本極低。
  2. skin **可由名字從 JSON 選定** —— 正是 Phase B headless Actions repo 需要的掛鉤。
  3. 零新依賴,延用現有 `--accent` / token 慣例。
- **相容約束**:所有新 CSS 選擇器必須以 `.phone` 或 `.line-chat` 開頭(嵌入 HTML 的 scoped keep-list 依賴此字首)。skin 以 `.phone.skin-<id>` 起手,天然符合。

### settings model 變更

- 新增 `settings.skin` 至 `DEMO.settings`,值域 `memo`(預設)/`jelly`/`doodle`/`pop` + 隱藏 `real`。`skin` 是外觀的單一事實來源。加進 `DEMO.settings` 後,既有 `migrate()`(app.js:67-72)自動把舊草稿補上 `skin:'memo'`。
- `settings.os` 本就不存在(README 誤植,實際未實作),無需處理。既有 `settings.theme`(`light`/`dark`)+ `sysColor` **保留**,只在 `skin === 'real'` 時作為真實 skin 的子選項出現;玩樂 skin 下隱藏、各 skin 自帶配色。
- 新增 `settings.playfulness`(0–1,預設 0.5):全域縮放傾斜 + 彈跳強度,0 = 冷靜。

## 四款 v1 skin

三款亮、一款暗,讓整組也有暗色選項。

| skin | 調色 | 泡泡 | 傾斜 | 進場動態 |
|---|---|---|---|---|
| **Memo**(預設) | 奶油紙感 | 貼紙剪裁 + 紙膠帶裝飾 | 每泡 ±3–5°(貼上去感) | 蓋章落定 |
| **Jelly** | 粉嫩糖果 | 光澤、超圓、Q 彈高光 | ±1–2° | 彈性 overshoot(果凍抖) |
| **Doodle** | 筆記本白 | 手繪抖動漫畫框線 | ±2–3° | 描線 / 抖動 pop |
| **Pop** | 霓虹暗底 | 發光框線、玻璃感填色 | ±2–4° | pop + 光暈閃 |

- 貼圖:各 skin 可把貼圖放大、加玩樂裝飾(Memo/Pop 尤其),呼應「大貼圖排版」的行銷表現。貼圖機制既有,skin 只是把它放大/風格化。

## 手機殼與反真實處理

- 保留手機外框(瀏海、圓角、home 條)當容器。
- 玩樂 skin(memo/jelly/doodle/pop)以 `.phone.skin-<id>` **覆蓋**既有樣式,把泡泡 + 狀態列 + 表頭風格化(玩具感),不模仿真機。公開 UI 只提供這四款,所以「一般使用者做不出真截圖」成立。
- 「真實」= 現況 baseline 渲染(手繪 Android 式狀態列 + LINE 表頭 + LINE 綠泡泡 + `theme` light/dark),**不掛任何 skin class**。收斂成隱藏 `real` skin,零 rip-out。
- 註:README 宣稱的「iOS 風/Android 切換」**實際從未實作**(無 `os` 欄位、無 iOS markup、狀態列 hardcode Android;`SKILL.md` 已記 `os 已廢棄`)。本波順手把這個假宣稱從 README 拿掉。
- 釐清邊界:skin 只主題化**手機預覽 / 輸出**;編輯器自己的介面明暗(`body.dark`)是另一回事,不動。

## 真實 skin 的隱藏與閘門(核心)

初衷是「一般人拿不到真實、我自己拿得到、分享連結不外洩真實」。誠實前提:repo 為 MIT 且 git 歷史永存真實碼,翻 source 的人本就能重啟——威脅模型只針對**順手濫用**,不是有心人(與現況 README 立場一致)。

- **本機 opt-in 旗標**:`localStorage['lcm-real']`。未設(所有一般訪客)→ `real` 不進選單、也不渲染。設了(你自己的瀏覽器,devtools 一行)→ `real` 出現在選單、可選 os/theme 子選項、正常渲染。
- **防外洩閘門(最關鍵)**:任何腳本 JSON / `#s=` 連結 / 匯入資料指定 `skin:'real'`(或帶 legacy os/theme 真實語意)但**本機沒設旗標** → 一律強制退回 `memo`。即真實能力綁在**你的本機 opt-in**,不綁在資料上;你分享的連結永遠不會在別人螢幕上渲染真實。
- 浮水印/隱形識別**照舊套用於全部輸出**(含你自己的真實 skin)——對正當自用無害,萬一外流反而有識別線索。

## 動態

- 延用現有 30fps 播放 / MP4 引擎,讓每款 skin 有進場動態(上表第 5 欄)。live 播放與 MP4 匯出(WebCodecs 擷取 DOM)呈現一致,影片自動變更有梗。
- 全域「俏皮度/傾斜」旋鈕(`playfulness`)縮放傾斜 + 彈跳強度。

## 向後相容 / 遷移

- 舊草稿 / `#s=` 連結 / 匯入 JSON 無 `skin` 欄位:`migrate()` 自動補成 `DEMO.settings` 預設 → 一律 `skin:'memo'`。訊息與 `theme`/`sysColor` 完整保留;要看真實外觀者(你,已設旗標)在選單手動切 `real`。(不做旗標感知遷移——簡單優先。)
- 防外洩閘門(唯一硬規則):resolve 時 `skin==='real' 且本機沒 lcm-real 旗標 → 強制當 'memo'`。所以你做了 real 圖並分享,連結雖帶 `skin:'real'`,別人開仍是 Memo。
- 更新 `skills/line-chat-maker/SKILL.md` schema(第 22-50 行 settings 區塊):新增 `skin`(玩樂四款),註明 `real` 為本機 opt-in、對外一律退回 `memo`;`os` 敘述本已標廢棄。
- `ai.js`:無 `os`。executor prompt(ai.js:108)settings 清單加 `skin`;writer 的「以假亂真」(ai.js:143)語氣軟化為「做成一張 LINE 風格對話圖」;評審 #5「真實感」(ai.js:186)實為**對白可信度**(「像真人打字的口語與短句」),**保留不動**。

## 文件 / 定位

- README「防濫用」段改寫為誠實版:「**UI 只提供玩樂風格**,做不出真截圖;真實渲染保留但需本機 opt-in 且分享連結不會外洩;浮水印全程套用作為後備。」不宣稱「無法真實」(git 歷史本就有真實碼)。
- 更新功能條目:主打四款玩樂 skin;**刪掉 README:25 的「iOS 風/Android 精刻切換」假宣稱**(從未實作);深色主題改述為 opt-in 真實 skin 的內部能力,不放在對外主要賣點。
- 依規則:改 repo 一併更新 README。

## 驗證清單(無測試框架,這就是可執行檢查)

1. 開頁 → 逐一切換 4 款 skin:渲染、傾斜、進場動態都正常。
2. 每款各匯出一支 MP4 → 動態以 30fps 擷取進影片。
3. 每支輸出丟 `verify.html` → 隱形浮水印仍驗得出。
4. 載入舊 `theme:dark` 分享連結(**本機無旗標**)→ 開成 Memo、內容完整。
5. 設 `localStorage['lcm-real']=1` → `real` 出現在選單、可切 os/theme、真實渲染正常;移除旗標後同一份 `skin:'real'` 資料 → 退回 Memo(確認閘門把關,分享連結不外洩真實)。
6. 產一段「嵌入」HTML → scoped 樣式仍完整(確認 `.phone.skin-*` 選擇器有進 keep-list)。

## 實作路線(細節留給 writing-plans)

先做 registry + 把現有渲染改成 skin 驅動(既有 os/theme 收成隱藏 `real` skin、預設 Memo、上 opt-in 旗標與防外洩閘門),再以**一款 reference skin 先行**(Memo,因為是預設)讓 yazelin 開頁對真物反應,其餘三款依同模板跟上;動態引擎整合、俏皮度旋鈕、遷移 + SKILL/ai.js、文件收尾。

## Phase B 掛鉤(本分支不實作)

skin 可由腳本 JSON 具名選定(registry 已滿足)。未來 catime 式 Actions repo 產「荒謬日常」場景時,直接在 JSON 指定 skin 即可 headless 驅動。此處不寫任何 Phase B 程式。

## 待完整功能後決定(deferred)

真實版的**最終處置**延後到完整功能做完、yazelin 看過成品再拍板:

- **A(本分支預設,可逆)**:真實維持隱藏 gated skin,歷史照留。
- **B(單向門,日後可再選)**:現碼移除真實 + 歷史重寫成玩樂根 + 真實收進 private repo。

在做出決定前一律走 A;A 不擋 B(隨時能升級),B 會丟專案歷史所以不預先做。**無論 A/B,防外洩閘門(沒本機旗標 → 真實一律退回 Memo)全程有效**,所以延後決定不影響對外安全。
