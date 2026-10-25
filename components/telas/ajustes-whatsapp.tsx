"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, QrCode, Smartphone } from "lucide-react";
import { whatsappAtualizarStatus, whatsappDesconectar, whatsappEnviarTeste, whatsappIniciar, whatsappStatus } from "@/lib/api";
import type { WhatsappConexao } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { Bloco, Botao, Campo, Entrada, Erro } from "@/components/ui/primitivos";
import { DeslizarConfirmar } from "@/components/fx/deslizar-confirmar";

/* Bloco "WhatsApp do consultório" (Ajustes): conectar por QR Code ou código de pareamento, acompanhar o status,
   enviar um teste para o próprio número e desconectar. A tela nunca vê token nenhum: só o retrato WhatsappConexao. */

const POLL_MS = 2500;
const QR_EXPIRA_MS = 2 * 60_000;
const PAIR_EXPIRA_MS = 5 * 60_000;

function Qr({ base64 }: { base64: string }) {
  const src = base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR Code para conectar o WhatsApp" width={224} height={224} className="wa-qr" />;
}

export function AjustesWhatsapp() {
  const r = useApi(() => whatsappStatus(), []);
  const [modo, setModo] = useState<"parado" | "pair-form" | "ocupado">("parado");
  const [telefone, setTelefone] = useState("");
  const [desconectando, setDesconectando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const timer = useRef<number | null>(null);
  const c = r.dados;

  // enquanto está conectando, pergunta ao servidor a cada 2,5 s (ele consulta a UAZ e devolve QR/código atualizados)
  useEffect(() => {
    if (c?.status !== "connecting") return;
    const tick = async () => {
      const res = await whatsappAtualizarStatus();
      if (res.sucesso) {
        const antes = c.status;
        r.definir(() => res.dados);
        if (res.dados.status === "connected" && antes !== "connected") toast("WhatsApp conectado", { description: `Número ${res.dados.numero_mascarado ?? ""}` });
      }
      setAgora(Date.now());
    };
    timer.current = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.status]);

  async function iniciar(metodo: "qr" | "pair") {
    setModo("ocupado");
    const res = await whatsappIniciar(metodo, metodo === "pair" ? telefone.replace(/\D/g, "") : undefined);
    setModo("parado");
    if (!res.sucesso) {
      toast.error("Não deu para começar a conexão.", { description: res.erro.mensagem });
      return;
    }
    r.definir(() => res.dados);
  }
  async function desconectar() {
    const res = await whatsappDesconectar();
    setDesconectando(false);
    if (!res.sucesso) {
      toast.error("Não deu para desconectar.", { description: res.erro.mensagem });
      return;
    }
    r.definir(() => res.dados);
    toast("WhatsApp desconectado", { description: "Para voltar a usar, faça um novo pareamento." });
  }
  async function enviarTeste() {
    setModo("ocupado");
    const res = await whatsappEnviarTeste();
    setModo("parado");
    if (!res.sucesso) {
      toast.error(res.erro.codigo === "conflito" ? "Espere um minuto entre um teste e outro." : "O teste não saiu.", { description: res.erro.codigo === "conflito" ? undefined : res.erro.mensagem });
      return;
    }
    r.definir(() => res.dados);
    toast("Teste enviado", { description: "Confira o WhatsApp do consultório." });
  }
  function cancelar() {
    void desconectar();
  }

  const restante = c?.status === "connecting" && c.iniciado_em ? Math.max(0, (c.metodo === "pair" ? PAIR_EXPIRA_MS : QR_EXPIRA_MS) - (agora - Date.parse(c.iniciado_em))) : 0;
  const mmss = `${Math.floor(restante / 60000)}:${String(Math.floor((restante % 60000) / 1000)).padStart(2, "0")}`;
  const telefoneOk = /^\d{10,15}$/.test(telefone.replace(/\D/g, ""));

  return (
    <Bloco titulo="WhatsApp do consultório" id="whatsapp" primeiro lado={c ? <StatusChip status={c.status} /> : undefined}>
      {r.fase === "erro" && !c && <Erro mensagem={r.erro} tentar={r.recarregar} />}
      {!c ? (
        <span className="osso block h-16" aria-hidden />
      ) : !c.configurado ? (
        <p className="a-ajuste__dica">A integração do WhatsApp ainda não foi configurada no servidor. Quando estiver, você conecta o número do consultório aqui, por QR Code ou código de pareamento.</p>
      ) : c.status === "connected" ? (
        <>
          <div className="a-ajuste">
            <div>
              <p className="a-ajuste__rotulo num">{c.numero_mascarado ?? "Número conectado"}</p>
              <p className="a-ajuste__dica">Confirmações de consulta e o chat passam a sair por este número.</p>
            </div>
            <Botao onClick={() => void enviarTeste()} disabled={modo === "ocupado"}>
              <MessageCircle size={16} aria-hidden /> Enviar teste pra mim
            </Botao>
          </div>
          {desconectando ? (
            <div className="mt-3">
              <DeslizarConfirmar tom="alerta" rotulo="Arraste para desconectar o WhatsApp" rotuloFeito="Desconectado" aoConfirmar={() => void desconectar()} />
              <button type="button" className="a-link mt-2" onClick={() => setDesconectando(false)}>Deixa conectado</button>
            </div>
          ) : (
            <button type="button" className="a-link mt-2" onClick={() => setDesconectando(true)}>Desconectar</button>
          )}
        </>
      ) : c.status === "connecting" ? (
        <div className="wa-conectando">
          {c.metodo === "qr" ? (
            <>
              {c.qrcode_base64 ? <Qr base64={c.qrcode_base64} /> : <span className="osso wa-qr" aria-hidden />}
              <div>
                <p className="a-ajuste__rotulo">Leia o QR Code no celular do consultório</p>
                <p className="a-ajuste__dica">WhatsApp → Aparelhos conectados → Conectar um aparelho. O código muda sozinho; expira em <span className="num">{mmss}</span>.</p>
              </div>
            </>
          ) : (
            <>
              <p className="wa-paircode num" aria-label="Código de pareamento">{c.paircode ?? "……"}</p>
              <div>
                <p className="a-ajuste__rotulo">Digite este código no celular do consultório</p>
                <p className="a-ajuste__dica">WhatsApp → Aparelhos conectados → Conectar um aparelho → Conectar com número de telefone. Expira em <span className="num">{mmss}</span>.</p>
              </div>
            </>
          )}
          <Botao onClick={cancelar}>Cancelar</Botao>
        </div>
      ) : (
        <>
          <p className="a-ajuste__dica mb-3">
            {c.status === "hibernated" ? "A sessão está pausada. Conecte de novo para voltar a usar." : "Conecte o WhatsApp do consultório para confirmações e o chat."}
            {c.erro && <span className="block mt-1 text-alerta">{c.erro}</span>}
          </p>
          {modo === "pair-form" ? (
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (telefoneOk) void iniciar("pair");
              }}
            >
              <Campo rotulo="Número do WhatsApp do consultório" dica="Com DDI e DDD, só números. Ex.: 5511999991234">
                <Entrada inputMode="numeric" autoFocus value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="5511999991234" maxLength={20} />
              </Campo>
              <div className="flex flex-wrap gap-2">
                <Botao type="submit" cheio disabled={!telefoneOk || modo !== "pair-form"}>Gerar código</Botao>
                <Botao onClick={() => setModo("parado")}>Voltar</Botao>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Botao cheio onClick={() => void iniciar("qr")} disabled={modo === "ocupado"}>
                <QrCode size={16} aria-hidden /> {c.status === "hibernated" ? "Reconectar com QR Code" : "Conectar com QR Code"}
              </Botao>
              <Botao onClick={() => setModo("pair-form")} disabled={modo === "ocupado"}>
                <Smartphone size={16} aria-hidden /> Código de pareamento
              </Botao>
            </div>
          )}
        </>
      )}
      <p className="mt-3 text-[12px] text-tinta-3">Prefira um número WhatsApp Business. As mensagens passam pela infraestrutura da Synaptica (UAZ-API).</p>
    </Bloco>
  );
}

function StatusChip({ status }: { status: WhatsappConexao["status"] }) {
  const rotulo = { connected: "Conectado", connecting: "Conectando…", hibernated: "Pausado", disconnected: "Desconectado" }[status];
  const classe = { connected: "chip--verde", connecting: "chip--amarelo", hibernated: "chip--amarelo", disconnected: "" }[status];
  return <span className={`chip ${classe}`}>{rotulo}</span>;
}
