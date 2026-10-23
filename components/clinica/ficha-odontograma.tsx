"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { listarProfissionais, removerItemOdontograma, salvarItemOdontograma } from "@/lib/api";
import type { FaceDente, ItemOdontograma, Profissional, Prontuario, StatusOdontograma } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { reais } from "@/components/dados/datas";
import { AreaTexto, Bloco, Botao, Campo, Entrada, Vazio } from "@/components/ui/primitivos";
import { Chip, Folha, dataHoraBonita } from "./ficha-util";

/* Odontograma: 32 dentes permanentes (FDI). Superior: 18…11 | 21…28. Inferior: 48…41 | 31…38.
   Cada face é pintada pelo registro mais recente daquela face (ou "todas"). */

const SUPERIOR = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const INFERIOR = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const SUGESTOES = ["Restauração em resina", "Restauração em amálgama", "Coroa", "Faceta", "Canal", "Extração", "Implante", "Selante", "Profilaxia", "Cárie", "Ausente", "Fratura", "Prótese", "Clareamento"];
const STATUS: { valor: StatusOdontograma; rotulo: string }[] = [
  { valor: "planejado", rotulo: "Planejado" }, { valor: "realizado", rotulo: "Realizado" }, { valor: "existente", rotulo: "Já existia" },
];

const anterior = (d: number) => d % 10 <= 3;
const superior = (d: number) => d < 30;
/** Mesial fica do lado da linha média: direita na tela para os quadrantes 1 e 4, esquerda para 2 e 3. */
const mesialDireita = (d: number) => Math.floor(d / 10) === 1 || Math.floor(d / 10) === 4;

function statusDaFace(itens: ItemOdontograma[], face: FaceDente): StatusOdontograma | null {
  const alvo = itens.filter((i) => i.face === face || i.face === "todas").sort((a, b) => (a.registrado_em < b.registrado_em ? 1 : -1))[0];
  return alvo?.status ?? null;
}
function ausente(itens: ItemOdontograma[]) {
  return itens.some((i) => /ausente|extra[çc][ãa]o/i.test(i.procedimento) && i.status !== "planejado");
}

function Dente({ numero, itens, selecionado, aoClicar }: { numero: number; itens: ItemOdontograma[]; selecionado: boolean; aoClicar: () => void }) {
  const centro: FaceDente = anterior(numero) ? "I" : "O";
  const baixo: FaceDente = superior(numero) ? "P" : "L";
  const esquerda: FaceDente = mesialDireita(numero) ? "D" : "M";
  const direita: FaceDente = mesialDireita(numero) ? "M" : "D";
  const cls = (f: FaceDente) => { const s = statusDaFace(itens, f); return `face ${s ? `face--${s}` : ""}`; };
  const titulo = itens.length ? `${numero}: ${itens.map((i) => `${i.procedimento} (${i.face})`).join(", ")}` : `Dente ${numero}`;
  return (
    <button type="button" className={`dente pressa ${ausente(itens) ? "dente--ausente" : ""}`} aria-pressed={selecionado} aria-label={titulo} title={titulo} onClick={aoClicar}>
      <span className="dente__numero num" aria-hidden>{numero}</span>
      <svg viewBox="0 0 40 52" aria-hidden>
        <g transform={superior(numero) ? "translate(0 8)" : "translate(0 2)"}>
          {/* V (topo), L/P (base), M/D (lados), O/I (centro) */}
          <polygon className={cls("V")} points="2,2 38,2 29,11 11,11" />
          <polygon className={cls(baixo)} points="11,29 29,29 38,38 2,38" />
          <polygon className={cls(esquerda)} points="2,2 11,11 11,29 2,38" />
          <polygon className={cls(direita)} points="38,2 38,38 29,29 29,11" />
          <rect className={cls(centro)} x="11" y="11" width="18" height="18" />
        </g>
      </svg>
    </button>
  );
}

