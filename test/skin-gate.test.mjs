// test/skin-gate.test.mjs — 用 node 跑真的 skin.js,驗 skin 解析(六款含真實;未知值退 memo)。無框架。
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'skin.js'), 'utf8');
const g = {};
new Function('root', src.replace(/\(typeof window[^;]+;/, '(root);'))(g); // 以 g 當 root 執行 IIFE
const { pickSkin, resolveSkin, SKINS } = g.LCM_SKINS;

// 六款 skin 都合法(含 real,不再隱藏、不再有旗標閘門)
assert.equal(SKINS.length, 6, '六款 skin');
assert.ok(SKINS.some((s) => s.id === 'real') && !SKINS.some((s) => s.hidden), 'real 為正常可選 skin,無 hidden');

// 純函式 pickSkin:合法值直通,未知/缺值 → memo
assert.equal(pickSkin('real'), 'real', 'real 為合法 skin,直通');
assert.equal(pickSkin('ink'), 'ink');
assert.equal(pickSkin('jelly'), 'jelly');
assert.equal(pickSkin('memo'), 'memo');
assert.equal(pickSkin(undefined), 'memo', '缺值 → 預設 memo');
assert.equal(pickSkin('bogus'), 'memo', '未知值 → memo');

// resolveSkin(render 實際走的路徑)
assert.equal(resolveSkin({ skin: 'real' }), 'real');
assert.equal(resolveSkin({ skin: 'ink' }), 'ink');
assert.equal(resolveSkin({}), 'memo', 'legacy 無 skin → memo');
assert.equal(resolveSkin(null), 'memo');

console.log('skin-resolve: OK');
