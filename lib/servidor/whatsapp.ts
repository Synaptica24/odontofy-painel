import 'server-only';
import { clienteAdmin, sessaoAutorizada } from '../supabase/server';
import { erroSeguro } from './painel';
import type { Json, ResultadoApi, StatusWhatsapp, WhatsappConexao } from '../contratos';

/* WhatsApp do consultório via UAZ-API (https://docs.uazapi.com, contrato OpenAPI 2.6.x).
   Endpoints usados, todos confirmados no openapi-bundled.json oficial:
   - POST /instance/create      header admintoken   → { instance: { id, token, ... } }
   - POST /instance/connect     header token        → body {} (QR) ou { phone } (código) → { instance: { status, qrcode, paircode } }
   - GET  /instance/status      header token        → { instance: { status, qrcode, paircode, owner } }
   - POST /instance/disconnect  header token
   - POST /send/text            header token        → body { number, text }
   O token da instância vive só em whatsapp_conexoes.instance_token, lido com service_role. Nada dele volta ao navegador. */

const QR_EXPIRA_MS = 2 * 60_000;
const PAIR_EXPIRA_MS = 5 * 60_000;
const TESTE_INTERVALO_MS = 60_000;
const TIMEOUT_MS = 20_000;

type Linha = {
  id: string; consultorio_id: string; instance_id: string; instance_token: string; status: StatusWhatsapp;
  numero_e164: string | null; metodo_pareamento: 'qr' | 'pair' | null; iniciado_em: string | null; pareado_em: string | null;
  teste_enviado_em: string | null; ultimo_erro: string; atualizado_em: string;
};
type InstanciaUaz = { id?: string; token?: string; status?: string; qrcode?: string; paircode?: string; owner?: string; profileName?: string };

const configurado = () => !!process.env.UAZ_BASE_URL && !!process.env.UAZ_ADMIN_TOKEN;
const baseUrl = () => {
  const u = new URL(process.env.UAZ_BASE_URL!);
  if (u.protocol !== 'https:') throw new Error('UAZ_BASE_URL precisa ser https');
  return u.origin;
};

async function uaz<T = Record<string, unknown>>(caminho: string, opcoes: { metodo?: 'GET' | 'POST' | 'DELETE'; token?: string; admin?: boolean; corpo?: unknown }): Promise<T> {
  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (opcoes.admin) cabecalhos.admintoken = process.env.UAZ_ADMIN_TOKEN!;
  if (opcoes.token) cabecalhos.token = opcoes.token;
  const r = await fetch(`${baseUrl()}${caminho}`, {
    method: opcoes.metodo ?? 'POST', headers: cabecalhos, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
    body: opcoes.metodo === 'GET' ? undefined : JSON.stringify(opcoes.corpo ?? {}),
  });
  const texto = await r.text();
  let json: unknown = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* resposta sem JSON */ }
  if (!r.ok) {
    const msg = json && typeof json === 'object' && 'error' in json ? String((json as { error: unknown }).error) : `HTTP ${r.status}`;
    throw new Error(`UAZ ${caminho}: ${msg}`.slice(0, 200));
  }
  return (json ?? {}) as T;
}

const soDigitos = (v: string) => v.replace(/\D/g, '');
function mascarar(e164: string | null) {
  if (!e164) return null;
  const d = soDigitos(e164);
  if (d.length < 8) return '+' + d.slice(0, 2) + ' ****';
  const pais = d.slice(0, 2), ddd = d.slice(2, 4), fim = d.slice(-4);
  return `+${pais} ${ddd} *****-${fim}`;
}
function e164DoOwner(owner?: string) {
  const d = soDigitos((owner ?? '').split('@')[0] ?? '');
  return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
}
function statusUaz(v?: string): StatusWhatsapp {
  return v === 'connected' || v === 'connecting' || v === 'hibernated' ? v : 'disconnected';
}
function expirou(l: Linha) {
  if (l.status !== 'connecting' || !l.iniciado_em) return false;
  const limite = l.metodo_pareamento === 'pair' ? PAIR_EXPIRA_MS : QR_EXPIRA_MS;
  return Date.now() - Date.parse(l.iniciado_em) > limite;
}

