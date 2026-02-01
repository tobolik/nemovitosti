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
            addLabel:   'Přidat nemovitost',
            editLabel:  'Uložit změny',
            getValues() {
                return {
                    name:           document.getElementById('prop-name').value.trim(),
                    address:        document.getElementById('prop-address').value.trim(),
                    size_m2:        document.getElementById('prop-size-m2').value || null,
                    purchase_price: document.getElementById('prop-purchase-price').value || null,
                    type:           document.getElementById('prop-type').value,
                    note:           document.getElementById('prop-note').value.trim(),
                };
            },
            fillForm(row) {
                document.getElementById('prop-name').value           = row.name           || '';
                document.getElementById('prop-address').value        = row.address        || '';
                document.getElementById('prop-size-m2').value         = row.size_m2        || '';
                document.getElementById('prop-purchase-price').value  = row.purchase_price || '';
                document.getElementById('prop-type').value            = row.type           || 'apartment';
                document.getElementById('prop-note').value            = row.note           || '';
            },
            resetForm() {
                ['prop-name','prop-address','prop-size-m2','prop-purchase-price','prop-note'].forEach(id =>
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

        UI.renderTable('prop-table',
            [
                { label: 'Název' },
                { label: 'Typ' },
                { label: 'Adresa' },
                { label: 'Poznámka' },
                { label: 'Akce', act: true },
            ],
            data,
            (p) => (
                '<td><strong>' + UI.esc(p.name) + '</strong></td>' +
                '<td>' + UI.esc(TYPE_LABELS[p.type] || p.type) + '</td>' +
                '<td>' + UI.esc(p.address) + '</td>' +
                '<td>' + (p.size_m2 ? UI.fmt(p.size_m2) + ' m²' : '—') + '</td>' +
                '<td>' + (p.purchase_price ? UI.fmt(p.purchase_price) + ' Kč' : '—') + '</td>' +
                '<td>' + (p.note ? UI.esc(p.note) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td class="td-act">' +
                    '<button class="btn btn-ghost btn-sm" onclick="PropertiesView.edit(' + p.id + ')">Úprava</button>' +
                    '<button class="btn btn-danger btn-sm" onclick="PropertiesView.del(' + p.id + ')">Smazat</button>' +
                '</td>'
            ),
            { emptyMsg: 'Žádné nemovitosti. Přidejte první výše.' }
        );
    }

    // ── exposed actions (volané z onclick) ──────────────────────────────
    // Cache: uložíme data, aby edit nemuselo znovu fetcovat
    let _cache = [];

    async function _ensureCache() {
        if (!_cache.length) _cache = await Api.crudList('properties');
    }

    function edit(id) {
        _ensureCache().then(() => {
            const row = _cache.find(r => r.id === id);
            if (row) form.startEdit(row);
        });
    }

    function del(id) {
        UI.confirmDelete('properties', id, 'Smaznout tuto nemovitost?', () => {
            _cache = [];  // invalidate cache
            loadList();
        });
    }

    // ── view loader (volání z routeru) ──────────────────────────────────
    async function load() {
        initForm();
        _cache = [];
        await loadList();
    }

    return { load, edit, del };
})();

App.registerView('properties', PropertiesView.load);
