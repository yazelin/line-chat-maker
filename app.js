/* LINE 對話製造機 — 單檔 vanilla JS,狀態=一份 JSON,人與 AI 都用它 */
'use strict';

const DEMO = {
  settings: { title: 'C# Taiwan交流聚會', members: 1947, bg: '#7d9bc1', bgImage: null, frameLevel: 'phone', notch: 'island', radius: 32, buttons: true, homebar: true, watermark: true, clock: '16:08', signal: 4, wifi: true, battery: 87, battText: true, glow: 0, glowColor: '#96b9ff', darkUI: false, backlight: 0, backColor: '#06c755', height: 'fixed', heightPx: 768, mode: 'group', draft: '', announceOn: false, embedAutoplay: false, announce: '下次聚會 7/26(六)14:00 台北;新朋友先看記事本' },
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
let bgTarget = false;   // 等待上傳背景圖
let imgTarget = null;   // 等待換圖的 image 訊息 index

function load() {
  try {
    const h = location.hash.match(/^#s=(.+)$/);
    if (h) { const s = JSON.parse(decodeURIComponent(escape(atob(h[1].replace(/-/g, '+').replace(/_/g, '/'))))); history.replaceState(null, '', location.pathname); save(s); return s; }
  } catch (e) { console.warn('hash 匯入失敗', e); }
  try {
    const s = JSON.parse(localStorage.getItem('lcm-state'));
    if (s && s.messages) {
      if (s.settings.frameLevel === undefined) s.settings.frameLevel = s.settings.frame === false ? 'chat' : 'phone';
      const d = DEMO.settings;
      for (const k of Object.keys(d)) if (s.settings[k] === undefined) s.settings[k] = d[k];
      return s;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEMO));
}
function save(s) { localStorage.setItem('lcm-state', JSON.stringify(s || state)); }

const $ = (sel) => document.querySelector(sel);
const chatEl = $('#chat');

function glowShadow(st) {
  if (!(st.glow > 0)) return '';
  const hx = (st.glowColor || '#96b9ff').replace('#', '');
  const r = parseInt(hx.slice(0, 2), 16), g = parseInt(hx.slice(2, 4), 16), b = parseInt(hx.slice(4, 6), 16);
  return `0 0 ${st.glow}px rgba(${r},${g},${b},${Math.min(0.9, st.glow / 100)})`;
}

function personOf(m) { return state.people.find((p) => p.id === m.personId) || { id: null, name: '???', avatar: null }; }

function render() {
  const st = state.settings;
  $('#set-title').value = st.title;
  $('#set-members').value = st.members;
  $('#set-bg').value = st.bg;
  $('#set-frame-level').value = st.frameLevel;
  $('#set-notch').value = st.notch;
  $('#set-radius').value = st.radius; $('#radius-val').textContent = st.radius;
  $('#set-buttons').checked = !!st.buttons;
  $('#set-homebar').checked = !!st.homebar;
  $('#set-watermark').checked = !!st.watermark;
  $('#wm-preview').style.display = st.watermark ? '' : 'none';
  $('#set-clock').value = st.clock;
  $('#set-signal').value = st.signal; $('#signal-val').textContent = st.signal + '/4';
  $('#set-wifi').checked = !!st.wifi;
  $('#set-battery').value = st.battery; $('#battery-val').textContent = st.battery;
  $('#set-batttext').checked = !!st.battText;
  $('#set-glow').value = st.glow; $('#glow-val').textContent = st.glow;
  $('#set-glowcolor').value = st.glowColor || '#96b9ff';
  $('#set-darkui').checked = !!st.darkUI;
  $('#set-backlight').value = st.backlight || 0; $('#backlight-val').textContent = st.backlight || 0;
  $('#set-backcolor').value = st.backColor || '#06c755';
  const bl = $('#backlight');
  if (st.backlight > 0) {
    const hx = (st.backColor || '#06c755').replace('#', '');
    const r = parseInt(hx.slice(0, 2), 16), g = parseInt(hx.slice(2, 4), 16), b = parseInt(hx.slice(4, 6), 16);
    const a1 = (st.backlight / 100 * 0.85).toFixed(2), a2 = (st.backlight / 100 * 0.35).toFixed(2);
    bl.style.display = '';
    bl.style.background = `radial-gradient(ellipse 62% 58% at 50% 50%, rgba(${r},${g},${b},${a1}) 0%, rgba(${r},${g},${b},${a1}) 45%, rgba(139,92,246,${a2}) 66%, transparent 82%)`;
  } else { bl.style.display = 'none'; }
  document.body.classList.toggle('dark', !!st.darkUI);
  $('#set-height').value = st.height || 'auto';
  $('#set-heightpx').value = st.heightPx || 768;
  $('#lbl-heightpx').style.display = st.height === 'fixed' ? '' : 'none';
  $('#set-mode').value = st.mode || 'group';
  $('#grp-hw').style.display = st.frameLevel === 'phone' ? '' : 'none';
  $('#grp-sb').style.display = st.frameLevel === 'chat' ? 'none' : '';

  const phone = $('#phone');
  phone.className = 'phone level-' + st.frameLevel + (st.height === 'fixed' ? ' fixedh' : '');
  const screen = $('#phone .screen');
  screen.style.height = st.height === 'fixed' ? (st.heightPx || 768) + 'px' : '';
  if (st.frameLevel === 'phone') {
    screen.style.borderRadius = st.radius + 'px';
    phone.style.borderRadius = (st.radius + 8) + 'px';
    screen.style.boxShadow = glowShadow(st);
  } else {
    screen.style.borderRadius = '';
    phone.style.borderRadius = '';
    screen.style.boxShadow = glowShadow(st) || '0 8px 30px rgba(0,0,0,0.12)';
  }
  $('#notch').className = 'notch ' + st.notch;
  const sbPad = st.frameLevel === 'phone' ? Math.max(20, Math.round(st.radius * 0.62)) : 14;
  $('#phone .statusbar').style.padding = `0.35rem ${sbPad}px 0.1rem`;
  // 瀏海/動態島寬度動態夾住:不得壓到左時鐘或右圖示叢(實測寬度,含電量數字開關等變因)
  if (st.frameLevel === 'phone' && (st.notch === 'notch' || st.notch === 'island')) {
    const scrW = $('#phone .screen').offsetWidth;
    const side = Math.max($('#clock').offsetWidth, $('#phone .sicons').offsetWidth);
    const maxW = scrW - 2 * (sbPad + side + 6);
    const base = st.notch === 'notch' ? 132 : 78;
    $('#notch').style.width = Math.max(56, Math.min(base, maxW)) + 'px';
  } else {
    $('#notch').style.width = '';
  }
  document.querySelectorAll('.sbtn').forEach((n) => { n.style.display = st.frameLevel === 'phone' && st.buttons ? '' : 'none'; });
  $('#phone .homebar').style.display = st.frameLevel !== 'chat' && st.homebar ? '' : 'none';

  // 狀態列
  $('#clock').textContent = st.clock || '16:08';
  document.querySelectorAll('#sig rect').forEach((r, i) => { r.setAttribute('opacity', i < st.signal ? '1' : '0.3'); });
  $('#wifi-ic').style.display = st.wifi ? '' : 'none';
  $('#batt-fill').setAttribute('width', String(Math.max(1, Math.round(17 * st.battery / 100))));
  $('#batt-text').textContent = st.battery + '%';
  $('#batt-text').style.display = st.battText ? '' : 'none';
  if ($('#draft').textContent !== (st.draft || '')) $('#draft').textContent = st.draft || '';
  $('#set-announce').checked = !!st.announceOn;
  $('#set-embplay').checked = !!st.embedAutoplay;
  $('#announce').style.display = st.announceOn && st.frameLevel !== 'chat' ? '' : 'none';
  if ($('#announce-text').textContent !== (st.announce || '')) $('#announce-text').textContent = st.announce || '';

  const dm = st.mode === 'dm';
  $('#chat-title').textContent = st.title;
  $('#chat-members').textContent = !dm && st.members > 0 ? `(${st.members})` : '';
  $('#chat-members').style.display = !dm && st.members > 0 ? '' : 'none';
  chatEl.style.background = st.bg;
  chatEl.style.backgroundImage = st.bgImage ? `url(${st.bgImage})` : '';
  chatEl.style.backgroundSize = 'cover';
  chatEl.style.backgroundPosition = 'center';

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
      node.appendChild(content(m, i));
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
      if (!cont && state.settings.mode !== 'dm') {
        const p = personOf(m);
        const who = el('span', 'who'); who.contentEditable = true; who.textContent = p.name;
        who.addEventListener('input', () => { p.name = who.textContent; save(); });
        body.appendChild(who);
      }
      body.appendChild(content(m, i));
      const time = el('span', 'time'); time.contentEditable = true; time.textContent = m.time || '';
      time.addEventListener('input', () => { m.time = time.textContent; save(); });
      body.appendChild(time);
      node.appendChild(body);
    }
    node.appendChild(controls(m, i));
    chatEl.appendChild(node);
  });
  if (state.settings.height === 'fixed') chatEl.scrollTop = chatEl.scrollHeight;
}

