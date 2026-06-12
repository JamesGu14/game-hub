# iPad 点按屏幕蓝色闪动修复设计

## 背景

在 iPad 上游玩《成都保卫战 · 三国塔防》时，无论是否开启全屏，只要点按屏幕，整个画面就会出现一层浅浅的蓝色闪动。该现象不影响功能，但体验较差。

## 根因分析

WebKit/Safari 在触控设备上默认会为可点击元素显示点按高亮（tap highlight），颜色为半透明蓝色（`-webkit-tap-highlight-color` 默认值）。

本项目 `style.css` 中：
- 未设置 `-webkit-tap-highlight-color: transparent`
- 未设置 `-webkit-user-select: none` / `user-select: none`
- 未设置 `-webkit-touch-callout: none`
- `touch-action: none` 仅作用于 `#game`，未覆盖 `html`/`body`

由于游戏 canvas 铺满全屏，点按时系统高亮覆盖整个视口，表现为全屏闪一下。

## 设计目标

1. 消除 iPad 点按时的蓝色闪动。
2. 同时禁用可能伴随触控交互出现的文本选中、上下文菜单等系统默认行为。
3. 保持游戏内 canvas 自绘按钮的 hover/active 反馈不变。
4. 与 hub 内其他游戏的移动触控防护风格保持一致。

## 方案

采用方案 B：在 `style.css` 中为 `html`、`body`、`#game` 统一补充触控 guard。

### 改动文件

- `games/tower-defender/style.css`

### 改动内容

将现有样式：

```css
html, body { width: 100%; height: 100%; overflow: hidden; background: #1a120b; font-family: system-ui, sans-serif; }
#game { display: block; width: 100vw; height: 100vh; touch-action: none; cursor: pointer; }
```

调整为：

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

## 验证计划

1. 在 iPad Safari 打开游戏，反复点按屏幕，确认无蓝色闪动。
2. 测试全屏模式与非全屏模式均正常。
3. 测试核心交互：建造塔、点击暂停/倍速/全屏按钮、滑动查看地图，确保无异常。
4. 确认 canvas 自绘按钮的高亮/按下反馈仍然正常显示。

## 风险与回退

风险极低。这些样式仅禁用系统级默认触控反馈，不会干扰游戏自定义渲染或事件处理。如出现意外影响，可直接回退 `style.css` 修改。

## 范围

本次改动仅涉及 `style.css`，不修改 JavaScript、HTML 或资源文件。
