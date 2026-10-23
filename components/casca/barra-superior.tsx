"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Coins, Megaphone, MessageSquare, Settings, Sparkles, Sun, Users } from "lucide-react";
import { inscreverEmConversas, lerConfig, resumoDoDia } from "@/lib/api";
import { hojeCivil } from "@/components/dados/datas";
import { Marca } from "@/components/ui/primitivos";

/* Barra superior do desktop, no desenho do Codental: nome à esquerda, abas com ícone no meio,
   estado da IA e atalhos à direita. No celular ela some e a barra inferior assume. */

const ABAS = [
  { rotulo: "Hoje", href: "/hoje", Icone: Sun },
  { rotulo: "Conversas", href: "/conversas", Icone: MessageSquare, contador: true },
  { rotulo: "Agenda", href: "/agenda", Icone: CalendarDays },
  { rotulo: "Pacientes", href: "/pacientes", Icone: Users },
  { rotulo: "IA responde", href: "/ia-responde", Icone: Sparkles },
];
const ATALHOS = [
  { rotulo: "Campanha de retorno", href: "/campanha", Icone: Megaphone },
  { rotulo: "Consumo de IA", href: "/consumo", Icone: Coins },
  { rotulo: "Ajustes", href: "/ajustes", Icone: Settings },
];

export function BarraSuperior() {
  const caminho = usePathname();
  const [escaladas, setEscaladas] = useState(0);
  const [assumidas, setAssumidas] = useState(0);
  const [iaAtiva, setIaAtiva] = useState<boolean | null>(null);
  const [iaHoje, setIaHoje] = useState<number | null>(null);

  useEffect(() => {
    const cancelar = inscreverEmConversas((res) => {
      if (!res.sucesso) return;
      setEscaladas(res.dados.filter((c) => c.status === "escalada").length);
      setAssumidas(res.dados.filter((c) => c.status === "assumida").length);
    });
    void lerConfig().then((r) => r.sucesso && setIaAtiva(r.dados.agente_ativo));
    void resumoDoDia(hojeCivil()).then((r) => r.sucesso && setIaHoje(r.dados.mensagens_ia_hoje));
    return cancelar;
  }, []);

  return (
    <header className="topo">
      <div className="topo__marca">
        <span className="topo__nome">
          Dr. Mateus Peixoto
          <small>Painel do consultório</small>
        </span>
      </div>

      <nav className="topo__nav" aria-label="Navegação">
        {ABAS.map(({ rotulo, href, Icone, contador }) => (
          <Link key={href} href={href} aria-current={caminho.startsWith(href) ? "page" : undefined}>
            <Icone size={18} strokeWidth={2} aria-hidden />
            {rotulo}
            {contador && escaladas > 0 && (
              <span className="topo__contador num" aria-label={`${escaladas} esperando você`}>
                {escaladas}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="topo__direita">
        <span className={`topo__estado ${iaAtiva === false ? "topo__estado--off" : ""}`}>
          <Marca tipo={iaAtiva === false ? "falta" : "ia"} />
          {iaAtiva === null ? "IA…" : iaAtiva ? "IA respondendo" : "IA desligada"}
          {iaHoje !== null && iaAtiva && (
            <>
              <span aria-hidden>·</span>
              <b className="num">{iaHoje}</b> hoje
            </>
          )}
        </span>
        {assumidas > 0 && (
          <span className="topo__estado">
            <Marca tipo="voce" />
            <b className="num">{assumidas}</b> com você
          </span>
        )}
        {ATALHOS.map(({ rotulo, href, Icone }) => (
          <Link
            key={href}
            href={href}
            className="topo__icone"
            title={rotulo}
            aria-label={rotulo}
            aria-current={caminho.startsWith(href) ? "page" : undefined}
          >
            <Icone size={20} strokeWidth={2} aria-hidden />
          </Link>
        ))}
      </div>
    </header>
  );
}
