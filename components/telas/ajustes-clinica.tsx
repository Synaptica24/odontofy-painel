"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { excluirConvenio, listarConvenios, listarProfissionais, salvarConvenio, salvarProfissional } from "@/lib/api";
import type { Convenio, Profissional } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { Bloco, Botao, Campo, Entrada, Item, Linha, Lista, OssoLinha, Vazio } from "@/components/ui/primitivos";
import { Folha } from "@/components/clinica/folha";

const CORES = ["#1570EF", "#17B26A", "#F79009", "#F04438", "#7A5AF8", "#0E9384", "#B54708", "#475467"];

/* Profissionais (quem atende) e convênios (chip no bloco da agenda). */
export function AjustesClinica() {
  const prof = useApi(() => listarProfissionais(), []);
  const conv = useApi(() => listarConvenios(), []);
  const [editProf, setEditProf] = useState<Partial<Profissional> | null>(null);
  const [editConv, setEditConv] = useState<Partial<Convenio> | null>(null);

  async function salvarP(e: React.FormEvent) {
    e.preventDefault();
    if (!editProf) return;
    const r = await salvarProfissional(editProf);
    if (!r.sucesso) { toast.error("Não deu para salvar.", { description: r.erro.mensagem }); return; }
    toast("Profissional salvo"); setEditProf(null); void prof.recarregar();
  }
  async function salvarC(e: React.FormEvent) {
    e.preventDefault();
    if (!editConv) return;
    const r = await salvarConvenio(editConv);
    if (!r.sucesso) { toast.error("Não deu para salvar.", { description: r.erro.codigo === "conflito" ? "Já existe convênio com esse nome." : r.erro.mensagem }); return; }
    toast("Convênio salvo"); setEditConv(null); void conv.recarregar();
  }
  async function apagarC(c: Convenio) {
    const r = await excluirConvenio(c.id);
    if (!r.sucesso) { toast.error("Não deu para excluir.", { description: "Se há pacientes ou consultas com esse convênio, desative em vez de excluir." }); return; }
    toast(`${c.nome} excluído`); void conv.recarregar();
  }

  return (
    <>
      <Bloco titulo="Profissionais" id="profissionais" lado={<Botao onClick={() => setEditProf({ nome: "", cro: "", cor: CORES[0], ativo: true, ordem: (prof.dados?.length ?? 0) })}><Plus size={16} aria-hidden /> Adicionar</Botao>}>
        {!prof.dados ? <OssoLinha n={1} /> : prof.dados.length === 0 ? <Vazio titulo="Nenhum profissional." sub="Adicione quem atende para a agenda separar por pessoa." /> : (
          <Lista>
            {prof.dados.map((p) => (
              <Item key={p.id}>
                <Linha marca="nada" onClick={() => setEditProf(p)} titulo={<><span className="inline-block h-2.5 w-2.5 rounded-full mr-2 align-middle" style={{ background: p.cor }} />{p.nome}{!p.ativo ? " · inativo" : ""}</>} sub={p.cro || "CRO não informado"} lado={<span className="a-linha__meta">editar</span>} />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>
      <Bloco titulo="Convênios" id="convenios" lado={<Botao onClick={() => setEditConv({ nome: "", cor: CORES[2], ativo: true })}><Plus size={16} aria-hidden /> Adicionar</Botao>}>
        {!conv.dados ? <OssoLinha n={1} /> : conv.dados.length === 0 ? <Vazio titulo="Só particular por enquanto." sub="Cadastre SulAmérica, Privian ou outros para marcar no bloco da agenda." /> : (
          <Lista>
            {conv.dados.map((c) => (
              <Item key={c.id}>
                <Linha marca="nada" onClick={() => setEditConv(c)} titulo={<><span className="chip chip--cor" style={{ background: c.cor }}>{c.nome}</span>{!c.ativo ? <span className="ml-2 text-tinta-3">inativo</span> : null}</>} lado={<span className="a-linha__meta">editar</span>} />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>

      {editProf && (
        <Folha titulo={editProf.id ? "Editar profissional" : "Novo profissional"} aoFechar={() => setEditProf(null)}>
          <form onSubmit={salvarP} className="folha__grade">
            <Campo rotulo="Nome"><Entrada value={editProf.nome ?? ""} onChange={(e) => setEditProf({ ...editProf, nome: e.target.value })} required maxLength={120} autoFocus /></Campo>
            <Campo rotulo="CRO"><Entrada value={editProf.cro ?? ""} onChange={(e) => setEditProf({ ...editProf, cro: e.target.value })} maxLength={40} placeholder="CRO-UF 00000" /></Campo>
            <Campo rotulo="Cor na agenda">
              <div className="flex flex-wrap gap-2">
                {CORES.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={editProf.cor === c} className="h-8 w-8 rounded-full border-2" style={{ background: c, borderColor: editProf.cor === c ? "#101828" : "transparent" }} onClick={() => setEditProf({ ...editProf, cor: c })} />)}
              </div>
            </Campo>
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="h-4 w-4" checked={editProf.ativo ?? true} onChange={(e) => setEditProf({ ...editProf, ativo: e.target.checked })} /> Ativo (aparece na agenda)</label>
            <div className="folha__acoes"><Botao type="submit" cheio>Salvar</Botao><Botao onClick={() => setEditProf(null)}>Cancelar</Botao></div>
          </form>
        </Folha>
      )}
      {editConv && (
        <Folha titulo={editConv.id ? "Editar convênio" : "Novo convênio"} aoFechar={() => setEditConv(null)}>
          <form onSubmit={salvarC} className="folha__grade">
            <Campo rotulo="Nome"><Entrada value={editConv.nome ?? ""} onChange={(e) => setEditConv({ ...editConv, nome: e.target.value })} required maxLength={80} autoFocus placeholder="SulAmérica, Privian…" /></Campo>
            <Campo rotulo="Cor do chip">
              <div className="flex flex-wrap gap-2">
                {CORES.map((c) => <button key={c} type="button" aria-label={c} aria-pressed={editConv.cor === c} className="h-8 w-8 rounded-full border-2" style={{ background: c, borderColor: editConv.cor === c ? "#101828" : "transparent" }} onClick={() => setEditConv({ ...editConv, cor: c })} />)}
              </div>
            </Campo>
            <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="h-4 w-4" checked={editConv.ativo ?? true} onChange={(e) => setEditConv({ ...editConv, ativo: e.target.checked })} /> Ativo</label>
            <div className="folha__acoes">
              <Botao type="submit" cheio>Salvar</Botao>
              <Botao onClick={() => setEditConv(null)}>Cancelar</Botao>
              {editConv.id && <Botao alerta onClick={() => { void apagarC(editConv as Convenio); setEditConv(null); }}>Excluir</Botao>}
            </div>
          </form>
        </Folha>
      )}
    </>
  );
}
