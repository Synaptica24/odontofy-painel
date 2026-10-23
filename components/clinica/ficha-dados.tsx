"use client";

import { useState } from "react";
import { toast } from "sonner";
import { listarConvenios, salvarPaciente } from "@/lib/api";
import type { Convenio, DadosPaciente, Paciente } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { AreaTexto, Botao, Campo, Entrada, Interruptor } from "@/components/ui/primitivos";
import { Folha } from "./ficha-util";

/* Folha "Editar dados": cadastro básico do paciente. Telefone em E.164 (+55…). */
export function FichaDados({ paciente, aoFechar, aoSalvar }: { paciente: Paciente; aoFechar: () => void; aoSalvar: (p: Paciente) => void }) {
  const convenios = useApi<Convenio[]>(() => listarConvenios(), []);
  const [f, setF] = useState<DadosPaciente>({
    nome: paciente.nome, telefone_e164: paciente.telefone_e164, cpf: paciente.cpf ?? "", nascimento: paciente.nascimento ?? "",
    email: paciente.email ?? "", endereco: paciente.endereco ?? "", convenio_id: paciente.convenio_id ?? null,
    numero_carteirinha: paciente.numero_carteirinha ?? "", observacoes: paciente.observacoes ?? "", nao_perturbe: paciente.nao_perturbe,
  });
  const [salvando, setSalvando] = useState(false);
  const campo = <K extends keyof DadosPaciente>(k: K) => (v: DadosPaciente[K]) => setF((x) => ({ ...x, [k]: v }));

  async function salvar() {
    const telefone = (f.telefone_e164 ?? "").replace(/[^\d+]/g, "");
    const e164 = telefone.startsWith("+") ? telefone : `+55${telefone}`;
    if (!/^\+[1-9][0-9]{7,14}$/.test(e164)) { toast.error("Telefone inválido.", { description: "Use DDD e número, ex.: 11 99999-9999." }); return; }
    const cpf = (f.cpf ?? "").replace(/\D/g, "");
    if (cpf && cpf.length !== 11) { toast.error("CPF precisa ter 11 dígitos."); return; }
    setSalvando(true);
    const res = await salvarPaciente(paciente.id, { ...f, telefone_e164: e164, cpf, nascimento: f.nascimento || null });
    setSalvando(false);
    if (!res.sucesso) { toast.error("Não salvou.", { description: res.erro.mensagem }); return; }
    toast.success("Dados atualizados.");
    aoSalvar({ ...paciente, ...res.dados, convenio: convenios.dados?.find((c) => c.id === res.dados.convenio_id) ?? null });
    aoFechar();
  }

  return (
    <Folha titulo="Editar dados" sub="Cadastro do paciente" aoFechar={aoFechar}
      acoes={<><Botao cheio onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Botao><Botao onClick={aoFechar}>Cancelar</Botao></>}>
      <div className="folha__grade">
        <Campo rotulo="Nome completo"><Entrada value={f.nome ?? ""} onChange={(e) => campo("nome")(e.target.value)} autoComplete="off" /></Campo>
        <div className="folha__grade folha__grade--2">
          <Campo rotulo="Telefone (WhatsApp)" dica="Com DDD"><Entrada inputMode="tel" value={f.telefone_e164 ?? ""} onChange={(e) => campo("telefone_e164")(e.target.value)} /></Campo>
          <Campo rotulo="CPF"><Entrada inputMode="numeric" value={f.cpf ?? ""} onChange={(e) => campo("cpf")(e.target.value)} placeholder="000.000.000-00" /></Campo>
        </div>
        <div className="folha__grade folha__grade--2">
          <Campo rotulo="Nascimento"><Entrada type="date" value={f.nascimento ?? ""} onChange={(e) => campo("nascimento")(e.target.value)} /></Campo>
          <Campo rotulo="E-mail"><Entrada type="email" value={f.email ?? ""} onChange={(e) => campo("email")(e.target.value)} /></Campo>
        </div>
        <Campo rotulo="Endereço"><Entrada value={f.endereco ?? ""} onChange={(e) => campo("endereco")(e.target.value)} /></Campo>
        <div className="folha__grade folha__grade--2">
          <Campo rotulo="Convênio">
            <select className="a-entrada a-select" value={f.convenio_id ?? ""} onChange={(e) => campo("convenio_id")(e.target.value || null)}>
              <option value="">Particular</option>
              {(convenios.dados ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Carteirinha"><Entrada value={f.numero_carteirinha ?? ""} onChange={(e) => campo("numero_carteirinha")(e.target.value)} /></Campo>
        </div>
        <Campo rotulo="Observações"><AreaTexto rows={3} value={f.observacoes ?? ""} onChange={(e) => campo("observacoes")(e.target.value)} /></Campo>
        <label className="flex items-center justify-between gap-3 py-1">
          <span className="text-[13px] text-tinta-2">Não receber mensagens automáticas (campanha e IA)</span>
          <Interruptor ligado={!!f.nao_perturbe} aoMudar={campo("nao_perturbe")} rotulo="Não perturbe" />
        </label>
      </div>
    </Folha>
  );
}
