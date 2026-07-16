# Android 模式 + 深色主題 + LINE AI 懸浮鈕 設計(2026-07-17)

## 需求與依據

「完美對應系統格式、細節到位」。依據 yazelin 提供的兩張真機 Android LINE 深色截圖(1對1 與群組),逐項復刻;iOS 精刻等有一手素材再開第二波(現況外框即 iOS 風,保持不動)。所有 icon 依公開截圖**手繪 SVG 重製**,不使用 LINE 資產。

## 拍板範圍(方案:核心包 + AI 懸浮鈕)

- `settings.os`:`'ios'`(預設,現況)/`'android'`(本波新增)
- `settings.theme`:`'light'`(預設)/`'dark'`
- `settings.aiFab`:LINE AI 懸浮鈕,布林,**預設 true**,可勾選關閉
- 不做(此波):未接來電卡片、多圖拼貼相簿格、廣告橫幅位

## 從截圖拆出的復刻清單

### 狀態列(os=android)
左:時鐘(沿用可編輯 `clock`)。右依序:鬧鐘、WiFi 扇形(旁附上/下小箭頭)、`VoLTE` 小字徽章(兩行堆疊)、訊號實心三角楔形(依 `signal` 0-4 以裁切比例呈現)、直立電池(依 `battery` 填充)+ 右側 `100%` 數字(沿用 `battText` 開關)。iOS 組(現行四柱訊號/橫向電池)在 os=android 時隱藏,反之亦然。

### LINE header(隨 os=android 且依 mode 分流)
- 1對1(`mode:'dm'`):`‹`、名字,右側四顆:搜尋、電話(線條聽筒)、行事曆(圓角框+「31」)、漢堡
- 群組:`‹`、名字+人數,右側三顆:搜尋、圓形對話泡、漢堡(**無電話**)
- 人數格式改 `(1,947)` 千分位(**雙 os 都改**,現況缺逗號是錯的)
- 置頂公告:左大聲公、右 `˅`,深色半透明(dark 下)

### 輸入列(os=android)
左:`＋`、相機、圖庫;中:圓角輸入框(框內右側笑臉);右:麥克風。全線條 icon。

### 其他
- 日期分隔:Android 慣例 `7月13日 週一`;「+日期」按鈕依 os 給預設文字(既有訊息文字不動,那是使用者內容)
- 預設頭像:灰底白人形剪影(雙 os 全域修正,LINE 兩平台皆同)
- Android 手勢條:較細長的白條
- 狀態列/系統字改 Roboto stack(`'Roboto','Noto Sans TC',sans-serif`),使用者的 `font` 設定優先

### 深色主題(theme=dark,雙 os 通用)
- header/狀態列底:近黑,字白
- 左泡泡 `#2b2d31` 白字;右泡泡維持 LINE 綠、深字(截圖證實)
- 引用框:綠泡內深色半透明
- 時間/已讀:淺灰;日期/略過 pill:深色半透明
- 輸入列:黑底、深灰輸入框、淺灰 icon
- 聊天背景色/背景圖不動(使用者資產;截圖中深色模式配紫色桌布即此語意)

### LINE AI 懸浮鈕
聊天區右下(輸入列上方)圓形半透明深色鈕、白字「AI」+ 細白圈;`aiFab` 勾選控制;**匯出/嵌入包含它**(它是畫面的一部分),預覽不受影響。

## 實作要點

- `#phone` 加 class:`os-<os> theme-<theme>`;index.html 同時放 iOS 與 Android 兩組狀態列/header/輸入列 icon,CSS 依 class 顯隱(靜態 markup、零 JS 重繪)
- 所有新 CSS 選擇器以 `.phone` 或 `.line-chat` 開頭(嵌入 HTML 的 scoped keep-list 依賴此字首)
- Android 訊號楔形:灰底楔形 + 白楔形 `clip-path: inset(0 X% 0 0)`,X 由 `signal` 換算
- 電池:Android 直立版 `#batt-fill-a` 高度隨 `battery`;`%` 數字獨立 span,iOS/Android 各一組
- `migrate()` 自動補新欄位,舊草稿/舊分享連結預設 `os:'ios'`、`theme:'light'`、`aiFab:true`
- SKILL.md schema 補三欄;sw.js CACHE bump;README 補一條

## 追加細節(使用者驗收回饋,依第三張真機截圖)

- **時間永不換行**:泡泡+時間包成 flex 列(`.brow`),時間 `flex:none` 貼泡泡底部;文字在泡泡內自行折行。下一行專屬表情回應列。
- **泡泡 R 角不對稱**:說話者側上角小 R(左訊息=左上 4px、右訊息=右上 4px,其餘 16px);圖片訊息同規則。
- **表情回應的灰笑臉座在半透明深色圓底上**(任何桌布都可見;先前 #8a94a3 在藍底上近乎隱形,已修);表情旁的人數計數直接用「+表情」再加一格打數字即可,不需獨立欄位。
- **引用回覆帶被引用者小圓頭像**:依 `quote.name` 比對 `people[]` 自動帶頭像,無則人形剪影。
- **os 切換自動帶鏡頭預設**:Android=挖孔、iOS=動態島(避免 Android 頂著 iPhone 島穿幫),使用者仍可手動改。

## 驗收

1. 外框分頁切 os=Android → 狀態列變 Android 組(鬧鐘/VoLTE/楔形訊號/直立電池)、iOS 組消失;切回 iOS 復原。
2. mode=群組時 header 三顆 icon(無電話);mode=1對1 四顆(含電話、行事曆)。
3. theme=dark → header/輸入列/左泡泡/時間色全變深色系;右泡泡仍綠。
4. 成員數顯示 `(1,947)` 千分位。
5. aiFab 預設顯示;取消勾選即消失;開啟時匯出 PNG 含此鈕。
6. 全部既有驗收情境(草稿/匯入/表情/字體)不受影響,重跑全綠。
