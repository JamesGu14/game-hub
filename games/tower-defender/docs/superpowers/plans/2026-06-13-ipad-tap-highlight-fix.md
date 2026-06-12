# iPad Tap Highlight Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the light-blue tap flash on iPad by adding WebKit touch guards to `style.css`.

**Architecture:** Add mobile touch CSS guards (`-webkit-tap-highlight-color`, `-webkit-touch-callout`, `-webkit-user-select`, `user-select`, `touch-action`) to `html, body, #game` in `style.css`, and add a regression test that verifies these rules are present.

**Tech Stack:** CSS, Node.js built-in assertions, existing `scripts/test.sh` test runner.

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `style.css` | Modify | Add WebKit touch guards to `html, body, #game` |
| `tests/css-guards.test.mjs` | Create | Regression test: assert required CSS rules exist |

---

## Task 1: Add CSS Touch Guards

**Files:**
- Modify: `style.css:1-3`
- Create: `tests/css-guards.test.mjs`

- [ ] **Step 1: Write the failing regression test**

Create `tests/css-guards.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node tests/css-guards.test.mjs
```

Expected: FAIL with `AssertionError: style.css 应包含 -webkit-tap-highlight-color: transparent`

- [ ] **Step 3: Modify `style.css` to add the guards**

Replace the existing rules:

```css
html, body { width: 100%; height: 100%; overflow: hidden; background: #1a120b; font-family: system-ui, sans-serif; }
#game { display: block; width: 100vw; height: 100vh; touch-action: none; cursor: pointer; }
```

With:

```css
html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #1a120b;
  font-family: system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: none;
}

#game {
  display: block;
  width: 100vw;
  height: 100vh;
  touch-action: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
```

- [ ] **Step 4: Run the new test to verify it passes**

Run:

```bash
node tests/css-guards.test.mjs
```

Expected: PASS, prints `✅ css-guards ok`

- [ ] **Step 5: Run the full test suite**

Run:

```bash
bash scripts/test.sh
```

Expected: All checks pass, ending with `✅✅ 全部门禁通过`

- [ ] **Step 6: Commit**

```bash
cd /Users/james/Projects/game-hub
git add games/tower-defender/style.css games/tower-defender/tests/css-guards.test.mjs
git commit -m "fix(tower-defender): disable iPad tap highlight and touch callout in style.css"
```

---

## Self-Review Checklist

- **Spec coverage:** The design spec requires adding tap-highlight, touch-callout, user-select, and touch-action guards to `html, body, #game`. Task 1 implements all of these.
- **Placeholder scan:** No TBD/TODO/vague steps. Each step includes exact file paths and code.
- **Type consistency:** N/A — only CSS string matching and file reading.
