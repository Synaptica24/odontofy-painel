"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { atualizarRetorno, confirmarSugestao, decidirOrcamento, financeiroResumo, marcarConfirmacaoEnviada } from "@/lib/api";
import type { FinanceiroResumo, Retorno } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { diaCurto, diaLongo, hojeCivil, hora, inicioDaSemana, reais, somarDias, telefoneBonito } from "@/components/dados/datas";
import { Abas, Bloco, Botao, Cabecalho, Erro, Item, Linha, Lista, OssoLinha, Pagina, Vazio } from "@/components/ui/primitivos";

/* Financeiro: faturamento previsto e realizado, orçamentos por estado, confirmações da semana,
   lista de faltas e retornos (quem precisa voltar) com botão de chamar no WhatsApp. */

type Periodo = "semana" | "mes" | "30d";
const CHIP: Record<string, string> = { pendente: "chip--amarelo", aprovado: "chip--verde", recusado: "chip--vermelho" };

function intervalo(p: Periodo): [string, string] {
  const hoje = hojeCivil();
  if (p === "30d") return [somarDias(hoje, -29), hoje];
  if (p === "mes") {
    // último dia do mês de verdade (30, 31, 28 ou 29), sem depender do fuso do aparelho
    const [ano, mes] = hoje.split("-").map(Number);
    const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    return [`${hoje.slice(0, 7)}-01`, `${hoje.slice(0, 7)}-${String(ultimo).padStart(2, "0")}`];
  }
  const seg = inicioDaSemana(hoje);
  return [seg, somarDias(seg, 6)];
}
function textoRetorno(r: Retorno) {
  return `Olá, ${r.paciente?.nome.split(" ")[0]}! Aqui é do consultório do Dr. Mateus Peixoto. Está na hora do seu retorno (${r.motivo.toLowerCase()}). Quer que eu veja um horário para você esta semana?`;
}
function textoFalta(nome: string, tipo: string) {
  return `Olá, ${nome.split(" ")[0]}! Sentimos sua falta na consulta de ${tipo.toLowerCase()}. Quer remarcar? Me diz o melhor dia e horário.`;
}

