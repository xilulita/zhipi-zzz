const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

/* ===== 用户数据目录（必须在 app ready 之前设置）=====
 * Electron 默认用 productName 作为 %APPDATA% 下的目录名。同一台电脑装两个
 * 同源批改软件时，只要 productName 相同（或被安装器写成同一个），两者就会共用
 * 同一个 userData，Local Storage 里的 zhipi.history.v1 互相覆盖 —— 表现就是
 * 「装了另一个，前一个的记录全没了」。
 *
 * 这里按 appId 的末段固定目录名：不同软件只要 appId 不同，数据天然隔离；
 * 同一软件升级时 appId 不变，历史记录不会迁移丢失。
 */
const APP_ID = 'com.zhipi.zuowen.desktop';
const DATA_DIR = 'ZhipiZuowenDesktop';   // 稳定标识，勿随意改动，改了等于丢历史

/* 迁移旧数据：老版本把数据放在 productName 目录下，升级后要能读回历史。
 * 只在目标目录还没有 Local Storage 时执行一次，避免覆盖用户的新数据。
 * 注意：'智批作文' 是另一个软件的目录，若本机同时装了它，只会在本程序
 * 首次启动且自身目录为空时复制一次，之后互不影响。 */
function migrateLegacyData(targetDir) {
  const candidates = ['智批作文专业版', '智批作文', 'zhipi-zuowen-desktop'];
  const targetLS = path.join(targetDir, 'Local Storage');
  try {
    if (fs.existsSync(targetLS) && fs.readdirSync(targetLS).length) return;  // 已有数据，不动
  } catch (e) { /* 读不到就当作没有 */ }
  for (const name of candidates) {
    const from = path.join(app.getPath('appData'), name);
    try {
      if (from === targetDir) continue;
      const fromLS = path.join(from, 'Local Storage');
      if (!fs.existsSync(fromLS)) continue;
      fs.mkdirSync(targetDir, { recursive: true });
      // 只搬 Local Storage（历史记录就在这里），其余缓存不必复制
      fs.cpSync(fromLS, targetLS, { recursive: true, force: false, errorOnExist: false });
      console.log('[紫微星] 已从旧目录迁移历史数据:', from);
      return;
    } catch (e) {
      console.error('[紫微星] 旧数据迁移跳过:', e && e.message);
    }
  }
}

try {
  const dir = path.join(app.getPath('appData'), DATA_DIR);
  fs.mkdirSync(dir, { recursive: true });
  migrateLegacyData(dir);
  app.setPath('userData', dir);
} catch (e) {
  // 设置失败就退回默认目录，不能让启动因此中断
  console.error('[紫微星] 用户数据目录设置失败，回退默认:', e && e.message);
}

let mainWindow;
let splashWindow;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 620,
    height: 360,
    frame: false,
    transparent: true,
    hasShadow: false,        // 透明窗的投影会在圆角外合成深色边，关掉
    roundedCorners: true,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow && splashWindow.show());
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    title: '紫微星 · AI 批改工作台',
    // 窗口底色与页面一致：Windows 11 圆角外侧由系统合成，
    // 若底色偏深会在四角形成黑色三角/包边。
    backgroundColor: '#f5f6fa',
    // 显式开启圆角（Win11 默认开启，这里声明意图，避免被主题或兼容设置关掉）
    roundedCorners: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // 仅用于 PDF 导出：通过 contextBridge 暴露一个受限的 invoke
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) { event.preventDefault(); shell.openExternal(url); }
  });

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // 先显示主窗，再撤闪窗：顺序反了会出现「闪窗已关、主窗还没上」的白屏空档。
    // 原先固定等 650ms，机器慢时等够也一样空，机器快时又白等。
    mainWindow.show();
    mainWindow.focus();
    // 主窗首帧已就绪，闪窗再淡出，交接处不露底色
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    }, 120);
  });
}

/* ===== PDF · 一键导出 =====
 * 流程：点击按钮 → 立即弹原生「保存到」对话框 → 用户选好位置点保存 →
 * 隐藏窗口后台排版 + printToPDF 渲染 → 直接写盘 → 返回路径给页面提示。
 * 全程不出现打印界面。用 printToPDF 而不是 html2canvas 截图：
 * 截图式 PDF 是位图，文字放大会糊、也不能复制检索；printToPDF 输出矢量文字，
 * 配合导出文档里的 @media print 规则获得自然的 A4 分页。
 */
