/* ===== 智批作文 · 导出模块（HTML · A4 分页 / 一键直下） =====
 * 自包含单文件 HTML，每页一个 A4 容器，点击即下载
 */
(function (global) {
  'use strict';

  const A4 = { w: 595.28, h: 841.89 };          // pt
  const PX = { w: 794, h: 1123 };               // 96dpi 下的 A4 像素

  /* ---------- 公共：取数据 ---------- */
  function collect(d) {
    const R = d.result;
    const sc = R.score, lv = R.level;
    const P = (R.essay.paras || []).filter(x => x && x.length > 2);
    const g = (window.ZP.GRADES.find(x => x.id === d.gradeId) || { name: '', total: 100, label: '' });
    const ge = (window.ZP.GENRES.find(x => x.id === d.genreId) || { name: '' });
    return {
      title: R.essay.title || d.name || '作文批改报告',
      stu: (d.note && d.note !== '未命名') ? d.note : '',
      grade: g.name, genre: ge.name, total: g.total, label: g.label,
      words: R.essay.words, paras: P, score: sc, level: lv,
      annos: R.annos || [],
      // 统一字段名：兼容 AI 返回的 title/detail/severity 与旧版 t/d/sev
      highlights: (R.report.highlights || []).map(h => ({
        t: h.t || h.title || '', d: h.d || h.detail || h.desc || ''
      })),
      issues: (R.report.issues || []).map(it => ({
        title: it.title || it.t || '',
        sev: it.sev || it.severity || 'low',
        desc: it.desc || it.d || it.detail || '',
        ex: it.ex || (it.quote ? `<s>${it.quote}</s>${it.fix ? ' → <b>' + it.fix + '</b>' : ''}` : '')
      })),
      review: R.report.review || '', img: d.img,
      dims: window.ZP.DIMS,
      pages: (d.pages && d.pages.length > 1)
        ? d.pages.map((pg, i) => ({ img: pg.img, w: pg.w, h: pg.h, page: i + 1 }))
        : null,
      dimComments: R.report.dimComments || {},
      // 优先取调用方（buildExportData）注入的字段，其次回落到 AI 报告字段
      polished: d.polished || R.report.polished || R.essay.polished || (R.essay.paras || []),
      drills: d.drills || R.report.drills || [],
      genreTips: d.genreTips || R.report.genreTips || [],
      outline: d.outline || R.report.outline || null
    };
  }


  /* 块渲染专用样式（与网页版一致的视觉语言） */
  /* ================= 统一导出样式（各页共用，确保版式一致） ================= */
  const EXPORT_CSS = `
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{margin:0;background:#fff;font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#22242b}

  /* ---- 品牌头 ---- */
  .brand{display:flex;align-items:center;gap:9px;margin-bottom:12px}
  .brand .lg{width:30px;height:30px;border-radius:9px;flex:0 0 30px;
    background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-size:17.8px;font-weight:800;
    display:flex;align-items:center;justify-content:center}
  .brand .nm{font-size:15.4px;font-weight:800;letter-spacing:.6px;line-height:1.2}
  .brand .rt{font-size:10.7px;color:#a4a9b6;line-height:1.6;white-space:nowrap}
  .brand .bmark{margin-left:auto;display:flex;align-items:center;gap:8px}
  .brand{padding-bottom:6px}
  .brand .bmark .nm{font-size:15.4px;font-weight:800;letter-spacing:.6px;line-height:1.2}
  .h1{font-size:27.3px;font-weight:800;letter-spacing:1px;margin:0 0 7px;line-height:1.3;word-break:break-word}
  .meta{font-size:11.9px;color:#8a90a0;margin-bottom:14px;line-height:1.7}

  /* ---- 分数条 ---- */
  .headrow{display:flex;align-items:flex-start;gap:22px;margin-bottom:12px;padding-right:2px}
  .headrow .hl{flex:1;min-width:0;padding-right:6px}
  .headrow .h1{margin-top:0}
  .headrow{align-items:center}
  .score{flex:0 0 auto;display:flex;align-items:center;gap:11px;flex-wrap:nowrap;
    background:linear-gradient(120deg,#f7f7ff,#fdf8ff);border:1px solid #e9e6fb;
    border-radius:11px;padding:12px 18px;white-space:nowrap;min-width:210px}
  .score .num{font-size:35.6px;font-weight:800;color:#5b5ce2;line-height:1}
  .score .den{font-size:14.3px;color:#b0b4c0;align-self:flex-end;padding-bottom:4px}
  .score .lv{margin-left:10px;padding-left:13px;border-left:1px solid #e6e3fb;text-align:left}
  .score .lv b{display:block;font-size:13.7px;color:#2a2c35;line-height:1.4;margin-bottom:2px}
  .score .lv span{font-size:10.7px;color:#9aa0ad;line-height:1.45}

  /* ---- 区块标题 ---- */
  .sec{font-size:16.1px;font-weight:800;margin:18px 0 9px;padding-left:9px;
    border-left:3.5px solid #5b5ce2;line-height:1.3}
  .sec:first-child{margin-top:0}
  .sec .tag{font-size:10.2px;font-weight:500;color:#9aa0ad;margin-left:7px}

  /* ================= 白板页：与软件内 board-frame 同一套视觉 ================= */
  /* 背景板：软件内 canvas-wrap 的渐变 + 点阵 */
  .pagewrap.pg-board{
    background:
      radial-gradient(circle at 50% 0%, rgba(255,255,255,.92), rgba(255,255,255,0) 62%),
      linear-gradient(180deg,#f4f6fa,#eaeef5) !important;
  }
  .pagewrap.pg-board::before{
    content:"";position:absolute;inset:0;pointer-events:none;
    background-image:radial-gradient(#d5d9e6 1px,transparent 1px);
    background-size:24px 24px;opacity:.16;
  }
  .pagewrap.pg-cover{
    background:linear-gradient(180deg,#fbfcff,#f4f6fb) !important;
  }

  /* 三列：左卡列 | 作文纸 | 右卡列，居中且左右留白对称 */
  .board3{
    position:relative;display:flex;align-items:flex-start;justify-content:center;
    width:100%;max-width:100%;margin:0 auto;gap:var(--gap,22px);box-sizing:border-box;
    margin-left:auto;margin-right:auto;
  }
  .board3 .col-side{
    position:relative;flex:0 0 auto;align-self:stretch;min-width:0;
  }
  .board3 .shot{
    position:relative;flex:0 0 auto;align-self:flex-start;
    border-radius:6px;background:#fff;overflow:visible;
    box-shadow:0 1px 3px rgba(20,23,45,.07),0 10px 30px rgba(20,23,45,.10);
  }
  .board3 .shot img{display:block;width:100%;height:100%;object-fit:fill;border-radius:5px}

  /* 图内划线痕迹 */
  .mk{position:absolute;border-radius:2px;box-sizing:border-box}
  .mk .mark-no,.mk-no{
    position:absolute;top:50%;transform:translateY(-50%);
    width:15px;height:15px;border-radius:50%;color:#fff;
    font-size:9.4px;font-weight:800;display:flex;align-items:center;justify-content:center;
    line-height:1;box-shadow:0 1px 4px rgba(20,23,45,.22);z-index:3;letter-spacing:0;
  }
  .mk .mark-no.left,.mk-no.left{left:-18px}
  .mk .mark-no.right,.mk-no.right{right:-18px}

  /* 批注卡：结构对齐软件内 .anno（彩色渐变底 + 编号 + 类型标签 + 正文） */
  .side-card{
    position:absolute;left:0;right:0;box-sizing:border-box;
    background:linear-gradient(180deg,#fff,#fff);
    border:1px solid #e9ebf2;border-radius:11px;
    padding:8px 10px 9px;
    box-shadow:0 1px 2px rgba(20,23,45,.04),0 4px 14px rgba(20,23,45,.05);
    word-break:break-word;overflow-wrap:anywhere;
  }
  .side-card .sc-head{display:flex;align-items:center;gap:5px;margin-bottom:5px;line-height:1}
  .side-card .sc-no{
    flex:0 0 15px;width:15px;height:15px;border-radius:50%;color:#fff;
    font-size:9.4px;font-weight:800;display:flex;align-items:center;justify-content:center;
    line-height:1;letter-spacing:0;
  }
  .side-card .sc-lb{
    display:inline-block;font-size:9.6px;font-weight:700;letter-spacing:.2px;
    padding:1.5px 6px;border-radius:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .side-card .sc-tx{
    font-size:10.4px;line-height:1.62;color:#4a4d57;
    word-break:break-word;overflow-wrap:anywhere;
  }
  .side-card .sc-tx b{color:#1a1b1f;font-weight:700}
  .side-card .sc-tx u{text-decoration-color:#8b5cf6;text-underline-offset:2px}

  /* 按类型着色，与软件内 .anno.err / .polish / .good / .dele 一致 */
  .side-card.err{background:linear-gradient(180deg,#fffbfb,#fff);border-color:#f6e3e2}
  .side-card.err .sc-lb{color:#d94a44;background:#fdeeee}
  .side-card.err .sc-tx b{box-shadow:inset 0 -7px 0 rgba(226,85,79,.14)}
  .side-card.polish{background:linear-gradient(180deg,#fffdf6,#fff);border-color:#f4ead2}
  .side-card.polish .sc-lb{color:#a97a10;background:#fdf6e6}
  .side-card.polish .sc-tx b{box-shadow:inset 0 -7px 0 rgba(217,162,35,.16)}
  .side-card.good{background:linear-gradient(180deg,#f9fdfb,#fff);border-color:#ddf0e7}
  .side-card.good .sc-lb{color:#1e8f60;background:#eaf7f1}
  .side-card.good .sc-tx b{box-shadow:inset 0 -7px 0 rgba(34,160,107,.13)}
  .side-card.dele{background:linear-gradient(180deg,#fcfaff,#fff);border-color:#ece3fb}
  .side-card.dele .sc-lb{color:#7c5cf0;background:#f3ecfd}
  .side-card.dele .sc-tx b{box-shadow:inset 0 -7px 0 rgba(139,92,246,.13)}

  /* 引线层 */
  .board3 .anno-lines{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:1}

  /* 页脚说明 */
  .pg-cap{
    margin-top:10px;text-align:center;font-size:10px;color:#9aa0ad;letter-spacing:.3px;
  }

  /* ---- 页码 ---- */
  .pagefoot{position:absolute;left:0;right:0;bottom:8px;text-align:center;
    font-size:9px;color:#c2c6d2;letter-spacing:.4px}

  /* ---- Tab 导航条 ---- */
  .tabbar{display:flex;gap:6px;margin:0 0 12px;padding:4px;background:#f4f5fa;border-radius:10px}
  .tabbar .tb{flex:1;text-align:center;font-size:11.9px;font-weight:600;color:#8a90a0;
    padding:7px 4px;border-radius:7px;white-space:nowrap}
  .tabbar .tb.on{background:#fff;color:#5b5ce2;font-weight:800;
    box-shadow:0 1px 4px rgba(20,23,45,.10)}

  /* ---- 四维 ---- */
  .dims{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}
  .dim{border:1px solid #eef0f6;border-radius:10px;padding:11px 13px;min-width:0}
  .dim .h{display:flex;align-items:center;gap:7px;font-size:13.1px;font-weight:800;margin-bottom:6px}
  .dim .h .dot{width:8px;height:8px;border-radius:2px;flex:0 0 8px}
  .dim .h .v{margin-left:auto;font-size:14.9px;font-weight:800;white-space:nowrap}
  .dim .h .v small{font-size:10.7px;font-weight:600;color:#b4b9c4}
  .dim .bar{height:5px;border-radius:9px;background:#f0f1f6;overflow:hidden;margin-bottom:6px}
  .dim .bar i{display:block;height:100%;border-radius:9px}
  .dim .c{font-size:10.9px;line-height:1.6;color:#6b7080;word-break:break-word}

  /* ---- 列表 ---- */
  .li{padding:9px 0;border-bottom:1px dashed #eef0f6;font-size:12.1px;line-height:1.7;color:#4a4d57;
    word-break:break-word}
  .li:last-child{border-bottom:none;padding-bottom:2px}
  .li b{color:#1a1b1f;font-size:12.6px}
  .li .sev{font-size:9.5px;padding:1px 6px;border-radius:4px;background:#f2f4f9;color:#8a90a0;
    margin-left:6px;vertical-align:2px;white-space:nowrap}
  .li .ex{margin-top:5px;padding:6px 9px;background:#fafbfd;border-left:2.5px solid #e4e7ef;
    font-size:11.1px;color:#6b7080;border-radius:0 5px 5px 0;line-height:1.6}
  .li .ex s{color:#b3b8c4}
  .li .ex b{color:#1e8f60;font-size:11.1px}

  /* ================= 写作思路：参考提纲 + 具体问题与修改思路 ================= */
  /* 区块一：外框浅灰蓝，标题带圆点，内部为纵向时间轴 */
  .ol-sec{
    border:1px solid #e6e9f2;border-radius:12px;background:#f7f9fd;
    padding:14px 16px 16px;margin-bottom:14px;
  }
  .ol-t{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:800;
    color:#2f6bdd;margin:0 0 5px;line-height:1.3}
  .ol-t .dot{width:7px;height:7px;border-radius:50%;background:#3b82f6;flex:0 0 7px}
  .ol-sub{font-size:10.6px;color:#8f96a8;line-height:1.7;margin:0 0 12px;padding-left:14px}
  .ol-sub .ol-br{display:block;margin-top:5px;color:#9aa2b4}

  /* 时间轴：左侧节点标签 + 中间竖线 + 右侧白卡 */
  .ol-flow{position:relative;padding-left:60px}
  .ol-flow::before{content:"";position:absolute;left:47px;top:12px;bottom:12px;
    width:1.5px;background:#dfe5f2}
  .ol-row{position:relative;margin-bottom:10px}
  .ol-row:last-child{margin-bottom:0}
  .ol-row .tag{
    position:absolute;left:-60px;top:2px;width:52px;text-align:center;
    font-size:10.4px;font-weight:700;line-height:20px;height:20px;border-radius:5px;
    letter-spacing:.3px;z-index:2;
  }
  .ol-row .tag::after{
    content:"";position:absolute;right:-9px;top:9px;width:9px;height:1.5px;background:#dfe5f2;
  }
  .ol-row .tag.s1{color:#3b82f6;background:#e8f0fe}
  .ol-row .tag.s2{color:#18885f;background:#e6f6ee}
  .ol-row .tag.s3{color:#c2760c;background:#fdf3e2}
  .ol-row .body{
    background:#fff;border:1px solid #e8ecf5;border-radius:9px;
    padding:9px 12px;font-size:11.4px;line-height:1.78;color:#4a4f5e;
  }
  .ol-row .body .lead{color:#2a2f3d;font-weight:700;margin-bottom:5px;display:block}
  .ol-row .body .item{display:flex;gap:6px;margin-top:4px;align-items:flex-start}
  .ol-row .body .item .n{
    flex:0 0 14px;height:14px;border-radius:50%;background:#eef2fb;color:#5f6b85;
    font-size:9px;font-weight:700;line-height:14px;text-align:center;margin-top:2px;
  }
  .ol-row .body .item span:last-child{flex:1;min-width:0;word-break:break-word}
  .ol-row .body .ex{
    margin-top:6px;padding:6px 9px;background:#f8fafd;border-radius:6px;
    font-size:10.8px;color:#6f7891;line-height:1.65;
  }
  .ol-row .body .ex em{font-style:normal;color:#8f96a8}

  /* 区块二：问题卡片（浅绿调 + 左侧绿竖条 + 编号标题 → 说明 → 步骤） */
  /* 区块二标题：普通标题直接接卡片，不套容器（对齐参考排版） */
  .fx-head{font-size:14.6px;font-weight:800;color:#2a2c35;margin:18px 0 5px;
    padding-left:9px;border-left:3.5px solid #35a06a;line-height:1.3}
  .fx-sub{font-size:10.6px;color:#8f96a8;line-height:1.65;margin:0 0 10px;padding-left:12px}
  .fx-list{margin-top:2px}
  .fx{
    background:linear-gradient(180deg,#f4fbf7,#fbfefc);
    border:1px solid #dff0e6;border-left:3.5px solid #35a06a;
    border-radius:10px;padding:12px 14px 13px;margin-bottom:10px;
  }
  .fx:last-child{margin-bottom:0}
  .fx-h{font-size:12.4px;font-weight:800;color:#1f3b2e;line-height:1.7;margin-bottom:5px}
  .fx-h .n{color:#2f8f60;margin-right:2px}
  .fx-d{font-size:11.2px;line-height:1.75;color:#5b666f;margin-bottom:8px}
  .fx-steps{border-top:1px dashed #dcece3;padding-top:8px}
  .fx-step{display:flex;gap:6px;font-size:11.1px;line-height:1.7;color:#4d5a54;
    margin-bottom:4px;align-items:flex-start}
  .fx-step:last-child{margin-bottom:0}
  .fx-step .sn{
    flex:0 0 14px;height:14px;border-radius:50%;background:#e3f2ea;color:#2f8f60;
    font-size:9px;font-weight:700;line-height:14px;text-align:center;margin-top:2px;
  }
  .fx-step span:last-child{flex:1;min-width:0;word-break:break-word}
  .fx-step b{color:#1f7a52;font-weight:700}

  /* ---- 小练笔 ---- */
  .drill{border:1px solid #eef0f6;border-radius:10px;padding:12px 14px;margin-bottom:10px}
  .drill .h{display:flex;align-items:center;gap:7px;margin-bottom:6px}
  .drill .n{width:18px;height:18px;flex:0 0 18px;border-radius:50%;
    background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-size:10.7px;
    font-weight:800;display:flex;align-items:center;justify-content:center}
  .drill .t{font-size:13.1px;font-weight:800;color:#2a2c35;min-width:0;word-break:break-word}
  .drill .t em{font-style:normal;font-size:10.9px;color:#8a90a0;margin-left:5px;font-weight:500}
  .drill .iss{font-size:10.9px;color:#b8730a;background:#fff8ec;border-radius:6px;
    padding:3px 8px;margin-bottom:7px;display:inline-block;line-height:1.5}
  /* 三行色块：问题（橙）/ 思路（绿）/ 例子（蓝） */
  .drill .r{font-size:11.3px;line-height:1.72;color:#4a4d57;display:flex;gap:8px;
    align-items:flex-start;border-radius:7px;padding:7px 10px;margin-bottom:6px}
  .drill .r .kk{flex:0 0 auto;font-size:9.4px;font-weight:800;
    border-radius:4px;padding:1.5px 6px;line-height:1.5;margin-top:1px;white-space:nowrap}
  .drill .r span:last-child{flex:1;min-width:0;word-break:break-word}
  .drill .r.prob{background:#fdf4e9;border-left:3px solid #e8a33d}
  .drill .r.prob .kk{color:#b8730a;background:#fbe8cd}
  .drill .r.idea{background:#ecf7ef;border-left:3px solid #4aa96c}
  .drill .r.idea .kk{color:#2f7d4f;background:#d8efe0}
  .drill .r.demo{background:#eef2fd;border-left:3px solid #5b7fd4}
  .drill .r.demo .kk{color:#3f5fa8;background:#dbe4fa}
  .drill .r.demo span:last-child{color:#40507a;font-family:"Songti SC","SimSun",serif;font-size:11px}

  /* ---- 总评 / 润色稿 ---- */
  .review{font-size:13.4px;line-height:2.1;text-align:justify;color:#3a3d47}
  .review p{margin:0 0 9px;text-indent:2em}
  .review b{color:#5b5ce2}
  .paper-txt{background:#fdfcf8;border:1px solid #f2efe6;border-radius:10px;padding:36px 40px;min-height:940px}
  /* ---- 本次润色说明 ---- */
  .pn-head{font-size:14px;font-weight:800;color:#2a2c35;margin:22px 0 5px;
    padding-left:9px;border-left:3.5px solid #4aa96c;line-height:1.3}
  .pn-sub{font-size:10.6px;color:#8f96a8;line-height:1.65;margin:0 0 10px;padding-left:12px}
  .pn-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
  .pn{border:1px solid #e9eef4;border-radius:9px;padding:9px 11px;background:#fbfcfe}
  .pn-n{font-size:11.6px;font-weight:800;color:#1f6b8a;margin-bottom:3px;display:flex;align-items:center;gap:5px}
  .pn-n::before{content:"·";color:#4aa96c;font-weight:900;font-size:15px;line-height:1}
  .pn-d{font-size:10.7px;line-height:1.7;color:#5b6472}
  .pn-s{margin-top:5px;font-size:10.5px;line-height:1.65;color:#7a8194;
    background:#f4f7fb;border-radius:5px;padding:5px 7px;word-break:break-word}
  .paper-txt .t{text-align:center;font-family:"Songti SC","SimSun",serif;font-size:19.5px;
    font-weight:800;margin-bottom:12px;letter-spacing:1.2px}
  .paper-txt p{font-family:"Songti SC","SimSun",serif;font-size:15.2px;line-height:2.4;
    text-indent:2em;margin:0 0 10px;text-align:justify;color:#33363f;word-break:break-word}
  `;

  const CSS_BLOCKS = EXPORT_CSS;

  /* ---------- 样式（A4 内页通用） ---------- */
  const CSS = ``;   /* 已废弃：统一使用 EXPORT_CSS */

  // ===== 块清单：每项可独立渲染、独立分页，不会被切开 =====
  /* 找出块内可安全断开的位置。
     规则：只在"完整的条目元素"之间切（.li / .note / .stp / .dim / .drill / .tipbox 等），
     条目内部的标题与正文绝不允许被拆开。 */
  function findCuts(el, totalH) {
    const baseTop = el.getBoundingClientRect().top;
    const cuts = [];
    const orphans = [];
    const ITEM = /(^|\s)(li|note|stp|dim|drill|tipbox|sec|card|fl|li-row|block)(\s|$)/;

    const yOf = node => Math.round(node.getBoundingClientRect().top - baseTop);
    const hOf = node => node.getBoundingClientRect().height;

    const addCut = node => {
      const y = yOf(node);
      if (hOf(node) >= 26 && y > 40 && y < totalH - 40) cuts.push(y);
      if (node.classList && node.classList.contains('sec')) {
        orphans.push(Math.round(node.getBoundingClientRect().bottom - baseTop));
      }
    };

    const walk = (node, depth) => {
      if (depth > 3) return;
      [...node.children].forEach(k => {
        const cls = String(k.className || '');
        const isItem = ITEM.test(cls);
        // 条目本身可以作为切点（在它之前断开），但不再往里切
        if (isItem) {
          addCut(k);
          // .li 这类条目内部还有嵌套时，只在"下一个条目"处切，不进入内部
          if (k.dataset && k.dataset.atomic === '1') return;
          return;
        }
        // 非条目容器（如 .card 的内容包裹层）继续下钻
        if (k.children.length) walk(k, depth + 1);
        else addCut(k);
      });
    };

    walk(el, 0);

    const bad = new Set(orphans);
    return [...new Set(cuts)]
      .filter(y => !bad.has(y) && !bad.has(y + 1) && !bad.has(y - 1))
      .sort((a, b) => a - b);
  }

  function getBlocks(o) {
    // 页面顺序（按优先级）：
    //   封面 → 第1页白板 → 第2页白板 → …（每页独立）
    //   → 全文概览 → 写作思路 → 小练笔 → 润色后文章（每 Tab 起始占新页，超出续页）
    const list = [
      { id: 'cover',  html: secCover(o), cover: true, fullPage: true, atomic: true },
      ...secBoardBlocks(o),
      { id: 'tabOverview', html: tabOverview(o), fullPage: true, tab: true },
      { id: 'tabOutline',  html: tabOutline(o),  fullPage: true, tab: true },
      { id: 'tabDrill',    html: tabDrill(o),    fullPage: true, tab: true },
      { id: 'tabPolish',   html: tabPolish(o),   fullPage: true, tab: true }
    ];
    return list.filter(b => b.html && b.html.trim());
  }

  /* ---- 四个 Tab 页：各自内容连续排布，装不下自动续页 ---- */
  function tabBar(active) {
    const tabs = [
      { k: 'overview', n: '全文概览' },
      { k: 'outline',  n: '写作思路' },
      { k: 'drill',    n: '小练笔' },
      { k: 'polish',   n: '润色后文章' }
    ];
    return `<div class="tabbar">${tabs.map(t =>
      `<span class="tb ${t.k === active ? 'on' : ''}">${t.n}</span>`).join('')}</div>`;
  }

  function tabOverview(o) {
    return `<div class="tabpage">${tabBar('overview')}
      ${secDims(o)}
      ${secHighlights(o)}
      ${secIssues(o)}
      ${secReview(o)}
    </div>`;
  }

  function tabOutline(o) {
    return `<div class="tabpage">${tabBar('outline')}
      ${secOutline(o)}
    </div>`;
  }

  function tabDrill(o) {
    return `<div class="tabpage">${tabBar('drill')}
      ${secDrills(o)}
    </div>`;
  }

  function tabPolish(o) {
    return `<div class="tabpage">${tabBar('polish')}
      ${secPolish(o)}
    </div>`;
  }

  /* 封面：标题 + 评分条（仅第一页） */
  function secCover(o) {
    // 封面首页：标题 + 评分 + 四维总览 + 总评摘要，让第一页有实质内容
    return `<div class="cover">
      ${secHead(o)}
      ${secDims(o)}
      ${secReview(o)}
    </div>`;
  }

  function secHead(o) {
    // 标题左、分数右（同一行，分数靠右上角）
    return `<div class="headrow">
      <div class="hl">
        <h1 class="h1">${esc(o.title)}</h1>
        <div class="meta">${esc([o.stu, o.grade, o.genre].filter(Boolean).join(' · '))}　|　${o.words} 字 · ${o.paras.length} 段</div>
      </div>
      ${secScore(o)}
    </div>`;
  }

  function secScore(o) {
    return `<div class="score">
      <span class="num">${o.score.total}</span><span class="den">/ ${o.total}</span>
      <span class="lv"><b>${o.level.name} · ${o.level.desc}</b><span>${esc([o.grade, o.label].filter(Boolean).join(' ') || '评分要求')}</span></span>
    </div>`;
  }

  /* 白板拆成多块：标题块 + 每页一块，便于逐页排版与自动续页 */
  /* 白板按页拆块：一页一块，各自独占一页，绝不缩放、绝不跨页切开 */
  function secBoardBlocks(o) {
    const pages = (o.pages && o.pages.length > 1)
      ? o.pages.map(pg => ({ img: pg.img, w: pg.w, h: pg.h, page: pg.page,
          annos: o.annos.filter(a => (a.page || 1) === pg.page) }))
      : [{ img: o.img, w: o.imgW, h: o.imgH, page: 1, annos: o.annos }];

    return pages.map((pg, i) => ({
      id: 'board' + i,
      html: boardPageHTML(pg, pages.length, { availW: o.boardW, availH: o.boardH }),
      atomic: true,          // 白板不可切分
      board: true,           // 标记：渲染后需要做真实测量排版
      fullPage: true,        // 每页白板独占一页
      pageData: pg,
      geometry: null,        // 测量阶段回填
      totalPages: pages.length,
      pageBreakBefore: i > 0
    }));
  }

/* ============ 白板页：真实测量排版（所见即所得） ============
 * 思路：不做高度估算。先把两侧批注卡真实插进 DOM，用 offsetHeight 量出真高，
 * 再按"中心对齐各自划线 → 自上而下消重叠 → 底部溢出上推"摆放。
 * 列宽按可用宽度自适应，吃满页面横向空间，两侧留白对称。
 */

/* 页面尺寸（96dpi 像素） —— 与软件内 board-frame 同一视觉语言 */
const PAGE = { w: 794, h: 1123 };

/* 构图：算出纸张宽高与两侧列宽，保证 纸 + 两列 + 间隙 ≤ 可用宽 */
function boardGeometry(pg, opts) {
  const o = opts || {};
  const availW = o.availW || 742;
  const availH = o.availH || 1000;
  const ratio = (pg.h && pg.w) ? (pg.h / pg.w) : 1.35;
  const safeRatio = Math.max(0.2, ratio);

  const GAP = 22;                                  // 卡片与纸张之间的留白（走线空间）
  const wide = safeRatio < 0.9;

  // 纸张高度先定：占可用高的 86%，给卡片上下溢出留余地
  const maxPaperH = o.maxPaperH || Math.round(availH * 0.98);

  // 由高度按比例反推纸张宽（保持原图比例，绝不拉伸）
  let paperH = maxPaperH;
  let paperW = Math.round(paperH / safeRatio);

  // 横向上限：竖幅图占可用宽 60%，宽幅图占 56%
  const targetRatioW = wide ? 0.54 : 0.56;
  const wantW = Math.round(availW * targetRatioW);
  paperW = Math.max(240, Math.min(paperW, wantW));
  paperH = Math.round(paperW * safeRatio);
  if (paperH > maxPaperH) { paperH = maxPaperH; paperW = Math.round(paperH / safeRatio); }

  // 余下宽度严格平分给两列 —— 纸张+两列+两间隙 == 可用宽，flex 不再压缩纸张
  let sideW = Math.floor((availW - paperW - GAP * 2) / 2);
  if (sideW < 132) {
    sideW = 132;
    paperW = Math.max(240, availW - sideW * 2 - GAP * 2);
    paperH = Math.round(paperW * safeRatio);
    if (paperH > maxPaperH) { paperH = maxPaperH; paperW = Math.round(paperH / safeRatio); }
  }

  return {
    availW, availH, colW: sideW, gap: GAP, ratio: safeRatio,
    paperW, paperH,
    colH: Math.max(paperH, availH),
    totalW: paperW + sideW * 2 + GAP * 2
  };
}

/* 生成白板页 HTML（无绝对定位，卡片先按真实流布好，交给 placeCards 摆放） */
function boardPageHTML(pg, totalPages, opts) {
  const o = opts || {};
  const g = boardGeometry(pg, o);
  const annos = pg.annos || [];
  // 只有坐标完整且有限的批注才画到纸面上；未定位的只出现在两侧卡片里
  const valid = annos.filter(a => a.located !== false
    && Number.isFinite(a.x) && Number.isFinite(a.y)
    && Number.isFinite(a.w) && Number.isFinite(a.h));
  const left = valid.filter(a => a.side !== 'right').sort((x, z) => x.y - z.y);
  // 未定位的批注不画纸面标记，但仍要作为卡片呈现，学生才能读到这条意见
  const unloc = annos.filter(a => valid.indexOf(a) < 0);
  left.push(...unloc.filter(a => a.side !== 'right'));
  const right = valid.filter(a => a.side === 'right')
    .concat(unloc.filter(a => a.side === 'right'))
    .sort((x, z) => (Number.isFinite(x.y) ? x.y : 0.5) - (Number.isFinite(z.y) ? z.y : 0.5));
  const marks = markLayerHTML(pg, g, valid);
  const cap = totalPages > 1
    ? `第 ${pg.page} / ${totalPages} 页 · ${annos.length} 条批注`
    : `${annos.length} 条批注`;

  return `<div class="board3" data-page="${pg.page || 1}"
      style="--paperW:${g.paperW}px;--paperH:${g.paperH}px;--colW:${g.colW}px;--gap:${g.gap}px">
    <div class="col-side left" data-side="left" style="width:${g.colW}px">${left.map(a => annoCardHTML(a)).join('')}</div>
    <div class="shot" style="width:${g.paperW}px;height:${g.paperH}px">
      <img src="${pg.img}" alt="" style="width:100%;height:100%;display:block;object-fit:fill">
      ${marks}
    </div>
    <div class="col-side right" data-side="right" style="width:${g.colW}px">${right.map(a => annoCardHTML(a)).join('')}</div>
  </div>
  <div class="pg-cap">${cap}</div>`;
}

/* 图内划线 + 编号（编号贴在划线起点/终点，与软件内一致） */
function markLayerHTML(pg, g, list) {
  const colors = { err: '#e2554f', polish: '#d9a223', good: '#22a06b', dele: '#8b5cf6' };
  return list.map(a => {
    const c = colors[a.type] || '#5b5ce2';
    const side = a.side === 'right' ? 'right' : 'left';
    return `<div class="mk ${a.type}" data-side="${side}"
      style="left:${(a.x * 100).toFixed(3)}%;top:${(a.y * 100).toFixed(3)}%;
      width:${(a.w * 100).toFixed(3)}%;height:${Math.max(0.6, a.h * 100).toFixed(3)}%;
      border-bottom:2.2px solid ${c};background:${hexA(c, .12)}">
      <span class="mark-no ${side}" style="background:${c}">${a.no || ''}</span>
    </div>`;
  }).join('');
}

/* 单张批注卡：结构对齐软件内 .anno（彩色渐变底 + 类型标签 + 编号） */
function annoCardHTML(a) {
  const colors = { err: '#e2554f', polish: '#d9a223', good: '#22a06b', dele: '#8b5cf6' };
  const names = { err: '错别字 / 病句', polish: '润色建议', good: '优秀好句', dele: '删改' };
  const c = colors[a.type] || '#5b5ce2';
  return `<div class="side-card ${a.type}" data-a="${a.id}" data-y="${a.y}" data-anchor-y="${a.y}"
    style="--mark:${c}">
    <div class="sc-head"><span class="sc-no" style="background:${c}">${a.no || ''}</span>
      <span class="sc-lb" style="color:${a.type === 'err' ? '#d94a44' : a.type === 'polish' ? '#a97a10' : a.type === 'good' ? '#1e8f60' : '#7c5cf0'}">${names[a.type] || '批注'}</span>
    </div>
    <div class="sc-tx">${a.html}</div>
  </div>`;
}

/* 关键：真实测量后摆放。
 * root 为已插入文档的白板页容器，返回每张卡的最终矩形，供引线绘制。 */
function placeCards(root, geometry) {
  const g = geometry || {};
  const shot = root.querySelector('.shot');
  if (!shot) return [];
  const paperH = shot.getBoundingClientRect().height;
  const box = root.getBoundingClientRect();
  const placed = [];

  ['left', 'right'].forEach(side => {
    const col = root.querySelector(`.col-side.${side}`);
    if (!col) return;
    const cards = [...col.querySelectorAll('.side-card')];
    if (!cards.length) return;

    col.style.height = paperH + 'px';

    // 一、测真高（先按原始样式量）
    let items = cards.map(el => ({
      el,
      h: el.getBoundingClientRect().height,
      anchor: (parseFloat(el.dataset.anchorY) || 0) * paperH
    })).sort((x, z) => x.anchor - z.anchor);

    // 一·补：若卡片总高超出纸张高度，先压缩卡片内部排版，而不是硬挤成一团
    const GAP0 = 12;
    const needOf = list => list.reduce((a, it) => a + it.h, 0) + GAP0 * (list.length - 1);
    if (needOf(items) > paperH && paperH > 0) {
      // 逐档压缩字号与内边距，找到能放进纸张的那一档
      const steps = [1, 0.94, 0.88, 0.82, 0.76, 0.70];
      for (const k of steps) {
        if (k === 1) continue;
        cards.forEach(el => {
          el.style.setProperty('--k', k);
          const tx = el.querySelector('.sc-tx');
          const hd = el.querySelector('.sc-head');
          if (tx) tx.style.fontSize = (10.4 * k).toFixed(2) + 'px';
          if (tx) tx.style.lineHeight = (1.62 * (0.9 + 0.1 * k)).toFixed(2);
          if (hd) hd.style.marginBottom = (5 * k).toFixed(1) + 'px';
          el.style.padding = `${(8 * k).toFixed(1)}px ${(10 * k).toFixed(1)}px ${(9 * k).toFixed(1)}px`;
        });
        items = cards.map(el => ({
          el,
          h: el.getBoundingClientRect().height,
          anchor: (parseFloat(el.dataset.anchorY) || 0) * paperH
        })).sort((x, z) => x.anchor - z.anchor);
        if (needOf(items) <= paperH) break;
      }
      // 仍放不下：收紧卡片间隙
      if (needOf(items) > paperH) { /* 由下方上推兜底 */ }
    }

    // 二、中心对齐各自划线（与软件内 layoutAnnos 同一规则），限制在列内
    items.forEach(it => {
      it.top = Math.max(0, Math.min(it.anchor - it.h / 2, Math.max(0, paperH - it.h)));
    });

    // 三、自上而下消重叠，间隙 GAP（与软件内一致，略放大避免视觉拥挤）
    const GAP = 12;
    items.sort((x, z) => x.top - z.top);
    let cursor = 0;
    items.forEach(it => {
      it.top = Math.max(it.top, cursor);
      cursor = it.top + it.h + GAP;
    });

    // 四、底部溢出：从后往前整体上推，仍不够则整体上移并允许列变高
    let overflow = cursor - GAP - paperH;
    if (overflow > 0) {
      for (let i = items.length - 1; i >= 0 && overflow > 0; i--) {
        const minTop = i === 0 ? 0 : items[i - 1].top + items[i - 1].h + GAP;
        const shift = Math.min(overflow, items[i].top - minTop);
        items[i].top -= shift;
        overflow -= shift;
      }
    }
    // 五、消除小数误差后写回定位
    items.forEach(it => {
      it.el.style.position = 'absolute';
      it.el.style.left = '0';
      it.el.style.right = '0';
      it.el.style.top = Math.round(it.top) + 'px';
      const r = it.el.getBoundingClientRect();
      placed.push({
        el: it.el, side,
        top: Math.round(it.top),
        h: Math.round(r.height),
        bottom: Math.round(it.top + r.height),
        anchor: Math.round(it.anchor),
        no: (it.el.querySelector('.sc-no') || {}).textContent || ''
      });
    });
  });

  return placed;
}

/* 用 SVG 画引线：卡片边缘 → 纸张内划线端点，只走两侧留白，不横穿图片 */
function connectorsSVG(root, placed, geometry) {
  const g = geometry || {};
  const shot = root.querySelector('.shot');
  if (!shot || !placed.length) return '';
  const host = root.getBoundingClientRect();
  const sr = shot.getBoundingClientRect();
  const H = Math.round(sr.height);
  const W = Math.round(host.width);
  const lines = placed.map(p => {
    const color = getComputedStyle(p.el).getPropertyValue('--mark').trim() || '#5b5ce2';
    const cardEdge = p.side === 'left' ? sr.left - host.left - g.gap : sr.right - host.left + g.gap;
    const paperEdge = p.side === 'left' ? sr.left - host.left : sr.right - host.left;
    const y1 = p.top + 14;                       // 卡片标题行高度
    const y2 = Math.round(sr.top - host.top) + p.anchor;
    const midX = (cardEdge + paperEdge) / 2;
    // 折线：卡片边 → 中线 → 纸张边划线处
    const d = `M ${cardEdge} ${y1} H ${midX} L ${paperEdge} ${y2}`;
    return `<path d="${d}" stroke="${color}" stroke-width="1.1" fill="none" opacity=".55"
      stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  return `<svg class="anno-lines" width="${W}" height="${H}" style="position:absolute;left:0;top:0;
    pointer-events:none;overflow:visible;z-index:1">${lines}</svg>`;
}

function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g2 = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g2},${b},${a})`;
}

  /* 兼容旧入口：整块白板（多页时依次输出） */
  function secBoard(o) {
    const pages = (o.pages && o.pages.length > 1)
      ? o.pages.map(pg => ({ img: pg.img, w: pg.w, h: pg.h, page: pg.page,
          annos: o.annos.filter(a => (a.page || 1) === pg.page) }))
      : [{ img: o.img, w: o.imgW, h: o.imgH, page: 1, annos: o.annos }];
    // 每页白板独立成一页，由页尾脚本做真实测量摆卡
    return pages.map((pg, i) => `<div class="sheet-page" data-page="${pg.page}">
      <div class="sheet-inner">${boardPageHTML(pg, pages.length, {
        availW: PAGE.w - 40, availH: PAGE.h - 76
      })}</div></div>`).join('');
  }

  function secDims(o) {
    const dims = o.dims.map(dm => {
      const p = o.score.points[dm.key];
      return `<div class="dim">
        <div class="h"><span class="dot" style="background:${dm.color}"></span>${dm.name}
          <span class="v" style="color:${dm.color}">${p.got}<small> / ${p.full}</small></span></div>
        <div class="bar"><i style="width:${Math.round(p.quant * 100)}%;background:${dm.color}"></i></div>
        <div class="c">${esc((o.dimComments && o.dimComments[dm.key]) || p.comment || dm.hint || '')}</div>
      </div>`;
    }).join('');
    return `<div class="sec">四维评分</div><div class="dims">${dims}</div>`;
  }

  function secHighlights(o) {
    const hl = o.highlights.map((h, i) =>
      `<div class="li"><b>${i + 1}. ${esc(h.t)}</b><div style="margin-top:4px">${h.d}</div></div>`).join('');
    return `<div class="sec">文章亮点</div>${hl}`;
  }

  function secIssues(o) {
    const iss = o.issues.map((it, i) => `<div class="li">
      <b>${i + 1}. ${esc(it.title)}</b><span class="sev">${it.sev === 'high' ? '重要' : it.sev === 'mid' ? '中等' : '轻微'}</span>
      <div style="margin-top:4px">${esc(it.desc)}</div>
      ${it.ex ? `<div class="ex">${it.ex}</div>` : ''}</div>`).join('');
    return `<div class="sec">问题</div>${iss}`;
  }

  /* ================= 写作思路 =================
   * 结构参考实际批改排版：
   *   一、参考写作思路 —— 先诊断全文现状，再按「开头 / 展开 / 细节 / 转折 / 结尾」
   *        给出可执行方向，纵向时间轴 + 节点标签 + 白卡。
   *   二、具体问题与修改思路 —— 以问题句作小标题，先概括问题，再给可操作步骤与示例。
   */
  function outlineData(o) {
    const P = (o.paras || []).filter(x => x && String(x).trim().length > 2);
    const issues = o.issues || [];
    const cnt = s => String(s || '').replace(/\s+/g, '').length;
    const full = P.join('');
    const cut = (t, n) => String(t || '').replace(/\s+/g, '').slice(0, n);
    const words = o.words || cnt(full);

    /* ---------- 全文现状诊断（供读者先看清底子） ---------- */
    const longSents = P.filter(t => /[^。！？；]{42,}/.test(t));
    const hasDialog = /[“"][^”"]{2,}[”"]/.test(full);
    const hasSense = /(听见|闻到|摸到|闻到|凉|暖|响|香|光|影|烫|冷)/.test(full);
    const hasImage = /(像|仿佛|好似|如同)/.test(full);
    const longest = P.reduce((a, b) => (cnt(b) > cnt(a) ? b : a), P[0] || '');
    const shortest = P.reduce((a, b) => (cnt(b) < cnt(a) || !a ? b : a), P[0] || '');
    const spread = P.length >= 2 ? (cnt(longest) - cnt(shortest)) : 0;

    const diag = [];
    diag.push(`全文 ${cnt(full) || words} 字、${P.length} 段，${P.length && cnt(full) / P.length > 90 ? '段落偏长，可再切分' : '段落长度适中'}`);
    if (hasDialog) diag.push('有人物对话，叙述有现场感');
    else diag.push('全篇没有人物原话，可加一句对话让场景活起来');
    if (hasSense) diag.push('写到了声音 / 触感等感官细节');
    else diag.push('缺少感官细节，画面偏“看”不偏“感”');
    if (hasImage) diag.push('用了比喻，语言有形象感');
    if (longSents.length) diag.push(`有 ${longSents.length} 处长句未断开`);
    if (spread > 40) diag.push('段落长短差距较大，节奏可再匀一匀');
    const diagLine = diag.slice(0, 4).join('；') + '。';

    /* ---------- 一、参考写作思路：按段落功能给方向 ---------- */
    const nodes = [
      {
        tag: '开头', cls: 's1',
        lead: '用具体画面切入，先把人放进场景里',
        items: [
          '起笔给一个能看见的镜头：时间、地点、一个正在发生的动作。',
          '主角出场时写他在做什么，不要先写他在“想”什么。',
          hasDialog ? '可以在开头埋一句原话，让读者先听见声音。'
                    : '可以在开头埋一句人物的原话，先声夺人。'
        ],
        ex: P[0] ? `本文开头：“${cut(P[0], 30)}…”` : ''
      },
      {
        tag: '展开', cls: 's2',
        lead: '选一个片段慢镜头细写，把“经过”写具体',
        items: [
          '先交代起因：什么打破了原来的平静，一句话说清。',
          '只选一个关键瞬间，按“先做什么 → 再做什么 → 最后做什么”推进。',
          '每写一个动作，后面跟一处身体反应或环境细节。'
        ],
        ex: P[1] ? `本文中段：“${cut(P[1], 30)}…”` : ''
      },
      {
        tag: '细节', cls: 's2',
        lead: '把概括性的说法换成可感的具体',
        items: [
          hasSense ? '保留现有感官描写，再补一处与情绪相反的感觉，反差更有力。'
                   : '补一处声音或触感，比如水声、掌心温度、指尖的粗糙。',
          '把“我很感动 / 很难过”这类词划掉，改写成身体反应。',
          hasImage ? '比喻保留一个最贴切的，删掉重复的。'
                   : '给最关键的物件配一个来自生活的比喻。'
        ],
        ex: longest ? `可改写的段落：“${cut(longest, 26)}…”` : ''
      },
      {
        tag: '转折', cls: 's3',
        lead: '在情绪变化处放慢，给一个“停住”的瞬间',
        items: [
          '在“想做”和“没做”之间补一个犹豫的动作。',
          '用一句原话或一个意外，把情绪推到转折点。',
          '转折之后不要立刻解释，先让动作说完。'
        ],
        ex: longSents.length ? `注意长句：“${cut(longSents[0], 26)}…”建议在此断句。` : ''
      },
      {
        tag: '结尾', cls: 's3',
        lead: '回到开头的意象，把感受藏在画面里',
        items: [
          '让开头出现过的那件物或那个声音再出现一次，形成回环。',
          '停在动作或画面上，不解释、不喊口号。',
          '如果一定要点题，只用一句，且要短。'
        ],
        ex: P.length ? `本文结尾：“${cut(P[P.length - 1], 28)}…”` : ''
      }
    ];

    /* ---------- 二、具体问题与修改思路 ---------- */
    const fixSteps = (it) => {
      const t = (it.title || '') + (it.desc || '');
      if (/长句|断句|逗号|40|45/.test(t)) {
        return ['先把这句话单独抄到一张纸上，找到“可 / 但 / 于是 / 却”这类转折词。',
          '在转折词前面断开，前后各留半句，读一遍，不喘气就对了。',
          '断开后检查前半句主语是否还在，没有就把主语补上。'];
      }
      if (/错别字|病句|的|地|得|标点|成分|助词/.test(t)) {
        return ['把原句抄下来，逐字读一遍，标出可疑处。',
          '按“修饰名词用的、修饰动词用地、补充说明用得”逐处核对。',
          '改完再读一遍，确认句子成分完整、不残缺。'];
      }
      if (/情绪|概括|抽象|感动|难过|开心|紧张/.test(t)) {
        return ['把“我很感动 / 很难过”这类概括词先划掉。',
          '问自己：那一刻手在做什么？眼睛看见了什么？喉咙、鼻子什么感觉？',
          '选一个最清楚的身体反应写进去，比如“鼻子一酸，眼眶忽然热了一下”。'];
      }
      if (/重复|啰嗦|删|冗余/.test(t)) {
        return ['找出与前文意思相同的句子，只保留最有力的一句。',
          '删掉后读上下文，若跳跃就补半句过渡。',
          '删完再看字数，若明显变短，把省下的篇幅补给细节。'];
      }
      if (/节奏|平|起伏|层次/.test(t)) {
        return ['把这一段按句子数一数，如果连续三句长度接近，就拆一句短的。',
          '在最关键处单独成句，用短句制造停顿。',
          '段与段之间留一个空行或一句过渡，让读者喘口气。'];
      }
      return ['先定位问题句，把它单独抄出来。',
        '按“是什么问题 → 怎么改 → 改完读一遍”三步处理。',
        '改完放回原文，确认与上下文衔接自然。'];
    };

    const fixes = issues.slice(0, 3).map((it, i) => ({
      t: it.title || `问题 ${i + 1}`,
      d: it.desc || '',
      quote: it.quote || '',
      fix: it.fix || '',
      steps: fixSteps(it)
    }));
    return { diagLine, nodes, fixes };
  }

  /* 渲染：写作思路（面板与导出共用 outlineData 的数据） */
  function secOutline(o) {
    /* ---------- 拼装（数据来自 outlineData，面板复用同一份） ---------- */
    const D = outlineData(o);
    const { diagLine, nodes, fixes } = D;
    const flowHTML = nodes.map(n => `
      <div class="ol-row">
        <span class="tag ${n.cls}">${n.tag}</span>
        <div class="body">
          <span class="lead">${esc(n.lead)}</span>
          ${n.items.map((s, i) => `<div class="item"><span class="n">${i + 1}</span><span>${esc(s)}</span></div>`).join('')}
          ${n.ex ? `<div class="ex"><em>${esc(n.ex)}</em></div>` : ''}
        </div>
      </div>`).join('');

    const fixHTML = fixes.map((f, i) => `
      <div class="fx">
        <div class="fx-h"><span class="n">${i + 1}.</span>${esc(f.t)}</div>
        ${f.d ? `<div class="fx-d">${esc(f.d)}</div>` : ''}
        <div class="fx-steps">
          ${f.steps.map((s, k) => `<div class="fx-step"><span class="sn">${k + 1}</span><span>${esc(s)}</span></div>`).join('')}
        </div>
      </div>`).join('');

    return `<div class="sec">写作思路</div>

      <div class="ol-sec">
        <div class="ol-t"><span class="dot"></span>参考写作思路</div>
        <p class="ol-sub">先看现状：${esc(diagLine)}<span class="ol-br">下面按段落功能给出一条可参考的写法路径，可对照自己的作文逐段调整。</span></p>
        <div class="ol-flow">${flowHTML}</div>
      </div>

      ${fixes.length ? `
        <div class="fx-head">具体问题与修改思路</div>
        <p class="fx-sub">针对本篇最值得优先处理的 ${fixes.length} 处问题，每条给出可落地的改法。</p>
        <div class="fx-list">${fixHTML}</div>` : ''}
    `;
  }

  function secDrills(o) {
    const list = o.drills || [];
    if (!list.length) return '';
    // 卡片结构对齐参考排版：问题（橙）/ 思路（绿）/ 例子（蓝）
    return `<div class="sec">小练笔<span class="tag">针对本文薄弱点</span></div>
      ${list.map((b, i) => `<div class="drill">
        <div class="h"><span class="n">${i + 1}</span><span class="t">${esc(b.key)}<em>· ${esc(b.focus)}</em></span></div>
        ${b.related ? `<div class="iss">对应问题：${esc(b.related)}</div>` : ''}
        <div class="r prob"><span class="kk">问题</span><span>${esc(b.issue || '')}</span></div>
        <div class="r idea"><span class="kk">思路</span><span>${esc(b.idea || '')}</span></div>
        <div class="r demo"><span class="kk">例子</span><span>${esc(b.demo || '')}</span></div>
      </div>`).join('')}`;
  }

  function secReview(o) {
    const html = String(o.review).split(/<br\s*\/?>/i).filter(x => x.trim())
      .map(p => `<p>${p}</p>`).join('') || `<p>${esc(o.review)}</p>`;
    return `<div class="sec">教师总评</div><div class="review">${html}</div>`;
  }

  function secPolish(o) {
    const lvTag = [o.grade, o.label].filter(Boolean).join(' · ');
    const notes = o.polishNotes || [];
    return `<div class="sec">润色后文章${lvTag ? `<span class="tag">${esc(lvTag)}</span>` : ''}</div>
      <div class="paper-txt"><div class="t">${esc(o.title)}</div>
        ${o.polished.map(t => `<p>${esc(t)}</p>`).join('')}</div>
      ${notes.length ? `<div class="pn-head">本次润色说明</div>
      <div class="pn-sub">以下为本次润色实际改动的方向，原文的意思、顺序与人物均未改动。</div>
      <div class="pn-grid">
        ${notes.map(n => `<div class="pn">
          <div class="pn-n">${esc(n.name)}</div>
          <div class="pn-d">${esc(n.desc)}</div>
          ${n.sample ? `<div class="pn-s">${esc(n.sample)}</div>` : ''}
        </div>`).join('')}
      </div>` : ''}`;
  }

  function secFooter(o) { return ''; }

  /* 长文档：每页一个 A4 页容器，白板页内嵌真实测量脚本 */
  function buildLongDocument(o) {
    if (!Array.isArray(o.polished)) o.polished = (o.paras || []);
    if (!Array.isArray(o.drills)) o.drills = [];
    if (!Array.isArray(o.genreTips)) o.genreTips = [];
    if (!o.imgW || !o.imgH) { o.imgW = 760; o.imgH = 1000; }

    // ===== 区块顺序（作文图与批注在最前，其后依次是标题、四维、总评与各 Tab）=====
    const boards = boardPageList(o);            // 每个作文页一块白板，纵向依次排列
    const blocks = [
      { id: 'board',  html: boards.join(''),          cls: 'sec-board' },
      { id: 'head',   html: secCover(o),              cls: 'sec-cover' },
      { id: 'ov',     html: tabOverview(o),           cls: 'sec-tab' },
      { id: 'out',    html: tabOutline(o),            cls: 'sec-tab' },
      { id: 'drill',  html: tabDrill(o),              cls: 'sec-tab' },
      { id: 'polish', html: tabPolish(o),             cls: 'sec-tab' }
    ].filter(b => b.html && b.html.trim());

    const body = blocks
      .map(b => `<section class="blk ${b.cls}">${b.html}</section>`)
      .join('');

    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(o.title)} · 智批作文</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:#f4f6fa;-webkit-font-smoothing:antialiased;
    font-family:"PingFang SC","Microsoft YaHei",sans-serif}

  /* ===== 单一长页：不分页，内容自上而下连续排布 ===== */
  .doc{
    /* 宽度随最宽区块（白板三栏）自适应，最小 794，保证任意内容都居中不溢左 */
    width:max-content;min-width:794px;max-width:100%;
    margin:0 auto;background:#fff;position:relative;
  }
  /* 正文类区块限制在 794 的阅读宽度内并居中 */
  .blk{padding:22px 26px 0;max-width:794px;margin:0 auto}
  .blk.sec-board{padding:20px 26px 8px}
  .blk:last-child{padding-bottom:34px}
  /* 白板区作为开篇，宽度跟随三栏内容，不额外限宽 */
  .blk.sec-board{max-width:none}
  /* 标题区在其后，与白板之间留出呼吸空间 */
  .blk.sec-cover{padding-top:10px;border-top:1px solid #eef0f6}
  .blk.sec-tab{padding-top:26px}

  /* 白板：多页作文纵向排列时，页与页之间留出间隔 */
  /* 多页作文：每页白板独立成块，页间留出明显间距 */
  .blk.sec-board .board3{justify-content:center;margin:0 auto}
  .blk.sec-board .pg-cap{margin:12px 0 34px}
  .blk.sec-board .pg-cap:last-child{margin-bottom:6px}

  @page{size:A4 portrait;margin:10mm}
  @media print{
    body{background:#fff}
    .doc{width:auto}
    .blk{page-break-inside:auto}
    .blk.sec-cover{page-break-before:always}
    .blk.sec-tab{page-break-before:always}
    .board3{page-break-inside:avoid}
  }
  ${EXPORT_CSS}
</style></head>
<body>
<div class="doc" id="doc">${body}</div>
<script>
(function(){
  /* 一、白板真实测量摆卡 */
  function placeAll(){
    var roots = [].slice.call(document.querySelectorAll('.board3'));
    roots.forEach(function(root){
      var shot = root.querySelector('.shot');
      if (!shot) return;
      var paperH = shot.getBoundingClientRect().height;
      ['left','right'].forEach(function(side){
        var col = root.querySelector('.col-side.' + side);
        if (!col) return;
        var cards = [].slice.call(col.querySelectorAll('.side-card'));
        if (!cards.length) return;
        col.style.height = paperH + 'px';
        var items = cards.map(function(el){
          return { el: el, h: el.getBoundingClientRect().height,
                   anchor: (parseFloat(el.dataset.anchorY) || 0) * paperH };
        }).sort(function(a,b){ return a.anchor - b.anchor; });
        // 卡片总高超出纸张：逐档压缩字号与留白，避免硬挤成一团
        var needOf = function(list){
          return list.reduce(function(a,it){ return a + it.h; }, 0) + 12 * Math.max(0, list.length - 1);
        };
        if (needOf(items) > paperH) {
          [0.94, 0.88, 0.82, 0.76, 0.70].forEach(function(k){
            if (needOf(items) <= paperH) return;
            cards.forEach(function(el){
              var tx = el.querySelector('.sc-tx'), hd = el.querySelector('.sc-head');
              if (tx){ tx.style.fontSize = (10.4*k).toFixed(2)+'px';
                       tx.style.lineHeight = (1.62*(0.9+0.1*k)).toFixed(2); }
              if (hd) hd.style.marginBottom = (5*k).toFixed(1)+'px';
              el.style.padding = (8*k).toFixed(1)+'px '+(10*k).toFixed(1)+'px '+(9*k).toFixed(1)+'px';
            });
            items = cards.map(function(el){
              return { el: el, h: el.getBoundingClientRect().height,
                       anchor: (parseFloat(el.dataset.anchorY) || 0) * paperH };
            }).sort(function(a,b){ return a.anchor - b.anchor; });
          });
        }
        items.forEach(function(it){
          it.top = Math.max(0, Math.min(it.anchor - it.h/2, Math.max(0, paperH - it.h)));
        });
        var GAP = 12, cursor = 0;
        items.sort(function(a,b){ return a.top - b.top; });
        items.forEach(function(it){
          it.top = Math.max(it.top, cursor);
          cursor = it.top + it.h + GAP;
        });
        var over = cursor - GAP - paperH;
        if (over > 0){
          for (var i = items.length - 1; i >= 0 && over > 0; i--){
            var minTop = i === 0 ? 0 : items[i-1].top + items[i-1].h + GAP;
            var shift = Math.min(over, items[i].top - minTop);
            items[i].top -= shift; over -= shift;
          }
        }
        items.forEach(function(it){
          it.el.style.position = 'absolute';
          it.el.style.left = '0'; it.el.style.right = '0';
          it.el.style.top = Math.round(it.top) + 'px';
        });
      });
      drawLines(root);
    });
  }

  /* 二、引线：卡片边 → 纸张内划线，只走两侧留白 */
  function drawLines(root){
    var shot = root.querySelector('.shot');
    if (!shot) return;
    var old = root.querySelector('.anno-lines');
    if (old) old.remove();
    var rootR = root.getBoundingClientRect();
    var sr = shot.getBoundingClientRect();
    var gap = parseFloat(getComputedStyle(root).getPropertyValue('--gap')) || 22;
    var paths = [];
    [].slice.call(root.querySelectorAll('.side-card')).forEach(function(el){
      var c = el.getBoundingClientRect();
      var side = el.closest('.col-side').dataset.side;
      var color = getComputedStyle(el).getPropertyValue('--mark').trim() || '#5b5ce2';
      var anchorY = (parseFloat(el.dataset.anchorY) || 0) * sr.height;
      var y1 = c.top - rootR.top + 14;
      var y2 = sr.top - rootR.top + anchorY;
      var cardEdge = side === 'left' ? sr.left - rootR.left - gap : sr.right - rootR.left + gap;
      var paperEdge = side === 'left' ? sr.left - rootR.left : sr.right - rootR.left;
      var midX = (cardEdge + paperEdge) / 2;
      paths.push('<path d="M '+cardEdge+' '+y1+' H '+midX+' L '+paperEdge+' '+y2+'" stroke="'+color+
        '" stroke-width="1.1" fill="none" opacity=".55" stroke-linejoin="round" stroke-linecap="round"/>');
    });
    if (!paths.length) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','anno-lines');
    svg.setAttribute('width', Math.round(rootR.width));
    svg.setAttribute('height', Math.round(rootR.height));
    svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:1';
    svg.innerHTML = paths.join('');
    root.insertBefore(svg, root.firstChild);
  }

  function boot(){
    placeAll();
    var imgs = [].slice.call(document.images);
    var left = imgs.filter(function(im){ return !im.complete; }).length;
    if (left){
      var done = 0;
      var again = function(){ if (++done >= left){ placeAll(); } };
      imgs.forEach(function(im){
        if (im.complete) return;
        im.addEventListener('load', again);
        im.addEventListener('error', again);
      });
    }
    setTimeout(placeAll, 300);
    setTimeout(placeAll, 900);
    window.addEventListener('resize', placeAll);
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
})();
</script></body></html>`;
  }


  /* 白板页列表 */
  function boardPageList(o) {
    const pages = (o.pages && o.pages.length > 1)
      ? o.pages.map(pg => ({ img: pg.img, w: pg.w, h: pg.h, page: pg.page,
          annos: o.annos.filter(a => (a.page || 1) === pg.page) }))
      : [{ img: o.img, w: o.imgW, h: o.imgH, page: 1, annos: o.annos }];
    // 流式布局：宽度扣掉左右内边距，可用高度按一屏常见高度定基准，
    // 纸张按原图比例撑开，不做固定页高限制
    const availW = o.availW || 754;
    const availH = o.availH || 960;
    return pages.map(pg => boardPageHTML(pg, pages.length, { availW, availH }));
  }

  function buildDocument(o) { return buildLongDocument(o); }

  /* ---------- 导出 HTML ---------- */
  function exportHTML(o) {
    const html = buildDocument(o);
    const blob = new Blob(['\ufeff' + html], { type: 'text/html;charset=utf-8' });
    dl(blob, `智批作文-${safe(o.title)}.html`);
  }

  /* ---------- 工具 ---------- */
  const esc = s => String(s == null ? '' : s)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const safe = s => String(s || '作文').replace(/[\\/:*?"<>|\s]/g, '_').slice(0, 40);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function dl(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
  }

  global.ZPEXPORT = { collect, buildDocument, exportHTML, outlineData, __getBlocks: getBlocks, __sec: { secCover, secBoardBlocks, tabOverview, secOutline } };
})(window);
