/* 內建 AI 助手:工具=腳本 JSON 操作(參考 zerotype-agent 的迴圈設計:強制工具+反偷懶+迴圈上限)
   與 app.js 同為 classic script,直接共用全域的 state / save / render / toast。 */
'use strict';
(() => {

// ── 連線設定(只存 localStorage,絕不進 state:草稿與分享連結不能帶到 API key) ──
const PROVIDERS = {
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b' }, // 2026-07 實測:工具呼叫最穩+繁中最乾淨(qwen3 會捏造 @imgN)
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
  gemini: { label: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  openrouter: { label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4.1-mini' },
  ollama: { label: 'Ollama(本機)', base: 'http://localhost:11434/v1', model: 'llama3.2', keyless: true },
  custom: { label: '自訂(OpenAI 相容)', base: '', model: '', keyless: true },
};
function cfg() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem('lcm-ai')) || {}; } catch (e) {}
  if (!PROVIDERS[c.provider]) c = { provider: 'groq', base: PROVIDERS.groq.base, model: PROVIDERS.groq.model, key: '' };
  return c;
}
function saveCfg(c) { try { localStorage.setItem('lcm-ai', JSON.stringify(c)); } catch (e) {} }

// ── 圖片佔位:dataURL 換成 @imgN 再給模型,套回時還原(模型 round-trip 不會弄丟圖) ──
let imgRegistry = [];
function strip(v) {
  if (typeof v === 'string') {
    if (v.startsWith('data:image')) { imgRegistry.push(v); return '@img' + (imgRegistry.length - 1); }
    return v;
  }
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = strip(v[k]); return o; }
  return v;
}
function rehydrate(v) {
  if (typeof v === 'string') { const m = v.match(/^@img(\d+)$/); return m ? (imgRegistry[+m[1]] ?? null) : v; }
  if (Array.isArray(v)) return v.map(rehydrate);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = rehydrate(v[k]); return o; }
  return v;
}
function scriptOf() { return { settings: state.settings, people: state.people, messages: state.messages }; }

// ── 工具(同一份定義供 agent 迴圈與 WebMCP 註冊) ──
const TOOL_DEFS = [
  { name: 'get_script', description: '讀取目前完整腳本 JSON(圖片以 @imgN 佔位符表示)。', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'apply_script', description: '修改腳本並立即更新畫面:settings 淺合併、people 整組取代、messages 整列取代;三個欄位都可省略,只給要改的。', parameters: { type: 'object', properties: { settings: { type: 'object', description: '只放要改的欄位' }, people: { type: 'array', items: { type: 'object' } }, messages: { type: 'array', items: { type: 'object' } } }, additionalProperties: false } },
  { name: 'append_messages', description: '在對話尾端加入訊息,畫面立即更新。', parameters: { type: 'object', properties: { messages: { type: 'array', items: { type: 'object' } } }, required: ['messages'], additionalProperties: false } },
  { name: 'export_png', description: '把目前畫面匯出成 PNG(會觸發下載)。只在使用者明確要求匯出時使用。', parameters: { type: 'object', properties: {}, additionalProperties: false } },
];
function sanitizeMessages(list) {
  return rehydrate(list).filter((m) => m && typeof m === 'object' && typeof m.type === 'string');
}
function fixRefs() { // left 訊息的 personId 必須存在;沒人就補一位
  if (!state.people.length) state.people.push({ id: 'p1', name: '朋友', avatar: null });
  const ids = new Set(state.people.map((p) => p.id));
  for (const m of state.messages) if (m.type === 'msg' && m.side === 'left' && !ids.has(m.personId)) m.personId = state.people[0].id;
}
async function execTool(name, args) {
  if (name === 'get_script') return JSON.stringify(strip(scriptOf()));
  if (name === 'apply_script') {
    if (args.settings && typeof args.settings === 'object' && !Array.isArray(args.settings)) Object.assign(state.settings, rehydrate(args.settings));
    if (Array.isArray(args.people)) state.people = rehydrate(args.people).filter((p) => p && p.id).map((p) => ({ id: String(p.id), name: String(p.name ?? '朋友'), avatar: typeof p.avatar === 'string' && p.avatar.startsWith('data:') ? p.avatar : null }));
    if (Array.isArray(args.messages)) state.messages = sanitizeMessages(args.messages);
    fixRefs(); save(); render();
    return JSON.stringify({ ok: true, people: state.people.length, messages: state.messages.length });
  }
  if (name === 'append_messages') {
    if (!Array.isArray(args.messages)) throw new Error('messages 必須是陣列');
    state.messages.push(...sanitizeMessages(args.messages));
    fixRefs(); save(); render();
    return JSON.stringify({ ok: true, messages: state.messages.length });
  }
  if (name === 'export_png') { $('#export-png').click(); return JSON.stringify({ ok: true }); }
  throw new Error('未知工具:' + name);
}

