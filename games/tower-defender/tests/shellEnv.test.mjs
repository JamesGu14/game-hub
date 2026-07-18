// tests/shellEnv.test.mjs — 壳 UA 标记检测:命中 / 不误判 / 非字符串安全
import assert from 'node:assert';
import { isShellEnv } from '../src/core/shellEnv.js';

// 壳 UA(Android WebView 追加 " TDShell/1")→ true
assert.equal(isShellEnv('Mozilla/5.0 (Linux; Android 16; 24091RPADC) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 TDShell/1'), true);

// 浏览器 UA(iPad Safari / Mac Chrome)→ false
assert.equal(isShellEnv('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'), false);
assert.equal(isShellEnv('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0'), false);

// 非字符串 / 空 → false 不炸
assert.equal(isShellEnv(undefined), false);
assert.equal(isShellEnv(''), false);
assert.equal(isShellEnv(null), false);

console.log('shellEnv.test.mjs OK');
