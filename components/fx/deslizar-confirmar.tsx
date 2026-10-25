"use client";

// Adaptado do bloco "Slide to confirm" do Bencho (bencho.dev), licença MIT, via o Brio (barbearia Figars).
// Ver THIRD_PARTY_NOTICES.md.

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ArrowRight, Check } from "lucide-react";

const H = 56;
const PAD = 4;
const PUXADOR = H - PAD * 2;
const RIGIDEZ = 580;
// amortecimento crítico: no fim do trilho não há para onde o puxador ultrapassar
const MOLA = { type: "spring" as const, stiffness: RIGIDEZ, damping: 2 * Math.sqrt(RIGIDEZ * 0.9), mass: 0.9 };
// a volta é um pouco subamortecida; o excesso vira achatamento contra a borda
const VOLTA = { ...MOLA, damping: MOLA.damping * 0.62 };

const limitar = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Props {
  rotulo: string;
  rotuloFeito?: string;
  /** Validação antes de confirmar; se devolver false, o puxador volta. */
  podeConfirmar?: () => boolean;
  aoConfirmar: () => void;
  desabilitado?: boolean;
  /** "alerta" pinta o trilho de vermelho: para cancelar, excluir, marcar falta. */
  tom?: "tinta" | "alerta";
  className?: string;
}

/**
 * Arrastar até o fim para confirmar. O puxador segue o dedo; no fim ele se
 * desdobra para a esquerda e vira a própria confirmação. Teclado: Enter ou →.
 */
export function DeslizarConfirmar({ rotulo, rotuloFeito = "Confirmado", podeConfirmar, aoConfirmar, desabilitado, tom = "tinta", className = "" }: Props) {
  const reduz = useReducedMotion();
  const trilho = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(320);
  const [feito, setFeito] = useState(false);
  const [segurando, setSegurando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const pegada = useRef<{ id: number; agarre: number | null } | null>(null);
  const timer = useRef(0);
  const soltar = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      soltar.current?.();
    },
    [],
  );

  const percurso = Math.max(1, largura - PAD * 2 - PUXADOR);

  const x = useMotionValue(0);
  // onde o puxador parou ao confirmar: a largura cresce o que o x perde,
  // então a borda direita fica parada por aritmética
  const ancora = useMotionValue(0);
  const pulso = useMotionValue(1);
  const mostra = useMotionValue(1);

  const visto = useTransform(x, (v) => limitar(v, 0, percurso));
  const larguraPuxador = useTransform([visto, ancora], ([v, a]: number[]) => PUXADOR + limitar(a - v, 0, percurso));
  const achata = useTransform(x, (v) => 1 - Math.min(0.08, Math.max(0, -v) / 110));
  const incha = sobre && !segurando && !feito ? 1.03 : 1;
  const sx = useTransform(achata, (q) => q * incha);
  const sy = useTransform(achata, (q) => (1 / q) * incha);
  const rastro = useTransform(visto, (v) => v + PUXADOR);
  const texto = useTransform(visto, (v) => 1 - limitar(v / (percurso * 0.55), 0, 1));
  const seta = useTransform([visto, mostra], ([v, on]: number[]) => on * limitar(1 - (v - percurso * 0.55) / (percurso * 0.4), 0, 1));

  const terminar = () => {
    setFeito(true);
    ancora.set(x.get());
    animate(mostra, 0, { duration: 0.16 });
    animate(x, 0, reduz ? { duration: 0 } : MOLA);
    if (!reduz) animate(pulso, [1, 0.974, 1], { duration: 0.42, times: [0, 0.62, 1], ease: [0.33, 0.55, 0.2, 1], delay: 0.1 });
    timer.current = window.setTimeout(aoConfirmar, reduz ? 0 : 480);
  };

  const tentar = () => {
    if (podeConfirmar && !podeConfirmar()) {
      animate(x, 0, VOLTA);
      return;
    }
    terminar();
  };

  const local = (clientX: number) => {
    const caixa = trilho.current?.getBoundingClientRect();
    return caixa ? clientX - caixa.left : 0;
  };

  // o arrasto é seguido na janela: soltar em qualquer lugar encerra o gesto,
  // mesmo que o navegador perca a captura do ponteiro
  const mover = (e: PointerEvent) => {
    const g = pegada.current;
    if (!g || g.id !== e.pointerId) return;
    const em = local(e.clientX);
    if (g.agarre === null) {
      g.agarre = em - x.get();
      return;
    }
    x.set(limitar(em - g.agarre, 0, percurso));
  };

  const largar = (e: PointerEvent) => {
    if (!pegada.current) return;
    pegada.current = null;
    try {
      trilho.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* não estava capturado */
    }
    setSegurando(false);
    // quase no fim já vale: o dedo costuma soltar alguns pixels antes da borda
    if (x.get() >= percurso * 0.9) tentar();
    else animate(x, 0, VOLTA);
  };

  const pegar = (e: React.PointerEvent) => {
    if (feito || desabilitado) return;
    x.stop();
    pegada.current = { id: e.pointerId, agarre: null };
    setSegurando(true);
    try {
      trilho.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ponteiro sintético */
    }
    soltar.current?.();
    const aoMover = (ev: PointerEvent) => mover(ev);
    const aoSoltar = (ev: PointerEvent) => {
      largar(ev);
      soltar.current?.();
    };
    window.addEventListener("pointermove", aoMover);
    window.addEventListener("pointerup", aoSoltar);
    window.addEventListener("pointercancel", aoSoltar);
    soltar.current = () => {
      window.removeEventListener("pointermove", aoMover);
      window.removeEventListener("pointerup", aoSoltar);
      window.removeEventListener("pointercancel", aoSoltar);
      soltar.current = null;
    };
  };

  const tecla = (e: React.KeyboardEvent) => {
    if (feito || desabilitado) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      if (podeConfirmar && !podeConfirmar()) return;
      if (reduz) terminar();
      else animate(x, percurso, { ...MOLA, onComplete: terminar });
    }
  };

  return (
    <motion.div
      ref={trilho}
      className={`sld ${className}`}
      data-tom={tom}
      style={{ height: H, scale: pulso }}
      data-held={segurando || undefined}
      data-done={feito || undefined}
      data-disabled={desabilitado || undefined}
      onPointerDown={pegar}
    >
      <motion.i className="sld-wash" aria-hidden style={{ width: rastro }} />
      <motion.span className="sld-say" style={{ opacity: texto }} aria-hidden>
        {rotulo}
      </motion.span>
      <motion.button
        type="button"
        className="sld-grip"
        disabled={desabilitado}
        onPointerEnter={() => setSobre(true)}
        onPointerLeave={() => setSobre(false)}
        onKeyDown={tecla}
        onClick={(e) => e.preventDefault()}
        style={{ x: visto, scaleX: sx, scaleY: sy, width: larguraPuxador }}
        aria-label={feito ? rotuloFeito : `${rotulo}. Arraste até o fim ou pressione Enter.`}
      >
        <motion.span className="sld-arrow" style={{ opacity: seta }} aria-hidden>
          <ArrowRight size={20} strokeWidth={2} />
        </motion.span>
        <motion.span
          className="sld-done"
          aria-hidden
          initial={false}
          animate={{ opacity: feito ? 1 : 0, scale: feito ? 1 : 0.7 }}
          transition={{ duration: 0.16, ease: [0.33, 0.55, 0.2, 1] }}
        >
          <Check size={20} strokeWidth={2.4} />
          {rotuloFeito}
        </motion.span>
      </motion.button>
    </motion.div>
  );
}
