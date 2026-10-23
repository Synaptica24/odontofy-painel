'use server';

import { headers } from 'next/headers';
import { sessaoAutorizada } from './supabase/server';
import { erroSeguro } from './servidor/painel';
import type { Anexo, ResultadoApi } from './contratos';

const CATEGORIAS = ['raio_x', 'foto', 'documento', 'exame', 'outro'];
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/dicom'];
const LIMITE = 25 * 1024 * 1024;

/** Upload de anexo do prontuário para o bucket privado `prontuario` (caminho consultorio/paciente/arquivo). */
export async function enviarAnexo(form: FormData): Promise<ResultadoApi<Anexo>> {
  try {
    const cliente = await sessaoAutorizada();
    const arquivo = form.get('arquivo');
    const pacienteId = String(form.get('paciente_id') ?? '');
    const categoria = String(form.get('categoria') ?? 'documento');
    const descricao = String(form.get('descricao') ?? '').slice(0, 500);
    if (!(arquivo instanceof File) || !/^[0-9a-f-]{36}$/i.test(pacienteId) || !CATEGORIAS.includes(categoria)) throw { code: '22023' };
    if (arquivo.size === 0 || arquivo.size > LIMITE || !TIPOS.includes(arquivo.type)) throw { code: '22023' };
    const { data: paciente, error: eP } = await cliente.from('pacientes').select('consultorio_id').eq('id', pacienteId).single();
    if (eP) throw eP;
    const nomeSeguro = arquivo.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(0, 80) || 'arquivo';
    const caminho = `${paciente.consultorio_id}/${pacienteId}/${Date.now()}-${nomeSeguro}`;
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const { error: eUp } = await cliente.storage.from('prontuario').upload(caminho, bytes, { contentType: arquivo.type, upsert: false });
    if (eUp) throw eUp;
    const { data, error } = await cliente.from('anexos').insert({ paciente_id: pacienteId, nome: arquivo.name.slice(0, 160), tipo_mime: arquivo.type, categoria, caminho, tamanho: arquivo.size, descricao }).select().single();
    if (error) { await cliente.storage.from('prontuario').remove([caminho]); throw error; }
    try {
      const h = await headers();
      await cliente.rpc('registrar_acesso_prontuario', { p_paciente: pacienteId, p_acao: 'anexou', p_detalhe: arquivo.name.slice(0, 160), p_ip: (h.get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 64) });
    } catch { /* trilha é melhor esforço aqui; o trigger da tabela já registrou a alteração */ }
    return { sucesso: true, dados: data as Anexo, erro: null };
  } catch (erro) { return erroSeguro(erro) as ResultadoApi<Anexo>; }
}
