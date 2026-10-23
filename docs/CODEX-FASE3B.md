Você é o CODEX, dono do backend. Continuação da FASE 3 (a anterior parou por limite de cota depois de gravar lib/fixture.ts). Leia docs/PEDIDOS.md.

1) Confirme que lib/fixture.ts está completo conforme docs/CODEX-FASE3.md (12 pacientes, 6 conversas com áudio e imagem, agenda da semana, 2 bloqueios, 8 conhecimentos, 40 envios em 2 levas com 3 agendadas, config preenchida, consumo de teste, resumoDoDia coerente). Complete o que faltar.
2) Pedido aberto: em `statusCampanha`, cada `CampanhaEnvio` precisa trazer `paciente: { id: Id; nome: string }` (adicione o campo ao tipo em lib/contratos.ts como obrigatório em ResultadoStatusCampanha.envios, ajuste fixture e implementação real via join). O front vai ler `envio.paciente.nome`.
3) `npx tsc --noEmit` e `npx eslint lib app` limpos. Marque os pedidos como atendidos em docs/PEDIDOS.md. Não toque em app/(painel)/, components/, styles/. Responda em 5 linhas.
