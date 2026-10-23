"use client";

import { useEffect, useState } from "react";
import { listarPacientes } from "@/lib/api";
import type { Paciente } from "@/lib/contratos";
import { telefoneBonito } from "@/components/dados/datas";
import { Entrada } from "@/components/ui/primitivos";

/* Campo de busca que vira seleção de paciente. Usado na nova consulta e no retorno. */
export function BuscaPaciente({
  valor,
  aoEscolher,
  aoCriarNovo,
  autoFoco,
}: {
  valor: Paciente | null;
  aoEscolher: (p: Paciente | null) => void;
  aoCriarNovo?: (termo: string) => void;
  autoFoco?: boolean;
}) {
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState<Paciente[] | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const t = termo.trim();
    const id = window.setTimeout(() => {
      if (t.length < 2) { setLista(null); setCarregando(false); return; }
      setCarregando(true);
      void listarPacientes(t).then((r) => { setLista(r.sucesso ? r.dados.slice(0, 8) : []); setCarregando(false); });
    }, t.length < 2 ? 0 : 180);
    return () => window.clearTimeout(id);
  }, [termo]);

  if (valor) {
    return (
      <div className="a-linha a-linha--toque" style={{ paddingLeft: 0 }}>
        <span className="marca marca--voce" aria-hidden />
        <div className="min-w-0">
          <div className="a-linha__nome">{valor.nome}</div>
          <div className="a-linha__sub">{telefoneBonito(valor.telefone_e164)}{valor.convenio ? ` · ${valor.convenio.nome}` : ""}</div>
        </div>
        <button type="button" className="a-botao pressa" onClick={() => aoEscolher(null)}>Trocar</button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <Entrada
        type="search"
        value={termo}
        autoFocus={autoFoco}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Nome, telefone ou CPF"
        aria-label="Buscar paciente"
      />
      {lista && (
        <div className="busca-lista" role="listbox">
          {lista.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={false} onClick={() => aoEscolher(p)}>
              {p.nome}
              <small>{telefoneBonito(p.telefone_e164)}{p.convenio ? ` · ${p.convenio.nome}` : ""}</small>
            </button>
          ))}
          {lista.length === 0 && !carregando && (
            <button type="button" onClick={() => aoCriarNovo?.(termo.trim())} disabled={!aoCriarNovo}>
              Ninguém com esse nome.
              <small>{aoCriarNovo ? `Cadastrar “${termo.trim()}” agora` : "Cadastre em Pacientes."}</small>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
