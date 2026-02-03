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

    /** Google Drive URL → preview embed URL, jinak null. */
    function getDrivePreviewUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        return m ? 'https://drive.google.com/file/d/' + m[1] + '/preview' : null;
    }

    /** Jednorázová inicializace náhledu smlouvy (PDF) při hoveru – delegace na document.body. */
    let _contractPreviewInited = false;
    function initContractPreview() {
        if (_contractPreviewInited) return;
        _contractPreviewInited = true;
        let popover = document.getElementById('contract-preview-popover');
        if (!popover) {
            popover = document.createElement('div');
            popover.id = 'contract-preview-popover';
            popover.className = 'contract-preview-popover';
            document.body.appendChild(popover);
        }
        let hideTimer = null;
        function scheduleHide() {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => popover.classList.remove('show'), 350);
        }
        function cancelHide() {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
        document.body.addEventListener('mouseover', (e) => {
            const trigger = e.target.closest('.contract-preview-trigger');
            if (!trigger) return;
            if (e.relatedTarget && trigger.contains(e.relatedTarget)) return;
            cancelHide();
            const url = trigger.getAttribute('data-url') || trigger.href || '';
            const previewUrl = getDrivePreviewUrl(url);
            if (previewUrl) {
                popover.innerHTML = '<iframe src="' + esc(previewUrl) + '" title="Náhled dokumentu"></iframe>';
                popover.classList.add('has-iframe');
            } else {
                popover.innerHTML = '<p class="contract-preview-fallback">Náhled není k dispozici.</p><a href="' + esc(url) + '" target="_blank" rel="noopener">Otevřít dokument</a>';
                popover.classList.remove('has-iframe');
            }
            const rect = trigger.getBoundingClientRect();
            const pw = 420, ph = 320;
            let left = rect.left, top = rect.bottom + 6;
            if (left + pw > window.innerWidth) left = window.innerWidth - pw - 8;
            if (left < 8) left = 8;
            if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - 6);
            popover.style.width = pw + 'px';
            popover.style.height = ph + 'px';
            popover.style.left = left + 'px';
            popover.style.top = top + 'px';
            popover.classList.add('show');
        }, true);
        document.body.addEventListener('mouseout', (e) => {
            if (!e.target.closest('.contract-preview-trigger')) return;
            if (e.relatedTarget && (e.relatedTarget.closest('.contract-preview-popover') || e.relatedTarget.closest('.contract-preview-trigger'))) return;
            scheduleHide();
        }, true);
        popover.addEventListener('mouseenter', cancelHide);
        popover.addEventListener('mouseleave', () => scheduleHide());
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
    // headers: [{ label, key?, width?, act?, hideMobile? }]
    // rows: array of objects
    // rowFn: (item) => string of <td>...</td> (celý řádek)
    // hideMobile: adds 'col-hide-mobile' class to column (hidden on mobile)
    function renderTable(containerId, headers, rows, rowFn, { emptyMsg = 'Žádné záznamy.' } = {}) {
        const el = document.getElementById(containerId);
        if (!el) return;

        if (!rows || !rows.length) {
            el.innerHTML = '<div class="empty">' + esc(emptyMsg) + '</div>';
            return;
        }

        const ths = headers.map(h => {
            let cls = [];
            if (h.act) cls.push('th-act');
            if (h.hideMobile) cls.push('col-hide-mobile');
            const titleAttr = h.title ? ' title="' + esc(h.title) + '"' : '';
            return '<th' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + titleAttr + '>' + esc(h.label) + '</th>';
        }).join('');

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
        let _editingRow = null;
        const formCard = cfg.formCardId ? document.getElementById(cfg.formCardId) : null;
        const addBtn   = cfg.addBtnId   ? document.getElementById(cfg.addBtnId)   : null;

        function showForm() {
            if (formCard) {
                formCard.style.display = '';
                // On mobile, scroll to show form but keep page title visible
                // Use 'nearest' to avoid unnecessary scrolling
                setTimeout(() => {
                    formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 50);
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
            _editingRow = null;
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
                _editingRow = row;
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
        getDrivePreviewUrl,
        initContractPreview,
    };
})();
