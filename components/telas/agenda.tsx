"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  agendaDaSemana,
  agendaDoDia,
  cancelarAgendamento,
  confirmarSugestao,
  criarBloqueio,
  marcarFalta,
  remarcarAgendamento,
} from "@/lib/api";
import type { AgendamentoComPaciente, Bloqueio } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import {
  diaLongo,
  diaNumero,
  diaSemanaCurto,
  ehHoje,
  hojeCivil,
  hora,
  inicioDaSemana,
  somarDias,
} from "@/components/dados/datas";
import {
  Abas,
  Bloco,
  Botao,
  Cabecalho,
  Campo,
  Entrada,
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

type Visao = "dia" | "semana";

export function TelaAgenda() {
  const [visao, setVisao] = useState<Visao>("dia");
  const [data, setData] = useState(hojeCivil());
  // no desktop a visão inicial é a semana inteira
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      if (window.matchMedia("(min-width: 1024px)").matches) setVisao("semana");
    });
    return () => window.cancelAnimationFrame(id);
  }, []);
  const semana = inicioDaSemana(data);
  const r = useApi(
    () => (visao === "dia" ? agendaDoDia(data) : agendaDaSemana(semana)),
    [visao, data, semana],
  );
  const [bloqueando, setBloqueando] = useState(false);
  const [remarcando, setRemarcando] = useState<AgendamentoComPaciente | null>(null);

  const d = r.dados;
  const sugestoes = d?.agendamentos.filter((a) => a.status === "sugerido") ?? [];

  function avancar(n: number) {
    setData((atual) => somarDias(atual, visao === "dia" ? n : 7 * n));
  }

  async function confirmar(a: AgendamentoComPaciente) {
    if (!d) return;
    const antes = d;
    r.definir((x) => ({ ...x, agendamentos: x.agendamentos.map((i) => (i.id === a.id ? { ...i, status: "confirmado" } : i)) }));
    const res = await confirmarSugestao(a.id);
    if (!res.sucesso) {
      r.definir(() => antes);
      toast.error("Não deu para confirmar.", { description: res.erro.mensagem });
      return;
    }
    toast(`${hora(a.inicio)} confirmado com ${a.paciente.nome}`);
  }

  async function recusar(a: AgendamentoComPaciente) {
    if (!d) return;
    const antes = d;
    r.definir((x) => ({ ...x, agendamentos: x.agendamentos.filter((i) => i.id !== a.id) }));
    const res = await cancelarAgendamento(a.id);
    if (!res.sucesso) {
      r.definir(() => antes);
      toast.error("Não deu para recusar.", { description: res.erro.mensagem });
      return;
    }
    toast(`Sugestão das ${hora(a.inicio)} recusada`, {
      action: { label: "Desfazer", onClick: () => { r.definir(() => antes); void r.recarregar(); } },
    });
  }

  async function faltou(a: AgendamentoComPaciente) {
    if (!d) return;
    const antes = d;
    r.definir((x) => ({ ...x, agendamentos: x.agendamentos.map((i) => (i.id === a.id ? { ...i, status: "faltou" } : i)) }));
    const res = await marcarFalta(a.id);
    if (!res.sucesso) {
      r.definir(() => antes);
      toast.error("Não deu para marcar a falta.", { description: res.erro.mensagem });
      return;
    }
    toast(`${a.paciente.nome} marcado como falta`, {
      action: { label: "Desfazer", onClick: () => { r.definir(() => antes); void r.recarregar(); } },
    });
  }

  async function bloquear(inicio: string, fim: string) {
    const res = await criarBloqueio(inicio, fim);
    if (!res.sucesso) {
      toast.error("Não deu para bloquear.", { description: res.erro.mensagem });
      return false;
    }
    r.definir((x) => ({ ...x, bloqueios: [...x.bloqueios, res.dados] }));
    toast(`Bloqueado das ${hora(inicio)} às ${hora(fim)}`);
    return true;
  }

  async function remarcar(a: AgendamentoComPaciente, novoInicio: string) {
    const antes = d;
    const res = await remarcarAgendamento(a.id, novoInicio);
    if (!res.sucesso) {
      if (antes) r.definir(() => antes);
      toast.error("Não deu para remarcar.", { description: res.erro.mensagem });
      return false;
    }
    toast(`${a.paciente.nome} remarcado para ${diaLongo(novoInicio.slice(0, 10))}, ${hora(novoInicio)}`);
    void r.recarregar();
    return true;
  }

  const titulo =
    visao === "dia"
      ? ehHoje(data)
        ? "Hoje"
        : diaLongo(data)
      : `Semana de ${diaNumero(semana)} a ${diaNumero(somarDias(semana, 6))}`;

  return (
    <Pagina>
      <Cabecalho
        titulo="Agenda"
        sobre={d ? <Teto usado={d.pacientes_novos_semana} teto={d.teto_pacientes_novos_semana} /> : "…"}
        acao={
          <Botao onClick={() => setBloqueando((v) => !v)} aria-expanded={bloqueando}>
            Bloquear horário
          </Botao>
        }
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <Abas
          valor={visao}
          aoMudar={(v) => {
            setVisao(v);
            if (v === "dia") setData(hojeCivil());
          }}
          opcoes={[
            { valor: "dia", rotulo: "Dia" },
            { valor: "semana", rotulo: "Semana" },
          ]}
        />
        <div className="a-passos">
          <button type="button" className="a-passo pressa" onClick={() => avancar(-1)} aria-label="Anterior">
            <ChevronLeft size={20} />
          </button>
          <button type="button" className="a-passo pressa" onClick={() => setData(hojeCivil())}>
            Hoje
          </button>
          <button type="button" className="a-passo pressa" onClick={() => avancar(1)} aria-label="Próximo">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {bloqueando && (
        <FormBloqueio
          data={data}
          aoFechar={() => setBloqueando(false)}
          aoBloquear={bloquear}
        />
      )}

      {remarcando && (
        <FormRemarcar
          agendamento={remarcando}
          aoFechar={() => setRemarcando(null)}
          aoRemarcar={remarcar}
        />
      )}

      {r.fase === "erro" && !d && <Erro mensagem={r.erro} tentar={r.recarregar} />}

      {sugestoes.length > 0 && (
        <Bloco titulo="A IA sugeriu, falta você confirmar" id="sugestoes" lado={sugestoes.length} primeiro>
          <Lista>
            {sugestoes.map((a) => (
              <Item key={a.id}>
                <Linha
                  marca="anel"
                  acoesEmbaixo
                  href={`/pacientes/${a.paciente_id}`}
                  titulo={
                    <>
                      <span className="num">
                        {visao === "semana" ? `${diaSemanaCurto(a.inicio.slice(0, 10))} ` : ""}
                        {hora(a.inicio)}
                      </span>
                      <span className="text-tinta-3"> · </span>
                      {a.paciente.nome}
                    </>
                  }
                  sub={`${a.tipo}${a.paciente_novo ? " · paciente novo" : ""}`}
                  lado={
                    <span className="flex gap-1.5">
                      <Botao onClick={(e) => { e.preventDefault(); void recusar(a); }}>Recusar</Botao>
                      <Botao cheio onClick={(e) => { e.preventDefault(); void confirmar(a); }}>Confirmar</Botao>
                    </span>
                  }
                />
              </Item>
            ))}
          </Lista>
        </Bloco>
      )}

      <Bloco titulo={titulo} id="lista" primeiro={sugestoes.length === 0}>
        {!d ? (
          <OssoLinha n={4} />
        ) : visao === "dia" ? (
          <ListaDia
            data={data}
            agendamentos={d.agendamentos.filter((a) => a.status !== "sugerido")}
            bloqueios={d.bloqueios}
            aoFaltar={faltou}
            aoRemarcar={setRemarcando}
          />
        ) : (
          <SemanaGrade
            semana={semana}
            agendamentos={d.agendamentos}
            bloqueios={d.bloqueios}
            aoAbrirDia={(civil) => { setVisao("dia"); setData(civil); }}
            aoConfirmar={confirmar}
          />
        )}
      </Bloco>
    </Pagina>
  );
}