const PLAY_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const FILE_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#5b8def" aria-hidden="true"><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5L13 3.5z"/></svg>';

function content(m, i) {
  const kind = m.kind || 'text';
  if (kind === 'image' || kind === 'sticker') {
    const box = el('div', kind === 'image' ? 'imgmsg' : 'sticker');
    const img = document.createElement('img');
    img.src = m.img || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="#d8dde5"/><text x="100" y="80" text-anchor="middle" font-size="15" fill="#7a8091">點我上傳圖片</text></svg>');
    img.alt = '';
    box.title = '點擊換圖';
    box.addEventListener('click', () => { imgTarget = i; $('#file-avatar').click(); });
    box.appendChild(img);
    return box;
  }
  if (kind === 'voice') {
    const b = el('div', 'bubble');
    const v = el('div', 'voice');
    v.innerHTML = PLAY_SVG + '<span class="vbars">' + [8, 12, 6, 14, 9, 12, 5, 10].map((hgt) => `<i style="height:${hgt}px"></i>`).join('') + '</span>';
    const dur = el('span'); dur.contentEditable = true; dur.textContent = m.dur || '0:12';
    dur.addEventListener('input', () => { m.dur = dur.textContent; save(); });
    v.appendChild(dur);
    b.appendChild(v);
    return b;
  }
  if (kind === 'file') {
    const b = el('div', 'bubble');
    const f = el('div', 'file');
    f.innerHTML = FILE_SVG;
    const meta = el('span', 'fmeta');
    const fn = el('span', 'fname'); fn.contentEditable = true; fn.textContent = m.fname || '報告.pdf';
    fn.addEventListener('input', () => { m.fname = fn.textContent; save(); });
    const fz = el('span', 'fsize'); fz.contentEditable = true; fz.textContent = m.fsize || '2.4 MB';
    fz.addEventListener('input', () => { m.fsize = fz.textContent; save(); });
    meta.appendChild(fn); meta.appendChild(fz);
    f.appendChild(meta);
    b.appendChild(f);
    return b;
  }
  return bubble(m);
}

