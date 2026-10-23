"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, Lock, MessageCircle } from "lucide-react";
import {
  agendaFiltrada, cancelarAgendamento, concluirAgendamento, confirmarSugestao, criarAgendamento, criarBloqueioPainel, editarAgendamento,
  lerConfig, marcarFalta, marcarConfirmacaoEnviada, remarcarAgendamento, removerBloqueio,
} from "@/lib/api";
import type { AgendamentoComPaciente, Bloqueio, Config, Convenio, Paciente, Profissional } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { civilParaData, diaLongo, diaNumero, diaSemanaCurto, hojeCivil, hora, inicioDaSemana, mesPorExtenso, reais, somarDias, telefoneBonito } from "@/components/dados/datas";
import { Botao, Campo, Entrada, Erro, Pagina, AreaTexto, Abas } from "@/components/ui/primitivos";
import { Folha } from "@/components/clinica/folha";
import { BuscaPaciente } from "@/components/clinica/busca-paciente";
import { PacienteForm } from "@/components/clinica/paciente-form";

/* Agenda no desenho do Codental: minicalendário à esquerda, grade por dia com faixas de horário,
   blocos coloridos por estado, clique no vazio cria, clique no bloco abre. Um profissional por vez. */

const HORA_INICIO = 7;
const HORA_FIM = 20;
const ALTURA_HORA = 64;
const FUSO = "America/Sao_Paulo";

const ROTULO_STATUS: Record<string, string> = {
  sugerido: "Sugerido pela IA", agendado: "Agendado", confirmado: "Confirmado", cancelado: "Cancelado", faltou: "Faltou", concluido: "Atendido",
};
const CHIP_STATUS: Record<string, string> = {
  sugerido: "chip--amarelo", agendado: "chip--azul", confirmado: "chip--verde", cancelado: "", faltou: "chip--vermelho", concluido: "",
};

