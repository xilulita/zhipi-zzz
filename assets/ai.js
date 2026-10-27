/* ===== 智批作文 · AI 批改接口层 =====
 * 支持 OpenAI 兼容接口（云端）与 Ollama 本地部署
 * 未配置时抛出明确错误，绝不返回伪造结果
 */
(function (global) {
  'use strict';

  const CFG_KEY = 'zhipi.ai.deploy.v1';

  function readCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { return {}; }
  }

  function mode() {
    const c = readCfg();
    if (c.mode === 'api' && c.api && c.api.base && c.api.key) return 'api';
    if (c.mode === 'local' && c.local && c.local.base) return 'local';
    return null;
  }

  /* ---------- 构造提示词 ---------- */
  function buildPrompt(grade, genre, weights) {
    const dims = [
      `内容立意（权重${weights[0]}%）：主题是否明确、立意是否深刻、素材是否贴合题意`,
      `结构逻辑（权重${weights[1]}%）：段落安排是否合理、层次是否清晰、详略是否得当`,
      `语言表达（权重${weights[2]}%）：用词是否准确生动、句式是否流畅、修辞运用水平`,
      `规范书写（权重${weights[3]}%）：错别字、病句、标点与书写规范`
    ].join('\n');

    return `你是一位资深的${grade}语文教师，正在批改一篇${genre}。请先逐字识别图片中的手写作文，再按以下四个维度评分并给出批注。

评分维度：
${dims}

语言要求（重要）：
- 提到写这篇作文的学生时，一律称"小作者"，不要用"作者""笔者""该生"。
- 语气亲切、具体，像老师在作文本上写的评语，不要空话套话。
- 不要出现任何"AI""人工智能""模型""系统生成"之类的字眼。

要求：
1. 必须先准确识别图片中的作文原文（含标题），不要编造内容。
   如果原文没有写标题（或标题被遮挡、无法辨认），不要填"未命名"，请根据文章内容自行拟定一个贴切的标题（8~14 字，点明事件或中心，不要用"我的一天""难忘的事"这类泛标题），填入 title 字段。
   若一次传入多张图片：它们按顺序是同一篇作文的第 1 页、第 2 页……，请跨页合并成一篇，不要把每页当成独立作文，也不要跨页重复或遗漏句子。
2. 四个维度各给一个 0~1 的达成率（ratio），保留两位小数。
3. 给出 3 条文章亮点，每条必须引用原文中的真实句子。
4. 给出 2~3 条存在问题，每条必须指明原文中的具体句子。
5. 给出 6~8 条批注，要求：
   - err（错别字/病句）：尽最大努力找全——错别字、用词不当、"的/地/得"误用、标点错误、成分残缺、搭配不当、语序不当，每一处都要单列一条；
   - polish（润色）：**至少 2 条**，指出可写得更生动具体的句子，并给出改写后的表达；
   - good（好句）：1~2 条，标出全文最有画面感或最动人的句子；
   - dele（删改）：0~2 条，重复啰嗦或与中心无关的内容。
   每条必须包含：原文引用 quote（必须是图中真实存在的句子，逐字照抄）、点评 comment、所在页码 page（从 1 开始，只有一页时填 1）、位置坐标。
   坐标规则非常重要：坐标相对于该条批注所在的【那一页】图片，图片左上角为 (0,0)，右下角为 (1,1)。x/y 是 quote 实际文字区域左上角，w/h 是宽高，均为 0~1 小数；必须满足 x+w<=1、y+h<=1。矩形要贴住 quote 的首字与末字，行中心与文字中心一致，不要固定整行宽度，不要放在行间空白。若无法确定真实位置，设置 located=false，不要编造坐标。
6. 总评 200~400 字，要有具体表扬、具体问题、可执行建议。
7. 额外给出一版**润色后全文** polished。这是给学生看的"范文升级版"，要求**看得出明显变化**，不能只是把原句改通顺：
   - 篇幅：在你识别出的原文基础上扩写约 30%~60%，段落数与原文一致，情节与结构不变；
   - 细节：每个关键情节补 1~2 处慢镜头——手怎么动、肩膀怎么塌、呼吸怎么变、空气里是什么味道；
   - 修辞：比喻至少 2 处、拟人至少 1 处，喻体必须来自日常生活且贴切（"像被反复折过的纸"好过"像蝴蝶"）；
   - 句式：长短句交替，情绪最重的地方用 4~8 字的短句单独成句；
   - 环境：开头补一句环境画面，结尾让景物跟着情绪一起变；
   - 保留原文所有真实情节与人物，不新增事件、不换主题、不写成另一个故事；
   - 分段数组，每项一段，纯文本不带 HTML，不要写"润色后"之类的标签。

8. 只输出 JSON，不要任何解释文字、不要 markdown 代码块。

严格按此 JSON 结构输出：
{
  "title": "作文标题",
  "paragraphs": ["第一段原文", "第二段原文"],
  "dimensions": {
    "content": {"ratio": 0.85, "comment": "该维度评语"},
    "structure": {"ratio": 0.78, "comment": "该维度评语"},
    "language": {"ratio": 0.82, "comment": "该维度评语"},
    "norm": {"ratio": 0.90, "comment": "该维度评语"}
  },
  "highlights": [{"title": "亮点小标题", "detail": "具体说明并引用原句"}],
  "issues": [{"title": "问题小标题", "severity": "high|mid|low", "desc": "问题说明", "quote": "原文原句", "fix": "修改建议"}],
  "annotations": [{"type": "good|err|polish|dele", "quote": "原文原句", "comment": "点评", "page": 1, "located": true, "x": 0.08, "y": 0.22, "w": 0.31, "h": 0.035}],
  "review": "总评正文",
  "polished": ["润色后的第一段", "润色后的第二段"]
}`;
  }

  /* ---------- 从文本里抽取 JSON ---------- */
  function extractJSON(text) {
    if (!text) throw new Error('AI 未返回内容');
    let s = String(text).trim();
    // 去掉 ```json ``` 包裹
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(s); } catch (e) {}
    // 截取第一个 { 到最后一个 }
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) {
      const seg = s.slice(a, b + 1);
      try { return JSON.parse(seg); } catch (e) {}
      // 常见修复：尾逗号
      try { return JSON.parse(seg.replace(/,\s*([}\]])/g, '$1')); } catch (e) {}
    }
    throw new Error('AI 返回的内容不是有效 JSON');
  }

  /* ---------- 云端 OpenAI 兼容 ---------- */
  async function callAPI(cfg, prompt, imgDataUrl, signal) {
    const imgs = Array.isArray(imgDataUrl) ? imgDataUrl : [imgDataUrl];
    const base = cfg.base.replace(/\/+$/, '');
    // 温度：默认 0.25（批改需要稳定），可由用户调节 0~1
    const temp = (typeof cfg.temperature === 'number')
      ? Math.min(1, Math.max(0, cfg.temperature)) : 0.25;
    const body = {
      model: cfg.model,
      temperature: temp,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imgs.map((u, i) => ({ type: 'image_url', image_url: { url: u } }))
        ]
      }]
    };
    // 支持 JSON 模式的模型附加 response_format
    if (!/claude|gemini/i.test(cfg.model || '')) body.response_format = { type: 'json_object' };

    /* ---- 深度思考开关（豆包 / 火山方舟 2.1 turbo 等支持） ----
     * 快速模式：thinking.type = 'disabled'，跳过思考链，批改更快
     * 质量模式：thinking.type = 'enabled'，模型先思考再作答
     * 其他兼容接口若忽略该字段，不会影响请求；不支持的会返回 400，
     * 此时自动去掉该字段重试一次，保证兼容性。 */
    const thinkingOn = cfg.thinking === true;
    const modelName = String(cfg.model || '').toLowerCase();
    const supportsThinking = /doubao|seed|ark|volc|deepseek|qwen|glm|kimi/.test(modelName);
    if (supportsThinking) {
      body.thinking = { type: thinkingOn ? 'enabled' : 'disabled' };
    }

    let res;
    try {
      res = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.key
        },
        body: JSON.stringify(body),
        signal
      });
    } catch (e) {
      if (e && e.name === 'AbortError') { const er = new Error('已取消'); er.code = 'ABORTED'; throw er; }
      throw new Error('网络请求失败：' + (e.message || '可能被浏览器跨域拦截，请检查接口地址'));
    }
    // 兼容：若接口不认 thinking / response_format 字段（400/422），去掉后重试一次
    if (!res.ok && (res.status === 400 || res.status === 422) && (body.thinking || body.response_format)) {
      let detail = '';
      try { const j = await res.json(); detail = j.error?.message || JSON.stringify(j).slice(0, 160); } catch (e) {}
      const retryBody = Object.assign({}, body);
      delete retryBody.thinking;
      delete retryBody.response_format;
      try {
        const r2 = await fetch(base + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
          body: JSON.stringify(retryBody),
          signal
        });
        if (r2.ok) { res = r2; }
        else { throw new Error(`接口返回 ${res.status}${detail ? '：' + detail : ''}`); }
      } catch (e) {
        if (e && e.name === 'AbortError') { const er = new Error('已取消'); er.code = 'ABORTED'; throw er; }
        throw new Error(`接口返回 ${res.status}${detail ? '：' + detail : ''}`);
      }
    }
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j.error?.message || JSON.stringify(j).slice(0, 160); } catch (e) {}
      throw new Error(`接口返回 ${res.status}${detail ? '：' + detail : ''}`);
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content;
    const out = extractJSON(text);
    const u = json?.usage || {};
    out.__usage = {
      prompt: u.prompt_tokens || u.input_tokens || 0,
      completion: u.completion_tokens || u.output_tokens || 0,
      total: u.total_tokens || ((u.prompt_tokens || 0) + (u.completion_tokens || 0))
    };
    return out;
  }

  /* ---------- 本地 Ollama / LM Studio ---------- */
  async function callLocal(cfg, prompt, imgDataUrl, signal) {
    const base = cfg.base.replace(/\/+$/, '');
    const imgs = Array.isArray(imgDataUrl) ? imgDataUrl : [imgDataUrl];
    const b64s = imgs.map(u => (u.split(',')[1] || ''));
    const isOllama = (cfg.engine || 'ollama') === 'ollama';

    const url = isOllama ? base + '/api/chat' : base + '/chat/completions';
    const body = isOllama ? {
      model: cfg.model,
      stream: false,
      format: 'json',
      messages: [{ role: 'user', content: prompt, images: b64s }]
    } : {
      model: cfg.model,
      temperature: 0.25,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...imgs.map(u => ({ type: 'image_url', image_url: { url: u } }))
        ]
      }]
    };

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });
    } catch (e) {
      if (e && e.name === 'AbortError') { const er = new Error('已取消'); er.code = 'ABORTED'; throw er; }
      throw new Error('无法连接本地服务：' + (e.message || '请确认已启动并允许跨域'));
    }
    if (!res.ok) throw new Error(`本地服务返回 ${res.status}`);
    const json = await res.json();
    const text = isOllama ? json?.message?.content : json?.choices?.[0]?.message?.content;
    const out = extractJSON(text);
    out.__usage = {
      prompt: json?.prompt_eval_count || json?.usage?.prompt_tokens || 0,
      completion: json?.eval_count || json?.usage?.completion_tokens || 0,
      total: (json?.prompt_eval_count || 0) + (json?.eval_count || 0)
    };
    return out;
  }

  /* ---------- 统一入口 ---------- */
  async function grade(doc, gradeMeta, genreName, weights, onStage, opts) {
    const m = mode();
    if (!m) {
      const err = new Error('NOCONFIG');
      err.code = 'NOCONFIG';
      throw err;
    }
    const cfg = readCfg();
    const prompt = buildPrompt(gradeMeta.name, genreName, weights || [30, 25, 25, 20]);
    // 多页作文：一次提交全部页面，按上传顺序作为第 1、2…页
    const pageImgs = (Array.isArray(doc.pages) && doc.pages.length)
      ? doc.pages.map(p => p.img).filter(Boolean)
      : (doc.img ? [doc.img] : []);
    if (!pageImgs.length) throw new Error('缺少作文图片');
    const img = pageImgs;

    const signal = opts && opts.signal;
    const st = (txt, pct) => { onStage && onStage(txt, pct); };
    st('OCR 文字识别中…', 10);
    const t0 = Date.now();
    const raw = m === 'api'
      ? await callAPI(cfg.api, prompt, img, signal)
      : await callLocal(cfg.local, prompt, img, signal);
    st('四维评分计算中…', 62);
    // 让阶段切换在界面上可见（极快返回时不至于一闪而过）
    if (Date.now() - t0 < 260) await new Promise(r => setTimeout(r, 160));
    st('逐句批注生成中…', 78);
    const out = normalize(raw, gradeMeta, weights, genreName);
    st('报告排版与渲染…', 94);
    out.usage = raw.__usage || null;
    out.usageEst = !raw.__usage;
    return out;
  }

  /* ---------- 归一化为内部结构 ---------- */
  function normalize(raw, gradeMeta, weights, genreName) {
    // 统一口吻：学生称“小作者”，且不出现任何 AI 相关字眼
    const kid = v => String(v == null ? '' : v)
      .replace(/(?<!小)作者/g, '小作者')
      .replace(/人工智能|大模型|AI|智能批改|系统自动生成/gi, '');
    raw = raw || {};
    for (const k of ['highlights', 'issues']) {
      if (Array.isArray(raw[k])) {
        raw[k] = raw[k].map(h => ({
          ...h,
          title: kid(h && h.title),
          detail: kid(h && h.detail),
          desc: kid(h && h.desc),
          quote: kid(h && h.quote),
          fix: kid(h && h.fix)
        }));
      }
    }
    if (Array.isArray(raw.annotations)) {
      raw.annotations = raw.annotations.map(a => ({ ...a, comment: kid(a && a.comment) }));
    }
    if (raw.dimensions) {
      for (const k of Object.keys(raw.dimensions)) {
        if (raw.dimensions[k]) raw.dimensions[k].comment = kid(raw.dimensions[k].comment);
      }
    }
    if (Array.isArray(raw.polished)) raw.polished = raw.polished.map(kid);
    if (raw.review) raw.review = kid(raw.review);

    const W = weights || [30, 25, 25, 20];
    const dims = raw.dimensions || {};
    const clamp = v => Math.max(0.3, Math.min(1, Number(v) || 0.7));

    const ratio = {
      content: clamp(dims.content?.ratio),
      structure: clamp(dims.structure?.ratio),
      language: clamp(dims.language?.ratio),
      norm: clamp(dims.norm?.ratio)
    };

    const points = {};
    let total = 0;
    const keys = ['content', 'structure', 'language', 'norm'];
    keys.forEach((k, i) => {
      const full = Math.round(gradeMeta.total * W[i] / 100 * 10) / 10;
      const got = Math.round(full * ratio[k]);
      points[k] = { got, full, quant: ratio[k], comment: dims[k]?.comment || '' };
      total += got;
    });

    const pct = total / gradeMeta.total;
    const level = pct >= 0.86 ? { name: '一类文', desc: '优秀', key: 'one' }
      : pct >= 0.70 ? { name: '二类文', desc: '良好', key: 'two' }
      : { name: '三类文', desc: '合格', key: 'three' };

    const paras = (raw.paragraphs || []).filter(x => x && String(x).trim());
    const text = paras.join('');
    const words = text.replace(/\s/g, '').length;

    const typeMap = { good: 'good', err: 'err', polish: 'polish', dele: 'dele' };
    // 批注：最多 8 条；润色不足 2 条时补齐（从 err/good 中借位提示）
    let rawAnnos = (raw.annotations || []).map(a => ({ ...a, type: typeMap[a.type] || 'polish' }));
    const polishCount = rawAnnos.filter(a => a.type === 'polish').length;
    if (polishCount < 2 && rawAnnos.length) {
      // 把非润色的若干条"补一条润色提示"（不覆盖原批注，新增一条通用润色）
      const need = 2 - polishCount;
      for (let k = 0; k < need; k++) {
        rawAnnos.push({
          type: 'polish',
          quote: (raw.paragraphs && raw.paragraphs[k]) || '',
          comment: '此处可再具体些：补一个动作或感官细节，句子会更有画面感。',
          located: false
        });
      }
    }
    const annosPick = rawAnnos.slice(0, 8);
    const rectOf = a => {
      const x = num(a.x, 0.08);
      const y = num(a.y, 0.08);
      const w0 = Number.isFinite(Number(a.w)) ? Number(a.w) : 0.22;
      const h0 = Number.isFinite(Number(a.h)) ? Number(a.h) : 0.035;
      return {
        x, y,
        w: Math.max(0.012, Math.min(1 - x, w0)),
        h: Math.max(0.012, Math.min(1 - y, h0))
      };
    };
    const annos = annosPick.map((a, i) => {
      const rect = rectOf(a);
      const located = a.located !== false && [a.x, a.y, a.w].every(v => Number.isFinite(Number(v)));
      const pg = Math.max(1, Math.min(99, parseInt(a.page, 10) || 1));
      return {
        id: 'a' + i, no: i + 1,
        page: pg,
        type: a.type,
        side: i % 2 === 0 ? 'left' : 'right',
        html: `<b>“${escShort(a.quote, 26)}”</b>　${escShort(a.comment, 90)}`,
        para: i,
        stat: { good: '好句', err: '病句', polish: '润色', dele: '删改' }[a.type],
        located,
        x: rect.x, y: rect.y, w: rect.w, h: rect.h
      };
    });

    const highlights = (raw.highlights || []).slice(0, 3).map(h => ({
      t: h.title || '亮点', d: escShort(h.detail, 120)
    }));

    const issues = (raw.issues || []).slice(0, 3).map(h => ({
      dim: 'content',
      sev: ['high', 'mid', 'low'].includes(h.severity) ? h.severity : 'low',
      title: h.title || '需注意',
      desc: escShort(h.desc, 120),
      ex: h.quote ? `原句：<s>${escShort(h.quote, 40)}</s>${h.fix ? ` 建议：<b>${escShort(h.fix, 50)}</b>` : ''}` : ''
    }));

    const polished = Array.isArray(raw.polished)
      ? raw.polished.map(x => String(x || '').trim()).filter(Boolean)
      : [];

    return {
      essay: { title: autoTitle(raw.title, paras, genreName), paras: paras.length ? paras : ['（未识别到正文）'], words, genre: genreName },
      score: { points, total, stats: { words, paras: paras.length } },
      level,
      annos,
      report: {
        highlights,
        issues,
        review: String(raw.review || '').replace(/\n/g, '<br>'),
        stu: '', words, genre: genreName,
        polished,
        dimComments: {
          content: dims.content?.comment || '',
          structure: dims.structure?.comment || '',
          language: dims.language?.comment || '',
          norm: dims.norm?.comment || ''
        }
      },
      source: 'ai',
      at: Date.now()
    };
  }

  /* 标题兜底：模型没给/给了"未命名"时，按首段与关键词拟一个 */
  function autoTitle(t, paras, genreName) {
    const bad = !t || /^(未命名|无标题|标题|作文|untitled)$/i.test(String(t).trim());
    if (!bad) return String(t).trim();
    const text = (paras || []).join('');
    // 抓首句里的场景/人物/动作作为标题骨架
    const first = (paras && paras[0] ? paras[0] : '').replace(/[，。！？、；：""''\s]/g, '');
    const pick = (re) => { const m = text.match(re); return m ? m[1] : ''; };
    const who = pick(/(妈妈|爸爸|爷爷|奶奶|老师|同学|外婆|外公|弟弟|妹妹|姐姐|哥哥)/);
    const what = pick(/(第一次[^，。]{2,8}|学会了[^，。]{2,8}|那一刻[^，。]{0,6}|那一次[^，。]{2,8})/);
    const things = pick(/(雨|雪|风|灯|饭|碗|手|背影|车|窗|月|花|树|路)/);
    if (what) return what.slice(0, 14);
    if (who && things) return `那个${things}里的${who}`.slice(0, 14);
    if (who) return `关于${who}的一件事`.slice(0, 14);
    if (first.length >= 6) return first.slice(0, 12);
    return (genreName ? `一篇${genreName}` : '我的作文').slice(0, 12);
  }

  const num = (v, d) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : d);
  const escShort = (s, n) => String(s == null ? '' : s)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .slice(0, n || 300);

  global.ZPAI = { grade, mode, readCfg, CFG_KEY, extractJSON, buildPrompt };
})(window);
