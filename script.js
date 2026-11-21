/* ═══════════════════════════════════════════════════════════
   CONFIGURAÇÃO
══════════════════════════════════════════════════════════ */
const KK_PER_BI = 1000;          // 1 bi = 1.000 kk  →  até 999 kk fica em kk, a partir de 1.000 kk vira bi
const LEMBRAR_COTACAO = false;   // true: reabre a página já com a última cotação digitada
const STORAGE_KEY = 'pw_bi_rate';
const AUTO_BI_DELAY = 700;       // ms de pausa na digitação até trocar kk → bi automaticamente
const QTY_MAX = 99999;

/* ═══════════════════════════════════════════════════════════
   ESTADO
══════════════════════════════════════════════════════════ */
let biRate = 0;                  // R$ por 1 bi (0 = ainda não definida)

const hasRate = () => biRate > 0;
const kkRate = () => biRate / KK_PER_BI;

/* ═══════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const setText = (id, txt) => { $(id).textContent = txt; };
const NBSP = '\u00a0';

// toLocaleString pt-BR com mínimo/máximo de casas decimais
const nf = (n, min = 0, max = min) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });

// localStorage com proteção (modo privado / file:// podem bloquear)
const store = {
  get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
  set(key, val) { try { localStorage.setItem(key, val); } catch (_) { /* ignora */ } },
};

/* ═══════════════════════════════════════════════════════════
   LEITURA DE NÚMEROS (padrão pt-BR: ponto = milhar, vírgula = decimal)
   • dotAsDecimal = true (usado nos campos kk/bi): um único ponto também é
     tratado como decimal (ex.: 3.500 → 3,5 kk · 1.540 → 1,540 bi)
══════════════════════════════════════════════════════════ */
function parseBR(raw, dotAsDecimal = false) {
  if (raw === null || raw === undefined) return NaN;
  let s = String(raw).trim().replace(/[^\d.,]/g, '');
  if (!s) return NaN;

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');

  if (hasDot && hasComma) {
    // O último separador é o decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');   // 1.250,50 → 1250.50
    } else {
      s = s.replace(/,/g, '');                      // 1,250.50 → 1250.50
    }
  } else if (hasComma) {
    const commas = (s.match(/,/g) || []).length;
    s = commas > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (hasDot) {
    const parts = s.split('.');
    if (parts.length > 2) {
      s = parts.join('');                           // 1.000.000 → 1000000
    } else if (!dotAsDecimal && parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3 && parts[0] !== '0') {
      s = parts.join('');                           // 1.540 → 1540 (milhar em R$)
    }
    // caso contrário o ponto é decimal: 3.500 → 3.5 · 1.5 → 1.5 · 0.540 → 0.54
  }
  return parseFloat(s);
}

/* ═══════════════════════════════════════════════════════════
   FORMATAÇÃO
══════════════════════════════════════════════════════════ */

// R$ 1.250,00 · valores pequenos (< R$ 0,10) mostram 3 casas
function fmtBRL(n, decimals) {
  if (!isFinite(n)) return '—';
  if (decimals === undefined) decimals = (n > 0 && n < 0.10) ? 3 : 2;
  return 'R$' + NBSP + nf(n, decimals);
}

// 500 kk · 12,5 kk
function fmtKK(kk) {
  if (!isFinite(kk)) return '—';
  return nf(kk, 0, 3) + NBSP + 'kk';
}

// Parte numérica de um valor em bi.
// 1,540 preserva o zero (1 bi + 540 kk) · 1,5 · 1 · 1,255
function biNumber(bi, grouping = true) {
  const kk = bi * KK_PER_BI;
  const kkInt = Math.round(kk);
  const isWhole = Math.abs(kk - kkInt) < 1e-6;
  const opts = isWhole && kkInt % 10 === 0 && kkInt % 100 !== 0
    ? { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: grouping }
    : { minimumFractionDigits: 0, maximumFractionDigits: 4, useGrouping: grouping };
  return bi.toLocaleString('pt-BR', opts);
}

