// ---- CONFIGURAÇÕES ----
const WA_NUMBER = '5541991115372'; // <— ajuste aqui
const WA_PREFIX = `https://wa.me/${WA_NUMBER}?text=`;

// ===== JSON-LD Helpers =====
const SITE_ORIGIN = (typeof location !== 'undefined' ? location.origin : 'https://seusite.com.br');

const tipoToSchema = (tipoBr) => {
  const t = String(tipoBr || '').toLowerCase();
  if (t.includes('casa')) return 'House';
  if (t.includes('sobrado')) return 'House';
  if (t.includes('apart') || t.includes('apto') || t.includes('studio') || t.includes('kit')) return 'Apartment';
  if (t.includes('cobertura')) return 'Apartment';
  // fallback genérico
  return 'Residence';
};

function removeLd(selector = '[data-ld]') {
  document.querySelectorAll(selector).forEach(s => s.remove());
}

function buildOffer(imovel) {
  return {
    "@type": "Offer",
    "price": imovel.preco || 0,
    "priceCurrency": "BRL",
    "availability": "https://schema.org/InStock",
    "url": `${SITE_ORIGIN}/#imovel-${imovel.id}`
  };
}

function buildPropertyLD(imovel) {
  const tipo = tipoToSchema(imovel.tipo);
  const ld = {
    "@context": "https://schema.org",
    "@type": tipo,
    "name": imovel.titulo,
    "description": imovel.descricao || "",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": imovel.cidade || "Salvador",
      "addressRegion": imovel.uf || "BA",
      "addressCountry": "BR"
    },
    "offers": buildOffer(imovel)
  };
  if (imovel.area) {
    ld.floorSize = { "@type": "QuantitativeValue", "value": imovel.area, "unitCode": "MTK" };
  }
  if (Array.isArray(imovel.imagens) && imovel.imagens.length) {
    ld.photo = imovel.imagens.map(src => src.startsWith('http') ? src : `${SITE_ORIGIN}/${src}`);
  }
  return ld;
}

// Injeta JSON-LD para a LISTA atual (visível após filtros)
function injectListLD(lista) {
  removeLd('[data-ld="list"]');
  if (!lista || !lista.length) return;
  const graph = lista.slice(0, 24).map(buildPropertyLD); // limita para não exagerar
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.dataset.ld = 'list';
  s.textContent = JSON.stringify({ "@context":"https://schema.org", "@graph": graph });
  document.head.appendChild(s);
}

// Injeta JSON-LD para o imóvel DETALHE (quando abrir modal)
function injectDetailLD(imovel) {
  removeLd('[data-ld="detail"]');
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.dataset.ld = 'detail';
  s.textContent = JSON.stringify(buildPropertyLD(imovel));
  document.head.appendChild(s);
}


// Fallback se o fetch ao JSON falhar
const DEFAULT_IMOVEIS = [
  {
    id: 1, criadoEm: "2025-09-07T10:00:00Z", finalidade: "comprar", tipo: "Apartamento",
    titulo: "Apartamento 2/4 no Rio Vermelho", preco: 320000, bairro: "Rio Vermelho",
    cidade: "Salvador", uf: "BA", area: 78, quartos: 2, suites: 1, banheiros: 2, vagas: 1,
    descricao: "2 quartos, 1 suíte, 78m², 1 vaga de garagem.",
    condominio: 690, iptu: 1200, tags: ["varanda","elevador"], imagens: ["imagens/casa1.jpeg"], destaque: true
  },
  {
    id: 2, criadoEm: "2025-09-08T12:30:00Z", finalidade: "comprar", tipo: "Casa",
    titulo: "Casa ampla no Caminho das Árvores", preco: 870000, bairro: "Caminho das Árvores",
    cidade: "Salvador", uf: "BA", area: 200, quartos: 3, suites: 1, banheiros: 3, vagas: 2,
    descricao: "3 quartos, 200m², área gourmet.",
    condominio: 0, iptu: 2800, tags: ["área gourmet","quintal"], imagens: ["imagens/casa1.jpeg"], destaque: false
  },
  {
    id: 3, criadoEm: "2025-09-09T18:00:00Z", finalidade: "comprar", tipo: "Studio",
    titulo: "Studio mobiliado na Pituba", preco: 220000, bairro: "Pituba",
    cidade: "Salvador", uf: "BA", area: 35, quartos: 0, suites: 0, banheiros: 1, vagas: 1,
    descricao: "Studio compacto e moderno, ótima localização.",
    condominio: 550, iptu: 900, tags: ["mobiliado","varanda"], imagens: ["imagens/casa1.jpeg"], destaque: true
  },
  {
    id: 4, criadoEm: "2025-09-10T14:00:00Z", finalidade: "alugar", tipo: "Apartamento",
    titulo: "Studio mobiliado na Pituba (Aluguel)", preco: 2500, bairro: "Pituba",
    cidade: "Salvador", uf: "BA", area: 35, quartos: 0, suites: 0, banheiros: 1, vagas: 1,
    descricao: "Compacto, moderno e bem localizado.",
    condominio: 550, iptu: 75, tags: ["mobiliado","vaga"], imagens: ["imagens/casa1.jpeg"], destaque: false
  }
];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== Modo Escuro (toggle + persistência) =====
(function themeInit(){
  const STORAGE_KEY = 'tk_theme';
  const btn = document.getElementById('theme-toggle');
  if(!btn) return;

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const stored = localStorage.getItem(STORAGE_KEY);
  const startTheme = stored ? stored : (prefersDark ? 'dark' : 'light');

  applyTheme(startTheme);

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  function applyTheme(mode){
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(STORAGE_KEY, mode);
    // alterna ícone
    btn.textContent = mode === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', mode === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro');
  }
})();

