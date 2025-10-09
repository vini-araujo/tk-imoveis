// ---- CONFIGURAÇÕES ----
const WA_NUMBER = '557199688-6685'; // <— ajuste aqui
const WA_PREFIX = `https://wa.me/${WA_NUMBER}?text=`;
const DATA_URL = 'imoveis.json'; // arquivo local com os imóveis

// ===== JSON-LD Helpers =====
const SITE_ORIGIN = (typeof location !== 'undefined' ? location.origin : 'https://seusite.com.br');

const tipoToSchema = (tipoBr) => {
  const t = String(tipoBr || '').toLowerCase();
  if (t.includes('casa')) return 'House';
  if (t.includes('sobrado')) return 'House';
  if (t.includes('apart') || t.includes('apto') || t.includes('studio') || t.includes('kit')) return 'Apartment';
  if (t.includes('cobertura')) return 'Apartment';
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
  const graph = lista.slice(0, 24).map(buildPropertyLD);
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

// ===== Fallback se o fetch ao JSON falhar
const DEFAULT_IMOVEIS = [
  {
    id: 1, criadoEm: "2025-09-07T10:00:00Z", finalidade: "comprar", tipo: "Apartamento",
    titulo: "Apartamento 2/4 no Rio Vermelho", preco: 320000, bairro: "Rio Vermelho",
    cidade: "Salvador", uf: "BA", area: 78, quartos: 2, suites: 1, banheiros: 2, vagas: 1,
    descricao: "2 quartos, 1 suíte, 78m², 1 vaga de garagem.",
    condominio: 690, iptu: 1200, tags: ["varanda","elevador"], imagens: ["imagens/casa1.jpeg","imagens/casa1b.jpeg"], destaque: true
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
    condominio: 550, iptu: 900, tags: ["mobiliado","varanda"], imagens: ["imagens/casa1.jpeg","imagens/casa1b.jpeg"], destaque: true
  }
];

// ===== Utilidades DOM / Estado
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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

// ====== Init ======
init();

async function init() {
  await carregarDados();
  aplicarQueryStringInicial();
  preencherOpcoesDinamicas();
  bindEventos();
  render();
}

// ====== Carregar dados de imoveis.json ======
async function carregarDados() {
  try {
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('imoveis.json não encontrado');
    const arr = await res.json();
    // Normaliza estruturas (ex.: garantir arrays)
    IMOVEIS = (Array.isArray(arr) ? arr : []).map(i => ({
      id: Number(i.id || 0),
      criadoEm: i.criadoEm || new Date().toISOString(),
      finalidade: String(i.finalidade || '').toLowerCase(),
      tipo: i.tipo || '',
      titulo: i.titulo || '',
      preco: Number(i.preco || 0),
      bairro: i.bairro || '',
      cidade: i.cidade || 'Salvador',
      uf: (i.uf || 'BA').toUpperCase(),
      area: Number(i.area || 0),
      quartos: Number(i.quartos || 0),
      suites: Number(i.suites || 0),
      banheiros: Number(i.banheiros || 0),
      vagas: Number(i.vagas || 0),
      descricao: i.descricao || '',
      condominio: Number(i.condominio || 0),
      iptu: Number(i.iptu || 0),
      tags: Array.isArray(i.tags) ? i.tags : String(i.tags || '').split(',').map(s=>s.trim()).filter(Boolean),
      imagens: Array.isArray(i.imagens) ? i.imagens : String(i.imagens || '').split('\n').map(s=>s.trim()).filter(Boolean),
      destaque: (i.destaque === true) || String(i.destaque || '').toLowerCase() === 'true'
    })).filter(i => i.id && i.titulo);
  } catch (e) {
    console.warn('[TK] Falha ao ler imoveis.json, usando DEFAULT_IMOVEIS:', e.message);
    IMOVEIS = DEFAULT_IMOVEIS;
  }
}

// ====== Filtros / eventos ======
function aplicarQueryStringInicial() {
  const params = new URLSearchParams(window.location.search);
  const finalidade = params.get('finalidade');
  if (finalidade && els.fFinalidade) els.fFinalidade.value = finalidade.toLowerCase();
}

function preencherOpcoesDinamicas() {
  if (!els.fTipo || !els.fBairro) return;
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
  if (els.filtrosForm) {
    els.filtrosForm.addEventListener('input', render);
    els.filtrosForm.addEventListener('reset', () => setTimeout(render, 0));
  }
  els.modalClose?.addEventListener('click', fecharModal);
  els.modal?.addEventListener('click', (e) => { if (e.target === els.modal) fecharModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });
}

// ====== Lógica de filtro/ordenação ======
function filtrar() {
  const q = {
    finalidade: els.fFinalidade?.value || '',
    tipo: els.fTipo?.value || '',
    bairro: els.fBairro?.value || '',
    precoMin: parseInt(els.fPrecoMin?.value || '0', 10),
    precoMax: parseInt(els.fPrecoMax?.value || '0', 10) || Infinity,
    quartos: parseInt(els.fQuartos?.value || '0', 10),
    suites: parseInt(els.fSuites?.value || '0', 10),
    vagas: parseInt(els.fVagas?.value || '0', 10),
    areaMin: parseInt(els.fAreaMin?.value || '0', 10),
    busca: (els.fBusca?.value || '').trim().toLowerCase()
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

  const ord = els.fOrdenar?.value || 'recentes';
  lista.sort((a, b) => {
    if (ord === 'preco-asc') return (a.preco||0) - (b.preco||0);
    if (ord === 'preco-desc') return (b.preco||0) - (a.preco||0);
    if (ord === 'area-desc') return (b.area||0) - (a.area||0);
    return new Date(b.criadoEm) - new Date(a.criadoEm);
  });

  return lista;
}

// ====== Render de cards ======
function render() {
  const lista = filtrar();
  if (els.total) els.total.textContent = `${lista.length} imóvel(is) encontrado(s)`;
  if (els.lista) els.lista.innerHTML = '';

  if (!lista.length) {
    if (els.lista) els.lista.innerHTML = `<p>Nenhum imóvel encontrado com os filtros atuais.</p>`;
    injectListLD(lista);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const i of lista) {
    const card = document.createElement('div');
    card.className = 'card';
    const capa = (Array.isArray(i.imagens) && i.imagens[0]) ? i.imagens[0] : 'imagens/casa1.jpeg';
    const precoFmt = formatarPreco(i.preco, i.finalidade);

    card.innerHTML = `
      <img class="card-capa" src="${capa}" alt="${i.titulo}"/>
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
    // clique na capa abre o modal com slider
   card.querySelector('.card-capa')?.addEventListener('click', () => abrirModalImovel(i));
    frag.appendChild(card);
  }
  els.lista?.appendChild(frag);

  // actions: botão Detalhes
  els.lista?.querySelectorAll('button[data-acao="detalhes"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      const imovel = IMOVEIS.find(x => x.id === id);
      abrirModalImovel(imovel); // <— aqui também
    });
  });

  // JSON-LD da lista atual
  injectListLD(lista);
}

// ====== Helpers de formatação/Whats ======
function montarWhatsLink(i) {
  const texto = `Olá! Tenho interesse no imóvel: ${i.titulo} (${i.bairro} - ${i.cidade}/${i.uf}). Preço: ${formatarPreco(i.preco, i.finalidade)}. ID ${i.id}. Pode me enviar mais informações?`;
  return WA_PREFIX + encodeURIComponent(texto);
}

function formatarPreco(valor, finalidade) {
  const prefix = 'R$ ';
  const sufix = finalidade === 'alugar' ? '/mês' : '';
  return prefix + toBRLnum(valor) + sufix;
}

function toBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function toBRLnum(v) {
  return Number(v || 0).toLocaleString('pt-BR');
}
function capitalize(s) { return (s||'').charAt(0).toUpperCase() + (s||'').slice(1); }

// ====== SLIDER (galeria) ======
function createSlider(images, startIndex = 0){
  const imgs = (Array.isArray(images) && images.length) ? images : ['imagens/casa1.jpeg'];

  const root = document.createElement('div');
  root.className = 'slider';
  root.setAttribute('role','region');
  root.setAttribute('aria-label','Galeria de imagens do imóvel');

  const track = document.createElement('div');
  track.className = 'slider-track';
  root.appendChild(track);

  imgs.forEach(src=>{
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = src;
    img.alt = 'Foto do imóvel';
    track.appendChild(img);
  });

  const btnPrev = document.createElement('button');
  btnPrev.className = 'slider-btn prev';
  btnPrev.innerHTML = '‹';
  const btnNext = document.createElement('button');
  btnNext.className = 'slider-btn next';
  btnNext.innerHTML = '›';
  root.append(btnPrev, btnNext);

  const dots = document.createElement('div');
  dots.className = 'slider-dots';
  imgs.forEach((_,i)=>{
    const b = document.createElement('button');
    b.addEventListener('click', ()=> goTo(i));
    dots.appendChild(b);
  });
  root.appendChild(dots);

  let index = Math.min(Math.max(startIndex,0), imgs.length-1);
  let width = 0;
  const updateSize = ()=> {
    width = root.clientWidth;
    track.style.transform = `translateX(${-index * width}px)`;
  };
  const updateDots = ()=>{
    dots.querySelectorAll('button').forEach((b,i)=> b.classList.toggle('active', i===index));
  };
  const goTo = (i)=> {
    index = (i + imgs.length) % imgs.length;
    track.style.transform = `translateX(${-index * width}px)`;
    updateDots();
  };
  const next = ()=> goTo(index+1);
  const prev = ()=> goTo(index-1);

  // eventos
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);
  window.addEventListener('resize', updateSize);

  // teclado
  root.tabIndex = 0;
  root.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  // swipe
  let startX = 0, dragging = false;
  root.addEventListener('touchstart', (e)=>{ dragging = true; startX = e.touches[0].clientX; }, {passive:true});
  root.addEventListener('touchmove', (e)=>{
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    track.style.transform = `translateX(${dx - index*width}px)`;
  }, {passive:true});
  root.addEventListener('touchend', (e)=>{
    if (!dragging) return; dragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -50) next(); else if (dx > 50) prev(); else goTo(index);
  });

  // init
  requestAnimationFrame(()=>{
    updateSize();
    updateDots();
  });

  return { el: root, goTo };
}

// ---- Modal (usa slider) ----
function abrirModalImovel(i, fotoIndex = 0) {
  if (!i) return;

  // ELEMENTOS BASE
  const modal = els.modal;
  const body  = els.modalBody;
  const content = modal.querySelector('.modal-content');

  // ===== [NOVO] Cabeçalho do modal com o título (fora da área rolável) =====
  let head = content.querySelector('#modal-head');
  if (!head) {
    head = document.createElement('div');
    head.id = 'modal-head';
    // insere o cabeçalho ANTES do #modal-body (fora do scroll)
    content.insertBefore(head, body);
  }
  head.innerHTML = `<div class="imv-titulo" role="heading" aria-level="3">${i.titulo || 'Imóvel'}</div>`;

  // Limpa o conteúdo rolável e garante que não existe título dentro do body
  body.innerHTML = '';
  // (se existir por alguma versão anterior, remove)
  body.querySelector('.imv-titulo')?.remove();

  // ===== Slider
  const sliderArea = document.createElement('div');
  sliderArea.id = 'slider-area';
  body.appendChild(sliderArea);
  const imagens = Array.isArray(i.imagens) && i.imagens.length ? i.imagens : ['imagens/casa1.jpeg'];
  renderSwiper(sliderArea, imagens);

  // Badges rápidas
  const badges = document.createElement('div');
  badges.className = 'imv-badges';
  const addBadge = (txt) => { const d = document.createElement('div'); d.className = 'imv-badge'; d.textContent = txt; badges.appendChild(d); };
  if (i.finalidade) addBadge(capFirst(i.finalidade));
  if (i.tipo) addBadge(i.tipo);
  if (i.bairro) addBadge(i.bairro);
  if (i.area) addBadge(`${i.area} m²`);
  if ((i.quartos ?? 0) > 0) addBadge(`${i.quartos} quartos`);
  if ((i.suites ?? 0) > 0) addBadge(`${i.suites} suítes`);
  if ((i.banheiros ?? 0) > 0) addBadge(`${i.banheiros} banheiros`);
  if ((i.vagas ?? 0) > 0) addBadge(`${i.vagas} vagas`);
  els.modalBody.appendChild(badges);

  // Grade de informações (à esquerda: rótulo, à direita: valor)
  const grid = document.createElement('div');
  grid.className = 'imv-grid';

  const addLinha = (label, valor, destaque=false) => {
    if (valor === undefined || valor === null || valor === '') return;
    const row = document.createElement('div'); row.className = 'imv-row' + (destaque ? ' imv-row--destaque' : '');
    const l = document.createElement('div'); l.className = 'imv-lbl'; l.textContent = label;
    const v = document.createElement('div'); v.className = 'imv-val'; v.innerHTML = valor;
    row.append(l, v); grid.appendChild(row);
  };

  // Preço (destaque)
  const precoFmt = (i.preco ? toBRL(i.preco) : '—');
  addLinha('Preço', precoFmt, true);

  // Cond., IPTU, Preço/m²
  if (i.condominio) addLinha('Condomínio', `${toBRL(i.condominio)}/mês`);
  if (i.iptu) {
    const sufixo = (i.finalidade === 'alugar') ? '/mês' : '/ano';
    addLinha('IPTU', `${toBRL(i.iptu)}${sufixo}`);
  }
  if (i.preco && i.area) addLinha('Preço/m²', toBRL(i.preco / i.area));

  // Medidas e cômodos
  if (i.area) addLinha('Área', `${i.area} m²`);
  if (i.quartos) addLinha('Quartos', String(i.quartos));
  if (i.suites) addLinha('Suítes', String(i.suites));
  if (i.banheiros) addLinha('Banheiros', String(i.banheiros));
  if (i.vagas) addLinha('Vagas', String(i.vagas));

  // Localização
  const loc = [i.bairro, i.cidade, i.uf].filter(Boolean).join(' - ');
  if (loc) addLinha('Localização', loc);

  // Código e Data
  addLinha('Código do imóvel', `#${i.id}`);
  if (i.criadoEm) {
    const dt = new Date(i.criadoEm);
    if (!isNaN(dt.getTime())) addLinha('Publicado em', dt.toLocaleDateString('pt-BR'));
  }

  // Tags (se existirem)
  if (Array.isArray(i.tags) && i.tags.length) {
    addLinha('Tags', i.tags.map(t => `<span class="imv-chip">${t}</span>`).join(' '));
  }

  els.modalBody.appendChild(grid);

  // Descrição (maior e com respiro)
  if (i.descricao) {
    const desc = document.createElement('div');
    desc.className = 'imv-desc';
    desc.textContent = i.descricao;
    els.modalBody.appendChild(desc);
  }

  // CTA de contato (WhatsApp / Ligar / E-mail)
  const acoes = document.createElement('div'); acoes.className = 'imv-acoes';

  const wa = document.createElement('a');
  wa.className = 'btn btn--whats';
  wa.target = '_blank'; wa.rel = 'noopener';
  wa.href = montarWhatsLink(i); // usa seu WA_NUMBER
  wa.textContent = 'Falar no WhatsApp';
  acoes.appendChild(wa);

  const ligar = document.createElement('a');
  ligar.className = 'btn';
  ligar.href = 'tel:+5571996886685';
  ligar.textContent = 'Ligar';
  acoes.appendChild(ligar);

  const mail = document.createElement('a');
  mail.className = 'btn';
  mail.href = 'mailto:teresa@tkmatosimoveis.com.br?subject=' + encodeURIComponent(`Interesse no imóvel #${i.id} - ${i.titulo}`);
  mail.textContent = 'Enviar e-mail';
  acoes.appendChild(mail);

  els.modalBody.appendChild(acoes);

  // JSON-LD detalhe (se você já usa)
  if (typeof injectDetailLD === 'function') injectDetailLD(i);

  // Abre modal
  els.modal.classList.add('show');
  els.modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

// helpers usados acima
function toBRL(v){ try { return Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});} catch { return v; } }
function capFirst(s){ return (s||'').charAt(0).toUpperCase() + (s||'').slice(1); }
function fecharModal() {
  els.modal.classList.remove('show');
  els.modal.setAttribute('aria-hidden', 'true');
  removeLd('[data-ld="detail"]');
  document.body.classList.remove('modal-open'); // <— libera o scroll da página
}

// ===== Modo Escuro (toggle + persistência) =====
(function themeInit(){
  const STORAGE_KEY = 'tk_theme';
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const stored = localStorage.getItem(STORAGE_KEY);
  const startTheme = stored ? stored : (prefersDark ? 'dark' : 'light');
  applyTheme(startTheme);

  if (btn) {
    btn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  function applyTheme(mode){
    root.setAttribute('data-theme', mode);
    localStorage.setItem(STORAGE_KEY, mode);
    if (btn) {
      btn.textContent = mode === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', mode === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro');
    }
  }
})();

function renderSwiper(container, imagens = []) {
  if (!imagens.length) {
    container.innerHTML = '<p>Sem imagens</p>';
    return null;
  }

  container.innerHTML = `
    <div class="swiper swiper-main">
      <div class="swiper-wrapper">
        ${imagens.map((src,i)=>`
          <div class="swiper-slide">
            <img src="${src}" alt="Foto ${i+1} do imóvel" loading="${i===0?'eager':'lazy'}" decoding="async" onerror="this.src='imagens/casa1.jpeg'">
          </div>`).join('')}
      </div>
      <div class="swiper-button-prev"></div>
      <div class="swiper-button-next"></div>
      <div class="swiper-pagination"></div>
    </div>

    ${imagens.length > 1 ? `
    <div class="swiper swiper-thumbs">
      <div class="swiper-wrapper">
        ${imagens.map((src,i)=>`
          <div class="swiper-slide">
            <img src="${src}" alt="Miniatura ${i+1}" onerror="this.src='imagens/casa1.jpeg'">
          </div>`).join('')}
      </div>
    </div>` : ''}
  `;

  const mainEl   = container.querySelector('.swiper-main');
  const thumbsEl = container.querySelector('.swiper-thumbs');

  let thumbsSwiper = null;
  if (imagens.length > 1 && thumbsEl) {
    thumbsSwiper = new Swiper(thumbsEl, {
      slidesPerView: 'auto',
      spaceBetween: 8,
      freeMode: true,
      watchSlidesProgress: true,
      watchSlidesVisibility: true,
    });
  }

  const mainSwiper = new Swiper(mainEl, {
    loop: imagens.length > 1,
    spaceBetween: 8,
    keyboard: { enabled: true },
    lazy: { loadPrevNext: true, loadPrevNextAmount: 2 },
    navigation: { nextEl: mainEl.querySelector('.swiper-button-next'), prevEl: mainEl.querySelector('.swiper-button-prev') },
    pagination: { el: mainEl.querySelector('.swiper-pagination'), clickable: true },
    thumbs: thumbsSwiper ? { swiper: thumbsSwiper } : undefined,
  });

  return mainSwiper;
}





