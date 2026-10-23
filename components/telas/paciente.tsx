"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, Pencil } from "lucide-react";
import { prontuario } from "@/lib/api";
import type { Prontuario } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { telefoneBonito } from "@/components/dados/datas";
import { Botao, Cabecalho, Erro, OssoLinha, Pagina } from "@/components/ui/primitivos";
import { Chip, ChipCor, cpfBonito, idade, linkWhatsApp } from "@/components/clinica/ficha-util";
import { FichaDados } from "@/components/clinica/ficha-dados";
import { FichaResumo } from "@/components/clinica/ficha-resumo";
import { FichaAnamnese, alertasAnamnese } from "@/components/clinica/ficha-anamnese";
import { FichaOdontograma } from "@/components/clinica/ficha-odontograma";
import { FichaEvolucao } from "@/components/clinica/ficha-evolucao";
import { FichaAnexos } from "@/components/clinica/ficha-anexos";
import { FichaOrcamentos, type VariaveisContrato } from "@/components/clinica/ficha-orcamentos";
import { FichaContratos } from "@/components/clinica/ficha-contratos";
import { FichaConsultas } from "@/components/clinica/ficha-consultas";
import { FichaAcessos } from "@/components/clinica/ficha-acessos";

/* Ficha do paciente = prontuário completo em abas. Uma chamada (prontuario) traz tudo; as abas
   editam em cima do mesmo objeto (definir) para a tela nunca pular. */

type Aba = "resumo" | "anamnese" | "odontograma" | "evolucao" | "anexos" | "orcamentos" | "contratos" | "consultas" | "acessos";
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "resumo", rotulo: "Resumo" }, { valor: "anamnese", rotulo: "Anamnese" }, { valor: "odontograma", rotulo: "Odontograma" },
  { valor: "evolucao", rotulo: "Evolução" }, { valor: "anexos", rotulo: "Anexos" }, { valor: "orcamentos", rotulo: "Orçamentos" },
  { valor: "contratos", rotulo: "Contratos" }, { valor: "consultas", rotulo: "Consultas" }, { valor: "acessos", rotulo: "Acessos" },
];
const STATUS: Record<string, string> = { novo: "Contato novo", em_conversa: "Em conversa", agendado: "Agendado", paciente: "Paciente", fora_da_base: "Fora da base" };

