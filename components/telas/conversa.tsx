"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Mic, Paperclip, Send } from "lucide-react";
import {
  abrirConversa,
  assumirConversa,
  devolverParaIA,
  enviarMensagem,
  inscreverEmMensagens,
  lerConfig,
} from "@/lib/api";
import type { Mensagem } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { diaLongo, faltaQuanto, hojeCivil, hora } from "@/components/dados/datas";
import { Botao, Erro, Marca } from "@/components/ui/primitivos";
import { Reacoes } from "@/components/fx/reacoes";

function agruparPorDia(msgs: Mensagem[]) {
  const grupos: { dia: string; itens: Mensagem[] }[] = [];
  for (const m of msgs) {
    const dia = hojeCivil(new Date(m.criada_em));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.itens.push(m);
    else grupos.push({ dia, itens: [m] });
  }
  return grupos;
}

export function TelaConversa({ id }: { id: string }) {
  const r = useApi(() => abrirConversa(id), [id]);
  const cfg = useApi(() => lerConfig(), []);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  // última reação (emoji) que você mandou nesta visita; vai como mensagem normal pelo WhatsApp
  const [reacao, setReacao] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const cancelar = inscreverEmMensagens(id, (res) => {
      if (!res.sucesso) return;
      r.definir((d) => ({ ...d, mensagens: res.dados }));
    });
    const relogio = window.setInterval(() => setAgora(new Date()), 30000);
    return () => {
      cancelar();
      window.clearInterval(relogio);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [r.dados?.mensagens.length]);

  const d = r.dados;
  const conversa = d?.conversa;
  const pausadaAte = conversa?.agente_pausado_ate ? new Date(conversa.agente_pausado_ate) : null;
  const vocePausou = !!pausadaAte && pausadaAte > agora;
  const voceResponde = conversa?.status === "assumida" || vocePausou;
  const escalada = conversa?.status === "escalada";
  const pausaMin = cfg.dados?.pausa_agente_minutos ?? 30;

  async function assumir() {
    if (!d) return;
    const antes = d;
    r.definir((x) => ({
      ...x,
      conversa: {
        ...x.conversa,
        status: "assumida",
        agente_pausado_ate: new Date(Date.now() + pausaMin * 60000).toISOString(),
      },
    }));
    const res = await assumirConversa(id);
    if (!res.sucesso) {
      r.definir(() => antes);
      toast.error("Não deu para assumir.", { description: res.erro.mensagem });
      return;
    }
    r.definir((x) => ({ ...x, conversa: res.dados }));
    toast(`Você assumiu ${d.paciente.nome}`, {
      description: `A IA fica em silêncio por ${pausaMin} min, ou até você devolver.`,
      action: { label: "Devolver", onClick: () => void devolver() },
    });
  }

  async function devolver() {
    if (!d) return;
    const antes = d;
    r.definir((x) => ({ ...x, conversa: { ...x.conversa, status: "ativa", agente_pausado_ate: null } }));
    const res = await devolverParaIA(id);
    if (!res.sucesso) {
      r.definir(() => antes);
      toast.error("Não deu para devolver.", { description: res.erro.mensagem });
      return;
    }
    r.definir((x) => ({ ...x, conversa: res.dados }));
    toast("A IA voltou a responder", {
      action: { label: "Desfazer", onClick: () => void assumir() },
    });
  }

  async function reagir(emoji: string) {
    if (!d || enviando) return;
    setReacao(emoji);
    await enviar(emoji);
  }

  async function enviar(conteudo?: string) {
    const t = (conteudo ?? texto).trim();
    if (!t || !d || enviando) return;
    setEnviando(true);
    const otimista: Mensagem = {
      id: `local-${Date.now()}`,
      conversa_id: id,
      direcao: "saida",
      autor: "dentista",
      texto: t,
      tipo: "texto",
      transcricao: null,
      midia_url: null,
      wa_message_id: null,
      criada_em: new Date().toISOString(),
    };
    r.definir((x) => ({ ...x, mensagens: [...x.mensagens, otimista] }));
    if (!conteudo) setTexto("");
    const res = await enviarMensagem(id, t);
    setEnviando(false);
    if (!res.sucesso) {
      r.definir((x) => ({ ...x, mensagens: x.mensagens.filter((m) => m.id !== otimista.id) }));
      if (conteudo) {
        setReacao(null);
        toast.error("A reação não saiu.", { description: res.erro.mensagem });
      } else {
        setTexto(t);
        toast.error("A mensagem não saiu.", { description: `${res.erro.mensagem} O texto continua aí embaixo.` });
      }
      return;
    }
    r.definir((x) => ({ ...x, mensagens: x.mensagens.map((m) => (m.id === otimista.id ? res.dados : m)) }));
  }

  return (
    <div className="a-thread">
      <header className="a-thread__topo">
        <Link href="/conversas" className="a-thread__voltar pressa" aria-label="Voltar para conversas">
          <ArrowLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          {d ? (
            <>
              <Link href={`/pacientes/${d.paciente.id}`} className="a-thread__nome truncate">
                {d.paciente.nome}
              </Link>
              <p className={`a-thread__quem ${escalada ? "a-thread__quem--alerta" : ""}`}>
                <Marca tipo={escalada ? "escalada" : voceResponde ? "voce" : "ia"} className="inline-block" />
                {escalada
                  ? `Esperando você${conversa?.urgente ? " · urgente" : ""}`
                  : voceResponde
                    ? `Você está respondendo${pausadaAte ? ` · IA volta em ${faltaQuanto(conversa!.agente_pausado_ate!, agora)}` : ""}`
                    : "IA respondendo"}
              </p>
            </>
          ) : (
            <>
              <span className="osso block h-5 w-40" />
              <span className="osso mt-1 block h-3 w-28" />
            </>
          )}
        </div>
        {d &&
          (voceResponde ? (
            <Botao onClick={() => void devolver()}>Devolver pra IA</Botao>
          ) : (
            <Botao cheio onClick={() => void assumir()}>
              Assumir
            </Botao>
          ))}
      </header>

      <div className="a-thread__corpo">
        {r.fase === "erro" && !d && <Erro mensagem={r.erro} tentar={r.recarregar} />}
        {!d ? (
          <div className="grid gap-3 px-4 pt-4" aria-hidden>
            <span className="osso h-12 w-3/5 self-start" />
            <span className="osso h-16 w-4/5 justify-self-end" />
            <span className="osso h-10 w-1/2 self-start" />
          </div>
        ) : d.mensagens.length === 0 ? (
          <p className="px-4 pt-6 text-center text-tinta-2">Nenhuma mensagem ainda.</p>
        ) : (
          agruparPorDia(d.mensagens).map((g) => (
            <section key={g.dia} className="a-thread__dia">
              <h2 className="a-thread__data">{g.dia === hojeCivil() ? "Hoje" : diaLongo(g.dia)}</h2>
              {g.itens.map((m) => (
                <Balao key={m.id} m={m} />
              ))}
            </section>
          ))
        )}
        <div ref={fim} />
      </div>

      <footer className="a-thread__rodape">
        {voceResponde ? (
          <form
            className="a-thread__form"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <textarea
              className="a-entrada a-thread__texto"
              rows={1}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              placeholder={`Responder ${d?.paciente.nome ?? ""}`}
              aria-label="Sua resposta"
            />
            <Reacoes valor={reacao} aoEscolher={(e) => void reagir(e)} aoLimpar={() => setReacao(null)} desabilitado={enviando} />
            <button type="submit" className="a-thread__enviar pressa" disabled={!texto.trim() || enviando} aria-label="Enviar">
              <Send size={20} strokeWidth={2} />
            </button>
          </form>
        ) : (
          <p className="a-thread__aviso">
            {escalada ? "A IA parou e está esperando você." : "A IA está respondendo."}{" "}
            <button type="button" className="a-thread__link" onClick={() => void assumir()}>
              Assumir para responder
            </button>
          </p>
        )}
      </footer>
    </div>
  );
}

