/* 本地 mock OpenAI 兼容接口，用于验证前端 AI 批改链路
 * 启动：node mock-ai.js  （默认 8787 端口）
 */
const http = require('http');

const PORT = 8787;

const reply = {
  title: '那一刻，我长大了',
  paragraphs: [
    '窗外的梧桐叶被风翻了一下，露出背面浅浅的银色。',
    '我坐在书桌前，笔尖停在纸上，像被什么东西绊住了。',
    '那天下午发生的事，一遍一遍地在我眼前重演。',
    '妈妈在厨房里弯腰拣菜，背影像一张被岁月折过的纸。',
    '我忽然想走过去，帮她提一下那袋米，可我又坐回去了。',
    '现在想起来，心里像被什么轻轻撞了一下。'
  ],
  dimensions: {
    content: { ratio: 0.88, comment: '主题明确，选取生活小事切入，情感真挚，能围绕“长大”这一中心展开。' },
    structure: { ratio: 0.80, comment: '段落层次清楚，但中段铺垫稍长，高潮部分可再展开一点。' },
    language: { ratio: 0.85, comment: '用词准确，有比喻与细节描写；个别句子偏长，可适当断句。' },
    norm: { ratio: 0.92, comment: '标点使用规范，未见明显错别字，卷面整洁。' }
  },
  highlights: [
    { title: '开篇画面感强', detail: '“窗外的梧桐叶被风翻了一下，露出背面浅浅的银色。”以景物起笔，迅速把读者带入情境。' },
    { title: '细节真实可感', detail: '“妈妈在厨房里弯腰拣菜，背影像一张被岁月折过的纸。”比喻贴切，有生活的重量。' },
    { title: '结尾克制有余味', detail: '“现在想起来，心里像被什么轻轻撞了一下。”不喊口号，把感受留在动作里。' }
  ],
  issues: [
    { title: '中段略平，缺少一个“停住”的瞬间', severity: 'mid',
      desc: '从“坐回去”到“想要走过去”之间，心理变化写得偏快，读者来不及跟上。',
      quote: '我忽然想走过去，帮她提一下那袋米，可我又坐回去了。',
      fix: '在“坐回去”之前补一句犹豫：手已经撑在桌沿，又慢慢收回来。' },
    { title: '长句偏多，节奏可以更松', severity: 'low',
      desc: '部分句子超过 40 字未断句，朗读时容易一口气读不完。',
      quote: '那天下午发生的事，一遍一遍地在我眼前重演。',
      fix: '拆成两句，让停顿落在“下午”之后。' },
    { title: '“的/地/得”需通读一遍', severity: 'low',
      desc: '修饰动词应使用“地”，文中有一两处混用。', quote: '', fix: '通读一遍，重点检查这三类助词。' }
  ],
  annotations: [
    { type: 'good', quote: '窗外的梧桐叶被风翻了一下，露出背面浅浅的银色。', comment: '以景入题，画面干净，是很好的开头方式。', x: 0.08, y: 0.10, w: 0.80 },
    { type: 'err', quote: '笔尖停在纸上，像被什么东西绊住了', comment: '"绊住"多用于脚步，用于笔尖搭配不当，可改为"像被什么按住了"。', x: 0.06, y: 0.20, w: 0.80 },
    { type: 'err', quote: '妈妈的背影像一张被岁月折过的纸', comment: '此句缺谓语中心，"妈妈的背影"后应补"像"，或改为"妈妈的背影，像一张…"。', x: 0.06, y: 0.30, w: 0.80 },
    { type: 'err', quote: '可我又坐回去了', comment: '"坐回去"与前文"想走过去"形成反差，但缺少过渡，建议补一句心理活动。', x: 0.06, y: 0.40, w: 0.80 },
    { type: 'polish', quote: '心里像被什么轻轻撞了一下', comment: '可把"什么"具体化，例如"像被一只温热的手轻轻按了一下"，更有触感。', x: 0.08, y: 0.50, w: 0.78 },
    { type: 'polish', quote: '水很凉，碗很多，我却洗得很有耐心', comment: '三个短句可改为一句有节奏的长句："水凉得刺手，碗一层层码着，我却洗得很慢。"', x: 0.08, y: 0.60, w: 0.78 },
    { type: 'polish', quote: '妈妈站在门口看我，什么也没说，只是笑了一下', comment: '可补一个细节："她把手在围裙上擦了擦"，画面会更完整。', x: 0.08, y: 0.70, w: 0.78 },
    { type: 'dele', quote: '那天下午发生的事，一遍一遍地在我眼前重演。', comment: '与本段其他句子信息重复，可删去，直接进入细节。', x: 0.06, y: 0.80, w: 0.80 }
  ],
  review: '这篇文章最打动我的，是它的真诚。你没有堆砌好词好句，而是把一个真实的下午写了下来——梧桐叶、厨房里的背影、想帮忙又坐回去的那点犹豫，都是有生活重量的细节。开篇以景物起笔，“露出背面浅浅的银色”一句，镜头感很好；结尾把感受收在“轻轻撞了一下”里，克制而有回味，这是同年龄段里比较难得的自觉。<br><br>需要提高的地方有三点。第一，中段的心理转折偏快。“想走过去”与“坐回去”之间，读者还没跟上你的犹豫，建议在这里放慢，补一个具体的动作，比如手已经撑在桌沿，又慢慢收回来。第二，长句偏多，朗读时容易喘，可以在转折处断开。第三，“的/地/得”还有混用，通读一遍即可解决。<br><br>整体看，这篇作文已经具备一类文的底子：有画面、有真情、有结构意识。下一步只要在“细节的密度”和“句子的节奏”上再打磨，分数还能往上走。'
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ data: [{ id: 'mock-vision' }] }));
  }

  if (req.url === '/v1/chat/completions' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let hasImage = false;
      try {
        const j = JSON.parse(body);
        hasImage = JSON.stringify(j).includes('image_url');
      } catch (e) {}
      console.log('[mock] 收到批改请求, 含图片:', hasImage);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(reply) } }]
      }));
    });
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Mock AI 已启动: http://127.0.0.1:' + PORT + '/v1');
});
