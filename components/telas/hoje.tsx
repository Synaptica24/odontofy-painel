"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, MessageCircle, RotateCcw, UserRoundCheck } from "lucide-react";
import { IlhaProximo, quandoChega } from "@/components/fx/ilha-proximo";
import { NumeroRolante } from "@/components/fx/numero-rolante";
import { PilhaAtencao, type ItemAtencao } from "@/components/fx/pilha-atencao";
import { GrupoAvatares } from "@/components/fx/grupo-avatares";
import {
  agendaDaSemana,
  assumirConversa,
  confirmarSugestao,
  consumoDoMes,
  devolverParaIA,
  lerConfig,
  listarConversas,
  resumoDoDia,
  statusCampanha,
} from "@/lib/api";
import type { ResultadoApi } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import {
  diaLongo,
  diaNumero,
  diaSemanaCurto,
  haQuanto,
  hojeCivil,
  hora,
  inicioDaSemana,
  reais,
  somarDias,
} from "@/components/dados/datas";
import {
  Bloco,
  Botao,
  BotaoLink,
  Cabecalho,
  Erro,
  Item,
  Linha,
  Lista,
  Marca,
  OssoLinha,
  Pagina,
  Teto,
  Vazio,
} from "@/components/ui/primitivos";

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

async function carregarExtras(civil: string) {
  const semana = inicioDaSemana(civil);
  const [ativas, agenda, campanha, consumo, config] = await Promise.all([
    listarConversas({ status: "ativa", limite: 100 }),
    agendaDaSemana(semana),
    statusCampanha(),
    consumoDoMes(),
    lerConfig(),
  ]);
  const dados = {
    ativas: ativas.sucesso ? ativas.dados.length : null,
    semana: agenda.sucesso ? agenda.dados : null,
    campanha: campanha.sucesso ? campanha.dados : null,
    consumo: consumo.sucesso ? consumo.dados : null,
    config: config.sucesso ? config.dados : null,
  };
  return { sucesso: true, dados, erro: null } as ResultadoApi<typeof dados>;
}

