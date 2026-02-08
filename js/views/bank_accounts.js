// js/views/bank_accounts.js

const BankAccountsView = (() => {
    let form = null;
    let _cache = [];
    let _contracts = [];

    function initForm() {
        if (form) return;
        form = UI.createCrudForm({
            table:      'bank_accounts',
            alertId:    'bank-alert',
            titleId:    'bank-form-title',
            saveId:     'btn-bank-save',
            cancelId:   'btn-bank-cancel',
            editIdField:'bank-edit-id',
            formCardId: 'bank-form-card',
            addBtnId:   'btn-bank-add',
            addLabel:   'Přidat účet',
            editLabel:  'Uložit změny',
            successAddMsg: 'Bankovní účet byl přidán.',
            successEditMsg: 'Bankovní účet byl aktualizován.',
            getValues() {
                let currency = (document.getElementById('bank-currency') && document.getElementById('bank-currency').value.trim()) || 'CZK';
                currency = currency.toUpperCase().slice(0, 3);
                const vals = {
                    name:          document.getElementById('bank-name').value.trim(),
                    account_number: document.getElementById('bank-account').value.trim(),
                    currency:      currency || 'CZK',
                    is_primary:    document.getElementById('bank-primary').checked ? 1 : 0,
                    sort_order:    parseInt(document.getElementById('bank-sort').value, 10) || 0,
                };
                const token = document.getElementById('bank-fio-token').value.trim();
                if (token) vals.fio_token = token;
                return vals;
            },
            fillForm(row) {
                document.getElementById('bank-edit-id').value = String(row.bank_accounts_id ?? row.id);
                document.getElementById('bank-name').value = row.name || '';
                document.getElementById('bank-account').value = row.account_number || '';
                const curEl = document.getElementById('bank-currency');
                if (curEl) curEl.value = (row.currency || 'CZK').toUpperCase().slice(0, 3);
                document.getElementById('bank-primary').checked = !!row.is_primary;
                document.getElementById('bank-sort').value = row.sort_order ?? 0;
                const tokenEl = document.getElementById('bank-fio-token');
                tokenEl.value = '';
                tokenEl.placeholder = row.fio_token_isset ? 'Zadaný token je uložen (pro změnu zadejte nový)' : 'Token z FIO IB → Nastavení → API (volitelné)';
            },
            resetForm() {
                document.getElementById('bank-name').value = '';
                document.getElementById('bank-account').value = '';
                const curEl = document.getElementById('bank-currency');
                if (curEl) curEl.value = 'CZK';
                document.getElementById('bank-primary').checked = false;
                document.getElementById('bank-sort').value = '0';
                document.getElementById('bank-fio-token').value = '';
                document.getElementById('bank-fio-token').placeholder = 'Token z FIO IB → Nastavení → API (volitelné)';
            },
            onSaved: loadList,
        });
    }

    let _sortState = { order: [{ key: 'sort_order', dir: 'asc' }] };

    function getBankSortValue(b, key) {
        switch (key) {
            case 'name': return (b.name || '').toLowerCase();
            case 'account_number': return (b.account_number || '').toLowerCase();
            case 'currency': return (b.currency || 'CZK').toUpperCase();
            case 'fio_token_isset': return b.fio_token_isset ? 1 : 0;
            case 'is_primary': return b.is_primary ? 1 : 0;
            case 'sort_order': return parseInt(b.sort_order, 10) || 0;
            default: return '';
        }
    }

    function compareValues(va, vb) {
        if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb);
        return va < vb ? -1 : (va > vb ? 1 : 0);
    }

    function sortBanks(data, state) {
        const order = state.order && state.order.length ? state.order : [{ key: 'sort_order', dir: 'asc' }];
        return [...data].sort((a, b) => {
            for (let i = 0; i < order.length; i++) {
                const { key, dir } = order[i];
                const cmp = compareValues(getBankSortValue(a, key), getBankSortValue(b, key));
                if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
            }
            return 0;
        });
    }

    function applySortAndRender() {
        const sorted = sortBanks(_cache, _sortState);
        UI.renderTable('bank-table',
            [
                { label: 'Název', sortKey: 'name' },
                { label: 'Číslo účtu', sortKey: 'account_number', hideMobile: true },
                { label: 'Měna', sortKey: 'currency', hideMobile: true },
                { label: 'FIO', sortKey: 'fio_token_isset' },
                { label: 'Primární', sortKey: 'is_primary' },
                { label: 'Pořadí', sortKey: 'sort_order', hideMobile: true },
                { label: 'Akce', act: true },
            ],
            sorted,
            (b) => (
                '<td><strong>' + UI.esc(b.name) + '</strong></td>' +
                '<td class="col-note col-hide-mobile">' + UI.esc(b.account_number || '—') + '</td>' +
                '<td class="col-hide-mobile">' + UI.esc((b.currency || 'CZK').toUpperCase()) + '</td>' +
                '<td>' + (b.fio_token_isset ? '<span class="badge badge-ok" title="Účet propojen s FIO API">FIO</span>' : '—') + '</td>' +
                '<td>' + (b.is_primary ? '<span class="badge badge-ok">ANO</span>' : '—') + '</td>' +
                '<td class="col-hide-mobile">' + (b.sort_order ?? 0) + '</td>' +
                '<td class="td-act">' +
                    '<button class="btn btn-ghost btn-sm" onclick="BankAccountsView.edit(' + (b.bank_accounts_id ?? b.id) + ')">Úprava</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="BankAccountsView.del(' + (b.bank_accounts_id ?? b.id) + ')">Smazat</button>' +
                '</td>'
            ),
            { emptyMsg: 'Žádné bankovní účty. Přidejte první účet.', sortable: { order: _sortState.order }, striped: true }
        );
    }

    function initBankTableSortClick() {
        const el = document.getElementById('bank-table');
        if (!el || el.dataset.sortBound) return;
        el.dataset.sortBound = '1';
        el.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-sort]');
            if (!th) return;
            const key = th.getAttribute('data-sort');
            if (!key) return;
            const order = _sortState.order || [];
            const idx = order.findIndex(o => o.key === key);
            if (e.ctrlKey || e.metaKey) {
                if (idx >= 0) order[idx].dir = order[idx].dir === 'asc' ? 'desc' : 'asc';
                else order.push({ key, dir: 'asc' });
                _sortState.order = order;
            } else {
                _sortState.order = idx >= 0 && order.length === 1
                    ? [{ key, dir: order[idx].dir === 'asc' ? 'desc' : 'asc' }]
                    : [{ key, dir: 'asc' }];
            }
            applySortAndRender();
        });
    }

    /** K datu YYYY-MM-DD přičte/odečte počet měsíců, vrátí YYYY-MM-DD. */
    function addMonthsToDate(dateStr, delta) {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        const d = new Date(dateStr + 'T12:00:00');
        d.setMonth(d.getMonth() + delta);
        return d.toISOString().slice(0, 10);
    }

    function fillFioFetchForm() {
        const sel = document.getElementById('fio-fetch-account');
        if (!sel) return;
        const withToken = _cache.filter(b => b.fio_token_isset);
        sel.innerHTML = '<option value="">— Vyberte účet —</option>' +
            withToken.map(b => {
                const id = b.bank_accounts_id ?? b.id;
                return '<option value="' + id + '">' + UI.esc(b.name) + (b.account_number ? ' – ' + UI.esc(b.account_number) : '') + '</option>';
            }).join('');
        const contractSel = document.getElementById('fio-fetch-contract');
        if (contractSel) {
            const cid = (c) => c.contracts_id ?? c.id;
            contractSel.innerHTML = '<option value="">— Volitelně: podle smlouvy —</option>' +
                (_contracts || []).map(c => '<option value="' + cid(c) + '">' + UI.esc(c.tenant_name || '') + ' – ' + UI.esc(c.property_name || '') + '</option>').join('');
        }
        const fromEl = document.getElementById('fio-fetch-from');
        const toEl = document.getElementById('fio-fetch-to');
        if (fromEl && toEl && !fromEl.value) {
            const now = new Date();
            fromEl.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
            toEl.value = now.toISOString().slice(0, 10);
        }
    }

    function applyFioFetchContractDates(contractId) {
        const c = (_contracts || []).find(x => String(x.contracts_id ?? x.id) === String(contractId));
        if (!c) return;
        const start = (c.contract_start || '').toString().slice(0, 10);
        let end = (c.contract_end || '').toString().slice(0, 10);
        if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
        if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            end = d.toISOString().slice(0, 10);
        }
        const fromEl = document.getElementById('fio-fetch-from');
        const toEl = document.getElementById('fio-fetch-to');
        if (fromEl) fromEl.value = addMonthsToDate(start, -1);
        if (toEl) toEl.value = addMonthsToDate(end, 1);
    }

    async function loadList() {
        let data;
        try { data = await Api.crudList('bank_accounts'); _cache = data; }
        catch (e) { return; }
        applySortAndRender();
        fillFioFetchForm();
    }

    function edit(id) {
        const row = _cache.find(r => (r.bank_accounts_id ?? r.id) == id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('bank_accounts', id, 'Smazat tento bankovní účet?', loadList);
    }

    function initFioFetch() {
        const btn = document.getElementById('btn-fio-fetch');
        const alertEl = document.getElementById('fio-fetch-alert');
        const resultEl = document.getElementById('fio-import-result');
        const contractSel = document.getElementById('fio-fetch-contract');
        if (contractSel) {
            contractSel.addEventListener('change', function () {
                const v = this.value;
                if (v) applyFioFetchContractDates(parseInt(v, 10));
            });
        }
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const accountId = document.getElementById('fio-fetch-account').value;
            const from = document.getElementById('fio-fetch-from').value;
            const to = document.getElementById('fio-fetch-to').value;
            if (!accountId) {
                if (alertEl) { alertEl.textContent = 'Vyberte účet s FIO tokenem.'; alertEl.className = 'alert alert-err show'; alertEl.style.display = ''; }
                if (resultEl) resultEl.style.display = 'none';
                return;
            }
            btn.disabled = true;
            if (alertEl) alertEl.style.display = 'none';
            if (resultEl) resultEl.style.display = 'none';
            try {
                const data = await Api.fioImport(parseInt(accountId, 10), from || undefined, to || undefined);
                const n = data.imported || 0;
                const sk = data.skipped || 0;
                const skFilter = data.skipped_filter || 0;
                if (resultEl) {
                    resultEl.className = 'alert alert-ok show';
                    resultEl.style.display = '';
                    let msg = 'Naimportováno <strong>' + n + '</strong> pohybů.';
                    if (sk > 0) msg += ' (' + sk + ' již v importu přeskočeno.)';
                    if (skFilter > 0) msg += ' (' + skFilter + ' neodpovídá protiúčtům u smluv.)';
                    msg += ' <a href="#payment_imports">Přejít na kontrolu importů</a>';
                    resultEl.innerHTML = msg;
                }
            } catch (e) {
                if (alertEl) { alertEl.textContent = e.message || 'Import z FIO se nezdařil.'; alertEl.className = 'alert alert-err show'; alertEl.style.display = ''; }
            }
            btn.disabled = false;
        });
    }

    async function load() {
        initForm();
        initBankTableSortClick();
        initFioFetch();
        form.exitEdit();
        try { _contracts = await Api.crudList('contracts'); } catch (e) { _contracts = []; }
        await loadList();
    }

    return { load, edit, del };
})();

App.registerView('bank_accounts', BankAccountsView.load);
window.BankAccountsView = BankAccountsView;