// ── Agent 迴圈 ──
const SYSTEM = `你是「LINE 對話製造機」網頁內建的 AI 助手,幫創作者製作 LINE 風格的示意對話截圖。
整個畫面由一份腳本 JSON 驅動:{ settings, people, messages }。你用工具讀取與修改這份腳本,畫面立即更新。

schema 重點:
- settings:title(聊天室名稱)、members(0=不顯示)、bg(背景色)、mode("group"|"dm")、theme("light"|"dark")、clock(狀態列時間)、frameLevel("phone"|"screen"|"chat")、watermark、height("auto"|"fixed")、heightPx、draft(輸入框未送出文字)、announceOn/announce(置頂公告)。只改需要的欄位。
- people:[{id,name,avatar}],avatar 是圖片(@imgN 佔位符或 null=灰底圓)。
- messages 依序渲染:
  {"type":"date","text":"7月15日 (三)"} 日期分隔
  {"type":"skip","text":"⋯⋯(略)⋯⋯"} 省略分隔
  {"type":"msg","side":"left","personId":"p1","text":"...","time":"下午3:42","read":"","quote":null} 他人訊息
  {"type":"msg","side":"right","text":"...","time":"下午4:06","read":"已讀"} 自己(綠泡泡),不需 personId;群組的 read 可寫「已讀 8」
  選填 quote:{name,text}=引用回覆;react:["😆"]=表情回應列
  kind:"image"|"sticker"(配 img 欄位)、"voice"(dur:"0:12")、"file"(fname,fsize);kind 省略=文字
- 時間照台灣 LINE 慣例如「下午4:06」,前後訊息時間要合理遞增。連續同 personId 的 left 訊息會自動省略頭像暱稱。

規則:
- 一律使用繁體中文(zh-TW)回覆。
- 收到任務直接用工具完成,不要反問、不要只給建議或範例;改完用一句話回報結果。
- 對話內容要自然口語像真人閒聊,每個人物講話風格一致;適度用貼圖、已讀、時間差說故事。
- @imgN 代表既有圖片:要沿用就原樣保留;不可發明不存在的 @imgN;新的 image/sticker 訊息 img 給 null(顯示佔位圖)。
- 僅供創作示意(部落格配圖、教學、行銷素材);拒絕製作用於詐騙、毀謗、偽造證據的內容。`;

let aborter = null;
let aiSnapshot = null;

async function chat(msgs, force) {
  const c = cfg();
  const res = await fetch(c.base.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    signal: aborter.signal,
    headers: { 'content-type': 'application/json', ...(c.key ? { authorization: 'Bearer ' + c.key } : {}) },
    body: JSON.stringify({ model: c.model, messages: msgs, tools: TOOL_DEFS.map((t) => ({ type: 'function', function: t })), tool_choice: force ? 'required' : 'auto' }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d.error && d.error.message) || d.message || 'HTTP ' + res.status);
  const m = d.choices && d.choices[0] && d.choices[0].message;
  if (!m) throw new Error('模型沒有回傳訊息。');
  return m;
}

async function runAgent(prompt) {
  imgRegistry = [];
  const before = structuredClone(scriptOf());
  aborter = new AbortController();
  let mutated = false, usedTool = false, force = true;
  const msgs = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: '目前腳本 JSON:\n' + JSON.stringify(strip(scriptOf())) + '\n\n使用者任務:' + prompt },
  ];
  try {
    for (let step = 1; step <= 10; step++) {
      const m = await chat(msgs, force);
      force = false;
      msgs.push(m);
      const calls = Array.isArray(m.tool_calls) ? m.tool_calls : [];
      if (!calls.length) {
        const text = (typeof m.content === 'string' ? m.content : '').trim();
        if (!usedTool && step < 10) { // 反偷懶:只回文字沒動手,踹回去(參考 zerotype)
          log('模型只回了文字,要求改用工具執行', 'warn');
          msgs.push({ role: 'user', content: '不要只回覆文字或計畫,現在立刻呼叫工具完成任務。' });
          force = true;
          continue;
        }
        log(text || '已完成。', 'done');
        return;
      }
      for (const call of calls) {
        const name = call.function && call.function.name;
        let args = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch (e) {}
        log('工具:' + name);
        let out;
        try {
          out = await execTool(name, args);
          usedTool = true;
          if (name === 'apply_script' || name === 'append_messages') mutated = true;
        } catch (e) { out = JSON.stringify({ ok: false, error: e.message }); }
        msgs.push({ role: 'tool', tool_call_id: call.id, name, content: out });
      }
    }
    log('已達迴圈上限(10),停在目前結果。', 'warn');
  } finally {
    if (mutated) { aiSnapshot = before; $('#ai-undo').hidden = false; }
    aborter = null;
  }
}

