/* LINE 對話製造機 — 單檔 vanilla JS,狀態=一份 JSON,人與 AI 都用它 */
'use strict';

const DEMO = {
  settings: { title: 'C# 讀書會', members: 143, bg: '#7d9bc1', frame: true, watermark: true, clock: '16:08' },
  people: [
    { id: 'p1', name: '中年攻城屍', avatar: null },
    { id: 'p2', name: '小白++', avatar: null },
  ],
  messages: [
    { type: 'date', text: '7月15日 (三)' },
    { type: 'msg', side: 'left', personId: 'p1', text: '現在有AI 是有點想做side project 只是不知道要做什麼', time: '下午3:42', read: '', quote: null },
    { type: 'skip', text: '⋯⋯大家熱烈討論(略)⋯⋯' },
    { type: 'msg', side: 'right', text: '做一個許願池發社群上給大家許願', time: '下午4:06', read: '已讀 8', quote: { name: '中年攻城屍', text: '現在有AI 是有點想做side project…' } },
    { type: 'msg', side: 'left', personId: 'p2', text: '欸 好耶', time: '下午4:06', read: '', quote: null },
  ],
};

let state = load();
let avatarTarget = null; // personId 等待換頭像

function load() {
  try {
    const h = location.hash.match(/^#s=(.+)$/);
    if (h) { const s = JSON.parse(decodeURIComponent(escape(atob(h[1].replace(/-/g, '+').replace(/_/g, '/'))))); history.replaceState(null, '', location.pathname); save(s); return s; }
  } catch (e) { console.warn('hash 匯入失敗', e); }
  try { const s = JSON.parse(localStorage.getItem('lcm-state')); if (s && s.messages) return s; } catch (e) {}
  return JSON.parse(JSON.stringify(DEMO));
}
function save(s) { localStorage.setItem('lcm-state', JSON.stringify(s || state)); }

const $ = (sel) => document.querySelector(sel);
const chatEl = $('#chat');

function personOf(m) { return state.people.find((p) => p.id === m.personId) || { id: null, name: '???', avatar: null }; }

function render() {
  // 設定面板同步
  $('#set-title').value = state.settings.title;
  $('#set-members').value = state.settings.members;
  $('#set-bg').value = state.settings.bg;
  $('#set-frame').checked = !!state.settings.frame;
  $('#set-watermark').checked = !!state.settings.watermark;
  $('#set-clock').value = state.settings.clock;
  // 外框
  $('#phone').classList.toggle('framed', !!state.settings.frame);
  $('#clock').textContent = state.settings.clock || '16:08';
  $('#chat-title').textContent = state.settings.title;
  $('#chat-members').textContent = state.settings.members > 0 ? `(${state.settings.members})` : '';
  $('#chat-members').style.display = state.settings.members > 0 ? '' : 'none';
  chatEl.style.background = state.settings.bg;

  chatEl.innerHTML = '';
  state.messages.forEach((m, i) => {
    let node;
    if (m.type === 'skip' || m.type === 'date') {
      node = el('div', m.type);
      const span = el('span'); span.contentEditable = true; span.textContent = m.text;
      span.addEventListener('input', () => { m.text = span.textContent; save(); });
      node.appendChild(span);
    } else if (m.side === 'right') {
      node = el('div', 'msg me');
      if (m.read || m.time) {
        const meta = el('span', 'read'); meta.contentEditable = true; meta.textContent = [m.read, m.time].filter(Boolean).join('\n');
        meta.style.display = 'inline-block'; meta.style.whiteSpace = 'pre'; meta.style.textAlign = 'right';
        meta.addEventListener('input', () => { const t = meta.innerText.split('\n'); m.read = t.length > 1 ? t[0] : ''; m.time = t[t.length - 1]; save(); });
        node.appendChild(meta); node.appendChild(document.createTextNode(' '));
      }
      node.appendChild(bubble(m));
    } else {
      const prev = state.messages[i - 1];
      const cont = prev && prev.type === 'msg' && prev.side === 'left' && prev.personId === m.personId;
      node = el('div', cont ? 'msg cont' : 'msg');
      if (!cont) {
        const p = personOf(m);
        const av = el('img', 'av'); av.alt = '';
        if (p.avatar) av.src = p.avatar; else av.removeAttribute('src');
        av.title = '點擊換頭像'; av.addEventListener('click', () => { avatarTarget = p.id; $('#file-avatar').click(); });
        node.appendChild(av);
      }
      const body = el('div', 'mbody');
      if (!cont) {
        const p = personOf(m);
        const who = el('span', 'who'); who.contentEditable = true; who.textContent = p.name;
        who.addEventListener('input', () => { p.name = who.textContent; save(); });
        body.appendChild(who);
      }
      body.appendChild(bubble(m));
      const time = el('span', 'time'); time.contentEditable = true; time.textContent = m.time || '';
      time.addEventListener('input', () => { m.time = time.textContent; save(); });
      body.appendChild(time);
      node.appendChild(body);
    }
    node.appendChild(controls(m, i));
    chatEl.appendChild(node);
  });
}

function bubble(m) {
  const p = el('p'); p.contentEditable = true;
  if (m.quote) {
    const q = el('span', 'q'); q.contentEditable = false;
    const nm = el('strong'); nm.contentEditable = true; nm.textContent = m.quote.name;
    nm.addEventListener('input', () => { m.quote.name = nm.textContent; save(); });
    const qt = el('span'); qt.contentEditable = true; qt.textContent = m.quote.text;
    qt.addEventListener('input', () => { m.quote.text = qt.textContent; save(); });
    q.appendChild(nm); q.appendChild(qt); p.appendChild(q);
  }
  const txt = el('span'); txt.contentEditable = true; txt.textContent = m.text;
  txt.addEventListener('input', () => { m.text = txt.textContent; save(); });
  p.contentEditable = false;
  p.appendChild(txt);
  return p;
}

function controls(m, i) {
  const c = el('div', 'ctl');
  const btn = (label, title, fn) => { const b = el('button'); b.textContent = label; b.title = title; b.addEventListener('click', fn); c.appendChild(b); };
  btn('↑', '上移', () => { if (i > 0) { state.messages.splice(i - 1, 0, state.messages.splice(i, 1)[0]); save(); render(); } });
  btn('↓', '下移', () => { if (i < state.messages.length - 1) { state.messages.splice(i + 1, 0, state.messages.splice(i, 1)[0]); save(); render(); } });
  if (m.type === 'msg') {
    btn('⇄', '換邊', () => { if (m.side === 'left') { m.side = 'right'; m.read = m.read || ''; } else { m.side = 'left'; m.personId = m.personId || state.people[0].id; } save(); render(); });
    btn('引', '加/移除引用回覆', () => { m.quote = m.quote ? null : { name: '某人', text: '被引用的訊息' }; save(); render(); });
    if (m.side === 'left') btn('換人', '換發話者', () => { const idx = state.people.findIndex((p) => p.id === m.personId); m.personId = state.people[(idx + 1) % state.people.length].id; save(); render(); });
  }
  btn('✕', '刪除', () => { state.messages.splice(i, 1); save(); render(); });
  return c;
}

function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }

