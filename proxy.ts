import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.next();
  let resposta = NextResponse.next({ request });
  resposta.headers.set('Cache-Control', 'private, no-store');
  const caminho = request.nextUrl.pathname;
  // Público: site institucional na raiz, SEO, assinatura de contrato pelo paciente e autenticação.
  const publico = caminho === '/' || caminho === '/entrar' || caminho === '/sitemap.xml' || caminho === '/robots.txt'
    || caminho.startsWith('/opengraph-image') || caminho.startsWith('/twitter-image') || caminho.startsWith('/site/')
    || caminho.startsWith('/assinar/') || caminho.startsWith('/api/assinar/')
    || ['/api/auth/callback', '/api/auth/magic-link', '/api/auth/senha', '/api/auth/sair'].includes(caminho);
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let autorizado = false;
  if (chave) {
    const cliente = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, chave, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (itens) => {
          itens.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          itens.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
          resposta.headers.set('Cache-Control', 'private, no-store');
        },
      },
    });
    try {
      const { data: { user }, error } = await cliente.auth.getUser();
      if (!error && user && process.env.AUTH_EMAIL_PERMITIDO && user.email?.toLowerCase() === process.env.AUTH_EMAIL_PERMITIDO.trim().toLowerCase()) {
        const conta = await cliente.rpc('conta_permitida');
        autorizado = !conta.error && conta.data === true;
      }
    } catch { autorizado = false; }
  }
  if (!publico && !autorizado) {
    const negada = request.nextUrl.pathname.startsWith('/api/')
      ? NextResponse.json({ sucesso: false, dados: null, erro: { codigo: 'nao_autorizado', mensagem: 'Entre com a conta autorizada.' } }, { status: 401 })
      : NextResponse.redirect(new URL('/entrar', request.url));
    resposta.cookies.getAll().forEach((cookie) => negada.cookies.set(cookie));
    negada.headers.set('Cache-Control', 'private, no-store');
    return negada;
  }
  return resposta;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
