"use client";

// Do Brio (barbearia Figars): uma rajada de confete, uma vez, no momento da conquista.

import { useEffect, useRef } from "react";

const CORES = ["--acento", "--sucesso", "--aviso-vivo", "--ia", "--tinta-3", "--alerta-vivo"];

type Papel = { x: number; y: number; vx: number; vy: number; r: number; vr: number; w: number; h: number; c: string; redondo: boolean; vida: number };

/**
 * Sai de `origem` (fração da tela), cai com gravidade e arrasto e some sozinha.
 * Respeita "reduzir movimento": nesse caso não desenha nada.
 */
export function Confete({ origem = { x: 0.5, y: 0.28 }, quantidade = 140 }: { origem?: { x: number; y: number }; quantidade?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const mundo = document.querySelector("[data-mundo]") ?? document.documentElement;
    const css = getComputedStyle(mundo);
    const paleta = CORES.map((v) => css.getPropertyValue(v).trim() || "#2b6a8a");
    const ox = origem.x * W;
    const oy = origem.y * H;
    const papeis: Papel[] = Array.from({ length: quantidade }, (_, i) => {
      // leque para cima, mais forte no meio
      const angulo = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
      const vel = 7 + Math.random() * 9;
      return {
        x: ox,
        y: oy,
        vx: Math.cos(angulo) * vel,
        vy: Math.sin(angulo) * vel - 2,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        c: paleta[i % paleta.length],
        redondo: i % 5 === 0,
        vida: 1,
      };
    });

    let raf = 0;
    let anterior = 0;
    const quadro = (t: number) => {
      const dt = anterior ? Math.min(2.5, (t - anterior) / 16.67) : 1;
      anterior = t;
      ctx.clearRect(0, 0, W, H);
      let vivos = 0;
      for (const b of papeis) {
        if (b.vida <= 0) continue;
        b.vx *= Math.pow(0.985, dt);
        b.vy = b.vy * Math.pow(0.985, dt) + 0.32 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.r += b.vr * dt;
        if (b.vy > 0) b.vida -= 0.006 * dt;
        if (b.y > H + 20) b.vida = 0;
        if (b.vida <= 0) continue;
        vivos++;
        ctx.save();
        ctx.globalAlpha = Math.min(1, b.vida * 1.6);
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        // o "giro" do papel: a largura oscila como se virasse no ar
        ctx.scale(1, Math.cos(b.r * 2.2));
        ctx.fillStyle = b.c;
        if (b.redondo) {
          ctx.beginPath();
          ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
      raf = vivos ? requestAnimationFrame(quadro) : 0;
      if (!vivos) ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
    // dispara uma vez por montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-50 size-full" />;
}
