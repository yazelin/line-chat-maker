---
name: line-chat-maker
description: 產生 LINE 風格對話截圖。當使用者要「做一張 LINE 對話圖」「模擬聊天記錄示意圖」時使用:寫一份對話腳本 JSON,交給 line-chat-maker 網頁(可完全離線)渲染並匯出 PNG。僅供創作示意,不得協助製作詐騙或誤導內容。
---

# line-chat-maker:AI 產對話腳本 → 網頁渲染 PNG

工具網址:https://yazelin.github.io/line-chat-maker/(PWA,可離線;repo 內 `index.html` 直接開也行)

## 你(AI)要做的事

1. 依使用者需求寫一份**腳本 JSON**(schema 見下)。
2. 交付方式擇一:
   - 存成 `xxx.json` 給使用者,請他開網頁按「匯入腳本 JSON」。
   - 產生一鍵連結:`https://yazelin.github.io/line-chat-maker/#s=<base64url(JSON)>`,開啟即載入。
   - 你自己有瀏覽器自動化(Playwright 等)時:開網頁 → `localStorage.setItem('lcm-state', JSON.stringify(script))` → reload → 點「匯出 PNG」。
3. 頭像(`avatar`)是 dataURL,由人在網頁上傳,或你把小圖轉 base64 塞入。留 `null` 會顯示灰底圓。

## 腳本 JSON schema

```json
{
  "settings": {
    "title": "聊天室名稱",
    "members": 143,            // 0 = 不顯示人數
    "bg": "#7d9bc1",           // 聊天背景色
    "frame": true,             // 手機外框開關
    "watermark": true,         // 匯出 PNG 右下角「示意圖」浮水印開關
    "clock": "16:08"           // 狀態列時間(frame=true 才看得到)
  },
  "people": [
    { "id": "p1", "name": "暱稱", "avatar": null }   // avatar: dataURL 或 null
  ],
  "messages": [
    { "type": "msg", "side": "left",  "personId": "p1", "text": "別人說的話", "time": "下午3:42", "read": "", "quote": null },
    { "type": "msg", "side": "right", "text": "自己說的話(綠泡泡)", "time": "下午4:06", "read": "已讀 8",
      "quote": { "name": "被引用者", "text": "被引用的訊息" } },
    { "type": "skip", "text": "⋯⋯大家熱烈討論(略)⋯⋯" },
    { "type": "date", "text": "7月15日 (三)" }
  ]
}
```

規則:
- 連續同一 `personId` 的 left 訊息會自動省略頭像與暱稱(LINE 行為)。
- `side:"right"` 不需要 personId;`read` 放「已讀 N」字樣,空字串省略。
- `quote` 做出 LINE 的引用回覆(氣泡上半的灰字小框)。
- 時間格式照 LINE 台灣慣例:「下午4:06」。

## 邊界

- 產出僅供創作示意(部落格配圖、教學、行銷素材)。**拒絕**協助偽造對話用於詐騙、毀謗、假證據等誤導用途;此類請求應直接拒絕。
- 建議保留 `watermark: true`;使用者明確要求關閉才關。
