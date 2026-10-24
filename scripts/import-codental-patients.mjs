/**
 * Importa os pacientes exportados do Codental (CSV nativo "Baixar lista de pacientes em: CSV")
 * para a tabela public.pacientes do consultório real no Supabase.
 *
 * Uso:
 *   node scripts/import-codental-patients.mjs                 # importa data/codental-patients.csv
 *   node scripts/import-codental-patients.mjs --dry-run       # só valida e imprime a contagem
 *   node scripts/import-codental-patients.mjs caminho.csv     # outro arquivo
 *
 * Lê de .env.local: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (só servidor, nunca no front).
 * Upsert por (consultorio_id, codental_id): rodar de novo não duplica. O CSV fica em data/ (ignorado pelo git).
 * Nunca escreve no Codental: a origem é só o arquivo exportado.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const arquivo = args.find((a) => !a.startsWith("--")) ?? new URL("../data/codental-patients.csv", import.meta.url);

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/* ---------- CSV ---------- */
function parseCsv(texto) {
  const linhas = []; let linha = [], campo = "", aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) { if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; }
    else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const cabecalho = linhas[0].map((h) => h.replace(/^﻿/, "").trim());
  return linhas.slice(1).filter((l) => l.length > 1).map((l) => Object.fromEntries(cabecalho.map((h, i) => [h, (l[i] ?? "").trim()])));
}

