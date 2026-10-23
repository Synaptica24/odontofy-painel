"use client";

import Link from "next/link";
import { useState } from "react";
import type { Prontuario } from "@/lib/contratos";
import { diaCurto, hojeCivil, hora, reais } from "@/components/dados/datas";
import { Bloco, Item, Linha, Lista, Vazio } from "@/components/ui/primitivos";
import { Chip, STATUS_AGENDAMENTO } from "./ficha-util";

const civilDe = (iso: string) => hojeCivil(new Date(iso));

/* Histórico de consultas com link para a agenda do dia. */
export function FichaConsultas({ d }: { d: Prontuario }) {
  const [agora] = useState(() => Date.now());
  const futuras = d.agendamentos.filter((a) => new Date(a.inicio).getTime() >= agora && a.status !== "cancelado");
  const passadas = d.agendamentos.filter((a) => new Date(a.inicio).getTime() < agora || a.status === "cancelado");
  const linha = (a: Prontuario["agendamentos"][number]) => (
    <Item key={a.id}>
      <Linha
        marca={a.status === "concluido" || a.status === "confirmado" ? "feito" : a.status === "faltou" ? "falta" : a.status === "sugerido" ? "anel" : a.status === "cancelado" ? "nada" : a.origem === "agente" ? "ia" : "voce"}
        href={`/agenda?data=${civilDe(a.inicio)}`}
        titulo={<span className="num">{diaCurto(a.inicio)} · {hora(a.inicio)}</span>}
        sub={<>{a.tipo}{a.profissional ? ` · ${a.profissional}` : ""}{Number(a.valor) > 0 ? <span className="num"> · {reais(Number(a.valor))}</span> : null}{a.observacao ? ` · ${a.observacao}` : ""}</>}
        lado={<Chip cor={STATUS_AGENDAMENTO[a.status].cor}>{STATUS_AGENDAMENTO[a.status].rotulo}</Chip>}
      />
    </Item>
  );
  return (
    <>
      <Bloco titulo="Próximas consultas" id="futuras" lado={`${futuras.length}`} primeiro>
        {futuras.length === 0 ? <Vazio titulo="Nada marcado." sub={<Link href="/agenda" className="underline">Abrir a agenda</Link>} icone={<span className="marca" />} /> : <Lista>{futuras.map(linha)}</Lista>}
      </Bloco>
      <Bloco titulo="Histórico" id="passadas" lado={`${passadas.length}`}>
        {passadas.length === 0 ? <Vazio titulo="Primeira vez aqui." sub="Nenhuma consulta anterior." icone={<span className="marca" />} /> : <Lista>{passadas.map(linha)}</Lista>}
      </Bloco>
    </>
  );
}
