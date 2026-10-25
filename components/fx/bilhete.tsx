"use client";

// Do Brio (barbearia Figars): comprovante que sai de uma impressora.

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { diaLongo, hojeCivil, hora, reais } from "@/components/dados/datas";
import { Avatar } from "./grupo-avatares";

// código de barras de enfeite, sempre o mesmo para o mesmo código
function barras(codigo: string) {
  const saida: number[] = [];
  for (const ch of codigo.repeat(9)) {
    const c = ch.charCodeAt(0);
    saida.push(1 + (c % 3), 1 + ((c >> 2) % 2));
  }
  return saida;
}

export interface DadosBilhete {
  id: string;
  consultorio: string;
  paciente: string;
  tipo: string;
  inicio: string;
  fim: string;
  valor?: number;
  profissional?: { nome: string; cor?: string | null } | null;
}

/**
 * O bilhete desce pela fenda, tem picote entre a consulta e o canhoto e inclina de leve sob o mouse.
 */
export function Bilhete({ dados }: { dados: DadosBilhete }) {
  const reduz = useReducedMotion();
  const cartao = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 220, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 220, damping: 20 });

  const codigo = dados.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  const duracao = Math.round((Date.parse(dados.fim) - Date.parse(dados.inicio)) / 60000);
  const [dia, resto] = diaLongo(hojeCivil(new Date(dados.inicio))).split(", ");

  const inclinar = (e: React.PointerEvent) => {
    if (reduz || e.pointerType !== "mouse") return;
    const r = cartao.current!.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 6);
  };

  return (
    <div className="tkt">
      <span className="tkt-mouth" aria-hidden />
      <div className="tkt-slot">
        <motion.div
          ref={cartao}
          className="tkt-card"
          initial={reduz ? false : { y: "-104%" }}
          animate={{ y: 0 }}
          transition={{ duration: 1.05, ease: [0.2, 0.75, 0.25, 1], delay: 0.15 }}
          style={{ rotateX: rx, rotateY: ry }}
          onPointerMove={inclinar}
          onPointerLeave={() => {
            rx.set(0);
            ry.set(0);
          }}
        >
          <div className="p-5">
            <p className="a-eyebrow">{dados.consultorio}</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar nome={dados.paciente} cor={dados.profissional?.cor} tamanho={44} />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{dados.paciente}</p>
                <p className="text-[13px] text-tinta-2">
                  {dados.tipo} · {duracao} min{dados.profissional ? ` · ${dados.profissional.nome}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="tkt-perf" aria-hidden />

          <div className="p-5 pt-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[13px] capitalize text-tinta-2">{dia}</p>
                <p className="text-[17px] font-semibold">{resto ?? dia}</p>
              </div>
              <p className="num text-[2.5rem] font-semibold leading-none tracking-[-0.04em]">{hora(dados.inicio)}</p>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-[13px]">
              <span className="text-tinta-2">
                {dados.valor ? (
                  <>
                    Valor previsto <span className="num font-medium text-tinta">{reais(dados.valor)}</span>
                  </>
                ) : (
                  "Sem valor previsto"
                )}
              </span>
              <span className="font-mono font-semibold tracking-[0.18em]">{codigo}</span>
            </div>
            <div className="tkt-bars" aria-hidden>
              {barras(codigo).map((w, i) => (
                <i key={i} style={{ width: w * 2, opacity: i % 2 ? 0 : 1 }} />
              ))}
            </div>
            <p className="sr-only">Código da consulta {codigo}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
