// Mede, em produção, quanto demora cada chamada de dados do painel (server actions operacaoPainel e operacaoPainelLote).
// Uso: node scripts/medir-latencia.mjs <idOperacaoPainel> [url ou -] [idOperacaoPainelLote]. Os ids estão nos chunks de /hoje
// (procure createServerReference(... "operacaoPainel")). Não imprime cookie, senha nem dado de paciente.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const acao = process.argv[2];
const acaoLote = process.argv[4];
const base = process.argv[3] && process.argv[3] !== "-" ? process.argv[3] : "https://dr-mateus-peixoto.vercel.app";
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data, error } = await s.auth.signInWithPassword({ email: env.AUTH_EMAIL_PERMITIDO, password: env.DR_SENHA_INICIAL });
if (error) throw error;
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const valor = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
// @supabase/ssr divide em pedaços de ~3180 caracteres
const pedacos = valor.match(/.{1,3180}/g);
const cookie = pedacos.length === 1 ? `sb-${ref}-auth-token=${valor}` : pedacos.map((p, i) => `sb-${ref}-auth-token.${i}=${p}`).join("; ");

async function chamar(op, args = {}) {
  const t = performance.now();
  const r = await fetch(`${base}/hoje`, { method: "POST", headers: { Cookie: cookie, "Next-Action": acao, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify([op, args]) });
  const corpo = await r.text();
  return { op, ms: Math.round(performance.now() - t), http: r.status, ok: corpo.includes('"sucesso":true'), regiao: r.headers.get("x-vercel-id")?.split("::").slice(0, 2).join("→") };
}
// aquece a função
await chamar("lerConfig");
const ops = [["resumoDoDia", {}], ["lerConfig", {}], ["listarConversas", { status: "ativa", limite: 100 }], ["statusCampanha", {}], ["consumoDoMes", {}], ["listarPacientes", {}]];
const res = [];
for (const [op, a] of ops) res.push(await chamar(op, a));
console.table(res);
const t = performance.now();
await Promise.all(ops.slice(0, 5).map(([op, a]) => chamar(op, a)));
console.log("tela Hoje (5 chamadas ao mesmo tempo, como o navegador faz):", Math.round(performance.now() - t), "ms");
if (acaoLote) {
  const t2 = performance.now();
  const r = await fetch(`${base}/hoje`, { method: "POST", headers: { Cookie: cookie, "Next-Action": acaoLote, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify([ops.slice(0, 5).map(([operacao, argumentos]) => ({ operacao, argumentos }))]) });
  const corpo = await r.text();
  console.log("tela Hoje em LOTE (1 requisição):", Math.round(performance.now() - t2), "ms, http", r.status, ", ok:", (corpo.match(/"sucesso":true/g) ?? []).length, "de 5");
}
await s.auth.signOut();
