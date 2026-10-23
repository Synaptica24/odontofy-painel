"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/* Folha lateral (desktop) / de baixo (celular). Fecha com Esc e clique fora. Sem portal: o z-index já resolve. */
export function Folha({
  titulo,
  sobre,
  aoFechar,
  children,
  acoes,
}: {
  titulo: ReactNode;
  sobre?: ReactNode;
  aoFechar: () => void;
  children: ReactNode;
  acoes?: ReactNode;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
  }, [aoFechar]);
  return (
    <>
      <div className="folha__fundo" onClick={aoFechar} aria-hidden />
      <section className="folha" role="dialog" aria-modal="true" aria-label={typeof titulo === "string" ? titulo : undefined}>
        <header className="folha__cabeca">
          <div className="min-w-0">
            {sobre && <p className="text-[13px] text-tinta-3">{sobre}</p>}
            <h2>{titulo}</h2>
          </div>
          <button type="button" className="folha__fechar pressa" onClick={aoFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        {children}
        {acoes && <div className="folha__acoes">{acoes}</div>}
      </section>
    </>
  );
}
