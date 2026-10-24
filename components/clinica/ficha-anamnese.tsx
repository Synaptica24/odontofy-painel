"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { salvarAnamnese } from "@/lib/api";
import type { Anamnese, Prontuario } from "@/lib/contratos";
import { AreaTexto, Bloco, Campo } from "@/components/ui/primitivos";

type Campos = Omit<Anamnese, "paciente_id" | "atualizado_em">;
const VAZIA: Campos = {
  alergias: "", medicamentos: "", doencas: "", gestante: false, fumante: false, diabetes: false, hipertensao: false,
  cardiopatia: false, anticoagulante: false, cirurgias: "", queixa_principal: "", observacoes: "",
};
const MARCACOES: { chave: keyof Campos; rotulo: string }[] = [
  { chave: "gestante", rotulo: "Gestante" }, { chave: "fumante", rotulo: "Fumante" }, { chave: "diabetes", rotulo: "Diabetes" },
  { chave: "hipertensao", rotulo: "Hipertensão" }, { chave: "cardiopatia", rotulo: "Cardiopatia" }, { chave: "anticoagulante", rotulo: "Usa anticoagulante" },
];

/* Anamnese salva sozinha (debounce). Nunca perde texto: em erro, o que foi digitado fica na tela. */
export function FichaAnamnese({ d, definir }: { d: Prontuario; definir: (fn: (x: Prontuario) => Prontuario) => void }) {
  const base: Campos = d.anamnese ? { ...VAZIA, ...d.anamnese } : VAZIA;
  const [f, setF] = useState<Campos>(base);
  const [estado, setEstado] = useState<"parado" | "salvando" | "salvo" | "erro">("parado");
  const [salvoEm, setSalvoEm] = useState<string | null>(d.anamnese?.atualizado_em ?? null);
  const sujo = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!sujo.current) return;
    setEstado("salvando");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const res = await salvarAnamnese(d.paciente.id, f);
      if (!res.sucesso) { setEstado("erro"); toast.error("A anamnese não salvou.", { description: `${res.erro.mensagem} O texto continua aí.` }); return; }
      setEstado("salvo"); setSalvoEm(res.dados.atualizado_em);
      definir((x) => ({ ...x, anamnese: res.dados }));
    }, 800);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  const mudar = <K extends keyof Campos>(k: K, v: Campos[K]) => { sujo.current = true; setF((x) => ({ ...x, [k]: v })); };
  const hora = salvoEm ? new Date(salvoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : null;
  const lado = estado === "salvando" ? "salvando…" : estado === "erro" ? "não salvou" : hora ? `salvo às ${hora}` : undefined;

  return (
    <>
      <Bloco titulo="Anamnese" id="anamnese" lado={lado} primeiro>
        <div className="grid gap-3">
          <Campo rotulo="Queixa principal"><AreaTexto rows={2} value={f.queixa_principal} onChange={(e) => mudar("queixa_principal", e.target.value)} placeholder="O que trouxe o paciente" /></Campo>
          <Campo rotulo="Alergias" dica="Medicamentos, látex, anestésicos…"><AreaTexto rows={2} value={f.alergias} onChange={(e) => mudar("alergias", e.target.value)} /></Campo>
          <Campo rotulo="Medicamentos em uso"><AreaTexto rows={2} value={f.medicamentos} onChange={(e) => mudar("medicamentos", e.target.value)} /></Campo>
          <Campo rotulo="Doenças e condições"><AreaTexto rows={2} value={f.doencas} onChange={(e) => mudar("doencas", e.target.value)} /></Campo>
          <Campo rotulo="Cirurgias anteriores"><AreaTexto rows={2} value={f.cirurgias} onChange={(e) => mudar("cirurgias", e.target.value)} /></Campo>
        </div>
      </Bloco>
      <Bloco titulo="Condições" id="condicoes">
        <div className="marcacoes">
          {MARCACOES.map((m) => (
            <label key={m.chave}>
              <input type="checkbox" checked={!!f[m.chave]} onChange={(e) => mudar(m.chave, e.target.checked as never)} />
              {m.rotulo}
            </label>
          ))}
        </div>
      </Bloco>
      <Bloco titulo="Observações da anamnese" id="anam-obs">
        <AreaTexto rows={3} value={f.observacoes} onChange={(e) => mudar("observacoes", e.target.value)} placeholder="Qualquer coisa relevante para o atendimento" />
      </Bloco>
      {(d.anamneses_respostas ?? []).length > 0 && (
        <Bloco titulo="Anamneses respondidas" id="anam-respostas" lado={`${d.anamneses_respostas!.length} importada${d.anamneses_respostas!.length === 1 ? "" : "s"} do Codental`}>
          <div className="grid gap-2">
            {d.anamneses_respostas!.map((a) => {
              const preenchidas = a.respostas.filter((r) => r.resposta && r.resposta.trim());
              return (
                <details key={a.id} className="anam-resp">
                  <summary>
                    <span className="anam-resp__modelo">{a.modelo}</span>
                    <span className="anam-resp__meta">
                      {new Date(a.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      {" · "}{preenchidas.length} {preenchidas.length === 1 ? "resposta" : "respostas"}{a.assinada ? " · assinada" : ""}
                    </span>
                  </summary>
                  <dl className="anam-resp__lista">
                    {(preenchidas.length ? preenchidas : a.respostas).map((r, i) => (
                      <div key={i}>
                        <dt>{r.pergunta}</dt>
                        <dd>{r.resposta || <span className="text-tinta-3">sem resposta</span>}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              );
            })}
          </div>
        </Bloco>
      )}
    </>
  );
}

/** Alertas para o resumo: o que precisa saltar aos olhos antes de atender. */
export function alertasAnamnese(a: Anamnese | null): { texto: string; cor: "vermelho" | "amarelo" }[] {
  if (!a) return [];
  const lista: { texto: string; cor: "vermelho" | "amarelo" }[] = [];
  if (a.alergias.trim()) lista.push({ texto: `Alergia: ${a.alergias.trim()}`, cor: "vermelho" });
  if (a.anticoagulante) lista.push({ texto: "Usa anticoagulante", cor: "vermelho" });
  if (a.cardiopatia) lista.push({ texto: "Cardiopatia", cor: "vermelho" });
  if (a.gestante) lista.push({ texto: "Gestante", cor: "amarelo" });
  if (a.diabetes) lista.push({ texto: "Diabetes", cor: "amarelo" });
  if (a.hipertensao) lista.push({ texto: "Hipertensão", cor: "amarelo" });
  if (a.fumante) lista.push({ texto: "Fumante", cor: "amarelo" });
  if (a.medicamentos.trim()) lista.push({ texto: `Medicamentos: ${a.medicamentos.trim()}`, cor: "amarelo" });
  return lista;
}