const els = {
  lista: $("#lista-imoveis"),
  total: $("#total-encontrados"),
  fFinalidade: $("#f-finalidade"),
  fTipo: $("#f-tipo"),
  fBairro: $("#f-bairro"),
  fPrecoMin: $("#f-preco-min"),
  fPrecoMax: $("#f-preco-max"),
  fQuartos: $("#f-quartos"),
  fSuites: $("#f-suites"),
  fVagas: $("#f-vagas"),
  fAreaMin: $("#f-area-min"),
  fBusca: $("#f-busca"),
  fOrdenar: $("#f-ordenar"),
  filtrosForm: $("#filtros"),
  modal: $("#modal"),
  modalBody: $("#modal-body"),
  modalClose: document.querySelector(".modal-close")
};

let IMOVEIS = [];

init();

async function init() {
  await carregarDados();
  aplicarQueryStringInicial();
  preencherOpcoesDinamicas();
  bindEventos();
  render();
}

async function carregarDados() {
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1mZjhlOB-942aWX8TQk6I8mVWDzrYbgFfJTerONNgbyg/gviz/tq?sheet=Imoveis&tqx=out:json';
  try {
    const res = await fetch(SHEET_URL, { cache: 'no-store' });
    const text = await res.text();
    const json = JSON.parse(text.replace(/^[^{]+/, '').replace(/;?\s*$/, ''));
    const cols = json.table.cols.map(c => c?.label || '');
    IMOVEIS = json.table.rows.map(r => {
      const obj = {};
      r.c.forEach((cell, idx) => obj[cols[idx]] = cell ? (cell.v ?? cell.f ?? '') : '');
      return {
        id: Number(obj.id || 0),
        criadoEm: obj.criadoEm || new Date().toISOString(),
        finalidade: String(obj.finalidade || '').toLowerCase(),
        tipo: obj.tipo || '',
        titulo: obj.titulo || '',
        preco: Number(obj.preco || 0),
        bairro: obj.bairro || '',
        cidade: obj.cidade || 'Salvador',
        uf: (obj.uf || 'BA').toUpperCase(),
        area: Number(obj.area || 0),
        quartos: Number(obj.quartos || 0),
        suites: Number(obj.suites || 0),
        banheiros: Number(obj.banheiros || 0),
        vagas: Number(obj.vagas || 0),
        descricao: obj.descricao || '',
        condominio: Number(obj.condominio || 0),
        iptu: Number(obj.iptu || 0),
        tags: String(obj.tags || '').split(',').map(s=>s.trim()).filter(Boolean),
        imagens: String(obj.imagens || '').split('\n').map(s=>s.trim()).filter(Boolean),
        destaque: String(obj.destaque || '').toLowerCase() === 'true'
      };
    }).filter(i => i.id && i.titulo);
  } catch (e) {
    console.warn('[TK] Falha ao ler planilha, usando DEFAULT_IMOVEIS:', e.message);
    IMOVEIS = DEFAULT_IMOVEIS;
  }
}

function aplicarQueryStringInicial() {
  const params = new URLSearchParams(window.location.search);
  const finalidade = params.get('finalidade');
  if (finalidade && els.fFinalidade) els.fFinalidade.value = finalidade.toLowerCase();
}

function preencherOpcoesDinamicas() {
  const tipos = [...new Set(IMOVEIS.map(i => (i.tipo || '').trim()).filter(Boolean))].sort();
  const bairros = [...new Set(IMOVEIS.map(i => (i.bairro || '').trim()).filter(Boolean))].sort();
  for (const t of tipos) {
    const op = document.createElement('option'); op.value = t; op.textContent = t; els.fTipo.appendChild(op);
  }
  for (const b of bairros) {
    const op = document.createElement('option'); op.value = b; op.textContent = b; els.fBairro.appendChild(op);
  }
}

function bindEventos() {
  els.filtrosForm.addEventListener('input', render);
  els.filtrosForm.addEventListener('reset', () => setTimeout(render, 0));
  els.modalClose.addEventListener('click', fecharModal);
  els.modal.addEventListener('click', (e) => { if (e.target === els.modal) fecharModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });
}

function filtrar() {
  const q = {
    finalidade: els.fFinalidade.value,
    tipo: els.fTipo.value,
    bairro: els.fBairro.value,
    precoMin: parseInt(els.fPrecoMin.value || '0', 10),
    precoMax: parseInt(els.fPrecoMax.value || '0', 10) || Infinity,
    quartos: parseInt(els.fQuartos.value || '0', 10),
    suites: parseInt(els.fSuites.value || '0', 10),
    vagas: parseInt(els.fVagas.value || '0', 10),
    areaMin: parseInt(els.fAreaMin.value || '0', 10),
    busca: (els.fBusca.value || '').trim().toLowerCase()
  };

  let lista = IMOVEIS.filter(i => {
    if (q.finalidade && i.finalidade?.toLowerCase() !== q.finalidade) return false;
    if (q.tipo && i.tipo !== q.tipo) return false;
    if (q.bairro && i.bairro !== q.bairro) return false;
    if (!(i.preco >= q.precoMin && i.preco <= q.precoMax)) return false;
    if (q.quartos && (i.quartos || 0) < q.quartos) return false;
    if (q.suites && (i.suites || 0) < q.suites) return false;
    if (q.vagas && (i.vagas || 0) < q.vagas) return false;
    if (q.areaMin && (i.area || 0) < q.areaMin) return false;

    if (q.busca) {
      const hay = [
        i.titulo, i.descricao, i.tipo, i.bairro, i.cidade,
        ...(i.tags || [])
      ].join(' ').toLowerCase();
      if (!hay.includes(q.busca)) return false;
    }
    return true;
  });

  // Ordenação
  const ord = els.fOrdenar.value;
  lista.sort((a, b) => {
    if (ord === 'preco-asc') return (a.preco||0) - (b.preco||0);
    if (ord === 'preco-desc') return (b.preco||0) - (a.preco||0);
    if (ord === 'area-desc') return (b.area||0) - (a.area||0);
    // recentes (default): por criadoEm desc
    return new Date(b.criadoEm) - new Date(a.criadoEm);
  });

  return lista;
}

function render() {
  const lista = filtrar();
  els.total.textContent = `${lista.length} imóvel(is) encontrado(s)`;
  els.lista.innerHTML = '';

  if (!lista.length) {
    els.lista.innerHTML = `<p>Nenhum imóvel encontrado com os filtros atuais.</p>`;
    injectListLD(lista);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const i of lista) {
    const card = document.createElement('div');
    card.className = 'card';
    const precoFmt = formatarPreco(i.preco, i.finalidade);

    card.innerHTML = `
      <img src="${i.imagens[0]}" alt="${i.titulo}"/>
      <h3>${i.titulo}</h3>
      <div class="badges">
        ${i.finalidade ? `<span class="badge">${capitalize(i.finalidade)}</span>` : ''}
        ${i.tipo ? `<span class="badge">${i.tipo}</span>` : ''}
        ${i.bairro ? `<span class="badge">${i.bairro}</span>` : ''}
        ${i.area ? `<span class="badge">${i.area} m²</span>` : ''}
        ${(i.quartos ?? 0) ? `<span class="badge">${i.quartos} qt</span>` : ''}
        ${(i.suites ?? 0) ? `<span class="badge">${i.suites} st</span>` : ''}
        ${(i.vagas ?? 0) ? `<span class="badge">${i.vagas} vg</span>` : ''}
      </div>
      <p><strong>Preço:</strong> ${precoFmt}</p>
      ${i.condominio ? `<p><strong>Condomínio:</strong> ${toBRL(i.condominio)}/mês</p>` : ''}
      ${i.iptu ? `<p><strong>IPTU:</strong> ${toBRL(i.iptu)}${i.finalidade==='alugar' ? '/mês' : '/ano'}</p>` : ''}
      <p>${i.descricao || ''}</p>
      <div class="acoes">
        <button class="btn" data-acao="detalhes" data-id="${i.id}">Detalhes</button>
        <a class="btn link-whats" target="_blank" rel="noopener" href="${montarWhatsLink(i)}">WhatsApp</a>
      </div>
    `;
    frag.appendChild(card);
  }
  els.lista.appendChild(frag);

  // actions
  els.lista.querySelectorAll('button[data-acao="detalhes"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      const imovel = IMOVEIS.find(x => x.id === id);
      abrirModal(imovel);
    });
  });
  injectListLD(lista);
}

