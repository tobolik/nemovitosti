// js/views/tenants.js

const TenantsView = (() => {
    let form   = null;
    let _cache = [];

    function initAresButton() {
        const typeEl = document.getElementById('ten-type');
        const wrapAres = document.getElementById('ten-ares-wrap');
        const btnAres = document.getElementById('ten-ares-btn');
        const alertEl = document.getElementById('ten-alert');
        if (!btnAres || !wrapAres) return;

        const wrapIcDic = document.getElementById('ten-ic-dic-wrap');
        const birthDateWrap = document.getElementById('ten-birth-date-wrap');
        function toggleTenantTypeVisibility() {
            const isCompany = typeEl.value === 'company';
            wrapAres.style.display = isCompany ? 'block' : 'none';
            if (wrapIcDic) wrapIcDic.style.display = isCompany ? 'flex' : 'none';
            if (birthDateWrap) birthDateWrap.style.display = !isCompany ? 'block' : 'none';
        }
        typeEl.addEventListener('change', toggleTenantTypeVisibility);
        toggleTenantTypeVisibility();

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
            formCardId: 'ten-form-card',
            addBtnId:   'btn-ten-add',
            addLabel:   'Přidat nájemníka',
            editLabel:  'Uložit změny',
            successAddMsg: 'Nájemník byl úspěšně přidán.',
            successEditMsg: 'Nájemník byl úspěšně aktualizován.',
            getValues() {
                const type = document.getElementById('ten-type').value;
                const isCompany = type === 'company';
                return {
                    name:    document.getElementById('ten-name').value.trim(),
                    type,
                    birth_date: !isCompany ? (document.getElementById('ten-birth-date').value || null) : null,
                    email:   document.getElementById('ten-email').value.trim(),
                    phone:   document.getElementById('ten-phone').value.trim(),
                    address: document.getElementById('ten-address').value.trim(),
                    ic:      isCompany ? (document.getElementById('ten-ic').value.trim() || null) : null,
                    dic:     isCompany ? (document.getElementById('ten-dic').value.trim() || null) : null,
                    note:    document.getElementById('ten-note').value.trim(),
                };
            },
            fillForm(row) {
                document.getElementById('ten-name').value    = row.name    || '';
                document.getElementById('ten-type').value     = row.type    || 'person';
                document.getElementById('ten-birth-date').value = row.birth_date ? row.birth_date.slice(0, 10) : '';
                document.getElementById('ten-email').value   = row.email   || '';
                document.getElementById('ten-phone').value   = row.phone   || '';
                document.getElementById('ten-address').value = row.address || '';
                document.getElementById('ten-ic').value      = row.ic      || '';
                document.getElementById('ten-dic').value     = row.dic     || '';
                document.getElementById('ten-edit-id').value = String(row.tenants_id ?? row.id);
                document.getElementById('ten-note').value    = row.note    || '';
                const wrapAresF = document.getElementById('ten-ares-wrap');
                const wrapIcDicF = document.getElementById('ten-ic-dic-wrap');
                const birthWrap = document.getElementById('ten-birth-date-wrap');
                const isCo = row.type === 'company';
                if (wrapAresF) wrapAresF.style.display = isCo ? 'block' : 'none';
                if (wrapIcDicF) wrapIcDicF.style.display = isCo ? 'flex' : 'none';
                if (birthWrap) birthWrap.style.display = !isCo ? 'block' : 'none';
            },
            resetForm() {
                ['ten-name','ten-birth-date','ten-email','ten-phone','ten-address','ten-ic','ten-dic','ten-note'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
                document.getElementById('ten-type').value = 'person';
                const wrapAresR = document.getElementById('ten-ares-wrap');
                const wrapIcDicR = document.getElementById('ten-ic-dic-wrap');
                const birthWrapR = document.getElementById('ten-birth-date-wrap');
                if (wrapAresR) wrapAresR.style.display = 'none';
                if (wrapIcDicR) wrapIcDicR.style.display = 'none';
                if (birthWrapR) birthWrapR.style.display = 'block';
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
                { label: 'Datum narození', hideMobile: true },
                { label: 'E-mail', hideMobile: true },
                { label: 'Telefon' },
                { label: 'IČO', hideMobile: true },
                { label: 'Poznámka', hideMobile: true },
                { label: 'Akce', act: true },
            ],
            data,
            (t) => {
                const birthDate = t.type === 'person' && t.birth_date ? UI.fmtDate(t.birth_date) : '—';
                return (
                '<td><strong>' + UI.esc(t.name) + '</strong></td>' +
                '<td>' + (t.type === 'company' ? 'PO' : 'FO') + '</td>' +
                '<td class="col-hide-mobile">' + birthDate + '</td>' +
                '<td class="col-hide-mobile">' + (t.email ? '<a href="mailto:' + UI.esc(t.email) + '">' + UI.esc(t.email) + '</a>' : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td>' + (t.phone ? '<a href="tel:' + UI.esc(t.phone) + '">' + UI.esc(t.phone) + '</a>' : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td class="col-hide-mobile">' + (t.ic ? UI.esc(t.ic) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td class="col-note col-hide-mobile">' + (t.note  ? UI.esc(t.note)  : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td class="td-act">' +
                    '<button class="btn btn-ghost btn-sm" onclick="TenantsView.edit(' + t.id + ')">Úprava</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="TenantsView.del(' + t.id + ')">Smazat</button>' +
                '</td>'
            );
            },
            { emptyMsg: 'Žádní nájemníci. Přidejte první výše.' }
        );
    }

    function edit(id) {
        const row = _cache.find(r => (r.tenants_id ?? r.id) == id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('tenants', id, 'Smazat tohoto nájemníka?', () => {
            _cache = [];
            loadList();
        });
    }

    async function load() {
        initForm();
        form.exitEdit();
        _cache = [];
        await loadList();
        try {
            const raw = sessionStorage.getItem('dashboard-open-edit');
            if (raw) {
                const { view, id } = JSON.parse(raw);
                if (view === 'tenants' && id) {
                    sessionStorage.removeItem('dashboard-open-edit');
                    const numId = parseInt(id, 10);
                    if (!isNaN(numId)) setTimeout(() => TenantsView.edit(numId), 0);
                }
            }
        } catch (_) {}
    }

    return { load, edit, del };
})();

App.registerView('tenants', TenantsView.load);
window.TenantsView = TenantsView;
