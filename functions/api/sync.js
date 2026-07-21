const MAX_BODY = 3_000_000; // 3MB, generoso para o JSON do app
const MIN_CODE_LEN = 8;

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  // nunca deixa CDN/navegador cachear — cada leitura precisa refletir a última gravação
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

function badRequest(msg) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: JSON_HEADERS,
  });
}

function validCode(code) {
  return typeof code === 'string' && code.length >= MIN_CODE_LEN && code.length <= 128;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!validCode(code)) return badRequest(`code precisa ter pelo menos ${MIN_CODE_LEN} caracteres`);

  const stored = await env.SYNC_KV.get(`sync:${code}`);
  return new Response(stored || 'null', {
    headers: JSON_HEADERS,
  });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!validCode(code)) return badRequest(`code precisa ter pelo menos ${MIN_CODE_LEN} caracteres`);

  const text = await request.text();
  if (!text) return badRequest('corpo vazio');
  if (text.length > MAX_BODY) return badRequest('payload grande demais');

  try {
    JSON.parse(text);
  } catch {
    return badRequest('JSON inválido');
  }

  await env.SYNC_KV.put(`sync:${code}`, text);
  return new Response(JSON.stringify({ ok: true }), {
    headers: JSON_HEADERS,
  });
}