function bubble(m) {
  const p = el('div', 'bubble');
  if (m.quote) {
    const q = el('div', 'q');
    const nm = el('strong'); const nmt = el('span'); nmt.contentEditable = true; nmt.textContent = m.quote.name;
    nmt.addEventListener('input', () => { m.quote.name = nmt.textContent; save(); }); nm.appendChild(nmt);
    const qt = el('span'); qt.contentEditable = true; qt.textContent = m.quote.text;
    qt.addEventListener('input', () => { m.quote.text = qt.textContent; save(); });
    q.appendChild(nm); q.appendChild(qt); p.appendChild(q);
  }
  const txt = el('div', 'btxt'); const ts = el('span'); ts.contentEditable = true; ts.textContent = m.text;
  ts.addEventListener('input', () => { m.text = ts.textContent; save(); }); txt.appendChild(ts);
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
    if ((m.kind || 'text') === 'text') btn('引', '加/移除引用回覆', () => { m.quote = m.quote ? null : { name: '某人', text: '被引用的訊息' }; save(); render(); });
    if (m.side === 'left') {
      btn('換人', '換成下一位既有人物', () => { const idx = state.people.findIndex((p) => p.id === m.personId); m.personId = state.people[(idx + 1) % state.people.length].id; save(); render(); });
      btn('新人', '建立新人物並指給這則訊息', () => { const p = { id: 'p' + Date.now(), name: '新朋友(點我改名)', avatar: null }; state.people.push(p); m.personId = p.id; save(); render(); });
    }
  }
  btn('✕', '刪除', () => { state.messages.splice(i, 1); save(); render(); });
  return c;
}

function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }

