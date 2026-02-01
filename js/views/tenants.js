// js/views/tenants.js

const TenantsView = (() => {
    let form   = null;
    let _cache = [];

    function initAresButton() {
        const typeEl = document.getElementById('ten-type');
        const btnAres = document.getElementById('ten-ares-btn');
        const alertEl = document.getElementById('ten-alert');
        if (!btnAres) return;

        function toggleAresButton() {
            btnAres.style.display = typeEl.value === 'company' ? '' : 'none';
        }
        typeEl.addEventListener('change', toggleAresButton);
        toggleAresButton();

        btnAres.addEventListener('click', async () => {
            const ic = document.getElementById('ten-ic').value.replace(/\D/g, '');
            if (ic.length !== 8) {
                UI.alertShow('ten-alert', 'Zadejte platné IČ (8 číslic).', 'err');
                return;
            }
            btnAres.disabled = true;
            btnAres.textContent = '…';
            try {
                const data = await Api.aresLookup(ic);
                document.getElementById('ten-name').value = data.name || '';
                document.getElementById('ten-address').value = data.address || '';
                document.getElementById('ten-ic').value = data.ic || ic;
                document.getElementById('ten-dic').value = data.dic || '';
                UI.alertShow('ten-alert', 'Data načtena z ARES.', 'ok');
            } catch (e) {
                UI.alertShow('ten-alert', e.message || 'ARES nedostupný.', 'err');
            } finally {
                btnAres.disabled = false;
                btnAres.textContent = 'Načíst z ARES';
            }
        });
    }

    function initForm() {
        if (form) return;
        initAresButton();
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
                    name:    document.getElementById('ten-name').value.trim(),
                    type:    document.getElementById('ten-type').value,
                    email:   document.getElementById('ten-email').value.trim(),
                    phone:   document.getElementById('ten-phone').value.trim(),
                    address: document.getElementById('ten-address').value.trim(),
                    ic:      document.getElementById('ten-ic').value.trim() || null,
                    dic:     document.getElementById('ten-dic').value.trim() || null,
                    note:    document.getElementById('ten-note').value.trim(),
                };
            },
            fillForm(row) {
                document.getElementById('ten-name').value    = row.name    || '';
                document.getElementById('ten-type').value     = row.type    || 'person';
                document.getElementById('ten-email').value   = row.email   || '';
                document.getElementById('ten-phone').value   = row.phone   || '';
                document.getElementById('ten-address').value = row.address || '';
                document.getElementById('ten-ic').value      = row.ic      || '';
                document.getElementById('ten-dic').value     = row.dic     || '';
                document.getElementById('ten-note').value    = row.note    || '';
                const btn = document.getElementById('ten-ares-btn');
                if (btn) btn.style.display = (row.type === 'company') ? '' : 'none';
            },
            resetForm() {
                ['ten-name','ten-email','ten-phone','ten-address','ten-ic','ten-dic','ten-note'].forEach(id =>
                    document.getElementById(id).value = ''
                );
                document.getElementById('ten-type').value = 'person';
                const btn = document.getElementById('ten-ares-btn');
                if (btn) btn.style.display = 'none';
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
                { label: 'Jméno / Název' },
                { label: 'Typ' },
                { label: 'E-mail' },
                { label: 'Telefon' },
                { label: 'IČO' },
                { label: 'Poznámka' },
                { label: 'Akce', act: true },
            ],
            data,
            (t) => (
                '<td><strong>' + UI.esc(t.name) + '</strong></td>' +
                '<td>' + (t.type === 'company' ? 'PO' : 'FO') + '</td>' +
                '<td>' + (t.email ? UI.esc(t.email) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td>' + (t.phone ? UI.esc(t.phone) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td>' + (t.ic ? UI.esc(t.ic) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
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
