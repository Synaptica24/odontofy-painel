"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/* Revelação ao rolar com IntersectionObserver + CSS. Só acontece uma vez.
   Text rise e Text blur (ideias do bencho.dev) são variações do mesmo observador. */

function useVisivel<T extends HTMLElement>(margem = "-10% 0px") {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.setAttribute("data-visivel", "");
      return;
    }
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            el.setAttribute("data-visivel", "");
            obs.disconnect();
          }
        }
      },
      { rootMargin: margem, threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [margem]);
  return ref;
}

export function Revelar({
  children,
  as: Tag = "div",
  className = "",
  indice = 0,
  desfoca = false,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  indice?: number;
  desfoca?: boolean;
}) {
  const ref = useVisivel<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={`${desfoca ? "s-desfoca" : "s-revela"} ${className}`}
      style={{ "--i": indice } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}

/** Título em que cada palavra sobe de dentro de uma máscara. Aceita <em> no texto via `destaque`. */
export function TextoSobe({
  texto,
  destaque,
  as: Tag = "h2",
  className = "",
}: {
  texto: string;
  /** palavra(s) a mostrar em itálico terracota, exatamente como aparecem em `texto` */
  destaque?: string;
  as?: ElementType;
  className?: string;
}) {
  const ref = useVisivel<HTMLElement>();
  const palavras = texto.split(" ");
  const limpar = (p: string) => p.replace(/[.,!?;:]/g, "");
  const alvo = destaque?.split(" ").map(limpar) ?? [];
  let i = 0;
  return (
    <Tag ref={ref} className={`s-sobe ${className}`}>
      {palavras.map((p, idx) => {
        const ehDestaque = alvo.length > 0 && alvo.includes(limpar(p));
        const indice = i++;
        return (
          <span key={idx} className="s-sobe__mascara">
            <span className="s-sobe__palavra" style={{ "--i": indice } as React.CSSProperties}>
              {ehDestaque ? <em>{p}</em> : p}
              {idx < palavras.length - 1 ? " " : ""}
            </span>
          </span>
        );
      })}
    </Tag>
  );
}