async function exportPdf({ html, suggestName }) {
  if (typeof html !== 'string' || html.length < 200) throw new Error('导出内容为空');
  const safe = String(suggestName || '作文批改报告')
    .replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 60) || '作文批改报告';

  // ① 先弹「保存到」：用户决定位置与文件名，取消则整个流程静默结束
  const picked = await dialog.showSaveDialog(mainWindow, {
    title: '导出 PDF 报告',
    defaultPath: path.join(app.getPath('downloads'), safe + '.pdf'),
    filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });
  if (picked.canceled || !picked.filePath) return { canceled: true };
  let filePath = picked.filePath;
  if (!/\.pdf$/i.test(filePath)) filePath += '.pdf';

  // ② 隐藏窗口离屏渲染：不闪窗、不影响用户当前画面
  // 宽度对齐 A4 内容宽（794px @96dpi），白板测量脚本按此宽度摆卡
  const win = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  // 真实作文带整页照片，HTML 可达数 MB，data:URL 会超出 Chromium 2MB 上限
  // （ERR_INVALID_URL，页面显示成乱码般的 URL 编码文本）。改写临时文件加载。
  const tmpFile = path.join(os.tmpdir(), `zhipi-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
  try {
    fs.writeFileSync(tmpFile, html, 'utf8');
    await win.loadFile(tmpFile);
    // 等图片、字体与导出文档自带的排版脚本全部就绪（脚本完成时置 __zpLayoutDone）
    await win.webContents.executeJavaScript(`
      (async () => {
        const imgs = [...document.images];
        await Promise.all(imgs.map(i => i.complete ? Promise.resolve()
          : new Promise(r => { i.onload = r; i.onerror = r; })));
        if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
        // 排版脚本最晚在 load 后 900ms 完成最后一轮摆卡，这里等它的完成标记
        const t0 = Date.now();
        while (!window.__zpLayoutDone && Date.now() - t0 < 4000) {
          await new Promise(r => setTimeout(r, 60));
        }
        return true;
      })()
    `, true);
    await new Promise(r => setTimeout(r, 200));   // 给最后一帧渲染留余量

    // ③ 后台生成 PDF（无任何打印对话框）
    const data = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,        // 背景色/圆角卡片/彩色表头都靠它
      preferCSSPageSize: true,      // 尊重导出文档里的 @page 设置
      margins: { marginType: 'default' }
    });
    // ④ 直接写盘到用户选定的位置
    fs.writeFileSync(filePath, data);
    return { canceled: false, filePath, fileName: path.basename(filePath), dir: path.dirname(filePath) };
  } finally {
    if (!win.isDestroyed()) win.destroy();
    try { fs.unlinkSync(tmpFile); } catch (e) { /* 临时文件清理失败不影响导出 */ }
  }
}

ipcMain.handle('zhipi:export-pdf', async (event, payload) => {
  // 只接受来自主窗口的请求，且参数结构受限
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('非法来源');
  }
  const body = payload && typeof payload === 'object' ? payload : {};
  return exportPdf({ html: body.html, suggestName: body.suggestName });
});

/* ===== HTML 报告 · 保存到自选位置 =====
 * 与 PDF 同一交互：先弹原生「保存到」对话框，用户选好位置点保存后直接写盘。
 * 不再走浏览器自动下载（那会固定落到下载目录，用户无法选位置）。 */
ipcMain.handle('zhipi:save-html', async (event, payload) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('非法来源');
  }
  const body = payload && typeof payload === 'object' ? payload : {};
  const html = body.html;
  if (typeof html !== 'string' || html.length < 200) throw new Error('导出内容为空');
  const safe = String(body.suggestName || '作文批改报告')
    .replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 60) || '作文批改报告';

  const picked = await dialog.showSaveDialog(mainWindow, {
    title: '导出 HTML 报告',
    defaultPath: path.join(app.getPath('downloads'), safe + '.html'),
    filters: [{ name: 'HTML 网页', extensions: ['html', 'htm'] }],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });
  if (picked.canceled || !picked.filePath) return { canceled: true };
  let filePath = picked.filePath;
  if (!/\.html?$/i.test(filePath)) filePath += '.html';
  // 带 BOM：Windows 记事本/旧浏览器直接双击打开不乱码
  fs.writeFileSync(filePath, '\ufeff' + html, 'utf8');
  return { canceled: false, filePath, fileName: path.basename(filePath), dir: path.dirname(filePath) };
});

app.whenReady().then(() => {
  createSplash();
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
