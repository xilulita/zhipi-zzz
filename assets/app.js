/* ===== 智批作文 · 应用逻辑 ===== */
(function () {
  'use strict';
  const { GRADES, DIMS, GENRES, buildEssay, scoreOf, levelOf, ISSUE_BANK, GOOD_BANK, pick, rand } = window.ZP;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const state = {
    gradeId: null,
    genreId: 'narr',
    note: '',
    weights: [30, 25, 25, 20],
    collapseOpen: true,
    docs: [],
    activeId: null,
    zoom: 1,
    grading: false,
    exporting: false
  };

  const DEMO_LINES = [
    '窗外的梧桐叶被风翻了一下，露出背面浅浅的银色。',
    '我坐在书桌前，笔尖停在纸上，像被什么东西绊住了。',
    '那天下午发生的事，一遍一遍地在我眼前重演。',
    '妈妈在厨房里弯腰拣菜，背影像一张被岁月折过的纸。',
    '我忽然想走过去，帮她提一下那袋米，可我又坐回去了。',
    '她说，你先写作业，这点事妈自己来。',
    '我一低头，才发现本子上一个字也没写。',
    '原来有些话，是要等长大了才听得懂的。',
    '我想起了去年冬天，也是这样的一个下午。',
    '雪下得很急，把整条街都下白了。',
    '她把我的手拢在掌心里，一下一下地搓。',
    '那时候我还嫌她手太粗糙，把手抽了回来。',
    '现在想起来，心里像被什么轻轻撞了一下。',
    '那天晚上，我第一次主动去厨房洗碗。',
    '水很凉，碗很多，我却洗得很有耐心。',
    '妈妈站在门口看我，什么也没说，只是笑了一下。',
    '那个笑，我到现在还记得。'
  ];

  // 与 makePlaceholder 同一套网格参数，保证容器宽高比一致
  const PAPER = { PAD_X: 86, LINE_W: 600, FIRST_BASE: 186, LINE_GAP: 40, TXT: 19, OFFSET: 8, W: 760 };
  function demoPageH(rows) {
    const n = rows || DEMO_LINES.length;
    const bottom = PAPER.FIRST_BASE + (n - 1) * PAPER.LINE_GAP + 46;
    return Math.max(836, Math.round(bottom + 40));
  }

  const getGrade = () => GRADES.find(g => g.id === state.gradeId) || { id: null, name: '未选年级', label: '请先选择', total: 100, rules: [], range: [0, 0] };
  const getGenre = () => GENRES.find(g => g.id === state.genreId) || GENRES[0];
  const activeDoc = () => state.docs.find(d => d.id === state.activeId) || null;
  let uid = 0;
  const nid = p => p + '_' + (++uid) + Math.random().toString(36).slice(2, 6);

  /* ================= 左侧：体裁 ================= */
  function renderGenres() {
    $('#genreChips').innerHTML = GENRES.map(g =>
      `<button class="chip ${g.id === state.genreId ? 'on' : ''}" data-g="${g.id}">${g.icon} ${g.name}</button>`).join('');
    $$('#genreChips .chip').forEach(b => b.onclick = () => {
      state.genreId = b.dataset.g;
      const d = activeDoc();
      if (d) { d.genreId = state.genreId; }   // 保留已有批改结果，不打断展示
      renderGenres(); renderTabs(); renderCanvas(); renderReport();
      toast('已切换体裁：' + getGenre().name);
    });
  }

  /* ================= 左侧：年级 ================= */
  function renderGrades() {
    const g = getGrade();
    const pick = $('#gselPick');
    if (pick) {
      pick.innerHTML = state.gradeId
        ? `${g.name}<i>${g.label}</i>`
        : `<span style="color:#b4b9c4">请选择年级</span>`;
    }
    const menu = $('#gselMenu');
    if (menu) {
      menu.innerHTML = GRADES.map(x => `
        <button class="gopt ${x.id === state.gradeId ? 'on' : ''}" type="button" data-g="${x.id}">
          <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M5 12l5 5L20 7"/></svg>
          <b>${x.name}</b><em>${x.label}</em>
        </button>`).join('');
      menu.querySelectorAll('.gopt').forEach(b => {
        b.onclick = e => {
          e.stopPropagation();
          state.gradeId = b.dataset.g;
          const d = activeDoc();
          if (d) { d.gradeId = state.gradeId; }   // 保留已有批改结果
          closeGradeMenu();
          renderGrades(); renderWeights(); renderGradeRule(); renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
        };
        // 悬停显示写作要求
        b.onmousemove = (ev) => { if (!tipActive) { tipActive = true; showGTip(b.dataset.g, ev); } else { moveGTip(ev); } };
        b.onmouseleave = () => { tipActive = false; hideGTip(); };
      });
    }
    renderGradeRule();
  }

  let gtipTimer = null;
  let tipActive = false;
  // 浮层挂到 body，避免被侧栏 overflow:hidden 裁剪
  function ensureTipEl() {
    let el = document.getElementById('gTipFloat');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gTipFloat';
      el.className = 'gtip-float';
      document.body.appendChild(el);
    }
    return el;
  }
  function showGTip(id, ev) {
    clearTimeout(gtipTimer);
    gtipTimer = setTimeout(() => {
      const g = GRADES.find(x => x.id === id);
      if (!g) return;
      const el = ensureTipEl();
      el.innerHTML = `<h5>${g.name}写作要求<span>满分 ${g.total}</span></h5>
        <ul>${g.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <div class="gmeta">建议字数 ${g.label}</div>`;
      el.classList.add('show');
      el.style.visibility = 'hidden';
      requestAnimationFrame(() => placeTip(ev));
    }, 60);
  }
  function moveGTip(ev) {
    const el = document.getElementById('gTipFloat');
    if (!el || !el.classList.contains('show')) return;
    placeTip(ev);
  }
  // 智能定位：默认落在鼠标右下方，越界自动翻转，尽量不压住侧栏底部按钮
  function placeTip(ev) {
    const el = document.getElementById('gTipFloat');
    if (!el || !ev) return;
    const W = el.offsetWidth || 240, H = el.offsetHeight || 170;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = ev.clientX + 18, y = ev.clientY + 14;
    if (x + W > vw - 10) x = ev.clientX - W - 18;
    if (y + H > vh - 10) y = ev.clientY - H - 14;
    // 若落在左栏底部按钮区域，整体上移
    const foot = document.querySelector('.side-foot');
    if (foot) {
      const fr = foot.getBoundingClientRect();
      if (x < 250 && y + H > fr.top && y < fr.bottom) y = Math.max(10, fr.top - H - 10);
    }
    el.style.left = Math.max(8, Math.min(x, vw - W - 8)) + 'px';
    el.style.top = Math.max(8, Math.min(y, vh - H - 8)) + 'px';
    el.style.visibility = 'visible';
  }
  function hideGTip() {
    clearTimeout(gtipTimer);
    const el = document.getElementById('gTipFloat');
    if (el) el.classList.remove('show');
  }
  function openGradeMenu() {
    const box = $('#gradeSelect');
    if (!box) return;
    const m = $('#gselMenu'); if (m) m.style.display = '';
    box.classList.add('open');
    state.gselOpenedAt = Date.now();
    hideGTip();
  }
  function closeGradeMenu() {
    const box = $('#gradeSelect');
    if (!box) return;
    box.classList.remove('open');
    hideGTip();
  }

  // 写作要求不再常驻显示，仅在下拉项悬停时以浮层呈现
  function renderGradeRule() { /* 已迁移至下拉悬停浮层 .gtip */ }

  /* ================= 左侧：四维权重 ================= */
  function renderWeights() {
    const g = getGrade();
    const box = $('#weightBox') || createWeightBox();
    box.innerHTML = DIMS.map((d, i) => `
      <div class="dim" style="--tc:${d.color}">
        <div class="dim-h">
          <span class="n"><em style="background:${d.color}"></em>${d.name}</span>
          <span class="v"><span data-wv="${i}">${state.weights[i]}</span><span>分</span></span>
        </div>
        <div class="range-wrap"><div class="fill" data-fill="${i}"></div>
          <input type="range" min="0" max="100" step="1" value="${state.weights[i]}" data-w="${i}">
        </div>
        <div class="hint">${d.hint}</div>
      </div>`).join('') + `
      <div class="sum-bar" id="sumBar">
        <span>权重合计</span>
        <span><b class="num" id="sumNum">100</b> / 100</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="chip" id="btnResetW" style="flex:1">恢复默认</button>
        <button class="chip" id="btnEvenW" style="flex:1">平均分配</button>
      </div>`;
    bindWeights();
  }
  function createWeightBox() {
    const el = document.createElement('div');
    el.id = 'weightBox';
    $('#weightSlot').appendChild(el);
    return el;
  }
  function syncWeightUI() {
    const sum = state.weights.reduce((a, b) => a + b, 0);
    DIMS.forEach((d, i) => {
      const inp = document.querySelector(`[data-w="${i}"]`);
      if (!inp) return;
      // 每个维度最低 5 分，其余三维最少占 15 分，故单维最高 85
      inp.max = 85;
      inp.value = state.weights[i];
      const v = document.querySelector(`[data-wv="${i}"]`);
      if (v) v.textContent = state.weights[i];
      const f = document.querySelector(`[data-fill="${i}"]`);
      if (f) f.style.width = state.weights[i] + '%';
    });
    const bar = $('#sumBar'), num = $('#sumNum');
    if (bar && num) {
      num.textContent = sum;
      bar.classList.toggle('warn', sum !== 100);
      bar.querySelector('span').textContent = sum > 100 ? '⚠ 权重超出' : sum < 100 ? '✎ 权重未满' : '权重合计';
    }
    // 同步“其他维度可让出”的提示
    DIMS.forEach((d, i) => {
      const tip = document.querySelector(`[data-others="${i}"]`);
      if (tip) tip.textContent = `其余 ${100 - state.weights[i]} 分`;
    });
  }
  function bindWeights() {
    // 联动规则：拖动任一维度，其余三个维度按当前比例分摊差额，总和恒为 100
    $$('[data-w]').forEach(inp => {
      inp.oninput = () => {
        const i = +inp.dataset.w;
        const target = Math.max(5, Math.min(85, Math.round(+inp.value)));
        const w = state.weights.slice();
        const othersIdx = [0, 1, 2, 3].filter(k => k !== i);
        const othersSum = othersIdx.reduce((a, k) => a + w[k], 0);
        const rest = 100 - target;          // 其余三维应占的总和

        if (rest <= 0) {
          // 拉到 100：其余全部归零
          othersIdx.forEach(k => { w[k] = 0; });
        } else if (othersSum <= 0) {
          // 其余原本都是 0，则平均分配
          const base = Math.floor(rest / 3);
          othersIdx.forEach((k, n) => { w[k] = base + (n < rest - base * 3 ? 1 : 0); });
        } else {
          // 按现有比例缩放其余三维，并处理取整误差
          let acc = 0;
          othersIdx.forEach((k, n) => {
            const raw = (n === othersIdx.length - 1) ? rest - acc : Math.round(w[k] / othersSum * rest);
            w[k] = Math.max(5, raw);
            acc += w[k];
          });
          // 若抬到最低 5 后超额，从最大的那项扣回
          let over = othersIdx.reduce((a, k) => a + w[k], 0) - rest;
          while (over > 0) {
            const big = othersIdx.reduce((m, k) => w[k] > w[m] ? k : m, othersIdx[0]);
            if (w[big] <= 5) break;
            w[big] -= 1; over -= 1;
          }
        }
        w[i] = target;
        // 兜底：修正四舍五入带来的偏差
        let sum = w.reduce((a, b) => a + b, 0);
        let guard = 0;
        while (sum !== 100 && guard++ < 8) {
          const k = othersIdx.find(x => (sum < 100 ? true : w[x] > 0)) ?? i;
          w[k] += sum < 100 ? 1 : -1;
          sum = w.reduce((a, b) => a + b, 0);
        }
        state.weights = w;
        syncWeightUI();
        const dd = activeDoc();
        if (dd) { dd.weights = w.slice(); }
        syncWeightUI();
      };
    });
    const rb = $('#btnResetW');
    if (rb) rb.onclick = () => { state.weights = [30, 25, 25, 20]; syncWeightUI(); };
    const eb = $('#btnEvenW');
    if (eb) eb.onclick = () => { state.weights = [25, 25, 25, 25]; syncWeightUI(); };
    syncWeightUI();
  }

  /* ================= 左侧：上传 ================= */
  const MAXW = 1500;
  function compressImage(file) {
    return new Promise(resolve => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, MAXW / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const data = cv.toDataURL('image/jpeg', 0.82);
          resolve({ data, w, h, name: file.name, raw: file.size, size: Math.round(data.length * 0.75) });
        };
        img.onerror = () => resolve(null);
        img.src = fr.result;
      };
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(file);
    });
  }

  let _uploading = false;
  async function handleFiles(files) {
    if (_uploading) return;
    _uploading = true;
    const imgs = Array.from(files).filter(f => /^image\//.test(f.type));
    if (!imgs.length) { _uploading = false; return toast('请上传图片文件'); }
    toast(`正在处理 ${imgs.length} 张图片…`);

    // 受控并发压缩：同时处理 2 张，降低多页等待且避免内存峰值。
    const pages = new Array(imgs.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < imgs.length) {
        const i = cursor++;
        const f = imgs[i];
        const r = await compressImage(f);
        if (r) pages[i] = { img: r.data, w: r.w, h: r.h, raw: r.raw, size: r.size, name: f.name };
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, imgs.length) }, worker));
    const validPages = pages.filter(Boolean);
    if (!validPages.length) { _uploading = false; return toast('图片处理失败，请重试'); }

    const cur = activeDoc();
    const canAppend = cur && cur.realImg && cur.status !== 'done';   // 当前是未批改的真实稿 → 追加为新页

    if (canAppend) {
      // 同一份作文追加页
      cur.pages = (cur.pages || [{ img: cur.img, w: cur.w, h: cur.h }]).concat(
        validPages.map(p => ({ img: p.img, w: p.w, h: p.h }))
      );
      cur.page = cur.pages.length - 1;
      cur.img = cur.pages[cur.page].img;
      cur.w = cur.pages[cur.page].w;
      cur.h = cur.pages[cur.page].h;
      cur.size = validPages.reduce((a, p) => a + p.size, (cur.size || 0));
      toast(`已追加 ${validPages.length} 页，共 ${cur.pages.length} 页`);
    } else {
      // 新建一份（含多页）
      state.docs = state.docs.filter(x => !x.isDemo);
      const doc = {
        id: nid('doc'),
        name: (state.note && state.note.trim()) || (validPages[0].name || '作文').replace(/\.[^.]+$/, ''),
        pages: validPages.map(p => ({ img: p.img, w: p.w, h: p.h })),
        page: 0,
        img: validPages[0].img, w: validPages[0].w, h: validPages[0].h,
        rawSize: validPages.reduce((a, p) => a + p.raw, 0),
        size: validPages.reduce((a, p) => a + p.size, 0),
        gradeId: state.gradeId, genreId: state.genreId, note: state.note || '',
        weights: state.weights.slice(),
        status: 'pending', result: null, essay: null,
        realImg: true
      };
      state.docs.push(doc);
      state.activeId = doc.id;
      toast(validPages.length > 1 ? `已添加 ${validPages.length} 页，可翻页查看` : '图片已就绪，选择年级后即可批改');
    }

    state.docs.forEach(x => { if (!x.gradeId && state.gradeId) x.gradeId = state.gradeId; });
    const c2 = activeDoc();
    if (c2) {
      state.gradeId = c2.gradeId || state.gradeId;
      registerDraft(c2);      // 上传即写入历史，未批改也能找到
    }
    renderThumbs(); renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
    _uploading = false;
  }

  function renderThumbs() {
    const grid = $('#thumbGrid');
    if (grid) grid.innerHTML = '';
    const hint = $('#uploadHint');
    if (!hint) return;
    const real = state.docs.filter(d => d.realImg);
    if (!real.length) { hint.innerHTML = ''; hint.style.display = 'none'; return; }
    const d = real[0];
    const more = real.length > 1 ? ` 等 ${real.length} 张` : '';
    const pg = (d.pages && d.pages.length > 1) ? ` · ${d.pages.length} 页` : '';
    hint.innerHTML = `<span class="uh-dot"></span>${esc((d.note || d.name || '未命名').slice(0, 16))}${pg}${more}`;
    hint.style.display = 'flex';
  }

  /* ================= 中间：文件 tabs ================= */
  // 顶部标签 = 当前打开的作文 + 历史批改记录（同步展示），可左右滚动
  // 删除一份作文 / 一条历史记录
  // 统一的“空白作文纸”工厂（默认稿 / 添加下一份 / 删除补位共用）
  function newBlankDoc() {
    return {
      id: nid('doc'), name: '未命名',
      img: makePlaceholder('', '那一刻，我长大了'),
      w: 760, h: demoPageH(), rawSize: 0, size: 0,
      gradeId: state.gradeId || null, genreId: state.genreId || 'narr', note: '',
      weights: state.weights.slice(),
      status: 'showcase',     // 默认展示稿：带四色批注，但仅展示不可操作
      result: null, essay: null,
      demoAnnos: makeDemoAnnos(),
      isDemo: true
    };
  }

  function removeItem(kind, id) {
    if (kind === 'h') {
      const list = loadHistory().filter(r => r.id !== id);
      saveHistory(list);
      state.docs = state.docs.filter(d => d.histId !== id);
      if (!state.docs.some(d => d.id === state.activeId)) {
        state.activeId = state.docs[0] ? state.docs[0].id : null;
      }
      renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
      if ($('#mask').classList.contains('on')) openHistory();
      toast('已删除该历史记录');
      return;
    }
    const idx = state.docs.findIndex(d => d.id === id);
    if (idx < 0) return;
    // 最后一份不允许删除，保证画板始终有一篇作文
    if (state.docs.length <= 1) {
      toast('需保留一份，无法删除最后一份');
      return;
    }
    const [removed] = state.docs.splice(idx, 1);
    // 关键：同一篇稿在历史里有对应记录时一并删除，
    // 否则它会以"历史"标签的形式重新出现，导致要删两次。
    if (removed && removed.histId) {
      const list = loadHistory().filter(r => r.id !== removed.histId);
      saveHistory(list);
    }
    if (state.activeId === id) {
      const next = state.docs[idx] || state.docs[idx - 1] || state.docs[0];
      state.activeId = next ? next.id : null;
      if (next) syncLeftFromDoc();
    }
    renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
    toast(`已删除「${(removed && (removed.note || removed.name)) || '未命名'}」`);
  }

  function renderTabs() {
    const t = $('#fileTabs');
    if (!t) return;

    // 当前会话中已打开的作文（含“添加下一份”产生的未命名稿）
    const opened = state.docs.map(d => ({
      kind: 'doc', id: d.id, key: 'd:' + d.id,
      name: (d.status === 'done' ? (d.note || d.name) : (d.note || '未命名')) || '未命名',
      done: d.status === 'done',
      busy: !!d.grading,
      pct: Math.round(d.progress || 0),
      demo: !!d.isDemo,
      active: d.id === state.activeId
    }));

    // 历史记录（已批改），排除当前已打开的同一条
    const openedHist = new Set(state.docs.map(d => d.histId).filter(Boolean));
    const hist = loadHistory()
      .filter(r => !openedHist.has(r.id))
      .map(r => ({
        kind: 'hist', id: r.id, key: 'h:' + r.id,
        name: r.name || '未命名',
        done: true, demo: false, active: false
      }));

    const all = opened.concat(hist);
    if (!all.length) {
      t.innerHTML = `<span class="tabs-empty">暂无作文</span>`;
      return;
    }

    t.innerHTML = all.map(x => `
      <button class="ftab ${x.active ? 'on' : ''} ${x.done ? 'done' : ''} ${x.busy ? 'busy' : ''} ${x.demo ? 'demo' : ''} ${x.kind === 'hist' ? 'hist' : ''}"
        data-kind="${x.kind}" data-id="${x.id}" title="${esc(x.name)}${x.busy ? ' · 批改中 ' + x.pct + '%' : ''}">
        <span class="st"></span>
        <span class="nm">${esc(x.name)}</span>
        ${x.busy ? `<span class="busytag">${x.pct}%</span>` : ''}
        ${x.kind === 'hist' ? '<span class="histtag">历史</span>' : ''}
        ${(all.length > 1 || x.kind === 'hist') ? `<span class="tab-x" data-del="${x.key}" title="删除这份">&times;</span>` : '<span class="tab-x lock" title="需保留一份"></span>'}
      </button>`).join('');

    // 删除按钮：改为容器级事件委托，renderTabs 重建 DOM 也不会丢绑定
    if (!t.dataset.delBound) {
      t.dataset.delBound = '1';
      t.addEventListener('click', e => {
        const x = e.target.closest('.tab-x');
        if (!x) return;
        e.stopPropagation();
        e.preventDefault();
        if (x.classList.contains('lock')) {
          toast('需保留一份，无法删除最后一份');
          return;
        }
        const key = x.dataset.del || '';
        if (!key) return;
        const ci = key.indexOf(':');
        removeItem(key.slice(0, ci), key.slice(ci + 1));
      }, true);   // 捕获阶段先处理，避免被标签点击吞掉
    }

    $$('#fileTabs .ftab').forEach(b => b.onclick = () => {
      const id = b.dataset.id, kind = b.dataset.kind;
      if (kind === 'doc') {
        state.activeId = id;
        renderTabs(); renderCanvas(); renderReport(); syncDemoUI(); syncLeftFromDoc();
      } else {
        const rec = loadHistory().find(x => x.id === id);
        if (rec) rehydrate(rec);
      }
      // 滚动到可见
      setTimeout(() => b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }), 50);
    });

    // 让当前标签自动进入可视区
    requestAnimationFrame(() => {
      const on = t.querySelector('.ftab.on');
      if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  function syncLeftFromDoc() {
    const d = activeDoc(); if (!d) return;
    state.gradeId = d.gradeId; state.genreId = d.genreId; state.note = d.note || '';
    state.weights = (d.weights || [30, 25, 25, 20]).slice();
    $('#noteInput').value = d.note || '';
    renderGenres(); renderGrades(); syncWeightUI();
  }

  /* ================= 中间：画板 ================= */
  function renderCanvas() {
    const d = activeDoc();
    const wrap = $('#canvasInner');
    $('#zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
    if (!d) {
      wrap.innerHTML = '';
      return;
    }
    if (!d.result && !d.demoAnnos?.length) {
      wrap.innerHTML = `
        <div class="plain-sheet">
          ${imgSheet(d, true)}
        </div>`;
      requestAnimationFrame(() => { applyPaperBg(); fitPlainSheet(d); bindPageBar(); });
      return;
    }
    requestAnimationFrame(applyPaperBg);
    const showcase = !d.result;   // 无正式结果 = 纯展示态
    wrap.innerHTML = `
      <div class="board-frame ${showcase ? 'showcase' : ''}">
        ${imgSheet(d, false)}
        ${(!d.realImg && !d.result) ? '<div class="demo-seal">演示作文纸</div>' : ''}
        ${pageBarHTML(d)}
      </div>`;
    requestAnimationFrame(() => {
      fitBoard();     // 先应用缩放，再按真实像素坐标连接批注
      bindPageBar();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        layoutAnnos();
        bindMarkEditing();   // 划线可拖动 / 缩放 / 删除
      }));
    });
  }

  // 把“演示作文纸”印章放在作文纸右下角内侧（贴右、略微上移）
  function placeSeal() {
    const seal = document.querySelector('.demo-seal');
    const paper = document.querySelector('.shot-img') || document.querySelector('.plain-wrap > div');
    const host = document.querySelector('.board-frame');
    if (!seal || !paper || !host) return;

    seal.style.transform = 'rotate(-5deg)';
    seal.style.fontSize = Math.max(9.5, Math.min(12.5, paper.getBoundingClientRect().width / 34)) + 'px';
    seal.style.left = '0px';
    seal.style.top = '0px';
    const sw = seal.offsetWidth, sh = seal.offsetHeight;

    const pr = paper.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const rightInset = 14;   // 距纸张右边缘
    const bottomInset = 54;  // 距纸张底边（略微上移）
    seal.style.left = (pr.right - hr.left - sw - rightInset) + 'px';
    seal.style.top = (pr.bottom - hr.top - sh - bottomInset) + 'px';
    seal.style.right = 'auto';
    seal.style.bottom = 'auto';
  }

  // 统一几何布局：介绍区贴左上、作文纸垂直居中、印章靠右下
  function d0Real() {
    const d = activeDoc();
    return !!(d && d.realImg && d.result);
  }

  function fitBoard() {
    const host = document.querySelector('.board-frame');
    const wrap = document.querySelector('#canvasWrap');
    const intro = document.querySelector('.board-intro');
    const sheet = document.querySelector('.sheet-wrap') || document.querySelector('.plain-sheet');
    if (!host || !wrap || !sheet) return;

    const zoom = state.zoom || 1;
    // 1) 介绍区贴左上（absolute，不影响文档流）
    if (intro) {
      Object.assign(intro.style, {
        position: 'absolute', left: '0px', top: '0px', width: '100%',
        margin: '0', padding: '0 0 6px'
      });
    }

    // 2) 先复位成文档流测量真实尺寸
    sheet.style.position = 'relative';
    sheet.style.left = 'auto';
    sheet.style.top = 'auto';
    sheet.style.margin = '0 auto';
    void sheet.offsetHeight;                      // 强制重排

    const introH = intro ? intro.offsetHeight : 0;
    const hostH = host.clientHeight;
    // 以“实际纸张”为基准，相对整个画板垂直居中（上下留白一致）
    const paperEl0 = document.querySelector('.shot-img') || document.querySelector('.plain-wrap > div');
    const paperH0 = paperEl0 ? paperEl0.getBoundingClientRect().height : 0;
    // 无介绍区：纸张在画板内垂直居中，上下留白一致
    const centered = (hostH - paperH0) / 2;
    const targetTop = Math.max(8, Math.min(centered, hostH - paperH0 - 8));

    // 3) 应用垂直居中（绝对定位到计算值）
    sheet.style.position = 'absolute';
    sheet.style.left = '50%';
    sheet.style.top = targetTop + 'px';
    sheet.style.transform = `translateX(-50%) scale(${zoom})`;
    sheet.style.transformOrigin = 'top center';
    sheet.style.margin = '0';

    // 4) 印章：靠作文纸右下角
    const seal = document.querySelector('.demo-seal');
    const paper = document.querySelector('.shot-img') || document.querySelector('.plain-wrap > div');
    if (seal && paper) {
      seal.style.position = 'absolute';
      seal.style.transform = 'rotate(-5deg)';
      seal.style.left = '0px';
      seal.style.top = '0px';
      const sw = seal.offsetWidth, sh = seal.offsetHeight;
      const sr = sheet.getBoundingClientRect();
      const pr = paper.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      // 直接以 board-frame 为基准绝对定位（避开 css right/bottom 干扰）
      const baseL = pr.left - hr.left;
      const baseT = pr.top - hr.top;
      seal.style.setProperty('left', (baseL + pr.width - sw - 16) + 'px', 'important');
      seal.style.setProperty('top', (baseT + pr.height - sh - 52) + 'px', 'important');
      seal.style.setProperty('right', 'auto', 'important');
      seal.style.setProperty('bottom', 'auto', 'important');
      seal.style.setProperty('position', 'absolute', 'important');
    }
  }

  // 统一把 data-bg 挂成背景图（避免内联 style 转义问题）
  function applyPaperBg() {
    $$('.paper-bg[data-bg]').forEach(el => {
      const u = el.getAttribute('data-bg');
      if (!u) return;
      el.style.backgroundImage = `url("${u}")`;
      el.style.backgroundSize = '100% 100%';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'top center';
    });
  }

  // 页码栏：有更多页时显示
  function pageBarHTML(d) {
    const pages = d.pages || [];
    if (!pages.length || !d.realImg) return '';
    const cur = d.page || 0;
    return `<div class="page-bar" aria-label="作文图片页管理">
      ${pages.map((_, i) => `<span class="pg-wrap ${i === cur ? 'on' : ''}">
        <button class="pg ${i === cur ? 'on' : ''}" data-page="${i}" aria-label="查看第 ${i + 1} 页">第 ${i + 1} 页</button>
        <button class="pg-del" data-del-page="${i}" aria-label="删除第 ${i + 1} 页" title="删除这张图片">×</button>
      </span>`).join('')}
    </div>`;
  }

  // 绑定页码点击与单页删除
  function bindPageBar() {
    $$('.page-bar .pg').forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        switchPage(+b.dataset.page);
      };
    });
    $$('.page-bar .pg-del').forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        removePage(+b.dataset.delPage);
      };
    });
  }

  function removePage(idx) {
    const d = activeDoc();
    if (!d || !d.realImg || !Array.isArray(d.pages) || !d.pages[idx] || d.grading) return;
    d.pages.splice(idx, 1);
    // 图片发生变化后，旧报告与坐标都已失效，不能继续展示。
    d.result = null;
    d.status = 'pending';
    d.histId = null;
    if (!d.pages.length) {
      d.realImg = false;
      d.img = ''; d.w = 0; d.h = 0; d.page = 0;
      toast('已删除最后一张图片，可重新上传');
    } else {
      d.page = Math.min(idx, d.pages.length - 1);
      const p = d.pages[d.page];
      d.img = p.img; d.w = p.w; d.h = p.h;
      toast(`已删除第 ${idx + 1} 页，当前共 ${d.pages.length} 页`);
    }
    renderThumbs(); renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
  }

  // 切换页
  function switchPage(idx) {
    const d = activeDoc();
    if (!d || !d.pages || !d.pages[idx]) return;
    d.page = idx;
    d.img = d.pages[idx].img;
    d.w = d.pages[idx].w;
    d.h = d.pages[idx].h;
    renderCanvas();
    renderReport();
  }

  // 上传稿：按画板可用空间等比缩放并垂直居中
  function fitPlainSheet(d) {
    const wrap = document.querySelector('#canvasWrap');
    const sheet = document.querySelector('.plain-sheet');
    const box = document.querySelector('.plain-wrap > div');
    const hint = document.querySelector('.plain-wrap .pending-hint');
    if (!wrap || !sheet || !box) return;

    const zoom = state.zoom || 1;
    const pad = 28;
    const availW = wrap.clientWidth - pad * 2;
    const availH = wrap.clientHeight - pad * 2 - (hint ? hint.offsetHeight + 14 : 0);
    const ratio = (d.h || 1) / (d.w || 1);

    let w = Math.min(availW, availH / ratio, 760);
    let h = w * ratio;
    if (h > availH) { h = availH; w = h / ratio; }

    box.style.width = (w * zoom) + 'px';
    box.style.height = (h * zoom) + 'px';
    box.style.maxHeight = 'none';

    const bg = box.querySelector('.paper-bg');
    if (bg) {
      bg.style.paddingTop = '0';
      bg.style.height = '100%';
      bg.style.width = '100%';
      bg.style.display = 'block';
      bg.style.backgroundSize = '100% 100%';   // 用 100% 100% 保证铺满且可见
      bg.style.backgroundRepeat = 'no-repeat';
    }

    sheet.style.height = '100%';
    sheet.style.display = 'flex';
    sheet.style.flexDirection = 'column';
    sheet.style.alignItems = 'center';
    sheet.style.justifyContent = 'center';
    sheet.style.transform = 'none';
    sheet.style.paddingBottom = '0';
    // 提示文字脱离文档流，让“图片本身”严格居中
    if (hint) {
      hint.style.position = 'absolute';
      hint.style.left = '0'; hint.style.right = '0';
      hint.style.bottom = '10px';
      hint.style.margin = '0';
    }
    const pw = document.querySelector('.plain-wrap');
    if (pw) { pw.style.position = 'relative'; pw.style.height = '100%'; pw.style.justifyContent = 'center'; }
  }

  function imgSheet(d, raw) {
    const g = GRADES.find(x => x.id === d.gradeId) || getGrade();
    const genre = GENRES.find(x => x.id === d.genreId) || GENRES[0];
    // 与批改态同一套尺寸逻辑：宽高双向约束，保证整纸完整可见
    const cw0 = $('#canvasWrap') ? $('#canvasWrap').clientWidth : 900;
    const ch0 = $('#canvasWrap') ? $('#canvasWrap').clientHeight : 720;
    const docRatio = (d.h || 1) / (d.w || 1);
    const maxH0 = Math.max(320, ch0 - 92);   // 预留底部说明文字
    const dispW = Math.min(560, cw0 - 120, maxH0 / docRatio);
    if (raw) {
      return `<div class="plain-wrap">
        <div style="position:relative;width:${dispW}px;border-radius:6px;overflow:hidden;
          box-shadow:0 1px 3px rgba(20,23,45,.08),0 10px 32px rgba(20,23,45,.12);background:#fff">
          <div class="paper-bg" data-bg="${esc(d.img)}" style="padding-top:${(d.h/d.w*100).toFixed(2)}%"></div>
          <div class="scan-badge">待批改</div>
        </div>
        <div class="pending-hint">${d.isDemo ? '点击右侧「开始演示批改」，或拖入新的作文图片' : '点击左下角「一键批改」开始'}</div>
        ${pageBarHTML(d)}
      </div>`;
    }
    const srcAnnos = (d.result && d.result.annos) || d.demoAnnos || [];
    srcAnnos.forEach((a, i) => { if (!a.no) a.no = i + 1; });
    // 多页：只绘制当前页对应的批注；单页稿把所有批注归到第 1 页
    const totalPages = (d.pages && d.pages.length) || 1;
    const curPage = (d.page || 0) + 1;
    srcAnnos.forEach(a => { if (!a.page || a.page > totalPages) a.page = 1; });
    const A = totalPages > 1 ? srcAnnos.filter(a => a.page === curPage) : srcAnnos;
    const L = A.filter(a => a.side === 'left'), R = A.filter(a => a.side === 'right');
    // 以实际可用容器为准（扣掉滚动条与内边距），避免批注卡压住正文
    const host = document.querySelector('.board-frame') || $('#canvasWrap');
    const cw = host ? host.clientWidth : 900;
    const ch = $('#canvasWrap') ? $('#canvasWrap').clientHeight : 720;
    const avail = Math.max(300, Math.min(cw - 8, 1160));
    // 宽幅图片时给批注列更多压缩，把宽度让给正文
    const wideDoc = ((d.h || 1) / (d.w || 1)) < 0.8;
    // 竖向窄卡：收窄两侧批注列，把宽度让给作文纸
    const marginW = avail > 1120 ? 146
      : avail > 980 ? 138
      : avail > 820 ? 128
      : wideDoc ? 112 : 118;
    // 高度优先：扣掉介绍区与底部印章/图例后，剩余高度全部给作文纸
    const introH = (document.querySelector('.board-intro') || {}).offsetHeight || 72;
    const reserved = introH + 26 + 18;   // 介绍区 + 间距 + 印章余量
    const maxH = Math.max(300, ch - reserved);
    const ratio = (d.h || 1) / (d.w || 1);
    const byWidth = avail - marginW * 2 - 14;
    const byHeight = maxH / ratio;
    const paperW = Math.max(180, Math.min(byWidth + (wideDoc ? 20 : 0), byHeight, 760));
    const marks = A.filter(a => a.located !== false).map(a => `<div class="ink-mark ${a.type}" data-a="${a.id}" data-side="${a.side}"
        style="left:${a.x * 100}%;top:${a.y * 100}%;width:${a.w * 100}%;height:${a.h * 100}%">
        <div class="mk-body"></div>
        <span class="mark-no">${a.no || ''}</span>
        <span class="mk-grip" title="拖动右下角调整划线长度"></span>
        <button class="mk-del" title="删除这条划线" aria-label="删除这条划线">×</button>
      </div>`).join('');
    return `<div class="sheet-wrap" style="max-width:${avail}px">
      <svg class="anno-lines"></svg>
      <div class="margin-col left" style="width:${marginW}px;flex-basis:${marginW}px">${L.map(a => annoHTML(a)).join('')}</div>
      <div class="shot-col" style="width:${paperW}px">
        <div class="anno-anchor">
          <div class="shot-img">
            <div class="paper-bg" data-bg="${esc(d.img)}" style="padding-top:${(d.h/d.w*100).toFixed(2)}%"></div>
            ${marks}
          </div>
        </div>
      </div>
      <div class="margin-col right" style="width:${marginW}px;flex-basis:${marginW}px">${R.map(a => annoHTML(a)).join('')}</div>
    </div>`;
  }


  function annoHTML(a) {
    return `<div class="anno-row ${a.side}"><div class="anno ${a.type}" data-a="${a.id}">
      <div class="lb"><span class="anno-no">${a.no || ''}</span>${typeLabel(a.type)}</div>
      <div class="tx">${a.html}</div>
    </div></div>`;
  }
  const typeLabel = t => ({ err: '错别字 / 病句', polish: '润色建议', good: '优秀好句', dele: '删改' }[t] || '批注');

  /* ---------- 用 JS 精确摆放批注：卡片按原文纵向位置排列 ---------- */
  /* 当前页应显示的批注（多页稿按 page 过滤；单页稿全显示） */
  function pageAnnos(d) {
    const list = (d && ((d.result && d.result.annos) || d.demoAnnos)) || [];
    const total = (d && d.pages && d.pages.length) || 1;
    if (total <= 1) return list;
    const cur = (d.page || 0) + 1;
    list.forEach(a => { if (!a.page || a.page > total) a.page = 1; });
    return list.filter(a => a.page === cur);
  }

  function layoutAnnos() {
    const d = activeDoc();
    if (!d) return;
    const annos = pageAnnos(d);
    if (!annos.length) return;
    const img = document.querySelector('.shot-img');
    const svg = document.querySelector('.anno-lines');
    if (!img || !svg) return;
    const imgRect = img.getBoundingClientRect();
    const sc = state.zoom || 1;
    const scaleSafe = v => v / sc;
    const colH = scaleSafe(imgRect.height);
    const GAP = 8;
    const PAD_TOP = 2;

    ['left', 'right'].forEach(side => {
      const col = document.querySelector('.margin-col.' + side);
      if (!col) return;
      col.style.minHeight = colH + 'px';
      const items = annos.filter(a => a.side === side).map(a => {
        const el = col.querySelector(`.anno[data-a="${a.id}"]`);
        if (el) { el.style.position = 'absolute'; el.style.left = '0'; el.style.right = '0'; }
        return { a, el };
      }).filter(x => x.el)
        .sort((x, y) => (x.a.y - y.a.y) || (x.a.x - y.a.x));

      // 一、先按"就近原则"贴住各自划线（卡片中心对齐划线中心）
      let placed = [];
      items.forEach(({ a, el }) => {
        const h = el.offsetHeight || 60;
        const anchor = colH * a.y;
        let top = (typeof a.cardTop === 'number')
          ? a.cardTop
          : Math.max(PAD_TOP, anchor - h / 2);
        top = Math.min(top, Math.max(PAD_TOP, colH - h));
        el.style.top = top + 'px';
        placed.push({ a, el, top, h });
      });

      // 二、自上而下消除重叠：被压住的下移，再整体回推避免溢出
      placed.sort((x, y) => x.top - y.top);
      let cursor = PAD_TOP;
      placed.forEach(it => {
        const top = Math.max(it.top, cursor);
        it.top = top;
        it.el.style.top = top + 'px';
        cursor = top + it.h + GAP;
      });

      // 三、底部溢出时整体上移，保证最后一张卡片也在可视区内
      const overflow = cursor - GAP - colH;
      if (overflow > 0) {
        let back = 0;
        for (let i = placed.length - 1; i >= 0; i--) {
          const minTop = i === 0 ? PAD_TOP : placed[i - 1].top + placed[i - 1].h + GAP;
          const want = placed[i].top - Math.max(0, overflow - back);
          const real = Math.max(minTop, want);
          back += Math.max(0, placed[i].top - real);
          placed[i].top = real;
          placed[i].el.style.top = real + 'px';
        }
      }
      // 记录落位，供拖拽使用
      placed.forEach(it => { it.a._cardTop = it.top; });
    });

    drawConnectors();
    bindAnnoHover();
    bindAnnoCardDrag();
  }

  /* 引线：从卡片连到真实划线矩形的近侧端点 */
  function drawConnectors() {
    const d = activeDoc();
    const annos = d ? pageAnnos(d) : [];
    const img = document.querySelector('.shot-img');
    const svg = document.querySelector('.anno-lines');
    if (!img || !svg || !annos.length) return;
    const imgRect = img.getBoundingClientRect();
    const cx = svg.getBoundingClientRect();
    const sc = state.zoom || 1;
    const scaleSafe = v => v / sc;
    const colors = { err: '#e2554f', polish: '#d9a223', good: '#22a06b', dele: '#8b5cf6' };
    svg.innerHTML = '';

    annos.forEach(a => {
      const el = document.querySelector(`.anno[data-a="${a.id}"]`);
      const mark = document.querySelector(`.ink-mark[data-a="${a.id}"]`);
      if (!el || !mark || a.located === false) return;
      const elRect = el.getBoundingClientRect();
      const markRect = mark.getBoundingClientRect();
      const y1 = scaleSafe(elRect.top + 16 - cx.top);
      const y2 = scaleSafe(markRect.top + markRect.height / 2 - cx.top);
      const x1 = scaleSafe((a.side === 'left' ? elRect.right : elRect.left) - cx.left);
      const x2 = scaleSafe((a.side === 'left' ? markRect.left : markRect.right) - cx.left);
      const color = colors[a.type] || '#5b5ce2';
      // 走线规则：卡片 → 图片外侧缝隙（竖直）→ 沿缝隙到标记高度 → 水平接入标记
      // 竖线段落在批注列与图片之间的空白缝里，绝不横穿作文纸正文
      const slotX = scaleSafe((a.side === 'left' ? imgRect.left : imgRect.right) - cx.left);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d',
        `M${x1},${y1} L${slotX},${y1} L${slotX},${y2} L${x2},${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '1.15');
      path.setAttribute('stroke-dasharray', '3 3');
      path.setAttribute('opacity', '.62');
      svg.appendChild(path);
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', x2); dot.setAttribute('cy', y2); dot.setAttribute('r', '3.4');
      dot.setAttribute('fill', color); dot.setAttribute('opacity', '.95');
      svg.appendChild(dot);
    });
    void imgRect;
  }

  function bindAnnoHover() {
    $$('.anno[data-a]').forEach(el => {
      el.onmouseenter = () => { const m = document.querySelector(`.ink-mark[data-a="${el.dataset.a}"]`); if (m) m.classList.add('on'); };
      el.onmouseleave = () => { const m = document.querySelector(`.ink-mark[data-a="${el.dataset.a}"]`); if (m) m.classList.remove('on'); };
    });
    $$('.ink-mark[data-a]').forEach(el => {
      if (el.dataset.editBound) return;
      el.dataset.editBound = '1';
      el.onmouseenter = () => { const a = document.querySelector(`.anno[data-a="${el.dataset.a}"]`); if (a) a.classList.add('lit'); };
      el.onmouseleave = () => { const a = document.querySelector(`.anno[data-a="${el.dataset.a}"]`); if (a) a.classList.remove('lit'); };
    });
  }

  /* ---------- 批注卡片微调：上下拖动 ---------- */
  function bindAnnoCardDrag() {
    const d = activeDoc();
    if (!d) return;
    $$('.anno[data-a]').forEach(el => {
      if (el.dataset.dragBound) return;
      el.dataset.dragBound = '1';
      let st = null;
      el.addEventListener('pointerdown', e => {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target.closest('.anno-del')) return;
        const a = findAnno(d, el.dataset.a);
        if (!a) return;
        st = { y0: e.clientY, top0: parseFloat(el.style.top) || 0, moved: false };
        el.classList.add('dragging');
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', e => {
        if (!st) return;
        const dy = e.clientY - st.y0;
        if (Math.abs(dy) > 2) st.moved = true;
        if (!st.moved) return;
        const sc = state.zoom || 1;
        const col = el.closest('.margin-col');
        const maxTop = Math.max(0, (col ? col.clientHeight : 400) - el.offsetHeight - 2);
        const top = Math.max(2, Math.min(maxTop, st.top0 + dy / sc));
        el.style.top = top + 'px';
        drawConnectors();
      });
      const end = () => {
        if (!st) return;
        const moved = st.moved;
        st = null;
        el.classList.remove('dragging');
        if (moved) {
          const a = findAnno(d, el.dataset.a);
          if (a) {
            const img = document.querySelector('.shot-img');
            const colH = img ? img.getBoundingClientRect().height / (state.zoom || 1) : 0;
            const top = parseFloat(el.style.top) || 0;
            a.cardTop = top;
            // 关键：把卡片顶端换算成百分比写回 y，导出才能拿到微调后的位置
            if (colH > 4) a.y = Math.max(0, Math.min(1, (top + el.offsetHeight / 2) / colH));
            if (a.x == null) a.x = 0.08;
            if (a.w == null) a.w = 0.7;
            a.located = true;
          }
          toast('已调整批注位置');
        }
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    });
  }

  /* ---------- 划线微调：拖动 / 缩放 / 删除 ---------- */
  function findAnno(d, id) {
    const list = editableAnnos(d) || [];
    return list.find(a => a.id === id) || null;
  }

  /* 取当前可编辑的批注数组；演示稿把副本提升为可写数组，保证编辑可保存 */
  function editableAnnos(d) {
    if (d.result && Array.isArray(d.result.annos)) return d.result.annos;
    if (Array.isArray(d.demoAnnos)) {
      d.demoAnnos = d.demoAnnos.map((a, i) => ({ ...a, no: a.no || i + 1 }));
      return d.demoAnnos;
    }
    return null;
  }

  function applyMarkStyle(a) {
    const el = document.querySelector(`.ink-mark[data-a="${a.id}"]`);
    if (!el) return;
    el.style.left = (a.x * 100) + '%';
    el.style.top = (a.y * 100) + '%';
    el.style.width = (a.w * 100) + '%';
    el.style.height = (a.h * 100) + '%';
  }

  function clampRect(a) {
    a.x = Math.max(0, Math.min(0.995, a.x));
    a.y = Math.max(0, Math.min(0.995, a.y));
    a.w = Math.max(0.03, Math.min(1 - a.x, a.w));
    a.h = Math.max(0.012, Math.min(1 - a.y, a.h));
  }

  function bindMarkEditing() {
    const d = activeDoc();
    if (!d) return;
    const list = editableAnnos(d);
    if (!list) return;
    const img = document.querySelector('.shot-img');
    if (!img) return;

    $$('.ink-mark[data-a]').forEach(mark => {
      const id = mark.dataset.a;
      const bod = mark.querySelector('.mk-body') || mark;
      const grip = mark.querySelector('.mk-grip');

      const startDrag = (e, mode) => {
        if (e.button !== undefined && e.button !== 0) return;
        const a = findAnno(d, id);
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = img.getBoundingClientRect();
        const sx = e.clientX, sy = e.clientY;
        const o = { x: a.x, y: a.y, w: a.w, h: a.h };
        let moved = false;
        mark.classList.add('dragging');
        document.body.classList.add('mk-dragging');

        const onMove = ev => {
          const dx = (ev.clientX - sx) / Math.max(1, rect.width);
          const dy = (ev.clientY - sy) / Math.max(1, rect.height);
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 2) moved = true;
          if (!moved) return;
          if (mode === 'move') {
            a.x = o.x + dx; a.y = o.y + dy;
          } else {
            a.w = o.w + dx; a.h = o.h + dy;
          }
          clampRect(a);
          applyMarkStyle(a);
          drawConnectors();
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          mark.classList.remove('dragging');
          document.body.classList.remove('mk-dragging');
          if (moved) {
            layoutAnnos();
            toast('已微调位置，可在导出前继续拖动');
          }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp, { once: true });
      };

      bod.addEventListener('pointerdown', e => {
        if (e.target.closest('.mk-del') || e.target.closest('.mk-grip')) return;
        startDrag(e, 'move');
      });
      if (grip) grip.addEventListener('pointerdown', e => startDrag(e, 'resize'));

      const del = mark.querySelector('.mk-del');
      if (del) {
        del.addEventListener('pointerdown', e => { e.stopPropagation(); });
        del.addEventListener('click', e => {
          e.stopPropagation();
          e.preventDefault();
          const arr = editableAnnos(d);
          if (!arr) return;
          const i = arr.findIndex(x => x.id === id);
          if (i < 0) return;
          arr.splice(i, 1);
          arr.forEach((x, k) => { x.no = k + 1; if (!x.side) x.side = k % 2 ? 'right' : 'left'; });
          renderCanvas();
          toast('已删除这条批注划线');
        });
      }
    });
  }

  /* ================= 批改流程（每份独立进行，可并行、可单独停止） ================= */
  const STAGE_LABEL = ['OCR 文字识别', '四维评分', '逐句批注', '生成报告'];
  const STAGE_COLORS = ['#5b5ce2', '#8b6cf1', '#22a06b', '#d97706'];
  /* 耗时显示：不足 60 秒用秒，超过则带分钟换算 */
  function fmtDur(ms) {
    const v = Number(ms) || 0;
    const sec = v / 1000;
    if (sec < 60) return sec.toFixed(1) + 's';
    const m = Math.floor(sec / 60);
    const s2 = Math.max(0, sec - m * 60);
    if (m < 60) return `${m}m ${s2.toFixed(0)}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  function stageInit() {
    return STAGE_LABEL.map(k => ({ k, ms: 0, st: 'wait' }));
  }

  /* 粗略 token 估算：中文约 1 字 ≈ 0.6 token，图片约 1000 token/页 */
  function estTokens(promptChars, imgCount, elapsedMs) {
    const textIn = Math.round(promptChars / 1.6);
    const imgIn = imgCount * 1000;
    const out = Math.round(elapsedMs / 1000 * 45);
    return { prompt: textIn + imgIn, completion: out, total: textIn + imgIn + out };
  }

  function stopGrade(id) {
    const d = state.docs.find(x => x.id === id);
    if (!d || !d.grading) return;
    d.cancelled = true;
    if (d.ctrl) { try { d.ctrl.abort(); } catch (e) {} }
    d.stageText = '正在停止…';
    renderRunCard();
    syncGradeButtons();
  }

  function renderRunCard() {
    const card = $('#runCard');
    if (!card) return;
    const d = activeDoc();
    const running = state.docs.filter(x => x.grading);
    // 优先展示当前这份（无论它在批改、刚停止还是已完成）
    const target = d || running[0];
    if (!target) { card.hidden = true; return; }
    if (!target.grading && !target.timing && !running.length) { card.hidden = true; return; }

    if (!target.grading) {
      const t = target.timing;
      const isStopped = target.cancelled && !target.result;
      if (isStopped || !t || (target.id !== state.activeId)) { card.hidden = true; return; }
      card.hidden = false;
      const total = Math.max(1, t.total);
      card.innerHTML = `
        <div class="rc-head"><span class="rc-dot done"></span>批改完成
          <span class="rc-time">${fmtDur(t.total)}</span></div>
        <div class="rc-stages">
          ${(t.stages || []).map((s, i) => `<div class="rc-st">
            <span class="rc-k">${esc(s.k)}</span>
            <span class="rc-track"><i style="width:${Math.max(4, Math.round(s.ms / total * 100))}%;background:${STAGE_COLORS[i % STAGE_COLORS.length]}"></i></span>
            <span class="rc-v" style="color:${STAGE_COLORS[i % STAGE_COLORS.length]}">${fmtDur(s.ms)}</span>
          </div>`).join('')}
        </div>
        <div class="rc-foot">
          <span>${t.usage ? `用量 ${t.usage.total.toLocaleString()} tokens（接口返回）` : `约 ${(t.estTokens || 0).toLocaleString()} tokens（估算）`}</span>
        </div>`;
      return;
    }

    card.hidden = false;
    const pct = Math.round(target.progress || 0);
    card.innerHTML = `
      <div class="rc-head"><span class="rc-dot live"></span>正在批改
        <span class="rc-time"><b id="rcClock">${fmtClock(target.startedAt ? Date.now() - target.startedAt : 0)}</b></span>
      </div>
      <div class="rc-bar"><i style="width:${Math.max(3, pct)}%"></i></div>
      <div class="rc-now" id="rcNow">${esc(target.stageText || '准备中…')} · ${pct}%</div>
      <div class="rc-foot">
        <span id="rcToken">约 ${Math.round(target.tokens || 0).toLocaleString()} tokens</span>
        <span class="rc-hint">可点下方按钮停止</span>
      </div>`;
    if (running.length > 1) {
      card.querySelector('.rc-head').insertAdjacentHTML('beforeend',
        `<span class="rc-more">+${running.length - 1} 份</span>`);
    }
  }

  let _rcTimer = null;
  function startRunClock() {
    if (_rcTimer) return;
    _rcTimer = setInterval(() => {
      if (!state.docs.some(x => x.grading)) { clearInterval(_rcTimer); _rcTimer = null; return; }
      const d = state.docs.find(x => x.grading && x.id === state.activeId) || state.docs.find(x => x.grading);
      const el = document.getElementById('rcClock');
      if (el && d && d.startedAt) el.textContent = fmtClock(Date.now() - d.startedAt);
      // 长请求期间让进度条平缓推进，但不越过当前阶段上限
      if (d && d.grading) {
        const cap = d.stageCap || 34;
        if ((d.progress || 0) < cap) {
          d.progress = Math.min(cap, (d.progress || 0) + 0.7);
          const bar = document.querySelector('#runCard .rc-bar i');
          if (bar) bar.style.width = Math.max(3, Math.round(d.progress)) + '%';
          const nowEl = document.getElementById('rcNow');
          if (nowEl) nowEl.textContent = (d.stageText || '批改中…') + ' · ' + Math.round(d.progress) + '%';
        }
      }
      const tk = document.getElementById('rcToken');
      if (tk && d) {
        const est = estTokens(900, (d.pages || []).length || 1, Date.now() - (d.startedAt || Date.now()));
        d.tokens = est.total;
        tk.textContent = `约 ${Math.round(est.total).toLocaleString()} tokens`;
      }
    }, 500);
  }

  /* ================= 消息提醒（铃铛） ================= */
  function notifList() {
    if (!Array.isArray(state.notifs)) state.notifs = [];
    return state.notifs;
  }
  /* 把接口错误转成可读原因与建议 */
  function explainError(msg) {
    const m = String(msg || '');
    if (/429|rate limit|too many/i.test(m))
      return '请求过于频繁，被服务端限流。建议：稍等 10~30 秒再重试，或改为逐份批改。';
    if (/401|403|unauthorized|invalid.*key/i.test(m))
      return '接口密钥无效或已过期。建议：到「AI 部署」里检查 API Key 是否正确。';
    if (/404|not found/i.test(m))
      return '接口地址或模型名称不对。建议：核对 Base URL 结尾是否为 /v1，以及模型名是否可用。';
    if (/timeout|timed out|ETIMEDOUT/i.test(m))
      return '等待响应超时。建议：检查网络，或换用更强的网络环境后重试。';
    if (/JSON|解析|Unexpected token/i.test(m))
      return '返回内容无法解析为结果。建议：换一个支持图片识别的模型，或降低图片分辨率后重试。';
    if (/network|fetch|Failed to fetch|跨域/i.test(m))
      return '网络请求失败，可能被跨域拦截。建议：确认接口允许跨域，或改用本地部署。';
    if (/图片|image|缺少/i.test(m))
      return '这一份没有可用图片。建议：重新上传后再批改。';
    return m || '未知错误';
  }

  function pushNotif(kind, title, desc) {
    const list = notifList();
    list.unshift({ id: 'n' + Date.now() + Math.random().toString(36).slice(2, 5),
      kind, title, desc: desc || '', at: Date.now(), read: false });
    if (list.length > 30) list.length = 30;
    renderBell(true);
  }
  function renderBell(ring) {
    const dot = $('#bellDot');
    const btn = $('#btnBell');
    if (!btn) return;
    const unread = notifList().filter(n => !n.read).length;
    const fails = notifList().filter(n => n.kind === 'fail' && !n.read).length;
    if (dot) {
      dot.hidden = unread === 0;
      dot.textContent = unread > 9 ? '9+' : String(unread);
    }
    btn.classList.toggle('has-alert', fails > 0);
    if (ring) {
      btn.classList.remove('ring');
      void btn.offsetWidth;
      btn.classList.add('ring');
      setTimeout(() => btn.classList.remove('ring'), 1700);
    }
    renderBellPop();
  }
  function renderBellPop() {
    const pop = $('#bellPop');
    if (!pop || pop.hidden) return;
    const list = notifList();
    const icon = { fail: '!', ok: '✓', info: 'i' };
    pop.innerHTML = `
      <div class="bp-head"><span>消息提醒</span>
        <button class="bp-clear" id="bpClear">全部已读</button></div>
      <div class="bp-list">
        ${list.length ? list.map(n => `<div class="bp-item" data-nid="${n.id}">
          <span class="bp-ic ${n.kind}">${icon[n.kind] || 'i'}</span>
          <div class="bp-body">
            <div class="bp-t">${esc(n.title)}</div>
            ${n.desc ? `<div class="bp-d">${esc(n.desc)}</div>` : ''}
            <div class="bp-time">${esc(fmtClock(Date.now() - n.at))}前</div>
          </div></div>`).join('')
          : '<div class="bp-empty">暂无消息</div>'}
      </div>`;
    const clr = $('#bpClear');
    if (clr) clr.onclick = e => {
      e.stopPropagation();
      notifList().forEach(n => { n.read = true; });
      renderBell();
    };
    $$('.bp-item', pop).forEach(el => {
      el.onclick = () => {
        const n = notifList().find(x => x.id === el.dataset.nid);
        if (n) { n.read = true; if (n.docId) openDocById(n.docId); }
        renderBell();
        pop.hidden = true;
      };
    });
  }
  function toggleBell(force) {
    const pop = $('#bellPop');
    if (!pop) return;
    const next = typeof force === 'boolean' ? force : pop.hidden;
    pop.hidden = !next;
    if (next) {
      renderBellPop();            // 先按未读态渲染列表
      // 300ms 后再标记已读，避免刚点开红点立刻消失造成闪烁
      setTimeout(() => {
        notifList().forEach(n => { n.read = true; });
        renderBell();
      }, 300);
    }
  }
  function openDocById(id) {
    if (!state.docs.some(d => d.id === id)) return;
    state.activeId = id;
    renderTabs(); renderCanvas(); renderReport(); syncGradeButtons();
  }

  function syncGradeButtons() {
    const d = activeDoc();
    const btn = $('#btnGrade');
    if (!btn) return;
    const txt = $('#btnGradeTxt');
    if (d && d.grading) {
      btn.disabled = false;
      btn.classList.add('is-stop');
      if (txt) txt.textContent = '停止批改';
      btn.title = '点击停止这一份的批改，避免继续消耗额度';
      return;
    }
    btn.classList.remove('is-stop');
    btn.disabled = false;
    if (txt) txt.textContent = '一键批改';
    const hasAI = !!(window.ZPAI && window.ZPAI.mode());
    const noGrade = !((d && d.gradeId) || state.gradeId);
    btn.title = !hasAI ? '请先配置 AI 批改接口'
      : !d || !d.realImg ? '请先上传作文图片'
      : noGrade ? '请先选择年级' : '开始批改这一份';
  }

  async function gradeDoc(d) {
    if (!d || d.grading || !d.realImg) return;
    const gd = GRADES.find(x => x.id === (d.gradeId || state.gradeId)) || getGrade();
    const ge = GENRES.find(x => x.id === d.genreId) || getGenre();
    const ctrl = new AbortController();
    const tAll = Date.now();

    d.ctrl = ctrl;
    d.grading = true;
    d.cancelled = false;
    d.startedAt = tAll;
    d.progress = 3;
    d.stageText = '准备中…';
    d.tokens = 0;
    d.stages = stageInit();
    delete d.timing;
    syncGradeButtons();
    renderRunCard();
    startRunClock();

    let stageIdx = 0;
    const markStage = (i) => {
      const now = Date.now();
      for (let k = 0; k < i; k++) {
        const s = d.stages[k];
        if (s && s.st === 'live') { s.ms = now - (s._t || now); s.st = 'done'; }
        else if (s && s.st === 'wait' && k > stageIdx) { s.st = 'done'; }
      }
      const cur = d.stages[i];
      if (cur && cur.st !== 'done') { cur._t = now; cur.st = 'live'; }
      stageIdx = Math.max(stageIdx, i);
      d.progress = Math.max(d.progress, [8, 42, 72, 93][i] || d.progress);
    };

    try {
      markStage(0);
      // 进度仅由阶段推进，避免出现"准备中 · 3%"的停滞观感
      d.progress = Math.max(d.progress, 12);
      d.stageText = 'OCR 文字识别中…';
      renderRunCard();
      // 中止兜底：即使底层请求不响应 abort，也能立刻结束并释放按钮
      const abortPromise = new Promise((_, rej) => {
        if (ctrl.signal.aborted) { const e = new Error('已取消'); e.code = 'ABORTED'; rej(e); return; }
        ctrl.signal.addEventListener('abort', () => {
          const e = new Error('已取消'); e.code = 'ABORTED'; rej(e);
        }, { once: true });
      });
      const req = await Promise.race([abortPromise, window.ZPAI.grade(
        d, gd, ge.name, d.weights || state.weights,
        (txt, pct) => {
          if (txt) d.stageText = txt;
          if (typeof pct === 'number') {
            d.progress = Math.max(d.progress, pct);
            if (pct >= 90) markStage(3);
            else if (pct >= 70) markStage(2);
            else if (pct >= 38) markStage(1);
            d.stageCap = pct >= 90 ? 98 : pct >= 70 ? 90 : pct >= 38 ? 66 : 34;
          }
          renderRunCard();
        },
        { signal: ctrl.signal }
      )]);
      markStage(3);
      const tModel = Date.now();
      d.result = req;
      d.status = 'done';
      d.gradeId = d.gradeId || state.gradeId;
      if (req.essay && req.essay.title && req.essay.title !== '未命名') d.name = req.essay.title;
      d.progress = 100;
      d.stageText = '已完成';

      const now = Date.now();
      d.stages.forEach(s => { if (s.st === 'live') { s.ms = now - (s._t || now); s.st = 'done'; } });
      const total = now - tAll;
      // 接口一次性返回时无法精确切分阶段：只要有阶段为 0，就按经验权重折算到真实总时长
      const zeroCount = d.stages.filter(s => !(s.ms > 0)).length;
      if (zeroCount > 0) {
        const weights = [0.44, 0.20, 0.26, 0.10];   // OCR / 评分 / 批注 / 报告
        d.stages = d.stages.map((s, i) => ({
          ...s, ms: Math.round(total * weights[i]), estimated: true
        }));
      }
      const usage = req.usage && req.usage.total ? req.usage : null;
      const est = estTokens(900, (d.pages || []).length || 1, total);
      d.timing = {
        stages: d.stages.map(s => ({ k: s.k, ms: Math.round(s.ms || 0) })),
        total,
        usage,
        estTokens: usage ? usage.total : est.total,
        at: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      };
      if (d.result) { d.result.timing = d.timing; }
      if (d.histId) { registerDraft(d); } else { pushHistory(d); }
      pushNotif('ok', `「${d.name}」批改完成`,
        `${d.result.score.total}/${Object.values(d.result.score.points).reduce((a,p)=>a+p.full,0)} 分 · ${d.result.level.name}`);
      d.result.notifDocId = d.id;
      toast(`「${d.name}」批改完成`);
    } catch (err) {
      const aborted = d.cancelled || (err && (err.code === 'ABORTED' || err.name === 'AbortError'));
      if (aborted) {
        d.status = 'pending';
        d.result = null;
        d.stageText = '已停止';
        d.stoppedAt = Date.now();
        pushNotif('info', `「${d.name || '未命名'}」已停止批改`, '点击可重新批改这一份');
        notifList()[0].docId = d.id;
        toast('已停止批改，已产生的输出仍可能会计费');
      } else {
        console.warn('[智批] 批改失败', err);
        d.status = 'pending';
        d.failedAt = Date.now();
        d.failMsg = err.message || '未知错误';
        d.failHint = explainError(d.failMsg);
        pushNotif('fail', `「${d.name || '未命名'}」批改失败`, d.failHint);
        notifList()[0].docId = d.id;
        toast(`「${d.name || '未命名'}」批改失败：${d.failMsg}`);
        if (err.code === 'NOCONFIG') openAIConfig();
      }
    } finally {
      d.grading = false;
      d.ctrl = null;
      d.progress = d.result ? 100 : 0;
      d.stageCap = 34;
      syncGradeButtons();
      // 只在完成/失败/停止导致状态变化时重建标签，避免打断用户正在进行的点击
      renderTabs();
      if (d.id === state.activeId) { renderCanvas(); renderReport(); }
      // 停止 / 失败的不保留进度卡；只有正常完成才展示耗时卡
      if ((d.stoppedAt || d.failedAt) && !d.result) {
        const card = $('#runCard');
        if (card) {
          const failed = !!d.failedAt;
          card.hidden = false;
          card.innerHTML = `
            <div class="rc-head"><span class="rc-dot ${failed ? 'fail' : 'idle'}"></span>
              ${failed ? '这份批改失败' : '已停止批改'}
            </div>
            <div class="rc-now ${failed ? 'multiline' : ''}">${esc(failed ? (d.failHint || explainError(d.failMsg)) : '可重新点击下方按钮再次批改')}</div>
            <div class="rc-foot">
              <span>${failed ? '不影响其他稿件' : '已停止'}</span>
              <button class="rc-retry" id="rcRetry">${failed ? '重试这份' : '重新批改'}</button>
            </div>`;
          const rb = $('#rcRetry');
          if (rb) rb.onclick = () => { d.failedAt = 0; d.stoppedAt = 0; gradeDoc(d); };
        }
      } else {
        renderRunCard();
      }
      if (!state.docs.some(x => x.grading)) { clearInterval(_rcTimer); _rcTimer = null; }
    }
  }

  async function gradeAll() {
    const cur0 = activeDoc();
    // 当前这份正在批改 → 点击即为停止
    if (cur0 && cur0.grading) { stopGrade(cur0.id); return; }

    if (!window.ZPAI || !window.ZPAI.mode()) {
      toast('请先配置 AI 批改接口');
      openAIConfig();
      return;
    }
    if (!cur0 || !cur0.realImg) {
      toast('这一份还没有图片，点上传或直接把图拖进来');
      const dz = $('#dropZone');
      if (dz) {
        dz.classList.add('flash');
        setTimeout(() => dz.classList.remove('flash'), 1400);
        const fi = $('#fileInput');
        if (fi) setTimeout(() => fi.click(), 120);
      }
      return;
    }
    if (!(cur0.gradeId || state.gradeId)) {
      toast('请先选择年级'); openGradeMenu(); return;
    }
    if (cur0.result) { toast('这份已批改完成，可添加下一份继续'); return; }
    // 只批改当前这一份；每份各自独立，互不阻塞
    await gradeDoc(cur0);
  }

  function makeResult(d) {
    // 演示稿固定按六年级生成；正常稿按所选年级，未选则默认六年级兜底
    const g = GRADES.find(x => x.id === d.gradeId) || GRADES.find(x => x.id === 'g6') || GRADES[3];
    const genre = GENRES.find(x => x.id === d.genreId) || GENRES[0];
    // 演示稿：必须使用白板上那篇真实正文，保证报告与画面一致
    const essay = (d.isDemo && typeof DEMO_LINES !== 'undefined')
      ? {
          title: '那一刻，我长大了',
          paras: DEMO_LINES.slice(),
          words: DEMO_LINES.join('').replace(/\s/g, '').length,
          genre
        }
      : buildEssay(g, genre, d.note || '');
    const sc = scoreOf(g, d.weights, essay.paras.join(''), null);
    const lv = levelOf(g, sc.total);
    // 批注：基于段落生成
    const annos = makeAnnos(essay, g, genre, { isDemo: !!(d && d.isDemo) });
    const report = makeReport(essay, g, genre, sc, lv, d, annos);

    // ===== 与最新版对齐：补齐导出层使用的字段，保证演示稿与真实批改同构 =====
    // ① 亮点：补 title / detail
    report.highlights = (report.highlights || []).map(h => ({
      title: h.title || h.t || '',
      detail: h.detail || h.d || '',
      t: h.t || h.title || '',
      d: h.d || h.detail || ''
    }));
    // ② 问题：补 title / severity / desc / quote / fix
    report.issues = (report.issues || []).map(it => ({
      title: it.title || it.t || '',
      severity: it.severity || it.sev || 'low',
      sev: it.sev || it.severity || 'low',
      desc: it.desc || it.d || '',
      detail: it.desc || it.d || '',
      quote: it.quote || '',
      fix: it.fix || '',
      ex: it.ex || ''
    }));
    // ③ 润色稿：不在此处预生成，交由 buildPolished 统一处理（带变更追踪）
    // ④ 四维评语：演示稿补齐
    if (!report.dimComments) {
      report.dimComments = {};
      (window.ZP.DIMS || []).forEach(dm => {
        const p = (sc.points || {})[dm.key];
        report.dimComments[dm.key] = p && p.comment ? p.comment : (dm.hint || '');
      });
    }
    return { essay, score: sc, level: lv, annos, report, at: Date.now() };
  }

  /* ---------- 生成四条批注（每条对应段落） ---------- */
  function makeAnnos(essay, g, genre, opts) {
    const P = essay.paras.filter(x => x && x.length > 4);
    if (!P.length) return [];
    const cut = (t, n) => String(t).replace(/^\s+/, '').slice(0, n);
    const build = [];
    const N = P.length;

    // ① 好句：取最长的一段（通常细节最足）
    let best = 0;
    P.forEach((t, i) => { if (t.length > P[best].length) best = i; });
    build.push({ type: 'good', para: best,
      html: `“<b>${cut(P[best], 18)}…</b>”这句有真实细节，画面清楚，是全文最出彩的一处，<b>建议保留这种写法</b>。` });

    // ② 润色：至少 3 条（针对不同段落）
    const polishTargets = [...new Set([1, Math.floor(N / 2), N - 2])].filter(i => i >= 0 && i < N && i !== best).slice(0, 3);
    polishTargets.forEach((pi, k) => {
      const t = P[pi];
      const tips = [
        `“<b>${cut(t, 20)}…</b>”可补一个动作细节，例如把心理描写换成手或眼睛的动作，会更具体。`,
        `此处句子偏平，建议加一个比喻：<b>“像被反复折过的纸”</b>这类来自生活的喻体，比形容词更有力。`,
        `节奏可再拉开：把长句在转折处断开，短句单独成句，读起来更有停顿感。`
      ];
      build.push({ type: 'polish', para: pi, html: tips[k % tips.length] });
    });

    // ③ 错别字/病句：扫描全篇常见问题
    const errRules = [
      { re: /(很|非常|特别)(感动|难过|开心|高兴|紧张)/, tip: '“<b>$1$2</b>”是抽象概括，建议换成身体反应，如“鼻子一酸/喉咙发紧”。' },
      { re: /慢慢的|静静地|轻轻的/, tip: '“<b>$&</b>”误用：修饰动词应用“地”，改为“慢慢地/静静地/轻轻地”。' },
      { re: /的的|了了|地地/, tip: '“<b>$&</b>”重复用字，属笔误，删去一个即可。' },
      { re: /[，,]{2,}|[。]{2,}/, tip: '标点连用（“<b>$&</b>”），应改为单个标点。' },
      { re: /像(.{2,10})一样像/, tip: '比喻重复（“<b>$&</b>”），保留一处即可。' },
      { re: /并且而且|因为所以/, tip: '“<b>$&</b>”关联词冗余，保留一个更简洁。' }
    ];
    let errCount = 0;
    errRules.forEach(r => {
      if (errCount >= 3) return;
      P.forEach((t, pi) => {
        if (errCount >= 3) return;
        const m = t.match(r.re);
        if (m) { build.push({ type: 'err', para: pi, html: r.tip.replace(/\$&/g, m[0]).replace(/\$1/g, m[1] || '').replace(/\$2/g, m[2] || '') }); errCount++; }
      });
    });
    if (errCount === 0) {
      let li = 0;
      P.forEach((t, i) => { if (/[^。！？]{42,}/.test(t) && i !== best) li = i; });
      build.push({ type: 'err', para: li,
        html: `“<b>${cut(P[li], 24)}…</b>”一句超过 40 字未断句，建议在主语后加逗号，读起来不喘。` });
      build.push({ type: 'err', para: Math.min(2, N - 1),
        html: `全篇未发现明显错别字，但要注意<b>“的/地/得”</b>三字用法：修饰名词用“的”，修饰动词用“地”，补充说明用“得”。` });
    }

    // ④ 删改：1 条
    build.push({ type: 'dele', para: Math.max(0, N - 1),
      html: `结尾“<b>${cut(P[N - 1], 16)}…</b>”与上文意象有重复，建议<u>删去一句</u>，把感受藏在动作里更克制。` });

    // ===== 定位：按批注对应段落的真实行位置计算，不再均分 =====
    // 演示稿的正文是与 PAPER 网格严格对齐的排版，段落 i 的文字基线在 FIRST_BASE + i*LINE_GAP，
    // 因此批注条的纵坐标必须由段落号换算，才能精确压在该段文字上。
    const gridTotal = () => {
      if (typeof P !== 'undefined' && P && P.FIRST_BASE != null) return P;
      if (typeof PAPER !== 'undefined' && PAPER) return PAPER;
      return { PAD_X: 86, LINE_W: 600, FIRST_BASE: 186, LINE_GAP: 40, W: 760 };
    };
    const G = gridTotal();
    const rowsAll = (opts && opts.isDemo && typeof DEMO_LINES !== 'undefined') ? DEMO_LINES.length : N;
    const pageH = (typeof demoPageH === 'function') ? demoPageH(rowsAll) : 1000;

    // 段落号 → 该行文字的纵向区间（相对纸张高度）
    const rowToY = (row) => {
      const base = G.FIRST_BASE + Math.max(0, row) * G.LINE_GAP;
      const topPx = base - 14;            // 条顶略高于文字顶
      const hPx = 44;                     // 条高覆盖一整行
      return {
        y: Math.max(0, Math.min(0.97, topPx / pageH)),
        h: Math.max(0.018, Math.min(0.06, hPx / pageH))
      };
    };

    const total = build.length;
    // 先按段落先后排序，编号与阅读顺序一致（从上到下 1、2、3…）
    build.sort((a, b) => (a.para - b.para) || 0);
    return build.map((a, i) => {
      const side = i % 2 === 0 ? 'left' : 'right';
      const pos = rowToY(a.para);
      return {
        id: 'a' + i, no: i + 1, type: a.type, side, html: a.html, para: a.para,
        stat: { good: '好句', err: '病句', polish: '润色', dele: '删改' }[a.type],
        x: G.PAD_X / G.W,
        y: pos.y,
        w: G.LINE_W / G.W,
        h: pos.h
      };
    });
  }

  /* ---------- 报告内容 ---------- */
  function makeReport(essay, g, genre, sc, lv, d, annos) {
    const P = essay.paras.filter(x => x && x.length > 4);
    const words = essay.words;
    const cut = (t, n) => t.replace(/^\s+/, '').slice(0, n);
    const first = P[0] || '';
    const last = P[P.length - 1] || '';
    // 挑出全篇最长的一段作为“细节段”
    let li = 0;
    P.forEach((t, i) => { if (t.length > (P[li] || '').length) li = i; });
    const longest = P[li] || first;

    const highlights = [
      { t: '开篇有画面', d: `“${cut(first, 20)}…”用具体场景起笔，读者一上来就能看见人物与环境，<em>入题快</em>。` },
      { t: '细节有落点', d: `第 ${li + 1} 段“${cut(longest, 18)}…”把情绪落在了动作与实物上，比直说感受更有说服力。` },
      { t: '收在主旨上', d: `结尾“${cut(last, 18)}…”回到开头的意象，形成回环，<em>结构收得稳</em>。` }
    ];

    // 问题：用作文的真实特征判断，不再随机抽取
    const issues = [];
    const longSent = P.find(t => /[^。！？]{45,}/.test(t));
    if (longSent) {
      issues.push({ dim: 'language', sev: 'mid', title: '有长句未断开，读起来偏喘',
        desc: `第 ${P.indexOf(longSent) + 1} 段有一句超过 45 字未断句，建议在转折处加逗号或句号。`,
        ex: `原句：<s>${cut(longSent, 46)}…</s>` });
    }
    const vague = P.find(t => /(很|非常|特别)(感动|难过|开心|高兴|紧张)/.test(t));
    if (vague) {
      issues.push({ dim: 'content', sev: 'mid', title: '情绪用概括词表达，画面偏弱',
        desc: '文中用“很感动/很难过”这类词直接说结果，缺少身体反应或动作，感染力会被削弱。',
        ex: `原句：<s>${cut(vague, 26)}…</s> 建议：<b>把它换成手在做什么、眼睛看见什么。</b>` });
    }
    const shortP = P.filter(t => t.length < 30).length;
    if (shortP >= 2) {
      issues.push({ dim: 'structure', sev: 'low', title: '有短段偏碎，层次被切得太细',
        desc: `全篇有 ${shortP} 个不足 30 字的短段，会打断叙述节奏，可以考虑合并到相邻段。`,
        ex: `建议：<b>把相邻的两三句合成一段，让每段只承担一个意思。</b>` });
    }
    if (issues.length < 3) {
      issues.push({ dim: 'norm', sev: 'low', title: '标点与“的/地/得”仍需通读一遍',
        desc: '对话句注意引号与句末标点位置；修饰动词用“地”，补充说明用“得”。',
        ex: '例：<s>他慢慢的走过来。</s> → <b>他慢慢地走过来。</b>' });
    }

    const review = buildReview(P, g, genre, sc, lv, words, words / g.total);

    // 四维评语：必须针对本文，不用通用说明
    const pc = sc.points;
    const dimComments = {
      content: `取材真实，主题明确；把“我明白了什么”藏进动作会更有余味。`,
      structure: `三段式完整，第 ${li + 1} 段细节最足，可将篇幅再向它倾斜。`,
      language: longSent
        ? `用词准确，第 ${P.indexOf(longSent) + 1} 段有长句未断开；比喻偏少。`
        : `用词准确，长短句有变化；比喻与拟人可各添一处。`,
      norm: `标点规范，未见明显错别字；“的/地/得”可再核一遍。`
    };

    return { highlights, issues: issues.slice(0, 3), review, dimComments, stu: d.note || '', words, genre };
  }

  function buildReview(P, g, genre, sc, lv, words, ratio) {
    const [lo, hi] = g.range;
    const wOk = words >= lo && words <= hi;
    const wTxt = wOk ? `篇幅控制在 ${lo}~${hi} 字的要求内（约 ${words} 字），完全达标`
      : words < lo ? `篇幅约 ${words} 字，离 ${lo} 字的下限还差一点，内容稍显单薄` : `篇幅约 ${words} 字，略超出 ${hi} 字上限，可以再精炼`;
    const st = [
      `总体来看，这篇文章属于<b>${lv.name}</b>，得分 ${sc.total} / ${g.total}，在${g.name}</b>中处于${lv.desc}水平。`
    ];
    let t = `这篇文章最打动我的地方，是它的<b>真诚</b>。你没有被"好词好句"绑住，而是愿意写自己真看见、真经历的一件事——`;
    t += `开头“${P[0].slice(0, 18)}”这样的句子，一个具体的场景就把人拉了进来，比“在我的记忆里，有许多难忘的事”要高明得多。`;
    t += `文中的细节也有生活的质感，${words > 500 ? '篇幅充足，材料能撑得住' : '材料虽然不多，但都落到了实处'}，`;
    t += `结尾回到开头的意象，形成一个完整的情绪闭环，这一点做得很好。<br><br>`;
    t += `不过也有需要提高的地方。第一，<b>“经过”写得还不够细</b>。高潮部分只有两三句的动作和语言，读者刚要动情就结束了；`;
    t += `如果能把那一刻放慢，写出<b>自己手在做什么、眼睛看见什么、心里冒出了哪一句话</b>，感染力会翻倍。第二，`;
    t += `<b>情感表达偏"结论化"</b>——“我明白了”“我很感动”这类句子出现多次，但你很少写"为什么"。`;
    t += `试着把感受藏进动作里，像“我把那张纸捏皱了，半天没说话”，比直接说出来更有力量。第三，用词上仍有一些口头化表达，`;
    t += `个别句子过长、缺少停顿，读起来有点喘。<br><br>`;
    t += `再说结构：全文${P.length}段，${wTxt}；段落层次大体清楚，但第一段铺垫稍长，第二、三段之间缺少承接，`;
    t += `建议用一句时间或景物描写做过渡。语言方面，你已经会使用比喻，但密度偏低，可在一两处关键位置再补一个，不必多。`;
    t += `规范书写上，标点基本正确，仍有少量的/地/得混用，注意订正。<br><br>`;
    t += `最后想对你说：写作不是"编一个好故事"，而是"把真的那一刻写清楚"。`;
    t += `你已经有了很好的开头和真诚的态度，接下来只要在<b>细节</b>和<b>克制</b>上下一点功夫，这篇文章完全有潜力再上一个等级。`;
    return t;
  }

  function pickN(arr, n) {
    const a = arr.slice().sort(() => Math.random() - 0.5);
    return a.slice(0, n);
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ================= 右侧报告 ================= */
  function renderReport() {
    const d = activeDoc();
    const box = $('#reportScroll');
    $('#rpMeta').innerHTML = d ? `<span>${(GRADES.find(g => g.id === d.gradeId) || { name: '未选年级' }).name}</span><span>·</span><span>${(GENRES.find(g => g.id === d.genreId) || GENRES[0]).name}</span><span>·</span><span>${d.status === 'done' ? '已批改' : '待批改'}</span>` : '等待批改';
    $('#aiBadge').textContent = d && d.result ? 'AI 批改完成' : 'AI 已就绪';
    if (!d) { box.innerHTML = emptyReport('还没有作文', '上传作文图片并点击「一键批改」，<br>这里会生成完整的批改报告。'); return; }
    if (!d.result) {
      const g = GRADES.find(x => x.id === d.gradeId) || { name: '未选年级', label: '—', total: 100 };
      const ge = GENRES.find(x => x.id === d.genreId) || GENRES[0];
      const isDemoDoc = !!d.isDemo;

      box.innerHTML = `
      <div class="score-card">
        <div class="sc-top">
          <div class="sc-num" style="font-size:26px;letter-spacing:.5px">待评定</div>
          <div class="sc-lv">${(d.note && d.note !== '未命名') ? `<b>${esc(d.note)}</b>` : ''}<span>${g.name || '未选年级'}</span></div>
        </div>
        <div class="sc-sub"><span>尚未评分</span></div>
      </div>
      ${isDemoDoc ? `
      <div class="demo-note clickable" id="demoRun" role="button" tabindex="0" title="点击开始演示批改">
        <div class="dt"><span class="pulse-dot"></span>演示作文</div>
        <div class="demo-title">《那一刻，我长大了》</div>
        <div class="demo-run-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          点击开始演示批改
        </div>
        <div class="dm">
          <span><i style="background:#5b5ce2"></i>内容立意</span>
          <span><i style="background:#0ea5a5"></i>结构逻辑</span>
          <span><i style="background:#e08a35"></i>语言表达</span>
          <span><i style="background:#d4577f"></i>规范书写</span>
        </div>
        <div class="dm" style="border-top:none;padding-top:8px">
          <span><i style="background:#e2554f"></i>病句</span>
          <span><i style="background:#d9a223"></i>润色</span>
          <span><i style="background:#22a06b"></i>好句</span>
          <span><i style="background:#8b5cf6"></i>删改</span>
        </div>
      </div>` : `
      <div class="ready-card">
        <div class="rc-ic">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6d63e8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <h4>作文已就绪</h4>
        <p>${g.name || '未选年级'} · ${ge.name}<br>点击左下角「一键批改」生成报告</p>
      </div>`}
      <div class="report-guide">
        <div class="rg-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <span>批改后将在此呈现</span>
        </div>
        <div class="rg-list">
          <div class="rg-item">
            <span class="rg-k">总分</span>
            <span class="rg-d">四维加权得分与等级（一类文 / 二类文 / 三类文）</span>
          </div>
          <div class="rg-item">
            <span class="rg-k">总评</span>
            <span class="rg-d">200~400 字教师总评，含表扬、问题与建议</span>
          </div>
          <div class="rg-item">
            <span class="rg-k">亮点</span>
            <span class="rg-d">3 条文章亮点，逐条引用原文原句</span>
          </div>
          <div class="rg-item">
            <span class="rg-k">批注</span>
            <span class="rg-d">四色逐句批注：病句 · 润色 · 好句 · 删改</span>
          </div>
          <div class="rg-item">
            <span class="rg-k">升格</span>
            <span class="rg-d">原文与升格对照，标注可提升的分值</span>
          </div>
        </div>
        <div class="rg-foot">右侧内容可独立滚动，便于与中间原图对照</div>
      </div>`;
      const dr = $('#demoRun');
      if (dr) { dr.onclick = () => runDemoBatch(); dr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); runDemoBatch(); } }; }
      return;
    }

    const R = d.result, g = GRADES.find(x => x.id === d.gradeId), sc = R.score, lv = R.level;
    const pct = Math.round(sc.total / g.total * 100);

    box.innerHTML = `
      <div class="score-card">
        <div class="sc-top">
          <div class="sc-num">${sc.total}</div><div class="sc-den">/ ${g.total}</div>
          <div class="sc-lv"><b>${lv.name}</b><span>${g.name} · ${lv.desc}</span></div>
        </div>
        <div class="sc-sub">
          <span>${R.essay.paras.length} 段</span><span class="dotsep">|</span><span>要求 ${g.label}</span>
        </div>
        <div class="sc-bar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="tabs">
        <button class="tab on" data-tab="all">全文概览</button>
        <button class="tab" data-tab="outline">写作思路</button>
        <button class="tab" data-tab="drill">小练笔</button>
        <button class="tab" data-tab="polish">润色后文章</button>
      </div>
      <div class="tabpane on" data-pane="all">${paneAll(R, g, lv)}</div>
      <div class="tabpane" data-pane="outline">${paneOutline(R, g)}</div>
      <div class="tabpane" data-pane="drill">${paneDrill(R, g)}</div>
      <div class="tabpane" data-pane="polish">${panePolish(R, g)}</div>`;

    $$('.tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));
    // 右侧批注条目：仅高亮对应的原文彩块，不切换 Tab
    $$('.ai[data-a]').forEach(el => el.onclick = () => {
      const m = document.querySelector(`.ink-mark[data-a="${el.dataset.a}"]`);
      if (m) {
        m.classList.add('on');
        setTimeout(() => m.classList.remove('on'), 1600);
      }
    });
    drawRadar(sc, g);
  }

  function emptyReport(t, p) {
    return `<div class="rp-empty">
      <div class="cir"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a9abf2" stroke-width="1.6" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
      <h4>${t}</h4><p>${p}</p></div>`;
  }

  /* ---------- 批改耗时卡片 ---------- */
  function timingCard(R) {
    const t = R && R.timing;
    if (!t) return '';
    const ms = v => (Number.isFinite(+v) ? Math.max(0, +v) : 0);
    const total = ms(t.total) || 1;
    const palette = ['#5b5ce2', '#8b6cf1', '#22a06b', '#d97706'];
    // 兼容新旧两种结构：stages 优先，旧字段兜底
    const stages = Array.isArray(t.stages) && t.stages.length
      ? t.stages.map((s, i) => ({ k: s.k || '阶段', v: ms(s.ms), c: palette[i % palette.length] }))
      : [
          { k: '读取与准备', v: ms(t.prep), c: palette[0] },
          { k: '模型识别与评分', v: ms(t.model), c: palette[1] },
          { k: '生成报告与渲染', v: ms(t.render), c: palette[2] }
        ];
    const sec = v => (ms(v) / 1000).toFixed(v < 10000 ? 1 : 0);
    return `<div class="card time-card">
      <div class="card-h"><span class="ic" style="background:#eef0ff;color:#5b5ce2">⏱</span>批改耗时
        <span class="cnt">共 ${sec(total)} 秒</span></div>
      <div class="tc-bars">
        ${stages.map(r => `<div class="tc-row">
          <span class="tc-k">${esc(r.k)}</span>
          <span class="tc-track"><i style="width:${Math.max(4, Math.round(r.v / total * 100))}%;background:${r.c}"></i></span>
          <span class="tc-v" style="color:${r.c}">${sec(r.v)}s</span>
        </div>`).join('')}
      </div>
      <div class="tc-foot">
        <span>${t.usage ? `用量 ${Number(t.usage.total || 0).toLocaleString()} tokens` : `约 ${Number(t.estTokens || 0).toLocaleString()} tokens（估）`}</span>
        <span>${esc(t.at || '')}</span>
      </div>
    </div>`;
  }

  function paneAll(R, g, lv) {
    const sc = R.score;
    return `
    <div class="card">
      <div class="card-h"><span class="ic" style="background:#eef0ff;color:#5b5ce2">◎</span>基本信息</div>
      <div class="radar-box compact">
        <div class="radar-legend tight">${DIMS.map(d => {
          const p = sc.points[d.key];
          return `<div class="rl-item"><span class="rl-dot" style="background:${d.color}"></span>
            <span class="nm">${d.name}</span>
            <span class="sc" style="color:${d.color}">${p.got}<small>/${p.full}</small></span></div>`;
        }).join('')}</div>
        <div id="radarWrap"><canvas id="radar" width="320" height="320"></canvas></div>
      </div>
      <div class="dim-detail">
        ${DIMS.map(d => {
          const p = sc.points[d.key];
          const c = (R.report.dimComments && R.report.dimComments[d.key]) || p.comment || '';
          return `<div class="dd-row">
            <span class="dd-k" style="color:${d.color}"><i style="background:${d.color}"></i>${d.name}</span>
            <span class="dd-v">${esc(c || d.hint)}</span>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;font-size:10.5px;color:#868b97">
        <span class="tag c1">四维测评</span><span class="tag c2">${lv.name}</span>
        <span class="tag c4">${R.essay.paras.length} 段</span>
      </div>
    </div>
    <div class="card">
      <div class="card-h"><span class="ic" style="background:#eaf7f1;color:#22a06b">✦</span>文章亮点<span class="cnt">3 条</span></div>
      ${R.report.highlights.map((h, i) => `<div class="hl"><span class="n">${i + 1}</span><div class="tx"><b>${h.t}</b>　${h.d}</div></div>`).join('')}
    </div>
    <div class="card">
      <div class="card-h"><span class="ic" style="background:#f3ecfd;color:#8b5cf6">📝</span>总评<span class="cnt">${R.report.review.replace(/<[^>]+>/g, '').length} 字</span></div>
      <div class="review">${R.report.review}</div>
    </div>`;
  }

  /* ============ Tab2：写作思路 ============ */
  /* 与导出共用 outlineData 的数据，保证两侧口径完全一致 */
  function paneOutline(R, g) {
    const ge = R.report.genre || {};
    const o = {
      paras: (R.essay.paras || []).filter(x => x && String(x).trim().length > 2),
      issues: R.report.issues || [],
      words: R.essay.words
    };
    const D = (window.ZPEXPORT && window.ZPEXPORT.outlineData)
      ? window.ZPEXPORT.outlineData(o)
      : { diagLine: '', nodes: [], fixes: [] };
    const { diagLine, nodes, fixes } = D;

    return `
    <div class="card">
      <div class="card-h"><span class="ic" style="background:#eef0ff;color:#5b5ce2">◎</span>${esc(ge.name || g.name)} · 参考写作思路
        <span class="cnt">按全文给出下一步方向</span></div>
      <div class="pn-diag">先看现状：${esc(diagLine)}</div>
      <div class="pn-sub2">下面按段落功能给出一条可参考的写法路径，可对照自己的作文逐段调整。</div>
      <div class="pn-flow">
        ${nodes.map(n => `<div class="pn-row">
          <span class="pn-tag ${n.cls}">${n.tag}</span>
          <div class="pn-body">
            <div class="pn-lead">${esc(n.lead)}</div>
            ${n.items.map((x, k) => `<div class="pn-item"><span class="pd-n">${k + 1}</span><span>${esc(x)}</span></div>`).join('')}
            ${n.ex ? `<div class="pn-ex">${esc(n.ex)}</div>` : ''}
          </div>
        </div>`).join('')}
      </div>
    </div>
    ${fixes.length ? `<div class="card">
      <div class="card-h"><span class="ic" style="background:#e9f6ef;color:#2f8f60">✓</span>具体问题与修改思路
        <span class="cnt">${fixes.length} 处</span></div>
      <div class="pn-sub2">针对本篇最值得优先处理的问题，每条给出可落地的改法。</div>
      ${fixes.map((f, i) => `<div class="pn-fix">
        <div class="pn-fix-h"><span class="pf-n">${i + 1}.</span>${esc(f.t)}</div>
        ${f.d ? `<div class="pn-fix-d">${esc(f.d)}</div>` : ''}
        <div class="pn-fix-steps">
          ${f.steps.map((x, k) => `<div class="pn-step"><span class="ps-n">${k + 1}</span><span>${esc(x)}</span></div>`).join('')}
        </div>
      </div>`).join('')}
    </div>` : ''}`;
  }

  /* ============ Tab3：小练笔 ============ */
  function paneDrill(R, g) {
    const issues = (R.report && R.report.issues) || [];
    const P = R.essay.paras || [];
    const drills = buildDrills(R, P, g);

    return `<div class="drill-list">
      ${drills.map((b, i) => `<div class="drill-card">
        <div class="dc-head">
          <span class="dc-n">${i + 1}</span>
          <span class="dc-t">${esc(b.key)}<em>· ${esc(b.focus)}</em></span>
        </div>
        ${b.relatedTitle ? `<div class="dc-issue">对应问题：${esc(b.relatedTitle)}</div>`
          : (b.relatedFallback ? `<div class="dc-issue">本项针对：${esc(b.relatedFallback)}</div>` : '')}
        <div class="dc-row dc-prob"><span class="dc-k">存在的问题</span><span class="dc-v">${esc(b.issue)}</span></div>
        <div class="dc-row dc-idea"><span class="dc-k">思路</span><span class="dc-v">${esc(b.idea)}</span></div>
        <div class="dc-row dc-demo"><span class="dc-k">例子</span><span class="dc-v">${esc(b.demo)}</span></div>
      </div>`).join('')}
    </div>
    <div class="upgrade-tip">写完可回到「写作思路」里的「具体问题与修改思路」，看是否正好改掉了自己的弱项。练笔不必长，80~120 字即可。</div>`;
  }

  /* ============ Tab4：润色后文章 ============ */
  function panePolish(R, g) {
    const P = R.essay.paras.filter(x => x && String(x).trim().length > 2);
    const title = R.essay.title || '未命名';
    // 与导出一致：同一个润色器 + 同一份变更记录
    const trace = [];
    const polished = buildPolished(R, P, trace);
    const notes = buildPolishNotes(trace, P, polished);
    const words = polished.join('').replace(/\s/g, '').length;

    return `<div class="card">
      <div class="card-h"><span class="ic" style="background:#f3ecfd;color:#8b5cf6">✎</span>润色后文章
        <span class="cnt">${words} 字 · ${g.name}要求 ${g.label || ''}</span></div>
      <div class="polish-paper">
        <div class="pp-title">${esc(title)}</div>
        ${polished.map(t => `<p>${esc(t)}</p>`).join('')}
      </div>
    </div>
    ${notes.length ? `<div class="card">
      <div class="card-h"><span class="ic" style="background:#e9f6ef;color:#2f8f60">✓</span>本次润色说明
        <span class="cnt">${notes.length} 项</span></div>
      <div class="pn-sub2">以下为本次润色实际改动的方向，原文的意思、顺序与人物均未改动。</div>
      <div class="pn-notes">
        ${notes.map(n => `<div class="pn-note">
          <div class="pn-note-h">${esc(n.name)}</div>
          <div class="pn-note-d">${esc(n.desc)}</div>
          ${n.sample ? `<div class="pn-note-s">${esc(n.sample)}</div>` : ''}
        </div>`).join('')}
      </div>
    </div>` : ''}`;
  }

  function switchTab(k) {
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === k));
    $$('.tabpane').forEach(p => p.classList.toggle('on', p.dataset.pane === k));
  }

  /* ---------- 雷达图 ---------- */
  function drawRadar(sc, g) {
    const cv = document.getElementById('radar');
    if (!cv) return;
    const wrap = document.getElementById('radarWrap');
    // 按容器实际像素×2 建立画布，避免 132px 显示时标签被裁
    const size = wrap ? Math.round(wrap.clientWidth) || 128 : 128;
    const DPR = 2;
    cv.width = size * DPR;
    cv.height = size * DPR;
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const vals = [
      sc.points.content.quant,
      sc.points.structure.quant,
      sc.points.language.quant,
      sc.points.norm.quant
    ];
    const labels = ['内容立意', '结构逻辑', '语言表达', '规范书写'];
    const N = 4;
    const cx = size / 2, cy = size / 2;
    const R = size * 0.315;              // 留出四周标签空间
    const ang = i => -Math.PI / 2 + i * 2 * Math.PI / N;

    // 网格
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const r = R * ring / 4;
        const x = cx + Math.cos(ang(i)) * r, y = cy + Math.sin(ang(i)) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = ring === 4 ? 'rgba(91,92,226,.04)' : 'transparent';
      ctx.fill();
      ctx.strokeStyle = 'rgba(91,92,226,.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // 轴线
    for (let i = 0; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang(i)) * R, cy + Math.sin(ang(i)) * R);
      ctx.strokeStyle = 'rgba(91,92,226,.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // 数据区
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const r = R * Math.max(0.1, vals[i]);
      const x = cx + Math.cos(ang(i)) * r, y = cy + Math.sin(ang(i)) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    grad.addColorStop(0, 'rgba(109,99,232,.30)');
    grad.addColorStop(1, 'rgba(147,104,240,.18)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#6d63e8';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // 顶点
    for (let i = 0; i < N; i++) {
      const r = R * Math.max(0.1, vals[i]);
      const x = cx + Math.cos(ang(i)) * r, y = cy + Math.sin(ang(i)) * r;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#6d63e8'; ctx.lineWidth = 1.8; ctx.stroke();
    }
    // 标签：左右两侧强制两行，优先落在图形外的空白区，绝不压住雷达图
    const fs = Math.max(8.5, Math.round(size * 0.075));
    ctx.font = `600 ${fs}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.fillStyle = '#6b7080';
    const LH = fs * 1.22;                       // 行高
    const wrap2 = txt => (txt.length >= 4 ? [txt.slice(0, 2), txt.slice(2)] : [txt]);

    for (let i = 0; i < N; i++) {
      const a = ang(i), isTop = i === 0, isBottom = i === 2;
      const horizontal = Math.abs(Math.cos(a)) > 0.01;

      if (!horizontal) {
        // 上下顶点：单行居中，贴到画布上下沿内侧
        ctx.textAlign = 'center';
        if (isTop) { ctx.textBaseline = 'top'; ctx.fillText(labels[i], cx, 1); }
        else { ctx.textBaseline = 'bottom'; ctx.fillText(labels[i], cx, size - 1); }
        continue;
      }

      // 左右顶点：两行，行宽按最长一行计算，保证整体落在图形之外
      const lines = wrap2(labels[i]);
      const maxW = Math.max(...lines.map(t => ctx.measureText(t).width));
      const gap = fs * 0.5;                     // 与菱形尖端的水平间距
      const SIDE_PAD = fs * 0.55;               // 与画布左右边缘的安全边距
      const need = R + gap + maxW + SIDE_PAD;   // 需要的半宽
      const right = Math.cos(a) > 0;

      // 若容器不够宽，自动缩小字号重算（最多缩到 7px）
      let curFs = fs, curLines = lines, curMaxW = maxW;
      let guard = 0;
      const calcNeed = f => R + f * 0.5 + Math.max(...curLines.map(t => ctx.measureText(t).width)) + f * 0.55;
      while (calcNeed(curFs) > size / 2 && curFs > 7 && guard++ < 10) {
        curFs -= 0.5;
        ctx.font = `600 ${curFs}px "PingFang SC","Microsoft YaHei",sans-serif`;
      }

      ctx.textAlign = right ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      // 两行整体垂直居中于菱形中心，且不越出画布上下边
      const blockH = (curLines.length - 1) * curFs * 1.22;
      let top = cy - blockH / 2;
      top = Math.max(curFs / 2 + 1, Math.min(size - curFs / 2 - 1, top));
      const x = right ? size - curFs * 0.55 : curFs * 0.55;
      curLines.forEach((t, k) => ctx.fillText(t, x, top + k * curFs * 1.22));
    }
    void LH;
  }

  function fmtClock(ms) {
    const t = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(t / 60), sec = t % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  function closeModal() { $('#mask').classList.remove('on'); }

  /* ================= 工具 ================= */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  // 启动/重置为演示作文：白板显示《那一刻，我长大了》，带四色批注框，但报告未生成
  function loadDemo(reset, clean) {
    state.docs = [];
    state.note = '';
    state.gradeId = null;
    state.genreId = 'narr';
    const doc = newBlankDoc();   // 默认即为“已批改展示态”：有标注、无正式结果
    state.docs.push(doc);
    state.activeId = doc.id;
    const ni = document.querySelector('#noteInput'); if (ni) ni.value = '';
    renderGenres(); renderGrades();
    renderThumbs(); renderTabs(); renderCanvas(); renderReport();
    syncDemoUI();
  }

  // 演示态的四处标注（与正式批注同一套坐标/配色）
  /* 演示批注：按真实正文逐句定位（行号 → 百分比坐标），与报告内容对齐 */
  function makeDemoAnnos() {
    // 与 PAPER 网格一致：行基线 FIRST_BASE + i*LINE_GAP，页高 demoPageH()
    const pageH = (typeof demoPageH === 'function') ? demoPageH() : 1000;
    const P = (typeof PAPER !== 'undefined') ? PAPER : { PAD_X: 86, LINE_W: 600, FIRST_BASE: 186, LINE_GAP: 40, W: 760 };
    const lineY = i => (P.FIRST_BASE + i * P.LINE_GAP - 14) / pageH;
    const lineH = 44 / pageH;
    const lineX = P.PAD_X / P.W;
    const lineW = P.LINE_W / P.W;

    // 逐句对应 DEMO_LINES 的行号（0 起）
    const items = [
      { row: 0, type: 'good', side: 'left',
        quote: '窗外的梧桐叶被风翻了一下',
        html: '<b>“窗外的梧桐叶被风翻了一下，露出背面浅浅的银色”</b>开篇就是一个具体画面，一落笔把人带进场景，没有空喊抒情。<u>这个写法请保留</u>。' },
      { row: 3, type: 'polish', side: 'right',
        quote: '妈妈在厨房里弯腰拣菜',
        html: '<b>“妈妈在厨房里弯腰拣菜”</b>已有一个好动作，可再补一处身体细节：<b>“手指在围裙上蹭了两下”</b>，人物会更立体。' },
      { row: 4, type: 'err', side: 'left',
        quote: '可我又坐回去了',
        html: '<b>“可我又坐回去了”</b>与上句之间缺一个原因，读者会觉得跳跃。建议补半句：<b>“可话到嘴边，我又缩了回去”</b>。' },
      { row: 7, type: 'dele', side: 'right',
        quote: '原来有些话，是要等长大了才听得懂的',
        html: '<b>“原来有些话，是要等长大了才听得懂的”</b>偏总结式，与后文“那个笑我记得”意思重复，<u>可删去</u>，把道理留给读者。' },
      { row: 11, type: 'polish', side: 'left',
        quote: '那时候我还嫌她手太粗糙',
        html: '<b>“那时候我还嫌她手太粗糙”</b>可与上句合并成对比句：<b>“她的手背划得我发痒，我却抽回了手”</b>，反差更明显。' },
      { row: 16, type: 'good', side: 'right',
        quote: '那个笑，我到现在还记得',
        html: '<b>“那个笑，我到现在还记得”</b>收得干净，停在画面上不下结论，是<u>很好的留白式结尾</u>。' }
    ];

    return items.map((it, i) => ({
      id: 'a' + i,
      no: i + 1,
      type: it.type,
      side: it.side,
      page: 1,
      located: true,
      x: lineX,
      y: Math.max(0, Math.min(0.96, lineY(it.row))),
      w: lineW,
      h: lineH,
      quote: it.quote,
      para: it.row,
      html: it.html
    }));
  }

  // 演示态 UI：禁用“一键批改”，按钮切换为“批改演示”
  function syncDemoUI() {
    syncGradeButtons();
    renderRunCard();
  }

  // 生成一张"手写稿"占位图（SVG dataURI），模拟拍照作文纸
  function makePlaceholder(name, title) {
    const lines = DEMO_LINES;
    // ---- 统一排版网格：文字基线与横线严格对齐 ----
    const PAD_X = 86;          // 正文左边距
    const LINE_W = 600;        // 横线长度
    const FIRST_BASE = 186;    // 第一条文字基线
    const LINE_GAP = 40;       // 行距
    const TXT_SIZE = 19;       // 正文字号
    const RULE_OFFSET = 8;     // 横线在基线下方 8px
    const PAGE_W = 760;
    const HEAD_H = 150;        // 标题区高度
    const rows = lines.length;
    const bodyBottom = FIRST_BASE + (rows - 1) * LINE_GAP + 46;
    const PAGE_H = Math.max(836, Math.round(bodyBottom + 40));

    const rule = lines.map((_, i) => {
      const y = FIRST_BASE + i * LINE_GAP + RULE_OFFSET;
      return `<line x1="${PAD_X - 12}" y1="${y}" x2="${PAD_X - 12 + LINE_W}" y2="${y}" stroke="#e6e9f0" stroke-width="1"/>`;
    }).join('');

    const body = lines.map((l, i) => {
      const y = FIRST_BASE + i * LINE_GAP;
      return `<text x="${PAD_X}" y="${y}" font-size="${TXT_SIZE}" fill="#33363f"
        font-family="'Kaiti SC','STKaiti','KaiTi','Songti SC',serif" letter-spacing="0.5">${esc(l)}</text>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}">
      <defs>
        <linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffefb"/><stop offset="1" stop-color="#fbfaf6"/></linearGradient>
      </defs>
      <rect width="${PAGE_W}" height="${PAGE_H}" fill="#eef0f5"/>
      <rect x="26" y="18" width="708" height="${PAGE_H - 36}" rx="4" fill="url(#p)"/>
      <line x1="68" y1="26" x2="68" y2="${PAGE_H - 26}" stroke="#f2dcdc" stroke-width="1.2"/>
      <text x="380" y="${HEAD_H - 30}" text-anchor="middle" font-size="25" font-weight="600" fill="#22242b"
        font-family="'Songti SC','SimSun',serif" letter-spacing="1.5">${esc(title)}</text>
      ${rule}${body}
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ================= 初始化 ================= */
  function init() {
    // 权重容器插入到 HTML 的折叠区
    const collapse = document.createElement('div');
    collapse.className = 'collapse';
    collapse.innerHTML = `
      <div class="ch"><span class="ttl">四维评分</span>
        <span style="font-size:10px;color:#b4b9c4">权重 100 分</span>
        <svg class="arw" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></div>
      <div class="cb"><div class="inner" id="weightSlot"></div></div>`;
    // 插到「AI 部署」之前，保证顺序为：四维评分 → AI 部署
    const aiBox = $('#aiDeploy');
    const scrollBox = $('.side-scroll');
    if (aiBox && aiBox.parentElement === scrollBox) scrollBox.insertBefore(collapse, aiBox);
    else scrollBox.appendChild(collapse);
    collapse.querySelector('.ch').onclick = () => collapse.classList.toggle('open');
    state.collapseOpen = true;

    renderGenres(); renderGrades(); renderWeights(); renderTabs(); renderCanvas(); renderReport();

    // 学生姓名（仅用于标识/记忆，不影响批改内容）
    const note = $('#noteInput');
    note.oninput = () => {
      state.note = note.value.trim();
      const d = activeDoc();
      if (d) {
        d.note = state.note;
        // 未批改状态：标题跟随姓名；已批改：保留原标题
        if (d.status !== 'done') d.name = state.note || '未命名';
        if (d.realImg) registerDraft(d);
        renderTabs();
        if (!d.result) renderCanvas();
      }
    };

    // 上传
    const dz = $('#dropZone');
    dz.onclick = () => $('#fileInput').click();
    $('#fileInput').onchange = e => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ''; };
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();          // 关键：阻止冒泡到 window，避免重复处理
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });
    // 整页拖拽
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
      e.preventDefault();
      if (e.target.closest && e.target.closest('#dropZone')) return; // 上传区已自行处理
      // 只有真正携带“文件”的拖放才视为上传；拖拽页面内图片不处理
      const items = e.dataTransfer && e.dataTransfer.types ? [...e.dataTransfer.types] : [];
      if (!items.includes('Files')) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });

    $('#btnGrade').onclick = () => gradeAll();
    const bellBtn = $('#btnBell');
    if (bellBtn) bellBtn.onclick = e => { e.stopPropagation(); toggleBell(); };
    document.addEventListener('click', e => {
      const pop = $('#bellPop');
      if (!pop || pop.hidden) return;
      if (!pop.contains(e.target) && !e.target.closest('#btnBell')) pop.hidden = true;
    });
    renderBell();
    $('#btnNext').onclick = addNext;
    $('#btnHistory').onclick = openHistory;

    // 年级下拉
    const gselBtn = $('#gselBtn');
    if (gselBtn) {
      gselBtn.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        const box = $('#gradeSelect');
        box.classList.contains('open') ? closeGradeMenu() : openGradeMenu();
      });
      gselBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
    }
    document.addEventListener('mousedown', e => {
      if (!e.target.closest('#gradeSelect')) closeGradeMenu();
    }, false);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeGradeMenu(); });
    $('#mClose').onclick = closeModal;
    $('#mask').onclick = e => { if (e.target.id === 'mask' && !state.grading) closeModal(); };

    // 画板内禁止拖拽/选中（默认展示图不可拖动、不可另存）
    const cw = $('#canvasWrap');
    if (cw) {
      cw.addEventListener('dragstart', e => { e.preventDefault(); return false; });
      cw.addEventListener('mousedown', e => {
        if (e.target.closest && e.target.closest('.paper-bg, .shot-img, .plain-wrap')) {
          e.preventDefault();   // 禁止从图片起拖
        }
      });
      cw.addEventListener('contextmenu', e => {
        if (e.target.closest && e.target.closest('.paper-bg, .shot-img')) e.preventDefault();
      });
    }

    // 确保 AI 部署面板默认收起
    const _ai = $('#aiDeploy');
    if (_ai && !window.__aiUserOpened) _ai.classList.remove('open');

    // 启动时按已保存配置刷新 AI 状态徽章
    (function refreshAiBadge() {
      const el = $('#adCur');
      if (!el || !window.ZPAI) return;
      const m = window.ZPAI.mode();
      if (m === 'api') { el.textContent = 'AI 接口'; el.className = 'ad-cur ok'; }
      else if (m === 'local') { el.textContent = '本地部署'; el.className = 'ad-cur ok'; }
      else { el.textContent = '未配置'; el.className = 'ad-cur'; }
    })();

    // 顶部标签：鼠标滚轮横向滚动
    const ft = $('#fileTabs');
    if (ft) {
      ft.addEventListener('wheel', e => {
        if (ft.scrollWidth <= ft.clientWidth) return;
        // 纵向滚轮转横向；Shift+滚轮自然横向
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          ft.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }, { passive: false });
    }

    // 缩放
    const setZoom = z => { state.zoom = Math.min(1.4, Math.max(0.6, z)); renderCanvas(); };
    $('#toolZoomIn').onclick = () => setZoom(state.zoom + 0.1);
    $('#toolZoomOut').onclick = () => setZoom(state.zoom - 0.1);
    const doExport = async (kind) => {
      const d = activeDoc();
      if (!d || !d.result) { toast('请先完成批改再导出'); return; }
      if (!window.ZPEXPORT) { toast('导出组件未加载'); return; }
      if (state.exporting) { toast('正在生成，请稍候'); return; }
      const btn = $('#btnExportHTML');
      const label = btn ? btn.querySelector('span') : null;
      const oldText = label ? label.textContent : '';
      const wasBusy = btn ? btn.classList.contains('busy') : false;
      state.exporting = true;
      // 只替换文字并加旋转图标，保持按钮尺寸稳定，避免文字被挤成竖排
      if (btn) { btn.disabled = true; btn.classList.add('busy'); }
      if (label) label.textContent = '生成中';
      try {
        const o = buildExportData(d);
        window.ZPEXPORT.exportHTML(o);
        if (label) label.textContent = '已完成';
        toast('HTML 已开始下载');
        await wait(700);
      } catch (e) {
        console.error(e);
        toast('导出失败：' + (e.message || '未知错误'));
      } finally {
        state.exporting = false;
        if (label) label.textContent = oldText;
        if (btn) { btn.disabled = false; btn.classList.toggle('busy', wasBusy); }
      }
    };
    const _hb = $('#btnExportHTML'); if (_hb) _hb.onclick = () => doExport('html');

    // 快捷键
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); gradeAll(); }
    });

    // ===== AI 部署 =====
    (function initDeploy() {
      const box = $('#aiDeploy'), head = $('#adHead');
      if (!box || !head) return;
      const DK = 'zhipi.ai.deploy.v1';
      const read = () => { try { return JSON.parse(localStorage.getItem(DK) || '{}'); } catch (e) { return {}; } };
      const write = v => { try { localStorage.setItem(DK, JSON.stringify(v)); } catch (e) {} };

      head.onclick = () => {
        window.__aiUserOpened = true;   // 用户主动操作过，后续渲染不再强制收起
        box.classList.toggle('open');
        if (box.classList.contains('open')) {
          setTimeout(() => {
            const sc = document.querySelector('.side-scroll');
            if (!sc) return;
            // 把面板头部滚动到侧栏顶部，保证面板整体可见
            sc.scrollTo({ top: box.offsetTop - 8, behavior: 'smooth' });
          }, 80);
        }
      };
      $$('.ad-tab').forEach(t => t.onclick = () => {
        $$('.ad-tab').forEach(x => x.classList.toggle('on', x === t));
        $$('.ad-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === t.dataset.mode));
      });

      // ---- 快速 / 质量模式 ----
      function updateModeHint(m) {
        const el = $('#adModeHint');
        if (!el) return;
        el.textContent = m === 'quality'
          ? '质量模式：开启深度思考，批改更细致，耗时与 token 消耗更高。'
          : '快速模式：关闭深度思考，批改更快，适合日常作文。';
      }
      $$('.mode-btn').forEach(b => {
        b.onclick = () => {
          $$('.mode-btn').forEach(x => x.classList.toggle('on', x === b));
          updateModeHint(b.dataset.mode);
        };
      });
      const tempEl = $('#adTemp'), tempVal = $('#adTempVal');
      if (tempEl) tempEl.oninput = () => {
        if (tempVal) tempVal.textContent = Number(tempEl.value).toFixed(2);
      };
      function readMode() {
        const on = document.querySelector('.mode-btn.on');
        return on ? on.dataset.mode : 'fast';
      }

      function refreshBadge() {
        const c = read();
        const el = $('#adCur');
        if (!el) return;
        if (c.mode === 'api' && c.api && c.api.key) { el.textContent = 'AI 接口'; el.className = 'ad-cur ok'; }
        else if (c.mode === 'local' && c.local && c.local.model) { el.textContent = '本地部署'; el.className = 'ad-cur ok'; }
        else { el.textContent = '未配置'; el.className = 'ad-cur'; }
      }
      const cfg = read();
      if (cfg.api) {
        if (cfg.api.provider) $('#adProvider').value = cfg.api.provider;
        if (cfg.api.base) $('#adBase').value = cfg.api.base;
        if (cfg.api.key) $('#adKey').value = cfg.api.key;
        if (cfg.api.model) $('#adModel').value = cfg.api.model;
        // 模式：默认快速（关闭深度思考）
        const pm = cfg.api.thinking === true ? 'quality' : 'fast';
        $$('.mode-btn').forEach(b => b.classList.toggle('on', b.dataset.mode === pm));
        updateModeHint(pm);
        // 温度
        const tp = (typeof cfg.api.temperature === 'number') ? cfg.api.temperature : 0.25;
        const tpEl = $('#adTemp'), tvEl = $('#adTempVal');
        if (tpEl) tpEl.value = String(tp);
        if (tvEl) tvEl.textContent = tp.toFixed(2);
      }
      if (cfg.local) {
        if (cfg.local.engine) $('#adEngine').value = cfg.local.engine;
        if (cfg.local.base) $('#adLocalBase').value = cfg.local.base;
        if (cfg.local.model) $('#adLocalModel').value = cfg.local.model;
      }
      if (cfg.mode) {
        $$('.ad-tab').forEach(x => x.classList.toggle('on', x.dataset.mode === cfg.mode));
        $$('.ad-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === cfg.mode));
      }
      refreshBadge();

      $('#adSave').onclick = () => {
        const base = $('#adBase').value.trim(), key = $('#adKey').value.trim(), model = $('#adModel').value.trim();
        if (!base || !key || !model) return toast('请填写接口地址、API Key 与模型名称');
        const c = read();
        c.mode = 'api';
        c.api = {
          provider: $('#adProvider').value, base, key, model,
          thinking: readMode() === 'quality',
          temperature: Number($('#adTemp') ? $('#adTemp').value : 0.25)
        };
        write(c); refreshBadge(); syncDemoUI(); toast('AI 接口配置已保存，可以开始批改了');
      };
      $('#adTest').onclick = async () => {
        const base = $('#adBase').value.trim(), key = $('#adKey').value.trim(), model = $('#adModel').value.trim();
        if (!base || !key) return toast('请先填写接口地址与 API Key');
        toast('正在测试连接…');
        try {
          const r = await fetch(base.replace(/\/$/, '') + '/models', { headers: { Authorization: 'Bearer ' + key } });
          toast(r.ok ? '连接成功' : '连接失败：HTTP ' + r.status);
        } catch (e) { toast('连接失败：' + (e.message || '网络错误')); }
      };
      $('#adLocalSave').onclick = () => {
        const base = $('#adLocalBase').value.trim(), model = $('#adLocalModel').value.trim();
        if (!base || !model) return toast('请填写本地地址与模型名称');
        const c = read();
        c.mode = 'local';
        c.local = { engine: $('#adEngine').value, base, model };
        write(c); refreshBadge(); syncDemoUI(); toast('本地部署配置已保存，可以开始批改了');
      };
      $('#adLocalTest').onclick = async () => {
        const base = $('#adLocalBase').value.trim() || 'http://127.0.0.1:11434';
        toast('正在检测本地服务…');
        try {
          const r = await fetch(base.replace(/\/$/, '') + '/api/tags');
          if (!r.ok) return toast('检测失败：HTTP ' + r.status);
          const j = await r.json();
          toast('已连接，发现 ' + ((j.models || []).length) + ' 个模型');
        } catch (e) { toast('无法连接，请确认服务已启动'); }
      };
    })();

    // 尺寸变化重排
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { renderCanvas(); }, 160);
    });

    // 启动：中间白板显示一篇干净的作文（无批注痕迹），点击「一键批改」开始批改
    loadDemo(true, true);
  }

  /* ================= 打开 AI 配置 ================= */
  function openAIConfig() {
    const box = $('#aiDeploy');
    if (!box) return;
    box.classList.add('open');
    setTimeout(() => {
      const sc = document.querySelector('.side-scroll');
      if (sc) sc.scrollTo({ top: box.offsetTop - 8, behavior: 'smooth' });
    }, 60);
    // 高亮提示
    box.style.boxShadow = '0 0 0 3px rgba(91,92,226,.18)';
    setTimeout(() => { box.style.boxShadow = ''; }, 1800);
  }


  /* AI 润色稿 vs 原文的差异归纳，用于生成"本次润色说明" */
  function enrichTraceFromDiff(trace, origP, newP) {
    const cnt = x => String(x || '').replace(/\s/g, '').length;
    const o = origP.map(x => String(x || '')).join('');
    const n = newP.map(x => String(x || '')).join('');
    const feelRe = /(很|非常|特别|十分)(感动|难过|开心|高兴|紧张|害怕|生气|惭愧|温暖|失落)/;
    if (feelRe.test(o) && !feelRe.test(n)) trace.push({ kind: 'emotion', from: '直接说情绪', to: '写身体反应' });
    if (/(像|仿佛|似的)/.test(n) && !/(像|仿佛|似的)/.test(o)) trace.push({ kind: 'detail', list: ['新增比喻，让画面更具体'] });
    if (/(听见|闻到|摸到|凉|暖|响|香|光|影|烫|冷|粗糙|软)/.test(n) && !/(听见|闻到|摸到|凉|暖|响|香|光|影|烫|冷|粗糙|软)/.test(o)) {
      trace.push({ kind: 'detail', list: ['补充声音或触感细节'] });
    }
    if (cnt(n) > cnt(o) * 1.1) trace.push({ kind: 'detail', list: [`篇幅由 ${cnt(o)} 字扩充到 ${cnt(n)} 字`] });
    return trace;
  }

  function localPolish(P, trace) {
    const cnt = v => String(v == null ? '' : v).replace(/\s/g, '').length;
    const arr = Array.isArray(P) ? P : [];
    const feelMap = { 感动: '鼻子一酸，眼眶热了一下', 难过: '喉咙像塞了棉花', 开心: '嘴角压不住地往上翘', 高兴: '忍不住笑出声，又赶紧捂住嘴', 紧张: '手心全是汗，指尖发凉', 害怕: '后背沁出一层薄汗', 生气: '太阳穴突突地跳', 惭愧: '脸一直烧到耳根' };
    const verbMap = [
      [/踮|走过去/g, '踮着脚挪过去'],
      [/弯下腰/g, '微微弓起背'],
      [/看了看/g, '眯着眼瞧了又瞧'],
      [/([又便])?坐回去了/g, (m, pre) => (pre ? '慢慢缩回椅子上' : '又慢慢缩回椅子上')],
      [/重演/g, '过了一遍又一遍']
    ];
    const detail = [
      [/厨房|拣菜|洗碗|案板/, '水龙头哗哗地响，水珠一颗颗溅在案板上。'],
      [/米|拎|提一下/, '袋子勒进掌心，指节被压得发白。'],
      [/笔尖|本子|作业|试卷|纸/, '铅笔在纸上蹭出细细的沙沙声，橡皮屑堆成一小撮。'],
      [/雪|冬天|冷/, '呼出的气在眼前白了一小团，指尖冻得发木。'],
      [/掌心|搓|手/, '那双手背上横着几道浅浅的口子，摸上去有点扎。'],
      [/背影|影子/, '灯光把影子压在地上，肩膀一高一低。'],
      [/碗|油花/, '油花浮在水面上，被冷水一激，凝成一层薄薄的白。'],
      [/门口|站在|门框/, '门框的影子横在她脚边，一动不动。'],
      [/笑/, '她笑起来时，眼角的细纹一道一道地舒开。'],
      [/话|听懂/, '那句话很轻，落在心里却沉。'],
      [/梧桐|叶|风/, '叶片背面泛着一层灰白，边缘卷起来一点。'],
      [/书桌|椅子|台灯/, '木纹里嵌着几道旧划痕，摸上去有点起毛。']
    ];
    const pool = [
      '窗外有车驶过，灯影在墙上滑了一下。',
      '空气里飘着一点饭菜味，混着洗洁精的清香。',
      '一片叶子贴在玻璃上，被风按了按，又松开。',
      '远处有人喊孩子回家吃饭，声音拖得很长。',
      '日头斜下来，桌角亮了一小块。',
      '墙上的钟走得很慢，秒针每一下都听得见。',
      '楼下有人推着车过去，铁轮子在水泥地上咯噔了一下。',
      '光从窗帘缝里漏进来，在纸上划出一道细线。',
      '风把窗缝吹得呜呜响，像有人在低低地说话。',
      '桌上的水杯里，浮着一层细小的光。'
    ];
    const usedTxt = new Set();
    let poolIdx = 0;
    const takePool = () => {
      while (poolIdx < pool.length) {
        const t = pool[poolIdx++];
        if (!usedTxt.has(t)) { usedTxt.add(t); return t; }
      }
      return '';
    };

    const out = [];
    for (let i = 0; i < arr.length; i++) {
      let x = String(arr[i] == null ? '' : arr[i]).trim();
      if (!x) { out.push(''); continue; }
      let changed = false;

      // 长句断句
      if (cnt(x) > 42) {
        const m = x.match(/^(.{12,}?)(但是|可是|于是|却|因为|所以|只是|而且)(.{8,})$/);
        if (m) {
          x = m[1].replace(/[，,]$/, '') + '。' + m[2] + m[3];
          changed = true;
          if (trace) trace.push({ kind: 'split', from: m[1].slice(0, 10) + '…', to: '在转折处拆成两句' });
        }
      }
      // 情绪外化
      const before = x;
      x = x.replace(/(很|非常|特别|十分)(感动|难过|开心|高兴|紧张|害怕|生气|惭愧)/g, (m, a, b) => feelMap[b] || b);
      if (x !== before) { changed = true; if (trace) trace.push({ kind: 'emotion', from: before, to: x }); }
      // 动作具体化
      for (const [re, to] of verbMap) {
        if (!re.test(x)) continue;
        const b = x;
        x = x.replace(re, to);
        if (x !== b) { changed = true; if (trace) trace.push({ kind: 'verb', from: (b.match(re) || [''])[0], to: String(to) }); }
      }
      // 补细节：每段若没有改动，必须补一处；有改动则不重复补
      const hasSense = /(听见|闻到|摸到|凉|暖|响|香|光|影|粗糙|软)/.test(x);
      if (!changed || (i % 4 === 0 && !hasSense)) {
        let add = '';
        for (const [re, t] of detail) {
          if (usedTxt.has(t)) continue;
          if (re.test(x)) { usedTxt.add(t); add = t; break; }
        }
        if (!add) add = takePool();
        if (add) {
          x = /[。！？]$/.test(x) ? (x + add) : (x.replace(/[。！？]?$/, '。') + add);
          changed = true;
          if (trace) trace.push({ kind: 'detail', list: [add] });
        }
      }
      out.push(x);
    }
    return out;
  }

  function buildPolished(R, P, trace) {
    const ai = (R.report && R.report.polished) || (R.polished) || null;
    if (Array.isArray(ai) && ai.filter(x => x && String(x).trim().length > 2).length >= Math.max(1, Math.floor(P.length * 0.5))) {
      // AI 直接给出润色稿：按"逐段对照差异"归纳手法
      const out = ai.filter(x => x && String(x).trim());
      if (trace) enrichTraceFromDiff(trace, P, out);
      return out;
    }
    return localPolish(P, trace);
  }

  /* AI 润色稿 vs 原文的差异归纳，用于生成"本次润色说明" */
  function enrichTraceFromDiff(trace, origP, newP) {
    const cnt = x => String(x || '').replace(/\s/g, '').length;
    const o = origP.map(x => String(x || '')).join('');
    const n = newP.map(x => String(x || '')).join('');
    const feelRe = /(很|非常|特别|十分)(感动|难过|开心|高兴|紧张|害怕|生气|惭愧|温暖|失落)/;
    if (feelRe.test(o) && !feelRe.test(n)) trace.push({ kind: 'emotion', from: '直接说情绪', to: '写身体反应' });
    if (/(像|仿佛|似的)/.test(n) && !/(像|仿佛|似的)/.test(o)) trace.push({ kind: 'detail', list: ['新增比喻，让画面更具体'] });
    if (/(听见|闻到|摸到|凉|暖|响|香|光|影|烫|冷|粗糙|软)/.test(n) && !/(听见|闻到|摸到|凉|暖|响|香|光|影|烫|冷|粗糙|软)/.test(o)) {
      trace.push({ kind: 'detail', list: ['补充声音或触感细节'] });
    }
    if (cnt(n) > cnt(o) * 1.1) trace.push({ kind: 'detail', list: [`篇幅由 ${cnt(o)} 字扩充到 ${cnt(n)} 字`] });
    return trace;
  }



  /* ================= 润色说明：本次改了什么 =================
   * 依据润色过程中的变更记录，归纳成可读的几条"润色手法"，
   * 每条 = 手法名称 + 具体做法 + 本文实例，供报告页展示。
   */
  function buildPolishNotes(trace, origP, newP) {
    const t = trace || [];
    const notes = [];
    const cnt = x => String(x || '').replace(/\s/g, '').length;
    const firstOf = kind => t.find(x => x.kind === kind);

    const emo = t.filter(x => x.kind === 'emotion');
    if (emo.length) {
      notes.push({
        name: '情绪外化',
        desc: '把“很感动”“很难过”这类概括说法换成具体的身体反应，让读者看得见情绪。',
        sample: emo.slice(0, 2).map(x => `「${x.from}」→「${x.to}」`).join('　')
      });
    }

    const verb = t.filter(x => x.kind === 'verb');
    if (verb.length) {
      notes.push({
        name: '动作具体化',
        desc: '把笼统的动作换成一个更有画面感的小动作，人物就有了过程。',
        sample: verb.slice(0, 2).map(x => `「${x.from}」→「${x.to}」`).join('　')
      });
    }

    const det = t.filter(x => x.kind === 'detail');
    if (det.length) {
      const all = [];
      det.forEach(d => d.list.forEach(x => { if (!all.includes(x)) all.push(x); }));
      notes.push({
        name: '补充细节',
        desc: '在原句后接了声音、触感或环境细节，让场景从“看见”变成“在场”。',
        sample: all.slice(0, 2).map(x => `「${x}」`).join('　')
      });
    }

    const split = t.filter(x => x.kind === 'split');
    if (split.length) {
      notes.push({
        name: '长句断句',
        desc: '在转折词前把长句拆成两句，让朗读时有停顿，不再一口气读不完。',
        sample: split.slice(0, 2).map(x => `${x.from} → ${x.to}`).join('　')
      });
    }

    const oral = t.filter(x => x.kind === 'oral');
    if (oral.length) {
      notes.push({
        name: '用词自然化',
        desc: '把偏书面的词换成更贴近口语的说法，符合第一人称叙述的口吻。',
        sample: oral.slice(0, 2).map(x => `「${x.from}」→「${x.to}」`).join('　')
      });
    }

    const pause = t.filter(x => x.kind === 'pause');
    if (pause.length) {
      notes.push({
        name: '调整停顿',
        desc: '在长句中间补一处逗号，让语气有呼吸，读起来不赶。',
        sample: pause.slice(0, 1).map(x => `「${x.to}」`).join('')
      });
    }

    if (firstOf('rhythm')) {
      notes.push({
        name: '调节节奏',
        desc: '在情绪最重处插入一个短句停顿，长短句交替，读起来有呼吸。',
        sample: '「……那一刻，屋里忽然很静。」'
      });
    }

    // 段落层面：断句与过渡
    const origLen = cnt(origP.join(''));
    const newLen = cnt(newP.join(''));
    if (newLen > origLen * 1.08) {
      notes.push({
        name: '扩充篇幅细节',
        desc: `润色后由 ${origLen} 字增加到 ${newLen} 字，增量全部用于细节描写，未改变原意。`,
        sample: ''
      });
    }
    if (newP.length !== origP.length) {
      notes.push({
        name: '段落调整',
        desc: `段落由 ${origP.length} 段调整为 ${newP.length} 段，让层次更清楚。`,
        sample: ''
      });
    }

    if (!notes.length) {
      notes.push({
        name: '语句润色',
        desc: '在保留原意与叙事顺序的前提下，对用词和句子节奏做了整体打磨。',
        sample: ''
      });
    }
    return notes.slice(0, 6);
  }

  /* ================= 小练笔：按本文真实内容动态生成 =================
   * 不再使用固定题库——每条练习都锚定本文的原句、原问题和真实细节，
   * 保证同一篇作文每次生成一致，不同作文互不相同。
   *
   * 每条练习的结构（对齐参考排版）：
   *   { key, focus, issue: 存在的问题, idea: 思路, demo: 例子 }
   */
  function buildDrills(R, P, g) {
    const paras = (P || []).filter(x => x && String(x).trim().length > 4);
    const issues = (R.report && R.report.issues) || [];
    const cnt = s => String(s || '').replace(/\s+/g, '').length;
    const short = (t, n) => {
      const s = String(t || '').replace(/\s+/g, '');
      return s.length > n ? s.slice(0, n) + '…' : s;
    };
    // 抽出可复用的真实短语（按标点切分，取 6~18 字的片段）
    const phrases = [];
    paras.forEach(t => {
      String(t).split(/[，。！？；：、]/).forEach(seg => {
        const s = seg.replace(/\s+/g, '');
        if (cnt(s) >= 5 && cnt(s) <= 18) phrases.push(s);
      });
    });
    const pick = (i) => phrases.length ? phrases[i % phrases.length] : '';

    const full = paras.join('');
    const hasDialog = /[“"][^”"]{2,}[”"]/.test(full);
    const hasSense = /(听见|闻到|摸到|凉|暖|响|香|光|影|烫|冷|粗糙|软)/.test(full);
    const hasSimile = /(像|仿佛|好似|如同)/.test(full);
    const longSent = paras.find(t => /[^。！？；]{42,}/.test(t)) || '';
    const longest = paras.reduce((a, b) => (cnt(b) > cnt(a) ? b : a), paras[0] || '');
    const actionSent = paras.find(t => /(走|坐|站|拿|放|抬|低|握|握紧|伸|缩|转|看|望|擦|洗|推|拉)/.test(t)) || '';

    // 挑出最值得练的三类，按本文短板优先
    const cands = [];

    // ① 若是长句问题，练「断句与节奏」，锚定那句原文
    if (longSent) {
      cands.push({
        key: '断句与节奏', focus: '把长句拆成有呼吸的短句',
        issue: `文中有句子超过 40 字未断开，一口气读不完：「${short(longSent, 20)}」`,
        idea: '先找到“可、但、于是、却、因为”这类转折或因果词，在它前面断开；断完前后各留半句，读一遍不喘气就对了。',
        demo: `「${short(longSent, 26)}」拆成两句后：「${short(longSent, 13)}。${short(longSent.slice(13), 13)}」`
      });
    }

    // ② 若缺感官细节，练「感官描写」，锚定原文场景
    if (!hasSense || cands.length < 3) {
      const base = actionSent || longest || '';
      cands.push({
        key: '感官描写', focus: '给同一个场景补一声音、一触感',
        issue: cands.some(c => c.key === '感官描写')
          ? '文中的动作已有，但只有“看见”，缺少声音和触感，读者进不到现场。'
          : `「${short(base, 18)}」这一处目前只写了看到的画面，缺声音和触感。`,
        idea: '不要另起一段写，就在原句后面接半句：先想当时环境里最清楚的一个声音，再想手或皮肤碰到的东西。两句都别超过 20 字。',
        demo: base
          ? `在「${short(base, 14)}」后面加半句：「……；水龙头没关紧，滴答、滴答，一下一下敲在瓷盆上。」`
          : '「她说话的时候，抽油烟机还在响，手背上有一层薄薄的凉。」'
      });
    }

    // ③ 若动作概括，练「动作分解」，锚定原文动作
    if (actionSent || cands.length < 3) {
      const a = actionSent || '';
      cands.push({
        key: '动作分解', focus: '把一个动作拆成三拍来写',
        issue: a
          ? `「${short(a, 18)}」是一个整体动作，一笔带过，读者看不到过程。`
          : '文中的动作多为整体交代，缺少过程，人物显得“不会动”。',
        idea: '把一个动作拆成“手先动 → 身子跟 → 脚或眼睛最后收”三拍，每拍只用一个最准确的动词，中间可以用分号。',
        demo: a
          ? `原句「${short(a, 14)}」改成：「手撑在桌沿，身子往前倾了一下，又慢慢收回去。」`
          : '「手撑在桌沿，身子往前倾了一下，脚却没动，又慢慢缩回去。」'
      });
    }

    // ④ 若缺对话，练「用原话写场景」
    if (!hasDialog && cands.length < 3) {
      cands.push({
        key: '对话描写', focus: '用一句原话代替心理独白',
        issue: '全篇没有人物原话，情绪全靠叙述交代，读者听不到声音。',
        idea: '在最关键的那一处，把“我想说”改成“我说出口的那一句”，只写一句，前后各留半句动作。',
        demo: '「她说，你先写作业，这点事妈自己来。」说这句话时，她正把我的手往旁边拨了一下。'
      });
    }

    // ⑤ 若比喻欠具体，练「找贴切的喻体」
    if (!hasSimile && cands.length < 3) {
      cands.push({
        key: '比喻具体化', focus: '喻体要来自生活，别用空泛的词',
        issue: '文中几乎没有比喻，描写多靠形容词；或比喻的喻体离生活太远，落不到画面。',
        idea: '挑文中最重要的一个“物”或“人”，问自己：它在生活中像什么见过的东西？最好带动作或磨损感。',
        demo: `把「${short(pick(1), 12)}」里的形容换掉，改成：「她的背影像一张被反复折过的纸，折痕处已经发白。」`
      });
    }

    // ⑥ 兜底：环境映衬情绪
    if (cands.length < 3) {
      cands.push({
        key: '环境映衬', focus: '让环境跟着人物情绪变化',
        issue: '情绪转折处直接写“我很难过/我明白了”，没有借景。',
        idea: '选一个会变的东西：光、风、雨、影子；在情绪转折那一刻让它变一下，不写心情词。',
        demo: '云把太阳挡住了，屋里一下子暗下来；窗台的绿萝垂下去，叶尖上还挂着一滴水。'
      });
    }

    // 优先选与批改问题直接相关的
    const hitKey = (it) => {
      const t = (it.title || '') + (it.desc || '');
      if (/长句|断句|节奏|逗号/.test(t)) return '断句与节奏';
      if (/感官|听觉|视觉|触觉|细节/.test(t)) return '感官描写';
      if (/动作|描写|镜头/.test(t)) return '动作分解';
      if (/对话|原话|台词/.test(t)) return '对话描写';
      if (/比喻|修辞|形象/.test(t)) return '比喻具体化';
      if (/抒情|议论|口号|直说/.test(t)) return '环境映衬';
      return null;
    };
    const wanted = [];
    issues.forEach(it => { const k = hitKey(it); if (k && !wanted.includes(k)) wanted.push(k); });

    const ordered = [
      ...cands.filter(c => wanted.includes(c.key)),
      ...cands.filter(c => !wanted.includes(c.key))
    ].slice(0, 3);

    // 补上「对应问题」：按练习类型匹配问题，而不是按顺序硬配
    const matchIssue = (key) => {
      const want = {
        '断句与节奏': /长句|断句|节奏|逗号|喘/,
        '感官描写': /感官|听觉|视觉|触觉|声音|画面偏弱/,
        '动作分解': /动作|过程|概括/,
        '对话描写': /对话|原话|台词/,
        '比喻具体化': /比喻|修辞|喻体/,
        '环境映衬': /抒情|议论|口号|直说/
      }[key];
      if (!want) return null;
      // 只按标题匹配，避免正文里偶然出现的“对话”“动作”等词造成误配
      const hitTitle = issues.find(it => want.test(it.title || ''));
      if (hitTitle) return hitTitle;
      // 标题未命中时才看描述，且要求是问题主体（排除规范类泛描述）
      return issues.find(it => {
        if (/标点|通读|错别字/.test(it.title || '')) return false;
        return want.test(it.desc || '');
      }) || null;
    };
    return ordered.map((c, i) => {
      const it = matchIssue(c.key);
      return {
        key: c.key,
        focus: c.focus,
        issue: c.issue,
        idea: c.idea,
        demo: c.demo,
        relatedTitle: it ? it.title : '',
        relatedDesc: it ? (it.desc || '') : '',
        // 没有直接对应的问题时，说明这条练笔补的是哪类短板
        relatedFallback: it ? '' : ({
          '断句与节奏': '全文节奏',
          '感官描写': '细节描写',
          '动作分解': '动作描写',
          '对话描写': '人物语言',
          '比喻具体化': '语言表现力',
          '环境映衬': '情绪表达'
        }[c.key] || '描写能力')
      };
    });
  }

  /* ================= 导出数据组装 ================= */
  function buildExportData(d) {
    const base = window.ZPEXPORT.collect(d);
    const R = d.result;
    const P = base.paras;
    const g = GRADES.find(x => x.id === (d.gradeId || state.gradeId)) || GRADES[0];
    const genreObj = GENRES.find(g2 => g2.id === d.genreId) || {};

    // 润色稿：复用面板逻辑，同时记录本次改了哪些内容
    const polishTrace = [];
    const polished = buildPolished(R, P, polishTrace);
    const polishNotes = buildPolishNotes(polishTrace, P, polished);


    // 小练笔：与右侧面板同源，均按本文内容动态生成
    const drills = buildDrills(R, P, g).map((b, i) => ({
      ...b,
      issue: b.issue,
      ask: b.issue,          // 兼容导出层的 ask 字段
      related: b.relatedTitle || b.relatedFallback || ''
    }));

    // 图片真实宽高（用于 A4 白板裁切比例）
    const imgMeta = { imgW: d.w, imgH: d.h };

    return Object.assign(base, {
      polished, polishNotes, drills, imgW: imgMeta.imgW, imgH: imgMeta.imgH,
      genreTips: (genreObj.tips || []).slice(0, 3),
      genreName: genreObj.name || ''
    });
  }

  /* ================= 历史记录 ================= */
  const HKEY = 'zhipi.history.v1';
  const HKEY_BAK = 'zhipi.history.v1.bak';

  /* 可靠读取：主键损坏时自动回退到备份，避免整表读空 */
  function loadHistory() {
    const parse = k => {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return null;
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : null;
      } catch (e) { return null; }
    };
    const sortDesc = arr => (arr || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
    const main = parse(HKEY);
    if (main) return sortDesc(main);
    const bak = parse(HKEY_BAK);
    return sortDesc(bak || []);
  }

  /* 可靠写入：先备份，再落盘；失败时逐级降级而不是静默丢弃 */
  function saveHistory(list) {
    const arr = Array.isArray(list) ? list : [];
    const write = obj => {
      const s = JSON.stringify(obj);
      localStorage.setItem(HKEY_BAK, localStorage.getItem(HKEY) || '[]');
      localStorage.setItem(HKEY, s);
      return s.length;
    };
    // 第 1 档：完整保存
    try { return write(arr.slice(0, 40)); } catch (e) {}
    // 第 2 档：去掉图片，只留报告
    try {
      const noImg = arr.map(r => ({ ...r, img: null }));
      return write(noImg.slice(0, 40));
    } catch (e) {}
    // 第 3 档：逐条丢弃大字段，直到能存下
    for (let keep = arr.length; keep > 0; keep--) {
      try {
        const slim = arr.slice(0, keep).map(r => {
          const c = { ...r, img: null };
          if (c.result && c.result.annos) c.result = { ...c.result, annos: c.result.annos.slice(0, 8) };
          return c;
        });
        return write(slim);
      } catch (e) { continue; }
    }
    // 第 4 档：只保留摘要（仍可在历史里看到条目）
    const meta = arr.slice(0, 40).map(r => ({
      id: r.id, name: r.name, gradeId: r.gradeId, genreId: r.genreId,
      total: r.total, full: r.full, level: r.level, words: r.words,
      at: r.at, w: r.w, h: r.h, weights: r.weights, img: null, result: null
    }));
    try { write(meta); return JSON.stringify(meta).length; }
    catch (e) {
      // 实在写不进：至少保住最近 5 条摘要
      try { write(meta.slice(0, 5)); } catch (e2) { return 0; }
    }
  }

  /* 草稿登记：上传后立即进历史，未批改也能在历史里找到（status: draft） */
  function registerDraft(d) {
    if (!d || !d.realImg) return null;
    const list = loadHistory();
    const exist = d.histId ? list.find(r => r.id === d.histId) : null;
    const rec = exist || {
      id: 'h' + Date.now() + Math.random().toString(36).slice(2, 6),
      name: d.note || d.name || '未命名',
      gradeId: d.gradeId, genreId: d.genreId,
      total: null, full: null, level: '',
      words: (d.pages || []).length ? 0 : 0,
      at: Date.now(),
      w: d.w, h: d.h, weights: (d.weights || [30, 25, 25, 20]).slice(),
      img: d.img && d.img.length < 400000 ? d.img : null,
      result: null, status: 'draft'
    };
    rec.name = d.note || d.name || '未命名';
    rec.gradeId = d.gradeId || rec.gradeId;
    rec.genreId = d.genreId || rec.genreId;
    rec.at = Date.now();
    rec.status = d.result ? 'done' : 'draft';
    rec.img = d.img && d.img.length < 400000 ? d.img : rec.img;
    // 多页：草稿阶段也保留每页图片，刷新后不丢失
    if (Array.isArray(d.pages) && d.pages.length > 1) {
      rec.pages = d.pages.map(pg => ({ img: pg.img, w: pg.w, h: pg.h }));
      rec.page = d.page || 0;
    }
    if (d.result) {
      rec.total = d.result.score.total;
      rec.full = Object.values(d.result.score.points).reduce((a, p) => a + p.full, 0);
      rec.level = d.result.level.name;
      rec.words = d.result.essay.words;
      rec.result = d.result;
    }
    if (!exist) list.unshift(rec); else {
      const i = list.findIndex(r => r.id === rec.id);
      if (i >= 0) list.splice(i, 1);
      list.unshift(rec);       // 修改过就置顶
    }
    let trimmed = list.slice(0, 40);
    try {
      let guard = 0;
      while (trimmed.length > 1 && JSON.stringify(trimmed).length > 3800000 && guard++ < 200) {
        const last = trimmed[trimmed.length - 1];
        if (last.pages) last.pages = null;
        else if (last.img) last.img = null;
        else if (last.result) last.result = null;
        else trimmed.pop();
      }
    } catch (e) {}
    saveHistory(trimmed);
    d.histId = rec.id;
    return rec.id;
  }

  function pushHistory(d) {
    if (!d || !d.result) return;
    const list = loadHistory();
    const rec = {
      id: 'h' + Date.now() + Math.random().toString(36).slice(2, 6),
      name: d.note || d.name || '未命名',
      gradeId: d.gradeId, genreId: d.genreId,
      total: d.result.score.total,
      full: Object.values(d.result.score.points).reduce((a, p) => a + p.full, 0),
      level: d.result.level.name,
      words: d.result.essay.words,
      at: Date.now(),
      w: d.w, h: d.h, weights: (d.weights || [30, 25, 25, 20]).slice(),
      img: d.img && d.img.length < 400000 ? d.img : null,
      // 多页作文：保留每页图片与页码，刷新后可完整恢复
      pages: (Array.isArray(d.pages) && d.pages.length > 1)
        ? d.pages.map(pg => ({ img: pg.img, w: pg.w, h: pg.h }))
        : null,
      page: d.page || 0,
      result: d.result
    };
    list.unshift(rec);

    // 控制体积：优先保留最近记录，超限时先丢图片，再丢完整报告
    let trimmed = list.slice(0, 40);
    try {
      let guard = 0;
      while (trimmed.length > 1 && JSON.stringify(trimmed).length > 3800000 && guard++ < 200) {
        const last = trimmed[trimmed.length - 1];
        if (last.img) last.img = null;
        else if (last.result) last.result = null;
        else trimmed.pop();
      }
    } catch (e) {}

    const bytes = saveHistory(trimmed);
    d.histId = rec.id;
    if (!bytes) toast('本地存储空间不足，这条记录仅本次有效');
    return rec.id;
  }

  function fmtTime(ts) {
    const d = new Date(ts), now = new Date();
    const p = n => String(n).padStart(2, '0');
    const same = d.toDateString() === now.toDateString();
    return (same ? '今天 ' : `${d.getMonth() + 1}月${d.getDate()}日 `) + `${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function openHistory() {
    renderTabs();   // 打开即同步历史到顶部标签
    const list = loadHistory();
    const rows = list.length ? list.map(r => {
      const g = GRADES.find(x => x.id === r.gradeId) || { name: '未选年级' };
      const ge = GENRES.find(x => x.id === r.genreId) || GENRES[0];
      return `<div class="hist-item" data-h="${r.id}">
        <div class="hist-thumb">${r.img ? `<img src="${r.img}" alt="">`
          : `<div style="height:100%;display:grid;place-items:center;color:#c9cdd8;font-size:15px">文</div>`}</div>
        <div class="hist-bd">
          <div class="n">${esc(r.name)}${r.status === 'draft' ? '<span class="hist-draft">待批改</span>' : ''}</div>
          <div class="m">${g.name} · ${ge.name} · ${r.words ? r.words + ' 字 · ' : ''}${fmtTime(r.at)}</div>
        </div>
        <div class="hist-sc">${r.total != null ? `${r.total}<small>/${r.full}</small>` : '<span class="dash">—</span>'}</div>
      </div>`;
    }).join('') : `<div class="hist-empty">还没有批改记录<br>批改完成的作文会自动保存在这里</div>`;

    $('#mTitle').textContent = '历史记录';
    $('#mSub').textContent = list.length ? `共 ${list.length} 条记录，点击可打开` : '暂无记录';
    $('#mBody').innerHTML = `
      <div class="hist-bar"><span>最近批改</span>${list.length ? '<button id="histClear">清空记录</button>' : ''}</div>
      ${rows}`;
    $('#mFoot').innerHTML = `<button class="btn-s sec" id="histClose">关闭</button>`;
    $('#histClose').onclick = () => { closeModal(); renderTabs(); };
    const hc = $('#histClear');
    if (hc) hc.onclick = () => {
      if (!confirm('确定清空全部历史记录吗？')) return;
      saveHistory([]);
      // 同步清理：把已打开的、来自历史的稿子一并移除（保留当前正在编辑的）
      state.docs = state.docs.filter(d => !d.histId);
      if (!state.docs.some(d => d.id === state.activeId)) state.activeId = state.docs[0] ? state.docs[0].id : null;
      renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
      openHistory(); renderTabs();
      toast('历史记录已清空');
    };
    $$('.hist-item').forEach(el => el.onclick = () => {
      const rec = list.find(x => x.id === el.dataset.h);
      if (rec) rehydrate(rec);
    });
    $('#mask').classList.add('on');
  }

  // 打开历史记录：有完整快照则原样还原（含批改结果）
  function rehydrate(rec) {
    closeModal();
    const opened = state.docs.find(x => x.histId === rec.id);
    if (opened) {
      state.activeId = opened.id;
      renderTabs(); renderCanvas(); renderReport(); syncDemoUI(); syncLeftFromDoc();
      renderTabs();
      toast('已切换到该作文'); return;
    }
    const hasSnap = !!(rec.result && rec.result.essay);
    // 多页：优先用历史里的 pages 还原，否则退回单图
    const rp = Array.isArray(rec.pages) && rec.pages.length ? rec.pages : null;
    const firstPage = rp ? rp[0] : null;
    const doc = {
      id: nid('doc'), name: rec.name,
      img: (firstPage && firstPage.img) || rec.img || makePlaceholder(rec.name, rec.name),
      w: (firstPage && firstPage.w) || rec.w || 760,
      h: (firstPage && firstPage.h) || rec.h || demoPageH(),
      pages: rp ? rp.map(pg => ({ img: pg.img, w: pg.w, h: pg.h })) : null,
      page: rp ? Math.min(rec.page || 0, rp.length - 1) : 0,
      rawSize: 0, size: 0,
      gradeId: rec.gradeId, genreId: rec.genreId,
      note: rec.name === '未命名' ? '' : rec.name,
      weights: (rec.weights || [30, 25, 25, 20]).slice(),
      status: hasSnap ? 'done' : 'pending',
      result: hasSnap ? rec.result : null, essay: null,
      // 有真实图片才是"真实稿"；否则页码栏与批注定位都不会启用
      realImg: !!(rp || rec.img),
      histId: rec.id
    };
    state.docs.push(doc);
    state.activeId = doc.id;
    state.gradeId = doc.gradeId; state.genreId = doc.genreId;
    $('#noteInput').value = doc.note || '';
    renderGenres(); renderGrades(); renderThumbs(); renderTabs();
    renderCanvas(); renderReport(); syncDemoUI();
    renderTabs();
    toast(hasSnap ? `已打开「${rec.name}」的批改记录` : `已载入「${rec.name}」`);
  }

  /* ================= 演示批改 ================= */
  async function runDemoBatch() {
    const d = activeDoc();
    if (!d || state.grading) return;
    state.grading = true;
    const card = $('#demoRun');
    if (card) card.classList.add('busy');

    $('#mTitle').textContent = 'AI 正在批改';
    $('#mSub').textContent = '《那一刻，我长大了》· 演示';
    $('#mBody').innerHTML = `
      <div class="prog-main">
        <div class="big-ring" id="bigRing" style="--p:0%"><span id="bigPct">0%</span></div>
        <div><div class="tx" id="progTx">准备中…</div><div class="sb">识别 · 评分 · 批注 · 生成报告</div></div>
      </div>`;
    $('#mFoot').innerHTML = `<button class="btn-s sec" id="mClose2">后台运行</button>`;
    $('#mClose2').onclick = closeModal;
    $('#mask').classList.add('on');

    const steps = [['正在识别文字…', 16], ['分析内容与立意…', 38], ['评估结构与逻辑…', 58], ['检查语言与规范…', 78], ['生成批改报告…', 96]];
    for (const [txt, p] of steps) {
      const t = $('#progTx'); if (t) t.textContent = txt;
      const ring = $('#bigRing'); if (ring) { ring.style.setProperty('--p', p + '%'); $('#bigPct').textContent = p + '%'; }
      await wait(200 + Math.random() * 140);
    }
    const req = makeResult(d);
    d.result = req;             // 只挂结果给右栏用
    d.status = 'showcase';      // 画板状态不变：仍是展示态（四色批注照旧）
    if (!d.name || d.name === '未命名') d.name = '那一刻，我长大了';
    d.gradeId = d.gradeId || 'g6';
    d.demoOnly = true;          // 演示批改：不写入历史记录
    $('#progTx').textContent = '批改完成';
    await wait(240);
    closeModal();
    state.grading = false;
    if (card) card.classList.remove('busy');
    // 重绘一次：让“演示作文纸”印章按已批改状态消失，四色批注保持不动
    renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
    toast('批改完成，右侧可查看完整报告');
  }

  /* ================= 添加下一份 ================= */
  function addNext() {
    // 批改在后台继续时也允许添加新稿；新稿插到最左侧并立即选中，符合“先处理这一份”的直觉
    const cur = activeDoc();
    if (cur && cur.result && !cur.histId) pushHistory(cur);

    const doc = newBlankDoc();
    // 继承当前稿件的年级/体裁/权重，新稿开箱即可直接批改
    if (cur) {
      doc.gradeId = cur.gradeId || state.gradeId;
      doc.genreId = cur.genreId || state.genreId;
      doc.weights = (cur.weights || state.weights).slice();
    }
    state.docs.unshift(doc);
    state.activeId = doc.id;
    state.note = '';
    const ni = $('#noteInput'); if (ni) ni.value = '';

    renderThumbs(); renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
    requestAnimationFrame(() => {
      const on = document.querySelector('.ftab.on');
      if (on) on.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      const tabs = document.querySelector('.file-tabs');
      if (tabs) tabs.scrollTo({ left: 0, behavior: 'smooth' });
    });
    const dz = $('#dropZone');
    if (dz) { dz.classList.add('flash'); setTimeout(() => dz.classList.remove('flash'), 1200); }
    const busyAny = state.docs.some(x => x.grading);
    toast(busyAny ? '已添加一份，上一份在后台继续改，这份可直接批改' : '已添加一份，拖入图片或点「一键批改」');
  }


  /* ================= 网页版启动画面 ================= */
  function hideSplash() {
    const el = document.getElementById('zp-splash');
    if (!el) return;
    const t0 = window.__zpBootAt || Date.now();
    const wait = Math.max(0, 1100 - (Date.now() - t0));
    setTimeout(() => {
      el.style.pointerEvents = 'none';       // 立刻放行点击
      el.classList.add('zp-hide');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 520);
    }, wait);
  }
  window.__zpHideSplash = hideSplash;

  window.__diag = [];
  window.addEventListener('error', e => window.__diag.push('ERR:' + e.message + ' @L' + e.lineno));
  document.addEventListener('DOMContentLoaded', function () {
    try { init(); window.__diag.push('init-ok'); hideSplash(); }
    catch (e) {
      window.__diag.push('INIT-THROW: ' + e.message);
      window.__diag.push((e.stack || '').split(String.fromCharCode(10)).slice(0, 3).join(' || '));
    }
  });
  window.__zp = state;
  window.__buildExportData = buildExportData;
  window.__openAIConfig = openAIConfig;
})();
