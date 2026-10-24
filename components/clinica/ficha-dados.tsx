"use client";

import type { Paciente } from "@/lib/contratos";
import { PacienteForm } from "./paciente-form";

/* Folha "Editar dados" da ficha: o mesmo formulário completo do cadastro, já preenchido. */
export function FichaDados({ paciente, aoFechar, aoSalvar }: { paciente: Paciente; aoFechar: () => void; aoSalvar: (p: Paciente) => void }) {
  return <PacienteForm paciente={paciente} aoFechar={aoFechar} aoSalvar={(p) => { aoSalvar(p); aoFechar(); }} />;
}
