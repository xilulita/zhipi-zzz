/* ===== 预加载桥：仅向页面暴露 PDF 导出所需的最小接口 =====
 * 主窗口启用了 contextIsolation + sandbox，页面拿不到 Node 能力。
 * 这里只透出一个 invoke，且主进程侧会校验参数，不开放任意文件写入。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ZPNATIVE', {
  // html: 完整的导出文档源码；suggestName: 建议文件名（不含扩展名）
  // 两者都会先弹原生「保存到」对话框，用户选好位置后才写盘；取消返回 { canceled: true }
  exportPDF: (html, suggestName) => ipcRenderer.invoke('zhipi:export-pdf', { html, suggestName }),
  saveHTML: (html, suggestName) => ipcRenderer.invoke('zhipi:save-html', { html, suggestName }),
  // 是否具备原生保存能力（网页版回落到浏览器下载）
  hasPDF: true
});
