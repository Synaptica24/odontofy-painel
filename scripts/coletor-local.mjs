// Servidor local que recebe, do navegador logado no Codental, as páginas/arquivos lidos (só leitura lá)
// e grava em data/codental/ (pasta no .gitignore: dados de pacientes nunca vão para o git).
// Uso: node scripts/coletor-local.mjs   (porta 3011)
//   GET  /ok                      → "ok"
//   GET  /ids                     → JSON com os codental_id do CSV exportado
//   POST /salvar?nome=<caminho>   → grava o corpo (texto ou binário) em data/codental/<caminho>
//   GET  /existe?nome=<caminho>   → {existe:boolean, tamanho}
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const RAIZ = join(process.cwd(), 'data', 'codental');
mkdirSync(RAIZ, { recursive: true });

function caminhoSeguro(nome) {
  const limpo = normalize(nome).replace(/^([.\\/]+)/, '').replace(/\.\./g, '');
  return join(RAIZ, limpo);
}
function idsDoCsv() {
  const csv = readFileSync(join(process.cwd(), 'data', 'codental-patients.csv'), 'utf8');
  const linhas = csv.split(/\r?\n/).filter(Boolean).slice(1);
  return linhas.map((l) => l.split(/[;,]/)[0].replace(/"/g, '').trim()).filter((v) => /^\d+$/.test(v));
}

const servidor = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Allow-Local-Network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/ok') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (req.method === 'GET' && url.pathname === '/extrator.js') { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(readFileSync(join(process.cwd(), 'scripts', 'codental-extrator.browser.js'))); }
  if (req.method === 'GET' && url.pathname === '/ids') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(idsDoCsv())); }
  if (req.method === 'GET' && url.pathname === '/existe') {
    const c = caminhoSeguro(url.searchParams.get('nome') || '');
    const existe = existsSync(c);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ existe, tamanho: existe ? statSync(c).size : 0 }));
  }
  if (req.method === 'POST' && url.pathname === '/salvar') {
    const nome = url.searchParams.get('nome');
    if (!nome) { res.writeHead(400); return res.end('nome?'); }
    const partes = [];
    req.on('data', (p) => partes.push(p));
    req.on('end', () => {
      const c = caminhoSeguro(nome);
      mkdirSync(dirname(c), { recursive: true });
      const corpo = Buffer.concat(partes);
      writeFileSync(c, corpo);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, tamanho: corpo.length }));
    });
    return;
  }
  res.writeHead(404); res.end();
});
servidor.listen(3011, '127.0.0.1', () => console.log('coletor em http://localhost:3011 → ' + RAIZ));