function montarWhatsLink(i) {
  const texto = `Olá! Tenho interesse no imóvel: ${i.titulo} (${i.bairro} - ${i.cidade}/${i.uf}). Preço: ${formatarPreco(i.preco, i.finalidade)}. ID ${i.id}. Pode me enviar mais informações?`;
  return WA_PREFIX + encodeURIComponent(texto);
}

function formatarPreco(valor, finalidade) {
  const prefix = finalidade === 'alugar' ? 'R$ ' : 'R$ ';
  const sufix = finalidade === 'alugar' ? '/mês' : '';
  return prefix + toBRLnum(valor) + sufix;
}

function toBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function toBRLnum(v) {
  return v.toLocaleString('pt-BR');
}
function capitalize(s) { return (s||'').charAt(0).toUpperCase() + (s||'').slice(1); }

// ---- Modal ----
function abrirModal(i) {
  if (!i) return;
  els.modalBody.innerHTML = `
    <h3>${i.titulo}</h3>
    <div class="badges">
      ${i.finalidade ? `<span class="badge">${capitalize(i.finalidade)}</span>` : ''}
      ${i.tipo ? `<span class="badge">${i.tipo}</span>` : ''}
      ${i.bairro ? `<span class="badge">${i.bairro}</span>` : ''}
      ${i.area ? `<span class="badge">${i.area} m²</span>` : ''}
      ${(i.quartos ?? 0) ? `<span class="badge">${i.quartos} quartos</span>` : ''}
      ${(i.suites ?? 0) ? `<span class="badge">${i.suites} suítes</span>` : ''}
      ${(i.vagas ?? 0) ? `<span class="badge">${i.vagas} vagas</span>` : ''}
      ${i.destaque ? `<span class="badge">Destaque</span>` : ''}
    </div>
    <div class="galeria">
      ${i.imagens.map(src => `<img src="${src}" alt="${i.titulo}">`).join('')}
    </div>
    <p><strong>Preço:</strong> ${formatarPreco(i.preco, i.finalidade)}</p>
    ${i.condominio ? `<p><strong>Condomínio:</strong> ${toBRL(i.condominio)}/mês</p>` : ''}
    ${i.iptu ? `<p><strong>IPTU:</strong> ${toBRL(i.iptu)}${i.finalidade==='alugar' ? '/mês' : '/ano'}</p>` : ''}
    <p>${i.descricao || ''}</p>
    <p><strong>Localização:</strong> ${[i.bairro, i.cidade, i.uf].filter(Boolean).join(' - ')}</p>
    <p><strong>Cód. do imóvel:</strong> ${i.id}</p>
    <div class="acoes">
      <a class="btn link-whats" target="_blank" rel="noopener" href="${montarWhatsLink(i)}">Falar no WhatsApp</a>
    </div>
  `;
  els.modal.classList.add('show');
  els.modal.setAttribute('aria-hidden', 'false');
}
function fecharModal() {
  els.modal.classList.remove('show');
  els.modal.setAttribute('aria-hidden', 'true');
}
