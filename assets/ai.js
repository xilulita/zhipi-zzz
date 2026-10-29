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
   **识别时的注意点**：
   - 手写体请按笔画逐个辨认，遇到连笔、涂改、字迹潦草处，结合上下文判断最可能的字，并在该句里按判断结果如实写出，不要跳过整句，也不要用"（字迹不清）"占位；
   - 中文标点（，。！？""）与常见错别字都要照实转录，**不要顺手把学生的错误改对**——批改的依据就是你识别出的原始文字；
   - 如果图片整体模糊到无法辨认（例如严重失焦、反光遮挡、只拍到页面一角），**不要猜测编造**，请在 title 字段填入"图片不清晰"，paragraphs 只放你确实看清的句子，并在 review 开头明确告诉用户"图片不够清晰，建议重新拍摄：光线从上往下、纸面平整、四角完整入镜"。
   如果原文没有写标题（或标题被遮挡、无法辨认），不要填"未命名"，请根据文章内容自行拟定一个贴切的标题（8~14 字，点明事件或中心，不要用"我的一天""难忘的事"这类泛标题），填入 title 字段。
   若一次传入多张图片：它们按顺序是同一篇作文的第 1 页、第 2 页……，请跨页合并成一篇，不要把每页当成独立作文，也不要跨页重复或遗漏句子。
