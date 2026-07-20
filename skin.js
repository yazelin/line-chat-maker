// skin.js — skin registry 與純函式解析。以 plain <script> 載入(browser),node 測試可用 new Function 注入。
// ponytail: pickSkin 保持純函式、有 runnable 測試。
(function (root) {
  const SKINS = [
    { id: 'memo', label: '貼紙手帳' },
    { id: 'jelly', label: '果凍軟糖' },
    { id: 'doodle', label: '手繪塗鴉' },
    { id: 'pop', label: '波普霓虹' },
    { id: 'ink', label: '宣紙水墨' },
    { id: 'real', label: '真實' },
  ];
  const SKIN_IDS = new Set(SKINS.map((s) => s.id));

  // 純函式:給定想要的 skin,回一個一定合法的 skin id;未知值 → 'memo'。
  function pickSkin(want) {
    want = want || 'memo';
    return SKIN_IDS.has(want) ? want : 'memo';
  }
  function resolveSkin(settings) { return pickSkin(settings && settings.skin); }

  root.LCM_SKINS = { SKINS, SKIN_IDS, pickSkin, resolveSkin };
})(typeof window !== 'undefined' ? window : globalThis);
