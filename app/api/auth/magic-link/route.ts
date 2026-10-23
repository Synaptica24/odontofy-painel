import { enviarMagicLink } from '@/lib/auth';
import { origemValida, respostaApi } from '@/lib/servidor/http';
import { erroSeguro } from '@/lib/servidor/painel';

export async function POST(request: Request) {
  try {
    if (!origemValida(request)) throw { code: '42501' };
    const texto = await request.text();
    if (texto.length > 1000) throw { code: '22023' };
    let corpo;
    try { corpo = JSON.parse(texto); } catch { throw { code: '22023' }; }
    if (typeof corpo?.email !== 'string') throw { code: '22023' };
    return respostaApi(await enviarMagicLink(corpo.email));
  } catch (erro) { return respostaApi(erroSeguro(erro)); }
}
