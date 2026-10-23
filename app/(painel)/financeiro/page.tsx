import type { Metadata } from "next";
import { TelaFinanceiro } from "@/components/telas/financeiro";

export const metadata: Metadata = { title: "Financeiro" };

export default function PaginaFinanceiro() {
  return <TelaFinanceiro />;
}
