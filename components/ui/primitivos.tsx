"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Check } from "lucide-react";

/* Primitivos do mundo "Clínica clara" (classes com prefixo a-, herdado): cartões, linhas, pontos de estado, botões retos.
   Só estes arquivos e styles/ conhecem as classes do mundo. As telas usam nomes semânticos. */

export function Pagina({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={`a-pagina mx-auto w-full px-4 pt-3 ${className}`}
      style={{ paddingBottom: "calc(var(--barra-inferior) + 1.5rem)" }}
    >
      {children}
    </main>
  );
}

export function Cabecalho({
  titulo,
  sobre,
  abaixo,
  acao,
}: {
  titulo: ReactNode;
  sobre?: ReactNode;
  abaixo?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <header className="pt-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {sobre && <p className="text-[13px] text-tinta-3">{sobre}</p>}
          <h1 className="mt-0.5 truncate">{titulo}</h1>
        </div>
        {acao}
      </div>
      {abaixo && <p className="mt-2 text-[13px] text-tinta-2">{abaixo}</p>}
    </header>
  );
}

export function Bloco({
  titulo,
  id,
  lado,
  children,
  primeiro,
}: {
  titulo?: ReactNode;
  id?: string;
  lado?: ReactNode;
  children: ReactNode;
  primeiro?: boolean;
}) {
  return (
    <section className={`a-bloco ${primeiro ? "a-bloco--primeiro" : ""} ${titulo || lado ? "" : "a-bloco--sem-legenda"}`} aria-labelledby={id}>
      {(titulo || lado) && (
        <div className="a-legenda">
          {titulo ? <h2 id={id}>{titulo}</h2> : <span />}
          {lado && <span className="num">{lado}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export type TipoMarca = "escalada" | "ia" | "voce" | "anel" | "feito" | "falta" | "nada";

/** Ponto de estado pequeno e chapado (como "● Confirmada" no Codental). Feito e falta carregam um glifo. */
export function Marca({ tipo, className = "" }: { tipo: TipoMarca; className?: string }) {
  const base = `marca marca--${tipo} ${className}`;
  switch (tipo) {
    case "feito":
      return (
        <svg className={base} viewBox="0 0 12 12" aria-hidden>
          <path d="M3 6.5 5.2 8.6 9 3.8" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "falta":
      return (
        <svg className={base} viewBox="0 0 12 12" aria-hidden>
          <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      );
    default:
      return <span className={base} aria-hidden />;
  }
}

type LinhaBase = {
  marca?: TipoMarca;
  titulo: ReactNode;
  sub?: ReactNode;
  meta?: ReactNode;
  lado?: ReactNode;
  alerta?: boolean;
  className?: string;
  acoesEmbaixo?: boolean;
};

/** Uma linha da ficha. Vira link quando recebe href; botão quando recebe onClick. */
export function Linha({
  marca = "nada",
  titulo,
  sub,
  meta,
  lado,
  alerta,
  className = "",
  acoesEmbaixo,
  href,
  onClick,
}: LinhaBase & { href?: string; onClick?: () => void }) {
  const conteudo = (
    <>
      <Marca tipo={marca} />
      <div className="min-w-0">
        <div className="a-linha__nome">{titulo}</div>
        {sub && <div className="a-linha__sub">{sub}</div>}
        {meta && <div className="a-linha__meta num">{meta}</div>}
      </div>
      {lado ?? <span />}
    </>
  );
  const classes = `a-linha ${alerta ? "a-linha--alerta" : ""} ${acoesEmbaixo ? "a-linha--acoes" : ""} ${href || onClick ? "pressa a-linha--toque" : ""} ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {conteudo}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {conteudo}
      </button>
    );
  }
  return <div className={classes}>{conteudo}</div>;
}

export function Lista({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ul className={`a-lista ${className}`}>{children}</ul>;
}
export function Item({ children, saindo, className = "" }: { children: ReactNode; saindo?: boolean; className?: string }) {
  return <li className={`entra ${saindo ? "linha-sai" : ""} ${className}`}>{children}</li>;
}

type BotaoProps = ComponentProps<"button"> & {
  cheio?: boolean;
  alerta?: boolean;
  grande?: boolean;
};
export function Botao({ cheio, alerta, grande, className = "", ...props }: BotaoProps) {
  return (
    <button
      type="button"
      {...props}
      className={`a-botao pressa ${cheio ? "a-botao--cheio" : ""} ${alerta ? "a-botao--alerta" : ""} ${grande ? "a-botao--grande" : ""} ${className}`}
    />
  );
}

export function BotaoLink({
  cheio,
  grande,
  className = "",
  ...props
}: ComponentProps<typeof Link> & { cheio?: boolean; grande?: boolean }) {
  return (
    <Link
      {...props}
      className={`a-botao pressa inline-flex items-center justify-center ${cheio ? "a-botao--cheio" : ""} ${grande ? "a-botao--grande" : ""} ${className}`}
    />
  );
}

/** Estado vazio: boa notícia, não texto cinza. */
export function Vazio({ titulo, sub, icone }: { titulo: ReactNode; sub?: ReactNode; icone?: ReactNode }) {
  return (
    <p className="a-vazio entra">
      {icone ?? <Check size={18} strokeWidth={2.25} aria-hidden />}
      <span>
        <strong>{titulo}</strong>
        {sub && <> {sub}</>}
      </span>
    </p>
  );
}

/** Erro que diz o que houve e o que fazer. */
export function Erro({ mensagem, tentar }: { mensagem: string; tentar?: () => void }) {
  return (
    <div className="a-erro entra" role="alert">
      <p>{mensagem}</p>
      {tentar && (
        <Botao onClick={tentar} className="mt-2">
          Tentar de novo
        </Botao>
      )}
    </div>
  );
}

/** Esqueleto com a forma de uma linha. */
export function OssoLinha({ n = 3 }: { n?: number }) {
  return (
    <ul aria-hidden>
      {Array.from({ length: n }).map((_, i) => (
        <li key={i} className="a-linha">
          <span className="marca osso rounded-full" />
          <div className="grid gap-1.5">
            <span className="osso h-4" style={{ width: `${55 + ((i * 17) % 30)}%` }} />
            <span className="osso h-3" style={{ width: `${35 + ((i * 23) % 40)}%` }} />
          </div>
          <span className="osso h-8 w-16" />
        </li>
      ))}
    </ul>
  );
}

export function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: ReactNode;
  dica?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="a-campo">
      <span className="a-campo__rotulo">{rotulo}</span>
      {children}
      {dica && <span className="a-campo__dica">{dica}</span>}
    </label>
  );
}

export function Entrada({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`a-entrada ${className}`} />;
}
export function AreaTexto({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`a-entrada a-entrada--area ${className}`} />;
}

/** Interruptor com alvo grande. */
export function Interruptor({
  ligado,
  aoMudar,
  rotulo,
}: {
  ligado: boolean;
  aoMudar: (v: boolean) => void;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => aoMudar(!ligado)}
      className={`a-interruptor pressa ${ligado ? "a-interruptor--ligado" : ""}`}
    >
      <span className="a-interruptor__bola" />
    </button>
  );
}

/** Filtro em abas: controle segmentado (iOS/Brio), o indicador branco desliza até a opção ativa. */
export function Abas<T extends string>({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: ReactNode }[];
  aoMudar: (v: T) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(`[data-valor="${CSS.escape(valor)}"]`);
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  }, [valor, opcoes.length]);
  return (
    <div
      ref={ref}
      className="a-abas"
      role="tablist"
      onKeyDown={(e) => {
        const i = opcoes.findIndex((o) => o.valor === valor);
        if (e.key === "ArrowRight") aoMudar(opcoes[(i + 1) % opcoes.length].valor);
        if (e.key === "ArrowLeft") aoMudar(opcoes[(i - 1 + opcoes.length) % opcoes.length].valor);
      }}
    >
      {ind && <span aria-hidden className="a-abas__indicador" style={{ width: ind.w, transform: `translateX(${ind.x - 3}px)` }} />}
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={valor === o.valor}
          tabIndex={valor === o.valor ? 0 : -1}
          data-valor={o.valor}
          onClick={() => aoMudar(o.valor)}
          className="a-aba"
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Contador contra o teto: número a favor dele. */
export function Teto({ usado, teto }: { usado: number; teto: number }) {
  if (!teto) return <span className="text-tinta-3">sem teto de novos</span>;
  const cheio = usado >= teto;
  return (
    <span className={`num ${cheio ? "text-tinta" : ""}`}>
      {usado} de {teto} novos na semana{cheio ? " · cheio" : ""}
    </span>
  );
}