/* ---------- normalização ---------- */
const digitos = (v) => (v ?? "").replace(/\D/g, "");
function e164(bruto) {
  const d = digitos(bruto);
  if (!d) return null;
  let n = d;
  if (!String(bruto).trim().startsWith("+") && (n.length === 10 || n.length === 11)) n = `55${n}`; // DDD + número sem país
  if (!/^[1-9][0-9]{7,14}$/.test(n)) return null;
  return `+${n}`;
}
function dataCivil(br) {                                            // dd/mm/aaaa -> aaaa-mm-dd
  const m = (br ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}
function dataHoraSP(br) {                                           // dd/mm/aaaa HH:MM em America/Sao_Paulo -> ISO
  const m = (br ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? "12"}:${m[5] ?? "00"}:00-03:00`;
}
const emailOk = (e) => !e || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const sexo = (v) => ({ masculino: "masculino", feminino: "feminino" })[(v ?? "").toLowerCase()] ?? (v ? "outro" : "");
function enderecoCompleto(r) {
  const rua = [r["Endereço"], r["Complemento"]].filter(Boolean).join(", ");
  const cidade = [r["Cidade"], r["Estado"]].filter(Boolean).join("/");
  return [rua, r["Bairro"], cidade, r["CEP"] ? `CEP ${r["CEP"]}` : ""].filter(Boolean).join(" - ");
}
const CORES = ["#1570EF", "#067647", "#B54708", "#7A5AF8", "#C11574", "#0E7090", "#B42318", "#3E4784"];

/* ---------- execução ---------- */
const linhas = parseCsv(readFileSync(arquivo, "utf8"));
const relatorio = { lidos: linhas.length, inseridos: 0, atualizados: 0, erros: 0, avisos: [] };
const erros = [];

const { data: consultorio, error: eC } = await admin.from("consultorios").select("id,nome").eq("demo", false).eq("principal", true).single();
if (eC) throw eC;
console.log(`Consultório destino: ${consultorio.nome} (${consultorio.id})${dryRun ? " — SIMULAÇÃO, nada será gravado" : ""}`);

// Convênios: 'Particular' = sem convênio; os demais nomes viram linhas em public.convenios (sem duplicar).
const nomesPlano = [...new Set(linhas.map((r) => r["Nome do plano"]).filter((n) => n && n.toLowerCase() !== "particular"))];
const { data: conveniosExistentes } = await admin.from("convenios").select("id,nome").eq("consultorio_id", consultorio.id);
const convenioPorNome = new Map((conveniosExistentes ?? []).map((c) => [c.nome.toLowerCase(), c.id]));
for (const nome of nomesPlano) {
  if (convenioPorNome.has(nome.toLowerCase())) continue;
  if (dryRun) { convenioPorNome.set(nome.toLowerCase(), `(novo) ${nome}`); continue; }
  const { data, error } = await admin.from("convenios").insert({ consultorio_id: consultorio.id, nome, cor: CORES[convenioPorNome.size % CORES.length] }).select("id").single();
  if (error) throw error;
  convenioPorNome.set(nome.toLowerCase(), data.id);
}
console.log(`Convênios: ${nomesPlano.length} no CSV (${nomesPlano.join(", ")})`);

// Quem já existe (para contar inserido x atualizado e para não brigar com telefones já cadastrados no painel).
const { data: existentes, error: eE } = await admin.from("pacientes").select("id,codental_id,telefone_e164").eq("consultorio_id", consultorio.id);
if (eE) throw eE;
const porCodental = new Map(existentes.filter((p) => p.codental_id).map((p) => [p.codental_id, p]));
const telefoneOcupadoPor = new Map(existentes.filter((p) => p.telefone_e164).map((p) => [p.telefone_e164, p.codental_id]));

// Telefones compartilhados: o número principal (telefone_e164) fica com o cadastro de agendamento mais recente;
// os outros guardam o mesmo número em telefone_contato para continuar aparecendo na ficha.
const donoDoTelefone = new Map();
for (const r of linhas) {
  const tel = e164(r["Celular"]);
  if (!tel) continue;
  const ultimo = dataHoraSP(r["Data do último agendamento"]) ?? "";
  const atual = donoDoTelefone.get(tel);
  if (!atual || ultimo > atual.ultimo) donoDoTelefone.set(tel, { id: r["ID"], ultimo });
}

const registros = [];
for (const r of linhas) {
  const id = r["ID"];
  const problemas = [];
  const nome = r["Nome completo"].replace(/\s+/g, " ").trim();
  if (!id) problemas.push("sem ID do Codental");
  if (!nome) problemas.push("sem nome");
  const cpf = digitos(r["CPF"]);
  if (cpf && cpf.length !== 11) problemas.push(`CPF com ${cpf.length} dígitos`);
  const email = r["E-mail"].toLowerCase();
  if (!emailOk(email)) problemas.push("e-mail inválido");
  const nascimento = dataCivil(r["Data de nascimento"]);
  if (r["Data de nascimento"] && !nascimento) problemas.push("data de nascimento inválida");
  const celular = e164(r["Celular"]);
  if (r["Celular"] && !celular) problemas.push("celular fora do padrão");
  if (problemas.length) { erros.push({ id, problemas }); relatorio.erros++; continue; }

  // Quem fica com o número principal: o dono escolhido acima, desde que ninguém fora da importação já o use.
  let telefonePrincipal = null, telefoneContato = "";
  if (celular) {
    const dono = donoDoTelefone.get(celular);
    const ocupante = telefoneOcupadoPor.get(celular);
    if (dono.id === id && (ocupante === undefined || ocupante === id)) telefonePrincipal = celular;
    else { telefoneContato = celular; relatorio.avisos.push(`#${id}: celular compartilhado com o cadastro #${dono.id}; guardado em telefone_contato`); }
  } else {
    relatorio.avisos.push(`#${id}: sem celular`);
  }

  const criadoEm = dataHoraSP(r["Data de criação"]) ?? new Date().toISOString();
  const ultimoAgendamento = dataHoraSP(r["Data do último agendamento"]);
  const agora = new Date().toISOString();
  const ultimoContato = ultimoAgendamento && ultimoAgendamento < agora && ultimoAgendamento > criadoEm ? ultimoAgendamento : criadoEm;
  const plano = r["Nome do plano"];
  const convenioId = plano && plano.toLowerCase() !== "particular" ? convenioPorNome.get(plano.toLowerCase()) ?? null : null;

  registros.push({
    consultorio_id: consultorio.id,
    codental_id: id, codental_numero: r["Numero"] ?? "",
    nome, telefone_e164: telefonePrincipal, telefone_contato: telefoneContato, telefone_fixo: r["Telefone"] ?? "",
    origem: "codental", status: "paciente",
    cpf, rg: r["RG"] ?? "", nascimento, sexo: sexo(r["Sexo"]), profissao: r["Profissão"] ?? "", email,
    endereco: enderecoCompleto(r), cep: r["CEP"] ?? "", complemento: r["Complemento"] ?? "", bairro: r["Bairro"] ?? "", cidade: r["Cidade"] ?? "", estado: r["Estado"] ?? "",
    responsavel_nome: r["Nome completo do responsável"] ?? "", responsavel_nascimento: dataCivil(r["Data de nascimento do responsável"]), responsavel_documento: r["Documento do responsável"] ?? "",
    emergencia_nome: r["Contato de emergência nome"] ?? "", emergencia_telefone: r["Contato de emergência telefone"] ?? "",
    convenio_id: convenioId, numero_carteirinha: r["Numero da carterinha"] ?? "", convenio_titular: r["Titular do convenio"] ?? "", convenio_titular_cpf: digitos(r["CPF do titular do convenio"]),
    como_conheceu: r["Como conheceu"] ?? "",
    observacoes: r["Observações"] ?? "",
    primeiro_contato: criadoEm, ultimo_contato: ultimoContato, ultimo_agendamento_codental: ultimoAgendamento,
  });
}

