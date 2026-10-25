"use client";

// Do Brio (barbearia Figars): rolagem com ímã no centro, base da fita de dias e do tambor.

import { useCallback, useEffect, useRef, type RefObject } from "react";

type Eixo = "x" | "y";

/**
 * Escreve em cada filho `--d` (distância até o centro, em tamanhos de item, com sinal)
 * e `--ad` (a mesma, positiva), para o CSS escalar e esmaecer; quando a rolagem assenta,
 * avisa qual ficou no meio.
 */
export function useImaCentro(ref: RefObject<HTMLElement | null>, eixo: Eixo, total: number, aoAssentar: (indice: number) => void) {
  const assentar = useRef(aoAssentar);
  useEffect(() => {
    assentar.current = aoAssentar;
  });
  // rolagens feitas pelo código não devem escolher nada no caminho
  const quietoAte = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let timer = 0;

    const medir = () => {
      raf = 0;
      const caixa = el.getBoundingClientRect();
      const meio = eixo === "x" ? caixa.left + caixa.width / 2 : caixa.top + caixa.height / 2;
      const filhos = el.children;
      let melhor = -1;
      let melhorD = Infinity;
      for (let i = 0; i < filhos.length; i++) {
        const k = filhos[i] as HTMLElement;
        const r = k.getBoundingClientRect();
        const tamanho = eixo === "x" ? r.width : r.height;
        const c = eixo === "x" ? r.left + r.width / 2 : r.top + r.height / 2;
        const d = tamanho ? (c - meio) / tamanho : 0;
        k.style.setProperty("--d", d.toFixed(3));
        k.style.setProperty("--ad", Math.min(4, Math.abs(d)).toFixed(3));
        if (Math.abs(d) < melhorD) {
          melhorD = Math.abs(d);
          melhor = i;
        }
      }
      return melhor;
    };

    const aoRolar = () => {
      if (!raf) raf = requestAnimationFrame(medir);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const i = medir();
        if (i >= 0 && performance.now() > quietoAte.current) assentar.current(i);
      }, 120);
    };

    medir();
    el.addEventListener("scroll", aoRolar, { passive: true });
    const ro = new ResizeObserver(() => medir());
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", aoRolar);
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [ref, eixo, total]);

  /** Centraliza o item `i` sem rolar a página. */
  const centrar = useCallback(
    (i: number, suave: boolean) => {
      const el = ref.current;
      const k = el?.children[i] as HTMLElement | undefined;
      if (!el || !k) return;
      quietoAte.current = performance.now() + (suave ? 600 : 160);
      if (eixo === "x") el.scrollTo({ left: k.offsetLeft - (el.clientWidth - k.offsetWidth) / 2, behavior: suave ? "smooth" : "instant" });
      else el.scrollTo({ top: k.offsetTop - (el.clientHeight - k.offsetHeight) / 2, behavior: suave ? "smooth" : "instant" });
    },
    [ref, eixo],
  );

  return centrar;
}
