# 玩樂行銷風改版(多 skin + 隱藏 gated 真實)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 line-chat-maker 從「刻意擬真的 LINE 截圖」改為「一眼看得出是玩樂製圖」——提供 4 款玩樂行銷 skin(Memo 預設 / Jelly / Doodle / Pop),真實渲染降為隱藏、需本機 opt-in 且分享不外洩的 `real` skin。

**Architecture:** 新增 `skin.js`(skin registry + 純函式閘門 `pickSkin`),`render()` 依 `resolveSkin(settings)` 在 `#phone` 掛 `skin-<id>` class;各玩樂 skin 以 `.phone.skin-<id> …` 覆蓋既有 baseline 樣式(泡泡 / 狀態列 / 表頭 / 背景 / 傾斜 / 進場動態)。真實 = baseline(不掛覆蓋),`skin==='real'` 且無 `localStorage['lcm-real']` 旗標時強制退回 `memo`。零 build step、純 vanilla JS/CSS。

**Tech Stack:** Vanilla JS(無框架、無 build)、CSS(custom properties + class 覆蓋)、IndexedDB(草稿)、WebCodecs + mp4-muxer(既有 MP4)、Service Worker(全量 precache PWA)。測試:`node --test` 不需要;用一支 `node` assert 腳本驗純邏輯。

## Global Constraints

