"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

/* Quadro de assinatura (ideia do "Signature pad" do bencho.dev): traço com pointer events, grossura que
   varia com a velocidade, funciona com dedo, caneta e mouse. Exporta PNG com fundo transparente. */

export type AssinaturaPadRef = { exportarPng: () => string | null; limpar: () => void; vazio: () => boolean };

export function AssinaturaPad({ ref, onChange }: { ref?: Ref<AssinaturaPadRef>; onChange?: (vazio: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimo = useRef<{ x: number; y: number; t: number; w: number } | null>(null);
  const [vazio, setVazio] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ajustar = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const copia = canvas.toDataURL();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1f1e1b";
      if (!vazio) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height);
        img.src = copia;
      }
    };
    ajustar();
    const obs = new ResizeObserver(ajustar);
    obs.observe(canvas);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ponto(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  }
  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const p = ponto(e);
    ultimo.current = { ...p, w: 2.2 };
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#1f1e1b";
    ctx.fill();
    if (vazio) { setVazio(false); onChange?.(false); }
  }
  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current || !ultimo.current) return;
    e.preventDefault();
    const p = ponto(e);
    const u = ultimo.current;
    const dist = Math.hypot(p.x - u.x, p.y - u.y);
    const vel = dist / Math.max(1, p.t - u.t);
    const alvo = Math.max(1.2, Math.min(3.2, 3.2 - vel * 1.4));
    const w = u.w + (alvo - u.w) * 0.3;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(u.x, u.y);
    ctx.quadraticCurveTo(u.x, u.y, (u.x + p.x) / 2, (u.y + p.y) / 2);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo.current = { ...p, w };
  }
  function soltar(e: React.PointerEvent<HTMLCanvasElement>) {
    desenhando.current = false;
    ultimo.current = null;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
  }
  function limpar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setVazio(true);
    onChange?.(true);
  }

  useImperativeHandle(ref, () => ({
    exportarPng: () => (vazio ? null : (canvasRef.current?.toDataURL("image/png") ?? null)),
    limpar,
    vazio: () => vazio,
  }));

  return (
    <div className="pad">
      <canvas
        ref={canvasRef}
        className="assinar__canvas"
        aria-label="Quadro para desenhar sua assinatura"
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onPointerLeave={soltar}
      />
      <div className="pad__rodape">
        <span className="pad__dica">{vazio ? "Assine aqui com o dedo ou o mouse" : "Assinatura registrada"}</span>
        <button type="button" className="pad__limpar" onClick={limpar} disabled={vazio}>Limpar</button>
      </div>
    </div>
  );
}
