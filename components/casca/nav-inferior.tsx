"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { inscreverEmConversas } from "@/lib/api";
import { CalendarDays, MessageSquare, MoreHorizontal, Sun, Users } from "lucide-react";

const DESTINOS = [
  { rotulo: "Hoje", href: "/hoje", Icone: Sun },
  { rotulo: "Agenda", href: "/agenda", Icone: CalendarDays },
  { rotulo: "Pacientes", href: "/pacientes", Icone: Users },
  { rotulo: "Conversas", href: "/conversas", Icone: MessageSquare, ponto: true },
  { rotulo: "Mais", href: "/mais", Icone: MoreHorizontal },
];

const MAIS = ["/financeiro", "/campanha", "/ajustes", "/consumo", "/ia-responde", "/mais"];

export function NavInferior() {
  const caminho = usePathname();
  const [pendencias, setPendencias] = useState(false);
  useEffect(() => {
    return inscreverEmConversas((res) => {
      if (res.sucesso) setPendencias(res.dados.some((c) => c.status === "escalada"));
    });
  }, []);
  return (
    <nav className="a-nav" aria-label="Principal">
      {DESTINOS.map(({ rotulo, href, Icone, ponto }) => {
        const atual = href === "/mais" ? MAIS.some((m) => caminho.startsWith(m)) : caminho.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={atual ? "page" : undefined} className="pressa">
            <span className={ponto && pendencias ? "ponto" : undefined}>
              <Icone size={22} strokeWidth={1.75} aria-hidden />
            </span>
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
