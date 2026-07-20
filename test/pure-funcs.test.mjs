// test/pure-funcs.test.mjs — 覆蓋三個功能抽得出的純邏輯:去背色距門檻、取回 pending 序列化往返、切圖幾何。
// 無框架,node 直跑(node --test 亦可)。ai.js/app.js 是含 DOM 的瀏覽器 IIFE,純函式未 export、
// 也無法整檔 new Function 注入(載入即呼叫 $()/addEventListener),故此處自帶「與原始碼等價」的鏡像實作,
// 邏輯必須與 ai.js chromaKey／applyGrid／planGrid、app.js safeFileName 同步;改動原始公式時一併更新這裡。
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── 鏡像:ai.js chromaKey 的單像素色距→alpha(lo=45 全透明核心、hi=95 全保留、之間羽化)+ 綠溢抑制 ──
const LO = 45, HI = 95;
function chromaPixel(bg, px, origAlpha = 255) { // bg=[r,g,b] 底色;px=[r,g,b] 前景;回 {alpha, green}
  const [br, bg_, bb] = bg;
  const [r, gr, b] = px;
  const dist = Math.sqrt((r - br) ** 2 + (gr - bg_) ** 2 + (b - bb) ** 2);
  const a = Math.max(0, Math.min(1, (dist - LO) / (HI - LO))) * 255;
  const alpha = Math.min(origAlpha, a);
  let green = gr;
  if (a > 0 && a < 255) { const cap = Math.max(r, b); if (gr > cap) green = Math.min(gr, cap + 12); }
  return { alpha, green };
}

test('去背色距門檻:底色像素(悶綠 [114,152,98])→ alpha 全透明 0', () => {
  const bg = [114, 152, 98];
  assert.equal(chromaPixel(bg, bg).alpha, 0, '與底色零色距必須被去乾淨(不是舊碼的半透明 110)');
});

test('去背色距門檻:主體非綠色塊 → alpha 全保留 255', () => {
  const bg = [114, 152, 98];
  assert.equal(chromaPixel(bg, [220, 60, 60]).alpha, 255, '色距遠大於 hi 的主體像素必須完整保留');
});

test('去背色距門檻:LINE 綠 #06c755 不被誤刪', () => {
  const bg = [114, 152, 98];
  assert.equal(chromaPixel(bg, [6, 199, 85]).alpha, 255, '飽和 LINE 綜色距約 118.5 > hi,必須保留');
});

test('去背色距門檻:羽化帶(色距落在 45~95 間)→ 0 < alpha < 255', () => {
  const bg = [114, 152, 98];
  const { alpha } = chromaPixel(bg, [114 + 70, 152, 98]); // 沿 r 軸推 70,色距恰 70
  assert.ok(alpha > 0 && alpha < 255, `羽化帶應部分透明,實得 ${alpha}`);
});

test('去背色距門檻:邊緣綠溢抑制,綠不得高於 max(r,b)+12', () => {
  const bg = [114, 152, 98];
  const px = [120, 210, 110]; // 色距約 59.5 在羽化帶,綠 210 遠高於 max(120,110)=120
  const { alpha, green } = chromaPixel(bg, px);
  assert.ok(alpha > 0 && alpha < 255, '前提:此像素在羽化帶');
  assert.ok(green <= Math.max(px[0], px[2]) + 12, `綠溢應被壓到 <= cap+12,實得 ${green}`);
  assert.equal(green, 132, '120(cap)+12 = 132');
});

test('去背色距門檻:核心區(色距 < lo)一律全刪', () => {
  const bg = [114, 152, 98];
  const { alpha } = chromaPixel(bg, [114 + 30, 152, 98]); // 色距 30 < lo=45
  assert.equal(alpha, 0, '色距小於 lo 的近底色像素全透明');
});

// ── 鏡像:savePending 寫進 localStorage 的紀錄形狀;驗 JSON 往返與 undefined 欄位自動略去 ──
function makeRecord(currentId, provider, jobId, grid, cells, msgLen, peopleLen) {
  return { draftId: currentId, provider, jobId, grid: { cols: grid.cols, rows: grid.rows }, cells, msgLen, peopleLen, ts: 1234567890 };
}

