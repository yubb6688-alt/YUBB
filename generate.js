const ALLOWED_STAGES = new Set(['认知', '兴趣', '购买', '忠诚']);
const TIMEOUT_MS = 60_000;

function jsonResponse(res, statusCode, body) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(body);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readRequestBody(req) {
  if (req.body !== undefined) return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function characterCount(value) {
  return Array.from(value).length;
}

function validateInputs(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return '请填写完整信息。';
  const productName = typeof body.product_name === 'string' ? body.product_name.trim() : '';
  const sellingPoint = typeof body.selling_point === 'string' ? body.selling_point.trim() : '';
  const stage = typeof body.stage === 'string' ? body.stage : '';

  if (!productName) return '请填写商品名。';
  if (characterCount(productName) > 30) return '商品名最多 30 字，请修改后重试。';
  if (!sellingPoint) return '请填写核心卖点。';
  if (characterCount(sellingPoint) > 100) return '核心卖点最多 100 字，请修改后重试。';
  if (!ALLOWED_STAGES.has(stage)) return '营销段请选择认知、兴趣、购买或忠诚。';
  return { product_name: productName, selling_point: sellingPoint, stage };
}

module.exports = async function generate(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return jsonResponse(res, 405, { message: '请使用正确的请求方式。' });
  }

  const body = await readRequestBody(req);
  const inputs = validateInputs(body);
  if (typeof inputs === 'string') return jsonResponse(res, 400, { message: inputs });

  const apiBase = process.env.DIFY_API_BASE;
  const apiKey = process.env.DIFY_API_KEY;
  if (!apiBase || !apiKey) {
    return jsonResponse(res, 500, { message: '服务尚未配置完成，请联系管理员。' });
  }

  const endpoint = `${apiBase.replace(/\/+$/, '')}/workflows/run`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs, response_mode: 'blocking', user: 'xiaozhou-web' }),
      signal: controller.signal,
    });

    if (!upstream.ok) return jsonResponse(res, 502, { message: '标题生成失败，请稍后重试。' });

    const payload = await upstream.json();
    const outputs = payload && payload.data && payload.data.outputs;
    if (outputs && typeof outputs.title === 'string' && outputs.title.trim()) {
      return jsonResponse(res, 200, { kind: 'safe', title: outputs.title });
    }
    if (outputs && typeof outputs.verdict === 'string' && typeof outputs.draft === 'string') {
      return jsonResponse(res, 200, { kind: 'review', verdict: outputs.verdict, draft: outputs.draft });
    }
    return jsonResponse(res, 502, { message: '标题生成失败，请稍后重试。' });
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return jsonResponse(res, 504, { message: '请再试一次' });
    }
    return jsonResponse(res, 502, { message: '标题生成失败，请稍后重试。' });
  } finally {
    clearTimeout(timeout);
  }
};
