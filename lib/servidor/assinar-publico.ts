import 'server-only';
import { clienteAdmin } from '../supabase/server';
import { cpfValido, gerarPdfAssinado } from './assinatura';
import type { CodigoErro, ResultadoApi } from '../contratos';

/* Assinatura pelo paciente, sem sessão: tudo aqui roda com service role, validado pelo token do contrato.
 *
 * Como plugar um provedor externo (ZapSign, Clicksign) mais tarde:
 *  1. Implementar a interface ProvedorAssinatura (lib/servidor/assinatura.ts) em lib/servidor/provedor-zapsign.ts:
 *     criarEnvelope() sobe o PDF na API do provedor e devolve { link, referencia }.
 *  2. Trocar provedorAssinatura() para devolver o novo provedor quando a chave de API existir no ambiente.
 *  3. enviarContrato (lib/servidor/clinica.ts) já grava provedor e provedor_referencia no contrato e manda o link do provedor.
 *  4. Criar app/api/assinar/webhook/[provedor]/route.ts: valida a assinatura HMAC do provedor, baixa o PDF assinado,
 *     sobe em contratos/<consultorio>/<paciente>/<id>-assinado.pdf e chama concluirAssinaturaExterna() abaixo.
 *  5. A página pública /assinar/[token] e o POST interno recusam contratos cujo provedor !== 'interno' (já feito aqui).
 */

export interface ContratoPublico {
  id: string; titulo: string; conteudo: string; status: string; provedor: string;
  consultorio: string; profissional: string; assinado_em: string | null; expirado: boolean;
}

type Linha = {
  id: string; consultorio_id: string; paciente_id: string; titulo: string; conteudo: string; status: string; provedor: string;
  token_expira_em: string | null; pdf_caminho: string | null; pdf_assinado_caminho: string | null; assinado_em: string | null;
};

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const erro = (codigo: CodigoErro, mensagem: string): ResultadoApi<never> => ({ sucesso: false, dados: null, erro: { codigo, mensagem } });

async function porToken(token: string): Promise<Linha | null> {
  if (!TOKEN.test(token)) return null;
  const admin = clienteAdmin();
  const { data } = await admin.from('contratos').select('id,consultorio_id,paciente_id,titulo,conteudo,status,provedor,token_expira_em,pdf_caminho,pdf_assinado_caminho,assinado_em').eq('token', token).maybeSingle();
  return (data as Linha | null) ?? null;
}

export async function contratoPublico(token: string): Promise<ResultadoApi<ContratoPublico & { pdf_url: string | null }>> {
  const c = await porToken(token);
  if (!c) return erro('nao_encontrado', 'Este link não é válido. Peça um novo link ao consultório.');
  const admin = clienteAdmin();
  const [{ data: cons }, { data: prof }] = await Promise.all([
    admin.from('consultorios').select('nome').eq('id', c.consultorio_id).maybeSingle(),
    admin.from('profissionais').select('nome').eq('consultorio_id', c.consultorio_id).order('ordem').limit(1).maybeSingle(),
  ]);
  const expirado = c.status === 'enviado' && !!c.token_expira_em && Date.parse(c.token_expira_em) < Date.now();
  const caminho = c.status === 'assinado' ? c.pdf_assinado_caminho : c.pdf_caminho;
  let pdf_url: string | null = null;
  if (caminho && !expirado) {
    const { data } = await admin.storage.from('contratos').createSignedUrl(caminho, 900);
    pdf_url = data?.signedUrl ?? null;
  }
  return {
    sucesso: true, erro: null,
    dados: { id: c.id, titulo: c.titulo, conteudo: c.conteudo, status: c.status, provedor: c.provedor, consultorio: cons?.nome ?? 'Consultório', profissional: prof?.nome ?? '', assinado_em: c.assinado_em, expirado, pdf_url },
  };
}

/* Limite de tentativas por token: contagem em memória do processo (reinicia a cada deploy; suficiente
   para barrar força bruta no CPF/aceite. Para algo persistente, mover para uma tabela). */
const tentativas = new Map<string, number>();
const LIMITE_TENTATIVAS = 5;

export interface EntradaAssinatura { nome: string; cpf: string; aceite: boolean; imagem_png: string; ip: string; user_agent: string }

