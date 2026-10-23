"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listarConvenios, salvarPaciente } from "@/lib/api";
import type { Convenio, DadosPaciente, Paciente } from "@/lib/contratos";
import { Botao, Campo, Entrada, AreaTexto } from "@/components/ui/primitivos";
import { Folha } from "./folha";

/* Cadastro/edição de paciente em folha. Telefone vira E.164 (+55…); CPF só dígitos. */

export function telefoneParaE164(bruto: string) {
  const d = bruto.replace(/\D/g, "");
  if (!d) return "";
  if (bruto.trim().startsWith("+")) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if (d.length >= 12 && d.startsWith("55")) return `+${d}`;
  return `+${d}`;
}
export function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function PacienteForm({
  paciente,
  nomeInicial = "",
  aoFechar,
  aoSalvar,
}: {
  paciente?: Paciente | null;
  nomeInicial?: string;
  aoFechar: () => void;
  aoSalvar: (p: Paciente) => void;
}) {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({
    nome: paciente?.nome ?? nomeInicial,
    telefone: paciente?.telefone_e164 ?? "",
    cpf: mascaraCpf(paciente?.cpf ?? ""),
    nascimento: paciente?.nascimento ?? "",
    email: paciente?.email ?? "",
    endereco: paciente?.endereco ?? "",
    convenio_id: paciente?.convenio_id ?? "",
    numero_carteirinha: paciente?.numero_carteirinha ?? "",
    origem: paciente?.origem ?? "indicacao",
    observacoes: paciente?.observacoes ?? "",
    nao_perturbe: paciente?.nao_perturbe ?? false,
  });
  useEffect(() => { void listarConvenios().then((r) => r.sucesso && setConvenios(r.dados.filter((c) => c.ativo))); }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const telefone = telefoneParaE164(f.telefone);
    if (!/^\+[1-9][0-9]{7,14}$/.test(telefone)) { toast.error("Telefone inválido.", { description: "Use DDD + número, ex.: 11 99999-9999." }); return; }
    const cpf = f.cpf.replace(/\D/g, "");
    if (cpf && cpf.length !== 11) { toast.error("CPF precisa ter 11 dígitos."); return; }
    setSalvando(true);
    const dados: DadosPaciente = {
      nome: f.nome.trim(), telefone_e164: telefone, cpf, nascimento: f.nascimento || null, email: f.email.trim(), endereco: f.endereco.trim(),
      convenio_id: f.convenio_id || null, numero_carteirinha: f.numero_carteirinha.trim(), origem: f.origem as Paciente["origem"], observacoes: f.observacoes, nao_perturbe: f.nao_perturbe,
    };
    const r = await salvarPaciente(paciente?.id ?? null, dados);
    setSalvando(false);
    if (!r.sucesso) { toast.error("Não deu para salvar.", { description: r.erro.codigo === "conflito" ? "Já existe paciente com esse telefone." : r.erro.mensagem }); return; }
    toast(paciente ? "Dados atualizados" : `${r.dados.nome} cadastrado`);
    aoSalvar({ ...r.dados, convenio: convenios.find((c) => c.id === r.dados.convenio_id) ?? null });
  }
  const m = (campo: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((a) => ({ ...a, [campo]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <Folha titulo={paciente ? "Editar paciente" : "Novo paciente"} aoFechar={aoFechar}>
      <form onSubmit={salvar} className="folha__grade" id="form-paciente">
        <Campo rotulo="Nome completo"><Entrada value={f.nome} onChange={m("nome")} required maxLength={120} autoFocus={!paciente} /></Campo>
        <div className="folha__grade folha__grade--2">
          <Campo rotulo="Celular (WhatsApp)"><Entrada value={f.telefone} onChange={m("telefone")} required placeholder="11 99999-9999" inputMode="tel" /></Campo>
          <Campo rotulo="CPF"><Entrada value={f.cpf} onChange={(e) => setF((a) => ({ ...a, cpf: mascaraCpf(e.target.value) }))} placeholder="000.000.000-00" inputMode="numeric" /></Campo>
          <Campo rotulo="Nascimento"><Entrada type="date" value={f.nascimento} onChange={m("nascimento")} /></Campo>
          <Campo rotulo="E-mail"><Entrada type="email" value={f.email} onChange={m("email")} maxLength={160} /></Campo>
          <Campo rotulo="Convênio">
            <select className="a-entrada a-select" value={f.convenio_id} onChange={m("convenio_id")}>
              <option value="">Particular</option>
              {convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Carteirinha"><Entrada value={f.numero_carteirinha} onChange={m("numero_carteirinha")} maxLength={40} /></Campo>
        </div>
        <Campo rotulo="Endereço"><Entrada value={f.endereco} onChange={m("endereco")} maxLength={200} /></Campo>
        <Campo rotulo="Como chegou">
          <select className="a-entrada a-select" value={f.origem} onChange={m("origem")}>
            <option value="indicacao">Indicação</option><option value="site">Site</option><option value="whatsapp">WhatsApp</option><option value="campanha">Campanha</option>
          </select>
        </Campo>
        <Campo rotulo="Observações"><AreaTexto value={f.observacoes} onChange={m("observacoes")} rows={3} maxLength={2000} /></Campo>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={f.nao_perturbe} onChange={m("nao_perturbe")} className="h-4 w-4" /> Não quer receber mensagens</label>
        <div className="folha__acoes">
          <Botao type="submit" cheio disabled={salvando}>{salvando ? "Salvando…" : paciente ? "Salvar" : "Cadastrar"}</Botao>
          <Botao onClick={aoFechar}>Cancelar</Botao>
        </div>
      </form>
    </Folha>
  );
}
