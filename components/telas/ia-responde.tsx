"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { alternarConhecimento, excluirConhecimento, listarConhecimento, salvarConhecimento } from "@/lib/api";
import type { ItemConhecimento } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import {
  AreaTexto,
  Bloco,
  Botao,
  Cabecalho,
  Campo,
  Entrada,
  Erro,
  Interruptor,
  OssoLinha,
  Pagina,
  Vazio,
} from "@/components/ui/primitivos";

export function TelaIaResponde() {
  const r = useApi(() => listarConhecimento(), []);
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  const [busca, setBusca] = useState("");

  const lista = r.dados;
  const filtrada =
    lista?.filter((i) => {
      const q = busca.trim().toLocaleLowerCase("pt-BR");
      if (!q) return true;
      return (
        i.pergunta.toLocaleLowerCase("pt-BR").includes(q) ||
        i.resposta.toLocaleLowerCase("pt-BR").includes(q) ||
        i.palavras_chave.some((p) => p.toLocaleLowerCase("pt-BR").includes(q))
      );
    }) ?? [];

  async function alternar(item: ItemConhecimento, ativo: boolean) {
    r.definir((l) => l.map((i) => (i.id === item.id ? { ...i, ativo } : i)));
    const res = await alternarConhecimento(item.id, ativo);
    if (!res.sucesso) {
      r.definir((l) => l.map((i) => (i.id === item.id ? { ...i, ativo: !ativo } : i)));
      toast.error("Não deu para mudar.", { description: res.erro.mensagem });
      return;
    }
    toast(ativo ? "A IA voltou a usar essa resposta" : "A IA parou de usar essa resposta", {
      action: { label: "Desfazer", onClick: () => void alternar(item, !ativo) },
    });
  }

  async function excluir(item: ItemConhecimento) {
    const antes = r.dados ?? [];
    r.definir((l) => l.filter((i) => i.id !== item.id));
    setEditando(null);
    const res = await excluirConhecimento(item.id);
    if (!res.sucesso) {
      r.definir(() => antes);
      toast.error("Não deu para excluir.", { description: res.erro.mensagem });
      return;
    }
    toast("Resposta excluída", {
      action: {
        label: "Desfazer",
        onClick: async () => {
          const volta = await salvarConhecimento({ pergunta: item.pergunta, resposta: item.resposta, palavras_chave: item.palavras_chave, ativo: item.ativo });
          if (volta.sucesso) r.definir((l) => [volta.dados, ...l]);
        },
      },
    });
  }

  async function salvar(dados: { id?: string; pergunta: string; resposta: string; palavras_chave: string[]; ativo: boolean }) {
    const res = await salvarConhecimento(dados);
    if (!res.sucesso) {
      toast.error("Não salvou.", { description: `${res.erro.mensagem} O que você escreveu continua aí.` });
      return false;
    }
    r.definir((l) => (dados.id ? l.map((i) => (i.id === dados.id ? res.dados : i)) : [res.dados, ...l]));
    setEditando(null);
    toast(dados.id ? "Resposta atualizada" : "A IA já pode usar essa resposta");
    return true;
  }

  return (
    <Pagina>
      <Cabecalho
        titulo="O que a IA responde"
        abaixo="Pergunta do paciente, resposta da IA. Mude aqui e vale na próxima mensagem."
        acao={
          <Botao cheio onClick={() => setEditando("novo")} disabled={editando === "novo"}>
            <Plus size={16} strokeWidth={2.5} aria-hidden className="-ml-0.5 mr-1 inline" />
            Nova
          </Botao>
        }
      />

      {editando === "novo" && (
        <Editor
          inicial={{ pergunta: "", resposta: "", palavras_chave: [], ativo: true }}
          aoCancelar={() => setEditando(null)}
          aoSalvar={(v) => salvar(v)}
        />
      )}

      <div className="mt-3">
        <Entrada
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar uma pergunta ou palavra"
          aria-label="Procurar"
        />
      </div>

      {r.fase === "erro" && !lista && <Erro mensagem={r.erro} tentar={r.recarregar} />}

      <Bloco primeiro titulo="Perguntas" id="lista-perguntas" lado={lista && lista.length > 0 ? `${lista.filter((i) => i.ativo).length} ativas` : undefined}>
        {!lista ? (
          <OssoLinha n={4} />
        ) : lista.length === 0 ? (
          <Vazio titulo="A IA ainda não tem respostas suas." sub="Toque em Nova e escreva a primeira." icone={<span className="marca" />} />
        ) : filtrada.length === 0 ? (
          <Vazio titulo="Nada com essa palavra." icone={<span className="marca" />} />
        ) : (
          <ul className="a-lista">
            {filtrada.map((item) => (
              <li key={item.id} className="entra">
                {editando === item.id ? (
                  <Editor
                    inicial={item}
                    aoCancelar={() => setEditando(null)}
                    aoSalvar={(v) => salvar({ ...v, id: item.id })}
                    aoExcluir={() => excluir(item)}
                  />
                ) : (
                  <div className={`a-resposta ${item.ativo ? "" : "a-resposta--off"}`}>
                    <button type="button" className="a-resposta__corpo pressa" onClick={() => setEditando(item.id)}>
                      <span className="a-resposta__pergunta">{item.pergunta}</span>
                      <span className="a-resposta__texto">{item.resposta}</span>
                      {item.palavras_chave.length > 0 && (
                        <span className="a-resposta__chaves">{item.palavras_chave.join(" · ")}</span>
                      )}
                    </button>
                    <Interruptor
                      ligado={item.ativo}
                      aoMudar={(v) => void alternar(item, v)}
                      rotulo={item.ativo ? "A IA usa essa resposta" : "A IA não usa essa resposta"}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    </Pagina>
  );
}

function Editor({
  inicial,
  aoCancelar,
  aoSalvar,
  aoExcluir,
}: {
  inicial: { pergunta: string; resposta: string; palavras_chave: string[]; ativo: boolean };
  aoCancelar: () => void;
  aoSalvar: (v: { pergunta: string; resposta: string; palavras_chave: string[]; ativo: boolean }) => Promise<boolean>;
  aoExcluir?: () => void;
}) {
  const [pergunta, setPergunta] = useState(inicial.pergunta);
  const [resposta, setResposta] = useState(inicial.resposta);
  const [chaves, setChaves] = useState(inicial.palavras_chave.join(", "));
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="a-form entra"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        await aoSalvar({
          pergunta: pergunta.trim(),
          resposta: resposta.trim(),
          palavras_chave: chaves.split(",").map((s) => s.trim()).filter(Boolean),
          ativo: inicial.ativo,
        });
        setEnviando(false);
      }}
    >
      <Campo rotulo="Quando o paciente pergunta">
        <Entrada value={pergunta} onChange={(e) => setPergunta(e.target.value)} placeholder="Ex.: Vocês atendem convênio?" required autoFocus />
      </Campo>
      <Campo rotulo="A IA responde">
        <AreaTexto rows={4} value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Escreva como você falaria" required />
      </Campo>
      <Campo rotulo="Palavras que puxam essa resposta" dica="Separe por vírgula. Opcional.">
        <Entrada value={chaves} onChange={(e) => setChaves(e.target.value)} placeholder="convênio, plano, unimed" />
      </Campo>
      <div className="mt-2 flex items-center justify-between gap-1.5">
        {aoExcluir ? (
          <Botao alerta onClick={aoExcluir}>Excluir</Botao>
        ) : (
          <span />
        )}
        <span className="flex gap-1.5">
          <Botao onClick={aoCancelar}>Cancelar</Botao>
          <Botao cheio type="submit" disabled={enviando || !pergunta.trim() || !resposta.trim()}>
            Salvar
          </Botao>
        </span>
      </div>
    </form>
  );
}
