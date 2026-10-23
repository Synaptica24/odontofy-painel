'use server';

import { clienteServer } from './supabase/server';
import type { ResultadoApi } from './contratos';

export async function enviarMagicLink(email: string): Promise<ResultadoApi<{ mensagem: string }>> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { sucesso: true, dados: { mensagem: 'Demonstração: nenhum e-mail foi enviado.' }, erro: null };
  const generica = { sucesso: true as const, dados: { mensagem: 'Se o e-mail estiver autorizado, você receberá um link de acesso.' }, erro: null };
  if (typeof email !== 'string' || email.length > 254 || !process.env.AUTH_EMAIL_PERMITIDO || email.trim().toLowerCase() !== process.env.AUTH_EMAIL_PERMITIDO.trim().toLowerCase()) return generica;
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
