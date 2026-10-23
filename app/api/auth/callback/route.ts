import { NextResponse } from 'next/server';
import { clienteServer, sessaoAutorizada } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const base = process.env.APP_URL;
  if (!base) return new Response('Autenticação não configurada.', { status: 503 });
  try {
    const code = new URL(request.url).searchParams.get('code');
    if (!code) throw new Error('Código ausente');
    const cliente = await clienteServer();
    const { error } = await cliente.auth.exchangeCodeForSession(code);
    if (error) throw error;
    try { await sessaoAutorizada(); }
    catch { await cliente.auth.signOut(); throw new Error('Conta não autorizada'); }
    const resposta = NextResponse.redirect(new URL('/', base));
    resposta.headers.set('Cache-Control', 'private, no-store');
    return resposta;
  } catch {
    const resposta = NextResponse.redirect(new URL('/entrar?erro=1', base));
    resposta.headers.set('Cache-Control', 'private, no-store');
    return resposta;
  }
}
