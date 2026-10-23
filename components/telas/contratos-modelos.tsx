"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Plus, Trash2, X } from "lucide-react";
import { excluirModelo, listarModelos, salvarModelo } from "@/lib/api";
import type { ContratoModelo } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { diaCurto } from "@/components/dados/datas";
import { AreaTexto, Bloco, Botao, Cabecalho, Campo, Entrada, Erro, Interruptor, Linha, Lista, Item, OssoLinha, Pagina, Vazio } from "@/components/ui/primitivos";

/* Modelos de contrato/termo com variáveis {{...}}. Gerar a partir da ficha do paciente fica na aba Contratos da ficha. */

const VARIAVEIS: { chave: string; rotulo: string; exemplo: string }[] = [
  { chave: "nome_paciente", rotulo: "Nome do paciente", exemplo: "Paciente Exemplo da Silva" },
  { chave: "cpf", rotulo: "CPF", exemplo: "000.000.000-00" },
  { chave: "telefone", rotulo: "Telefone", exemplo: "+55 11 90000-0000" },
  { chave: "email", rotulo: "E-mail", exemplo: "paciente@exemplo.com" },
  { chave: "endereco", rotulo: "Endereço", exemplo: "Rua Exemplo, 100" },
  { chave: "nascimento", rotulo: "Nascimento", exemplo: "01/01/1990" },
  { chave: "tratamento", rotulo: "Tratamento", exemplo: "Restauração em resina no dente 36" },
  { chave: "valor", rotulo: "Valor", exemplo: "R$ 350,00" },
  { chave: "parcelas", rotulo: "Parcelas", exemplo: "3x de R$ 116,67" },
  { chave: "data", rotulo: "Data", exemplo: "23/10/2026" },
  { chave: "data_extenso", rotulo: "Data por extenso", exemplo: "23 de outubro de 2026" },
  { chave: "consultorio", rotulo: "Consultório", exemplo: "Consultório Dr. Mateus Peixoto" },
  { chave: "profissional", rotulo: "Profissional", exemplo: "Dr. Mateus Peixoto" },
  { chave: "cro", rotulo: "CRO", exemplo: "CRO-SP 00000" },
];

