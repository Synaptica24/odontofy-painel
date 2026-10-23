"use client";

import type { Prontuario } from "@/lib/contratos";
import { Bloco, Vazio } from "@/components/ui/primitivos";
import { dataHoraBonita } from "./ficha-util";

const ACAO: Record<string, string> = {
  visualizou: "Abriu a ficha", alterou: "Alterou o prontuário", anexou: "Anexou arquivo", baixou: "Abriu anexo",
  gerou_contrato: "Gerou contrato", assinou_contrato: "Paciente assinou contrato",
};

/* Trilha de acesso (LGPD): quem abriu ou alterou o prontuário, quando e de onde. Somente leitura. */
export function FichaAcessos({ d }: { d: Prontuario }) {
  return (
    <Bloco titulo="Quem acessou esta ficha" id="acessos" lado={`últimos ${d.acessos.length}`} primeiro>
      <p className="text-[13px] text-tinta-2 mb-3">
        Dado de saúde é sensível. A Lei Geral de Proteção de Dados pede registro de quem acessa e altera o prontuário.
        Esta lista é gravada automaticamente e não pode ser apagada.
      </p>
      {d.acessos.length === 0 ? (
        <Vazio titulo="Nenhum acesso registrado ainda." />
      ) : (
        <table className="tabela">
          <thead><tr><th>Quando</th><th>Ação</th><th>Detalhe</th><th>IP</th></tr></thead>
          <tbody>
            {d.acessos.map((a) => (
              <tr key={a.id}>
                <td className="num whitespace-nowrap">{dataHoraBonita(a.criado_em)}</td>
                <td>{ACAO[a.acao] ?? a.acao}{a.user_id ? "" : " (sistema)"}</td>
                <td className="text-tinta-2">{a.detalhe}</td>
                <td className="num text-tinta-3">{a.ip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Bloco>
  );
}
