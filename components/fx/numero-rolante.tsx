"use client";

// Adaptado do bloco "Rolling counter" do Bencho (bencho.dev), licença MIT, via o Brio (barbearia Figars).
// Ver THIRD_PARTY_NOTICES.md.

import { useEffect, useLayoutEffect, useRef } from "react";

// mola por quadro (1/60 s): a amortização é elevada ao dt, então um quadro
// perdido gasta a mesma energia que os dois que ele substituiu
const K = 0.152;
const D = 0.71;
const ESCALONA = 45;
const CELULA = 1.15; // em

type Coluna = { pos: number; vel: number; alvo: number; quando: number[]; proximos: number[] };

const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const parado = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Número que rola como um odômetro quando muda. Cada coluna conta (1284 é
 * 128 para as dezenas), então 9 → 10 avança uma casa em vez de voltar oito.
 * Na primeira pintura não anima: o painel abre parado e só se mexe quando
 * o valor muda de verdade (uma consulta confirmada, por exemplo).
 */
export function NumeroRolante({ valor, className = "" }: { valor: string; className?: string }) {
  const chars = [...valor];
  const digitos = chars.filter((c) => c >= "0" && c <= "9");
  const n = Number(digitos.join("") || "0");
  const casas = digitos.length;

  const colunas = useRef<Coluna[]>([]);
  const fitas = useRef<(HTMLSpanElement | null)[]>([]);
  const raf = useRef(0);

  const pintar = () => {
    colunas.current.forEach((c, p) => {
      const el = fitas.current[p];
      if (!el || !c) return;
      const m = ((c.pos % 10) + 10) % 10;
      const borrao = Math.min(3, Math.abs(c.vel) * 2.4);
      el.style.transform = `translateY(${-m * CELULA}em)`;
      el.style.filter = borrao > 0.15 ? `blur(${borrao.toFixed(2)}px)` : "";
    });
  };

  const inquieto = () => colunas.current.some((c) => c && (c.quando.length > 0 || c.pos !== c.alvo || c.vel !== 0));

  const rodar = () => {
    if (raf.current) return;
    let anterior = 0;
    const tick = (t: number) => {
      const dt = anterior ? limitar((t - anterior) / 16.67, 0, 2.5) : 1;
      anterior = t;
      const agora = performance.now();
      let ocupado = false;
      for (const c of colunas.current) {
        if (!c) continue;
        while (c.quando.length && c.quando[0] <= agora) {
          c.quando.shift();
          c.alvo = c.proximos.shift()!;
        }
        if (c.quando.length) ocupado = true;
        // uma coluna muito longe pula voltas inteiras antes (fica igual na tela)
        const falta = c.alvo - c.pos;
        if (Math.abs(falta) > 24) c.pos += Math.round((falta - Math.sign(falta) * 24) / 10) * 10;
        c.vel += (c.alvo - c.pos) * K * dt;
        c.vel *= Math.pow(D, dt);
        c.pos += c.vel * dt;
        if (Math.abs(c.alvo - c.pos) < 0.004 && Math.abs(c.vel) < 0.004) {
          c.pos = c.alvo;
          c.vel = 0;
        } else ocupado = true;
      }
      pintar();
      raf.current = ocupado ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  };

  useLayoutEffect(() => {
    const agora = performance.now();
    const quieto = parado();
    let mexeu = false;
    for (let p = 0; p < casas; p++) {
      const para = Math.floor(n / 10 ** p);
      const c = colunas.current[p];
      if (!c) {
        colunas.current[p] = { pos: para, vel: 0, alvo: para, quando: [], proximos: [] };
        continue;
      }
      const ultimo = c.proximos.length ? c.proximos[c.proximos.length - 1] : c.alvo;
      if (ultimo === para) continue;
      if (quieto) {
        c.pos = c.alvo = para;
        c.vel = 0;
        c.quando = [];
        c.proximos = [];
      } else {
        c.quando.push(agora + p * ESCALONA);
        c.proximos.push(para);
        mexeu = true;
      }
    }
    colunas.current.length = casas;
    pintar();
    if (mexeu || inquieto()) rodar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, casas]);

  // ao (re)montar, retoma uma rolagem que ficou pela metade; ao desmontar, zera o laço
  useEffect(() => {
    if (inquieto()) rodar();
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // casas contadas da direita para a esquerda, para que as colunas sobrevivam quando o número ganha um dígito
  let casa = casas;
  return (
    <span className={`rn ${className}`}>
      <span className="sr-only">{valor}</span>
      <span aria-hidden className="rn-row">
        {chars.map((ch, i) => {
          if (ch < "0" || ch > "9") {
            return (
              <span key={`s${chars.length - i}`} className="rn-static">
                {ch}
              </span>
            );
          }
          const p = --casa;
          return (
            <span key={`d${p}`} className="rn-col">
              <span
                className="rn-strip"
                ref={(el) => {
                  fitas.current[p] = el;
                }}
                style={{ transform: `translateY(${-Number(ch) * CELULA}em)` }}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => (
                  <span key={j}>{d}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
