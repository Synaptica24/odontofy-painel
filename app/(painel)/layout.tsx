import { BarraSuperior } from "@/components/casca/barra-superior";
import { NavInferior } from "@/components/casca/nav-inferior";

export default function LayoutPainel({ children }: { children: React.ReactNode }) {
  return (
    <div data-mundo="a" className="casca bg-fundo-app text-tinta">
      <BarraSuperior />
      <div className="casca__conteudo">{children}</div>
      <NavInferior />
    </div>
  );
}
