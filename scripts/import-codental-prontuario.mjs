/**
 * Importa o prontuário extraído do Codental (data/codental/, gerado por scripts/codental-extrator.browser.js + coletor-local.mjs)
 * para o Supabase do consultório real: consultas e bloqueios (agenda), evoluções, tratamentos (odontograma), orçamentos e itens,
 * pagamentos, anamneses respondidas, receitas/atestados (registro) e arquivos (Storage "prontuario" + anexos).
 *
 * Uso:
 *   node scripts/import-codental-prontuario.mjs                 # tudo
 *   node scripts/import-codental-prontuario.mjs --dry-run       # só conta, não grava
 *   node scripts/import-codental-prontuario.mjs --so-agenda | --so-fichas | --sem-arquivos | --paciente 3734185
 *
 * Idempotente: cada linha guarda codental_id; o que já existe não é inserido de novo (consultas têm o status atualizado).
 * Nunca escreve no Codental. Lê credenciais só de .env.local.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const dryRun = flag("--dry-run");
const soAgenda = flag("--so-agenda"), soFichas = flag("--so-fichas"), semArquivos = flag("--sem-arquivos");
const soPaciente = args.includes("--paciente") ? args[args.indexOf("--paciente") + 1] : null;
const RAIZ = new URL("../data/codental/", import.meta.url);
const CONSULTORIO = "f0bf5c31-1e88-47b6-8b3c-fe93f0e1a901"; // Consultório Dr. Mateus Peixoto (real)

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const rel = { consultas: { novas: 0, atualizadas: 0, sem_paciente: 0, conflitos: 0 }, bloqueios: { novos: 0, conflitos: 0 }, evolucoes: 0, odontograma: 0, orcamentos: 0, itens: 0, pagamentos: 0, anamneses: 0, documentos: 0, arquivos: { enviados: 0, existentes: 0, erros: 0 }, notas: 0, fichas_lidas: 0, fichas_sem_paciente: 0, erros: [] };
const erro = (m) => { rel.erros.push(m); if (rel.erros.length <= 30) console.error("  !", m); };

/* ---------- mapas ---------- */
async function todas(tabela, colunas, filtro) {
  const out = []; let de = 0;
  for (;;) {
    let q = admin.from(tabela).select(colunas).eq("consultorio_id", CONSULTORIO).range(de, de + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabela}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
    de += 1000;
  }
}
const pacientes = new Map((await todas("pacientes", "id,codental_id", (q) => q.not("codental_id", "is", null))).map((p) => [String(p.codental_id), p.id]));
const profissionais = await todas("profissionais", "id,nome,ordem");
const profissional = (profissionais.find((p) => /mateus/i.test(p.nome)) ?? profissionais[0])?.id ?? null;
console.log(`pacientes com codental_id: ${pacientes.size} · profissional: ${profissional ? "ok" : "nenhum (fica nulo)"} · ${dryRun ? "DRY-RUN" : "gravando"}`);
const existentes = async (tabela) => new Map((await todas(tabela, "id,codental_id", (q) => q.not("codental_id", "is", null))).map((r) => [Number(r.codental_id), r.id]));

async function inserir(tabela, linhas, lote = 100) {
  if (dryRun || !linhas.length) return linhas.map(() => null);
  const ids = [];
  for (let i = 0; i < linhas.length; i += lote) {
    const parte = linhas.slice(i, i + lote);
    const { data, error } = await admin.from(tabela).insert(parte).select("id");
    if (error) {
      // um por um para isolar a linha com problema (ex.: sobreposição de horário)
      for (const l of parte) {
        const r = await admin.from(tabela).insert(l).select("id").single();
        if (r.error) { ids.push({ erro: r.error }); } else ids.push(r.data.id);
      }
    } else ids.push(...data.map((d) => d.id));
  }
  return ids;
}
const sp = (iso) => (iso ? (/[+-]\d{2}:\d{2}$|Z$/.test(iso) ? iso : `${iso}${iso.includes("T") ? "" : "T12:00:00"}-03:00`) : null);
const dente = (s) => { const m = /(\d{2})/.exec(s || ""); const n = m ? Number(m[1]) : null; return n && n >= 11 && n <= 48 && n % 10 >= 1 && n % 10 <= 8 ? n : null; };
const dentes = (s) => [...(s || "").matchAll(/\b(\d{2})\b/g)].map((m) => Number(m[1])).filter((n) => n >= 11 && n <= 48 && n % 10 >= 1 && n % 10 <= 8);
const reais = (s) => { const m = /([\d.]+),(\d{2})/.exec(s || ""); return m ? Number(m[1].replace(/\./g, "") + "." + m[2]) : 0; };

