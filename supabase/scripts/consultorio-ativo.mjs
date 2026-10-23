/**
 * Aponta o consultório ativo do usuário do Dr. (útil para desenvolvimento e para "resetar" a preferência).
 * Uso: node supabase/scripts/consultorio-ativo.mjs real   |   node supabase/scripts/consultorio-ativo.mjs demo
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const demo = process.argv[2] !== "real";
const { data: c, error: e1 } = await admin.from("consultorios").select("id,nome").eq("demo", demo).single();
if (e1) throw e1;
const { data: u } = await admin.auth.admin.listUsers({ perPage: 1000 });
const user = u.users.find((x) => x.email?.toLowerCase() === (process.env.DR_EMAIL || env.AUTH_EMAIL_PERMITIDO).toLowerCase());
if (!user) throw new Error("Usuário não encontrado");
const { error } = await admin.from("preferencias").upsert({ user_id: user.id, consultorio_id: c.id });
if (error) throw error;
console.log(`Consultório ativo de ${user.email}: ${c.nome}`);
