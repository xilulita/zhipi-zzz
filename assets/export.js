/* ===== 智批作文 · 导出模块（A4 竖版 / 一键直下） =====
 * PDF：jsPDF + html2canvas，点击即下载，不经过打印面板
 * HTML：自包含单文件，同样 A4 排版
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
      annos: R.annos || [], highlights: R.report.highlights || [], issues: R.report.issues || [],
      review: R.report.review || '', img: d.img,
      dims: window.ZP.DIMS,
      pages: (d.pages && d.pages.length > 1)
        ? d.pages.map((pg, i) => ({ img: pg.img, w: pg.w, h: pg.h, page: i + 1 }))
        : null,
      dimComments: R.report.dimComments || {}
    };
  }


  /* 块渲染专用样式（与网页版一致的视觉语言） */
  /* ================= 统一导出样式（PDF 与 HTML 共用，确保完全一致） ================= */
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

  /* ---- 白板三列：左卡 | 作文纸 | 右卡（自动铺满） ---- */
  .board3{display:flex;align-items:flex-start;justify-content:center;width:100%;margin:2px 0 6px;gap:0;padding:0 6px;box-sizing:border-box}
  .board3 .col-side{position:relative;flex:1 1 0;min-width:0;max-width:none}
  .board3 .shot{position:relative;flex:0 0 auto;align-self:flex-start;border-radius:6px;
    border:1px solid #e6e9f0;background:#fff;overflow:visible}
  .board3 .shot img{display:block;width:100%;height:100%;object-fit:contain;border-radius:5px}
  .mk{position:absolute;border-radius:2px}
  .mk-no{position:absolute;top:50%;transform:translateY(-50%);width:16px;height:16px;border-radius:50%;
    color:#fff;font-size:10.2px;font-weight:800;display:flex;align-items:center;justify-content:center;
    line-height:1;box-shadow:0 1px 4px rgba(20,23,45,.22);z-index:2}
  .mk-no.left{left:-19px}
  .mk-no.right{right:-19px}
  .mk-pin{position:absolute;width:17px;height:17px;border-radius:50%;color:#fff;
    font-size:10.3px;font-weight:800;display:flex;align-items:center;justify-content:center;
    line-height:1;box-shadow:0 1px 4px rgba(20,23,45,.24);transform:translate(-50%,-50%);z-index:3}
  .mk-pin.left{transform:translate(-140%,-50%)}
  .mk-pin.right{transform:translate(40%,-50%)}
  .side-card{position:absolute;left:0;right:38px;background:#fff;border:1px solid #eef0f5;
    border-left-width:3px;border-radius:9px;padding:9px 10px 10px;font-size:11.4px;line-height:1.72;
    color:#4a4d57;word-break:break-word;box-shadow:0 1px 4px rgba(20,23,45,.06)}
  .side-card .sc-head{display:flex;align-items:center;gap:5px;margin-bottom:5px}
  .side-card .sc-no{position:static;width:16px;height:16px;flex:0 0 16px;
    font-size:10.3px;box-shadow:0 1px 2px rgba(20,23,45,.18)}
  .side-card .sc-lb{display:inline-block;font-size:10.3px;font-weight:800;margin:0}
  .board3 .col-side.right .side-card{left:38px;right:0;border-left-width:1px;border-right-width:3px}
  .side-card .sc-no{position:absolute;top:-6px;left:-6px;width:15px;height:15px;border-radius:50%;
    color:#fff;font-size:9.5px;font-weight:800;display:flex;align-items:center;justify-content:center;
    box-shadow:0 1px 3px rgba(20,23,45,.2)}
  .side-card .sc-lb{display:block;font-size:10.5px;font-weight:800;margin-bottom:2px}
  .side-card .sc-tx b{color:#1a1b1f;font-weight:700}
  .side-card.err{border-left-color:#e2554f}   .side-card.err .sc-lb{color:#d94a44}
  .side-card.polish{border-left-color:#d9a223}.side-card.polish .sc-lb{color:#a97a10}
  .side-card.good{border-left-color:#22a06b}  .side-card.good .sc-lb{color:#1e8f60}
  .side-card.dele{border-left-color:#8b5cf6}  .side-card.dele .sc-lb{color:#7c5cf0}
  .board3 .col-side.right .side-card.err{border-right-color:#e2554f;border-left-color:#edeff5}
  .board3 .col-side.right .side-card.polish{border-right-color:#d9a223;border-left-color:#edeff5}
  .board3 .col-side.right .side-card.good{border-right-color:#22a06b;border-left-color:#edeff5}
  .board3 .col-side.right .side-card.dele{border-right-color:#8b5cf6;border-left-color:#edeff5}
  .pg-cap{margin:6px 0 12px;text-align:center;font-size:10.2px;color:#9aa0ad}
  .pg-block{margin-bottom:6px}

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
  .review{font-size:12.6px;line-height:2;text-align:justify;color:#3a3d47}
  .review p{margin:0 0 9px;text-indent:2em}
  .review b{color:#5b5ce2}
  .paper-txt{background:#fdfcf8;border:1px solid #f2efe6;border-radius:10px;padding:18px 20px}
  .paper-txt .t{text-align:center;font-family:"Songti SC","SimSun",serif;font-size:17.3px;
    font-weight:800;margin-bottom:12px;letter-spacing:1.2px}
  .paper-txt p{font-family:"Songti SC","SimSun",serif;font-size:13.1px;line-height:2;
    text-indent:2em;margin:0 0 3px;text-align:justify;color:#33363f;word-break:break-word}
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
    // 页面顺序：封面（标题+评分）→ 每页白板 → 各 Tab 独占页
    // 每个大区块各自成页（fullPage），内容超出时自动续到下一页
    const list = [
      // 封面不独占整页：与第一页白板合并，避免首屏大片空白
      { id: 'cover',  html: secCover(o),      cover: true, fullPage: false, keepWithNext: true },
      ...secBoardBlocks(o),
      // 按 Tab 分组：每个 Tab 的内容尽量放一页，装不下自动续页
      { id: 'tabOverview', html: tabOverview(o),  fullPage: true, tab: true },
      { id: 'tabOutline',  html: tabOutline(o),   fullPage: true, tab: true },
      { id: 'tabDrill',    html: tabDrill(o),     fullPage: true, tab: true },
      { id: 'tabPolish',   html: tabPolish(o),    fullPage: true, tab: true }
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
    // 标题行内已含右上角评分框，不再重复渲染大评分条
    return `<div class="cover">
      ${secHead(o)}
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
      <span class="lv"><b>${o.level.name} · ${o.level.desc}</b><span>${esc(o.grade)}要求 ${esc(o.label || '')}</span></span>
    </div>`;
  }

  /* 白板拆成多块：标题块 + 每页一块，便于逐页排版与自动续页 */
  function secBoardBlocks(o) {
    const pages = (o.pages && o.pages.length > 1)
      ? o.pages.map(pg => ({ img: pg.img, w: pg.w, h: pg.h, page: pg.page,
          annos: o.annos.filter(a => (a.page || 1) === pg.page) }))
      : [{ img: o.img, w: o.imgW, h: o.imgH, page: 1, annos: o.annos }];

    const list = [];
    pages.forEach((pg, i) => {
      const isFirst = i === 0;
      // 第 1 页白板与封面同页：可用高度扣除封面占位；其余页独占
      const availH = isFirst ? 900 : 1071;
      list.push({
        id: 'board' + i,
        html: (isFirst ? `<div class="sec">批改白板<span class="tag">原文与批注痕迹</span></div>` : '')
              + boardPageHTML(pg, pages.length, { availW: 734, availH, fullPage: true, noCenter: isFirst }),
        atomic: false,
        board: true,
        fullPage: !isFirst,
        pageData: pg,
        totalPages: pages.length,
        keepWithNext: false,
        // 只有第 2 页起的白板才另起页；第一页紧跟封面
        pageBreakBefore: i > 0
      });
    });
    return list;
  }

  /* 单页白板：左卡 | 作文纸 | 右卡。内容超出时由调用方切到下一页续排。 */
  function boardPageHTML(pg, totalPages, opts) {
    const colors = { err: '#e2554f', polish: '#d9a223', good: '#22a06b', dele: '#8b5cf6' };
    const names = { err: '错别字/病句', polish: '润色建议', good: '优秀好句', dele: '删改' };
    const o2 = opts || {};
    // 白板独占整页：高度吃满可用区，纸张按比例居中
    const FULL = !!o2.fullPage;
    const imgSrc = pg.img;
    const ratio = (pg.h && pg.w) ? (pg.h / pg.w) : 1.35;
    // 铺满：用可用宽度反推，最大 380px 宽（保证单页放得下）
    // 铺满整页：先按可用高度算出纸张最大高度，再反推宽度
    const AVAIL_W = o2.availW || 690;        // 794 - 52*2
    const AVAIL_H = o2.availH || 1000;       // 单页可用高度（已扣页边距与页码）
    // 让纸张尽量宽（文字更大更好读），高度按内容自然高度，不留大白框
    // 纸张占中间约 54%，两侧各留 23% 放竖排批注卡
    const capH = Math.max(320, AVAIL_H - 6);
    const maxW = Math.round(AVAIL_W * 0.66);
    const ratioSafe = Math.max(0.2, ratio);
    // 纸张宽度尽量占满上限，高度按图片比例；不足时用图片居中留白补满
    let shotW = Math.min(maxW, Math.round(capH / ratioSafe));
    let imgH = Math.round(shotW * ratioSafe);
    if (imgH > capH) { imgH = capH; shotW = Math.round(imgH / ratioSafe); }
    // 与封面同页时纸张高度补足可用区，避免页面底部大片空白
    // 纸张高度 = 图片真实高度；不足整页时不硬撑，避免纸内出现大片空白
    const shotH = imgH;
    const vPad = Math.max(0, Math.round((shotH - imgH) / 2));
    const shotWFinal = shotW;
    // 白板独占页：列高度跟随整页可用高度，纸张垂直居中
    const colH = FULL ? Math.max(capH, shotH) : shotH;
    // 独占页才垂直居中；与封面同页时贴住上方，避免底部留白
    const boardTop = (FULL && !o2.noCenter) ? Math.max(0, Math.round((capH - shotH) / 2)) : 0;
    const annos = pg.annos || [];
    const valid = annos.filter(a => a.located !== false);
    const left = valid.filter(a => a.side !== 'right');
    const right = valid.filter(a => a.side === 'right');

    // 图内保留划线与编号（批注痕迹必须显示）
    const marks = valid.map(a => {
      const color = colors[a.type] || '#5b5ce2';
      const side = a.side === 'right' ? 'right' : 'left';
      const topPx = Math.round(vPad + imgH * a.y);
      return `<div class="mk ${side}" style="left:${a.x * 100}%;top:${topPx}px;
        width:${a.w * 100}%;height:${Math.max(4, Math.round(imgH * a.h))}px;border:1.4px solid ${color};
        background:${color}1a"><span class="mk-no ${side}" style="background:${color}">${a.no || ''}</span></div>`;
    }).join('');

    // 纵向排布：按 y 就近，再向下消重叠
    // 卡片纵向位置：与图片实际区域（含 vPad）对齐，再自上而下消重叠
    const layout = (list) => {
      const GAP = 22;   // 卡片之间留出明显间隙
      const est = a => {
        const len = String(a.html || '').replace(/<[^>]+>/g, '').length;
        return 40 + Math.min(5, Math.ceil(len / 26)) * 10;
      };
      const items = list.slice().sort((x, z) => x.y - z.y).map(a => ({ a, h: est(a) }));
      let cursor = 0;
      items.forEach(it => {
        const center = vPad + imgH * it.a.y;
        it.top = Math.max(0, Math.max(cursor, center - it.h / 2));
        cursor = it.top + it.h + GAP;
      });
      const limit = shotH;
      const over = cursor - GAP - limit;
      if (over > 0) {
        for (let i = items.length - 1; i >= 0; i--) {
          const minTop = i === 0 ? 0 : items[i - 1].top + items[i - 1].h + GAP;
          items[i].top = Math.max(minTop, items[i].top - over);
        }
      }
      return items;
    };

    const lItems = layout(left);
    const rItems = layout(right);
    // 卡片结构：左上编号圆标 + 类型标签，正文在下（与参考排版一致）
    const cardHTML = it => `<div class="side-card ${it.a.type}" style="top:${Math.round(it.top)}px">
      <div class="sc-head">
        <span class="sc-no" style="background:${colors[it.a.type] || '#5b5ce2'}">${it.a.no || ''}</span>
        <span class="sc-lb">${names[it.a.type] || '批注'}</span>
      </div>
      <div class="sc-tx">${it.a.html}</div></div>`;

    const lineOf = (it, side) => {
      const W = 40;
      const y1 = Math.round(it.top + 12);
      const y2 = Math.round(vPad + imgH * it.a.y + imgH * (it.a.h || 0.03) / 2) + 1;
      const top = Math.min(y1, y2) - 1;
      const hgt = Math.max(2, Math.abs(y2 - y1) + 2);
      const x1 = side === 'left' ? 0 : W;
      const x2 = side === 'left' ? W : 0;
      const color = colors[it.a.type] || '#5b5ce2';
      // 连线span在卡片与纸张之间的空隙里，双端都完整可见
      // 放在列内右侧（左列）/左侧（右列）的空白缝里
      // 折线连接：卡片边缘 → 水平到中线 → 斜向到目标（两段 CSS 线，兼容 html2canvas）
      // 连线横跨卡片与纸张之间的缝（36px），端点严格落在卡片边缘与标记边缘
      const GAP = 34;
      const W2 = GAP;
      const dy = y2 - y1;
      const deg = Math.atan2(dy, W2) * 180 / Math.PI;
      const sideCss = side === 'left' ? 'right:0;' : 'left:0;';
      const origin = side === 'left' ? '100% 0' : '0 0';
      return `<i class="ln" style="position:absolute;display:block;pointer-events:none;z-index:3;
        ${sideCss}top:${y1}px;left:${side === 'left' ? 'auto' : 'auto'};width:${W2}px;height:2px;
        background:${color};opacity:.55;transform-origin:${origin};transform:rotate(${deg}deg)"></i>
        <i style="position:absolute;display:block;pointer-events:none;z-index:4;
        ${side === 'left' ? `right:${-3}px;` : `left:${-3}px;`}top:${y2 - 3}px;
        width:6px;height:6px;border-radius:50%;background:${color};opacity:.85"></i>`;
    };

    const cap = totalPages > 1
      ? `第 ${pg.page} / ${totalPages} 页 · ${annos.length} 条批注`
      : `${annos.length} 条批注`;

    return `<div class="board3" data-page="${pg.page}">
      <div class="col-side left" style="height:${colH}px;margin-top:${boardTop}px">${lItems.map(it => `${lineOf(it, 'left')}${cardHTML(it)}`).join('')}</div>
      <div class="shot" style="width:${shotW}px;height:${shotH}px;margin-top:${boardTop}px">
        <img src="${imgSrc}" style="position:absolute;left:0;top:${vPad}px;width:100%;height:${imgH}px;object-fit:fill">
        ${marks}
      </div>
      <div class="col-side right" style="height:${colH}px;margin-top:${boardTop}px">${rItems.map(it => `${lineOf(it, 'right')}${cardHTML(it)}`).join('')}</div>
    </div><div class="pg-cap">${cap}</div>`;
  }

  /* 兼容旧入口：整块白板（多页时依次输出） */
  function secBoard(o) {
    const pages = (o.pages && o.pages.length > 1)
      ? o.pages.map(pg => ({ img: pg.img, w: pg.w, h: pg.h, page: pg.page,
          annos: o.annos.filter(a => (a.page || 1) === pg.page) }))
      : [{ img: o.img, w: o.imgW, h: o.imgH, page: 1, annos: o.annos }];
    return `<div class="sec">批改白板<span class="tag">原文与批注痕迹</span></div>
      ${pages.map(pg => `<div class="pg-block">${boardPageHTML(pg, pages.length, {
        availW: 734, availH: 1053, fullPage: true
      })}</div>`).join('')}`;
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
    return `<div class="sec">润色后文章<span class="tag">${esc(o.grade)}要求 ${esc(o.label || '')}</span></div>
      <div class="paper-txt"><div class="t">${esc(o.title)}</div>
        ${o.polished.map(t => `<p>${esc(t)}</p>`).join('')}</div>
`;
  }

  function secFooter(o) { return ''; }

  /* HTML 长文档：与 PDF 使用完全相同的结构与样式，保证版式一致 */
  function buildLongDocument(o) {
    if (!Array.isArray(o.polished)) o.polished = (o.paras || []);
    if (!Array.isArray(o.drills)) o.drills = [];
    if (!Array.isArray(o.genreTips)) o.genreTips = [];
    if (!o.imgW || !o.imgH) { o.imgW = 760; o.imgH = 1000; }

    // 与 PDF 完全相同的区块顺序，保证两者版式与内容一致
    const body = [
      secCover(o),
      secBoard(o),
      tabOverview(o),
      tabOutline(o),
      tabDrill(o),
      tabPolish(o)
    ].filter(Boolean).join('');

    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(o.title)} · 智批作文</title>
<style>
  :root{--w:794px}
  body{margin:0;background:#eef1f6;-webkit-font-smoothing:antialiased}
  .long{width:var(--w);max-width:100%;margin:0 auto;background:#fff;
        padding:34px 30px 48px}
  @page{size:A4 portrait;margin:0}
  /* 小屏：保持三列结构，靠 JS 等比缩放（见页尾脚本），不做竖排堆叠 */
  @media screen and (max-width:820px){
    body{background:#fff}
    .long{padding:20px 14px 30px;overflow-x:hidden}
    .scalebox{transform-origin:top left;will-change:transform}
  }
  @media print{ body{background:#fff} .long{padding:14mm 12mm} }
  ${EXPORT_CSS}
</style></head>
<body><div class="long"><div class="scalebox" id="sb">${body}</div></div>
<script>
(function(){
  var sb = document.getElementById('sb');
  if (!sb) return;
  var BASE = 794;   // 设计宽度
  function fit(){
    sb.style.transform = 'none'; sb.style.width = '100%'; sb.style.marginBottom = '0';
    var box = document.querySelector('.long');
    var pad = parseFloat(getComputedStyle(box).paddingLeft) + parseFloat(getComputedStyle(box).paddingRight);
    var w = box.clientWidth - pad;
    if (w >= BASE - 4) return;
    // 缩放下限 0.62：再小文字就看不清了，超窄屏改为允许横向滑动
    var s = Math.max(0.62, w / BASE);
    sb.style.width = BASE + 'px';
    sb.style.transform = 'scale(' + s + ')';
    sb.style.marginBottom = (sb.scrollHeight * (s - 1)) + 'px';
    var box2 = document.querySelector('.long');
    // 清空 overflow，避免 .long 自身变成滚动容器产生嵌套滚动条
    box2.style.overflow = '';
  }
  fit();
  window.addEventListener('resize', fit);
})();
</script></body></html>`;
  }

  function buildDocument(o) { return buildLongDocument(o); }

  /* ---------- 导出 HTML ---------- */
  function exportHTML(o) {
    const html = buildDocument(o);
    const blob = new Blob(['\ufeff' + html], { type: 'text/html;charset=utf-8' });
    dl(blob, `智批作文-${safe(o.title)}.html`);
  }

  /* ---------- 导出 PDF：逐块渲染 + 块级装箱（绝不切开任何块） ---------- */
  async function exportPDF(o) {
    if (!window.jspdf || !window.html2canvas) throw new Error('PDF 组件未加载');

    const { jsPDF } = window.jspdf;
    // A4 纵向，但内容区收窄到与 HTML 一致（纸张占主体、两侧批注竖排）
    const PAGE_W = 794;
    const PAGE_H = Math.round(794 * 841.89 / 595.28);   // 1123
    const PAD_X = 24, PAD_TOP = 22, PAD_BOT = 30;
    const CONTENT_W = PAGE_W - PAD_X * 2;
    const CONTENT_H = PAGE_H - PAD_TOP - PAD_BOT;

    // 渲染容器（iframe 隔离主页面 CSS）
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;height:1400px;border:0;z-index:-1';
    document.body.appendChild(frame);
    const fd = frame.contentWindow.document;
    fd.open();
    fd.write(buildShell(o));
    fd.close();
    await sleep(120);

    const stage = fd.getElementById('stage');
    // 关键：测量宽度必须与实际排版宽度一致，否则文字重排会导致高度失真
    stage.style.width = CONTENT_W + 'px';
    const blocks = getBlocks(o);

    // 1) 逐块测量高度，并记录"可在何处断开"的分割点
    const measured = [];
    for (const b of blocks) {
      stage.innerHTML = `<div class="blk">${b.html}</div>`;
      let el = stage.firstElementChild;
      await waitForImages(el);
      await sleep(20);
      let h = Math.ceil(el.getBoundingClientRect().height);

      // 白板块：超出单页时先逐档缩小作文纸宽度，尽量塞进一页
      if (b.board && h > CONTENT_H) {
        const scales = [1, 0.94, 0.88, 0.82];
        for (const k of scales) {
          const pg = b.pageData;
          stage.innerHTML = `<div class="blk">${boardPageHTML(pg, b.totalPages, { availW: 734, availH: Math.round(1053 * k), fullPage: true })}</div>`;
          el = stage.firstElementChild;
          await waitForImages(el);
          await sleep(20);
          h = Math.ceil(el.getBoundingClientRect().height);
          if (h <= CONTENT_H) break;
        }
      }
      // 白板块：以卡片之间的空隙作为断点（避免切开单张卡片）
      let cuts = [];
      if (b.board) {
        const tops = [...el.querySelectorAll('.side-card, .pg-cap')]
          .map(c => Math.round(c.getBoundingClientRect().top - el.getBoundingClientRect().top))
          .filter(y => y > 60 && y < h - 40).sort((a, z) => a - z);
        // 关键断点：纸张底部与说明之间（整页白板最自然的切分点）
        cuts = tops;
      } else {
        cuts = b.atomic ? [] : findCuts(el, h);
      }
      measured.push({ ...b, h, fullH: h, cuts });
    }

    // 2) 装箱：优先整块；放不下时在块内断点拆分（不切断文字行）
    const MIN_SLIVER = 110;        // 拆出来的半块至少要有这么多高度才值得
    const pages = [];
    let cur = [], used = 0;

    for (let i = 0; i < measured.length; i++) {
      const b = measured[i];
      let rest = { ...b, off: 0, h: b.h };

      // 每个大区块独占一页（内容超出时续页）
      if ((b.fullPage || b.pageBreakBefore) && cur.length) {
        pages.push(cur); cur = []; used = 0;
      }

      // 单块比整页还高：独占一页（不缩放，按原尺寸溢出到下一页）
      if (rest.h > CONTENT_H) {
        if (cur.length) { pages.push(cur); cur = []; used = 0; }
        // 允许在块内断点拆分，保证批注不被裁掉
        const cuts = (b.cuts || []).filter(c => c > 80 && c < b.h - 40);
        if (cuts.length) {
          let off = 0;
          while (off < b.h) {
            const room = CONTENT_H - 0;
            const limit = off + room;
            const cand = cuts.filter(c => c > off + 60 && c <= limit);
            const cut = cand.length ? cand[cand.length - 1] : null;
            if (cut) {
              pages.push([{ ...b, off, h: cut - off }]);
              off = cut;
            } else {
              pages.push([{ ...b, off, h: Math.min(room, b.h - off) }]);
              off += Math.min(room, b.h - off);
            }
          }
        } else {
          pages.push([rest]);
        }
        continue;
      }

      while (rest.h > 0) {
        const room = CONTENT_H - used;

        if (rest.h <= room) {
          cur.push(rest); used += rest.h; rest = null; break;
        }

        // 放不下 → 找块内最后一个可用断点
        const limit = (rest.off || 0) + room;
        const cand = (b.cuts || []).filter(c => c > (rest.off || 0) + MIN_SLIVER && c <= limit);
        const cut = cand.length ? cand[cand.length - 1] : null;

        if (cut) {
          const firstH = cut - (rest.off || 0);
          cur.push({ ...b, off: rest.off || 0, h: firstH });
          pages.push(cur); cur = []; used = 0;
          rest = { ...b, off: cut, h: b.h - cut };
        } else if (b.fullPage) {
          // 整页块：按可用高度硬切，剩余部分接到下一页继续
          const take = Math.max(120, room);
          cur.push({ ...b, off: rest.off || 0, h: take });
          pages.push(cur); cur = []; used = 0;
          rest = { ...b, off: (rest.off || 0) + take, h: Math.max(0, rest.h - take) };
        } else {
          if (cur.length) { pages.push(cur); cur = []; used = 0; }
          // 整块推到新页；若新页仍放不下则缩放独占
          if (rest.h > CONTENT_H) { pages.push([rest]); rest = null; }
        }
        if (!cur.length && !rest) break;
      }

      // keepWithNext：标题类的块若与下一块挤不开，一起挪到下一页
      const next = measured[i + 1];
      if (b.keepWithNext && next && cur.length === 1 && used + next.h > CONTENT_H) {
        const moved = cur.pop();
        pages.push(cur); cur = [moved]; used = moved.h;
        cur = []; used = 0;
        pages.push([moved]);
      }
    }
    if (cur.length) pages.push(cur);

    // 3) 逐页渲染成图片
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
    const A4W = 595.28, A4H = 841.89;

    for (let p = 0; p < pages.length; p++) {
      const items = pages[p];
      const totalH = items.reduce((a, b) => a + b.h, 0);

      // 整页块按 100% 原尺寸渲染（宽度已按页面算好），只对溢出做轻微收缩
      let scale = totalH > CONTENT_H ? CONTENT_H / totalH : 1;
      // 白板页：绝不缩放，作文图片必须保持原比例 1:1 输出
      const hasBoard = items.some(b => b.board);
      const isTab = items.some(b => b.tab);
      const isFull = items.some(b => b.fullPage);
      if (hasBoard) {
        scale = 1;                       // 所见即所得：白板一律原尺寸
      } else if (isTab && totalH < CONTENT_H * 0.96) {
        scale = Math.min(1.28, CONTENT_H / Math.max(1, totalH));
      } else if (isFull) {
        scale = totalH > CONTENT_H * 1.02 ? Math.max(0.88, CONTENT_H / totalH) : 1;
      }

      stage.innerHTML = `<div class="pagewrap" style="width:${PAGE_W}px;height:${PAGE_H}px;
        padding:${PAD_TOP}px ${PAD_X}px ${PAD_BOT}px;box-sizing:border-box;background:#fff;
        position:relative;overflow:hidden">
        <div class="pageinner" style="width:${CONTENT_W / scale}px;transform:scale(${scale});
          transform-origin:top left;position:absolute;left:${PAD_X}px;top:${PAD_TOP}px">
          ${items.map(b => {
            const whole = !b.off && b.h >= (b.fullH || b.h);
            if (whole) return `<div class="blk">${b.html}</div>`;
            return `<div class="blk" style="height:${b.h}px;overflow:hidden">
              <div class="slice" style="margin-top:-${b.off || 0}px">${b.html}</div></div>`;
          }).join('')}
        </div>
        <div class="pagefoot" style="position:absolute;left:${PAD_X}px;right:${PAD_X}px;
          bottom:22px;display:flex;justify-content:flex-end;font-size:8.5px;color:#ccd0da">
          <span>第 ${p + 1} / ${pages.length} 页</span>
        </div>
      </div>`;
      await waitForImages(stage);
      await sleep(60);

      const node = stage.querySelector('.pagewrap');
      const canvas = await window.html2canvas(node, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W, windowHeight: PAGE_H,
        scrollX: 0, scrollY: 0
      });

      if (p > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, A4W, A4H, undefined, 'FAST');
    }

    pdf.save(`智批作文-${safe(o.title)}.pdf`);
    frame.remove();
  }

  /* 渲染外壳：只含基础样式，无分页容器 */
  function buildShell(o) {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><style>
      body{margin:0;background:#fff}
      #stage{width:auto}
      .slice > *:first-child{margin-top:0 !important}
      ${CSS_BLOCKS}
    </style></head><body><div id="stage"></div></body></html>`;
  }

  /* ---------- 工具 ---------- */
  const esc = s => String(s == null ? '' : s)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const safe = s => String(s || '作文').replace(/[\\/:*?"<>|\s]/g, '_').slice(0, 40);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function waitForImages(root) {
    const imgs = Array.from(root.querySelectorAll('img'));
    return Promise.all(imgs.map(im => im.complete ? Promise.resolve() : new Promise(res => {
      im.onload = res; im.onerror = res; setTimeout(res, 3000);
    })));
  }
  function dl(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
  }

  global.ZPEXPORT = { collect, buildDocument, exportHTML, exportPDF };
})(window);
