"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { depoimentos } from "@/config/site";
import { BotaoWhatsApp } from "./botao-whatsapp";
import { Revelar, TextoSobe } from "./revelar";

/* Swipe deck (ideia do bencho.dev): a carta da frente sai para o lado com a velocidade do gesto;
   as de trás sobem um degrau. Setas e teclado fazem o mesmo sem arrastar. */
export function Depoimentos() {
  const [indice, setIndice] = useState(0);
  const [direcao, setDirecao] = useState(1);
  const reduzir = useReducedMotion();
  const total = depoimentos.length;

  function ir(delta: number) {
    setDirecao(delta);
    setIndice((i) => (i + delta + total) % total);
  }
  function soltar(_: unknown, info: PanInfo) {
    const rapido = Math.abs(info.velocity.x) > 500;
    const longe = Math.abs(info.offset.x) > 90;
    if (rapido || longe) ir(info.offset.x < 0 ? 1 : -1);
  }

  const visiveis = [0, 1, 2].map((d) => depoimentos[(indice + d) % total]);

  return (
    <section id="depoimentos" className="s-secao s-secao--linha" aria-labelledby="depo-titulo">
      <div className="s-conteudo s-depo__grade">
        <div>
          <Revelar as="p" className="s-rotulo">
            Quem já passou por aqui
          </Revelar>
          <div style={{ marginTop: "1rem" }}>
            <TextoSobe
              className="s-titulo-2"
              texto="Palavras de quem chegou com medo e saiu sorrindo."
              destaque="sorrindo."
            />
          </div>
          <Revelar as="p" className="s-texto" indice={1}>
            <span style={{ display: "block", marginTop: "1.25rem" }}>
              Arraste as cartas ou use as setas. Os depoimentos abaixo são exemplos e serão
              substituídos por relatos reais, com autorização.
            </span>
          </Revelar>
          <Revelar className="s-depo__controles" indice={2}>
            <button type="button" className="s-depo__seta" aria-label="Depoimento anterior" onClick={() => ir(-1)}>
              <ArrowLeft size={18} />
            </button>
            <button type="button" className="s-depo__seta" aria-label="Próximo depoimento" onClick={() => ir(1)}>
              <ArrowRight size={18} />
            </button>
            <span className="s-depo__pontos" aria-hidden>
              {depoimentos.map((_, i) => (
                <i key={i} data-ativo={i === indice ? "" : undefined} />
              ))}
            </span>
            <span className="s-mudo s-pequeno num" aria-live="polite">
              {indice + 1} de {total}
            </span>
          </Revelar>
          <Revelar indice={3}>
            <div style={{ marginTop: "1.5rem" }}>
              <BotaoWhatsApp origem="depoimentos" className="s-botao s-botao--contorno">
                Quero ser o próximo
              </BotaoWhatsApp>
            </div>
          </Revelar>
        </div>

        <Revelar indice={1}>
          <div className="s-baralho" aria-roledescription="carrossel" aria-label="Depoimentos">
            <AnimatePresence initial={false} custom={direcao}>
              {visiveis
                .slice()
                .reverse()
                .map((d, idxInv) => {
                  const profundidade = visiveis.length - 1 - idxInv; // 0 = frente
                  const frente = profundidade === 0;
                  const chave = `${d.nome}-${d.contexto}`;
                  return (
                    <motion.article
                      key={chave}
                      className="s-carta"
                      aria-hidden={!frente}
                      drag={frente && !reduzir ? "x" : false}
                      dragElastic={0.6}
                      dragConstraints={{ left: 0, right: 0 }}
                      onDragEnd={soltar}
                      custom={direcao}
                      initial={
                        reduzir
                          ? { opacity: 0 }
                          : { opacity: 0, transform: `translateY(${12 + profundidade * 10}px) scale(${0.94 - profundidade * 0.04})` }
                      }
                      animate={{
                        opacity: 1 - profundidade * 0.12,
                        transform: `translateY(${profundidade * 14}px) scale(${1 - profundidade * 0.05})`,
                        zIndex: 10 - profundidade,
                      }}
                      variants={{
                        sair: (dir: number) =>
                          reduzir
                            ? { opacity: 0 }
                            : {
                                opacity: 0,
                                transform: `translateX(${dir > 0 ? -120 : 120}%) rotate(${dir > 0 ? -6 : 6}deg)`,
                                transition: { duration: 0.32, ease: [0.23, 1, 0.32, 1] },
                              },
                      }}
                      exit="sair"
                      transition={{ type: "spring", stiffness: 260, damping: 26, mass: 0.7 }}
                      style={{ cursor: frente ? "grab" : "default" }}
                      whileDrag={{ cursor: "grabbing" }}
                    >
                      <span className="s-carta__aspas" aria-hidden>
                        “
                      </span>
                      <p className="s-carta__texto">{d.texto}</p>
                      <footer className="s-carta__autor">
                        <b>{d.nome}</b>
                        <span>{d.contexto}</span>
                      </footer>
                    </motion.article>
                  );
                })}
            </AnimatePresence>
          </div>
        </Revelar>
      </div>
    </section>
  );
}