function fmtBI(bi) {
  if (!isFinite(bi)) return '—';
  return biNumber(bi) + NBSP + 'bi';
}

// REGRA GERAL: até 999 kk → kk · a partir de 1.000 kk → bi
function fmtCoins(kk) {
  if (!isFinite(kk)) return '—';
  return kk >= KK_PER_BI ? fmtBI(kk / KK_PER_BI) : fmtKK(kk);
}

// Texto que vai dentro do campo de entrada, de acordo com a unidade
// (sem ponto de milhar para não ser relido como decimal)
function coinFieldText(kk, unit) {
  return unit === 'bi'
    ? biNumber(kk / KK_PER_BI, false)
    : kk.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3, useGrouping: false });
}

function fmtPct(n) {
  if (!isFinite(n)) return '—';
  return nf(n, 2) + '%';
}

/* ═══════════════════════════════════════════════════════════
   HELPERS DE INTERFACE
══════════════════════════════════════════════════════════ */

// 1º clique seleciona tudo · clique seguinte posiciona o cursor para editar
function smartSelect(input) {
  let wasAllSelected = false;
  input.addEventListener('mousedown', () => {
    wasAllSelected = input.value.length > 0 &&
      input.selectionStart === 0 && input.selectionEnd === input.value.length;
  });
  input.addEventListener('click', () => {
    if (wasAllSelected) wasAllSelected = false;
    else input.select();
  });
  input.addEventListener('blur', () => { wasAllSelected = false; });
}

// Feedback rápido no botão (ex.: "✓ Calculado!")
function flashButton(btn, okText) {
  if (!btn) return;
  const label = btn.querySelector('.btn-label');
  if (!label) return;
  if (!btn.dataset.label) btn.dataset.label = label.textContent;
  clearTimeout(btn._flashTimer);
  btn.classList.replace('btn-gold', 'btn-green');
  label.textContent = okText;
  btn._flashTimer = setTimeout(() => {
    btn.classList.replace('btn-green', 'btn-gold');
    label.textContent = btn.dataset.label;
  }, 1200);
}

let toastTimer;
function showToast(msg) {
  setText('toastMsg', msg);
  const t = $('toast');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

async function copyText(txt) {
  try {
    await navigator.clipboard.writeText(txt);
    return true;
  } catch (_) { /* cai no plano B */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (_) {
    return false;
  }
}

document.addEventListener('click', e => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const txt = $(btn.dataset.copy).textContent
    .replace(/^R\$[\s\u00a0]*/, '')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!txt || txt === '—') { showToast('Nada para copiar ainda'); return; }
  copyText(txt).then(ok => showToast(ok ? 'Valor copiado: ' + txt : 'Não foi possível copiar'));
});