// ── 設定面板 ──
$('#set-title').addEventListener('input', (e) => { state.settings.title = e.target.value; save(); render(); });
$('#set-members').addEventListener('input', (e) => { state.settings.members = +e.target.value || 0; save(); render(); });
$('#set-bg').addEventListener('input', (e) => { state.settings.bg = e.target.value; save(); render(); });
$('#set-frame-level').addEventListener('change', (e) => { state.settings.frameLevel = e.target.value; save(); render(); });
$('#set-notch').addEventListener('change', (e) => { state.settings.notch = e.target.value; save(); render(); });
$('#set-radius').addEventListener('input', (e) => { state.settings.radius = +e.target.value; save(); render(); });
$('#set-buttons').addEventListener('change', (e) => { state.settings.buttons = e.target.checked; save(); render(); });
$('#set-homebar').addEventListener('change', (e) => { state.settings.homebar = e.target.checked; save(); render(); });
$('#set-signal').addEventListener('input', (e) => { state.settings.signal = +e.target.value; save(); render(); });
$('#set-wifi').addEventListener('change', (e) => { state.settings.wifi = e.target.checked; save(); render(); });
$('#set-battery').addEventListener('input', (e) => { state.settings.battery = +e.target.value; save(); render(); });
$('#set-batttext').addEventListener('change', (e) => { state.settings.battText = e.target.checked; save(); render(); });
$('#set-glow').addEventListener('input', (e) => { state.settings.glow = +e.target.value; save(); render(); });
$('#set-glowcolor').addEventListener('input', (e) => { state.settings.glowColor = e.target.value; save(); render(); });
$('#set-darkui').addEventListener('change', (e) => { state.settings.darkUI = e.target.checked; save(); render(); });
$('#set-backlight').addEventListener('input', (e) => { state.settings.backlight = +e.target.value; save(); render(); });
$('#set-backcolor').addEventListener('input', (e) => { state.settings.backColor = e.target.value; save(); render(); });
$('#draft').addEventListener('input', () => { state.settings.draft = $('#draft').textContent; save(); });
$('#set-announce').addEventListener('change', (e) => { state.settings.announceOn = e.target.checked; save(); render(); });
$('#set-embplay').addEventListener('change', (e) => { state.settings.embedAutoplay = e.target.checked; save(); });
$('#announce-text').addEventListener('input', () => { state.settings.announce = $('#announce-text').textContent; save(); });
$('#set-bgimg').addEventListener('click', () => { bgTarget = true; $('#file-avatar').click(); });
$('#clear-bgimg').addEventListener('click', () => { state.settings.bgImage = null; save(); render(); });
$('#set-watermark').addEventListener('change', (e) => { state.settings.watermark = e.target.checked; save(); render(); });
$('#set-clock').addEventListener('input', (e) => { state.settings.clock = e.target.value; save(); render(); });
$('#set-height').addEventListener('change', (e) => { state.settings.height = e.target.value; save(); render(); });
$('#set-mode').addEventListener('change', (e) => { state.settings.mode = e.target.value; save(); render(); });
$('#set-heightpx').addEventListener('input', (e) => { state.settings.heightPx = Math.max(300, +e.target.value || 768); save(); render(); });

// ── 新增 ──
function addLeft() {
  let pid = state.people[0] && state.people[0].id;
  for (let i = state.messages.length - 1; i >= 0; i--) { const m = state.messages[i]; if (m.type === 'msg' && m.side === 'left') { pid = m.personId; break; } }
  if (!pid) { const p = { id: 'p' + Date.now(), name: '新朋友', avatar: null }; state.people.push(p); pid = p.id; }
  state.messages.push({ type: 'msg', side: 'left', personId: pid, text: '點我改文字', time: '下午4:00', read: '', quote: null }); save(); render();
}
function lastLeftPid() { for (let i = state.messages.length - 1; i >= 0; i--) { const m = state.messages[i]; if (m.type === 'msg' && m.side === 'left') return m.personId; } return state.people[0] && state.people[0].id; }

// ── 圖片上傳(頭像 96 / 背景 800 / 圖片訊息 480 / 貼圖 320 保留透明) ──
$('#file-avatar').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    if (bgTarget) {
      const sc = Math.min(1, 800 / img.width);
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      state.settings.bgImage = c.toDataURL('image/jpeg', 0.85);
      bgTarget = false;
    } else if (imgTarget !== null) {
      const m = state.messages[imgTarget];
      const maxW = m && m.kind === 'sticker' ? 320 : 480;
      const sc = Math.min(1, maxW / img.width);
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      if (m) m.img = c.toDataURL('image/png');
      imgTarget = null;
    } else if (avatarTarget) {
      c.width = c.height = 96;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
      const p = state.people.find((x) => x.id === avatarTarget);
      if (p) p.avatar = c.toDataURL('image/png');
      avatarTarget = null;
    }
    save(); render();
  };
  img.src = URL.createObjectURL(f);
  e.target.value = '';
});

