/* ═══════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════ */
let biRate = 0;    // R$ por 1 bi (inicia vazio com marca d'água 0,00)
let convLock = false;

/* ═══════════════════════════════════════════════════════════
   UTILS & FORMATAÇÃO BRASILEIRA (pt-BR)
══════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

// Converte strings no formato brasileiro ou numérico para float seguro
function parseBR(str) {
  if (!str && str !== 0) return NaN;
  str = String(str).trim().replace(/[^\d.,]/g, '');
  if (!str) return NaN;

  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // 1.250,50 -> 1250.50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,250.50 -> 1250.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (str.includes('.')) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      // 1.000.000 -> 1000000
      str = str.replace(/\./g, '');
    } else {
      const parts = str.split('.');
      if (parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3 && parts[0] !== '0') {
        // 1.000 ou 50.000 -> 1000 ou 50000
        str = parts[0] + parts[1];
      } else {
        // 28.5 ou 28.00 ou 0.028
        str = parts[0] + '.' + parts[1];
      }
    }
  }
  return parseFloat(str);
}

// Formata valores em Reais no padrão brasileiro (ex: R$ 1.250,00, R$ 28,00 ou R$ 0,028 para frações)
function fmtBRL(n, decimals) {
  if (!isFinite(n)) return '—';
  if (decimals === undefined) {
    decimals = (n > 0 && n < 0.10) ? 3 : 2;
  }
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Formata número cru em Reais no padrão brasileiro (ex: 1.250,00 ou 28,00)
function fmtBRLraw(n, decimals = 2) {
  if (!isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Formata valores em KK com separador de milhar (ex: 1.000 kk, 10.000 kk)
function fmtKK(n, maxDecimals = 3) {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals }) + '\u00a0kk';
}

// Formata valores em BI com separador e decimais corretos (ex: 1 bi, 2,5 bi, 10 bi)
function fmtBI(n, maxDecimals = 4) {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals }) + '\u00a0bi';
}

// Formata números gerais com padrão brasileiro de pontos e vírgulas
function fmtNumBR(n, maxDecimals = 4) {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
}

// Formata porcentagens com vírgula (ex: 12,50%)
function fmtPct(n) {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

/* ═══════════════════════════════════════════════════════════
   COTAÇÃO
══════════════════════════════════════════════════════════ */
function initRate() {
  const inp = $('biRate');
  inp.value = '';
  biRate = 0;
  updatePills();
}

function updatePills() {
  if (!biRate || biRate <= 0) {
    $('pill-kk').textContent = '—';
    $('pill-rl').textContent = '—';
    return;
  }
  const kkRate = biRate / 1000;
  const rlKK = 1 / kkRate;
  $('pill-kk').textContent = 'R$\u00a0' + kkRate.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 6 });
  $('pill-rl').textContent = rlKK.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + '\u00a0kk';
}

$('biRate').addEventListener('input', () => {
  const valStr = $('biRate').value.trim();
  if (!valStr) {
    biRate = 0;
    updatePills();
    calcItem();
    calcCompare();
    calcConv('none');
    renderTable();
    return;
  }
  const v = parseBR(valStr);
  if (v > 0) {
    biRate = v;
    localStorage.setItem('pw_bi_rate', v);
    updatePills();
    calcItem();
    calcCompare();
    calcConv('none');
    renderTable();
  }
});

// Formata o campo ao pressionar Enter e dispara cálculo
function applyBiRate() {
  const valStr = $('biRate').value.trim();
  if (!valStr) {
    biRate = 0;
    $('biRate').value = '';
    updatePills();
    calcItem();
    calcCompare();
    calcConv('none');
    renderTable();
    return;
  }
  const v = parseBR(valStr);
  if (v > 0) {
    biRate = v;
    localStorage.setItem('pw_bi_rate', v);
    $('biRate').value = fmtBRLraw(v, 2);  // Formata: 28 → 28,00
    updatePills();
    calcItem();
    calcCompare();
    calcConv('none');
    renderTable();
    flashBiBtn();
  }
}

function flashBiBtn() {
  const btn = $('biCalcBtn');
  if (!btn) return;
  btn.classList.add('btn-green');
  btn.classList.remove('btn-gold');
  btn.innerHTML = '✓ Atualizado!';
  setTimeout(() => {
    btn.classList.remove('btn-green');
    btn.classList.add('btn-gold');
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-8 8M4 12a8 8 0 0 1 8-8M20 4l-2 2 2 2M4 8l2-2-2-2"/></svg> Atualizar`;
  }, 1200);
}

