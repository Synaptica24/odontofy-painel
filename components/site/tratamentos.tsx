"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";
import { tratamentos, type Tratamento } from "@/config/site";
import { registrarEvento } from "@/lib/site/eventos";
import { BotaoWhatsApp } from "./botao-whatsapp";
import { Revelar, TextoSobe } from "./revelar";

type Aba = "oQueE" | "paraQuem" | "comoFunciona";
const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: "oQueE", rotulo: "O que é" },
  { chave: "paraQuem", rotulo: "Para quem é" },
  { chave: "comoFunciona", rotulo: "Como funciona" },
];

/* Tilt card (ideia do bencho.dev): o cartão inclina seguindo o ponteiro, com mola, só em ponteiro fino. */
function CartaoTratamento({
  t,
  indice,
  aberto,
  aoAbrir,
}: {
  t: Tratamento;
  indice: number;
  aberto: boolean;
  aoAbrir: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduzir = useReducedMotion();
  const [inclina, setInclina] = useState({ x: 0, y: 0 });

  function mover(e: React.PointerEvent<HTMLButtonElement>) {
    if (reduzir || e.pointerType !== "mouse") return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ref.current?.style.setProperty("--mx", `${px * 100}%`);
    ref.current?.style.setProperty("--my", `${py * 100}%`);
    setInclina({ x: (0.5 - py) * 6, y: (px - 0.5) * 8 });
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`s-trat ${t.destaque ? "s-trat--destaque" : ""}`}
      aria-expanded={aberto}
      aria-controls={`trat-${t.slug}`}
      onClick={aoAbrir}
      onPointerMove={mover}
      onPointerLeave={() => setInclina({ x: 0, y: 0 })}
      animate={{
        transform: `perspective(900px) rotateX(${inclina.x}deg) rotateY(${inclina.y}deg)`,
      }}
      whileTap={reduzir ? undefined : { transform: "perspective(900px) scale(0.985)" }}
      transition={{ type: "spring", stiffness: 220, damping: 22, mass: 0.6 }}
    >
      <span className="s-trat__brilho" aria-hidden />
      <span className="s-trat__indice num" aria-hidden>
        {String(indice + 1).padStart(2, "0")}
      </span>
      <span className="s-trat__nome">{t.nome}</span>
      <span className="s-trat__resumo">{t.resumo}</span>
    </motion.button>
  );
}

export function Tratamentos() {
  const [abertoSlug, setAbertoSlug] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("oQueE");
  const idBase = useId();
  const reduzir = useReducedMotion();
  const aberto = tratamentos.find((t) => t.slug === abertoSlug) ?? null;

  function abrir(t: Tratamento) {
    const fechar = abertoSlug === t.slug;
    setAbertoSlug(fechar ? null : t.slug);
    setAba("oQueE");
    if (!fechar) registrarEvento("ver_tratamento", { tratamento: t.slug });
  }

  return (
    <section id="tratamentos" className="s-secao s-secao--linha" aria-labelledby={`${idBase}-titulo`}>
      <div className="s-conteudo">
        <div className="s-trat__cabeca">
          <div>
            <Revelar as="p" className="s-rotulo">
              Tratamentos
            </Revelar>
            <div style={{ marginTop: "1rem" }}>
              <TextoSobe
                className="s-titulo-2"
                texto="O que fazemos aqui, em palavras que você entende."
                destaque="entende."
              />
            </div>
          </div>
          <Revelar as="p" className="s-texto" indice={2}>
            Toque em um tratamento para ver o que é, para quem é e como funciona. Sem termo técnico sem
            tradução.
          </Revelar>
        </div>

        <div className="s-trat__grade">
          {tratamentos.map((t, i) => (
            <CartaoTratamento
              key={t.slug}
              t={t}
              indice={i}
              aberto={abertoSlug === t.slug}
              aoAbrir={() => abrir(t)}
            />
          ))}

          <AnimatePresence initial={false}>
            {aberto && (
              <motion.div
                key={aberto.slug}
                id={`trat-${aberto.slug}`}
                className="s-trat__detalhe"
                role="region"
                aria-label={aberto.nome}
                initial={reduzir ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px) scale(0.985)" }}
                animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
                exit={reduzir ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px) scale(0.99)" }}
                transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              >
                <div className="s-trat__detalhe-cabeca">
                  <div>
                    <p className="s-rotulo">Tratamento</p>
                    <h3 className="s-titulo-3" style={{ marginTop: "0.5rem" }}>
                      {aberto.nome}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="s-depo__seta"
                    aria-label="Fechar"
                    onClick={() => setAbertoSlug(null)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="s-trat__abas" role="tablist" aria-label="Detalhes do tratamento">
                  {ABAS.map((a) => (
                    <button
                      key={a.chave}
                      type="button"
                      role="tab"
                      aria-selected={aba === a.chave}
                      className="s-trat__aba"
                      onClick={() => setAba(a.chave)}
                    >
                      {a.rotulo}
                    </button>
                  ))}
                </div>
                <div className="s-trat__corpo" role="tabpanel">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={aba}
                      initial={{ opacity: 0, filter: "blur(4px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {aberto[aba]}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <div className="s-trat__rodape">
                  <span className="s-mudo s-pequeno">
                    Valores e prazos exatos saem na avaliação, por escrito.
                  </span>
                  <BotaoWhatsApp
                    origem="tratamento"
                    detalhe={aberto.slug}
                    mensagem={`Olá, vim pelo site e quero agendar uma avaliação. Tenho interesse em: ${aberto.nome}`}
                    className="s-botao"
                  >
                    Agendar avaliação <ArrowUpRight size={18} />
                  </BotaoWhatsApp>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
