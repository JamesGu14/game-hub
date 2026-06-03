# Game Hub · 游戏中心

一个类似 Nintendo Switch 主界面的游戏导航页，从导航页选择并进入各款游戏。
纯静态 HTML/CSS/JS，零构建即可运行（贪吃蛇首次需构建一次，见下）。

## 目录结构

```
game-hub/
├── index.html          # Switch 风格导航页
├── css/hub.css         # 导航页样式
├── js/
│   ├── games.js        # 游戏注册表（要加新游戏改这里）
│   └── hub.js          # 导航逻辑（键盘 / 鼠标 / 手柄）
└── games/
    ├── tactical-strike/    # 3D 战术射击（原生 JS + Three.js，静态可直接跑）
    └── snake/              # 蛇蛇王国（TypeScript + Vite，需构建到 dist/）
```

## 本地运行

```bash
# 1) 首次：构建贪吃蛇（射击游戏无需构建）
cd games/snake
npm install
npm run build        # 产物输出到 games/snake/dist/
cd ../..

# 2) 在仓库根目录启动任意静态服务器
python3 -m http.server 8000
```

然后浏览器打开 <http://localhost:8000/>。

> 注意：必须通过 HTTP 服务访问，不能直接用 `file://` 打开（ES Module / 资源加载会被浏览器拦截）。

## 导航页操作

| 操作 | 键盘 | 鼠标 | 手柄 |
| --- | --- | --- | --- |
| 切换游戏 | `←` / `→`（或 `A` / `D`） | 悬停卡片 | 左摇杆 / 方向键 |
| 进入游戏 | `Enter` / `Space` | 点击卡片 | `A` 键 |

进入游戏后，点左上角「← HUB」即可返回导航页。

## 添加新游戏

把游戏放进 `games/<your-game>/`，然后在 `js/games.js` 的 `GAMES` 数组里加一项：

```js
{
  id: 'your-game',
  title: '游戏名',
  subtitle: '副标题',
  desc: '一句话介绍',
  icon: '🎮',              // 封面用 emoji，无需图片
  accent: '#3cd070',       // 主题色
  accent2: '#0a5e2e',      // 渐变第二色
  tags: ['标签1', '标签2'],
  path: 'games/your-game/index.html',   // 相对 hub 根目录的入口
}
```

导航页会自动渲染对应卡片。

## 说明

- 全部使用相对路径，可在本地或任意静态托管下运行。
- 贪吃蛇的 Vite `base` 已设为 `'./'`，所以构建产物能在子目录正确加载资源。
- `games/snake/dist/` 与 `node_modules/` 已被 `.gitignore` 忽略，克隆后需按上面步骤重新构建贪吃蛇。
- 射击游戏的界面字体走 Google Fonts CDN，离线时自动回退为系统等宽字体，不影响游戏。
