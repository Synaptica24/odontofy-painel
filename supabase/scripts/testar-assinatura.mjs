/**
 * Teste de ponta a ponta da assinatura: cria um contrato "enviado" para um Paciente Teste do consultório
 * de demonstração (com PDF no bucket) e imprime o link público. Depois de assinar, rode com `verificar <id>`.
 *
 *   node supabase/scripts/testar-assinatura.mjs            → cria e imprime o link
 *   node supabase/scripts/testar-assinatura.mjs verificar <contrato_id>
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (process.argv[2] === "verificar") {
  const { data, error } = await admin.from("contratos").select("id,status,assinado_em,assinatura,pdf_assinado_caminho,token").eq("id", process.argv[3]).single();
  if (error) throw error;
  console.log(JSON.stringify({ ...data, token: data.token ? "(presente: o paciente ainda consegue reabrir o link e baixar o PDF assinado)" : null }, null, 2));
  const { data: acessos } = await admin.from("acessos_prontuario").select("acao,detalhe,ip,criado_em").eq("detalhe", data.assinatura ? `Contrato de teste · ${data.assinatura.nome}` : "").order("criado_em", { ascending: false }).limit(1);
  console.log("trilha:", acessos);
  process.exit(0);
}

const { data: demo } = await admin.from("consultorios").select("id,nome").eq("demo", true).single();
const { data: paciente } = await admin.from("pacientes").select("id,nome").eq("consultorio_id", demo.id).order("nome").limit(1).single();
const conteudo = `CONTRATO DE TESTE\n\nPaciente: ${paciente.nome}.\n\n1. OBJETO\nEste documento existe só para testar a assinatura eletrônica pelo celular.\n\n2. VALOR\nR$ 0,00.\n\nDemonstração, ${new Date().toLocaleDateString("pt-BR")}.`;

const doc = await PDFDocument.create();
const fonte = await doc.embedFont(StandardFonts.Helvetica);
const pagina = doc.addPage([595.28, 841.89]);
let y = 780;
for (const linha of conteudo.split("\n")) { pagina.drawText(linha.replace(/[^\x00-\xFF]/g, "?"), { x: 56, y, size: 11, font: fonte }); y -= 16; }
const pdf = await doc.save();

const token = randomBytes(24).toString("base64url");
const { data: contrato, error } = await admin.from("contratos").insert({
  consultorio_id: demo.id, paciente_id: paciente.id, titulo: "Contrato de teste", conteudo, status: "enviado",
  token, token_expira_em: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), provedor: "interno",
}).select("id").single();
if (error) throw error;
const caminho = `${demo.id}/${paciente.id}/${contrato.id}.pdf`;
const { error: eUp } = await admin.storage.from("contratos").upload(caminho, Buffer.from(pdf), { contentType: "application/pdf", upsert: true });
if (eUp) throw eUp;
await admin.from("contratos").update({ pdf_caminho: caminho }).eq("id", contrato.id);
console.log(`Contrato ${contrato.id} para ${paciente.nome}`);
console.log(`Link: ${(env.APP_URL || "http://localhost:3010").replace(/\/$/, "")}/assinar/${token}`);
