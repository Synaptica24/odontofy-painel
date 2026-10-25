"use client";

// Do Brio (barbearia Figars): cartão que aparece ao parar o mouse (ou focar) sobre algo.

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const ABRIR_MS = 280;
const FECHAR_MS = 140;
const LARGURA = 280;

/**
 * No toque, um toque abre e outro fecha. Vai para o body, então não é cortado
 * por contêineres com rolagem, e fica sempre dentro da tela.
 */
export function CartaoPrevia({ children, cartao, className = "" }: { children: ReactNode; cartao: ReactNode; className?: string }) {
  const reduz = useReducedMotion();
  const id = useId();
  const ancora = useRef<HTMLSpanElement>(null);
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef(0);

  const depois = (v: boolean, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAberto(v), ms);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useLayoutEffect(() => {
    if (!aberto || !ancora.current) return;
    const posicionar = () => {
      const r = ancora.current!.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: Math.max(12, Math.min(window.innerWidth - LARGURA - 12, r.left)) });
    };
    posicionar();
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    const fora = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ancora.current?.contains(t) && !document.getElementById(id)?.contains(t)) setAberto(false);
    };
    document.addEventListener("keydown", esc);
    document.addEventListener("pointerdown", fora, true);
    return () => {
      document.removeEventListener("keydown", esc);
      document.removeEventListener("pointerdown", fora, true);
    };
  }, [aberto, id]);

  return (
    <>
      <span
        ref={ancora}
        className={className}
        aria-describedby={aberto ? id : undefined}
        onPointerEnter={(e) => e.pointerType === "mouse" && depois(true, ABRIR_MS)}
        onPointerLeave={(e) => e.pointerType === "mouse" && depois(false, FECHAR_MS)}
        onFocus={() => depois(true, 0)}
        onBlur={() => depois(false, FECHAR_MS)}
      >
        {children}
      </span>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {aberto && pos && (
              <motion.div
                id={id}
                role="tooltip"
                className="cp-cartao"
                style={{ top: pos.top, left: pos.left, width: LARGURA, transformOrigin: "top left" }}
                initial={reduz ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                onPointerEnter={() => window.clearTimeout(timer.current)}
                onPointerLeave={() => depois(false, FECHAR_MS)}
              >
                {cartao}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