function SemanaGrade({
  semana,
  agendamentos,
  bloqueios,
  aoAbrirDia,
  aoConfirmar,
}: {
  semana: string;
  agendamentos: AgendamentoComPaciente[];
  bloqueios: Bloqueio[];
  aoAbrirDia: (civil: string) => void;
  aoConfirmar: (a: AgendamentoComPaciente) => void;
}) {
  return (
    <div className="semana-grade">
      {Array.from({ length: 6 }).map((_, i) => {
        const civil = somarDias(semana, i);
        type Chip =
          | { inicio: string; tipo: "ag"; a: AgendamentoComPaciente }
          | { inicio: string; tipo: "bl"; b: Bloqueio };
        const chips: Chip[] = [
          ...agendamentos
            .filter((a) => a.inicio.slice(0, 10) === civil && a.status !== "cancelado")
            .map((a) => ({ inicio: a.inicio, tipo: "ag" as const, a })),
          ...bloqueios.filter((b) => b.inicio.slice(0, 10) === civil).map((b) => ({ inicio: b.inicio, tipo: "bl" as const, b })),
        ].sort((x, y) => x.inicio.localeCompare(y.inicio));
        const novos = agendamentos.filter((a) => a.inicio.slice(0, 10) === civil && a.paciente_novo && a.status !== "cancelado").length;
        return (
          <div key={civil} className={`semana-col ${ehHoje(civil) ? "semana-col--hoje" : ""}`}>
            <button type="button" className="semana-col__cabeca pressa w-full" onClick={() => aoAbrirDia(civil)}>
              <span className="num">{diaNumero(civil)}</span>
              <span>{diaSemanaCurto(civil)}</span>
              <span className="a-linha__meta ml-auto">
                {chips.filter((c) => c.tipo === "ag").length || "livre"}
                {novos ? ` · ${novos} ${novos === 1 ? "novo" : "novos"}` : ""}
              </span>
            </button>
            {chips.length === 0 ? (
              <p className="semana-col__vazio">Dia livre</p>
            ) : (
              chips.map((c) =>
                c.tipo === "bl" ? (
                  <div key={c.b.id} className="semana-chip semana-chip--bloqueio">
                    <span className="marca" aria-hidden />
                    <span>
                      <span className="semana-chip__hora num">{hora(c.b.inicio)} – {hora(c.b.fim)}</span>
                      <span className="semana-chip__tipo">bloqueado</span>
                    </span>
                  </div>
                ) : (
                  <Link
                    key={c.a.id}
                    href={`/pacientes/${c.a.paciente_id}`}
                    className={`semana-chip pressa ${
                      c.a.status === "sugerido"
                        ? "semana-chip--sugerido"
                        : c.a.status === "faltou"
                          ? "semana-chip--faltou"
                          : c.a.origem === "agente"
                            ? "semana-chip--ia"
                            : "semana-chip--voce"
                    }`}
                  >
                    <Marca tipo={c.a.status === "sugerido" ? "anel" : c.a.status === "faltou" ? "falta" : c.a.origem === "agente" ? "ia" : "voce"} />
                    <span>
                      <span className="semana-chip__hora num">{hora(c.a.inicio)}</span>{" "}
                      <span className="semana-chip__nome">{c.a.paciente.nome}</span>
                      <span className="semana-chip__tipo">
                        {c.a.tipo}
                        {c.a.paciente_novo ? " · novo" : ""}
                        {c.a.status === "faltou" ? " · faltou" : ""}
                      </span>
                      {c.a.status === "sugerido" && (
                        <button
                          type="button"
                          className="a-link mt-1"
                          onClick={(e) => { e.preventDefault(); aoConfirmar(c.a); }}
                        >
                          Confirmar
                        </button>
                      )}
                    </span>
                  </Link>
                ),
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

function ListaDia({
  data,
  agendamentos,
  bloqueios,
  compacto,
  aoFaltar,
  aoRemarcar,
}: {
  data: string;
  agendamentos: AgendamentoComPaciente[];
  bloqueios: Bloqueio[];
  compacto?: boolean;
  aoFaltar: (a: AgendamentoComPaciente) => void;
  aoRemarcar: (a: AgendamentoComPaciente) => void;
}) {
  type Slot = { inicio: string; tipo: "ag"; a: AgendamentoComPaciente } | { inicio: string; tipo: "bl"; b: Bloqueio };
  const slots: Slot[] = [
    ...agendamentos.map((a) => ({ inicio: a.inicio, tipo: "ag" as const, a })),
    ...bloqueios.map((b) => ({ inicio: b.inicio, tipo: "bl" as const, b })),
  ].sort((x, y) => x.inicio.localeCompare(y.inicio));
  const [agora] = useState(() => Date.now());
  const passou = (iso: string) => new Date(iso).getTime() < agora;

  if (slots.length === 0) {
    return compacto ? null : (
      <Vazio titulo={ehHoje(data) ? "Nada marcado hoje." : "Dia livre."} sub="Nenhum horário e nenhum bloqueio." />
    );
  }
  return (
    <Lista>
      {slots.map((s) =>
        s.tipo === "bl" ? (
          <Item key={s.b.id}>
            <Linha
              marca="nada"
              titulo={<span className="num text-tinta-2">{hora(s.b.inicio)} – {hora(s.b.fim)}</span>}
              sub="Bloqueado"
            />
          </Item>
        ) : (
          <Item key={s.a.id}>
            <Linha
              acoesEmbaixo={s.a.status === "confirmado"}
              marca={s.a.status === "faltou" ? "falta" : s.a.status === "cancelado" ? "nada" : s.a.origem === "agente" ? "ia" : "voce"}
              href={`/pacientes/${s.a.paciente_id}`}
              titulo={
                <>
                  <span className="num">{hora(s.a.inicio)}</span>
                  <span className="text-tinta-3"> · </span>
                  {s.a.paciente.nome}
                </>
              }
              sub={[s.a.tipo, s.a.paciente_novo ? "paciente novo" : null, s.a.status === "faltou" ? "faltou" : null, s.a.status === "cancelado" ? "cancelado" : null].filter(Boolean).join(" · ")}
              lado={
                s.a.status === "confirmado" ? (
                  <span className="flex gap-1.5 flex-wrap justify-end">
                    <Botao onClick={(e) => { e.preventDefault(); aoRemarcar(s.a); }}>Remarcar</Botao>
                    {passou(s.a.inicio) && (
                      <Botao onClick={(e) => { e.preventDefault(); aoFaltar(s.a); }}>Faltou</Botao>
                    )}
                  </span>
                ) : undefined
              }
            />
          </Item>
        ),
      )}
    </Lista>
  );
}

function FormBloqueio({
  data,
  aoFechar,
  aoBloquear,
}: {
  data: string;
  aoFechar: () => void;
  aoBloquear: (inicio: string, fim: string) => Promise<boolean>;
}) {
  const [dia, setDia] = useState(data);
  const [de, setDe] = useState("12:00");
  const [ate, setAte] = useState("14:00");
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="a-form entra"
      onSubmit={async (e) => {
        e.preventDefault();
        if (ate <= de) {
          toast.error("O fim precisa vir depois do início.");
          return;
        }
        setEnviando(true);
        const ok = await aoBloquear(`${dia}T${de}:00-03:00`, `${dia}T${ate}:00-03:00`);
        setEnviando(false);
        if (ok) aoFechar();
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        <Campo rotulo="Dia">
          <Entrada type="date" value={dia} onChange={(e) => setDia(e.target.value)} required />
        </Campo>
        <Campo rotulo="Das">
          <Entrada type="time" value={de} onChange={(e) => setDe(e.target.value)} required step={900} />
        </Campo>
        <Campo rotulo="Às">
          <Entrada type="time" value={ate} onChange={(e) => setAte(e.target.value)} required step={900} />
        </Campo>
      </div>
      <div className="mt-2 flex justify-end gap-1.5">
        <Botao onClick={aoFechar}>Cancelar</Botao>
        <Botao cheio type="submit" disabled={enviando}>Bloquear</Botao>
      </div>
    </form>
  );
}

function FormRemarcar({
  agendamento,
  aoFechar,
  aoRemarcar,
}: {
  agendamento: AgendamentoComPaciente;
  aoFechar: () => void;
  aoRemarcar: (a: AgendamentoComPaciente, novoInicio: string) => Promise<boolean>;
}) {
  const [dia, setDia] = useState(agendamento.inicio.slice(0, 10));
  const [hr, setHr] = useState(hora(agendamento.inicio));
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="a-form entra"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const ok = await aoRemarcar(agendamento, `${dia}T${hr}:00-03:00`);
        setEnviando(false);
        if (ok) aoFechar();
      }}
    >
      <p className="mb-2 text-[13px] text-tinta-2">
        Remarcar <b className="text-tinta">{agendamento.paciente.nome}</b> · {agendamento.tipo}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Novo dia">
          <Entrada type="date" value={dia} onChange={(e) => setDia(e.target.value)} required />
        </Campo>
        <Campo rotulo="Nova hora">
          <Entrada type="time" value={hr} onChange={(e) => setHr(e.target.value)} required step={900} />
        </Campo>
      </div>
      <div className="mt-2 flex justify-end gap-1.5">
        <Botao onClick={aoFechar}>Cancelar</Botao>
        <Botao cheio type="submit" disabled={enviando}>Remarcar</Botao>
      </div>
    </form>
  );
}