/* ---------- agenda ---------- */
async function agenda() {
  const arq = new URL("agenda/events.json", RAIZ);
  if (!existsSync(arq)) { console.log("agenda/events.json não existe; pulando agenda"); return; }
  const eventos = JSON.parse(readFileSync(arq, "utf8"));
  const agora = Date.now();
  const STATUS = { scheduled: "agendado", confirmed: "confirmado", finished: "concluido", patient_attendance: "concluido", missed: "faltou", canceled_by_the_patient: "cancelado", canceled_by_the_professional: "cancelado" };
  const jaConsultas = await existentes("agendamentos");
  const jaBloqueios = await existentes("bloqueios");
  const novas = [], atualizar = [];
  for (const e of eventos.filter((e) => e.type === "Appointment")) {
    const pac = pacientes.get(String(e.patient_id));
    if (!pac) { rel.consultas.sem_paciente++; continue; }
    let status = STATUS[e.status_enum] ?? "agendado";
    const passou = Date.parse(e.end) < agora;
    if (passou && (status === "agendado" || status === "confirmado")) status = "concluido"; // o Codental não marca presença em tudo; consulta passada e não cancelada = aconteceu
    const linha = {
      consultorio_id: CONSULTORIO, paciente_id: pac, tipo: "Consulta", inicio: e.start, fim: e.end, status,
      confirmado_em: status === "confirmado" ? e.start : null, origem: "codental", observacao: (e.observations || "").trim(),
      paciente_novo: !!e.first_appointment, profissional_id: profissional, codental_id: e.id,
    };
    if (jaConsultas.has(e.id)) atualizar.push({ id: jaConsultas.get(e.id), status, confirmado_em: linha.confirmado_em, observacao: linha.observacao });
    else novas.push(linha);
  }
  const ids = await inserir("agendamentos", novas);
  for (const r of ids) { if (r && r.erro) { rel.consultas.conflitos++; erro(`consulta: ${r.erro.message.slice(0, 120)}`); } else rel.consultas.novas++; }
  if (!dryRun) for (const u of atualizar) { const { error } = await admin.from("agendamentos").update({ status: u.status, confirmado_em: u.confirmado_em, observacao: u.observacao }).eq("id", u.id); if (!error) rel.consultas.atualizadas++; }
  else rel.consultas.atualizadas = atualizar.length;

  const blocos = [];
  for (const e of eventos.filter((e) => e.type === "Compromise")) {
    if (jaBloqueios.has(e.id) || !e.start || !e.end) continue;
    blocos.push({ consultorio_id: CONSULTORIO, inicio: e.start, fim: e.end, motivo: e.private_title ? "Compromisso" : (e.title || "Compromisso").trim(), profissional_id: profissional, codental_id: e.id });
  }
  const idsB = await inserir("bloqueios", blocos);
  for (const r of idsB) { if (r && r.erro) { rel.bloqueios.conflitos++; } else rel.bloqueios.novos++; }
  if (dryRun) { rel.consultas.novas = novas.length; rel.bloqueios.novos = blocos.length; }
}

