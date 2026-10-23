import { enviarMagicLink } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function Entrar({ searchParams }: { searchParams: Promise<{ enviado?: string; erro?: string }> }) {
  const parametros = await searchParams;
  async function enviar(form: FormData) {
    'use server';
    const resultado = await enviarMagicLink(String(form.get('email') ?? ''));
    redirect(resultado.sucesso ? '/entrar?enviado=1' : '/entrar?erro=1');
  }
  return <main style={{ maxWidth: 420, margin: '80px auto', padding: 24 }}>
    <h1>Entrar no consultório</h1>
    {!process.env.NEXT_PUBLIC_SUPABASE_URL && <p>Modo demonstração. <Link href="/">Abrir painel fictício</Link></p>}
    <form action={enviar}>
      <label htmlFor="email">E-mail autorizado</label>
      <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      <button type="submit">Receber link de acesso</button>
    </form>
    {parametros.enviado && <p role="status">Se o e-mail estiver autorizado, você receberá o link. No modo demonstração, nenhum e-mail é enviado.</p>}
    {parametros.erro && <p role="alert">Não foi possível entrar. Solicite um novo link.</p>}
  </main>;
}
