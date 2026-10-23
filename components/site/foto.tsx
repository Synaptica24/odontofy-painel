import Image from "next/image";

/** Moldura de foto. Com `src` mostra a imagem; sem, mostra uma moldura tonal com o rótulo do placeholder. */
export function Foto({
  src,
  alt,
  rotulo,
  className = "",
  prioridade = false,
  sizes = "(min-width: 64rem) 40vw, 100vw",
  children,
}: {
  src?: string;
  alt: string;
  rotulo: string;
  className?: string;
  prioridade?: boolean;
  sizes?: string;
  children?: React.ReactNode;
}) {
  return (
    <figure className={`s-foto ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={prioridade} />
      ) : (
        <span className="s-foto__rotulo" role="img" aria-label={`Espaço reservado: ${rotulo}`}>
          {rotulo}
        </span>
      )}
      {children}
    </figure>
  );
}
