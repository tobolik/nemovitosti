// js/views/properties.js

const TYPE_LABELS = { apartment:'Byt', house:'Dům', garage:'Garáž', commercial:'Komerční', land:'Pozemek' };

const PropertiesView = (() => {
    // CRUD form controller (created once on first load)
    let form = null;

    function initForm() {
        if (form) return;
        form = UI.createCrudForm({
            table:      'properties',
            alertId:    'prop-alert',
            titleId:    'prop-form-title',
            saveId:     'btn-prop-save',
            cancelId:   'btn-prop-cancel',
            editIdField:'prop-edit-id',
            formCardId: 'prop-form-card',
            addBtnId:   'btn-prop-add',
            addLabel:   'Přidat nemovitost',
            editLabel:  'Uložit změny',
            successAddMsg: 'Nemovitost byla úspěšně přidána.',
            successEditMsg: 'Nemovitost byla úspěšně aktualizována.',
            validate(values) {
                if (values.purchase_date && !UI.isDateValid(values.purchase_date)) {
                    return 'Datum koupě: zadejte platné datum (např. únor má max. 29 dní).';
                }
                return null;
            },
            getValues() {
                return {
                    name:                   document.getElementById('prop-name').value.trim(),
                    address:                document.getElementById('prop-address').value.trim(),
                    size_m2:                document.getElementById('prop-size-m2').value || null,
                    purchase_price:         document.getElementById('prop-purchase-price').value || null,
                    purchase_date:          document.getElementById('prop-purchase-date').value || null,
                    purchase_contract_url:  document.getElementById('prop-purchase-contract-url').value.trim() || null,
                    type:                   document.getElementById('prop-type').value,
                    note:                   document.getElementById('prop-note').value.trim(),
                };
            },
            fillForm(row) {
                document.getElementById('prop-name').value                   = row.name                   || '';
                document.getElementById('prop-address').value                = row.address                || '';
                document.getElementById('prop-size-m2').value                 = row.size_m2                || '';
                document.getElementById('prop-purchase-price').value          = row.purchase_price         || '';
                document.getElementById('prop-purchase-date').value          = row.purchase_date          || '';
                document.getElementById('prop-purchase-contract-url').value   = row.purchase_contract_url || '';
                document.getElementById('prop-type').value                    = row.type                   || 'apartment';
                document.getElementById('prop-note').value                    = row.note                   || '';
            },
            resetForm() {
                ['prop-name','prop-address','prop-size-m2','prop-purchase-price','prop-purchase-date','prop-purchase-contract-url','prop-note'].forEach(id =>
                    document.getElementById(id).value = ''
                );
                document.getElementById('prop-type').value = 'apartment';
            },
            onSaved: loadList,
        });
    }

    // ── list loader ─────────────────────────────────────────────────────
    async function loadList() {
        let data;
        try { data = await Api.crudList('properties'); }
        catch (e) { return; }
        _cache = data;

        UI.renderTable('prop-table',
            [
                { label: 'Název' },
                { label: 'Typ' },
                { label: 'Adresa', hideMobile: true },
                { label: 'Výměra', hideMobile: true },
                { label: 'Kupní cena', hideMobile: true },
                { label: 'Datum koupě', hideMobile: true },
                { label: 'Smlouva', hideMobile: true },
                { label: 'Poznámka', hideMobile: true },
                { label: 'Akce', act: true },
            ],
            data,
            (p) => {
                const contractLink = p.purchase_contract_url
                    ? '<a href="' + UI.esc(p.purchase_contract_url) + '" target="_blank" rel="noopener" title="Otevřít kupní smlouvu">📄</a>'
                    : '<span style="color:var(--txt3)">—</span>';
                return (
                    '<td><strong>' + UI.esc(p.name) + '</strong></td>' +
                    '<td>' + UI.esc(TYPE_LABELS[p.type] || p.type) + '</td>' +
                    '<td class="col-hide-mobile">' + UI.esc(p.address) + '</td>' +
                    '<td class="col-hide-mobile">' + (p.size_m2 ? UI.fmt(p.size_m2) + ' m²' : '—') + '</td>' +
                    '<td class="col-hide-mobile">' + (p.purchase_price ? UI.fmt(p.purchase_price) + ' Kč' : '—') + '</td>' +
                    '<td class="col-hide-mobile">' + (p.purchase_date ? UI.fmtDate(p.purchase_date) : '—') + '</td>' +
                    '<td class="col-hide-mobile">' + contractLink + '</td>' +
                    '<td class="col-hide-mobile">' + (p.note ? UI.esc(p.note) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                    '<td class="td-act">' +
                        '<button class="btn btn-ghost btn-sm" onclick="PropertiesView.edit(' + p.id + ')">Úprava</button>' +
                        '<button class="btn btn-danger btn-sm" onclick="PropertiesView.del(' + p.id + ')">Smazat</button>' +
                    '</td>'
                );
            },
            { emptyMsg: 'Žádné nemovitosti. Přidejte první výše.' }
        );
    }

    // ── exposed actions (volané z onclick) ──────────────────────────────
    let _cache = [];

    function edit(id) {
        const row = _cache.find(r => r.id === id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('properties', id, 'Smazat tuto nemovitost?', () => {
            _cache = [];
            loadList();
        });
    }

    // ── view loader (volání z routeru) ──────────────────────────────────
    async function load() {
        initForm();
        form.exitEdit();
        _cache = [];
        await loadList();
    }

    return { load, edit, del };
})();

App.registerView('properties', PropertiesView.load);
window.PropertiesView = PropertiesView;
