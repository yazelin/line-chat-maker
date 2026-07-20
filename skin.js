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
