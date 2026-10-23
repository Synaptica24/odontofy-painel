/**
 * Cria (ou atualiza) o usuário do consultório, os dois consultórios (real e demonstração),
 * o vínculo de membro, o profissional, a configuração inicial e semeia a demonstração.
 *
 * Uso:  node supabase/scripts/criar-usuario.mjs
 * Lê de .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTH_EMAIL_PERMITIDO.
 * A senha inicial vem de DR_SENHA_INICIAL (ou é gerada e impressa uma única vez).
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const chave = env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.DR_EMAIL || env.AUTH_EMAIL_PERMITIDO || "").trim().toLowerCase();
if (!url || !chave || !email) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou AUTH_EMAIL_PERMITIDO no .env.local");

const senha = process.env.DR_SENHA_INICIAL || randomBytes(9).toString("base64url");
const nome = process.env.DR_NOME || "Dr. Mateus Peixoto";
const admin = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });

// 1. usuário (idempotente)
let userId;
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
const existente = lista?.users.find((u) => u.email?.toLowerCase() === email);
if (existente) {
  userId = existente.id;
  if (process.env.DR_SENHA_INICIAL) await admin.auth.admin.updateUserById(userId, { password: senha });
  console.log(`Usuário já existia: ${email}${process.env.DR_SENHA_INICIAL ? " (senha atualizada)" : ""}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
  if (error) throw error;
  userId = data.user.id;
  console.log(`Usuário criado: ${email}`);
  console.log(`Senha inicial (guarde agora, não é mostrada de novo): ${senha}`);
}

// 2. consultórios
async function consultorio(nomeC, demo, principal) {
  const { data: achado } = await admin.from("consultorios").select("id").eq("nome", nomeC).eq("demo", demo).maybeSingle();
  if (achado) return achado.id;
  const { data, error } = await admin.from("consultorios").insert({ nome: nomeC, demo, principal }).select("id").single();
  if (error) throw error;
  return data.id;
}
const real = await consultorio("Consultório Dr. Mateus Peixoto", false, true);
const demo = await consultorio("Demonstração", true, false);
for (const c of [real, demo]) {
  const { error } = await admin.from("membros").upsert({ consultorio_id: c, user_id: userId, papel: "dono" });
  if (error) throw error;
}
await admin.from("preferencias").upsert({ user_id: userId, consultorio_id: real });

// 3. profissional e configuração inicial do consultório real (banco limpo, só o essencial)
const { data: prof } = await admin.from("profissionais").select("id").eq("consultorio_id", real).limit(1);
if (!prof?.length) {
  const { error } = await admin.from("profissionais").insert({ consultorio_id: real, nome, cro: "", cor: "#1570EF", user_id: userId, ordem: 0 });
  if (error) throw error;
}
const configInicial = {
  horarios_atendimento: {
    segunda: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
    terca: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
    quarta: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
    quinta: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
    sexta: [{ inicio: "08:00", fim: "12:00" }, { inicio: "14:00", fim: "18:00" }],
    sabado: [], domingo: [],
  },
  duracoes_por_tipo: { "Avaliação": 30, "Limpeza": 45, "Restauração": 60, "Canal": 90, "Retorno": 30, "Clareamento": 60 },
  teto_pacientes_novos_semana: 20,
  agenda_ativa: true,
};
const { data: cfgReal } = await admin.from("config").select("chave").eq("consultorio_id", real).eq("chave", "agenda_ativa").maybeSingle();
if (!cfgReal) {
  const linhas = Object.entries(configInicial).map(([chave, valor]) => ({ consultorio_id: real, chave, valor }));
  const { error } = await admin.from("config").upsert(linhas);
  if (error) throw error;
  console.log("Configuração inicial da agenda gravada (horários seg-sex 8-12/14-18; ajuste em Ajustes).");
}

// 4. demonstração
const { data: semeado, error: erroDemo } = await admin.rpc("semear_demo", { p_consultorio: demo });
if (erroDemo) throw erroDemo;
console.log("Demonstração semeada:", semeado);
console.log(`\nPronto. Consultório real: ${real}\nDemonstração: ${demo}\nEntre em /entrar com ${email}.`);
