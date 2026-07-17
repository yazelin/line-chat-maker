/* 內建 AI 助手:工具=腳本 JSON 操作(參考 zerotype-agent 的迴圈設計:強制工具+反偷懶+迴圈上限)
   與 app.js 同為 classic script,直接共用全域的 state / save / render / toast。 */
'use strict';
(() => {

// ── 連線設定(只存 localStorage,絕不進 state:草稿與分享連結不能帶到 API key) ──
const PROVIDERS = {
  free: { label: '刷亞澤的信用卡(免費體驗,每日限量)', base: 'https://lcm-ai-proxy.yazelinj303.workers.dev', model: 'openai/gpt-oss-120b', keyless: true }, // 代理 worker 見 repo worker/;額度用完會引導填自己的 key
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b' }, // 2026-07 實測:工具呼叫最穩+繁中最乾淨(qwen3 會捏造 @imgN)
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-5-mini' },
  gemini: { label: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', writerModel: 'gemini-2.5-pro' }, // 編劇選 Gemini 帶 pro:創作力差一檔
  openrouter: { label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4.1-mini' },
  ollama: { label: 'Ollama(本機)', base: 'http://localhost:11434/v1', model: 'llama3.2', keyless: true },
  custom: { label: '自訂(OpenAI 相容)', base: '', model: '', keyless: true },
};
function cfg() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem('lcm-ai')) || {}; } catch (e) {}
  if (!PROVIDERS[c.provider]) c = { provider: 'free', base: PROVIDERS.free.base, model: PROVIDERS.free.model, key: '' }; // 新使用者預設=免費體驗,零設定即可玩
  return c;
}
function saveCfg(c) { try { localStorage.setItem('lcm-ai', JSON.stringify(c)); } catch (e) {} }
function writerCfg() { // 編劇/評審模型另設(選填);沒設或設不完整回 null,呼叫端退回主設定
  const c = cfg();
  if (!c.wProvider || !PROVIDERS[c.wProvider]) return null;
  return { provider: c.wProvider, base: c.wBase || '', model: c.wModel || '', key: c.wKey || '' };
}
function writerCfgBad(w) { return w && (!w.model || !w.base || (!PROVIDERS[w.provider].keyless && !w.key)); }

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
  const out = [];
  for (const m of rehydrate(list).filter((x) => x && typeof x === 'object' && typeof x.type === 'string')) {
    if (m.type === 'msg' && typeof m.text === 'string') {
      m.text = m.text.replace(/^[((](?:轉折|高潮|伏筆|鋪陳|開場|收尾|結尾|轉折點|高潮點)[))]\s*/, ''); // 舞台指示滲進台詞的保險
      if (/^[((]略[))]$/.test(m.text.trim())) { out.push({ type: 'skip', text: '⋯⋯(略)⋯⋯' }); continue; } // 「小亮:(略)」→ 正確的省略分隔
    }
    const emptyText = m.type === 'msg' && (m.kind || 'text') === 'text' && !(m.text && String(m.text).trim());
    if (emptyText) { // 模型常把 react/已讀寫成空白訊息:有 react 就併回前一則,純空白直接丟(程式碼保險)
      if (Array.isArray(m.react) && m.react.length && out.length && out[out.length - 1].type === 'msg') {
        const prev = out[out.length - 1];
        prev.react = (Array.isArray(prev.react) ? prev.react : []).concat(m.react);
      }
      continue;
    }
    out.push(m);
  }
  return out;
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
- mode:"dm"(1對1)時 title 必須=對方(左側那位)的名字、members 給 0;mode:"group" 時 title=群組名稱、members 給合理人數。
- people:[{id,name,avatar}],avatar 是圖片(@imgN 佔位符或 null=灰底圓)。
- messages 依序渲染:
  {"type":"date","text":"7月15日 (三)"} 日期分隔
  {"type":"skip","text":"⋯⋯(略)⋯⋯"} 省略分隔
  {"type":"msg","side":"left","personId":"p1","text":"...","time":"下午3:42","read":"","quote":null} 他人訊息
  {"type":"msg","side":"right","text":"...","time":"下午4:06","read":"已讀"} 自己(綠泡泡),不需 personId;群組的 read 可寫「已讀 8」
  選填 quote:{name,text}=引用回覆;react:["😆"]=表情回應列
  kind:"image"|"sticker"(配 img 欄位)、"voice"(dur:"0:12")、"file"(fname,fsize);kind 省略=文字
- react 是「別人對這則訊息的反應」,放在**被反應的那一則訊息**的 react 欄位(劇本寫「小雯對阿亮上一則按 ❤️」=把 ❤️ 加進阿亮那則的 react)。絕不可為了 react 或已讀狀態建立空白訊息(text 空的 msg 是錯誤)。
- text 只放角色真的打出來的文字。劇本裡的括號註記——(轉折)(高潮)(已讀)(略)(草稿)(react)等——是給你的舞台指示,**絕不可抄進 text**:轉折/高潮照常填內容不含標記;(略)=獨立 skip 分隔則;草稿=settings.draft;已讀=read 欄位。
- 劇本的方括號記法=非文字訊息,轉成對應 kind,描述文字不進 text:[貼圖:…]→kind:"sticker",img:null;[圖片:…]→kind:"image",img:null;[語音 0:12:…]→kind:"voice",dur:"0:12";[檔案:xx.pdf 2.4MB]→kind:"file",fname,fsize。
- 「(引用某人的「原文」)自己的話」→ 該則訊息 quote:{name:"某人",text:"原文"},text 只放自己的話;「[日期:7月17日 (四)]」→ {type:"date",text:"7月17日 (四)"}。
- read 欄位只在 side:"right"(自己的綠泡泡)有意義;left 訊息不放 read。「已讀不回」=right 訊息 read:"已讀"+下一則時間拉開。
- 時間照台灣 LINE 慣例如「下午4:06」,前後訊息時間要合理遞增。連續同 personId 的 left 訊息會自動省略頭像暱稱。

創作流程(使用者的提示通常很簡短,你要把它長成完整作品):
1. 補齊規格:先在心中定好角色個性與關係、劇情弧(起因→轉折→收尾)、要用哪些說故事手法——已讀不回、時間跳躍、日期分隔、「(略)」省略、貼圖、引用回覆、表情回應、輸入框未送出的草稿(draft)都是敘事工具。
2. 產出初稿:依規格用工具一次做完整——settings(title/mode 要相符)、people、messages 全部到位,不要只做一半。
3. 自審修稿:每次修改後你會收到自審要求,用檢查清單重讀腳本;有不合格就繼續修,全部合格才收工。

規則:
- 一律使用繁體中文(zh-TW)回覆。
- 你的第一個回應必須是工具呼叫,不可以只回覆文字、規劃或思考過程;所有思考直接化為工具行動。
- 收到任務直接用工具完成,不要反問、不要只給建議或範例;改完用一句話回報結果。
- 填入大量訊息時務必分批:先用 apply_script 放 settings、people 與前幾則訊息,之後用 append_messages 每批最多 8 則補完;單次工具參數過長容易格式出錯。
- 對話內容要自然口語像真人閒聊,每個人物講話風格一致;適度用貼圖、已讀、時間差說故事。
- @imgN 代表既有圖片:要沿用就原樣保留;不可發明不存在的 @imgN;新的 image/sticker 訊息 img 給 null(顯示佔位圖)。
- 僅供創作示意(部落格配圖、教學、行銷素材);拒絕製作用於詐騙、毀謗、偽造證據的內容。`;

// ── 編劇/評審(創意與執行分離:編劇寫劇本→評審打分及格→執行 AI 只負責詳實填入) ──
const WRITER_SYSTEM = `你是資深編劇,專為「LINE 對話截圖」這種形式寫劇本。

【演出管線】
你的劇本不會被人類觀眾讀到,而是交給一個「執行 AI」逐字轉譯成一張以假亂真的 LINE 聊天畫面——觀眾最後看到的只有那張截圖。
這個舞台沒有旁白、沒有內心獨白、沒有場景與鏡頭描寫、沒有表情動作說明;所有情緒與劇情,只能用「畫面上真的看得到的東西」演出來。這是 show, don't tell 的 LINE 版——寫任何一行前先問:這個東西會出現在截圖上嗎?不會,就換成畫面演得出來的手法。

【舞台元素全覽】你能用的全部元素、劇本記法、畫面效果:
訊息類型(五種,都是正當訊息;「角色A/角色B」是記法佔位,創作時換成你取的名字):
- 文字:「角色A:今晚好冷~」→ 對話泡泡
- 貼圖:「角色A:[貼圖:抱抱的熊]」→ 大張貼圖,無文字;情緒的標點符號
- 圖片:「角色B:[圖片:海邊夕陽]」→ 照片訊息;曬生活、給證據、傳截圖都靠它
- 語音:「角色A:[語音 0:15:大意是想見你]」→ 畫面只有語音條和秒數,觀眾聽不到內容——想讓觀眾知道說了什麼,要用後續訊息呼應(「你剛那句…再說一次?」)
- 檔案:「角色B:[檔案:企劃書.pdf 2.4MB]」→ 檔案訊息;職場戲的道具
結構元素:
- 引用回覆:「角色A:(引用角色B的「我想吃燉飯」)那今晚一起去?」→ 泡泡上方帶原文小框;回應較早的話、製造呼應或翻舊帳
- 表情回應:「(角色B在角色A的上一則按了 ❤️)」→ 貼在對方訊息下的小表情;不是訊息,是無聲的回應——曖昧戲的靈魂
- 已讀:自己(右側綠泡泡)訊息旁的「已讀」;左側訊息沒有已讀標示
- 時間:每則「下午4:06」且遞增;時間差本身就是戲——秒回=在乎,隔一小時=有事發生
- 日期分隔:獨立行「[日期:7月17日 (四)]」→ 跨日必用;跨日本身可以是劇情(冷戰過夜)
- 省略分隔:獨立行「(略)」→ 跳過不重要的過程,兩段高潮之間的剪接
場景設定(開場先決定):
- 1對1(dm):標題=對方的名字;群組:標題=像真的群組名+合理成員數,置頂公告是群組限定武器(可以埋梗)
- 輸入框草稿:「(草稿) draft=打了沒送出的那句話」→ 顯示在輸入框;強力的懸念收尾,但屬於選配——不是每部都要用,連用會膩
- 主題氛圍:可指定深色/亮色主題、聊天背景色配合劇情(深夜戲用深色)

【敘事技法】用上面的元素組合出來的招式:
- 已讀不回=自己訊息標已讀+下一則時間拉大;連發短句=急切;語音+對方只按 ❤️=聽完說不出話
- 貼圖接在尷尬話題後=打圓場;引用很久以前的話=翻舊帳或深情;公告與對話反差=群組戲笑點

【格式紀律】(寫錯執行端會做出怪畫面)
- 台詞行只寫角色真的會打出來的字;轉折/高潮/心理註記只能放在劇本最後的標註區
- react/已讀/沉默是狀態註記不是台詞;「(略)」「[日期:…]」是獨立行不屬於任何角色

【創作憲章】以上規則只管格式,不管膽子——劇情要敢:誤會、反轉、翻車、告白、神來一筆的貼圖時機。平庸安全、只有寒暄問答的劇本會被評審退件;寧可戲劇化一點,也不要乾。五種訊息類型至少用三種,結構元素能用就用——但為用而用不行,每個元素都要服務劇情。
結尾手法要輪換,依這部作品的劇情選最對味的一種:草稿懸念/已讀不回的沉默/一句話神回/貼圖收場/公告或日期分隔的反差…上一部用過的招,這一部就換一招。
每部作品要設計一格「截圖點」——觀眾看完最想單獨截下來傳給朋友的那一則(神回/暴擊/反轉句),整部戲為它鋪陳;共鳴要具體到讓人想 tag 某個人(「這就是我媽」「tag 你室友」)。
使用者的主題是委託簡報,不是分鏡表:具體的起因、轉折、結局、人物與細節由你發明;就算主題已經寫了走向,也要在細節上加出乎意料的料。你是編劇,不是打字員。

【輸出格式】寫出完整劇本:
1. 角色設定:每人的個性、說話習慣(語助詞/標點/長短句)。名字要依題材新取、貼合身分(職場/家人/同學各有命名感),不要沿用示例或上一部作品的名字
2. 逐則對話:誰說/內容(照記法)/時間/已讀狀態
3. 標註高潮與轉折點在哪一則
只輸出劇本文字,劇情要有起因、升溫、高潮、收尾;對話像真人打字。`;
const CRITIC_SYSTEM = `你是嚴格的 LINE 對話劇本評審,標準是「能在社群瘋傳」。對劇本六項評分,各 0-10:
1 arc 劇情弧(起因→升溫→高潮→收尾完整) 2 voice 角色聲音(口氣一致且彼此區分)
3 form 形式運用(已讀不回/時間差/日期分隔/貼圖/引用/react/draft 至少巧用三種且服務劇情)
4 pacing 節奏(留白與密集交錯,高潮前有鋪陳) 5 real 真實感(像真人打字的口語與短句)
6 share 傳播力:看完會想 tag 誰?有沒有共鳴點(「這就是我媽」「tag 你室友」)?最關鍵:有沒有一格明確的「截圖點」——觀眾最想單獨截下來傳的那一則。
平淡無起伏、只有寒暄問答、沒有任何意外或情緒轉折的劇本,arc 與 pacing 不得超過 6;純文字沒穿插貼圖/圖片/語音等非文字訊息的,form 不得超過 6;形式元素「為用而用」沒服務劇情的(例:草稿結尾與劇情無關、貼圖亂入),form 扣分;沒有明確截圖點或共鳴對象模糊的,share 不得超過 6。
只回傳 JSON:{"scores":{"arc":n,"voice":n,"form":n,"pacing":n,"real":n,"share":n},"total":n,"pass":true|false,"feedback":"具體可執行的修改指示,share 低分時要指出截圖點該設在哪"}
pass 條件:total>=48 且每項>=6。`;
const IDEAS = [ // 委託簡報式:只給主題+情緒目標,具體轉折留給編劇發明(寫太細它會照抄)
  ['情侶吵架和好', '情侶吵架和好,要高潮迭起,結局暖但過程虐,吵架的原因和破冰的方式由你發明'],
  ['家人的日常', '家人之間嘴硬心軟的日常,表面平淡結尾有後勁,誰跟誰、為了什麼事由你決定'],
  ['群組修羅場', '一個多人群組的修羅場,誤會或災難逐步升級,要有人說錯話的瞬間,題材自選'],
  ['深夜曖昧', '深夜曖昧,話越聊越近但誰都不敢先說破,結尾懸念要讓人截圖傳給朋友,細節自由發揮'],
  ['荒謬日常', '一段荒謬又真實的日常鬧劇,笑點要生活化,場景人物全由你發明'],
];

const QUICK_GUIDE = `這是「微調」任務,最高原則:只動使用者指定的地方,其他內容一字不改、順序不動。
- 使用者說「第 N 句/則」= 畫面由上而下第 N 則訊息(含日期與(略)分隔一起數);若指令引用了訊息文字,以文字比對為準,比序號可靠。
- 先用 get_script 讀目前腳本、確認目標所在,再用 apply_script 做最小變更(回傳完整 messages 時,未修改的則必須原封保留,含 @imgN)。
- 不要順手潤飾、不要補劇情、不要調整沒被點名的時間或文字。`;
const QUICK_REVIEW_MESSAGE = `自審:用 get_script 重讀腳本,只檢查兩件事:
1) 使用者指定的修改是否正確完成?
2) 其他內容是否原封不動(文字、時間、順序、圖片佔位符都沒被動到)?
有動到不該動的立刻改回來;確認無誤才用一句話回報。`;

const REVIEW_MESSAGE = `自審清單,逐項檢查剛才的修改:
1) 使用者任務與你補齊的規格是否完整達成?劇情有起因、轉折、收尾?
2) 每個人物口氣前後一致、像真人?
3) 時間格式照「下午4:06」慣例且合理遞增?
4) 節奏有留白?(日期分隔、(略)、已讀不回的時間差)
5) 有善用視覺敘事?(貼圖、引用回覆、表情回應、draft)
6) settings 的 title/mode 與內容相符?
先用 get_script 重讀一次腳本核對;有任何不合格就立刻用工具修正,全部合格才用一句話回報完成。`;

let aborter = null;
let aiUndoStack = []; // 每次 AI 修改推一層 {draftId, snap},按一次退一步;只作用於目前草稿
function undoEntries() { return aiUndoStack.filter((e) => e.draftId === currentId); }
function updateUndoButton() { // 常駐但停用:隱藏式按鈕使用者找不到(實戰回饋)
  const n = undoEntries().length;
  const b = $('#ai-undo');
  b.disabled = !n;
  b.textContent = n > 1 ? `還原上一步(可退 ${n} 步)` : '還原上一步';
}

async function chat(msgs, force, noTools, useCfg) {
  const c = useCfg || cfg();
  const res = await fetch(c.base.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    signal: aborter.signal,
    headers: { 'content-type': 'application/json', ...(c.key ? { authorization: 'Bearer ' + c.key } : {}) },
    body: JSON.stringify({
      model: c.model,
      messages: msgs,
      ...(noTools ? {} : { tools: TOOL_DEFS.map((t) => ({ type: 'function', function: t })), tool_choice: force ? 'required' : 'auto' }),
    }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d.error && d.error.message) || d.message || 'HTTP ' + res.status);
  const m = d.choices && d.choices[0] && d.choices[0].message;
  if (!m) throw new Error('模型沒有回傳訊息。');
  return m;
}

function textOf(m) { return (typeof m.content === 'string' ? m.content : '').trim(); }

async function writeScreenplay(prompt, existing) { // 編劇→評審迴圈,及格(或 3 輪取最佳)才放行
  log('編劇撰寫劇本中…');
  const wcfg = writerCfg() || cfg(); // 編劇/評審可另設模型,沒設=同執行
  const brief = '需求:' + prompt + (existing ? '\n\n既有劇本(在此基礎上強化:保留好的部分、針對需求與弱點改寫,輸出完整新版):\n' + existing : '');
  const wmsgs = [{ role: 'system', content: WRITER_SYSTEM }, { role: 'user', content: brief }];
  let best = { script: '', total: -1 };
  for (let round = 1; round <= 3; round++) {
    const script = textOf(await chat(wmsgs, false, true, wcfg));
    if (!script) break;
    wmsgs.push({ role: 'assistant', content: script });
    let verdict = null;
    try {
      const raw = textOf(await chat([{ role: 'system', content: CRITIC_SYSTEM }, { role: 'user', content: script }], false, true, wcfg));
      verdict = JSON.parse((raw.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    } catch (e) {}
    if (!verdict || typeof verdict.total !== 'number') { log('評審回覆無法解析,採用目前劇本', 'warn'); return script; }
    if (verdict.total > best.total) best = { script, total: verdict.total };
    if (verdict.pass) { log(`劇本評分 ${verdict.total}/60${verdict.scores && typeof verdict.scores.share === 'number' ? `(傳播力 ${verdict.scores.share})` : ''},通過`, 'done'); return script; }
    log(`劇本評分 ${verdict.total}/60 未達標(第 ${round}/3 輪):${String(verdict.feedback || '').slice(0, 80)}`, 'warn');
    if (round < 3) wmsgs.push({ role: 'user', content: '評審未通過(' + verdict.total + '/50)。依以下意見改寫整份劇本:\n' + (verdict.feedback || '') });
  }
  log(`三輪未達標,採用最高分劇本(${best.total}/50)`, 'warn');
  return best.script;
}

async function runAgent(prompt, screenplay, quick) {
  imgRegistry = [];
  const before = structuredClone(scriptOf());
  aborter = new AbortController();
  let mutated = false, usedTool = false, force = true;
  const task = quick
    ? QUICK_GUIDE + '\n\n使用者的微調指令:' + prompt
    : screenplay
      ? '使用者原始需求:' + (prompt || '(見劇本)') + '\n\n以下是使用者定稿的劇本,你的工作是把它詳實填入腳本 JSON(settings/people/messages),忠於劇本的每一則對話、時間、已讀與形式安排,不要自行改劇情:\n' + screenplay +
        '\n\n(劇本結束。現在直接呼叫 apply_script 開始填入,先放 settings/people 與前幾則,再用 append_messages 分批補完;不要輸出文字。)'
      : '使用者任務:' + prompt;
  const msgs = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: '目前腳本 JSON:\n' + JSON.stringify(strip(scriptOf())) + '\n\n' + task },
  ];
  const loopLimit = Math.min(50, Math.max(3, +cfg().loops || 10)); // 每按一次「開始製作」重新起算
  let allowForce = true; // 推理模型偶爾在 required 下硬回文字,Groq 直接 400;降級 auto+反偷懶訊息驅動
  try {
    for (let step = 1; step <= loopLimit; step++) {
      let m;
      for (let attempt = 1; ; attempt++) { // 模型偶爾把工具參數 JSON 寫壞(長輸出常見),重取樣重試
        try { m = await chat(msgs, force && allowForce); break; }
        catch (e) {
          if (e.name === 'AbortError') throw e;
          if (allowForce && /did not call a tool|tool_choice/i.test(e.message)) {
            allowForce = false;
            log('模型拒絕強制工具呼叫,改用引導模式重試', 'warn');
            continue;
          }
          if (attempt >= 3 || !/parse|json|failed_generation|tool call/i.test(e.message)) throw e;
          log(`模型工具參數格式錯誤,重試(${attempt}/2)`, 'warn');
        }
      }
      force = false;
      msgs.push(m);
      const calls = Array.isArray(m.tool_calls) ? m.tool_calls : [];
      if (!calls.length) {
        const text = (typeof m.content === 'string' ? m.content : '').trim();
        if (!usedTool && step < loopLimit) { // 反偷懶:只回文字沒動手,踹回去(參考 zerotype)
          log('模型只回了文字,要求改用工具執行', 'warn');
          msgs.push({ role: 'user', content: '不要只回覆文字或計畫,現在立刻呼叫工具完成任務。' });
          force = true;
          continue;
        }
        log(text || '已完成。', 'done');
        return;
      }
      let batchMutated = false;
      for (const call of calls) {
        const name = call.function && call.function.name;
        let args = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch (e) {}
        log('工具:' + name);
        let out;
        try {
          out = await execTool(name, args);
          usedTool = true;
          if (name === 'apply_script' || name === 'append_messages') { mutated = true; batchMutated = true; }
        } catch (e) { out = JSON.stringify({ ok: false, error: e.message }); }
        msgs.push({ role: 'tool', tool_call_id: call.id, name, content: out });
      }
      if (batchMutated && step < loopLimit - 1) { // 改完強制自審一輪(參考 zerotype 的 post-mutation review);微調查「有沒有多改」,大製作查劇情品質
        log('已要求模型自審剛才的修改', 'warn');
        msgs.push({ role: 'user', content: quick ? QUICK_REVIEW_MESSAGE : REVIEW_MESSAGE });
        force = true;
      }
    }
    log('已達迴圈上限(' + loopLimit + '),停在目前結果。', 'warn');
  } finally {
    if (mutated) {
      aiUndoStack.push({ draftId: currentId, snap: before });
      if (aiUndoStack.length > 20) aiUndoStack.shift();
      updateUndoButton();
    }
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
  const blocked = offline || needsKey(c) || !c.model;
  const w = writerCfg();
  const wBad = writerCfgBad(w);
  $('#ai-run').disabled = blocked;
  $('#ai-enhance').disabled = blocked || wBad; // 編劇另設但沒設完整,只擋「劇本強化」
  $('#ai-quick-run').disabled = offline; // 沒設定時保持可按:點了引導去連線設定(按鈕離設定太遠,死灰沒人懂)
  $('#ai-quick-run').title = offline ? '離線中,AI 需要網路' : (needsKey(c) || !c.model) ? '尚未設定 AI 連線,點我去設定' : '';
  $('#ai-status').textContent = offline ? '離線中:AI 需要網路(其餘功能照常離線可用)。'
    : needsKey(c) ? '先展開上方「連線設定」填 API Key(只存這台裝置,不會進草稿或分享連結)。'
    : !c.model ? '先展開上方「連線設定」填 Model 名稱。'
    : wBad ? '編劇模型設定不完整(缺 Model 或 Key),補完或 Provider 改回「同執行設定」。' : '';
  $('#ai-settings-summary').textContent = blocked && !offline
    ? '連線設定(尚未設定,點開填 API Key)'
    : `連線設定(${PROVIDERS[c.provider].label} · ${c.model}${w ? ` / 編劇:${PROVIDERS[w.provider].label} · ${w.model || '未填'}` : ''})`;
}
// 免費體驗額度徽章(右上角):免費 provider 才顯示,任務結束後刷新
async function refreshQuota() {
  const badge = $('#ai-quota');
  if (cfg().provider !== 'free') { badge.hidden = true; return; }
  try {
    const r = await fetch(PROVIDERS.free.base + '/quota');
    if (!r.ok) throw new Error('quota ' + r.status);
    const q = await r.json();
    badge.textContent = `今日 AI 剩 ${Math.max(0, q.ipLimit - q.ipUsed)} / ${q.ipLimit}`;
    badge.title = `免費體驗額度,每天重置(約 20 次=1 個完整作品)。全站今日剩 ${Math.max(0, q.globalLimit - q.globalUsed)} / ${q.globalLimit};用完可到連線設定填自己的 Key。`;
    badge.hidden = false;
  } catch (e) { badge.hidden = true; }
}
// 劇本跟著草稿走(localStorage per draft id,不進 state:分享連結與匯出不帶劇本)
function screenplayLoad() { try { $('#ai-screenplay-text').value = localStorage.getItem('lcm-screenplay-' + currentId) || ''; } catch (e) {} }
function screenplaySave() { try { localStorage.setItem('lcm-screenplay-' + currentId, $('#ai-screenplay-text').value); } catch (e) {} }
function fillCfgForm() {
  const c = cfg();
  const sel = $('#ai-provider');
  if (!sel.options.length) for (const [id, p] of Object.entries(PROVIDERS)) { const o = document.createElement('option'); o.value = id; o.textContent = p.label; sel.appendChild(o); }
  sel.value = c.provider;
  $('#ai-base').value = c.base || '';
  $('#ai-model').value = c.model || '';
  $('#ai-key').value = c.key || '';
  $('#ai-loops').value = Math.min(50, Math.max(3, +c.loops || 10));
  const wsel = $('#ai-w-provider');
  if (!wsel.options.length) {
    const same = document.createElement('option'); same.value = ''; same.textContent = '同執行設定'; wsel.appendChild(same);
    for (const [id, p] of Object.entries(PROVIDERS)) { const o = document.createElement('option'); o.value = id; o.textContent = p.label; wsel.appendChild(o); }
  }
  wsel.value = PROVIDERS[c.wProvider] ? c.wProvider : '';
  $('#ai-w-fields').hidden = !wsel.value;
  $('#ai-w-base').value = c.wBase || '';
  $('#ai-w-model').value = c.wModel || '';
  $('#ai-w-key').value = c.wKey || '';
  updateGate();
}
function setBusy(on) {
  $('#ai-run').disabled = on;
  $('#ai-enhance').disabled = on;
  $('#ai-quick-run').disabled = on;
  $('#ai-stop').hidden = !on;
  if (!on) updateGate();
}

$('#ai-provider').addEventListener('change', (e) => {
  const p = PROVIDERS[e.target.value];
  saveCfg({ ...cfg(), provider: e.target.value, base: p.base, model: p.model });
  fillCfgForm();
  refreshQuota();
});
for (const [id, key] of [['#ai-base', 'base'], ['#ai-model', 'model'], ['#ai-key', 'key'], ['#ai-loops', 'loops'], ['#ai-w-base', 'wBase'], ['#ai-w-model', 'wModel'], ['#ai-w-key', 'wKey']]) {
  $(id).addEventListener('input', (e) => { saveCfg({ ...cfg(), [key]: e.target.value.trim() }); updateGate(); });
}
$('#ai-w-provider').addEventListener('change', (e) => {
  const id = e.target.value;
  const p = PROVIDERS[id];
  saveCfg({ ...cfg(), wProvider: id, wBase: p ? p.base : '', wModel: p ? (p.writerModel || p.model) : '', wKey: id ? cfg().wKey || '' : '' });
  fillCfgForm();
});
$('#ai-enhance').addEventListener('click', async () => { // 第 1 段:發想與充實劇本(可反覆)
  const prompt = $('#ai-prompt').value.trim();
  const existing = $('#ai-screenplay-text').value.trim();
  if (!prompt && !existing) { $('#ai-prompt').focus(); return; }
  setBusy(true);
  log('劇本強化:' + (prompt || '(依既有劇本)'), 'prompt');
  aborter = new AbortController();
  try {
    const s = await writeScreenplay(prompt || '把既有劇本整體強化', existing);
    if (s) { $('#ai-screenplay-text').value = s; screenplaySave(); log('劇本已更新:可直接編輯、再按「劇本強化」迭代;滿意就按「開始製作」。', 'done'); }
  } catch (e) { log(e.name === 'AbortError' ? '已停止。' : '失敗:' + e.message, 'err'); }
  aborter = null;
  setBusy(false);
  refreshQuota();
});
$('#ai-run').addEventListener('click', async () => { // 第 2 段:穩定實作(忠於劇本)
  const prompt = $('#ai-prompt').value.trim();
  const screenplay = $('#ai-screenplay-text').value.trim();
  if (!prompt && !screenplay) { $('#ai-prompt').focus(); return; }
  setBusy(true);
  log('開始製作:' + (screenplay ? '依定稿劇本' : prompt), 'prompt');
  try { await runAgent(prompt, screenplay); }
  catch (e) { log(e.name === 'AbortError' ? '已停止。' : '失敗:' + e.message, 'err'); }
  setBusy(false);
  refreshQuota();
});
$('#ai-quick-run').addEventListener('click', async () => { // 微調:直接下指令改畫面,不經劇本
  const c = cfg();
  if (needsKey(c) || !c.model) { // 沒設定 → 帶去 AI 分頁的連線設定
    document.querySelector('.tabs [data-pane="ai"]').click();
    $('#ai-settings').open = true;
    $(needsKey(c) ? '#ai-key' : '#ai-model').focus();
    toast('先設定 AI 連線(填 API Key),設好就能用 AI 修改');
    return;
  }
  const quick = $('#ai-quick').value.trim();
  if (!quick) { $('#ai-quick').focus(); return; }
  setBusy(true);
  log('微調:' + quick, 'prompt');
  try { await runAgent(quick, '', true); $('#ai-quick').value = ''; toast('AI 微調完成,不滿意可按「還原上一步」'); }
  catch (e) { log(e.name === 'AbortError' ? '已停止。' : '失敗:' + e.message, 'err'); toast('AI 微調失敗,詳見 AI 分頁紀錄'); }
  setBusy(false);
  refreshQuota();
});
$('#ai-quick').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#ai-quick-run').click(); });
$('#ai-screenplay-text').addEventListener('input', screenplaySave);
$('#ai-stop').addEventListener('click', () => { if (aborter) aborter.abort(); });
$('#ai-undo').addEventListener('click', () => {
  const mine = undoEntries();
  const entry = mine[mine.length - 1];
  if (!entry) return;
  aiUndoStack.splice(aiUndoStack.lastIndexOf(entry), 1);
  state.settings = entry.snap.settings; state.people = entry.snap.people; state.messages = entry.snap.messages;
  save(); render(); updateUndoButton();
  toast('已還原上一步 AI 修改' + (undoEntries().length ? `(還可再退 ${undoEntries().length} 步)` : ''));
});
$('#ai-prompt').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#ai-enhance').click(); }); // 主題欄的主動作=劇本強化
$('#ai-new-draft').addEventListener('click', async () => { // 借用草稿頁的既有邏輯
  $('#draft-new').click();
  await new Promise((r) => setTimeout(r, 50)); // 等 currentId 換新
  screenplayLoad(); updateUndoButton();
  toast('已開新草稿,AI 會在這份上創作');
});
document.querySelector('.tabs [data-pane="ai"]').addEventListener('click', () => { screenplayLoad(); updateUndoButton(); }); // 切回 AI 頁時同步目前草稿
for (const [label, idea] of IDEAS) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = label; b.title = idea;
  b.addEventListener('click', () => { $('#ai-prompt').value = idea; $('#ai-prompt').focus(); });
  $('#ai-ideas').appendChild(b);
}
window.addEventListener('online', updateGate);
window.addEventListener('offline', updateGate);
fillCfgForm();
updateUndoButton();
refreshQuota();
{ const c = cfg(); $('#ai-settings').open = needsKey(c) || !c.model; } // 只在載入時決定一次:沒設好=展開;之後不自動開合,不打擾使用者輸入

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
