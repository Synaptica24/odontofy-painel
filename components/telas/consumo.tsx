"use client";

import Link from "next/link";
import { consumoDoMes } from "@/lib/api";
import { useApi } from "@/components/dados/use-api";
import { diaCurto, dolares, hora, mesPorExtenso, reais } from "@/components/dados/datas";
import { Bloco, Cabecalho, Erro, Pagina } from "@/components/ui/primitivos";

export function TelaConsumo() {
  const r = useApi(() => consumoDoMes(), []);
  const d = r.dados;
  const temTeto = !!d && d.teto_brl > 0;
  const gasto = d?.gasto_brl ?? null;
  const fracao = temTeto && gasto !== null ? Math.min(1, gasto / d!.teto_brl) : 0;
  const estourou = temTeto && gasto !== null && gasto >= d!.teto_brl;

  return (
    <Pagina>
      <Cabecalho titulo="Consumo de IA" sobre={mesPorExtenso()} />
      {r.fase === "erro" && !d && <Erro mensagem={r.erro} tentar={r.recarregar} />}
      <Bloco primeiro>
        {!d ? (
          <div className="grid gap-3" aria-hidden>
            <span className="osso h-14 w-48" />
            <span className="osso h-4 w-40" />
            <span className="osso h-2 w-full" />
          </div>
        ) : d.status === "nao_configurado" || gasto === null ? (
          <div className="a-consumo">
            <p className="a-consumo__n num text-tinta-3">R$ —</p>
            <p className="a-consumo__l">
              A fonte do consumo ainda não está ligada. Quando estiver, o gasto do mês aparece aqui em reais e em dólar.
            </p>
            {temTeto && <p className="a-consumo__l">Seu teto é {reais(d.teto_brl)} por mês.</p>}
          </div>
        ) : (
          <div className="a-consumo">
            <p className={`a-consumo__n num ${estourou ? "text-alerta" : ""}`}>{reais(gasto)}</p>
            <p className="a-consumo__l num">
              {d.gasto_usd !== null ? `${dolares(d.gasto_usd)} ` : ""}
              {d.cambio_usd_brl ? `· câmbio ${d.cambio_usd_brl.toFixed(2)}` : ""}
            </p>
            {temTeto ? (
              <>
                <div className="a-barra" role="progressbar" aria-valuemin={0} aria-valuemax={d.teto_brl} aria-valuenow={gasto} aria-label="Gasto contra o teto">
                  <span className={`a-barra__cheio ${estourou ? "a-barra__cheio--alerta" : ""}`} style={{ transform: `scaleX(${fracao})` }} />
                </div>
                <p className="a-consumo__l">
                  {estourou
                    ? `Passou do teto de ${reais(d.teto_brl)}. A IA continua respondendo; se quiser, mude o teto nos ajustes.`
                    : `de ${reais(d.teto_brl)} do teto do mês. Sobram ${reais(d.teto_brl - gasto)}.`}
                </p>
              </>
            ) : (
              <p className="a-consumo__l">
                Sem teto definido. <Link className="underline" href="/ajustes#gasto">Definir um teto</Link>
              </p>
            )}
            <p className="a-consumo__meta">
              {d.atualizado_em ? `Atualizado ${diaCurto(d.atualizado_em)} às ${hora(d.atualizado_em)}` : "Sem data de atualização"}
              {d.fonte_consumo ? ` · ${d.fonte_consumo}` : ""}
              {d.fonte_cambio ? ` · câmbio ${d.fonte_cambio}` : ""}
            </p>
            <p className="a-consumo__meta">Essa conta é sua: o crédito está no seu nome.</p>
          </div>
        )}
      </Bloco>
    </Pagina>
  );
}
