/* lcm-ai-proxy:line-chat-maker 的免費體驗代理(「刷作者的信用卡」)
   Groq key 只存在 Cloudflare secret,絕不進前端。
   五道閘:Origin 白名單 / model 鎖定+請求形狀 / 每 IP 每日額度 / 全站每日熔斷 / max_tokens 上限。
   自架:見同目錄 README.md。 */
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const okOrigin = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean).includes(origin);
    const cors = {
      'access-control-allow-origin': okOrigin ? origin : 'null',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-max-age': '86400',
    };
    const err = (status, message) => new Response(JSON.stringify({ error: { message } }), { status, headers: { 'content-type': 'application/json', ...cors } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const pathname = new URL(req.url).pathname;
    if (req.method === 'GET' && pathname === '/quota') { // 唯讀查額度(給前端徽章),不計入用量
      if (!okOrigin) return err(403, '這個免費代理只服務 line-chat-maker 網頁。');
      const day = new Date().toISOString().slice(0, 10);
      const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
      let mine = 0, all = 0;
      try {
        const a = await env.DB.prepare('SELECT n FROM lcm_quota WHERE day = ?1 AND ip = ?2').bind(day, ip).first();
        const b = await env.DB.prepare('SELECT n FROM lcm_quota WHERE day = ?1 AND ip = ?2').bind(day, '__global__').first();
        mine = a ? a.n : 0; all = b ? b.n : 0;
      } catch (e) {} // 表還沒建=零用量
      return new Response(
        JSON.stringify({ ipUsed: mine, ipLimit: +env.IP_DAILY || 60, globalUsed: all, globalLimit: +env.GLOBAL_DAILY || 1200 }),
        { headers: { 'content-type': 'application/json', ...cors } },
      );
    }
    if (req.method !== 'POST' || pathname !== '/chat/completions') return err(404, '這個免費代理只有 POST /chat/completions 與 GET /quota。');
    if (!okOrigin) return err(403, '這個免費代理只服務 line-chat-maker 網頁。想自架:repo 的 worker/ 目錄照 README 部署,用自己的 key。');

    const raw = await req.text();
    if (raw.length > 400_000) return err(413, '請求太大。');
    let body;
    try { body = JSON.parse(raw); } catch { return err(400, '請求不是合法 JSON。'); }
    if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 150) return err(400, 'messages 格式不對。');

    // 額度:每 IP 每日+全站熔斷(D1;表不存在時自建一次)
    const day = new Date().toISOString().slice(0, 10); // UTC 日界,台北時間早上 8 點重置
    const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
    const ipLimit = +env.IP_DAILY || 60;
    const globalLimit = +env.GLOBAL_DAILY || 1200;
    let counts;
    try { counts = await bump(env.DB, day, ip); }
    catch (e) {
      await env.DB.exec('CREATE TABLE IF NOT EXISTS lcm_quota (day TEXT NOT NULL, ip TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, ip))');
      counts = await bump(env.DB, day, ip);
    }
    if (counts.global > globalLimit) return err(429, '今天全站的免費體驗額度被大家用完了(作者的信用卡在冒煙)。明天再來,或到連線設定填自己的 Groq API Key(免費申請,額度歸你)。');
    if (counts.ip > ipLimit) return err(429, `你今天的免費體驗額度用完了(每天 ${ipLimit} 次 AI 呼叫,約 3 個作品)。想繼續:連線設定填自己的 Groq API Key(免費申請)。`);

    // 鎖定 model 與欄位:這不是萬用 LLM 代理
    const clean = {
      model: env.MODEL || 'openai/gpt-oss-120b',
      messages: body.messages,
      max_tokens: Math.min(+body.max_tokens || 4096, 4096),
    };
    if (Array.isArray(body.tools)) clean.tools = body.tools;
    if (body.tool_choice !== undefined) clean.tool_choice = body.tool_choice;

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.GROQ_API_KEY },
      body: JSON.stringify(clean),
    });
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { 'content-type': 'application/json', ...cors } });
  },
};

async function bump(db, day, ip) {
  const sql = 'INSERT INTO lcm_quota (day, ip, n) VALUES (?1, ?2, 1) ON CONFLICT(day, ip) DO UPDATE SET n = n + 1 RETURNING n';
  const mine = await db.prepare(sql).bind(day, ip).first();
  const all = await db.prepare(sql).bind(day, '__global__').first();
  return { ip: mine.n, global: all.n };
}
