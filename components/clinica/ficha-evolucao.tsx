"use client";

import { useState } from "react";
import { toast } from "sonner";
import { adicionarEvolucao, listarProfissionais } from "@/lib/api";
import type { Evolucao, Profissional, Prontuario } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { AreaTexto, Bloco, Botao, Campo, Vazio } from "@/components/ui/primitivos";
import { STATUS_AGENDAMENTO, dataHoraBonita } from "./ficha-util";
import { diaCurto, hora } from "@/components/dados/datas";

/* Evolução clínica: só acrescenta. Correção = novo registro apontando para o antigo (que fica riscado). */
export function FichaEvolucao({ d, definir }: { d: Prontuario; definir: (fn: (x: Prontuario) => Prontuario) => void }) {
  const profissionais = useApi<Profissional[]>(() => listarProfissionais(), []);
  const [texto, setTexto] = useState("");
  const [profissional, setProfissional] = useState("");
  const [consulta, setConsulta] = useState("");
  const [corrigindo, setCorrigindo] = useState<Evolucao | null>(null);
  const [salvando, setSalvando] = useState(false);

  const corrigidas = new Set(d.evolucoes.map((e) => e.corrige_id).filter(Boolean));
  const consultas = d.agendamentos.filter((a) => a.status !== "cancelado").slice(0, 30);

  async function registrar() {
    if (!texto.trim()) { toast.error("Escreva a evolução antes de registrar."); return; }
    setSalvando(true);
    const res = await adicionarEvolucao(d.paciente.id, texto.trim(), { profissional_id: profissional || null, agendamento_id: consulta || null, corrige_id: corrigindo?.id ?? null });
    setSalvando(false);
    if (!res.sucesso) { toast.error("Não registrou.", { description: `${res.erro.mensagem} O texto continua aí.` }); return; }
    const nome = profissionais.dados?.find((p) => p.id === profissional)?.nome ?? null;
    definir((x) => ({ ...x, evolucoes: [{ ...res.dados, profissional: nome }, ...x.evolucoes] }));
    setTexto(""); setCorrigindo(null); setConsulta("");
    toast.success(corrigindo ? "Correção registrada." : "Evolução registrada.");
  }

  return (
    <div className="ficha__duas ficha__duas--inversa">
      <Bloco titulo="Histórico" id="evolucoes" lado={`${d.evolucoes.length}`} primeiro>
        {d.evolucoes.length === 0 ? (
          <Vazio titulo="Nenhuma evolução ainda." sub="O primeiro registro fica aqui, com data e profissional." />
        ) : (
          <ol className="evolucao">
            {d.evolucoes.map((e) => {
              const corrigida = corrigidas.has(e.id);
              const correcao = d.evolucoes.find((c) => c.corrige_id === e.id);
              const consultaDe = e.agendamento_id ? d.agendamentos.find((a) => a.id === e.agendamento_id) : null;
              return (
                <li key={e.id} className={`evolucao__item entra ${corrigida ? "evolucao__item--corrigida" : ""}`}>
                  <div className="evolucao__meta">
                    <span className="num">{dataHoraBonita(e.criado_em)}</span>
                    {e.profissional && <span>{e.profissional}</span>}
                    {consultaDe && <span>consulta de {diaCurto(consultaDe.inicio)} {hora(consultaDe.inicio)} · {consultaDe.tipo}</span>}
                    {e.corrige_id && <span className="chip chip--azul">correção</span>}
                    {corrigida && correcao && <span className="chip chip--vermelho">corrigido em {dataHoraBonita(correcao.criado_em)}</span>}
                  </div>
                  <p className="evolucao__texto">{e.texto}</p>
                  {!corrigida && (
                    <button type="button" className="evolucao__corrigir" onClick={() => { setCorrigindo(e); setTexto(e.texto); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      Corrigir
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Bloco>
      <Bloco titulo={corrigindo ? "Corrigir registro" : "Nova evolução"} id="nova-evolucao" lado={corrigindo ? <button type="button" className="underline" onClick={() => { setCorrigindo(null); setTexto(""); }}>cancelar</button> : undefined}>
        <div className="grid gap-3">
          {corrigindo && <p className="a-vazio" style={{ marginTop: 0 }}>O registro original continua no histórico, riscado. A correção entra como registro novo.</p>}
          <AreaTexto rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que foi feito, achados, conduta, orientações…" />
          {(profissionais.dados?.length ?? 0) > 0 && (
            <Campo rotulo="Profissional">
              <select className="a-entrada a-select" value={profissional} onChange={(e) => setProfissional(e.target.value)}>
                <option value="">—</option>
                {profissionais.dados!.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
          )}
          {consultas.length > 0 && !corrigindo && (
            <Campo rotulo="Vincular a uma consulta" dica="Opcional">
              <select className="a-entrada a-select" value={consulta} onChange={(e) => setConsulta(e.target.value)}>
                <option value="">—</option>
                {consultas.map((a) => <option key={a.id} value={a.id}>{diaCurto(a.inicio)} {hora(a.inicio)} · {a.tipo} · {STATUS_AGENDAMENTO[a.status].rotulo}</option>)}
              </select>
            </Campo>
          )}
          <Botao cheio grande onClick={registrar} disabled={salvando}>{salvando ? "Registrando…" : corrigindo ? "Registrar correção" : "Registrar evolução"}</Botao>
          <p className="text-[12px] text-tinta-3">Registros não podem ser apagados nem editados. Isso protege você e o paciente.</p>
        </div>
      </Bloco>
    </div>
  );
}
