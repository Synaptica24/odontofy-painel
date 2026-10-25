"use client";

// Do Brio (barbearia Figars): fita de dias que gira como um rolo.

import { useEffect, useRef } from "react";
import { diaLongo, diaNumero, diaSemanaCurto } from "@/components/dados/datas";
import { useImaCentro } from "./use-ima-centro";

/**
 * O dia no centro é o escolhido, os vizinhos encolhem e esmaecem.
 * Arrastar, tocar num dia ou usar ← → no teclado. `contagens` diz quantas consultas há em cada dia.
 */
export function FitaDias({ dias, valor, aoMudar, hoje, contagens }: { dias: string[]; valor: string; aoMudar: (civil: string) => void; hoje: string; contagens: Map<string, number> }) {
  const ref = useRef<HTMLDivElement>(null);
  const indice = Math.max(0, dias.indexOf(valor));
  const centrar = useImaCentro(ref, "x", dias.length, (i) => {
    if (dias[i] && dias[i] !== valor) aoMudar(dias[i]);
  });

  // a primeira vez centraliza sem animar; depois, desliza até o dia escolhido
  const primeira = useRef(true);
  useEffect(() => {
    centrar(indice, !primeira.current);
    primeira.current = false;
  }, [indice, centrar]);

  const passo = (delta: number) => {
    const proximo = dias[Math.min(dias.length - 1, Math.max(0, indice + delta))];
    if (proximo && proximo !== valor) {
      aoMudar(proximo);
      (ref.current?.children[dias.indexOf(proximo)] as HTMLElement | undefined)?.focus({ preventScroll: true });
    }
  };

  return (
    <div className="reel">
      <span className="reel-frame" aria-hidden />
      <div
        ref={ref}
        className="reel-track"
        role="listbox"
        aria-label="Escolha o dia"
        aria-orientation="horizontal"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            passo(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            passo(-1);
          }
        }}
      >
        {dias.map((d) => {
          // sem contagem conhecida (dia ainda não carregado) o dia fica neutro, sem risco nem ponto
          const n = contagens.get(d);
          const ativo = d === valor;
          return (
            <button
              key={d}
              type="button"
              role="option"
              aria-selected={ativo}
              tabIndex={ativo ? 0 : -1}
              data-date={d}
              onClick={() => aoMudar(d)}
              aria-label={`${diaLongo(d)}${n === undefined ? "" : n === 0 ? ", sem consultas" : `, ${n} ${n === 1 ? "consulta" : "consultas"}`}`}
              className={`reel-day ${ativo ? "is-active" : ""} ${n === 0 ? "is-empty" : ""}`}
            >
              <span className="reel-wd">{d === hoje ? "hoje" : diaSemanaCurto(d)}</span>
              <span className="num reel-n">{diaNumero(d)}</span>
              <span className={`reel-dot ${!n ? "" : ativo ? "reel-dot--claro" : n >= 6 ? "reel-dot--cheio" : "reel-dot--ok"}`} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