- **無 build step**:直接改檔;`git clone` 後開靜態伺服器即跑。
- **不使用 emoji**:程式碼註解、UI 文案、commit、任何地方皆不要(yazelin 硬規則)。
- **正體中文**:所有 UI 文案與註解用繁體中文,禁簡體字。
- **對外文案全形標點**:UI/README 對外中文用全形標點,不用破折號「——」以外的半形。
- **CSS 選擇器字首約束**:嵌入(embed)keep-list 正則在 `app.js:827` = `/^(\.phone|\.screen|\.statusbar|\.linehead|\.inputbar|\.homebar|\.notch|\.line-chat|\.announce)/`。所有新 skin CSS 選擇器**必須以 `.phone` 開頭**(用 `.phone.skin-<id> …`),否則嵌入時被丟。
- **embed 需手動注入 keyframes**:`@keyframes` 不符 keep-list;skin 進場動畫若要在 embed autoplay 生效,需比照 `lcmIn`(app.js:840)手動加進 embed `<style>`。
- **MP4 幀是靜態 SVG 快照**(app.js:656-699):時間性動畫要在匯出迴圈(app.js:746-782)以 inline style 逐幀 bake;靜態 transform(傾斜)會被快照自然擷取,但逐幀 inline transform 必須與傾斜**組合**(不可覆蓋掉傾斜)。
- **閘門是硬規則**:`skin==='real'` 且 `localStorage['lcm-real'] !== '1'` → 一律當 `'memo'`。集中在 `skin.js` 的 `pickSkin`,所有解析點都走它。
- **浮水印 / verify.html 不動**。
- **sw.js**:任何新檔一律加進 `ASSETS`(sw.js:3)並 bump `CACHE`(sw.js:2),否則離線載不到。
- **commit**:conventional(feat/docs/fix)、結尾 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`、無 emoji。

---

### Task 1: 基礎 — skin.js registry + 純閘門 + class 掛載

**Files:**
- Create: `skin.js`
- Create: `test/skin-gate.test.mjs`
- Modify: `index.html`(在載入 `app.js` 前加 `<script src="skin.js">`)
- Modify: `app.js:200-201`(render 掛 `skin-<id>` class)
- Modify: `sw.js:2-3`(precache 加 `skin.js`、bump cache)

**Interfaces:**
- Produces(全域,供 app.js 用):`window.LCM_SKINS = { SKINS, SKIN_IDS, pickSkin, resolveSkin, realEnabled }`
  - `SKINS: Array<{id:string,label:string,hidden?:boolean}>`
  - `pickSkin(want:string|undefined, realFlag:boolean): string` — 純函式,回合法 skin id
  - `resolveSkin(settings:object): string` — `pickSkin(settings?.skin, realEnabled())`
  - `realEnabled(): boolean` — `localStorage['lcm-real']==='1'`

- [ ] **Step 1: 寫 skin.js(registry + 純閘門)**

```js
// skin.js — skin registry 與純閘門。以 plain <script> 載入(browser),node 測試可用 new Function 注入。
// ponytail: 真實閘門是安全路徑,pickSkin 保持純函式、有 runnable 測試。
(function (root) {
  const SKINS = [
    { id: 'memo', label: '貼紙手帳' },
    { id: 'jelly', label: '果凍軟糖' },
    { id: 'doodle', label: '手繪塗鴉' },
    { id: 'pop', label: '波普霓虹' },
    { id: 'real', label: '真實(本機)', hidden: true },
  ];
  const SKIN_IDS = new Set(SKINS.map((s) => s.id));

  // 純函式:給定想要的 skin 與本機真實旗標,回一個一定合法的 skin id。
  // 硬規則:want==='real' 但沒旗標 → 'memo'(分享連結不外洩真實)。未知值 → 'memo'。
  function pickSkin(want, realFlag) {
    want = want || 'memo';
    if (want === 'real' && !realFlag) return 'memo';
    if (!SKIN_IDS.has(want)) return 'memo';
    return want;
  }

  function realEnabled() {
    try { return localStorage.getItem('lcm-real') === '1'; } catch (e) { return false; }
  }
  function resolveSkin(settings) { return pickSkin(settings && settings.skin, realEnabled()); }

  root.LCM_SKINS = { SKINS, SKIN_IDS, pickSkin, realEnabled, resolveSkin };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 2: 寫 runnable 測試(node,跑真的 skin.js,不重寫邏輯)**

```js
// test/skin-gate.test.mjs — 用 node 跑真的 skin.js,驗閘門。無框架。
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'skin.js'), 'utf8');
const g = {};
new Function('root', src.replace(/\(typeof window[^;]+;/, '(root);'))(g); // 以 g 當 root 執行 IIFE
const { pickSkin } = g.LCM_SKINS;

assert.equal(pickSkin('real', false), 'memo', '沒旗標的 real 必須退回 memo(防外洩)');
assert.equal(pickSkin('real', true), 'real', '有旗標的 real 保留');
assert.equal(pickSkin('jelly', false), 'jelly', '玩樂 skin 直通');
assert.equal(pickSkin('memo', false), 'memo');
assert.equal(pickSkin(undefined, true), 'memo', '缺值 → 預設 memo');
assert.equal(pickSkin('bogus', true), 'memo', '未知值 → memo');
console.log('skin-gate: OK');
```

- [ ] **Step 3: 跑測試,確認通過**

Run: `node test/skin-gate.test.mjs`
Expected: 印出 `skin-gate: OK`,exit 0。若閘門寫錯(例如 real 沒退回 memo)會 AssertionError。

- [ ] **Step 4: index.html 載入 skin.js(在 app.js 前)**

找到 index.html 載入 `app.js` 的 `<script>`(檔尾)。在它**之前**插入:

```html
<script src="skin.js"></script>
```

- [ ] **Step 5: render() 掛 skin class**

修改 `app.js:201`,在 className 尾端接 skin:

```js
// 原:
//   phone.className = 'phone level-' + st.frameLevel + (st.height === 'fixed' ? ' fixedh' : '') + ' theme-' + (st.theme || 'light') + (st.mode === 'dm' ? ' mode-dm' : ' mode-group');
// 改為(尾端加 skin-<resolved>):
  phone.className = 'phone level-' + st.frameLevel + (st.height === 'fixed' ? ' fixedh' : '') + ' theme-' + (st.theme || 'light') + (st.mode === 'dm' ? ' mode-dm' : ' mode-group') + ' skin-' + window.LCM_SKINS.resolveSkin(st);
```

`skin-real` 不寫任何覆蓋 CSS,所以 real 顯示 baseline;玩樂 skin 由後續 task 的 `.phone.skin-<id>` 覆蓋。

- [ ] **Step 6: sw.js precache 加 skin.js + bump cache**

```js
// sw.js:2 原 const CACHE = 'lcm-v99'; → bump:
const CACHE = 'lcm-v100';
// sw.js:3 ASSETS 陣列加入 'skin.js'(放在 'app.js' 前):
const ASSETS = ['./', 'index.html', 'style.css', 'skin.js', 'app.js', 'ai.js', 'vendor/html2canvas.min.js', 'vendor/mp4-muxer.min.js', 'verify.html', 'demo.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
```

- [ ] **Step 7: 手動驗證 — 預設掛上 memo class**

Run: `cd ~/line-chat-maker && python3 -m http.server 8123`;瀏覽器開 `http://localhost:8123/`。
DevTools Elements 檢查 `#phone`:className 應含 ` skin-memo`(舊草稿經 migrate 補 `skin:'memo'`)。Console 無錯。

- [ ] **Step 8: Commit**

```bash
git add skin.js test/skin-gate.test.mjs index.html app.js sw.js
git commit -m "feat: skin registry 與純閘門 skin.js;render 掛 skin class

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: skin 選單 UI + 閘門感知的 real 選項

**Files:**
- Modify: `app.js:4-5`(DEMO.settings 加 `skin: 'memo'`)
- Modify: `index.html:52-56`(#pane-frameset 加 `<select id="set-skin">`,並把既有 `set-theme` 標記為真實子選項)
- Modify: `app.js:463-467` 附近(加 `#set-skin` handler;render 時依 skin 顯隱真實子選項)

**Interfaces:**
- Consumes:`window.LCM_SKINS`(Task 1)
- Produces:`state.settings.skin`(string);UI 只在 `realEnabled()` 時顯示 `real` 選項與 `theme`/`sysColor` 子控制

- [ ] **Step 1: DEMO.settings 加 skin 預設**

`app.js:5` 的 `DEMO.settings` 物件加入 `skin: 'memo',`(放在 `theme: 'light',` 後即可)。既有 `migrate()`(app.js:70)會自動把舊草稿補上 `skin:'memo'`。

- [ ] **Step 2: index.html 加 skin 選單**

在 `#pane-frameset`(index.html:52 起)最前面、`set-syscolor` 之前插入:

```html
<label>風格 <select id="set-skin"></select></label>
```

把既有佈景控制(index.html:54 的 `<label>佈景 …set-theme…</label>`)整段包一層,方便顯隱:

```html
<span id="real-only" hidden><label>佈景 <select id="set-theme"><option value="light">亮色</option><option value="dark">深色(LINE 深色模式)</option></select></label></span>
```

(`set-syscolor` 也可一併移進 `#real-only`;非必要。)

- [ ] **Step 3: app.js 填 skin 選單 + handler + 顯隱真實子選項**

在設定控制註冊區(`app.js:423-486` 內、`set-theme` handler 旁)加入:

```js
// 依旗標填 skin 選單:一般訪客只看到玩樂四款;本機設 lcm-real 才多出 real
(function initSkinPicker() {
  const sel = document.querySelector('#set-skin');
  const showReal = window.LCM_SKINS.realEnabled();
  sel.innerHTML = '';
  for (const s of window.LCM_SKINS.SKINS) {
    if (s.hidden && !showReal) continue;
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.label;
    sel.appendChild(o);
  }
})();
document.querySelector('#set-skin').addEventListener('change', (e) => {
  state.settings.skin = e.target.value;
  save(); render();
});
```

- [ ] **Step 4: render() 同步 skin 選單值 + 顯隱真實子選項**

在 `render()`(app.js:136-216)裡、`set-theme` 被賦值處(app.js:182)附近加:

```js
  const eff = window.LCM_SKINS.resolveSkin(st);
  const skinSel = document.querySelector('#set-skin');
  if (skinSel) skinSel.value = eff;
  const realOnly = document.querySelector('#real-only');
  if (realOnly) realOnly.hidden = eff !== 'real'; // 佈景/系統色只在真實 skin 下有意義
```

- [ ] **Step 5: 手動驗證 — 選單與閘門**

伺服器開著,重整。
1. 未設旗標:`#set-skin` 只有「貼紙手帳 / 果凍軟糖 / 手繪塗鴉 / 波普霓虹」四項,無真實;`#real-only` 隱藏。切各項 → `#phone` class 隨之變(此時尚無覆蓋 CSS,外觀先不變,下一批 task 才上)。
2. Console 執行 `localStorage.setItem('lcm-real','1')` 後重整:`#set-skin` 多出「真實(本機)」;選它 → 佈景/深色控制出現。
3. 選真實後,Console `localStorage.removeItem('lcm-real')` 重整 → skin 選單值退回 memo、真實子選項消失(閘門)。

- [ ] **Step 6: Commit**

```bash
git add app.js index.html
git commit -m "feat: skin 選單 UI 與閘門感知的真實選項(需本機 opt-in)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 玩樂基礎設施 — 每泡確定性傾斜 + 俏皮度旋鈕 + 進場 hook

**Files:**
- Modify: `app.js` render 的訊息節點建立處(app.js:260-308)——每泡設 `--tilt`
- Modify: `app.js:4-5`(DEMO.settings 加 `playfulness: 0.5`)
- Modify: `index.html` #pane-frameset(加俏皮度 slider `#set-playful`)
- Modify: `app.js`(`#set-playful` handler;render 在 `#phone` 設 `--playful`)
- Modify: `style.css`(`.phone` 讀 `--playful`/`--tilt` 的基礎規則)

**Interfaces:**
- Produces:每個 `.msg` 節點有 inline `--tilt: <deg>`(確定性、依訊息序,重繪不跳);`#phone` 有 inline `--playful: <0..1>`;CSS 可用 `calc(var(--tilt) * var(--playful))`。

- [ ] **Step 1: 確定性傾斜工具(不用 Math.random,避免重繪跳動且匯出與預覽一致)**

在 app.js 適當工具區加:

```js
// 依整數 seed 產一個 [-1,1] 的穩定偽亂數(重繪同 seed 同值,匯出與預覽一致)
function tiltUnit(seed) {
  const x = Math.sin((seed + 1) * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // [-1,1)
}
```

- [ ] **Step 2: render 每泡設 --tilt**

**先讀 app.js:260-308** 確認訊息節點迴圈的形狀與 seed 來源。每個 `node` 建好後、append 前,用一個**穩定 seed**(該泡在列表的位置索引;若迴圈無現成索引,用 `msgs.indexOf(m)` 或另設遞增計數)設 `--tilt`:

```js
  node.style.setProperty('--tilt', tiltUnit(seed).toFixed(2) + 'deg'); // 基礎 ±1deg;各 skin 以 --tilt-range 放大;seed 穩定 → 重繪/匯出不跳
```

(`seed` = 該訊息的穩定位置索引。基礎幅度小;各 skin 用自己的 `--tilt-range` 乘上去,見 skin task。)

- [ ] **Step 3: DEMO.settings 加 playfulness,index.html 加 slider**

`app.js:5` DEMO.settings 加 `playfulness: 0.5,`。index.html #pane-frameset 加:

```html
<label>俏皮度 <input id="set-playful" type="range" min="0" max="1" step="0.05" value="0.5"></label>
```

- [ ] **Step 4: handler + render 套用 --playful**

app.js 設定註冊區加:

```js
document.querySelector('#set-playful').addEventListener('input', (e) => {
  state.settings.playfulness = parseFloat(e.target.value);
  document.querySelector('#phone').style.setProperty('--playful', state.settings.playfulness);
  // 只動 CSS 變數即時反映,不必整頁重繪;仍需存檔
  save();
});
```

在 `render()` 內(掛 className 之後)加同步:

```js
  document.querySelector('#phone').style.setProperty('--playful', st.playfulness == null ? 0.5 : st.playfulness);
  const pf = document.querySelector('#set-playful'); if (pf) pf.value = st.playfulness == null ? 0.5 : st.playfulness;
```

- [ ] **Step 5: style.css 基礎規則(讓傾斜生效,且 real skin 不吃傾斜)**

在 style.css 末尾加:

```css
/* 玩樂基礎:傾斜由 --tilt(每泡)× --playful(全域)× 各 skin 的 --tilt-range 決定;real skin 不設 --tilt-range 故為 0 */
.phone { --playful: 0.5; }
.phone[class*="skin-"] .line-chat .msg { transform: rotate(calc(var(--tilt, 0deg) * var(--playful, .5) * var(--tilt-range, 0))); transition: transform .15s ease; }
```

(real skin:`.phone.skin-real` 不定義 `--tilt-range`,故 `--tilt-range:0` → 不傾斜,維持 baseline。)

- [ ] **Step 6: 手動驗證**

重整,選一個玩樂 skin(class 已上,但 `--tilt-range` 尚未由 skin 設,故此步先手動驗變數):DevTools 對 `#phone` 加 inline `style="--tilt-range:1"`,訊息應輕微歪斜;拉俏皮度 slider,歪斜幅度即時變化;拉到 0 完全不歪。移除後恢復。

- [ ] **Step 7: Commit**

```bash
git add app.js index.html style.css
git commit -m "feat: 玩樂基礎——每泡確定性傾斜 --tilt、俏皮度旋鈕 --playful

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Memo skin(預設、reference)

**Files:**
- Modify: `style.css`(新增 `.phone.skin-memo …` 覆蓋 + `@keyframes memoIn`)

**Interfaces:**
- Consumes:`--tilt`/`--playful`(Task 3)、`.appear`(既有 playback class,app.js:963)
- Produces:`@keyframes memoIn`(進場);`.phone.skin-memo` 一整組樣式。**所有選擇器以 `.phone` 開頭**(embed 相容)。

Memo 設計 token(奶油紙感、貼紙剪裁、紙膠帶、隨手歪貼、蓋章落定):
- 背景 `--c-bg: #f4ece0`;泡泡底白 `#fffdf8`,4px 白外框 + 柔陰影(貼紙剪裁感);圓角 14px;`--tilt-range: 4`(±4deg × playful)。
- 收訊泡文字 `#3a3226`,自己(me)泡 `#eafbe6`(淡綠、非 LINE 綠),避免仿真綠。
- 狀態列/表頭:紙色底、深棕字(蓋掉既有 sysColor imperative:見 Step 3 註)。
- 進場 `memoIn`:從 scale(.9) + 上移 + 輕微反向旋轉 落定(蓋章感),0.34s。

- [ ] **Step 1: 寫 Memo CSS**

在 style.css 末尾加(完整,作為其餘 skin 的模板):

```css
/* ===== skin: Memo 貼紙手帳 ===== */
.phone.skin-memo { --tilt-range: 4; }
.phone.skin-memo .screen { background: #f4ece0; }
.phone.skin-memo .line-chat { background: #f4ece0; }
.phone.skin-memo .line-chat .msg .bubble {
  background: #fffdf8; color: #3a3226;
  border: 3px solid #fff; border-radius: 14px;
  box-shadow: 0 2px 0 rgba(120,100,70,.18), 0 6px 14px rgba(120,100,70,.12);
}
.phone.skin-memo .line-chat .msg.me .bubble { background: #eafbe6; color: #2b3a24; }
.phone.skin-memo .linehead { position: relative; } /* 供紙膠帶 ::before 定位 */
.phone.skin-memo .statusbar, .phone.skin-memo .linehead { background: #efe4d4 !important; color: #5b4a34 !important; }
.phone.skin-memo .inputbar { background: #efe4d4; color: #5b4a34; }
/* 紙膠帶裝飾:表頭上緣一條半透明斜貼 */
.phone.skin-memo .linehead::before {
  content: ''; position: absolute; left: 18px; top: -6px; width: 68px; height: 18px;
  background: rgba(230,180,120,.55); transform: rotate(-4deg); border-radius: 2px;
}
.phone.skin-memo .line-chat .appear { animation: memoIn .34s cubic-bezier(.22,1.2,.36,1) both; }
@keyframes memoIn {
  from { opacity: 0; transform: scale(.9) translateY(10px) rotate(2deg); }
  to   { opacity: 1; transform: scale(1) translateY(0) rotate(0); }
}
```

- [ ] **Step 2: 讓 skin 狀態列色蓋過既有 imperative 設定**

**先讀 `app.js:185-190`** 看它實際怎麼取 statusbar/linehead 元素(survey 指出這裡 imperatively 用 `sysColor` 覆寫其 `background`/`color`,inline style 優先於 CSS)。玩樂 skin 需要自己的色,所以要把這段**現有**設定包進條件、只在 real skin 套用;else 分支把**同一批元素**的 inline `background`/`color` 清空交還 CSS:

```js
  if (window.LCM_SKINS.resolveSkin(st) === 'real') {
    // ← 把 app.js:185-190 現有那段 sysColor → statusbar/linehead 設定原封移進來
  } else {
    // 玩樂 skin:清掉同一批元素的 inline 色(用該段原本的選取方式,例如 elStatus/elHead 變數)
    // elStatus.style.background=''; elStatus.style.color=''; elHead.style.background=''; elHead.style.color='';
  }
```

用**該段原本的元素變數/選取方式**填入(不要臆測 id);skin CSS 另有 `!important` 兜底,但仍以清 inline 為正解。

- [ ] **Step 3: 手動驗證 — Memo 為預設外觀**

重整(預設 memo):`#phone` 應為奶油紙底、白框貼紙泡泡、表頭有紙膠帶斜貼、訊息輕微歪斜;按「▶ 播放」訊息以蓋章感逐則落定。切到別的 skin 再切回 memo 正常。

- [ ] **Step 4: Commit**

```bash
git add style.css app.js
git commit -m "feat: Memo 貼紙手帳 skin(預設),狀態列色改為 skin 驅動

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Jelly skin(果凍軟糖)

**Files:** Modify `style.css`(`.phone.skin-jelly …` + `@keyframes jellyIn`)

**Interfaces:** 同 Task 4 模板;選擇器一律 `.phone.skin-jelly …`。

Jelly token(粉嫩糖果、光澤玩具泡泡、Q 彈 overshoot、微傾):
- 背景漸層 `#ffeaf4 → #eaf3ff`;泡泡超圓(radius 22px)、內高光(top 白色 inset)、飽和粉/薰衣草;`--tilt-range: 2`。
- me 泡 `#b6f0c9`(薄荷),對方泡 `#ffe1ef`;文字深一階同色系。
- 進場 `jellyIn`:scale 從 .6 overshoot 到 1(果凍抖),0.4s。

- [ ] **Step 1: 寫 Jelly CSS**

```css
/* ===== skin: Jelly 果凍軟糖 ===== */
.phone.skin-jelly { --tilt-range: 2; }
.phone.skin-jelly .screen, .phone.skin-jelly .line-chat { background: linear-gradient(160deg, #ffeaf4, #eaf3ff); }
.phone.skin-jelly .line-chat .msg .bubble {
  border-radius: 22px; background: #ffe1ef; color: #6b2f4d;
  box-shadow: inset 0 3px 6px rgba(255,255,255,.85), 0 6px 14px rgba(180,120,160,.28);
}
.phone.skin-jelly .line-chat .msg.me .bubble { background: #b6f0c9; color: #205238; }
.phone.skin-jelly .statusbar, .phone.skin-jelly .linehead { background: #ffd6ea !important; color: #7a3159 !important; }
.phone.skin-jelly .inputbar { background: #ffd6ea; color: #7a3159; }
.phone.skin-jelly .line-chat .appear { animation: jellyIn .4s cubic-bezier(.18,1.5,.3,1) both; }
@keyframes jellyIn {
  0% { opacity: 0; transform: scale(.6); }
  60% { opacity: 1; transform: scale(1.08); }
  100% { transform: scale(1); }
}
```

- [ ] **Step 2: 手動驗證** — 切 Jelly:漸層底、光澤圓泡;播放時泡泡 Q 彈放大落定。

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: Jelly 果凍軟糖 skin

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Doodle skin(手繪塗鴉)

**Files:** Modify `style.css`(`.phone.skin-doodle …` + `@keyframes doodleIn`)

Doodle token(筆記本白、手繪抖動框線、蠟筆、漫畫、描線 pop):
- 背景 `#fffef8` + 淡格線(repeating-linear-gradient);泡泡白底、2.5px 深色**手繪感**框線(用 border + border-radius 不規則:`255px 15px 225px 15px/15px 225px 15px 255px` 之類的有機圓角);`--tilt-range: 3`。
- me 泡淡黃 `#fff6c8`;對方泡白;字 `#333`。
- 進場 `doodleIn`:scale + 輕轉「描上去」感,0.3s。

- [ ] **Step 1: 寫 Doodle CSS**

```css
/* ===== skin: Doodle 手繪塗鴉 ===== */
.phone.skin-doodle { --tilt-range: 3; }
.phone.skin-doodle .screen, .phone.skin-doodle .line-chat {
  background: #fffef8;
  background-image: repeating-linear-gradient(#fffef8 0 26px, #eef0e6 26px 27px);
}
.phone.skin-doodle .line-chat .msg .bubble {
  background: #fff; color: #333;
  border: 2.5px solid #3a3a3a;
  border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px; /* 手繪不規則 */
  box-shadow: 2px 3px 0 rgba(0,0,0,.12);
}
.phone.skin-doodle .line-chat .msg.me .bubble { background: #fff6c8; }
.phone.skin-doodle .statusbar, .phone.skin-doodle .linehead { background: #fff !important; color: #333 !important; border-bottom: 2.5px solid #3a3a3a; }
.phone.skin-doodle .inputbar { background: #fff; color: #333; border-top: 2.5px solid #3a3a3a; }
.phone.skin-doodle .line-chat .appear { animation: doodleIn .3s ease-out both; }
@keyframes doodleIn {
  from { opacity: 0; transform: scale(.85) rotate(-3deg); }
  to   { opacity: 1; transform: scale(1) rotate(0); }
}
```

- [ ] **Step 2: 手動驗證** — 切 Doodle:筆記本格線、手繪不規則框線泡泡。

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: Doodle 手繪塗鴉 skin

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Pop skin(波普霓虹、暗底)

**Files:** Modify `style.css`(`.phone.skin-pop …` + `@keyframes popIn`)

Pop token(霓虹暗底、發光框線、玻璃填色、pop + 光暈閃):
- 背景深 `#12101c`;泡泡半透明玻璃(`rgba(255,255,255,.06)` + backdrop 感)、2px 霓虹框(青/洋紅)+ 外發光;`--tilt-range: 3`。
- me 泡青色發光 `#00e5c0` 邊;對方洋紅 `#ff4fd8` 邊;字近白。
- 進場 `popIn`:scale + 外發光由強到常態,0.36s。

- [ ] **Step 1: 寫 Pop CSS**

```css
/* ===== skin: Pop 波普霓虹(暗底) ===== */
.phone.skin-pop { --tilt-range: 3; }
.phone.skin-pop .screen, .phone.skin-pop .line-chat { background: #12101c; }
.phone.skin-pop .line-chat .msg .bubble {
  background: rgba(255,255,255,.06); color: #f4f2ff;
  border: 2px solid #ff4fd8; border-radius: 16px;
  box-shadow: 0 0 12px rgba(255,79,216,.6), inset 0 0 8px rgba(255,79,216,.25);
}
.phone.skin-pop .line-chat .msg.me .bubble {
  border-color: #00e5c0; color: #eafffb;
  box-shadow: 0 0 12px rgba(0,229,192,.6), inset 0 0 8px rgba(0,229,192,.25);
}
.phone.skin-pop .statusbar, .phone.skin-pop .linehead { background: #0c0a14 !important; color: #f4f2ff !important; }
.phone.skin-pop .inputbar { background: #0c0a14; color: #cfc9e6; }
.phone.skin-pop .line-chat .appear { animation: popIn .36s ease-out both; }
@keyframes popIn {
  0% { opacity: 0; transform: scale(.7); box-shadow: 0 0 26px rgba(255,79,216,.9); }
  100% { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 2: 手動驗證** — 切 Pop:暗底、霓虹發光泡泡;播放時泡泡帶光暈彈出。

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: Pop 波普霓虹 skin(暗底)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: MP4 匯出進場 + embed 相容(讓 skin 動畫進影片與嵌入)

**Files:**
- Modify: `app.js:746-782`(MP4 匯出迴圈:進場 inline style 與 `--tilt` 組合、加 scale overshoot)
- Modify: `app.js:826-840`(embed:確認 skin 選擇器過 keep-list;注入各 skin `@keyframes`)

**Interfaces:**
- Consumes:各 skin `@keyframes`(Task 4-7)、`--tilt`(Task 3)
- Produces:MP4 逐幀進場(scale + 位移 + 與傾斜組合);embed `<style>` 含 skin keyframes

- [ ] **Step 1: MP4 進場改為 scale+位移並組合傾斜**

`app.js:761-764` 目前逐幀寫:`a.node.style.opacity = e2; a.node.style.transform = translateY(6*(1-e2))`。改為 scale overshoot + 位移,且**保留該泡的傾斜**(靜態快照會擷取 CSS rotate,但 inline transform 會蓋掉它,故要一起寫):

```js
        } else {
          const e2 = easeOut(Math.max(p, 0));
          const tilt = a.node.style.getPropertyValue('--tilt') || '0deg'; // 讀每泡傾斜
          const s = 0.7 + 0.3 * e2;            // scale .7 → 1
          a.node.style.opacity = e2.toFixed(3);
          a.node.style.transform = `rotate(${tilt}) scale(${s.toFixed(3)}) translateY(${(8 * (1 - e2)).toFixed(2)}px)`;
          if (a.scrollBy) chatEl.scrollTop = a.scrollFrom + a.scrollBy * e2;
        }
```

進場結束的還原(`app.js:761` 的 `p>=1` 分支)把 transform 清空即可(還原成 CSS 靜態傾斜):

```js
        if (p >= 1) { a.node.style.opacity = ''; a.node.style.transform = ''; chatEl.scrollTop = a.scrollFrom + a.scrollBy; anims.splice(k, 1); }
```

(注:v1 MP4 用這支「共用加強版進場」(scale overshoot),不逐 skin 分歧;各 skin 專屬 MP4 進場列為後續 polish。傾斜與各 skin 靜態外觀仍逐幀正確擷取。)

- [ ] **Step 2: embed 注入 skin keyframes**

`app.js:840` 目前手動把 `@keyframes lcmIn{…}` 塞進 embed `<style>`。skin 進場靠各自 keyframes,embed autoplay 需要它們。把該處字串補上四個 skin keyframes(與 style.css 內容一致):

```js
  // ...原 lcmIn 之外,補上 skin 進場 keyframes(keep-list 不含 @keyframes,需手動注入)
  const skinKeyframes = `
@keyframes memoIn{from{opacity:0;transform:scale(.9) translateY(10px) rotate(2deg)}to{opacity:1;transform:none}}
@keyframes jellyIn{0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes doodleIn{from{opacity:0;transform:scale(.85) rotate(-3deg)}to{opacity:1;transform:none}}
@keyframes popIn{0%{opacity:0;transform:scale(.7)}100%{opacity:1;transform:scale(1)}}`;
  // 併入 emit 的 <style>(找到原本組 style 字串處接上 skinKeyframes)
```

並確認 embed autoplay JS(app.js:839 的 `m.style.animation='lcmIn …'`)改為依當前 skin 用對應動畫名,或簡單起見 embed 一律用 `lcmIn`(保底淡入)——**至少不能壞**。最小作法:embed autoplay 維持 `lcmIn`,skin 靜態外觀(顏色/框線/傾斜)照樣呈現(那些選擇器過了 keep-list)。skin 專屬 embed 進場列為 polish。

- [ ] **Step 3: 手動驗證 — MP4 與 embed**

1. 選 Memo,按「匯出 MP4」,存檔播放:訊息以 scale 放大進場、各泡帶輕微固定傾斜、奶油紙底正確。對 Jelly/Pop 各測一支。
2. 把匯出的 MP4 拖進 `verify.html`:仍偵測到隱形場紋(浮水印未動)。
3. 按「嵌入」複製 HTML,貼進一個空白 .html 開啟:skin 顏色/框線/傾斜正確呈現(scoped CSS 帶到了);autoplay 至少有淡入。

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: MP4 進場改 scale overshoot 並組合每泡傾斜;embed 注入 skin keyframes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: SKILL.md 與 ai.js 更新

**Files:**
- Modify: `skills/line-chat-maker/SKILL.md:22-50`(settings schema 加 `skin`)
- Modify: `ai.js:108`(executor settings 清單加 skin)、`ai.js:143`(writer「以假亂真」語氣軟化)

**Interfaces:** 對外文件與 AI prompt 與新 skin 模型一致;評審 #5「真實感」(對白可信度)**不動**。

- [ ] **Step 1: SKILL.md 加 skin 欄位**

在 `SKILL.md` settings 區塊(第 22-50 行)`theme` 附近加一行:

```
  "skin": "memo",            // 外觀風格:'memo'(預設)/'jelly'/'doodle'/'pop';'real'(真實)僅本機 opt-in,對外一律當 'memo'
```

`theme`/`sysColor` 說明保留,補註「只在本機真實 skin 下作用」。

- [ ] **Step 2: ai.js executor 清單加 skin**

`ai.js:108` 的 settings 條列(`title、members、bg、mode、theme…`)加入 `skin("memo"|"jelly"|"doodle"|"pop")`。

- [ ] **Step 3: writer 語氣軟化**

`ai.js:143` 的「逐字轉譯成一張以假亂真的 LINE 聊天畫面」改為「逐字轉譯成一張 LINE 風格的對話畫面」(去掉「以假亂真」的擬真暗示)。評審 #5「真實感(像真人打字的口語與短句)」是對白層面,**保留**。

- [ ] **Step 4: 手動驗證** — 開 AI 分頁跑一次「生成一段…對話」,確認執行 AI 能填入且不報 schema 錯;畫面套用當前 skin。

- [ ] **Step 5: Commit**

```bash
git add skills/line-chat-maker/SKILL.md ai.js
git commit -m "docs: SKILL schema 加 skin;ai.js executor 認得 skin、writer 去擬真語氣

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: README 改寫(拿掉假宣稱 + 誠實防濫用 + 主打 skin)

**Files:** Modify `README.md:25`(刪 iOS/Android 假宣稱)、`README.md:60-67`(防濫用誠實版)、能力條目主打四 skin。

- [ ] **Step 1: 刪 README:25 假宣稱、改主打 skin**

把 `- 系統切換:iOS 風/Android 精刻…+ LINE 深色主題 + AI 懸浮鈕開關` 改為:

```
- 玩樂風格切換:貼紙手帳 / 果凍軟糖 / 手繪塗鴉 / 波普霓虹(暗底)四款,各有配色、泡泡造型、傾斜與進場動態;可調俏皮度。刻意不提供擬真樣式。
```

- [ ] **Step 2: 防濫用段改誠實版**

`README.md:60-67` 首兩點改為:

```
- 本工具**只提供玩樂風格**,做不出擬真 LINE 截圖;產出一眼看得出是製圖,供部落格配圖、教學、行銷素材。請勿用於詐騙、毀謗、偽造證據等誤導用途。
- 匯出的 PNG/MP4 一律嵌入三層隱形識別標記(見下),作為後備;不宣稱能防有心人 fork。
```

其餘隱形浮水印、verify、開源界限、商標聲明**保留原文**。

- [ ] **Step 3: 手動驗證** — README 預覽:無 iOS/Android 字樣;防濫用讀來與新方向一致。

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README 主打玩樂 skin、刪除從未實作的 iOS/Android 假宣稱、防濫用改誠實版

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: 完整驗證(spec 驗證清單)

**Files:** 無(純驗證);發現問題回對應 task 修。

- [ ] **Step 1: 跑純邏輯測試**

Run: `node test/skin-gate.test.mjs` → `skin-gate: OK`。

- [ ] **Step 2: 四 skin 渲染 + 傾斜 + 進場**

伺服器開著,逐一切 memo/jelly/doodle/pop:各自配色/泡泡/傾斜正確;按「▶ 播放」各自進場動態正確。

- [ ] **Step 3: 每 skin 匯出 MP4**

每款各匯出一支:進場以 30fps 擷取進影片、傾斜正確、無破圖。

- [ ] **Step 4: 浮水印仍驗得出**

把 Step 3 任一 MP4 與一張匯出 PNG 拖進 `verify.html`:仍偵測到本工具識別標記。

- [ ] **Step 5: 舊連結遷移 + 閘門**

1. 用舊格式(無 `skin`、含 `theme:'dark'`)JSON 匯入(本機**無**旗標)→ 開成 Memo、訊息完整。
2. `localStorage.setItem('lcm-real','1')` 重整,做一張 real 圖,產生分享連結;`localStorage.removeItem('lcm-real')` 重整後開該連結 → 退回 Memo(閘門把關,真實不外洩)。

- [ ] **Step 6: 嵌入 scoped 樣式完整**

Memo 圖按「嵌入」,貼進空白 .html:`.phone.skin-memo …` 樣式帶到、外觀正確。

- [ ] **Step 7: 收尾 commit(若前面驗證有小修才需要)**

```bash
git add -A && git commit -m "test: 完整驗證清單通過(四 skin 渲染/MP4/浮水印/遷移/閘門/嵌入)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 收尾(全部 task 後,人工確認再做)

- 合併 `feat/playful-marketing-skins` → `master`(PR 或直接,依 yazelin 當下指示)。
- **延後決定**:真實版最終處置(維持隱藏 skin,或走 B:全移除+洗歷史+private repo)等 yazelin 看過成品再拍板(spec「待完整功能後決定」節)。合併不代表拍板 B。
- 可選:`archive/realistic-line-v1` 是否推遠端/刪除,依 yazelin 決定。
