"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import type { StatusAgendamento, StatusContrato, StatusOrcamento, StatusRetorno } from "@/lib/contratos";

/* Peças compartilhadas da ficha: folha lateral, chips de estado, formatações. */

export function Folha({ titulo, sub, aoFechar, children, acoes }: { titulo: ReactNode; sub?: ReactNode; aoFechar: () => void; children: ReactNode; acoes?: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", tecla); document.body.style.overflow = antes; };
  }, [aoFechar]);
  return (
    <>
      <div className="folha__fundo" onClick={aoFechar} aria-hidden />
      <section className="folha" role="dialog" aria-modal="true" aria-label={typeof titulo === "string" ? titulo : undefined}>
        <div className="folha__cabeca">
          <div className="min-w-0">
            <h2>{titulo}</h2>
            {sub && <p className="text-[13px] text-tinta-2 mt-0.5">{sub}</p>}
          </div>
          <button type="button" className="folha__fechar pressa" aria-label="Fechar" onClick={aoFechar}>
            <X size={18} />
          </button>
        </div>
        {children}
        {acoes && <div className="folha__acoes">{acoes}</div>}
      </section>
    </>
  );
}

export function Chip({ cor, children, title }: { cor?: "azul" | "verde" | "amarelo" | "vermelho" | "cinza"; children: ReactNode; title?: string }) {
  return <span className={`chip ${cor && cor !== "cinza" ? `chip--${cor}` : ""}`} title={title}>{children}</span>;
}
export function ChipCor({ cor, children }: { cor: string; children: ReactNode }) {
  return <span className="chip chip--cor" style={{ background: cor }}>{children}</span>;
}

export const STATUS_AGENDAMENTO: Record<StatusAgendamento, { rotulo: string; cor: "azul" | "verde" | "amarelo" | "vermelho" | "cinza" }> = {
  sugerido: { rotulo: "Sugerido pela IA", cor: "amarelo" },
  agendado: { rotulo: "Agendado", cor: "azul" },
  confirmado: { rotulo: "Confirmado", cor: "verde" },
  concluido: { rotulo: "Concluído", cor: "cinza" },
  faltou: { rotulo: "Faltou", cor: "vermelho" },
  cancelado: { rotulo: "Cancelado", cor: "cinza" },
};
export const STATUS_ORCAMENTO: Record<StatusOrcamento, { rotulo: string; cor: "azul" | "verde" | "amarelo" | "vermelho" | "cinza" }> = {
  pendente: { rotulo: "Pendente", cor: "amarelo" },
  aprovado: { rotulo: "Aprovado", cor: "verde" },
  recusado: { rotulo: "Recusado", cor: "vermelho" },
};
export const STATUS_CONTRATO: Record<StatusContrato, { rotulo: string; cor: "azul" | "verde" | "amarelo" | "vermelho" | "cinza" }> = {
  rascunho: { rotulo: "Rascunho", cor: "cinza" },
  enviado: { rotulo: "Aguardando assinatura", cor: "amarelo" },
  assinado: { rotulo: "Assinado", cor: "verde" },
  cancelado: { rotulo: "Cancelado", cor: "vermelho" },
};
export const STATUS_RETORNO: Record<StatusRetorno, string> = {
  pendente: "Pendente", contatado: "Contatado", agendado: "Agendado", descartado: "Descartado",
};

export function idade(nascimento?: string | null) {
  if (!nascimento) return null;
  const n = new Date(`${nascimento}T12:00:00-03:00`);
  const hoje = new Date();
  let a = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) a--;
  return a;
}
export function cpfBonito(cpf?: string) {
  const d = (cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf ?? "";
}
export function dataCivilBonita(civil?: string | null) {
  if (!civil) return "";
  return new Date(`${civil}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
export function dataHoraBonita(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function tamanhoBonito(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function linkWhatsApp(telefoneE164: string | null | undefined, texto?: string) {
  const n = (telefoneE164 ?? "").replace(/\D/g, "");
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}
export function hojeCivilLocal(desloc = 0) {
  const d = new Date(Date.now() + desloc * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
