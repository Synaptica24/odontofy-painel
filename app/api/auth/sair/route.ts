import { sessaoAutorizada } from '@/lib/supabase/server';
import { origemValida, respostaApi } from '@/lib/servidor/http';
import { erroSeguro } from '@/lib/servidor/painel';

export async function POST(request: Request) {
  try {
    if (!origemValida(request)) throw { code: '42501' };
    const cliente = await sessaoAutorizada();
    const { error } = await cliente.auth.signOut();
    if (error) throw error;
    return respostaApi({ sucesso: true, dados: null, erro: null });
  } catch (erro) { return respostaApi(erroSeguro(erro)); }
}
