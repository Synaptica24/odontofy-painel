"use client";

// Adaptado do bloco "Dynamic island" do Bencho (bencho.dev), licença MIT, via o Brio (barbearia Figars).
// Ver THIRD_PARTY_NOTICES.md.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Stethoscope } from "lucide-react";

const COMPACTA = { w: 196, h: 38, r: 19 };
const ABERTA = { w: 340, h: 84, r: 42 };
// a forma anda numa mola só; o conteúdo troca por esmaecimento com um pouco de blur
const FADE = {
  initial: { opacity: 0, scale: 0.92, filter: "blur(6px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.92, filter: "blur(6px)" },
};

export function quandoChega(inicioIso: string, agoraMs: number, horaBonita: string) {
  const d = Math.round((Date.parse(inicioIso) - agoraMs) / 60000);
  if (d <= -1) return { texto: `atrasado ${-d} min`, atrasado: true };
  if (d <= 0) return { texto: "agora", atrasado: false };
  if (d < 60) return { texto: `em ${d} min`, atrasado: false };
  return { texto: `às ${horaBonita}`, atrasado: false };
}

/** Pílula preta com o próximo paciente do dia; toque para abrir o detalhe. */
export function IlhaProximo({
  id,
  primeiroNome,
  nome,
  rotulo,
  detalhe,
  quando,
  acao,
  aoAbrir,
}: {
  id: string;
  primeiroNome: string;
  nome: string;
  /** linha de cima quando aberta: "14:00 · Dr. Mateus" */
  rotulo: string;
  /** linha de baixo quando aberta: tipo da consulta */
  detalhe: string;
  quando: { texto: string; atrasado: boolean };
  /** botão redondo opcional (ex.: confirmar) */
  acao?: ReactNode;
  aoAbrir: () => void;
}) {
  const reduz = useReducedMotion();
  const [aberta, setAberta] = useState(false);
  const [aceno, setAceno] = useState(0);
  const ultimo = useRef(id);
  const raiz = useRef<HTMLDivElement>(null);

  // aberta, um toque fora dela ou o Esc a recolhem
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberta(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    document.addEventListener("pointerdown", fora, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora, true);
      document.removeEventListener("keydown", esc);
    };
  }, [aberta]);

  // quando muda o próximo paciente, a pílula dá um aceno
  useEffect(() => {
    if (ultimo.current === id) return;
    ultimo.current = id;
    setAceno((n) => n + 1);
  }, [id]);

  // fechada, a pílula abraça o texto (nome + quando)
  const tamanho = aberta ? ABERTA : { ...COMPACTA, w: Math.max(COMPACTA.w, Math.min(280, 72 + (primeiroNome.length + quando.texto.length) * 7.4)) };
  const mola = reduz ? { duration: 0 } : { type: "spring" as const, stiffness: 380, damping: 27, mass: 0.9 };

  return (
    <motion.div
      ref={raiz}
      className="dyn"
      role="group"
      aria-label={`Próximo paciente: ${nome}, ${quando.texto}`}
      initial={false}
      animate={{ width: tamanho.w, height: tamanho.h, borderRadius: tamanho.r }}
      transition={mola}
    >
      <button type="button" className="dyn-toggle" aria-expanded={aberta} aria-label={aberta ? "Recolher próximo paciente" : "Ver próximo paciente"} onClick={() => setAberta((o) => !o)} />
      <motion.span
        key={aceno}
        className="dyn-in"
        initial={aceno && !reduz ? { scale: 1.08 } : false}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {aberta ? (
            <motion.span key="aberta" className="dyn-open" {...FADE} transition={{ duration: reduz ? 0 : 0.22, delay: reduz ? 0 : 0.06 }}>
              <span className="dyn-avatar" aria-hidden>{primeiroNome.slice(0, 1)}</span>
              <span className="dyn-who">
                <span className="dyn-label">{rotulo}</span>
                <span className="dyn-name">{nome}</span>
                <span className="dyn-label truncate">{detalhe}</span>
              </span>
              <span className="dyn-grow" />
              {acao}
              <button type="button" className="dyn-more" onClick={aoAbrir}>
                Abrir
              </button>
            </motion.span>
          ) : (
            <motion.span key="compacta" className="dyn-compact" {...FADE} transition={{ duration: reduz ? 0 : 0.22, delay: reduz ? 0 : 0.06 }}>
              <Stethoscope size={16} className="dyn-icone" strokeWidth={2} aria-hidden />
              <span className="dyn-num truncate">{primeiroNome}</span>
              <span className="dyn-num" data-late={quando.atrasado || undefined}>
                {quando.texto}
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </motion.div>
  );
}
