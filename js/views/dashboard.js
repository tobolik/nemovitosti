// js/views/dashboard.js

const MONTH_NAMES = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];

async function loadDashboard(year) {
    const yearSelect = document.getElementById('dash-year');
    const currentYear = new Date().getFullYear();
    const activeBtn = yearSelect && yearSelect.querySelector('.heatmap-year-btn.active');
    const fromSelect = activeBtn ? parseInt(activeBtn.dataset.year, 10) : NaN;
    const y = (year != null && !isNaN(year)) ? year : (!isNaN(fromSelect) ? fromSelect : currentYear);

    let data;
    try { data = await Api.dashboardLoad(y); }
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

    // ── Year selector (tlačítka) ─────────────────────────────────────────
    if (yearSelect) {
        const nowY = new Date().getFullYear();
        let btns = '';
        for (let yr = nowY - 2; yr <= nowY + 1; yr++) {
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

        let rows = '';
        properties.forEach(prop => {
            rows += '<tr><td class="heatmap-property">' + UI.esc(prop.name) + '</td>';
            for (let m = 1; m <= 12; m++) {
                const monthKey = y + '-' + String(m).padStart(2, '0');
                const key = prop.id + '_' + monthKey;
                const cell = heatmap[key] || { type: 'empty', monthKey };

                const paidAmt = cell.paid_amount ?? (cell.payment && cell.payment.amount ? cell.payment.amount : 0);
                const paymentCount = cell.payment_count ?? (cell.payment && cell.payment.count ? cell.payment.count : 0);
                const remaining = cell.remaining ?? (cell.amount ? Math.max(0, cell.amount - paidAmt) : 0);
                const isPaid = cell.type === 'exact' || cell.type === 'overpaid';

                let cls = 'heatmap-cell ' + (cell.type || 'empty');
                let content = '';
                if (cell.type === 'empty') {
                    content = 'Volno';
                } else if (cell.type === 'exact' || cell.type === 'overpaid') {
                    const sumLabel = paymentCount > 1 ? UI.fmt(paidAmt) + ' (' + paymentCount + ' platby)' : UI.fmt(paidAmt);
                    content = '<span class="cell-amount">' + sumLabel + '</span><br><span class="cell-icon cell-check">✓</span>';
                } else if (paidAmt > 0 && remaining > 0) {
                    const partialLabel = paymentCount > 1 ? UI.fmt(paidAmt) + ' (' + paymentCount + ' platby) / ' : UI.fmt(paidAmt) + ' / ';
                    content = '<span class="cell-partial">' + partialLabel + UI.fmt(cell.amount || 0) + '</span><br><span class="cell-remaining">zbývá ' + UI.fmt(remaining) + '</span>';
                } else {
                    content = '<span class="cell-amount">' + UI.fmt(cell.amount || 0) + '</span><br><span class="cell-icon cell-cross">✗</span>';
                }

                const dataAttrs = cell.type !== 'empty'
                    ? ' data-contract-id="' + cell.contract.id + '" data-contracts-id="' + (cell.contract.contracts_id ?? cell.contract.id) + '" data-month-key="' + cell.monthKey + '" data-amount="' + (cell.amount || 0) + '" data-tenant="' + (cell.contract.tenant_name || '').replace(/"/g, '&quot;') + '" data-paid="' + (isPaid ? '1' : '0') + '" data-payment-date="' + (cell.payment && cell.payment.date ? cell.payment.date : '') + '" data-payment-amount="' + paidAmt + '" data-remaining="' + remaining + '"'
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
        heatmapEl.innerHTML = '<div class="empty">Žádné nemovitosti. Přidejte nemovitost v sekci <a href="#properties">Nemovitosti</a>.</div>';
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
                    ' <span class="tag-plus" onclick="DashboardView.quickPay(' + d.contracts_id + ',' + u.year + ',' + u.month + ',' + d.monthly_rent + ')" title="Přidat platbu">+</span></span>';
            });

            return (
                '<td><strong>' + UI.esc(d.tenant_name) + '</strong></td>' +
                '<td>' + UI.esc(d.property_name) + '</td>' +
                '<td>' + UI.fmt(d.monthly_rent) + ' Kč</td>' +
                '<td><div class="prog-wrap"><div class="prog-bar"><div class="prog-fill ' + (hasDbt ? 'bad' : 'ok') + '" style="width:' + Math.round(pct) + '%"></div></div>' +
                '<span class="prog-lbl">' + UI.fmt(d.total_paid) + ' / ' + UI.fmt(d.expected_total) + ' Kč</span></div></td>' +
                '<td><span class="badge ' + (hasDbt ? 'badge-danger' : 'badge-ok') + '">' + (hasDbt ? 'Má dluh' : 'V pořádku') + '</span></td>' +
                '<td>' + (tags || '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td class="td-act"><button class="btn btn-ghost btn-sm" onclick="PaymentsView.navigateWithFilter(' + d.contracts_id + ')">Platby</button></td>'
            );
        },
        { emptyMsg: 'Žádné aktivní smlouvy.' }
    );
}

App.registerView('dashboard', () => loadDashboard());

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
    const propName = el.closest('tr').querySelector('.heatmap-property').textContent;

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
    const editIdEl = document.getElementById('pay-modal-edit-id');

    const bankAccounts = await Api.crudList('bank_accounts');
    const primaryAccount = bankAccounts.find(b => b.is_primary);
    const defaultAccNum = primaryAccount ? primaryAccount.account_number : '';
    accountSelect.innerHTML = '<option value="">— Vyberte účet —</option>' +
        bankAccounts.map(b =>
            '<option value="' + UI.esc(b.account_number || '') + '"' + (b.account_number === defaultAccNum ? ' selected' : '') + '>' +
                UI.esc(b.name) + (b.account_number ? ' – ' + UI.esc(b.account_number) : '') +
            '</option>'
        ).join('');

    document.getElementById('pay-modal-contract-id').value = contractId;
    document.getElementById('pay-modal-month-key').value = monthKey;
    editIdEl.value = '';

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

    paid.checked = isPaid;
    amount.value = isPaid ? amountVal : remaining;
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
            const acc = (p.account_number || '').replace(/"/g, '&quot;');
            html += '<li class="pay-modal-existing-item">' +
                '<span>' + amt + ' Kč (' + dt + ')</span> ' +
                '<button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="' + p.id + '" data-amount="' + (p.amount ?? 0) + '" data-date="' + (p.payment_date || '') + '" data-method="' + method + '" data-account="' + acc + '">Upravit</button> ' +
                '<button type="button" class="btn btn-ghost btn-sm" data-action="delete" data-id="' + p.id + '">Smazat</button>' +
                '</li>';
        });
        html += '</ul><div class="pay-modal-add-link"><a href="#" data-action="add">+ Přidat novou platbu</a></div>';
        existingWrap.innerHTML = html;
    }
    renderExisting();

    existingWrap.onclick = async (e) => {
        const editBtn = e.target.closest('[data-action="edit"]');
        const delBtn = e.target.closest('[data-action="delete"]');
        const addLink = e.target.closest('[data-action="add"]');
        if (editBtn) {
            editIdEl.value = editBtn.dataset.id;
            amount.value = editBtn.dataset.amount || '';
            dateInput.value = editBtn.dataset.date || new Date().toISOString().slice(0, 10);
            methodSelect.value = editBtn.dataset.method === 'cash' ? 'cash' : 'account';
            accountSelect.value = editBtn.dataset.account || '';
            accountWrap.style.display = methodSelect.value === 'account' ? 'block' : 'none';
            paid.checked = true;
            dateWrap.style.display = 'block';
            methodWrap.style.display = 'flex';
        } else if (delBtn) {
            try {
                await Api.crudDelete('payments', parseInt(delBtn.dataset.id, 10));
                payments = await Api.crudList('payments', { contracts_id: contractsId });
                forMonth = payments.filter(x => String(x.period_year) === year && String(x.period_month).padStart(2, '0') === month);
                renderExisting();
                await loadDashboard(parseInt(year, 10));
            } catch (err) { alert(err.message); }
        } else if (addLink) {
            e.preventDefault();
            editIdEl.value = '';
            amount.value = remaining;
            paid.checked = false;
            dateWrap.style.display = 'none';
            methodWrap.style.display = 'none';
        }
    };

    paid.onchange = () => {
        dateWrap.style.display = paid.checked ? 'block' : 'none';
        methodWrap.style.display = paid.checked ? 'flex' : 'none';
    };
    methodSelect.onchange = () => {
        accountWrap.style.display = methodSelect.value === 'account' ? 'block' : 'none';
    };

    document.getElementById('btn-pay-modal-save').onclick = async () => {
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
                const editId = editIdEl.value.trim();
                const method = methodSelect.value === 'account' || methodSelect.value === 'cash' ? methodSelect.value : 'account';
                const accountNum = method === 'account' ? (accountSelect.value || '').trim() : null;
                const payData = {
                    contracts_id: parseInt(contractsId, 10),
                    period_year: parseInt(year, 10),
                    period_month: parseInt(month, 10),
                    amount: amt,
                    payment_date: dateInput.value,
                    payment_method: method,
                    account_number: accountNum || null,
                };
                if (editId) {
                    await Api.crudEdit('payments', parseInt(editId, 10), payData);
                } else {
                    await Api.crudAdd('payments', payData);
                }
            } else {
                for (const p of forMonth) {
                    await Api.crudDelete('payments', p.id);
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

const DashboardView = {
    openPaymentModal,
    openNewContract,
    async quickPay(contractId, year, month, rent) {
        await App.navigateWithHistory('payments');
        PaymentsView.prefill(contractId, year, month, rent);
    }
};
window.DashboardView = DashboardView;
