/* ===== 紫微星 · 应用逻辑 ===== */
(function () {
  'use strict';
  const { GRADES, DIMS, GENRES, buildEssay, scoreOf, levelOf, ISSUE_BANK, GOOD_BANK, pick, rand } = window.ZP;
  const genreById = window.ZP.genreById || (id => GENRES.find(g => g.id === id) || GENRES[0]);
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

  /* 演示作文《外婆的蒲扇》：
   * 白板按正常作文连续成段排版（首行缩进两格、写满换行），
   * 报告按五段成文（DEMO_PARAS），两者同源同文。 */
  const DEMO_TITLE = '外婆的蒲扇';
  const DEMO_PARAS = [
    '外婆有一把旧蒲扇。扇面黄黄的，边上磨出了毛，扇柄被手磨得发亮。小时候的夏天，我总睡在外婆身边，她一边给我扇风，一边哼着听不懂的老歌。我曾以为，那把扇子早就该扔了，商店里的电风扇比它凉快多了。',
    '那年暑假特别热，停电的晚上，屋里闷得像蒸笼。我翻来覆去睡不着，外婆就坐在床边给我扇扇子。我迷迷糊糊地问她热不热，她说，外婆不怕热。半夜我醒来，看见她还在扇，额头上全是汗，衣领湿了一圈。',
    '后来我进城上学，家里装了空调，那把蒲扇挂在墙上，落了灰。去年夏天回去，外婆还是执意给我扇风，我说有空调不用扇，她笑笑，把扇子放回墙上，转身去厨房给我切西瓜。那天夜里我很感动，却什么也没说。',
    '临走那天，外婆把蒲扇塞进我的行李箱，说城里停电时用得上。我嫌它占地方，偷偷拿了出来。外婆看见了，什么也没说，只是把扇子上的灰擦了又擦。汽车开动的时候，她还站在门口，手里攥着那把扇子。',
    '如今每当我吹着空调，总会想起那把旧蒲扇。原来外婆扇的不是风，是她说不出口的牵挂。我明白了，爱就是这样一代一代传下来的。'
  ];
  /* 白板拆行：连续成段排版——每段首行缩进两格，写满 28 字换行，
   * 行首不悬标点。不再一句一行（书信式），与真实作文卷面一致。 */
  const DEMO_WRAP_MAX = 28;
  const DEMO_WRAP_PUNC = '，。！？；：、」』”）';
  function demoWrapPara(p) {
    const text = '　　' + p;
    const out = [];
    let i = 0;
    while (i < text.length) {
      let end = Math.min(i + DEMO_WRAP_MAX, text.length);
      while (end < text.length && DEMO_WRAP_PUNC.indexOf(text[end]) >= 0 && end > i + 1) end--;
      out.push(text.slice(i, end));
      i = end;
    }
    return out;
  }
  const DEMO_LINES = DEMO_PARAS.reduce((rows, p) => rows.concat(demoWrapPara(p)), []);
  // 段落号 → 该段首行行号（批注定位用，与拆行逻辑同源）
  const DEMO_PARA_ROWS = (() => {
    const starts = [];
    let row = 0;
    DEMO_PARAS.forEach(p => { starts.push(row); row += demoWrapPara(p).length; });
    return starts;
  })();

  /* 演示润色稿：与参考版式一致。正文用 <m1>~<m4> 标出改写片段，
   * m1 动作/细节（橙）m2 感官（蓝）m3 修辞（紫）m4 议论改叙述/点题（绿）。 */
  const DEMO_POLISHED = [
    '外婆有一把旧蒲扇。扇面黄黄的，边上磨出了毛，<m1>扇柄被手掌磨得发亮，握上去温温的</m1>。小时候的夏天，我总睡在外婆身边，她一边给我扇风，一边哼着听不懂的老歌。<m2>老歌的调子软软的，混着蒲扇一下一下的风声</m2>。我曾以为，那把扇子早就该扔了，商店里的电风扇比它凉快多了。',
    '那年暑假特别热，停电的晚上，<m3>屋里闷得像一口盖严的蒸笼</m3>。我翻来覆去睡不着，外婆就坐在床边给我扇扇子。<m2>风一下一下落在我背上，带着淡淡的皂角味，窗外的蝉声一浪一浪</m2>。我迷迷糊糊地问她热不热，她说，外婆不怕热。半夜我醒来，<m1>她还在扇，手腕一顿一顿的，额头的汗顺着皱纹往下淌</m1>，衣领湿了一圈。',
    '后来我进城上学，家里装了空调，那把蒲扇挂在墙上，落了灰。去年夏天回去，外婆还是执意给我扇风，我说有空调不用扇，她笑笑，把扇子放回墙上，转身去厨房给我切西瓜。<m1>那天夜里我盯着墙上那团扇影，鼻子忽然一酸</m1>，却什么也没说。',
    '临走那天，外婆把蒲扇塞进我的行李箱，说城里停电时用得上。我嫌它占地方，偷偷拿了出来。外婆看见了，什么也没说，<m1>只是把扇面上的灰擦了又擦，指腹在毛边上停了很久</m1>。汽车开动的时候，她还站在门口，<m3>手里攥着那把扇子，像攥着一句没来得及说的话</m3>。',
    '<m4>如今空调的风再凉，也吹不出那股皂角味。那把旧蒲扇摇出来的，哪里是风，分明是外婆一夜一夜不肯停下的牵挂</m4>。'
  ];
  // 本次使用的润色手法：mark 与正文标记一一对应
  const DEMO_TECHNIQUES = [
    { mark: 'rhetoric', text: '运用比喻修辞，把闷热比作盖严的蒸笼、把攥扇的手比作没说完的话，让牵挂变成可看的画面' },
    { mark: 'action', text: '补充动作细节，手腕一顿一顿、汗顺着皱纹淌、指腹在毛边上停留，替代「她很辛苦」这类概括' },
    { mark: 'sense', text: '补进听觉与嗅觉触觉，老歌混着风声、皂角味、落在背上的风，让夏夜写得可听可闻可感' },
    { mark: 'theme', text: '把「爱一代一代传下来」这类议论改成实物落点，结尾回扣蒲扇与皂角味，首尾照应不喊口号' }
  ];
  // 演示稿总评：精炼三段，点亮点、指短板、给方向，不逐条罗列
  const DEMO_REVIEW =
    '这是一篇<b>有生活温度</b>的习作。一把旧蒲扇串起三个夏夜，选材小而真，「外婆不怕热」这句原话尤其动人——嘴上说不热，额头的汗却说了实话，这份反差抓得很好。<br><br>' +
    '最需要改的是<b>把概括换成画面</b>：「半夜她还在扇」是全文的题眼，却只有一句；写一写她扇风的手腕、汗珠、你半梦半醒间的皂角味，分量立刻不同。「那天夜里我很感动」也停在了结论上，换成身体反应，读者才会跟着你一起动情。<br><br>' +
    '结尾「爱一代一代传下来」偏口号，回到蒲扇本身收束会更有余味。按这个方向改一稿，完全有条件冲进一类文。';
  // 演示稿「具体问题与修改思路」：固定三条，与批改要求同构（问题 + 三步修改思路 + 原句改法）
  const DEMO_ISSUES = [
    { dim: 'structure', sev: 'high', title: '题眼段太薄：深夜扇风没写透',
      desc: '第二段「半夜她还在扇」是全文最动人的瞬间，却只有「额头上全是汗」一句带过；读者看不到她扇风的动作和你醒来那一刻的画面。',
      steps: ['先把「还在扇」拆成有过程的小动作：手腕怎么动、扇到哪儿停一下。',
        '再补两处能看见或闻到的细节：汗顺着皱纹淌、风里的皂角味。',
        '最后停在「我假装睡着」这类身体反应上，不写「我很感动」。'],
      quote: '半夜我醒来，看见她还在扇，额头上全是汗，衣领湿了一圈。',
      fix: '她还在扇，手腕一顿一顿的，额头的汗顺着皱纹往下淌。' },
    { dim: 'language', sev: 'mid', title: '情绪停在结论上，缺身体反应',
      desc: '「那天夜里我很感动」直接说结果，读者接收不到画面；全文情绪多次靠「感动」「明白」这类词收尾，感染力被削弱。',
      steps: ['把「很感动」划掉，问自己：那一刻鼻子、喉咙、眼睛什么感觉？',
        '选一个最清楚的反应写进去，比如「盯着墙上的扇影，鼻子一酸」。',
        '写完读一遍，确认没有出现「感动」「温暖」这类概括词。'],
      quote: '那天夜里我很感动，却什么也没说。',
      fix: '那天夜里我盯着墙上那团扇影，鼻子忽然一酸，却什么也没说。' },
    { dim: 'content', sev: 'mid', title: '结尾喊口号，没有回到实物',
      desc: '「我明白了，爱就是这样一代一代传下来的」偏议论腔，与前文具体的叙述脱节；开头立起的蒲扇意象，结尾没有接住。',
      steps: ['先删掉「我明白了」这句总结，把道理留给读者。',
        '让蒲扇或皂角味在结尾再出现一次，与开头形成回环。',
        '如果要抒情，只用一句，且落在实物上，比如「摇出来的哪里是风」。'],
      quote: '我明白了，爱就是这样一代一代传下来的。',
      fix: '那把旧蒲扇摇出来的，哪里是风，分明是外婆一夜一夜不肯停下的牵挂。' }
  ];

  // 与 makePlaceholder 同一套网格参数，保证容器宽高比一致
  const PAPER = { PAD_X: 86, LINE_W: 600, FIRST_BASE: 186, LINE_GAP: 40, TXT: 19, OFFSET: 8, W: 760 };
  function demoPageH(rows) {
    const n = rows || DEMO_LINES.length;
    const bottom = PAPER.FIRST_BASE + (n - 1) * PAPER.LINE_GAP + 46;
    return Math.max(836, Math.round(bottom + 40));
  }

  const getGrade = () => GRADES.find(g => g.id === state.gradeId) || { id: null, name: '未选年级', label: '请先选择', total: 100, rules: [], range: [0, 0] };
  const getGenre = () => genreById(state.genreId);
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
      if (d) {
        d.genreId = state.genreId;
        /* 体裁变了批改口径也要跟着变：已有批改结果按新体裁重新生成，
         * 避免"选了演讲稿、批注还在按记叙文批"的错位。
         * 演示稿的白板批注是固定展示，但报告层同样按新体裁重批。 */
        if (d.result) {
          d.result = makeResult(d);
          toast('已按「' + getGenre().name + '」重新批改');
        } else {
          toast('已切换体裁：' + getGenre().name);
        }
      } else {
        toast('已切换体裁：' + getGenre().name);
      }
      renderGenres(); renderTabs(); renderCanvas(); renderReport();
    });
    bindGenreTips();
  }

  /* 体裁悬停提示：浅色卡片（对齐参考版式）——
   * 标题「XX · 批改要点」+ 逐条要点 + 底部「适用题型」 */
  let genreTipEl = null;
  function bindGenreTips() {
    if (!genreTipEl) {
      genreTipEl = document.createElement('div');
      genreTipEl.className = 'genre-tip';
      genreTipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(genreTipEl);
    }
    $$('#genreChips .chip').forEach(b => {
      const show = () => {
        const g = genreById(b.dataset.g);
        if (!g) return;
        const points = (g.points && g.points.length) ? g.points : [g.focus || g.desc || ''];
        genreTipEl.innerHTML =
          `<div class="gt-h">${esc(g.name)} · 批改要点</div>` +
          `<ul class="gt-list">${points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` +
          (g.types ? `<div class="gt-types">适用题型：${esc(g.types)}</div>` : '');
        genreTipEl.classList.add('on');
        const r = b.getBoundingClientRect();
        // 优先显示在 chip 右侧（侧栏右缘外），放不下则显示在上方
        const tw = genreTipEl.offsetWidth, th = genreTipEl.offsetHeight;
        let left = r.right + 10, top = r.top + r.height / 2 - th / 2;
        if (left + tw > window.innerWidth - 8) { left = Math.max(8, r.left); top = r.top - th - 8; }
        top = Math.max(8, Math.min(top, window.innerHeight - th - 8));
        genreTipEl.style.left = left + 'px';
        genreTipEl.style.top = top + 'px';
      };
      const hide = () => genreTipEl.classList.remove('on');
      b.addEventListener('mouseenter', show);
      b.addEventListener('mouseleave', hide);
      b.addEventListener('focus', show);
      b.addEventListener('blur', hide);
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
  /* 上传压缩：兼顾识别率与传输大小
   * - 长边 1800px：手写小字也能保留笔画，低于 1200 时 OCR 明显掉字
   * - JPEG 质量 0.9：0.8 以下压缩噪点会被模型误认成笔画
   * - 超过 1.8MB 时再降一档质量，避免单请求过大导致超时 */
  const MAXW = 1800;
  const MAX_BYTES = 1.8 * 1024 * 1024;
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
          // 提升对比度：手写稿常偏灰，增强后笔画更清晰
          ctx.filter = 'contrast(1.06) saturate(0.95)';
          ctx.drawImage(img, 0, 0, w, h);
          ctx.filter = 'none';
          let q = 0.9;
          let data = cv.toDataURL('image/jpeg', q);
          while (data.length * 0.75 > MAX_BYTES && q > 0.62) {
            q -= 0.06;
            data = cv.toDataURL('image/jpeg', q);
          }
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
      img: makePlaceholder('', DEMO_TITLE),
      w: 760, h: demoPageH(), rawSize: 0, size: 0,
      gradeId: state.gradeId || null, genreId: state.genreId || 'narr', note: '',
      weights: state.weights.slice(),
      status: 'showcase',     // 默认展示稿：干净卷面，点「演示批改」后才出现四色批注
      result: null, essay: null,
      demoAnnos: [],          // 批注在演示批改时再挂上，默认界面不展示
      isDemo: true
    };
  }

  /* 最近一次删除的快照，供「撤销」使用。只留一份，够用且不占内存 */
  let _lastDeleted = null;

  /* 带「撤销」的提示：删除立即可恢复，作为误删的最后一道保险 */
  let _undoTimer = null;
  function toastUndo(msg) {
    const el = $('#toast');
    if (!el) return;
    if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; }
    el.innerHTML = `<span class="tu-tx">${esc(msg)}</span><button class="tu-btn" id="tuUndo">撤销</button>`;
    el.classList.add('on', 'undo');
    const btn = $('#tuUndo');
    if (btn) btn.onclick = e => { e.stopPropagation(); undoDelete(); };
    _undoTimer = setTimeout(() => {
      el.classList.remove('on', 'undo');
      _undoTimer = null;
    }, 6000);          // 6 秒内可撤销
  }

  function undoDelete() {
    const snap = _lastDeleted;
    if (!snap) { toast('没有可撤销的删除'); return; }
    _lastDeleted = null;
    if (snap.kind === 'h') {
      const list = loadHistory();
      list.splice(Math.max(0, snap.index || 0), 0, snap.rec);
      saveHistory(list);
      /* 历史记录的排序是「按时间倒序」，恢复后要重新按 at 排序，
       * 否则它会停在插进去的位置，与"最新的在最前"不一致。 */
      const sorted = list.slice().sort((a, b) => (b.at || 0) - (a.at || 0));
      saveHistory(sorted);
      renderTabs();
      if ($('#mask').classList.contains('on')) openHistory();
    } else {
      const at = Math.min(snap.index || 0, state.docs.length);
      state.docs.splice(at, 0, snap.doc);
      state.activeId = snap.doc.id;
      /* 撤销恢复的是完整 doc 对象（含 result/annos/pages），
       * 直接按它同步左侧并重绘，不需要重新批改。 */
      syncLeftFromDoc();
      renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
    }
    const el = $('#toast');
    if (el) el.classList.remove('on', 'undo');
    toast('已恢复');
  }

  function removeItem(kind, id) {
    if (kind === 'h') {
      const all = loadHistory();
      const rec = all.find(r => r.id === id);
      const list = all.filter(r => r.id !== id);
      if (rec) _lastDeleted = { kind: 'h', rec, index: all.indexOf(rec) };
      saveHistory(list);
      state.docs = state.docs.filter(d => d.histId !== id);
      if (!state.docs.some(d => d.id === state.activeId)) {
        state.activeId = state.docs[0] ? state.docs[0].id : null;
      }
      renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
      if ($('#mask').classList.contains('on')) openHistory();
      toastUndo('已删除「' + String((rec && rec.name) || '该记录').slice(0, 14) + '」');
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
    /* 若这一份还在批改，必须中止请求：
     * 否则请求跑完后仍会写回历史（pushHistory / registerDraft），
     * 用户会看到"已经删掉的作文"以历史记录的形式重新冒出来。 */
    if (removed) {
      removed.cancelled = true;
      if (removed.ctrl) { try { removed.ctrl.abort(); } catch (e) {} removed.ctrl = null; }
      removed.grading = false;
    }
    if (removed) _lastDeleted = { kind: 'doc', doc: removed, index: idx };
    // 关键：同一篇稿在历史里有对应记录时一并删除，
    // 否则它会以"历史"标签的形式重新出现，导致要删两次。
    if (removed && removed.histId) {
      const list = loadHistory().filter(r => r.id !== removed.histId);
      saveHistory(list);
    }
    if (state.activeId === id) {
      const next = state.docs[idx] || state.docs[idx - 1] || state.docs[0];
      state.activeId = next ? next.id : null;
    }
    /* 不管删的是不是当前稿，左侧面板都按"当前稿"重新同步一次：
     * 删除后当前稿可能已经换了，年级/体裁/姓名/权重都要跟着变，
     * 否则会出现「右侧是 A，左侧还显示 B 的年级」的错位。 */
    syncLeftFromDoc();
    renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
    toastUndo(`已删除「${String((removed && (removed.note || removed.name)) || '未命名').slice(0, 14)}」`);
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

    // 删除按钮：容器级事件委托，renderTabs 重建 DOM 也不会丢绑定。
    // 删除按钮：document 级事件委托。
    // 为什么挂 document 而不是容器：标签多时内容会横向溢出，部分叉号落在
    // 右侧工具栏之下（z-index 更高），事件根本到不了容器，只能从顶层拦截。
    // 判定除了 e.target，还会按坐标做几何兜底，被遮挡也能命中。
    if (!document.documentElement.dataset.tabDelBound) {
      document.documentElement.dataset.tabDelBound = '1';

      const hitTabX = (ev) => {
        const t2 = document.querySelector('#fileTabs');
        if (!t2) return null;
        // 1) 常规：直接命中的元素
        const direct = ev.target && ev.target.closest ? ev.target.closest('.tab-x') : null;
        // 只有在标签栏内的叉号才算，避免误伤别处的 .tab-x
        if (direct && t2.contains(direct)) return direct;
        /* 2) 兜底：按坐标找标签栏内的叉号。
         * 原来四周各放宽 6px，等于把叉号的"可点区域"扩大了近一倍，
         * 相邻标签、标签正文边缘都成了删除区——这是误删的直接原因。
         * 现在不放宽，只认叉号自身的矩形。 */
        const pad = 0;
        const tabs = Array.from(t2.querySelectorAll('.ftab'));
        for (const tab of tabs) {
          const x = tab.querySelector('.tab-x');
          if (!x) continue;
          const xr = x.getBoundingClientRect();
          if (!xr.width) continue;
          if (ev.clientX >= xr.left - pad && ev.clientX <= xr.right + pad
            && ev.clientY >= xr.top - pad && ev.clientY <= xr.bottom + pad) {
            return x;
          }
        }
        return null;
      };

      /* 删除：先弹确认框，确认后才真正删除。
       * 原来的实现是 pointerdown 就直接删——鼠标一按下即生效，
       * 连"点错但没松手"的后悔机会都没有，这是误删的主要原因。 */
      const kind0 = k => k.slice(0, k.indexOf(':'));

      const askDelete = async (x, ev) => {
        if (!x) return;
        /* 在捕获阶段拦下，事件不会传到标签本身，
         * 所以不会再"顺带把这篇切成当前稿"。 */
        ev.stopPropagation();
        ev.preventDefault();
        if (x.classList.contains('lock')) {
          toast('需保留一份，无法删除最后一份');
          return;
        }
        const key = x.dataset.del || '';
        /* 兜底：正在批改中的稿先提示"需先停止"，避免删了却留个在跑的请求，
         * 也避免弹出一个"确认了也删不掉"的空确认框。 */
        if (kind0(key) === 'doc') {
          const dd = state.docs.find(v => v.id === key.slice(2));
          if (dd && dd.grading) { toast('这一份正在批改，请先停止再删除'); return; }
          if (state.docs.length <= 1) { toast('需保留一份，无法删除最后一份'); return; }
        }
        if (!key) return;
        const ci = key.indexOf(':');
        if (ci < 0) return;
        const kind = key.slice(0, ci), id = key.slice(ci + 1);

        // 找出这份作文的名字与批改状态，写进确认框，让人看清楚删的是哪一篇
        let name = '这份作文', graded = false;
        if (kind === 'doc') {
          const d = state.docs.find(v => v.id === id);
          if (d) { name = d.note || d.name || '未命名'; graded = !!d.result || d.status === 'done'; }
        } else {
          const rec = loadHistory().find(v => v.id === id);
          if (rec) { name = rec.name || '未命名'; graded = true; }
        }
        const ok = await askConfirm({
          title: '确认删除这份作文？',
          body: `「<b>${esc(String(name).slice(0, 20))}</b>」${graded ? '已经批改完成，删除后<b>批注与评分都会一起删掉</b>。' : '删除后需要重新上传。'}`,
          tip: '删除后 6 秒内可以点提示里的「撤销」找回。',
          okText: '确认删除',
          cancelText: '保留'
        });
        if (!ok) return;
        removeItem(kind, id);
      };

      // 用 click 触发（松手后才算），不再是 pointerdown 按下即删
      document.addEventListener('click', ev => {
        const x = hitTabX(ev);
        if (x) askDelete(x, ev);
      }, true);


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
      requestAnimationFrame(() => {
        applyPaperBg();
        fitPlainSheet(d);
        bindPageBar();
        /* 切页时新页背景图尚未解码完成，第一次 fitPlainSheet 可能量到
         * 未就位的容器尺寸，纸张会短暂停在偏低的位置（肉眼是一次重影）。
         * 图片解码后再校准一次；decode() 失败（如 dataURL 异常）也不影响首帧。 */
        const bg = document.querySelector('.plain-wrap .paper-bg');
        const late = () => requestAnimationFrame(() => fitPlainSheet(d));
        if (bg) {
          const url = bg.getAttribute('data-bg');
          if (url) {
            const im = new Image();
            im.onload = late;
            im.onerror = late;
            im.src = url;
          } else late();
        } else late();
      });
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
      requestAnimationFrame(() => {
        // 图片/字体加载后高度会变，复校一次，避免底部批注再次被裁
        fitBoard();
        requestAnimationFrame(() => {
          layoutAnnos();
          bindMarkEditing();   // 划线可拖动 / 缩放 / 删除
          /* layoutAnnos 排完批注后，左右列才会被撑到真实高度。
           * 之前它排在最后且之后不再校准，fitBoard 量到的仍是「只有纸张」的高度，
           * 批注比纸张高时画板没跟着变高、纸张也没按新内容重新定位，
           * 表现为作文整体靠下、上半留白像有空气墙。这里补一次收尾校准。 */
          requestAnimationFrame(() => fitBoard());
        });
      });
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
    /* 可视高度必须取「画板视口」，不能取 host.clientHeight 或 #canvasInner：
     * 这两个容器都会被下面撑高，用它们当基准会形成测量环路，
     * 第一轮撑高后第二轮就永远认为"没超高"，底部照样被裁。
     * 只有外层 .canvas-wrap 是固定高度的滚动视口，才是真正的可用高度。 */
    const viewport = document.querySelector('#canvasWrap');
    const hostH = viewport ? viewport.clientHeight : host.clientHeight;
    // 以“实际纸张”为基准，相对整个画板垂直居中（上下留白一致）
    const paperEl0 = document.querySelector('.shot-img') || document.querySelector('.plain-wrap > div');
    const paperH0 = paperEl0 ? paperEl0.getBoundingClientRect().height : 0;
    /* 居中基准要取「纸张」与「两侧批注列」中更高的那个。
     * 早期只按纸张高度居中：批注卡比纸张高时，卡片下半截会溢出画板底部被裁掉，
     * 表现为右下角最后那张紫色批注看不见。
     * 统一用未缩放的布局高度（offsetHeight / scrollHeight / rect÷zoom）：
     * sheet 上还挂着 scale(zoom)，直接用 rect 会把缩放算进内容高度。 */
    const z = state.zoom || 1;
    const sheetRect = sheet.getBoundingClientRect();
    const contentH = Math.max(
      (paperH0 || 0) / z,          // 纸张同样要剥掉 scale，否则缩放后会误判超高
      sheet.offsetHeight || 0,
      sheet.scrollHeight || 0,
      (sheetRect.height || 0) / z
    );
    /* 切页瞬间新页的背景图还没解码完，纸张高度会读到 0。
     * 这时若照常计算居中，slack 会接近整个视口高，纸张被定位到
     * (hostH)/2 附近（实测 466px），图片加载出来后位置已经定格，
     * 于是肉眼看到一次"重影 + 跳到偏下"。高度无效时直接跳过本次定位，
     * 保留上一帧位置，等图片 onload 触发的复校再算。 */
    if (!(contentH > 20)) return;

    /* 批注列高于纸张时，把 .sheet-wrap 切成顶部对齐。
     * 它本身是 flex 容器，默认 align-items:center；一旦被更高的批注撑开，
     * 中间的纸张就会被垂直居中推到下方，顶部留出一片空白
     * （用户描述为「图片靠下、像有空气墙」）。批注多、纸张矮时最明显。 */
    const paperH = (paperH0 || 0) / z;
    const colH = Math.max(
      sheet.offsetHeight || 0,
      sheet.scrollHeight || 0,
      (sheetRect.height || 0) / z
    );
    sheet.classList.toggle('col-overflow', colH > paperH + 2);
    // 居中后若仍放不下，顶部再上提一点，保证上下都不越界；始终不高于画板顶部
    const margin = 10;
    const slack = hostH - contentH;
    /* 垂直定位：内容在画板内居中，上下留白尽量均等。
     * 只做一件事——居中，不额外上移。之前为了「不贴顶」反复调基准，
     * 结果把 top 压到 6px，反而变成贴边。
     *  - slack > 0：上下各分一半（居中）；
     *  - slack ≤ 0（内容比画板高）：从 0 开始，交给画板滚动。
     * 两端各留 padding 由 .canvas-wrap 提供，这里不再叠加额外偏移。 */
    /* 居中时要把页码栏的高度算进去：它排在纸张下方，
     * 若只按画板高度居中，纸张会被推得偏下一点（实测上 58 / 下 32）。
     * 这里从可用高度里扣掉页码栏，再均分，上下就对称了。 */
    const barEl = document.querySelector('.board-frame > .page-bar');
    const barH = barEl ? (barEl.offsetHeight + 10) : 0;
    /* 居中的基准必须是「纸张高度」，不能用 contentH。
     * contentH 取的是「纸张与批注列中较高者」——批注比纸高时它等于批注高度，
     * 此时若按它居中，纸张（比它矮）就会被摆到偏上的位置，
     * 下方留下大片空白（用户看到的就是「贴边 + 底下空一大片」）。
     * 纸张才是视觉主体，按纸张居中；批注超出部分交给滚动，不参与居中。 */
    const paperVisH = (paperH0 || 0) / z;
    const slackInner = hostH - barH - paperVisH;
    const targetTop = slackInner > 0 ? Math.max(0, Math.round(slackInner / 2)) : 0;

    // 3) 应用垂直居中（绝对定位到计算值）
    sheet.style.position = 'absolute';
    sheet.style.left = '50%';
    sheet.style.top = targetTop + 'px';
    sheet.style.transform = `translateX(-50%) scale(${zoom})`;
    sheet.style.transformOrigin = 'top center';
    sheet.style.margin = '0';
    /* 内容比画板高时，让画板可以纵向滚动，而不是把底部裁掉。
     * #canvasInner / .board-frame 默认锁死 height:100%，内容撑不开容器，
     * 于是 .canvas-wrap 的 scrollHeight === clientHeight，永远滚不动。 */
    const overflow = contentH + margin * 2 > hostH;
    const inner = document.querySelector('#canvasInner');
    if (inner) {
      inner.style.height = overflow ? 'auto' : '100%';
      inner.style.minHeight = '100%';
    }
    // .board-frame 在 CSS 里是 height:100%!important，行内普通赋值盖不住，必须带 important
    if (overflow) {
      host.style.setProperty('height', (contentH + margin * 2) + 'px', 'important');
      host.style.setProperty('min-height', '100%', 'important');
    } else {
      host.style.setProperty('height', '100%', 'important');
      host.style.setProperty('min-height', '100%', 'important');
    }

    /* 页码栏跟随「图片下沿」，而不是贴在画板最底边。
     * 原样式是 bottom:8px 绝对定位，画板高时页码会飘到很远的下方，
     * 必须滚轮才能看到；上传态用的是跟随文档流，两者观感不一致。
     * 这里按纸张实际底边算一个 top，让页码紧贴图片下方。 */
    const bar = document.querySelector('.board-frame > .page-bar');
    if (bar) {
      const paperEl = document.querySelector('.shot-img') || document.querySelector('.plain-wrap > div');
      const hostRect = host.getBoundingClientRect();
      const paperRect = paperEl ? paperEl.getBoundingClientRect() : null;
      if (paperRect) {
        const barTop = (paperRect.bottom - hostRect.top) + 10;   // 距图片底 10px
        bar.style.setProperty('position', 'absolute', 'important');
        bar.style.setProperty('left', '50%', 'important');
        bar.style.setProperty('transform', 'translateX(-50%)', 'important');
        bar.style.setProperty('top', Math.round(barTop) + 'px', 'important');
        bar.style.setProperty('bottom', 'auto', 'important');
        bar.style.setProperty('margin', '0', 'important');
      }
    }

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

    /* 先给容器定尺寸，再动 .paper-bg 的 padding-top。
     * 顺序反了会有一帧「容器高 0 + 百分比我 141.51%」的中间态：百分比
     * padding 相对宽度计算仍需容器已定型，否则纸张高读到 0，
     * fitPlainSheet 便按 0 居中，肉眼就是切页时的一次重影与下跳。 */
    box.style.width = (w * zoom) + 'px';
    box.style.height = (h * zoom) + 'px';
    box.style.maxHeight = 'none';
    void box.offsetHeight;                      // 强制应用尺寸后再改背景

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
    /* 与批改态同一套规则：垂直居中，上下均分。
     * 之前用「基准 + 系数」，两态各算一套，导致位置不一致且容易压到边缘。 */
    const vpH = wrap.clientHeight;
    const slackP = vpH - (h * zoom);
    const topP = slackP > 0 ? Math.round(slackP / 2) : 0;
    // CSS 里有 .plain-sheet{justify-content:center}，行内需带 important 才能覆盖
    sheet.style.setProperty('justify-content', 'flex-start', 'important');
    sheet.style.setProperty('padding-top', topP + 'px', 'important');
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
    const genre = genreById(d.genreId);
    // 与批改态同一套尺寸逻辑：宽高双向约束，保证整纸完整可见
    const cw0 = $('#canvasWrap') ? $('#canvasWrap').clientWidth : 900;
    const ch0 = $('#canvasWrap') ? $('#canvasWrap').clientHeight : 720;
    const docRatio = (d.h || 1) / (d.w || 1);
    const maxH0 = Math.max(320, ch0 - 92);   // 预留底部说明文字
    const dispW = Math.min(560, cw0 - 120, maxH0 / docRatio);
    if (raw) {
      /* 高度用确定像素而不是 padding-top 百分比：
       * 百分比 padding 依赖容器已有宽度，切页重建 DOM 时容器尚未定型，
       * 会有一帧高度为 0，居中逻辑据此把纸张放到偏低处，形成可见的重影。
       * 这里 dispW 与比例都已算好，直接给高度最稳。 */
      const dispH = Math.round(dispW * docRatio);
      return `<div class="plain-wrap">
        <div style="position:relative;width:${dispW}px;height:${dispH}px;border-radius:6px;overflow:hidden;
          box-shadow:0 1px 3px rgba(20,23,45,.08),0 10px 32px rgba(20,23,45,.12);background:#fff">
          <div class="paper-bg" data-bg="${esc(d.img)}" style="width:100%;height:100%"></div>
          <div class="scan-badge">待批改</div>
        </div>
        ${pageBarHTML(d)}
      </div>`;
    }
    /* 演示稿：批注一律取定制版（四色齐全，含"删改"），不受 AI 生成结果影响；
     * 真实稿：用批改结果里的批注。 */
    const srcAnnos = (d.isDemo && Array.isArray(d.demoAnnos) && d.demoAnnos.length)
      ? d.demoAnnos
      : ((d.result && d.result.annos) || d.demoAnnos || []);
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
    // 批注列宽：字号加大后同步加宽，保证每行能容下 12~13 个字；
    // 窄窗口时适度回收，但不再低于 132px（竖屏另有堆叠布局兜底）
    // 堆叠阈值看「画板实际宽度」而非窗口宽度：三栏布局下画板 = 窗口 - 两侧栏，
    // 竖屏堆叠布局下画板 ≈ 整窗宽，两种形态都能正确判断
    const stack = cw < 560;   // 竖屏/窄画板：批注改为纸下方双列卡片流
    /* 批注列宽：与导出一致——纸张占可用宽约 62%，其余平分给两列，
     * 白边只剩走线间隙；列宽有可读下限（能放下 12~13 字一行）。 */
    const COL_MIN = 132;
    const paperTargetW = Math.round(avail * 0.62);
    const marginByRest = Math.floor((avail - paperTargetW) / 2) - 8;
    const marginW = stack ? 0 : Math.max(COL_MIN, marginByRest);
    // 高度优先：扣掉介绍区与底部印章/图例后，剩余高度全部给作文纸
    const introH = (document.querySelector('.board-intro') || {}).offsetHeight || 72;
    const reserved = introH + 26 + 18;   // 介绍区 + 间距 + 印章余量
    const maxH = Math.max(300, ch - reserved);
    const ratio = (d.h || 1) / (d.w || 1);
    const byWidth = avail - marginW * 2 - 18;
    const byHeight = maxH / ratio;
    // 堆叠模式：纸张独占整行宽度（批注在下方），高度不再受视口挤压
    const paperW = stack
      ? Math.max(220, Math.min(avail - 8, 760))
      : Math.max(200, Math.min(byWidth, byHeight, 760));
    /* 只画坐标真实有效的批注方格。
     * 以前对缺失坐标的批注兜底成同一个默认矩形，导致所有方格叠在纸面同一处，
     * 互相覆盖后只有一个能点到，其余既选不中也拖不动。
     * 现在没有坐标就不画方格（批注文字仍列在两侧卡片里）。 */
    const marks = A.filter(a => a.located !== false
        && Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.w) && Number.isFinite(a.h))
      .map(a => `<div class="ink-mark ${a.type}" data-a="${a.id}" data-side="${a.side}"
        style="left:${a.x * 100}%;top:${a.y * 100}%;width:${a.w * 100}%;height:${a.h * 100}%">
        <div class="mk-body"></div>
        <span class="mark-no">${a.no || ''}</span>
        <span class="mk-grip" title="拖动右下角调整划线长度"></span>
        <button class="mk-del" title="删除这条划线" aria-label="删除这条划线">×</button>
      </div>`).join('');
    return `<div class="sheet-wrap${stack ? ' stack-mode' : ''}" style="max-width:${avail}px">
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
    const list = (d && ((d.isDemo && d.demoAnnos && d.demoAnnos.length)
      ? d.demoAnnos
      : ((d.result && d.result.annos) || d.demoAnnos))) || [];
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

    /* 堆叠模式（竖屏/窄窗）：批注卡改为纸下方的双列卡片流，
     * 不再绝对定位、不画引线；卡片按原文顺序自然排列，全部可读。 */
    const sheetEl = document.querySelector('.sheet-wrap');
    if (sheetEl && sheetEl.classList.contains('stack-mode')) {
      svg.innerHTML = '';
      ['left', 'right'].forEach(side => {
        const col = document.querySelector('.margin-col.' + side);
        if (!col) return;
        col.style.height = '';
        col.style.minHeight = '';
        col.querySelectorAll('.anno').forEach(el => {
          el.style.position = '';
          el.style.top = '';
          el.style.left = '';
          el.style.right = '';
          el.style.width = '';
          el.style.maxHeight = '';
          el.style.overflowY = '';
        });
      });
      bindAnnoHover();
      return;
    }

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
        // 卡片宽度严格等于列的内容盒宽度，不受任何 padding 影响，避免出现横向溢出。
        if (el) {
          el.style.position = 'absolute';
          el.style.left = '0';
          el.style.right = 'auto';
          el.style.width = '100%';
          el.style.boxSizing = 'border-box';
        }
        return { a, el };
      }).filter(x => x.el)
        // 排序键先做数值兜底：未定位批注的 y/x 可能是 null，直接相减会得到 NaN 导致排序错乱
        .sort((x, y) => {
          const ky = (Number.isFinite(x.a.y) ? x.a.y : 0.5) - (Number.isFinite(y.a.y) ? y.a.y : 0.5);
          if (ky) return ky;
          return (Number.isFinite(x.a.x) ? x.a.x : 0) - (Number.isFinite(y.a.x) ? y.a.x : 0);
        });

      /* 一、测量真实高度
       * 必须先清掉上一轮留下的 maxHeight/overflow 再测：
       * 否则卡片被上一轮的 maxHeight 压过，offsetHeight 量到的是压缩值，
       * 后面的排布就会按错误的高度算间距，导致卡片互相压叠。 */
      items.forEach(({ el }) => {
        el.style.maxHeight = '';
        el.style.overflowY = '';
      });
      void (items[0] && items[0].el.offsetHeight);   // 强制重排

      const placed = items.map(({ a, el }) => {
        // 锚点优先级：用户手动拖过的位置 > 纸面 y 坐标 > 居中
        const anchorRatio = (typeof a.cardAnchor === 'number') ? a.cardAnchor
          : (Number.isFinite(a.y) ? a.y : 0.5);
        return {
          a, el,
          h: Math.max(24, el.offsetHeight || 60),
          anchor: colH * anchorRatio
        };
      });
      const totalH = placed.reduce((sum, it) => sum + it.h, 0) + GAP * Math.max(0, placed.length - 1);

      /* 二、排布策略（重写）
       *
       * 目标：优先贴着对应划线排布，不压缩卡片；只有真的放不下时才向下延伸。
       *
       *   1) 先按「贴住各自锚点」放置（中心对齐划线）；
       *   2) 自上而下消重叠，卡片始终按自然高度显示，**不压缩、不加内部滚动条**；
       *   3) 若排完超出纸张底部：
       *        - 空间确实不够（总高 > 纸高）→ 列高跟着内容向下延伸，
       *          让多出来的卡片自然排到纸面下方，而不是把每张卡压扁；
       *        - 只是个别卡片贴得太靠下 → 先把整体往上收，仍以不重叠为前提。
       *   4) 列高 = max(纸张高度, 内容实际高度)，既保证和纸面对齐，
       *      又允许内容超出时向下长出来。
       */
      // 步骤 1：先按锚点放置（中心对齐划线）
      placed.forEach(it => {
        it.top = (typeof it.a.cardTop === 'number')
          ? it.a.cardTop
          : it.anchor - it.h / 2;
        it.top = Math.max(PAD_TOP, it.top);
      });

      // 步骤 2：自上而下消重叠（按当前 top 排序，保持视觉顺序）
      placed.sort((x, y) => x.top - y.top);
      let cursor = PAD_TOP;
      placed.forEach(it => {
        it.top = Math.max(it.top, cursor);
        cursor = it.top + it.h + GAP;
      });

      const contentH = cursor - GAP;              // 排完后内容的真实底边
      const colFillH = Math.max(colH, contentH);  // 列高：至少和纸一样高，放不下就向下延伸

      /* 步骤 3：如果只是「贴太靠下」导致溢出，而整体其实放得下（totalH <= colH），
       * 就把整列整体上移，让内容收回纸张范围内——这种情况不该向下延伸。 */
      if (contentH > colH && totalH <= colH) {
        const shift = Math.min(contentH - colH, placed.length ? placed[0].top - PAD_TOP : 0);
        if (shift > 0) {
          placed.forEach(it => { it.top -= shift; });
          // 上移后重新正向消重叠，保证不重叠
          let c2 = PAD_TOP;
          placed.forEach(it => {
            it.top = Math.max(it.top, c2);
            c2 = it.top + it.h + GAP;
          });
        }
      }

      // 步骤 4：写回位置——卡片保持自然高度，不再压缩
      placed.forEach(it => {
        it.top = Math.max(PAD_TOP, it.top);
        it.el.style.top = Math.round(it.top) + 'px';
        it.el.style.maxHeight = '';
        it.el.style.overflowY = '';
        it.a._cardTop = it.top;
      });

      /* 步骤 5：列高跟随内容。内容超出纸面时向下延伸，
       * 这样多出来的批注排在作文纸下方，既不压缩也不被裁掉。 */
      const finalH = Math.max(colH, (() => {
        const last = placed[placed.length - 1];
        return last ? last.top + last.h : 0;
      })());
      col.style.height = finalH + 'px';
      col.style.minHeight = finalH + 'px';
      col.style.overflow = 'visible';
      col.dataset.overflow = finalH > colH + 1 ? '1' : '0';
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
    // 堆叠模式（竖屏）不画引线：卡片在纸下方，连线会横穿正文
    const sheetEl = document.querySelector('.sheet-wrap');
    if (sheetEl && sheetEl.classList.contains('stack-mode')) { svg.innerHTML = ''; return; }
    const imgRect = img.getBoundingClientRect();
    const cx = svg.getBoundingClientRect();
    const sc = state.zoom || 1;
    const scaleSafe = v => v / sc;
    const colors = { err: '#e2554f', polish: '#d9a223', good: '#22a06b', dele: '#8b5cf6' };
    svg.innerHTML = '';

    annos.forEach(a => {
      const el = document.querySelector(`.anno[data-a="${a.id}"]`);
      const mark = document.querySelector(`.ink-mark[data-a="${a.id}"]`);
      // 未定位（没有方格）的批注不画引线，否则会从卡片拉一条线到图片外的 (0,0)
      if (!el || !mark || a.located === false) return;
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return;
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
        // 堆叠模式（竖屏）卡片在文档流中，不可拖动定位
        const sheet = el.closest('.sheet-wrap');
        if (sheet && sheet.classList.contains('stack-mode')) return;
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
            // 只调整卡片在侧栏的纵向位置；不擅自给未定位的批注编造纸面坐标
            if (colH > 4) a.cardAnchor = Math.max(0, Math.min(1, (top + el.offsetHeight / 2) / colH));
            // 原本就有纸面位置的批注，同步 y，保证导出时引线仍然对上
            if (a.located !== false && Number.isFinite(a.y) && colH > 4) {
              a.y = Math.max(0, Math.min(1 - (a.h || 0.03), (top + el.offsetHeight / 2) / colH));
            }
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
    // 与画板取批注同源：演示稿用定制版（含删改），真实稿用批改结果
    if (d.isDemo && Array.isArray(d.demoAnnos) && d.demoAnnos.length) {
      d.demoAnnos = d.demoAnnos.map((a, i) => ({ ...a, no: a.no || i + 1 }));
      return d.demoAnnos;
    }
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
            <div class="bp-time">${esc(fmtStamp(n.at))}</div>
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
    const hasAI = !!(window.ZPAI && window.ZPAI.mode());
    const noGrade = !((d && d.gradeId) || state.gradeId);
    // 未配置接口时按钮不置灰：置灰会让人连点试探却得不到任何反馈。
    // 改为保持可点，文案直接说明下一步是什么，点一下自动展开配置面板。
    btn.classList.toggle('need-ai', !hasAI);
    if (txt) txt.textContent = hasAI ? '一键批改' : '先配置 AI';
    btn.title = !hasAI ? '还未配置 AI 批改接口，点击展开配置'
      : !d || !d.realImg ? '请先上传作文图片'
      : noGrade ? '请先选择年级' : '开始批改这一份';
  }

  async function gradeDoc(d) {
    if (!d || d.grading || !d.realImg) return;
    const gd = GRADES.find(x => x.id === (d.gradeId || state.gradeId)) || getGrade();
    const ge = genreById(d.genreId) || getGenre();
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
        { signal: ctrl.signal, genreFocus: ge.focus || '', genreDesc: ge.desc || '' }
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
        console.warn('[紫微星] 批改失败', err);
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
      toast('先配置 AI 接口，填好 API Key 后即可批改');
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
    // 已批改完成：允许重新批改，但先二次确认，避免手滑覆盖已有结果
    if (cur0.result) {
      const ok = await askConfirmRerun(cur0);
      if (!ok) return;
    }
    // 只批改当前这一份；每份各自独立，互不阻塞
    await gradeDoc(cur0);
  }

  /* 重复批改二次确认：返回 Promise<boolean> */
  /* 通用二次确认：返回 Promise<boolean>
   * 用于删除等不可逆操作，避免误点直接生效。
   * opts: { title, body(html), tip, okText, cancelText } */
  function askConfirm(opts) {
    return new Promise(resolve => {
      const mask = $('#cfMask');
      const body = $('#cfBody');
      const titleEl = $('#cfTitle');
      const okBtn = $('#cfOk');
      const cancelBtn = $('#cfCancel');
      if (!mask || !body || !okBtn || !cancelBtn) { resolve(true); return; }

      const o = opts || {};
      if (titleEl) titleEl.textContent = o.title || '请确认';
      body.innerHTML = o.body || '';
      if (o.tip) {
        const tip = document.createElement('div');
        tip.className = 'cf-tip';
        tip.textContent = o.tip;
        body.appendChild(tip);
      }
      okBtn.textContent = o.okText || '确定';
      cancelBtn.textContent = o.cancelText || '取消';

      let settled = false;
      const cleanup = () => {
        mask.hidden = true;
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        mask.onclick = null;
        document.removeEventListener('keydown', onKey, true);
        // 还原默认文案，避免影响其他调用方
        okBtn.textContent = '确定重新批改';
        cancelBtn.textContent = '取消';
      };
      const finish = v => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(v);
      };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        else if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      };
      okBtn.onclick = e => { e.stopPropagation(); finish(true); };
      cancelBtn.onclick = e => { e.stopPropagation(); finish(false); };
      mask.onclick = e => { if (e.target === mask) finish(false); };
      document.addEventListener('keydown', onKey, true);
      mask.hidden = false;
      setTimeout(() => cancelBtn.focus(), 60);   // 默认焦点在"取消"，回车不会误删
    });
  }

  function askConfirmRerun(d) {
    return new Promise(resolve => {
      const mask = $('#cfMask');
      const body = $('#cfBody');
      const okBtn = $('#cfOk');
      const cancelBtn = $('#cfCancel');
      if (!mask || !body || !okBtn || !cancelBtn) { resolve(true); return; }

      const title = (d && (d.note || d.name)) || '这篇作文';
      const score = d && d.result && d.result.score ? `当前得分 <b>${d.result.score.total}</b> 分，` : '';
      body.innerHTML = `「<b>${esc(String(title).slice(0, 20))}</b>」已经批改过了。<br>` +
        `${score}重新批改会用新的结果<b>覆盖</b>现有的批注、评分和报告。`;
      const tip = document.createElement('div');
      tip.className = 'cf-tip';
      tip.textContent = '原结果不会保留，如果还想对照旧版本，建议先导出当前报告。';
      body.appendChild(tip);

      let settled = false;
      const cleanup = () => {
        mask.hidden = true;
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        mask.onclick = null;
        document.removeEventListener('keydown', onKey, true);
      };
      const finish = v => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(v);
      };
      const onKey = e => {
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        else if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      };

      okBtn.onclick = e => { e.stopPropagation(); finish(true); };
      cancelBtn.onclick = e => { e.stopPropagation(); finish(false); };
      mask.onclick = e => { if (e.target === mask) finish(false); };
      document.addEventListener('keydown', onKey, true);

      mask.hidden = false;
      setTimeout(() => okBtn.focus(), 60);
    });
  }

  function makeResult(d) {
    // 演示稿固定按五年级生成（450~550 字区间）；正常稿按所选年级，未选则默认六年级兜底
    const g = GRADES.find(x => x.id === d.gradeId) || GRADES.find(x => x.id === (d.isDemo ? 'g5' : 'g6')) || GRADES[3];
    const genre = genreById(d.genreId);
    // 演示稿：必须使用白板上那篇真实正文，保证报告与画面一致
    const essay = (d.isDemo && typeof DEMO_PARAS !== 'undefined')
      ? {
          title: DEMO_TITLE,
          paras: DEMO_PARAS.slice(),
          words: DEMO_PARAS.join('').replace(/\s/g, '').length,
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
    // ③b 演示稿：总评与「具体问题」使用精炼定制版（三条，与批改要求同构）
    if (d.isDemo && typeof DEMO_REVIEW !== 'undefined') {
      report.review = DEMO_REVIEW;
      report.issues = DEMO_ISSUES.map(it => ({ ...it, detail: it.desc, ex: it.ex || '' }));
    }
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
  /* ================= 批注生成：按每段真实文本特征检测 =================
   * 原则：只对文中确实存在的问题出批注，一条一批注、各条指向不同片段。
   * 同一段可以同时出多条（例如既有病句又有润色点），不做"必须覆盖几段"的硬凑。
   */
  function makeAnnos(essay, g, genre, opts) {
    const P = essay.paras.filter(x => x && String(x).trim().length > 4);
    if (!P.length) return [];
    const raw = String;
    const cnt = t => String(t || '').replace(/\s+/g, '').length;
    const cut = (t, n) => {
      const s = String(t || '').replace(/\s+/g, '');
      return s.length > n ? s.slice(0, n) + '…' : s;
    };
    const build = [];   // { type, para, html, quote }

    /* ---------- 〇、体裁契合检查 ----------
     * 先判断"这篇文章是不是所选体裁"：文中出现其他体裁的强特征时，
     * 出一条提醒（不硬改内容），避免批注口径与文章实际类型错位。 */
    const gid0 = genre && genre.id;
    const full0 = P.join('');
    const looksLetter = /(^|\n)\s*(亲爱的|敬爱的|尊敬的)[^\n]{0,10}[:：]/.test(full0) || /(此致\s*敬礼|祝\s*身体健康)/.test(full0);
    const looksSpeech = /(同学们|老师们|各位(同学|老师|朋友))[：:，]?\s*(大家好|你们好)/.test(full0);
    const looksRead = /《[^》]{1,20}》/.test(full0) && /(读了|读完|看完|有感|读后感|观后感)/.test(full0);
    const detected = looksLetter ? 'letter' : looksSpeech ? 'speech' : looksRead ? 'read' : null;
    if (detected && gid0 && detected !== gid0 && !(detected === 'letter' && gid0 === 'speech')) {
      const nameOf = { letter: '书信', speech: '演讲发言', read: '读后有感' };
      build.push({ type: 'polish', para: 0, quote: cut(P[0], 12),
        html: `这篇文章带有明显的<b>${nameOf[detected]}</b>特征，与当前所选体裁「${genre.name}」不一致。建议把左侧体裁切换为「${nameOf[detected]}」，批改口径会更贴合；以下批注仍按本文实际内容给出。` });
    }

    /* ---------- 一、病句 / 错别字：逐段扫描实际文本 ---------- */
    const ERR_RULES = [
      { re: /(很|非常|特别|十分)(感动|难过|开心|高兴|紧张|害怕|生气|惭愧|温暖|失落)/,
        make: (m, t) => `“<b>${m[0]}</b>”是在直接说结果，读者接收不到画面。建议换成身体反应，例如“${({ 感动: '鼻子一酸，眼眶热了一下', 难过: '喉咙像塞了棉花', 开心: '嘴角压不住地往上翘', 紧张: '手心全是汗', 害怕: '后背沁出一层薄汗' })[m[2]] || '手心发凉'}”。` },
      { re: /(慢慢的|静静的|轻轻的|悄悄的)(?![地])/,
        // m[1] 已经是“慢慢的”这种带“的”的形式，去掉尾字再补“地”
        pair: (m) => [m[0], m[1].replace(/的$/, '') + '地'],
        make: (m) => `“<b>${m[0]}</b>”误用：修饰动作要用“地”，应写作“${m[1].replace(/的$/, '')}地”。` },
      { re: /([的地得])\s*(?=[走跑看说想坐站拿放])/,
        pair: (m) => [m[1], '地'],
        make: (m, t) => `此处“<b>${m[1]}</b>”后面接的是动作，应该用“地”，改为“${m[1].replace(/[的地得]/, '地')}”。` },
      // 重复用字：只认真正笔误（如“的的”“了了”），排除“浅浅/慢慢/妈妈”这类正常叠词
      { re: /(的的|了了|地地|得得|是是|在在|我我|他他|她她)/,
        pair: (m) => [m[0], m[0][0]],
        make: (m) => `“<b>${m[0]}</b>”重复用字，属于笔误，删去一个即可。` },
      { re: /[，,]{2,}|[。！？]{2,}/,
        make: (m) => `标点连用“<b>${m[0]}</b>”，应改为单个标点。` },
      { re: /并且而且|因为所以|虽然但是(?=[^，。])/,
        make: (m) => `“<b>${m[0]}</b>”关联词冗余，保留一个更简洁。` },
      { re: /像(.{2,10})一样像/,
        make: (m) => `比喻重复“<b>${m[0]}</b>”，保留一处即可。` },
      { re: /的的|了了|地地/, make: (m) => `“<b>${m[0]}</b>”重复用字，删去一个。` }
    ];
    const hitParas = new Set();
    P.forEach((t, pi) => {
      ERR_RULES.forEach(r => {
        const m = String(t).match(r.re);
        if (!m) return;
        // 同一段同类规则只记一次
        const key = pi + ':' + r.re.source;
        if (hitParas.has(key)) return;
        hitParas.add(key);
        /* pair 给出“错→对”，供报告里的「错别字汇总」直接列出；
           没有 pair 的规则（如长句、标点连用）不算错别字，不进汇总。 */
        const pr = r.pair ? r.pair(m, t) : null;
        build.push({ type: 'err', para: pi, quote: m[0], html: r.make(m, t),
          typo: pr ? { wrong: String(pr[0]), right: String(pr[1]) } : null });
      });
    });

    /* ---------- 二、长句未断：按实际字数判定 ---------- */
    P.forEach((t, pi) => {
      if (!/[^。！？；]{42,}/.test(t)) return;
      const seg = String(t).match(/[^。！？；]{42,}/)[0];
      // 找到可断处：转折/因果连词，或句中逗号后
      const turn = seg.match(/(.{12,}?)(可|但是|可是|于是|却|因为|所以|只是|而且)/);
      const advice = turn
        ? `建议在“<b>${turn[2]}</b>”前断开成两句：“${cut(turn[1], 16)}。”另起一句。`
        : `建议在中途的逗号处断开，让句子有停顿。`;
      build.push({ type: 'err', para: pi, quote: cut(seg, 24),
        html: `这一句有 <b>${cnt(seg)}</b> 字未断开，一口气读不完。${advice}` });
    });

    /* ---------- 二·补 用词与句式层面的可改进点 ----------
     * 这类不是"写错"，而是"写得可以更好"：泛动词、抽象形容词、全是短句、连续同一主语开头。
     * 归入 polish，每条都指名具体的那一句，不做无对象点评。 */
    const GENERIC_VERB = /(|^)(做|弄|搞|弄了|进行|处理|完成)/;
    const VAGUE_ADJ = /(很美|很好看|非常好看|特别好|很棒|很漂亮|舒服|美好|不错)/;
    const subjectRepeat = [];

    P.forEach((t, pi) => {
      const txt = String(t);

      // a) 泛动词：做/弄/搞 代替了具体动作
      const gv = txt.match(/(做|弄|搞)(了|着|好|完)?[^，。]{0,8}/);
      if (gv && build.filter(b => b.type === 'polish').length < 8) {
        build.push({ type: 'polish', para: pi, quote: gv[0],
          html: `“<b>${gv[0]}</b>”里的动词太笼统，读者看不到动作。换成具体的手部动作，例如把“做了准备”改成“把袖子往上撸了两下”。` });
      }

      // b) 抽象形容词：很美/很好看/特别好
      const va = txt.match(VAGUE_ADJ);
      if (va && build.filter(b => b.type === 'polish').length < 8) {
        build.push({ type: 'polish', para: pi, quote: va[0],
          html: `“<b>${va[0]}</b>”是评价，不是描写。读者不知道美在哪里。改成具体的颜色、形状或一个细节：“叶子边缘卷起来一点，背面的灰白翻了出来。”` });
      }

      // c) 连续短句：一句里超过 3 个逗号且每截都很短
      const segs = txt.split(/[，；]/).map(x => x.trim()).filter(Boolean);
      if (segs.length >= 4 && segs.every(x => cnt(x) <= 6) && build.filter(b => b.type === 'polish').length < 8) {
        build.push({ type: 'polish', para: pi, quote: cut(txt, 18),
          html: `这一句连用了 ${segs.length} 个很短的短句，节奏碎。可以合并成一句有起伏的长句，再在最重的地方用一个短句收住。` });
      }

      // d) 连续以"我"开头（记录，后面统一出一条）
      if (/^我[^，。]{0,6}/.test(txt)) subjectRepeat.push(pi);
    });

    // d) 主语重复：连续段落都以"我"开头，只出一条
    if (subjectRepeat.length >= 3 && build.filter(b => b.type === 'polish').length < 9) {
      const si = subjectRepeat[1];
      build.push({ type: 'polish', para: si, quote: cut(P[si], 12),
        html: `连续 ${subjectRepeat.length} 段都以“我”开头，句式重复。可以把其中几句换成“手里的笔”“窗外的风”作主语，视角一换就活了。` });
    }

    /* ---------- 三、润色点：按文本特征给出针对性改写 ---------- */
    // 3.1 有"像/仿佛"的比喻句 → 检查喻体是否具体
    //     喻体笼统的才批"太笼统"；喻体已经具体的，改为给一个不同的推法（每条措辞不同）
    const simileReplies = [
      (m) => `“<b>${m[0]}</b>”已经是个好比喻。可以在喻体后面再补一个<b>可触摸的细节</b>——它的温度、重量或磨损痕迹，画面就从“像”变成“是”。`,
      (m) => `“<b>${m[0]}</b>”的比喻方向偏静态。试着给它加一个<b>动作</b>，让喻体也动起来，例如让它被风吹一下、被人碰一下。`,
      (m) => `“<b>${m[0]}</b>”喻体选得贴生活。可以把这个比喻<b>往后延一句</b>，写它带来的感受，让读者也尝到那种滋味。`
    ];
    let simileIdx = 0;
    P.forEach((t, pi) => {
      const m = String(t).match(/(像|仿佛)([^，。；！？]{1,8})/);
      if (!m) return;
      const isVague = /^(很|好|某种|什么|一个)/.test(m[2]) || cnt(m[2]) <= 2;
      const html = isVague
        ? `“<b>${m[0]}</b>”的喻体太笼统，读者想不出画面。换成生活里见过的东西，最好带动作或磨损感，例如“像一张被反复折过的纸，折痕处已经发白”。`
        : simileReplies[simileIdx++ % simileReplies.length](m);
      build.push({ type: 'polish', para: pi, quote: m[0], html });
    });

    // 3.2 通篇"看见"型描写 → 提示补声音或触感
    P.forEach((t, pi) => {
      const hasSense = /(听见|闻到|摸到|凉|暖|响|香|光|影|烫|冷|粗糙|软|硬|湿)/.test(t);
      const isScene = /(看|望|见|站|坐|走|厨房|窗|手|脸|背)/.test(t) && cnt(t) >= 12;
      if (hasSense || !isScene) return;
      // 只在真正"纯视觉"的段落提示，且全文最多 3 条
      if (build.filter(b => b.type === 'polish').length >= 3) return;
      build.push({ type: 'polish', para: pi, quote: cut(t, 18),
        html: `这一段只有画面，没有声音和触感。可在动作后面接半句：“${cut(t, 10)}……；水龙头没关紧，滴答、滴答，一下一下敲在瓷盆上。”` });
    });

    // 3.3 动作一笔带过 → 提示拆成三拍
    P.forEach((t, pi) => {
      const m = String(t).match(/(我)?(走过去|跑过去|坐下去|拿起|放下|转过头|低下头)/);
      if (!m) return;
      if (build.filter(b => b.type === 'polish').length >= 4) return;
      build.push({ type: 'polish', para: pi, quote: m[0],
        html: `“<b>${m[0]}</b>”是一个整体动作，一笔带过。拆成三拍会更有过程感：“手撑在桌沿，身子往前倾了一下，又慢慢收回去。”` });
    });

    /* ---------- 三·补2 通用建议与体裁的适配 ----------
     * 议论说理 / 演讲发言 / 读后有感本来就靠"讲道理"收束，
     * 不能再按记叙文口径建议"删掉总结句、把道理藏起来"。
     * （gid 提前声明：3.4 对话检查与后面的体裁专属检查共用） */
    const gid = genre && genre.id;
    const reasoningGenre = gid === 'argue' || gid === 'speech' || gid === 'read';

    // 3.4 缺少人物原话 → 提示加一句对话（说理/演讲类不强制要求人物对话）
    const hasDialog = /[“"][^”"]{2,}[”"]/.test(P.join(''));
    if (!hasDialog && !reasoningGenre && gid !== 'travel' && gid !== 'object') {
      const cand = P.findIndex((t, i) => /(说|问|喊|答|告诉)/.test(t));
      const idx = cand >= 0 ? cand : Math.min(1, P.length - 1);
      build.push({ type: 'polish', para: idx, quote: cut(P[idx], 14),
        html: `全篇没有人物原话，情绪都靠转述。可以在这一处让人物说<b>一句</b>原话（带引号），比如“她说，你先写作业，这点事妈自己来。”，现场感立刻就出来了。` });
    }

    /* ---------- 三·补 体裁专属检查 ----------
     * 按所选体裁追加"这类文章该有而没有"的检查，每条钉在真实段落上；
     * 与通用规则共用去重逻辑，不会与其他批注点评同一句。 */
    const full = P.join('');
    const pushGenre = (type, pi, quote, html) => build.push({ type, para: pi, quote, html });
    const genreMismatch = !!(detected && gid && detected !== gid);
    if (genreMismatch) {
      // 体裁不符时跳过"该体裁该有而没有"的检查，避免对书信批"缺少演讲呼告"这类错位
    } else if (gid === 'letter') {
      // 书信格式：称呼 / 祝语 / 署名日期
      if (!/^[^\n]{0,12}(亲爱的|敬爱的|尊敬的|您好|你好)/.test(String(P[0] || '')) && !/[:：]\s*$/.test(String(P[0] || ''))) {
        pushGenre('err', 0, cut(P[0], 12), '书信开头应有<b>顶格称呼</b>（如"亲爱的妈妈："），这是书信格式的固定要求，现在缺失会直接扣格式分。');
      }
      if (!/(此致|祝|身体健康|工作顺利|天天开心|敬礼)/.test(full)) {
        pushGenre('err', P.length - 1, cut(P[P.length - 1], 12), '结尾缺少<b>祝语</b>（如"祝身体健康"）。书信的祝语、署名、日期是格式分的关键，补上才完整。');
      }
      if (!/(署名|您的|你的(儿子|女儿|学生|朋友)|×××|[0-9]{1,2}月[0-9]{1,2}日)/.test(String(P[P.length - 1] || '') + String(P[P.length - 2] || ''))) {
        pushGenre('polish', P.length - 1, cut(P[P.length - 1], 12), '结尾建议补上<b>署名与日期</b>（右下角两行），书信格式才算完整。');
      }
      if (!/(您|你)/.test(full)) {
        pushGenre('polish', Math.min(1, P.length - 1), cut(P[Math.min(1, P.length - 1)], 12), '全篇没有出现"你/您"，缺少<b>对象感</b>。书信是写给某个人看的，试着直接对收信人说话。');
      }
    } else if (gid === 'speech') {
      if (!/(同学们|老师们|大家好|各位|朋友们)/.test(String(P[0] || ''))) {
        pushGenre('polish', 0, cut(P[0], 12), '演讲开头应有<b>呼告</b>（如"亲爱的同学们：大家好！"），先和听众建立联系，再进入正题。');
      }
      if (!/(我们|大家)/.test(full)) {
        pushGenre('polish', Math.min(1, P.length - 1), cut(P[Math.min(1, P.length - 1)], 12), '全篇很少用"我们/大家"。演讲是说给听众听的，多用<b>共同立场的词</b>，感染力会更强。');
      }
      if (!/(让我们|一起来|从现在|行动|呼吁|倡议)/.test(String(P[P.length - 1] || ''))) {
        pushGenre('polish', P.length - 1, cut(P[P.length - 1], 12), '结尾建议加一句<b>号召</b>（如"让我们从今天做起"），演讲收在行动上才有力量。');
      }
    } else if (gid === 'argue') {
      if (!/(我认为|我觉得|我想说|应该|必须|道理|观点)/.test(full)) {
        pushGenre('polish', 0, cut(P[0], 12), '议论文开头要<b>亮明观点</b>，一句话说清你的主张（如"我认为……"），现在读者还不清楚你要论证什么。');
      }
      const examplePara = P.findIndex(t => /(有一次|记得|比如|例如|曾经)/.test(t));
      if (examplePara >= 0 && !/(这说明|可见|因此|正因为|告诉我们)/.test(P[examplePara])) {
        pushGenre('polish', examplePara, cut(P[examplePara], 14), '这一段举了事例，但缺少<b>分析</b>。事例后补一句"这说明……"，把事例和观点连起来，论证才成立。');
      }
    } else if (gid === 'read') {
      if (!/(《[^》]+》|读了|看完|观后)/.test(full)) {
        pushGenre('err', 0, cut(P[0], 12), '读后感开头应交代<b>所读的书目或篇目</b>（用书名号），现在读者不知道你读的是什么。');
      }
      const introLong = P.findIndex(t => cnt(t) > 120 && /(讲了|主要写了|故事|内容|情节)/.test(t));
      if (introLong >= 0) {
        pushGenre('dele', introLong, cut(P[introLong], 14), '这一段复述原文内容偏多。读后感"读"只占三分之一，<b>压缩复述</b>，把篇幅让给自己的感受。');
      }
      if (!/(想起|记得|我也|有一次|去年|那次)/.test(full)) {
        pushGenre('polish', Math.min(2, P.length - 1), cut(P[Math.min(2, P.length - 1)], 12), '感受部分建议<b>联系自己的一次具体经历</b>，"感"才有落点，不悬在半空。');
      }
    } else if (gid === 'travel') {
      if (!/(来到|走进|沿着|穿过|到了|出发|前往)/.test(full)) {
        pushGenre('polish', 0, cut(P[0], 12), '游记要有一条<b>游览路线</b>（"走进……沿着……来到……"），读者才能跟着你的脚步走，现在缺少行踪线索。');
      }
      const senses = ['/(看见|望|映入眼帘|眼前)/', '/(听见|听到|传来|声)/', '/(闻到|清香|气息|味)/', '/(摸|触|凉|暖|风吹)/'];
      const senseCnt = senses.filter(re => new RegExp(re.slice(1, -1)).test(full)).length;
      if (senseCnt <= 1 && P.length >= 2) {
        pushGenre('polish', 1, cut(P[1], 12), '写景目前只有视觉。补上<b>声音、气味或触感</b>（鸟鸣、花香、风的凉意），景物才立体可感。');
      }
    } else if (gid === 'object') {
      if (!/(形状|颜色|摸|质地|花纹|外形|样子|毛|叶子|花瓣)/.test(full)) {
        pushGenre('polish', Math.min(1, P.length - 1), cut(P[Math.min(1, P.length - 1)], 12), '状物要有<b>外形特写</b>：形状、颜色、质地按顺序细看，现在读者还"看"不清这件物。');
      }
      if (!/(来历|送给|买的|捡|养|陪|那年|小时候)/.test(full)) {
        pushGenre('polish', Math.min(2, P.length - 1), cut(P[Math.min(2, P.length - 1)], 12), '建议写一写这件物的<b>来历或故事</b>——它从哪来、和你发生过什么，物才有温度。');
      }
    } else if (gid === 'imag') {
      if (!/(假如|如果|梦见|突然|神奇|魔法|未来|星球|王国|穿越)/.test(String(P[0] || '') + String(P[1] || ''))) {
        pushGenre('polish', 0, cut(P[0], 12), '想象作文开头要尽快<b>交代神奇设定</b>（时间、地点、规则），读者才能进入你虚构的世界。');
      }
      if (!/(醒来|原来|回到|现实|睁眼)/.test(String(P[P.length - 1] || ''))) {
        pushGenre('polish', P.length - 1, cut(P[P.length - 1], 12), '结尾可以<b>回到现实</b>（"我睁开眼睛……"），一虚一实，想象更有余味。');
      }
    }

    /* ---------- 四、好句：挑真实有画面感的句子 ---------- */
    const scoreOfLine = (t) => {
      let sc = 0;
      if (/(像|仿佛|好似|如同)/.test(t)) sc += 3;                 // 有比喻
      if (/(听见|闻到|凉|暖|响|香|光|影|烫|冷|粗糙|软)/.test(t)) sc += 2;  // 有感官
      if (/(捡|搓|擦|攥|拢|抹|掀|垂|缩|倾|撑)/.test(t)) sc += 2;   // 有具体动词
      if (cnt(t) >= 10 && cnt(t) <= 30) sc += 1;                    // 长度适中
      return sc;
    };
    const ranked = P.map((t, i) => ({ t, i, s: scoreOfLine(t) }))
      .filter(x => x.s >= 3).sort((a, b) => b.s - a.s).slice(0, 2);
    ranked.forEach(x => {
      const why = /(像|仿佛|好似)/.test(x.t) ? '用了一个来自生活的比喻，画面立得住'
        : /(听见|闻到|凉|暖|响|香)/.test(x.t) ? '调动了感官，读者能跟着“在场”'
        : '动词选得准，动作有过程感';
      build.push({ type: 'good', para: x.i, quote: cut(x.t, 20),
        html: `“<b>${cut(x.t, 20)}</b>”${why}，<b>这种写法请保留</b>。` });
    });
    // 保底：至少一条好句
    if (!build.some(b => b.type === 'good')) {
      let bi = 0;
      P.forEach((t, i) => { if (cnt(t) > cnt(P[bi])) bi = i; });
      build.push({ type: 'good', para: bi, quote: cut(P[bi], 18),
        html: `“<b>${cut(P[bi], 18)}</b>”是全文细节最足的一句，把感受落在了具体的事上，比直接抒情更有说服力。` });
    }

    /* ---------- 五、删改：找真正重复或可删的句子 ---------- */
    // 5.1 与开头/前文高度重合的结尾总结句
    const first = P[0] || '';
    const last = P[P.length - 1] || '';
    const overlap = (a, b) => {
      const sa = String(a).replace(/[，。！？；]/g, '').slice(0, 6);
      return sa.length >= 3 && String(b).includes(sa);
    };
    if (P.length > 1 && overlap(first, last)) {
      build.push({ type: 'dele', para: P.length - 1, quote: cut(last, 16),
        html: `结尾“<b>${cut(last, 16)}</b>”与开头意象重合，读起来是重复的。建议<u>删去这一句</u>，或压成半句，把余味留白。` });
    }
    // 5.2 含总结式/议论式套话的句子（说理类体裁除外：它们的点题句是必要的）
    P.forEach((t, pi) => {
      if (reasoningGenre) return;
      if (build.filter(b => b.type === 'dele').length >= 2) return;
      if (!/(原来|终于明白|我懂得了|这就是|让我明白了|使我懂得)/.test(t)) return;
      build.push({ type: 'dele', para: pi, quote: cut(t, 16),
        html: `“<b>${cut(t, 16)}</b>”是总结式收尾，把道理直接说了出来。<u>建议删去</u>，把道理藏在前面的动作里，读者自己品出来的更有味道。` });
    });
    // 5.3 全篇过短段落过多 → 提示合并（只出一条）
    const shortP = P.filter(t => cnt(t) < 18);
    if (shortP.length >= 3 && build.filter(b => b.type === 'dele').length < 2) {
      const si = P.findIndex(t => cnt(t) < 18);
      build.push({ type: 'dele', para: si >= 0 ? si : 0, quote: cut(P[si >= 0 ? si : 0], 14),
        html: `全文有 <b>${shortP.length}</b> 段不足 18 字，段落被切得太碎，读起来一跳一跳的。建议把相邻的两段<u>合并</u>，每段只承担一个意思。` });
    }

    /* ---------- 六、排序、去重、定位 ---------- */
    // 去重：同一段之内，同一处引文只保留一条（类型不同也不重复点评同一句）
    const seenQuote = new Set();
    const seenKey = new Set();
    const uniq = build.filter(b => {
      const q = String(b.quote || '').replace(/……|…/g, '').slice(0, 8);
      const qk = b.para + '|' + q;
      const kk = b.para + '|' + b.type + '|' + q;
      if (q.length >= 4 && seenQuote.has(qk)) return false;
      if (seenKey.has(kk)) return false;
      if (q.length >= 4) seenQuote.add(qk);
      seenKey.add(kk);
      return true;
    });

    // 排序：先按段落（从上到下），同段落按类型优先级
    const order = { err: 0, polish: 1, good: 2, dele: 3 };
    uniq.sort((a, b) => (a.para - b.para) || (order[a.type] - order[b.type]));

    // 段落号 → 该行文字的纵向区间
    const gridTotal = () => {
      if (typeof PAPER !== 'undefined' && PAPER && PAPER.FIRST_BASE != null) return PAPER;
      return { PAD_X: 86, LINE_W: 600, FIRST_BASE: 186, LINE_GAP: 40, W: 760 };
    };
    const G = gridTotal();
    const isDemoGrid = !!(opts && opts.isDemo && typeof DEMO_LINES !== 'undefined');
    const rowsAll = isDemoGrid ? DEMO_LINES.length : P.length;
    const pageH = (typeof demoPageH === 'function') ? demoPageH(rowsAll) : 1000;
    // 演示稿白板按句拆行：把「段落号」映射到该段首句所在行，避免批注错位
    const paraRow = (pi) => {
      if (!isDemoGrid || typeof DEMO_PARA_ROWS === 'undefined') return pi;
      return DEMO_PARA_ROWS[Math.max(0, Math.min(pi, DEMO_PARA_ROWS.length - 1))];
    };
    const rowToY = (row) => {
      const base = G.FIRST_BASE + Math.max(0, row) * G.LINE_GAP;
      return {
        y: Math.max(0, Math.min(0.97, (base - 14) / pageH)),
        h: Math.max(0.018, Math.min(0.06, 44 / pageH))
      };
    };

    return uniq.map((a, i) => {
      const side = i % 2 === 0 ? 'left' : 'right';
      const pos = rowToY(paraRow(a.para));
      return {
        id: 'a' + i, no: i + 1, type: a.type, side, html: a.html, para: a.para,
        quote: a.quote || '',
        // 错别字的「错→对」配对要一路带到报告层，供「错别字汇总」使用
        typo: a.typo || null,
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

    // 问题：用作文的真实特征判断，不再随机抽取；保底凑足 3 条内容类问题
    // （「具体问题与修改思路」按 3 条设计，规范类问题会被该栏过滤，不能占坑）
    const issues = [];
    const longSent = P.find(t => /[^。！？]{45,}/.test(t));
    if (longSent) {
      const turnIn = longSent.match(/(.{12,}?)(可|但是|可是|于是|却|因为|所以|只是|而且)(.{8,})/);
      issues.push({ dim: 'language', sev: 'mid', title: '有长句未断开，读起来偏喘',
        desc: `第 ${P.indexOf(longSent) + 1} 段有一句超过 45 字未断句，建议在转折处加逗号或句号。`,
        quote: cut(longSent, 46),
        fix: turnIn ? turnIn[1].replace(/[，,]$/, '') + '。' + turnIn[2] + turnIn[3] : cut(longSent, 46),
        ex: `原句：<s>${cut(longSent, 46)}…</s>` });
    }
    const vague = P.find(t => /(很|非常|特别)(感动|难过|开心|高兴|紧张)/.test(t));
    if (vague) {
      const em = vague.match(/(很|非常|特别)(感动|难过|开心|高兴|紧张|害怕)/);
      const bodyMap = { 感动: '鼻子一酸，眼眶忽然热了一下', 难过: '喉咙像塞了棉花', 开心: '嘴角压不住地往上翘',
        高兴: '忍不住笑出声，又赶紧捂住嘴', 紧张: '手心全是汗，指尖发凉', 害怕: '后背沁出一层薄汗' };
      issues.push({ dim: 'content', sev: 'mid', title: '情绪用概括词表达，画面偏弱',
        desc: '文中用“很感动/很难过”这类词直接说结果，缺少身体反应或动作，感染力会被削弱。',
        quote: cut(vague, 26),
        fix: em ? vague.replace(em[0], bodyMap[em[2]] || '手心发凉') : cut(vague, 26),
        ex: `原句：<s>${cut(vague, 26)}…</s> 建议：<b>把它换成手在做什么、眼睛看见什么。</b>` });
    }
    const shortP = P.filter(t => t.length < 30).length;
    if (shortP >= 2) {
      const sp = P.find(t => t.length < 30) || '';
      issues.push({ dim: 'structure', sev: 'low', title: '有短段偏碎，层次被切得太细',
        desc: `全篇有 ${shortP} 个不足 30 字的短段，会打断叙述节奏，可以考虑合并到相邻段。`,
        quote: cut(sp, 26),
        fix: cut(sp, 26),
        ex: `建议：<b>把相邻的两三句合成一段，让每段只承担一个意思。</b>` });
    }
    /* 内容类保底：按文本真实特征依次补，直到凑足 3 条 */
    const gidR = genre && genre.id;
    if (issues.length < 3 && gidR === 'read' && !/(想起|记得|我也|有一次|去年|那次)/.test(P.join(''))) {
      issues.push({ dim: 'content', sev: 'mid', title: '感受缺自身经历支撑，"感"悬在半空',
        desc: '读后感的"感"要落到自己的一次具体经历上，现在只有对原文的评价，读者看不到这本书和"我"的关系。',
        ex: '建议：<b>补一段"我也遇到过类似的事"，写清那一次的时间、动作和心里的变化。</b>' });
    }
    if (issues.length < 3 && !/[“"][^”"]{2,}[”"]/.test(P.join('')) && gidR !== 'argue' && gidR !== 'read') {
      issues.push({ dim: 'language', sev: 'low', title: '全篇没有人物原话，现场感偏弱',
        desc: '情绪与冲突都靠转述交代，读者听不到人物自己的声音，场景显得隔了一层。',
        ex: '建议：<b>在最关键处让人物说一句原话（带引号），前后各配半句动作。</b>' });
    }
    if (issues.length < 3 && !/(像|仿佛|好似|如同)/.test(P.join(''))) {
      issues.push({ dim: 'language', sev: 'low', title: '描写多靠形容词，缺少贴切的比喻',
        desc: '文中几乎没有比喻，"很美、很难忘"这类评价词撑不起画面，语言表现力打了折扣。',
        ex: '建议：<b>给最重要的物或人配一个来自生活的比喻，喻体最好带动作或磨损感。</b>' });
    }
    if (issues.length < 3) {
      const keyPara = P.reduce((a, b) => (b.length > (a || '').length ? b : a), '');
      issues.push({ dim: 'structure', sev: 'mid', title: '重点段可以再展开，详略不够分明',
        desc: `全文各段篇幅接近，最该细写的关键段（第 ${P.indexOf(keyPara) + 1} 段）没有明显放开，读者刚进入情境就过去了。`,
        quote: cut(keyPara, 26),
        fix: cut(keyPara, 26).replace(/[。！？]$/, '') + '，手腕一顿一顿的，额头的汗顺着皱纹往下淌。',
        ex: '建议：<b>把关键段扩成慢镜头：动作拆成三拍，补一处声音或触感，其余段落适当压缩。</b>' });
    }
    if (issues.length < 3) {
      issues.push({ dim: 'content', sev: 'low', title: '结尾收束偏快，余味不足',
        desc: '结尾把道理直接说了出来，缺少一个让读者自己回味的画面或实物落点。',
        quote: cut(last, 26),
        fix: cut(last, 26).replace(/我明白了|我懂得了|这就是|让我明白/g, '') || cut(last, 26),
        ex: '建议：<b>让开头出现过的物或景在结尾再出现一次，停在画面上，不解释。</b>' });
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
    /* 总评里不再点具体错字/错句，只保留"书写规范需留意"的整体提醒。
     * 具体订正统一放进「错别字汇总」，避免总评变成订正清单。 */
    const normLine = g.isHigh
      ? `规范书写上，到这个年级更该避免基础错别字与标点误用——这篇里若还有零星笔误，记得自己通读一遍纠正，这类失分最可惜。<br><br>`
      : `规范书写上，整体还算规整，个别标点与用字留意一下，写完自己通读一遍能纠正大部分。<br><br>`;
    t += normLine;
    t += `最后想对你说：写作不是"编一个好故事"，而是"把真的那一刻写清楚"。`;
    t += `你已经有了很好的开头和真诚的态度，接下来只要在<b>细节</b>和<b>克制</b>上下一点功夫，这篇文章完全有潜力再上一个等级。`;
    return t;
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ================= 右侧报告 ================= */
  function renderReport() {
    const d = activeDoc();
    const box = $('#reportScroll');
    $('#rpMeta').innerHTML = d ? `<span>${(GRADES.find(g => g.id === d.gradeId) || { name: '未选年级' }).name}</span><span>·</span><span>${genreById(d.genreId).name}</span><span>·</span><span>${d.status === 'done' ? '已批改' : '待批改'}</span>` : '等待批改';
    $('#aiBadge').textContent = d && d.result ? 'AI 批改完成' : 'AI 已就绪';
    if (!d) { box.innerHTML = emptyReport('还没有作文', '上传作文图片并点击「一键批改」，<br>这里会生成完整的批改报告。'); return; }
    if (!d.result) {
      const g = GRADES.find(x => x.id === d.gradeId) || { name: '未选年级', label: '—', total: 100 };
      const ge = genreById(d.genreId);
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
        <div class="demo-title">《${DEMO_TITLE}》</div>
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
      <div class="tabpane" data-pane="polish">${panePolish(R, g, d)}</div>`;

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

  /* 错别字汇总：只列「错字 → 正字」，不写原因、不写改法。
   * 数据来自批注里的 typo 配对（ERR_RULES 的 pair），没有就整块不显示。
   * 这样总评与「具体问题与修改思路」可以彻底不谈错别字，只保留一处清单。 */
  function typoCard(R) {
    const annos = (R && R.annos) || [];
    const pairs = [];
    const seen = new Set();
    annos.forEach(a => {
      const t = a && a.typo;
      if (!t || !t.wrong || !t.right) return;
      const key = t.wrong + '>' + t.right;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push(t);
    });
    if (!pairs.length) return '';
    return `<div class="card">
      <div class="card-h"><span class="ic" style="background:#fdeeee;color:#e2554f">✎</span>错别字汇总<span class="cnt">${pairs.length} 处</span></div>
      <div class="typo-list">
        ${pairs.map(t => `<span class="typo-item"><s>${esc(t.wrong)}</s><i>→</i><b>${esc(t.right)}</b></span>`).join('')}
      </div>
    </div>`;
  }

  function emptyReport(t, p) {
    return `<div class="rp-empty">
      <div class="cir"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a9abf2" stroke-width="1.6" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
      <h4>${t}</h4><p>${p}</p></div>`;
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
    ${typoCard(R)}
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
      <div class="card-h"><span class="ic" style="background:#eeeefc;color:#5b5ce2">✓</span>具体问题与修改思路
        <span class="cnt">${fixes.length} 处</span></div>
      <div class="pn-sub2">针对本篇最值得优先处理的问题，每条给出可落地的改法。</div>
      ${fixes.map((f, i) => `<div class="pn-fix">
        <div class="pn-fix-h"><span class="pf-n">${i + 1}</span>${esc(f.t)}</div>
        ${f.d ? `<div class="pn-fix-sec">
          <div class="pf-lb lb-issue">问题在哪</div>
          <div class="pn-fix-d">${esc(f.d)}</div>
        </div>` : ''}
        <div class="pn-fix-sec">
          <div class="pf-lb lb-how">怎么做</div>
          <div class="pn-fix-steps">
            ${f.steps.map((x, k) => `<div class="pn-step"><span class="ps-n">${k + 1}</span><span>${esc(x)}</span></div>`).join('')}
          </div>
        </div>
        ${f.fix ? `<div class="pn-fix-sec">
          <div class="pf-lb lb-demo">改后例句</div>
          <div class="pf-fix">${esc(f.fix)}</div>
        </div>` : ''}
      </div>`).join('')}
    </div>` : ''}`;
  }

  /* ============ Tab3：小练笔（通用写作能力训练） ============ */
  function paneDrill(R, g) {
    const P = R.essay.paras || [];
    const drills = buildDrills(R, P, g);

    return `<div class="drill-intro">按本篇暴露的短板，为你挑了 ${drills.length} 个<b>通用练笔专题</b>——内容与原文无关，练的是走到哪都用得上的写作基本功。素材可以抄进积累本。</div>
    <div class="drill-list">
      ${drills.map((b, i) => `<div class="drill-card">
        <div class="dc-head">
          <span class="dc-n">${i + 1}</span>
          <span class="dc-t">${esc(b.key)}<em>· ${esc(b.focus)}</em></span>
        </div>
        <div class="dc-row dc-prob"><span class="dc-k">练什么</span><span class="dc-v">${esc(b.issue)}</span></div>
        <div class="dc-row dc-idea"><span class="dc-k">怎么写</span><span class="dc-v">${esc(b.idea)}</span></div>
        <div class="dc-mat">
          <span class="dc-k">素材积累</span>
          <ul>${(b.materials || []).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
        </div>
        <div class="dc-task"><span class="dc-k">练笔任务</span><span>${esc(b.task || '')}</span></div>
      </div>`).join('')}
    </div>
    <div class="upgrade-tip">每次练笔 80~150 字即可，贵在坚持：一周练两个专题，把素材本上的句子用进自己的作文里，能力就长在身上了。</div>`;
  }

  /* ============ Tab4：润色后文章 ============ */
  /* 演示稿 <m1>~<m4> 标记 → 与真实稿完全相同的 marks 结构，
   * 这样两条路径共用同一个 highlightPara，彩色片段的字体、颜色、
   * 底色与字重不可能再出现差异。 */
  function demoMarksOf(paras) {
    const out = [];
    paras.forEach((raw, pi) => {
      const s = String(raw == null ? '' : raw);
      const re = /<m([1-4])>([^<]*)<\/m\1>/g;
      let m;
      let plain = '';
      let cursor = 0;
      while ((m = re.exec(s))) {
        plain += s.slice(cursor, m.index);
        const st = plain.length;
        plain += m[2];
        out.push({ para: pi, start: st, end: plain.length, key: ({ '1': 'action', '2': 'sense', '3': 'rhetoric', '4': 'theme' })[m[1]] || 'detail' });
        cursor = m.index + m[0].length;
      }
      plain += s.slice(cursor);
    });
    return out;
  }

  /* ============ 润色手法四类标记（与参考版式一致，界面与导出共用） ============ */
  const TECH_MARKS = [
    { key: 'action',   alias: 'm1', name: '动作 / 细节描写', color: '#b3541e', bg: 'rgba(214,138,74,.18)' },
    { key: 'sense',    alias: 'm2', name: '感官描写',        color: '#1f6f8b', bg: 'rgba(76,158,182,.16)' },
    { key: 'rhetoric', alias: 'm3', name: '修辞手法',        color: '#7a4fa8', bg: 'rgba(139,110,192,.16)' },
    { key: 'theme',    alias: 'm4', name: '议论改叙述 / 点题', color: '#2f7d5c', bg: 'rgba(72,150,116,.16)' }
  ];
  const techMarkOf = k => TECH_MARKS.find(t => t.key === k || t.alias === k) || null;
  const stripTechMarks = t => String(t == null ? '' : t).replace(/<\/?m[1-4]>/g, '');

  /* 润色稿分段规整（界面与导出共用同一函数，保证两边一致）：
   * ① 首段只是重复标题（AI 常把题目当成第一段返回）→ 整段删除，只留居中题目；
   * ② 段首带「标题。」→ 剥掉题目这截，保留后面的正文；
   * ③ 段内相邻重复句（"可一旦这种沉迷变成常态，危险便会悄然降临。"连写两遍）→ 删掉重复的那一句；
   * ④ 跨段重复的段首句 / 整段重复 → 后者删掉，避免同一句在文中出现两次。
   * 去重只认"完全相同"的句子（忽略空白与标点差异），不动任何改写内容。 */
  const bareTitle = t => String(t == null ? '' : t).replace(/[\s《》「」“”\"'‘’：:，,。！？；、·|—]/g, '');

  /* 按句切分，保留句末标点，便于逐句比对 */
  function splitSentences(text) {
    const raw = String(text == null ? '' : text);
    const out = [];
    let buf = '';
    for (let i = 0; i < raw.length; i++) {
      buf += raw[i];
      if (/[。！？…!?]/.test(raw[i])) { if (buf.trim()) out.push(buf.trim()); buf = ''; }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  /* 句子归一：去掉空白与标点，只比"字面内容" */
  const sentKey = s => String(s).replace(/[\s，。！？…、；：""''（）《》\-—·|,.;:!?"'()]/g, '');

  /* 按标点切小句（分号也算边界）：模型把"半句"连写两遍时，按句切不开 */
  function splitClauses(text) {
    const raw = String(text == null ? '' : text);
    const out = [];
    let buf = '';
    for (let i = 0; i < raw.length; i++) {
      buf += raw[i];
      if (/[。！？；…!?;]/.test(raw[i])) { if (buf.trim()) out.push(buf.trim()); buf = ''; }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  /* 段内去重：删掉"完全相同"的重复小句。
   * 判重键 = 去掉标点空白后的字面内容，且长度 ≥10 字——
   * 短句重复可能是刻意的复沓/排比（"盼望着，盼望着"），不动；
   * 长句完全重复一定是模型写重了，删掉第二次出现。 */
  /* 段内去重：两档判定，避免误伤刻意的复沓（如「盼望着，盼望着」）。
   * ① 整句重复（按 。！？ 切分）：完全相同且 ≥6 字 → 删掉后出现的那句。
   * ② 长分句重复（按 。！？； 切分）：完全相同且 ≥10 字 → 删掉后出现的那截。
   * 两层都不碰"同一句之内用逗号重复的短语"——那通常是修辞而非错误。 */
  function dedupeSentences(text) {
    const raw = String(text == null ? '' : text);
    const sents = splitSentences(raw);            // 只按 。！？ 切
    let out = raw, changed = false;

    if (sents.length > 1) {
      const seen = new Set();
      const kept = [];
      sents.forEach(x => {
        const k = sentKey(x);
        if (k.length >= 6 && seen.has(k)) { changed = true; return; }
        if (k) seen.add(k);
        kept.push(x);
      });
      if (changed) out = kept.join('');
    }

    /* ② 同一句内、用逗号/句号隔开的"尾部分句"重复：
     *    如「…叶缘卷起来一点。叶缘卷起来一点。」
     *    只在"重复分句之前已经有一长段内容"时才删——这时后一截纯属抄重；
     *    而「盼望着，盼望着」整句都在重复、前面没有实质内容，属于修辞，保留。 */
    const segs = out.split(/(?<=[，,。])/).filter(x => x.trim());
    if (segs.length > 1) {
      const seenS = new Set();
      const keptS = [];
      let hitS = false;
      let contentLen = 0;      // 已保留的实质内容长度
      segs.forEach(x => {
        const k = sentKey(x);
        if (k && contentLen >= 12 && seenS.has(k)) { hitS = true; return; }
        if (k) seenS.add(k);
        contentLen += k.length;
        keptS.push(x);
      });
      if (hitS) { out = keptS.join(''); changed = true; }
    }

    /* ③ 再按分号检查长分句重复（跨句重复之外，还可能有"分号连接的半句"重复） */
    const clauses = splitClauses(out);
    if (clauses.length > 1) {
      const seen2 = new Set();
      const kept2 = [];
      let hit2 = false;
      clauses.forEach(c => {
        const k = sentKey(c);
        if (k.length >= 10 && seen2.has(k)) { hit2 = true; return; }
        if (k) seen2.add(k);
        kept2.push(c);
      });
      if (hit2) { out = kept2.join(''); changed = true; }
    }
    return changed ? out : raw;
  }

  function normalizePolishedParas(list, title) {
    let out = (Array.isArray(list) ? list : [])
      .map(x => String(x == null ? '' : x).trim()).filter(Boolean);

    /* ③ 先做段内相邻重复句清理：与标题无关，任何稿子都适用 */
    out = out.map(t => dedupeSentences(t)).filter(Boolean);

    const T = bareTitle(title);
    if (T) {
      /* ① 整段就是题目：直接删 */
      while (out.length && bareTitle(out[0]) === T) out = out.slice(1);
      /* ② 段首是题目：只剥掉题目这一截 */
      if (out.length) {
        const raw = out[0];
        if (bareTitle(raw).indexOf(T) === 0) {
          let i = 0, kept = 0;
          while (i < raw.length && kept < T.length) {
            if (bareTitle(raw[i]) !== '') kept++;
            i++;
          }
          while (i < raw.length && /[\s《》「」“”\"'‘’：:，,。！？；、·|—]/.test(raw[i])) i++;
          const rest = raw.slice(i).trim();
          if (rest) out[0] = rest; else out = out.slice(1);
        }
      }
    }

    /* ④ 跨段去重：
     * a) 整段重复 → 保留第一次出现的那段；
     * b) 后一段的段首句与前文任一句完全相同 → 删掉这个重复的段首句。
     * 只处理"完全相同"的句子，改写过的不受影响。 */
    const seenSent = new Set();
    const seenPara = new Set();
    const result = [];
    for (const para of out) {
      const pk = sentKey(para);
      if (pk && seenPara.has(pk)) continue;          // 整段重复
      if (pk) seenPara.add(pk);

      let sents = splitClauses(para);
      // 段首小句与已出现过的完全相同 → 去掉
      while (sents.length > 1 && seenSent.has(sentKey(sents[0])) && sentKey(sents[0]).length >= REPEAT_MIN) {
        sents = sents.slice(1);
      }
      const rest = sents.join('');
      if (!rest.trim()) continue;
      sents.forEach(x => { const k = sentKey(x); if (k) seenSent.add(k); });
      result.push(rest.trim());
    }
    return result;
  }

  function panePolish(R, g, d) {
    const P = R.essay.paras.filter(x => x && String(x).trim().length > 2);
    const title = R.essay.title || '未命名';
    const isDemo = !!(d && d.isDemo && typeof DEMO_POLISHED !== 'undefined');

    let bodyParas, techList, marks, words, inRange;
    if (isDemo) {
      // 演示稿：与参考版式逐字一致的润色稿，标记转成统一 marks
      bodyParas = DEMO_POLISHED.slice();
      marks = demoMarksOf(bodyParas);
      bodyParas = bodyParas.map(t => stripTechMarks(t));
      techList = DEMO_TECHNIQUES.slice();
      words = bodyParas.join('').replace(/\s/g, '').length;
      const rg = (g && g.range) || [450, 550];
      inRange = words >= rg[0] && words <= rg[1];
    } else {
      // 真实稿：同一个润色器 + 同一份变更记录（与导出一致）
      const trace = [];
      const polished = buildPolished(R, P, trace);
      marks = (trace && trace.marks) || [];
      bodyParas = normalizePolishedParas(polished, title);
      // 标题行被删掉后，marks 的段号要整体前移，否则彩块会落到别的段上
      const shift = polished.length - bodyParas.length;
      if (shift > 0) marks = marks.map(m => ({ ...m, para: m.para - shift })).filter(m => m.para >= 0);
      const notes = buildPolishNotes(trace, P, polished);
      words = bodyParas.join('').replace(/\s/g, '').length;
      const rg = (g && g.range) || [0, 99999];
      inRange = words >= rg[0] && words <= rg[1];
      /* 手法说明落到本文真实例句（与例图一致：手法名 + 具体改了什么），
       * 不再用"新增比喻与拟人"这类通用话术；detail 类不上手法清单 */
      const techDesc = {
        rhetoric: (items) => '运用比喻修辞，' + items.slice(0, 2).map(x => '「' + String(x).replace(/[。！？；]$/, '').slice(0, 24) + '」').join('、') + '，让抽象的感受变成可看的画面',
        sense: (items) => '补进声音与触感，' + items.slice(0, 2).map(x => '「' + String(x).replace(/[。！？；]$/, '').slice(0, 24) + '」').join('、') + '，让场景可听可感',
        action: (items) => '补充动作细节，' + items.slice(0, 2).map(x => '「' + String(x).replace(/[。！？；]$/, '').slice(0, 24) + '」').join('、') + '，人物形象更具体可感',
        theme: (items) => '把空泛的议论改成具体落点，' + items.slice(0, 2).map(x => '「' + String(x).replace(/[。！？；]$/, '').slice(0, 24) + '」').join('、') + '，结尾照应前文不喊口号'
      };
      techList = notes.filter(n => techDesc[n.key]).map(n => ({
        mark: n.key,
        text: techDesc[n.key]((n.items || []).map(x => x.text || x))
      }));
    }

    /* 唯一的彩色片段渲染：两条路径共用 */
    const paraHTML = (text, pi) => {
      const raw = String(text || '');
      const list = marks.filter(m => m.para === pi).sort((a, b) => a.start - b.start);
      if (!list.length) return esc(raw);
      let out = '', cursor = 0;
      list.forEach(m => {
        const st = Math.max(cursor, Math.min(raw.length, m.start));
        const en = Math.max(st, Math.min(raw.length, m.end));
        if (en <= st) return;
        if (st > cursor) out += esc(raw.slice(cursor, st));
        /* 只有四类手法上色，与演示稿完全一致；detail 类属"通用补写"，
         * 不上色、保持正文原样，避免真实稿多出灰块而演示稿没有。 */
        const rmk = techMarkOf(m.key);
        out += rmk
          ? `<span class="tech-span" style="--c:${rmk.color}">${esc(raw.slice(st, en))}</span>`
          : esc(raw.slice(st, en));
        cursor = en;
      });
      if (cursor < raw.length) out += esc(raw.slice(cursor));
      return out;
    };

    const techHTML = techList.length ? `<div class="tech-blk">
      <div class="tech-head"><h4>本次使用的润色手法</h4><i></i>
        <span class="tech-meta">${techList.length} 条 · 对照原文查看改动</span></div>
      <ul class="tech-list">
        ${techList.map(t => {
          const mk = techMarkOf(t.mark);
          const label = mk ? `<b class="tech-key" style="--c:${mk.color}">${esc(mk.name)}</b>` : '';
          return `<li${mk ? ` style="--c:${mk.color}"` : ''}>${label}<span>${esc(t.text)}</span></li>`;
        }).join('')}
      </ul>
    </div>` : '';

    return `<div class="card">
      <div class="card-h"><span class="ic" style="background:#f3ecfd;color:#8b5cf6">✎</span>润色后文章
        <span class="cnt">${words} 字 · ${g.name}要求 ${g.label || ''}</span></div>
      <div class="polish-paper">
        ${title ? `<div class="pp-title">${esc(title)}</div>` : ''}
        ${bodyParas.map((t, pi) => `<p>${paraHTML(t, pi)}</p>`).join('')}
      </div>
      <div class="range-note${inRange ? '' : ' warn'}">${inRange ? '字数落在本年级区间内' : '字数偏离本年级要求区间，建议增删细节后重试'}</div>
      ${techHTML}
    </div>`;
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
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    // 含路径等需要看清的提示可传更长的显示时间
    toastTimer = setTimeout(() => t.classList.remove('on'), ms || 2200);
  }

  // 启动/重置为演示作文：白板显示《外婆的蒲扇》，带四色批注框，但报告未生成
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

    // 逐句对应 DEMO_LINES 的行号（0 起，连续成段排版共 19 行，段首行 [0,4,8,12,16]）
    const items = [
      { row: 0, type: 'good', side: 'left',
        quote: '扇面黄黄的，边上磨出了毛',
        html: '<b>“扇面黄黄的，边上磨出了毛，扇柄被手磨得发亮”</b>开篇不写「外婆爱我」，先给一把有年头的扇子——物件一出场，感情就有了落点。<u>这个写法请保留</u>。' },
      { row: 3, type: 'dele', side: 'right',
        quote: '我曾以为，那把扇子早就该扔了',
        html: '<b>“我曾以为，那把扇子早就该扔了”</b>这个「嫌弃」埋得好，是后文读懂的伏笔；但「电风扇比它凉快多了」偏解释，<u>可删去后半句</u>，让嫌弃停在态度上。' },
      { row: 6, type: 'polish', side: 'left',
        quote: '她说，外婆不怕热',
        html: '<b>“她说，外婆不怕热”</b>是全文最动人的一句原话——嘴上说不热，汗却说了实话。<u>请保留原话</u>，不要转述成「她说不热」。' },
      { row: 7, type: 'polish', side: 'right',
        quote: '看见她还在扇，额头上全是汗',
        html: '<b>“看见她还在扇”</b>是题眼，却一句带过。把「还在扇」拆开：<b>“手腕一顿一顿的，汗顺着皱纹往下淌”</b>，画面就立住了。' },
      { row: 11, type: 'err', side: 'left',
        quote: '那天夜里我很感动',
        html: '<b>“我很感动”</b>在直接说结果，读者接收不到画面。换成身体反应：<b>“我盯着墙上那团扇影，鼻子忽然一酸”</b>。' },
      { row: 14, type: 'good', side: 'right',
        quote: '只是把扇子上的灰擦了又擦',
        html: '<b>“把扇子上的灰擦了又擦”</b>被拒绝后不辩解、只擦灰，一个动作写尽了外婆的委屈与不舍，<u>细节胜过千言</u>。' },
      { row: 18, type: 'dele', side: 'left',
        quote: '我明白了，爱就是这样一代一代传下来的',
        html: '<b>“我明白了，爱就是这样一代一代传下来的”</b>偏口号，与前文叙述脱节，<u>可删去</u>——回到蒲扇或皂角味收束，把道理留给读者。' }
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
    // 四维评分展开/收起：与「AI 部署」保持一致的动效——
    // 展开后自动平滑滚动，让内容完整进入可视区，而不是停在半截需要手滑
    collapse.querySelector('.ch').onclick = () => {
      const willOpen = !collapse.classList.contains('open');
      collapse.classList.toggle('open');
      if (willOpen) {
        setTimeout(() => {
          const sc = document.querySelector('.side-scroll');
          if (!sc) return;
          // 用 rect 差值算相对滚动容器的偏移，比 offsetTop 可靠
          // （offsetTop 参照的是最近的定位祖先，未必是滚动容器）
          const scRect = sc.getBoundingClientRect();
          const cRect = collapse.getBoundingClientRect();
          const target = sc.scrollTop + (cRect.top - scRect.top) - 8;
          const maxTop = Math.max(0, sc.scrollHeight - sc.clientHeight);
          sc.scrollTo({ top: Math.max(0, Math.min(target, maxTop)), behavior: 'smooth' });
        }, 90);
      }
    };
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
        /* 姓名变化会影响画板标题（未批改时）与报告里的姓名区，
         * 两边都要跟着刷新，否则会出现"标签改了、报告还是旧名"。 */
        renderTabs();
        renderCanvas();
        renderReport();
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
        // 滚轮横向滚动：普通鼠标只有 deltaY，触摸板常同时给出 deltaX。
        // 早期只判 deltaY > deltaX，触摸板横向手势会被漏掉，表现为「标签看得见却滚不过去」。
        const dx = e.deltaX || 0, dy = e.deltaY || 0;
        if (!dx && !dy) return;
        // 以纵向为主时把纵向折算成横向；横向手势（含 shift+滚轮）直接用 deltaX
        const move = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        if (!move) return;
        ft.scrollBy({ left: move, behavior: 'auto' });
        e.preventDefault();
      }, { passive: false });

      // 新增/切换标签后把目标标签滚进可视区，避免新标签落在容器外看不见、
      // 连叉号都没机会点到（此前只在 renderTabs 里对 .ftab.on 做 nearest 滚动）。
      const keepVisible = () => {
        const on = ft.querySelector('.ftab.on');
        if (!on) return;
        const fr = ft.getBoundingClientRect();
        const r = on.getBoundingClientRect();
        if (r.left < fr.left) ft.scrollBy({ left: r.left - fr.left - 8, behavior: 'auto' });
        else if (r.right > fr.right) ft.scrollBy({ left: r.right - fr.right + 8, behavior: 'auto' });
      };
      new MutationObserver(keepVisible).observe(ft, { childList: true, subtree: true });
    }

    /* 导出文件名：只用「学生姓名-作文题目」，不冠软件名。
     * 姓名取左侧「学生姓名」输入框（即 d.note），题目取批改结果的标题；
     * 任何一段缺失就只留另一段，两段都没有才用兜底名。 */
    const exportBaseName = (d, o) => {
      const clean = v => String(v == null ? '' : v)
        .replace(/[\/:*?"<>|\s]+/g, '').trim();
      const stu = clean((d && d.note) || (o && o.stu) || '');
      // 没有题目就写「无标题作文」，不留空档
      const title = clean((o && o.title) || (d && d.name) || '') || '无标题作文';
      // 学生姓名-作文题目-批改报告（姓名没有就省略，题目没有写「无标题作文」）
      const name = (stu ? stu + '-' : '') + title + '-批改报告';
      return name.slice(0, 60);
    };

    // 缩放
    const setZoom = z => { state.zoom = Math.min(1.4, Math.max(0.6, z)); renderCanvas(); };
    $('#toolZoomIn').onclick = () => setZoom(state.zoom + 0.1);
    $('#toolZoomOut').onclick = () => setZoom(state.zoom - 0.1);
    const doExport = async () => {
      const d = activeDoc();
      if (!d || !d.result) { toast('请先完成批改再导出'); return; }
      if (!window.ZPEXPORT) { toast('导出组件未加载'); return; }
      if (state.exporting) { toast('正在生成，请稍候'); return; }
      const btn = $('#btnExportHTML');
      const label = btn ? btn.querySelector('span') : null;
      const oldText = label ? label.textContent : '';
      const wasBusy = btn ? btn.classList.contains('busy') : false;
      state.exporting = true;
      if (btn) { btn.disabled = true; btn.classList.add('busy'); }
      try {
        const o = buildExportData(d);
        const suggest = exportBaseName(d, o);
        if (window.ZPNATIVE && window.ZPNATIVE.saveHTML) {
          // 桌面版：弹「保存到」对话框，用户自选位置后写盘；取消则静默结束
          const html = window.ZPEXPORT.buildDocument(o);
          const res = await window.ZPNATIVE.saveHTML(html, suggest);
          if (res && res.canceled) return;
          if (label) label.textContent = '已保存';
          toast('HTML 已保存：' + (res.fileName || ''), 3600);
          await wait(900);
        } else {
          // 网页版兜底：浏览器下载（无法自选位置，落到默认下载目录）
          if (label) label.textContent = '生成中';
          window.ZPEXPORT.exportHTML(o);
          toast('HTML 已开始下载');
          if (label) label.textContent = '已完成';
          await wait(700);
        }
      } catch (e) {
        console.error(e);
        toast('导出失败：' + (e.message || '未知错误'));
      } finally {
        state.exporting = false;
        if (label) label.textContent = oldText;
        if (btn) { btn.disabled = false; btn.classList.toggle('busy', wasBusy); }
      }
    };
    const _hb = $('#btnExportHTML'); if (_hb) _hb.onclick = () => doExport();

    /* ===== PDF · 一键导出 =====
     * 桌面版：点击 → 原生「保存到」对话框 → 选位置保存 → 后台排版写盘 → 提示已保存，
     * 全程无打印界面。网页版：离屏排版后走浏览器打印管线（目标选"另存为 PDF"）。 */
    const doExportPDF = async () => {
      const d = activeDoc();
      if (!d || !d.result) { toast('请先完成批改再导出'); return; }
      if (!window.ZPEXPORT) { toast('导出组件未加载'); return; }
      if (state.exporting) { toast('正在生成，请稍候'); return; }
      const btn = $('#btnExportPDF');
      const label = btn ? btn.querySelector('span') : null;
      const oldText = label ? label.textContent : '';
      state.exporting = true;
      if (btn) { btn.disabled = true; btn.classList.add('busy'); }
      try {
        const o = buildExportData(d);
        if (window.ZPNATIVE && window.ZPNATIVE.hasPDF) {
          const html = window.ZPEXPORT.buildDocument(o);
          const suggest = exportBaseName(d, o);
          // 保存对话框在原生侧弹出；用户取消时返回 canceled，静默结束
          const res = await window.ZPNATIVE.exportPDF(html, suggest);
          if (res && res.canceled) return;
          if (label) label.textContent = '已保存';
          toast('PDF 已保存：' + (res.fileName || ''), 3600);
          await wait(900);
        } else {
          // 网页版：排版就绪后调浏览器打印（目标选「另存为 PDF」）
          if (label) label.textContent = '排版中';
          toast('正在排版，稍后请在打印窗口选择「另存为 PDF」', 4200);
          await window.ZPEXPORT.exportPDFWeb(o);
          if (label) label.textContent = '已发送';
          await wait(900);
        }
      } catch (e) {
        console.error(e);
        toast('PDF 导出失败：' + (e.message || '未知错误'), 3200);
      } finally {
        state.exporting = false;
        if (btn) btn.disabled = false;
        if (btn) btn.classList.remove('busy');
        if (label) label.textContent = oldText;
      }
    };
    const _pb = $('#btnExportPDF');
    if (_pb) _pb.onclick = () => doExportPDF();

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
        write(c); refreshBadge(); syncDemoUI(); syncGradeButtons(); toast('AI 接口配置已保存，可以开始批改了');
      };
      $('#adTest').onclick = async () => {
        const base = $('#adBase').value.trim(), key = $('#adKey').value.trim(), model = $('#adModel').value.trim();
        if (!base || !key) return toast('请先填写接口地址与 API Key');
        if (!model) return toast('请填写模型名称，例如 doubao-2.1-turbo');
        const btn = $('#adTest');
        const oldTxt = btn.textContent;
        btn.disabled = true; btn.textContent = '测试中…';
        try {
          // 用一次最小的 chat/completions 请求做真实探测。
          // 火山方舟 / 通义 / 智谱等并不都提供 /models 端点，拿它测试会误报失败。
          const r = await window.ZPAI.testConnection({
            base, key, model,
            thinking: (() => { const on = document.querySelector('.mode-btn.on'); return on && on.dataset.mode === 'quality'; })(),
            temperature: 0.1
          });
          if (r.ok) toast(`连接成功 · 模型可用（${r.ms}ms）`);
          else toast('连接失败：' + r.reason);
        } catch (e) {
          toast('连接失败：' + (e.message || '网络错误'));
        } finally {
          btn.disabled = false; btn.textContent = oldTxt;
        }
      };
      $('#adLocalSave').onclick = () => {
        const base = $('#adLocalBase').value.trim(), model = $('#adLocalModel').value.trim();
        if (!base || !model) return toast('请填写本地地址与模型名称');
        const c = read();
        c.mode = 'local';
        c.local = { engine: $('#adEngine').value, base, model };
        write(c); refreshBadge(); syncDemoUI(); syncGradeButtons(); toast('本地部署配置已保存，可以开始批改了');
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
      if (!sc) return;
      // 用 rect 差值算相对滚动容器的偏移：.side 不是定位元素，
      // box.offsetTop 参照的是更外层祖先，直接拿它当 scrollTop 会跳错位置。
      const scRect = sc.getBoundingClientRect();
      const bRect = box.getBoundingClientRect();
      const target = sc.scrollTop + (bRect.top - scRect.top) - 8;
      const maxTop = Math.max(0, sc.scrollHeight - sc.clientHeight);
      // 用即时滚动而非 smooth：面板刚展开时高度还在变，平滑动画易被打断；
      // 且部分环境下（离屏/禁用硬件加速）smooth 动画不推进，会停在原处。
      sc.scrollTo({ top: Math.max(0, Math.min(target, maxTop)), behavior: 'instant' });
      // 同时聚焦第一个待填字段，用户不用再自己找输入框
      const first = $('#adBase');
      if (first && !first.value && !window.ZPAI?.mode()) {
        try { first.focus({ preventScroll: true }); } catch (e) {}
      }
    }, 60);
    // 高亮提示
    box.style.boxShadow = '0 0 0 3px rgba(91,92,226,.18)';
    setTimeout(() => { box.style.boxShadow = ''; }, 1800);
  }


  /* AI 润色稿 vs 原文的差异归纳，用于生成"本次润色说明"
   * 要点：说明必须落到「具体扩充了什么」，不能只写“补充细节”“写身体反应”。
   * 做法：逐段做最长公共子序列比对，把真正新增的短句/短语提取出来，
   * 再按它属于感官、动作、比喻、点题哪一类归档，供报告逐条展示。 */
  function enrichTraceFromDiff(trace, origP, newP) {
    if (!trace) return trace;
    const cnt = x => String(x || '').replace(/\s/g, '').length;
    const o = origP.map(x => String(x || '')).join('');
    const n = newP.map(x => String(x || '')).join('');

    /* 返回新增片段及其在【润色稿该段】中的下标区间 {text,start,end}。
     * 先取公共前缀 p 与公共后缀 s，中间即新增；再把首尾标点空白剥掉，
     * 同时把下标前移，保证高亮正好贴住文字、不染逗号句号。 */
    const addedSpan = (a, b) => {
      a = String(a || ''); b = String(b || '');
      if (!b) return null;
      let p = 0;
      const max = Math.min(a.length, b.length);
      while (p < max && a[p] === b[p]) p++;
      let s = 0;
      while (s < max - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
      let st = p, en = b.length - s;
      /* 后缀比对是按字符逐个回溯的，遇到「…跃上来。|…跃上。」这类句子，
       * 会把共有的「来」当成重叠部分剥掉，导致句子末尾缺字。
       * 这里若剥离点落在句中（后面还有字），说明断在了词中间，
       * 就把终点恢复到该句真正的句末标点位置。 */
      if (en < b.length && /[^。！？；!?;]/.test(b[en] || '')) {
        const rest = b.slice(en).search(/[。！？；!?;]/);
        if (rest >= 0) en = en + rest + 1;
      }
      const PUNC = '，。；、！？：""\'\'（）《》…—- \t';
      while (st < en && PUNC.indexOf(b[st]) >= 0) st++;
      while (en > st && PUNC.indexOf(b[en - 1]) >= 0) en--;
      /* 收尾时若从虚词开始（的/了/着/地/得），说明断在了词中间，
       * 例如「那天|的风软乎乎的」。把起始点前移到该分句开头，避免断头。 */
      const DANGLING = '的了着地得而并就都也还又很最更';
      if (st < en && DANGLING.indexOf(b[st]) >= 0) {
        let back = st;
        while (back > 0 && PUNC.indexOf(b[back - 1]) < 0) back--;
        st = back;
      }
      if (en - st < 2) return null;
      return { text: b.slice(st, en), start: st, end: en };
    };

    /* 归类：比喻优先于动作，动作优先于感官；
     * 点题信号（明白/原来/精神/勇气类总结）优先于动作，
     * 否则"我要学习武松打虎的精神"会因含"打"被误归动作类。 */
    const classify = (t) => {
      if (/(像|仿佛|好似|如同).{2,}/.test(t)) return 'rhetoric';
      if (/(我明白了|我懂得了|原来|终于明白|才明白|才知道|至今|每次看见|我要学习|的精神|真正的|勇敢地面|迎难而上)/.test(t)) return 'theme';
      if (/(攥|搓|擦|拢|抹|掀|垂|缩|倾|撑|勾|托|跺|鼓|屏|蹭|踩|捻|捋|捏|抓|跑|走|站|坐|抬|低|举|伸|按|拍|摇|摆|甩|弯|蹲|趴|扑|拽|拎|捧|抚|挠|踢|跨|迈|敲|深吸|舒展|渗)/.test(t)) return 'action';
      if (/(听见|闻到|摸到|尝到|凉|暖|烫|冷|响|香|光|影|粗糙|软|味|气息|青草|阳光|心跳|咚咚|沙沙|喧闹)/.test(t)) return 'sense';
      return 'detail';
    };

    const buckets = { rhetoric: [], sense: [], action: [], theme: [], detail: [] };
    /* marks 供正文上色，para 为 0 基下标，与 polished 数组一致 */
    const marks = [];
    const seen = new Set();
    const paraN = Math.max(origP.length, newP.length);

    /* 逐段找新增区域，按句切开、逐句归类 —— 但**不是每句都上色**。
     * 参考版式的观感：整篇黑字为主，只有几句关键改写带颜色。
     * 之前把 diff 出的所有句子全涂色，AI 大改时整篇 90%+ 都是彩底，
     * 这里改为「候选打分 + 全文限额」：每段最多 2 句、全文最多 8 句、
     * 总着色不超过全文 30%，优先挑修辞/感官/点题这类有教学价值的句子。 */
    const candidates = [];
    for (let i = 0; i < paraN; i++) {
      const sp = addedSpan(origP[i] || '', newP[i] || '');
      if (!sp) continue;
      const raw = String(newP[i] || '');
      const segText = raw.slice(sp.start, sp.end);
      if (!segText) continue;

      /* 句子切分：保留标点，句末标点归到该句 */
      const sents = [];
      let buf = '', bufStart = 0;
      for (let k = 0; k < segText.length; k++) {
        const ch = segText[k];
        buf += ch;
        if (/[。！？；!?;]/.test(ch)) {
          const t = buf.trim();
          if (t.length >= 6) sents.push({ text: t, start: sp.start + bufStart, end: sp.start + k + 1 });
          buf = '';
          bufStart = k + 1;
        }
      }
      const tail = buf.trim();
      if (tail.length >= 6) sents.push({ text: tail, start: sp.start + bufStart, end: sp.start + segText.length });

      sents.forEach(sn => {
        const dk = i + '|' + sn.text.slice(0, 12);
        if (seen.has(dk)) return;
        seen.add(dk);
        const key = classify(sn.text);
        const len = sn.text.replace(/\s/g, '').length;
        /* 打分：类别教学价值 > 句长适中 > 带具体细节；太长的整句复述降权 */
        let score = ({ rhetoric: 5, sense: 4, theme: 4, action: 3, detail: 1 })[key] || 1;
        if (len >= 10 && len <= 42) score += 2;
        else if (len > 60) score -= 3;
        if (/(像|仿佛|如同)/.test(sn.text)) score += 1;
        candidates.push({ para: i, start: sn.start, end: sn.end, key, text: sn.text, score, len });
      });
    }

    /* 全文限额挑选：**先保证四类手法各占一席**（动作/感官/修辞/点题），
     * 再按分数补满。之前纯按分数排，修辞/感官分高就占满名额，
     * 报告里只剩两类手法，与"各种润色都有"的预期不符。
     * 限额：每段最多 2 句、全文最多 8 句、总着色 ≤30%。 */
    const totalLen = newP.join('').replace(/\s/g, '').length || 1;
    const maxLen = Math.floor(totalLen * 0.3);
    const perPara = {};
    let usedLen = 0, usedCnt = 0;
    const picked = [];
    const take = (c) => {
      picked.push(c);
      perPara[c.para] = (perPara[c.para] || 0) + 1;
      usedLen += c.len; usedCnt++;
    };
    const canTake = (c, strict) => {
      if (usedCnt >= 8) return false;
      if ((perPara[c.para] || 0) >= 2) return false;
      if (strict && usedLen + c.len > maxLen && picked.length >= 3) return false;
      return true;
    };
    /* 第一轮：每类挑分数最高的一句（类别轮转，放宽长度限额保证四类齐全） */
    const byScore = candidates.slice().sort((a, b) => b.score - a.score || a.para - b.para || a.start - b.start);
    const CATS = ['action', 'sense', 'rhetoric', 'theme'];
    const usedCat = new Set();
    for (const cat of CATS) {
      const c = byScore.find(x => x.key === cat && !picked.includes(x) && canTake(x, false));
      if (c) { take(c); usedCat.add(cat); }
    }
    /* detail 类只在四类没凑齐时补位（它教学价值最低） */
    if (usedCat.size < 3) {
      const c = byScore.find(x => x.key === 'detail' && !picked.includes(x) && canTake(x, false));
      if (c) take(c);
    }
    /* 第二轮：按分数补满剩余名额，恢复长度限额 */
    for (const c of byScore) {
      if (picked.includes(c)) continue;
      if (!canTake(c, true)) continue;
      take(c);
    }
    /* 兜底：一句都没挑出来但确有改动时，取分数最高的一句，保证图例不空 */
    if (!picked.length && candidates.length) picked.push(candidates[0]);
    picked.sort((a, b) => a.para - b.para || a.start - b.start);
    picked.forEach(c => {
      buckets[c.key].push({ text: c.text, para: c.para + 1 });
      marks.push({ para: c.para, start: c.start, end: c.end, key: c.key });
    });

    const push = (kind, list) => {
      if (!list.length) return;
      trace.push({ kind, list: list.map(x => x.text), paras: list.map(x => x.para) });
    };
    push('rhetoric', buckets.rhetoric);
    push('sense', buckets.sense);
    push('action', buckets.action);
    push('theme', buckets.theme);
    push('detail', buckets.detail);
    try { trace.marks = marks; } catch (e) {}

    // 情绪直述被改写：保留整体判断（没有可摘取的片段时也能说明）
    const feelRe = /(很|非常|特别|十分)(感动|难过|开心|高兴|紧张|害怕|生气|惭愧|温暖|失落)/;
    if (feelRe.test(o) && !feelRe.test(n)) trace.push({ kind: 'emotion', from: '直接说情绪', to: '写身体反应' });
    if (cnt(n) > cnt(o) * 1.1) trace.push({ kind: 'grow', from: String(cnt(o)), to: String(cnt(n)) });
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

  /* AI 润色稿 vs 原文的差异归纳，用于生成"本次润色说明"
   * 要点：说明必须落到「具体扩充了什么」，不能只写“补充细节”“写身体反应”。
   * 做法：逐段做最长公共子序列比对，把真正新增的短句/短语提取出来，
   * 再按它属于感官、动作、比喻、点题哪一类归档，供报告逐条展示。 */



  /* ================= 润色说明：本次改了什么 =================
   * 依据润色过程中的变更记录，归纳成可读的几条"润色手法"，
   * 每条 = 手法名称 + 具体做法 + 本文实例，供报告页展示。
   */
  function buildPolishNotes(trace, origP, newP) {
    const t = trace || [];
    const notes = [];
    const cnt = x => String(x || '').replace(/\s/g, '').length;
    const byKind = k => t.filter(x => x.kind === k);
    const flat = list => {
      const out = [];
      list.forEach(x => (x.list || []).forEach(v => { if (!out.includes(v)) out.push(v); }));
      return out;
    };
    /* 每条说明统一成：手法名 + 一句做法 + 本文具体扩了什么（带段号） */
    const add = (name, key, howto, list) => {
      if (!list.length) return;
      const show = list.slice(0, 3);
      notes.push({
        name,
        key,
        desc: howto,
        items: show.map(x => typeof x === 'string' ? { text: x, para: 0 } : x)
      });
    };

    /* ---------- 修辞手法 ---------- */
    const rh = flat(byKind('rhetoric'));
    const rhParas = (byKind('rhetoric')[0] || {}).paras || [];
    add('修辞手法', 'rhetoric',
      '新增比喻与拟人，把抽象的感受落成可看的画面。',
      rh.map((x, i) => ({ text: x, para: rhParas[i] || 0 })));

    /* ---------- 感官描写 ---------- */
    const sn = flat(byKind('sense'));
    const snParas = (byKind('sense')[0] || {}).paras || [];
    add('感官描写', 'sense',
      '加入温度、气味、声音、触感等感官信息，让场景从"看见"变成"在场"。',
      sn.map((x, i) => ({ text: x, para: snParas[i] || 0 })));

    /* ---------- 动作 / 细节描写 ---------- */
    const ac = flat(byKind('action'));
    const acParas = (byKind('action')[0] || {}).paras || [];
    add('动作 / 细节描写', 'action',
      '把笼统的动作拆成有过程的小动作，人物的反应因此具体、鲜活。',
      ac.map((x, i) => ({ text: x, para: acParas[i] || 0 })));

    /* ---------- 议论改叙述 / 点题 ---------- */
    const th = flat(byKind('theme'));
    const thParas = (byKind('theme')[0] || {}).paras || [];
    add('议论改叙述 / 点题', 'theme',
      '把空泛的抒情换成具体场景落点，让结尾与开头呼应，主题自然浮现。',
      th.map((x, i) => ({ text: x, para: thParas[i] || 0 })));


    const emo = byKind('emotion');
    if (emo.length) {
      notes.push({
        name: '情绪外化', key: 'emotion',
        desc: '把"很感动""很难过"这类概括说法换成身体反应，情绪看得见。',
        items: emo.slice(0, 2).map(x => ({ text: `「${x.from}」→「${x.to}」`, para: 0 }))
      });
    }
    const verb = byKind('verb');
    if (verb.length) {
      notes.push({
        name: '动作具体化', key: 'action',
        desc: '把笼统动词换成有画面感的小动作。',
        items: verb.slice(0, 2).map(x => ({ text: `「${x.from}」→「${x.to}」`, para: 0 }))
      });
    }
    const split = byKind('split');
    if (split.length) {
      notes.push({
        name: '长句断句', key: 'split',
        desc: '在转折处把长句拆成两句，朗读时能换气。',
        items: split.slice(0, 2).map(x => ({ text: `「${x.from}」→ 转折处断开`, para: 0 }))
      });
    }

    /* 篇幅变化单独说明增量去向，避免"扩充了细节"这类空话 */
    const origLen = cnt(origP.join(''));
    const newLen = cnt(newP.join(''));
    if (!notes.length) {
      notes.push({
        name: '语句润色', key: 'plain',
        desc: '在保留原意与叙事顺序的前提下，对用词和句子节奏做了整体打磨。',
        items: []
      });
    }
    return notes.slice(0, 6);
  }

  /* ================= 小练笔：通用写作能力训练 =================
   * 定位：不是改这篇作文，而是按本文暴露的短板类型，匹配"通用练笔专题"。
   * 每条 = 训练目标 + 写作思路（怎么想怎么写）+ 可积累素材 + 练笔任务，
   * 素材与例句均与原文无关，重在方法迁移与日常积累。
   * 结构：{ key, focus, why(练什么), idea(思路), materials(素材[]), task(任务) }
   */
  const DRILL_BANK = [
    { key: '人物细节描写', focus: '用特写镜头写活一个人',
      match: /动作|细节|概括|镜头|人物|画面/,
      why: '写人最怕"他很辛苦""她很温柔"这类概括。学会抓手部动作、习惯动作、职业痕迹，人物立刻站起来。',
      idea: '闭眼想一个熟悉的人：他坐下先动哪个部位？手上有什么洗不掉的东西？紧张时有什么小动作？选三个最有"这个人味儿"的细节，按"大动作→小动作→习惯动作"排列，中间不加形容词。',
      materials: [
        '他把袖口往上撸了两下，露出手腕上一道旧疤。',
        '奶奶数钱时先往指腹上啐一口，捻开，再对着光看一眼。',
        '爷爷看电视时脚趾在袜子里一下一下地动，像在打拍子。',
        '修车的师傅擦手，总是先搓指缝，再抹掌心，最后甩两下。'
      ],
      task: '写一个你熟悉的人，120 字左右，不出现"辛苦、温柔、勤劳"这类评价词，只让动作说话。' },
    { key: '五感观察', focus: '让场景可听可闻可触',
      match: /感官|听觉|视觉|触觉|声音|气味/,
      why: '只会写"看见"，场景就是平面的。补上声音、气味、触感，读者才能"走进"你写的世界。',
      idea: '选一个日常场景（厨房、雨天、放学路上），闭眼回忆：最清楚的一个声音是什么？空气里什么味道？皮肤碰到什么感觉？每种感官只写一句，宁少勿滥。',
      materials: [
        '听觉：油锅"刺啦"一声，葱花下了锅，抽油烟机嗡嗡地追在后面。',
        '嗅觉：晒过的被子有太阳的味道，抱起来像抱住一个暖烘烘的下午。',
        '触觉：冬天的铁门把手冰得咬手，握上去指尖一缩。',
        '味觉：第一口冰汽水扎得舌根发麻，气泡在喉咙里噼啪作响。'
      ],
      task: '写"放学路上的五分钟"，150 字，至少用上三种感官，每种不超过一句。' },
    { key: '情绪外化', focus: '把心情写成身体反应',
      match: /情绪|感动|难过|结论|直说|身体反应|抒情/,
      why: '"我很感动"是把答案告诉读者；"鼻子一酸"是让读者自己感动。情绪要藏在身体里。',
      idea: '建一张"情绪→身体"对照表：紧张时手心怎样？委屈时喉咙怎样？开心时嘴角怎样？写作时先划掉心情词，再从表里挑一个最准的反应，配一个小动作。',
      materials: [
        '紧张：手心的汗把准考证的边角洇软了，我把它在裤缝上蹭了又蹭。',
        '委屈：喉咙里像塞了一团湿棉花，咽不下去，也吐不出来。',
        '开心：嘴角压不住地往上翘，我只好低头假装找橡皮。',
        '不舍：我数着地砖的格子往前走，故意走得很慢很慢。'
      ],
      task: '写"等待发试卷的两分钟"，100 字，全文不出现"紧张、害怕、担心"。' },
    { key: '比喻训练营', focus: '喻体要从生活里长出来',
      match: /比喻|修辞|喻体|形象|生动/,
      why: '"像蝴蝶""像天使"是用滥的比喻。好喻体来自你真实见过的东西，最好带动作或磨损感。',
      idea: '玩"它像什么"游戏：挑一样东西（旧书包、皱纹、月亮），强迫自己想出三个生活里的喻体，再挑最有画面感的那个，往后延一句写它的细节。',
      materials: [
        '旧书包像一块用久的橡皮，四个角都磨圆了。',
        '外婆的皱纹像晒干的核桃壳，一笑就全挤到一起。',
        '月亮像被谁咬了一口的烧饼，缺口处还留着毛边。',
        '那句话像一颗小石子投进井里，半天才听见回声。'
      ],
      task: '给"风、灯光、书包"各写一个比喻句，喻体必须是家里或上学路上见过的东西。' },
    { key: '断句与节奏', focus: '长短句交替，会呼吸的句子',
      match: /长句|断句|节奏|逗号|喘|句式/,
      why: '一口气 40 字的长句读着累，全是短句又太碎。节奏感=长短交替+关键处短句收住。',
      idea: '写完一段读出声：哪里喘不上气，就在转折词（可、但、却、于是）前断开；情绪最重的那一句，单独成句，控制在 4~8 字。',
      materials: [
        '长句拆短：他跑了。鞋带散了也不管，书包在背后一颠一颠。',
        '短句收重：我等了很久。门开了。不是妈妈。',
        '长短交替：雨点砸在铁皮棚上，噼里啪啦，像有人在头顶炒豆子。忽然停了。静得能听见水沿着棚沿往下爬。'
      ],
      task: '写"一场突然的雨"，120 字，至少一处 4~8 字短句单独成句，无超过 30 字的长句。' },
    { key: '对话与现场感', focus: '一句原话顶十句转述',
      match: /对话|原话|台词|语言|转述/,
      why: '"妈妈让我先写作业"是转述；"你先写作业，这点事妈自己来"是现场。人物一开口，场景就活了。',
      idea: '回忆家人常说的口头禅，挑一句最像"他本人"的。写对话时前后各配半句动作：说这话时他的手在干什么？眼睛看哪里？',
      materials: [
        '"多吃点，锅里还有。"奶奶说这话时，筷子已经把鸡腿夹到了我碗里。',
        '"没事，爸在呢。"他把手掌按在我肩膀上，按得很实。',
        '"你自己想清楚。"老师把卷子推回来，指尖在桌上点了两下。'
      ],
      task: '写一段两人对话（6 句以内），每句对话都带一个小动作，不用"说"以外的提示语堆砌。' },
    { key: '结尾留白', focus: '把道理藏进画面里',
      match: /结尾|口号|议论|点题|总结|留白/,
      why: '"我明白了爱是伟大的"是喊口号。高级的结尾停在画面或实物上，让读者自己品出道理。',
      idea: '三种留白结尾练起来：①实物收束——让开头出现的东西最后再出现一次；②动作收束——停在一个人物动作上；③景物收束——让景物替你说心情。都不解释。',
      materials: [
        '实物：那把伞我一直没换。伞骨断了一根，撑开时歪着一边，像它主人走路的样子。',
        '动作：她站在门口挥手。车开出很远，后视镜里那个身影还在挥。',
        '景物：天晴了。窗台上的水珠一颗一颗往下掉，掉得很慢，很有耐心。'
      ],
      task: '给"一次分别"写三种结尾（各 40 字内），全部不出现"爱、感动、明白"。' },
    { key: '环境映衬', focus: '让景物替人物说话',
      match: /环境|景物|借景|氛围/,
      why: '心情不好时写"天灰蒙蒙的"太直白。让环境"动"起来跟着情绪变，含蓄又有力量。',
      idea: '选一个会变的东西：光、风、雨、影子、声音。情绪转折那一刻让它变一下——不写心情词，读者自然懂。',
      materials: [
        '云把太阳挡住了，屋里一下子暗下来，作业本上的字都灰了。',
        '风把窗帘吹起来，又落下去，像谁欲言又止。',
        '绿灯亮了。他还没动，后面的自行车铃响了一串。'
      ],
      task: '写"听到一个好消息前后的教室"，100 字，只写环境变化，不写心情词。' }
  ];

  function buildDrills(R, P, g) {
    const paras = (P || []).filter(x => x && String(x).trim().length > 4);
    const issues = (R.report && R.report.issues) || [];
    const full = paras.join('');

    /* 短板信号：批改问题 + 文本特征，共同决定优先练什么 */
    const signals = [];
    issues.forEach(it => signals.push((it.title || '') + ' ' + (it.desc || '')));
    if (!/(听见|闻到|摸到|凉|暖|响|香|气味|粗糙|软)/.test(full)) signals.push('感官 声音 触觉');
    if (!/(像|仿佛|好似|如同)/.test(full)) signals.push('比喻 修辞');
    if (!/[“"][^”"]{2,}[”"]/.test(full)) signals.push('对话 原话');
    if (paras.some(t => /[^。！？；]{42,}/.test(t))) signals.push('长句 断句');
    if (/(很|非常|特别)(感动|难过|开心|紧张|害怕)/.test(full)) signals.push('情绪 直说 身体反应');
    if (/(我明白了|我懂得了|原来这就是)/.test(full)) signals.push('结尾 口号 总结');

    /* 按信号给专题打分，取前三；同分时保持题库顺序，结果稳定 */
    const scored = DRILL_BANK.map((d, i) => ({
      d, i,
      score: signals.reduce((s, t) => s + (d.match.test(t) ? 1 : 0), 0)
    }));
    scored.sort((a, b) => b.score - a.score || a.i - b.i);
    const picked = scored.slice(0, 3).map(x => x.d);

    return picked.map(d => ({
      key: d.key,
      focus: d.focus,
      issue: d.why,            // 兼容旧字段：现在放"为什么练这个"
      idea: d.idea,
      demo: d.materials[0],    // 兼容旧字段：首条素材作示例
      materials: d.materials.slice(),
      task: d.task,
      relatedTitle: '',
      relatedDesc: '',
      relatedFallback: d.focus
    }));
  }

  /* ================= 导出数据组装 ================= */
  function buildExportData(d) {
    const base = window.ZPEXPORT.collect(d);
    const R = d.result;
    const P = base.paras;
    const g = GRADES.find(x => x.id === (d.gradeId || state.gradeId)) || GRADES[0];
    const genreObj = genreById(d.genreId) || {};

    // 润色稿：复用面板逻辑，同时记录本次改了哪些内容
    const polishTrace = [];
    const isDemoDoc = !!(d && d.isDemo && typeof DEMO_POLISHED !== 'undefined');
    const rawPolished = isDemoDoc ? DEMO_POLISHED.map(stripTechMarks) : buildPolished(R, P, polishTrace);
    /* 与界面同一个规整函数：AI 常把题目当成第一段返回，导出里也必须只留一个题目 */
    const polished = normalizePolishedParas(rawPolished, R.essay.title || d.name || '');
    const polishNotes = buildPolishNotes(polishTrace, P, polished);
    /* marks 的段号跟着前移，否则彩块会落到别的段上 */
    const markShift = rawPolished.length - polished.length;
    if (markShift > 0 && polishTrace && Array.isArray(polishTrace.marks)) {
      polishTrace.marks = polishTrace.marks
        .map(m => ({ ...m, para: m.para - markShift })).filter(m => m.para >= 0);
    }


    // 小练笔：与右侧面板同源，按短板匹配通用练笔专题（内容与原文无关）
    const drills = buildDrills(R, P, g).map((b, i) => ({
      ...b,
      issue: b.issue,
      ask: b.issue,          // 兼容导出层的 ask 字段
      related: b.relatedTitle || b.relatedFallback || ''
    }));

    // 图片真实宽高（用于 A4 白板裁切比例）
    const imgMeta = { imgW: d.w, imgH: d.h };

    return Object.assign(base, {
      polished, polishNotes,
      polishMarks: (polishTrace && polishTrace.marks) || [],
      // 演示稿导出与界面同源：带 <m1>~<m4> 标记的润色稿 + 四条手法
      demoPolish: isDemoDoc ? { title: DEMO_TITLE, paras: DEMO_POLISHED.slice(), techniques: DEMO_TECHNIQUES.slice() } : null,
      drills, imgW: imgMeta.imgW, imgH: imgMeta.imgH,
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

  /* 消息与历史记录的时间：显示记录当时的真实时刻，不用「多久之前」的相对说法。
   *   今天      → 今天 14:30
   *   昨天      → 昨天 14:30
   *   今年其他  → 3月5日 14:30
   *   往年      → 2025年3月5日 14:30 */
  function fmtStamp(ts) {
    const d = new Date(Number(ts) || Date.now());
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const p = n => String(n).padStart(2, '0');
    const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, now)) return `今天 ${hm}`;
    const y = new Date(now.getTime() - 86400000);
    if (sameDay(d, y)) return `昨天 ${hm}`;
    if (d.getFullYear() === now.getFullYear()) {
      return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
    }
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
  }

  function openHistory() {
    renderTabs();   // 打开即同步历史到顶部标签
    const list = loadHistory();
    const rows = list.length ? list.map(r => {
      const g = GRADES.find(x => x.id === r.gradeId) || { name: '未选年级' };
      const ge = genreById(r.genreId);
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
      syncLeftFromDoc();
      renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
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
    /* 统一走 syncLeftFromDoc：年级、体裁、姓名、四维权重一次性对齐。
     * 之前这里手写 gradeId/genreId 再逐个 render，漏了权重，
     * 打开一份"权重与当前不同"的历史记录时，左侧权重会停在旧值。 */
    syncLeftFromDoc();
    renderThumbs(); renderTabs(); renderCanvas(); renderReport(); syncDemoUI();
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
    $('#mSub').textContent = `《${DEMO_TITLE}》· 演示`;
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
    if (!Array.isArray(d.demoAnnos) || !d.demoAnnos.length) d.demoAnnos = makeDemoAnnos();
    d.status = 'showcase';      // 画板状态不变：仍是展示态（四色批注照旧）
    if (!d.name || d.name === '未命名') d.name = DEMO_TITLE;
    d.gradeId = d.gradeId || 'g5';
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


  /* ================= 网页版启动画面 =================
   * 开屏不再自动关闭：初始化完成后把「进入工作台」按钮放开，
   * 用户点了才淡出。不点就一直停在开屏页。 */
  let _splashArmed = false;

  const SPLASH_AUTO_MS = 3000;      // 就绪后 3 秒自动进入工作台
  let _splashAutoTimer = null;
  let _splashCountTimer = null;

  function armSplash() {
    const btn = document.getElementById('zpsEnterBtn');
    const hint = document.getElementById('zpsHint');
    if (!btn) return;
    btn.disabled = false;
    _splashArmed = true;
    /* 不自动聚焦：按钮聚焦会带出一圈焦点边，开屏一打开就"挂着边"不好看。
     * 键盘用户按 Tab 时仍会出现焦点环（:focus-visible）。 */
    if (!hint) return;
    let left = Math.ceil(SPLASH_AUTO_MS / 1000);
    hint.textContent = left + ' 秒后自动进入，也可直接点击';
    _splashCountTimer = setInterval(() => {
      left -= 1;
      if (left > 0) hint.textContent = left + ' 秒后自动进入，也可直接点击';
      else { clearInterval(_splashCountTimer); _splashCountTimer = null; }
    }, 1000);
    _splashAutoTimer = setTimeout(() => goSplash(true), SPLASH_AUTO_MS);
  }

  function hideSplash() {
    const el = document.getElementById('zp-splash');
    if (!el) return;
    el.classList.add('zp-hide');
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 520);
  }

  /* 进入工作台：手动点击与 3 秒自动进入共用，先清掉倒计时再淡出 */
  function goSplash(byAuto) {
    const btn = document.getElementById('zpsEnterBtn');
    if (!_splashArmed || (btn && btn.disabled)) return;
    if (_splashAutoTimer) { clearTimeout(_splashAutoTimer); _splashAutoTimer = null; }
    if (_splashCountTimer) { clearInterval(_splashCountTimer); _splashCountTimer = null; }
    const hint = document.getElementById('zpsHint');
    if (btn) btn.disabled = true;
    if (hint) hint.textContent = byAuto ? '正在进入…' : '正在打开…';
    hideSplash();
  }

  function bindSplashEnter() {
    const btn = document.getElementById('zpsEnterBtn');
    if (!btn || btn.dataset.bound) return;
    /* 桌面版已有独立闪屏（带「进入工作台」按钮），主窗是隐藏加载的，
     * 这里再叠一层网页开屏就重复了：直接把网页开屏收掉。 */
    if (window.ZPNATIVE) {
      /* 桌面版由独立闪屏负责「进入工作台」，这里把网页开屏摘掉。
       * _splashArmed 保持 false：网页开屏已不存在，任何残留的
       * goSplash 调用都应直接返回，而不是去 hideSplash 一个空节点。 */
      const el = document.getElementById('zp-splash');
      if (el && el.parentNode) el.parentNode.removeChild(el);
      _splashArmed = false;
      return;
    }
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => goSplash(false));
    document.addEventListener('keydown', e => {
      if (!_splashArmed) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goSplash(false); }
    });
  }

  window.__zpHideSplash = hideSplash;   // 兼容外部调用（如 Electron 侧）
  window.__zpArmSplash = armSplash;

  window.__diag = [];
  window.addEventListener('error', e => window.__diag.push('ERR:' + e.message + ' @L' + e.lineno));
  document.addEventListener('DOMContentLoaded', function () {
    try {
      init();
      window.__diag.push('init-ok');
      bindSplashEnter();
      if (!window.ZPNATIVE) armSplash();   // 放开按钮，等用户点击；不点就停在开屏
    }
    catch (e) {
      window.__diag.push('INIT-THROW: ' + e.message);
      window.__diag.push((e.stack || '').split(String.fromCharCode(10)).slice(0, 3).join(' || '));
    }
  });
  window.__zp = state;
  window.__buildExportData = buildExportData;
  window.__openAIConfig = openAIConfig;
  // 调试/自测入口：外部可直接触发重渲染，避免依赖点击时序
  window.__renderAll = () => { renderTabs(); renderCanvas(); renderReport(); };
})();