export function TelaHoje() {
  const civil = hojeCivil();
  const r = useApi(() => resumoDoDia(civil), [civil]);
  const extras = useApi(() => carregarExtras(civil), [civil]);
  const [saindo, setSaindo] = useState<string | null>(null);
  const router = useRouter();

  async function assumir(conversaId: string, nome: string) {
    if (!r.dados) return;
    const antes = r.dados;
    setSaindo(conversaId);
    window.setTimeout(() => {
      r.definir((d) => ({ ...d, escaladas: d.escaladas.filter((c) => c.id !== conversaId) }));
      setSaindo(null);
    }, 200);
    const res = await assumirConversa(conversaId);
    if (!res.sucesso) {
      r.definir(() => antes);
      toast.error("Não deu para assumir agora.", { description: res.erro.mensagem });
      return;
    }
    toast(`Você assumiu ${nome}`, {
      description: "A IA fica em silêncio nesse contato até você devolver ou o prazo vencer.",
      action: {
        label: "Abrir conversa",
        onClick: () => router.push(`/conversas/${conversaId}`),
      },
      cancel: {
        label: "Desfazer",
        onClick: async () => {
          r.definir(() => antes);
          await devolverParaIA(conversaId);
          void r.recarregar();
        },
      },
    });
  }

  async function confirmar(agendamentoId: string, rotulo: string) {
    if (!r.dados) return;
    const antes = r.dados;
    r.definir((d) => ({
      ...d,
      agenda: d.agenda.map((a) => (a.id === agendamentoId ? { ...a, status: "confirmado" } : a)),
    }));
    const res = await confirmarSugestao(agendamentoId);
    if (!res.sucesso) {
      r.definir(() => antes);
      toast.error("Não deu para confirmar.", { description: res.erro.mensagem });
      return;
    }
    toast(`${rotulo} confirmado`, {
      action: { label: "Ver agenda", onClick: () => router.push("/agenda") },
    });
  }

  const d = r.dados;
  const x = extras.dados;

  // relógio de minuto em minuto: a ilha do próximo paciente diz "em 25 min" e precisa andar
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgoraMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const proximo = d?.agenda
    .filter((a) => (a.status === "agendado" || a.status === "confirmado") && Date.parse(a.fim) > agoraMs)
    .sort((p, q) => p.inicio.localeCompare(q.inicio))[0];

  // pilha "Pede atenção": escaladas na frente, depois confirmações e retornos pendentes
  const atencao: ItemAtencao[] = d
    ? [
        ...d.escaladas.map<ItemAtencao>((c) => ({
          chave: `esc-${c.id}`,
          Icone: MessageCircle,
          tom: "pa-tom--alerta",
          titulo: c.paciente.nome,
          texto: `${c.urgente ? "Urgente · " : ""}${c.motivo_escalonamento ?? c.ultima_mensagem?.texto ?? "Pediu para falar com você"} · ${haQuanto(c.iniciada_em)}`,
          aoAbrir: () => router.push(`/conversas/${c.id}`),
          acao: (
            <Botao cheio onClick={() => void assumir(c.id, c.paciente.nome)}>
              Assumir
            </Botao>
          ),
        })),
        ...((d.confirmacoes_pendentes ?? 0) > 0
          ? [{
              chave: "confirmacoes",
              Icone: CalendarCheck,
              tom: "pa-tom--aviso",
              titulo: `${d.confirmacoes_pendentes} ${d.confirmacoes_pendentes === 1 ? "consulta a confirmar" : "consultas a confirmar"}`,
              texto: "Nas próximas 48 horas. A IA já mandou lembrete; falta a resposta.",
              aoAbrir: () => router.push("/financeiro#confirmacoes"),
              acao: <BotaoLink href="/financeiro#confirmacoes">Ver</BotaoLink>,
            } satisfies ItemAtencao]
          : []),
        ...((d.retornos_pendentes ?? 0) > 0
          ? [{
              chave: "retornos",
              Icone: RotateCcw,
              tom: "pa-tom--ia",
              titulo: `${d.retornos_pendentes} ${d.retornos_pendentes === 1 ? "retorno para chamar" : "retornos para chamar"}`,
              texto: "Pacientes com retorno previsto nos próximos 14 dias.",
              aoAbrir: () => router.push("/financeiro#retornos"),
              acao: <BotaoLink href="/financeiro#retornos">Ver</BotaoLink>,
            } satisfies ItemAtencao]
          : []),
      ]
    : [];

  type Slot =
    | { inicio: string; tipo: "ag"; a: NonNullable<typeof d>["agenda"][number] }
    | { inicio: string; tipo: "bl"; fim: string; id: string };
  const slots: Slot[] = d
    ? [
        ...d.agenda.map((a) => ({ inicio: a.inicio, tipo: "ag" as const, a })),
        ...d.bloqueios.map((b) => ({ inicio: b.inicio, tipo: "bl" as const, fim: b.fim, id: b.id })),
      ].sort((p, q) => p.inicio.localeCompare(q.inicio))
    : [];
  const [agoraIso] = useState(() => new Date().toISOString());

  return (
    <Pagina>
      <Cabecalho
        sobre={diaLongo(civil)}
        titulo="Hoje"
        acao={
          proximo ? (
            <div className="ilha-caixa">
              <IlhaProximo
                id={proximo.id}
                primeiroNome={primeiroNome(proximo.paciente.nome)}
                nome={proximo.paciente.nome}
                rotulo={`${hora(proximo.inicio)} – ${hora(proximo.fim)}${proximo.profissional ? ` · ${proximo.profissional.nome}` : ""}`}
                detalhe={[proximo.tipo, proximo.paciente_novo ? "paciente novo" : null, proximo.status === "confirmado" ? "confirmada" : "aguarda confirmação"].filter(Boolean).join(" · ")}
                quando={quandoChega(proximo.inicio, agoraMs, hora(proximo.inicio))}
                aoAbrir={() => router.push(`/pacientes/${proximo.paciente_id}`)}
                acao={
                  proximo.status !== "confirmado" ? (
                    <button type="button" className="dyn-round dyn-ok" aria-label={`Confirmar ${proximo.paciente.nome}`} onClick={() => void confirmar(proximo.id, `${hora(proximo.inicio)} com ${proximo.paciente.nome}`)}>
                      <UserRoundCheck size={20} strokeWidth={2} aria-hidden />
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : undefined
        }
      />

      {r.fase === "erro" && !d && <Erro mensagem={r.erro} tentar={r.recarregar} />}

      {!d ? (
        <div className="pa" aria-hidden>
          <span className="osso block h-5 w-40" />
          <span className="osso mt-2.5 block h-[76px] w-full rounded-[14px]" />
        </div>
      ) : atencao.length > 0 ? (
        <PilhaAtencao itens={atencao.filter((it) => !saindo || it.chave !== `esc-${saindo}`)} />
      ) : (
        <div className="pa">
          <Vazio titulo="Nada esperando você." sub="A IA está respondendo tudo e não há consulta por confirmar." />
        </div>
      )}

      <div className="grade-hoje">
        <div>
          <Bloco
            titulo={
              <span className="group inline-flex items-center gap-2.5">
                Agenda de hoje
                {d && (
                  <GrupoAvatares
                    tamanho={24}
                    maximo={5}
                    pessoas={d.agenda.filter((a) => a.status !== "cancelado" && a.status !== "faltou").map((a) => ({ nome: a.paciente.nome, cor: a.profissional?.cor ?? null }))}
                  />
                )}
              </span>
            }
            id="agenda"
            primeiro
            lado={d ? <Teto usado={d.pacientes_novos_semana} teto={d.teto_pacientes_novos_semana} /> : undefined}
          >
            {!d ? (
              <OssoLinha n={3} />
            ) : slots.length === 0 ? (
              <Vazio titulo="Agenda livre hoje." sub={<BotaoLink href="/agenda" className="ml-1">Ver a semana</BotaoLink>} />
            ) : (
              <Lista>
                {slots.map((s) => {
                  if (s.tipo === "bl") {
                    return (
                      <Item key={s.id}>
                        <Linha
                          marca="nada"
                          titulo={<span className="num text-tinta-2">{hora(s.inicio)} – {hora(s.fim)}</span>}
                          sub="Bloqueado"
                        />
                      </Item>
                    );
                  }
                  const a = s.a;
                  const sugerido = a.status === "sugerido";
                  const faltou = a.status === "faltou";
                  const cancelado = a.status === "cancelado";
                  const passou = a.fim < agoraIso;
                  return (
                    <Item key={a.id}>
                      <Linha
                        marca={sugerido ? "anel" : faltou ? "falta" : a.status === "concluido" ? "feito" : a.origem === "agente" ? "ia" : "voce"}
                        href={`/pacientes/${a.paciente_id}`}
                        className={passou && !sugerido ? "opacity-60" : ""}
                        titulo={
                          <>
                            <span className="num">{hora(a.inicio)}</span>
                            <span className="text-tinta-3"> – </span>
                            <span className="num text-tinta-2">{hora(a.fim)}</span>
                            <span className="text-tinta-3"> · </span>
                            {a.paciente.nome}
                          </>
                        }
                        sub={
                          <>
                            {[
                              a.tipo,
                              a.paciente_novo ? "paciente novo" : null,
                              a.origem === "agente" ? "a IA marcou" : "você marcou",
                              sugerido ? "falta você confirmar" : null,
                              faltou ? "faltou" : null,
                              cancelado ? "cancelado" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            {a.observacao && <span className="tabela-linha__extra"> · {a.observacao}</span>}
                          </>
                        }
                        lado={
                          sugerido ? (
                            <Botao
                              onClick={(e) => {
                                e.preventDefault();
                                void confirmar(a.id, `${hora(a.inicio)} com ${a.paciente.nome}`);
                              }}
                            >
                              Confirmar
                            </Botao>
                          ) : (
                            <span className="a-linha__meta">{passou ? "já passou" : ""}</span>
                          )
                        }
                      />
                    </Item>
                  );
                })}
              </Lista>
            )}
          </Bloco>

          <Bloco titulo="Dia em números" id="numeros">
            {!d ? (
              <OssoLinha n={1} />
            ) : (
              <div className="numeros">
                <div className="numero"><b className="num"><NumeroRolante valor={reais(d.faturamento_previsto ?? 0)} /></b><span>faturamento previsto hoje</span></div>
                <div className="numero"><b className="num"><NumeroRolante valor={reais(d.faturamento_realizado ?? 0)} /></b><span>já realizado (atendidos)</span></div>
                <div className="numero">
                  <b className="num"><NumeroRolante valor={d.comparecimento_30d && d.comparecimento_30d.total > 0 ? `${Math.round((d.comparecimento_30d.compareceram / d.comparecimento_30d.total) * 100)}%` : "—"} /></b>
                  <span>comparecimento em 30 dias{d.comparecimento_30d ? ` · ${d.comparecimento_30d.faltaram} ${d.comparecimento_30d.faltaram === 1 ? "falta" : "faltas"}` : ""}</span>
                </div>
                <Link href="/financeiro#confirmacoes" className="numero pressa"><b className="num"><NumeroRolante valor={String(d.confirmacoes_pendentes ?? 0)} /></b><span>a confirmar nas próximas 48 h</span></Link>
                <Link href="/financeiro#retornos" className="numero pressa"><b className="num"><NumeroRolante valor={String(d.retornos_pendentes ?? 0)} /></b><span>retornos para chamar</span></Link>
              </div>
            )}
          </Bloco>

          <Bloco titulo="Desde ontem" id="desde-ontem">
            {!d ? (
              <div className="grid gap-2" aria-hidden>
                <span className="osso h-4 w-56" />
                <span className="osso h-4 w-64" />
              </div>
            ) : (
              <div className="a-contagem">
                <p>
                  <b className="num">{d.contatos_novos_24h}</b>{" "}
                  {d.contatos_novos_24h === 1 ? "contato novo chegou." : "contatos novos chegaram."}
                </p>
                <p>
                  A IA respondeu <b className="num">{d.mensagens_ia_hoje}</b>{" "}
                  {d.mensagens_ia_hoje === 1 ? "mensagem hoje." : "mensagens hoje."}
                  {x?.ativas !== null && x?.ativas !== undefined && (
                    <>
                      {" "}
                      <b className="num">{x.ativas}</b> {x.ativas === 1 ? "conversa em andamento." : "conversas em andamento."}
                    </>
                  )}
                </p>
              </div>
            )}
          </Bloco>
        </div>

        <aside className="hoje-lateral" aria-label="Resumo">
          <section className="painel">
            <h2 className="painel__titulo">
              Novos na semana <Link href="/ajustes#novos">teto</Link>
            </h2>
            {!d ? (
              <span className="osso block h-10 w-32" />
            ) : d.teto_pacientes_novos_semana > 0 ? (
              <>
                <div className="painel__n num">
                  {d.pacientes_novos_semana}
                  <span className="text-tinta-3"> / {d.teto_pacientes_novos_semana}</span>
                </div>
                <div className="imas-fileira" aria-hidden>
                  {Array.from({ length: d.teto_pacientes_novos_semana }).map((_, i) =>
                    i < d.pacientes_novos_semana ? (
                      <Marca key={i} tipo="ia" />
                    ) : (
                      <span key={i} className="marca marca--vaga" />
                    ),
                  )}
                </div>
                <p className="painel__l">
                  {d.pacientes_novos_semana >= d.teto_pacientes_novos_semana
                    ? "Teto cheio. A IA não oferece horário para gente nova até segunda."
                    : `Ainda cabem ${d.teto_pacientes_novos_semana - d.pacientes_novos_semana} nesta semana.`}
                </p>
              </>
            ) : (
              <p className="painel__l">Sem teto definido. A IA marca quantos novos aparecerem.</p>
            )}
          </section>

          <section className="painel">
            <h2 className="painel__titulo">
              Semana <Link href="/agenda">ver agenda</Link>
            </h2>
            {!x ? (
              <span className="osso block h-24 w-full" />
            ) : x.semana ? (
              Array.from({ length: 6 }).map((_, i) => {
                const dia = somarDias(inicioDaSemana(civil), i);
                const n = x.semana!.agendamentos.filter(
                  (a) => a.inicio.slice(0, 10) === dia && a.status !== "cancelado",
                ).length;
                const sug = x.semana!.agendamentos.filter((a) => a.inicio.slice(0, 10) === dia && a.status === "sugerido").length;
                return (
                  <div key={dia} className={`painel__linha ${dia === civil ? "text-tinta" : ""}`}>
                    <span>
                      <b className="num">{diaNumero(dia)}</b> {diaSemanaCurto(dia)}
                      {dia === civil ? " · hoje" : ""}
                    </span>
                    <span className="num">
                      {n === 0 ? "livre" : `${n} ${n === 1 ? "horário" : "horários"}`}
                      {sug > 0 ? ` · ${sug} a confirmar` : ""}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="painel__l">Não deu para carregar a semana.</p>
            )}
          </section>

          <section className="painel">
            <h2 className="painel__titulo">
              Campanha de retorno <Link href="/campanha">abrir</Link>
            </h2>
            {!x ? (
              <span className="osso block h-12 w-40" />
            ) : x.campanha ? (
              <>
                <div className="painel__n painel__n--ia num">{x.campanha.agendadas}</div>
                <p className="painel__l">{x.campanha.agendadas === 1 ? "pessoa voltou a marcar" : "pessoas voltaram a marcar"}</p>
                <div className="painel__linha">
                  <span>Na fila</span>
                  <b className="num">{x.campanha.fila}</b>
                </div>
                <div className="painel__linha">
                  <span>Responderam</span>
                  <b className="num">{x.campanha.respondidas}</b>
                </div>
                <div className="painel__linha">
                  <span>Estado</span>
                  <b>{x.campanha.pausada ? "pausada" : "enviando"}</b>
                </div>
              </>
            ) : (
              <p className="painel__l">Sem dados da campanha.</p>
            )}
          </section>

          <section className="painel">
            <h2 className="painel__titulo">
              Gasto de IA no mês <Link href="/consumo">detalhes</Link>
            </h2>
            {!x ? (
              <span className="osso block h-12 w-40" />
            ) : x.consumo && x.consumo.gasto_brl !== null ? (
              <>
                <div className={`painel__n num ${x.consumo.teto_brl > 0 && x.consumo.gasto_brl >= x.consumo.teto_brl ? "painel__n--alerta" : ""}`}>
                  {reais(x.consumo.gasto_brl)}
                </div>
                {x.consumo.teto_brl > 0 ? (
                  <>
                    <div className="painel__barra" aria-hidden>
                      <span
                        className={x.consumo.gasto_brl >= x.consumo.teto_brl ? "alerta" : ""}
                        style={{ transform: `scaleX(${Math.min(1, x.consumo.gasto_brl / x.consumo.teto_brl)})` }}
                      />
                    </div>
                    <p className="painel__l">de {reais(x.consumo.teto_brl)} do teto</p>
                  </>
                ) : (
                  <p className="painel__l">sem teto definido</p>
                )}
              </>
            ) : (
              <p className="painel__l">Fonte de consumo ainda não ligada.</p>
            )}
            {x?.config && (
              <div className="painel__linha">
                <span>
                  <Marca tipo={x.config.agente_ativo ? "ia" : "falta"} className="mr-1.5 inline-block align-[-1px]" />
                  IA no WhatsApp
                </span>
                <b>{x.config.agente_ativo ? "ligada" : "desligada"}</b>
              </div>
            )}
          </section>
        </aside>
      </div>
    </Pagina>
  );
}
