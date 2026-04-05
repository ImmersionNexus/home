// ═══════════════════════════════════════════════════════════
//  犯罪報酬シミュレーター — script.js
// ═══════════════════════════════════════════════════════════

let items = [];
let chartInstance = null;
let nextId = 1;
let editingId = null;   // 編集中のアイテムID（nullなら新規追加モード）

// ── 初期化 ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[name="amount-type"]').forEach(r => {
        r.addEventListener('change', toggleAmountType);
    });
    document.querySelectorAll('input[name="price-type"]').forEach(r => {
        r.addEventListener('change', togglePriceType);
    });
    document.getElementById('target-mean').addEventListener('input', () => {
        updateEV();
        if (chartInstance) redrawTargetLine();
    });
    // 保存済みテーマを復元
    if (localStorage.getItem('theme') === 'light') applyTheme('light');
    updateEV();
    renderItemList();
    renderBreakdown();
});

// ── テーマ切替 ─────────────────────────────────────────────
function toggleTheme() {
    const isLight = document.documentElement.classList.contains('light');
    applyTheme(isLight ? 'dark' : 'light');
}
function applyTheme(theme) {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.getElementById('theme-icon').textContent = theme === 'light' ? '☾' : '☀';
    localStorage.setItem('theme', theme);
}

// ── 個数タイプ切替 ──────────────────────────────────────────
function toggleAmountType() {
    const isFixed = document.querySelector('input[name="amount-type"]:checked').value === 'fixed';
    document.getElementById('static-input').style.display  = isFixed ? '' : 'none';
    document.getElementById('dynamic-input').style.display = isFixed ? 'none' : '';
}

// ── 売却単価タイプ切替 ─────────────────────────────────────
function togglePriceType() {
    const isFixed = document.querySelector('input[name="price-type"]:checked').value === 'fixed';
    document.getElementById('price-static-input').style.display  = isFixed ? '' : 'none';
    document.getElementById('price-dynamic-input').style.display = isFixed ? 'none' : '';
}

// ── アイテム追加 / 更新 ────────────────────────────────────
function addLine() {
    const name      = document.getElementById('item-name').value.trim();
    const type      = document.querySelector('input[name="amount-type"]:checked').value;
    const priceType = document.querySelector('input[name="price-type"]:checked').value;
    const dropRate  = parseFloat(document.getElementById('drop-rate').value);
    const dropCount = parseInt(document.getElementById('drop-count').value);

    if (!name)                                   { alert('アイテム名を入力してください'); return; }
    if (isNaN(dropRate) || dropRate < 0 || dropRate > 100) { alert('ドロップ確率は 0〜100 で入力してください'); return; }
    if (isNaN(dropCount) || dropCount < 1)        { alert('ドロップ数（試行回数）は1以上を入力してください'); return; }

    let amountMin, amountMax;
    if (type === 'fixed') {
        amountMin = amountMax = parseInt(document.getElementById('static-amount').value);
        if (isNaN(amountMin) || amountMin < 1) { alert('個数を入力してください'); return; }
    } else {
        amountMin = parseInt(document.getElementById('random-min').value);
        amountMax = parseInt(document.getElementById('random-max').value);
        if (isNaN(amountMin) || isNaN(amountMax)) { alert('最小・最大個数を入力してください'); return; }
        if (amountMin < 1)           { alert('最小個数は1以上を入力してください'); return; }
        if (amountMin > amountMax)   { alert('最小個数は最大個数以下にしてください'); return; }
    }

    let sellPriceMin, sellPriceMax;
    if (priceType === 'fixed') {
        const v = parseFloat(document.getElementById('sell-price').value);
        if (isNaN(v) || v < 0) { alert('売却単価を正しく入力してください'); return; }
        sellPriceMin = sellPriceMax = v;
    } else {
        sellPriceMin = parseFloat(document.getElementById('price-min').value);
        sellPriceMax = parseFloat(document.getElementById('price-max').value);
        if (isNaN(sellPriceMin) || isNaN(sellPriceMax)) { alert('売却単価の最小・最大を入力してください'); return; }
        if (sellPriceMin < 0)               { alert('売却単価は0以上を入力してください'); return; }
        if (sellPriceMin > sellPriceMax)    { alert('単価の最小は最大以下にしてください'); return; }
    }

    if (editingId !== null) {
        // 編集モード：既存アイテムを上書き
        const idx = items.findIndex(it => it.id === editingId);
        if (idx !== -1) {
            items[idx] = { id: editingId, name, type, amountMin, amountMax, priceType, sellPriceMin, sellPriceMax, dropRate, dropCount };
        }
        finishEdit();
    } else {
        // 新規追加
        items.push({ id: nextId++, name, type, amountMin, amountMax, priceType, sellPriceMin, sellPriceMax, dropRate, dropCount });
    }

    clearForm();
    renderItemList();
    renderBreakdown();
    updateEV();
}