2. 四个维度各给一个 0~1 的达成率（ratio），保留两位小数。
3. 给出 3 条文章亮点，每条必须引用原文中的真实句子。
4. 给出 2~3 条存在问题，每条必须指明原文中的具体句子。
5. 给出 12~16 条批注（按文章长短决定，短文不少于 10 条，长文可到 16 条）。**每一条都必须钉在原文的真实句子上，且各条指向不同的句子**——宁可少给，也不要把同一句话重复点评，或用"这句可以更好"这类空话凑数。
   - **多页作文务必按页分配**：每一页都要有自己的批注，不要把所有批注都压在第 1 页。页数越多，每页分到的条数相应减少（如两页各 4~6 条，三页各 3~4 条），保证学生翻到每一页都能看到针对本页文字的意见。
   - **但要客观真实**：如果某一页确实写得规整、没有值得指出的问题，该页可以少给甚至不给，**不要为了凑数硬挑毛病、不要重复点评同一句**。有则指出，没有就留白。
   - err（错别字/病句）：找全主要问题——错别字、用词不当（动宾搭配、修饰语与中心词不搭）、"的/地/得"误用、标点错误、成分残缺（缺主语/谓语）、语序不当、句意重复、指代不明。每一处单独一条，comment 里要说明**为什么错**，而不只是贴个标签；
   - polish（润色）：**至少 3 条，文章长可到 5 条**，这是学生最需要的部分。每条必须写成「原句 → 改写句」的对照形式，comment 里先一句话点出这句"现在缺什么"，然后**用「」标出改写后的完整句子**，改写要真的动笔、看得出差别，不能只是加个形容词。
     正例：「他跑得很快」→「他脚尖点着地跑，校服下摆被风掀起来，书包在背后一颠一颠」
     反例：「这句话可以更生动一些」「可以加些细节」——这类空话一律不要。
   - good（好句）：2~3 条，标出全文最有画面感、最动人的句子，说明它好在哪里（用了什么手法、为什么有力量）；
   - dele（删改）：1~3 条，指出重复啰嗦、与中心无关、或可以合并的句子，并说明删掉后为什么更好。
   四类都要有：挑错（err）之外，一定要给出"怎么写更好"（polish）和"哪里写得好"（good），不要整篇只挑毛病。
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

  /* 修复被截断的 JSON：补齐未闭合的字符串与括号 */
  function repairTruncated(str) {
    let s = String(str).trim();
    // 去掉末尾不完整的片段（最后一个逗号或冒号之后被截断）
    let inStr = false, esc = false;
    const stack = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (esc) { esc = false; continue; }
      if (c.charCodeAt(0) === 92) { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{' || c === '[') stack.push(c);
      else if (c === '}' || c === ']') stack.pop();
    }
    if (inStr) s += '"';                      // 补上未闭合的字符串
    s = s.replace(/[,:]\s*$/, '');            // 去掉悬空的逗号/冒号
    while (stack.length) {                     // 补齐括号
      const open = stack.pop();
      s += open === '{' ? '}' : ']';
    }
    return s;
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
      // 依次尝试几种稳定修复，任一成功即返回
      const t1 = seg.replace(/,\s*([}\]])/g, '$1');                       // 尾逗号
      const t2 = t1.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"); // 中文引号
      const tries = [seg, t1, t2];
      for (const t of tries) {
        try { return JSON.parse(t); } catch (e) {}
      }
      // 被截断的 JSON：尝试补齐括号后解析
      const fixed = repairTruncated(seg);
      if (fixed) { try { return JSON.parse(fixed); } catch (e) {} }
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
      // 输出上限：批改报告含原文识别 + 14 条批注 + 润色全文，很容易超过 2000 token。
      // 不显式指定会被默认值截断，导致 JSON 不完整、解析失败。
      max_tokens: 8192,
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
    // 自动重试：网络抖动、5xx、JSON 解析失败时重试，最多 3 次
    // 401/403/400 这类确定性错误不重试，直接报错，避免白等
    const callOnce = () => m === 'api'
      ? callAPI(cfg.api, prompt, img, signal)
      : callLocal(cfg.local, prompt, img, signal);

    const MAX_TRY = 3;
    let raw = null, lastErr = null;
    for (let attempt = 1; attempt <= MAX_TRY; attempt++) {
      try {
        raw = await callOnce();
        break;
      } catch (e) {
        lastErr = e;
        if (e && e.code === 'ABORTED') throw e;
        const msg = String(e && e.message || '');
        // 确定性错误不重试
        if (/^接口返回 (400|401|403|404)/.test(msg)) throw e;
        if (attempt < MAX_TRY) {
          st(`第 ${attempt} 次失败，${attempt + 1} 秒后重试…`, 10 + attempt * 12);
          await new Promise(r => setTimeout(r, 1500 * attempt));
        }
      }
    }
    if (!raw) {
      const em = String(lastErr && lastErr.message || '未知错误');
      const er = new Error(`批改失败：${em}`);
      er.detail = em;
      throw er;
    }
    st('四维评分计算中…', 62);
    // 让阶段切换在界面上可见（极快返回时不至于一闪而过）
    if (Date.now() - t0 < 260) await new Promise(r => setTimeout(r, 160));
    st('逐句批注生成中…', 78);
    // 把总页数传给归一化：多页稿要保证每页都有对应批注，且名额按页分配
    const out = normalize(raw, gradeMeta, weights, genreName, pageImgs.length);
    st('报告排版与渲染…', 94);
    out.usage = raw.__usage || null;
    out.usageEst = !raw.__usage;
    return out;
  }

  /* ---------- 归一化为内部结构 ---------- */
  function normalize(raw, gradeMeta, weights, genreName, totalPages) {
    const PAGES = Math.max(1, Math.min(99, parseInt(totalPages, 10) || 1));
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
    // 批注条数：单页 8 条；多页按页给名额（每页 4~6 条），保证每页都有
    let rawAnnos = (raw.annotations || []).map(a => ({ ...a, type: typeMap[a.type] || 'polish' }));

    /* 润色不足时补齐：早期版本补的是「此处可再具体些」这类空话，
     * 学生看了不知道该怎么改，等于没给润色。这里改为：
     * 优先从模型给的「润色后全文」里，按段落取对应改写句，凑成真正可对照的润色批注。 */
    const polishCount0 = rawAnnos.filter(a => a.type === 'polish').length;
    // 目标条数：3~5 条；文章句子确实不足 3 句时按实际句子数给（不硬凑、不重复同句）
    const sentCount = paras.reduce((n, p) =>
      n + String(p).split(/[。！？!?；;]/).filter(x => x.trim().length >= 6).length, 0);
    const POLISH_MIN = Math.min(Math.max(3, Math.min(5, Math.round(rawAnnos.length / 3))),
      Math.max(1, sentCount));
    if (polishCount0 < POLISH_MIN) {
      const polishedArr = Array.isArray(raw.polished) ? raw.polished : [];
      // 已有批注引用的句子，避免重复点评同一句
      const usedQuotes = new Set(rawAnnos.map(a => String(a.quote || '').trim()).filter(Boolean));
      const need = POLISH_MIN - polishCount0;
      const picked = [];

      /* 把每段再切成「分句」，这样一段里也能给出多条润色——
       * 否则文章只有两三段时，润色条数会被段落数卡死（永远凑不到 3 条）。 */
      const splitSent = s => String(s).split(/(?<=[。！？!?；;])/).map(x => x.trim()).filter(x => x.length >= 6);
      const origSents = paras.map(p => splitSent(p));
      const rewSents = polishedArr.map(p => splitSent(p));

      // 第一轮：按段落取「原文分句 → 改写分句」配对，各段轮流取，保证摊得开
      const paraCount = Math.max(1, paras.length);
      const perPara = Math.max(1, Math.ceil(need / paraCount));
      for (let round = 0; round < perPara && picked.length < need; round++) {
        for (let i = 0; i < paras.length && picked.length < need; i++) {
          const origs = origSents[i] || [];
          const rews = rewSents[i] || [];
          if (!origs.length || !rews.length) continue;
          const orig = origs[round];
          if (!orig || usedQuotes.has(orig)) continue;
          // 改写句按比例对应，避免越界
          const idx = Math.min(rews.length - 1,
            Math.round(round * (rews.length - 1) / Math.max(1, origs.length - 1)));
          const rew = rews[idx] || rews[0];
          picked.push({
            type: 'polish',
            quote: orig.slice(0, 40),
            comment: `这一句可以这样写，句子会更有画面感：「${rew.slice(0, 70)}」`,
            _paraIdx: i,          // 记录所属段落，页码兜底时据此摊到对应页
            located: false
          });
          usedQuotes.add(orig);
        }
      }
      // 第二轮：还不够就用未用过的分句补，仍然给出具体改法（不用空话）
      if (picked.length < need) {
        for (let i = 0; i < origSents.length && picked.length < need; i++) {
          for (const orig of (origSents[i] || [])) {
            if (picked.length >= need) break;
            if (usedQuotes.has(orig)) continue;
            picked.push({
              type: 'polish',
              quote: orig.slice(0, 40),
              comment: '这句是直述，可以先写「看到什么」，再写「心里怎么一变」，画面和情绪就都立起来了。',
              located: false
            });
            usedQuotes.add(orig);
          }
        }
      }
      /* 素材实在不够（文章只有一两句话）时，用「同一句、不同角度」补足，
       * 让学生至少拿到 3 条可操作的改写方向，而不是被段落数卡死在 2 条。
       * 注意：同一句只补一次，避免同一句被两条润色重复点评。 */
      if (picked.length < need && origSents.flat().length) {
        const angles = [
          { k: '句式', c: '这句话偏平铺直叙，试试拆成两小句：先写眼前看到的，再写心里冒出来的那个念头。' },
          { k: '细节', c: '这句话只有结果没有过程，补一个具体的动作或声音，读者才能「看见」这个画面。' },
          { k: '情绪', c: '这句话把情绪说得太满，不如只写一个身体反应（手抖、喉咙发紧），让读者自己体会。' }
        ];
        const flat = [];
        origSents.forEach((arr, pi) => arr.forEach(s => flat.push({ s, pi })));
        let ai2 = 0;
        // 从没被第一轮用过的句子开始挑，实在没有才回到已用过的
        const unused = flat.filter(x => !usedQuotes.has(x.s));
        const pool = unused.length ? unused : flat;
        for (let k = 0; k < pool.length && picked.length < need && ai2 < angles.length; k++) {
          const target = pool[k];
          if (usedQuotes.has(target.s)) continue;      // 同一句不重复补
          const ang = angles[ai2];
          picked.push({
            type: 'polish',
            quote: target.s.slice(0, 40),
            comment: `换个角度改：${ang.c}`,
            _paraIdx: target.pi,                        // 后面按段落摊到对应页
            located: false
          });
          usedQuotes.add(target.s);
          ai2++;
        }
      }
      rawAnnos = rawAnnos.concat(picked);
    }

    /* ---------- 多页：按页分配批注名额 ----------
     * 旧逻辑 slice(0,8) 只留前 8 条，多页稿里后面的页会被整页剃光。
     * 新逻辑：先按 page 分组，再按「每页保底 N 条、总额受限」的方式挑，
     * 某一页模型确实没给出问题时留空（不硬凑），但保证名额没有被前面的页吃光。 */
    const pageOf = a => Math.max(1, Math.min(PAGES, parseInt(a.page, 10) || 1));

    /* 兜底：模型常常漏填 page，导致所有批注都压在第 1 页。
     * 判定标准——多页稿里「第 1 页的条数 ≥ 总条数的 80% 且第 2 页起为空」，
     * 视为模型根本没分页。此时按段落字数的累计比例，把批注重新摊到各页，
     * 让第 2、3 页也有对应批注；如果模型确实分了页，则原样保留。 */
    if (PAGES > 1 && rawAnnos.length) {
      const cnt = {};
      rawAnnos.forEach(a => { const p = pageOf(a); cnt[p] = (cnt[p] || 0) + 1; });
      const firstPageShare = (cnt[1] || 0) / rawAnnos.length;
      const laterEmpty = PAGES >= 2 && !Object.keys(cnt).some(k => +k >= 2);
      if (laterEmpty && firstPageShare >= 0.8) {
        // 用段落字数比例推断每页大致覆盖到第几段
        const lens = paras.map(p => String(p).length);
        const totalLen = lens.reduce((a, b) => a + b, 0) || 1;
        // 每段归属页：按累计字数 / 总字数 映射到 1..PAGES
        const pageOfPara = [];
        let acc = 0;
        lens.forEach(len => {
          const mid = (acc + len / 2) / totalLen;
          pageOfPara.push(Math.min(PAGES, Math.floor(mid * PAGES) + 1));
          acc += len;
        });
        // 批注按所在段落的配额落到对应页
        const assigned = new Array(PAGES + 1).fill(0);
        rawAnnos.forEach((a, i) => {
          if (typeof a._paraIdx === 'number') {
            // 补出来的润色：直接用它所属段落映射到的页码，避免全堆到最后一页
            a.page = pageOfPara[Math.min(pageOfPara.length - 1, a._paraIdx)] || 1;
          } else {
            // 模型原始批注：按数组中的相对位置映射到段落
            const paraIdx = Math.min(paras.length - 1,
              Math.floor((i / rawAnnos.length) * Math.max(1, paras.length)));
            a.page = pageOfPara[paraIdx] || 1;
          }
          assigned[a.page]++;
        });
        // 保证：至少让第 2 页起各拿到 1 条（若模型给得够多）
        for (let p = 2; p <= PAGES; p++) {
          if (!assigned[p] && rawAnnos.length >= PAGES) {
            // 从第 1 页借一条最靠后的批注过来
            for (let j = rawAnnos.length - 1; j >= 0; j--) {
              if (pageOf(rawAnnos[j]) === 1) { rawAnnos[j].page = p; assigned[p]++; assigned[1]--; break; }
            }
          }
        }
      }

      /* 润色批注按段落跟随到对应页：
       * 补出来的润色带 _paraIdx，如果它默认落在第 1 页、而所点评的段落在后面的页，
       * 就把它挪到该段落所在页，避免「后面的页有字、批注却全在前面」。 */
      const lens2 = paras.map(p => String(p).length);
      const totalLen2 = lens2.reduce((a, b) => a + b, 0) || 1;
      const pageOfPara2 = [];
      let acc2 = 0;
      lens2.forEach(len => {
        const mid = (acc2 + len / 2) / totalLen2;
        pageOfPara2.push(Math.min(PAGES, Math.floor(mid * PAGES) + 1));
        acc2 += len;
      });
      rawAnnos.forEach(a => {
        if (typeof a._paraIdx === 'number' && a.type === 'polish') {
          const want = pageOfPara2[Math.min(pageOfPara2.length - 1, a._paraIdx)] || 1;
          // 只在模型没给这位润色明确页码时才搬
          const declaredPage = parseInt(a.page, 10);
          if (!declaredPage || declaredPage === 1) a.page = want;
        }
      });
    }

    const CAP_TOTAL = PAGES <= 1 ? 10 : Math.min(18, PAGES * 6);   // 单页 10 条；多页平均每页 5~6 条
    const CAP_MIN_PAGE = PAGES <= 1 ? 10 : 4;                       // 多页时每页至少争取 4 条

    /* 按类型保底：模型输出里 err 往往占大头且排在前面，
     * 纯按顺序截断会把润色/好句/删改挤掉，学生只看得到挑错、看不到"该怎么写"。
     * 这里先给每类留出底线名额，剩下的才按页均衡分。 */
    const TYPE_FLOOR = PAGES <= 1
      ? { polish: 3, good: 2, dele: 1, err: 3 }     // 单页 10 条：润色 3 + 好句 2 + 删改 1 + 病句 3
      : { polish: 3, good: 1, dele: 1, err: 3 };    // 多页：润色同样保底 3 条（可跨页），其余按页摊

    // 先按「类型保底」挑一批，保证润色不会被 err 挤占
    const floorPick = new Set();
    Object.keys(TYPE_FLOOR).forEach(t => {
      const need = TYPE_FLOOR[t];
      if (!need) return;
      // 同类里优先取「多页稿每页各留一条」，避免全落在第一页
      const same = rawAnnos.filter(a => a.type === t);
      if (!same.length) return;
      const byPage = new Map();
      same.forEach(a => {
        const p = pageOf(a);
        if (!byPage.has(p)) byPage.set(p, []);
        byPage.get(p).push(a);
      });
      // 轮转各页取，直到满足该类名额
      const pages = Array.from(byPage.keys()).sort((x, y) => x - y);
      let round = 0, taken = 0;
      while (taken < need) {
        let progressed = false;
        for (const p of pages) {
          if (taken >= need) break;
          const arr = byPage.get(p);
          if (arr[round]) { floorPick.add(arr[round]); taken++; progressed = true; }
        }
        if (!progressed) break;
        round++;
      }
    });

    let annosPick;
    if (PAGES <= 1) {
      // 单页：先放保底的类型，再按原顺序补足到上限
      const picked = rawAnnos.filter(a => floorPick.has(a));
      for (const a of rawAnnos) {
        if (picked.length >= CAP_TOTAL) break;
        if (!floorPick.has(a)) picked.push(a);
      }
      // 保持原文出现顺序，编号才连贯
      annosPick = picked.slice(0, CAP_TOTAL)
        .sort((x, y) => rawAnnos.indexOf(x) - rawAnnos.indexOf(y));
    } else {
      const buckets = new Map();
      for (let p = 1; p <= PAGES; p++) buckets.set(p, []);
      rawAnnos.forEach(a => buckets.get(pageOf(a)).push(a));

      /* 按页配额：
       * 0) 类型保底优先：floorPick 里的（润色/好句/删改等）必须优先占位，
       *    否则每页前若干条全被 err 占满，润色会被系统性挤掉；
       * 1) 每页先保底 CAP_MIN_PAGE 条；某页本身就不足这么多，有多少取多少；
       * 2) 剩余名额优先补给「条数少的页」，让各页尽量均衡；
       * 3) 全部页内都取完了还有空额，才允许前面的页继续加。 */
      const quota = new Map();
      for (let p = 1; p <= PAGES; p++) quota.set(p, 0);

      // 第 0 步：先把类型保底的批注占进各自页的名额
      let used = 0;
      const floorByPage = new Map();
      for (let p = 1; p <= PAGES; p++) floorByPage.set(p, []);
      rawAnnos.forEach(a => {
        if (!floorPick.has(a)) return;
        const p = pageOf(a);
        if (floorByPage.get(p).length >= CAP_TOTAL - used) return;
        floorByPage.get(p).push(a);
      });
      for (let p = 1; p <= PAGES; p++) {
        const want = floorByPage.get(p).length;
        const take = Math.min(want, CAP_TOTAL - used);
        quota.set(p, take);
        used += take;
      }

      // 第 1 步：保底（保底名额已含在配额里，只补差额）
      for (let p = 1; p <= PAGES; p++) {
        const b = buckets.get(p);
        const need = Math.min(CAP_MIN_PAGE, b.length);
        if (quota.get(p) < need && used < CAP_TOTAL) {
          const add = Math.min(need - quota.get(p), CAP_TOTAL - used);
          quota.set(p, quota.get(p) + add);
          used += add;
        }
      }
      // 第 2 步：均衡补足（每轮给当前最少的那几页各加 1 条）
      let guard = 0;
      while (used < CAP_TOTAL && guard++ < 200) {
        // 找「还有余量」的页里当前配额最小的
        let target = -1, minQ = Infinity;
        for (let p = 1; p <= PAGES; p++) {
          const b = buckets.get(p);
          if (quota.get(p) >= b.length) continue;      // 这页已经没内容可取
          const q = quota.get(p);
          if (q < minQ) { minQ = q; target = p; }
        }
        if (target === -1) break;                       // 所有页都取完了
        quota.set(target, quota.get(target) + 1);
        used++;
      }

      // 第 3 步：按配额取——先放该页的类型保底，再按顺序补足，最后还原原文顺序
      annosPick = [];
      for (let p = 1; p <= PAGES; p++) {
        const b = buckets.get(p);
        const q = quota.get(p);
        if (!q) continue;
        const floorSet = new Set(floorByPage.get(p));
        const take = [];
        b.forEach(a => { if (floorSet.has(a) && take.length < q) take.push(a); });
        for (const a of b) {
          if (take.length >= q) break;
          if (!floorSet.has(a) && !take.includes(a)) take.push(a);
        }
        // 还原到该页内的原始出现顺序
        take.sort((x, y) => b.indexOf(x) - b.indexOf(y));
        annosPick = annosPick.concat(take);
      }
    }
    /* 坐标换算：
     * 关键缺陷 —— 旧代码对缺失/非法坐标一律兜底成 (0.08, 0.08, 0.22, 0.035)，
     * 于是所有「模型没给坐标」的批注全都叠在纸面同一处（表现为彩色方格堆成一团、
     * 且因为完全重合，只有一个能点到，其余点不到也拖不动）。
     * 新策略：
     *   1) 坐标齐全且合法 → 原样使用，视为可定位；
     *   2) 坐标缺失/越界/宽高为 0 → 标记 located=false，并且【不画方格】，
     *      只在批注卡里呈现文字（学生仍能读到该条意见），
     *      这样既不会在纸面留下一个假位置的格子，也不会互相压叠导致无法选中。 */
    const isNum = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
    const validRect = a => {
      if (!isNum(a.x) || !isNum(a.y)) return null;
      const x = Number(a.x), y = Number(a.y);
      const w = isNum(a.w) ? Number(a.w) : NaN;
      const h = isNum(a.h) ? Number(a.h) : NaN;
      if (!(x >= 0 && x < 1) || !(y >= 0 && y < 1)) return null;
      if (!(w > 0) || !(h > 0)) return null;
      return {
        x: Math.min(0.995, x), y: Math.min(0.995, y),
        w: Math.max(0.012, Math.min(1 - Math.min(0.995, x), w)),
        h: Math.max(0.012, Math.min(1 - Math.min(0.995, y), h))
      };
    };

    // 页码先算好，编号按「页内顺序」排，保证每一页的编号都从 1 开始且连贯
    const seqOfPage = new Map();
    /* 最终去重：同一处引文、同一类型只保留一条批注。
     * 模型有时会把同一句话分别用 err 和 polish 点评一遍，学生看到两条指向同一句的意见
     * 会觉得重复；但「同一句的润色」和「同一句的挑错」视角不同，属于合理并存，
     * 所以去重键带上类型，避免把不同角度的意见误删。 */
    const seenQuote = new Set();
    const dedup = [];
    annosPick.forEach(a => {
      const q = String(a.quote || '').replace(/\s/g, '').slice(0, 20);
      const k = q ? (a.type + '|' + q) : '';
      if (k && seenQuote.has(k)) return;
      if (k) seenQuote.add(k);
      dedup.push(a);
    });
    const annos = dedup.map((a, i) => {
      const rect = validRect(a);
      const located = a.located !== false && !!rect;
      const pg = Math.max(1, Math.min(PAGES, parseInt(a.page, 10) || 1));
      const seq = (seqOfPage.get(pg) || 0) + 1;
      seqOfPage.set(pg, seq);
      // 未定位批注的卡片锚点：按页内序号均匀铺开，避免卡片叠在一起
      let anchorY = null;
      if (!located) {
        const totalOnPage = annosPick.filter(x =>
          Math.max(1, Math.min(PAGES, parseInt(x.page, 10) || 1)) === pg).length || 1;
        anchorY = (seq - 1 + 0.5) / totalOnPage;
      }
      return {
        id: 'a' + i, no: seq,
        page: pg,
        type: a.type,
        // 左右侧：按页内顺序左右交替，避免全堆一侧
        side: seq % 2 === 1 ? 'left' : 'right',
        html: `<b>“${escShort(a.quote, 26)}”</b>　${escShort(a.comment, 90)}`,
        para: i,
        stat: { good: '好句', err: '病句', polish: '润色', dele: '删改' }[a.type],
        located,
        // 未定位时坐标留空（不画方格），但给卡片一个独立的纵向锚点
        x: rect ? rect.x : null, y: rect ? rect.y : anchorY,
        w: rect ? rect.w : null, h: rect ? rect.h : null,
        noLoc: !located
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

  /* ---------- 连接测试 ----------
   * 用一次最小的 chat/completions 请求探测，而不是 /models
   * （火山方舟、部分兼容网关并不提供 /models，用它测会误报失败）。
   * 返回 { ok, ms, reason }，reason 面向普通用户措辞。 */
  async function testConnection(cfg) {
    const base = String(cfg.base || '').replace(/\/+$/, '');
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);

    const body = {
      model: cfg.model,
      temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.1,
      max_tokens: 16,
      messages: [{ role: 'user', content: '只回复两个字：可用' }]
    };
    // 带上思考开关（若模型支持），和不支持时一样能通过
    const nm = String(cfg.model || '').toLowerCase();
    if (/doubao|seed|ark|volc|deepseek|qwen|glm|kimi/.test(nm)) {
      body.thinking = { type: cfg.thinking === true ? 'enabled' : 'disabled' };
    }

    try {
      let res = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      // 若因 thinking 字段被拒，去掉后重试一次
      if (!res.ok && (res.status === 400 || res.status === 422) && body.thinking) {
        const b2 = Object.assign({}, body); delete b2.thinking;
        try {
          const r2 = await fetch(base + '/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
            body: JSON.stringify(b2),
            signal: ctrl.signal
          });
          if (r2.ok) res = r2;
        } catch (e) {}
      }
      const ms = Date.now() - t0;
      if (res.ok) return { ok: true, ms };

      let detail = '';
      try {
        const j = await res.json();
        detail = (j.error && (j.error.message || j.error.code)) || j.message || '';
      } catch (e) {}

      const map = {
        401: 'API Key 无效或已过期，请检查是否复制完整',
        403: '这个 API Key 没有调用该模型的权限，请到控制台开通',
        404: detail
          ? `接口地址或模型名不对（${detail}）。地址一般以 /v1 或 /api/v3 结尾`
          : '接口地址或模型名不对，请检查地址结尾与模型名称',
        429: '调用太频繁或额度已用完，稍后再试或查看账户余额',
        500: '服务端出错，稍后重试',
        503: '服务暂时不可用，稍后重试'
      };
      const reason = map[res.status] || (detail ? `HTTP ${res.status}：${detail}` : `HTTP ${res.status}`);
      return { ok: false, reason };
    } catch (e) {
      const ms = Date.now() - t0;
      if (e && e.name === 'AbortError') {
        return { ok: false, reason: '30 秒内没有响应，请检查网络或接口地址' };
      }
      return { ok: false, reason: '网络不通：' + (e.message || '请检查网络连接或接口地址') };
    } finally {
      clearTimeout(timer);
    }
  }

  global.ZPAI = { grade, mode, readCfg, CFG_KEY, extractJSON, buildPrompt, testConnection };
})(window);