function retrato(l: Linha | null, extra: { qrcode?: string | null; paircode?: string | null } = {}): WhatsappConexao {
  const conectando = l?.status === 'connecting';
  return {
    status: l?.status ?? 'disconnected',
    numero_mascarado: l?.status === 'connected' ? mascarar(l.numero_e164) : null,
    metodo: l?.metodo_pareamento ?? null,
    qrcode_base64: conectando && l?.metodo_pareamento === 'qr' ? extra.qrcode ?? null : null,
    paircode: conectando && l?.metodo_pareamento === 'pair' ? extra.paircode ?? null : null,
    iniciado_em: conectando ? l?.iniciado_em ?? null : null,
    atualizado_em: l?.atualizado_em ?? null,
    erro: l?.ultimo_erro ?? '',
    configurado: configurado(),
  };
}

async function registrarEvento(admin: ReturnType<typeof clienteAdmin>, tipo: string, consultorioId: string, userId: string, detalhe: Record<string, Json> = {}) {
  await admin.from('eventos').insert({ tipo, payload: { consultorio_id: consultorioId, ator: userId, ...detalhe } });
}

/** Sessão válida + consultório atual + cliente admin para a tabela (único lugar que vê o token). */
async function contexto() {
  const sessao = await sessaoAutorizada();
  const { data: { user } } = await sessao.auth.getUser();
  const { data: consultorioId, error } = await sessao.rpc('consultorio_atual');
  if (error || !consultorioId) throw { code: '42501' };
  const admin = clienteAdmin();
  const { data: linha } = await admin.from('whatsapp_conexoes').select('*').eq('consultorio_id', consultorioId).maybeSingle<Linha>();
  return { admin, consultorioId: consultorioId as string, userId: user?.id ?? '', linha: linha ?? null };
}

async function gravar(admin: ReturnType<typeof clienteAdmin>, consultorioId: string, campos: Partial<Linha>) {
  const { data, error } = await admin.from('whatsapp_conexoes').upsert({ consultorio_id: consultorioId, ...campos }, { onConflict: 'consultorio_id' }).select('*').single<Linha>();
  if (error) throw error;
  return data;
}

/** Sincroniza a linha local com GET /instance/status. Devolve a linha e o QR/código atuais (nunca gravados no banco). */
async function sincronizar(admin: ReturnType<typeof clienteAdmin>, consultorioId: string, userId: string, linha: Linha) {
  if (!linha.instance_token) return { linha, qrcode: null, paircode: null };
  let inst: InstanciaUaz;
  try {
    const r = await uaz<{ instance?: InstanciaUaz }>('/instance/status', { metodo: 'GET', token: linha.instance_token });
    inst = r.instance ?? {};
  } catch (e) {
    const l = await gravar(admin, consultorioId, { ultimo_erro: 'Não deu para falar com o servidor do WhatsApp. Tente de novo em instantes.' });
    void e; return { linha: l, qrcode: null, paircode: null };
  }
  let status = statusUaz(inst.status);
  const campos: Partial<Linha> = { ultimo_erro: '' };
  if (status === 'connected') {
    campos.numero_e164 = e164DoOwner(inst.owner) ?? linha.numero_e164;
    if (linha.status !== 'connected') { campos.pareado_em = new Date().toISOString(); await registrarEvento(admin, 'whatsapp.conectou', consultorioId, userId, { metodo: linha.metodo_pareamento }); }
  } else if (status === 'connecting' && expirou(linha)) {
    // prazo do QR/código venceu: volta a desconectado e exige novo pareamento
    status = 'disconnected';
    campos.ultimo_erro = linha.metodo_pareamento === 'pair' ? 'O código de pareamento expirou. Gere outro.' : 'O QR Code expirou. Gere outro.';
    try { await uaz('/instance/disconnect', { token: linha.instance_token }); } catch { /* já caiu */ }
  }
  if (status !== 'connected' && linha.status === 'connected') campos.numero_e164 = null;
  campos.status = status;
  const l = await gravar(admin, consultorioId, campos);
  return { linha: l, qrcode: status === 'connecting' ? inst.qrcode ?? null : null, paircode: status === 'connecting' ? inst.paircode ?? null : null };
}

