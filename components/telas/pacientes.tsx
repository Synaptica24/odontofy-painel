"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { listarPacientes } from "@/lib/api";
import type { Paciente } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { diaCurto, hora, quando, telefoneBonito } from "@/components/dados/datas";
import { Bloco, Botao, Cabecalho, Entrada, Erro, Item, Linha, Lista, OssoLinha, Pagina, Vazio } from "@/components/ui/primitivos";
import { PacienteForm } from "@/components/clinica/paciente-form";

const ORIGEM: Record<string, string> = { whatsapp: "veio pelo WhatsApp", site: "veio pelo site", campanha: "voltou pela campanha", indicacao: "veio por indicação" };
const STATUS: Record<string, string> = { novo: "contato novo", em_conversa: "em conversa", agendado: "agendado", paciente: "paciente", fora_da_base: "fora da base" };

export function TelaPacientes() {
  return (
    <Suspense fallback={null}>
      <Pacientes />
    </Suspense>
  );
}

function Pacientes() {
  const params = useSearchParams();
  const router = useRouter();
  const [busca, setBusca] = useState(params.get("busca") ?? "");
  const [novo, setNovo] = useState(false);
  const r = useApi(() => listarPacientes(busca.trim() || undefined), [busca.trim()]);
  const lista = r.dados;

  function cadastrado(p: Paciente) {
    setNovo(false);
    r.definir((atual) => [p, ...atual]);
    router.push(`/pacientes/${p.id}`);
  }

  return (
    <Pagina>
      <Cabecalho titulo="Pacientes" acao={<Botao cheio onClick={() => setNovo(true)}><Plus size={16} aria-hidden /> Novo paciente</Botao>} />
      <div className="mt-3">
        <Entrada type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, telefone ou CPF" aria-label="Procurar paciente" />
      </div>
      {r.fase === "erro" && !lista && <Erro mensagem={r.erro} tentar={r.recarregar} />}
      <Bloco primeiro titulo={busca ? "Resultado" : "Todos"} id="lista-pacientes" lado={lista && lista.length > 0 ? lista.length : undefined}>
        {!lista ? (
          <OssoLinha n={6} />
        ) : lista.length === 0 ? (
          <Vazio
            titulo={busca ? "Ninguém com esse nome." : "Nenhum paciente ainda."}
            sub={!busca ? <Botao className="ml-2" onClick={() => setNovo(true)}>Cadastrar o primeiro</Botao> : <Botao className="ml-2" onClick={() => setNovo(true)}>Cadastrar “{busca.trim()}”</Botao>}
            icone={<span className="marca" />}
          />
        ) : (
          <Lista>
            {lista.map((p) => (
              <Item key={p.id}>
                <Linha
                  marca={p.status === "em_conversa" ? "ia" : p.status === "agendado" ? "voce" : "nada"}
                  href={`/pacientes/${p.id}`}
                  titulo={
                    <>
                      {p.nome}
                      {p.convenio && <span className="chip chip--cor ml-2 align-middle" style={{ background: p.convenio.cor }}>{p.convenio.nome}</span>}
                    </>
                  }
                  sub={
                    <>
                      {telefoneBonito(p.telefone_e164)} · {STATUS[p.status] ?? p.status}
                      <span className="tabela-linha__extra">
                        {" · "}{ORIGEM[p.origem] ?? p.origem} · primeiro contato {diaCurto(p.primeiro_contato)}
                        {p.nao_perturbe ? " · não quer mensagens" : ""}
                      </span>
                    </>
                  }
                  lado={
                    <span className="a-linha__meta num">
                      {p.proximo_agendamento ? `próxima ${diaCurto(p.proximo_agendamento.inicio)} ${hora(p.proximo_agendamento.inicio)}` : `último contato ${quando(p.ultimo_contato)}`}
                    </span>
                  }
                />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>
      {novo && <PacienteForm nomeInicial={lista && lista.length === 0 ? busca.trim() : ""} aoFechar={() => setNovo(false)} aoSalvar={cadastrado} />}
    </Pagina>
  );
}