// ── 面板 UI ──
function log(text, cls) {
  const box = $('#ai-log');
  const row = document.createElement('div');
  if (cls) row.className = cls;
  row.textContent = text;
  box.appendChild(row);
  while (box.children.length > 60) box.firstChild.remove();
  box.scrollTop = box.scrollHeight;
}
function needsKey(c) { return !PROVIDERS[c.provider].keyless && !c.key; }
function updateGate() {
  const c = cfg();
  const offline = !navigator.onLine;
  $('#ai-run').disabled = offline || needsKey(c) || !c.model;
  $('#ai-status').textContent = offline ? '離線中:AI 需要網路(其餘功能照常離線可用)。'
    : needsKey(c) ? '先在下方填 API Key(只存這台裝置,不會進草稿或分享連結)。'
    : !c.model ? '先在下方填 Model 名稱。' : '';
}
function fillCfgForm() {
  const c = cfg();
  const sel = $('#ai-provider');
  if (!sel.options.length) for (const [id, p] of Object.entries(PROVIDERS)) { const o = document.createElement('option'); o.value = id; o.textContent = p.label; sel.appendChild(o); }
  sel.value = c.provider;
  $('#ai-base').value = c.base || '';
  $('#ai-model').value = c.model || '';
  $('#ai-key').value = c.key || '';
  updateGate();
}
function setBusy(on) {
  $('#ai-run').disabled = on;
  $('#ai-stop').hidden = !on;
  if (!on) updateGate();
}

$('#ai-provider').addEventListener('change', (e) => {
  const p = PROVIDERS[e.target.value];
  saveCfg({ ...cfg(), provider: e.target.value, base: p.base, model: p.model });
  fillCfgForm();
});
for (const [id, key] of [['#ai-base', 'base'], ['#ai-model', 'model'], ['#ai-key', 'key']]) {
  $(id).addEventListener('input', (e) => { saveCfg({ ...cfg(), [key]: e.target.value.trim() }); updateGate(); });
}
$('#ai-run').addEventListener('click', async () => {
  const prompt = $('#ai-prompt').value.trim();
  if (!prompt) { $('#ai-prompt').focus(); return; }
  setBusy(true);
  log('任務:' + prompt, 'prompt');
  try { await runAgent(prompt); }
  catch (e) { log(e.name === 'AbortError' ? '已停止。' : '失敗:' + e.message, 'err'); }
  setBusy(false);
});
$('#ai-stop').addEventListener('click', () => { if (aborter) aborter.abort(); });
$('#ai-undo').addEventListener('click', () => {
  if (!aiSnapshot) return;
  state.settings = aiSnapshot.settings; state.people = aiSnapshot.people; state.messages = aiSnapshot.messages;
  aiSnapshot = null; $('#ai-undo').hidden = true;
  save(); render(); toast('已還原到 AI 修改前');
});
$('#ai-prompt').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#ai-run').click(); });
window.addEventListener('online', updateGate);
window.addEventListener('offline', updateGate);
fillCfgForm();

// ── WebMCP:同一組工具註冊給頁面的 modelContext,讓 ZeroType Agent 等外部 agent 直接聰明操作 ──
try {
  const mc = navigator.modelContext;
  if (mc) {
    const tools = TOOL_DEFS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.parameters,
      annotations: t.name === 'get_script' ? { readOnlyHint: true } : {},
      execute: async (args) => ({ content: [{ type: 'text', text: await execTool(t.name, typeof args === 'string' ? JSON.parse(args || '{}') : (args || {})) }] }),
    }));
    if (typeof mc.provideContext === 'function') mc.provideContext({ tools });
    else if (typeof mc.registerTool === 'function') for (const t of tools) mc.registerTool(t);
  }
} catch (e) { console.warn('WebMCP 註冊失敗(不影響內建 AI)', e); }

})();