export async function executarWhatsapp(operacao: string, entrada: unknown): Promise<ResultadoApi<Json>> {
  try {
    const a = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
    const { admin, consultorioId, userId, linha } = await contexto();
    let dados: WhatsappConexao;
    switch (operacao) {
      case 'whatsappStatus': {
        if (!linha || !configurado()) { dados = retrato(linha); break; }
        // só consulta a UAZ quando há algo para acompanhar; conectado/desconectado usam o que está no banco
        if (linha.status === 'connecting') { const s = await sincronizar(admin, consultorioId, userId, linha); dados = retrato(s.linha, s); }
        else dados = retrato(linha);
        break;
      }
      case 'whatsappAtualizarStatus': {
        if (!linha || !configurado()) { dados = retrato(linha); break; }
        const s = await sincronizar(admin, consultorioId, userId, linha);
        dados = retrato(s.linha, s); break;
      }
      case 'whatsappIniciar': {
        if (!configurado()) throw new Error('UAZ não configurada');
        const metodo = a.metodo === 'pair' ? 'pair' : a.metodo === 'qr' ? 'qr' : null;
        if (!metodo) throw { code: '22023' };
        let telefone: string | undefined;
        if (metodo === 'pair') {
          telefone = soDigitos(String(a.telefone ?? ''));
          if (!/^\d{10,15}$/.test(telefone)) throw { code: '22023' };
        }
        let atual = linha;
        // uma instância por consultório; cria só na primeira vez
        if (!atual || !atual.instance_token) {
          const r = await uaz<{ instance?: InstanciaUaz; token?: string }>('/instance/create', { admin: true, corpo: { name: `odontofy-${consultorioId.slice(0, 8)}`, systemName: 'OdontoFy' } });
          const token = r.instance?.token ?? r.token;
          if (!token) throw new Error('UAZ não devolveu o token da instância');
          atual = await gravar(admin, consultorioId, { instance_id: r.instance?.id ?? '', instance_token: token, status: 'disconnected', ultimo_erro: '' });
        }
        if (atual.status === 'connected') { dados = retrato(atual); break; }
        const r = await uaz<{ instance?: InstanciaUaz }>('/instance/connect', { token: atual.instance_token, corpo: telefone ? { phone: telefone } : {} });
        const inst = r.instance ?? {};
        const status = statusUaz(inst.status);
        const l = await gravar(admin, consultorioId, {
          status: status === 'disconnected' ? 'connecting' : status, metodo_pareamento: metodo, iniciado_em: new Date().toISOString(), ultimo_erro: '',
          ...(status === 'connected' ? { numero_e164: e164DoOwner(inst.owner), pareado_em: new Date().toISOString() } : {}),
        });
        dados = retrato(l, { qrcode: inst.qrcode ?? null, paircode: inst.paircode ?? null });
        break;
      }
      case 'whatsappDesconectar': {
        if (!linha) { dados = retrato(null); break; }
        if (linha.instance_token && configurado()) {
          try { await uaz('/instance/disconnect', { token: linha.instance_token }); } catch { /* registra local mesmo assim: o Dr. pediu para desligar */ }
        }
        const l = await gravar(admin, consultorioId, { status: 'disconnected', numero_e164: null, metodo_pareamento: null, iniciado_em: null, ultimo_erro: '' });
        await registrarEvento(admin, 'whatsapp.desconectou', consultorioId, userId);
        dados = retrato(l); break;
      }
      case 'whatsappEnviarTeste': {
        if (!linha || linha.status !== 'connected' || !linha.numero_e164) throw { code: 'P0002' };
        if (linha.teste_enviado_em && Date.now() - Date.parse(linha.teste_enviado_em) < TESTE_INTERVALO_MS) throw { code: '23505' };
        // vai para o próprio número do consultório (o aparelho pareado): nada chega a paciente
        await uaz('/send/text', { token: linha.instance_token, corpo: { number: soDigitos(linha.numero_e164), text: 'Teste do OdontoFy: o WhatsApp do consultório está conectado ao painel. Pode ignorar esta mensagem.' } });
        const l = await gravar(admin, consultorioId, { teste_enviado_em: new Date().toISOString() });
        dados = retrato(l); break;
      }
      default: throw { code: '22023' };
    }
    return { sucesso: true, dados: dados as unknown as Json, erro: null };
  } catch (erro) {
    if (erro instanceof Error && erro.message.startsWith('UAZ ')) {
      return { sucesso: false, dados: null, erro: { codigo: 'indisponivel', mensagem: 'O servidor do WhatsApp recusou a operação. Tente de novo; se continuar, avise o suporte.' } };
    }
    if (erro instanceof Error && erro.message === 'UAZ não configurada') {
      return { sucesso: false, dados: null, erro: { codigo: 'indisponivel', mensagem: 'A integração do WhatsApp ainda não foi configurada no servidor.' } };
    }
    return erroSeguro(erro);
  }
}

