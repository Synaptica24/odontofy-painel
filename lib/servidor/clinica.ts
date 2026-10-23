import 'server-only';
import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { sessaoAutorizada } from '../supabase/server';
import { erroSeguro } from './painel';
import { gerarPdfContrato, preencherVariaveis, provedorAssinatura, formatarCpf } from './assinatura';
import type { Json, ResultadoApi } from '../contratos';

/* Operações clínicas (prontuário, agenda do painel, orçamentos, retornos, contratos, financeiro).
   Tudo roda com a sessão do usuário: a RLS por consultório decide o que ele enxerga. */

type Argumentos = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const objeto = (v: unknown): Argumentos => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw { code: '22023' }; return v as Argumentos; };
const texto = (v: unknown, limite = 20000, vazio = true): string => { if (typeof v !== 'string' || v.length > limite || (!vazio && !v.trim())) throw { code: '22023' }; return v; };
const id = (v: unknown): string => { const s = texto(v, 36); if (!UUID.test(s)) throw { code: '22023' }; return s; };
const idOpcional = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : id(v));
const numero = (v: unknown, min = 0, max = 1e9): number => { const n = typeof v === 'number' ? v : Number(v); if (!Number.isFinite(n) || n < min || n > max) throw { code: '22023' }; return n; };
const instante = (v: unknown): string => { const s = texto(v, 40); if (!Number.isFinite(Date.parse(s))) throw { code: '22023' }; return s; };
const civil = (v: unknown): string => { const s = texto(v, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw { code: '22023' }; return s; };
const booleano = (v: unknown, padrao = false): boolean => (v === undefined ? padrao : v === true || v === false ? v : (() => { throw { code: '22023' }; })());
const FACES = ['todas', 'V', 'L', 'M', 'D', 'O', 'I', 'P'];
const STATUS_ODONTO = ['existente', 'planejado', 'realizado'];

async function ipDoPedido() {
  try { const h = await headers(); return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim().slice(0, 64); } catch { return ''; }
}

export async function executarClinica(operacao: string, entrada: unknown): Promise<ResultadoApi<Json>> {
  try {
    const cliente = await sessaoAutorizada();
    const a = objeto(entrada);
    const rpc = async (nome: string, parametros: Argumentos = {}) => { const { data, error } = await cliente.rpc(nome, parametros); if (error) throw error; return data as Json; };
    const unico = async <T>(q: PromiseLike<{ data: T | null; error: unknown }>) => { const { data, error } = await q; if (error) throw error; return data as Json; };
    let dados: Json;
    switch (operacao) {
      /* ----- consultórios ----- */
      case 'meusConsultorios': dados = await rpc('meus_consultorios'); break;
      case 'escolherConsultorio': dados = await rpc('escolher_consultorio', { p_consultorio: id(a.id) }); break;
      case 'listarProfissionais': dados = await unico(cliente.from('profissionais').select('*').order('ordem').order('nome')); break;
      case 'salvarProfissional': {
        const p = objeto(a.profissional);
        const campos = { nome: texto(p.nome, 120, false), cro: texto(p.cro ?? '', 40), cor: texto(p.cor ?? '#1570EF', 9), ativo: booleano(p.ativo, true), ordem: numero(p.ordem ?? 0, 0, 999) };
        dados = await unico(p.id ? cliente.from('profissionais').update(campos).eq('id', id(p.id)).select().single() : cliente.from('profissionais').insert(campos).select().single()); break;
      }
      case 'listarConvenios': dados = await unico(cliente.from('convenios').select('*').order('nome')); break;
      case 'salvarConvenio': {
        const c = objeto(a.convenio);
        const campos = { nome: texto(c.nome, 80, false), cor: texto(c.cor ?? '#475467', 9), ativo: booleano(c.ativo, true) };
        dados = await unico(c.id ? cliente.from('convenios').update(campos).eq('id', id(c.id)).select().single() : cliente.from('convenios').insert(campos).select().single()); break;
      }
      case 'excluirConvenio': { const { error } = await cliente.from('convenios').delete().eq('id', id(a.id)); if (error) throw error; dados = null; break; }

      /* ----- pacientes e agenda ----- */
      case 'salvarPaciente': {
        const d = objeto(a.dados);
        if (d.telefone_e164 !== undefined && !/^\+[1-9][0-9]{7,14}$/.test(String(d.telefone_e164))) throw { code: '22023' };
        if (d.cpf !== undefined) { const l = String(d.cpf).replace(/\D/g, '').length; if (l !== 0 && l !== 11) throw { code: '22023' }; }
        dados = await rpc('salvar_paciente', { p_id: idOpcional(a.id), p_dados: d as Json }); break;
      }
      case 'criarAgendamento': {
        const n = objeto(a.dados);
        dados = await rpc('criar_agendamento_painel', {
          p_paciente: id(n.paciente_id), p_tipo: texto(n.tipo, 80, false), p_inicio: instante(n.inicio), p_duracao_min: numero(n.duracao_min, 5, 720),
          p_profissional: idOpcional(n.profissional_id), p_convenio: idOpcional(n.convenio_id), p_observacao: texto(n.observacao ?? '', 2000),
          p_valor: numero(n.valor ?? 0, 0, 1e7), p_status: n.status === 'confirmado' ? 'confirmado' : 'agendado',
        }); break;
      }
      case 'editarAgendamento': {
        const alt = objeto(a.alteracoes); const limpo: Argumentos = {};
        if (alt.tipo !== undefined) limpo.tipo = texto(alt.tipo, 80, false);
        if (alt.inicio !== undefined) limpo.inicio = instante(alt.inicio);
        if (alt.duracao_min !== undefined) limpo.duracao_min = numero(alt.duracao_min, 5, 720);
        if (alt.profissional_id !== undefined) limpo.profissional_id = idOpcional(alt.profissional_id) ?? '';
        if (alt.convenio_id !== undefined) limpo.convenio_id = idOpcional(alt.convenio_id) ?? '';
        if (alt.observacao !== undefined) limpo.observacao = texto(alt.observacao, 2000);
        if (alt.valor !== undefined) limpo.valor = numero(alt.valor, 0, 1e7);
        dados = await rpc('editar_agendamento', { p_id: id(a.id), p_alteracoes: limpo as Json }); break;
      }
      case 'concluirAgendamento': dados = await rpc('concluir_agendamento', { p_agendamento_id: id(a.id) }); break;
      case 'criarBloqueioPainel': dados = await rpc('criar_bloqueio_painel', { p_inicio: instante(a.inicio), p_fim: instante(a.fim), p_profissional: idOpcional(a.profissional_id), p_motivo: texto(a.motivo ?? '', 200) }); break;
      case 'removerBloqueio': dados = await rpc('remover_bloqueio', { p_id: id(a.id) }); break;
      case 'marcarConfirmacaoEnviada': dados = await rpc('marcar_confirmacao_enviada', { p_agendamento: id(a.id) }); break;
      case 'agendaFiltrada': {
        const data = civil(a.data); const dias = a.dias === 7 ? 7 : 1; const filtro = objeto(a.filtro ?? {});
        dados = await rpc('painel_leitura', { p_operacao: 'agenda', p_argumentos: { data, dias, filtro } }); break;
      }

      /* ----- prontuário ----- */
      case 'prontuario': {
        const pid = id(a.id);
        dados = await rpc('prontuario_completo', { p_paciente: pid });
        await rpc('registrar_acesso_prontuario', { p_paciente: pid, p_acao: 'visualizou', p_detalhe: 'ficha', p_ip: await ipDoPedido() });
        break;
      }
      case 'salvarAnamnese': {
        const an = objeto(a.anamnese); const pid = id(a.id);
        const campos = {
          paciente_id: pid, alergias: texto(an.alergias ?? '', 2000), medicamentos: texto(an.medicamentos ?? '', 2000), doencas: texto(an.doencas ?? '', 2000),
          gestante: booleano(an.gestante), fumante: booleano(an.fumante), diabetes: booleano(an.diabetes), hipertensao: booleano(an.hipertensao),
          cardiopatia: booleano(an.cardiopatia), anticoagulante: booleano(an.anticoagulante), cirurgias: texto(an.cirurgias ?? '', 2000),
          queixa_principal: texto(an.queixa_principal ?? '', 2000), observacoes: texto(an.observacoes ?? '', 4000), atualizado_em: new Date().toISOString(),
        };
        dados = await unico(cliente.from('anamneses').upsert(campos, { onConflict: 'paciente_id' }).select().single()); break;
      }
      case 'salvarItemOdontograma': {
        const it = objeto(a.item);
        const dente = numero(it.dente, 11, 48); if (dente % 10 < 1 || dente % 10 > 8) throw { code: '22023' };
        const face = texto(it.face ?? 'todas', 5); if (!FACES.includes(face)) throw { code: '22023' };
        const status = texto(it.status ?? 'planejado', 12); if (!STATUS_ODONTO.includes(status)) throw { code: '22023' };
        const campos = { paciente_id: id(it.paciente_id), dente, face, procedimento: texto(it.procedimento, 200, false), status, observacao: texto(it.observacao ?? '', 2000), valor: numero(it.valor ?? 0, 0, 1e7), profissional_id: idOpcional(it.profissional_id), realizado_em: status === 'realizado' ? new Date().toISOString() : null };
        dados = await unico(it.id ? cliente.from('odontograma').update(campos).eq('id', id(it.id)).select().single() : cliente.from('odontograma').insert(campos).select().single()); break;
      }
      case 'removerItemOdontograma': { const { error } = await cliente.from('odontograma').delete().eq('id', id(a.id)); if (error) throw error; dados = null; break; }
      case 'adicionarEvolucao': {
        const campos = { paciente_id: id(a.id), texto: texto(a.texto, 20000, false), profissional_id: idOpcional(a.profissional_id), agendamento_id: idOpcional(a.agendamento_id), corrige_id: idOpcional(a.corrige_id) };
        dados = await unico(cliente.from('evolucoes').insert(campos).select().single()); break;
      }
      case 'urlAnexo': {
        const { data: anexo, error } = await cliente.from('anexos').select('caminho,paciente_id,nome').eq('id', id(a.id)).single();
        if (error) throw error;
        const { data: url, error: erroUrl } = await cliente.storage.from('prontuario').createSignedUrl(anexo.caminho, 600);
        if (erroUrl) throw erroUrl;
        await rpc('registrar_acesso_prontuario', { p_paciente: anexo.paciente_id, p_acao: 'baixou', p_detalhe: anexo.nome, p_ip: await ipDoPedido() });
        dados = { url: url.signedUrl }; break;
      }
      case 'removerAnexo': {
        const { data: anexo, error } = await cliente.from('anexos').select('caminho').eq('id', id(a.id)).single();
        if (error) throw error;
        await cliente.storage.from('prontuario').remove([anexo.caminho]);
        const { error: e2 } = await cliente.from('anexos').delete().eq('id', id(a.id)); if (e2) throw e2; dados = null; break;
      }

      /* ----- orçamentos e retornos ----- */
      case 'salvarOrcamento': {
        const o = objeto(a.orcamento); const itens = Array.isArray(o.itens) ? o.itens : [];
        if (itens.length > 100) throw { code: '22023' };
        const cabecalho = { paciente_id: id(o.paciente_id), titulo: texto(o.titulo ?? 'Plano de tratamento', 120, false), desconto: numero(o.desconto ?? 0, 0, 1e7), observacao: texto(o.observacao ?? '', 4000), validade: o.validade ? civil(o.validade) : null, atualizado_em: new Date().toISOString() };
        const salvo = objeto(await unico(o.id ? cliente.from('orcamentos').update(cabecalho).eq('id', id(o.id)).select().single() : cliente.from('orcamentos').insert(cabecalho).select().single()));
        const oid = String(salvo.id);
        const { error: eDel } = await cliente.from('orcamento_itens').delete().eq('orcamento_id', oid); if (eDel) throw eDel;
        if (itens.length) {
          const linhas = itens.map((raw, i) => { const it = objeto(raw); return { orcamento_id: oid, descricao: texto(it.descricao, 200, false), dente: it.dente ? numero(it.dente, 11, 48) : null, quantidade: numero(it.quantidade ?? 1, 1, 999), valor_unitario: numero(it.valor_unitario ?? 0, 0, 1e7), ordem: i }; });
          const { error: eIns } = await cliente.from('orcamento_itens').insert(linhas); if (eIns) throw eIns;
        }
        dados = salvo as Json; break;
      }
      case 'decidirOrcamento': {
        const status = texto(a.status, 10); if (!['pendente', 'aprovado', 'recusado'].includes(status)) throw { code: '22023' };
        dados = await unico(cliente.from('orcamentos').update({ status, decidido_em: status === 'pendente' ? null : new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq('id', id(a.id)).select().single()); break;
      }
      case 'excluirOrcamento': { const { error } = await cliente.from('orcamentos').delete().eq('id', id(a.id)); if (error) throw error; dados = null; break; }
      case 'criarRetorno': dados = await unico(cliente.from('retornos').insert({ paciente_id: id(a.paciente_id), motivo: texto(a.motivo, 200, false), previsto_para: civil(a.previsto_para) }).select().single()); break;
      case 'atualizarRetorno': {
        const status = texto(a.status, 12); if (!['pendente', 'contatado', 'agendado', 'descartado'].includes(status)) throw { code: '22023' };
        dados = await unico(cliente.from('retornos').update({ status, contatado_em: status === 'contatado' ? new Date().toISOString() : undefined, agendamento_id: idOpcional(a.agendamento_id) ?? undefined }).eq('id', id(a.id)).select().single()); break;
      }
      case 'financeiroResumo': dados = await rpc('financeiro_resumo', { p_inicio: civil(a.inicio), p_fim: civil(a.fim) }); break;

      /* ----- contratos ----- */
      case 'listarModelos': dados = await unico(cliente.from('contrato_modelos').select('*').order('nome')); break;
      case 'salvarModelo': {
        const m = objeto(a.modelo);
        const campos = { nome: texto(m.nome, 120, false), conteudo: texto(m.conteudo, 60000, false), ativo: booleano(m.ativo, true), atualizado_em: new Date().toISOString() };
        dados = await unico(m.id ? cliente.from('contrato_modelos').update(campos).eq('id', id(m.id)).select().single() : cliente.from('contrato_modelos').insert(campos).select().single()); break;
      }
      case 'excluirModelo': { const { error } = await cliente.from('contrato_modelos').delete().eq('id', id(a.id)); if (error) throw error; dados = null; break; }
      case 'gerarContrato': {
        const pid = id(a.paciente_id); const extras = objeto(a.variaveis ?? {});
        const { data: paciente, error: eP } = await cliente.from('pacientes').select('nome,cpf,telefone_e164,email,endereco,nascimento').eq('id', pid).single(); if (eP) throw eP;
        let conteudoBase: string; let titulo: string; let modeloId: string | null = null;
        if (a.modelo_id) {
          const { data: modelo, error: eM } = await cliente.from('contrato_modelos').select('*').eq('id', id(a.modelo_id)).single(); if (eM) throw eM;
          conteudoBase = modelo.conteudo; titulo = texto(a.titulo ?? modelo.nome, 160, false); modeloId = modelo.id;
        } else { conteudoBase = texto(a.conteudo, 60000, false); titulo = texto(a.titulo, 160, false); }
        const { data: cons } = await cliente.from('consultorios').select('nome').limit(1).maybeSingle();
        const { data: prof } = await cliente.from('profissionais').select('nome,cro').order('ordem').limit(1).maybeSingle();
        const hoje = new Date();
        const variaveis: Record<string, string> = {
          nome_paciente: paciente.nome, cpf: paciente.cpf ? formatarCpf(paciente.cpf) : '', telefone: paciente.telefone_e164, email: paciente.email ?? '', endereco: paciente.endereco ?? '',
          nascimento: paciente.nascimento ? new Date(`${paciente.nascimento}T12:00:00-03:00`).toLocaleDateString('pt-BR') : '',
          data: hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }), data_extenso: hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' }),
          consultorio: cons?.nome ?? '', profissional: prof?.nome ?? '', cro: prof?.cro ?? '',
          tratamento: '', valor: '', parcelas: '',
        };
        for (const [k, v] of Object.entries(extras)) if (/^[a-zA-Z0-9_]{1,40}$/.test(k)) variaveis[k] = texto(v, 2000);
        const conteudo = preencherVariaveis(conteudoBase, variaveis);
        const { data: criado, error: eC } = await cliente.from('contratos').insert({ paciente_id: pid, modelo_id: modeloId, titulo, conteudo, variaveis, status: 'rascunho' }).select().single(); if (eC) throw eC;
        const pdf = await gerarPdfContrato(titulo, conteudo, `${cons?.nome ?? 'Consultório'} · ${paciente.nome}`);
        const caminho = `${criado.consultorio_id}/${pid}/${criado.id}.pdf`;
        const { error: eUp } = await cliente.storage.from('contratos').upload(caminho, Buffer.from(pdf), { contentType: 'application/pdf', upsert: true }); if (eUp) throw eUp;
        const { data: atualizado, error: eA } = await cliente.from('contratos').update({ pdf_caminho: caminho }).eq('id', criado.id).select().single(); if (eA) throw eA;
        await rpc('registrar_acesso_prontuario', { p_paciente: pid, p_acao: 'gerou_contrato', p_detalhe: titulo, p_ip: await ipDoPedido() });
        dados = atualizado; break;
      }
      case 'enviarContrato': {
        const cid = id(a.id);
        const { data: c, error } = await cliente.from('contratos').select('id,status,titulo,pdf_caminho,paciente_id').eq('id', cid).single(); if (error) throw error;
        if (c.status === 'assinado' || c.status === 'cancelado') throw { code: '23514' };
        const token = randomBytes(24).toString('base64url');
        const expira = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
        const base = (process.env.APP_URL ?? '').replace(/\/$/, '');
        const envelope = await provedorAssinatura().criarEnvelope({ contratoId: cid, titulo: c.titulo, pdf: new Uint8Array(), signatario: { nome: '' }, linkBase: base, token });
        const { data: at, error: e2 } = await cliente.from('contratos').update({ status: 'enviado', token, token_expira_em: expira, provedor: provedorAssinatura().nome, provedor_referencia: envelope.referencia }).eq('id', cid).select().single(); if (e2) throw e2;
        dados = { ...at, token: undefined, link: envelope.link }; break;
      }
      case 'cancelarContrato': dados = await unico(cliente.from('contratos').update({ status: 'cancelado', token: null }).eq('id', id(a.id)).neq('status', 'assinado').select().single()); break;
      case 'urlContrato': {
        const { data: c, error } = await cliente.from('contratos').select('pdf_caminho,pdf_assinado_caminho').eq('id', id(a.id)).single(); if (error) throw error;
        const caminho = a.assinado && c.pdf_assinado_caminho ? c.pdf_assinado_caminho : c.pdf_caminho; if (!caminho) throw { code: 'P0002' };
        const { data: url, error: eU } = await cliente.storage.from('contratos').createSignedUrl(caminho, 600); if (eU) throw eU;
        dados = { url: url.signedUrl }; break;
      }
      default: throw { code: '22023' };
    }
    return { sucesso: true, dados, erro: null };
  } catch (erro) { return erroSeguro(erro); }
}