$('biRate').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); applyBiRate(); }
});

$('biRate').addEventListener('blur', () => {
  const valStr = $('biRate').value.trim();
  if (valStr) {
    const v = parseBR(valStr);
    if (v > 0) $('biRate').value = fmtBRLraw(v, 2);
  } else {
    $('biRate').value = '';
  }
  biRateWasAllSelected = false;
});

// 1º clique seleciona tudo | clique a mais tira seleção para editar número por número
let biRateWasAllSelected = false;

$('biRate').addEventListener('mousedown', function () {
  biRateWasAllSelected = (this.selectionStart === 0 && this.selectionEnd === this.value.length && this.value.length > 0);
});

$('biRate').addEventListener('click', function () {
  if (biRateWasAllSelected) {
    biRateWasAllSelected = false;
  } else {
    this.select();
  }
});

$('biCalcBtn').addEventListener('click', applyBiRate);

/* ═══════════════════════════════════════════════════════════
   MÓDULO 1 — CALCULADORA DE ITEM E LOTE
══════════════════════════════════════════════════════════ */
function getItemKK() {
  const price = parseBR($('itemPrice').value);
  const unit = $('itemUnit').value;
  const qty = parseInt($('itemQty').value) || 1;
  if (!isFinite(price) || price <= 0) return { valid: false };
  const unitKK = unit === 'bi' ? price * 1000 : price;
  const totalKK = unitKK * qty;
  return { valid: true, unitKK, totalKK, qty, unitPriceRaw: price };
}

// Formata o input de preço de acordo com a unidade selecionada (KK vs BI)
function formatItemPriceInput() {
  const p = parseBR($('itemPrice').value);
  if (!isFinite(p) || p <= 0) return;
  const unit = $('itemUnit').value;
  if (unit === 'kk') {
    $('itemPrice').value = p.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  } else {
    $('itemPrice').value = p.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  }
}

// Seleção de clique inteligente no input de preço
let itemPriceWasAllSelected = false;
$('itemPrice').addEventListener('mousedown', function () {
  itemPriceWasAllSelected = (this.selectionStart === 0 && this.selectionEnd === this.value.length && this.value.length > 0);
});
$('itemPrice').addEventListener('click', function () {
  if (itemPriceWasAllSelected) {
    itemPriceWasAllSelected = false;
  } else {
    this.select();
  }
});
$('itemPrice').addEventListener('blur', () => {
  formatItemPriceInput();
  itemPriceWasAllSelected = false;
});

