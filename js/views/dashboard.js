// js/views/dashboard.js

const MONTH_NAMES = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];

const DASHBOARD_SHOW_ENDED_KEY = 'dashboard-show-ended';
const DASHBOARD_EXTENDED_KEY = 'dashboard-extended';

async function loadDashboard(year) {
    const yearSelect = document.getElementById('dash-year');
    const currentYear = new Date().getFullYear();
    const activeBtn = yearSelect && yearSelect.querySelector('.heatmap-year-btn.active');
    const fromSelect = activeBtn ? parseInt(activeBtn.dataset.year, 10) : NaN;
    const y = (year != null && !isNaN(year)) ? year : (!isNaN(fromSelect) ? fromSelect : currentYear);
    const showEnded = sessionStorage.getItem(DASHBOARD_SHOW_ENDED_KEY) === '1';
    const extended = sessionStorage.getItem(DASHBOARD_EXTENDED_KEY) === '1';

    let data;
    try { data = await Api.dashboardLoad(y, showEnded, extended); }
    catch (e) { return; }

    const { contracts, properties, heatmap, stats, monthNames, yearMin, yearMax, extendedStats, monthlyChart, monthlyTotals, yearTotalExpected, yearTotalActual } = data;
    const months = monthNames || MONTH_NAMES;

    // ── Režim: jen Rozšířený režim („Zobrazit skončené“ je u tabulky) ────
    const modeBar = document.getElementById('dash-mode-bar');
    if (modeBar) {
        modeBar.innerHTML =
            '<label class="dash-toggle"><input type="checkbox" id="dash-extended"' + (extended ? ' checked' : '') + '> Rozšířený režim (statistiky a grafy)</label>';
    }

    // ── Záhlaví sekce smluv + Zobrazit skončené smlouvy ───────────────────
    const dashTableBar = document.getElementById('dash-table-bar');
    if (dashTableBar) {
        dashTableBar.innerHTML =
            '<div class="dash-table-header">' +
            '<h3 class="dash-table-title">Přehled smluv</h3>' +
            '<label class="dash-toggle"><input type="checkbox" id="dash-show-ended"' + (showEnded ? ' checked' : '') + '> Zobrazit skončené smlouvy</label>' +
            '<a href="#" class="dash-add-request" id="dash-add-request">Přidat požadavek (energie, vyúčt.)</a>' +
            '</div>';
    }
    initPaymentRequestModal();

    // ── Stats (Obsazenost, Měsíční výnos, ROI, Míra inkasa) ─────────────
    document.getElementById('dash-stats').innerHTML =
        '<div class="stat">' +
            '<div class="stat-icon purple">%</div>' +
            '<div class="stat-val">' + (stats.occupancyRate ?? 0) + '%</div>' +
            '<div class="stat-label">Obsazenost</div>' +
        '</div>' +
        '<div class="stat">' +
            '<div class="stat-icon green">$</div>' +
            '<div class="stat-val green">' + UI.fmt(stats.monthlyIncome ?? 0) + ' Kč</div>' +
            '<div class="stat-label">Měsíční výnos</div>' +
        '</div>' +
        '<div class="stat">' +
            '<div class="stat-icon yellow">?</div>' +
            '<div class="stat-val">' + (stats.roi ?? 0) + '%</div>' +
            '<div class="stat-label">ROI (roční)</div>' +
        '</div>' +
        '<div class="stat">' +
            '<div class="stat-icon blue">📄</div>' +
            '<div class="stat-val">' + (stats.collectionRate ?? 100) + '%</div>' +
            '<div class="stat-label">Míra inkasa</div>' +
        '</div>';

    // ── Rozšířené statistiky a graf ────────────────────────────────────
    const extendedWrap = document.getElementById('dash-extended-wrap');
    if (extendedWrap) {
        if (extended && extendedStats && monthlyChart) {
            extendedWrap.style.display = '';
            const es = extendedStats;
            let endingSoonHtml = '';
            if (es.contracts_ending_soon && es.contracts_ending_soon.length) {
                endingSoonHtml = es.contracts_ending_soon.map(function (x) {
                    return '<a href="#" class="dash-link" onclick="DashboardView.openEdit(\'contracts\',' + (x.contracts_id ?? x.id) + '); return false;">' + UI.esc(x.tenant_name) + ' – ' + UI.esc(x.property_name) + ' (do ' + (x.contract_end ? UI.fmtDate(x.contract_end) : '') + ')</a>';
                }).join('<br>');
            } else {
                endingSoonHtml = '<span style="color:var(--txt3)">Žádné</span>';
            }
            const maxChartVal = Math.max(1, ...monthlyChart.map(function (m) { return Math.max(m.expected || 0, m.actual || 0); }));
            let chartBars = '';
            monthlyChart.forEach(function (m) {
                const pctExpected = maxChartVal > 0 ? (m.expected / maxChartVal) * 100 : 0;
                const pctActual = maxChartVal > 0 ? (m.actual / maxChartVal) * 100 : 0;
                chartBars += '<div class="dash-chart-bar-wrap" title="' + UI.esc(m.label) + ': očekáváno ' + UI.fmt(m.expected) + ' Kč, vybráno ' + UI.fmt(m.actual) + ' Kč">' +
                    '<div class="dash-chart-bar-bg" style="height:' + Math.max(2, pctExpected) + '%"></div>' +
                    '<div class="dash-chart-bar-fill" style="height:' + Math.max(2, pctActual) + '%"></div>' +
                    '<span class="dash-chart-label">' + (m.label.length > 12 ? m.label.replace(/^(\w+)\s/, '$1 ') : m.label) + '</span>' +
                    '</div>';
            });
            extendedWrap.innerHTML =
                '<div class="dash-extended-stats">' +
                    '<div class="stat"><div class="stat-icon green">$</div><div class="stat-val">' + UI.fmt(es.expected_current_month || 0) + ' Kč</div><div class="stat-label">Očekávaný nájem (tento měsíc)</div></div>' +
                    '<div class="stat' + (es.total_arrears > 0 ? ' stat-warn' : '') + '"><div class="stat-icon">!</div><div class="stat-val">' + UI.fmt(es.total_arrears || 0) + ' Kč</div><div class="stat-label">Celkové nedoplatky</div></div>' +
                    '<div class="stat"><div class="stat-val">' + (es.tenants_with_arrears_count || 0) + '</div><div class="stat-label">Nájemníků s nedoplatkem</div></div>' +
                    '<div class="stat"><div class="stat-val">' + (es.contracts_ending_soon ? es.contracts_ending_soon.length : 0) + '</div><div class="stat-label">Smlouvy končící do 3 měsíců</div></div>' +
                    '<div class="stat"><div class="stat-val">' + UI.fmt(es.deposits_total || 0) + ' Kč</div><div class="stat-label">Kauce celkem</div></div>' +
                    '<div class="stat' + (es.deposits_to_return > 0 ? ' stat-info' : '') + '"><div class="stat-val">' + UI.fmt(es.deposits_to_return || 0) + ' Kč</div><div class="stat-label">Kauce k vrácení</div></div>' +
                '</div>' +
                '<div class="dash-extended-ending">' +
                    '<strong>Končící smlouvy:</strong><div class="dash-ending-list">' + endingSoonHtml + '</div>' +
                '</div>' +
                '<div class="dash-chart-section">' +
                    '<h4 class="dash-chart-title">Vývoj výnosu (posledních 12 měsíců)</h4>' +
                    '<div class="dash-chart-legend"><span class="dash-chart-legend-expected">očekáváno</span> <span class="dash-chart-legend-actual">vybráno</span></div>' +
                    '<div class="dash-chart">' + chartBars + '</div>' +
                '</div>';
        } else {
            extendedWrap.style.display = 'none';
            extendedWrap.innerHTML = '';
        }
    }

    // ── Year selector (tlačítka) ─────────────────────────────────────────
    if (yearSelect) {
        const minY = (yearMin != null && !isNaN(yearMin)) ? yearMin : currentYear - 2;
        const maxY = (yearMax != null && !isNaN(yearMax)) ? yearMax : currentYear + 1;
        let btns = '';
        for (let yr = minY; yr <= maxY; yr++) {
            const active = yr === y ? ' active' : '';
            btns += '<button type="button" class="heatmap-year-btn' + active + '" data-year="' + yr + '">' + yr + '</button>';
        }
        yearSelect.innerHTML = btns;
        yearSelect.querySelectorAll('.heatmap-year-btn').forEach(btn => {
            btn.onclick = () => loadDashboard(parseInt(btn.dataset.year, 10));
        });
    }

    // ── Heatmap ─────────────────────────────────────────────────────────
    const heatmapEl = document.getElementById('dash-heatmap');
    if (heatmapEl && properties && properties.length) {
        let ths = '<th class="heatmap-property">Nemovitost</th>';
        for (let m = 1; m <= 12; m++) {
            const label = months[m - 1] ? (months[m - 1] + '\n' + m) : m;
            ths += '<th>' + label.replace('\n', '<br>') + '</th>';
        }
        ths += '<th class="heatmap-total-col">Celkem</th>';

        let rows = '';
        properties.forEach(prop => {
            let propYearExpected = 0;
            let propYearActual = 0;
            rows += '<tr><td class="heatmap-property">' + UI.esc(prop.name) + '</td>';
            for (let m = 1; m <= 12; m++) {
                const monthKey = y + '-' + String(m).padStart(2, '0');
                const key = prop.id + '_' + monthKey;
                const cell = heatmap[key] || { type: 'empty', monthKey };

                const paidAmt = cell.paid_amount ?? (cell.payment && cell.payment.amount ? cell.payment.amount : 0);
                const paymentCount = cell.payment_count ?? (cell.payment && cell.payment.count ? cell.payment.count : 0);
                const remaining = cell.remaining ?? (cell.amount ? Math.max(0, cell.amount - paidAmt) : 0);
                const isPaid = cell.type === 'exact' || cell.type === 'overpaid';
                if (cell.type !== 'empty') {
                    propYearExpected += cell.amount || 0;
                    propYearActual += paidAmt;
                }
                const isFuture = cell.isPast === false;
                const now = new Date();
                const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;

                let cls = 'heatmap-cell ' + (cell.type || 'empty');
                if (cell.is_contract_start_month) cls += ' heatmap-cell-start-month';
                if (isFuture && (cell.type === 'unpaid' || cell.type === 'overdue')) {
                    cls = (isCurrentMonth ? 'heatmap-cell current-month-unpaid' : 'heatmap-cell future-unpaid') + (cell.is_contract_start_month ? ' heatmap-cell-start-month' : '');
                } else if (isFuture && isPaid) {
                    cls = (isCurrentMonth ? 'heatmap-cell ' + (cell.type || 'exact') : 'heatmap-cell paid-advance') + (cell.is_contract_start_month ? ' heatmap-cell-start-month' : '');
                }

                let content = '';
                let isBeforePurchase = false;
                if (cell.type === 'empty') {
                    // Volno jen od měsíce koupě nemovitosti; předtím buňka prázdná
                    const purchaseDate = prop.purchase_date || '';
                    const purchaseYear = purchaseDate ? parseInt(purchaseDate.substring(0, 4), 10) : null;
                    const purchaseMonth = purchaseDate ? parseInt(purchaseDate.substring(5, 7), 10) : null;
                    isBeforePurchase = purchaseYear != null && purchaseMonth != null &&
                        (y < purchaseYear || (y === purchaseYear && m < purchaseMonth));
                    content = isBeforePurchase ? '' : 'Volno';
                } else if (isFuture && (cell.type === 'unpaid' || cell.type === 'overdue')) {
                    if (paidAmt > 0 && remaining > 0) {
                        const partialLabel = paymentCount > 1 ? UI.fmt(paidAmt) + ' (' + paymentCount + ' platby) / ' : UI.fmt(paidAmt) + ' / ';
                        content = '<span class="cell-partial">' + partialLabel + UI.fmt(cell.amount || 0) + '</span><br><span class="cell-remaining">zbývá ' + UI.fmt(remaining) + '</span>';
                    } else {
                        content = '<span class="cell-amount">' + UI.fmt(cell.amount || 0) + '</span>';
                    }
                } else if (cell.type === 'exact' || cell.type === 'overpaid') {
                    const fullPrescribed = cell.amount_full != null && cell.amount_full > (cell.amount || 0);
                    const sumLabel = paymentCount > 1 ? UI.fmt(paidAmt) + ' (' + paymentCount + ' platby)' : UI.fmt(paidAmt);
                    const prescribedLabel = fullPrescribed ? UI.fmt(paidAmt) + ' / ' + UI.fmt(cell.amount_full) : sumLabel;
                    content = '<span class="cell-amount">' + prescribedLabel + '</span><br><span class="cell-icon cell-check">✓</span>';
                } else if (paidAmt > 0 && remaining > 0) {
                    const partialLabel = paymentCount > 1 ? UI.fmt(paidAmt) + ' (' + paymentCount + ' platby) / ' : UI.fmt(paidAmt) + ' / ';
                    content = '<span class="cell-partial">' + partialLabel + UI.fmt(cell.amount || 0) + '</span><br><span class="cell-remaining">zbývá ' + UI.fmt(remaining) + '</span>';
                } else {
                    content = '<span class="cell-amount">' + UI.fmt(cell.amount || 0) + '</span><br><span class="cell-icon cell-cross">✗</span>';
                }

                if (cell.type === 'empty' && isBeforePurchase) cls += ' heatmap-cell-before-purchase';

                const contractEntityId = cell.contract.contracts_id ?? cell.contract.id;
                const dataAttrs = cell.type !== 'empty'
                    ? ' data-contract-id="' + contractEntityId + '" data-contracts-id="' + contractEntityId + '" data-month-key="' + cell.monthKey + '" data-amount="' + (cell.amount || 0) + '" data-tenant="' + (cell.contract.tenant_name || '').replace(/"/g, '&quot;') + '" data-paid="' + (isPaid ? '1' : '0') + '" data-payment-date="' + (cell.payment && cell.payment.date ? cell.payment.date : '') + '" data-payment-amount="' + paidAmt + '" data-remaining="' + remaining + '"'
                    : ' data-property-id="' + (prop.properties_id ?? prop.id) + '" data-month-key="' + monthKey + '"';

                let titleAttr = '';
                if (cell.type !== 'empty' && cell.payment_details && cell.payment_details.length > 0) {
                    const titleLines = cell.payment_details.map(function(p) {
                        const dt = p.payment_date ? UI.fmtDate(p.payment_date) : '—';
                        return UI.fmt(p.amount) + ' Kč (' + dt + ')';
                    });
                    titleAttr = ' title="' + UI.esc(titleLines.join('\n')) + '"';
                } else if (cell.type !== 'empty' && cell.payment && cell.payment.date) {
                    titleAttr = ' title="' + UI.esc(UI.fmtDate(cell.payment.date)) + '"';
                }

                const onClick = cell.type === 'empty'
                    ? (isBeforePurchase ? '' : 'DashboardView.openNewContract(this)')
                    : 'DashboardView.openPaymentModal(this)';

                rows += '<td><div class="' + cls + '"' + dataAttrs + titleAttr + (onClick ? ' onclick="' + onClick + '"' : '') + '>' + content + '</div></td>';
            }
            rows += '<td class="heatmap-total-cell">' + (propYearExpected > 0 ? UI.fmt(propYearActual) + ' / ' + UI.fmt(propYearExpected) : '—') + '</td>';
            rows += '</tr>';
        });

        // Řádek součtů za měsíce + celkový součet roku
        let sumRow = '<tr class="heatmap-sum-row"><td class="heatmap-property heatmap-sum-label">Součet</td>';
        if (monthlyTotals && monthlyTotals.length === 12) {
            monthlyTotals.forEach(function (t) {
                const label = t.expected > 0 ? UI.fmt(t.actual) + ' / ' + UI.fmt(t.expected) : '—';
                sumRow += '<td class="heatmap-total-cell heatmap-sum-cell" title="Přiteklo / mělo přitéct">' + label + '</td>';
            });
        } else {
            for (let m = 1; m <= 12; m++) sumRow += '<td class="heatmap-total-cell">—</td>';
        }
        const yearLabel = (yearTotalExpected != null && yearTotalExpected > 0)
            ? UI.fmt(yearTotalActual ?? 0) + ' / ' + UI.fmt(yearTotalExpected)
            : '—';
        sumRow += '<td class="heatmap-total-cell heatmap-sum-total" title="Celkem za rok ' + y + ' – přiteklo / mělo přitéct">' + yearLabel + '</td></tr>';

        heatmapEl.innerHTML = '<table class="heatmap-table"><thead><tr>' + ths + '</tr></thead><tbody>' + rows + '</tbody><tfoot>' + sumRow + '</tfoot></table>';
    } else if (heatmapEl) {
        heatmapEl.innerHTML = '<div class="empty">Žádné nemovitosti. Přidejte nemovitost v sekci <a href="#properties">Nemovitosti</a>.</div>';
    }

    // ── Table (přehled smluv) ───────────────────────────────────────────
    if (!contracts || !contracts.length) {
        document.getElementById('dash-table').innerHTML =
            '<div class="empty">' + (showEnded ? 'Žádné smlouvy.' : 'Žádné aktivní smlouvy.<br>Začněte přidáním nemovitosti a nájemníka, nebo klikněte na "Volno" v kalendáři.') + '</div>';
        return;
    }

    contracts.forEach(d => {
        d._rowClass = d.balance > 0 ? 'row-warn' : '';
        if (d.deposit_to_return) d._rowClass = (d._rowClass || '') + ' row-deposit-return';
    });

    UI.renderTable('dash-table',
        [
            { label: 'Nájemník' },
            { label: 'Nemovitost' },
            { label: 'Nájemné / měs.' },
            { label: 'Uhrazeno / Očekáváno' },
            { label: 'Neuhrazené měsíce' },
        ],
        contracts,
        (d) => {
            let pct = d.expected_total > 0 ? Math.min(100, (d.total_paid / d.expected_total) * 100) : 100;
            const hasDbt = d.balance > 0;
            const now = new Date();
            const currentY = now.getFullYear();
            const currentM = now.getMonth() + 1;
            const hasHistoricalArrear = (d.unpaid_months || []).some(u => u.year < currentY || (u.year === currentY && u.month < currentM));
            const progClass = hasDbt ? (hasHistoricalArrear ? 'bad' : 'current-debt') : 'ok';
            if (hasDbt && pct < 2) pct = 2;
            const depAmt = d.deposit_amount || 0;
            const hoverInfo = [];
            if (depAmt > 0) hoverInfo.push('Kauce: ' + UI.fmt(depAmt) + ' Kč' + (d.deposit_to_return ? ' (k vrácení)' : ''));
            hoverInfo.push(hasDbt ? (hasHistoricalArrear ? 'Stav: Nedoplatek (historický)' : 'Stav: Aktuální měsíc neuhrazen') : 'Stav: V pořádku');
            const progTitle = hoverInfo.length ? hoverInfo.join(' | ') : '';

            let tags = '';
            const requestTypeLabels = { energy: 'Energie', settlement: 'Vyúčt.', other: 'Jiné' };
            (d.unpaid_months || []).forEach(u => {
                const tenant = (d.tenant_name || '').replace(/"/g, '&quot;');
                const prop = (d.property_name || '').replace(/"/g, '&quot;');
                const rent = u.rent != null ? u.rent : d.monthly_rent;
                tags += '<span class="tag">' + u.month + '/' + u.year +
                    ' <span class="tag-plus" data-contracts-id="' + d.contracts_id + '" data-year="' + u.year + '" data-month="' + u.month + '" data-rent="' + rent + '" data-tenant="' + tenant + '" data-property="' + prop + '" title="Přidat platbu">+</span></span>';
            });
            (d.payment_requests || []).forEach(pr => {
                const tenant = (d.tenant_name || '').replace(/"/g, '&quot;');
                const prop = (d.property_name || '').replace(/"/g, '&quot;');
                const typeLabel = requestTypeLabels[pr.type] || pr.type;
                tags += '<span class="tag tag-request">' + typeLabel + ' ' + UI.fmt(pr.amount) + ' Kč' +
                    ' <span class="tag-plus" data-contracts-id="' + d.contracts_id + '" data-amount="' + (pr.amount || 0) + '" data-request-type="' + (pr.type || 'energy') + '" data-payment-request-id="' + (pr.payment_requests_id ?? pr.id) + '" data-tenant="' + tenant + '" data-property="' + prop + '" title="Zapsat platbu">+</span></span>';
            });
            const tagsHtml = tags ? '<span class="tags dash-unpaid-tags">' + tags + '</span>' : '<span style="color:var(--txt3)">—</span>';

            const tenantId = d.tenants_id ?? d.tenant_row_id;
            const propId = d.properties_id ?? d.property_row_id;
            const contractEntityId = d.contracts_id ?? d.id;
            const tenantLink = tenantId ? ' onclick="DashboardView.openEdit(\'tenants\',' + tenantId + ')" class="dash-link" title="Upravit nájemníka"' : '';
            const propLink = propId ? ' onclick="DashboardView.openEdit(\'properties\',' + propId + ')" class="dash-link" title="Upravit nemovitost"' : '';
            const contractLink = contractEntityId ? ' onclick="DashboardView.openEdit(\'contracts\',' + contractEntityId + ')" class="dash-link" title="Upravit smlouvu"' : '';
            const paymentsTitle = progTitle || 'Klikni pro platby';
            const paymentsLink = ' onclick="PaymentsView.navigateWithFilter(' + d.contracts_id + ')" class="dash-link" title="' + UI.esc(paymentsTitle) + '"';

            return (
                '<td><strong' + tenantLink + '>' + UI.esc(d.tenant_name) + '</strong></td>' +
                '<td' + propLink + '>' + UI.esc(d.property_name) + '</td>' +
                '<td' + contractLink + '>' + UI.fmt(d.monthly_rent) + ' Kč</td>' +
                '<td' + paymentsLink + '><div class="prog-wrap"><div class="prog-bar"><div class="prog-fill ' + progClass + '" style="width:' + Math.round(pct) + '%"></div></div>' +
                '<span class="prog-lbl">' + UI.fmt(d.total_paid) + ' / ' + UI.fmt(d.expected_total) + ' Kč</span></div></td>' +
                '<td class="dash-unpaid-cell">' + tagsHtml + '</td>'
            );
        },
        { emptyMsg: 'Žádné aktivní smlouvy.' }
    );
}

// Modal „Přidat požadavek“ (doplatek energie, vyúčtování)
function initPaymentRequestModal() {
    const view = document.getElementById('view-dashboard');
    if (!view || view.dataset.paymentRequestModalBound) return;
    view.dataset.paymentRequestModalBound = '1';

    view.addEventListener('click', async (e) => {
        if (!e.target.closest('#dash-add-request')) return;
        e.preventDefault();
        const alertEl = document.getElementById('pay-req-alert');
        const contractSel = document.getElementById('pay-req-contract');
        const amountEl = document.getElementById('pay-req-amount');
        const typeEl = document.getElementById('pay-req-type');
        const noteEl = document.getElementById('pay-req-note');
        if (!contractSel) return;
        try {
            const contracts = await Api.crudList('contracts');
            contractSel.innerHTML = '<option value="">— Vyberte smlouvu —</option>' +
                contracts.map(c => '<option value="' + (c.contracts_id ?? c.id) + '">' + UI.esc(c.tenant_name) + ' – ' + UI.esc(c.property_name) + '</option>').join('');
        } catch (err) {
            if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = err.message || 'Chyba načtení.'; }
            return;
        }
        if (alertEl) { alertEl.className = 'alert'; alertEl.textContent = ''; }
        amountEl.value = '';
        typeEl.value = 'energy';
        noteEl.value = '';
        const dueDateEl = document.getElementById('pay-req-due-date');
        if (dueDateEl) dueDateEl.value = '';
        UI.modalOpen('modal-payment-request');
    });

    const btnSave = document.getElementById('btn-pay-req-save');
    if (btnSave && !btnSave.dataset.bound) {
        btnSave.dataset.bound = '1';
        btnSave.addEventListener('click', async () => {
            const contractSel = document.getElementById('pay-req-contract');
            const amountEl = document.getElementById('pay-req-amount');
            const typeEl = document.getElementById('pay-req-type');
            const noteEl = document.getElementById('pay-req-note');
            const dueDateEl = document.getElementById('pay-req-due-date');
            const alertEl = document.getElementById('pay-req-alert');
            const cid = parseInt(contractSel.value, 10);
            const amount = parseFloat(amountEl.value) || 0;
            if (!cid || cid <= 0) {
                if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = 'Vyberte smlouvu.'; }
                return;
            }
            if (amount <= 0) {
                if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = 'Zadejte kladnou částku.'; }
                return;
            }
            const type = ['energy', 'settlement', 'other'].includes(typeEl.value) ? typeEl.value : 'energy';
            const dueDate = dueDateEl && dueDateEl.value ? dueDateEl.value.trim() : null;
            btnSave.disabled = true;
            try {
                await Api.crudAdd('payment_requests', {
                    contracts_id: cid,
                    amount: amount,
                    type: type,
                    note: (noteEl.value || '').trim() || null,
                    due_date: dueDate,
                });
                UI.modalClose('modal-payment-request');
                const yearBtn = document.querySelector('#dash-year .heatmap-year-btn.active');
                const y = yearBtn ? parseInt(yearBtn.dataset.year, 10) : new Date().getFullYear();
                loadDashboard(y);
            } catch (err) {
                if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = err.message || 'Chyba uložení.'; }
            } finally {
                btnSave.disabled = false;
            }
        });
    }
}

// Delegace změn přepínačů (funguje i po překreslení obsahu)
function initDashboardCheckboxDelegation() {
    const view = document.getElementById('view-dashboard');
    if (!view || view.dataset.dashboardCheckboxBound) return;
    view.dataset.dashboardCheckboxBound = '1';
    view.addEventListener('change', function (e) {
        const id = e.target && e.target.id;
        if (id === 'dash-show-ended') {
            sessionStorage.setItem(DASHBOARD_SHOW_ENDED_KEY, e.target.checked ? '1' : '0');
            const yearBtn = document.querySelector('#dash-year .heatmap-year-btn.active');
            const y = yearBtn ? parseInt(yearBtn.dataset.year, 10) : new Date().getFullYear();
            loadDashboard(y);
        } else if (id === 'dash-extended') {
            sessionStorage.setItem(DASHBOARD_EXTENDED_KEY, e.target.checked ? '1' : '0');
            const yearBtn = document.querySelector('#dash-year .heatmap-year-btn.active');
            const y = yearBtn ? parseInt(yearBtn.dataset.year, 10) : new Date().getFullYear();
            loadDashboard(y);
        }
    });
}

App.registerView('dashboard', () => { loadDashboard(); initDashboardCheckboxDelegation(); initQuickPayDelegation(); initPayModalShortcut(); });

// ── PaymentModal ─────────────────────────────────────────────────────────
async function openPaymentModal(el) {
    const contractId = el.dataset.contractId;
    const contractsId = el.dataset.contractsId || contractId;
    const monthKey = el.dataset.monthKey;
    const amountVal = parseFloat(el.dataset.amount) || 0;
    const tenantName = el.dataset.tenant || '';
    const isPaid = el.dataset.paid === '1';
    const paymentDate = el.dataset.paymentDate || new Date().toISOString().slice(0, 10);
    const paymentAmount = el.dataset.paymentAmount ? parseFloat(el.dataset.paymentAmount) : 0;
    const remaining = el.dataset.remaining ? parseFloat(el.dataset.remaining) : amountVal;

    const [year, month] = monthKey.split('-');
    const monthName = MONTH_NAMES[parseInt(month, 10) - 1] || month;
    const propName = el.dataset.propertyName || (el.closest('tr') && el.closest('tr').querySelector('.heatmap-property') ? el.closest('tr').querySelector('.heatmap-property').textContent : '') || '';

    const info = document.getElementById('pay-modal-info');
    const amount = document.getElementById('pay-modal-amount');
    const paid = document.getElementById('pay-modal-paid');
    const dateWrap = document.getElementById('pay-modal-date-wrap');
    const dateInput = document.getElementById('pay-modal-date');
    const methodWrap = document.getElementById('pay-modal-method-wrap');
    const methodSelect = document.getElementById('pay-modal-method');
    const accountWrap = document.getElementById('pay-modal-account-wrap');
    const accountSelect = document.getElementById('pay-modal-account');
    const existingWrap = document.getElementById('pay-modal-existing');
    const batchHintEl = document.getElementById('pay-modal-batch-hint');
    const editIdEl = document.getElementById('pay-modal-edit-id');
    const typeSelect = document.getElementById('pay-modal-type');
    const typeWrap = document.getElementById('pay-modal-type-wrap');
    const bulkWrap = document.getElementById('pay-modal-bulk-wrap');
    const bulkCheckbox = document.getElementById('pay-modal-bulk');
    const rangeRow = document.getElementById('pay-modal-range-row');
    const monthFromEl = document.getElementById('pay-modal-month-from');
    const yearFromEl = document.getElementById('pay-modal-year-from');
    const monthToEl = document.getElementById('pay-modal-month-to');
    const yearToEl = document.getElementById('pay-modal-year-to');

    const bankAccounts = await Api.crudList('bank_accounts');
    const primaryAccount = bankAccounts.find(b => b.is_primary);
    const defaultAccId = primaryAccount ? (primaryAccount.bank_accounts_id ?? primaryAccount.id) : '';
    accountSelect.innerHTML = '<option value="">— Vyberte účet —</option>' +
        bankAccounts.map(b => {
            const bid = b.bank_accounts_id ?? b.id;
            return '<option value="' + bid + '"' + (bid == defaultAccId ? ' selected' : '') + '>' +
                UI.esc(b.name) + (b.account_number ? ' – ' + UI.esc(b.account_number) : '') +
            '</option>';
        }).join('');

    document.getElementById('pay-modal-contract-id').value = contractId;
    document.getElementById('pay-modal-month-key').value = monthKey;
    document.getElementById('pay-modal-payment-request-id').value = '';
    editIdEl.value = '';
    batchHintEl.style.display = 'none';
    bulkCheckbox.checked = false;
    rangeRow.style.display = 'none';
    const nowY = new Date().getFullYear();
    const yearOpts = [];
    for (let y = nowY - 2; y <= nowY + 2; y++) {
        yearOpts.push('<option value="' + y + '"' + (y === parseInt(year, 10) ? ' selected' : '') + '>' + y + '</option>');
    }
    yearFromEl.innerHTML = yearOpts.join('');
    yearToEl.innerHTML = yearOpts.join('');
    monthFromEl.value = month;
    monthToEl.value = month;
    yearFromEl.value = year;
    yearToEl.value = year;

    let infoHtml = '<div><strong>Nemovitost:</strong> ' + UI.esc(propName) + '</div>' +
        '<div><strong>Nájemce:</strong> ' + UI.esc(tenantName) + '</div>' +
        '<div><strong>Období:</strong> ' + monthName + ' ' + year + '</div>';
    if (!isPaid && paymentAmount > 0 && remaining > 0) {
        infoHtml += '<div class="pay-modal-partial"><strong>Uhrazeno:</strong> ' + UI.fmt(paymentAmount) + ' Kč, <strong>zbývá:</strong> ' + UI.fmt(remaining) + ' Kč</div>';
    } else if (isPaid) {
        const overpaid = paymentAmount > amountVal;
        infoHtml += '<div class="pay-modal-full' + (overpaid ? ' pay-modal-overpaid' : '') + '"><strong>Měsíc je ' + (overpaid ? 'přeplacen' : 'plně uhrazen') + '.</strong> Zrušte zaškrtnutí pro smazání všech plateb.</div>';
    }
    info.innerHTML = infoHtml;

    const typeLabels = { rent: 'Nájem', deposit: 'Kauce', energy: 'Doplatek energie', other: 'Jiné' };
    function setTypeWrapClass(t) {
        const v = (t && ['rent','deposit','energy','other'].includes(t)) ? t : 'rent';
        if (typeWrap) {
            typeWrap.classList.remove('pay-type-rent', 'pay-type-deposit', 'pay-type-energy', 'pay-type-other');
            typeWrap.classList.add('pay-type-' + v);
        }
    }

    const paymentRequestId = el.dataset.paymentRequestId || '';
    if (paymentRequestId) {
        document.getElementById('pay-modal-payment-request-id').value = paymentRequestId;
        const reqType = (el.dataset.requestType || 'energy');
        typeSelect.value = reqType === 'settlement' ? 'other' : reqType;
        setTypeWrapClass(typeSelect.value);
        amount.value = parseFloat(el.dataset.amount) || '';
    } else {
        typeSelect.value = 'rent';
        setTypeWrapClass('rent');
    }
    paid.checked = isPaid;
    if (!paymentRequestId) amount.value = isPaid ? amountVal : remaining;
    dateInput.value = paymentDate;
    dateWrap.style.display = isPaid ? 'block' : 'none';
    methodWrap.style.display = isPaid ? 'flex' : 'none';
    accountWrap.style.display = methodSelect.value === 'account' ? 'block' : 'none';

    let payments = await Api.crudList('payments', { contracts_id: contractsId });
    let forMonth = payments.filter(x => String(x.period_year) === year && String(x.period_month).padStart(2, '0') === month);

    function renderExisting() {
        if (!forMonth.length) {
            existingWrap.innerHTML = '';
            return;
        }
        let html = '<div class="pay-modal-existing-title">Existující platby:</div><ul class="pay-modal-existing-list">';
        forMonth.forEach(p => {
            const amt = UI.fmt(p.amount ?? 0);
            const dt = p.payment_date ? UI.fmtDate(p.payment_date) : '—';
            const method = p.payment_method || 'account';
            const accId = p.bank_accounts_id ?? '';
            const pt = p.payment_type || 'rent';
            const typeLabel = typeLabels[pt] || 'Nájem';
            const typeBadge = '<span class="pay-modal-type-badge pay-type-' + pt + '">' + UI.esc(typeLabel) + '</span>';
            const batchTag = p.payment_batch_id ? ' <span class="tag tag-batch" title="Součást jedné platby za více měsíců">dávka</span>' : '';
            const payEntityId = p.payments_id ?? p.id;
            html += '<li class="pay-modal-existing-item">' +
                '<span>' + typeBadge + ' ' + amt + ' Kč (' + dt + ')' + batchTag + '</span> ' +
                '<button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="' + payEntityId + '" data-amount="' + (p.amount ?? 0) + '" data-date="' + (p.payment_date || '') + '" data-method="' + method + '" data-account="' + accId + '" data-type="' + pt + '" data-batch-id="' + (p.payment_batch_id || '') + '">Upravit</button> ' +
                '<button type="button" class="btn btn-ghost btn-sm" data-action="delete" data-id="' + payEntityId + '" data-batch-id="' + (p.payment_batch_id || '') + '">Smazat</button>' +
                '</li>';
        });
        html += '</ul><div class="pay-modal-add-link"><a href="#" data-action="add">+ Přidat novou platbu</a></div>';
        existingWrap.innerHTML = html;
    }
    renderExisting();

    if (forMonth.length === 1) {
        const p = forMonth[0];
        const method = p.payment_method || 'account';
        const pt = p.payment_type || 'rent';
        editIdEl.value = String((p.payments_id ?? p.id) || '');
        editIdEl.dataset.batchId = String(p.payment_batch_id || '');
        editIdEl.dataset.originalAmount = String(p.amount ?? '');
        amount.value = p.amount ?? '';
        dateInput.value = p.payment_date ? p.payment_date.slice(0, 10) : new Date().toISOString().slice(0, 10);
        methodSelect.value = method === 'cash' ? 'cash' : 'account';
        accountSelect.value = p.bank_accounts_id || '';
        accountWrap.style.display = methodSelect.value === 'account' ? 'block' : 'none';
        typeSelect.value = ['rent','deposit','energy','other'].includes(pt) ? pt : 'rent';
        setTypeWrapClass(typeSelect.value);
        paid.checked = true;
        dateWrap.style.display = 'block';
        methodWrap.style.display = 'flex';
        batchHintEl.style.display = p.payment_batch_id ? 'block' : 'none';
        bulkWrap.style.display = 'none';
    } else {
        bulkWrap.style.display = editIdEl.value ? 'none' : 'block';
    }

    existingWrap.onclick = async (e) => {
        const editBtn = e.target.closest('[data-action="edit"]');
        const delBtn = e.target.closest('[data-action="delete"]');
        const addLink = e.target.closest('[data-action="add"]');
        if (editBtn) {
            const pt = editBtn.dataset.type || 'rent';
            editIdEl.value = String(editBtn.dataset.id || '');
            editIdEl.dataset.batchId = String(editBtn.dataset.batchId || '');
            editIdEl.dataset.originalAmount = String(editBtn.dataset.amount || '');
            amount.value = editBtn.dataset.amount || '';
            dateInput.value = editBtn.dataset.date || new Date().toISOString().slice(0, 10);
            methodSelect.value = editBtn.dataset.method === 'cash' ? 'cash' : 'account';
            accountSelect.value = editBtn.dataset.account || '';
            accountWrap.style.display = methodSelect.value === 'account' ? 'block' : 'none';
            typeSelect.value = ['rent','deposit','energy','other'].includes(pt) ? pt : 'rent';
            setTypeWrapClass(typeSelect.value);
            paid.checked = true;
            dateWrap.style.display = 'block';
            methodWrap.style.display = 'flex';
            batchHintEl.style.display = editBtn.dataset.batchId ? 'block' : 'none';
            bulkWrap.style.display = 'none';
        } else if (delBtn) {
            const batchId = (delBtn.dataset.batchId || '').trim();
            if (batchId) {
                const batchCount = payments.filter(x => x.payment_batch_id === batchId).length;
                const msg = batchCount === 1 ? 'Opravdu smazat tuto platbu?' : 'Opravdu smazat celou dávku? (' + batchCount + ' plateb)';
                if (!confirm(msg)) return;
                try {
                    await Api.paymentsDeleteBatch(batchId);
                } catch (err) { alert(err.message); return; }
            } else {
                if (!confirm('Opravdu smazat tuto platbu?')) return;
                try {
                    await Api.crudDelete('payments', parseInt(delBtn.dataset.id, 10));
                } catch (err) { alert(err.message); return; }
            }
            payments = await Api.crudList('payments', { contracts_id: contractsId });
            forMonth = payments.filter(x => String(x.period_year) === year && String(x.period_month).padStart(2, '0') === month);
            renderExisting();
            await loadDashboard(parseInt(year, 10));
        } else if (addLink) {
            e.preventDefault();
            editIdEl.value = '';
            delete editIdEl.dataset.batchId;
            delete editIdEl.dataset.originalAmount;
            amount.value = remaining;
            typeSelect.value = 'rent';
            setTypeWrapClass('rent');
            paid.checked = false;
            dateWrap.style.display = 'none';
            methodWrap.style.display = 'none';
            batchHintEl.style.display = 'none';
            bulkWrap.style.display = 'block';
            bulkCheckbox.checked = false;
            rangeRow.style.display = 'none';
        }
    };

    paid.onchange = () => {
        dateWrap.style.display = paid.checked ? 'block' : 'none';
        methodWrap.style.display = paid.checked ? 'flex' : 'none';
    };
    methodSelect.onchange = () => {
        accountWrap.style.display = methodSelect.value === 'account' ? 'block' : 'none';
    };
    typeSelect.onchange = () => {
        setTypeWrapClass(typeSelect.value);
    };
    bulkCheckbox.onchange = () => {
        rangeRow.style.display = bulkCheckbox.checked ? '' : 'none';
        if (bulkCheckbox.checked && !amount.value) {
            amount.value = Math.round(amountVal * 12);
        }
    };

    document.getElementById('btn-pay-modal-save').onclick = async () => {
        const editId = (editIdEl.value || '').trim();
        const batchId = (editIdEl.dataset.batchId || '').trim();
        try {
            if (paid.checked) {
                const dateVal = dateInput.value;
                if (!dateVal || !UI.isDateValid(dateVal)) {
                    alert('Zadejte platné datum platby (např. únor má max. 29 dní).');
                    return;
                }
                const amt = parseFloat(amount.value) || 0;
                if (amt <= 0) {
                    alert('Zadejte kladnou částku platby.');
                    return;
                }
                const method = methodSelect.value === 'account' || methodSelect.value === 'cash' ? methodSelect.value : 'account';
                const accountId = method === 'account' ? Number(accountSelect.value || 0) : null;
                if (method === 'account' && (!accountId || accountId <= 0)) {
                    alert('Vyberte bankovní účet.');
                    return;
                }
                const paymentType = ['rent','deposit','energy','other'].includes(typeSelect.value) ? typeSelect.value : 'rent';
                if (editId && batchId) {
                    const batchData = {
                        payment_date: dateInput.value,
                        payment_method: method,
                        bank_accounts_id: accountId || null,
                        payment_type: paymentType,
                    };
                    const origAmt = parseFloat(editIdEl.dataset.originalAmount || 0);
                    if (amt !== origAmt) {
                        batchData.amount_override_id = parseInt(editId, 10);
                        batchData.amount_override_value = amt;
                    }
                    await Api.paymentsEditBatch(batchId, batchData);
                } else if (editId) {
                    const payData = {
                        contracts_id: parseInt(contractsId, 10),
                        period_year: parseInt(year, 10),
                        period_month: parseInt(month, 10),
                        amount: amt,
                        payment_date: dateInput.value,
                        payment_method: method,
                        bank_accounts_id: accountId || null,
                        payment_type: paymentType,
                    };
                    await Api.crudEdit('payments', parseInt(editId, 10), payData);
                } else {
                    const bulk = bulkCheckbox.checked;
                    const payData = {
                        contracts_id: parseInt(contractsId, 10),
                        amount: amt,
                        payment_date: dateInput.value,
                        payment_method: method,
                        bank_accounts_id: accountId || null,
                        payment_type: paymentType,
                    };
                    if (bulk) {
                        const yFrom = parseInt(yearFromEl.value, 10);
                        const mFrom = parseInt(monthFromEl.value, 10);
                        const yTo = parseInt(yearToEl.value, 10);
                        const mTo = parseInt(monthToEl.value, 10);
                        const tsFrom = yFrom * 12 + mFrom;
                        const tsTo = yTo * 12 + mTo;
                        if (tsFrom > tsTo) {
                            alert('Měsíc „od“ musí být před měsícem „do“.');
                            return;
                        }
                        payData.period_year = yFrom;
                        payData.period_month = mFrom;
                        payData.period_year_to = yTo;
                        payData.period_month_to = mTo;
                    } else {
                        payData.period_year = parseInt(year, 10);
                        payData.period_month = parseInt(month, 10);
                    }
                    const prIdEl = document.getElementById('pay-modal-payment-request-id');
                    if (prIdEl && prIdEl.value) payData.payment_request_id = parseInt(prIdEl.value, 10);
                    await Api.crudAdd('payments', payData);
                }
            } else {
                if (batchId) {
                    const batchCount = payments.filter(x => x.payment_batch_id === batchId).length;
                    const msg = batchCount === 1 ? 'Opravdu smazat tuto platbu?' : 'Opravdu smazat celou dávku? (' + batchCount + ' plateb)';
                    if (!confirm(msg)) return;
                    await Api.paymentsDeleteBatch(batchId);
                } else {
                    const platLabel = forMonth.length === 1 ? '1 platba' : (forMonth.length >= 2 && forMonth.length <= 4 ? forMonth.length + ' platby' : forMonth.length + ' plateb');
                    if (!confirm('Opravdu smazat všechny platby za tento měsíc? (' + platLabel + ')')) return;
                    for (const p of forMonth) {
                        await Api.crudDelete('payments', p.id);
                    }
                }
            }
        } catch (e) {
            alert(e.message);
        } finally {
            UI.modalClose('modal-payment');
            await loadDashboard(parseInt(year, 10));
        }
    };

    UI.modalOpen('modal-payment');
}

// ── New contract from Volno cell ─────────────────────────────────────────
function openNewContract(el) {
    const propertyId = el.dataset.propertyId;
    const monthKey = el.dataset.monthKey;
    const propertyName = el.dataset.propertyName || '';
    App.navigate('contracts');
    ContractsView.prefillFromCalendar(parseInt(propertyId, 10), monthKey, propertyName);
}

// Ctrl+Enter – uložit platbu v modalu
function initPayModalShortcut() {
    const el = document.getElementById('modal-payment');
    if (!el || el.dataset.shortcutBound) return;
    el.dataset.shortcutBound = '1';
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter' && el.classList.contains('show')) {
            e.preventDefault();
            document.getElementById('btn-pay-modal-save').click();
        }
    });
}

