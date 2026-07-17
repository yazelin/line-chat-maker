# LINE 對話製造機 line-chat-maker

免費、免註冊、**完全離線**的 LINE 風格對話截圖產生器。

**線上用:https://yazelin.github.io/line-chat-maker/**

![icon](icons/icon-192.png)

## 能做什麼

- 所見即所得:泡泡文字、暱稱、時間、已讀數,點了直接改
- 頭像上傳自動裁圓(圖片只存在你的瀏覽器,不上傳任何伺服器)
- LINE 元件齊全:引用回覆、表情回應(emoji 或自傳小圖)、「⋯⋯(略)⋯⋯」分隔、日期分隔、連續訊息自動省頭像
- 手機外框(瀏海、SVG 狀態列、home 條)可開關;群組/1對1 模式切換
- 系統切換:iOS 風/**Android 精刻**(狀態列、表頭、輸入列 icon 依真機截圖手繪 SVG 重製,群組與 1對1 的表頭 icon 組不同)+ **LINE 深色主題** + AI 懸浮鈕開關
- 換字體:內建圓體/楷書/明體等,或直接選你電腦裡裝的任何字體(Chrome/Edge),整支手機畫面同步換——重現「朋友手機用特殊字體」的截圖感
- 畫面高度兩種:依訊息內容,或固定高度(px 可調,訊息貼底像真的聊天室)
- 一鍵匯出 PNG(2x 解析度);「嵌入」複製一段 scoped HTML,貼進部落格/CMS 直接顯示;「示意圖」浮水印可開關
- 對話腳本 JSON 匯入/匯出:存檔、分享,或讓 AI 直接生成整段對話
- 多草稿:創作自動即時保存在本機(IndexedDB);開別人的分享連結或匯入 JSON 會開成**新草稿**,不會覆蓋你的創作
- PWA:安裝後飛航模式照用

## AI 也能用

repo 內附 [skills/line-chat-maker/SKILL.md](skills/line-chat-maker/SKILL.md):給 AI Agent 的腳本 JSON schema 與交付方式(檔案匯入/`#s=` 一鍵連結/Playwright 自動匯出)。把 skill 目錄 symlink 進你的 agent skills 資料夾即可。

## 本機開發

沒有 build step。`git clone` 後直接開 `index.html`,或任何靜態伺服器。

## 聲明與防濫用

- 產出**僅供創作示意**(部落格配圖、教學、行銷素材)。請勿用於詐騙、毀謗、偽造證據等誤導用途。
- 匯出的 PNG 除了可開關的「示意圖」浮水印,**一律嵌入三層隱形識別標記**(無開關):
  1. PNG iTXt metadata——檔案原樣流傳可驗,上傳社群平台通常被移除
  2. alpha 通道 LSB 藏碼——檔案未轉檔/重壓縮可驗
  3. ±3/255 亮度格紋——肉眼不可見,截圖、JPEG 重壓縮(實測 q70 仍可驗)、裁切後可統計驗出;縮放後不保證
- 任何人都可以用 [verify.html](https://yazelin.github.io/line-chat-maker/verify.html) 拖圖驗證「這張圖是否由本工具產生」,分析全在瀏覽器本機。
- 誠實說明界限:本專案開源,標記擋不住有心人 fork 移除,別的工具做的假圖也驗不出來。標記的目的是提高順手濫用的成本、給受害者與平台一個識別線索,不是防偽保證。
- 非官方工具;LINE 為 LY Corporation 之商標,本專案與其無任何關聯。

## 作者

[yazelin](https://yazelin.github.io/) — [GitHub](https://github.com/yazelin) | [Facebook](https://www.facebook.com/yaze.lin.gm) | [Buy me a coffee](https://buymeacoffee.com/yazelin)

MIT License © 2026 林亞澤
