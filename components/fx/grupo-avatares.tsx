// Do Brio (barbearia Figars): rostos sobrepostos com um anel da cor da superfície.

/** Iniciais do nome, no disco neutro do painel. `cor` (ex.: a do profissional) tinge o fundo. */
export function Avatar({ nome, cor, tamanho = 32 }: { nome: string; cor?: string | null; tamanho?: number }) {
  const partes = nome.trim().split(/\s+/);
  const iniciais = ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
  return (
    <span
      className="avatar num"
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.38), ...(cor ? { background: cor, color: "#fff" } : {}) }}
      aria-hidden
    >
      {iniciais}
    </span>
  );
}

/** Sob o mouse (ou o pai com `group` em hover) eles se afastam e mostram cada um. */
export function GrupoAvatares({ pessoas, tamanho = 28, maximo = 4, className = "" }: { pessoas: { nome: string; cor?: string | null }[]; tamanho?: number; maximo?: number; className?: string }) {
  const vistos = pessoas.slice(0, maximo);
  const resto = pessoas.length - vistos.length;
  if (!pessoas.length) return null;
  return (
    <span className={`avg ${className}`} style={{ "--avg-s": `${tamanho}px` } as React.CSSProperties} aria-label={pessoas.map((p) => p.nome).join(", ")} role="img">
      {vistos.map((p, i) => (
        <span key={`${p.nome}-${i}`} className="avg-item" style={{ zIndex: vistos.length - i }}>
          <Avatar nome={p.nome} cor={p.cor} tamanho={tamanho} />
        </span>
      ))}
      {resto > 0 && (
        <span className="avg-item avg-more num" style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.34) }}>
          +{resto}
        </span>
      )}
    </span>
  );
}
