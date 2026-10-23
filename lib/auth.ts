'use server';

import { clienteServer, sessaoAutorizada } from './supabase/server';
import type { ResultadoApi } from './contratos';

export async function enviarMagicLink(email: string): Promise<ResultadoApi<{ mensagem: string }>> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { sucesso: true, dados: { mensagem: 'Demonstração: nenhum e-mail foi enviado.' }, erro: null };
  const generica = { sucesso: true as const, dados: { mensagem: 'Se o e-mail estiver autorizado, você receberá um link de acesso.' }, erro: null };
  const permitido = process.env.AUTH_EMAIL_PERMITIDO?.trim().toLowerCase();
  if (typeof email !== 'string' || email.length > 254 || (permitido && email.trim().toLowerCase() !== permitido)) return generica;
  try {
    if (!process.env.APP_URL) throw new Error('Configuração ausente');
    const cliente = await clienteServer();
    const { error } = await cliente.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: new URL('/api/auth/callback', process.env.APP_URL).toString() } });
    if (error) throw error;
    return generica;
  } catch {
    return { sucesso: false, dados: null, erro: { codigo: 'indisponivel', mensagem: 'Não foi possível solicitar o link. Aguarde e tente novamente.' } };
  }
}

/** Entrada por e-mail e senha. Não diz se foi o e-mail ou a senha que errou. */
export async function entrarComSenha(email: string, senha: string): Promise<ResultadoApi<{ ok: true }>> {
  const falha: ResultadoApi<{ ok: true }> = { sucesso: false, dados: null, erro: { codigo: 'nao_autorizado', mensagem: 'E-mail ou senha incorretos.' } };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { sucesso: true, dados: { ok: true }, erro: null };
  if (typeof email !== 'string' || typeof senha !== 'string' || email.length > 254 || senha.length < 6 || senha.length > 200) return falha;
  try {
    const cliente = await clienteServer();
    const { error } = await cliente.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    if (error) return falha;
    try { await sessaoAutorizada(); }
    catch { await cliente.auth.signOut(); return { sucesso: false, dados: null, erro: { codigo: 'nao_autorizado', mensagem: 'Esta conta não tem acesso a nenhum consultório.' } }; }
    return { sucesso: true, dados: { ok: true }, erro: null };
  } catch {
    return { sucesso: false, dados: null, erro: { codigo: 'indisponivel', mensagem: 'Não foi possível entrar agora. Tente de novo em instantes.' } };
  }
}

export async function trocarSenha(nova: string): Promise<ResultadoApi<{ ok: true }>> {
  if (typeof nova !== 'string' || nova.length < 8 || nova.length > 200) return { sucesso: false, dados: null, erro: { codigo: 'validacao', mensagem: 'A senha precisa ter pelo menos 8 caracteres.' } };
  try {
    const cliente = await sessaoAutorizada();
    const { error } = await cliente.auth.updateUser({ password: nova });
    if (error) throw error;
    return { sucesso: true, dados: { ok: true }, erro: null };
  } catch {
    return { sucesso: false, dados: null, erro: { codigo: 'indisponivel', mensagem: 'Não foi possível trocar a senha.' } };
  }
}
