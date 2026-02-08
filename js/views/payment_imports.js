// js/views/payment_imports.js – Kontrola importů z FIO, párování a hromadné schválení

const PaymentImportsView = (() => {
    let _cache = [];
    let _contracts = [];
    let _bankAccounts = [];
    let _requestsByContract = {};

    async function loadContractsAndBanks() {
        [_contracts, _bankAccounts] = await Promise.all([
            Api.crudList('contracts'),
            Api.crudList('bank_accounts'),
        ]);
    }

    function fillFilterDropdowns() {
        const accSel = document.getElementById('import-filter-account');
        if (!accSel) return;
        accSel.innerHTML = '<option value="">— Všechny —</option>' +
            (_bankAccounts || []).map(b => {
                const id = b.bank_accounts_id ?? b.id;
                return '<option value="' + id + '">' + UI.esc(b.name) + (b.account_number ? ' – ' + UI.esc(b.account_number) : '') + '</option>';
            }).join('');
        const fromEl = document.getElementById('import-filter-from');
        const toEl = document.getElementById('import-filter-to');
        if (fromEl && toEl && !fromEl.value) {
            const now = new Date();
            fromEl.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
            toEl.value = now.toISOString().slice(0, 10);
        }
    }

    function getFilterParams() {
        const status = document.getElementById('import-filter-status');
        const acc = document.getElementById('import-filter-account');
        const from = document.getElementById('import-filter-from');
        const to = document.getElementById('import-filter-to');
        const onlyMatchingEl = document.getElementById('import-filter-only-matching');
        const params = {
            bank_accounts_id: acc && acc.value ? parseInt(acc.value, 10) : undefined,
            from: from && from.value ? from.value : undefined,
            to: to && to.value ? to.value : undefined,
            only_matching_counterpart: onlyMatchingEl ? onlyMatchingEl.checked : true,
        };
        if (status && status.value === 'to_review') params.to_review = true;
        if (status && status.value === 'history') params.history = true;
        if (params.only_matching_counterpart === false) params.only_matching_counterpart = false;
        return params;
    }

    function monthOptions(selected) {
        const labels = ['', 'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
        let html = '<option value="">—</option>';
        for (let m = 1; m <= 12; m++) {
            html += '<option value="' + m + '"' + (selected === m ? ' selected' : '') + '>' + m + ' – ' + labels[m] + '</option>';
        }
        return html;
    }

    function yearOptions(selected) {
        const now = new Date().getFullYear();
        let html = '<option value="">—</option>';
        for (let y = now; y >= now - 15; y--) {
            html += '<option value="' + y + '"' + (selected === y ? ' selected' : '') + '>' + y + '</option>';
        }
        return html;
    }

    function typeOptions(selected) {
        const types = [{ v: 'rent', l: 'Nájem' }, { v: 'deposit', l: 'Kauce' }, { v: 'deposit_return', l: 'Vrácení kauce' }, { v: 'energy', l: 'Energie' }, { v: 'other', l: 'Jiné' }];
        return '<option value=""' + (selected === '' || selected === null || selected === undefined ? ' selected' : '') + '>—</option>' +
            types.map(t => '<option value="' + t.v + '"' + (selected === t.v ? ' selected' : '') + '>' + t.l + '</option>').join('');
    }

    function contractOptions(selected) {
        const cid = (c) => c.contracts_id ?? c.id;
        return '<option value="">— Smlouva —</option>' +
            (_contracts || []).map(c => '<option value="' + cid(c) + '"' + (String(selected) === String(cid(c)) ? ' selected' : '') + '>' + UI.esc(c.tenant_name) + ' – ' + UI.esc(c.property_name) + '</option>').join('');
    }

    function requestOptions(requests, selected) {
        if (!requests || requests.length === 0) {
            return '<option value="">— Požadavek —</option>';
        }
        const prId = (pr) => pr.payment_requests_id ?? pr.id;
        return '<option value="">— Požadavek —</option>' +
            requests.map(pr => {
                const label = UI.fmt(Number(pr.amount)) + ' Kč' + (pr.note ? ' – ' + UI.esc(pr.note.substring(0, 40)) + (pr.note.length > 40 ? '…' : '') : '') + (pr.due_date ? ' (spl. ' + UI.fmtDate(pr.due_date) + ')' : '');
                return '<option value="' + prId(pr) + '"' + (String(selected) === String(prId(pr)) ? ' selected' : '') + '>' + label + '</option>';
            }).join('');
    }

    function effectivePairing(row) {
        const cid = row.contracts_id ?? row.suggested_contracts_id;
        const py = row.period_year ?? row.suggested_period_year;
        const pm = row.period_month ?? row.suggested_period_month;
        const ptype = row.payment_type || row.suggested_payment_type;
        return !!(cid && py && pm && ptype);
    }
    function updateApproveButton() {
        const btn = document.getElementById('import-approve-btn');
        if (!btn) return;
        const checked = document.querySelectorAll('#import-tbody input.import-cb:checked');
        const ready = Array.from(checked).filter(cb => {
            const id = cb.getAttribute('data-id');
            const row = _cache.find(r => String(r.id) === String(id));
            return row && !row.approved_at && !row.overpayment && effectivePairing(row);
        });
        btn.disabled = ready.length === 0;
        btn.textContent = ready.length > 0 ? 'Hromadně schválit vybrané (' + ready.length + ')' : 'Hromadně schválit vybrané';
    }

    function currencyLabel(code) {
        const c = (code || 'CZK').toString().toUpperCase();
        return c === 'CZK' ? 'Kč' : c;
    }
    function renderRow(imp) {
        const id = imp.id;
        const isProcessed = !!imp.approved_at;
        // Efektivní hodnoty: uložené nebo návrh (suggested) – pro předvyplnění a průhledné vybarvení
        const cid = imp.contracts_id ?? imp.suggested_contracts_id;
        const py = imp.period_year ?? imp.suggested_period_year;
        const pm = imp.period_month ?? imp.suggested_period_month;
        const pyTo = imp.period_year_to ?? imp.suggested_period_year_to ?? imp.suggested_period_year ?? imp.period_year;
        const pmTo = imp.period_month_to ?? imp.suggested_period_month_to ?? imp.suggested_period_month ?? imp.period_month;
        const ptype = imp.payment_type || imp.suggested_payment_type || '';
        const paired = !!(cid && py && pm && ptype);
        const sid = (name) => 'import-' + name + '-' + id;
        const contractSel = '<select id="' + sid('contract') + '" class="import-contract" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + contractOptions(cid) + '</select>';
        const yearFrom = '<select id="' + sid('year-from') + '" class="import-year-from" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + yearOptions(py) + '</select>';
        const monthFrom = '<select id="' + sid('month-from') + '" class="import-month-from" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + monthOptions(pm) + '</select>';
        const yearTo = '<select id="' + sid('year-to') + '" class="import-year-to" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + yearOptions(pyTo) + '</select>';
        const monthTo = '<select id="' + sid('month-to') + '" class="import-month-to" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + monthOptions(pmTo) + '</select>';
        const typeSel = '<select id="' + sid('type') + '" class="import-type" data-id="' + id + '"' + (isProcessed ? ' disabled' : '') + '>' + typeOptions(ptype) + '</select>';
        const requests = _requestsByContract[cid] || [];
        const requestSel = '<select id="' + sid('request') + '" class="import-request" data-id="' + id + '" title="Napárovat na konkrétní požadavek (energie, doplatek…)"' + (isProcessed ? ' disabled' : '') + '>' + requestOptions(requests, imp.payment_request_id) + '</select>';
        let statusCell = '—';
        if (isProcessed && imp.payments_id) {
            statusCell = '<span class="badge badge-ok" title="Zpracováno">✓</span> <span class="pay-from-bank" title="Platba vytvořena z tohoto importu (rozlišení od ručně zadaných)">🏦</span> <a href="#payments" class="import-link-payment" title="Platba z tohoto importu (ID ' + (imp.payments_id || '') + ')">→ Platba</a>';
        } else if (isProcessed) {
            statusCell = '<span class="badge badge-ok" title="Zpracováno">✓</span>';
        } else if (imp.overpayment) {
            statusCell = '<span class="badge badge-warn" title="Pro toto období a smlouvu již platba existuje.">Spárováno</span>';
        }
        const curr = currencyLabel(imp.currency);
        const counterpartFull = imp.counterpart_account || '';
        const noteFull = imp.note || '';
        const shodaCell = imp.counterpart_matches === true
            ? '<span class="badge badge-ok" title="Protiúčet odpovídá účtu nájemce">✓</span>'
            : imp.counterpart_matches === false
                ? '<span class="badge badge-warn" title="Protiúčet neodpovídá žádnému číslu účtu nájemce">Nesedí</span>'
                : '—';
        // Párování: řádek 1: Smlouva + Typ + Požadavek, řádek 2: Období od + Období do
        const pairingCell = '<td colspan="4" class="import-cell-pairing">' +
            '<div class="import-pairing-row1">' +
            '<span class="import-cell-contract' + (cid ? ' import-cell-paired' : '') + '">' + contractSel + '</span>' +
            '<span class="import-cell-type' + (ptype ? ' import-cell-paired' : '') + '">' + typeSel + '</span>' +
            '<span class="import-cell-request">' + requestSel + '</span>' +
            '</div>' +
            '<div class="import-pairing-row2">' +
            '<span class="import-cell-period-from' + (py && pm ? ' import-cell-paired' : '') + '"><span class="import-period-from">' + yearFrom + ' ' + monthFrom + '</span></span>' +
            '<span class="import-cell-period-to' + (pyTo && pmTo ? ' import-cell-paired' : '') + '"><span class="import-period-to">' + yearTo + ' ' + monthTo + '</span></span>' +
            '</div>' +
            '</td>';
        const trClass = [isProcessed && 'import-row-processed', paired && 'import-row-has-paired'].filter(Boolean).join(' ');
        return '<tr data-id="' + id + '"' + (trClass ? ' class="' + trClass + '"' : '') + '>' +
            '<td class="import-col-cb"><input type="checkbox" class="import-cb" data-id="' + id + '"' + (isProcessed ? ' disabled' : imp.overpayment ? ' disabled title="Spárováno – platba pro toto období již existuje"' : (paired ? '' : ' disabled title="Vyplňte smlouvu, období a typ platby"')) + '></td>' +
            '<td class="col-status">' + statusCell + '</td>' +
            '<td class="import-col-date">' + (imp.payment_date ? UI.fmtDate(imp.payment_date) : '—') + '</td>' +
            '<td class="import-col-amount">' + UI.fmt(imp.amount) + ' ' + UI.esc(curr) + '</td>' +
            '<td class="import-col-counterpart" title="' + UI.esc(counterpartFull) + '">' + UI.esc(counterpartFull || '—') + '</td>' +
            '<td class="col-shoda">' + shodaCell + '</td>' +
            '<td class="import-col-msg cell-note-wrap"><span class="cell-note-truncate" title="' + UI.esc(noteFull) + '">' + UI.esc(noteFull || '—') + '</span></td>' +
            pairingCell +
            '<td class="td-act">' + (isProcessed ? '' : '<button type="button" class="btn btn-ghost btn-sm import-del" data-id="' + id + '">Smazat</button>') + '</td>' +
            '</tr>';
    }

    async function loadList() {
        const params = getFilterParams();
        try {
            _cache = await Api.paymentImportsList(params);
        } catch (e) {
            _cache = [];
        }
        const cids = new Set();
        _cache.forEach(r => {
            const c = r.contracts_id ?? r.suggested_contracts_id;
            if (c) cids.add(c);
        });
        _requestsByContract = {};
        if (cids.size > 0) {
            try {
                const cidArr = [...cids];
                const results = await Promise.all(cidArr.map(cid => Api.crudList('payment_requests', { contracts_id: cid })));
                cidArr.forEach((cid, i) => { _requestsByContract[cid] = results[i] || []; });
            } catch (e) {
                // bez požadavků jen nezobrazíme roletku
            }
        }
        const tbody = document.getElementById('import-tbody');
        const emptyEl = document.getElementById('import-empty');
        const wrap = document.getElementById('import-table-wrap');
        if (!_cache.length) {
            if (tbody) tbody.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            if (wrap) wrap.style.display = 'none';
            updateApproveButton();
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (wrap) wrap.style.display = 'block';
        tbody.innerHTML = _cache.map(imp => renderRow(imp)).join('');

        // Searchable selecty (včetně vyhledávání číslem u měsíců/roků)
        const selectNames = ['contract', 'year-from', 'month-from', 'year-to', 'month-to', 'type'];
        _cache.forEach(imp => {
            if (imp.approved_at) return; /* zpracované řádky necháme jako nativní disabled selecty */
            selectNames.forEach(name => {
                const selectId = 'import-' + name + '-' + imp.id;
                const sel = document.getElementById(selectId);
                if (sel && sel.tagName === 'SELECT' && !sel.disabled && !sel.closest('.searchable-select-wrap')) {
                    if (typeof UI.createSearchableSelect === 'function') UI.createSearchableSelect(selectId);
                }
            });
        });
        // Šipky pro měsíc/rok když je dropdown zavřený (jako v heatmapě plateb)
        const nowYear = new Date().getFullYear();
        _cache.forEach(imp => {
            if (imp.approved_at) return;
            ['year-from', 'year-to'].forEach(name => {
                const selectId = 'import-' + name + '-' + imp.id;
                const selectEl = document.getElementById(selectId);
                const wrap = document.querySelector('.searchable-select-wrap[data-for="' + selectId + '"]');
                const input = wrap && wrap.querySelector('.searchable-select-input');
                if (!selectEl || !input) return;
                input.addEventListener('keydown', function (e) {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    const dropdown = wrap.querySelector('.searchable-select-dropdown');
                    if (dropdown && dropdown.classList.contains('show')) return;
                    e.preventDefault();
                    const delta = e.key === 'ArrowUp' ? 1 : -1;
                    let y = parseInt(selectEl.value, 10) || nowYear;
                    y += delta;
                    if (y > nowYear) y = nowYear;
                    if (y < nowYear - 15) y = nowYear - 15;
                    selectEl.value = String(y);
                    if (typeof UI.updateSearchableSelectDisplay === 'function') UI.updateSearchableSelectDisplay(selectId);
                    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
            ['month-from', 'month-to'].forEach(name => {
                const selectId = 'import-' + name + '-' + imp.id;
                const selectEl = document.getElementById(selectId);
                const wrap = document.querySelector('.searchable-select-wrap[data-for="' + selectId + '"]');
                const input = wrap && wrap.querySelector('.searchable-select-input');
                if (!selectEl || !input) return;
                input.addEventListener('keydown', function (e) {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    const dropdown = wrap.querySelector('.searchable-select-dropdown');
                    if (dropdown && dropdown.classList.contains('show')) return;
                    e.preventDefault();
                    const delta = e.key === 'ArrowUp' ? 1 : -1;
                    let m = parseInt(selectEl.value, 10) || 1;
                    m += delta;
                    if (m > 12) m = 1;
                    if (m < 1) m = 12;
                    selectEl.value = String(m);
                    if (typeof UI.updateSearchableSelectDisplay === 'function') UI.updateSearchableSelectDisplay(selectId);
                    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
        });

        tbody.querySelectorAll('.import-contract').forEach(el => {
            el.addEventListener('change', () => savePairing(parseInt(el.getAttribute('data-id'), 10), 'contracts_id', el.value));
        });
        tbody.querySelectorAll('.import-year-from, .import-month-from').forEach(el => {
            el.addEventListener('change', () => {
                const id = parseInt(el.getAttribute('data-id'), 10);
                const y = document.getElementById('import-year-from-' + id);
                const m = document.getElementById('import-month-from-' + id);
                savePairing(id, 'period', { period_year: y ? y.value : '', period_month: m ? m.value : '' });
            });
        });
        tbody.querySelectorAll('.import-year-to, .import-month-to').forEach(el => {
            el.addEventListener('change', () => {
                const id = parseInt(el.getAttribute('data-id'), 10);
                const y = document.getElementById('import-year-to-' + id);
                const m = document.getElementById('import-month-to-' + id);
                savePairing(id, 'period_to', { period_year_to: y ? y.value : '', period_month_to: m ? m.value : '' });
            });
        });
        tbody.querySelectorAll('.import-type').forEach(el => {
            el.addEventListener('change', () => savePairing(parseInt(el.getAttribute('data-id'), 10), 'payment_type', el.value));
        });
        tbody.querySelectorAll('.import-request').forEach(el => {
            el.addEventListener('change', () => savePairing(parseInt(el.getAttribute('data-id'), 10), 'payment_request_id', el.value ? parseInt(el.value, 10) : null));
        });
        tbody.querySelectorAll('.import-contract').forEach(el => {
            el.addEventListener('change', async function () {
                const id = parseInt(this.getAttribute('data-id'), 10);
                const cid = this.value ? parseInt(this.value, 10) : 0;
                const reqSel = document.getElementById('import-request-' + id);
                const row = _cache.find(r => r.id === id);
                if (row) {
                    row.payment_request_id = null;
                    if (reqSel) {
                        try {
                            await savePairing(id, 'payment_request_id', null);
                        } catch (e) {}
                        if (cid) {
                            try {
                                const list = await Api.crudList('payment_requests', { contracts_id: cid });
                                _requestsByContract[cid] = list || [];
                                reqSel.innerHTML = requestOptions(list || [], null);
                            } catch (e) {
                                reqSel.innerHTML = requestOptions([], null);
                            }
                        } else {
                            reqSel.innerHTML = requestOptions([], null);
                        }
                    }
                }
            });
        });
        tbody.querySelectorAll('.import-cb').forEach(el => {
            el.addEventListener('change', updateApproveButton);
        });
        tbody.querySelectorAll('.import-del').forEach(el => {
            el.addEventListener('click', () => deleteOne(parseInt(el.getAttribute('data-id'), 10)));
        });

        const selectAllEl = document.getElementById('import-select-all');
        if (selectAllEl && !selectAllEl.dataset.bound) {
            selectAllEl.dataset.bound = '1';
            selectAllEl.addEventListener('change', function () {
                document.querySelectorAll('#import-tbody .import-cb:not(:disabled)').forEach(cb => { cb.checked = this.checked; });
                updateApproveButton();
            });
        }
        updateApproveButton();
    }

    async function savePairing(id, field, value) {
        const row = _cache.find(r => r.id === id);
        if (!row) return;
        let data = {};
        if (field === 'contracts_id') data = { contracts_id: value ? parseInt(value, 10) : null };
        else if (field === 'period') data = { period_year: value.period_year ? parseInt(value.period_year, 10) : null, period_month: value.period_month ? parseInt(value.period_month, 10) : null };
        else if (field === 'period_to') data = { period_year_to: value.period_year_to ? parseInt(value.period_year_to, 10) : null, period_month_to: value.period_month_to ? parseInt(value.period_month_to, 10) : null };
        else if (field === 'payment_type') data = { payment_type: value };
        else if (field === 'payment_request_id') data = { payment_request_id: value };
        try {
            await Api.paymentImportEdit(id, data);
            Object.assign(row, data);
            const tr = document.querySelector('#import-tbody tr[data-id="' + id + '"]');
            if (tr) {
                const contractEl = tr.querySelector('.import-cell-contract');
                const periodFromEl = tr.querySelector('.import-cell-period-from');
                const periodToEl = tr.querySelector('.import-cell-period-to');
                const typeEl = tr.querySelector('.import-cell-type');
                if (contractEl) contractEl.classList.toggle('import-cell-paired', !!(row.contracts_id || row.suggested_contracts_id));
                if (periodFromEl) periodFromEl.classList.toggle('import-cell-paired', !!(row.period_year && row.period_month) || !!(row.suggested_period_year && row.suggested_period_month));
                if (periodToEl) periodToEl.classList.toggle('import-cell-paired', !!(row.period_year_to && row.period_month_to) || !!(row.suggested_period_year_to && row.suggested_period_month_to) || !!(row.suggested_period_year && row.suggested_period_month));
                if (typeEl) typeEl.classList.toggle('import-cell-paired', !!(row.payment_type || row.suggested_payment_type));
            }
            const cb = document.querySelector('.import-cb[data-id="' + id + '"]');
            if (cb) {
                const paired = effectivePairing(row);
                cb.disabled = !paired;
                cb.title = paired ? '' : 'Vyplňte smlouvu, období a typ platby';
            }
            updateApproveButton();
        } catch (e) {
            UI.alertShow('import-alert', e.message || 'Uložení se nezdařilo.');
        }
    }

    async function deleteOne(id) {
        if (!confirm('Smazat tento import?')) return;
        try {
            await Api.paymentImportDelete(id);
            _cache = _cache.filter(r => r.id !== id);
            await loadList();
        } catch (e) {
            UI.alertShow('import-alert', e.message || 'Smazání se nezdařilo.');
        }
    }

    async function approveSelected() {
        const checked = document.querySelectorAll('#import-tbody input.import-cb:checked');
        const ids = Array.from(checked).map(cb => parseInt(cb.getAttribute('data-id'), 10));
        const ready = ids.filter(id => {
            const row = _cache.find(r => r.id === id);
            return row && !row.approved_at && !row.overpayment && effectivePairing(row);
        });
        if (ready.length === 0) return;
        try {
            // U řádků s jen návrhem (bez uloženého párování) nejdřív uložíme návrh
            for (const id of ready) {
                const row = _cache.find(r => r.id === id);
                if (!row || row.contracts_id) continue;
                const cid = row.suggested_contracts_id;
                const py = row.suggested_period_year;
                const pm = row.suggested_period_month;
                if (!cid || !py || !pm) continue;
                const pyTo = row.suggested_period_year_to ?? row.suggested_period_year;
                const pmTo = row.suggested_period_month_to ?? row.suggested_period_month;
                const ptype = row.suggested_payment_type || 'rent';
                await Api.paymentImportEdit(id, { contracts_id: cid, period_year: py, period_month: pm, period_year_to: pyTo, period_month_to: pmTo, payment_type: ptype, payment_request_id: row.payment_request_id || undefined });
                Object.assign(row, { contracts_id: cid, period_year: py, period_month: pm, period_year_to: pyTo, period_month_to: pmTo, payment_type: ptype });
            }
            const res = await Api.paymentImportsApprove(ready);
            UI.alertShow('import-alert', 'Schváleno ' + (res.approved || 0) + ' importů, vytvořeno ' + (res.created || 0) + ' plateb.' + (res.errors && res.errors.length ? ' Chyby: ' + res.errors.join(' ') : ''), 'ok');
            await loadList();
        } catch (e) {
            UI.alertShow('import-alert', e.message || 'Schválení se nezdařilo.');
        }
    }

    async function load() {
        await loadContractsAndBanks();
        fillFilterDropdowns();
        document.getElementById('import-filter-btn').addEventListener('click', loadList);
        document.getElementById('import-approve-btn').addEventListener('click', approveSelected);
        await loadList();
    }

    return { load };
})();

App.registerView('payment_imports', PaymentImportsView.load);
window.PaymentImportsView = PaymentImportsView;
