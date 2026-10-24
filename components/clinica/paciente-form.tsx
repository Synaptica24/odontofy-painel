"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listarConvenios, salvarPaciente } from "@/lib/api";
import type { Convenio, DadosPaciente, Paciente } from "@/lib/contratos";
import { Botao, Campo, Entrada, AreaTexto } from "@/components/ui/primitivos";
import { Folha } from "./folha";

/* Cadastro/edição de paciente em folha, com as mesmas seções do Codental:
   dados básicos, contato de emergência, endereço, responsável e convênio.
   Telefone (WhatsApp) vira E.164 (+55…) e é opcional desde que haja outro contato; CPF só dígitos. */

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
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const COMO_CONHECEU = ["Indicação de amigo", "Indicação familiar", "Indicação de outro dentista", "Convênio", "Instagram", "Google", "Site", "Outro"];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="form-secao">
      <legend>{titulo}</legend>
      <div className="folha__grade">{children}</div>
    </fieldset>
  );
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
    telefone_contato: paciente?.telefone_contato ?? "",
    telefone_fixo: paciente?.telefone_fixo ?? "",
    cpf: mascaraCpf(paciente?.cpf ?? ""),
    rg: paciente?.rg ?? "",
    nascimento: paciente?.nascimento ?? "",
    sexo: paciente?.sexo ?? "",
    profissao: paciente?.profissao ?? "",
    email: paciente?.email ?? "",
    emergencia_nome: paciente?.emergencia_nome ?? "",
    emergencia_telefone: paciente?.emergencia_telefone ?? "",
    cep: paciente?.cep ?? "",
    endereco_rua: paciente?.cep || paciente?.bairro || paciente?.cidade ? enderecoRua(paciente) : paciente?.endereco ?? "",
    complemento: paciente?.complemento ?? "",
    bairro: paciente?.bairro ?? "",
    cidade: paciente?.cidade ?? "",
    estado: paciente?.estado ?? "",
    responsavel_nome: paciente?.responsavel_nome ?? "",
    responsavel_documento: paciente?.responsavel_documento ?? "",
    responsavel_nascimento: paciente?.responsavel_nascimento ?? "",
    convenio_id: paciente?.convenio_id ?? "",
    numero_carteirinha: paciente?.numero_carteirinha ?? "",
    convenio_titular: paciente?.convenio_titular ?? "",
    convenio_titular_cpf: mascaraCpf(paciente?.convenio_titular_cpf ?? ""),
    como_conheceu: paciente?.como_conheceu ?? "",
    origem: paciente?.origem ?? "indicacao",
    observacoes: paciente?.observacoes ?? "",
    nao_perturbe: paciente?.nao_perturbe ?? false,
  });
  useEffect(() => { void listarConvenios().then((r) => r.sucesso && setConvenios(r.dados.filter((c) => c.ativo || c.id === paciente?.convenio_id))); }, [paciente?.convenio_id]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const telefone = telefoneParaE164(f.telefone);
    if (telefone && !/^\+[1-9][0-9]{7,14}$/.test(telefone)) { toast.error("Celular inválido.", { description: "Use DDD + número, ex.: 11 99999-9999." }); return; }
    if (!telefone && !f.telefone_contato.trim() && !f.telefone_fixo.trim()) { toast.error("Informe um telefone.", { description: "Celular, telefone de contato ou fixo." }); return; }
    const cpf = f.cpf.replace(/\D/g, "");
    if (cpf && cpf.length !== 11) { toast.error("CPF precisa ter 11 dígitos."); return; }
    const titularCpf = f.convenio_titular_cpf.replace(/\D/g, "");
    if (titularCpf && titularCpf.length !== 11) { toast.error("CPF do titular precisa ter 11 dígitos."); return; }
    setSalvando(true);
    const t = (v: string) => v.trim();
    const dados: DadosPaciente = {
      nome: t(f.nome), telefone_e164: telefone || null, telefone_contato: t(f.telefone_contato), telefone_fixo: t(f.telefone_fixo),
      cpf, rg: t(f.rg), nascimento: f.nascimento || null, sexo: f.sexo as DadosPaciente["sexo"], profissao: t(f.profissao), email: t(f.email),
      emergencia_nome: t(f.emergencia_nome), emergencia_telefone: t(f.emergencia_telefone),
      cep: t(f.cep), complemento: t(f.complemento), bairro: t(f.bairro), cidade: t(f.cidade), estado: f.estado,
      endereco: enderecoCompleto({ rua: t(f.endereco_rua), complemento: t(f.complemento), bairro: t(f.bairro), cidade: t(f.cidade), estado: f.estado, cep: t(f.cep) }),
      responsavel_nome: t(f.responsavel_nome), responsavel_documento: t(f.responsavel_documento), responsavel_nascimento: f.responsavel_nascimento || null,
      convenio_id: f.convenio_id || null, numero_carteirinha: t(f.numero_carteirinha), convenio_titular: t(f.convenio_titular), convenio_titular_cpf: titularCpf,
      como_conheceu: f.como_conheceu, origem: f.origem as Paciente["origem"], observacoes: f.observacoes, nao_perturbe: f.nao_perturbe,
    };
    const r = await salvarPaciente(paciente?.id ?? null, dados);
    setSalvando(false);
    if (!r.sucesso) { toast.error("Não deu para salvar.", { description: r.erro.codigo === "conflito" ? "Já existe paciente com esse celular." : r.erro.mensagem }); return; }
    toast(paciente ? "Dados atualizados" : `${r.dados.nome} cadastrado`);
    aoSalvar({ ...paciente, ...r.dados, convenio: convenios.find((c) => c.id === r.dados.convenio_id) ?? null });
  }
  const m = (campo: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((a) => ({ ...a, [campo]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <Folha titulo={paciente ? "Editar paciente" : "Novo paciente"} aoFechar={aoFechar}>
      <form onSubmit={salvar} className="folha__grade" id="form-paciente">
        <Campo rotulo="Nome completo"><Entrada value={f.nome} onChange={m("nome")} required maxLength={120} autoFocus={!paciente} /></Campo>
        <div className="folha__grade folha__grade--2">
          <Campo rotulo="Celular (WhatsApp)" dica={paciente && !paciente.telefone_e164 && paciente.telefone_contato ? "Número da família está em “Telefone de contato”" : undefined}>
            <Entrada value={f.telefone} onChange={m("telefone")} placeholder="11 99999-9999" inputMode="tel" />
          </Campo>
          <Campo rotulo="Telefone de contato" dica="Quando o celular é de um familiar"><Entrada value={f.telefone_contato} onChange={m("telefone_contato")} inputMode="tel" maxLength={40} /></Campo>
          <Campo rotulo="Telefone fixo"><Entrada value={f.telefone_fixo} onChange={m("telefone_fixo")} inputMode="tel" maxLength={40} /></Campo>
          <Campo rotulo="E-mail"><Entrada type="email" value={f.email} onChange={m("email")} maxLength={160} /></Campo>
          <Campo rotulo="CPF"><Entrada value={f.cpf} onChange={(e) => setF((a) => ({ ...a, cpf: mascaraCpf(e.target.value) }))} placeholder="000.000.000-00" inputMode="numeric" /></Campo>
          <Campo rotulo="RG"><Entrada value={f.rg} onChange={m("rg")} maxLength={30} /></Campo>
          <Campo rotulo="Nascimento"><Entrada type="date" value={f.nascimento} onChange={m("nascimento")} /></Campo>
          <Campo rotulo="Sexo">
            <select className="a-entrada a-select" value={f.sexo} onChange={m("sexo")}>
              <option value="">Não informado</option><option value="feminino">Feminino</option><option value="masculino">Masculino</option><option value="outro">Outro</option>
            </select>
          </Campo>
          <Campo rotulo="Profissão"><Entrada value={f.profissao} onChange={m("profissao")} maxLength={80} /></Campo>
          <Campo rotulo="Como conheceu">
            <select className="a-entrada a-select" value={f.como_conheceu} onChange={m("como_conheceu")}>
              <option value="">Não informado</option>
              {COMO_CONHECEU.map((c) => <option key={c} value={c}>{c}</option>)}
              {f.como_conheceu && !COMO_CONHECEU.includes(f.como_conheceu) && <option value={f.como_conheceu}>{f.como_conheceu}</option>}
            </select>
          </Campo>
        </div>

        <Secao titulo="Contato de emergência">
          <div className="folha__grade folha__grade--2">
            <Campo rotulo="Nome"><Entrada value={f.emergencia_nome} onChange={m("emergencia_nome")} maxLength={120} /></Campo>
            <Campo rotulo="Telefone"><Entrada value={f.emergencia_telefone} onChange={m("emergencia_telefone")} inputMode="tel" maxLength={40} /></Campo>
          </div>
        </Secao>

        <Secao titulo="Endereço">
          <div className="folha__grade folha__grade--2">
            <Campo rotulo="CEP"><Entrada value={f.cep} onChange={m("cep")} inputMode="numeric" placeholder="00000-000" maxLength={9} /></Campo>
            <Campo rotulo="Bairro"><Entrada value={f.bairro} onChange={m("bairro")} maxLength={80} /></Campo>
          </div>
          <Campo rotulo="Endereço com número"><Entrada value={f.endereco_rua} onChange={m("endereco_rua")} maxLength={200} /></Campo>
          <div className="folha__grade folha__grade--2">
            <Campo rotulo="Complemento"><Entrada value={f.complemento} onChange={m("complemento")} maxLength={80} /></Campo>
            <Campo rotulo="Cidade"><Entrada value={f.cidade} onChange={m("cidade")} maxLength={80} /></Campo>
            <Campo rotulo="Estado">
              <select className="a-entrada a-select" value={f.estado} onChange={m("estado")}>
                <option value="">—</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </Campo>
          </div>
        </Secao>

        <Secao titulo="Responsável (menores ou dependentes)">
          <Campo rotulo="Nome do responsável"><Entrada value={f.responsavel_nome} onChange={m("responsavel_nome")} maxLength={120} /></Campo>
          <div className="folha__grade folha__grade--2">
            <Campo rotulo="CPF ou documento"><Entrada value={f.responsavel_documento} onChange={m("responsavel_documento")} maxLength={30} /></Campo>
            <Campo rotulo="Nascimento"><Entrada type="date" value={f.responsavel_nascimento} onChange={m("responsavel_nascimento")} /></Campo>
          </div>
        </Secao>

        <Secao titulo="Convênio">
          <div className="folha__grade folha__grade--2">
            <Campo rotulo="Plano">
              <select className="a-entrada a-select" value={f.convenio_id} onChange={m("convenio_id")}>
                <option value="">Particular</option>
                {convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Carteirinha"><Entrada value={f.numero_carteirinha} onChange={m("numero_carteirinha")} maxLength={40} /></Campo>
            <Campo rotulo="Titular"><Entrada value={f.convenio_titular} onChange={m("convenio_titular")} maxLength={120} placeholder="Se não for o próprio paciente" /></Campo>
            <Campo rotulo="CPF do titular"><Entrada value={f.convenio_titular_cpf} onChange={(e) => setF((a) => ({ ...a, convenio_titular_cpf: mascaraCpf(e.target.value) }))} inputMode="numeric" /></Campo>
          </div>
        </Secao>

        {!paciente && (
          <Campo rotulo="Como chegou">
            <select className="a-entrada a-select" value={f.origem} onChange={m("origem")}>
              <option value="indicacao">Indicação</option><option value="site">Site</option><option value="whatsapp">WhatsApp</option><option value="campanha">Campanha</option>
            </select>
          </Campo>
        )}
        <Campo rotulo="Observações" dica="Cadastrais; a evolução clínica fica na ficha"><AreaTexto value={f.observacoes} onChange={m("observacoes")} rows={3} maxLength={2000} /></Campo>
        <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={f.nao_perturbe} onChange={m("nao_perturbe")} className="h-4 w-4" /> Não quer receber mensagens automáticas (campanha e IA)</label>
        <div className="folha__acoes">
          <Botao type="submit" cheio disabled={salvando}>{salvando ? "Salvando…" : paciente ? "Salvar" : "Cadastrar"}</Botao>
          <Botao onClick={aoFechar}>Cancelar</Botao>
        </div>
      </form>
    </Folha>
  );
}

/* O campo `endereco` é a linha única mostrada na lista e nos contratos; as partes ficam em colunas próprias.
   Ao editar, recuperamos só a rua a partir das partes para não duplicar bairro/cidade/CEP na linha. */
function enderecoCompleto(p: { rua: string; complemento: string; bairro: string; cidade: string; estado: string; cep: string }) {
  const rua = [p.rua, p.complemento].filter(Boolean).join(", ");
  const cidade = [p.cidade, p.estado].filter(Boolean).join("/");
  return [rua, p.bairro, cidade, p.cep ? `CEP ${p.cep}` : ""].filter(Boolean).join(" - ");
}
function enderecoRua(p?: Paciente | null) {
  if (!p?.endereco) return "";
  let rua = p.endereco.split(" - ")[0] ?? "";
  if (p.complemento && rua.endsWith(`, ${p.complemento}`)) rua = rua.slice(0, -(p.complemento.length + 2));
  return rua;
}
