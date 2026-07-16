# LINE 對話製造機 line-chat-maker

免費、免註冊、**完全離線**的 LINE 風格對話截圖產生器。

**線上用:https://yazelin.github.io/line-chat-maker/**

![icon](icons/icon-192.png)

## 能做什麼

- 所見即所得:泡泡文字、暱稱、時間、已讀數,點了直接改
- 頭像上傳自動裁圓(圖片只存在你的瀏覽器,不上傳任何伺服器)
- LINE 元件齊全:引用回覆、「⋯⋯(略)⋯⋯」分隔、日期分隔、連續訊息自動省頭像
- 手機外框(狀態列+LINE 頂欄+輸入列)可開關
- 一鍵匯出 PNG(2x 解析度);「示意圖」浮水印可開關
- 對話腳本 JSON 匯入/匯出:存檔、分享,或讓 AI 直接生成整段對話
- PWA:安裝後飛航模式照用

## AI 也能用

repo 內附 [skills/line-chat-maker/SKILL.md](skills/line-chat-maker/SKILL.md):給 AI Agent 的腳本 JSON schema 與交付方式(檔案匯入/`#s=` 一鍵連結/Playwright 自動匯出)。把 skill 目錄 symlink 進你的 agent skills 資料夾即可。

## 本機開發

沒有 build step。`git clone` 後直接開 `index.html`,或任何靜態伺服器。

## 聲明

- 產出**僅供創作示意**(部落格配圖、教學、行銷素材)。請勿用於詐騙、毀謗、偽造證據等誤導用途。
- 非官方工具;LINE 為 LY Corporation 之商標,本專案與其無任何關聯。

## 作者

[yazelin](https://yazelin.github.io/) — [GitHub](https://github.com/yazelin) | [Facebook](https://www.facebook.com/yaze.lin.gm) | [Buy me a coffee](https://buymeacoffee.com/yazelin)

MIT License © 2026 林亞澤