/* ═══════════════════════════════════════════════════════════
   CAMPO DE MOEDAS (kk / bi) — usado em 3 lugares
   • guarda o valor sempre em kk internamente
   • a partir de 1.000 kk troca sozinho para bi
══════════════════════════════════════════════════════════ */
function createCoinField({ inputId, toggleId, onChange }) {
  const input = $(inputId);
  const toggle = $(toggleId);
  const opts = toggle.querySelectorAll('.unit-opt');
  let unit = 'kk';
  let autoBi = false;   // true = o bi foi escolhido pelo app (e não pela pessoa)
  let timer = null;

  function paint() {
    opts.forEach(o => {
      const on = o.dataset.val === unit;
      o.classList.toggle('active', on);
      o.setAttribute('aria-pressed', String(on));
    });
    input.placeholder = unit === 'bi' ? 'Ex: 1,5' : 'Ex: 500';
  }

  // valor em kk (NaN se vazio/inválido)
  function getKK() {
    const v = parseBR(input.value, true);
    if (!isFinite(v) || v <= 0) return NaN;
    return unit === 'bi' ? v * KK_PER_BI : v;
  }

  function setUnit(next) {
    if (next === unit) return;
    const kk = getKK();
    if (next === 'kk' && kk >= KK_PER_BI) return;   // acima de 999 kk só existe em bi
    unit = next;
    paint();
    if (isFinite(kk)) input.value = coinFieldText(kk, unit);
  }

  // formata o campo e troca para bi se passou de 999 kk
  function commit() {
    clearTimeout(timer);
    const kk = getKK();
    if (!isFinite(kk)) return;
    if (unit === 'kk' && kk >= KK_PER_BI) { unit = 'bi'; autoBi = true; paint(); }
    input.value = coinFieldText(kk, unit);
  }

  // preenche por código, já na unidade certa
  function setKK(kk) {
    clearTimeout(timer);
    if (!isFinite(kk) || kk <= 0) { clear(); return; }
    unit = kk >= KK_PER_BI ? 'bi' : 'kk';
    autoBi = unit === 'bi';
    paint();
    input.value = coinFieldText(kk, unit);
  }

  function clear(resetUnit = false) {
    clearTimeout(timer);
    input.value = '';
    if (resetUnit || autoBi) { unit = 'kk'; autoBi = false; paint(); }
  }

  // Se o bi veio do app e a pessoa começa um número novo (texto todo selecionado),
  // volta para kk antes da digitação entrar
  input.addEventListener('beforeinput', e => {
    if (!autoBi || !e.inputType || !e.inputType.startsWith('insert')) return;
    const allSelected = input.value.length > 0 &&
      input.selectionStart === 0 && input.selectionEnd === input.value.length;
    if (allSelected) { unit = 'kk'; autoBi = false; paint(); }
  });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    // Campo apagado: volta para kk
    if (autoBi && input.value.trim() === '') { unit = 'kk'; autoBi = false; paint(); }
    // Não mexe no texto enquanto a pessoa digita; troca para bi quando ela faz uma pausa
    if (unit === 'kk' && getKK() >= KK_PER_BI) timer = setTimeout(commit, AUTO_BI_DELAY);
    if (onChange) onChange('typing');
  });
  input.addEventListener('blur', commit);

  toggle.addEventListener('click', e => {
    const opt = e.target.closest('.unit-opt');
    setUnit(opt ? opt.dataset.val : (unit === 'kk' ? 'bi' : 'kk'));
    autoBi = false;   // escolha manual da pessoa
    if (onChange) onChange('unit');
  });

  smartSelect(input);
  paint();

  return {
    input, getKK, setKK, clear, commit,
    hasText: () => input.value.trim() !== '',
  };
}

/* ═══════════════════════════════════════════════════════════
   COTAÇÃO
══════════════════════════════════════════════════════════ */
function updatePills() {
  if (!hasRate()) {
    setText('pill-kk', '—');
    setText('pill-rl', '—');
    return;
  }
  setText('pill-kk', 'R$' + NBSP + nf(kkRate(), 3, 6));
  setText('pill-rl', fmtCoins(1 / kkRate()));
}

function applyRate(format = false) {
  const inp = $('biRate');
  const v = parseBR(inp.value);
  biRate = (isFinite(v) && v > 0) ? v : 0;

  if (hasRate()) {
    if (LEMBRAR_COTACAO) store.set(STORAGE_KEY, String(biRate));
    if (format) inp.value = nf(biRate, 2);
  } else if (format) {
    inp.value = '';
  }

  updatePills();
  refreshAll();
}

$('biRate').addEventListener('input', () => applyRate(false));
$('biRate').addEventListener('blur', () => applyRate(true));
$('biRate').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    applyRate(true);
    if (hasRate()) flashButton($('biCalcBtn'), '✓ Atualizado!');
  }
});
$('biCalcBtn').addEventListener('click', () => {
  applyRate(true);
  if (hasRate()) flashButton($('biCalcBtn'), '✓ Atualizado!');
});
smartSelect($('biRate'));

/* ═══════════════════════════════════════════════════════════
   MÓDULO 1 — CALCULADORA DE ITEM E LOTE
══════════════════════════════════════════════════════════ */
const itemField = createCoinField({
  inputId: 'itemPrice',
  toggleId: 'unitToggle',
  onChange: () => calcItem(),
});
const qtyInput = $('itemQty');