/** Minutos desde a meia-noite local (São Paulo) de um ISO. */
function minutosLocais(iso: string) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0);
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h * 60 + m;
}
function civilDe(iso: string) {
  return hojeCivil(new Date(iso));
}
/** ISO com offset de São Paulo para uma data civil e minutos. Usa o offset real do dia (horário de verão não existe hoje, mas fica certo). */
function isoLocal(civil: string, minutos: number) {
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  const tentativa = new Date(`${civil}T${h}:${m}:00-03:00`);
  // corrige se o offset do dia for diferente de -03:00
  const local = minutosLocais(tentativa.toISOString());
  const delta = minutos - local;
  return new Date(tentativa.getTime() + delta * 60000).toISOString();
}
function horaCurta(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function mensagemConfirmacao(a: AgendamentoComPaciente) {
  const dia = diaLongo(civilDe(a.inicio));
  return `Olá, ${a.paciente.nome.split(" ")[0]}! Passando para confirmar sua consulta (${a.tipo}) ${dia.toLowerCase()} às ${hora(a.inicio)} com o Dr. Mateus Peixoto. Pode confirmar respondendo SIM? Se precisar remarcar, é só avisar.`;
}

export function TelaAgenda() {
  const params = useSearchParams();
  const router = useRouter();
  const [visao, setVisao] = useState<"dia" | "semana">("dia");
  const [data, setData] = useState(() => params.get("data") ?? hojeCivil());
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [mesMini, setMesMini] = useState(() => (params.get("data") ?? hojeCivil()).slice(0, 7));
  const [config, setConfig] = useState<Config | null>(null);
  const [novo, setNovo] = useState<{ civil: string; minutos: number } | null>(null);
  const [aberto, setAberto] = useState<AgendamentoComPaciente | null>(null);
  const [bloqueando, setBloqueando] = useState<{ civil: string; minutos: number } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = window.requestAnimationFrame(() => { if (window.matchMedia("(min-width: 1024px)").matches) setVisao("semana"); });
    void lerConfig().then((r) => r.sucesso && setConfig(r.dados));
    const t = window.setInterval(() => setAgora(Date.now()), 60000);
    return () => { window.cancelAnimationFrame(id); window.clearInterval(t); };
  }, []);

  const inicio = visao === "semana" ? inicioDaSemana(data) : data;
  const dias = visao === "semana" ? 7 : 1;
  // Sem profissional escolhido, a primeira carga vem sem filtro; depois o primeiro da lista vira o ativo.
  const r = useApi(() => agendaFiltrada(inicio, dias as 1 | 7, profissionalId ? { profissional_id: profissionalId } : {}), [inicio, dias, profissionalId]);
  const d = r.dados;
  const profissionais: Profissional[] = useMemo(() => d?.profissionais ?? [], [d]);
  const convenios: Convenio[] = d?.convenios ?? [];
  const profissionalAtivo = profissionalId || profissionais[0]?.id || "";

  const colunas = useMemo(() => Array.from({ length: visao === "semana" ? 6 : 1 }, (_, i) => somarDias(inicio, i)), [inicio, visao]);
  const horas = useMemo(() => Array.from({ length: HORA_FIM - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i), []);
  const alturaGrade = (HORA_FIM - HORA_INICIO) * ALTURA_HORA;

  function expediente(civil: string) {
    if (!config) return null;
    const dow = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "long" }).format(civilParaData(civil)).toLowerCase();
    const chave = ({ monday: "segunda", tuesday: "terca", wednesday: "quarta", thursday: "quinta", friday: "sexta", saturday: "sabado", sunday: "domingo" } as const)[dow as "monday"];
    return config.horarios_atendimento[chave] ?? [];
  }

  function clicouVazio(civil: string, e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest(".ag__bloco")) return;
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    const minutos = HORA_INICIO * 60 + Math.floor((y / ALTURA_HORA) * 60 / 15) * 15;
    if (e.shiftKey) setBloqueando({ civil, minutos });
    else setNovo({ civil, minutos });
  }

  function avancar(n: number) {
    const nova = somarDias(data, visao === "dia" ? n : 7 * n);
    setData(nova); setMesMini(nova.slice(0, 7));
  }
  const irPara = useCallback((civil: string) => { setData(civil); setMesMini(civil.slice(0, 7)); router.replace(`/agenda?data=${civil}`); }, [router]);

  /* ---- ações sobre o agendamento (otimistas) ---- */
  async function agir(a: AgendamentoComPaciente, acao: "confirmar" | "falta" | "cancelar" | "concluir" | "remarcar", novoInicio?: string) {
    if (!d) return;
    const antes = d;
    const proximo = { confirmar: "confirmado", falta: "faltou", cancelar: "cancelado", concluir: "concluido", remarcar: a.status }[acao] as AgendamentoComPaciente["status"];
    r.definir((x) => ({ ...x, agendamentos: x.agendamentos.map((i) => (i.id === a.id ? { ...i, status: proximo, ...(novoInicio ? { inicio: novoInicio, fim: new Date(Date.parse(novoInicio) + (Date.parse(a.fim) - Date.parse(a.inicio))).toISOString() } : {}) } : i)) }));
    setAberto(null);
    const res = acao === "confirmar" ? await confirmarSugestao(a.id) : acao === "falta" ? await marcarFalta(a.id) : acao === "cancelar" ? await cancelarAgendamento(a.id) : acao === "concluir" ? await concluirAgendamento(a.id) : await remarcarAgendamento(a.id, novoInicio!);
    if (!res.sucesso) { r.definir(() => antes); toast.error("Não deu certo.", { description: res.erro.mensagem }); return; }
    const rotulos = { confirmar: "Consulta confirmada", falta: "Falta registrada", cancelar: "Consulta cancelada", concluir: "Atendimento concluído", remarcar: "Consulta remarcada" };
    toast(rotulos[acao], { description: `${a.paciente.nome} · ${hora(res.dados.inicio)}`, action: { label: "Ver ficha", onClick: () => router.push(`/pacientes/${a.paciente_id}`) } });
    void r.recarregar();
  }
  async function enviarConfirmacao(a: AgendamentoComPaciente) {
    window.open(`https://wa.me/${a.paciente.telefone_e164.replace(/\D/g, "")}?text=${encodeURIComponent(mensagemConfirmacao(a))}`, "_blank", "noopener");
    const res = await marcarConfirmacaoEnviada(a.id);
    if (res.sucesso) { toast("Mensagem de confirmação aberta no WhatsApp", { description: "Quando o paciente responder, marque como confirmada." }); void r.recarregar(); }
  }
  async function apagarBloqueio(b: Bloqueio) {
    const res = await removerBloqueio(b.id);
    if (!res.sucesso) { toast.error("Não deu para remover o bloqueio."); return; }
    toast("Bloqueio removido"); void r.recarregar();
  }

  const ocupados = useMemo(() => new Set((d?.agendamentos ?? []).filter((a) => a.status !== "cancelado").map((a) => civilDe(a.inicio))), [d]);
  const hoje = hojeCivil();
  const minutosAgora = minutosLocais(new Date(agora).toISOString());

  return (
    <Pagina>
      <div className="ag">
        <aside className="ag__lateral">
          <section className="a-bloco a-bloco--primeiro">
            <MiniCalendario mes={mesMini} data={data} semana={visao === "semana" ? inicio : null} ocupados={ocupados} aoMudarMes={setMesMini} aoEscolher={irPara} />
          </section>
          <section className="a-bloco">
            <div className="a-legenda"><h2>Profissional</h2></div>
            {profissionais.length === 0 ? (
              <p className="text-[13px] text-tinta-3">Cadastre em <Link href="/ajustes#profissionais" className="text-ia">Ajustes</Link>.</p>
            ) : (
              <select className="a-entrada a-select w-full" value={profissionalAtivo} onChange={(e) => setProfissionalId(e.target.value)} aria-label="Profissional">
                {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            )}
            <div className="ag__legenda mt-3" aria-label="Legenda">
              <span><i style={{ background: "#eff8ff", borderColor: "#1570ef" }} />Agendado</span>
              <span><i style={{ background: "#ecfdf3", borderColor: "#17b26a" }} />Confirmado</span>
              <span><i style={{ background: "#fffaeb", borderColor: "#f79009", borderStyle: "dashed" }} />Sugerido pela IA</span>
              <span><i style={{ background: "#fef3f2", borderColor: "#f04438" }} />Faltou</span>
              <span><i style={{ background: "repeating-linear-gradient(135deg,#f2f4f7 0 3px,#e4e7ec 3px 4px)" }} />Bloqueado</span>
            </div>
            <p className="mt-3 text-[12px] text-tinta-3">Clique num horário vazio para marcar. Shift + clique bloqueia.</p>
          </section>
        </aside>

        <section className="ag__principal">
          {r.fase === "erro" && !d && <Erro mensagem={r.erro} tentar={r.recarregar} />}
          <div className="ag__barra">
            <h1 className="ag__titulo">{visao === "dia" ? diaLongo(data) : `${diaNumero(inicio)} a ${diaNumero(somarDias(inicio, 5))} de ${mesPorExtenso(civilParaData(inicio)).toLowerCase()}`}</h1>
            <div className="ag__passos" role="group" aria-label="Navegar">
              <button type="button" onClick={() => avancar(-1)} aria-label="Anterior"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => irPara(hoje)}>Hoje</button>
              <button type="button" onClick={() => avancar(1)} aria-label="Próximo"><ChevronRight size={16} /></button>
            </div>
            <Abas valor={visao} aoMudar={setVisao} opcoes={[{ valor: "dia", rotulo: "Dia" }, { valor: "semana", rotulo: "Semana" }]} />
            <Botao cheio onClick={() => setNovo({ civil: data, minutos: Math.max(HORA_INICIO * 60, Math.ceil(minutosAgora / 30) * 30) })}><Plus size={16} aria-hidden /> Nova consulta</Botao>
          </div>

          <div className="ag__rolagem">
            <div className="ag__grade" style={{ "--dias": colunas.length, "--altura-hora": `${ALTURA_HORA}px` } as React.CSSProperties}>
              <div className="ag__cabeca" aria-hidden />
              {colunas.map((c) => (
                <div key={c} className={`ag__cabeca ${c === hoje ? "ag__cabeca--hoje" : ""}`}>
                  {diaSemanaCurto(c)}
                  <b className="num">{diaNumero(c)}</b>
                </div>
              ))}
              <div className="ag__horas" style={{ height: alturaGrade }}>
                {horas.map((h) => <span key={h} className="ag__hora num" style={{ top: (h - HORA_INICIO) * ALTURA_HORA }}>{String(h).padStart(2, "0")}:00</span>)}
              </div>
              {colunas.map((c) => {
                const faixas = expediente(c);
                const itens = (d?.agendamentos ?? []).filter((a) => civilDe(a.inicio) === c);
                const bloqueios = (d?.bloqueios ?? []).filter((b) => civilDe(b.inicio) === c);
                return (
                  <div
                    key={c}
                    className={`ag__dia ${c === hoje ? "ag__dia--hoje" : ""} ${faixas && faixas.length === 0 ? "ag__dia--fora" : ""}`}
                    style={{ height: alturaGrade }}
                    onClick={(e) => clicouVazio(c, e)}
                    role="presentation"
                  >
                    {faixas && faixas.length > 0 && (() => {
                      // sombreia o que está fora do expediente
                      const sombras: React.ReactNode[] = []; let cursor = HORA_INICIO * 60;
                      for (const f of faixas) {
                        const ini = Number(f.inicio.slice(0, 2)) * 60 + Number(f.inicio.slice(3));
                        if (ini > cursor) sombras.push(<div key={`s${cursor}`} className="absolute inset-x-0 bg-fundo-app/70 pointer-events-none" style={{ top: ((cursor - HORA_INICIO * 60) / 60) * ALTURA_HORA, height: ((ini - cursor) / 60) * ALTURA_HORA }} />);
                        cursor = Number(f.fim.slice(0, 2)) * 60 + Number(f.fim.slice(3));
                      }
                      if (cursor < HORA_FIM * 60) sombras.push(<div key="sfim" className="absolute inset-x-0 bg-fundo-app/70 pointer-events-none" style={{ top: ((cursor - HORA_INICIO * 60) / 60) * ALTURA_HORA, height: ((HORA_FIM * 60 - cursor) / 60) * ALTURA_HORA }} />);
                      return sombras;
                    })()}
                    {bloqueios.map((b) => {
                      const ini = Math.max(HORA_INICIO * 60, minutosLocais(b.inicio)); const fim = Math.min(HORA_FIM * 60, minutosLocais(b.fim));
                      return (
                        <button key={b.id} type="button" className="ag__bloco ag__bloco--bloqueio" style={{ top: ((ini - HORA_INICIO * 60) / 60) * ALTURA_HORA, height: Math.max(18, ((fim - ini) / 60) * ALTURA_HORA - 2) }}
                          onClick={(e) => { e.stopPropagation(); if (window.confirm(`Remover o bloqueio ${horaCurta(ini)}–${horaCurta(fim)}${b.motivo ? ` (${b.motivo})` : ""}?`)) void apagarBloqueio(b); }}>
                          <b><Lock size={10} className="inline" aria-hidden /> {b.motivo || "Bloqueado"}</b>
                          <small className="num">{horaCurta(ini)} – {horaCurta(fim)}</small>
                        </button>
                      );
                    })}
                    {itens.map((a) => {
                      const ini = minutosLocais(a.inicio); const fim = minutosLocais(a.fim);
                      const top = ((ini - HORA_INICIO * 60) / 60) * ALTURA_HORA; const altura = Math.max(22, ((fim - ini) / 60) * ALTURA_HORA - 2);
                      const conv = a.convenio;
                      return (
                        <button key={a.id} type="button" className={`ag__bloco ag__bloco--${a.status}`} style={{ top, height: altura }} onClick={(e) => { e.stopPropagation(); setAberto(a); }} title={`${hora(a.inicio)} ${a.paciente.nome} · ${a.tipo}`}>
                          <b>{a.paciente.nome}</b>
                          {altura > 36 && <small className="num">{hora(a.inicio)} · {a.tipo}</small>}
                          {conv && altura > 52 && <span className="ag__convenio" style={{ background: conv.cor }}>{conv.nome}</span>}
                        </button>
                      );
                    })}
                    {c === hoje && minutosAgora >= HORA_INICIO * 60 && minutosAgora <= HORA_FIM * 60 && (
                      <div className="ag__agora" style={{ top: ((minutosAgora - HORA_INICIO * 60) / 60) * ALTURA_HORA }} aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {d && (
            <p className="mt-2 text-[13px] text-tinta-3 num">
              {d.agendamentos.filter((a) => !["cancelado"].includes(a.status)).length} consultas · {d.agendamentos.filter((a) => a.status === "sugerido").length} a confirmar
              {d.teto_pacientes_novos_semana > 0 ? ` · ${d.pacientes_novos_semana} de ${d.teto_pacientes_novos_semana} novos na semana` : ""}
            </p>
          )}
        </section>
      </div>

      {novo && (
        <NovaConsulta civil={novo.civil} minutos={novo.minutos} config={config} profissionais={profissionais} profissionalId={profissionalAtivo} convenios={convenios}
          aoFechar={() => setNovo(null)} aoCriar={() => { setNovo(null); void r.recarregar(); }} />
      )}
      {bloqueando && (
        <NovoBloqueio civil={bloqueando.civil} minutos={bloqueando.minutos} profissionalId={profissionalAtivo} aoFechar={() => setBloqueando(null)} aoCriar={() => { setBloqueando(null); void r.recarregar(); }} />
      )}
      {aberto && (
        <DetalheConsulta a={aberto} convenios={convenios} aoFechar={() => setAberto(null)} agir={agir} enviarConfirmacao={enviarConfirmacao} aoEditar={() => void r.recarregar()} />
      )}
    </Pagina>
  );
}

/* ---------- minicalendário ---------- */
function MiniCalendario({ mes, data, semana, ocupados, aoMudarMes, aoEscolher }: { mes: string; data: string; semana: string | null; ocupados: Set<string>; aoMudarMes: (m: string) => void; aoEscolher: (c: string) => void }) {
  const primeiro = `${mes}-01`;
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short" }).format(civilParaData(primeiro)));
  const inicioGrade = somarDias(primeiro, -dow);
  const celulas = Array.from({ length: 42 }, (_, i) => somarDias(inicioGrade, i));
  const hoje = hojeCivil();
  const mudar = (n: number) => { const d = civilParaData(primeiro); d.setUTCMonth(d.getUTCMonth() + n); aoMudarMes(hojeCivil(d).slice(0, 7)); };
  const semanaFim = semana ? somarDias(semana, 6) : null;
  return (
    <div className="mini">
      <div className="mini__cabeca">
        <button type="button" onClick={() => mudar(-1)} aria-label="Mês anterior"><ChevronLeft size={16} /></button>
        <span>{mesPorExtenso(civilParaData(primeiro))}</span>
        <button type="button" onClick={() => mudar(1)} aria-label="Próximo mês"><ChevronRight size={16} /></button>
      </div>
      <div className="mini__grade">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((s, i) => <span key={i} aria-hidden>{s}</span>)}
        {celulas.map((c) => (
          <button key={c} type="button" onClick={() => aoEscolher(c)} aria-label={diaLongo(c)} aria-pressed={c === data}
            className={`mini__dia num ${c.slice(0, 7) !== mes ? "mini__dia--fora" : ""} ${c === hoje ? "mini__dia--hoje" : ""} ${semana && c >= semana && c <= semanaFim! ? "mini__dia--semana" : ""} ${c === data ? "mini__dia--ativo" : ""} ${ocupados.has(c) ? "mini__dia--ocupado" : ""}`}>
            {Number(c.slice(8))}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- nova consulta ---------- */
function NovaConsulta({ civil, minutos, config, profissionais, profissionalId, convenios, aoFechar, aoCriar }: {
  civil: string; minutos: number; config: Config | null; profissionais: Profissional[]; profissionalId: string; convenios: Convenio[]; aoFechar: () => void; aoCriar: () => void;
}) {
  const tipos = Object.entries(config?.duracoes_por_tipo ?? {});
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [cadastrando, setCadastrando] = useState<string | null>(null);
  const [f, setF] = useState({ data: civil, hora: horaCurta(minutos), tipo: tipos[0]?.[0] ?? "Avaliação", duracao: tipos[0]?.[1] ?? 30, profissional_id: profissionalId, convenio_id: "", valor: "", observacao: "", status: "agendado" as "agendado" | "confirmado" });
  const [salvando, setSalvando] = useState(false);
  function escolherPaciente(p: Paciente | null) {
    setPaciente(p);
    if (p?.convenio_id) setF((a) => ({ ...a, convenio_id: p.convenio_id ?? "" }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!paciente) { toast.error("Escolha o paciente."); return; }
    const [h, m] = f.hora.split(":").map(Number);
    setSalvando(true);
    const res = await criarAgendamento({ paciente_id: paciente.id, tipo: f.tipo, inicio: isoLocal(f.data, h * 60 + m), duracao_min: Number(f.duracao), profissional_id: f.profissional_id || null, convenio_id: f.convenio_id || null, observacao: f.observacao, valor: Number(f.valor.replace(",", ".")) || 0, status: f.status });
    setSalvando(false);
    if (!res.sucesso) { toast.error("Não deu para marcar.", { description: res.erro.codigo === "conflito" ? "Já existe consulta ou bloqueio nesse horário." : res.erro.mensagem }); return; }
    toast(`Consulta marcada: ${paciente.nome}`, { description: `${diaLongo(f.data)} às ${f.hora}` });
    aoCriar();
  }
  const m = (campo: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((a) => ({ ...a, [campo]: e.target.value }));
  return (
    <>
      <Folha titulo="Nova consulta" sobre={`${diaLongo(civil)} · ${horaCurta(minutos)}`} aoFechar={aoFechar}>
        <form onSubmit={salvar} className="folha__grade">
          <Campo rotulo="Paciente"><BuscaPaciente valor={paciente} aoEscolher={escolherPaciente} aoCriarNovo={(t) => setCadastrando(t)} autoFoco /></Campo>
          <div className="folha__grade folha__grade--2">
            <Campo rotulo="Dia"><Entrada type="date" value={f.data} onChange={m("data")} required /></Campo>
            <Campo rotulo="Hora"><Entrada type="time" value={f.hora} onChange={m("hora")} step={300} required /></Campo>
            <Campo rotulo="Tipo">
              {tipos.length ? (
                <select className="a-entrada a-select" value={f.tipo} onChange={(e) => { const t = e.target.value; setF((a) => ({ ...a, tipo: t, duracao: config?.duracoes_por_tipo[t] ?? a.duracao })); }}>
                  {tipos.map(([t]) => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : <Entrada value={f.tipo} onChange={m("tipo")} required />}
            </Campo>
            <Campo rotulo="Duração (min)"><Entrada type="number" min={5} max={720} step={5} value={f.duracao} onChange={m("duracao")} required /></Campo>
            <Campo rotulo="Profissional">
              <select className="a-entrada a-select" value={f.profissional_id} onChange={m("profissional_id")}>
                {profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Convênio">
              <select className="a-entrada a-select" value={f.convenio_id} onChange={m("convenio_id")}>
                <option value="">Particular</option>
                {convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Valor previsto (R$)"><Entrada inputMode="decimal" value={f.valor} onChange={m("valor")} placeholder="0,00" /></Campo>
            <Campo rotulo="Estado">
              <select className="a-entrada a-select" value={f.status} onChange={m("status")}>
                <option value="agendado">Agendado (falta confirmar)</option><option value="confirmado">Confirmado</option>
              </select>
            </Campo>
          </div>
          <Campo rotulo="Observação"><AreaTexto rows={2} value={f.observacao} onChange={m("observacao")} maxLength={2000} /></Campo>
          <div className="folha__acoes">
            <Botao type="submit" cheio disabled={salvando}>{salvando ? "Marcando…" : "Marcar consulta"}</Botao>
            <Botao onClick={aoFechar}>Cancelar</Botao>
          </div>
        </form>
      </Folha>
      {cadastrando !== null && <PacienteForm nomeInicial={cadastrando} aoFechar={() => setCadastrando(null)} aoSalvar={(p) => { setPaciente(p); setCadastrando(null); }} />}
    </>
  );
}

/* ---------- bloqueio ---------- */
function NovoBloqueio({ civil, minutos, profissionalId, aoFechar, aoCriar }: { civil: string; minutos: number; profissionalId: string; aoFechar: () => void; aoCriar: () => void }) {
  const [f, setF] = useState({ data: civil, inicio: horaCurta(minutos), fim: horaCurta(Math.min(HORA_FIM * 60, minutos + 60)), motivo: "", todos: false });
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const [hi, mi] = f.inicio.split(":").map(Number); const [hf, mf] = f.fim.split(":").map(Number);
    const res = await criarBloqueioPainel(isoLocal(f.data, hi * 60 + mi), isoLocal(f.data, hf * 60 + mf), f.todos ? null : profissionalId || null, f.motivo);
    if (!res.sucesso) { toast.error("Não deu para bloquear.", { description: res.erro.codigo === "conflito" ? "Há consulta nesse horário." : res.erro.mensagem }); return; }
    toast("Horário bloqueado"); aoCriar();
  }
  return (
    <Folha titulo="Bloquear horário" sobre={diaLongo(civil)} aoFechar={aoFechar}>
      <form onSubmit={salvar} className="folha__grade">
        <Campo rotulo="Dia"><Entrada type="date" value={f.data} onChange={(e) => setF((a) => ({ ...a, data: e.target.value }))} /></Campo>
        <div className="folha__grade folha__grade--2">
          <Campo rotulo="Das"><Entrada type="time" value={f.inicio} step={300} onChange={(e) => setF((a) => ({ ...a, inicio: e.target.value }))} /></Campo>
          <Campo rotulo="Até"><Entrada type="time" value={f.fim} step={300} onChange={(e) => setF((a) => ({ ...a, fim: e.target.value }))} /></Campo>
        </div>
        <Campo rotulo="Motivo"><Entrada value={f.motivo} onChange={(e) => setF((a) => ({ ...a, motivo: e.target.value }))} placeholder="Almoço, curso, folga…" maxLength={200} /></Campo>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" className="h-4 w-4" checked={f.todos} onChange={(e) => setF((a) => ({ ...a, todos: e.target.checked }))} /> Para todos os profissionais</label>
        <div className="folha__acoes"><Botao type="submit" cheio>Bloquear</Botao><Botao onClick={aoFechar}>Cancelar</Botao></div>
      </form>
    </Folha>
  );
}

/* ---------- detalhe da consulta ---------- */
function DetalheConsulta({ a, convenios, aoFechar, agir, enviarConfirmacao, aoEditar }: {
  a: AgendamentoComPaciente; convenios: Convenio[]; aoFechar: () => void;
  agir: (a: AgendamentoComPaciente, acao: "confirmar" | "falta" | "cancelar" | "concluir" | "remarcar", novoInicio?: string) => Promise<void>;
  enviarConfirmacao: (a: AgendamentoComPaciente) => Promise<void>; aoEditar: () => void;
}) {
  const [remarcando, setRemarcando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [novaData, setNovaData] = useState(civilDe(a.inicio));
  const [novaHora, setNovaHora] = useState(hora(a.inicio));
  const [ed, setEd] = useState({ convenio_id: a.convenio_id ?? "", valor: a.valor ? String(a.valor) : "", observacao: a.observacao });
  const encerrado = ["cancelado", "faltou", "concluido"].includes(a.status);
  const [passou] = useState(() => Date.parse(a.fim) < Date.now());
  async function salvarEdicao() {
    const res = await editarAgendamento(a.id, { convenio_id: ed.convenio_id || null, valor: Number(ed.valor.replace(",", ".")) || 0, observacao: ed.observacao });
    if (!res.sucesso) { toast.error("Não deu para salvar.", { description: res.erro.mensagem }); return; }
    toast("Consulta atualizada"); setEditando(false); aoEditar(); aoFechar();
  }
  return (
    <Folha titulo={a.paciente.nome} sobre={`${diaLongo(civilDe(a.inicio))} · ${hora(a.inicio)} – ${hora(a.fim)}`} aoFechar={aoFechar}
      acoes={
        <>
          {!encerrado && (a.status === "sugerido" || a.status === "agendado") && <Botao cheio onClick={() => void agir(a, "confirmar")}>Confirmar</Botao>}
          {!encerrado && a.status !== "sugerido" && <Botao onClick={() => void agir(a, "concluir")}>Atendido</Botao>}
          {!encerrado && a.status !== "sugerido" && <Botao alerta onClick={() => void agir(a, "falta")}>Faltou</Botao>}
          {!encerrado && <Botao onClick={() => setRemarcando((v) => !v)}>Remarcar</Botao>}
          {!encerrado && <Botao onClick={() => { if (window.confirm("Cancelar esta consulta?")) void agir(a, "cancelar"); }}>Cancelar</Botao>}
        </>
      }>
      <dl className="ficha__resumo">
        <div><dt>Estado</dt><dd><span className={`chip ${CHIP_STATUS[a.status]}`}>{ROTULO_STATUS[a.status]}</span>{a.confirmacao_enviada_em && a.status === "agendado" ? <span className="ml-2 text-[12px] text-tinta-3">confirmação enviada {hora(a.confirmacao_enviada_em)}</span> : null}</dd></div>
        <div><dt>Tipo</dt><dd>{a.tipo}{a.paciente_novo ? " · paciente novo" : ""}</dd></div>
        <div><dt>Telefone</dt><dd><a className="text-ia" href={`https://wa.me/${a.paciente.telefone_e164.replace(/\D/g, "")}`} target="_blank" rel="noopener">{telefoneBonito(a.paciente.telefone_e164)}</a></dd></div>
        <div><dt>Convênio</dt><dd>{a.convenio ? <span className="chip chip--cor" style={{ background: a.convenio.cor }}>{a.convenio.nome}</span> : "Particular"}</dd></div>
        <div><dt>Valor previsto</dt><dd className="num">{a.valor ? reais(a.valor) : "—"}</dd></div>
        <div><dt>Marcado por</dt><dd>{a.origem === "agente" ? "IA no WhatsApp" : "painel"}{a.profissional ? ` · ${a.profissional.nome}` : ""}</dd></div>
        {a.observacao && <div style={{ gridColumn: "1 / -1" }}><dt>Observação</dt><dd>{a.observacao}</dd></div>}
      </dl>
      <div className="flex flex-wrap gap-2 mt-2">
        <Link href={`/pacientes/${a.paciente_id}`} className="a-botao pressa inline-flex items-center gap-1.5">Abrir ficha</Link>
        {!encerrado && !passou && <Botao onClick={() => void enviarConfirmacao(a)}><MessageCircle size={16} aria-hidden /> Pedir confirmação no WhatsApp</Botao>}
        {!encerrado && <Botao onClick={() => setEditando((v) => !v)}>Editar</Botao>}
      </div>
      {remarcando && (
        <div className="folha__grade mt-4 pt-4 border-t border-pauta">
          <div className="folha__grade folha__grade--2">
            <Campo rotulo="Novo dia"><Entrada type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} /></Campo>
            <Campo rotulo="Nova hora"><Entrada type="time" step={300} value={novaHora} onChange={(e) => setNovaHora(e.target.value)} /></Campo>
          </div>
          <div><Botao cheio onClick={() => { const [h, m] = novaHora.split(":").map(Number); void agir(a, "remarcar", isoLocal(novaData, h * 60 + m)); }}>Confirmar remarcação</Botao></div>
        </div>
      )}
      {editando && (
        <div className="folha__grade mt-4 pt-4 border-t border-pauta">
          <div className="folha__grade folha__grade--2">
            <Campo rotulo="Convênio">
              <select className="a-entrada a-select" value={ed.convenio_id} onChange={(e) => setEd((x) => ({ ...x, convenio_id: e.target.value }))}>
                <option value="">Particular</option>{convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Valor previsto (R$)"><Entrada inputMode="decimal" value={ed.valor} onChange={(e) => setEd((x) => ({ ...x, valor: e.target.value }))} /></Campo>
          </div>
          <Campo rotulo="Observação"><AreaTexto rows={2} value={ed.observacao} onChange={(e) => setEd((x) => ({ ...x, observacao: e.target.value }))} /></Campo>
          <div><Botao cheio onClick={() => void salvarEdicao()}>Salvar</Botao></div>
        </div>
      )}
    </Folha>
  );
}
