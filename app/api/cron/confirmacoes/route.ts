import { clienteAdmin } from '@/lib/supabase/server';

/* Confirmação automática de consulta (Vercel Cron, ver vercel.json).
   Para cada consultório com confirmacao_ativa, pega as consultas "agendado" que começam dentro de
   confirmacao_antecedencia_horas e ainda sem mensagem, e manda a mensagem pelo webhook do n8n
   (N8N_ENVIO_WEBHOOK_URL + N8N_ENVIO_WEBHOOK_SECRET). Sem webhook configurado, só lista o que seria
   enviado (dry run) para o painel mostrar; o Dr. continua enviando pelo botão de WhatsApp. */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  const cabecalho = request.headers.get('authorization') ?? '';
  if (!segredo || cabecalho !== `Bearer ${segredo}`) return new Response('Não autorizado', { status: 401 });
  const admin = clienteAdmin();
  const webhook = process.env.N8N_ENVIO_WEBHOOK_URL;
  const webhookSegredo = process.env.N8N_ENVIO_WEBHOOK_SECRET;
  const { data: consultorios, error } = await admin.from('consultorios').select('id,nome,demo').eq('demo', false);
  if (error) return Response.json({ sucesso: false, erro: 'consultorios' }, { status: 500 });
  const relatorio: { consultorio: string; candidatas: number; enviadas: number; modo: 'enviado' | 'dry-run' }[] = [];
  for (const c of consultorios ?? []) {
    const { data: cfg } = await admin.from('config').select('chave,valor').eq('consultorio_id', c.id).in('chave', ['confirmacao_ativa', 'confirmacao_antecedencia_horas']);
    const mapa = Object.fromEntries((cfg ?? []).map((l) => [l.chave, l.valor]));
    if (mapa.confirmacao_ativa !== true) continue;
    const horas = Number(mapa.confirmacao_antecedencia_horas ?? 24) || 24;
    const limite = new Date(Date.now() + horas * 3600 * 1000).toISOString();
    const { data: lista } = await admin.from('agendamentos').select('id,inicio,tipo,paciente:pacientes(nome,telefone_e164,nao_perturbe)').eq('consultorio_id', c.id).eq('status', 'agendado').is('confirmacao_enviada_em', null).gte('inicio', new Date().toISOString()).lte('inicio', limite);
    let enviadas = 0;
    for (const a of lista ?? []) {
      const p = Array.isArray(a.paciente) ? a.paciente[0] : a.paciente;
      if (!p || p.nao_perturbe) continue;
      const quando = new Date(a.inicio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      const texto = `Olá, ${p.nome.split(' ')[0]}! Passando para confirmar sua consulta (${a.tipo}) ${quando} com o Dr. Mateus Peixoto. Pode confirmar respondendo SIM? Se precisar remarcar, é só avisar.`;
      if (webhook && webhookSegredo) {
        try {
          const r = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${webhookSegredo}`, 'Idempotency-Key': `confirmacao-${a.id}` }, body: JSON.stringify({ versao: 'confirmacao-v1', agendamento_id: a.id, telefone: p.telefone_e164, texto }), signal: AbortSignal.timeout(15000) });
          if (!r.ok) continue;
          await admin.from('agendamentos').update({ confirmacao_enviada_em: new Date().toISOString() }).eq('id', a.id);
          enviadas++;
        } catch { /* tenta de novo na próxima execução */ }
      }
    }
    relatorio.push({ consultorio: c.nome, candidatas: (lista ?? []).length, enviadas, modo: webhook && webhookSegredo ? 'enviado' : 'dry-run' });
  }
  return Response.json({ sucesso: true, relatorio, executado_em: new Date().toISOString() });
}
