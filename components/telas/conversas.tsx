"use client";

import { useEffect, useState } from "react";
import { inscreverEmConversas, listarConversas } from "@/lib/api";
import type { ResumoConversa, StatusConversa } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { quando } from "@/components/dados/datas";
import {
  Abas,
  Bloco,
  Cabecalho,
  Erro,
  Item,
  Linha,
  Lista,
  Marca,
  OssoLinha,
  Pagina,
  Vazio,
} from "@/components/ui/primitivos";
import { TelaConversa } from "./conversa";

type Filtro = "escalada" | "ativa" | "todas";

function marcaDe(c: ResumoConversa) {
  if (c.status === "escalada") return "escalada" as const;
  if (c.status === "assumida") return "voce" as const;
  if (c.status === "encerrada") return "feito" as const;
  return "ia" as const;
}

function quemResponde(c: ResumoConversa) {
  if (c.status === "escalada") return c.urgente ? "Urgente · esperando você" : "Esperando você";
  if (c.status === "assumida") return "Você está respondendo";
  if (c.status === "encerrada") return "Encerrada";
  return "IA respondendo";
}

export function TelaConversas({ idAberta }: { idAberta?: string }) {
  const [filtro, setFiltro] = useState<Filtro>(idAberta ? "todas" : "escalada");
  const statusFiltro: StatusConversa | "todas" = filtro === "todas" ? "todas" : filtro;
  const r = useApi(() => listarConversas({ status: statusFiltro, limite: 100 }), [statusFiltro]);

  useEffect(() => {
    const cancelar = inscreverEmConversas((res) => {
      if (!res.sucesso) return;
      r.definir(() =>
        res.dados.filter((c) => (statusFiltro === "todas" ? true : c.status === statusFiltro)),
      );
    });
    return cancelar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFiltro]);

  const lista = r.dados;
  const escaladas = lista?.filter((c) => c.status === "escalada").length ?? 0;

  return (
    <div className={`mestre-detalhe ${idAberta ? "mestre-detalhe--aberta" : ""}`}>
      <div className="mestre-detalhe__lista">
        <Pagina>
          <Cabecalho titulo="Conversas" />
          <div className="mt-3">
            <Abas
              valor={filtro}
              aoMudar={setFiltro}
              opcoes={[
                { valor: "escalada", rotulo: escaladas > 0 ? `Esperando você · ${escaladas}` : "Esperando você" },
                { valor: "ativa", rotulo: "Com a IA" },
                { valor: "todas", rotulo: "Todas" },
              ]}
            />
          </div>

          {r.fase === "erro" && !lista && <Erro mensagem={r.erro} tentar={r.recarregar} />}

          <Bloco
            primeiro
            titulo={filtro === "escalada" ? "Quem espera" : filtro === "ativa" ? "Em andamento" : "Histórico"}
            id="lista-conversas"
            lado={lista && lista.length > 0 ? lista.length : undefined}
          >
            {!lista ? (
              <OssoLinha n={5} />
            ) : lista.length === 0 ? (
              filtro === "escalada" ? (
                <Vazio titulo="Ninguém esperando você." sub="A IA está dando conta." />
              ) : filtro === "ativa" ? (
                <Vazio titulo="Nenhuma conversa em andamento agora." />
              ) : (
                <Vazio titulo="Nenhuma conversa ainda." sub="Quando alguém escrever no WhatsApp, aparece aqui." />
              )
            ) : (
              <Lista>
                {lista.map((c) => (
                  <Item key={c.id}>
                    <Linha
                      marca={marcaDe(c)}
                      alerta={c.status === "escalada"}
                      href={`/conversas/${c.id}`}
                      className={c.id === idAberta ? "a-linha--ativa" : ""}
                      titulo={c.paciente.nome}
                      sub={c.ultima_mensagem?.texto ?? c.motivo_escalonamento ?? "Sem mensagens"}
                      meta={quemResponde(c)}
                      lado={
                        <span className="a-linha__meta num">
                          {quando(c.ultima_mensagem?.criada_em ?? c.iniciada_em)}
                        </span>
                      }
                    />
                  </Item>
                ))}
              </Lista>
            )}
          </Bloco>
        </Pagina>
      </div>

      <div className="mestre-detalhe__detalhe">
        {idAberta ? (
          <TelaConversa id={idAberta} />
        ) : (
          <div className="mestre-detalhe__vazio">
            <span className="flex items-center gap-3">
              <Marca tipo="ia" />
              Escolha uma conversa ao lado.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
