"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { buscarPaciente, salvarObservacao } from "@/lib/api";
import type { Agendamento, Conversa } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { diaCurto, hora, quando, telefoneBonito } from "@/components/dados/datas";
import {
  AreaTexto,
  Bloco,
  Cabecalho,
  Erro,
  Item,
  Linha,
  Lista,
  OssoLinha,
  Pagina,
  Vazio,
} from "@/components/ui/primitivos";

const ORIGEM: Record<string, string> = {
  whatsapp: "Chegou pelo WhatsApp",
  site: "Chegou pelo site",
  campanha: "Voltou pela campanha",
  indicacao: "Veio por indicação",
};
const STATUS: Record<string, string> = {
  novo: "Contato novo",
  em_conversa: "Em conversa",
  agendado: "Agendado",
  paciente: "Paciente",
  fora_da_base: "Fora da base",
};

function rotuloConversa(c: Conversa) {
  if (c.status === "escalada") return "esperando você";
  if (c.status === "assumida") return "você respondeu";
  if (c.status === "encerrada") return "encerrada";
  return "com a IA";
}
function marcaAgendamento(a: Agendamento) {
  if (a.status === "sugerido") return "anel" as const;
  if (a.status === "faltou") return "falta" as const;
  if (a.status === "cancelado") return "nada" as const;
  return a.origem === "agente" ? ("ia" as const) : ("voce" as const);
}

export function TelaPaciente({ id }: { id: string }) {
  const r = useApi(() => buscarPaciente(id), [id]);
  const [obs, setObs] = useState<string | null>(null);
  const [salvo, setSalvo] = useState<"parado" | "salvando" | "salvo">("parado");
  const timer = useRef<number | null>(null);

  const d = r.dados;
  const texto = obs ?? d?.paciente.observacoes ?? "";

  useEffect(() => {
    if (obs === null || !d || obs === d.paciente.observacoes) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const res = await salvarObservacao(id, obs);
      if (!res.sucesso) {
        setSalvo("parado");
        toast.error("A observação não salvou.", { description: `${res.erro.mensagem} O texto continua aí.` });
        return;
      }
      r.definir((x) => ({ ...x, paciente: res.dados }));
      setSalvo("salvo");
    }, 700);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs]);

  const [agora] = useState(() => Date.now());
  const futuros = d?.agendamentos.filter((a) => new Date(a.inicio).getTime() >= agora && a.status !== "cancelado") ?? [];
  const passados = d?.agendamentos.filter((a) => new Date(a.inicio).getTime() < agora || a.status === "cancelado") ?? [];

  return (
    <Pagina>
      <Link href="/conversas" className="a-voltar pressa">
        <ArrowLeft size={18} strokeWidth={2} aria-hidden /> Conversas
      </Link>
      {d ? (
        <Cabecalho
          titulo={d.paciente.nome}
          sobre={
            <>
              <a className="num underline-offset-2 hover:underline" href={`tel:${d.paciente.telefone_e164}`}>
                {telefoneBonito(d.paciente.telefone_e164)}
              </a>
              {" · "}
              {STATUS[d.paciente.status] ?? d.paciente.status}
            </>
          }
        />
      ) : (
        <div className="pt-2" aria-hidden>
          <span className="osso block h-4 w-40" />
          <span className="osso mt-2 block h-7 w-56" />
        </div>
      )}
      {r.fase === "erro" && !d && <Erro mensagem={r.erro} tentar={r.recarregar} />}

      {d && (
        <p className="mt-2 text-[13px] text-tinta-2">
          {ORIGEM[d.paciente.origem] ?? d.paciente.origem} em {diaCurto(d.paciente.primeiro_contato)}
          {d.paciente.nao_perturbe ? " · pediu para não receber mensagens" : ""}
          {d.paciente.codental_id ? ` · Codental ${d.paciente.codental_id}` : ""}
        </p>
      )}

      <Bloco titulo="Observações" id="obs" lado={salvo === "salvando" ? "salvando…" : salvo === "salvo" ? "salvo" : undefined} primeiro>
        <AreaTexto
          rows={3}
          value={texto}
          onChange={(e) => {
            setSalvo("salvando");
            setObs(e.target.value);
          }}
          placeholder="Algo que você quer lembrar sobre essa pessoa"
          disabled={!d}
        />
      </Bloco>

      <Bloco titulo="Próximos horários" id="futuros">
        {!d ? (
          <OssoLinha n={1} />
        ) : futuros.length === 0 ? (
          <Vazio titulo="Nada marcado." sub={<Link href="/agenda" className="underline">Ver a agenda</Link>} icone={<span className="marca" />} />
        ) : (
          <Lista>
            {futuros.map((a) => (
              <Item key={a.id}>
                <Linha
                  marca={marcaAgendamento(a)}
                  titulo={
                    <>
                      <span className="num">{diaCurto(a.inicio)} · {hora(a.inicio)}</span>
                    </>
                  }
                  sub={`${a.tipo}${a.status === "sugerido" ? " · a IA sugeriu, falta confirmar" : ""}${a.observacao ? ` · ${a.observacao}` : ""}`}
                />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>

      <Bloco titulo="Conversas" id="conversas">
        {!d ? (
          <OssoLinha n={2} />
        ) : d.conversas.length === 0 ? (
          <Vazio titulo="Nenhuma conversa ainda." icone={<span className="marca" />} />
        ) : (
          <Lista>
            {d.conversas.map((c) => (
              <Item key={c.id}>
                <Linha
                  marca={c.status === "escalada" ? "escalada" : c.status === "assumida" ? "voce" : c.status === "encerrada" ? "feito" : "ia"}
                  alerta={c.status === "escalada"}
                  href={`/conversas/${c.id}`}
                  titulo={c.resumo_gerado ?? c.motivo_escalonamento ?? "Conversa"}
                  sub={rotuloConversa(c)}
                  lado={<span className="a-linha__meta num">{quando(c.iniciada_em)}</span>}
                />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>

      {d && passados.length > 0 && (
        <Bloco titulo="Horários passados" id="passados">
          <Lista>
            {passados.map((a) => (
              <Item key={a.id}>
                <Linha
                  marca={marcaAgendamento(a)}
                  titulo={<span className="num">{diaCurto(a.inicio)} · {hora(a.inicio)}</span>}
                  sub={`${a.tipo}${a.status === "faltou" ? " · faltou" : a.status === "cancelado" ? " · cancelado" : ""}`}
                />
              </Item>
            ))}
          </Lista>
        </Bloco>
      )}
    </Pagina>
  );
}
