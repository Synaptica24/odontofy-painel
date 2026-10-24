"use client";

import type { DocumentoEmitido, Pagamento, Prontuario } from "@/lib/contratos";
import { reais } from "@/components/dados/datas";
import { Bloco, Vazio } from "@/components/ui/primitivos";
import { Chip } from "./ficha-util";

/* Pagamentos do paciente (parcelas/débitos), hoje alimentados pela importação do Codental.
   Só leitura: lançar e baixar pagamento vem depois, junto com o fluxo de caixa. */

const STATUS: Record<Pagamento["status"], { rotulo: string; cor: "verde" | "amarelo" | "vermelho" | "cinza" }> = {
  pago: { rotulo: "Pago", cor: "verde" }, pendente: { rotulo: "A receber", cor: "amarelo" }, atrasado: { rotulo: "Em atraso", cor: "vermelho" }, cancelado: { rotulo: "Cancelado", cor: "cinza" },
};
const data = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00-03:00` : iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null);

export function FichaPagamentos({ d }: { d: Prontuario }) {
  const lista = d.pagamentos ?? [];
  const soma = (f: (p: Pagamento) => boolean) => lista.filter(f).reduce((s, p) => s + Number(p.valor), 0);
  const pago = soma((p) => p.status === "pago");
  const aberto = soma((p) => p.status === "pendente" || p.status === "atrasado");
  const atrasado = soma((p) => p.status === "atrasado");
  const orcamento = (id: string | null) => (id ? d.orcamentos.find((o) => o.id === id) : null);

  return (
    <>
      <Bloco titulo="Pagamentos" id="pagamentos" lado={lista.length ? `${lista.length} ${lista.length === 1 ? "lançamento" : "lançamentos"}` : undefined} primeiro>
        {lista.length === 0 ? (
          <Vazio titulo="Nenhum pagamento lançado." sub="Os lançamentos do Codental aparecem aqui depois da importação." />
        ) : (
          <>
            <div className="pag-resumo">
              <div className="numero"><b className="num">{reais(pago)}</b><span>recebido</span></div>
              <div className="numero"><b className="num">{reais(aberto)}</b><span>a receber</span></div>
              <div className="numero"><b className={`num ${atrasado > 0 ? "text-alerta" : ""}`}>{reais(atrasado)}</b><span>em atraso</span></div>
            </div>
            <div>
              {lista.map((p) => {
                const o = orcamento(p.orcamento_id);
                const st = STATUS[p.status] ?? STATUS.pendente;
                return (
                  <div key={p.id} className="pag-linha">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{p.descricao || "Pagamento"}</span>
                        <Chip cor={st.cor}>{st.rotulo}</Chip>
                        {p.recibo && <Chip cor="cinza">recibo</Chip>}
                      </div>
                      <div className="pag-linha__sub">
                        {p.vencimento ? `Vence em ${data(p.vencimento)}` : "Sem vencimento"}
                        {p.pago_em ? ` · pago em ${data(p.pago_em)}` : ""}
                        {o ? ` · orçamento ${o.codental_numero ? `#${o.codental_numero}` : o.titulo}` : ""}
                        {p.codental_id ? " · importado do Codental" : ""}
                      </div>
                    </div>
                    <span className="pag-linha__valor">{reais(Number(p.valor))}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Bloco>
      <DocumentosEmitidos lista={d.documentos ?? []} />
    </>
  );
}

/** Receitas e atestados emitidos no Codental: só o registro (o PDF ficou lá). */
export function DocumentosEmitidos({ lista }: { lista: DocumentoEmitido[] }) {
  if (!lista.length) return null;
  return (
    <Bloco titulo="Receitas e atestados emitidos" id="documentos-emitidos" lado="registro do Codental">
      <div>
        {lista.map((doc) => (
          <div key={doc.id} className="pag-linha">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className="font-medium">{doc.tipo}</span></div>
              <div className="pag-linha__sub">{doc.resumo.replace(new RegExp(`^${doc.tipo}\\s*`), "")}</div>
            </div>
          </div>
        ))}
      </div>
    </Bloco>
  );
}