export async function assinarPorToken(token: string, entrada: EntradaAssinatura): Promise<ResultadoApi<{ assinado_em: string }>> {
  const c = await porToken(token);
  if (!c) return erro('nao_encontrado', 'Este link não é válido. Peça um novo link ao consultório.');
  if ((tentativas.get(c.id) ?? 0) >= LIMITE_TENTATIVAS) return erro('nao_autorizado', 'Muitas tentativas. Peça um novo link ao consultório.');
  const falha = (mensagem: string) => { tentativas.set(c.id, (tentativas.get(c.id) ?? 0) + 1); return erro('validacao', mensagem); };

  if (c.status === 'assinado') return erro('conflito', 'Este documento já foi assinado.');
  if (c.status !== 'enviado' || !c.token_expira_em || Date.parse(c.token_expira_em) < Date.now()) return erro('nao_autorizado', 'Este link expirou. Peça um novo link ao consultório.');
  if (c.provedor !== 'interno') return erro('conflito', `Este documento é assinado pelo provedor ${c.provedor}.`); // TODO: redirecionar ao provedor
  const nome = String(entrada.nome ?? '').trim().replace(/\s+/g, ' ');
  if (nome.length < 3 || nome.length > 120 || !/\s/.test(nome)) return falha('Escreva seu nome completo.');
  const cpf = String(entrada.cpf ?? '').replace(/\D/g, '');
  if (!cpfValido(cpf)) return falha('CPF inválido. Confira os números.');
  if (entrada.aceite !== true) return falha('É preciso marcar que leu e concorda com o documento.');
  const imagem = String(entrada.imagem_png ?? '');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]{200,}$/.test(imagem) || imagem.length > 300 * 1024) return falha('Desenhe sua assinatura no quadro.');
  if (!c.pdf_caminho) return erro('indisponivel', 'O PDF deste documento não está disponível. Avise o consultório.');

  const admin = clienteAdmin();
  const { data: original, error: eDown } = await admin.storage.from('contratos').download(c.pdf_caminho);
  if (eDown || !original) return erro('indisponivel', 'Não foi possível abrir o documento agora. Tente de novo em instantes.');
  const assinado_em = new Date().toISOString();
  const ip = String(entrada.ip ?? '').slice(0, 64);
  const user_agent = String(entrada.user_agent ?? '').slice(0, 300);
  const { pdf, hash_original } = await gerarPdfAssinado(new Uint8Array(await original.arrayBuffer()), { nome, cpf, ip, user_agent, assinado_em, imagem_png: imagem });
  const caminho = `${c.consultorio_id}/${c.paciente_id}/${c.id}-assinado.pdf`;
  const { error: eUp } = await admin.storage.from('contratos').upload(caminho, Buffer.from(pdf), { contentType: 'application/pdf', upsert: true });
  if (eUp) return erro('indisponivel', 'Não foi possível guardar o documento assinado. Tente de novo.');
  const assinatura = { nome, cpf, ip, user_agent, assinado_em, hash_documento: hash_original };
  const { error: eUpd } = await admin.from('contratos')
    // O token fica: depois de assinado ele só serve para o paciente reabrir o link e baixar o PDF assinado
    // (assinar de novo é recusado pelo status). token_expira_em fica também, mas só vale para o estado 'enviado'.
    .update({ status: 'assinado', assinatura, assinado_em, pdf_assinado_caminho: caminho })
    .eq('id', c.id).eq('status', 'enviado');
  if (eUpd) return erro('indisponivel', 'Não foi possível registrar a assinatura. Tente de novo.');
  await admin.from('acessos_prontuario').insert({ consultorio_id: c.consultorio_id, paciente_id: c.paciente_id, user_id: null, acao: 'assinou_contrato', detalhe: `${c.titulo} · ${nome}`, ip });
  tentativas.delete(c.id);
  return { sucesso: true, dados: { assinado_em }, erro: null };
}

/** Ponto de chegada do webhook de um provedor externo (ver comentário no topo). */
export async function concluirAssinaturaExterna(contratoId: string, dados: { pdf_assinado_caminho: string; assinatura: Record<string, string> }) {
  const admin = clienteAdmin();
  const assinado_em = new Date().toISOString();
  return admin.from('contratos').update({ status: 'assinado', assinado_em, pdf_assinado_caminho: dados.pdf_assinado_caminho, assinatura: { ...dados.assinatura, assinado_em } }).eq('id', contratoId).eq('status', 'enviado');
}
