"use client";

import { useEffect, useState } from "react";
import { Coins, FileSignature, Megaphone, Settings, Sparkles, Wallet } from "lucide-react";
import { Abas, Bloco, Cabecalho, Item, Linha, Lista, Pagina } from "@/components/ui/primitivos";

const ITENS = [
  { href: "/financeiro", titulo: "Financeiro", sub: "Faturamento, orçamentos, confirmações, faltas e retornos", Icone: Wallet },
  { href: "/ia-responde", titulo: "IA responde", sub: "O que a IA sabe responder no WhatsApp", Icone: Sparkles },
  { href: "/campanha", titulo: "Campanha de retorno", sub: "Quem voltou a marcar, e o botão de pausar", Icone: Megaphone },
  { href: "/ajustes/contratos", titulo: "Modelos de contrato", sub: "Termo de consentimento, contrato de tratamento", Icone: FileSignature },
  { href: "/ajustes", titulo: "Ajustes", sub: "Horários, tipos, profissionais, convênios", Icone: Settings },
  { href: "/consumo", titulo: "Consumo de IA", sub: "Quanto gastou no mês, no seu nome", Icone: Coins },
];

type Tema = "light" | "dark" | "auto";

export function TelaMais() {
  const [tema, setTema] = useState<Tema>("light");
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        const t = localStorage.getItem("tema") as Tema | null;
        if (t === "dark" || t === "auto") setTema(t);
      } catch {}
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  function mudarTema(t: Tema) {
    setTema(t);
    try {
      localStorage.setItem("tema", t);
    } catch {}
    const escuro = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = escuro ? "dark" : "light";
  }

  return (
    <Pagina>
      <Cabecalho titulo="Mais" />
      <Bloco primeiro titulo="Também aqui" id="tambem">
        <Lista>
          {ITENS.map(({ href, titulo, sub, Icone }) => (
            <Item key={href}>
              <Linha
                href={href}
                titulo={titulo}
                sub={sub}
                marca="nada"
                lado={<Icone size={20} strokeWidth={1.75} className="text-tinta-3" aria-hidden />}
              />
            </Item>
          ))}
        </Lista>
      </Bloco>
      <Bloco titulo="Tema" id="tema">
        <Abas
          valor={tema}
          aoMudar={mudarTema}
          opcoes={[
            { valor: "light", rotulo: "Branco" },
            { valor: "dark", rotulo: "Escuro" },
            { valor: "auto", rotulo: "Como o aparelho" },
          ]}
        />
        <p className="mt-2 text-[13px] text-tinta-3">Fica guardado neste aparelho.</p>
      </Bloco>
    </Pagina>
  );
}
