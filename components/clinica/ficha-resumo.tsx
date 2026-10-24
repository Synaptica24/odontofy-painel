"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { atualizarRetorno, criarRetorno } from "@/lib/api";
import type { Prontuario, Retorno } from "@/lib/contratos";
import { diaCurto, hojeCivil, hora, reais, telefoneExibicao } from "@/components/dados/datas";
import { Bloco, Botao, Campo, Entrada, Item, Linha, Lista, Vazio } from "@/components/ui/primitivos";
import { alertasAnamnese } from "./ficha-anamnese";
import { Chip, STATUS_AGENDAMENTO, STATUS_ORCAMENTO, STATUS_RETORNO, cpfBonito, dataCivilBonita, dataHoraBonita, hojeCivilLocal, linkWhatsApp } from "./ficha-util";
import { telefoneBonito } from "@/components/dados/datas";

const SEXO: Record<string, string> = { masculino: "Masculino", feminino: "Feminino", outro: "Outro" };
/** Cadastro completo (o que o Codental mostra em "Informações"): só o que está preenchido aparece. */
function DadosCadastrais({ p }: { p: Prontuario["paciente"] }) {
  const linhas: [string, string | null | undefined][] = [
    ["Código", p.codental_numero ? `${p.codental_numero}${p.codental_id ? ` (Codental ${p.codental_id})` : ""}` : null],
    ["Nascimento", dataCivilBonita(p.nascimento) || null],
    ["Sexo", p.sexo ? SEXO[p.sexo] : null],
    ["CPF", p.cpf ? cpfBonito(p.cpf) : null],
    ["RG", p.rg],
    ["Profissão", p.profissao],
    ["E-mail", p.email],
    ["Celular", p.telefone_e164 ? telefoneBonito(p.telefone_e164) : p.telefone_contato ? `${telefoneBonito(p.telefone_contato)} (compartilhado)` : null],
    ["Telefone fixo", p.telefone_fixo],
    ["Endereço", p.endereco],
    ["Responsável", p.responsavel_nome ? `${p.responsavel_nome}${p.responsavel_documento ? ` · ${p.responsavel_documento}` : ""}${p.responsavel_nascimento ? ` · ${dataCivilBonita(p.responsavel_nascimento)}` : ""}` : null],
    ["Emergência", p.emergencia_nome ? `${p.emergencia_nome}${p.emergencia_telefone ? ` · ${p.emergencia_telefone}` : ""}` : null],
    ["Convênio", p.convenio ? `${p.convenio.nome}${p.numero_carteirinha ? ` · carteirinha ${p.numero_carteirinha}` : ""}${p.convenio_titular ? ` · titular ${p.convenio_titular}` : ""}` : "Particular"],
    ["Como conheceu", p.como_conheceu],
    ["Observações", p.observacoes],
    ["Bloco de notas (Codental)", p.notas_codental],
  ];
  const cheias = linhas.filter(([, v]) => v);
  return (
    <dl className="dados-cadastrais">
      {cheias.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd className={/CPF|RG|Celular|Telefone|Código|Nascimento/.test(k) ? "num" : undefined}>{v}</dd></div>
      ))}
    </dl>
  );
}

type Aba = "anamnese" | "evolucao" | "orcamentos" | "consultas";