function BotaoFace({ f, valor, aoMudar }: { f: FaceDente; valor: FaceDente; aoMudar: (f: FaceDente) => void }) {
  return <button type="button" aria-pressed={valor === f} onClick={() => aoMudar(f)}>{f}</button>;
}
function SeletorFace({ dente, valor, aoMudar }: { dente: number; valor: FaceDente; aoMudar: (f: FaceDente) => void }) {
  const centro: FaceDente = anterior(dente) ? "I" : "O";
  const baixo: FaceDente = superior(dente) ? "P" : "L";
  const esq: FaceDente = mesialDireita(dente) ? "D" : "M";
  const dir: FaceDente = mesialDireita(dente) ? "M" : "D";
  const b = (f: FaceDente) => <BotaoFace f={f} valor={valor} aoMudar={aoMudar} />;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="faces" role="group" aria-label="Face do dente">
        <span className="faces__vazio" />{b("V")}<span className="faces__vazio" />
        {b(esq)}{b(centro)}{b(dir)}
        <span className="faces__vazio" />{b(baixo)}<span className="faces__vazio" />
      </div>
      <button type="button" className={`a-botao pressa ${valor === "todas" ? "a-botao--cheio" : ""}`} onClick={() => aoMudar("todas")}>Dente inteiro</button>
    </div>
  );
}

export function FichaOdontograma({ d, definir }: { d: Prontuario; definir: (fn: (x: Prontuario) => Prontuario) => void }) {
  const [dente, setDente] = useState<number | null>(null);
  const porDente = useMemo(() => {
    const m = new Map<number, ItemOdontograma[]>();
    for (const i of d.odontograma) m.set(i.dente, [...(m.get(i.dente) ?? []), i]);
    return m;
  }, [d.odontograma]);
  const planejados = d.odontograma.filter((i) => i.status === "planejado");
  const totalPlanejado = planejados.reduce((s, i) => s + Number(i.valor || 0), 0);

  return (
    <div className="ficha__duas">
      <Bloco titulo="Odontograma" id="odonto" lado={`${d.odontograma.length} registro${d.odontograma.length === 1 ? "" : "s"}`} primeiro>
        <div className="odonto">
          <div className="odonto__arcada odonto__arcada--superior">
            {SUPERIOR.map((n) => <Dente key={n} numero={n} itens={porDente.get(n) ?? []} selecionado={dente === n} aoClicar={() => setDente(n)} />)}
          </div>
          <div className="odonto__arcada odonto__arcada--inferior">
            {INFERIOR.map((n) => <Dente key={n} numero={n} itens={porDente.get(n) ?? []} selecionado={dente === n} aoClicar={() => setDente(n)} />)}
          </div>
          <p className="odonto__legenda">
            <span><i style={{ background: "#d0d5dd" }} />Já existia</span>
            <span><i style={{ background: "#fedf89" }} />Planejado</span>
            <span><i style={{ background: "#abefc6" }} />Realizado</span>
            <span className="text-tinta-3">Toque no dente para registrar.</span>
          </p>
        </div>
      </Bloco>
      <Bloco titulo="Plano por dente" id="plano" lado={planejados.length ? reais(totalPlanejado) : undefined}>
        {planejados.length === 0 ? (
          <Vazio titulo="Nada planejado." sub="Marque procedimentos nos dentes para montar o plano." />
        ) : (
          <table className="tabela">
            <thead><tr><th>Dente</th><th>Procedimento</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {planejados.sort((a, b) => a.dente - b.dente).map((i) => (
                <tr key={i.id}>
                  <td className="num"><button type="button" className="underline-offset-2 hover:underline" onClick={() => setDente(i.dente)}>{i.dente}</button> <span className="text-tinta-3">{i.face}</span></td>
                  <td>{i.procedimento}</td>
                  <td className="num">{reais(Number(i.valor || 0))}</td>
                </tr>
              ))}
              <tr className="tabela__total"><td colSpan={2}>Total planejado</td><td className="num">{reais(totalPlanejado)}</td></tr>
            </tbody>
          </table>
        )}
      </Bloco>
      {dente !== null && (
        <FolhaDente dente={dente} itens={porDente.get(dente) ?? []} pacienteId={d.paciente.id} aoFechar={() => setDente(null)} definir={definir} />
      )}
    </div>
  );
}

