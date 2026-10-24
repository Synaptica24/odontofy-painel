"use client";

// Adaptado do bloco "Toast stack" do Bencho (bencho.dev), licença MIT, via o Brio (barbearia Figars).
// Ver THIRD_PARTY_NOTICES.md.

import { useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X, type LucideIcon } from "lucide-react";

export interface ItemAtencao {
  chave: string;
  Icone: LucideIcon;
  /** classe do disco do ícone: "pa-tom--alerta" | "pa-tom--aviso" | "pa-tom--ia" | "pa-tom--ok" */
  tom: string;
  titulo: string;
  texto: string;
  acao?: ReactNode;
  /** clique no corpo do aviso (quando a pilha já está aberta) */
  aoAbrir?: () => void;
}

const H = 76;
const VAO = 10;
const ESPIA = 10;
const MOSTRA = 3;
// um pouco abaixo do crítico: assenta com um respiro, sem balançar
const MOLA = { type: "spring", stiffness: 380, damping: 34, mass: 1 } as const;

/**
 * Avisos empilhados: o mais importante na frente e os outros espiando por baixo.
 * Passar o mouse (ou tocar em "Ver todos") abre a pilha em lista. Dispensar é só visual, nesta visita.
 */
export function PilhaAtencao({ itens, titulo = "Pede atenção" }: { itens: ItemAtencao[]; titulo?: string }) {
  const reduz = useReducedMotion();
  const [dispensados, setDispensados] = useState<string[]>([]);
  const [saindo, setSaindo] = useState<string | null>(null);
  const [sobre, setSobre] = useState(false);
  const [fixa, setFixa] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  const lista = itens.filter((it) => !dispensados.includes(it.chave));
  if (!lista.length) return null;
  const varios = lista.length > 1;
  const aberta = varios && (sobre || fixa);

  const lugar = (k: number) => {
    if (aberta) return { y: k * (H + VAO), scale: 1 };
    const d = Math.min(k, MOSTRA - 1);
    return { y: d * ESPIA, scale: 1 - d * 0.05 };
  };
  const altura = aberta ? lista.length * H + (lista.length - 1) * VAO : H + (Math.min(lista.length, MOSTRA) - 1) * ESPIA;

  const dispensar = (chave: string) => {
    if (saindo) return;
    setSaindo(chave);
    window.setTimeout(
      () => {
        setDispensados((d) => [...d, chave]);
        setSaindo(null);
      },
      reduz ? 0 : 220,
    );
  };

  return (
    <section aria-label={titulo} className="pa">
      <div className="pa-cabeca">
        <h2>
          {titulo} <span className="num">· {lista.length}</span>
        </h2>
        {varios && (
          <button type="button" onClick={() => setFixa((p) => !p)} aria-expanded={aberta} className="pa-ver">
            {aberta ? "Agrupar" : "Ver todos"}
          </button>
        )}
      </div>
      <motion.div
        ref={raiz}
        className="tst"
        data-open={aberta || undefined}
        initial={false}
        animate={{ height: altura }}
        transition={reduz ? { duration: 0 } : MOLA}
        onPointerOver={(e) => e.pointerType === "mouse" && setSobre(true)}
        onPointerOut={(e) => {
          const para = e.relatedTarget as Node | null;
          if (!para || !raiz.current?.contains(para)) setSobre(false);
        }}
        onFocus={() => setSobre(true)}
        onBlur={(e) => {
          if (!raiz.current?.contains(e.relatedTarget as Node | null)) setSobre(false);
        }}
      >
        {lista.map((it, k) => {
          const fora = saindo === it.chave;
          const p = lugar(k);
          const frente = k === 0;
          const visivel = aberta || frente;
          return (
            <motion.div
              key={it.chave}
              className="tst-toast"
              data-front={frente || undefined}
              style={{ height: H, zIndex: lista.length - k }}
              initial={false}
              animate={fora ? { y: p.y, scale: p.scale, opacity: 0, x: 60 } : { y: p.y, scale: p.scale, opacity: k < MOSTRA || aberta ? 1 : 0, x: 0 }}
              transition={reduz ? { duration: 0 } : fora ? { duration: 0.22, ease: [0.4, 0, 1, 1] } : MOLA}
              aria-hidden={!visivel || undefined}
              inert={!visivel}
              onClick={() => {
                if (!aberta && varios) setFixa(true);
                else it.aoAbrir?.();
              }}
            >
              <span className={`pa-tom ${it.tom}`}>
                <it.Icone size={18} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="tst-text">
                <b>{it.titulo}</b>
                <span>{it.texto}</span>
              </span>
              {it.acao && <span className="pa-acao" onClick={(e) => e.stopPropagation()}>{it.acao}</span>}
              <button
                type="button"
                className="tst-x"
                aria-label={`Dispensar: ${it.titulo}`}
                onClick={(e) => {
                  e.stopPropagation();
                  dispensar(it.chave);
                }}
              >
                <X size={14} strokeWidth={2} aria-hidden />
              </button>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
