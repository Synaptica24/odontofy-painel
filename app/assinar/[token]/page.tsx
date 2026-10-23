import type { Metadata } from "next";
import { contratoPublico } from "@/lib/servidor/assinar-publico";
import { FormularioAssinatura } from "./formulario";

export const metadata: Metadata = { title: "Assinar documento", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/* Página pública: o paciente abre pelo link do WhatsApp, lê o documento e assina no celular. Sem casca do painel. */
export default async function PaginaAssinar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await contratoPublico(token);

  if (!r.sucesso) {
    return (
      <main className="assinar assinar--pagina">
        <section className="assinar__cartao">
          <p className="assinar__rotulo">Documento</p>
          <h1 className="assinar__titulo">Este link não funciona mais</h1>
          <p className="assinar__texto">{r.erro.mensagem}</p>
          <p className="assinar__mudo">Links de assinatura valem por 48 horas. Fale com o consultório pelo WhatsApp e peça um novo.</p>
        </section>
      </main>
    );
  }
  const c = r.dados;
  const assinado = c.status === "assinado";
  const expirado = c.expirado || c.status === "cancelado" || (c.status !== "enviado" && !assinado);
  const dataAssinatura = c.assinado_em ? new Date(c.assinado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" }) : null;

  return (
    <main className="assinar assinar--pagina">
      <header className="assinar__cabeca">
        <p className="assinar__rotulo">{c.consultorio}{c.profissional ? ` · ${c.profissional}` : ""}</p>
        <h1 className="assinar__titulo">{c.titulo}</h1>
      </header>

      {assinado && (
        <section className="assinar__cartao assinar__cartao--ok">
          <h2 className="assinar__sub">Documento assinado</h2>
          <p className="assinar__texto">Assinado em {dataAssinatura}. Guarde o PDF: ele contém o registro da assinatura.</p>
          {c.pdf_url && <a className="assinar__botao" href={c.pdf_url} target="_blank" rel="noopener">Baixar PDF assinado</a>}
        </section>
      )}
      {!assinado && expirado && (
        <section className="assinar__cartao">
          <h2 className="assinar__sub">Este link expirou</h2>
          <p className="assinar__texto">Por segurança, o link de assinatura vale por 48 horas. Peça um novo ao consultório.</p>
        </section>
      )}

      <section className="assinar__cartao">
        <div className="assinar__linha">
          <h2 className="assinar__sub">Leia o documento</h2>
          {c.pdf_url && <a className="assinar__link" href={c.pdf_url} target="_blank" rel="noopener">Ver PDF</a>}
        </div>
        <div className="contrato__pre assinar__conteudo" tabIndex={0}>{c.conteudo}</div>
      </section>

      {!assinado && !expirado && c.provedor !== "interno" && (
        <section className="assinar__cartao">
          <h2 className="assinar__sub">Assinatura via {c.provedor}</h2>
          <p className="assinar__texto">Este documento é assinado pela plataforma {c.provedor}. Use o link enviado por ela.</p>
          {/* TODO: quando o provedor externo estiver ativo, redirecionar para o link do envelope aqui. */}
        </section>
      )}
      {!assinado && !expirado && c.provedor === "interno" && <FormularioAssinatura token={token} />}

      <footer className="assinar__rodape">
        A assinatura eletrônica registra nome, CPF, data, hora, endereço IP e o desenho da assinatura, junto do código de integridade do documento (Lei 14.063/2020).
      </footer>
    </main>
  );
}
