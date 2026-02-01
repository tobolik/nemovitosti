// js/views/contracts.js

const ContractsView = (() => {
    let form   = null;
    let _cache = [];  // contracts with joined names

    function initForm() {
        if (form) return;
        form = UI.createCrudForm({
            table:      'contracts',
            alertId:    'con-alert',
            titleId:    'con-form-title',
            saveId:     'btn-con-save',
            cancelId:   'btn-con-cancel',
            editIdField:'con-edit-id',
            addLabel:   'Přidat smlouvu',
            editLabel:  'Uložit změny',
            getValues() {
                return {
                    property_id:    Number(document.getElementById('con-property').value),
                    tenant_id:      Number(document.getElementById('con-tenant').value),
                    contract_start: document.getElementById('con-start').value,
                    contract_end:   document.getElementById('con-end').value || '',
                    monthly_rent:   document.getElementById('con-rent').value,
                    note:           document.getElementById('con-note').value.trim(),
                };
            },
            fillForm(row) {
                document.getElementById('con-property').value = row.property_id || '';
                document.getElementById('con-tenant').value   = row.tenant_id   || '';
                document.getElementById('con-start').value    = row.contract_start || '';
                document.getElementById('con-end').value      = row.contract_end   || '';
                document.getElementById('con-rent').value     = row.monthly_rent   || '';
                document.getElementById('con-note').value     = row.note           || '';
            },
            resetForm() {
                ['con-property','con-tenant','con-start','con-end','con-rent','con-note']
                    .forEach(id => document.getElementById(id).value = '');
            },
            onSaved: loadList,
        });
    }

    // ── fill dropdowns ──────────────────────────────────────────────────
    async function fillDropdowns() {
        const [props, tens] = await Promise.all([
            Api.crudList('properties'),
            Api.crudList('tenants'),
        ]);

        document.getElementById('con-property').innerHTML =
            '<option value="">— Vyberte nemovitost —</option>' +
            props.map(p =>
                '<option value="' + p.id + '">' + UI.esc(p.name) + ' – ' + UI.esc(p.address) + '</option>'
            ).join('');

        document.getElementById('con-tenant').innerHTML =
            '<option value="">— Vyberte nájemníka —</option>' +
            tens.map(t =>
                '<option value="' + t.id + '">' + UI.esc(t.name) + '</option>'
            ).join('');
    }

    // ── table ───────────────────────────────────────────────────────────
    async function loadList() {
        let data;
        try { data = await Api.crudList('contracts'); _cache = data; }
        catch (e) { return; }

        UI.renderTable('con-table',
            [
                { label: 'Nemovitost' },
                { label: 'Nájemník' },
                { label: 'Od' },
                { label: 'Do' },
                { label: 'Nájemné / měs.' },
                { label: 'Poznámka' },
                { label: 'Akce', act: true },
            ],
            data,
            (c) => (
                '<td>' + UI.esc(c.property_name) + '</td>' +
                '<td><strong>' + UI.esc(c.tenant_name) + '</strong></td>' +
                '<td>' + UI.esc(c.contract_start) + '</td>' +
                '<td>' + (c.contract_end ? UI.esc(c.contract_end) : '<span style="color:var(--txt3)">neurčitá</span>') + '</td>' +
                '<td>' + UI.fmt(c.monthly_rent) + ' Kč</td>' +
                '<td>' + (c.note ? UI.esc(c.note) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td class="td-act">' +
                    '<button class="btn btn-ghost btn-sm" onclick="ContractsView.edit(' + c.id + ')">Úprava</button>' +
                    '<button class="btn btn-ghost btn-sm" onclick="PaymentsView.navigateWithFilter(' + c.id + ')">Platby</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="ContractsView.del(' + c.id + ')">Smazat</button>' +
                '</td>'
            ),
            { emptyMsg: 'Žádné smlouvy.' }
        );
    }

    function edit(id) {
        const row = _cache.find(r => r.id === id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('contracts', id, 'Smaznout tuto smlouvu?', () => {
            _cache = [];
            loadList();
        });
    }

    async function load() {
        initForm();
        initTenantModal();
        _cache = [];
        await fillDropdowns();
        await loadList();
        prefillFromCalendarIfPending();
    }

    let _pendingPrefill = null;
    function prefillFromCalendar(propertyId, monthKey, propertyName) {
        _pendingPrefill = { propertyId, monthKey, propertyName };
    }
    async function prefillFromCalendarIfPending() {
        if (!_pendingPrefill) return;
        const { propertyId, monthKey } = _pendingPrefill;
        _pendingPrefill = null;
        await fillDropdowns();
        document.getElementById('con-property').value = propertyId;
        document.getElementById('con-start').value = monthKey + '-01';
        document.getElementById('con-edit-id').value = '';
        document.getElementById('con-form-title').textContent = 'Přidat smlouvu';
        document.getElementById('btn-con-save').textContent = 'Přidat smlouvu';
        document.getElementById('btn-con-cancel').style.display = 'none';
    }

    function getCache() { return _cache; }

    return { load, edit, del, getCache, prefillFromCalendar };
})();

App.registerView('contracts', ContractsView.load);
