import 'server-only';
import { createServerClient } from '@supabase/ssr';
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

export async function sessaoAutorizada() {
  const cliente = await clienteServer();
  const { data: { user }, error } = await cliente.auth.getUser();
  const permitido = process.env.AUTH_EMAIL_PERMITIDO?.trim().toLowerCase();
  if (error || !user || !permitido || user.email?.toLowerCase() !== permitido) throw { code: '42501' };
  const { data, error: erroConta } = await cliente.rpc('conta_permitida');
  if (erroConta || data !== true) throw { code: '42501' };
  return cliente;
}
