"use client";

import { useRef, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { ChevronsLeftRight } from "lucide-react";
import { antesDepois } from "@/config/site";
import { BotaoWhatsApp } from "./botao-whatsapp";
import { Revelar, TextoSobe } from "./revelar";

/* Image compare (ideia do bencho.dev): arrasta a linha para comparar; um "flick" desliza até a borda
   com inércia. O corte é clip-path (só compositor), a posição vive numa variável CSS do próprio elemento. */
function Comparador({ antes, depois, titulo }: { antes: string; depois: string; titulo: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const corte = useMotionValue(50);
  const [arrastando, setArrastando] = useState(false);
  const reduzir = useReducedMotion();
  const ultimo = useRef<{ x: number; t: number; v: number }>({ x: 0, t: 0, v: 0 });

  useMotionValueEvent(corte, "change", (v) => {
    ref.current?.style.setProperty("--corte", `${v}%`);
  });

  function posicao(clientX: number) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return 50;
    return Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
  }

  function iniciar(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    ref.current?.setPointerCapture(e.pointerId);
    corte.stop();
    setArrastando(true);
    const p = posicao(e.clientX);
    corte.set(p);
    ultimo.current = { x: p, t: performance.now(), v: 0 };
  }
  function mover(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    const p = posicao(e.clientX);
    const agora = performance.now();
    const dt = Math.max(1, agora - ultimo.current.t);
    ultimo.current = { x: p, t: agora, v: (p - ultimo.current.x) / dt };
    corte.set(p);
  }
  function soltar(e: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    setArrastando(false);
    ref.current?.releasePointerCapture(e.pointerId);
    const v = ultimo.current.v; // % por ms
    if (!reduzir && Math.abs(v) > 0.12) {
      // flick: desliza até a borda com desaceleração
      animate(corte, v > 0 ? 96 : 4, { type: "spring", stiffness: 120, damping: 20, velocity: v * 1000 });
    }
  }
  function teclado(e: React.KeyboardEvent<HTMLDivElement>) {
    const passo = e.shiftKey ? 10 : 4;
    if (e.key === "ArrowLeft") corte.set(Math.max(0, corte.get() - passo));
    if (e.key === "ArrowRight") corte.set(Math.min(100, corte.get() + passo));
    if (e.key === "Home") corte.set(0);
    if (e.key === "End") corte.set(100);
  }

  return (
    <div
      ref={ref}
      className="s-compara"
      data-arrastando={arrastando ? "" : undefined}
      role="slider"
      aria-label={`Comparar antes e depois: ${titulo}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(corte.get())}
      tabIndex={0}
      onPointerDown={iniciar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onKeyDown={teclado}
      style={{ "--corte": "50%" } as React.CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG de exemplo, sem otimização */}
      <img src={antes} alt="" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG de exemplo, sem otimização */}
      <img src={depois} alt="" className="s-compara__depois" draggable={false} />
      <span className="s-compara__etiqueta s-compara__etiqueta--antes">Antes</span>
      <span className="s-compara__etiqueta s-compara__etiqueta--depois">Depois</span>
      <span className="s-compara__exemplo">Exemplo ilustrativo</span>
      <span className="s-compara__linha" aria-hidden />
      <span className="s-compara__alca" aria-hidden>
        <ChevronsLeftRight size={18} />
      </span>
    </div>
  );
}

export function AntesDepois() {
  const caso = antesDepois[0];
  return (
    <section id="resultados" className="s-secao s-secao--linha" aria-labelledby="res-titulo">
      <div className="s-conteudo s-resultados__grade">
        <div className="s-resultados__texto">
          <Revelar as="p" className="s-rotulo">
            Resultados
          </Revelar>
          <TextoSobe className="s-titulo-2" texto="Arraste e compare." destaque="compare." />
          <Revelar as="p" className="s-texto" indice={1}>
            {caso.titulo}. {caso.descricao}
          </Revelar>
          <Revelar as="p" className="s-texto s-pequeno s-mudo" indice={2}>
            Fotos reais de pacientes só entram aqui com autorização por escrito. Resultados variam de
            pessoa para pessoa.
          </Revelar>
          <Revelar indice={3}>
            <BotaoWhatsApp origem="antes-depois" className="s-botao s-botao--contorno">
              Quero um resultado assim
            </BotaoWhatsApp>
          </Revelar>
        </div>
        <Revelar indice={1}>
          <Comparador antes={caso.antes} depois={caso.depois} titulo={caso.titulo} />
        </Revelar>
      </div>
    </section>
  );
}
