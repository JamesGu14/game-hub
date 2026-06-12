// tests/css-guards.test.mjs — 校验移动端触控 guard 样式存在，防止 iPad 点按出现蓝色高亮
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(__dirname, '..', 'style.css');
const css = fs.readFileSync(cssPath, 'utf8');

const htmlBodyMatch = css.match(/html,\s*body\s*\{([^}]*)\}/s);
const gameMatch = css.match(/#game\s*\{([^}]*)\}/s);
assert.ok(htmlBodyMatch, '应存在 html, body 规则块');
assert.ok(gameMatch, '应存在 #game 规则块');
const htmlBody = htmlBodyMatch[1];
const game = gameMatch[1];

const required = [
  '-webkit-tap-highlight-color: transparent',
  '-webkit-touch-callout: none',
  '-webkit-user-select: none',
  'user-select: none',
  'touch-action: none',
];

for (const rule of required) {
  assert.ok(htmlBody.includes(rule), `html, body 应包含 ${rule}`);
  assert.ok(game.includes(rule), `#game 应包含 ${rule}`);
}

console.log('✅ css-guards ok');
