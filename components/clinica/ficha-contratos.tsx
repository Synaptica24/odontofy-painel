"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Plus } from "lucide-react";
import { cancelarContrato, enviarContrato, gerarContrato, listarModelos, urlContrato } from "@/lib/api";
import type { Contrato, ContratoModelo, Prontuario } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { AreaTexto, Bloco, Botao, Campo, Entrada, Item, Linha, Lista, Vazio } from "@/components/ui/primitivos";
import { Chip, Folha, STATUS_CONTRATO, dataHoraBonita, linkWhatsApp } from "./ficha-util";
import type { VariaveisContrato } from "./ficha-orcamentos";

/* Contratos do paciente: gerar a partir de modelo (variáveis {{nome_paciente}}, {{cpf}}, {{tratamento}},
   {{valor}}, {{data}}…), enviar link de assinatura, ver PDF original e assinado. */
export function FichaContratos({ d, definir, variaveisIniciais, aoConsumirVariaveis }: { d: Prontuario; definir: (fn: (x: Prontuario) => Prontuario) => void; variaveisIniciais?: VariaveisContrato | null; aoConsumirVariaveis?: () => void }) {
  const [novoManual, setNovo] = useState(false);
  const [link, setLink] = useState<{ contrato: Contrato; link: string } | null>(null);
  // Vindo de "Gerar contrato a partir deste orçamento", a folha abre sozinha com as variáveis preenchidas.
  const novo = novoManual || !!variaveisIniciais;

  async function abrir(c: Contrato, assinado: boolean) {
    const res = await urlContrato(c.id, assinado);
    if (!res.sucesso) { toast.error("Não foi possível abrir o PDF.", { description: res.erro.mensagem }); return; }
    window.open(res.dados.url, "_blank", "noopener");
  }
  async function enviar(c: Contrato) {
    const res = await enviarContrato(c.id);
    if (!res.sucesso) { toast.error("Não gerou o link.", { description: res.erro.mensagem }); return; }
    definir((x) => ({ ...x, contratos: x.contratos.map((k) => (k.id === c.id ? { ...k, ...res.dados } : k)) }));
    setLink({ contrato: res.dados, link: res.dados.link });
  }
  async function cancelar(c: Contrato) {
    definir((x) => ({ ...x, contratos: x.contratos.map((k) => (k.id === c.id ? { ...k, status: "cancelado" } : k)) }));
    const res = await cancelarContrato(c.id);
    if (!res.sucesso) { definir((x) => ({ ...x, contratos: x.contratos.map((k) => (k.id === c.id ? c : k)) })); toast.error("Não cancelou.", { description: res.erro.mensagem }); return; }
    toast.success("Contrato cancelado.");
  }

  return (
    <>
      <Bloco titulo="Contratos e termos" id="contratos" lado={<Botao cheio onClick={() => setNovo(true)}><Plus size={16} /> Novo</Botao>} primeiro>
        {d.contratos.length === 0 ? (
          <Vazio titulo="Nenhum contrato ainda." sub="Gere um termo de consentimento ou contrato de tratamento a partir de um modelo." />
        ) : (
          <Lista>
            {d.contratos.map((c) => (
              <Item key={c.id}>
                <Linha
                  marca={c.status === "assinado" ? "feito" : c.status === "cancelado" ? "falta" : c.status === "enviado" ? "anel" : "nada"}
                  titulo={c.titulo}
                  sub={<><Chip cor={STATUS_CONTRATO[c.status].cor}>{STATUS_CONTRATO[c.status].rotulo}</Chip>{c.assinado_em && <span className="ml-1">assinado em {dataHoraBonita(c.assinado_em)}{c.assinatura ? ` por ${c.assinatura.nome}` : ""}</span>}{c.status === "enviado" && c.token_expira_em && <span className="ml-1 text-tinta-3">link vale até {dataHoraBonita(c.token_expira_em)}</span>}</>}
                  meta={dataHoraBonita(c.criado_em)}
                  acoesEmbaixo
                  lado={
                    <div className="flex flex-wrap gap-1 justify-end">
                      <Botao onClick={() => abrir(c, false)}>Ver PDF</Botao>
                      {c.status === "assinado" && c.pdf_assinado_caminho && <Botao cheio onClick={() => abrir(c, true)}>PDF assinado</Botao>}
                      {(c.status === "rascunho" || c.status === "enviado") && <Botao cheio={c.status === "rascunho"} onClick={() => enviar(c)}>{c.status === "enviado" ? "Novo link" : "Enviar para assinar"}</Botao>}
                      {(c.status === "rascunho" || c.status === "enviado") && <Botao alerta onClick={() => cancelar(c)}>Cancelar</Botao>}
                    </div>
                  }
                />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>
      {novo && (
        <FolhaNovoContrato d={d} variaveis={variaveisIniciais ?? undefined} aoFechar={() => { setNovo(false); aoConsumirVariaveis?.(); }}
          aoCriado={(c) => { definir((x) => ({ ...x, contratos: [c, ...x.contratos] })); setNovo(false); aoConsumirVariaveis?.(); }} />
      )}
      {link && (
        <Folha titulo="Link de assinatura" sub={link.contrato.titulo} aoFechar={() => setLink(null)}>
          <div className="folha__grade">
            <p className="text-[13px] text-tinta-2">O paciente abre o link no celular, confere o documento, digita nome e CPF e desenha a assinatura. O link vale por 48 horas.</p>
            <div className="flex gap-2">
              <Entrada readOnly value={link.link} onFocus={(e) => e.currentTarget.select()} />
              <Botao onClick={() => { void navigator.clipboard.writeText(link.link); toast.success("Link copiado."); }} aria-label="Copiar link"><Copy size={16} /></Botao>
            </div>
            <a className="a-botao a-botao--cheio a-botao--grande pressa inline-flex items-center justify-center" target="_blank" rel="noopener"
              href={linkWhatsApp(d.paciente.telefone_e164, `Olá, ${d.paciente.nome.split(" ")[0]}! Segue o documento para você conferir e assinar pelo celular: ${link.link}`)}>
              Mandar pelo WhatsApp
            </a>
          </div>
        </Folha>
      )}
    </>
  );
}

function FolhaNovoContrato({ d, variaveis, aoFechar, aoCriado }: { d: Prontuario; variaveis?: VariaveisContrato; aoFechar: () => void; aoCriado: (c: Contrato) => void }) {
  const modelos = useApi<ContratoModelo[]>(() => listarModelos(), []);
  const [modeloEscolhido, setModelo] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [tratamento, setTratamento] = useState(variaveis?.tratamento ?? "");
  const [valor, setValor] = useState(variaveis?.valor ?? "");
  const [parcelas, setParcelas] = useState(variaveis?.parcelas ?? "");
  const [gerando, setGerando] = useState(false);
  const lista = (modelos.dados ?? []).filter((m) => m.ativo);
  // Sem escolha explícita, o primeiro modelo ativo é o padrão; sem modelos, texto livre.
  const modelo = modeloEscolhido || lista[0]?.id || (modelos.fase === "pronto" ? "livre" : "");
  const escolhido = lista.find((m) => m.id === modelo);

  async function gerar() {
    if (modelo !== "livre" && !escolhido) { toast.error("Escolha um modelo."); return; }
    if (modelo === "livre" && (!titulo.trim() || !conteudo.trim())) { toast.error("Dê um título e escreva o texto."); return; }
    setGerando(true);
    const res = await gerarContrato({ paciente_id: d.paciente.id, modelo_id: modelo === "livre" ? null : modelo, titulo: titulo.trim() || undefined, conteudo: modelo === "livre" ? conteudo : undefined, variaveis: { tratamento, valor, parcelas } });
    setGerando(false);
    if (!res.sucesso) { toast.error("Não gerou o contrato.", { description: res.erro.mensagem }); return; }
    toast.success("Contrato gerado em PDF.");
    aoCriado(res.dados);
  }

  return (
    <Folha titulo="Novo contrato" sub={`Para ${d.paciente.nome}`} aoFechar={aoFechar}
      acoes={<><Botao cheio onClick={gerar} disabled={gerando || modelos.fase === "carregando"}>{gerando ? "Gerando PDF…" : "Gerar PDF"}</Botao><Botao onClick={aoFechar}>Cancelar</Botao></>}>
      <div className="folha__grade">
        {modelos.fase === "pronto" && lista.length === 0 && (
          <p className="a-vazio" style={{ marginTop: 0 }}>Nenhum modelo cadastrado. Crie modelos em <b>Ajustes → Contratos</b> ou escreva um texto livre abaixo.</p>
        )}
        <Campo rotulo="Modelo">
          <select className="a-entrada a-select" value={modelo} onChange={(e) => setModelo(e.target.value)}>
            {lista.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            <option value="livre">Texto livre (sem modelo)</option>
          </select>
        </Campo>
        <Campo rotulo="Título" dica={modelo !== "livre" ? "Vazio = nome do modelo" : undefined}><Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={escolhido?.nome ?? "Ex.: Termo de consentimento"} /></Campo>
        {modelo === "livre" && (
          <Campo rotulo="Texto do documento" dica="Pode usar {{nome_paciente}}, {{cpf}}, {{tratamento}}, {{valor}}, {{data}}">
            <AreaTexto rows={8} value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
          </Campo>
        )}
        <div className="variaveis">
          {["nome_paciente", "cpf", "nascimento", "telefone", "endereco", "tratamento", "valor", "parcelas", "data", "data_extenso", "profissional", "cro", "consultorio"].map((v) => <code key={v}>{`{{${v}}}`}</code>)}
        </div>
        <Campo rotulo="Tratamento" dica="Preenche {{tratamento}}"><AreaTexto rows={2} value={tratamento} onChange={(e) => setTratamento(e.target.value)} /></Campo>
        <div className="folha__grade folha__grade--2">
          <Campo rotulo="Valor" dica="Preenche {{valor}}"><Entrada value={valor} onChange={(e) => setValor(e.target.value)} placeholder="R$ 0,00" /></Campo>
          <Campo rotulo="Parcelas" dica="Preenche {{parcelas}}"><Entrada value={parcelas} onChange={(e) => setParcelas(e.target.value)} placeholder="Ex.: 3× sem juros" /></Campo>
        </div>
        {escolhido && <details className="text-[13px] text-tinta-2"><summary className="cursor-pointer">Ver texto do modelo</summary><pre className="contrato__pre mt-2">{escolhido.conteudo}</pre></details>}
      </div>
    </Folha>
  );
}
