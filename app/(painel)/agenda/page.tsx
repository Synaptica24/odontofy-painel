import { Suspense } from "react";
import type { Metadata } from "next";
import { TelaAgenda } from "@/components/telas/agenda";

export const metadata: Metadata = { title: "Agenda" };

export default function PaginaAgenda() {
  return (
    <Suspense fallback={null}>
      <TelaAgenda />
    </Suspense>
  );
}