/**
 * Transporte único de texto para pacientes. Ordem: (1) WhatsApp do consultório conectado na UAZ;
 * (2) n8n homologado no protocolo correlacao-v1; (3) dry-run (nada sai). Respeita nao_perturbe.
 * Fase 1: existe e está testável; o cron de confirmações e o chat passam a usá-lo na fase 2.
 */
export async function enviarTextoWhatsapp(consultorioId: string, telefoneE164: string, texto: string, chaveIdempotencia: string, opcoes: { pacienteId?: string } = {}): Promise<{ modo: 'uaz' | 'n8n' | 'dry-run'; enviado: boolean; wa_message_id: string | null }> {
  const admin = clienteAdmin();
  const q = admin.from('pacientes').select('nao_perturbe').eq('consultorio_id', consultorioId);
  const { data: p } = opcoes.pacienteId ? await q.eq('id', opcoes.pacienteId).maybeSingle() : await q.eq('telefone_e164', telefoneE164).maybeSingle();
  if (p?.nao_perturbe) return { modo: 'dry-run', enviado: false, wa_message_id: null };
  const numero = soDigitos(telefoneE164);
  if (!/^\d{10,15}$/.test(numero) || !texto.trim()) return { modo: 'dry-run', enviado: false, wa_message_id: null };

  if (configurado()) {
    const { data: l } = await admin.from('whatsapp_conexoes').select('status, instance_token').eq('consultorio_id', consultorioId).maybeSingle<Pick<Linha, 'status' | 'instance_token'>>();
    if (l?.status === 'connected' && l.instance_token) {
      const r = await uaz<Array<{ messageid?: string; id?: string }> | { messageid?: string; id?: string }>('/send/text', { token: l.instance_token, corpo: { number: numero, text: texto, track_source: 'odontofy', track_id: chaveIdempotencia } });
      const m = Array.isArray(r) ? r[0] : r;
      return { modo: 'uaz', enviado: true, wa_message_id: m?.messageid ?? m?.id ?? null };
    }
  }
  const webhook = process.env.N8N_ENVIO_WEBHOOK_URL, segredo = process.env.N8N_ENVIO_WEBHOOK_SECRET;
  let url: URL | null = null;
  try { url = webhook ? new URL(webhook) : null; } catch { url = null; }
  if (url && url.protocol === 'https:' && segredo && process.env.N8N_ENVIO_PROTOCOLO === 'correlacao-v1') {
    const r = await fetch(url, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${segredo}`, 'Idempotency-Key': chaveIdempotencia }, body: JSON.stringify({ versao: 'texto-v1', chave: chaveIdempotencia, telefone: telefoneE164, texto }) });
    if (!r.ok) return { modo: 'n8n', enviado: false, wa_message_id: null };
    const ack = await r.json().catch(() => null) as { status?: string; wa_message_id?: string } | null;
    return { modo: 'n8n', enviado: ack?.status === 'enviada', wa_message_id: ack?.wa_message_id ?? null };
  }
  return { modo: 'dry-run', enviado: false, wa_message_id: null };
}