function getQty() {
  const q = parseInt(qtyInput.value, 10);
  return (Number.isFinite(q) && q >= 1) ? Math.min(q, QTY_MAX) : 1;
}

function getItem() {
  const unitKK = itemField.getKK();
  if (!isFinite(unitKK)) return { valid: false };
  const qty = getQty();
  return { valid: true, unitKK, qty, totalKK: unitKK * qty };
}

function calcItem() {
  const d = getItem();

  if (!d.valid) {
    ['unitBRL', 'unitBRLexact', 'totalCoins', 'totalCoinsSub', 'totalBRL', 'totalBRLsub',
      'simBiCount', 'simBiCost', 'simBiChange'].forEach(id => setText(id, '—'));
    setText('simNote', hasRate()
      ? 'Configure o preço do item acima para ver a simulação.'
      : 'Defina o valor da cotação no topo para ver os cálculos.');
    syncComparador(false);
    return;
  }

  const { unitKK, totalKK, qty } = d;
  const unitBRL = unitKK * kkRate();
  const totalBRL = totalKK * kkRate();

  // Custo unitário
  setText('unitBRL', hasRate() ? fmtBRL(unitBRL) : '—');
  setText('unitBRLexact', hasRate()
    ? `${fmtCoins(unitKK)} · exato ${fmtBRL(unitBRL, 4)}`
    : 'aguardando cotação');

  // Total do lote (kk até 999, bi acima)
  setText('totalCoins', fmtCoins(totalKK));
  setText('totalCoinsSub', `${nf(qty)} un. × ${fmtCoins(unitKK)}`);

  // Total em reais
  setText('totalBRL', hasRate() ? fmtBRL(totalBRL) : '—');
  setText('totalBRLsub', hasRate() ? `${nf(qty)} un. × ${fmtBRL(unitBRL)}` : 'aguardando cotação');

  // Simulador de pacote fechado
  const totalBI = totalKK / KK_PER_BI;
  const biNeeded = Math.max(1, Math.ceil(totalBI - 1e-9));
  let changeKK = (biNeeded - totalBI) * KK_PER_BI;
  if (changeKK < 1e-6) changeKK = 0;
  const biCost = biNeeded * biRate;
  const pacote = `${nf(biNeeded)} bi fechado${biNeeded > 1 ? 's' : ''}`;

  setText('simBiCount', nf(biNeeded));
  setText('simBiCost', hasRate() ? fmtBRL(biCost) : '—');
  setText('simBiChange', fmtCoins(changeKK));

  const note = $('simNote');
  if (!hasRate()) {
    note.textContent = 'Defina a cotação do bi no topo para calcular o pacote fechado.';
  } else if (changeKK === 0) {
    note.innerHTML = `Comprando <strong>${pacote}</strong> por <strong>${fmtBRL(biCost)}</strong>, você paga o item exato sem sobrar troco.`;
  } else {
    note.innerHTML = `Comprando <strong>${pacote}</strong> por <strong>${fmtBRL(biCost)}</strong>, você paga o item e fica com <strong>${fmtCoins(changeKK)}</strong> de troco na bag.`;
  }

  syncComparador(false);
}

function runItemCalc() {
  itemField.commit();
  calcItem();
  syncComparador(true);
  flashButton($('calcBtn'), '✓ Calculado!');
}

$('calcBtn').addEventListener('click', runItemCalc);
[itemField.input, qtyInput].forEach(el => {
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); runItemCalc(); }
  });
});

qtyInput.addEventListener('input', calcItem);
qtyInput.addEventListener('blur', () => { qtyInput.value = getQty(); calcItem(); });
$('qtyMinus').addEventListener('click', () => { qtyInput.value = Math.max(1, getQty() - 1); calcItem(); });
$('qtyPlus').addEventListener('click', () => { qtyInput.value = Math.min(QTY_MAX, getQty() + 1); calcItem(); });

