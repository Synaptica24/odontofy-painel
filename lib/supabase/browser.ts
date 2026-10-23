import { createBrowserClient } from '@supabase/ssr';

export function clienteBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) throw new Error('Supabase não configurado.');
  return createBrowserClient(url, chave);
}