// Event delegation pro tlačítko + u neuhrazených měsíců
function initQuickPayDelegation() {
    const el = document.getElementById('dash-table');
    if (!el || el.dataset.quickPayBound) return;
    el.dataset.quickPayBound = '1';
    el.addEventListener('click', (e) => {
        const plus = e.target.closest('.tag-plus');
        if (!plus) return;
        e.preventDefault();
        const contractsId = parseInt(plus.dataset.contractsId, 10);
        if (plus.dataset.paymentRequestId) {
            const amount = parseFloat(plus.dataset.amount) || 0;
            const requestType = plus.dataset.requestType || 'energy';
            const requestId = parseInt(plus.dataset.paymentRequestId, 10);
            const tenant = plus.dataset.tenant || '';
            const property = plus.dataset.property || '';
            DashboardView.quickPayFromRequest(contractsId, amount, requestType, requestId, tenant, property);
        } else {
            const year = parseInt(plus.dataset.year, 10);
            const month = parseInt(plus.dataset.month, 10);
            const rent = parseFloat(plus.dataset.rent) || 0;
            const tenant = plus.dataset.tenant || '';
            const property = plus.dataset.property || '';
            DashboardView.quickPay(contractsId, year, month, rent, tenant, property);
        }
    });
}

const DASHBOARD_OPEN_EDIT_KEY = 'dashboard-open-edit';

