/* ===== 闪屏桥：把「进入工作台」按钮接到主进程 =====
 * 闪屏是独立小窗，启用了 contextIsolation + sandbox，页面本身无法直接操作其他窗口。
 * 这里只暴露两个最小能力：
 *   ① ready —— 主窗渲染完成后由主进程通知闪屏，按钮这才可点；
 *   ② enter —— 用户点击「进入工作台」时通知主进程显示主窗、关闭闪屏。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zpSplash', {
  onReady: (cb) => {
    ipcRenderer.once('zhipi:splash-ready', () => { try { cb(); } catch (e) {} });
  },
  enter: () => ipcRenderer.send('zhipi:splash-enter'),
  /* 主进程在关闭闪屏前发来淡出指令，让过渡更顺 */
  onFade: (cb) => {
    ipcRenderer.once('zhipi:splash-fade', () => { try { cb(); } catch (e) {} });
  }
});
