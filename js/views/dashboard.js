// js/views/dashboard.js

const MONTH_NAMES = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];

App.registerView('dashboard', async () => {
    const yearSelect = document.getElementById('dash-year');
    const year = yearSelect ? parseInt(yearSelect.value, 10) || new Date().getFullYear() : new Date().getFullYear();

    let data;
    try { data = await Api.dashboardLoad(year); }
    catch (e) { return; }

    const { contracts, properties, heatmap, stats, monthNames } = data;
    const months = monthNames || MONTH_NAMES;

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

    // ── Year selector ───────────────────────────────────────────────────
    if (yearSelect) {
        const nowY = new Date().getFullYear();
        let opts = '';
        for (let y = nowY - 2; y <= nowY + 1; y++) {
            opts += '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>';
        }
        yearSelect.innerHTML = opts;
        yearSelect.onchange = () => App.navigate('dashboard', true);
    }

    // ── Heatmap ─────────────────────────────────────────────────────────
    const heatmapEl = document.getElementById('dash-heatmap');
    if (heatmapEl && properties && properties.length) {
        let ths = '<th class="heatmap-property">Nemovitost</th>';
        for (let m = 1; m <= 12; m++) {
            const label = months[m - 1] ? (months[m - 1] + '\n' + m) : m;
            ths += '<th>' + label.replace('\n', '<br>') + '</th>';
        }

        let rows = '';
        properties.forEach(prop => {
            rows += '<tr><td class="heatmap-property">' + UI.esc(prop.name) + '</td>';
            for (let m = 1; m <= 12; m++) {
                const monthKey = year + '-' + String(m).padStart(2, '0');
                const key = prop.id + '_' + monthKey;
                const cell = heatmap[key] || { type: 'empty', monthKey };

                let cls = 'heatmap-cell ' + (cell.type || 'empty');
                let content = '';
                if (cell.type === 'empty') {
                    content = 'Volno';
                } else if (cell.type === 'paid') {
                    content = '<span class="cell-amount">' + UI.fmt(cell.amount || 0) + '</span><br><span class="cell-icon cell-check">✓</span>';
                } else {
                    content = '<span class="cell-amount">' + UI.fmt(cell.amount || 0) + '</span><br><span class="cell-icon cell-cross">✗</span>';
                }

                const dataAttrs = cell.type !== 'empty'
                    ? ' data-contract-id="' + cell.contract.id + '" data-month-key="' + cell.monthKey + '" data-amount="' + (cell.amount || 0) + '" data-tenant="' + (cell.contract.tenant_name || '').replace(/"/g, '&quot;') + '" data-paid="' + (cell.type === 'paid' ? '1' : '0') + '" data-payment-date="' + (cell.payment && cell.payment.date ? cell.payment.date : '') + '" data-payment-amount="' + (cell.payment && cell.payment.amount ? cell.payment.amount : '') + '"'
                    : ' data-property-id="' + prop.id + '" data-month-key="' + monthKey + '"';

                const onClick = cell.type === 'empty'
                    ? 'DashboardView.openNewContract(this)'
                    : 'DashboardView.openPaymentModal(this)';

                rows += '<td><div class="' + cls + '"' + dataAttrs + ' onclick="' + onClick + '">' + content + '</div></td>';
            }
            rows += '</tr>';
        });

        heatmapEl.innerHTML = '<table class="heatmap-table"><thead><tr>' + ths + '</tr></thead><tbody>' + rows + '</tbody></table>';
    } else if (heatmapEl) {
        heatmapEl.innerHTML = '<div class="empty">Žádné nemovitosti. Přidejte nemovitost v sekci Nemovitosti.</div>';
    }

    // ── Table (přehled smluv) ───────────────────────────────────────────
    if (!contracts || !contracts.length) {
        document.getElementById('dash-table').innerHTML =
            '<div class="empty">Žádné aktivní smlouvy.<br>Začněte přidáním nemovitosti a nájemníka, nebo klikněte na "Volno" v kalendáři.</div>';
        return;
    }

    contracts.forEach(d => { d._rowClass = d.balance > 0 ? 'row-warn' : ''; });

    UI.renderTable('dash-table',
        [
            { label: 'Nájemník' },
            { label: 'Nemovitost' },
            { label: 'Nájemné / měs.' },
            { label: 'Uhrazeno / Očekáváno' },
            { label: 'Stav' },
            { label: 'Neuhrazené měsíce' },
            { label: 'Akce', act: true },
        ],
        contracts,
        (d) => {
            const pct = d.expected_total > 0 ? Math.min(100, (d.total_paid / d.expected_total) * 100) : 100;
            const hasDbt = d.balance > 0;

            let tags = '';
            (d.unpaid_months || []).forEach(u => {
                tags += '<span class="tag">' + u.month + '/' + u.year +
                    ' <span class="tag-plus" onclick="DashboardView.quickPay(' + d.contract_id + ',' + u.year + ',' + u.month + ',' + d.monthly_rent + ')" title="Přidat platbu">+</span></span>';
            });

            return (
                '<td><strong>' + UI.esc(d.tenant_name) + '</strong></td>' +
                '<td>' + UI.esc(d.property_name) + '</td>' +
                '<td>' + UI.fmt(d.monthly_rent) + ' Kč</td>' +
                '<td><div class="prog-wrap"><div class="prog-bar"><div class="prog-fill ' + (hasDbt ? 'bad' : 'ok') + '" style="width:' + Math.round(pct) + '%"></div></div>' +
                '<span class="prog-lbl">' + UI.fmt(d.total_paid) + ' / ' + UI.fmt(d.expected_total) + ' Kč</span></div></td>' +
                '<td><span class="badge ' + (hasDbt ? 'badge-danger' : 'badge-ok') + '">' + (hasDbt ? 'Má dluh' : 'V pořádku') + '</span></td>' +
                '<td>' + (tags || '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td class="td-act"><button class="btn btn-ghost btn-sm" onclick="PaymentsView.navigateWithFilter(' + d.contract_id + ')">Platby</button></td>'
            );
        },
        { emptyMsg: 'Žádné aktivní smlouvy.' }
    );
});

// ── PaymentModal ─────────────────────────────────────────────────────────
function openPaymentModal(el) {
    const contractId = el.dataset.contractId;
    const monthKey = el.dataset.monthKey;
    const amountVal = parseFloat(el.dataset.amount) || 0;
    const tenantName = el.dataset.tenant || '';
    const isPaid = el.dataset.paid === '1';
    const paymentDate = el.dataset.paymentDate || new Date().toISOString().slice(0, 10);
    const paymentAmount = el.dataset.paymentAmount ? parseFloat(el.dataset.paymentAmount) : amountVal;

    const info = document.getElementById('pay-modal-info');
    const amount = document.getElementById('pay-modal-amount');
    const paid = document.getElementById('pay-modal-paid');
    const dateWrap = document.getElementById('pay-modal-date-wrap');
    const dateInput = document.getElementById('pay-modal-date');

    document.getElementById('pay-modal-contract-id').value = contractId;
    document.getElementById('pay-modal-month-key').value = monthKey;

    paid.checked = isPaid;
    amount.value = isPaid ? paymentAmount : amountVal;
    dateInput.value = paymentDate;
    dateWrap.style.display = isPaid ? 'block' : 'none';

    const [y, m] = monthKey.split('-');
    const monthName = MONTH_NAMES[parseInt(m, 10) - 1] || m;
    const propName = el.closest('tr').querySelector('.heatmap-property').textContent;
    info.innerHTML = '<div><strong>Nemovitost:</strong> ' + UI.esc(propName) + '</div>' +
        '<div><strong>Nájemce:</strong> ' + UI.esc(tenantName) + '</div>' +
        '<div><strong>Období:</strong> ' + monthName + ' ' + y + '</div>';

    paid.onchange = () => { dateWrap.style.display = paid.checked ? 'block' : 'none'; };

    document.getElementById('btn-pay-modal-save').onclick = async () => {
        try {
            const [year, month] = monthKey.split('-');
            if (paid.checked) {
                const payments = await Api.crudList('payments', { contract_id: contractId });
                const existing = payments.find(x => String(x.period_year) === year && String(x.period_month) === month);
                const payload = {
                    contract_id: parseInt(contractId, 10),
                    period_year: parseInt(year, 10),
                    period_month: parseInt(month, 10),
                    amount: parseFloat(amount.value) || amountVal,
                    payment_date: dateInput.value,
                };
                if (existing) {
                    await Api.crudEdit('payments', existing.id, payload);
                } else {
                    await Api.crudAdd('payments', payload);
                }
            } else {
                const payments = await Api.crudList('payments', { contract_id: contractId });
                const p = payments.find(x => String(x.period_year) === year && String(x.period_month) === month);
                if (p) await Api.crudDelete('payments', p.id);
            }
            UI.modalClose('modal-payment');
            App.navigateWithHistory('dashboard');
        } catch (e) {
            alert(e.message);
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

const DashboardView = {
    openPaymentModal,
    openNewContract,
    async quickPay(contractId, year, month, rent) {
        await App.navigateWithHistory('payments');
        PaymentsView.prefill(contractId, year, month, rent);
    }
};