function openEdit(viewName, id) {
    sessionStorage.setItem(DASHBOARD_OPEN_EDIT_KEY, JSON.stringify({ view: viewName, id: String(id) }));
    location.hash = viewName;
}

const DashboardView = {
    openEdit,
    openPaymentModal,
    openNewContract,
    async quickPay(contractsId, year, month, rent, tenantName, propertyName) {
        const monthKey = year + '-' + String(month).padStart(2, '0');
        const fakeEl = document.createElement('div');
        fakeEl.dataset.contractId = String(contractsId);
        fakeEl.dataset.contractsId = String(contractsId);
        fakeEl.dataset.monthKey = monthKey;
        fakeEl.dataset.amount = String(rent);
        fakeEl.dataset.tenant = tenantName || '';
        fakeEl.dataset.paid = '0';
        fakeEl.dataset.paymentDate = new Date().toISOString().slice(0, 10);
        fakeEl.dataset.paymentAmount = '0';
        fakeEl.dataset.remaining = String(rent);
        fakeEl.dataset.propertyName = propertyName || '';
        await openPaymentModal(fakeEl);
    },
    async quickPayFromRequest(contractsId, amount, requestType, requestId, tenantName, propertyName) {
        const now = new Date();
        const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        const fakeEl = document.createElement('div');
        fakeEl.dataset.contractId = String(contractsId);
        fakeEl.dataset.contractsId = String(contractsId);
        fakeEl.dataset.monthKey = monthKey;
        fakeEl.dataset.amount = String(amount);
        fakeEl.dataset.tenant = tenantName || '';
        fakeEl.dataset.paid = '0';
        fakeEl.dataset.paymentDate = now.toISOString().slice(0, 10);
        fakeEl.dataset.paymentAmount = '0';
        fakeEl.dataset.remaining = String(amount);
        fakeEl.dataset.propertyName = propertyName || '';
        fakeEl.dataset.paymentRequestId = String(requestId);
        fakeEl.dataset.requestType = requestType || 'energy';
        await openPaymentModal(fakeEl);
    },
};
window.DashboardView = DashboardView;
