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
            '<a href="#" class="dash-add-request" id="dash-add-request">Přidat požadavek (energie, vyúčtování, kauce…)</a>' +
            '</div>';
    }
    initPaymentRequestModal();

    // ── Stats (Obsazenost, Vytížení, Měsíční výnos, ROI, Míra inkasa) ─────────────
    const statTitles = {
        occupancy: 'Výpočet: (počet nemovitostí se smlouvou / počet nemovitostí „v pronájmu“) × 100. Do jmenovatele se berou jen nemovitosti, u nichž je Pronajímáno od prázdné nebo ≤ dnes.',
        utilizationYear: 'Výpočet: (obsazené měsíce nemovitostí za vybraný rok / celkový počet měsíců v roce) × 100. U každé nemovitosti se započítávají jen měsíce od data „Pronajímáno od“.',
        utilizationOverall: 'Výpočet: (celkový počet obsazených měsíců / celkový počet měsíců v období) × 100. Období u každé nemovitosti začíná dnem „Pronajímáno od“, datumem koupě nebo první smlouvou. Reaguje na pole Pronajímáno od.',
        monthlyIncome: 'Výpočet: součet skutečně vybraných plateb (nájem) za aktuální kalendářní měsíc.',
        roi: 'Výpočet: (vybraný nájem za aktuální rok / celková investice) × 100. Investice = součet kupních cen všech nemovitostí.',
        collectionRate: 'Výpočet: (skutečně vybraný nájem za rok / očekávaný nájem za rok) × 100. Očekávaný = nájem dle smluv a změn nájmu za daný rok.',
        byDue: 'Podle splatnosti: platby se započítají do měsíce, kdy měl požadavek (nájem, kauce…) splatnost. Konzistentní s heatmapou.'
    };
    document.getElementById('dash-stats').innerHTML =
        '<div class="stat" title="' + UI.esc(statTitles.occupancy) + '">' +
            '<div class="stat-icon purple">%</div>' +
            '<div class="stat-val">' + (stats.occupancyRate ?? 0) + '%</div>' +
            '<div class="stat-label">Obsazenost</div>' +
        '</div>' +
        '<div class="stat" title="' + UI.esc(statTitles.utilizationYear) + '">' +
            '<div class="stat-icon purple">📅</div>' +
            '<div class="stat-val">' + (stats.utilizationRateYear ?? 0) + '%</div>' +
            '<div class="stat-label">Vytížení (' + y + ')</div>' +
        '</div>' +
        '<div class="stat" title="' + UI.esc(statTitles.utilizationOverall) + '">' +
            '<div class="stat-icon purple">Σ</div>' +
            '<div class="stat-val">' + (stats.utilizationRateOverall ?? 0) + '%</div>' +
            '<div class="stat-label">Vytížení (celkem)</div>' +
        '</div>' +
        '<div class="stat" title="' + UI.esc(statTitles.monthlyIncome) + '">' +
            '<div class="stat-icon green">$</div>' +
            '<div class="stat-val green">' + UI.fmt(stats.monthlyIncome ?? 0) + ' Kč</div>' +
            '<div class="stat-label">Měsíční výnos</div>' +
        '</div>' +
        '<div class="stat" title="' + UI.esc(statTitles.roi) + '">' +
            '<div class="stat-icon yellow">?</div>' +
            '<div class="stat-val">' + (stats.roi ?? 0) + '%</div>' +
            '<div class="stat-label">ROI (roční)</div>' +
        '</div>' +
        '<div class="stat" title="' + UI.esc(statTitles.collectionRate) + '">' +
            '<div class="stat-icon blue">📄</div>' +
            '<div class="stat-val">' + (stats.collectionRate ?? 100) + '%</div>' +
            '<div class="stat-label">Míra inkasa</div>' +
        '</div>' +
        '<div class="dash-stats-divider" aria-hidden="true"></div>' +
        '<div class="stat stat-by-due" title="' + UI.esc(statTitles.byDue) + '">' +
            '<div class="stat-icon green">$</div>' +
            '<div class="stat-val">' + UI.fmt(stats.monthlyIncomeByDue ?? 0) + ' Kč</div>' +
            '<div class="stat-label">Měsíc (splatnost)</div>' +
        '</div>' +
        '<div class="stat stat-by-due" title="' + UI.esc(statTitles.byDue) + '">' +
            '<div class="stat-icon green">Σ</div>' +
            '<div class="stat-val">' + UI.fmt(stats.yearIncomeByDue ?? 0) + ' Kč</div>' +
            '<div class="stat-label">Rok (splatnost)</div>' +
        '</div>' +
        '<div class="stat stat-by-due" title="' + UI.esc(statTitles.byDue) + '">' +
            '<div class="stat-icon blue">📄</div>' +
            '<div class="stat-val">' + (stats.collectionRateByDue ?? 100) + '%</div>' +
            '<div class="stat-label">Míra inkasa (splatnost)</div>' +
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
            const propEntityId = prop.properties_id ?? prop.id;
            const propNameCell = propEntityId
                ? '<a href="#properties&edit=' + propEntityId + '" class="dash-link heatmap-property-link" title="Zobrazit evidenci nemovitosti">' + UI.esc(prop.name) + '</a>'
                : UI.esc(prop.name);
            rows += '<tr><td class="heatmap-property" title="' + UI.esc(prop.name) + '">' + propNameCell + '</td>';
            for (let m = 1; m <= 12; m++) {
                const monthKey = y + '-' + String(m).padStart(2, '0');
                const key = prop.id + '_' + monthKey;
                const cell = heatmap[key] || { type: 'empty', monthKey };

                const paidAmt = cell.paid_amount ?? (cell.payment && cell.payment.amount ? cell.payment.amount : 0);
                const paymentCount = cell.payment_count ?? (cell.payment && cell.payment.count ? cell.payment.count : 0);
                const remaining = cell.remaining ?? (cell.amount ? Math.max(0, cell.amount - paidAmt) : 0);
                const isPaid = cell.type === 'exact' || cell.type === 'overpaid';
                const isEmptyOrNotRented = cell.type === 'empty' || cell.type === 'not_rented';
                if (!isEmptyOrNotRented) {
                    propYearExpected += cell.amount || 0;
                    propYearActual += paidAmt;
                }
                const isFuture = cell.isPast === false;
                const now = new Date();
                const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;

                let cls = 'heatmap-cell ' + (cell.type || 'empty');
                if (cell.type === 'not_rented') cls += ' heatmap-cell-not-rented';
                if (cell.is_contract_start_month) cls += ' heatmap-cell-start-month';
                if (cell.has_unfulfilled_requests) cls += ' heatmap-cell-has-requests';
                if (isFuture && (cell.type === 'unpaid' || cell.type === 'overdue')) {
                    cls = (isCurrentMonth ? 'heatmap-cell current-month-unpaid' : 'heatmap-cell future-unpaid') + (cell.is_contract_start_month ? ' heatmap-cell-start-month' : '');
                } else if (isFuture && isPaid) {
                    cls = (isCurrentMonth ? 'heatmap-cell ' + (cell.type || 'exact') : 'heatmap-cell paid-advance' + (cell.type === 'overpaid' ? ' overpaid' : '')) + (cell.is_contract_start_month ? ' heatmap-cell-start-month' : '');
                }

                const prescribedTotal = cell.amount || 0;
                const pctPaid = prescribedTotal > 0 ? Math.min(100, (paidAmt / prescribedTotal) * 100) : 100;
                let content = '';
                let isBeforePurchase = false;
                if (cell.type === 'not_rented') {
                    content = 'Není v pronájmu';
                } else if (cell.type === 'empty') {
                    const purchaseDate = prop.purchase_date || '';
                    const purchaseYear = purchaseDate ? parseInt(purchaseDate.substring(0, 4), 10) : null;
                    const purchaseMonth = purchaseDate ? parseInt(purchaseDate.substring(5, 7), 10) : null;
                    isBeforePurchase = purchaseYear != null && purchaseMonth != null &&
                        (y < purchaseYear || (y === purchaseYear && m < purchaseMonth));
                    content = isBeforePurchase ? '' : 'Volno';
                } else {
                    const isOverdue = cell.isPast || isCurrentMonth;
                    let icon = '';
                    if (remaining === 0) {
                        icon = '<span class="heatmap-cell-icon cell-check">✓</span>';
                    } else if (isOverdue) {
                        icon = '<span class="heatmap-cell-icon cell-cross">✗</span>';
                    }
                    content = '<div class="heatmap-cell-content">' +
                        '<span class="heatmap-cell-amount">' + UI.fmt(prescribedTotal) + '</span>' + icon +
                        '</div>';
                    content = '<div class="heatmap-cell-fill" style="width:' + Math.round(pctPaid) + '%"></div>' + content;
                }

                if (cell.type === 'empty' && isBeforePurchase) cls += ' heatmap-cell-before-purchase';

                const contract = (cell && cell.contract != null) ? cell.contract : null;
                const contractEntityId = contract ? (contract.contracts_id ?? contract.id) : '';
                const contractStart = contract && contract.contract_start ? String(contract.contract_start).slice(0, 10) : '';
                const contractEnd = contract && contract.contract_end ? String(contract.contract_end).slice(0, 10) : '';
                const rentChangesJson = (contract && contract.rent_changes && contract.rent_changes.length > 0)
                    ? JSON.stringify(contract.rent_changes).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                    : '';
                const monthlyRent = contract && (contract.monthly_rent != null) ? parseFloat(contract.monthly_rent) : 0;
                const defaultPaymentMethod = contract && (contract.default_payment_method === 'account' || contract.default_payment_method === 'cash') ? contract.default_payment_method : '';
                const defaultBankAccountId = contract && contract.default_bank_accounts_id != null && contract.default_bank_accounts_id !== '' ? String(contract.default_bank_accounts_id) : '';
                const propIdForCell = prop.properties_id ?? prop.id;
                const dataAttrs = !isEmptyOrNotRented
                    ? ' data-property-id="' + propIdForCell + '" data-contract-id="' + contractEntityId + '" data-contracts-id="' + contractEntityId + '" data-month-key="' + cell.monthKey + '" data-amount="' + (cell.amount || 0) + '" data-tenant="' + (contract && contract.tenant_name ? contract.tenant_name : '').replace(/"/g, '&quot;') + '" data-paid="' + (isPaid ? '1' : '0') + '" data-payment-date="' + (cell.payment && cell.payment.date ? cell.payment.date : '') + '" data-payment-amount="' + paidAmt + '" data-remaining="' + remaining + '"' + (cell.remaining_rent != null ? ' data-remaining-rent="' + cell.remaining_rent + '"' : '') + (contractStart ? ' data-contract-start="' + contractStart.replace(/"/g, '&quot;') + '"' : '') + (contractEnd ? ' data-contract-end="' + contractEnd.replace(/"/g, '&quot;') + '"' : '') + (rentChangesJson ? ' data-rent-changes="' + rentChangesJson + '"' : '') + (monthlyRent > 0 ? ' data-monthly-rent="' + monthlyRent + '"' : '') + (defaultPaymentMethod ? ' data-default-payment-method="' + defaultPaymentMethod.replace(/"/g, '&quot;') + '"' : '') + (defaultBankAccountId ? ' data-default-bank-account-id="' + defaultBankAccountId.replace(/"/g, '&quot;') + '"' : '')
                    : ' data-property-id="' + propIdForCell + '" data-month-key="' + monthKey + '"';

                let titleAttr = '';
                if (cell.type === 'not_rented') {
                    titleAttr = ' title="Nemovitost se v tomto období ještě nepronajímala (pole Pronajímáno od u nemovitosti)."';
                } else if (!isEmptyOrNotRented) {
                    const tipParts = ['Předpis (součet): ' + UI.fmt(prescribedTotal) + ' Kč'];
                    if (cell.payment_details && cell.payment_details.length > 0) {
                        tipParts.push('Uhrazené platby:');
                        cell.payment_details.forEach(function(p) {
                            const dt = p.payment_date ? UI.fmtDate(p.payment_date) : '—';
                            const bankIcon = p.bank_transaction_id ? '🏦 ' : '';
                            tipParts.push('• ' + bankIcon + UI.fmt(p.amount) + ' Kč (' + dt + ')');
                        });
                    }
                    if (remaining > 0) {
                        tipParts.push('Zbývá: ' + UI.fmt(remaining) + ' Kč');
                    } else if (cell.type === 'overpaid' && paidAmt > prescribedTotal) {
                        tipParts.push('Přeplaceno o ' + UI.fmt(paidAmt - prescribedTotal) + ' Kč');
                    } else {
                        tipParts.push(cell.has_unfulfilled_requests ? 'Nájem uhrazen v plné výši.' : 'Uhrazeno v plné výši.');
                    }
                    if (cell.has_unfulfilled_requests) {
                        if (cell.unfulfilled_requests && cell.unfulfilled_requests.length > 0) {
                            tipParts.push('Neuhrazené požadavky:');
                            cell.unfulfilled_requests.forEach(function (req) {
                                tipParts.push('• ' + (req.label || 'Požadavek') + ' ' + UI.fmt(req.amount != null ? req.amount : 0) + ' Kč');
                            });
                        } else {
                            tipParts.push('Oranžový okraj: neuhrazený požadavek (např. vrácení kauce).');
                        }
                    }
                    tipParts.push('');
                    tipParts.push('Kauce a vrácení kauce se započítávají do měsíce, kdy byly zaplaceny/vyplaceny.');
                    titleAttr = ' title="' + UI.esc(tipParts.join('\n')) + '"';
                }

                const onClick = cell.type === 'not_rented' ? ''
                    : (cell.type === 'empty' ? (isBeforePurchase ? '' : 'DashboardView.openNewContract(this)') : 'DashboardView.openPaymentModal(this)');

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
            { label: 'Uhrazeno / Očekáváno (od zač. smlouvy)', title: 'Očekáváno = nájem + požadavky (energie, kauce, vyúčt.); vrácení kauce = odchod. Uhrazeno = všechny platby.' },
            { label: 'Neuhrazené měsíce / JINÉ POŽADAVKY' },
            { label: 'Pož.', title: 'Přidat požadavek (energie, vyúčtování, kauce…) k této smlouvě' },
        ],
        contracts,
        (d) => {
            const totalPaid = d.total_paid != null ? d.total_paid : 0;
            const expectedTotal = d.expected_total != null ? d.expected_total : 0;
            let pct = expectedTotal > 0 ? Math.min(100, (totalPaid / expectedTotal) * 100) : 100;
            const hasDbt = d.status_type === 'debt';
            const now = new Date();
            const currentY = now.getFullYear();
            const currentM = now.getMonth() + 1;
            const hasHistoricalArrear = (d.unpaid_months || []).some(u => u.year < currentY || (u.year === currentY && u.month < currentM));
            const progClass = hasDbt ? (hasHistoricalArrear ? 'bad' : 'current-debt') : 'ok';
            if (hasDbt && pct < 2) pct = 2;
            const depAmt = d.deposit_amount || 0;
            const balanceAll = (d.expected_total != null && d.total_paid != null) ? (d.expected_total - d.total_paid) : 0;
            const unpaidMonths = d.unpaid_months || [];
            const today = now.toISOString().slice(0, 10);
            const contractEnded = !!(d.contract_end && String(d.contract_end).slice(0, 10) <= today);
            const depositReturned = depAmt > 0 && !d.deposit_to_return;

            const isOnlyCurrentMonth = !hasHistoricalArrear && hasDbt && unpaidMonths.length === 1 &&
                unpaidMonths[0].year === currentY && unpaidMonths[0].month === currentM;
            const unpaidMonthsFiltered = (hasDbt && !hasHistoricalArrear && unpaidMonths.length > 0)
                ? unpaidMonths.filter(u => !(u.year === currentY && u.month === currentM))
                : unpaidMonths;
            const unpaidMonthsStr = unpaidMonthsFiltered.length ? unpaidMonthsFiltered.map(u => u.month + '/' + u.year).join(', ') : '';

            let progTitle = '';
            if (balanceAll < 0) {
                progTitle = 'Přeplaceno o ' + UI.fmt(-balanceAll) + ' Kč.';
            } else if (balanceAll === 0 || (Math.abs(balanceAll) < 0.01)) {
                if (contractEnded && depAmt > 0 && depositReturned) {
                    progTitle = 'Smlouva ukončena. Kauce ' + UI.fmt(depAmt) + ' Kč byla vrácena, všechny závazky vyrovnány.';
                } else if (contractEnded) {
                    progTitle = 'Smlouva ukončena. Vše vyrovnáno.';
                } else {
                    progTitle = 'Vše v pořádku.';
                }
            } else {
                if (isOnlyCurrentMonth) {
                    progTitle = 'Chybí doplatit ' + UI.fmt(balanceAll) + ' Kč za aktuální měsíc.';
                } else {
                    progTitle = 'Chybí doplatit ' + UI.fmt(balanceAll) + ' Kč.';
                    if (unpaidMonthsStr) progTitle += ' Neuhrazené měsíce: ' + unpaidMonthsStr + '.';
                }
            }
            if (depAmt > 0 && !(contractEnded && depositReturned)) {
                progTitle += (progTitle ? ' ' : '') + 'Kauce: ' + UI.fmt(depAmt) + ' Kč' + (d.deposit_to_return ? ' (k vrácení)' : '') + '.';
            }

            let tags = '';
            const requestTypeLabels = { energy: 'Energie', settlement: 'Vyúčt.', deposit: 'Kauce', deposit_return: 'Vrác. kauce', other: 'Jiné' };
            (d.unpaid_months || []).forEach(u => {
                const tenant = (d.tenant_name || '').replace(/"/g, '&quot;');
                const prop = (d.property_name || '').replace(/"/g, '&quot;');
                const rent = u.rent != null ? u.rent : d.monthly_rent;
                tags += '<span class="tag">' + u.month + '/' + u.year +
                    ' <span class="tag-plus" data-contracts-id="' + d.contracts_id + '" data-property-id="' + (d.properties_id ?? '') + '" data-year="' + u.year + '" data-month="' + u.month + '" data-rent="' + rent + '" data-tenant="' + tenant + '" data-property="' + prop + '" title="Přidat platbu">+</span></span>';
            });
            const sortedRequests = (d.payment_requests || []).slice().sort((a, b) => {
                const da = (a.due_date || '').toString().slice(0, 10);
                const db = (b.due_date || '').toString().slice(0, 10);
                if (!da && !db) return 0;
                if (!da) return 1;
                if (!db) return -1;
                return da.localeCompare(db);
            });
            sortedRequests.forEach(pr => {
                const tenant = (d.tenant_name || '').replace(/"/g, '&quot;');
                const prop = (d.property_name || '').replace(/"/g, '&quot;');
                const typeLabel = requestTypeLabels[pr.type] || pr.type;
                const dueDate = (pr.due_date || '').slice(0, 10);
                const dueDateFormatted = dueDate.length === 10 ? (dueDate.slice(8, 10) + '.' + dueDate.slice(5, 7) + '.' + dueDate.slice(0, 4)) : '';
                const dueAttr = dueDate ? ' data-due-date="' + dueDate.replace(/"/g, '&quot;') + '"' : '';
                const prId = pr.payment_requests_id ?? pr.id;
                const isPaid = !!(pr.paid_at && String(pr.paid_at).trim());
                const paidDate = isPaid && pr.paid_at ? (function () {
                    const s = String(pr.paid_at).slice(0, 10);
                    if (s.length === 10) return s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4);
                    return '';
                })() : '';
                const paidClass = isPaid ? ' tag-request-paid' : '';
                const paidBadge = isPaid ? '<span class="tag-paid-badge" title="' + (paidDate ? 'Uhrazeno ' + paidDate : 'Uhrazeno') + '">uhrazeno' + (paidDate ? ' ' + paidDate : '') + '</span>' : '';
                const unpaidDatePart = !isPaid && dueDateFormatted ? ' (' + dueDateFormatted + ')' : '';
                tags += '<span class="tag tag-request' + paidClass + '">' + typeLabel + ' ' + UI.fmt(pr.amount) + ' Kč' + unpaidDatePart + paidBadge +
                    ' <span class="tag-edit-req" data-payment-request-id="' + prId + '" title="Upravit požadavek">✎</span>' +
                    ' <span class="tag-plus" data-contracts-id="' + d.contracts_id + '" data-property-id="' + (d.properties_id ?? '') + '" data-amount="' + (pr.amount || 0) + '" data-request-type="' + (pr.type || 'energy') + '" data-payment-request-id="' + prId + '" data-tenant="' + tenant + '" data-property="' + prop + '"' + dueAttr + ' title="Zapsat platbu">+</span></span>';
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
            const progWrapTitle = progTitle || (UI.fmt(totalPaid) + ' / ' + UI.fmt(expectedTotal) + ' Kč');

            const addReqTitle = 'Přidat požadavek k této smlouvě';
            const addReqBtn = '<button type="button" class="btn btn-ghost btn-sm dash-add-req-btn" data-contracts-id="' + (d.contracts_id ?? d.id) + '" title="' + UI.esc(addReqTitle) + '">+</button>';
            const rentHistory = d.rent_history || [];
            const hasRentChanges = rentHistory.length > 1;
            let rentCellTitle = '';
            if (rentHistory.length) {
                rentCellTitle = 'Aktuální nájem: ' + UI.fmt(d.monthly_rent) + ' Kč';
                if (rentHistory.length > 1) {
                    rentCellTitle += '\nHistorie změn:';
                    rentHistory.forEach(h => {
                        const from = (h.effective_from || '').slice(0, 10);
                        const dateStr = from ? (from.slice(8, 10) + '.' + from.slice(5, 7) + '.' + from.slice(0, 4)) : '—';
                        rentCellTitle += '\n — ' + UI.fmt(h.amount) + ' Kč (od ' + dateStr + ')';
                    });
                }
            }
            const rentCellContent = UI.fmt(d.monthly_rent) + ' Kč' + (hasRentChanges ? ' <span class="dash-rent-up">↑</span>' : '');
            const rentTdTitle = rentCellTitle ? ' title="' + UI.esc(rentCellTitle) + '"' : '';
            return (
                '<td><strong' + tenantLink + '>' + UI.esc(d.tenant_name) + '</strong></td>' +
                '<td' + propLink + '>' + UI.esc(d.property_name) + '</td>' +
                '<td' + contractLink + rentTdTitle + '>' + rentCellContent + '</td>' +
                '<td' + paymentsLink + '><div class="prog-wrap" title="' + UI.esc(progWrapTitle) + '"><div class="prog-bar"><div class="prog-fill ' + progClass + '" style="width:' + Math.round(pct) + '%"></div></div>' +
                '<span class="prog-lbl" title="' + UI.esc(progWrapTitle) + '">' + UI.fmt(totalPaid) + ' / ' + UI.fmt(expectedTotal) + ' Kč</span></div></td>' +
                '<td class="dash-unpaid-cell">' + tagsHtml + '</td>' +
                '<td class="dash-p-col" title="' + UI.esc(addReqTitle) + '">' + addReqBtn + '</td>'
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
        document.getElementById('pay-req-edit-id').value = '';
        const btnDel = document.getElementById('btn-pay-req-delete');
        if (btnDel) btnDel.style.display = 'none';
        const closeWithoutWrapInit = document.getElementById('pay-req-close-without-wrap');
        if (closeWithoutWrapInit) closeWithoutWrapInit.style.display = 'none';
        const titleEl = document.getElementById('pay-req-modal-title');
        if (titleEl) titleEl.textContent = 'Přidat požadavek na platbu';
        const saveBtn = document.getElementById('btn-pay-req-save');
        if (saveBtn) saveBtn.textContent = 'Přidat';
        amountEl.value = '';
        typeEl.value = 'energy';
        noteEl.value = '';
        const dueDateEl = document.getElementById('pay-req-due-date');
        if (dueDateEl) dueDateEl.value = '';
        UI.modalOpen('modal-payment-request');
    });

    // Klik na „Upravit požadavek“ u tagu (✎) – otevře modal v režimu úprav
    view.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.tag-edit-req');
        if (!editBtn) return;
        e.preventDefault();
        e.stopPropagation();
        const id = editBtn.dataset.paymentRequestId;
        if (id) openPaymentRequestEdit(parseInt(id, 10));
    });

    // Klik na „+“ ve sloupci P – přidat požadavek k dané smlouvě (předvyplní smlouvu)
    view.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.dash-add-req-btn');
        if (!addBtn) return;
        e.preventDefault();
        e.stopPropagation();
        const cid = addBtn.dataset.contractsId;
        if (cid) openAddPaymentRequestModal(parseInt(cid, 10));
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
            const editIdEl = document.getElementById('pay-req-edit-id');
            const editId = (editIdEl && editIdEl.value) ? editIdEl.value.trim() : '';
            const cid = parseInt(contractSel.value, 10);
            const amount = parseFloat(amountEl.value);
            if (isNaN(amount) || amount === 0) {
                if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = 'Zadejte částku (kladnou = příjem, zápornou = výdej).'; }
                return;
            }
            if (!cid || cid <= 0) {
                if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = 'Vyberte smlouvu.'; }
                return;
            }
            const type = ['energy', 'settlement', 'other', 'deposit', 'deposit_return'].includes(typeEl.value) ? typeEl.value : 'energy';
            const dueDate = dueDateEl && dueDateEl.value ? dueDateEl.value.trim() : null;
            const payload = {
                contracts_id: cid,
                amount: amount,
                type: type,
                note: (noteEl.value || '').trim() || null,
                due_date: dueDate,
            };
            btnSave.disabled = true;
            try {
                if (editId) {
                    await Api.crudEdit('payment_requests', parseInt(editId, 10), payload);
                    const linkedSel = document.getElementById('pay-req-linked-payment');
                    const oldLinked = window._payReqLinkedPaymentId != null ? window._payReqLinkedPaymentId : 0;
                    const newLinked = (linkedSel && linkedSel.value) ? parseInt(linkedSel.value, 10) : 0;
                    if (newLinked !== oldLinked) {
                        if (oldLinked) await Api.paymentRequestUnlink(parseInt(editId, 10));
                        if (newLinked) await Api.paymentRequestLink(parseInt(editId, 10), newLinked);
                    }
                } else {
                    await Api.crudAdd('payment_requests', payload);
                }
                UI.modalClose('modal-payment-request');
                const yearBtn = document.querySelector('#dash-year .heatmap-year-btn.active');
                const y = yearBtn ? parseInt(yearBtn.dataset.year, 10) : new Date().getFullYear();
                loadDashboard(y);
                const onSaved = window._paymentRequestEditOnSaved;
                if (typeof onSaved === 'function') { onSaved(); window._paymentRequestEditOnSaved = null; }
            } catch (err) {
                if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = err.message || 'Chyba uložení.'; }
            } finally {
                btnSave.disabled = false;
            }
        });
    }

    const btnUnlink = document.getElementById('btn-pay-req-unlink');
    if (btnUnlink && !btnUnlink.dataset.bound) {
        btnUnlink.dataset.bound = '1';
        btnUnlink.addEventListener('click', async () => {
            const editIdEl = document.getElementById('pay-req-edit-id');
            const linkedSel = document.getElementById('pay-req-linked-payment');
            const editId = (editIdEl && editIdEl.value) ? editIdEl.value.trim() : '';
            if (!editId || !linkedSel || !linkedSel.value) return;
            try {
                btnUnlink.disabled = true;
                await Api.paymentRequestUnlink(parseInt(editId, 10));
                linkedSel.value = '';
                window._payReqLinkedPaymentId = null;
                const yearBtn = document.querySelector('#dash-year .heatmap-year-btn.active');
                const y = yearBtn ? parseInt(yearBtn.dataset.year, 10) : new Date().getFullYear();
                loadDashboard(y);
                const onSaved = window._paymentRequestEditOnSaved;
                if (typeof onSaved === 'function') { onSaved(); }
            } catch (err) {
                const alertEl = document.getElementById('pay-req-alert');
                if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = err.message || 'Chyba odpojení.'; }
            } finally {
                btnUnlink.disabled = false;
            }
        });
    }

    const btnDelete = document.getElementById('btn-pay-req-delete');
    if (btnDelete && !btnDelete.dataset.bound) {
        btnDelete.dataset.bound = '1';
        btnDelete.addEventListener('click', async () => {
            const editIdEl = document.getElementById('pay-req-edit-id');
            const editId = (editIdEl && editIdEl.value) ? editIdEl.value.trim() : '';
            if (!editId) return;
            if (!confirm('Opravdu smazat tento požadavek na platbu?')) return;
            const alertEl = document.getElementById('pay-req-alert');
            try {
                btnDelete.disabled = true;
                await Api.crudDelete('payment_requests', parseInt(editId, 10));
                UI.modalClose('modal-payment-request');
                const yearBtn = document.querySelector('#dash-year .heatmap-year-btn.active');
                const y = yearBtn ? parseInt(yearBtn.dataset.year, 10) : new Date().getFullYear();
                loadDashboard(y);
                const onSaved = window._paymentRequestEditOnSaved;
                if (typeof onSaved === 'function') { onSaved(); window._paymentRequestEditOnSaved = null; }
            } catch (err) {
                if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = err.message || 'Chyba smazání.'; }
            } finally {
                btnDelete.disabled = false;
            }
        });
    }

    const btnCloseWithout = document.getElementById('btn-pay-req-close-without');
    if (btnCloseWithout && !btnCloseWithout.dataset.bound) {
        btnCloseWithout.dataset.bound = '1';
        btnCloseWithout.addEventListener('click', async () => {
            const editIdEl = document.getElementById('pay-req-edit-id');
            const reasonEl = document.getElementById('pay-req-close-reason');
            const alertEl = document.getElementById('pay-req-alert');
            const editId = (editIdEl && editIdEl.value) ? editIdEl.value.trim() : '';
            const reason = (reasonEl && reasonEl.value) ? reasonEl.value.trim() : '';
            if (!editId) return;
            if (!reason) {
                if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = 'Důvod uzavření (poznámka) je povinný.'; }
                return;
            }
            try {
                btnCloseWithout.disabled = true;
                if (alertEl) alertEl.className = 'alert'; alertEl.textContent = '';
                await Api.paymentRequestCloseWithoutPayment(parseInt(editId, 10), reason);
                UI.modalClose('modal-payment-request');
                const yearBtn = document.querySelector('#dash-year .heatmap-year-btn.active');
                const y = yearBtn ? parseInt(yearBtn.dataset.year, 10) : new Date().getFullYear();
                loadDashboard(y);
                const onSaved = window._paymentRequestEditOnSaved;
                if (typeof onSaved === 'function') { onSaved(); window._paymentRequestEditOnSaved = null; }
            } catch (err) {
                if (alertEl) alertEl.className = 'alert alert-err show'; alertEl.textContent = err.message || 'Chyba uzavření.';
            } finally {
                btnCloseWithout.disabled = false;
            }
        });
    }
}