export function TelaFinanceiro() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [ini, fim] = intervalo(periodo);
  const r = useApi(() => financeiroResumo(ini, fim), [ini, fim]);
  const d = r.dados;

  async function decidir(id: string, status: "aprovado" | "recusado" | "pendente") {
    const res = await decidirOrcamento(id, status);
    if (!res.sucesso) { toast.error("Não deu para atualizar o orçamento."); return; }
    toast(status === "aprovado" ? "Orçamento aprovado" : status === "recusado" ? "Orçamento recusado" : "Orçamento reaberto");
    void r.recarregar();
  }
  async function pedirConfirmacao(c: FinanceiroResumo["confirmacoes"][number]) {
    const msg = `Olá, ${c.paciente.nome.split(" ")[0]}! Passando para confirmar sua consulta (${c.tipo}) ${diaLongo(c.inicio.slice(0, 10)).toLowerCase()} às ${hora(c.inicio)} com o Dr. Mateus Peixoto. Pode confirmar respondendo SIM?`;
    window.open(`https://wa.me/${c.paciente.telefone_e164.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    await marcarConfirmacaoEnviada(c.id); void r.recarregar();
  }
  async function confirmar(id: string) {
    const res = await confirmarSugestao(id);
    if (!res.sucesso) { toast.error("Não deu para confirmar."); return; }
    toast("Consulta confirmada"); void r.recarregar();
  }
  async function chamarRetorno(ret: Retorno) {
    if (!ret.paciente) return;
    window.open(`https://wa.me/${ret.paciente.telefone_e164.replace(/\D/g, "")}?text=${encodeURIComponent(textoRetorno(ret))}`, "_blank", "noopener");
    await atualizarRetorno(ret.id, "contatado"); void r.recarregar();
  }
  async function mudarRetorno(ret: Retorno, status: Retorno["status"]) {
    const res = await atualizarRetorno(ret.id, status);
    if (!res.sucesso) { toast.error("Não deu para atualizar."); return; }
    toast(status === "descartado" ? "Retorno descartado" : "Retorno atualizado"); void r.recarregar();
  }

  const taxa = d && d.consultas + d.faltas > 0 ? Math.round((d.consultas / (d.consultas + d.faltas)) * 100) : null;

  return (
    <Pagina>
      <Cabecalho titulo="Financeiro" sobre={`${diaCurto(`${ini}T12:00:00-03:00`)} a ${diaCurto(`${fim}T12:00:00-03:00`)}`}
        acao={<Abas valor={periodo} aoMudar={setPeriodo} opcoes={[{ valor: "semana", rotulo: "Semana" }, { valor: "mes", rotulo: "Mês" }, { valor: "30d", rotulo: "30 dias" }]} />} />
      {r.fase === "erro" && !d && <Erro mensagem={r.erro} tentar={r.recarregar} />}

      <Bloco primeiro titulo="Resumo" id="resumo">
        {!d ? <OssoLinha n={2} /> : (
          <div className="numeros">
            <div className="numero"><b className="num">{reais(d.previsto)}</b><span>previsto no período</span></div>
            <div className="numero"><b className="num">{reais(d.realizado)}</b><span>realizado (atendidos)</span></div>
            <div className="numero"><b className="num">{d.consultas}</b><span>consultas</span></div>
            <div className="numero"><b className="num">{taxa === null ? "—" : `${taxa}%`}</b><span>comparecimento · {d.faltas} {d.faltas === 1 ? "falta" : "faltas"}</span></div>
            <div className="numero"><b className="num">{reais(d.orcamentos.valor_pendente)}</b><span>{d.orcamentos.pendentes} orçamento(s) pendente(s)</span></div>
            <div className="numero"><b className="num">{reais(d.orcamentos.valor_aprovado)}</b><span>{d.orcamentos.aprovados} aprovado(s) · {d.orcamentos.recusados} recusado(s)</span></div>
          </div>
        )}
        <p className="mt-2 text-[12px] text-tinta-3">Previsto = soma do valor das consultas marcadas. Realizado = consultas marcadas como atendidas. O valor sai da consulta ou do orçamento aprovado.</p>
      </Bloco>

      <Bloco titulo="Confirmações das próximas 72 horas" id="confirmacoes" lado={d?.confirmacoes.length || undefined}>
        {!d ? <OssoLinha n={2} /> : d.confirmacoes.length === 0 ? <Vazio titulo="Tudo confirmado." sub="Nenhuma consulta esperando confirmação." /> : (
          <Lista>
            {d.confirmacoes.map((c) => (
              <Item key={c.id}>
                <Linha marca="anel" href={`/pacientes/${c.paciente.id}`} titulo={c.paciente.nome}
                  sub={<>{diaCurto(c.inicio)} às {hora(c.inicio)} · {c.tipo}{c.confirmacao_enviada_em ? ` · mensagem enviada ${hora(c.confirmacao_enviada_em)}` : " · ainda sem mensagem"}</>}
                  acoesEmbaixo
                  lado={<span className="flex gap-2"><Botao onClick={(e) => { e.preventDefault(); void pedirConfirmacao(c); }}><MessageCircle size={16} aria-hidden /> WhatsApp</Botao><Botao cheio onClick={(e) => { e.preventDefault(); void confirmar(c.id); }}>Confirmou</Botao></span>} />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>

      <Bloco titulo="Retornos: quem precisa voltar" id="retornos" lado={d?.retornos.length || undefined}>
        {!d ? <OssoLinha n={2} /> : d.retornos.length === 0 ? <Vazio titulo="Ninguém atrasado." sub="Retornos aparecem aqui 30 dias antes da data prevista." /> : (
          <Lista>
            {d.retornos.map((ret) => {
              const atrasado = ret.previsto_para < hojeCivil();
              return (
                <Item key={ret.id}>
                  <Linha marca={atrasado ? "escalada" : ret.status === "contatado" ? "voce" : "anel"} href={`/pacientes/${ret.paciente_id}`} titulo={ret.paciente?.nome ?? "Paciente"}
                    sub={<>{ret.motivo} · previsto {diaCurto(`${ret.previsto_para}T12:00:00-03:00`)}{atrasado ? " · atrasado" : ""}{ret.status === "contatado" ? " · já chamado" : ""}</>}
                    acoesEmbaixo
                    lado={<span className="flex gap-2">
                      <Botao cheio onClick={(e) => { e.preventDefault(); void chamarRetorno(ret); }}><MessageCircle size={16} aria-hidden /> Chamar</Botao>
                      <Link href={`/agenda`} className="a-botao pressa inline-flex items-center" onClick={() => void atualizarRetorno(ret.id, "agendado")}>Marcar</Link>
                      <Botao onClick={(e) => { e.preventDefault(); void mudarRetorno(ret, "descartado"); }}>Descartar</Botao>
                    </span>} />
                </Item>
              );
            })}
          </Lista>
        )}
      </Bloco>

      <Bloco titulo="Orçamentos" id="orcamentos" lado={d?.lista_orcamentos.length || undefined}>
        {!d ? <OssoLinha n={3} /> : d.lista_orcamentos.length === 0 ? <Vazio titulo="Nenhum orçamento ainda." sub="Crie na ficha do paciente, aba Orçamentos." /> : (
          <Lista>
            {d.lista_orcamentos.map((o) => (
              <Item key={o.id}>
                <Linha marca={o.status === "aprovado" ? "feito" : o.status === "recusado" ? "falta" : "anel"} href={`/pacientes/${o.paciente?.id}`} titulo={<>{o.paciente?.nome} <span className={`chip ${CHIP[o.status]} ml-2 align-middle`}>{o.status}</span></>}
                  sub={<>{o.titulo} · {diaCurto(o.criado_em)}</>} meta={reais(o.total)} acoesEmbaixo
                  lado={o.status === "pendente" ? <span className="flex gap-2"><Botao cheio onClick={(e) => { e.preventDefault(); void decidir(o.id, "aprovado"); }}>Aprovar</Botao><Botao onClick={(e) => { e.preventDefault(); void decidir(o.id, "recusado"); }}>Recusar</Botao></span> : <Botao onClick={(e) => { e.preventDefault(); void decidir(o.id, "pendente"); }}>Reabrir</Botao>} />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>

      <Bloco titulo="Faltas nos últimos 60 dias" id="faltas" lado={d?.faltas_lista.length || undefined}>
        {!d ? <OssoLinha n={2} /> : d.faltas_lista.length === 0 ? <Vazio titulo="Ninguém faltou." /> : (
          <Lista>
            {d.faltas_lista.map((f) => (
              <Item key={f.id}>
                <Linha marca="falta" href={`/pacientes/${f.paciente.id}`} titulo={f.paciente.nome} sub={<>{diaCurto(f.inicio)} às {hora(f.inicio)} · {f.tipo} · {telefoneBonito(f.paciente.telefone_e164)}</>}
                  lado={<a className="a-botao pressa inline-flex items-center gap-1.5" href={`https://wa.me/${f.paciente.telefone_e164.replace(/\D/g, "")}?text=${encodeURIComponent(textoFalta(f.paciente.nome, f.tipo))}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}><MessageCircle size={16} aria-hidden /> Remarcar</a>} />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>
    </Pagina>
  );
}