function calcItem() {
  const d = getItemKK();
  const unit = $('itemUnit').value;

  if (!d.valid) {
    ['unitBRL', 'unitBRLexact', 'totalKK', 'totalBI', 'totalBRL'].forEach(id => { $(id).textContent = '—'; });
    $('subKK').textContent = '—';
    $('subBI').textContent = '—';
    $('totalBRLsub').textContent = '—';
    $('simBiCount').textContent = $('simBiCost').textContent = $('simBiChange').textContent = '—';
    $('simNote').textContent = (!biRate || biRate <= 0) ? 'Defina o valor da cotação no topo para ver os cálculos.' : 'Configure o preço do item acima para ver a simulação.';
    return;
  }

  const { unitKK, totalKK, qty } = d;
  const hasRate = (biRate && biRate > 0);
  const kkRate = hasRate ? biRate / 1000 : 0;
  const unitBRL = unitKK * kkRate;
  const totalBRL = totalKK * kkRate;
  const totalBI = totalKK / 1000;

  // Custo Unitário em R$
  $('unitBRL').textContent = hasRate ? fmtBRL(unitBRL) : '—';
  $('unitBRLexact').textContent = hasRate ? `exato: ${fmtBRL(unitBRL, 4)} · 1 ${unit}` : 'aguardando cotação';

  // Separação e formatação visual dos valores conforme KK ou BI
  const cardKK = $('cardKK');
  const cardBI = $('cardBI');
  const labelKK = $('labelKK');
  const labelBI = $('labelBI');
  const subKK = $('subKK');
  const subBI = $('subBI');

  if (unit === 'kk') {
    // Quando estiver selecionado KK: destaque em KK
    cardKK.classList.add('accent-gold');
    cardBI.classList.remove('accent-gold');
    cardKK.style.order = '1';
    cardBI.style.order = '2';

    labelKK.textContent = 'Total do Lote (kk)';
    $('totalKK').textContent = fmtKK(totalKK);
    subKK.textContent = `(= ${fmtBI(totalBI)})`;

    labelBI.textContent = 'Equivalente em bi';
    $('totalBI').textContent = fmtBI(totalBI);
    subBI.textContent = 'conversão automática';

    const changeKK = (Math.ceil(totalBI) - totalBI) * 1000;
    $('simBiChange').textContent = fmtKK(changeKK);
  } else {
    // Quando estiver selecionado BI: destaque em BI
    cardBI.classList.add('accent-gold');
    cardKK.classList.remove('accent-gold');
    cardBI.style.order = '1';
    cardKK.style.order = '2';

    labelBI.textContent = 'Total do Lote (bi)';
    $('totalBI').textContent = fmtBI(totalBI);
    subBI.textContent = `(= ${fmtKK(totalKK)})`;

    labelKK.textContent = 'Equivalente em kk';
    $('totalKK').textContent = fmtKK(totalKK);
    subKK.textContent = 'conversão automática';

    const changeKK = (Math.ceil(totalBI) - totalBI) * 1000;
    $('simBiChange').textContent = fmtBI(changeKK / 1000);
  }

  // Total Exato em R$
  $('totalBRL').textContent = hasRate ? fmtBRL(totalBRL) : '—';
  $('totalBRLsub').textContent = hasRate ? `${qty.toLocaleString('pt-BR')} un. × ${fmtBRL(unitBRL)}` : 'aguardando cotação';

  // Simulador BI com separadores pt-BR
  const biNeeded = Math.ceil(totalBI);
  const biCost = biNeeded * biRate;
  const changeKK = (biNeeded - totalBI) * 1000;

  $('simBiCount').textContent = biNeeded.toLocaleString('pt-BR');
  $('simBiCost').textContent = hasRate ? fmtBRL(biCost) : '—';

  if (!hasRate) {
    $('simNote').textContent = 'Defina a cotação do bi no topo para calcular o pacote fechado.';
  } else if (changeKK === 0) {
    $('simNote').innerHTML = `Comprando <strong>${biNeeded.toLocaleString('pt-BR')} bi fechado${biNeeded > 1 ? 's' : ''}</strong> por <strong>${fmtBRL(biCost)}</strong>, você paga o item exato sem sobrar troco.`;
  } else if (unit === 'kk') {
    $('simNote').innerHTML = `Comprando <strong>${biNeeded.toLocaleString('pt-BR')} bi fechado${biNeeded > 1 ? 's' : ''}</strong> por <strong>${fmtBRL(biCost)}</strong>, você paga o item e fica com <strong>${fmtKK(changeKK)}</strong> de troco na bag.`;
  } else {
    $('simNote').innerHTML = `Comprando <strong>${biNeeded.toLocaleString('pt-BR')} bi fechado${biNeeded > 1 ? 's' : ''}</strong> por <strong>${fmtBRL(biCost)}</strong>, você paga o item e fica com <strong>${fmtBI(changeKK / 1000)}</strong> (${fmtKK(changeKK)}) de troco na bag.`;
  }

  // Sync comparador passivo (só quando o campo cmpA estiver vazio)
  if (!$('cmpA').value.trim()) {
    const price = parseBR($('itemPrice').value);
    setCmpUnit(unit, false);
    $('cmpA').value = unit === 'bi'
      ? fmtNumBR(price, 4)
      : fmtNumBR(totalKK, 3);
    calcCompare();
  }
}

$('itemQty').addEventListener('input', calcItem);

/* ─── Toggle kk / bi ──────────────────────────────────── */
(function initUnitToggle() {
  const toggle = $('unitToggle');
  if (!toggle) return;
  const opts = toggle.querySelectorAll('.unit-opt');
  const hidden = $('itemUnit');
  const priceInput = $('itemPrice');

  toggle.addEventListener('click', () => {
    const current = hidden.value;
    const next = current === 'kk' ? 'bi' : 'kk';
    hidden.value = next;
    opts.forEach(o => {
      o.classList.toggle('active', o.dataset.val === next);
    });

    priceInput.placeholder = '0';
    formatItemPriceInput();
    calcItem();
  });
})();

