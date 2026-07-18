// core/shellEnv.js — 壳环境检测(Android WebView 壳 UA 带 " TDShell/1" 标记,见 android/ 工程)。
export function isShellEnv(ua) {
  return typeof ua === 'string' && ua.includes('TDShell');
}
