"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { lerConfig, salvarConfig } from "@/lib/api";
import type { Config, DiaSemana, FaixaHorario } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { Bloco, Botao, Cabecalho, Campo, Entrada, Erro, Interruptor, Pagina } from "@/components/ui/primitivos";
import { AjustesClinica } from "./ajustes-clinica";

const DIAS: { chave: DiaSemana; rotulo: string }[] = [
  { chave: "segunda", rotulo: "Segunda" },
  { chave: "terca", rotulo: "Terça" },
  { chave: "quarta", rotulo: "Quarta" },
  { chave: "quinta", rotulo: "Quinta" },
  { chave: "sexta", rotulo: "Sexta" },
  { chave: "sabado", rotulo: "Sábado" },
  { chave: "domingo", rotulo: "Domingo" },
];

export function TelaAjustes() {
  const r = useApi(() => lerConfig(), []);
  const [rascunho, setRascunho] = useState<Config | null>(null);
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo">("parado");
  const timer = useRef<number | null>(null);
  const cfg = rascunho ?? r.dados;

  // salva sozinho, com confirmação discreta
  useEffect(() => {
    if (!rascunho || !r.dados) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const res = await salvarConfig(rascunho);
      if (!res.sucesso) {
        setEstado("parado");
        toast.error("Os ajustes não salvaram.", { description: `${res.erro.mensagem} O que você mudou continua na tela.` });
        return;
      }
      r.definir(() => res.dados);
      setEstado("salvo");
    }, 800);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho]);

  function mudar(parcial: Partial<Config>) {
    if (!cfg) return;
    setEstado("salvando");
    setRascunho({ ...cfg, ...parcial });
  }
  function mudarHorario(dia: DiaSemana, faixas: FaixaHorario[]) {
    if (!cfg) return;
    mudar({ horarios_atendimento: { ...cfg.horarios_atendimento, [dia]: faixas } });
  }
  function mudarDuracao(tipo: string, minutos: number) {
    if (!cfg) return;
    mudar({ duracoes_por_tipo: { ...cfg.duracoes_por_tipo, [tipo]: minutos } });
  }
  function removerTipo(tipo: string) {
    if (!cfg) return;
    const copia = { ...cfg.duracoes_por_tipo };
    delete copia[tipo];
    mudar({ duracoes_por_tipo: copia });
  }

  const num = (v: string, min = 0) => Math.max(min, Number(v) || 0);

  return (
    <Pagina>
      <Cabecalho
        titulo="Ajustes"
        abaixo={estado === "salvando" ? "Salvando…" : estado === "salvo" ? "Salvo. Vale na hora." : "Muda aqui, vale na hora. Salva sozinho."}
      />
      {r.fase === "erro" && !cfg && <Erro mensagem={r.erro} tentar={r.recarregar} />}
      {!cfg ? (
        <div className="mt-6 grid gap-3" aria-hidden>
          <span className="osso h-10" />
          <span className="osso h-10" />
          <span className="osso h-10" />
        </div>
      ) : (
        <>
          <Bloco titulo="A IA" id="ia" primeiro>
            <div className="a-ajuste">
              <div>
                <p className="a-ajuste__rotulo">Responder no WhatsApp</p>
                <p className="a-ajuste__dica">{cfg.agente_ativo ? "Ela responde por você no WhatsApp." : "Ninguém responde por você."}</p>
              </div>
              <Interruptor ligado={cfg.agente_ativo} aoMudar={(v) => mudar({ agente_ativo: v })} rotulo="IA responde no WhatsApp" />
            </div>
            <div className="a-ajuste">
              <div>
                <p className="a-ajuste__rotulo">Marcar horários sozinha</p>
                <p className="a-ajuste__dica">{cfg.agenda_ativa ? "Ela marca direto na agenda." : "Ela só sugere e você confirma."}</p>
              </div>
              <Interruptor ligado={cfg.agenda_ativa} aoMudar={(v) => mudar({ agenda_ativa: v })} rotulo="IA marca horários" />
            </div>
            <Campo rotulo="Quando você assume, a IA fica quieta por" dica="Depois disso ela volta sozinha, para o consultório não ficar mudo.">
              <span className="a-campo__linha">
                <Entrada type="number" inputMode="numeric" min={5} step={5} value={cfg.pausa_agente_minutos} onChange={(e) => mudar({ pausa_agente_minutos: num(e.target.value, 5) })} className="w-24" />
                <span>minutos</span>
              </span>
            </Campo>
          </Bloco>

          <Bloco titulo="Horário de atendimento" id="horarios">
            {DIAS.map(({ chave, rotulo }) => {
              const faixas = cfg.horarios_atendimento[chave] ?? [];
              const aberto = faixas.length > 0;
              return (
                <div key={chave} className="a-ajuste a-ajuste--dia">
                  <div className="flex items-center gap-3">
                    <Interruptor ligado={aberto} aoMudar={(v) => mudarHorario(chave, v ? [{ inicio: "08:00", fim: "18:00" }] : [])} rotulo={`Atende ${rotulo}`} />
                    <span className="a-ajuste__rotulo w-20">{rotulo}</span>
                  </div>
                  {aberto ? (
                    <div className="grid gap-1.5">
                      {faixas.map((f, i) => (
                        <span key={i} className="a-campo__linha">
                          <Entrada type="time" value={f.inicio} step={900} onChange={(e) => mudarHorario(chave, faixas.map((x, j) => (j === i ? { ...x, inicio: e.target.value } : x)))} />
                          <span>às</span>
                          <Entrada type="time" value={f.fim} step={900} onChange={(e) => mudarHorario(chave, faixas.map((x, j) => (j === i ? { ...x, fim: e.target.value } : x)))} />
                          {faixas.length > 1 && (
                            <button type="button" className="a-link" onClick={() => mudarHorario(chave, faixas.filter((_, j) => j !== i))}>
                              tirar
                            </button>
                          )}
                        </span>
                      ))}
                      {faixas.length < 2 && (
                        <button type="button" className="a-link self-start" onClick={() => mudarHorario(chave, [...faixas, { inicio: "14:00", fim: "18:00" }])}>
                          + intervalo de almoço (segunda faixa)
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="a-ajuste__dica">não atende</span>
                  )}
                </div>
              );
            })}
          </Bloco>

          <Bloco titulo="Tipos de consulta e duração" id="tipos">
            {Object.entries(cfg.duracoes_por_tipo).length === 0 && (
              <p className="a-ajuste__dica mb-2">Nenhum tipo ainda. A IA só marca o que estiver aqui.</p>
            )}
            {Object.entries(cfg.duracoes_por_tipo).map(([tipo, minutos]) => (
              <div key={tipo} className="a-ajuste">
                <span className="a-ajuste__rotulo">{tipo}</span>
                <span className="a-campo__linha">
                  <Entrada type="number" inputMode="numeric" min={5} step={5} value={minutos} onChange={(e) => mudarDuracao(tipo, num(e.target.value, 5))} className="w-20" />
                  <span>min</span>
                  <button type="button" className="a-link" onClick={() => removerTipo(tipo)}>tirar</button>
                </span>
              </div>
            ))}
            <NovoTipo aoAdicionar={(t) => mudarDuracao(t, 30)} existentes={Object.keys(cfg.duracoes_por_tipo)} />
          </Bloco>

          <Bloco titulo="Pacientes novos" id="novos">
            <Campo rotulo="Teto de pacientes novos por semana" dica="Passou disso, a IA não oferece horário para gente nova. Zero desliga o teto.">
              <span className="a-campo__linha">
                <Entrada type="number" inputMode="numeric" min={0} value={cfg.teto_pacientes_novos_semana} onChange={(e) => mudar({ teto_pacientes_novos_semana: num(e.target.value) })} className="w-24" />
                <span>por semana</span>
              </span>
            </Campo>
            <Campo rotulo="Antecedência mínima para marcar">
              <span className="a-campo__linha">
                <Entrada type="number" inputMode="numeric" min={0} step={15} value={cfg.antecedencia_minima_minutos} onChange={(e) => mudar({ antecedencia_minima_minutos: num(e.target.value) })} className="w-24" />
                <span>minutos</span>
              </span>
            </Campo>
          </Bloco>

          <Bloco titulo="Confirmação de consulta" id="confirmacao">
            <div className="a-ajuste">
              <div>
                <p className="a-ajuste__rotulo">Pedir confirmação antes da consulta</p>
                <p className="a-ajuste__dica">A IA manda a mensagem e registra a resposta.</p>
              </div>
              <Interruptor ligado={cfg.confirmacao_ativa} aoMudar={(v) => mudar({ confirmacao_ativa: v })} rotulo="Confirmação automática" />
            </div>
            {cfg.confirmacao_ativa && (
              <div className="grid grid-cols-2 gap-2">
                <Campo rotulo="Com antecedência de">
                  <span className="a-campo__linha">
                    <Entrada type="number" inputMode="numeric" min={1} value={cfg.confirmacao_antecedencia_horas} onChange={(e) => mudar({ confirmacao_antecedencia_horas: num(e.target.value, 1) })} className="w-20" />
                    <span>horas</span>
                  </span>
                </Campo>
                <Campo rotulo="Enviar às">
                  <Entrada type="time" value={cfg.confirmacao_horario} onChange={(e) => mudar({ confirmacao_horario: e.target.value })} />
                </Campo>
              </div>
            )}
          </Bloco>

          <Bloco titulo="Urgência" id="urgencia">
            <Campo rotulo="Quando um paciente diz que é urgente, avisar por">
              <select className="a-entrada" value={cfg.canal_urgencia.tipo} onChange={(e) => mudar({ canal_urgencia: { ...cfg.canal_urgencia, tipo: e.target.value as Config["canal_urgencia"]["tipo"] } })}>
                <option value="nao_configurado">Ainda não escolhi</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
              </select>
            </Campo>
            {cfg.canal_urgencia.tipo !== "nao_configurado" && (
              <Campo rotulo={cfg.canal_urgencia.tipo === "whatsapp" ? "Número" : "E-mail"}>
                <Entrada
                  type={cfg.canal_urgencia.tipo === "whatsapp" ? "tel" : "email"}
                  value={cfg.canal_urgencia.destino}
                  onChange={(e) => mudar({ canal_urgencia: { ...cfg.canal_urgencia, destino: e.target.value } })}
                  placeholder={cfg.canal_urgencia.tipo === "whatsapp" ? "+55 11 9…" : "voce@…"}
                />
              </Campo>
            )}
          </Bloco>

          <Bloco titulo="Gasto de IA" id="gasto">
            <Campo rotulo="Teto de gasto por mês" dica="Passou do teto, você é avisado aqui e na tela de consumo.">
              <span className="a-campo__linha">
                <span>R$</span>
                <Entrada type="number" inputMode="decimal" min={0} step={10} value={cfg.teto_gasto_ia_brl} onChange={(e) => mudar({ teto_gasto_ia_brl: num(e.target.value) })} className="w-28" />
              </span>
            </Campo>
          </Bloco>
        </>
      )}
      <AjustesClinica />
    </Pagina>
  );
}

function NovoTipo({ aoAdicionar, existentes }: { aoAdicionar: (t: string) => void; existentes: string[] }) {
  const [nome, setNome] = useState("");
  return (
    <form
      className="a-campo__linha mt-2"
      onSubmit={(e) => {
        e.preventDefault();
        const t = nome.trim();
        if (!t) return;
        if (existentes.some((x) => x.toLocaleLowerCase("pt-BR") === t.toLocaleLowerCase("pt-BR"))) {
          toast("Esse tipo já existe.");
          return;
        }
        aoAdicionar(t);
        setNome("");
      }}
    >
      <Entrada value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Novo tipo, ex.: Limpeza" aria-label="Novo tipo de consulta" />
      <Botao type="submit" disabled={!nome.trim()}>Adicionar</Botao>
    </form>
  );
}