export function TelaPaciente({ id }: { id: string }) {
  const r = useApi<Prontuario>(() => prontuario(id), [id]);
  const [aba, setAba] = useState<Aba>("resumo");
  const [editando, setEditando] = useState(false);
  const [variaveisContrato, setVariaveisContrato] = useState<VariaveisContrato | null>(null);
  const d = r.dados;

  // aba vinda da URL (#anamnese etc.) e guardada ao trocar
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const h = window.location.hash.replace("#", "") as Aba;
      if (ABAS.some((a) => a.valor === h)) setAba(h);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);
  function trocar(a: Aba) {
    setAba(a);
    window.history.replaceState(null, "", `#${a}`);
  }

  const contagem = (a: Aba) => {
    if (!d) return null;
    switch (a) {
      case "odontograma": return d.odontograma.filter((i) => i.status === "planejado").length || null;
      case "evolucao": return d.evolucoes.length || null;
      case "anexos": return d.anexos.length || null;
      case "orcamentos": return d.orcamentos.filter((o) => o.status === "pendente").length || null;
      case "contratos": return d.contratos.filter((c) => c.status === "enviado").length || null;
      default: return null;
    }
  };
  const anos = d ? idade(d.paciente.nascimento) : null;
  const alertas = d ? alertasAnamnese(d.anamnese) : [];

  return (
    <Pagina className="ficha">
      <Link href="/pacientes" className="a-voltar pressa">
        <ArrowLeft size={18} strokeWidth={2} aria-hidden /> Pacientes
      </Link>
      {d ? (
        <Cabecalho
          titulo={d.paciente.nome}
          sobre={
            <>
              <a className="num underline-offset-2 hover:underline" href={`tel:${d.paciente.telefone_e164}`}>{telefoneBonito(d.paciente.telefone_e164)}</a>
              {anos !== null && ` · ${anos} anos`}
              {d.paciente.cpf && ` · CPF ${cpfBonito(d.paciente.cpf)}`}
            </>
          }
          acao={
            <div className="ficha__acoes">
              <a className="a-botao pressa inline-flex items-center gap-1.5" target="_blank" rel="noopener" href={linkWhatsApp(d.paciente.telefone_e164)} aria-label="Abrir conversa no WhatsApp">
                <MessageCircle size={16} /> <span className="ficha__acao-texto">WhatsApp</span>
              </a>
              <Botao onClick={() => setEditando(true)}><Pencil size={16} /> <span className="ficha__acao-texto">Editar dados</span></Botao>
            </div>
          }
        />
      ) : (
        <div className="pt-2" aria-hidden>
          <span className="osso block h-4 w-40" />
          <span className="osso mt-2 block h-7 w-56" />
        </div>
      )}
      {d && (
        <div className="ficha__chips">
          <Chip cor={d.paciente.status === "paciente" ? "verde" : d.paciente.status === "agendado" ? "azul" : "cinza"}>{STATUS[d.paciente.status] ?? d.paciente.status}</Chip>
          {d.paciente.convenio ? <ChipCor cor={d.paciente.convenio.cor}>{d.paciente.convenio.nome}{d.paciente.numero_carteirinha ? ` · ${d.paciente.numero_carteirinha}` : ""}</ChipCor> : <Chip>Particular</Chip>}
          {d.paciente.nao_perturbe && <Chip cor="vermelho">Não perturbe</Chip>}
          {alertas.filter((a) => a.cor === "vermelho").map((a) => <Chip key={a.texto} cor="vermelho">{a.texto}</Chip>)}
        </div>
      )}
      {r.fase === "erro" && !d && <Erro mensagem={r.erro} tentar={r.recarregar} />}

      <div className="ficha__abas" role="tablist" aria-label="Seções da ficha">
        {ABAS.map((a) => {
          const n = contagem(a.valor);
          return (
            <button key={a.valor} type="button" role="tab" aria-selected={aba === a.valor} className="ficha__aba pressa" onClick={() => trocar(a.valor)}>
              {a.rotulo}{n ? <span className="num">{n}</span> : null}
            </button>
          );
        })}
      </div>

      {!d ? (
        <section className="a-bloco a-bloco--primeiro"><OssoLinha n={4} /></section>
      ) : (
        <div key={aba} className="ficha__painel" role="tabpanel">
          {aba === "resumo" && <FichaResumo d={d} definir={r.definir} irPara={(a) => trocar(a)} />}
          {aba === "anamnese" && <FichaAnamnese d={d} definir={r.definir} />}
          {aba === "odontograma" && <FichaOdontograma d={d} definir={r.definir} />}
          {aba === "evolucao" && <FichaEvolucao d={d} definir={r.definir} />}
          {aba === "anexos" && <FichaAnexos d={d} definir={r.definir} />}
          {aba === "orcamentos" && <FichaOrcamentos d={d} definir={r.definir} aoGerarContrato={(v) => { setVariaveisContrato(v); trocar("contratos"); }} />}
          {aba === "contratos" && <FichaContratos d={d} definir={r.definir} variaveisIniciais={variaveisContrato} aoConsumirVariaveis={() => setVariaveisContrato(null)} />}
          {aba === "consultas" && <FichaConsultas d={d} />}
          {aba === "acessos" && <FichaAcessos d={d} />}
        </div>
      )}

      {d && editando && (
        <FichaDados paciente={d.paciente} aoFechar={() => setEditando(false)} aoSalvar={(p) => r.definir((x) => ({ ...x, paciente: p }))} />
      )}
    </Pagina>
  );
}