// ── アイテム削除 ───────────────────────────────────────────
function deleteItem(id) {
    if (editingId === id) cancelEdit();
    items = items.filter(it => it.id !== id);
    renderItemList();
    renderBreakdown();
    updateEV();
}

// ── 編集開始 ───────────────────────────────────────────────
function startEdit(id) {
    const item = items.find(it => it.id === id);
    if (!item) return;

    editingId = id;

    // フォームに値を流し込む
    document.getElementById('item-name').value  = item.name;
    document.getElementById('drop-rate').value  = item.dropRate;
    document.getElementById('drop-count').value = item.dropCount;

    if (item.type === 'fixed') {
        document.querySelector('input[name="amount-type"][value="fixed"]').checked = true;
        document.getElementById('static-amount').value = item.amountMin;
    } else {
        document.querySelector('input[name="amount-type"][value="random"]').checked = true;
        document.getElementById('random-min').value = item.amountMin;
        document.getElementById('random-max').value = item.amountMax;
    }
    toggleAmountType();

    if (item.priceType === 'fixed') {
        document.querySelector('input[name="price-type"][value="fixed"]').checked = true;
        document.getElementById('sell-price').value = item.sellPriceMin;
    } else {
        document.querySelector('input[name="price-type"][value="random"]').checked = true;
        document.getElementById('price-min').value = item.sellPriceMin;
        document.getElementById('price-max').value = item.sellPriceMax;
    }
    togglePriceType();

    // ボタンを「更新」に変える
    document.getElementById('add-btn-text').textContent = '✎ 更新';
    document.getElementById('cancel-edit').style.display = '';
    document.getElementById('add-row').classList.add('btn-edit-mode');

    // 編集中アイテムをハイライト
    document.querySelectorAll('.item-row').forEach(row => {
        row.classList.toggle('editing', parseInt(row.dataset.id) === id);
    });

    // フォームまでスクロール
    document.getElementById('item-input').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function finishEdit() {
    editingId = null;
    document.getElementById('add-btn-text').textContent = '+ 追加';
    document.getElementById('cancel-edit').style.display = 'none';
    document.getElementById('add-row').classList.remove('btn-edit-mode');
}

function cancelEdit() {
    finishEdit();
    clearForm();
    document.querySelectorAll('.item-row').forEach(row => row.classList.remove('editing'));
}

// ── フォームリセット ────────────────────────────────────────
function clearForm() {
    document.getElementById('item-name').value     = '';
    document.getElementById('static-amount').value = '1';
    document.getElementById('random-min').value    = '1';
    document.getElementById('random-max').value    = '1';
    document.getElementById('sell-price').value    = '';
    document.getElementById('price-min').value     = '';
    document.getElementById('price-max').value     = '';
    document.getElementById('drop-rate').value     = '100';
    document.getElementById('drop-count').value    = '1';
    document.querySelector('input[name="amount-type"][value="fixed"]').checked = true;
    document.querySelector('input[name="price-type"][value="fixed"]').checked  = true;
    toggleAmountType();
    togglePriceType();
}

// ── アイテム一覧レンダリング ────────────────────────────────
function renderItemList() {
    const list = document.getElementById('item-list');
    document.getElementById('item-count-badge').textContent = items.length + ' items';

    if (items.length === 0) {
        list.innerHTML = '<p class="item-list-empty">アイテムを追加してください</p>';
        return;
    }

    list.innerHTML = items.map(item => {
        const amountStr = item.type === 'fixed'
            ? item.amountMin + '個'
            : item.amountMin + '〜' + item.amountMax + '個';
        const priceStr = item.priceType === 'fixed'
            ? '¥' + item.sellPriceMin.toLocaleString()
            : '¥' + item.sellPriceMin.toLocaleString() + '〜' + item.sellPriceMax.toLocaleString();
        const ev = calcItemEV(item);
        const isEditing = item.id === editingId;

        return `
        <div class="item-row${isEditing ? ' editing' : ''}" data-id="${item.id}">
            <div class="item-row-main">
                <span class="item-row-name">${escHtml(item.name)}</span>
                <div class="item-row-tags">
                    <span class="item-tag">${amountStr}</span>
                    <span class="item-tag">${priceStr}</span>
                    <span class="item-tag">${item.dropRate}%</span>
                    <span class="item-tag">×${item.dropCount}</span>
                </div>
            </div>
            <div class="item-row-right">
                <span class="item-row-ev">${fmtMan(ev)}</span>
                <div class="item-row-actions">
                    <button class="btn-icon btn-edit" onclick="startEdit(${item.id})" title="編集">✎</button>
                    <button class="btn-icon btn-delete" onclick="deleteItem(${item.id})" title="削除">✕</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ── 期待値計算 ─────────────────────────────────────────────
function calcItemEV(item) {
    const avgAmount = (item.amountMin + item.amountMax) / 2;
    const avgPrice  = (item.sellPriceMin + item.sellPriceMax) / 2;
    return item.dropCount * (item.dropRate / 100) * avgAmount * avgPrice;
}

function calcTotalEV() {
    return items.reduce((sum, item) => sum + calcItemEV(item), 0);
}

function updateEV() {
    const ev     = calcTotalEV();
    const target = parseFloat(document.getElementById('target-mean').value) * 10000;
    document.getElementById('ev-value').textContent = items.length > 0 ? fmtMan(ev) : '—';

    const diffEl = document.getElementById('ev-target-diff');
    if (items.length > 0 && !isNaN(target) && target > 0) {
        const diff    = ev - target;
        const diffPct = (diff / target * 100).toFixed(1);
        diffEl.textContent  = '目標比 ' + (diff >= 0 ? '+' : '') + fmtMan(diff) + ' (' + (diff >= 0 ? '+' : '') + diffPct + '%)';
        diffEl.className    = 'ev-target ' + (diff >= 0 ? 'positive' : 'negative');
    } else {
        diffEl.textContent = '';
    }

    renderBreakdown();
}

// ── 内訳テーブル ───────────────────────────────────────────
function renderBreakdown() {
    const tbody   = document.getElementById('breakdown-body');
    const totalEV = calcTotalEV();

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="breakdown-empty">アイテムを追加してください</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(item => {
        const ev  = calcItemEV(item);
        const pct = totalEV > 0 ? (ev / totalEV * 100).toFixed(1) : '0.0';
        const amountStr = item.type === 'fixed'
            ? item.amountMin + '個'
            : item.amountMin + '〜' + item.amountMax + '個';
        const priceStr = item.priceType === 'fixed'
            ? '¥' + item.sellPriceMin.toLocaleString()
            : '¥' + item.sellPriceMin.toLocaleString() + '〜' + item.sellPriceMax.toLocaleString();

        return `<tr>
            <td class="td-name">${escHtml(item.name)}</td>
            <td>${amountStr}</td>
            <td>${priceStr}</td>
            <td>${item.dropRate}%</td>
            <td>×${item.dropCount}</td>
            <td class="td-ev">${fmtMan(ev)}</td>
            <td>
                <div class="pct-bar-wrap">
                    <div class="pct-bar-fill" style="width:${Math.min(parseFloat(pct), 100)}%"></div>
                </div>
                <span class="pct-label">${pct}%</span>
            </td>
        </tr>`;
    }).join('');
}

// ── シミュレーション ────────────────────────────────────────
function simulateStart() {
    if (items.length === 0) { alert('アイテムを追加してください'); return; }

    const n   = parseInt(document.getElementById('simulate-amount').value);
    const btn = document.getElementById('btn-simulate');
    const bar = document.getElementById('progress-bar');
    const fill = document.getElementById('progress-fill');

    btn.disabled = true;
    btn.textContent = '実行中...';
    bar.style.display = 'block';
    fill.style.width = '0%';

    const results = new Float64Array(n);
    let i = 0;
    const CHUNK = 8000;

    function step() {
        const end = Math.min(i + CHUNK, n);
        for (; i < end; i++) {
            let total = 0;
            for (const item of items) {
                const rate = item.dropRate / 100;
                for (let d = 0; d < item.dropCount; d++) {
                    if (Math.random() < rate) {
                        const amt   = item.amountMin + Math.floor(Math.random() * (item.amountMax - item.amountMin + 1));
                        const price = item.priceType === 'fixed'
                            ? item.sellPriceMin
                            : item.sellPriceMin + Math.random() * (item.sellPriceMax - item.sellPriceMin);
                        total += amt * price;
                    }
                }
            }
            results[i] = total;
        }
        fill.style.width = (i / n * 100) + '%';

        if (i < n) { requestAnimationFrame(step); return; }

        const sorted = Array.from(results).sort((a, b) => a - b);
        displayResults(sorted, n);
        btn.disabled = false;
        btn.textContent = '▶ シミュレーション実行';
        bar.style.display = 'none';
    }
    requestAnimationFrame(step);
}

// ── 結果表示 ───────────────────────────────────────────────
function displayResults(sorted, n) {
    const mean     = sorted.reduce((s, v) => s + v, 0) / n;
    const median   = n % 2 === 0 ? (sorted[n/2-1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
    const variance = sorted.reduce((s, v) => s + (v-mean)**2, 0) / n;
    const sd       = Math.sqrt(variance);

    const target  = parseFloat(document.getElementById('target-mean').value) * 10000;
    const diff    = mean - target;
    const diffPct = (!isNaN(target) && target > 0) ? (diff / target * 100).toFixed(1) : null;
    const diffStr = diffPct !== null
        ? (diff >= 0 ? '+' : '') + fmtMan(diff) + ' (' + (diff >= 0 ? '+' : '') + diffPct + '%)'
        : fmtMan(diff);

    document.getElementById('stat-mean').textContent    = fmtMan(mean);
    document.getElementById('stat-mean-diff').textContent = diffStr;
    document.getElementById('stat-mean-diff').className = 'stat-diff ' + (diff >= 0 ? 'positive' : 'negative');
    document.getElementById('stat-median').textContent  = fmtMan(median);
    document.getElementById('stat-sd').textContent      = '±' + fmtMan(sd);
    document.getElementById('stat-min').textContent     = fmtMan(sorted[0]);
    document.getElementById('stat-max').textContent     = fmtMan(sorted[n-1]);

    drawChart(sorted, mean, target);
}

let chartData = null;  // グラフ再描画用に保持

function drawChart(sorted, mean, target) {
    document.getElementById('chart-empty').style.display = 'none';

    const n    = sorted.length;
    const minV = sorted[0], maxV = sorted[n-1];
    const nBins = 20;
    const binW  = (maxV - minV) / nBins || 1;

    const bins   = new Array(nBins).fill(0);
    const labels = [];
    for (let b = 0; b < nBins; b++) {
        labels.push(Math.round((minV + b * binW) / 10000) + '万');
    }
    sorted.forEach(v => {
        let b = Math.min(Math.floor((v - minV) / binW), nBins - 1);
        bins[b]++;
    });
    const pcts = bins.map(v => Math.round(v / n * 1000) / 10);
    const targetBin = (target - minV) / binW;

    chartData = { pcts, labels, mean, minV, binW, nBins, targetBin };

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(document.getElementById('result-chart'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: pcts,
                backgroundColor: pcts.map((_, i) => {
                    const lo = minV + i * binW;
                    return (mean >= lo && mean < lo + binW) ? 'rgba(80,210,150,0.9)' : 'rgba(80,210,150,0.35)';
                }),
                borderColor: 'rgba(80,210,150,0.6)',
                borderWidth: 1,
                borderRadius: 3,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.raw.toFixed(1) + '%',
                        title: ctx => ctx[0].label + '〜'
                    },
                    backgroundColor: '#1a2035',
                    borderColor: 'rgba(80,210,150,0.3)',
                    borderWidth: 1,
                    titleColor: '#c8d8e8',
                    bodyColor: '#50d296',
                }
            },
            scales: {
                x: {
                    ticks: { color: '#4a5a6a', maxRotation: 45, autoSkip: true, maxTicksLimit: 10 },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                },
                y: {
                    ticks: { color: '#4a5a6a', callback: v => v + '%' },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                }
            }
        },
        plugins: [{
            id: 'targetLine',
            afterDraw(chart) {
                if (!isFinite(targetBin)) return;
                const ctx2  = chart.ctx;
                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;
                const xPos  = xAxis.left + (targetBin / nBins) * (xAxis.right - xAxis.left);
                ctx2.save();
                ctx2.strokeStyle = 'rgba(240,190,60,0.9)';
                ctx2.lineWidth   = 2;
                ctx2.setLineDash([6, 4]);
                ctx2.beginPath();
                ctx2.moveTo(xPos, yAxis.top);
                ctx2.lineTo(xPos, yAxis.bottom);
                ctx2.stroke();
                ctx2.setLineDash([]);
                ctx2.fillStyle = 'rgba(240,190,60,0.9)';
                ctx2.font      = '11px JetBrains Mono, monospace';
                ctx2.textAlign = 'center';
                ctx2.fillText('目標: ' + Math.round(target / 10000) + '万', xPos, yAxis.top - 6);
                ctx2.restore();
            }
        }]
    });
}

function redrawTargetLine() {
    if (chartInstance) chartInstance.update();
}

// ── ユーティリティ ─────────────────────────────────────────
function fmtMan(n) {
    return Math.round(n / 10000).toLocaleString('ja-JP') + '万円';
}
function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}