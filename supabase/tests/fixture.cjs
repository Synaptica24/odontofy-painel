/* Executar: node supabase/tests/fixture.cjs. Sem rede ou dependências adicionais. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'dr-mateus-fixture-'));
async function executar() {
  for (const nome of ['contratos', 'fixture']) {
    const fonte = fs.readFileSync(path.join(__dirname, '../../lib', `${nome}.ts`), 'utf8');
    const { outputText } = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    fs.writeFileSync(path.join(pasta, `${nome}.js`), outputText);
  }
  const api = require(path.join(pasta, 'fixture.js'));
  const dados = (r) => { assert.equal(r.sucesso, true, JSON.stringify(r.erro)); return r.dados; };
  const resumo = dados(await api.resumoDoDia());
  assert.equal(resumo.escaladas[0].paciente.nome, 'Paciente Teste 01');
  assert.equal(resumo.agenda[0].paciente.telefone_e164, '+5511900000001');
  assert.ok(Array.isArray(resumo.bloqueios));
  assert.equal(dados(await api.listarPacientes('Teste'))[0].contagem_conversas, 1);
  assert.deepEqual(dados(await api.listarPacientes('INEXISTENTE')), []);
  assert.equal((await api.resumoDoDia('2026-02-30')).sucesso, false);
  const agenda = dados(await api.agendaDoDia(resumo.data));
  assert.equal(agenda.agendamentos[0].paciente.id, resumo.agenda[0].paciente_id);
  const reserva = resumo.agenda[0];
  const novo = `${resumo.data}T14:00:00-03:00`;
  const remarcada = dados(await api.remarcarAgendamento(reserva.id, novo));
  assert.equal(remarcada.inicio, novo);
  assert.equal(Date.parse(remarcada.fim) - Date.parse(remarcada.inicio), 1800000);
  dados(await api.criarBloqueio(`${resumo.data}T16:00:00-03:00`, `${resumo.data}T17:00:00-03:00`));
  assert.equal((await api.remarcarAgendamento(reserva.id, `${resumo.data}T16:00:00-03:00`)).sucesso, false);
  assert.equal(dados(await api.cancelarAgendamento(reserva.id)).status, 'cancelado');
  assert.equal((await api.remarcarAgendamento(reserva.id, novo)).sucesso, false);
  const item = dados(await api.salvarConhecimento({ pergunta: 'PERGUNTA TESTE 02', resposta: 'RESPOSTA TESTE 02', palavras_chave: ['teste'], ativo: true }));
  assert.equal(dados(await api.alternarConhecimento(item.id, false)).ativo, false);
  assert.equal(dados(await api.excluirConhecimento(item.id)), null);
  assert.equal((await api.excluirConhecimento(item.id)).sucesso, false);
  const conversa = resumo.escaladas[0];
  assert.equal((await api.enviarMensagem(conversa.id, 'TESTE')).sucesso, false);
  dados(await api.assumirConversa(conversa.id));
  assert.match(dados(await api.enviarMensagem(conversa.id, 'TESTE')).texto, /NÃO ENVIADA/);
  dados(await api.devolverParaIA(conversa.id));
  assert.equal(dados(await api.consumoDoMes()).gasto_usd, null);
  let recebidas = 0;
  const cancelar = api.inscreverEmMensagens(conversa.id, () => recebidas++);
  cancelar(); cancelar();
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(recebidas, 0);
  console.log('Fixture: resumo, agenda com paciente, contagem, remarcação, cancelamento, conhecimento, envio fictício e cancelamento de inscrição passaram.');
}
executar().catch((erro) => { console.error(erro); process.exitCode = 1; }).finally(() => {
  const alvo = path.resolve(pasta), raiz = path.resolve(os.tmpdir()) + path.sep;
  if (alvo.startsWith(raiz) && path.basename(alvo).startsWith('dr-mateus-fixture-')) fs.rmSync(alvo, { recursive: true, force: true });
});