// ── 設定面板 ──
$('#set-title').addEventListener('input', (e) => { state.settings.title = e.target.value; save(); render(); });
$('#set-members').addEventListener('input', (e) => { state.settings.members = +e.target.value || 0; save(); render(); });
$('#set-bg').addEventListener('input', (e) => { state.settings.bg = e.target.value; save(); render(); });
$('#set-frame').addEventListener('change', (e) => { state.settings.frame = e.target.checked; save(); render(); });
$('#set-watermark').addEventListener('change', (e) => { state.settings.watermark = e.target.checked; save(); });
$('#set-clock').addEventListener('input', (e) => { state.settings.clock = e.target.value; save(); render(); });

// ── 新增 ──
$('#add-left').addEventListener('click', () => {
  let pid = state.people[0] && state.people[0].id;
  for (let i = state.messages.length - 1; i >= 0; i--) { const m = state.messages[i]; if (m.type === 'msg' && m.side === 'left') { pid = m.personId; break; } }
  if (!pid) { const p = { id: 'p' + Date.now(), name: '新朋友', avatar: null }; state.people.push(p); pid = p.id; }
  state.messages.push({ type: 'msg', side: 'left', personId: pid, text: '點我改文字', time: '下午4:00', read: '', quote: null }); save(); render();
});
$('#add-right').addEventListener('click', () => { state.messages.push({ type: 'msg', side: 'right', text: '點我改文字', time: '下午4:00', read: '', quote: null }); save(); render(); });
$('#add-skip').addEventListener('click', () => { state.messages.push({ type: 'skip', text: '⋯⋯(略)⋯⋯' }); save(); render(); });
$('#add-date').addEventListener('click', () => { state.messages.push({ type: 'date', text: '7月15日 (三)' }); save(); render(); });

// ── 頭像上傳:縮到 96px dataURL,只進 localStorage ──
$('#file-avatar').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f || !avatarTarget) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const s = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
    const p = state.people.find((x) => x.id === avatarTarget);
    if (p) { p.avatar = c.toDataURL('image/png'); save(); render(); }
  };
  img.src = URL.createObjectURL(f);
  e.target.value = '';
});

// ── 匯出 PNG(剝掉編輯痕跡+可選浮水印) ──
$('#export-png').addEventListener('click', async () => {
  const src = $('#phone');
  const canvas = await html2canvas(src, {
    scale: 2, backgroundColor: null, logging: false,
    onclone: (doc) => {
      doc.querySelectorAll('.ctl').forEach((n) => n.remove());
      doc.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    },
  });
  if (state.settings.watermark) {
    const ctx = canvas.getContext('2d');
    ctx.font = `${Math.round(canvas.width / 30)}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'right';
    ctx.fillText('示意圖', canvas.width - 14, canvas.height - 14);
  }
  const a = document.createElement('a');
  a.download = 'line-chat.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
});

// ── 腳本 JSON 進出 ──
$('#export-json').addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = 'line-chat-script.json';
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  a.click();
});
$('#import-json').addEventListener('click', () => $('#file-json').click());
$('#file-json').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { const s = JSON.parse(await f.text()); if (!s.messages) throw new Error('缺 messages'); state = s; save(); render(); }
  catch (err) { alert('JSON 讀不進來:' + err.message); }
  e.target.value = '';
});
$('#reset').addEventListener('click', () => { if (confirm('清空目前對話,回到範例?')) { state = JSON.parse(JSON.stringify(DEMO)); save(); render(); } });

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