/* Resumo: o que precisa saltar aos olhos antes de atender. */
export function FichaResumo({ d, definir, irPara }: { d: Prontuario; definir: (fn: (x: Prontuario) => Prontuario) => void; irPara: (aba: Aba) => void }) {
  const alertas = alertasAnamnese(d.anamnese);
  const [agora] = useState(() => Date.now());
  const proxima = d.agendamentos.filter((a) => new Date(a.inicio).getTime() >= agora && !["cancelado", "faltou", "concluido"].includes(a.status)).sort((a, b) => (a.inicio < b.inicio ? -1 : 1))[0];
  const ultima = d.evolucoes.find((e) => !d.evolucoes.some((c) => c.corrige_id === e.id));
  const pendentes = d.orcamentos.filter((o) => o.status === "pendente");
  const retornos = d.retornos.filter((r) => r.status === "pendente" || r.status === "contatado");
  const [novoRetorno, setNovoRetorno] = useState(false);
  const [motivo, setMotivo] = useState("Limpeza semestral");
  const [data, setData] = useState(() => hojeCivilLocal(180));
  const [hoje] = useState(() => hojeCivilLocal());

  async function criar() {
    if (!motivo.trim() || !data) return;
    const res = await criarRetorno(d.paciente.id, motivo.trim(), data);
    if (!res.sucesso) { toast.error("Não criou o retorno.", { description: res.erro.mensagem }); return; }
    definir((x) => ({ ...x, retornos: [...x.retornos, res.dados] }));
    setNovoRetorno(false);
    toast.success("Retorno anotado.");
  }
  async function mudarRetorno(r: Retorno, status: Retorno["status"]) {
    definir((x) => ({ ...x, retornos: x.retornos.map((k) => (k.id === r.id ? { ...k, status } : k)) }));
    const res = await atualizarRetorno(r.id, status);
    if (!res.sucesso) { definir((x) => ({ ...x, retornos: x.retornos.map((k) => (k.id === r.id ? r : k)) })); toast.error("Não atualizou.", { description: res.erro.mensagem }); }
  }

  return (
    <div className="ficha__duas">
      <div className="grid gap-4 content-start">
        <Bloco titulo="Atenção antes de atender" id="alertas" primeiro>
          {d.anamnese === null ? (
            <Vazio titulo="Anamnese ainda não preenchida." sub={<button type="button" className="underline" onClick={() => irPara("anamnese")}>Preencher agora</button>} icone={<span className="marca marca--anel" />} />
          ) : alertas.length === 0 ? (
            <Vazio titulo="Sem alertas na anamnese." sub="Nenhuma alergia ou condição marcada." />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {alertas.map((a) => <Chip key={a.texto} cor={a.cor}>{a.texto}</Chip>)}
            </div>
          )}
          {d.anamnese?.queixa_principal && <p className="mt-3 text-[13px] text-tinta-2"><b className="text-tinta">Queixa:</b> {d.anamnese.queixa_principal}</p>}
        </Bloco>

        <Bloco titulo="Próxima consulta" id="proxima">
          {proxima ? (
            <Lista>
              <Item>
                <Linha
                  marca={proxima.status === "confirmado" ? "feito" : proxima.status === "sugerido" ? "anel" : "voce"}
                  href={`/agenda?data=${hojeCivil(new Date(proxima.inicio))}`}
                  titulo={<span className="num">{diaCurto(proxima.inicio)} · {hora(proxima.inicio)}</span>}
                  sub={`${proxima.tipo}${proxima.profissional ? ` · ${proxima.profissional}` : ""}`}
                  lado={<Chip cor={STATUS_AGENDAMENTO[proxima.status].cor}>{STATUS_AGENDAMENTO[proxima.status].rotulo}</Chip>}
                />
              </Item>
            </Lista>
          ) : (
            <Vazio titulo="Nada marcado." sub={<Link href="/agenda" className="underline">Marcar na agenda</Link>} icone={<span className="marca" />} />
          )}
        </Bloco>

        <Bloco titulo="Última evolução" id="ultima" lado={ultima ? <button type="button" className="underline" onClick={() => irPara("evolucao")}>ver todas</button> : undefined}>
          {ultima ? (
            <div>
              <p className="text-[12px] text-tinta-3 num">{dataHoraBonita(ultima.criado_em)}{ultima.profissional ? ` · ${ultima.profissional}` : ""}</p>
              <p className="mt-1 whitespace-pre-wrap">{ultima.texto}</p>
            </div>
          ) : (
            <Vazio titulo="Nenhuma evolução registrada." sub={<button type="button" className="underline" onClick={() => irPara("evolucao")}>Registrar a primeira</button>} icone={<span className="marca" />} />
          )}
        </Bloco>
      </div>

      <div className="grid gap-4 content-start">
        <Bloco titulo="Retornos" id="retornos" lado={<Botao onClick={() => setNovoRetorno((v) => !v)}>{novoRetorno ? "Fechar" : "Anotar retorno"}</Botao>}>
          {novoRetorno && (
            <div className="grid gap-2 mb-3 pb-3 border-b border-pauta">
              <Campo rotulo="Motivo"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
              <Campo rotulo="Previsto para"><Entrada type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
              <Botao cheio onClick={criar}>Anotar</Botao>
            </div>
          )}
          {retornos.length === 0 ? (
            <Vazio titulo="Nenhum retorno pendente." sub="Ex.: limpeza a cada 6 meses." />
          ) : (
            <Lista>
              {retornos.map((r) => {
                const atrasado = r.previsto_para < hoje;
                return (
                  <Item key={r.id}>
                    <Linha
                      marca={atrasado ? "escalada" : "anel"}
                      alerta={atrasado}
                      titulo={r.motivo}
                      sub={`${atrasado ? "venceu em" : "previsto para"} ${dataCivilBonita(r.previsto_para)} · ${STATUS_RETORNO[r.status]}`}
                      acoesEmbaixo
                      lado={
                        <div className="flex gap-1 flex-wrap justify-end">
                          <a className="a-botao a-botao--cheio pressa inline-flex items-center" target="_blank" rel="noopener" href={linkWhatsApp(telefoneExibicao(d.paciente), `Olá, ${d.paciente.nome.split(" ")[0]}! Aqui é do consultório do Dr. Mateus. Está na hora do seu retorno (${r.motivo.toLowerCase()}). Quer que eu veja um horário para você?`)}
                            onClick={() => { if (r.status === "pendente") void mudarRetorno(r, "contatado"); }}>
                            Chamar no WhatsApp
                          </a>
                          <Botao onClick={() => mudarRetorno(r, "descartado")}>Descartar</Botao>
                        </div>
                      }
                    />
                  </Item>
                );
              })}
            </Lista>
          )}
        </Bloco>

        <Bloco titulo="Informações" id="informacoes">
          <DadosCadastrais p={d.paciente} />
        </Bloco>

        <Bloco titulo="Orçamentos pendentes" id="orc-pendentes" lado={<button type="button" className="underline" onClick={() => irPara("orcamentos")}>ver todos</button>}>
          {pendentes.length === 0 ? (
            <Vazio titulo="Nada esperando decisão." />
          ) : (
            <Lista>
              {pendentes.map((o) => (
                <Item key={o.id}>
                  <Linha marca="anel" titulo={o.titulo} sub={`${o.itens.length} ${o.itens.length === 1 ? "item" : "itens"} · ${dataHoraBonita(o.criado_em)}`} lado={<span className="num">{reais(o.total)} <Chip cor={STATUS_ORCAMENTO[o.status].cor}>{STATUS_ORCAMENTO[o.status].rotulo}</Chip></span>} onClick={() => irPara("orcamentos")} />
                </Item>
              ))}
            </Lista>
          )}
        </Bloco>
      </div>
    </div>
  );
}