$('resetItemBtn').addEventListener('click', () => {
  itemField.clear(true);
  qtyInput.value = '1';

  const btn = $('resetItemBtn');
  btn.classList.add('spin');
  setTimeout(() => btn.classList.remove('spin'), 450);

  calcItem();
  showToast('Campos resetados!');
});

/* ═══════════════════════════════════════════════════════════
   MÓDULO 2 — COMPARADOR INTELIGENTE
══════════════════════════════════════════════════════════ */
let cmpAuto = false;   // true = o campo da Opção A foi preenchido automaticamente pelo Módulo 1

const cmpField = createCoinField({
  inputId: 'cmpA',
  toggleId: 'cmpToggle',
  onChange: source => {
    if (source === 'typing') cmpAuto = false;   // a pessoa digitou: não sobrescrever
    calcCompare();
  },
});

// Copia o total do lote para a Opção A (só sobrescreve o que foi preenchido automaticamente)
function syncComparador(force = false) {
  const d = getItem();

  if (!d.valid) {
    if (cmpAuto) { cmpField.clear(true); cmpAuto = false; calcCompare(); }
    return;
  }
  if (!force && !cmpAuto && cmpField.hasText()) return;

  cmpField.setKK(d.totalKK);
  cmpAuto = true;
  calcCompare();
}

function calcCompare() {
  const aKK = cmpField.getKK();
  const bRaw = parseBR($('cmpB').value);
  const bBRL = (isFinite(bRaw) && bRaw > 0) ? bRaw : NaN;
  const aBRL = (hasRate() && isFinite(aKK)) ? aKK * kkRate() : NaN;

  setText('cmpAPrice', isFinite(aBRL) ? fmtBRL(aBRL) : '—');
  setText('cmpBPrice', isFinite(bBRL) ? fmtBRL(bBRL) : '—');
  setText('cmpANote', hasRate() ? 'custo em Reais (cotação atual)' : 'defina a cotação no topo');

  const sideA = $('sideA'), sideB = $('sideB');
  const vc = $('verdictCard');
  sideA.classList.remove('winner', 'loser');
  sideB.classList.remove('winner', 'loser');
  vc.classList.remove('neutral', 'red-verdict');

  const neutral = title => {
    vc.classList.add('neutral');
    setText('verdictTitle', title);
    ['vEco', 'vEcoCoins', 'vPct'].forEach(id => setText(id, '—'));
    setText('barLabelA', 'Opção A');
    setText('barLabelB', 'Opção B');
    $('barFillA').style.width = '50%';
    $('implicitNote').hidden = true;
  };

  if (!hasRate()) return neutral('⟳ Defina o valor da cotação no topo da página');
  if (!isFinite(aBRL) || !isFinite(bBRL)) return neutral('⟳ Preencha os dois campos para ver o veredito');

  const aCents = Math.round(aBRL * 100);
  const bCents = Math.round(bBRL * 100);
  const diff = Math.abs(aBRL - bBRL);

  // Cotação implícita: quanto o bi custaria comprando direto em R$
  const implBiRate = bBRL / (aKK / KK_PER_BI);
  const implPct = nf(Math.abs((implBiRate / biRate - 1) * 100), 1, 2);
  const note = $('implicitNote');

  if (aCents < bCents) {
    sideA.classList.add('winner');
    sideB.classList.add('loser');
    setText('verdictTitle', '✓ Usar Moedas do Jogo vale mais a pena!');
    setText('vPct', fmtPct((1 - aBRL / bBRL) * 100) + ' mais barato');
    note.innerHTML = `Comprar direto em <strong>R$</strong> equivale a pagar <strong>${fmtBRL(implBiRate)}</strong> no bi — a cotação implícita é <strong>${implPct}% mais cara</strong> que a cotação atual de ${fmtBRL(biRate)}/bi.`;
    note.hidden = false;
  } else if (bCents < aCents) {
    sideB.classList.add('winner');
    sideA.classList.add('loser');
    vc.classList.add('red-verdict');
    setText('verdictTitle', '✓ Comprar por Dinheiro Real vale mais a pena!');
    setText('vPct', fmtPct((1 - bBRL / aBRL) * 100) + ' mais barato');
    note.innerHTML = `Comprar direto em <strong>R$</strong> equivale a pagar <strong>${fmtBRL(implBiRate)}</strong> no bi — <strong>${implPct}% mais barato</strong> que a cotação atual de ${fmtBRL(biRate)}/bi.`;
    note.hidden = false;
  } else {
    vc.classList.add('neutral');
    setText('verdictTitle', '⚖ Ambas as opções custam igual');
    setText('vPct', '0,00%');
    note.hidden = true;
  }

  if (aCents === bCents) {
    setText('vEco', fmtBRL(0));
    setText('vEcoCoins', fmtKK(0));
  } else {
    setText('vEco', fmtBRL(diff));
    setText('vEcoCoins', fmtCoins(diff / kkRate()));
  }

  const pA = Math.max(4, Math.min(96, (aBRL / (aBRL + bBRL)) * 100));
  $('barFillA').style.width = pA + '%';
  setText('barLabelA', fmtBRL(aBRL));
  setText('barLabelB', fmtBRL(bBRL));
}

