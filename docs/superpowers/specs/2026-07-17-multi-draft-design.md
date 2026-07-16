# 多草稿管理設計(2026-07-17)

## 問題

`app.js` 的 `load()` 在偵測到 `#s=` 分享連結時,解析後當場 `save()` 覆蓋 localStorage 的 `lcm-state`,零確認、零備份;`?id=` 短連結(分享按鈕的主要產物,`importFromQuery()`)與「匯入 JSON 檔」同樣直接覆蓋。使用者創作到一半誤開別人的分享連結,作品即刻遺失。本機自動存檔本身已存在(每次編輯即時寫入 `lcm-state`),洞在匯入路徑。

## 決策

評估過三案:A 匯入前自動存歷史(安全網)、B 為 A 加匯入確認框、C 多草稿管理。拍板 **C,且草稿內容改存 IndexedDB**。匯入語意從「覆蓋」變「新增」,每份草稿本身就是可還原副本,不需要另做歷史記錄。

### 實測依據(2026-07-17,Chromium)

- localStorage 配額:5,242,688 字元(約 5MiB,按 UTF-16 code unit 計,中文不加倍),整個 `yazelin.github.io` origin 所有工具共用。
- IndexedDB 配額:同 origin 實測 6.4GB(拋棄式 context 的保守值),約為 localStorage 的 1,200 倍。
- 照片訊息 480px:PNG 約 490KB;JPEG 0.85 約 65KB(縮 7.5 倍)。貼圖 320px PNG 合成樣本約 40KB;頭像 96px PNG 約 25KB;背景 800px JPEG 約 180KB。
- 依現況(照片存 PNG + localStorage),照片流創作 2 到 3 份即滿;此設計後空間不再是實務限制。

### 現成範式

IndexedDB wrapper 照抄自家生產案例 line-sticker-studio `app.js`(`idbOpen`/`idbTx`/`idbPut`/`idbGetFrom`/`idbAllFrom`,約 40 行、零依賴、含版本升級)。

## 儲存結構

| 位置 | 鍵/store | 內容 |
|---|---|---|
| IndexedDB `line-chat-maker` v1 | store `drafts`(keyPath `id`) | `{ id, name, updatedAt, state }`,state 即現有整份 JSON |
| localStorage | `lcm-current` | 目前開啟的草稿 id(啟動時同步可讀) |
| localStorage | `lcm-state` | 「收件匣」:AI/Playwright 注入口 + 舊版資料遷移入口;讀取後即刪 |

- 草稿 id:`'d' + Date.now()`(沿用現有 people id 慣例)。
- 草稿名稱預設取 `state.settings.title`,可在列表改。

## 行為

1. **啟動(async init)**:開 IDB → 處理收件匣 → 依 `lcm-current` 載入草稿;一份草稿都沒有時,以 DEMO 建「範例」草稿。
2. **收件匣規則(一條規則吃兩個情境)**:載入時 `lcm-state` 存在 → 立成新草稿並切換,刪除該 key。既有使用者的舊資料因此自動變成第一份草稿(遷移);AI/Playwright 注入契約完全不變,語意升級為「新增不覆蓋」。
3. **`#s=` 分享連結**:解析成功 → 開成新草稿並切換,原草稿原地不動;hash 照舊 `replaceState` 清除。**去重**:若與最新一份草稿內容相同(JSON 字串比對)則直接切換、不新增,連開同一條連結不疊副本。
4. **`?id=` 短連結(主要分享路徑)**:先照常載入目前草稿並渲染(維持即開即用),worker 取回內容後同樣開新草稿並切換(同一套去重),清掉網址參數並提示。取回失敗只 console.warn,不影響現有草稿。
5. **匯入 JSON 檔**:同樣開新草稿並切換。
5. **save()**:對外簽名不變;內部 debounce 300ms 寫 IDB 並更新 `updatedAt`。已知取捨:關頁前最後 300ms 的編輯可能遺失,可接受。
6. **草稿 UI**:左側分頁新增「草稿」pane:列表(名稱可改、更新時間、大小 KB;大小於列表渲染時以 `JSON.stringify(state).length` 估算)+ 動作:開啟/新增空白/複製/刪除(confirm)。目前草稿高亮。刪到最後一份 → 自動建範例草稿。匯入成功後提示:「已開成新草稿,你原本的創作都在『草稿』分頁」。
7. **重設**:語意改為「重設目前這份草稿」,confirm 文案照舊。
8. **照片瘦身**:圖片訊息改存 JPEG 0.85(canvas 先鋪白底,避免透明變黑);`kind === 'sticker'` 維持 PNG 保透明。同時瘦身分享連結與匯出 JSON。
9. **常駐請求**:啟動時 `navigator.storage.persist()`(fire-and-forget)。

## 錯誤處理

- IDB 開啟失敗(罕見:私密模式、儲存被停用)→ 降級為純記憶體運作,提示「此瀏覽器無法本機保存,請匯出 JSON 備份」。
- 寫入 `QuotaExceededError`(6.4GB 下幾乎不會發生,磁碟將滿時配額會縮)→ 明確警示,指引刪舊草稿或匯出 JSON;**絕不自動淘汰草稿**。
- 匯出 JSON 仍是唯一「真備份」:瀏覽器儲存理論上可被系統清除(iOS Safari 未安裝 PWA 有 7 天未使用清除政策,對 localStorage 亦然,非本案退步)。草稿 UI 註一句。

## 周邊

- `sw.js` bump CACHE 版本。
- README 補「草稿」段;`skills/line-chat-maker/SKILL.md` 補一句注入新語意(lcm-state 會開成新草稿,不再覆蓋)。

## 不做(YAGNI)

編輯歷程 undo、雲端同步、草稿排序/搜尋、圖片獨立 object store、IndexedDB 之外的降級持久層。

## 驗收

本機起 server 手動走一遍 + console smoke:

1. 編輯到一半開別人的 `#s=` 連結 → 原草稿完好、新草稿被開啟。
2. Playwright/console 塞 `lcm-state` 後 reload → 變成新草稿並切換(AI 交付路徑不斷)。
3. 同一條連結開兩次 → 只有一份,直接切換。
4. 草稿刪到最後一份 → 自動出現範例草稿。
5. 上傳照片訊息 → dataURL 為 `image/jpeg` 且量級約數十 KB;上傳貼圖 → 仍為 `image/png` 且透明保留。
6. 重新整理 → 目前草稿與選擇狀態完整還原。
7. 舊版使用者情境:預先只放 `lcm-state` → 升級後自動成為第一份草稿,內容不失。
8. `?id=` 短連結(以攔截模擬 worker 回應)→ 開成新草稿並切換,原草稿完好。