/** Otevře modal „Přidat požadavek“ s předvyplněnou smlouvou (voláno ze sloupce P v přehledu smluv). */
async function openAddPaymentRequestModal(contractId) {
    const contractSel = document.getElementById('pay-req-contract');
    const editIdEl = document.getElementById('pay-req-edit-id');
    const titleEl = document.getElementById('pay-req-modal-title');
    const saveBtn = document.getElementById('btn-pay-req-save');
    const amountEl = document.getElementById('pay-req-amount');
    const typeEl = document.getElementById('pay-req-type');
    const noteEl = document.getElementById('pay-req-note');
    const dueDateEl = document.getElementById('pay-req-due-date');
    const alertEl = document.getElementById('pay-req-alert');
    if (!contractSel || !editIdEl) return;
    try {
        const contracts = await Api.crudList('contracts');
        contractSel.innerHTML = '<option value="">— Vyberte smlouvu —</option>' +
            contracts.map(c => '<option value="' + (c.contracts_id ?? c.id) + '">' + UI.esc(c.tenant_name) + ' – ' + UI.esc(c.property_name) + '</option>').join('');
        editIdEl.value = '';
        const linkWrapAdd = document.getElementById('pay-req-link-wrap');
        if (linkWrapAdd) linkWrapAdd.style.display = 'none';
        const closeWithoutWrapAdd = document.getElementById('pay-req-close-without-wrap');
        if (closeWithoutWrapAdd) closeWithoutWrapAdd.style.display = 'none';
        const btnDeleteAdd2 = document.getElementById('btn-pay-req-delete');
        if (btnDeleteAdd2) btnDeleteAdd2.style.display = 'none';
        if (titleEl) titleEl.textContent = 'Přidat požadavek na platbu';
        if (saveBtn) saveBtn.textContent = 'Přidat';
        contractSel.value = String(contractId || '');
        if (amountEl) amountEl.value = '';
        if (typeEl) typeEl.value = 'energy';
        if (noteEl) noteEl.value = '';
        if (dueDateEl) dueDateEl.value = '';
        if (alertEl) { alertEl.className = 'alert'; alertEl.textContent = ''; }
        window._paymentRequestEditOnSaved = null;
        UI.modalOpen('modal-payment-request');
    } catch (err) {
        if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = err.message || 'Chyba načtení.'; }
    }
}
window.openAddPaymentRequestModal = openAddPaymentRequestModal;