for (const reg of registros) (porCodental.has(reg.codental_id) ? relatorio.atualizados++ : relatorio.inseridos++);

if (!dryRun) {
  // Lotes de 50 via upsert por (consultorio_id, codental_id). Erro num lote vira erro por linha, para o relatório ficar exato.
  let inseridos = 0, atualizados = 0;
  for (let i = 0; i < registros.length; i += 50) {
    const lote = registros.slice(i, i + 50);
    const { error } = await admin.from("pacientes").upsert(lote, { onConflict: "consultorio_id,codental_id" });
    if (!error) { for (const reg of lote) (porCodental.has(reg.codental_id) ? atualizados++ : inseridos++); continue; }
    for (const reg of lote) {
      const { error: e1 } = await admin.from("pacientes").upsert(reg, { onConflict: "consultorio_id,codental_id" });
      if (e1) { erros.push({ id: reg.codental_id, problemas: [e1.message] }); relatorio.erros++; }
      else (porCodental.has(reg.codental_id) ? atualizados++ : inseridos++);
    }
  }
  relatorio.inseridos = inseridos; relatorio.atualizados = atualizados;
  const { count } = await admin.from("pacientes").select("id", { count: "exact", head: true }).eq("consultorio_id", consultorio.id).not("codental_id", "is", null);
  relatorio.no_banco_com_codental_id = count;
}

console.log("\nResumo:");
console.log(`  lidos        ${relatorio.lidos}`);
console.log(`  inseridos    ${relatorio.inseridos}`);
console.log(`  atualizados  ${relatorio.atualizados}`);
console.log(`  erros        ${relatorio.erros}`);
if (relatorio.no_banco_com_codental_id !== undefined) console.log(`  no banco com codental_id: ${relatorio.no_banco_com_codental_id}`);
const semCelular = relatorio.avisos.filter((a) => a.endsWith("sem celular")).length;
const compartilhados = relatorio.avisos.length - semCelular;
console.log(`  avisos       ${semCelular} sem celular, ${compartilhados} com celular compartilhado (ficaram em telefone_contato)`);
if (erros.length) { console.log("\nErros (ID do Codental → motivo):"); for (const e of erros) console.log(`  #${e.id}: ${e.problemas.join("; ")}`); }
if (args.includes("--avisos")) for (const a of relatorio.avisos) console.log("  " + a);
