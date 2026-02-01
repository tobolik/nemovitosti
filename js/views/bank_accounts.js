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
                return {
                    name:          document.getElementById('bank-name').value.trim(),
                    account_number: document.getElementById('bank-account').value.trim(),
                    is_primary:    document.getElementById('bank-primary').checked ? 1 : 0,
                    sort_order:    parseInt(document.getElementById('bank-sort').value, 10) || 0,
                };
            },
            fillForm(row) {
                document.getElementById('bank-name').value = row.name || '';
                document.getElementById('bank-account').value = row.account_number || '';
                document.getElementById('bank-primary').checked = !!row.is_primary;
                document.getElementById('bank-sort').value = row.sort_order ?? 0;
            },
            resetForm() {
                document.getElementById('bank-name').value = '';
                document.getElementById('bank-account').value = '';
                document.getElementById('bank-primary').checked = false;
                document.getElementById('bank-sort').value = '0';
            },
            onSaved: loadList,
        });
    }

    async function loadList() {
        let data;
        try { data = await Api.crudList('bank_accounts'); _cache = data; }
        catch (e) { return; }

        UI.renderTable('bank-table',
            [
                { label: 'Název' },
                { label: 'Číslo účtu' },
                { label: 'Primární' },
                { label: 'Pořadí' },
                { label: 'Akce', act: true },
            ],
            data,
            (b) => (
                '<td><strong>' + UI.esc(b.name) + '</strong></td>' +
                '<td>' + UI.esc(b.account_number || '—') + '</td>' +
                '<td>' + (b.is_primary ? '<span class="badge badge-ok">Ano</span>' : '—') + '</td>' +
                '<td>' + (b.sort_order ?? 0) + '</td>' +
                '<td class="td-act">' +
                    '<button class="btn btn-ghost btn-sm" onclick="BankAccountsView.edit(' + b.id + ')">Úprava</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="BankAccountsView.del(' + b.id + ')">Smazat</button>' +
                '</td>'
            ),
            { emptyMsg: 'Žádné bankovní účty. Přidejte první účet.' }
        );
    }

    function edit(id) {
        const row = _cache.find(r => r.id === id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('bank_accounts', id, 'Smazat tento bankovní účet?', loadList);
    }

    async function load() {
        initForm();
        form.exitEdit();
        await loadList();
    }

    return { load, edit, del };
})();

App.registerView('bank_accounts', BankAccountsView.load);
window.BankAccountsView = BankAccountsView;
