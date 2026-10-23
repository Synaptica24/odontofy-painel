"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const temPendencia = (d?.escaladas.length ?? 0) > 0;

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
      <Cabecalho sobre={diaLongo(civil)} titulo="Hoje" />

      {r.fase === "erro" && !d && <Erro mensagem={r.erro} tentar={r.recarregar} />}

      <div className="grade-hoje">
        <div>
          <Bloco titulo="Esperando você" id="esperando" lado={temPendencia ? d!.escaladas.length : undefined} primeiro>
            {!d ? (
              <OssoLinha n={2} />
            ) : temPendencia ? (
              <Lista>
                {d.escaladas.map((c) => (
                  <Item key={c.id} saindo={saindo === c.id}>
                    <Linha
                      marca="escalada"
                      alerta
                      href={`/conversas/${c.id}`}
                      titulo={c.paciente.nome}
                      sub={c.motivo_escalonamento ?? c.ultima_mensagem?.texto ?? "Pediu para falar com você"}
                      meta={
                        <>
                          {c.urgente ? "Urgente · " : ""}
                          {haQuanto(c.iniciada_em)}
                          {c.ultima_mensagem && c.ultima_mensagem.texto !== c.motivo_escalonamento && (
                            <span className="tabela-linha__extra">
                              {" · última mensagem: “"}
                              {c.ultima_mensagem.texto.slice(0, 70)}
                              {c.ultima_mensagem.texto.length > 70 ? "…" : ""}”
                            </span>
                          )}
                        </>
                      }
                      lado={
                        <Botao
                          cheio
                          onClick={(e) => {
                            e.preventDefault();
                            void assumir(c.id, c.paciente.nome);
                          }}
                        >
                          Assumir
                        </Botao>
                      }
                    />
                  </Item>
                ))}
              </Lista>
            ) : (
              <Vazio titulo="Nada esperando você." sub="A IA está respondendo tudo." />
            )}
          </Bloco>

          <Bloco
            titulo="Agenda de hoje"
            id="agenda"
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
                        marca={sugerido ? "anel" : faltou ? "falta" : a.origem === "agente" ? "ia" : "voce"}
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
