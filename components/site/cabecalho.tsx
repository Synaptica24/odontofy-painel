"use client";

import { useEffect, useState } from "react";
import { site } from "@/config/site";
import { BotaoWhatsApp } from "./botao-whatsapp";

const LINKS = [
  { href: "#tratamentos", rotulo: "Tratamentos" },
  { href: "#sobre", rotulo: "O Dr. Mateus" },
  { href: "#primeira-consulta", rotulo: "Primeira consulta" },
  { href: "#resultados", rotulo: "Resultados" },
  { href: "#faq", rotulo: "Dúvidas" },
  { href: "#onde", rotulo: "Onde fica" },
];

export function Cabecalho() {
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const ler = () => setRolou(window.scrollY > 8);
    ler();
    window.addEventListener("scroll", ler, { passive: true });
    return () => window.removeEventListener("scroll", ler);
  }, []);
  return (
    <header className="s-topo" data-rolou={rolou ? "" : undefined}>
      <div className="s-conteudo s-topo__linha">
        <a href="#inicio" className="s-topo__nome" aria-label="Voltar ao início">
          {site.nome}
          <small>
            {site.profissao} · {site.cidade}
          </small>
        </a>
        <nav className="s-topo__nav" aria-label="Seções do site">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.rotulo}
            </a>
          ))}
        </nav>
        <BotaoWhatsApp origem="cabecalho" className="s-botao s-botao--pequeno">
          Agendar
        </BotaoWhatsApp>
      </div>
    </header>
  );
}