export const MODELOS_PADRAO: { nome: string; conteudo: string }[] = [
  {
    nome: "Termo de consentimento para tratamento odontológico",
    conteudo: `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO

Paciente: {{nome_paciente}}, CPF {{cpf}}, nascido(a) em {{nascimento}}, residente em {{endereco}}.
Profissional responsável: {{profissional}}, {{cro}}, em {{consultorio}}.

1. OBJETO
Declaro que fui informado(a), em linguagem clara, sobre o diagnóstico e o tratamento proposto: {{tratamento}}. Tive a oportunidade de fazer perguntas e todas foram respondidas de forma satisfatória.

2. PROCEDIMENTO E ALTERNATIVAS
Fui esclarecido(a) sobre em que consiste o procedimento, o número estimado de sessões, os cuidados antes e depois, e as alternativas de tratamento, inclusive a de não realizar nenhum tratamento, com seus respectivos riscos e benefícios.

3. RISCOS E LIMITAÇÕES
Estou ciente de que todo procedimento odontológico envolve riscos, entre eles: sensibilidade, dor ou desconforto temporários, sangramento, inchaço, reações à anestesia ou a medicamentos, infecção, necessidade de procedimentos complementares e, em casos raros, insucesso do tratamento. Entendo que a Odontologia não é uma ciência exata e que os resultados dependem também da minha colaboração, da minha saúde geral e das características biológicas do meu organismo.

4. OBRIGAÇÕES DO PACIENTE
Comprometo-me a informar todo o meu histórico de saúde, alergias e medicamentos em uso; a seguir as orientações recebidas; a comparecer às consultas marcadas; e a comunicar imediatamente qualquer alteração no meu estado de saúde.

5. VALOR E PAGAMENTO
O valor do tratamento é de {{valor}}, a ser pago da seguinte forma: {{parcelas}}. Valores de procedimentos adicionais que se tornem necessários serão combinados previamente.

6. FALTAS E REMARCAÇÕES
Consultas devem ser desmarcadas com pelo menos 24 horas de antecedência. Faltas sem aviso podem implicar remarcação para o próximo horário disponível.

7. DADOS PESSOAIS E IMAGEM
Autorizo o registro das informações clínicas, fotografias e radiografias necessárias ao tratamento, que serão guardadas em prontuário com sigilo, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). O uso de imagens para fins científicos ou de divulgação só ocorrerá mediante autorização específica e separada deste termo.

8. CONSENTIMENTO
Declaro que li e compreendi este termo, que minhas dúvidas foram esclarecidas e que consinto, de forma livre e consciente, com a realização do tratamento descrito. Sei que posso revogar este consentimento a qualquer momento, antes da realização do procedimento.

{{consultorio}}, {{data_extenso}}.

Assinatura do(a) paciente: {{nome_paciente}}
Profissional: {{profissional}} - {{cro}}`,
  },
  {
    nome: "Contrato de prestação de serviços odontológicos",
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS

CONTRATANTE: {{nome_paciente}}, CPF {{cpf}}, residente em {{endereco}}, telefone {{telefone}}, e-mail {{email}}.
CONTRATADO(A): {{profissional}}, cirurgião(ã)-dentista inscrito(a) no {{cro}}, com atendimento em {{consultorio}}.

As partes firmam o presente contrato, que se regerá pelas cláusulas a seguir.

CLÁUSULA 1 - DO OBJETO
O(A) CONTRATADO(A) prestará ao(à) CONTRATANTE os serviços odontológicos descritos no plano de tratamento aprovado: {{tratamento}}.

CLÁUSULA 2 - DO VALOR E DO PAGAMENTO
Pelos serviços, o(a) CONTRATANTE pagará o valor total de {{valor}}, na forma: {{parcelas}}. Procedimentos não previstos no plano serão orçados e aprovados antes da execução. O atraso no pagamento poderá suspender as etapas seguintes do tratamento, sem prejuízo das urgências.

CLÁUSULA 3 - DAS OBRIGAÇÕES DO(A) CONTRATADO(A)
Realizar os procedimentos com técnica e materiais adequados, em ambiente com biossegurança; manter sigilo profissional; informar o(a) CONTRATANTE sobre cada etapa; manter o prontuário atualizado; e emitir os documentos fiscais correspondentes.

CLÁUSULA 4 - DAS OBRIGAÇÕES DO(A) CONTRATANTE
Fornecer informações verdadeiras sobre sua saúde; seguir as orientações pré e pós-operatórias; comparecer às consultas; comunicar intercorrências; e efetuar os pagamentos nas datas combinadas.

CLÁUSULA 5 - DOS RISCOS E DO CONSENTIMENTO
O(A) CONTRATANTE declara ter sido informado(a) sobre os riscos, limitações e alternativas do tratamento, inclusive a possibilidade de resultados diferentes do esperado em razão de fatores biológicos individuais, e consente com a sua realização.

CLÁUSULA 6 - DAS FALTAS E REMARCAÇÕES
Consultas devem ser desmarcadas com antecedência mínima de 24 horas. Em caso de falta sem aviso, a consulta será remarcada para o próximo horário disponível, podendo haver atraso no cronograma do tratamento.

CLÁUSULA 7 - DA PROTEÇÃO DE DADOS
Os dados pessoais e de saúde do(a) CONTRATANTE serão tratados exclusivamente para a prestação dos serviços, guardados com segurança e sigilo, conforme a Lei 13.709/2018 (LGPD). Fotografias e radiografias integram o prontuário. Qualquer uso de imagem para divulgação dependerá de autorização específica, por escrito, revogável a qualquer tempo.

CLÁUSULA 8 - DA RESCISÃO
Qualquer das partes pode encerrar este contrato mediante comunicação por escrito. Em caso de desistência pelo(a) CONTRATANTE, serão devidos os valores das etapas já realizadas e dos materiais já adquiridos.

CLÁUSULA 9 - DO FORO
Fica eleito o foro da comarca do domicílio do(a) CONTRATANTE para dirimir eventuais dúvidas decorrentes deste contrato.

E, por estarem de acordo, as partes assinam o presente instrumento.

{{consultorio}}, {{data_extenso}}.

CONTRATANTE: {{nome_paciente}}
CONTRATADO(A): {{profissional}} - {{cro}}`,
  },
];

function preencherExemplo(conteudo: string) {
  return conteudo.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => VARIAVEIS.find((v) => v.chave === k)?.exemplo ?? `[${k}]`);
}

type Rascunho = { id?: string; nome: string; conteudo: string; ativo: boolean };

export function TelaContratosModelos() {
  const r = useApi(() => listarModelos(), []);
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const cursorPendente = useRef<number | null>(null);
  const conteudoAtual = editando?.conteudo;

  // depois que o React escreve o novo valor na textarea, devolve o cursor para logo após a variável inserida
  useEffect(() => {
    const el = area.current;
    if (cursorPendente.current === null || !el) return;
    const pos = cursorPendente.current;
    cursorPendente.current = null;
    el.focus();
    el.setSelectionRange(pos, pos);
  }, [conteudoAtual]);

  function inserir(chave: string) {
    const el = area.current;
    if (!el || !editando) return;
    const ini = el.selectionStart ?? el.value.length;
    const fim = el.selectionEnd ?? ini;
    const texto = `{{${chave}}}`;
    const novo = el.value.slice(0, ini) + texto + el.value.slice(fim);
    cursorPendente.current = ini + texto.length;
    setEditando({ ...editando, conteudo: novo });
  }

  async function salvar() {
    if (!editando) return;
    if (!editando.nome.trim() || !editando.conteudo.trim()) { toast.error("Dê um nome e escreva o conteúdo do modelo."); return; }
    setSalvando(true);
    const res = await salvarModelo(editando);
    setSalvando(false);
    if (!res.sucesso) { toast.error("O modelo não salvou.", { description: res.erro.mensagem }); return; }
    r.definir((atual) => (editando.id ? atual.map((m) => (m.id === res.dados.id ? res.dados : m)) : [...atual, res.dados]).sort((a, b) => a.nome.localeCompare(b.nome)));
    setEditando(null);
    toast.success(editando.id ? "Modelo atualizado." : "Modelo criado.");
  }
  async function criarPadrao(p: { nome: string; conteudo: string }) {
    const res = await salvarModelo({ nome: p.nome, conteudo: p.conteudo, ativo: true });
    if (!res.sucesso) { toast.error("Não foi possível criar o modelo.", { description: res.erro.mensagem }); return; }
    r.definir((atual) => [...atual, res.dados].sort((a, b) => a.nome.localeCompare(b.nome)));
    toast.success(`"${p.nome}" criado. Revise o texto antes de usar.`);
  }
  async function excluir(m: ContratoModelo) {
    const antes = r.dados ?? [];
    r.definir((atual) => atual.filter((x) => x.id !== m.id));
    setConfirmando(null);
    const res = await excluirModelo(m.id);
    if (!res.sucesso) { r.definir(() => antes); toast.error("Não foi possível excluir.", { description: res.erro.mensagem }); return; }
    toast.success("Modelo excluído.");
  }
  async function alternar(m: ContratoModelo, ativo: boolean) {
    r.definir((atual) => atual.map((x) => (x.id === m.id ? { ...x, ativo } : x)));
    const res = await salvarModelo({ id: m.id, nome: m.nome, conteudo: m.conteudo, ativo });
    if (!res.sucesso) { r.definir((atual) => atual.map((x) => (x.id === m.id ? { ...x, ativo: !ativo } : x))); toast.error("Não foi possível alterar."); }
  }

  const modelos = r.dados ?? [];
  const faltandoPadrao = MODELOS_PADRAO.filter((p) => !modelos.some((m) => m.nome === p.nome));

  return (
    <Pagina>
      <Cabecalho
        sobre={<Link href="/ajustes">Ajustes</Link>}
        titulo="Modelos de contrato"
        abaixo="Termos e contratos com variáveis entre chaves. Na ficha do paciente, o documento sai preenchido e vai para assinatura pelo celular."
        acao={<Botao cheio onClick={() => setEditando({ nome: "", conteudo: "", ativo: true })}><Plus size={16} aria-hidden /> Novo modelo</Botao>}
      />

      <Bloco titulo="Seus modelos" lado={modelos.length ? `${modelos.length}` : undefined} primeiro>
        {r.fase === "carregando" && <OssoLinha n={2} />}
        {r.fase === "erro" && <Erro mensagem={r.erro} tentar={r.recarregar} />}
        {r.fase === "pronto" && modelos.length === 0 && (
          <Vazio titulo="Nenhum modelo ainda." sub="Comece pelos padrões abaixo e ajuste o texto do seu jeito." icone={<FileText size={18} aria-hidden />} />
        )}
        {modelos.length > 0 && (
          <Lista>
            {modelos.map((m) => (
              <Item key={m.id}>
                <Linha
                  marca={m.ativo ? "feito" : "nada"}
                  titulo={m.nome}
                  sub={`${m.conteudo.length.toLocaleString("pt-BR")} caracteres · ${(m.conteudo.match(/\{\{/g) ?? []).length} variáveis`}
                  meta={`Atualizado ${diaCurto(m.atualizado_em)}`}
                  acoesEmbaixo
                  lado={
                    <span className="modelos__acoes">
                      <Interruptor ligado={m.ativo} aoMudar={(v) => alternar(m, v)} rotulo={`Modelo ${m.nome} ativo`} />
                      <Botao onClick={() => setEditando({ id: m.id, nome: m.nome, conteudo: m.conteudo, ativo: m.ativo })}>Editar</Botao>
                      {confirmando === m.id ? (
                        <>
                          <Botao alerta onClick={() => excluir(m)}>Confirmar exclusão</Botao>
                          <Botao onClick={() => setConfirmando(null)}>Manter</Botao>
                        </>
                      ) : (
                        <Botao aria-label={`Excluir ${m.nome}`} onClick={() => setConfirmando(m.id)}><Trash2 size={16} aria-hidden /></Botao>
                      )}
                    </span>
                  }
                />
              </Item>
            ))}
          </Lista>
        )}
      </Bloco>

      {faltandoPadrao.length > 0 && r.fase === "pronto" && (
        <Bloco titulo="Criar a partir do padrão">
          <p className="modelos__dica">Textos completos em português, com as variáveis já no lugar. Depois é só revisar.</p>
          <div className="modelos__padroes">
            {faltandoPadrao.map((p) => (
              <Botao key={p.nome} onClick={() => criarPadrao(p)}><FileText size={16} aria-hidden /> {p.nome}</Botao>
            ))}
          </div>
        </Bloco>
      )}

      <Bloco titulo="Variáveis disponíveis">
        <p className="modelos__dica">Escreva entre chaves duplas. Na geração, cada uma vira o dado do paciente ou do consultório. Linhas em MAIÚSCULAS ou começando com # viram títulos no PDF.</p>
        <div className="variaveis">
          {VARIAVEIS.map((v) => <code key={v.chave} title={v.rotulo}>{`{{${v.chave}}}`}</code>)}
        </div>
      </Bloco>

      {editando && (
        <>
          <div className="folha__fundo" onClick={() => setEditando(null)} aria-hidden />
          <div className="folha folha--larga" role="dialog" aria-modal="true" aria-labelledby="modelo-titulo">
            <div className="folha__cabeca">
              <div>
                <h2 id="modelo-titulo">{editando.id ? "Editar modelo" : "Novo modelo"}</h2>
                <p className="modelos__dica">Clique numa variável para inserir onde o cursor está.</p>
              </div>
              <button type="button" className="folha__fechar" onClick={() => setEditando(null)} aria-label="Fechar"><X size={18} aria-hidden /></button>
            </div>
            <div className="folha__grade">
              <Campo rotulo="Nome do modelo">
                <Entrada value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} maxLength={120} placeholder="Ex.: Termo de consentimento" autoFocus />
              </Campo>
              <div className="variaveis variaveis--clicaveis" aria-label="Inserir variável">
                {VARIAVEIS.map((v) => (
                  <button key={v.chave} type="button" onClick={() => inserir(v.chave)} title={v.rotulo}><code>{`{{${v.chave}}}`}</code></button>
                ))}
              </div>
              <div className="modelos__abas" role="tablist">
                <button type="button" role="tab" aria-selected={!previa} onClick={() => setPrevia(false)}>Texto</button>
                <button type="button" role="tab" aria-selected={previa} onClick={() => setPrevia(true)}>Pré-visualização</button>
              </div>
              {previa ? (
                <div className="contrato__pre modelos__previa">{preencherExemplo(editando.conteudo) || "Nada para mostrar ainda."}</div>
              ) : (
                <Campo rotulo="Conteúdo">
                  <AreaTexto ref={area} className="modelos__area" value={editando.conteudo} onChange={(e) => setEditando({ ...editando, conteudo: e.target.value })} rows={18} maxLength={60000} spellCheck />
                </Campo>
              )}
              <label className="modelos__ativo">
                <Interruptor ligado={editando.ativo} aoMudar={(v) => setEditando({ ...editando, ativo: v })} rotulo="Modelo ativo" />
                <span>Disponível para gerar contratos</span>
              </label>
            </div>
            <div className="folha__acoes">
              <Botao cheio onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar modelo"}</Botao>
              <Botao onClick={() => setEditando(null)}>Cancelar</Botao>
            </div>
          </div>
        </>
      )}
    </Pagina>
  );
}
