// js/views/bank_accounts.js

const BankAccountsView = (() => {
    let form = null;
    let _cache = [];

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
                const vals = {
                    name:          document.getElementById('bank-name').value.trim(),
                    account_number: document.getElementById('bank-account').value.trim(),
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
                document.getElementById('bank-primary').checked = !!row.is_primary;
                document.getElementById('bank-sort').value = row.sort_order ?? 0;
                const tokenEl = document.getElementById('bank-fio-token');
                tokenEl.value = '';
                tokenEl.placeholder = row.fio_token_isset ? 'Zadaný token je uložen (pro změnu zadejte nový)' : 'Token z FIO IB → Nastavení → API (volitelné)';
            },
            resetForm() {
                document.getElementById('bank-name').value = '';
                document.getElementById('bank-account').value = '';
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
                { label: 'FIO', sortKey: 'fio_token_isset' },
                { label: 'Primární', sortKey: 'is_primary' },
                { label: 'Pořadí', sortKey: 'sort_order', hideMobile: true },
                { label: 'Akce', act: true },
            ],
            sorted,
            (b) => (
                '<td><strong>' + UI.esc(b.name) + '</strong></td>' +
                '<td class="col-note col-hide-mobile">' + UI.esc(b.account_number || '—') + '</td>' +
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

    async function loadList() {
        let data;
        try { data = await Api.crudList('bank_accounts'); _cache = data; }
        catch (e) { return; }
        applySortAndRender();
    }

    function edit(id) {
        const row = _cache.find(r => (r.bank_accounts_id ?? r.id) == id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('bank_accounts', id, 'Smazat tento bankovní účet?', loadList);
    }

    async function load() {
        initForm();
        initBankTableSortClick();
        form.exitEdit();
        await loadList();
    }

    return { load, edit, del };
})();

App.registerView('bank_accounts', BankAccountsView.load);
window.BankAccountsView = BankAccountsView;