// Campo de reais da Opção B
const cmpB = $('cmpB');
cmpB.addEventListener('input', calcCompare);
cmpB.addEventListener('blur', () => {
  const v = parseBR(cmpB.value);
  if (isFinite(v) && v > 0) cmpB.value = nf(v, 2);
});
cmpB.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = parseBR(cmpB.value);
    if (isFinite(v) && v > 0) cmpB.value = nf(v, 2);
    calcCompare();
  }
});
smartSelect(cmpB);

/* ═══════════════════════════════════════════════════════════
   MÓDULO 3 — CONVERSOR RÁPIDO BIDIRECIONAL (R$ ⇄ moedas)
══════════════════════════════════════════════════════════ */
let convSource = 'brl';   // último campo que a pessoa mexeu

const convBRL = $('convBRL');
const convField = createCoinField({
  inputId: 'convCoin',
  toggleId: 'convToggle',
  onChange: () => convFrom('coin'),
});

function convFrom(source) {
  convSource = source;

  if (source === 'brl') {
    const brl = parseBR(convBRL.value);
    if (hasRate() && isFinite(brl) && brl > 0) convField.setKK(brl / kkRate());
    else convField.clear();
  } else {
    const kk = convField.getKK();
    convBRL.value = (hasRate() && isFinite(kk)) ? nf(kk * kkRate(), 2) : '';
  }
}

function refreshConv() { convFrom(convSource); }

convBRL.addEventListener('input', () => convFrom('brl'));
convBRL.addEventListener('blur', () => {
  const v = parseBR(convBRL.value);
  if (isFinite(v) && v > 0) convBRL.value = nf(v, 2);
});
convBRL.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = parseBR(convBRL.value);
    if (isFinite(v) && v > 0) convBRL.value = nf(v, 2);
    convFrom('brl');
  }
});
smartSelect(convBRL);

/* ═══════════════════════════════════════════════════════════
   TABELA DE REFERÊNCIA RÁPIDA
══════════════════════════════════════════════════════════ */
const REF_KK = [1, 10, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

function renderTable() {
  $('refBody').innerHTML = REF_KK.map(kk => {
    const big = kk >= KK_PER_BI;
    const brl = hasRate() ? fmtBRL(kk * kkRate()) : '—';
    return `<tr${kk === KK_PER_BI ? ' class="sep"' : ''}>` +
      `<td>${fmtCoins(kk)}</td>` +
      `<td${big && hasRate() ? ' class="hl"' : ''}>${brl}</td></tr>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
function refreshAll() {
  calcItem();
  calcCompare();
  refreshConv();
  renderTable();
}

(function init() {
  if (LEMBRAR_COTACAO) {
    const saved = parseFloat(store.get(STORAGE_KEY));
    if (saved > 0) {
      biRate = saved;
      $('biRate').value = nf(saved, 2);
    }
  }
  updatePills();
  refreshAll();
})();
