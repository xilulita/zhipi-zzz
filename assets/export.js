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
    const g = (window.ZP.GRADES.find(x => x.id === d.gradeId) || { name: '', total: 30, label: '' });
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
    width:100%;margin:0;gap:var(--gap,18px);box-sizing:border-box;
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

  /* ---- 思路 / 技巧 ---- */
  .flow{position:relative;padding-left:24px;margin-top:4px}
  .flow::before{content:"";position:absolute;left:7px;top:8px;bottom:8px;width:1.5px;background:#e6e6f8}
  .stp{position:relative;padding:8px 0}
  .stp::before{content:"";position:absolute;left:-22px;top:13px;width:10px;height:10px;
    border-radius:50%;background:#fff;border:2.5px solid #7c7cf0}
  .stp .k{font-size:12.9px;font-weight:800;color:#5b5ce2;margin-bottom:3px}
  .stp .v{font-size:12.1px;line-height:1.75;color:#4a4d57}
  .stp .v b{color:#5b5ce2}
  .stp .ex{margin-top:5px;padding:6px 9px;background:#fafbff;border-radius:6px;
    font-size:11.1px;color:#7c8194;line-height:1.6}

  /* ---- 写作思路：两块结构 ---- */
  .ol-block{margin-bottom:12px}
  .ol-h{display:flex;align-items:center;gap:7px;font-size:13.7px;font-weight:800;
    color:#2a2c35;margin:0 0 7px;padding-bottom:5px;border-bottom:1px solid #eef0f6}
  .ol-h .ol-n{width:17px;height:17px;border-radius:50%;flex:0 0 17px;
    background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-size:10.3px;
    font-weight:800;display:flex;align-items:center;justify-content:center}
  .stp .steps{margin-top:4px}
  .step{display:flex;gap:5px;font-size:11.7px;line-height:1.65;color:#5a5f6d;
    margin-bottom:3px;align-items:flex-start}
  .step .sn{flex:0 0 13px;height:13px;border-radius:50%;background:#f0f1fa;color:#7c81a0;
    font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:2px}
  .fix{border:1px solid #eef0f6;border-radius:8px;padding:9px 11px;margin-bottom:8px;background:#fcfcfe}
  .fix-t{font-size:12.3px;font-weight:800;color:#2a2c35;margin-bottom:3px}
  .fix-d{font-size:11.1px;line-height:1.62;color:#8a90a0;margin-bottom:5px}

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
  .drill .r{font-size:11.7px;line-height:1.75;color:#4a4d57;display:flex;gap:7px;
    margin-bottom:5px;align-items:flex-start}
  .drill .r .kk{flex:0 0 30px;font-size:9.9px;font-weight:800;color:#b45309;background:#fff4e5;
    border-radius:4px;height:15px;line-height:15px;text-align:center;margin-top:1px}
  .drill .r + .r .kk{color:#5b5ce2;background:#eef0ff}
  .drill .r span:last-child{flex:1;min-width:0;word-break:break-word}
  .drill .demo{background:#f8f7ff;border-radius:7px;padding:7px 9px;font-size:11.1px;
    line-height:1.72;color:#5d5a80}
  .drill .demo .kk{background:#ece9fd;color:#7c5cf0}

  /* ---- 总评 / 润色稿 ---- */
  .review{font-size:13.4px;line-height:2.1;text-align:justify;color:#3a3d47}
  .review p{margin:0 0 9px;text-indent:2em}
  .review b{color:#5b5ce2}
  .paper-txt{background:#fdfcf8;border:1px solid #f2efe6;border-radius:10px;padding:36px 40px;min-height:940px}
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
  const valid = annos.filter(a => a.located !== false);
  const left = valid.filter(a => a.side !== 'right').sort((x, z) => x.y - z.y);
  const right = valid.filter(a => a.side === 'right').sort((x, z) => x.y - z.y);
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
    return `<div class="sec">存在问题</div>${iss}`;
  }

  function secOutline(o) {
    const P = o.paras || [];
    const cut = (t, n) => String(t || '').replace(/\s+/g, '').slice(0, n);
    const issues = o.issues || [];
    const text = P.join('');
    const hasDialog = /[“"][^”"]{2,}[”"]/.test(text);
    const hasSense = /(听见|闻到|摸到|凉|暖|响|香|光|影)/.test(text);

    // 一、参考写作思路：开头 / 中间（分条）/ 结尾
    const outline = [
      { k: '开头', v: '用一个具体画面或悬念切入，交代人物与情境，不要先讲道理。',
        steps: ['先给一个能看见的场景：时间、地点、一个正在发生的动作。', '让主角进场，写他此刻在做什么，而不是他"想"什么。'],
        ex: P[0] ? `本文开头：“${cut(P[0], 26)}…”` : '' },
      { k: '中间', v: '抓一个片段慢镜头细写，把"经过"写具体。',
        steps: [
          '第一步写起因：什么打破了原来的平静，用一句话交代清楚。',
          '第二步写经过：只选一个关键瞬间，按"先做什么→再做什么→最后做什么"推进。',
          hasDialog ? '第三步写转折：把最能改变情绪的那句原话，摆到转折点上。'
                    : '第三步写转折：加一句人物原话或一个意外，让情绪发生变化。',
          hasSense ? '每个动作后面补一处身体反应或环境细节，避免通篇概括。'
                   : '每个动作后面补一处声音或触感，让读者"在场"。'
        ],
        ex: P[1] ? `本文中段：“${cut(P[1], 26)}…”` : '' },
      { k: '结尾', v: '回到开头的意象或场景，用一句话点明感受，把道理藏在画面里。',
        steps: ['直接抒情式：用具体的词点明感受，不喊口号。', '首尾呼应式：让开头那件物或那个声音再出现一次。', '留白式：停在一个动作或画面上，不解释。'],
        ex: P.length ? `本文结尾：“${cut(P[P.length - 1], 26)}…”` : '' }
    ];

    // 二、具体问题与修改思路：问题 → 怎么改（分条）
    const fixes = issues.slice(0, 3).map((it, i) => {
      const steps = [];
      if (/长句|断句|45|逗号/.test(it.title || '')) {
        steps.push('找到那句超过 40 字的话，在转折处（"可""但""于是"）断开。',
          '断开后前后各留半句，读一遍，不喘气了就对了。',
          '比如：把"我忽然想走过去帮她提一下那袋米可我又坐回去了"拆成两句。');
      } else if (/错别字|病句|地|的|标点|成分/.test(it.title || '')) {
        steps.push('先把原句抄下来，逐字读一遍，标出可疑处。',
          '对照"修饰动词用地、补充说明用得、修饰名词用的"。',
          '改完再读一遍，确认句子成分完整、不残缺。');
      } else if (/情绪|概括|抽象|感动|难过/.test(it.title || '')) {
        steps.push('把"我很感动"这类概括词划掉。',
          '问自己：那一刻手在做什么？眼睛看见了什么？',
          '比如：改成"鼻子一酸，眼眶忽然热了一下"。');
      } else if (/重复|啰嗦|删/.test(it.title || '')) {
        steps.push('找出与前文意思相同的句子，只保留最有力的一句。',
          '删掉后看上下文是否连贯，若跳跃就补半句过渡。');
      } else {
        steps.push('先定位问题句，把它单独抄出来。',
          '按"是什么问题 → 怎么改 → 改完读一遍"三步处理。');
      }
      return { t: it.title || `问题 ${i + 1}`, d: it.desc || '', steps };
    });

    return `<div class="sec">写作思路</div>

      <div class="ol-block">
        <div class="ol-h"><span class="ol-n">一</span>参考写作思路</div>
        <div class="flow">${outline.map(r => `<div class="stp">
          <div class="k">${r.k}</div>
          <div class="v">${esc(r.v)}</div>
          <div class="steps">${r.steps.map((s, i) => `<div class="step"><span class="sn">${i + 1}</span>${esc(s)}</div>`).join('')}</div>
          ${r.ex ? `<div class="ex">${esc(r.ex)}</div>` : ''}
        </div>`).join('')}</div>
      </div>

      ${fixes.length ? `<div class="ol-block">
        <div class="ol-h"><span class="ol-n">二</span>具体问题与修改思路</div>
        ${fixes.map((f, i) => `<div class="fix">
          <div class="fix-t">${i + 1}. ${esc(f.t)}</div>
          ${f.d ? `<div class="fix-d">${esc(f.d)}</div>` : ''}
          <div class="steps">${f.steps.map((s, k) => `<div class="step"><span class="sn">${k + 1}</span>${esc(s)}</div>`).join('')}</div>
        </div>`).join('')}
      </div>` : ''}
    `;
  }

  function secDrills(o) {
    const list = o.drills || [];
    if (!list.length) return '';
    return `<div class="sec">小练笔<span class="tag">针对本文薄弱点</span></div>
      ${list.map((b, i) => `<div class="drill">
        <div class="h"><span class="n">${i + 1}</span><span class="t">${esc(b.key)}<em>· ${esc(b.focus)}</em></span></div>
        ${b.issue ? `<div class="iss">${esc(b.issue)}</div>` : ''}
        <div class="r"><span class="kk">练习</span><span>${esc(b.ask)}</span></div>
        <div class="r"><span class="kk">思路</span><span>${esc(b.idea)}</span></div>
        <div class="r demo"><span class="kk">素材</span><span>${esc(b.demo)}</span></div>
      </div>`).join('')}`;
  }

  function secReview(o) {
    const html = String(o.review).split(/<br\s*\/?>/i).filter(x => x.trim())
      .map(p => `<p>${p}</p>`).join('') || `<p>${esc(o.review)}</p>`;
    return `<div class="sec">教师总评</div><div class="review">${html}</div>`;
  }

  function secPolish(o) {
    const lvTag = [o.grade, o.label].filter(Boolean).join(' · ');
    return `<div class="sec">润色后文章${lvTag ? `<span class="tag">${esc(lvTag)}</span>` : ''}</div>
      <div class="paper-txt"><div class="t">${esc(o.title)}</div>
        ${o.polished.map(t => `<p>${esc(t)}</p>`).join('')}</div>
`;
  }

  function secFooter(o) { return ''; }

  /* 长文档：每页一个 A4 页容器，白板页内嵌真实测量脚本 */
  function buildLongDocument(o) {
    if (!Array.isArray(o.polished)) o.polished = (o.paras || []);
    if (!Array.isArray(o.drills)) o.drills = [];
    if (!Array.isArray(o.genreTips)) o.genreTips = [];
    if (!o.imgW || !o.imgH) { o.imgW = 760; o.imgH = 1000; }

    // 页面顺序：封面 → 每页白板 → 各 Tab 独占起始页
    const coverHTML = secCover(o);
    const boards = boardPageList(o);
    const tabs = [tabOverview(o), tabOutline(o), tabDrill(o), tabPolish(o)];

    const pageCls = 'pg';
    const page = (inner, cls, pageNo) => `<section class="${pageCls} ${cls || ''}">
      <div class="pg-inner">${inner}</div>
      ${pageNo ? `<div class="pagefoot">第 ${pageNo} 页</div>` : ''}
    </section>`;

    // 先收集所有页，再补页码
    const pageList = [];
    pageList.push({ html: coverHTML, cls: 'pg-cover' });
    boards.forEach(b => pageList.push({ html: b, cls: 'pg-board' }));
    tabs.forEach(t => pageList.push({ html: t, cls: 'pg-tab' }));

    const body = pageList
      .map((p, i) => page(p.html, p.cls, i + 1))
      .join('');

    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(o.title)} · 智批作文</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:#e9ecf2;-webkit-font-smoothing:antialiased;
    font-family:"PingFang SC","Microsoft YaHei",sans-serif}

  /* 每页：一个 A4 竖版页面 */
  .pg{
    position:relative;width:794px;height:1123px;
    margin:0 auto 18px;background:#fff;
    padding:20px;overflow:hidden;
    box-shadow:0 2px 12px rgba(20,23,45,.10);
    page-break-after:always;break-after:page;
  }
  .pg:last-child{page-break-after:auto;break-after:auto}
  .pg-inner{position:relative;width:754px;height:1083px;margin:0 auto}

  @page{size:A4 portrait;margin:0}
  @media print{
    body{background:#fff}
    .pg{margin:0;box-shadow:none;page-break-after:always}
  }
  /* 窄屏：整体等比缩放，保持三列结构不变形 */
  @media screen and (max-width:860px){
    body{background:#e9ecf2}
    .pg{transform-origin:top center}
  }
  ${EXPORT_CSS}
</style></head>
<body id="doc">${body}
<script>
(function(){
  /* 一、白板页真实测量摆卡 */
  var PAGE_W = 794, PAGE_H = 1123;
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

  /* 三、窄屏整体缩放 */
  function fitScreen(){
    var pgs = [].slice.call(document.querySelectorAll('.pg'));
    var vw = document.documentElement.clientWidth;
    var s = vw < 830 ? Math.max(0.42, (vw - 16) / PAGE_W) : 1;
    pgs.forEach(function(p){
      if (s === 1){ p.style.transform = ''; p.style.marginBottom = ''; }
      else {
        p.style.transform = 'scale(' + s + ')';
        p.style.transformOrigin = 'top center';
      }
    });
    // 缩放后调整占位高度，避免页面间出现大空隙
    pgs.forEach(function(p){
      if (s === 1) return;
      p.style.marginBottom = (-(PAGE_H * (1 - s)) + 18) + 'px';
    });
  }

  function boot(){
    placeAll();
    // 图片加载完再量一次，保证尺寸准确
    var imgs = [].slice.call(document.images);
    var left = imgs.filter(function(im){ return !im.complete; }).length;
    if (left){
      var done = 0;
      imgs.forEach(function(im){
        if (im.complete) return;
        im.addEventListener('load', function(){ if (++done >= left){ placeAll(); } });
        im.addEventListener('error', function(){ if (++done >= left){ placeAll(); } });
      });
    }
    setTimeout(placeAll, 300);
    fitScreen();
    window.addEventListener('resize', fitScreen);
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
    // 页面内容宽 = 794 - 左右 padding(20*2) - 滚动条余量，纵向扣掉上下 padding 与页码行
    const availW = o.availW || 754;
    const availH = (o.availH || 1123) - 40 - 18;
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

  global.ZPEXPORT = { collect, buildDocument, exportHTML, __getBlocks: getBlocks, __sec: { secCover, secBoardBlocks, tabOverview } };
})(window);
