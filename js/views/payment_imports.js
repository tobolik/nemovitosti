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
        const acc = document.getElementById('import-filter-account');
        const from = document.getElementById('import-filter-from');
        const to = document.getElementById('import-filter-to');
        return {
            bank_accounts_id: acc && acc.value ? parseInt(acc.value, 10) : undefined,
            from: from && from.value ? from.value : undefined,
            to: to && to.value ? to.value : undefined,
        };
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
        return types.map(t => '<option value="' + t.v + '"' + (selected === t.v ? ' selected' : '') + '>' + t.l + '</option>').join('');
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
            return row && row.contracts_id && row.period_year && row.period_month;
        });
        btn.disabled = ready.length === 0;
        btn.textContent = ready.length > 0 ? 'Hromadně schválit vybrané (' + ready.length + ')' : 'Hromadně schválit vybrané';
    }

    function renderRow(imp) {
        const id = imp.id;
        const paired = !!(imp.contracts_id && imp.period_year && imp.period_month);
        const contractSel = '<select class="import-contract" data-id="' + id + '">' + contractOptions(imp.contracts_id) + '</select>';
        const yearFrom = '<select class="import-year-from" data-id="' + id + '">' + yearOptions(imp.period_year) + '</select>';
        const monthFrom = '<select class="import-month-from" data-id="' + id + '">' + monthOptions(imp.period_month) + '</select>';
        const yearTo = '<select class="import-year-to" data-id="' + id + '">' + yearOptions(imp.period_year_to) + '</select>';
        const monthTo = '<select class="import-month-to" data-id="' + id + '">' + monthOptions(imp.period_month_to) + '</select>';
        return '<tr data-id="' + id + '">' +
            '<td><input type="checkbox" class="import-cb" data-id="' + id + '"' + (paired ? '' : ' disabled title="Nejprve napárujte smlouvu a období"') + '></td>' +
            '<td>' + (imp.payment_date ? UI.fmtDate(imp.payment_date) : '—') + '</td>' +
            '<td>' + UI.fmt(imp.amount) + ' Kč</td>' +
            '<td class="col-note">' + UI.esc(imp.counterpart_account || '—') + '</td>' +
            '<td class="col-note">' + UI.esc(imp.note || '—') + '</td>' +
            '<td class="import-cell-contract">' + contractSel + '</td>' +
            '<td><span class="import-period-from">' + yearFrom + ' ' + monthFrom + '</span></td>' +
            '<td><span class="import-period-to">' + yearTo + ' ' + monthTo + '</span></td>' +
            '<td><select class="import-type" data-id="' + id + '">' + typeOptions(imp.payment_type || 'rent') + '</select></td>' +
            '<td class="td-act"><button type="button" class="btn btn-ghost btn-sm import-del" data-id="' + id + '">Smazat</button></td>' +
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