function FolhaDente({ dente, itens, pacienteId, aoFechar, definir }: { dente: number; itens: ItemOdontograma[]; pacienteId: string; aoFechar: () => void; definir: (fn: (x: Prontuario) => Prontuario) => void }) {
  const profissionais = useApi<Profissional[]>(() => listarProfissionais(), []);
  const [face, setFace] = useState<FaceDente>(anterior(dente) ? "I" : "O");
  const [procedimento, setProcedimento] = useState("");
  const [status, setStatus] = useState<StatusOdontograma>("planejado");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [profissional, setProfissional] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!procedimento.trim()) { toast.error("Diga qual é o procedimento."); return; }
    setSalvando(true);
    const res = await salvarItemOdontograma({ paciente_id: pacienteId, dente, face, procedimento: procedimento.trim(), status, valor: Number(valor.replace(",", ".")) || 0, observacao, profissional_id: profissional || null });
    setSalvando(false);
    if (!res.sucesso) { toast.error("Não registrou.", { description: res.erro.mensagem }); return; }
    definir((x) => ({ ...x, odontograma: [...x.odontograma, res.dados] }));
    setProcedimento(""); setValor(""); setObservacao("");
    toast.success(`Dente ${dente}: ${res.dados.procedimento} registrado.`);
  }
  async function realizar(i: ItemOdontograma) {
    definir((x) => ({ ...x, odontograma: x.odontograma.map((o) => (o.id === i.id ? { ...o, status: "realizado" } : o)) }));
    const res = await salvarItemOdontograma({ ...i, status: "realizado" });
    if (!res.sucesso) { definir((x) => ({ ...x, odontograma: x.odontograma.map((o) => (o.id === i.id ? i : o)) })); toast.error("Não atualizou.", { description: res.erro.mensagem }); return; }
    definir((x) => ({ ...x, odontograma: x.odontograma.map((o) => (o.id === i.id ? res.dados : o)) }));
    toast.success("Marcado como realizado.");
  }
  async function excluir(i: ItemOdontograma) {
    definir((x) => ({ ...x, odontograma: x.odontograma.filter((o) => o.id !== i.id) }));
    const res = await removerItemOdontograma(i.id);
    if (!res.sucesso) { definir((x) => ({ ...x, odontograma: [...x.odontograma, i] })); toast.error("Não excluiu.", { description: res.erro.mensagem }); return; }
    toast.success("Registro excluído.");
  }

  return (
    <Folha titulo={`Dente ${dente}`} sub={`${superior(dente) ? "Arcada superior" : "Arcada inferior"} · ${anterior(dente) ? "anterior" : "posterior"}`} aoFechar={aoFechar}>
      {itens.length > 0 && (
        <ul className="a-lista mb-4">
          {itens.sort((a, b) => (a.registrado_em < b.registrado_em ? 1 : -1)).map((i) => (
            <li key={i.id} className="a-linha a-linha--acoes" style={{ gridTemplateColumns: "1fr auto" }}>
              <div className="min-w-0">
                <div className="a-linha__nome">{i.procedimento} <span className="text-tinta-3 font-normal">· face {i.face === "todas" ? "inteira" : i.face}</span></div>
                <div className="a-linha__sub">
                  <Chip cor={i.status === "realizado" ? "verde" : i.status === "planejado" ? "amarelo" : "cinza"}>{STATUS.find((s) => s.valor === i.status)?.rotulo}</Chip>
                  {Number(i.valor) > 0 && <span className="num ml-2">{reais(Number(i.valor))}</span>}
                  {i.observacao && <span className="ml-2">{i.observacao}</span>}
                </div>
                <div className="a-linha__meta num">{dataHoraBonita(i.registrado_em)}</div>
              </div>
              <div className="flex gap-2">
                {i.status === "planejado" && <Botao onClick={() => realizar(i)}>Realizado</Botao>}
                <Botao alerta aria-label="Excluir" onClick={() => excluir(i)}><Trash2 size={16} /></Botao>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="folha__grade">
        <p className="a-legenda" style={{ marginBottom: 0 }}><span>Novo registro</span></p>
        <SeletorFace dente={dente} valor={face} aoMudar={setFace} />
        <Campo rotulo="Procedimento">
          <Entrada list="procedimentos" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="Ex.: Restauração em resina" />
          <datalist id="procedimentos">{SUGESTOES.map((s) => <option key={s} value={s} />)}</datalist>
        </Campo>
        <div className="folha__grade folha__grade--2">
          <Campo rotulo="Situação">
            <select className="a-entrada a-select" value={status} onChange={(e) => setStatus(e.target.value as StatusOdontograma)}>
              {STATUS.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Valor (R$)"><Entrada inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></Campo>
        </div>
        {(profissionais.dados?.length ?? 0) > 1 && (
          <Campo rotulo="Profissional">
            <select className="a-entrada a-select" value={profissional} onChange={(e) => setProfissional(e.target.value)}>
              <option value="">—</option>
              {profissionais.dados!.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
        )}
        <Campo rotulo="Observação"><AreaTexto rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} /></Campo>
        <Botao cheio grande onClick={adicionar} disabled={salvando}>{salvando ? "Registrando…" : "Registrar no dente"}</Botao>
      </div>
    </Folha>
  );
}
