/* Extrator do prontuário do Codental. Roda DENTRO da aba logada em app.codental.com.br (só leitura: só GET)
   e envia o que lê para o coletor local (scripts/coletor-local.mjs, http://localhost:3011), que grava em data/codental/.
   Como carregar na aba:  eval(await (await fetch('http://localhost:3011/extrator.js')).text()); __cx.iniciar()
   Estado em window.__cx (feitos, erros, atual). Retoma de onde parou: pula pacientes já gravados. */
(() => {
  const COLETOR = 'http://localhost:3011';
  const PAUSA_MS = 250;
  const cx = (window.__cx = window.__cx || {});
  Object.assign(cx, { estado: 'parado', feitos: 0, pulados: 0, erros: [], atual: null, inicio: null, total: 0, arquivos: 0 });

  // aba em segundo plano: o Chrome estrangula setTimeout (até 1/min), então ali não se espera; o próprio fetch dá o ritmo
  const dormir = (ms) => (document.hidden ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const num = (s) => { const m = /(\d+)/.exec(s || ''); return m ? Number(m[1]) : null; };
  const reais = (s) => { const m = /R\$\s*([\d.]+),(\d{2})/.exec(s || ''); return m ? Number(m[1].replace(/\./g, '') + '.' + m[2]) : null; };
  const dataBr = (s) => { const m = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}${m[4] ? `T${m[4]}:${m[5]}:00` : ''}` : null; };
  const MESES = { janeiro: '01', fevereiro: '02', março: '03', marco: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' };
  const dataLonga = (s) => { // "Criado 15 de Outubro 2024 às 18:42"
    const m = /(\d{1,2}) de (\w+) (\d{4})(?: às (\d{2}):(\d{2}))?/i.exec((s || '').normalize('NFC'));
    if (!m) return null; const mes = MESES[m[2].toLowerCase()]; if (!mes) return null;
    return `${m[3]}-${mes}-${m[1].padStart(2, '0')}${m[4] ? `T${m[4]}:${m[5]}:00` : ''}`;
  };

  async function pagina(caminho) {
    const r = await fetch(caminho, { headers: { Accept: 'text/html' } });
    if (!r.ok) throw new Error(`${caminho} → ${r.status}`);
    const html = await r.text();
    await dormir(PAUSA_MS);
    return new DOMParser().parseFromString(html, 'text/html');
  }
  async function paginas(doc, raizSel) {
    // paginação infinita: data-infinity-pagination-url-value + total-pages; páginas seguintes via ?page=N
    const raiz = doc.querySelector(raizSel) || doc.querySelector('[data-infinity-pagination-url-value]');
    const docs = [doc];
    if (!raiz) return docs;
    const total = Number(raiz.getAttribute('data-infinity-pagination-data-total-pages-value') || '1');
    const url = raiz.getAttribute('data-infinity-pagination-url-value');
    for (let p = 2; p <= total && p <= 60; p++) docs.push(await pagina(`${url}${url.includes('?') ? '&' : '?'}page=${p}`));
    return docs;
  }
  async function salvar(nome, corpo, tipo = 'application/json') {
    const r = await fetch(`${COLETOR}/salvar?nome=${encodeURIComponent(nome)}`, { method: 'POST', headers: { 'Content-Type': tipo }, body: corpo });
    if (!r.ok) throw new Error('coletor ' + r.status);
    return r.json();
  }
  async function existe(nome) { return (await (await fetch(`${COLETOR}/existe?nome=${encodeURIComponent(nome)}`)).json()).existe; }

  // ---------- parsers ----------
  function visaoGeral(doc) {
    const notas = doc.querySelector('#patient_notes')?.value ?? '';
    const dentes = [...doc.querySelectorAll('.odontogram .odontogram-tooth[data-tooth]')].map((t) => {
      const img = t.querySelector('.odontogram-tooth-image');
      const cls = img ? img.className : '';
      return { dente: Number(t.getAttribute('data-tooth')), finalizado: /tooth-done/.test(cls), em_aberto: /on-process/.test(cls), removido: /tooth-cross/.test(cls) };
    }).filter((d) => d.finalizado || d.em_aberto || d.removido);
    const info = {};
    for (const b of doc.querySelectorAll('.basic-info-patient')) { const k = txt(b.querySelector('.patient-base-subtitle')); const v = txt(b.querySelector('.patient-base-info')); if (k) info[k] = v; }
    return { notas, odontograma: dentes, informacoes: info };
  }
  function evolucoesDe(doc) {
    const out = [];
    let mesAno = null;
    const linha = doc.querySelector('.evolution-timeline') || doc;
    for (const el of linha.querySelectorAll('.evolution-timeline__month-label, article.evolution-entry')) {
      if (el.matches('.evolution-timeline__month-label')) {
        const m = /(\w+)\s+(\d{4})/.exec(txt(el).normalize('NFC')); mesAno = m ? { mes: MESES[m[1].toLowerCase()] ?? null, ano: m[2] } : null; continue;
      }
      const dia = txt(el.querySelector('.evolution-date__day'));
      const mesAbrev = txt(el.querySelector('.evolution-date__month')).toLowerCase().slice(0, 3);
      const MES_ABREV = { jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06', jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12' };
      const mes = MES_ABREV[mesAbrev] ?? mesAno?.mes ?? null;
      const data = mesAno && mes && dia ? `${mesAno.ano}-${mes}-${dia.padStart(2, '0')}` : null;
      const texto = el.querySelector('.evolution-entry__text');
      const metaProc = el.querySelector('.evolution-meta--procedure');
      const metaGeral = [...el.querySelectorAll('.evolution-meta:not(.evolution-meta--procedure)')].pop();
      out.push({
        id: num(el.id), data, texto: texto ? texto.innerText.trim() : '', html: texto ? texto.innerHTML.trim() : '',
        procedimento: metaProc ? txt(metaProc.querySelector('.evolution-meta__strong')) : null,
        dente: metaProc ? txt([...metaProc.querySelectorAll('.evolution-meta__strong')][1]) || null : null,
        orcamento: metaProc ? num(txt(metaProc.querySelector('.evolution-meta__quote'))) : null,
        profissional: metaGeral ? txt(metaGeral.querySelector('span')) : '',
        assinatura: metaGeral ? txt(metaGeral.querySelector('.evolution-meta__status')) : '',
      });
    }
    return out;
  }
  function orcamentosDe(doc) {
    const out = [];
    const lista = doc.querySelector('.quotes-list') || doc;
    for (const btn of lista.querySelectorAll('.quote-details-button')) {
      const card = btn.closest('[class*="quote-container"]') || btn.closest('.tw-border') || btn.parentElement.parentElement.parentElement;
      const idQ = num(btn.getAttribute('data-id'));
      const cab = card.firstElementChild || card;
      const titulo = txt(btn.querySelector('h4'));
      const numero = num(txt([...cab.querySelectorAll('p')].find((p) => /^#\d+/.test(txt(p)))));
      const data = dataBr(txt(cab));
      const total = reais(txt([...cab.querySelectorAll('span')].find((s) => /R\$/.test(txt(s)))));
      const status = txt([...cab.querySelectorAll('span')].find((s) => /^(Aprovado|Pendente|Recusado|Reprovado|Em aberto|Cancelado|Expirado|Aguardando)/i.test(txt(s))));
      const det = card.querySelector('.quote-details') || doc.getElementById('details-' + idQ);
      const itens = [];
      const resumo = {};
      if (det) {
        for (const row of det.querySelectorAll('section > div > div')) {
          const ps = [...row.querySelectorAll(':scope > p')].map(txt);
          if (ps.length >= 4 && /R\$/.test(ps[3])) itens.push({ tratamento: ps[0], dente: ps[1] === '-' ? null : ps[1], faces: ps[2] === '-' ? null : ps[2], valor: reais(ps[3]) });
        }
        for (const par of det.querySelectorAll('div')) {
          const sp = [...par.children].filter((c) => c.tagName === 'SPAN');
          if (sp.length === 2 && /^(Entrada|Subtotal|Parcelas|Desconto|TOTAL|Total)$/i.test(txt(sp[0]))) resumo[txt(sp[0]).toLowerCase()] = txt(sp[1]);
        }
        const obs = det.querySelector(':scope > div > p');
        if (obs && txt(obs)) resumo.observacao = txt(obs);
      }
      out.push({ id: idQ, numero, titulo, data, total, status, itens, resumo });
    }
    return out;
  }
  function tratamentosDe(doc) {
    return [...doc.querySelectorAll('article.procedure-card')].map((a) => {
      const metas = [...a.querySelectorAll('.procedure-card__meta > span')].map(txt).filter((s) => s !== '·');
      const evo = a.querySelector('.procedure-card__evolutions');
      return {
        id: num(a.id), nome: txt(a.querySelector('.procedure-card__name')), dentes: txt(a.querySelector('.procedure-card__teeth')) || null,
        status: txt(a.querySelector('.procedure-card__status')), data: dataBr(metas[0]), convenio: metas[1] ?? null,
        valor: reais(txt(a.querySelector('.procedure-card__price'))), profissional: metas.find((m) => /^Dr|^Dra|Maia$/i.test(m)) ?? null,
        orcamento: num(txt(a.querySelector('.procedure-card__quote'))),
        evolucoes: evo ? num(txt(evo.querySelector('.procedure-card__evolutions-count'))) : 0, ultima: evo ? txt(evo.querySelector('.procedure-card__last')) : null,
        cancelado: /procedure-card--cancel/.test(a.className), finalizado: /procedure-card--done/.test(a.className),
      };
    });
  }
  function pagamentosDe(doc) {
    const cab = {};
    for (const sec of doc.querySelectorAll('header section section')) { const k = txt(sec.querySelector('h2')); if (k) cab[k] = reais(txt(sec.querySelector('h1'))); }
    const linhas = [...doc.querySelectorAll('.js-debt-list__row')].map((r) => {
      const chk = r.querySelector('input[type=checkbox][data-debt-id]');
      const venc = txt(r.querySelector('.debt-list__expires > span'));
      return {
        id: num(r.id), titulo: txt(r.querySelector('.debt-list__name a')), vencimento: dataBr(venc), orcamento: num((/Orc\s*#(\d+)/.exec(venc) || [])[1]),
        status: txt(r.querySelector('.debt-list__status p')) || txt(r.querySelector('.debt-list__status')), valor: chk ? Number(chk.getAttribute('data-amount')) : reais(txt(r.querySelector('.debt-list__amount'))),
        pago_em: chk ? (chk.getAttribute('data-paid-at') === 'false' ? null : chk.getAttribute('data-paid-at')) : null,
        recibo: !!r.querySelector('a[href*="/receipt"]'), tem_botao_pagar: !!r.querySelector('.debt-list__pay a'),
      };
    });
    return { resumo: cab, linhas };
  }
  function anamnesesLista(doc) {
    return [...doc.querySelectorAll('table.table tbody tr')].map((tr) => {
      const a = tr.querySelector('a[href*="/anamneses/"][href$="/edit"]');
      const spans = [...tr.querySelectorAll('td:first-child span')].map(txt);
      return {
        id: num((a?.getAttribute('href') || '').replace(/.*anamneses\/(\d+).*/, '$1')), modelo: txt(a), href: a?.getAttribute('href'),
        criado: dataLonga(spans.find((s) => /^Criado/.test(s))), atualizado: dataLonga(spans.find((s) => /^Atualizado/.test(s))),
        assinada: !!tr.querySelector('a[href^="/digital_signatures/"][title*="Assinado"]'),
      };
    }).filter((a) => a.id);
  }
  function anamneseRespostas(doc) {
    const out = [];
    for (const q of doc.querySelectorAll('[data-controller="anamnese-set-answered-by-patient"]')) {
      const pergunta = txt(q.querySelector('h3'));
      let resposta = '';
      const radio = q.querySelector('input[type=radio]:checked');
      if (radio) resposta = txt(q.querySelector(`label[for="${radio.id}"]`));
      const checks = [...q.querySelectorAll('input[type=checkbox]:checked')].map((c) => txt(q.querySelector(`label[for="${c.id}"]`))).filter(Boolean);
      if (checks.length) resposta = checks.join(', ');
      const textos = [...q.querySelectorAll('input[type=text], textarea')].map((i) => (i.value || i.getAttribute('value') || i.textContent || '').trim()).filter(Boolean);
      const complemento = textos.join(' ');
      if (!resposta) resposta = complemento; else if (complemento) resposta += ` — ${complemento}`;
      const pelo_paciente = q.querySelector('input[name*="answered_by"]')?.value === 'true';
      if (pergunta) out.push({ pergunta, resposta, pelo_paciente });
    }
    return out;
  }
  function documentosDe(doc) {
    const out = [];
    for (const b of doc.querySelectorAll('[data-url*="/prescriptions/"], [data-url*="/statements/"], [data-url*="/custom_documents/"], a[href*="/prescriptions/"], a[href*="/statements/"], a[href*="/custom_documents/"]')) {
      const url = b.getAttribute('data-url') || b.getAttribute('href');
      if (/\/new/.test(url)) continue;
      const linha = b.closest('tr, li, article, div');
      out.push({ url, tipo: txt(b), resumo: linha ? txt(linha).slice(0, 400) : '' });
    }
    const vistos = new Set();
    return out.filter((d) => (vistos.has(d.url) ? false : (vistos.add(d.url), true)));
  }
  function arquivosDe(doc, pasta) {
    const itens = [...doc.querySelectorAll('li[data-upload-id]')].map((li) => {
      const inp = li.querySelector('input[data-url]');
      let meta = null; try { meta = JSON.parse(inp?.getAttribute('data-url') || 'null'); } catch { meta = null; }
      return { id: Number(li.getAttribute('data-upload-id')), nome: meta?.filename || li.querySelector('upload-filename-input')?.getAttribute('name') || `arquivo-${li.getAttribute('data-upload-id')}`, download: meta?.download || null, tipo: inp?.getAttribute('data-file-type') || '', criado: dataBr(txt(li.querySelector('.upload-created-date'))), pasta };
    });
    const pastas = [...doc.querySelectorAll('#folders-list li a[href], #folders-list a[href*="folder"]')].map((a) => ({ href: a.getAttribute('href'), nome: txt(a) })).filter((p) => p.href && !/new_folder|move/.test(p.href));
    return { itens, pastas };
  }

  async function baixarArquivo(pacId, arq) {
    if (!arq.download) return null;
    const nome = `arquivos/${pacId}/${arq.id}__${arq.nome.replace(/[^\w.\-()à-ú ]/gi, '_')}`;
    if (await existe(nome)) return nome;
    const u = new URL(arq.download);
    const r = await fetch(u.pathname + u.search);
    if (!r.ok) throw new Error('arquivo ' + arq.id + ' → ' + r.status);
    const blob = await r.blob();
    await salvar(nome, blob, blob.type || 'application/octet-stream');
    arq.tipo = arq.tipo || blob.type; arq.tamanho = blob.size;
    cx.arquivos++;
    await dormir(PAUSA_MS);
    return nome;
  }

  async function paciente(id) {
    const base = `/patients/${id}`;
    const p = { id, coletado_em: new Date().toISOString() };
    const geral = await pagina(base);
    Object.assign(p, visaoGeral(geral));
    p.evolucoes = (await paginas(await pagina(base + '/evolutions'), '.evolution-history__timeline')).flatMap(evolucoesDe);
    p.orcamentos = (await paginas(await pagina(base + '/quotes'), '.quotes-list')).flatMap(orcamentosDe);
    p.tratamentos = (await paginas(await pagina(base + '/procedures'), '.procedures-list')).flatMap(tratamentosDe);
    const debDocs = await paginas(await pagina(base + '/debts'), '[data-infinity-pagination-url-value*="/debts"]');
    p.pagamentos = { resumo: pagamentosDe(debDocs[0]).resumo, linhas: debDocs.flatMap((d) => pagamentosDe(d).linhas) };
    p.anamneses = (await paginas(await pagina(base + '/anamneses'), '[data-infinity-pagination-url-value*="/anamneses"]')).flatMap(anamnesesLista);
    for (const a of p.anamneses) { try { a.respostas = anamneseRespostas(await pagina(a.href)); } catch (e) { a.erro = e.message; } }
    p.documentos = documentosDe(await pagina(base + '/documents'));
    const up = arquivosDe(await pagina(base + '/uploads'), null);
    p.arquivos = up.itens;
    for (const pasta of up.pastas) { try { const sub = arquivosDe(await pagina(pasta.href), pasta.nome); p.arquivos.push(...sub.itens); } catch (e) { cx.erros.push(`${id} pasta ${pasta.nome}: ${e.message}`); } }
    for (const arq of p.arquivos) { try { arq.local = await baixarArquivo(id, arq); } catch (e) { arq.erro = e.message; cx.erros.push(`${id} arquivo ${arq.id}: ${e.message}`); } }
    await salvar(`pacientes/${id}.json`, JSON.stringify(p));
    return p;
  }

  cx.um = async (id) => paciente(id);
  cx.iniciar = async (ids) => {
    if (cx.estado === 'rodando') return 'já rodando';
    cx.estado = 'rodando'; cx.inicio = Date.now(); cx.erros = [];
    const lista = ids || (await (await fetch(`${COLETOR}/ids`)).json());
    cx.total = lista.length;
    for (const id of lista) {
      if (cx.estado !== 'rodando') break;
      cx.atual = id;
      try {
        if (await existe(`pacientes/${id}.json`)) { cx.pulados++; continue; }
        await paciente(id);
        cx.feitos++;
      } catch (e) {
        cx.erros.push(`${id}: ${e.message}`);
        await dormir(1500);
      }
    }
    cx.atual = null;
    cx.estado = cx.estado === 'rodando' ? 'concluido' : cx.estado;
    try { await salvar('relatorio-extracao.json', JSON.stringify({ ...cx, fim: Date.now() })); } catch {}
    return cx.estado;
  };
  cx.parar = () => { cx.estado = 'parando'; };
  return 'extrator carregado';
})();
