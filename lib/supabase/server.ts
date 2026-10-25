import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function clienteServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) throw new Error('Supabase não configurado.');
  const jar = await cookies();
  return createServerClient(url, chave, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (itens) => {
        try { itens.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Server Components: o proxy atualiza os cookies. */ }
      },
    },
  });
}

/** Valida o JWT da sessão localmente (chaves assimétricas ES256; o JWKS fica em cache) em vez de perguntar ao
 *  Auth a cada chamada. Renova o token sozinho quando expira. Devolve o id e o e-mail do usuário. */
export async function usuarioDaSessao(cliente: Awaited<ReturnType<typeof clienteServer>>) {
  const { data, error } = await cliente.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: String(data.claims.sub), email: typeof data.claims.email === 'string' ? data.claims.email : '' };
}

/** Sessão válida = usuário logado que é membro de algum consultório (RPC conta_permitida).
 *  AUTH_EMAIL_PERMITIDO, quando definido, restringe ainda mais a um único e-mail. */
export async function sessaoAutorizada() {
  const cliente = await clienteServer();
  const user = await usuarioDaSessao(cliente);
  if (!user) throw { code: '42501' };
  const permitido = process.env.AUTH_EMAIL_PERMITIDO?.trim().toLowerCase();
  if (permitido && user.email.toLowerCase() !== permitido) throw { code: '42501' };
  const { data, error: erroConta } = await cliente.rpc('conta_permitida');
  if (erroConta || data !== true) throw { code: '42501' };
  return cliente;
}

/** Cliente administrativo (service role). Só no servidor, só para fluxos sem sessão (assinatura pelo paciente, cron). */
export function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error('Service role não configurada.');
  return createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });
}
