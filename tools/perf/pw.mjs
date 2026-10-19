// Playwright 解析：优先环境变量，其次本地 devDependency。
// PW_MODULE=/abs/path/playwright/index.mjs 可以指向任意已安装的 playwright。
export async function loadPlaywright() {
  for (const c of [process.env.PW_MODULE, 'playwright', 'playwright-core']) {
    if (!c) continue;
    try { return await import(c); } catch { /* 试下一个 */ }
  }
  throw new Error(
    '找不到 playwright。请 `npm i -D playwright`，或设置 PW_MODULE=/abs/path/playwright/index.mjs',
  );
}