test('取回 pending:序列化往返後欄位完整、可據以回填', () => {
  const cells = [
    { type: 'sticker', msgIndex: 2, personIndex: undefined, prompt: '抱抱的熊' },
    { type: 'avatar', msgIndex: undefined, personIndex: 0, prompt: '小白的大頭貼' },
    { type: 'image', msgIndex: 5, personIndex: undefined, prompt: '海邊夕陽' },
  ];
  const rec = makeRecord('d-42', 'free', 'job-abc', { cols: 2, rows: 2 }, cells, 8, 3);
  const back = JSON.parse(JSON.stringify(rec));
  assert.equal(back.draftId, 'd-42');
  assert.equal(back.provider, 'free');
  assert.equal(back.jobId, 'job-abc');
  assert.deepEqual(back.grid, { cols: 2, rows: 2 });
  assert.equal(back.msgLen, 8);
  assert.equal(back.peopleLen, 3);
  assert.equal(back.cells.length, 3);
  // undefined 欄位被 JSON.stringify 略去,不會變成 null
  assert.ok(!('personIndex' in back.cells[0]), 'sticker 格不應留下 personIndex:undefined');
  assert.ok(!('msgIndex' in back.cells[1]), 'avatar 格不應留下 msgIndex:undefined');
  assert.equal(back.cells[1].personIndex, 0);
  assert.equal(back.cells[2].msgIndex, 5);
  assert.equal(back.cells[0].type, 'sticker');
});

test('取回 pending:codex provider 紀錄同樣往返無損', () => {
  const rec = makeRecord('d-7', 'codex', 'j-9', { cols: 3, rows: 4 }, [{ type: 'image', msgIndex: 0, prompt: 'x' }], 1, 1);
  const back = JSON.parse(JSON.stringify(rec));
  assert.equal(back.provider, 'codex');
  assert.deepEqual(back.grid, { cols: 3, rows: 4 });
});

// ── 鏡像:ai.js planGrid 與 applyGrid 的切圖幾何(inset=0.08)──
function planGrid(n) {
  if (n <= 4) return { cols: 2, rows: 2, size: '1024x1024' };
  if (n <= 9) return { cols: 3, rows: 3, size: '1024x1024' };
  return { cols: 3, rows: 4, size: '1024x1536' };
}
function cellRect(img, grid, i, inset = 0.08) {
  const cw = img.width / grid.cols, ch = img.height / grid.rows;
  const col = i % grid.cols, row = Math.floor(i / grid.cols);
  return { sx: col * cw + cw * inset, sy: row * ch + ch * inset, sw: cw * (1 - inset * 2), sh: ch * (1 - inset * 2) };
}

test('切圖幾何:planGrid 依格數選盤面', () => {
  assert.deepEqual(planGrid(1), { cols: 2, rows: 2, size: '1024x1024' });
  assert.deepEqual(planGrid(4), { cols: 2, rows: 2, size: '1024x1024' });
  assert.deepEqual(planGrid(5), { cols: 3, rows: 3, size: '1024x1024' });
  assert.deepEqual(planGrid(9), { cols: 3, rows: 3, size: '1024x1024' });
  assert.deepEqual(planGrid(10), { cols: 3, rows: 4, size: '1024x1536' });
  assert.deepEqual(planGrid(12), { cols: 3, rows: 4, size: '1024x1536' });
});

test('切圖幾何:cellRect 對 2x2 盤右下格(index 3)算出正確內縮矩形', () => {
  const img = { width: 1024, height: 1024 };
  const grid = planGrid(4); // 2x2,cw=ch=512
  const r = cellRect(img, grid, 3); // col1,row1
  assert.equal(r.sx, 512 + 512 * 0.08); // 552.96
  assert.equal(r.sy, 512 + 512 * 0.08);
  assert.equal(r.sw, 512 * 0.84); // 430.08
  assert.equal(r.sh, 512 * 0.84);
});

test('切圖幾何:cellRect 對 3x4 縱盤取樣落在各格內、彼此不重疊', () => {
  const img = { width: 1024, height: 1536 };
  const grid = planGrid(12); // 3x4,cw≈341.33,ch=384
  const cw = 1024 / 3, ch = 1536 / 4;
  const r0 = cellRect(img, grid, 0); // 左上
  const r1 = cellRect(img, grid, 1); // 同列右鄰
  assert.ok(r0.sx >= 0 && r0.sx + r0.sw <= cw, '第 0 格取樣需落在該格欄寬內');
  assert.ok(r1.sx >= cw, '第 1 格起點需在第二欄,才不會跨格取樣');
  assert.equal(r0.sy, ch * 0.08);
});

// ── 鏡像:app.js safeFileName(下載檔名安全化;單一 regex + || '未命名')──
function safeFileName(s) { return String(s == null ? '' : s).replace(/[\\/:*?"<>|]+/g, '_').trim() || '未命名'; }

test('下載檔名:合法字元(含 CJK 與 +)保留、非法字元換底線、空白退未命名', () => {
  assert.equal(safeFileName('小白++'), '小白++');
  assert.equal(safeFileName('a/b:c*?'), 'a_b_c_');
  assert.equal(safeFileName('中年攻城屍'), '中年攻城屍');
  assert.equal(safeFileName('  '), '未命名');
  assert.equal(safeFileName(''), '未命名');
  assert.equal(safeFileName(null), '未命名');
});
