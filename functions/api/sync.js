const MAX_BODY = 3_000_000; // 3MB, generoso para o JSON do app
const MIN_CODE_LEN = 8;
const BACKUP_TTL = 60 * 60 * 24 * 60; // backups diários ficam 60 dias
const SHRINK_MIN_EXISTING = 20;       // só protege contas que já têm dados de verdade
const SHRINK_RATIO = 0.25;            // gravação com <25% dos registros da nuvem é recusada

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  // nunca deixa CDN/navegador cachear — cada leitura precisa refletir a última gravação
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

function badRequest(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: JSON_HEADERS,
  });
}

function validCode(code) {
  return typeof code === 'string' && code.length >= MIN_CODE_LEN && code.length <= 128;
}

// Total de registros "de verdade" (o que importa perder): receitas, despesas, cartões, lançamentos, investimentos
function countRecords(d) {
  if (!d || typeof d !== 'object') return 0;
  return ['receitas', 'despesas', 'cartoes', 'lancs', 'invest']
    .reduce((a, k) => a + (Array.isArray(d[k]) ? d[k].length : 0), 0);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!validCode(code)) return badRequest(`code precisa ter pelo menos ${MIN_CODE_LEN} caracteres`);

  // ?bak=AAAA-MM-DD devolve o backup diário daquele dia (a versão que existia ANTES da 1ª gravação do dia)
  const bak = url.searchParams.get('bak');
  if (bak) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bak)) return badRequest('bak precisa ser AAAA-MM-DD');
    const b = await env.SYNC_KV.get(`bak:${code}:${bak}`);
    return new Response(b || 'null', { headers: JSON_HEADERS });
  }

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

  let incoming;
  try {
    incoming = JSON.parse(text);
  } catch {
    return badRequest('JSON inválido');
  }

  const key = `sync:${code}`;
  const existingText = await env.SYNC_KV.get(key);

  if (existingText) {
    // Trava: um aparelho com dados vazios/desatualizados não pode sobrescrever uma nuvem cheia.
    // (force=1 existe só pra reset intencional feito à mão.)
    if (url.searchParams.get('force') !== '1') {
      let existing = null;
      try { existing = JSON.parse(existingText); } catch {}
      const before = countRecords(existing);
      const after = countRecords(incoming);
      if (before >= SHRINK_MIN_EXISTING && after < before * SHRINK_RATIO) {
        return badRequest(`gravação recusada: ${after} registros contra ${before} na nuvem`, 409);
      }
    }

    // Backup diário: guarda a versão anterior na 1ª gravação de cada dia (UTC).
    const day = new Date().toISOString().slice(0, 10);
    const bakKey = `bak:${code}:${day}`;
    if (!(await env.SYNC_KV.get(bakKey))) {
      await env.SYNC_KV.put(bakKey, existingText, { expirationTtl: BACKUP_TTL });
    }
  }

  await env.SYNC_KV.put(key, text);
  return new Response(JSON.stringify({ ok: true }), {
    headers: JSON_HEADERS,
  });
}
