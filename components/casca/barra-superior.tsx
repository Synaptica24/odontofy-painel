"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bell, CalendarDays, Coins, FileSignature, LogOut, Megaphone, MessageSquare, Search, Settings, Sparkles, Sun, Users, Wallet, Building2, FlaskConical, Check,
} from "lucide-react";
import { escolherConsultorio, inscreverEmConversas, listarPacientes, meusConsultorios, resumoDoDia, FIXTURE_ATIVA } from "@/lib/api";
import type { Consultorio, Paciente } from "@/lib/contratos";
import { hojeCivil, telefoneBonito } from "@/components/dados/datas";

/* Barra superior do desktop, no desenho do Codental: Hoje · Agenda · Pacientes · Financeiro · Conversas,
   busca de paciente, sino de pendências e menu da conta (troca de consultório, IA, campanha, consumo, ajustes, sair). */

const ABAS = [
  { rotulo: "Hoje", href: "/hoje", Icone: Sun },
  { rotulo: "Agenda", href: "/agenda", Icone: CalendarDays },
  { rotulo: "Pacientes", href: "/pacientes", Icone: Users },
  { rotulo: "Financeiro", href: "/financeiro", Icone: Wallet },
  { rotulo: "Conversas", href: "/conversas", Icone: MessageSquare, contador: true },
];
const MENU = [
  { rotulo: "IA responde", href: "/ia-responde", Icone: Sparkles },
  { rotulo: "Campanha de retorno", href: "/campanha", Icone: Megaphone },
  { rotulo: "Consumo de IA", href: "/consumo", Icone: Coins },
  { rotulo: "Modelos de contrato", href: "/ajustes/contratos", Icone: FileSignature },
  { rotulo: "Ajustes", href: "/ajustes", Icone: Settings },
];

