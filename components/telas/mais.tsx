"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, FileSignature, Megaphone, Settings, Sparkles, Wallet } from "lucide-react";
import { trocarSenha } from "@/lib/auth";
import { clienteBrowser } from "@/lib/supabase/browser";
import { Abas, Bloco, Botao, Cabecalho, Campo, Entrada, Item, Linha, Lista, Pagina } from "@/components/ui/primitivos";

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
      <Conta />
    </Pagina>
  );
}

/** E-mail da conta logada e troca de senha (server action trocarSenha, com a sessão atual). */
function Conta() {
  const [email, setEmail] = useState<string | null>(null);
  const [nova, setNova] = useState("");
  const [repete, setRepete] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    try {
      const c = clienteBrowser();
      void c?.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    } catch {
      /* modo demonstração sem Supabase */
    }
  }, []);
  const curta = nova.length > 0 && nova.length < 8;
  const diferente = repete.length > 0 && repete !== nova;
  const pode = nova.length >= 8 && repete === nova && !salvando;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!pode) return;
    setSalvando(true);
    const res = await trocarSenha(nova);
    setSalvando(false);
    if (!res.sucesso) {
      toast.error("A senha não mudou.", { description: res.erro.mensagem });
      return;
    }
    setNova("");
    setRepete("");
    toast("Senha trocada", { description: "Use a nova senha no próximo acesso." });
  }

  return (
    <Bloco titulo="Sua conta" id="conta">
      {email && <p className="mb-3 text-[14px]">Entrando como <b>{email}</b></p>}
      <form onSubmit={salvar} className="grid gap-2 sm:max-w-sm">
        <Campo rotulo="Nova senha" dica={curta ? "Pelo menos 8 caracteres." : undefined}>
          <Entrada type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} minLength={8} maxLength={200} />
        </Campo>
        <Campo rotulo="Repita a nova senha" dica={diferente ? "As duas senhas não batem." : undefined}>
          <Entrada type="password" autoComplete="new-password" value={repete} onChange={(e) => setRepete(e.target.value)} minLength={8} maxLength={200} />
        </Campo>
        <div>
          <Botao type="submit" cheio disabled={!pode}>{salvando ? "Trocando…" : "Trocar senha"}</Botao>
        </div>
      </form>
    </Bloco>
  );
}