// Calcular ao pressionar Enter no campo de preço
$('itemPrice').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    formatItemPriceInput();
    calcItem();
    syncComparadorForced();
    flashCalcBtn();
  }
});

// Botão Calcular (Módulo 1)
$('calcBtn').addEventListener('click', () => {
  formatItemPriceInput();
  calcItem();
  syncComparadorForced();
  flashCalcBtn();
});

// Força sync do comparador
function syncComparadorForced() {
  const d = getItemKK();
  if (!d.valid) return;
  const unit = $('itemUnit').value;
  const price = parseBR($('itemPrice').value);
  setCmpUnit(unit, false);
  $('cmpA').value = unit === 'bi'
    ? fmtNumBR(price, 4)
    : fmtNumBR(d.totalKK, 3);
  calcCompare();
}

function flashCalcBtn() {
  const btn = $('calcBtn');
  btn.classList.add('btn-green');
  btn.classList.remove('btn-gold');
  btn.textContent = '✓ Calculado!';
  setTimeout(() => {
    btn.classList.remove('btn-green');
    btn.classList.add('btn-gold');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Calcular`;
  }, 1200);
}

$('qtyMinus').addEventListener('click', () => {
  const v = parseInt($('itemQty').value) || 1;
  if (v > 1) { $('itemQty').value = v - 1; calcItem(); }
});
$('qtyPlus').addEventListener('click', () => {
  $('itemQty').value = (parseInt($('itemQty').value) || 1) + 1;
  calcItem();
});

// Resetar campos da Calculadora de Item e Lote (Preço e Quantidade)
function resetItemCalc() {
  const priceInp = $('itemPrice');
  const qtyInp = $('itemQty');
  const resetBtn = $('resetItemBtn');

  priceInp.value = '';
  qtyInp.value = '1';

  // Reseta unidade para kk
  const hidden = $('itemUnit');
  if (hidden && hidden.value !== 'kk') {
    hidden.value = 'kk';
    const toggle = $('unitToggle');
    if (toggle) {
      const opts = toggle.querySelectorAll('.unit-opt');
      opts.forEach(o => o.classList.toggle('active', o.dataset.val === 'kk'));
    }
  }

  itemPriceWasAllSelected = false;

  // Animação de giro nas setas circulares
  if (resetBtn) {
    resetBtn.classList.add('spin');
    setTimeout(() => resetBtn.classList.remove('spin'), 450);
  }

  calcItem();
  showToast('Campos resetados!');
}

const resetBtn = $('resetItemBtn');
if (resetBtn) {
  resetBtn.addEventListener('click', resetItemCalc);
}

/* ─── Copiar ─────────────────────────────────────────── */
function copyVal(id) {
  const el = $(id);
  const txt = el.textContent.replace(/^R\$[\s\u00a0]*/, '').trim();
  navigator.clipboard.writeText(txt).then(() => showToast('Valor copiado: ' + txt));
}
window.copyVal = copyVal;

/* ═══════════════════════════════════════════════════════════
   MÓDULO 2 — COMPARADOR INTELIGENTE
══════════════════════════════════════════════════════════ */
function calcCompare() {
  const aRaw = parseBR($('cmpA').value);
  const aUnit = $('cmpAUnit').value;
  const bRaw = parseBR($('cmpB').value);

  const hasRate = (biRate && biRate > 0);
  const kkRate = hasRate ? biRate / 1000 : 0;
  const aKK = isFinite(aRaw) && aRaw > 0
    ? (aUnit === 'bi' ? aRaw * 1000 : aRaw)
    : NaN;
  const aBRL = hasRate ? aKK * kkRate : NaN;
  const bBRL = isFinite(bRaw) && bRaw > 0 ? bRaw : NaN;

  $('cmpAPrice').textContent = isFinite(aBRL) ? fmtBRL(aBRL) : '—';
  $('cmpBPrice').textContent = isFinite(bBRL) ? fmtBRL(bBRL) : '—';

  // Nota explicativa dinâmica da Opção A
  if (!hasRate && isFinite(aRaw) && aRaw > 0) {
    $('cmpANote').textContent = aUnit === 'kk'
      ? `equivale a ${fmtBI(aRaw / 1000)} · defina a cotação no topo`
      : `equivale a ${fmtKK(aRaw * 1000)} · defina a cotação no topo`;
  } else if (isFinite(aRaw) && aRaw > 0) {
    $('cmpANote').textContent = aUnit === 'kk'
      ? `custo em Reais · equivale a ${fmtBI(aRaw / 1000)}`
      : `custo em Reais · equivale a ${fmtKK(aRaw * 1000)}`;
  } else {
    $('cmpANote').textContent = hasRate ? 'custo em Reais (cotação atual)' : 'defina a cotação no topo';
  }

  const sideA = $('sideA'), sideB = $('sideB');
  const vc = $('verdictCard');
  const vt = $('verdictTitle');

  sideA.classList.remove('winner', 'loser');
  sideB.classList.remove('winner', 'loser');
  vc.classList.remove('neutral', 'red-verdict');

  if (!hasRate) {
    vc.classList.add('neutral');
    vt.textContent = '⟳ Defina o valor da cotação no topo da página';
    ['vEco', 'vEcoKK', 'vPct'].forEach(i => { $(i).textContent = '—'; });
    $('barFillA').style.width = '50%';
    $('implicitNote').style.display = 'none';
    return;
  }

  if (!isFinite(aBRL) || !isFinite(bBRL)) {
    vc.classList.add('neutral');
    vt.textContent = '⟳ Preencha os dois campos para ver o veredito';
    ['vEco', 'vEcoKK', 'vPct'].forEach(i => { $(i).textContent = '—'; });
    $('barFillA').style.width = '50%';
    $('implicitNote').style.display = 'none';
    return;
  }

  const diff = Math.abs(aBRL - bBRL);
  const diffKK = diff / kkRate;

  if (aBRL < bBRL) {
    sideA.classList.add('winner');
    sideB.classList.add('loser');
    vt.textContent = '✓ Usar Moedas do Jogo vale mais a pena!';
    $('vEco').textContent = fmtBRL(diff);
    $('vEcoKK').textContent = fmtKK(diffKK);
    const advantage = ((1 - aBRL / bBRL) * 100);
    $('vPct').textContent = fmtPct(advantage) + ' mais barato';

    const implBiRate = bBRL / (aKK / 1000);
    const diffRatePct = Math.abs((implBiRate / biRate - 1) * 100);
    $('implicitNote').style.display = '';
    $('implicitNote').innerHTML = `Comprar direto em <strong>R$</strong> equivale a pagar <strong>${fmtBRL(implBiRate)}</strong> no bi — a cotação implícita é <strong>${diffRatePct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}% mais cara</strong> que a cotação atual de ${fmtBRL(biRate)}/bi.`;
  } else if (bBRL < aBRL) {
    sideB.classList.add('winner');
    sideA.classList.add('loser');
    vc.classList.add('red-verdict');
    vt.textContent = '✓ Comprar por Dinheiro Real vale mais a pena!';
    $('vEco').textContent = fmtBRL(diff);
    $('vEcoKK').textContent = fmtKK(diffKK);
    const advantage = ((1 - bBRL / aBRL) * 100);
    $('vPct').textContent = fmtPct(advantage) + ' mais barato';

    const implBiRate = bBRL / (aKK / 1000);
    const diffRatePct = Math.abs((1 - implBiRate / biRate) * 100);
    $('implicitNote').style.display = '';
    $('implicitNote').innerHTML = `Comprar direto em <strong>R$</strong> equivale a pagar <strong>${fmtBRL(implBiRate)}</strong> no bi — <strong>${diffRatePct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}% mais barato</strong> que a cotação atual de ${fmtBRL(biRate)}/bi.`;
  } else {
    sideA.classList.remove('winner', 'loser');
    sideB.classList.remove('winner', 'loser');
    vc.classList.add('neutral');
    vt.textContent = '⚖ Ambas as opções custam igual';
    $('vEco').textContent = 'R$ 0,00';
    $('vEcoKK').textContent = '0 kk';
    $('vPct').textContent = '0,00%';
    $('implicitNote').style.display = 'none';
  }

  const total = aBRL + bBRL;
  const pA = Math.max(4, Math.min(96, (aBRL / total) * 100));
  $('barFillA').style.width = pA + '%';
  $('barLabelA').textContent = fmtBRL(aBRL);
  $('barLabelB').textContent = fmtBRL(bBRL);
}

/* ─── Toggle kk / bi do Comparador ─────────────────────── */
function setCmpUnit(newUnit, shouldConvert = true) {
  const hidden = $('cmpAUnit');
  const oldUnit = hidden ? hidden.value : 'kk';
  if (hidden) hidden.value = newUnit;

  const optKK = $('cmpOptKK');
  const optBI = $('cmpOptBI');
  if (optKK) optKK.classList.toggle('active', newUnit === 'kk');
  if (optBI) optBI.classList.toggle('active', newUnit === 'bi');

  const input = $('cmpA');
  if (input) {
    input.placeholder = newUnit === 'kk' ? 'Ex: 10.000' : 'Ex: 10';
    const val = parseBR(input.value);
    if (isFinite(val) && val > 0) {
      if (shouldConvert && oldUnit !== newUnit) {
        if (newUnit === 'bi') {
          // Converte kk para bi
          input.value = fmtNumBR(val / 1000, 4);
        } else {
          // Converte bi para kk
          input.value = fmtNumBR(val * 1000, 3);
        }
      } else {
        input.value = newUnit === 'bi' ? fmtNumBR(val, 4) : fmtNumBR(val, 3);
      }
    }
  }

  calcCompare();
}

const cmpToggle = $('cmpToggle');
if (cmpToggle) {
  cmpToggle.addEventListener('click', e => {
    const targetOpt = e.target.closest('.unit-opt');
    const current = $('cmpAUnit').value;
    let next = current === 'kk' ? 'bi' : 'kk';
    if (targetOpt && targetOpt.dataset.val) {
      next = targetOpt.dataset.val;
    }
    setCmpUnit(next, true);
  });
}

// Seleção inteligente e formatação no campo cmpA
let cmpAWasAllSelected = false;
$('cmpA').addEventListener('mousedown', function () {
  cmpAWasAllSelected = (this.selectionStart === 0 && this.selectionEnd === this.value.length && this.value.length > 0);
});
$('cmpA').addEventListener('click', function () {
  if (cmpAWasAllSelected) {
    cmpAWasAllSelected = false;
  } else {
    this.select();
  }
});
$('cmpA').addEventListener('blur', () => {
  const v = parseBR($('cmpA').value);
  const unit = $('cmpAUnit').value;
  if (isFinite(v) && v > 0) {
    $('cmpA').value = unit === 'bi' ? fmtNumBR(v, 4) : fmtNumBR(v, 3);
  }
  cmpAWasAllSelected = false;
});
$('cmpA').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = parseBR($('cmpA').value);
    const unit = $('cmpAUnit').value;
    if (isFinite(v) && v > 0) {
      $('cmpA').value = unit === 'bi' ? fmtNumBR(v, 4) : fmtNumBR(v, 3);
    }
    calcCompare();
  }
});
$('cmpA').addEventListener('input', calcCompare);
$('cmpB').addEventListener('input', calcCompare);

// Formatação padrão BR no blur/Enter do campo de Reais da Opção B
let cmpBWasAllSelected = false;
$('cmpB').addEventListener('mousedown', function () {
  cmpBWasAllSelected = (this.selectionStart === 0 && this.selectionEnd === this.value.length && this.value.length > 0);
});
$('cmpB').addEventListener('click', function () {
  if (cmpBWasAllSelected) {
    cmpBWasAllSelected = false;
  } else {
    this.select();
  }
});
$('cmpB').addEventListener('blur', () => {
  const v = parseBR($('cmpB').value);
  if (isFinite(v) && v > 0) {
    $('cmpB').value = fmtBRLraw(v, 2);
  }
  cmpBWasAllSelected = false;
});
$('cmpB').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = parseBR($('cmpB').value);
    if (isFinite(v) && v > 0) $('cmpB').value = fmtBRLraw(v, 2);
    calcCompare();
  }
});

/* ═══════════════════════════════════════════════════════════
   MÓDULO 3 — CONVERSOR RÁPIDO BIDIRECIONAL
══════════════════════════════════════════════════════════ */
function calcConv(source) {
  if (convLock) return;
  convLock = true;
  const hasRate = (biRate && biRate > 0);
  const kkRate = hasRate ? biRate / 1000 : 0;

  if (source === 'brl') {
    const v = parseBR($('convBRL').value);
    if (hasRate && isFinite(v) && v >= 0) {
      const kk = v / kkRate;
      $('convKK').value = kk === 0 ? '' : fmtNumBR(kk, 4);
      $('convBI').value = kk === 0 ? '' : fmtNumBR(kk / 1000, 6);
    } else { $('convKK').value = ''; $('convBI').value = ''; }
  } else if (source === 'kk') {
    const v = parseBR($('convKK').value);
    if (isFinite(v) && v >= 0) {
      $('convBRL').value = (hasRate && v > 0) ? fmtBRLraw(v * kkRate, 2) : '';
      $('convBI').value = v === 0 ? '' : fmtNumBR(v / 1000, 6);
    } else { $('convBRL').value = ''; $('convBI').value = ''; }
  } else if (source === 'bi') {
    const v = parseBR($('convBI').value);
    if (isFinite(v) && v >= 0) {
      const kk = v * 1000;
      $('convBRL').value = (hasRate && kk > 0) ? fmtBRLraw(kk * kkRate, 2) : '';
      $('convKK').value = v === 0 ? '' : fmtNumBR(kk, 4);
    } else { $('convBRL').value = ''; $('convKK').value = ''; }
  }

  convLock = false;
}

$('convBRL').addEventListener('input', () => calcConv('brl'));
$('convKK').addEventListener('input', () => calcConv('kk'));
$('convBI').addEventListener('input', () => calcConv('bi'));

// Formatação padrão BR no blur/Enter do campo de Reais do Conversor
let convBRLWasAllSelected = false;
$('convBRL').addEventListener('mousedown', function () {
  convBRLWasAllSelected = (this.selectionStart === 0 && this.selectionEnd === this.value.length && this.value.length > 0);
});
$('convBRL').addEventListener('click', function () {
  if (convBRLWasAllSelected) {
    convBRLWasAllSelected = false;
  } else {
    this.select();
  }
});
$('convBRL').addEventListener('blur', () => {
  const v = parseBR($('convBRL').value);
  if (isFinite(v) && v > 0) {
    $('convBRL').value = fmtBRLraw(v, 2);
  }
  convBRLWasAllSelected = false;
});
$('convBRL').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = parseBR($('convBRL').value);
    if (isFinite(v) && v > 0) $('convBRL').value = fmtBRLraw(v, 2);
    calcConv('brl');
  }
});

/* ═══════════════════════════════════════════════════════════
   TABELA DE REFERÊNCIA RÁPIDA
══════════════════════════════════════════════════════════ */
const REF_VALUES = [
  { label: '1 kk', kk: 1 },
  { label: '10 kk', kk: 10 },
  { label: '50 kk', kk: 50 },
  { label: '100 kk', kk: 100 },
  { label: '250 kk', kk: 250 },
  { label: '500 kk', kk: 500 },
  { label: '1 bi', kk: 1000, sep: true },
  { label: '2 bi', kk: 2000 },
  { label: '5 bi', kk: 5000 },
  { label: '10 bi', kk: 10000 },
  { label: '20 bi', kk: 20000 },
  { label: '50 bi', kk: 50000 },
  { label: '100 bi', kk: 100000 },
];

function renderTable() {
  const hasRate = (biRate && biRate > 0);
  const kkRate = hasRate ? biRate / 1000 : 0;
  const tbody = $('refBody');
  tbody.innerHTML = '';
  REF_VALUES.forEach(row => {
    const tr = document.createElement('tr');
    if (row.sep) tr.classList.add('sep');
    const brl = hasRate ? fmtBRL(row.kk * kkRate) : '—';
    tr.innerHTML = `
  <td>${row.label}</td>
  <td>${row.kk.toLocaleString('pt-BR')} kk</td>
  <td>${(row.kk / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} bi</td>
  <td class="${row.kk >= 1000 && hasRate ? 'hl' : ''}">${brl}</td>
`;
    tbody.appendChild(tr);
  });
}

/* ═══════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════ */
let toastTimer;
function showToast(msg) {
  $('toastMsg').textContent = msg;
  const t = $('toast');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ═══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
initRate();
calcItem();
calcCompare();
renderTable();
