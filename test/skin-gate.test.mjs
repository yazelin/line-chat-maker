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