function Balao({ m }: { m: Mensagem }) {
  const meu = m.autor === "dentista";
  const ia = m.autor === "agente";
  return (
    <div className={`a-balao ${meu ? "a-balao--voce" : ia ? "a-balao--ia" : "a-balao--paciente"}`}>
      {(ia || meu) && (
        <span className="a-balao__autor">
          <Marca tipo={ia ? "ia" : "voce"} className="inline-block" />
          {ia ? "IA" : "Você"}
        </span>
      )}
      {m.tipo === "audio" ? (
        <div className="a-balao__audio">
          <span className="a-balao__tipo">
            <Mic size={14} aria-hidden /> Áudio
          </span>
          {m.midia_url && (
            <audio controls preload="none" src={m.midia_url} className="mt-1 w-full" />
          )}
          <p className="a-balao__transcricao">{m.transcricao ?? "Transcrição não disponível."}</p>
        </div>
      ) : m.tipo === "imagem" ? (
        <div>
          {m.midia_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.midia_url} alt="Imagem enviada" className="a-balao__imagem" loading="lazy" />
          ) : (
            <span className="a-balao__tipo">Imagem</span>
          )}
          {m.texto && <p className="mt-1">{m.texto}</p>}
        </div>
      ) : m.tipo === "documento" ? (
        <a className="a-balao__tipo underline" href={m.midia_url ?? "#"} target="_blank" rel="noreferrer">
          <Paperclip size={14} aria-hidden /> {m.texto || "Documento"}
        </a>
      ) : (
        <p className="whitespace-pre-wrap">{m.texto}</p>
      )}
      <time className="a-balao__hora num" dateTime={m.criada_em}>
        {hora(m.criada_em)}
      </time>
    </div>
  );
}