/** Otevře modal požadavku na platbu v režimu úpravy. Volatelné ze smluv i z dashboardu. */
async function openPaymentRequestEdit(paymentRequestId, onSaved) {
    const titleEl = document.getElementById('pay-req-modal-title');
    const editIdEl = document.getElementById('pay-req-edit-id');
    const btnSave = document.getElementById('btn-pay-req-save');
    const contractSel = document.getElementById('pay-req-contract');
    const amountEl = document.getElementById('pay-req-amount');
    const typeEl = document.getElementById('pay-req-type');
    const noteEl = document.getElementById('pay-req-note');
    const dueDateEl = document.getElementById('pay-req-due-date');
    const alertEl = document.getElementById('pay-req-alert');
    const linkWrap = document.getElementById('pay-req-link-wrap');
    const linkedPaymentSel = document.getElementById('pay-req-linked-payment');
    if (!editIdEl || !contractSel) return;
    try {
        const contracts = await Api.crudList('contracts');
        contractSel.innerHTML = '<option value="">— Vyberte smlouvu —</option>' +
            contracts.map(c => '<option value="' + (c.contracts_id ?? c.id) + '">' + UI.esc(c.tenant_name) + ' – ' + UI.esc(c.property_name) + '</option>').join('');
        const pr = await Api.crudGet('payment_requests', paymentRequestId);
        if (!pr) return;
        const prEntityId = parseInt(pr.payment_requests_id ?? pr.id, 10);
        editIdEl.value = String(prEntityId);
        if (titleEl) titleEl.textContent = 'Upravit požadavek na platbu';
        if (btnSave) btnSave.textContent = 'Uložit';
        const btnDelete = document.getElementById('btn-pay-req-delete');
        if (btnDelete) btnDelete.style.display = '';
        contractSel.value = pr.contracts_id ?? '';
        amountEl.value = pr.amount ?? '';
        typeEl.value = ['energy', 'settlement', 'other', 'deposit', 'deposit_return'].includes(pr.type) ? pr.type : 'energy';
        noteEl.value = pr.note ?? '';
        if (dueDateEl) dueDateEl.value = (pr.due_date || '').toString().slice(0, 10);
        if (alertEl) { alertEl.className = 'alert'; alertEl.textContent = ''; }

        // Sekce „Propojená platba“ – jen v režimu úpravy, platby této smlouvy
        if (linkWrap) linkWrap.style.display = '';
        const cid = parseInt(pr.contracts_id, 10) || 0;
        window._payReqLinkedPaymentId = pr.payments_id ? parseInt(pr.payments_id, 10) : null;
        if (linkedPaymentSel && cid) {
            const payments = await Api.crudList('payments', { contracts_id: cid });
            const payId = p => p.payments_id ?? p.id;
            linkedPaymentSel.innerHTML = '<option value="">— Žádná —</option>' +
                payments.map(p => {
                    const id = payId(p);
                    const amt = UI.fmt(parseFloat(p.amount) || 0);
                    const date = p.payment_date ? UI.fmtDate(p.payment_date) : (p.period_year && p.period_month ? p.period_year + '-' + String(p.period_month).padStart(2, '0') : '—');
                    return '<option value="' + id + '">' + amt + ' Kč (' + date + ')</option>';
                }).join('');
            linkedPaymentSel.value = window._payReqLinkedPaymentId ? String(window._payReqLinkedPaymentId) : '';
        }

        // „Uzavřít bez platby“ – jen u neuhrazeného požadavku (bez paid_at)
        const closeWithoutWrap = document.getElementById('pay-req-close-without-wrap');
        const closeReasonEl = document.getElementById('pay-req-close-reason');
        if (closeWithoutWrap) closeWithoutWrap.style.display = (pr.paid_at ? 'none' : '');
        if (closeReasonEl) closeReasonEl.value = '';

        window._paymentRequestEditOnSaved = onSaved || null;
        UI.modalOpen('modal-payment-request');
    } catch (err) {
        if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = err.message || 'Chyba načtení.'; }
    }
}
window.openPaymentRequestEdit = openPaymentRequestEdit;
window.initPaymentRequestModal = initPaymentRequestModal;

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