// ── 匯出 PNG:SVG foreignObject 真渲染(與預覽像素一致);失敗時 html2canvas 備援 ──
function cleanClone() {
  const clone = $('#phone-wrap').cloneNode(true);
  const wmp = clone.querySelector('.wm-preview'); if (wmp) wmp.remove();
  clone.querySelectorAll('.ctl, .chat-addbar').forEach((n) => n.remove());
  clone.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
  return clone;
}

async function renderCanvasNative() {
  const src = $('#phone-wrap');
  const w = src.offsetWidth, h = src.offsetHeight, scale = 2;
  const pad = state.settings.backlight > 0 ? 120 : 30;
  const css = await (await fetch('style.css')).text();
  const wrapEl = document.createElement('div');
  wrapEl.setAttribute('style', `--accent:#06c755;--fg:#1c1917;--muted:#6b6560;--border:#e5e2de;padding:${pad}px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC','Microsoft JhengHei',sans-serif;line-height:1.6;color:#1c1917;`);
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  wrapEl.appendChild(styleEl);
  wrapEl.appendChild(cleanClone());
  const xhtml = new XMLSerializer().serializeToString(wrapEl);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${(w + pad * 2) * scale}" height="${(h + pad * 2) * scale}" viewBox="0 0 ${w + pad * 2} ${h + pad * 2}"><foreignObject width="${w + pad * 2}" height="${h + pad * 2}">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = (w + pad * 2) * scale; canvas.height = (h + pad * 2) * scale;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.toDataURL('image/png'); // 提早觸發 taint 檢查,污染會在這裡丟例外
  return canvas;
}

async function renderCanvasFallback() {
  return html2canvas($('#phone-wrap'), {
    scale: 2, backgroundColor: null, logging: false,
    onclone: (doc) => {
      doc.querySelectorAll('.ctl, .chat-addbar').forEach((n) => n.remove());
      doc.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    },
  });
}

$('#export-png').addEventListener('click', async () => {
  let canvas;
  try { canvas = await renderCanvasNative(); }
  catch (e) { console.warn('foreignObject 匯出失敗,改用 html2canvas', e); canvas = await renderCanvasFallback(); }
  if (state.settings.watermark) {
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const pad = Math.round(canvas.width / 20);
    ctx.font = `${Math.round(canvas.width / 30)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('示意圖', canvas.width - pad + 2, canvas.height - pad + 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText('示意圖', canvas.width - pad, canvas.height - pad);
  }
  const a = document.createElement('a');
  a.download = 'line-chat.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
});

// ── 匯出 HTML:可內嵌片段(scoped CSS,貼進任何頁面即用) ──
$('#export-html').addEventListener('click', async () => {
  const css = await (await fetch('style.css')).text();
  const keep = /^(\.phone|\.screen|\.statusbar|\.linehead|\.inputbar|\.homebar|\.notch|\.line-chat|\.announce)/;
  const scoped = css.split('}').map((chunk) => {
    const i = chunk.indexOf('{');
    if (i < 0) return '';
    const sels = chunk.slice(0, i).trim().split(',').map((s) => s.trim()).filter((s) => keep.test(s));
    if (!sels.length) return '';
    return sels.map((s) => '.lcm-embed ' + s).join(',') + '{' + chunk.slice(i + 1) + '}';
  }).filter(Boolean).join('\n');
  const clone = cleanClone();
  const wm = state.settings.watermark ? '<div style="text-align:right;font:12px/1.6 sans-serif;color:rgba(0,0,0,0.45)">示意圖</div>' : '';
  const reset = '.lcm-embed *{margin:0;padding:0;border:0;box-sizing:border-box;background:none;font:inherit;color:inherit;}';
  const autoplay = !!state.settings.embedAutoplay;
  const embJs = `<script>(function(){var s=document.currentScript,r=s.closest('.lcm-embed');s.remove();var c=r.querySelector('.line-chat');function bottom(){if(c)c.scrollTop=c.scrollHeight}bottom();${autoplay ? "var ms=[].slice.call(r.querySelectorAll('.line-chat>div'));var io=new IntersectionObserver(function(en){if(!en[0].isIntersecting)return;io.disconnect();ms.forEach(function(m){m.style.visibility='hidden'});var i=0;(function st(){if(i>=ms.length)return;var m=ms[i++];m.style.visibility='';m.style.animation='lcmIn .3s ease-out';bottom();setTimeout(st,650)})()},{threshold:0.4});io.observe(r);" : ''}})();<\/script>`;
  const html = `<!-- LINE 對話製造機產生的內嵌片段:整段貼進你的頁面即可顯示。僅供創作示意 https://yazelin.github.io/line-chat-maker/ -->\n<div class="lcm-embed" style="max-width:24rem;margin:1.5rem auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC','Microsoft JhengHei',sans-serif;line-height:1.6;">\n${clone.outerHTML}\n${wm}\n${embJs}\n</div>\n<style>\n${reset}\n${scoped}\n@keyframes lcmIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }\n</style>`;
  try {
    await navigator.clipboard.writeText(html);
    alert('嵌入碼已複製!貼進部落格、CMS 或任何網頁的 HTML 區塊即可顯示。');
  } catch (e) {
    const aEl = document.createElement('a');
    aEl.download = 'line-chat-embed.html';
    aEl.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    aEl.click();
  }
});

// ── 分享連結:短網址(Cloudflare Worker KV);失敗時退回 #s= 長連結 ──
const SHORTURL_API = 'https://shorturl.yazelinj303.workers.dev';
document.querySelector('#share-link').addEventListener('click', async () => {
  let url;
  try {
    const r = await fetch(SHORTURL_API + '/api/short-url', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app: 'line-chat-maker', state }),
    });
    const d = await r.json();
    if (!d.shortUrl) throw new Error(d.error || 'no shortUrl');
    url = d.shortUrl;
  } catch (e) {
    console.warn('短網址服務失敗,退回長連結', e);
    const toB64 = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    url = location.origin + location.pathname + '#s=' + toB64(JSON.stringify(state));
  }
  try { await navigator.clipboard.writeText(url); alert('分享連結已複製!對方打開就是這段對話(連結保存一年)。'); }
  catch (e) { prompt('手動複製這個連結:', url); }
});

