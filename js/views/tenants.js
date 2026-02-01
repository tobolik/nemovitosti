// js/views/tenants.js

const TenantsView = (() => {
    let form   = null;
    let _cache = [];

    function initForm() {
        if (form) return;
        form = UI.createCrudForm({
            table:      'tenants',
            alertId:    'ten-alert',
            titleId:    'ten-form-title',
            saveId:     'btn-ten-save',
            cancelId:   'btn-ten-cancel',
            editIdField:'ten-edit-id',
            addLabel:   'Přidat nájemníka',
            editLabel:  'Uložit změny',
            getValues() {
                return {
                    name:  document.getElementById('ten-name').value.trim(),
                    email: document.getElementById('ten-email').value.trim(),
                    phone: document.getElementById('ten-phone').value.trim(),
                    note:  document.getElementById('ten-note').value.trim(),
                };
            },
            fillForm(row) {
                document.getElementById('ten-name').value  = row.name  || '';
                document.getElementById('ten-email').value = row.email || '';
                document.getElementById('ten-phone').value = row.phone || '';
                document.getElementById('ten-note').value  = row.note  || '';
            },
            resetForm() {
                ['ten-name','ten-email','ten-phone','ten-note'].forEach(id =>
                    document.getElementById(id).value = ''
                );
            },
            onSaved: loadList,
        });
    }

    async function loadList() {
        let data;
        try { data = await Api.crudList('tenants'); _cache = data; }
        catch (e) { return; }

        UI.renderTable('ten-table',
            [
                { label: 'Jméno' },
                { label: 'E-mail' },
                { label: 'Telefon' },
                { label: 'Poznámka' },
                { label: 'Akce', act: true },
            ],
            data,
            (t) => (
                '<td><strong>' + UI.esc(t.name) + '</strong></td>' +
                '<td>' + (t.email ? UI.esc(t.email) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td>' + (t.phone ? UI.esc(t.phone) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td>' + (t.note  ? UI.esc(t.note)  : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td class="td-act">' +
                    '<button class="btn btn-ghost btn-sm" onclick="TenantsView.edit(' + t.id + ')">Úprava</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="TenantsView.del(' + t.id + ')">Smazat</button>' +
                '</td>'
            ),
            { emptyMsg: 'Žádní nájemníci. Přidejte první výše.' }
        );
    }

    function edit(id) {
        const row = _cache.find(r => r.id === id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('tenants', id, 'Smaznout tohoto nájemníka?', () => {
            _cache = [];
            loadList();
        });
    }

    async function load() {
        initForm();
        _cache = [];
        await loadList();
    }

    return { load, edit, del };
})();

App.registerView('tenants', TenantsView.load);