/* ---------- fichas ---------- */
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", gif: "image/gif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff", pdf: "application/pdf", dcm: "application/dicom", mp4: "video/mp4", mov: "video/quicktime", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", txt: "text/plain" };
const mimeDe = (nome, dica) => MIME[(nome.split(".").pop() || "").toLowerCase()] ?? (dica && dica !== "image/png" ? dica : "application/octet-stream");
const categoria = (mime, nome) => (/^image\//.test(mime) ? (/raio|rx|radio|pano|peri/i.test(nome) ? "raio_x" : "foto") : mime === "application/pdf" ? "documento" : "outro");

async function fichas() {
  const dir = new URL("pacientes/", RAIZ);
  if (!existsSync(dir)) { console.log("pacientes/ não existe; pulando fichas"); return; }
  const arquivos = readdirSync(dir).filter((f) => f.endsWith(".json") && (!soPaciente || f === `${soPaciente}.json`));
  const [jaEv, jaOd, jaOrc, jaPag, jaAna, jaAnx] = await Promise.all(["evolucoes", "odontograma", "orcamentos", "pagamentos", "anamneses_respostas", "anexos"].map(existentes));
  const jaDocs = new Set((await todas("documentos_emitidos", "origem_url")).map((d) => d.origem_url));
  const orcUuid = new Map(jaOrc); // codental quote id → uuid (preenchido com os novos também)

  for (const f of arquivos) {
    const p = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    const pac = pacientes.get(String(p.id));
    rel.fichas_lidas++;
    if (!pac) { rel.fichas_sem_paciente++; continue; }
    const base = { consultorio_id: CONSULTORIO, paciente_id: pac };

    if (p.notas && p.notas.trim()) { rel.notas++; if (!dryRun) await admin.from("pacientes").update({ notas_codental: p.notas.trim() }).eq("id", pac); }

    // orçamentos primeiro: pagamentos e tratamentos apontam para eles
    for (const o of p.orcamentos || []) {
      if (!o.id || orcUuid.has(o.id)) continue;
      const st = /aprovado/i.test(o.status) ? "aprovado" : /recusado|reprovado|cancelado/i.test(o.status) ? "recusado" : "pendente";
      const linha = { ...base, titulo: (o.titulo || "Plano de tratamento").slice(0, 200), status: st, desconto: reais(o.resumo?.desconto), observacao: [o.resumo?.observacao, o.resumo?.entrada ? `Entrada ${o.resumo.entrada}` : null, o.resumo?.parcelas ? `${o.resumo.parcelas} parcela(s)` : null].filter(Boolean).join(" · "), valor_total: o.total, criado_em: sp(o.data) ?? new Date().toISOString(), atualizado_em: sp(o.data) ?? new Date().toISOString(), decidido_em: st !== "pendente" ? sp(o.data) : null, codental_id: o.id, codental_numero: o.numero ? String(o.numero) : "" };
      const [id] = await inserir("orcamentos", [linha]);
      if (id && id.erro) { erro(`orçamento ${o.id}: ${id.erro.message}`); continue; }
      rel.orcamentos++;
      if (id) orcUuid.set(o.id, id);
      const itens = (o.itens || []).map((it, i) => ({ consultorio_id: CONSULTORIO, orcamento_id: id, descricao: (it.tratamento || "Tratamento").slice(0, 200), dente: dente(it.dente), faces: it.faces || "", quantidade: 1, valor_unitario: it.valor ?? 0, ordem: i }));
      if (id) { const r = await inserir("orcamento_itens", itens); rel.itens += r.filter((x) => !(x && x.erro)).length; } else rel.itens += itens.length;
    }

    const ev = (p.evolucoes || []).filter((e) => e.id && !jaEv.has(e.id)).map((e) => ({ ...base, texto: (e.texto || "").trim() || `${e.procedimento ?? "Evolução"}${e.dente ? ` · ${e.dente}` : ""}`, criado_em: sp(e.data) ?? new Date().toISOString(), profissional_id: profissional, codental_id: e.id }));
    const rEv = await inserir("evolucoes", ev); rel.evolucoes += dryRun ? ev.length : rEv.filter((x) => !(x && x.erro)).length;

    const od = [];
    for (const t of p.tratamentos || []) {
      if (!t.id || t.cancelado) continue;
      const ds = dentes(t.dentes);
      ds.forEach((d, i) => { const cid = t.id * 100 + i; if (jaOd.has(cid)) return; od.push({ ...base, dente: d, face: "todas", procedimento: (t.nome || "Tratamento").slice(0, 200), status: t.finalizado ? "realizado" : "planejado", observacao: [t.convenio, t.orcamento ? `Orç. #${t.orcamento}` : null].filter(Boolean).join(" · "), valor: t.valor ?? 0, profissional_id: profissional, registrado_em: sp(t.data) ?? new Date().toISOString(), realizado_em: t.finalizado ? sp(t.data) : null, codental_id: cid }); });
    }
    const rOd = await inserir("odontograma", od); rel.odontograma += dryRun ? od.length : rOd.filter((x) => !(x && x.erro)).length;

    const pg = (p.pagamentos?.linhas || []).filter((l) => l.id && !jaPag.has(l.id)).map((l) => ({ ...base, orcamento_id: l.orcamento ? orcUuid.get(l.orcamento) ?? null : null, descricao: (l.titulo || "Pagamento").slice(0, 200), valor: l.valor ?? 0, vencimento: l.vencimento, status: l.pago_em ? "pago" : /atras/i.test(l.status) ? "atrasado" : /pago/i.test(l.status) ? "pago" : "pendente", pago_em: l.pago_em && l.pago_em !== "true" ? sp(l.pago_em) : (/pago/i.test(l.status) ? sp(l.vencimento) : null), recibo: !!l.recibo, codental_id: l.id }));
    const rPg = await inserir("pagamentos", pg); rel.pagamentos += dryRun ? pg.length : rPg.filter((x) => !(x && x.erro)).length;

    const an = (p.anamneses || []).filter((a) => a.id && !jaAna.has(a.id)).map((a) => ({ ...base, modelo: (a.modelo || "Anamnese").slice(0, 200), respostas: (a.respostas || []).map((r) => ({ pergunta: r.pergunta, resposta: r.resposta, pelo_paciente: !!r.pelo_paciente })), assinada: !!a.assinada, criado_em: sp(a.criado) ?? new Date().toISOString(), atualizado_em: sp(a.atualizado) ?? sp(a.criado) ?? new Date().toISOString(), codental_id: a.id }));
    const rAn = await inserir("anamneses_respostas", an); rel.anamneses += dryRun ? an.length : rAn.filter((x) => !(x && x.erro)).length;

    const docs = (p.documentos || []).filter((d) => d.url && !jaDocs.has(d.url)).map((d) => ({ ...base, tipo: (d.tipo || "documento").slice(0, 60), resumo: (d.resumo || "").slice(0, 2000), origem_url: d.url }));
    const rDc = await inserir("documentos_emitidos", docs); rel.documentos += dryRun ? docs.length : rDc.filter((x) => !(x && x.erro)).length;

    if (!semArquivos) {
      for (const a of p.arquivos || []) {
        if (!a.id || !a.local) continue;
        if (jaAnx.has(a.id)) { rel.arquivos.existentes++; continue; }
        const local = new URL(a.local, RAIZ);
        if (!existsSync(local)) { rel.arquivos.erros++; erro(`arquivo ${a.id} não baixado`); continue; }
        const mime = mimeDe(a.nome, a.tipo);
        const caminho = `${CONSULTORIO}/${pac}/codental-${a.id}-${a.nome.replace(/[^\w.\-]/g, "_").slice(0, 120)}`;
        if (dryRun) { rel.arquivos.enviados++; continue; }
        const bytes = readFileSync(local);
        const up = await admin.storage.from("prontuario").upload(caminho, bytes, { contentType: mime, upsert: true });
        if (up.error) { rel.arquivos.erros++; erro(`storage ${a.id}: ${up.error.message}`); continue; }
        const { error } = await admin.from("anexos").insert({ ...base, nome: a.nome.slice(0, 200), tipo_mime: mime, categoria: categoria(mime, a.nome), caminho, tamanho: bytes.length, descricao: ["Importado do Codental", a.pasta ? `pasta: ${a.pasta}` : null].filter(Boolean).join(" · "), pasta: a.pasta || "", criado_em: sp(a.criado) ?? new Date().toISOString(), codental_id: a.id });
        if (error) { rel.arquivos.erros++; erro(`anexo ${a.id}: ${error.message}`); } else rel.arquivos.enviados++;
      }
    }
  }
}

if (!soFichas) await agenda();
if (!soAgenda) await fichas();
console.log(JSON.stringify({ ...rel, erros: rel.erros.length }, null, 1));
