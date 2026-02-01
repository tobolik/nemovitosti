// js/views/contracts.js

const ContractsView = (() => {
    let form   = null;
    let _cache = [];  // contracts with joined names

    // ── modal: nový nájemník ────────────────────────────────────────────
    let _tenantModalInited = false;
    function initTenantModal() {
        if (_tenantModalInited) return;
        _tenantModalInited = true;
        const btnAdd = document.getElementById('btn-con-add-tenant');
        const btnSave = document.getElementById('btn-modal-tenant-save');
        const btnAres = document.getElementById('modal-tenant-ares-btn');
        const typeEl = document.getElementById('modal-tenant-type');
        const alertEl = document.getElementById('modal-tenant-alert');

        if (!btnAdd) return;

        btnAdd.addEventListener('click', () => {
            ['modal-tenant-name','modal-tenant-email','modal-tenant-phone','modal-tenant-address','modal-tenant-ic','modal-tenant-dic','modal-tenant-note'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            if (typeEl) typeEl.value = 'person';
            if (alertEl) { alertEl.className = 'alert'; alertEl.textContent = ''; }
            toggleAresButton();
            UI.modalOpen('modal-tenant');
        });

        function toggleAresButton() {
            if (btnAres) btnAres.style.display = (typeEl && typeEl.value === 'company') ? '' : 'none';
        }
        if (typeEl) typeEl.addEventListener('change', toggleAresButton);
        toggleAresButton();

        if (btnAres) btnAres.addEventListener('click', async () => {
            const ic = (document.getElementById('modal-tenant-ic')?.value || '').replace(/\D/g, '');
            if (ic.length !== 8) {
                UI.alertShow('modal-tenant-alert', 'Zadejte platné IČ (8 číslic).', 'err');
                return;
            }
            btnAres.disabled = true;
            btnAres.textContent = '…';
            try {
                const data = await Api.aresLookup(ic);
                const nameEl = document.getElementById('modal-tenant-name');
                const addrEl = document.getElementById('modal-tenant-address');
                const icEl = document.getElementById('modal-tenant-ic');
                const dicEl = document.getElementById('modal-tenant-dic');
                if (nameEl) nameEl.value = data.name || '';
                if (addrEl) addrEl.value = data.address || '';
                if (icEl) icEl.value = data.ic || ic;
                if (dicEl) dicEl.value = data.dic || '';
                UI.alertShow('modal-tenant-alert', 'Data načtena z ARES.', 'ok');
            } catch (e) {
                UI.alertShow('modal-tenant-alert', e.message || 'ARES nedostupný.', 'err');
            } finally {
                btnAres.disabled = false;
                btnAres.textContent = 'Načíst z ARES';
            }
        });

        if (btnSave) btnSave.addEventListener('click', async () => {
            const name = (document.getElementById('modal-tenant-name')?.value || '').trim();
            if (!name) {
                UI.alertShow('modal-tenant-alert', 'Jméno / Název je povinné.', 'err');
                return;
            }
            btnSave.disabled = true;
            try {
                const data = await Api.crudAdd('tenants', {
                    name:    name,
                    type:   (typeEl?.value) || 'person',
                    email:  (document.getElementById('modal-tenant-email')?.value || '').trim(),
                    phone:  (document.getElementById('modal-tenant-phone')?.value || '').trim(),
                    address: (document.getElementById('modal-tenant-address')?.value || '').trim(),
                    ic:     (document.getElementById('modal-tenant-ic')?.value || '').trim() || null,
                    dic:    (document.getElementById('modal-tenant-dic')?.value || '').trim() || null,
                    note:   (document.getElementById('modal-tenant-note')?.value || '').trim(),
                });
                await fillDropdowns();
                const tenantSel = document.getElementById('con-tenant');
                if (tenantSel) tenantSel.value = data.id;
                UI.modalClose('modal-tenant');
            } catch (e) {
                UI.alertShow('modal-tenant-alert', e.message || 'Chyba při ukládání.', 'err');
            } finally {
                btnSave.disabled = false;
            }
        });
    }

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
