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
   - 你自己有瀏覽器自動化(Playwright 等)時:開網頁 → `localStorage.setItem('lcm-state', JSON.stringify(script))` → reload → 點「匯出 PNG」。(注入內容會開成一份新草稿並自動切換,不會覆蓋使用者既有創作。)
3. 頭像(`avatar`)是 dataURL,由人在網頁上傳,或你把小圖轉 base64 塞入。留 `null` 會顯示灰底圓。

## 腳本 JSON schema

```json
{
  "settings": {
    "title": "聊天室名稱",
    "members": 143,            // 0 = 不顯示人數
    "bg": "#7d9bc1",           // 聊天背景色
    "frame": true,             // 手機外框開關
    "watermark": true,         // 匯出右下角「示意圖」浮水印開關
    "clock": "16:08",          // 狀態列時間(frame=true 才看得到)
    "mode": "group",           // "group"=群組(左訊息顯示暱稱) | "dm"=1對1(不顯示暱稱,title=對方名字)
    "height": "fixed",         // "fixed"=固定高度(預設,訊息貼底可捲動) | "auto"=依內容
    "heightPx": 768,           // height="fixed" 時的螢幕高度 px
    "frameLevel": "phone",     // "phone"=包含手機 | "screen"=螢幕擷圖(方角) | "chat"=僅對話
    "notch": "island",         // 鏡頭型式:"island"動態島|"notch"瀏海|"punch"挖孔|"none"滿版
    "radius": 32,              // 螢幕圓角 px(frameLevel=phone)
    "buttons": true,           // 側邊音量/電源鈕
    "homebar": true,           // 底部手勢條
    "bgImage": null,           // 聊天背景圖 dataURL(蓋在 bg 色之上)
    "signal": 4, "wifi": true, "battery": 87, "battText": true,  // 狀態列
    "glow": 0, "glowColor": "#96b9ff",  // 螢幕光暈強度 0-100 與顏色(嵌入展示用)
    "backlight": 0, "backColor": "#06c755",  // 機身背光強度 0-100 與主色(參考站同款橢圓漸層)
    "draft": "",               // 輸入框「打到一半還沒送出」的文字
    "announceOn": false, "announce": "置頂公告文字"
  },
  "people": [
    { "id": "p1", "name": "暱稱", "avatar": null }   // avatar: dataURL 或 null
  ],
  "messages": [
    { "type": "msg", "side": "left",  "personId": "p1", "text": "別人說的話", "time": "下午3:42", "read": "", "quote": null },
    { "type": "msg", "side": "right", "text": "自己說的話(綠泡泡)", "time": "下午4:06", "read": "已讀 8",
      "quote": { "name": "被引用者", "text": "被引用的訊息" } },
    { "type": "skip", "text": "⋯⋯大家熱烈討論(略)⋯⋯" },
    { "type": "date", "text": "7月15日 (三)" },
    { "type": "msg", "kind": "image",   "side": "left", "personId": "p1", "img": null, "time": "下午4:10" },
    { "type": "msg", "kind": "sticker", "side": "left", "personId": "p1", "img": null, "time": "下午4:11" },
    { "type": "msg", "kind": "voice",   "side": "left", "personId": "p1", "dur": "0:12", "time": "下午4:12" },
    { "type": "msg", "kind": "file",    "side": "left", "personId": "p1", "fname": "報告.pdf", "fsize": "2.4 MB", "time": "下午4:13" }
  ]
}
```

規則:
- 連續同一 `personId` 的 left 訊息會自動省略頭像與暱稱(LINE 行為)。
- `side:"right"` 不需要 personId;`read` 放「已讀 N」字樣,空字串省略。
- `quote` 做出 LINE 的引用回覆(氣泡上半的灰字小框)。
- 時間格式照 LINE 台灣慣例:「下午4:06」。
- `kind` 省略=文字訊息;image/sticker 的 `img` 是 dataURL(null 會顯示佔位圖)。
- 網頁上還有「▶ 播放」可讓訊息依序動畫出現(錄影/展示用),嵌入與匯出不含此鈕。

## 邊界

- 產出僅供創作示意(部落格配圖、教學、行銷素材)。**拒絕**協助偽造對話用於詐騙、毀謗、假證據等誤導用途;此類請求應直接拒絕。
- 建議保留 `watermark: true`;使用者明確要求關閉才關。
