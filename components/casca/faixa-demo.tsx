"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { escolherConsultorio, meusConsultorios, FIXTURE_ATIVA } from "@/lib/api";
import type { Consultorio } from "@/lib/contratos";

/* Faixa amarela no topo quando o consultório ativo é a demonstração: evita confundir dado fictício com real.
   No celular é também o único lugar para trocar de consultório. */
export function FaixaDemo() {
  const [lista, setLista] = useState<Consultorio[]>([]);
  useEffect(() => {
    if (FIXTURE_ATIVA) return;
    void meusConsultorios().then((r) => r.sucesso && setLista(r.dados));
  }, []);
  const ativo = lista.find((c) => c.ativo);
  const real = lista.find((c) => !c.demo);
  if (!ativo?.demo) return null;
  async function voltar() {
    if (!real) return;
    const r = await escolherConsultorio(real.id);
    if (!r.sucesso) { toast.error("Não deu para sair da demonstração."); return; }
    window.location.reload();
  }
  return (
    <div className="faixa-demo" role="status">
      Modo demonstração: tudo aqui é fictício.
      {real && <button type="button" onClick={() => void voltar()}>Voltar ao consultório real</button>}
    </div>
  );
}
