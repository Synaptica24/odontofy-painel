import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { enviarMagicLink, entrarComSenha } from '@/lib/auth';

/* Tela de entrar no desenho do painel (cartão branco, Inter, azul de ação). Senha é o caminho principal;
   o link por e-mail fica como alternativa. Erros não dizem qual campo errou. */
export default async function Entrar({ searchParams }: { searchParams: Promise<{ enviado?: string; erro?: string; motivo?: string }> }) {
  const parametros = await searchParams;
  const demonstracao = !process.env.NEXT_PUBLIC_SUPABASE_URL;

  async function entrar(form: FormData) {
    'use server';
    const resultado = await entrarComSenha(String(form.get('email') ?? ''), String(form.get('senha') ?? ''));
    if (resultado.sucesso) redirect('/hoje');
    redirect(`/entrar?erro=1&motivo=${encodeURIComponent(resultado.erro.mensagem)}`);
  }
  async function enviarLink(form: FormData) {
    'use server';
    const resultado = await enviarMagicLink(String(form.get('email') ?? ''));
    redirect(resultado.sucesso ? '/entrar?enviado=1' : '/entrar?erro=1');
  }

  return (
    <main data-mundo="a" className="a-pagina entrar">
      <section className="a-bloco a-bloco--primeiro entrar__cartao">
        <Image src="/odontofy-mascote.png" alt="" width={56} height={56} priority className="entrar__mascote" />
        <p className="entrar__marca">Dr. Mateus Peixoto</p>
        <h1 className="entrar__titulo">Entrar no consultório</h1>
        <p className="entrar__sub">Agenda, pacientes, prontuário e financeiro em um lugar só.</p>
        {demonstracao && (
          <p className="a-vazio">Modo demonstração. <Link href="/hoje">Abrir painel fictício</Link></p>
        )}
        {parametros.erro && (
          <p className="a-erro" role="alert">{parametros.motivo ?? 'Não foi possível entrar. Confira os dados e tente de novo.'}</p>
        )}
        {parametros.enviado && (
          <p className="a-vazio" role="status">Se o e-mail estiver autorizado, você receberá o link. Confira também a caixa de spam.</p>
        )}
        <form action={entrar} className="entrar__form">
          <label className="a-campo">
            <span className="a-campo__rotulo">E-mail</span>
            <input className="a-entrada" id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
          </label>
          <label className="a-campo">
            <span className="a-campo__rotulo">Senha</span>
            <input className="a-entrada" id="senha" name="senha" type="password" autoComplete="current-password" required minLength={6} maxLength={200} />
          </label>
          <button type="submit" className="a-botao a-botao--cheio a-botao--grande pressa w-full mt-4">Entrar</button>
        </form>
        <details className="entrar__alternativa">
          <summary>Prefere receber um link por e-mail?</summary>
          <form action={enviarLink} className="entrar__form">
            <label className="a-campo">
              <span className="a-campo__rotulo">E-mail autorizado</span>
              <input className="a-entrada" name="email" type="email" autoComplete="email" required maxLength={254} />
            </label>
            <button type="submit" className="a-botao a-botao--grande pressa w-full mt-3">Receber link de acesso</button>
          </form>
        </details>
      </section>
      <p className="entrar__rodape"><Link href="/">← Voltar ao site</Link></p>
    </main>
  );
}
