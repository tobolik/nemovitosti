// js/ui.js – sdílené UI utility
// Žádné globální state – čistě helper funkce + CRUD form factory

const UI = (() => {

    // ── escaping & formatting ───────────────────────────────────────────
    function esc(s) {
        return String(s ?? '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function fmt(n) {
        return Number(n).toLocaleString('cs-CZ');
    }

    function fmtDate(s) {
        if (!s) return '';
        const d = new Date(s + 'T12:00:00');
        if (isNaN(d.getTime())) return s;
        return d.toLocaleDateString('cs-CZ');
    }

    /** Ověří, zda řetězec YYYY-MM-DD představuje platné datum (např. 31.2. odmítne). */
    function isDateValid(str) {
        if (!str || typeof str !== 'string') return false;
        const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return false;
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10);
        const d = parseInt(m[3], 10);
        if (mo < 1 || mo > 12) return false;
        const lastDay = new Date(y, mo, 0).getDate();
        return d >= 1 && d <= lastDay;
    }

    const MONTHS = ['','Leden','Únor','Březen','Duben','Květen','Červen',
                        'Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

    // ── alerts ──────────────────────────────────────────────────────────
    // type = 'ok' | 'err'
    function alertShow(elementId, msg, type = 'err') {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.className = 'alert alert-' + type + ' show';
        el.textContent = msg;
        // auto hide po 4s
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('show'), 4000);
    }

    // ── modals ──────────────────────────────────────────────────────────
    function modalOpen(id)  { document.getElementById(id).classList.add('show'); }
    function modalClose(id) { document.getElementById(id).classList.remove('show'); }

    // ── generic table renderer ──────────────────────────────────────────
    // Vloží <table> do elementu `containerId`.
    // headers: [{ label, key?, width? }]
    // rows: array of objects
    // rowFn: (item) => string of <td>...</td> (celý řádek)
    function renderTable(containerId, headers, rows, rowFn, { emptyMsg = 'Žádné záznamy.' } = {}) {
        const el = document.getElementById(containerId);
        if (!el) return;

        if (!rows || !rows.length) {
            el.innerHTML = '<div class="empty">' + esc(emptyMsg) + '</div>';
            return;
        }

        const ths = headers.map(h =>
            '<th' + (h.act ? ' class="th-act"' : '') + '>' + esc(h.label) + '</th>'
        ).join('');

        const trs = rows.map(item => {
            const cls = item._rowClass || '';
            return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + rowFn(item) + '</tr>';
        }).join('');

        el.innerHTML =
            '<div class="tbl-wrap"><table class="tbl">' +
            '<thead><tr>' + ths + '</tr></thead>' +
            '<tbody>' + trs + '</tbody>' +
            '</table></div>';
    }

    // ── CRUD form factory ───────────────────────────────────────────────
    // Vrátí objekt { startEdit(row), exitEdit(), startAdd() } pro standardní add/edit form.
    // formCardId + addBtnId: seznam je první, formulář se zobrazí až po Přidat/Úprava.
    //
    // cfg: {
    //   table:        'properties',
    //   alertId:      'prop-alert',
    //   titleId:      'prop-form-title',
    //   saveId:       'btn-prop-save',
    //   cancelId:     'btn-prop-cancel',
    //   editIdField:  'prop-edit-id',
    //   formCardId:   'prop-form-card',   – volitelné: skrýt formulář, zobrazit až po Přidat/Úprava
    //   addBtnId:     'btn-prop-add',     – volitelné: tlačítko „+ Přidat“
    //   addLabel:     'Přidat nemovitost',
    //   editLabel:    'Uložit změny',
    //   getValues:    () => ({ name, address, ... }),   – reads from DOM
    //   fillForm:     (row) => { … },                  – fills DOM from row
    //   resetForm:    () => { … },                     – clears form
    //   onSaved:      () => { … },                     – callback after success (reload list)
    // }
    function createCrudForm(cfg) {
        let editMode = false;
        const formCard = cfg.formCardId ? document.getElementById(cfg.formCardId) : null;
        const addBtn   = cfg.addBtnId   ? document.getElementById(cfg.addBtnId)   : null;

        function showForm() {
            if (formCard) {
                formCard.style.display = '';
                formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            if (addBtn) addBtn.style.display = 'none';
        }
        function hideForm() {
            if (formCard) formCard.style.display = 'none';
            if (addBtn)   addBtn.style.display = '';
        }

        document.getElementById(cfg.saveId).addEventListener('click', async () => {
            const id     = document.getElementById(cfg.editIdField).value;
            const values = cfg.getValues();
            if (cfg.validate) {
                const err = cfg.validate(values, editMode);
                if (err) { alertShow(cfg.alertId, err, 'err'); return; }
            }
            try {
                if (editMode) {
                    await Api.crudEdit(cfg.table, Number(id), values);
                } else {
                    await Api.crudAdd(cfg.table, values);
                }
                const addMsg = cfg.successAddMsg ?? 'Záznam byl přidán.';
                const editMsg = cfg.successEditMsg ?? 'Záznam byl aktualizován.';
                alertShow(cfg.alertId, editMode ? editMsg : addMsg, 'ok');
                exitEdit();
                cfg.onSaved && cfg.onSaved();
            } catch (e) {
                alertShow(cfg.alertId, e.message, 'err');
            }
        });

        document.getElementById(cfg.cancelId).addEventListener('click', exitEdit);

        if (addBtn) {
            addBtn.addEventListener('click', startAdd);
        }

        function exitEdit() {
            editMode = false;
            document.getElementById(cfg.editIdField).value = '';
            document.getElementById(cfg.titleId).textContent  = cfg.addLabel;
            document.getElementById(cfg.saveId).textContent    = cfg.addLabel;
            document.getElementById(cfg.cancelId).style.display = 'none';
            cfg.resetForm();
            hideForm();
        }

        function startAdd() {
            editMode = false;
            document.getElementById(cfg.editIdField).value = '';
            document.getElementById(cfg.titleId).textContent  = cfg.addLabel;
            document.getElementById(cfg.saveId).textContent    = cfg.addLabel;
            document.getElementById(cfg.cancelId).style.display = 'none';
            cfg.resetForm();
            showForm();
        }

        return {
            startEdit(row) {
                editMode = true;
                document.getElementById(cfg.editIdField).value = row.id;
                document.getElementById(cfg.titleId).textContent  = 'Úprava';
                document.getElementById(cfg.saveId).textContent    = cfg.editLabel;
                document.getElementById(cfg.cancelId).style.display = '';
                cfg.fillForm(row);
                showForm();
            },
            exitEdit,
            startAdd,
        };
    }

    // ── generic delete helper ───────────────────────────────────────────
    async function confirmDelete(table, id, message, onSuccess) {
        if (!confirm(message)) return;
        try {
            await Api.crudDelete(table, id);
            onSuccess && onSuccess();
        } catch (e) {
            alert(e.message);
        }
    }

    // ── public ──────────────────────────────────────────────────────────
    return {
        esc, fmt, fmtDate, isDateValid, MONTHS,
        alertShow,
        modalOpen, modalClose,
        renderTable,
        createCrudForm,
        confirmDelete,
    };
})();
