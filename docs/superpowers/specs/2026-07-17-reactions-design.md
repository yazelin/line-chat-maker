# 表情回應(reactions)設計(2026-07-17)

## 需求

LINE 訊息下方的「表情回應」列(灰色笑臉 icon 開頭 + 一排表情),目前工具做不出來。參考真實截圖:回應列貼在泡泡下緣,右側訊息靠右、左側訊息對齊泡泡左緣。

## 決策(已拍板:方案 B)

- 表情素材:**系統 emoji 為預設,每顆表情也可上傳自己的小圖**(LINE FRIENDS 角色圖是版權素材,不內建)。
- 顯示規則:**至少一顆回應才出現整列(含灰笑臉 icon);沒有回應的訊息什麼都不顯示**。
- 灰笑臉 icon 為自繪 inline SVG,非 LINE 資產。

## 資料模型

`messages[].react`:選填陣列,每項為 emoji 字串(如 `"😆"`)或 dataURL 小圖(64px 方形置中裁切 PNG)。空陣列視同無,正規化為 null。舊資料無此欄位即無回應,免遷移;分享連結、匯出 JSON、嵌入 HTML 自然攜帶。

## 互動

- 訊息 hover 控制列新增「心」:切換 `react` null ↔ `['😆']`。
- 回應列 hover 出現編輯鈕(匯出/預覽/嵌入一律剝除,class `.radd`):「+表情」加一顆 emoji(contenteditable,點了直接改字,清空即移除)、「+圖」開檔案選擇器上傳小圖。
- 小圖點擊即移除(title 註明)。

## 驗收

1. 無回應訊息不出現回應列;設定 `react` 後出現灰笑臉+表情。
2. 「+表情」增加一顆;「+圖」上傳後以 `<img>` 呈現(64px PNG dataURL)。
3. 匯出 PNG 順利下載(dataURL 圖不污染 canvas);回應列在匯出中,編輯鈕不在。
4. 分享連結/JSON 帶著 react 欄位往返。

## 周邊

SKILL.md schema 補 `react` 欄位;README 功能清單補一條;sw.js CACHE bump v33。
