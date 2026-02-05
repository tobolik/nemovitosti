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
        function positionCenter() {
            const pw = Math.min(840, window.innerWidth - 24);
            const ph = Math.min(640, window.innerHeight - 24);
            const left = Math.max(0, (window.innerWidth - pw) / 2);
            const top = Math.max(0, (window.innerHeight - ph) / 2);
            popover.style.width = pw + 'px';
            popover.style.height = ph + 'px';
            popover.style.left = left + 'px';
            popover.style.top = top + 'px';
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
            positionCenter();
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
    // headers: [{ label, key?, width?, act?, hideMobile?, sortKey? }]
    // rows: array of objects
    // rowFn: (item) => string of <td>...</td> (celý řádek)
    // opts: { emptyMsg, sortable?: { currentKey, currentDir } | { order: [{ key, dir }] }, striped?: boolean }
    function renderTable(containerId, headers, rows, rowFn, { emptyMsg = 'Žádné záznamy.', sortable, striped } = {}) {
        const el = document.getElementById(containerId);
        if (!el) return;

        if (!rows || !rows.length) {
            el.innerHTML = '<div class="empty">' + esc(emptyMsg) + '</div>';
            return;
        }

        const order = sortable && sortable.order && sortable.order.length
            ? sortable.order
            : (sortable && sortable.currentKey ? [{ key: sortable.currentKey, dir: sortable.currentDir || 'asc' }] : []);

        const ths = headers.map(h => {
            let cls = [];
            if (h.act) cls.push('th-act');
            if (h.hideMobile) cls.push('col-hide-mobile');
            let sortLevel = '';
            if (h.sortKey) {
                cls.push('th-sortable');
                const idx = order.findIndex(o => o.key === h.sortKey);
                if (idx >= 0) {
                    const o = order[idx];
                    cls.push(o.dir === 'asc' ? 'th-sort-asc' : 'th-sort-desc');
                    sortLevel = ' data-sort-level="' + (idx + 1) + '"';
                }
            }
            const titleAttr = h.title ? ' title="' + esc(h.title) + '"' : '';
            const sortTitle = h.sortKey ? ' title="Klik: řazení podle tohoto sloupce (↑/↓). Ctrl+Klik: přidat další úroveň řazení."' : '';
            const sortAttr = h.sortKey ? ' data-sort="' + esc(h.sortKey) + '"' : '';
            return '<th' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + titleAttr + sortTitle + sortAttr + sortLevel + '>' + esc(h.label) + '</th>';
        }).join('');

        const trs = rows.map(item => {
            const cls = item._rowClass || '';
            return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>' + rowFn(item) + '</tr>';
        }).join('');

        const tableCls = 'tbl' + (striped ? ' tbl-striped' : '');
        el.innerHTML =
            '<div class="tbl-wrap"><table class="' + tableCls + '">' +
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

    // ── searchable select (combobox) ─────────────────────────────────────
    const _searchableSelects = new Map();

    function createSearchableSelect(selectId) {
        const select = document.getElementById(selectId);
        if (!select || select.tagName !== 'SELECT' || _searchableSelects.has(selectId)) return;
        if (select.closest('.searchable-select-wrap')) return;
        const parent = select.parentNode;
        const wrapper = document.createElement('div');
        wrapper.className = 'searchable-select-wrap';
        wrapper.setAttribute('data-for', selectId);
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'searchable-select-input';
        input.autocomplete = 'off';
        input.placeholder = 'Vyhledat…';
        input.setAttribute('aria-label', select.getAttribute('aria-label') || 'Vyhledat');
        const dropdown = document.createElement('div');
        dropdown.className = 'searchable-select-dropdown';
        dropdown.setAttribute('role', 'listbox');
        dropdown.setAttribute('aria-hidden', 'true');
        select.classList.add('searchable-select-native');
        select.setAttribute('tabindex', '-1');  /* vyřadit z tab pořadí – focus jen na input */
        wrapper.appendChild(input);
        wrapper.appendChild(dropdown);
        wrapper.appendChild(select);
        parent.appendChild(wrapper);

        function getOptions() {
            const opts = [];
            for (let i = 0; i < select.options.length; i++) {
                const o = select.options[i];
                if (o.value === '' && !o.textContent.trim()) continue;
                opts.push({ value: o.value, text: o.textContent.trim() });
            }
            return opts;
        }

        let selectedIndex = -1;

        function renderDropdown(filter) {
            const opts = getOptions();
            const q = (filter || '').toLowerCase().trim();
            const filtered = q
                ? opts.filter(o => o.text.toLowerCase().includes(q))
                : opts;
            dropdown.innerHTML = filtered.length
                ? filtered.map(o => '<div class="searchable-select-option" role="option" data-value="' + esc(o.value) + '">' + esc(o.text) + '</div>').join('')
                : '<div class="searchable-select-empty">Žádný výsledek</div>';
            dropdown.setAttribute('aria-hidden', 'false');
            selectedIndex = filtered.length ? 0 : -1;
            highlightSearchableOption();
        }

        function highlightSearchableOption() {
            const options = dropdown.querySelectorAll('.searchable-select-option');
            options.forEach((el, i) => el.classList.toggle('active', i === selectedIndex));
            const opt = options[selectedIndex];
            if (opt) opt.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        function setDisplayFromSelect() {
            const opt = select.options[select.selectedIndex];
            if (opt && opt.value === '') {
                input.value = '';
                input.placeholder = opt.textContent.trim();
            } else {
                input.value = opt ? opt.textContent.trim() : '';
                input.placeholder = 'Vyhledat…';
            }
        }

        function closeDropdown() {
            dropdown.classList.remove('show');
            dropdown.setAttribute('aria-hidden', 'true');
            selectedIndex = -1;
        }

        function selectOptionByIndex() {
            const options = dropdown.querySelectorAll('.searchable-select-option');
            const opt = options[selectedIndex];
            if (!opt) return;
            const val = opt.getAttribute('data-value');
            select.value = val;
            input.value = opt.textContent.trim();
            closeDropdown();
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        input.addEventListener('focus', () => {
            renderDropdown(input.value);
            dropdown.classList.add('show');
            /* Kliknutím do pole označit celý text, aby šel hned přepsat */
            if (input.value.length > 0) {
                setTimeout(function () { input.select(); }, 0);
            }
        });
        input.addEventListener('input', () => {
            renderDropdown(input.value);
            dropdown.classList.add('show');
        });
        input.addEventListener('blur', () => {
            setTimeout(closeDropdown, 180);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && input.value === input.placeholder) {
                input.value = '';
            }
            if (!dropdown.classList.contains('show')) {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                    e.preventDefault();
                    renderDropdown(input.value);
                    dropdown.classList.add('show');
                    if (e.key === 'Enter' && selectedIndex >= 0) selectOptionByIndex();
                }
                return;
            }
            const options = dropdown.querySelectorAll('.searchable-select-option');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
                highlightSearchableOption();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                highlightSearchableOption();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                selectOptionByIndex();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeDropdown();
            }
        });
        dropdown.addEventListener('mousedown', (e) => e.preventDefault());
        dropdown.addEventListener('click', (e) => {
            const opt = e.target.closest('.searchable-select-option');
            if (!opt) return;
            const val = opt.getAttribute('data-value');
            select.value = val;
            input.value = opt.textContent.trim();
            closeDropdown();
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        setDisplayFromSelect();
        _searchableSelects.set(selectId, { input, setDisplayFromSelect });
    }

    function updateSearchableSelectDisplay(selectId) {
        const rec = _searchableSelects.get(selectId);
        if (rec && rec.setDisplayFromSelect) rec.setDisplayFromSelect();
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
        createSearchableSelect,
        updateSearchableSelectDisplay,
    };
})();
