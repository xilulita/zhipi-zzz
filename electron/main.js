const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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
      console.log('[智批] 已从旧目录迁移历史数据:', from);
      return;
    } catch (e) {
      console.error('[智批] 旧数据迁移跳过:', e && e.message);
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
  console.error('[智批] 用户数据目录设置失败，回退默认:', e && e.message);
}

let mainWindow;
let splashWindow;

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 620,
    height: 360,
    frame: false,
    transparent: true,
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
    title: '智批作文专业版',
    backgroundColor: '#f5f6fa',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
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
