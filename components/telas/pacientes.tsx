"use client";

import { useState } from "react";
import { listarPacientes } from "@/lib/api";
import { useApi } from "@/components/dados/use-api";
import { diaCurto, quando, telefoneBonito } from "@/components/dados/datas";
import {
  Bloco,
  Cabecalho,
  Entrada,
  Erro,
  Item,
  Linha,
  Lista,
  OssoLinha,
  Pagina,
  Vazio,
} from "@/components/ui/primitivos";

const ORIGEM: Record<string, string> = {
  whatsapp: "veio pelo WhatsApp",
  site: "veio pelo site",
  campanha: "voltou pela campanha",
  indicacao: "veio por indicação",
};
const STATUS: Record<string, string> = {
  novo: "contato novo",
  em_conversa: "em conversa",
  agendado: "agendado",
  paciente: "paciente",
  fora_da_base: "fora da base",
};

export function TelaPacientes() {
  const [busca, setBusca] = useState("");
  const r = useApi(() => listarPacientes(busca.trim() || undefined), [busca.trim()]);
  const lista = r.dados;

  return (
    <Pagina>
      <Cabecalho titulo="Pacientes" />
      <div className="mt-3">
        <Entrada
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome ou telefone"
          aria-label="Procurar paciente"
        />
      </div>
      {r.fase === "erro" && !lista && <Erro mensagem={r.erro} tentar={r.recarregar} />}
      <Bloco primeiro titulo={busca ? "Resultado" : "Todos"} id="lista-pacientes" lado={lista && lista.length > 0 ? lista.length : undefined}>
        {!lista ? (
          <OssoLinha n={6} />
        ) : lista.length === 0 ? (
          <Vazio titulo={busca ? "Ninguém com esse nome." : "Nenhum paciente ainda."} icone={<span className="marca" />} />
        ) : (
          <Lista>
            {lista.map((p) => (
              <Item key={p.id}>
                <Linha
                  marca={p.status === "em_conversa" ? "ia" : p.status === "agendado" ? "voce" : "nada"}
                  href={`/pacientes/${p.id}`}
                  titulo={p.nome}
                  sub={
                    <>
                      {telefoneBonito(p.telefone_e164)} · {STATUS[p.status] ?? p.status}
                      <span className="tabela-linha__extra">
                        {" · "}
                        {ORIGEM[p.origem] ?? p.origem} · primeiro contato {diaCurto(p.primeiro_contato)}
                        {p.nao_perturbe ? " · não quer mensagens" : ""}
                      </span>
                    </>
                  }
                  lado={<span className="a-linha__meta num">último contato {quando(p.ultimo_contato)}</span>}
                />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>
    </Pagina>
  );
}
