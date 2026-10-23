"use client";

import { toast } from "sonner";
import { Pause, Play } from "lucide-react";
import { pausarCampanha, retomarCampanha, statusCampanha } from "@/lib/api";
import { useApi } from "@/components/dados/use-api";
import { quando } from "@/components/dados/datas";
import { Bloco, Botao, Cabecalho, Erro, Item, Linha, Lista, OssoLinha, Pagina, Vazio } from "@/components/ui/primitivos";

const ROTULO: Record<string, string> = {
  fila: "na fila",
  enviada: "enviada",
  respondida: "respondeu",
  erro: "deu erro",
  bloqueada: "não quer receber",
};

export function TelaCampanha() {
  const r = useApi(() => statusCampanha(), []);
  const d = r.dados;

  async function alternar() {
    if (!d) return;
    const pausar = !d.pausada;
    r.definir((x) => ({ ...x, pausada: pausar }));
    const res = pausar ? await pausarCampanha() : await retomarCampanha();
    if (!res.sucesso) {
      r.definir((x) => ({ ...x, pausada: !pausar }));
      toast.error(pausar ? "Não deu para pausar." : "Não deu para retomar.", { description: res.erro.mensagem });
      return;
    }
    toast(pausar ? "Campanha pausada. Nenhuma mensagem sai até você retomar." : "Campanha retomada.", {
      action: { label: "Desfazer", onClick: () => void alternar() },
    });
  }

  const enviosOrdenados = d ? [...d.envios].sort((a, b) => (b.enviada_em ?? "").localeCompare(a.enviada_em ?? "")) : [];
  const ultimaLeva = d && d.envios.length ? Math.max(...d.envios.map((e) => e.leva)) : null;

  return (
    <Pagina className="a-pagina--com-fixo">
      <Cabecalho
        titulo="Campanha de retorno"
        abaixo={d ? `${d.total} ${d.total === 1 ? "pessoa" : "pessoas"} sem consulta há mais de 6 meses${ultimaLeva ? ` · leva ${ultimaLeva}` : ""}` : "…"}
      />

      {r.fase === "erro" && !d && <Erro mensagem={r.erro} tentar={r.recarregar} />}

      <Bloco primeiro>
        {!d ? (
          <div className="grid grid-cols-2 gap-3" aria-hidden>
            <span className="osso h-20" />
            <span className="osso h-20" />
          </div>
        ) : (
          <div className="a-contagem">
            <p className="a-contagem--destaque">
              <b className="num">{d.agendadas}</b> {d.agendadas === 1 ? "pessoa voltou a marcar." : "pessoas voltaram a marcar."}
            </p>
            <p>
              <b className="num">{d.fila}</b> na fila · <b className="num">{d.enviadas}</b> enviadas ·{" "}
              <b className="num">{d.respondidas}</b> responderam
            </p>
            <p>
              <b className="num">{d.erro}</b> deram erro · <b className="num">{d.bloqueadas}</b> não querem receber
            </p>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Últimos envios" id="envios">
        {!d ? (
          <OssoLinha n={4} />
        ) : enviosOrdenados.length === 0 ? (
          <Vazio titulo="Nenhum envio ainda." sub="A primeira leva aparece aqui quando sair." icone={<span className="marca" />} />
        ) : (
          <Lista>
            {enviosOrdenados.slice(0, 40).map((e) => (
              <Item key={e.id}>
                <Linha
                  marca={e.status === "respondida" ? "ia" : e.status === "erro" ? "falta" : e.status === "enviada" ? "feito" : "nada"}
                  href={`/pacientes/${e.paciente_id}`}
                  titulo={<span className="num">Leva {e.leva}</span>}
                  sub={`${ROTULO[e.status] ?? e.status}${e.erro ? ` · ${e.erro}` : ""}`}
                  lado={<span className="a-linha__meta num">{e.enviada_em ? quando(e.enviada_em) : ""}</span>}
                />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>

      {d && (
        <div className="a-fixo-baixo">
          <Botao grande cheio={!d.pausada} alerta={false} onClick={() => void alternar()} className="w-full">
            {d.pausada ? (
              <>
                <Play size={18} strokeWidth={2.25} aria-hidden className="mr-1.5 inline" />
                Retomar campanha
              </>
            ) : (
              <>
                <Pause size={18} strokeWidth={2.25} aria-hidden className="mr-1.5 inline" />
                Pausar campanha
              </>
            )}
          </Botao>
        </div>
      )}
    </Pagina>
  );
}
