// js/views/payment_imports.js – Kontrola importů z FIO, párování a hromadné schválení

const PaymentImportsView = (() => {
    let _cache = [];
    let _contracts = [];
    let _bankAccounts = [];

    async function loadContractsAndBanks() {
        [_contracts, _bankAccounts] = await Promise.all([
            Api.crudList('contracts'),
            Api.crudList('bank_accounts'),
        ]);
    }

    function fillFilterDropdowns() {
        const accSel = document.getElementById('import-filter-account');
        if (!accSel) return;
        accSel.innerHTML = '<option value="">— Všechny —</option>' +
            (_bankAccounts || []).map(b => {
                const id = b.bank_accounts_id ?? b.id;
                return '<option value="' + id + '">' + UI.esc(b.name) + (b.account_number ? ' – ' + UI.esc(b.account_number) : '') + '</option>';
            }).join('');
        const fromEl = document.getElementById('import-filter-from');
        const toEl = document.getElementById('import-filter-to');
        if (fromEl && toEl && !fromEl.value) {
            const now = new Date();
            fromEl.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
            toEl.value = now.toISOString().slice(0, 10);
        }
    }

    function getFilterParams() {
        const status = document.getElementById('import-filter-status');
        const acc = document.getElementById('import-filter-account');
        const from = document.getElementById('import-filter-from');
        const to = document.getElementById('import-filter-to');
        const onlyMatchingEl = document.getElementById('import-filter-only-matching');
        const params = {
            bank_accounts_id: acc && acc.value ? parseInt(acc.value, 10) : undefined,
            from: from && from.value ? from.value : undefined,
            to: to && to.value ? to.value : undefined,
            only_matching_counterpart: onlyMatchingEl ? onlyMatchingEl.checked : true,
        };
        if (status && status.value === 'to_review') params.to_review = true;
        if (status && status.value === 'history') params.history = true;
        if (params.only_matching_counterpart === false) params.only_matching_counterpart = false;
        return params;
    }

    function monthOptions(selected) {
        const labels = ['', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
        let html = '<option value="">—</option>';
        for (let m = 1; m <= 12; m++) {
            html += '<option value="' + m + '"' + (selected === m ? ' selected' : '') + '>' + labels[m] + '</option>';
        }
        return html;
    }

    function yearOptions(selected) {
        const now = new Date().getFullYear();
        let html = '<option value="">—</option>';
        for (let y = now; y >= now - 15; y--) {
            html += '<option value="' + y + '"' + (selected === y ? ' selected' : '') + '>' + y + '</option>';
        }
        return html;
    }

    function typeOptions(selected) {
        const types = [{ v: 'rent', l: 'Nájem' }, { v: 'deposit', l: 'Kauce' }, { v: 'deposit_return', l: 'Vrácení kauce' }, { v: 'energy', l: 'Energie' }, { v: 'other', l: 'Jiné' }];
        return '<option value=""' + (selected === '' || selected === null || selected === undefined ? ' selected' : '') + '>—</option>' +
            types.map(t => '<option value="' + t.v + '"' + (selected === t.v ? ' selected' : '') + '>' + t.l + '</option>').join('');
    }

    function contractOptions(selected) {
        const cid = (c) => c.contracts_id ?? c.id;
        return '<option value="">— Smlouva —</option>' +
            (_contracts || []).map(c => '<option value="' + cid(c) + '"' + (String(selected) === String(cid(c)) ? ' selected' : '') + '>' + UI.esc(c.tenant_name) + ' – ' + UI.esc(c.property_name) + '</option>').join('');
    }

    function updateApproveButton() {
        const btn = document.getElementById('import-approve-btn');
        if (!btn) return;
        const checked = document.querySelectorAll('#import-tbody input.import-cb:checked');
        const ready = Array.from(checked).filter(cb => {
            const id = cb.getAttribute('data-id');
            const row = _cache.find(r => String(r.id) === String(id));
            return row && !row.approved_at && !row.overpayment && row.contracts_id && row.period_year && row.period_month && row.payment_type;
        });
        btn.disabled = ready.length === 0;
        btn.textContent = ready.length > 0 ? 'Hromadně schválit vybrané (' + ready.length + ')' : 'Hromadně schválit vybrané';
    }

    function currencyLabel(code) {
        const c = (code || 'CZK').toString().toUpperCase();
        return c === 'CZK' ? 'Kč' : c;
    }
    function renderRow(imp) {
        const id = imp.id;
        const isProcessed = !!imp.approved_at;
        const paired = !!(imp.contracts_id && imp.period_year && imp.period_month && imp.payment_type);
        const contractSel = '<select class="import-contract" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + contractOptions(imp.contracts_id) + '</select>';
        const yearFrom = '<select class="import-year-from" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + yearOptions(imp.period_year) + '</select>';
        const monthFrom = '<select class="import-month-from" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + monthOptions(imp.period_month) + '</select>';
        const yearTo = '<select class="import-year-to" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + yearOptions(imp.period_year_to) + '</select>';
        const monthTo = '<select class="import-month-to" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + monthOptions(imp.period_month_to) + '</select>';
        let statusCell = '—';
        if (isProcessed && imp.payments_id) {
            statusCell = '<span class="badge badge-ok" title="Zpracováno">✓</span> <a href="#payments" class="import-link-payment" title="Platba z tohoto importu">→ Platba</a>';
        } else if (isProcessed) {
            statusCell = '<span class="badge badge-ok" title="Zpracováno">✓</span>';
        } else if (imp.overpayment) {
            statusCell = '<span class="badge badge-warn" title="Pro toto období a smlouvu již platba existuje (převyplnění)">Převyplnění</span>';
        }
        const curr = currencyLabel(imp.currency);
        const counterpartFull = imp.counterpart_account || '';
        const noteFull = imp.note || '';
        const shodaCell = imp.counterpart_matches === true
            ? '<span class="badge badge-ok" title="Protiúčet odpovídá účtu nájemce">✓</span>'
            : imp.counterpart_matches === false
                ? '<span class="badge badge-warn" title="Protiúčet neodpovídá žádnému číslu účtu nájemce">Nesedí</span>'
                : '—';
        return '<tr data-id="' + id + '"' + (isProcessed ? ' class="import-row-processed"' : '') + '>' +
            '<td><input type="checkbox" class="import-cb" data-id="' + id + '"' + (isProcessed ? ' disabled' : imp.overpayment ? ' disabled title="Převyplnění – platba pro toto období již existuje"' : (paired ? '' : ' disabled title="Vyplňte smlouvu, období a typ platby"')) + '></td>' +
            '<td class="col-status">' + statusCell + '</td>' +
            '<td>' + (imp.payment_date ? UI.fmtDate(imp.payment_date) : '—') + '</td>' +
            '<td class="col-amount">' + UI.fmt(imp.amount) + ' ' + UI.esc(curr) + '</td>' +
            '<td class="col-hide-mobile">' + UI.esc((imp.currency || 'CZK').toString().toUpperCase()) + '</td>' +
            '<td class="col-note cell-note-wrap"><span class="cell-note-truncate" title="' + UI.esc(counterpartFull) + '">' + UI.esc(counterpartFull || '—') + '</span></td>' +
            '<td class="col-note cell-note-wrap col-hide-mobile"><span class="cell-note-truncate" title="' + UI.esc(noteFull) + '">' + UI.esc(noteFull || '—') + '</span></td>' +
            '<td class="col-shoda">' + shodaCell + '</td>' +
            '<td class="import-cell-contract">' + contractSel + '</td>' +
            '<td><span class="import-period-from">' + yearFrom + ' ' + monthFrom + '</span></td>' +
            '<td><span class="import-period-to">' + yearTo + ' ' + monthTo + '</span></td>' +
            '<td><select class="import-type" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + typeOptions(imp.payment_type || '') + '</select></td>' +
            '<td class="td-act">' + (isProcessed ? '' : '<button type="button" class="btn btn-ghost btn-sm import-del" data-id="' + id + '">Smazat</button>') + '</td>' +
            '</tr>';
    }

    async function loadList() {
        const params = getFilterParams();
        try {
            _cache = await Api.paymentImportsList(params);
        } catch (e) {
            _cache = [];
        }
        const tbody = document.getElementById('import-tbody');
        const emptyEl = document.getElementById('import-empty');
        const wrap = document.getElementById('import-table-wrap');
        if (!_cache.length) {
            if (tbody) tbody.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            if (wrap) wrap.style.display = 'none';
            updateApproveButton();
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (wrap) wrap.style.display = 'block';
        tbody.innerHTML = _cache.map(imp => renderRow(imp)).join('');

        tbody.querySelectorAll('.import-contract').forEach(el => {
            el.addEventListener('change', () => savePairing(parseInt(el.getAttribute('data-id'), 10), 'contracts_id', el.value));
        });
        tbody.querySelectorAll('.import-year-from, .import-month-from').forEach(el => {
            el.addEventListener('change', () => {
                const id = parseInt(el.getAttribute('data-id'), 10);
                const y = document.querySelector('.import-year-from[data-id="' + id + '"]');
                const m = document.querySelector('.import-month-from[data-id="' + id + '"]');
                savePairing(id, 'period', { period_year: y ? y.value : '', period_month: m ? m.value : '' });
            });
        });
        tbody.querySelectorAll('.import-year-to, .import-month-to').forEach(el => {
            el.addEventListener('change', () => {
                const id = parseInt(el.getAttribute('data-id'), 10);
                const y = document.querySelector('.import-year-to[data-id="' + id + '"]');
                const m = document.querySelector('.import-month-to[data-id="' + id + '"]');
                savePairing(id, 'period_to', { period_year_to: y ? y.value : '', period_month_to: m ? m.value : '' });
            });
        });
        tbody.querySelectorAll('.import-type').forEach(el => {
            el.addEventListener('change', () => savePairing(parseInt(el.getAttribute('data-id'), 10), 'payment_type', el.value));
        });
        tbody.querySelectorAll('.import-cb').forEach(el => {
            el.addEventListener('change', updateApproveButton);
        });
        tbody.querySelectorAll('.import-del').forEach(el => {
            el.addEventListener('click', () => deleteOne(parseInt(el.getAttribute('data-id'), 10)));
        });

        const selectAllEl = document.getElementById('import-select-all');
        if (selectAllEl && !selectAllEl.dataset.bound) {
            selectAllEl.dataset.bound = '1';
            selectAllEl.addEventListener('change', function () {
                document.querySelectorAll('#import-tbody .import-cb:not(:disabled)').forEach(cb => { cb.checked = this.checked; });
                updateApproveButton();
            });
        }
        updateApproveButton();
    }

    async function savePairing(id, field, value) {
        const row = _cache.find(r => r.id === id);
        if (!row) return;
        let data = {};
        if (field === 'contracts_id') data = { contracts_id: value ? parseInt(value, 10) : null };
        else if (field === 'period') data = { period_year: value.period_year ? parseInt(value.period_year, 10) : null, period_month: value.period_month ? parseInt(value.period_month, 10) : null };
        else if (field === 'period_to') data = { period_year_to: value.period_year_to ? parseInt(value.period_year_to, 10) : null, period_month_to: value.period_month_to ? parseInt(value.period_month_to, 10) : null };
        else if (field === 'payment_type') data = { payment_type: value };
        try {
            await Api.paymentImportEdit(id, data);
            Object.assign(row, data);
            const cb = document.querySelector('.import-cb[data-id="' + id + '"]');
            if (cb) {
                const paired = !!(row.contracts_id && row.period_year && row.period_month);
                cb.disabled = !paired;
                cb.title = paired ? '' : 'Nejprve napárujte smlouvu a období';
            }
            updateApproveButton();
        } catch (e) {
            UI.alertShow('import-alert', e.message || 'Uložení se nezdařilo.');
        }
    }

    async function deleteOne(id) {
        if (!confirm('Smazat tento import?')) return;
        try {
            await Api.paymentImportDelete(id);
            _cache = _cache.filter(r => r.id !== id);
            await loadList();
        } catch (e) {
            UI.alertShow('import-alert', e.message || 'Smazání se nezdařilo.');
        }
    }

    async function approveSelected() {
        const checked = document.querySelectorAll('#import-tbody input.import-cb:checked');
        const ids = Array.from(checked).map(cb => parseInt(cb.getAttribute('data-id'), 10));
        const ready = ids.filter(id => {
            const row = _cache.find(r => r.id === id);
            return row && row.contracts_id && row.period_year && row.period_month;
        });
        if (ready.length === 0) return;
        try {
            const res = await Api.paymentImportsApprove(ready);
            UI.alertShow('import-alert', 'Schváleno ' + (res.approved || 0) + ' importů, vytvořeno ' + (res.created || 0) + ' plateb.' + (res.errors && res.errors.length ? ' Chyby: ' + res.errors.join(' ') : ''), 'ok');
            await loadList();
        } catch (e) {
            UI.alertShow('import-alert', e.message || 'Schválení se nezdařilo.');
        }
    }

    async function load() {
        await loadContractsAndBanks();
        fillFilterDropdowns();
        document.getElementById('import-filter-btn').addEventListener('click', loadList);
        document.getElementById('import-approve-btn').addEventListener('click', approveSelected);
        await loadList();
    }

    return { load };
})();

App.registerView('payment_imports', PaymentImportsView.load);
window.PaymentImportsView = PaymentImportsView;
