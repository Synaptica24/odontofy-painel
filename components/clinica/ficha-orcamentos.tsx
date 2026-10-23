"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { decidirOrcamento, excluirOrcamento, salvarOrcamento } from "@/lib/api";
import type { Orcamento, OrcamentoItem, Prontuario, StatusOrcamento } from "@/lib/contratos";
import { reais } from "@/components/dados/datas";
import { AreaTexto, Bloco, Botao, Campo, Entrada, Item, Linha, Lista, Vazio } from "@/components/ui/primitivos";
import { Chip, Folha, STATUS_ORCAMENTO, dataCivilBonita, dataHoraBonita } from "./ficha-util";

export type VariaveisContrato = { tratamento: string; valor: string; parcelas?: string };

const total = (itens: OrcamentoItem[], desconto: number) => itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0) - desconto;

/* Orçamentos / plano de tratamento: lista + folha de edição + decisão (aprovado, recusado). */
export function FichaOrcamentos({ d, definir, aoGerarContrato }: { d: Prontuario; definir: (fn: (x: Prontuario) => Prontuario) => void; aoGerarContrato: (v: VariaveisContrato) => void }) {
  const [editando, setEditando] = useState<Partial<Orcamento> | null>(null);

  async function decidir(o: Orcamento, status: StatusOrcamento) {
    const antes = o;
    definir((x) => ({ ...x, orcamentos: x.orcamentos.map((k) => (k.id === o.id ? { ...k, status } : k)) }));
    const res = await decidirOrcamento(o.id, status);
    if (!res.sucesso) { definir((x) => ({ ...x, orcamentos: x.orcamentos.map((k) => (k.id === o.id ? antes : k)) })); toast.error("Não atualizou.", { description: res.erro.mensagem }); return; }
    toast.success(`Orçamento ${STATUS_ORCAMENTO[status].rotulo.toLowerCase()}.`, {
      action: { label: "Desfazer", onClick: () => void decidir({ ...o, status }, antes.status) },
    });
  }
  async function excluir(o: Orcamento) {
    definir((x) => ({ ...x, orcamentos: x.orcamentos.filter((k) => k.id !== o.id) }));
    const res = await excluirOrcamento(o.id);
    if (!res.sucesso) { definir((x) => ({ ...x, orcamentos: [o, ...x.orcamentos] })); toast.error("Não excluiu.", { description: res.erro.mensagem }); return; }
    toast.success("Orçamento excluído.");
  }
  function contrato(o: Orcamento) {
    aoGerarContrato({
      tratamento: o.itens.map((i) => `${i.quantidade > 1 ? `${i.quantidade}× ` : ""}${i.descricao}${i.dente ? ` (dente ${i.dente})` : ""}`).join("; "),
      valor: reais(o.total),
    });
  }

  return (
    <>
      <Bloco titulo="Orçamentos" id="orcamentos" lado={<Botao cheio onClick={() => setEditando({ paciente_id: d.paciente.id, titulo: "Plano de tratamento", itens: [], desconto: 0 })}><Plus size={16} /> Novo</Botao>} primeiro>
        {d.orcamentos.length === 0 ? (
          <Vazio titulo="Nenhum orçamento." sub="Monte o plano de tratamento com itens e valores; o paciente aprova ou recusa." />
        ) : (
          <Lista>
            {d.orcamentos.map((o) => (
              <Item key={o.id}>
                <Linha
                  marca={o.status === "aprovado" ? "feito" : o.status === "recusado" ? "falta" : "anel"}
                  titulo={<>{o.titulo} <span className="num text-tinta-2 font-normal">· {reais(o.total)}</span></>}
                  sub={<><Chip cor={STATUS_ORCAMENTO[o.status].cor}>{STATUS_ORCAMENTO[o.status].rotulo}</Chip> <span className="ml-1">{o.itens.length} {o.itens.length === 1 ? "item" : "itens"}{o.validade ? ` · válido até ${dataCivilBonita(o.validade)}` : ""}</span></>}
                  meta={dataHoraBonita(o.criado_em)}
                  acoesEmbaixo
                  lado={
                    <div className="flex flex-wrap gap-1 justify-end">
                      <Botao onClick={() => setEditando(o)}>Abrir</Botao>
                      {o.status === "pendente" && <Botao cheio onClick={() => decidir(o, "aprovado")}>Aprovar</Botao>}
                      {o.status === "pendente" && <Botao alerta onClick={() => decidir(o, "recusado")}>Recusar</Botao>}
                      {o.status !== "pendente" && <Botao onClick={() => decidir(o, "pendente")}>Reabrir</Botao>}
                      {o.status === "aprovado" && <Botao onClick={() => contrato(o)}>Gerar contrato</Botao>}
                    </div>
                  }
                />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>
      {editando && (
        <FolhaOrcamento inicial={editando} aoFechar={() => setEditando(null)} aoExcluir={editando.id ? () => { const o = d.orcamentos.find((k) => k.id === editando.id); setEditando(null); if (o) void excluir(o); } : undefined}
          aoSalvar={(o) => { definir((x) => ({ ...x, orcamentos: x.orcamentos.some((k) => k.id === o.id) ? x.orcamentos.map((k) => (k.id === o.id ? o : k)) : [o, ...x.orcamentos] })); setEditando(null); }} />
      )}
    </>
  );
}

function FolhaOrcamento({ inicial, aoFechar, aoSalvar, aoExcluir }: { inicial: Partial<Orcamento>; aoFechar: () => void; aoSalvar: (o: Orcamento) => void; aoExcluir?: () => void }) {
  const [titulo, setTitulo] = useState(inicial.titulo ?? "Plano de tratamento");
  const [itens, setItens] = useState<OrcamentoItem[]>(inicial.itens?.length ? inicial.itens.map((i) => ({ ...i })) : [{ descricao: "", dente: null, quantidade: 1, valor_unitario: 0 }]);
  const [desconto, setDesconto] = useState(String(inicial.desconto ?? 0));
  const [validade, setValidade] = useState(inicial.validade ?? "");
  const [observacao, setObservacao] = useState(inicial.observacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const soma = total(itens, Number(desconto.replace(",", ".")) || 0);
  const mudar = (i: number, campo: keyof OrcamentoItem, v: string) => setItens((x) => x.map((it, k) => (k === i ? { ...it, [campo]: campo === "descricao" ? v : campo === "dente" ? (v ? Number(v) : null) : Number(v.replace(",", ".")) || 0 } : it)));

  async function salvar() {
    const limpos = itens.filter((i) => i.descricao.trim());
    if (!limpos.length) { toast.error("Adicione pelo menos um item."); return; }
    setSalvando(true);
    const res = await salvarOrcamento({ id: inicial.id, paciente_id: inicial.paciente_id!, titulo: titulo.trim() || "Plano de tratamento", desconto: Number(desconto.replace(",", ".")) || 0, observacao, validade: validade || null, itens: limpos });
    setSalvando(false);
    if (!res.sucesso) { toast.error("Não salvou.", { description: res.erro.mensagem }); return; }
    toast.success("Orçamento salvo.");
    aoSalvar({ ...(inicial as Orcamento), ...res.dados, itens: limpos, total: total(limpos, Number(desconto.replace(",", ".")) || 0), status: res.dados.status ?? inicial.status ?? "pendente" });
  }

  return (
    <Folha titulo={inicial.id ? "Orçamento" : "Novo orçamento"} sub={inicial.status ? STATUS_ORCAMENTO[inicial.status].rotulo : undefined} aoFechar={aoFechar}
      acoes={<><Botao cheio onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao><Botao onClick={aoFechar}>Fechar</Botao>{aoExcluir && <Botao alerta onClick={aoExcluir} className="ml-auto">Excluir</Botao>}</>}>
      <div className="folha__grade">
        <Campo rotulo="Título"><Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
        <table className="tabela tabela--itens">
          <thead><tr><th>Item</th><th style={{ width: "4.5rem" }}>Dente</th><th style={{ width: "3.5rem" }}>Qtd</th><th style={{ width: "6.5rem" }} className="num">Valor</th><th style={{ width: "2.5rem" }} /></tr></thead>
          <tbody>
            {itens.map((it, i) => (
              <tr key={i}>
                <td><input className="a-entrada a-entrada--mini" value={it.descricao} onChange={(e) => mudar(i, "descricao", e.target.value)} placeholder="Procedimento" /></td>
                <td><input className="a-entrada a-entrada--mini num" inputMode="numeric" value={it.dente ?? ""} onChange={(e) => mudar(i, "dente", e.target.value)} placeholder="—" /></td>
                <td><input className="a-entrada a-entrada--mini num" inputMode="numeric" value={it.quantidade} onChange={(e) => mudar(i, "quantidade", e.target.value)} /></td>
                <td><input className="a-entrada a-entrada--mini num" inputMode="decimal" value={it.valor_unitario} onChange={(e) => mudar(i, "valor_unitario", e.target.value)} /></td>
                <td><button type="button" className="folha__fechar" style={{ width: "2.25rem", height: "2.25rem" }} aria-label="Remover item" onClick={() => setItens((x) => x.filter((_, k) => k !== i))}><Trash2 size={14} /></button></td>
              </tr>
            ))}
            <tr><td colSpan={5}><Botao onClick={() => setItens((x) => [...x, { descricao: "", dente: null, quantidade: 1, valor_unitario: 0 }])}><Plus size={14} /> Item</Botao></td></tr>
            <tr className="tabela__total"><td colSpan={3}>Total {Number(desconto) > 0 ? `(desconto ${reais(Number(desconto.replace(",", ".")) || 0)})` : ""}</td><td className="num" colSpan={2}>{reais(soma)}</td></tr>
          </tbody>
        </table>
        <div className="folha__grade folha__grade--2">
          <Campo rotulo="Desconto (R$)"><Entrada inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} /></Campo>
          <Campo rotulo="Válido até"><Entrada type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></Campo>
        </div>
        <Campo rotulo="Observação"><AreaTexto rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Condições de pagamento, etapas…" /></Campo>
      </div>
    </Folha>
  );
}