// Cache bank_accounts v rámci relace – modal je pak rychlejší (méně requestů)
let _payModalBankAccountsCache = null;
function getBankAccountsForModal() {
    if (_payModalBankAccountsCache) return Promise.resolve(_payModalBankAccountsCache);
    return Api.crudList('bank_accounts').then(list => { _payModalBankAccountsCache = list || []; return _payModalBankAccountsCache; });
}

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
    const remainingRent = el.dataset.remainingRent !== undefined && el.dataset.remainingRent !== '' ? parseFloat(el.dataset.remainingRent) : NaN;

    const [year, month] = monthKey.split('-');
    const monthName = MONTH_NAMES[parseInt(month, 10) - 1] || month;
    const propName = el.dataset.propertyName || (el.closest('tr') && el.closest('tr').querySelector('.heatmap-property') ? el.closest('tr').querySelector('.heatmap-property').textContent : '') || '';
    const propertyId = el.dataset.propertyId ? String(el.dataset.propertyId).trim() : '';

    const info = document.getElementById('pay-modal-info');
    const amount = document.getElementById('pay-modal-amount');
    const paid = document.getElementById('pay-modal-paid');
    const dateWrap = document.getElementById('pay-modal-date-wrap');
    const dateInput = document.getElementById('pay-modal-date');
    const methodWrap = document.getElementById('pay-modal-method-wrap');
    const methodSelect = document.getElementById('pay-modal-method');
    const accountWrap = document.getElementById('pay-modal-account-wrap');
    const accountSelect = document.getElementById('pay-modal-account');
    const noteEl = document.getElementById('pay-modal-note');
    const existingWrap = document.getElementById('pay-modal-existing');
    const batchHintEl = document.getElementById('pay-modal-batch-hint');
    const breakdownWrap = document.getElementById('pay-modal-breakdown');
    const editIdEl = document.getElementById('pay-modal-edit-id');
    const typeSelect = document.getElementById('pay-modal-type');
    const typeWrap = document.getElementById('pay-modal-type-wrap');
    const formSection = document.getElementById('pay-modal-form-section');
    const formTitle = document.getElementById('pay-modal-form-title');
    const bulkWrap = document.getElementById('pay-modal-bulk-wrap');
    const bulkCheckbox = document.getElementById('pay-modal-bulk');
    const rangeRow = document.getElementById('pay-modal-range-row');
    const monthFromEl = document.getElementById('pay-modal-month-from');
    const yearFromEl = document.getElementById('pay-modal-year-from');
    const monthToEl = document.getElementById('pay-modal-month-to');
    const yearToEl = document.getElementById('pay-modal-year-to');
    function parseYear(v) {
        const n = parseInt(String(v).trim(), 10);
        if (isNaN(n)) return NaN;
        if (n >= 100 && n <= 2100) return n;
        if (n >= 0 && n < 100) return 2000 + n;
        return n;
    }
    function parseMonth(v) {
        const n = parseInt(String(v).trim(), 10);
        if (isNaN(n) || n < 1 || n > 12) return NaN;
        return n;
    }

    // Kauce a vrácení kauce patří do měsíce podle payment_date; ostatní platby podle period (konzistentní s heatmapou).
    function effectiveMonthKey(p) {
        const pt = (p.payment_type || 'rent');
        if ((pt === 'deposit' || pt === 'deposit_return') && p.payment_date) return String(p.payment_date).slice(0, 7);
        if (p.period_year != null && p.period_month != null) return String(p.period_year) + '-' + String(p.period_month).padStart(2, '0');
        return null;
    }
    function paymentContributesToMonth(p, key) {
        if (effectiveMonthKey(p) === key) return true;
        const linkedIdsStr = (p.linked_payment_request_ids != null && String(p.linked_payment_request_ids).trim() !== '') ? String(p.linked_payment_request_ids).trim() : ((p.linked_payment_request_id != null && p.linked_payment_request_id !== '') ? String(p.linked_payment_request_id) : '');
        const linkedIds = linkedIdsStr ? linkedIdsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (linkedIds.length === 0) return false;
        const getReqId = r => String(r.payment_requests_id ?? r.id);
        const linkedReqs = paymentRequests.filter(r => linkedIds.includes(getReqId(r)));
        return linkedReqs.some(r => String(r.due_date || '').slice(0, 7) === key);
    }
    const paymentsPromise = propertyId
        ? Api.crudList('payments', { properties_id: propertyId })
        : Api.crudList('payments', { contracts_id: contractsId });
    const requestsPromise = propertyId
        ? Api.crudList('payment_requests', { properties_id: propertyId })
        : Api.crudList('payment_requests', { contracts_id: contractsId });
    const [bankAccounts, paymentsResult, paymentRequests] = await Promise.all([
        getBankAccountsForModal(),
        paymentsPromise,
        requestsPromise
    ]);
    let payments = paymentsResult || [];
    let forMonth = payments.filter(p => paymentContributesToMonth(p, monthKey));
    let defaultMethod = (el.dataset.defaultPaymentMethod === 'account' || el.dataset.defaultPaymentMethod === 'cash') ? el.dataset.defaultPaymentMethod : '';
    let defaultAccountId = (el.dataset.defaultBankAccountId != null && el.dataset.defaultBankAccountId !== '') ? String(el.dataset.defaultBankAccountId) : '';
    if (!defaultMethod && !defaultAccountId && contractsId) {
        try {
            const contractRow = await Api.crudGet('contracts', parseInt(contractsId, 10));
            if (contractRow) {
                defaultMethod = (contractRow.default_payment_method === 'account' || contractRow.default_payment_method === 'cash') ? contractRow.default_payment_method : '';
                defaultAccountId = (contractRow.default_bank_accounts_id != null && contractRow.default_bank_accounts_id !== '') ? String(contractRow.default_bank_accounts_id) : '';
            }
        } catch (_) {}
    }
    const primaryAccount = bankAccounts.find(b => b.is_primary);
    const fallbackAccId = primaryAccount ? (primaryAccount.bank_accounts_id ?? primaryAccount.id) : '';
    const defaultAccId = (defaultAccountId && bankAccounts.some(b => String(b.bank_accounts_id ?? b.id) === defaultAccountId)) ? defaultAccountId : fallbackAccId;
    accountSelect.innerHTML = '<option value="">— Vyberte účet —</option>' +
        bankAccounts.map(b => {
            const bid = b.bank_accounts_id ?? b.id;
            return '<option value="' + bid + '"' + (bid == defaultAccId ? ' selected' : '') + '>' +
                UI.esc(b.name) + (b.account_number ? ' – ' + UI.esc(b.account_number) : '') +
            '</option>';
        }).join('');
    if (defaultMethod) methodSelect.value = defaultMethod;
    accountWrap.style.display = (methodSelect.value === 'account' && paid.checked) ? 'block' : 'none';

    document.getElementById('pay-modal-contract-id').value = contractId;
    document.getElementById('pay-modal-month-key').value = monthKey;
    window._payModalPrefillRequestId = [];
    editIdEl.value = '';
    noteEl.value = '';
    const counterpartInit = document.getElementById('pay-modal-counterpart-account');
    if (counterpartInit) counterpartInit.value = '';
    batchHintEl.style.display = 'none';
    bulkCheckbox.checked = false;
    rangeRow.style.display = 'none';
    const nowY = new Date().getFullYear();
    if (monthFromEl) monthFromEl.value = month;
    if (monthToEl) monthToEl.value = month;
    yearFromEl.value = year;
    yearToEl.value = year;
    if (typeof UI.updateSearchableSelectDisplay === 'function') {
        UI.updateSearchableSelectDisplay('pay-modal-month-from');
        UI.updateSearchableSelectDisplay('pay-modal-month-to');
    }

    const showFormInitially = (forMonth.length === 0);
    if (showFormInitially) {
        if (formSection) formSection.style.display = '';
        if (formTitle) { formTitle.style.display = ''; formTitle.textContent = 'Přidat platbu'; }
        const periodWrapAdd = document.getElementById('pay-modal-period-wrap');
        const periodMonthAdd = document.getElementById('pay-modal-period-month');
        const periodYearAdd = document.getElementById('pay-modal-period-year');
        if (periodWrapAdd && periodMonthAdd && periodYearAdd) {
            periodWrapAdd.style.display = 'block';
            periodMonthAdd.value = String(parseInt(month, 10) || 1);
            periodYearAdd.value = year;
        }
    } else {
        if (formSection) formSection.style.display = 'none';
        if (formTitle) { formTitle.style.display = 'none'; formTitle.textContent = ''; }
    }

    let rentChanges = [];
    try {
        if (el.dataset.rentChanges) rentChanges = JSON.parse(el.dataset.rentChanges);
    } catch (_) {}
    const monthlyRentVal = el.dataset.monthlyRent ? parseFloat(el.dataset.monthlyRent) : 0;

    function getRentForMonthInRange(baseRent, changes, y, m) {
        const firstOfMonth = y + '-' + String(m).padStart(2, '0') + '-01';
        if (!changes || changes.length === 0) return baseRent;
        let rent = baseRent;
        for (let i = 0; i < changes.length; i++) {
            const ef = (changes[i].effective_from || '').slice(0, 10);
            if (ef && ef <= firstOfMonth) rent = changes[i].amount;
        }
        return rent;
    }
    function calcRentForRange() {
        if (!bulkCheckbox.checked) return null;
        const yFrom = parseYear(yearFromEl.value);
        const mFrom = parseMonth(monthFromEl.value);
        const yTo = parseYear(yearToEl.value);
        const mTo = parseMonth(monthToEl.value);
        if (isNaN(yFrom) || isNaN(mFrom) || isNaN(yTo) || isNaN(mTo)) return null;
        const tsFrom = yFrom * 12 + mFrom;
        const tsTo = yTo * 12 + mTo;
        if (tsFrom > tsTo) return null;
        const cStart = contractStart ? new Date(contractStart) : null;
        const cEnd = contractEnd ? new Date(contractEnd) : null;
        let total = 0;
        for (let y = yFrom, m = mFrom; y < yTo || (y === yTo && m <= mTo); m++) {
            if (m > 12) { m = 1; y++; }
            const firstOfMonth = new Date(y, m - 1, 1);
            const lastOfMonth = new Date(y, m, 0);
            if (cStart && lastOfMonth < cStart) { if (y === yTo && m === mTo) break; continue; }
            if (cEnd && firstOfMonth > cEnd) { if (y === yTo && m === mTo) break; continue; }
            total += getRentForMonthInRange(monthlyRentVal, rentChanges, y, m);
            if (y === yTo && m === mTo) break;
        }
        return Math.round(total * 100) / 100;
    }
    function updateAmountFromRange() {
        const sum = calcRentForRange();
        if (sum != null) amount.value = sum;
    }

    function amountContributingToMonth(p) {
        const linkedIdsStr = (p.linked_payment_request_ids != null && String(p.linked_payment_request_ids).trim() !== '') ? String(p.linked_payment_request_ids).trim() : ((p.linked_payment_request_id != null && p.linked_payment_request_id !== '') ? String(p.linked_payment_request_id) : '');
        const linkedIds = linkedIdsStr ? linkedIdsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        const getReqId = r => String(r.payment_requests_id ?? r.id);
        const linkedReqs = linkedIds.length ? paymentRequests.filter(r => linkedIds.includes(getReqId(r))) : [];
        const allocatedSum = linkedReqs.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
        const remainder = Math.round((parseFloat(p.amount) || 0) - allocatedSum, 2);
        const paymentMonthKey = (p.period_year != null && p.period_month != null) ? (String(p.period_year) + '-' + String(p.period_month).padStart(2, '0')) : '';
        const hasBreakdown = linkedIds.length > 0 && (remainder !== 0 || linkedReqs.length > 0);
        if (!hasBreakdown) {
            return (effectiveMonthKey(p) === monthKey) ? (parseFloat(p.amount) || 0) : 0;
        }
        let sum = 0;
        if (remainder !== 0 && paymentMonthKey === monthKey) sum += remainder;
        linkedReqs.forEach(r => {
            const reqMonthKey = r.due_date ? String(r.due_date).slice(0, 7) : '';
            if (reqMonthKey === monthKey) sum += parseFloat(r.amount) || 0;
        });
        return sum;
    }
    const sumForMonth = forMonth.reduce((s, p) => s + amountContributingToMonth(p), 0);
    let infoHtml = '<div><strong>Nemovitost:</strong> ' + UI.esc(propName) + '</div>' +
        '<div><strong>Nájemce:</strong> ' + UI.esc(tenantName) + '</div>' +
        '<div><strong>Období:</strong> ' + monthName + ' ' + year + '</div>';
    if (!isPaid && paymentAmount > 0 && remaining > 0) {
        infoHtml += '<div class="pay-modal-partial"><strong>Uhrazeno:</strong> ' + UI.fmt(paymentAmount) + ' Kč, <strong>zbývá:</strong> ' + UI.fmt(remaining) + ' Kč</div>';
    } else if (isPaid) {
        const overpaid = paymentAmount > amountVal;
        infoHtml += '<div class="pay-modal-full' + (overpaid ? ' pay-modal-overpaid' : '') + '"><strong>Měsíc je ' + (overpaid ? 'přeplacen' : 'plně uhrazen') + ' částkou ' + UI.fmt(sumForMonth) + ' Kč</strong> (můžete <a href="#" class="pay-modal-add-extra-link" data-action="add">přidat další platbu navíc</a> za přeplatek, doplatek…).</div>';
    }
    info.innerHTML = infoHtml;
    const initialInfoHtml = infoHtml;

    const typeLabels = { rent: 'Nájem', deposit: 'Kauce', deposit_return: 'Vrácení kauce', energy: 'Energie', other: 'Jiné' };
    function setTypeWrapClass(t) {
        const v = (t && ['rent','deposit','deposit_return','energy','other'].includes(t)) ? t : 'rent';
        if (typeWrap) {
            typeWrap.classList.remove('pay-type-rent', 'pay-type-deposit', 'pay-type-deposit_return', 'pay-type-energy', 'pay-type-other');
            typeWrap.classList.add('pay-type-' + v);
        }
    }

    if (breakdownWrap) breakdownWrap.style.display = 'none';

    const paymentRequestId = el.dataset.paymentRequestId || '';
    if (paymentRequestId) {
        window._payModalPrefillRequestId = [String(paymentRequestId)];
        const reqType = (el.dataset.requestType || 'energy');
        const payType = (reqType === 'deposit_return') ? 'deposit_return' : (['rent','deposit','energy','other'].includes(reqType) ? reqType : (reqType === 'settlement' ? 'other' : 'rent'));
        typeSelect.value = payType;
        setTypeWrapClass(typeSelect.value);
        const reqAmt = parseFloat(el.dataset.amount);
        amount.value = (reqType === 'deposit_return' && reqAmt > 0) ? -reqAmt : (isNaN(reqAmt) ? '' : reqAmt);
    } else {
        typeSelect.value = 'rent';
        setTypeWrapClass('rent');
    }
    paid.checked = isPaid;
    if (!paymentRequestId) {
        if (isPaid) amount.value = amountVal;
        else amount.value = remaining;
    }
    dateInput.value = paymentDate;
    dateWrap.style.display = isPaid ? 'block' : 'none';
    methodWrap.style.display = isPaid ? 'flex' : 'none';
    accountWrap.style.display = methodSelect.value === 'account' ? 'block' : 'none';

    const requestLinkWrap = document.getElementById('pay-modal-request-link-wrap');
    const requestLinkList = document.getElementById('pay-modal-linked-request-list');
    function renderRequestCheckboxes(requests, checkedIds) {
        if (!requestLinkList) return;
        const prId = r => r.payment_requests_id ?? r.id;
        const idSet = new Set((checkedIds || []).map(String));
        const sorted = [...requests].sort((a, b) => {
            const da = a.due_date ? String(a.due_date) : '';
            const db = b.due_date ? String(b.due_date) : '';
            if (da && db) return da.localeCompare(db);
            if (da) return -1;
            if (db) return 1;
            return 0;
        });
        let html = '';
        const reqTypeLabels = { energy: 'Energie', settlement: 'Vyúčtování', deposit: 'Kauce', deposit_return: 'Vrácení kauce', other: 'Jiné' };
        sorted.forEach(r => {
            const rid = prId(r);
            const typeLabel = reqTypeLabels[r.type] || 'Požadavek';
            const amtStr = UI.fmt(parseFloat(r.amount) || 0);
            const dateStr = r.due_date ? UI.fmtDate(r.due_date) : '';
            const statusStr = r.paid_at ? 'vyřízeno' : 'nevyřízeno';
            const label = typeLabel + ' ' + amtStr + ' Kč' + (dateStr ? ' (' + dateStr + ' – ' + statusStr + ')' : ' (' + statusStr + ')');
            const titleAttr = (r.note != null && String(r.note).trim() !== '') ? (' title="' + String(r.note).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"') : '';
            const checked = idSet.has(String(rid)) ? ' checked' : '';
            html += '<label class="pay-modal-request-cb"' + titleAttr + '><span class="pay-modal-request-cb-text">' + UI.esc(label) + '</span><input type="checkbox" name="pay-modal-pr" value="' + rid + '"' + checked + '></label>';
        });
        if (!html) html = '<p class="text-muted" style="font-size:.9rem">Žádné požadavky k propojení.</p>';
        requestLinkList.innerHTML = html;
    }
    function getCheckedRequestIds() {
        if (!requestLinkList) return [];
        return Array.from(requestLinkList.querySelectorAll('input[name="pay-modal-pr"]:checked')).map(cb => parseInt(cb.value, 10)).filter(n => !isNaN(n));
    }

    const contractIdsInMonth = [...new Set(forMonth.map(p => String(p.contracts_id ?? '')).filter(Boolean))];
    const contractIdToIndex = {};
    contractIdsInMonth.forEach((cid, i) => { contractIdToIndex[cid] = i; });

    const requestTypeLabelsShort = { energy: 'Energie', settlement: 'Vyúčtování', deposit: 'Kauce', deposit_return: 'Vrácení kauce', other: 'Jiné' };
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
            const linkedIdsStr = (p.linked_payment_request_ids != null && String(p.linked_payment_request_ids).trim() !== '') ? String(p.linked_payment_request_ids).trim() : ((p.linked_payment_request_id != null && p.linked_payment_request_id !== '') ? String(p.linked_payment_request_id) : '');
            const linkedIds = linkedIdsStr ? linkedIdsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
            const prId = r => String(r.payment_requests_id ?? r.id);
            const getReqId = r => String(r.payment_requests_id ?? r.id);
            const linkedReqs = linkedIds.length ? paymentRequests.filter(r => linkedIds.includes(getReqId(r))) : [];
            const allocatedSum = linkedReqs.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
            const remainder = Math.round((parseFloat(p.amount) || 0) - allocatedSum, 2);
            const periodLabel = (p.period_year && p.period_month && parseInt(p.period_month, 10) >= 1 && parseInt(p.period_month, 10) <= 12) ? ((typeof UI !== 'undefined' && UI.MONTHS ? UI.MONTHS[parseInt(p.period_month, 10)] : ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'][parseInt(p.period_month, 10) - 1]) + ' ' + p.period_year) : '';
            const periodLabelLower = periodLabel ? (periodLabel.charAt(0).toLowerCase() + periodLabel.slice(1)) : '';
            const paymentMonthKey = (p.period_year != null && p.period_month != null) ? (String(p.period_year) + '-' + String(p.period_month).padStart(2, '0')) : '';
            const partsWithMonth = [];
            if (remainder !== 0 && periodLabel) partsWithMonth.push({ label: 'Nájem', dateLabel: periodLabelLower, amount: UI.fmt(remainder) + ' Kč', partMonthKey: paymentMonthKey });
            linkedReqs.forEach(r => {
                const reqLabel = requestTypeLabelsShort[r.type] || 'Požadavek';
                const reqDate = r.due_date ? UI.fmtDate(r.due_date) : '';
                const reqMonthKey = r.due_date ? String(r.due_date).slice(0, 7) : '';
                partsWithMonth.push({ label: reqLabel, dateLabel: reqDate, amount: UI.fmt(parseFloat(r.amount) || 0) + ' Kč', partMonthKey: reqMonthKey });
            });
            const hasBreakdown = partsWithMonth.length > 1;
            const hasRentPart = remainder !== 0 && periodLabel;
            const displayTypeLabel = hasBreakdown
                ? (hasRentPart ? 'Nájem+požadavky' : (typeLabels[pt] || 'Požadavky'))
                : (typeLabels[pt] || 'Nájem');
            const typeBadge = '<span class="pay-modal-type-badge pay-type-' + pt + '">' + UI.esc(displayTypeLabel) + '</span>';
            const batchTag = p.payment_batch_id ? ' <span class="tag tag-batch" title="Součást jedné platby za více měsíců">dávka</span>' : '';
            const payEntityId = p.payments_id ?? p.id;
            const noteAttr = (p.note != null && p.note !== '') ? (' data-note="' + String(p.note).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"') : '';
            const cid = String(p.contracts_id ?? '');
            const contractIndex = contractIdToIndex[cid] ?? 0;
            const tenantLabel = (p.tenant_name != null && p.tenant_name !== '') ? (' <span class="pay-modal-tenant-label" title="Smlouva – nájemce">' + UI.esc(p.tenant_name) + '</span>') : '';
            const tenantAttr = (p.tenant_name != null && p.tenant_name !== '') ? (' data-tenant-name="' + String(p.tenant_name).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"') : '';
            const periodY = (p.period_year != null && p.period_year !== '') ? String(p.period_year) : '';
            const periodM = (p.period_month != null && p.period_month !== '') ? String(p.period_month) : '';
            const breakdownRows = hasBreakdown && partsWithMonth.length
                ? partsWithMonth.map(function (part) {
                    const active = (part.partMonthKey && part.partMonthKey === monthKey);
                    const rowClass = 'pay-modal-breakdown-row pay-modal-breakdown-part--' + (active ? 'active' : 'inactive');
                    return '<div class="' + rowClass + '"><span class="pay-modal-breakdown-label">' + UI.esc(part.label) + '</span><span class="pay-modal-breakdown-date">' + UI.esc(part.dateLabel || '') + '</span><span class="pay-modal-breakdown-amount">' + part.amount + '</span></div>';
                }).join('')
                : '';
            const contentHtml = hasBreakdown && partsWithMonth.length
                ? ('<div class="pay-modal-existing-content">' +
                    '<span class="pay-modal-main-label">' + typeBadge + batchTag + tenantLabel + '</span>' +
                    '<span class="pay-modal-main-date">' + dt + '</span>' +
                    '<span class="pay-modal-main-amount">' + amt + ' Kč</span>' +
                    '<div class="pay-modal-breakdown-block">' + breakdownRows + '</div></div>')
                : ('<div class="pay-modal-existing-content">' +
                    '<span class="pay-modal-main-label">' + typeBadge + batchTag + tenantLabel + '</span>' +
                    '<span class="pay-modal-main-date">' + dt + '</span>' +
                    '<span class="pay-modal-main-amount">' + amt + ' Kč</span></div>');
            const contributesAny = amountContributingToMonth(p) > 0;
            const allPartsInMonth = !hasBreakdown ? (effectiveMonthKey(p) === monthKey) : (partsWithMonth.length > 0 && partsWithMonth.every(part => part.partMonthKey === monthKey));
            const rowOutsideMonth = !contributesAny || (hasBreakdown && !allPartsInMonth);
            const itemClasses = 'pay-modal-existing-item pay-modal-by-contract-' + contractIndex + (rowOutsideMonth ? ' pay-modal-existing-item--outside-month' : '');
            html += '<li class="' + itemClasses + '">' +
                contentHtml + ' ' +
                '<button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="' + payEntityId + '" data-contracts-id="' + cid + '" data-contract-index="' + contractIndex + '"' + tenantAttr + ' data-amount="' + (p.amount ?? 0) + '" data-date="' + (p.payment_date || '') + '" data-method="' + method + '" data-account="' + accId + '" data-type="' + pt + '" data-batch-id="' + (p.payment_batch_id || '') + '" data-linked-request-ids="' + String(linkedIdsStr).replace(/"/g, '&quot;') + '" data-period-year="' + periodY + '" data-period-month="' + periodM + '"' + noteAttr + '>Upravit</button> ' +
                '<button type="button" class="btn btn-ghost btn-sm" data-action="delete" data-id="' + payEntityId + '" data-batch-id="' + (p.payment_batch_id || '') + '">Smazat</button>' +
                '</li>';
        });
        html += '</ul><div class="pay-modal-add-block"><div class="pay-modal-add-link"><a href="#" data-action="add">+ Přidat novou platbu</a></div></div>';
        existingWrap.innerHTML = html;
    }
    renderExisting();
    if (!showFormInitially) {
        const pref = document.getElementById('pay-modal-prefill-msg');
        if (pref) pref.style.display = 'none';
    }

    const prefillMsgEl = document.getElementById('pay-modal-prefill-msg');
    if (prefillMsgEl) prefillMsgEl.style.display = 'none';
    prefillMsgEl && (prefillMsgEl.textContent = '');

    // Předvyplnění jedné platby: priorita 1) zbývající nájem, 2) neuhrazené požadavky
    let prefillUnfulfilledReqs = [];
    if (!paymentRequestId && !editIdEl.value) {
        const expectedTotal = amountVal;
        const paidTotal = sumForMonth;
        prefillUnfulfilledReqs = paymentRequests.filter(r => {
            const d = r.due_date;
            return d && String(d).slice(0, 7) === monthKey && !r.paid_at && String(r.contracts_id ?? '') === String(contractsId);
        });
        if (!isNaN(remainingRent) && remainingRent > 0) {
            amount.value = remainingRent;
            typeSelect.value = 'rent';
            setTypeWrapClass('rent');
            window._payModalPrefillRequestId = [];
            if (prefillMsgEl) {
                prefillMsgEl.textContent = 'Bylo předvyplněno zbývajícím nájmem (' + UI.fmt(remainingRent) + ' Kč). Můžete změnit.';
                prefillMsgEl.style.display = 'block';
            }
        } else if (prefillUnfulfilledReqs.length > 0) {
            const r = prefillUnfulfilledReqs[0];
            const reqAmt = parseFloat(r.amount) || 0;
            amount.value = (r.type === 'deposit_return' && reqAmt > 0) ? -reqAmt : reqAmt;
            const payType = (r.type === 'deposit_return') ? 'deposit_return' : (['rent','deposit','energy','other'].includes(r.type) ? r.type : (r.type === 'settlement' ? 'energy' : 'energy'));
            typeSelect.value = payType;
            setTypeWrapClass(payType);
            window._payModalPrefillRequestId = [String(r.payment_requests_id ?? r.id)];
            const label = (r.note || (r.type === 'energy' ? 'Energie' : r.type === 'deposit_return' ? 'Vrácení kauce' : 'Požadavek')) + ' ' + UI.fmt(reqAmt) + ' Kč';
            if (prefillMsgEl) {
                prefillMsgEl.textContent = 'Bylo předvyplněno neuhrazeným požadavkem (' + label + '). Můžete změnit.';
                prefillMsgEl.style.display = 'block';
            }
        }
    } else if (paymentRequestId && prefillMsgEl) {
        prefillMsgEl.textContent = 'Bylo předvyplněno požadavkem. Můžete změnit.';
        prefillMsgEl.style.display = 'block';
    }

    if (showFormInitially) {
        bulkWrap.style.display = editIdEl.value ? 'none' : 'block';
        if (requestLinkWrap && requestLinkList) {
            if (!editIdEl.value) {
                requestLinkWrap.style.display = '';
                const unpaid = paymentRequests.filter(r => !r.paid_at && String(r.contracts_id ?? '') === String(contractsId));
                const prefillIds = (window._payModalPrefillRequestId && Array.isArray(window._payModalPrefillRequestId)) ? window._payModalPrefillRequestId : (window._payModalPrefillRequestId ? [String(window._payModalPrefillRequestId)] : []);
                renderRequestCheckboxes(unpaid, prefillIds);
            } else {
                requestLinkWrap.style.display = 'none';
            }
        }
    }

    function openAddForm() {
        existingWrap.querySelectorAll('.pay-modal-existing-item--editing').forEach(el => el.classList.remove('pay-modal-existing-item--editing'));
        if (formSection) formSection.classList.remove('pay-modal-form-section--contract-0', 'pay-modal-form-section--contract-1', 'pay-modal-form-section--contract-2');
        const uncheckHintAdd = document.getElementById('pay-modal-uncheck-hint');
        if (uncheckHintAdd) uncheckHintAdd.style.display = 'none';
        if (formSection) formSection.style.display = '';
        if (formTitle) { formTitle.style.display = ''; formTitle.textContent = 'Přidat platbu'; }
        if (info && typeof initialInfoHtml !== 'undefined') info.innerHTML = initialInfoHtml;
        editIdEl.value = '';
        delete editIdEl.dataset.batchId;
        delete editIdEl.dataset.originalAmount;
        delete editIdEl.dataset.linkedRequestIds;
        const periodWrapAdd = document.getElementById('pay-modal-period-wrap');
        if (periodWrapAdd) periodWrapAdd.style.display = 'none';
        if (prefillMsgEl) { prefillMsgEl.style.display = 'none'; prefillMsgEl.textContent = ''; }
        const addLinkWrap = document.querySelector('.pay-modal-add-block');
        if (addLinkWrap) addLinkWrap.style.display = 'none';
        if (requestLinkWrap && requestLinkList) {
            requestLinkWrap.style.display = '';
            const unpaid = paymentRequests.filter(r => !r.paid_at && String(r.contracts_id ?? '') === String(contractsId));
            const prefillIds = (window._payModalPrefillRequestId && Array.isArray(window._payModalPrefillRequestId)) ? window._payModalPrefillRequestId : (window._payModalPrefillRequestId ? [String(window._payModalPrefillRequestId)] : []);
            renderRequestCheckboxes(unpaid, prefillIds);
        }
        if (!isNaN(remainingRent) && remainingRent > 0) {
            amount.value = remainingRent;
            typeSelect.value = 'rent';
            setTypeWrapClass('rent');
            window._payModalPrefillRequestId = [];
        } else if (prefillUnfulfilledReqs.length > 0) {
            const r = prefillUnfulfilledReqs[0];
            const reqAmt = parseFloat(r.amount) || 0;
            amount.value = (r.type === 'deposit_return' && reqAmt > 0) ? -reqAmt : reqAmt;
            const payType = (r.type === 'deposit_return') ? 'deposit_return' : (['rent','deposit','energy','other'].includes(r.type) ? r.type : (r.type === 'settlement' ? 'energy' : 'energy'));
            typeSelect.value = payType;
            setTypeWrapClass(payType);
            window._payModalPrefillRequestId = [String(r.payment_requests_id ?? r.id)];
        } else {
            amount.value = '';
            typeSelect.value = 'rent';
            setTypeWrapClass('rent');
            window._payModalPrefillRequestId = [];
        }
        paid.checked = false;
        dateWrap.style.display = 'none';
        methodWrap.style.display = 'none';
        batchHintEl.style.display = 'none';
        bulkWrap.style.display = 'block';
        bulkCheckbox.checked = false;
        rangeRow.style.display = 'none';
        noteEl.value = '';
        const counterpartAdd = document.getElementById('pay-modal-counterpart-account');
        if (counterpartAdd) counterpartAdd.value = '';
    }

    existingWrap.onclick = async (e) => {
        const editBtn = e.target.closest('[data-action="edit"]');
        const delBtn = e.target.closest('[data-action="delete"]');
        const addLink = e.target.closest('[data-action="add"]');
        if (editBtn) {
            existingWrap.querySelectorAll('.pay-modal-existing-item--editing').forEach(el => el.classList.remove('pay-modal-existing-item--editing'));
            const editingRow = editBtn.closest('.pay-modal-existing-item');
            if (editingRow) editingRow.classList.add('pay-modal-existing-item--editing');
            if (formSection) {
                formSection.style.display = '';
                formSection.classList.remove('pay-modal-form-section--contract-0', 'pay-modal-form-section--contract-1', 'pay-modal-form-section--contract-2');
                const ci = editBtn.dataset.contractIndex;
                if (ci !== undefined && ci !== '') formSection.classList.add('pay-modal-form-section--contract-' + ci);
            }
            if (formTitle) { formTitle.style.display = ''; formTitle.textContent = 'Upravit platbu'; }
            const pt = editBtn.dataset.type || 'rent';
            const payId = String(editBtn.dataset.id || '');
            const paymentTenantName = (editBtn.dataset.tenantName != null && editBtn.dataset.tenantName !== '') ? editBtn.dataset.tenantName : tenantName;
            if (info && typeof initialInfoHtml !== 'undefined') {
                const editInfoHtml = '<div><strong>Nemovitost:</strong> ' + UI.esc(propName) + '</div>' +
                    '<div><strong>Nájemce (smlouva této platby):</strong> ' + UI.esc(paymentTenantName) + '</div>' +
                    '<div><strong>Období:</strong> ' + monthName + ' ' + year + '</div>';
                info.innerHTML = editInfoHtml;
            }
            editIdEl.value = payId;
            editIdEl.dataset.batchId = String(editBtn.dataset.batchId || '');
            editIdEl.dataset.originalAmount = String(editBtn.dataset.amount || '');
            editIdEl.dataset.linkedRequestIds = String(editBtn.dataset.linkedRequestIds || '');
            const periodWrap = document.getElementById('pay-modal-period-wrap');
            const periodMonthEl = document.getElementById('pay-modal-period-month');
            const periodYearEl = document.getElementById('pay-modal-period-year');
            if (periodWrap && periodMonthEl && periodYearEl) {
                periodWrap.style.display = 'block';
                const py = (editBtn.dataset.periodYear != null && editBtn.dataset.periodYear !== '') ? editBtn.dataset.periodYear : year;
                const pm = (editBtn.dataset.periodMonth != null && editBtn.dataset.periodMonth !== '') ? editBtn.dataset.periodMonth : month;
                periodYearEl.value = py;
                periodMonthEl.value = pm;
            }
            amount.value = editBtn.dataset.amount || '';
            dateInput.value = editBtn.dataset.date || new Date().toISOString().slice(0, 10);
            methodSelect.value = editBtn.dataset.method === 'cash' ? 'cash' : 'account';
            accountSelect.value = editBtn.dataset.account || '';
            accountWrap.style.display = methodSelect.value === 'account' ? 'block' : 'none';
            noteEl.value = editBtn.dataset.note ?? '';
            const counterpartInput = document.getElementById('pay-modal-counterpart-account');
            if (counterpartInput) counterpartInput.value = editBtn.dataset.counterpartAccount ?? '';
            typeSelect.value = ['rent','deposit','deposit_return','energy','other'].includes(pt) ? pt : 'rent';
            setTypeWrapClass(typeSelect.value);
            paid.checked = true;
            dateWrap.style.display = 'block';
            methodWrap.style.display = 'flex';
            batchHintEl.style.display = editBtn.dataset.batchId ? 'block' : 'none';
            bulkWrap.style.display = 'none';
            const uncheckHintEl = document.getElementById('pay-modal-uncheck-hint');
            if (uncheckHintEl) uncheckHintEl.style.display = '';
            const addLinkWrapEdit = document.querySelector('.pay-modal-add-block');
            if (addLinkWrapEdit) addLinkWrapEdit.style.display = '';
            const periodWrapEdit = document.getElementById('pay-modal-period-wrap');
            if (periodWrapEdit) periodWrapEdit.style.display = 'block';
            if (requestLinkWrap && requestLinkList) {
                requestLinkWrap.style.display = '';
                const payContractId = String(editBtn.dataset.contractsId ?? '');
                const requestsForThisContract = payContractId ? paymentRequests.filter(r => String(r.contracts_id ?? '') === payContractId) : paymentRequests;
                const showReqs = requestsForThisContract.filter(r => !r.paid_at || (r.payments_id != null && String(r.payments_id) === payId));
                const checkedIds = (editBtn.dataset.linkedRequestIds || '').split(',').map(s => s.trim()).filter(Boolean);
                renderRequestCheckboxes(showReqs, checkedIds);
            }
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
            if (propertyId) {
                payments = await Api.crudList('payments', { properties_id: propertyId });
            } else {
                payments = await Api.crudList('payments', { contracts_id: contractsId });
            }
            forMonth = payments.filter(p => effectiveMonthKey(p) === monthKey);
            renderExisting();
            await loadDashboard(parseInt(year, 10));
        } else if (addLink) {
            e.preventDefault();
            openAddForm();
        }
    };

    window._payModalOpenAddForm = openAddForm;
    const modalPaymentEl = document.getElementById('modal-payment');
    if (modalPaymentEl && !modalPaymentEl.dataset.addDelegateBound) {
        modalPaymentEl.dataset.addDelegateBound = '1';
        modalPaymentEl.addEventListener('click', function (e) {
            if (e.target.closest('[data-action="add"]')) {
                e.preventDefault();
                if (typeof window._payModalOpenAddForm === 'function') window._payModalOpenAddForm();
            }
        });
    }

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
        if (bulkCheckbox.checked) {
            if (!window._payModalSearchableMonthInited) {
                window._payModalSearchableMonthInited = true;
                if (typeof UI.createSearchableSelect === 'function') {
                    UI.createSearchableSelect('pay-modal-month-from');
                    UI.createSearchableSelect('pay-modal-month-to');
                }
                function normalizeYearInput(inputEl) {
                    const y = parseYear(inputEl.value);
                    if (!isNaN(y)) inputEl.value = String(y);
                }
                yearFromEl.addEventListener('blur', function () { normalizeYearInput(yearFromEl); });
                yearToEl.addEventListener('blur', function () { normalizeYearInput(yearToEl); });
                yearFromEl.addEventListener('change', function () { normalizeYearInput(yearFromEl); });
                yearToEl.addEventListener('change', function () { normalizeYearInput(yearToEl); });
                function yearArrowHandler(el, e) {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    e.preventDefault();
                    const delta = e.key === 'ArrowUp' ? 1 : -1;
                    let y = parseYear(el.value);
                    if (isNaN(y)) y = new Date().getFullYear();
                    el.value = String(y + delta);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
                yearFromEl.addEventListener('keydown', function (e) { yearArrowHandler(yearFromEl, e); });
                yearToEl.addEventListener('keydown', function (e) { yearArrowHandler(yearToEl, e); });
                function monthArrowHandler(selectEl, selectId, e) {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    const wrap = document.querySelector('.searchable-select-wrap[data-for="' + selectId + '"]');
                    const dropdown = wrap && wrap.querySelector('.searchable-select-dropdown');
                    if (dropdown && dropdown.classList.contains('show')) return;
                    e.preventDefault();
                    const delta = e.key === 'ArrowUp' ? 1 : -1;
                    let m = parseInt(selectEl.value, 10) || 1;
                    m += delta;
                    if (m > 12) m = 1;
                    if (m < 1) m = 12;
                    selectEl.value = String(m);
                    if (typeof UI.updateSearchableSelectDisplay === 'function') UI.updateSearchableSelectDisplay(selectId);
                    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
                const wrapFrom = document.querySelector('.searchable-select-wrap[data-for="pay-modal-month-from"]');
                const wrapTo = document.querySelector('.searchable-select-wrap[data-for="pay-modal-month-to"]');
                if (wrapFrom) wrapFrom.querySelector('.searchable-select-input').addEventListener('keydown', function (e) { monthArrowHandler(monthFromEl, 'pay-modal-month-from', e); });
                if (wrapTo) wrapTo.querySelector('.searchable-select-input').addEventListener('keydown', function (e) { monthArrowHandler(monthToEl, 'pay-modal-month-to', e); });
            }
            if (typeof UI.updateSearchableSelectDisplay === 'function') {
                UI.updateSearchableSelectDisplay('pay-modal-month-from');
                UI.updateSearchableSelectDisplay('pay-modal-month-to');
            }
            updateAmountFromRange();
            if (!amount.value) amount.value = amountVal || '';
        }
    };
    function addRangeChangeListeners() {
        [monthFromEl, yearFromEl, monthToEl, yearToEl].forEach(el => {
            if (!el) return;
            el.removeEventListener('change', _payModalRangeChange);
            el.removeEventListener('input', _payModalRangeChange);
            el.addEventListener('change', _payModalRangeChange);
            el.addEventListener('input', _payModalRangeChange);
        });
    }
    function _payModalRangeChange() {
        updateAmountFromRange();
    }
    addRangeChangeListeners();

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
                if (amt === 0) {
                    alert('Zadejte částku platby.');
                    return;
                }
                const paymentType = ['rent','deposit','deposit_return','energy','other'].includes(typeSelect.value) ? typeSelect.value : 'rent';
                const method = methodSelect.value === 'account' || methodSelect.value === 'cash' ? methodSelect.value : 'account';
                const accountId = method === 'account' ? Number(accountSelect.value || 0) : null;
                if (method === 'account' && (!accountId || accountId <= 0)) {
                    alert('Vyberte bankovní účet.');
                    return;
                }
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
                    const periodMonthEl = document.getElementById('pay-modal-period-month');
                    const periodYearEl = document.getElementById('pay-modal-period-year');
                    let editPeriodYear = parseInt(year, 10);
                    let editPeriodMonth = parseInt(month, 10);
                    if (periodYearEl && periodMonthEl && periodYearEl.value.trim() !== '' && periodMonthEl.value) {
                        const y = parseInt(periodYearEl.value.trim(), 10);
                        const m = parseInt(periodMonthEl.value, 10);
                        if (!isNaN(y) && y >= 2000 && y <= 2100 && !isNaN(m) && m >= 1 && m <= 12) {
                            editPeriodYear = y;
                            editPeriodMonth = m;
                        }
                    }
                    const payData = {
                        contracts_id: parseInt(contractsId, 10),
                        period_year: editPeriodYear,
                        period_month: editPeriodMonth,
                        amount: amt,
                        payment_date: dateInput.value,
                        payment_method: method,
                        bank_accounts_id: accountId || null,
                        payment_type: paymentType,
                        note: (noteEl.value || '').trim() || null,
                    };
                    await Api.crudEdit('payments', parseInt(editId, 10), payData);
                    const oldIdsStr = editIdEl.dataset.linkedRequestIds || '';
                    const oldIds = new Set(oldIdsStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)));
                    const newIds = getCheckedRequestIds();
                    const toUnlink = [...oldIds].filter(id => !newIds.includes(id));
                    const toLink = newIds.filter(id => !oldIds.has(id));
                    for (const id of toUnlink) await Api.paymentRequestUnlink(id);
                    const payEntityId = parseInt(editId, 10);
                    for (const id of toLink) await Api.paymentRequestLink(id, payEntityId);
                } else {
                    const bulk = bulkCheckbox.checked;
                    const counterpartEl = document.getElementById('pay-modal-counterpart-account');
                    const payData = {
                        contracts_id: parseInt(contractsId, 10),
                        amount: amt,
                        payment_date: dateInput.value,
                        payment_method: method,
                        bank_accounts_id: accountId || null,
                        payment_type: paymentType,
                        note: (noteEl.value || '').trim() || null,
                        counterpart_account: counterpartEl && (counterpartEl.value || '').trim() ? counterpartEl.value.trim() : null,
                    };
                    if (bulk) {
                        const yFrom = parseYear(yearFromEl.value);
                        const mFrom = parseMonth(monthFromEl.value);
                        const yTo = parseYear(yearToEl.value);
                        const mTo = parseMonth(monthToEl.value);
                        if (isNaN(yFrom) || isNaN(mFrom) || isNaN(yTo) || isNaN(mTo)) {
                            alert('Zadejte platný rozsah: měsíc 1–12, rok např. 26 nebo 2026.');
                            return;
                        }
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
                    const checkedIds = getCheckedRequestIds();
                    if (checkedIds.length) payData.payment_request_ids = checkedIds;
                    await Api.crudAdd('payments', payData);
                }
            } else {
                if (batchId) {
                    const batchCount = payments.filter(x => x.payment_batch_id === batchId).length;
                    const msg = batchCount === 1 ? 'Opravdu smazat tuto platbu?' : 'Opravdu smazat celou dávku? (' + batchCount + ' plateb)';
                    if (!confirm(msg)) return;
                    await Api.paymentsDeleteBatch(batchId);
                } else {
                    const toDelete = forMonth.filter(p => effectiveMonthKey(p) === monthKey);
                    const platLabel = toDelete.length === 1 ? '1 platba' : (toDelete.length >= 2 && toDelete.length <= 4 ? toDelete.length + ' platby' : toDelete.length + ' plateb');
                    if (!confirm('Opravdu smazat všechny platby za tento měsíc? (' + platLabel + ')')) return;
                    for (const p of toDelete) {
                        await Api.crudDelete('payments', p.payments_id ?? p.id);
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
        const propertyId = plus.dataset.propertyId ? parseInt(plus.dataset.propertyId, 10) : null;
        if (plus.dataset.paymentRequestId) {
            const amount = parseFloat(plus.dataset.amount) || 0;
            const requestType = plus.dataset.requestType || 'energy';
            const requestId = parseInt(plus.dataset.paymentRequestId, 10);
            const tenant = plus.dataset.tenant || '';
            const property = plus.dataset.property || '';
            const dueDate = plus.dataset.dueDate || '';
            DashboardView.quickPayFromRequest(contractsId, propertyId, amount, requestType, requestId, tenant, property, dueDate);
        } else {
            const year = parseInt(plus.dataset.year, 10);
            const month = parseInt(plus.dataset.month, 10);
            const rent = parseFloat(plus.dataset.rent) || 0;
            const tenant = plus.dataset.tenant || '';
            const property = plus.dataset.property || '';
            DashboardView.quickPay(contractsId, propertyId, year, month, rent, tenant, property);
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
    async quickPay(contractsId, propertyId, year, month, rent, tenantName, propertyName) {
        const monthKey = year + '-' + String(month).padStart(2, '0');
        const fakeEl = document.createElement('div');
        fakeEl.dataset.contractId = String(contractsId);
        fakeEl.dataset.contractsId = String(contractsId);
        if (propertyId) fakeEl.dataset.propertyId = String(propertyId);
        fakeEl.dataset.monthKey = monthKey;
        fakeEl.dataset.amount = String(rent);
        fakeEl.dataset.tenant = tenantName || '';
        fakeEl.dataset.paid = '0';
        fakeEl.dataset.paymentDate = new Date().toISOString().slice(0, 10);
        fakeEl.dataset.paymentAmount = '0';
        fakeEl.dataset.remaining = String(rent);
        fakeEl.dataset.remainingRent = String(rent);
        fakeEl.dataset.propertyName = propertyName || '';
        fakeEl.dataset.forceAddNew = '1'; // vždy otevřít režim „Přidat platbu“, ne úpravu jediné
        await openPaymentModal(fakeEl);
    },
    async quickPayFromRequest(contractsId, propertyId, amount, requestType, requestId, tenantName, propertyName, dueDateStr) {
        const now = new Date();
        let year, month, paymentDate;
        if (dueDateStr && /^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) {
            const [y, m] = dueDateStr.split('-').map(Number);
            year = y;
            month = m;
            paymentDate = dueDateStr;
        } else {
            year = now.getFullYear();
            month = now.getMonth() + 1;
            paymentDate = now.toISOString().slice(0, 10);
        }
        const monthKey = year + '-' + String(month).padStart(2, '0');
        const fakeEl = document.createElement('div');
        fakeEl.dataset.contractId = String(contractsId);
        fakeEl.dataset.contractsId = String(contractsId);
        if (propertyId) fakeEl.dataset.propertyId = String(propertyId);
        fakeEl.dataset.monthKey = monthKey;
        fakeEl.dataset.amount = String(amount);
        fakeEl.dataset.tenant = tenantName || '';
        fakeEl.dataset.paid = '0';
        fakeEl.dataset.paymentDate = paymentDate;
        fakeEl.dataset.paymentAmount = '0';
        fakeEl.dataset.remaining = String(amount);
        fakeEl.dataset.propertyName = propertyName || '';
        fakeEl.dataset.paymentRequestId = String(requestId);
        fakeEl.dataset.requestType = requestType || 'energy';
        await openPaymentModal(fakeEl);
    },
};
window.DashboardView = DashboardView;
