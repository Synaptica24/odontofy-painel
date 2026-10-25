"use client";

// Do Brio (barbearia Figars): tambor vertical, como o seletor de horas do iPhone.

import { useEffect, useId, useRef } from "react";
import { useImaCentro } from "./use-ima-centro";

export interface OpcaoTambor<T> {
  valor: T;
  rotulo: string;
}

/** Rolar, arrastar, tocar numa linha ou usar ↑ ↓. O item na faixa do meio é o escolhido. */
export function Tambor<T extends string | number>({ opcoes, valor, aoMudar, rotulo, className = "" }: { opcoes: OpcaoTambor<T>[]; valor: T; aoMudar: (v: T) => void; rotulo: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId();
  const indice = Math.max(0, opcoes.findIndex((o) => o.valor === valor));
  const centrar = useImaCentro(ref, "y", opcoes.length, (i) => {
    if (opcoes[i] && opcoes[i].valor !== valor) aoMudar(opcoes[i].valor);
  });

  const primeira = useRef(true);
  useEffect(() => {
    centrar(indice, !primeira.current);
    primeira.current = false;
  }, [indice, centrar]);

  const passo = (delta: number) => {
    const o = opcoes[Math.min(opcoes.length - 1, Math.max(0, indice + delta))];
    if (o && o.valor !== valor) aoMudar(o.valor);
  };

  return (
    <div className={`whl ${className}`}>
      <span className="whl-band" aria-hidden />
      <div
        ref={ref}
        className="whl-track"
        role="listbox"
        tabIndex={0}
        aria-label={rotulo}
        aria-activedescendant={`${uid}-${indice}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            passo(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            passo(-1);
          }
        }}
      >
        {opcoes.map((o, i) => (
          <div key={String(o.valor)} id={`${uid}-${i}`} role="option" aria-selected={i === indice} className={`whl-item num ${i === indice ? "is-active" : ""}`} onClick={() => aoMudar(o.valor)}>
            {o.rotulo}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dois tambores lado a lado (hora e minuto) que leem e escrevem "HH:MM". */
export function SeletorHora({ valor, aoMudar, horaInicio = 7, horaFim = 20, passoMin = 15 }: { valor: string; aoMudar: (hhmm: string) => void; horaInicio?: number; horaFim?: number; passoMin?: number }) {
  const [h, m] = valor.split(":").map(Number);
  const horas = Array.from({ length: horaFim - horaInicio + 1 }, (_, i) => horaInicio + i);
  const minutos = Array.from({ length: Math.floor(60 / passoMin) }, (_, i) => i * passoMin);
  const dd = (n: number) => String(n).padStart(2, "0");
  const hAtual = Number.isFinite(h) ? Math.min(horaFim, Math.max(horaInicio, h)) : horaInicio;
  const mAtual = Number.isFinite(m) ? Math.round(m / passoMin) * passoMin % 60 : 0;
  return (
    <div className="whl-par" role="group" aria-label="Hora">
      <Tambor rotulo="Hora" opcoes={horas.map((x) => ({ valor: x, rotulo: dd(x) }))} valor={hAtual} aoMudar={(x) => aoMudar(`${dd(x)}:${dd(mAtual)}`)} />
      <span className="whl-sep num" aria-hidden>:</span>
      <Tambor rotulo="Minuto" opcoes={minutos.map((x) => ({ valor: x, rotulo: dd(x) }))} valor={mAtual} aoMudar={(x) => aoMudar(`${dd(hAtual)}:${dd(x)}`)} />
    </div>
  );
}
