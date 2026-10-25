"use client";

// Adaptado do bloco "Emoji reactions" do Bencho (bencho.dev), licença MIT, via o Brio (barbearia Figars).
// Ver THIRD_PARTY_NOTICES.md.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SmilePlus } from "lucide-react";

const EMOJIS = [
  { e: "👍", rotulo: "Joia" },
  { e: "❤️", rotulo: "Obrigado" },
  { e: "😂", rotulo: "Haha" },
  { e: "🙏", rotulo: "Valeu" },
  { e: "✅", rotulo: "Combinado" },
  { e: "🦷", rotulo: "Até logo" },
];
const LARGURA = 36;

// cada emoji chega do seu jeito
const JEITO: Record<string, string> = { "👍": "nod", "❤️": "beat", "😂": "laugh", "🙏": "bow", "✅": "tick", "🦷": "flicker" };

function Emo({ e, toca }: { e: string; toca: boolean }) {
  return (
    <i className="rxn-p" data-k={JEITO[e] ?? "nod"} data-play={toca || undefined}>
      {e}
    </i>
  );
}

type Voo = { e: string; fx: number; fy: number; tx: number; ty: number };

/**
 * Reação rápida numa conversa: escolher um emoji manda ele como mensagem.
 * `valor` é a última reação enviada (mostrada no chip); `aoEscolher` recebe o emoji.
 */
export function Reacoes({ valor, aoEscolher, aoLimpar, desabilitado }: { valor: string | null; aoEscolher: (e: string) => void; aoLimpar?: () => void; desabilitado?: boolean }) {
  const reduz = useReducedMotion();
  const [aberto, setAberto] = useState(false);
  const [sobre, setSobre] = useState<number | null>(null);
  const [voo, setVoo] = useState<Voo | null>(null);
  const [pousando, setPousando] = useState(false);
  const [pousou, setPousou] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const pendente = useRef<{ e: string; fx: number; fy: number } | null>(null);

  const rapido = { type: "spring" as const, bounce: 0.2, duration: 0.24 };

  // toque fora fecha
  useEffect(() => {
    if (!aberto) return;
    const fora = (ev: PointerEvent) => {
      if (!raiz.current?.contains(ev.target as Node)) setAberto(false);
    };
    const esc = (ev: KeyboardEvent) => ev.key === "Escape" && setAberto(false);
    document.addEventListener("pointerdown", fora, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora, true);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const local = (r: DOMRect) => {
    const b = raiz.current!.getBoundingClientRect();
    return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top };
  };

  const escolher = (e: string, de: HTMLElement) => {
    setAberto(false);
    setSobre(null);
    const em = local(de.getBoundingClientRect());
    pendente.current = reduz ? null : { e, fx: em.x, fy: em.y };
    setPousando(!reduz);
    aoEscolher(e);
  };

  // o chip já está no lugar: mede onde o emoji pousa e manda a cópia para lá
  useLayoutEffect(() => {
    const p = pendente.current;
    if (!p || valor !== p.e) return;
    const el = raiz.current?.querySelector<HTMLElement>(".rxn-chip-e");
    if (!el) return;
    pendente.current = null;
    const para = local(el.getBoundingClientRect());
    setVoo({ e: p.e, fx: p.fx, fy: p.fy, tx: para.x, ty: para.y });
  }, [valor]);

  const pousar = () => {
    setVoo(null);
    setPousando(false);
    setPousou(true);
    window.setTimeout(() => setPousou(false), 700);
  };

  return (
    <div ref={raiz} className="rxn">
      <AnimatePresence initial={false} mode="popLayout">
        {valor && (
          <motion.button
            key={valor}
            type="button"
            className="rxn-chip"
            aria-label={`Última reação enviada: ${valor}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1, transition: rapido }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.16 } }}
            whileTap={{ scale: 0.92 }}
            onClick={() => aoLimpar?.()}
          >
            <span className="rxn-chip-e" data-landing={pousando || undefined}>
              <Emo e={valor} toca={pousou} />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <span className="rxn-add-wrap">
        <button type="button" className="rxn-add" aria-label="Reagir com emoji" aria-expanded={aberto} disabled={desabilitado} onClick={() => setAberto((o) => !o)}>
          <SmilePlus size={16} strokeWidth={2} />
        </button>
        <AnimatePresence>
          {aberto && (
            <motion.div
              className="rxn-pill"
              role="menu"
              initial={{ opacity: 0, scale: 0.9, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: rapido }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.14 } }}
              style={{ width: LARGURA * EMOJIS.length + 12 }}
              onPointerLeave={() => setSobre(null)}
            >
              {EMOJIS.map((m, i) => (
                <motion.button
                  key={m.e}
                  type="button"
                  role="menuitem"
                  className="rxn-emo"
                  aria-label={`Enviar ${m.e} (${m.rotulo})`}
                  initial={{ opacity: 0, y: 8, scale: 0.5, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { ...rapido, delay: 0.02 + i * 0.018 } }}
                  style={{ "--s": i === sobre && !reduz ? 1.3 : 1 } as React.CSSProperties}
                  onPointerEnter={() => setSobre(i)}
                  onFocus={() => setSobre(i)}
                  onClick={(ev) => escolher(m.e, ev.currentTarget)}
                >
                  <span>
                    <Emo e={m.e} toca={i === sobre} />
                  </span>
                </motion.button>
              ))}
              <AnimatePresence>
                {sobre != null && (
                  <motion.span key="dica" className="rxn-tip" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} style={{ left: 6 + sobre * LARGURA + LARGURA / 2 }}>
                    {EMOJIS[sobre].rotulo}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </span>

      {/* a reação a caminho: um arco do seletor até o chip */}
      {voo && (
        <motion.span
          className="rxn-fly"
          aria-hidden
          initial={{ x: voo.fx, y: voo.fy, scale: 1.4 }}
          animate={{
            x: [voo.fx, (voo.fx + voo.tx) / 2, voo.tx],
            y: [voo.fy, Math.min(voo.fy, voo.ty) - 40, voo.ty],
            scale: [1.4, 1.25, 1],
            rotate: [0, -14, 0],
          }}
          transition={{ duration: 0.55, ease: [0.35, 0, 0.3, 1], times: [0, 0.45, 1] }}
          onAnimationComplete={pousar}
        >
          {voo.e}
        </motion.span>
      )}
    </div>
  );
}