// 短連結載入:?id=code → 向 worker 取回狀態
(async function importFromQuery() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return;
  try {
    const r = await fetch(SHORTURL_API + '/api/template/' + encodeURIComponent(id));
    const d = await r.json();
    if (d && d.state && Array.isArray(d.state.messages)) {
      state = d.state;
      const dset = DEMO.settings;
      for (const k of Object.keys(dset)) if (state.settings[k] === undefined) state.settings[k] = dset[k];
      history.replaceState(null, '', location.pathname);
      save(); render();
    }
  } catch (e) { console.warn('短連結載入失敗', e); }
})();

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

window.addEventListener('hashchange', () => { if (location.hash.startsWith('#s=')) location.reload(); });

async function playback() {
  const nodes = Array.from(chatEl.children);
  nodes.forEach((n) => { n.style.visibility = 'hidden'; n.classList.remove('appear'); });
  for (const n of nodes) {
    await new Promise((r) => setTimeout(r, 650));
    n.style.visibility = '';
    n.classList.add('appear');
  }
}

document.querySelectorAll('.tabs .tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tabs .tab').forEach((x) => x.classList.toggle('active', x === t));
  document.querySelectorAll('.pane').forEach((pn) => pn.classList.toggle('active', pn.id === 'pane-' + t.dataset.pane));
}));
// 聊天視窗內新增條
$('#preview-toggle').addEventListener('click', () => {
  const on = document.body.classList.toggle('previewing');
  $('#preview-toggle').textContent = on ? '回編輯' : '預覽';
});
$('#chat-addbar').addEventListener('click', (e) => {
  const kind = e.target.dataset && e.target.dataset.add;
  if (!kind) return;
  if (kind === 'play') { playback(); return; }
  if (kind === 'left') addLeft();
  else if (kind === 'right') state.messages.push({ type: 'msg', side: 'right', text: '點我改文字', time: '下午4:00', read: '', quote: null });
  else if (kind === 'skip') state.messages.push({ type: 'skip', text: '⋯⋯(略)⋯⋯' });
  else if (kind === 'date') state.messages.push({ type: 'date', text: '7月15日 (三)' });
  else if (kind === 'image' || kind === 'sticker') state.messages.push({ type: 'msg', kind, side: 'left', personId: lastLeftPid(), img: null, time: '下午4:00', read: '' });
  else if (kind === 'voice') state.messages.push({ type: 'msg', kind: 'voice', side: 'left', personId: lastLeftPid(), dur: '0:12', time: '下午4:00', read: '' });
  else if (kind === 'file') state.messages.push({ type: 'msg', kind: 'file', side: 'left', personId: lastLeftPid(), fname: '報告.pdf', fsize: '2.4 MB', time: '下午4:00', read: '' });
  save(); render();
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