export function BarraSuperior() {
  const caminho = usePathname();
  const router = useRouter();
  const [escaladas, setEscaladas] = useState(0);
  const [pendencias, setPendencias] = useState<{ confirmacoes: number; retornos: number } | null>(null);
  const [consultorios, setConsultorios] = useState<Consultorio[]>([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Paciente[] | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cancelar = inscreverEmConversas((res) => {
      if (res.sucesso) setEscaladas(res.dados.filter((c) => c.status === "escalada").length);
    });
    void resumoDoDia(hojeCivil()).then((r) => r.sucesso && setPendencias({ confirmacoes: r.dados.confirmacoes_pendentes ?? 0, retornos: r.dados.retornos_pendentes ?? 0 }));
    if (!FIXTURE_ATIVA) void meusConsultorios().then((r) => r.sucesso && setConsultorios(r.dados));
    return cancelar;
  }, []);

  // fecha menu e busca ao clicar fora
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false);
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) setResultados(null);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  // busca com atraso curto
  useEffect(() => {
    const termo = busca.trim();
    const t = window.setTimeout(() => {
      if (termo.length < 2) { setResultados(null); return; }
      void listarPacientes(termo).then((r) => setResultados(r.sucesso ? r.dados.slice(0, 8) : []));
    }, termo.length < 2 ? 0 : 200);
    return () => window.clearTimeout(t);
  }, [busca]);

  const ativo = consultorios.find((c) => c.ativo);
  const iniciais = (ativo?.nome ?? "Dr. Mateus Peixoto").split(" ").filter((p) => p.length > 2).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const totalSino = escaladas + (pendencias?.confirmacoes ?? 0);

  async function trocar(c: Consultorio) {
    setMenuAberto(false);
    const r = await escolherConsultorio(c.id);
    if (!r.sucesso) { toast.error("Não deu para trocar de consultório.", { description: r.erro.mensagem }); return; }
    toast(c.demo ? "Modo demonstração ligado" : `Consultório: ${c.nome}`, { description: c.demo ? "Dados fictícios, para mostrar o sistema." : "Dados reais." });
    router.refresh();
    window.location.reload();
  }
  async function sair() {
    await fetch("/api/auth/sair", { method: "POST" });
    router.replace("/entrar");
    router.refresh();
  }

  return (
    <header className="topo">
      <div className="topo__marca">
        <Link href="/hoje" className="topo__nome">
          Dr. Mateus Peixoto
          <small>{ativo ? ativo.nome : "Painel do consultório"}</small>
        </Link>
      </div>

      <nav className="topo__nav" aria-label="Navegação">
        {ABAS.map(({ rotulo, href, Icone, contador }) => (
          <Link key={href} href={href} aria-current={caminho.startsWith(href) ? "page" : undefined}>
            <Icone size={18} strokeWidth={2} aria-hidden />
            {rotulo}
            {contador && escaladas > 0 && (
              <span className="topo__contador num" aria-label={`${escaladas} esperando você`}>{escaladas}</span>
            )}
          </Link>
        ))}
      </nav>

      <div className="topo__direita">
        <div className="busca-topo" ref={buscaRef}>
          <Search size={16} aria-hidden />
          <input
            className="a-entrada"
            type="search"
            placeholder="Buscar paciente"
            aria-label="Buscar paciente por nome, telefone ou CPF"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { router.push(`/pacientes?busca=${encodeURIComponent(busca.trim())}`); setResultados(null); }
              if (e.key === "Escape") setResultados(null);
            }}
          />
          {resultados && (
            <div className="busca-lista" role="listbox">
              {resultados.length === 0 ? (
                <button type="button" disabled>Ninguém com esse nome.<small>Enter abre a lista completa.</small></button>
              ) : (
                resultados.map((p) => (
                  <button key={p.id} type="button" role="option" aria-selected={false} onClick={() => { setResultados(null); setBusca(""); router.push(`/pacientes/${p.id}`); }}>
                    {p.nome}
                    <small>{telefoneBonito(p.telefone_e164)}{p.convenio ? ` · ${p.convenio.nome}` : ""}</small>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <Link href={escaladas > 0 ? "/conversas" : "/financeiro#confirmacoes"} className="topo__icone sino" title={totalSino > 0 ? `${escaladas} conversas esperando · ${pendencias?.confirmacoes ?? 0} consultas a confirmar` : "Nada pendente"} aria-label="Notificações">
          <Bell size={20} strokeWidth={2} aria-hidden />
          {totalSino > 0 && <span className="sino__contador num">{totalSino > 99 ? "99+" : totalSino}</span>}
        </Link>

        <div className="menu-conta" ref={menuRef}>
          <button type="button" className="menu-conta__botao" aria-haspopup="menu" aria-expanded={menuAberto} onClick={() => setMenuAberto((v) => !v)}>
            <span className="menu-conta__avatar" aria-hidden>{iniciais || "DM"}</span>
            Conta
          </button>
          {menuAberto && (
            <div className="menu-conta__lista" role="menu">
              {consultorios.length > 0 && (
                <>
                  <p className="menu-conta__rotulo">Consultório</p>
                  {consultorios.map((c) => (
                    <button key={c.id} type="button" role="menuitemradio" aria-checked={c.ativo} aria-current={c.ativo ? "true" : undefined} onClick={() => !c.ativo && void trocar(c)}>
                      {c.demo ? <FlaskConical size={16} aria-hidden /> : <Building2 size={16} aria-hidden />}
                      <span className="flex-1 truncate">{c.nome}</span>
                      {c.ativo && <Check size={16} aria-hidden />}
                    </button>
                  ))}
                  <div className="menu-conta__sep" />
                </>
              )}
              {MENU.map(({ rotulo, href, Icone }) => (
                <Link key={href} href={href} role="menuitem" onClick={() => setMenuAberto(false)} aria-current={caminho.startsWith(href) ? "true" : undefined}>
                  <Icone size={16} aria-hidden />
                  {rotulo}
                </Link>
              ))}
              <div className="menu-conta__sep" />
              <button type="button" role="menuitem" onClick={() => void sair()}>
                <LogOut size={16} aria-hidden />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
