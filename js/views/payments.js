// js/views/payments.js

const PaymentsView = (() => {
    let form = null;
    let contractsCache = [];   // all active contracts (with names)
    let bankAccountsCache = []; // bank accounts for select
    let propertiesCache = [];  // all properties for filter
    let filterContractId = 0;  // current filter (API)
    let filterPropertyId = 0;  // filter by property (API)
    let filterTenantId = 0;    // filter by tenant (API)
    let _payCache = [];        // last loaded rows (before client-side filters)

    // ── init form (once) ────────────────────────────────────────────────
    function initForm() {
        if (form) return;
        form = UI.createCrudForm({
            table:      'payments',
            alertId:    'pay-alert',
            titleId:    'pay-form-title',
            saveId:     'btn-pay-save',
            cancelId:   'btn-pay-cancel',
            editIdField:'pay-edit-id',
            formCardId: 'pay-form-card',
            addBtnId:   'btn-pay-add',
            addLabel:   'Zaznamenat platbu',
            editLabel:  'Uložit změny',
            successAddMsg: 'Platba byla úspěšně zaznamenána.',
            successEditMsg: 'Platba byla úspěšně aktualizována.',
            validate(values, editMode) {
                if (!values.contracts_id || values.contracts_id <= 0) return 'Vyberte smlouvu.';
                const amt = parseFloat(values.amount);
                if (isNaN(amt) || amt === 0) return 'Zadejte částku.';
                if (!values.payment_date) return 'Vyplňte datum platby.';
                if (!UI.isDateValid(values.payment_date)) return 'Datum platby: zadejte platné datum (např. únor má max. 29 dní).';
                if (values.payment_method === 'account' && (!values.bank_accounts_id || values.bank_accounts_id <= 0)) return 'Vyberte bankovní účet.';
                if (values.period_year_to != null) {
                    const tsFrom = values.period_year * 12 + values.period_month;
                    const tsTo = values.period_year_to * 12 + values.period_month_to;
                    if (tsFrom > tsTo) return 'Měsíc „od“ musí být před měsícem „do“.';
                }
                return null;
            },
            getValues() {
                const editId = document.getElementById('pay-edit-id').value;
                const bulk = !editId && document.getElementById('pay-bulk').checked;
                const methodEl = document.getElementById('pay-method');
                const accountEl = document.getElementById('pay-account');
                const method = methodEl.value === 'account' || methodEl.value === 'cash' ? methodEl.value : 'account';
                const accId = method === 'account' ? Number(accountEl.value || 0) : null;
                const base = {
                    contracts_id: Number(document.getElementById('pay-contract').value),
                    amount:       document.getElementById('pay-amount').value,
                    payment_date: document.getElementById('pay-date').value,
                    note:         document.getElementById('pay-note').value.trim(),
                    counterpart_account: document.getElementById('pay-counterpart-account').value.trim() || null,
                    payment_method: method,
                    bank_accounts_id: accId || null,
                    payment_type: document.getElementById('pay-type').value || 'rent',
                };
                if (bulk) {
                    base.period_year  = Number(document.getElementById('pay-year-from').value);
                    base.period_month = Number(document.getElementById('pay-month-from').value);
                    base.period_year_to  = Number(document.getElementById('pay-year-to').value);
                    base.period_month_to = Number(document.getElementById('pay-month-to').value);
                } else {
                    base.period_year  = Number(document.getElementById('pay-year').value);
                    base.period_month = Number(document.getElementById('pay-month').value);
                }
                return base;
            },
            async fillForm(row) {
                document.getElementById('pay-edit-id').value = String(row.payments_id ?? row.id);
                document.getElementById('pay-contract').value = row.contracts_id || '';
                document.getElementById('pay-type').value    = row.payment_type || 'rent';
                document.getElementById('pay-year').value     = row.period_year  || '';
                document.getElementById('pay-month').value    = row.period_month || '';
                document.getElementById('pay-amount').value   = row.amount       || '';
                document.getElementById('pay-date').value     = row.payment_date || '';
                document.getElementById('pay-method').value  = row.payment_method === 'cash' ? 'cash' : 'account';
                const accSel = document.getElementById('pay-account');
                const accId = row.bank_accounts_id || '';
                accSel.value = accId;
                document.getElementById('pay-note').value     = row.note         || '';
                const accWrap = document.getElementById('pay-account-wrap');
                accWrap.style.display = row.payment_method === 'cash' ? 'none' : 'block';
                const batchHint = document.getElementById('pay-batch-hint');
                if (batchHint) batchHint.style.display = row.payment_batch_id ? 'block' : 'none';
                const linkWrap = document.getElementById('pay-request-link-wrap');
                if (linkWrap) {
                    linkWrap.style.display = 'block';
                    const linkedEl = document.getElementById('pay-linked-request');
                    const linkRow = document.getElementById('pay-link-row');
                    const payId = row.payments_id ?? row.id;
                    if (row.linked_payment_request_id) {
                        const note = row.linked_request_note || (UI.fmt(Number(row.linked_request_amount)) + ' Kč');
                        linkedEl.innerHTML = '<span class="tag tag-request-linked">' + UI.esc(note) + '</span> ' +
                            '<button type="button" class="btn btn-ghost btn-sm" id="btn-pay-edit-request" title="Upravit požadavek">Upravit požadavek</button> ' +
                            '<button type="button" class="btn btn-ghost btn-sm" id="btn-pay-unlink-request">Odpojit</button>';
                        if (linkRow) linkRow.style.display = 'none';
                        const editReqBtn = document.getElementById('btn-pay-edit-request');
                        if (editReqBtn && typeof window.openPaymentRequestEdit === 'function') {
                            editReqBtn.onclick = () => {
                                window.openPaymentRequestEdit(row.linked_payment_request_id, () => { PaymentsView.edit(row.payments_id ?? row.id); });
                            };
                        }
                        const unlinkBtn = document.getElementById('btn-pay-unlink-request');
                        if (unlinkBtn) unlinkBtn.onclick = async () => {
                            try {
                                await Api.paymentRequestUnlink(row.linked_payment_request_id);
                                await renderPayments();
                                form.exitEdit();
                            } catch (e) { UI.alert(form.alertId, e.message); }
                        };
                    } else {
                        linkedEl.innerHTML = '<span style="color:var(--txt3)">Tato platba není přiřazena k požadavku.</span>';
                        if (linkRow) linkRow.style.display = 'flex';
                        const reqSelect = document.getElementById('pay-request-select');
                        const linkBtn = document.getElementById('btn-pay-link-request');
                        const requests = await Api.crudList('payment_requests', { contracts_id: row.contracts_id });
                        const typeLabels = { energy: 'Energie', settlement: 'Vyúčtování', other: 'Jiné', deposit: 'Kauce', deposit_return: 'Vrácení kauce' };
                        reqSelect.innerHTML = '<option value="">— Přiřadit k požadavku —</option>' + requests.map(pr => {
                            const eid = pr.payment_requests_id ?? pr.id;
                            const label = (UI.fmt(Number(pr.amount)) + ' Kč') + (pr.note ? ' – ' + pr.note : '') + ' (' + (typeLabels[pr.type] || pr.type) + ')';
                            return '<option value="' + eid + '">' + UI.esc(label) + '</option>';
                        }).join('');
                        if (linkBtn) linkBtn.onclick = async () => {
                            const prId = Number(reqSelect.value);
                            if (!prId) return;
                            try {
                                await Api.paymentRequestLink(prId, payId);
                                await renderPayments();
                                form.exitEdit();
                            } catch (e) { UI.alert(form.alertId, e.message); }
                        };
                    }
                }
            },
            async editSave(id, values, row) {
                const batchId = (row && row.payment_batch_id) ? String(row.payment_batch_id).trim() : '';
                if (batchId) {
                    const batchData = {
                        payment_date: values.payment_date,
                        payment_method: values.payment_method || 'account',
                        bank_accounts_id: values.bank_accounts_id || null,
                        payment_type: values.payment_type || 'rent',
                    };
                    const origAmt = row ? parseFloat(row.amount) : 0;
                    const newAmt = parseFloat(values.amount) || 0;
                    if (newAmt !== origAmt) {
                        batchData.amount_override_id = id;
                        batchData.amount_override_value = newAmt;
                    }
                    await Api.paymentsEditBatch(batchId, batchData);
                } else {
                    await Api.crudEdit('payments', id, values);
                }
            },
            resetForm() {
                const batchHint = document.getElementById('pay-batch-hint');
                if (batchHint) batchHint.style.display = 'none';
                const linkWrap = document.getElementById('pay-request-link-wrap');
                if (linkWrap) linkWrap.style.display = 'none';
                document.getElementById('pay-contract').value = '';
                document.getElementById('pay-amount').value   = '';
                document.getElementById('pay-note').value     = '';
                document.getElementById('pay-counterpart-account').value = '';
                document.getElementById('pay-date').value     = todayISO();
                document.getElementById('pay-method').value   = 'account';
                document.getElementById('pay-type').value     = 'rent';
                const primary = bankAccountsCache.find(b => b.is_primary);
                document.getElementById('pay-account').value = primary ? (primary.bank_accounts_id ?? primary.id) : '';
                document.getElementById('pay-bulk').checked   = false;
                document.getElementById('pay-single-row').style.display = '';
                document.getElementById('pay-range-row').style.display = 'none';
                document.getElementById('pay-account-wrap').style.display = 'block';
            },
            onSaved: renderPayments,
        });

        // Auto-fill amount + aktualizace roku podle smlouvy
        document.getElementById('pay-contract').addEventListener('change', function () {
            const val = Number(this.value);
            const c   = contractsCache.find(x => (x.contracts_id ?? x.id) === val);
            updateYearSelects();
            if (c) {
                const bulk = document.getElementById('pay-bulk').checked;
                const amtEl = document.getElementById('pay-amount');
                if (!amtEl.value) {
                    amtEl.value = bulk ? Math.round(c.monthly_rent * 12) : c.monthly_rent;
                }
            }
        });

        const propFilterEl = document.getElementById('pay-filter-property');
        const tenantFilterEl = document.getElementById('pay-filter-tenant');
        if (propFilterEl) {
            propFilterEl.addEventListener('change', function () {
                filterPropertyId = parseInt(this.value, 10) || 0;
                filterContractId = 0;
                const conSel = document.getElementById('pay-filter-contract');
                if (conSel) conSel.value = '';
                if (typeof UI.updateSearchableSelectDisplay === 'function') UI.updateSearchableSelectDisplay('pay-filter-contract');
                renderPayments(true);
            });
        }
        if (tenantFilterEl) {
            tenantFilterEl.addEventListener('change', function () {
                filterTenantId = parseInt(this.value, 10) || 0;
                filterContractId = 0;
                const conSel = document.getElementById('pay-filter-contract');
                if (conSel) conSel.value = '';
                if (typeof UI.updateSearchableSelectDisplay === 'function') UI.updateSearchableSelectDisplay('pay-filter-contract');
                renderPayments(true);
            });
        }
        document.getElementById('pay-filter-contract').addEventListener('change', function () {
            filterContractId = Number(this.value);
            filterPropertyId = 0;
            filterTenantId = 0;
            if (propFilterEl) propFilterEl.value = '';
            if (tenantFilterEl) tenantFilterEl.value = '';
            if (typeof UI.updateSearchableSelectDisplay === 'function') {
                UI.updateSearchableSelectDisplay('pay-filter-property');
                UI.updateSearchableSelectDisplay('pay-filter-tenant');
            }
            renderPayments(true);
        });
        // Filtry rok, měsíc, typ – při filtru po nemovitosti refetch (server), jinak jen client-side
        ['pay-filter-year', 'pay-filter-month', 'pay-filter-type'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => {
                const refetch = filterPropertyId && (id === 'pay-filter-year' || id === 'pay-filter-month');
                renderPayments(refetch);
            });
        });
        const approvedFilterEl = document.getElementById('pay-filter-approved');
        if (approvedFilterEl) approvedFilterEl.addEventListener('change', () => { renderPayments(true); });
        const searchEl = document.getElementById('pay-filter-search');
        if (searchEl) {
            let searchDebounce = null;
            searchEl.addEventListener('input', () => {
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(() => renderPayments(false), 200);
            });
        }

        // Způsob platby: zobrazit/skrýt číslo účtu
        document.getElementById('pay-method').addEventListener('change', function () {
            document.getElementById('pay-account-wrap').style.display = this.value === 'account' ? 'block' : 'none';
        });
    }

    // ── year dropdowns (one-time init) ──────────────────────────────────
    (function initYearSelects() {
        const now = new Date().getFullYear();
        const opts = [];
        for (let y = now - 2; y <= now + 1; y++) {
            opts.push('<option value="' + y + '"' + (y === now ? ' selected' : '') + '>' + y + '</option>');
        }
        const optsStr = opts.join('');
        document.getElementById('pay-year').innerHTML += optsStr;
        document.getElementById('pay-year-from').innerHTML = optsStr;
        document.getElementById('pay-year-to').innerHTML = optsStr;
        document.getElementById('pay-month').value = new Date().getMonth() + 1;
        document.getElementById('pay-date').value = todayISO();
    })();

    // ── bulk checkbox toggle ───────────────────────────────────────────
    (function initBulkToggle() {
        const bulk = document.getElementById('pay-bulk');
        const singleRow = document.getElementById('pay-single-row');
        const rangeRow = document.getElementById('pay-range-row');
        bulk.addEventListener('change', () => {
            const isBulk = bulk.checked;
            singleRow.style.display = isBulk ? 'none' : '';
            rangeRow.style.display = isBulk ? '' : 'none';
            if (isBulk) {
                const c = contractsCache.find(x => (x.contracts_id ?? x.id) === Number(document.getElementById('pay-contract').value));
                const now = new Date();
                const y = now.getFullYear();
                document.getElementById('pay-year-from').value = y;
                document.getElementById('pay-month-from').value = 1;
                document.getElementById('pay-year-to').value = y;
                document.getElementById('pay-month-to').value = 12;
                if (c) document.getElementById('pay-amount').value = Math.round(c.monthly_rent * 12);
            }
        });
    })();

    function todayISO() {
        return new Date().toISOString().slice(0, 10);
    }

    // ── year dropdowns – rozsah podle smlouvy (min. od contract_start) ─────
    function updateYearSelects() {
        const now = new Date().getFullYear();
        const c = contractsCache.find(x => (x.contracts_id ?? x.id) === Number(document.getElementById('pay-contract').value));
        const startYear = c && c.contract_start ? parseInt(c.contract_start.slice(0, 4), 10) : now - 10;
        const minY = Math.min(startYear, now - 2);
        const maxY = now + 2;
        const opts = [];
        for (let y = minY; y <= maxY; y++) {
            opts.push('<option value="' + y + '"' + (y === now ? ' selected' : '') + '>' + y + '</option>');
        }
        const optsStr = opts.join('');
        document.getElementById('pay-year').innerHTML = optsStr;
        document.getElementById('pay-year-from').innerHTML = optsStr;
        document.getElementById('pay-year-to').innerHTML = optsStr;
        const curYear = document.getElementById('pay-year').value;
        if (!curYear || curYear < minY || curYear > maxY) {
            document.getElementById('pay-year').value = now;
            document.getElementById('pay-year-from').value = now;
            document.getElementById('pay-year-to').value = now;
        }
    }

    // ── fill bank account select ───────────────────────────────────────
    function fillBankAccountSelect(selId) {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const primary = bankAccountsCache.find(b => b.is_primary);
        const defaultId = primary ? (primary.bank_accounts_id ?? primary.id) : '';
        sel.innerHTML = '<option value="">— Vyberte účet —</option>' +
            bankAccountsCache.map(b => {
                const bid = b.bank_accounts_id ?? b.id;
                return '<option value="' + bid + '"' + (bid == defaultId ? ' selected' : '') + '>' +
                    UI.esc(b.name) + (b.account_number ? ' – ' + UI.esc(b.account_number) : '') +
                '</option>';
            }).join('');
    }

    // ── fill contract dropdowns (form + filter) ────────────────────────
    async function fillDropdowns() {
        let tenantsCache = [];
        [contractsCache, bankAccountsCache, propertiesCache, tenantsCache] = await Promise.all([
            Api.crudList('contracts'),
            Api.crudList('bank_accounts'),
            Api.crudList('properties'),
            Api.crudList('tenants'),
        ]);

        fillBankAccountSelect('pay-account');

        const cid = (c) => c.contracts_id ?? c.id;
        const opts = '<option value="">— Vyberte smlouvu —</option>' +
            contractsCache.map(c =>
                '<option value="' + cid(c) + '">' +
                    UI.esc(c.tenant_name) + ' – ' + UI.esc(c.property_name) +
                    ' (' + UI.fmt(c.monthly_rent) + ' Kč/měs.)' +
                '</option>'
            ).join('');
        document.getElementById('pay-contract').innerHTML = opts;

        // Filter: Nemovitost
        const propSel = document.getElementById('pay-filter-property');
        if (propSel) {
            const pid = (p) => p.properties_id ?? p.id;
            propSel.innerHTML = '<option value="">— Všechny —</option>' +
                propertiesCache.map(p => '<option value="' + pid(p) + '" title="' + UI.esc(p.name) + '"' + (filterPropertyId === pid(p) ? ' selected' : '') + '>' + UI.esc(p.name) + '</option>').join('');
        }
        // Filter: Nájemník
        const tenantFilterSel = document.getElementById('pay-filter-tenant');
        if (tenantFilterSel && tenantsCache.length) {
            const tid = (t) => t.tenants_id ?? t.id;
            tenantFilterSel.innerHTML = '<option value="">— Všichni —</option>' +
                tenantsCache.map(t => '<option value="' + tid(t) + '" title="' + UI.esc(t.name) + '"' + (filterTenantId === tid(t) ? ' selected' : '') + '>' + UI.esc(t.name) + '</option>').join('');
        }
        // Filter: Smlouva
        const fOpts = '<option value="">— Všechny smlouvy —</option>' +
            contractsCache.map(c => {
                const label = UI.esc(c.tenant_name) + ' – ' + UI.esc(c.property_name);
                return '<option value="' + cid(c) + '" title="' + label + '"' + (filterContractId === cid(c) ? ' selected' : '') + '>' + label + '</option>';
            }).join('');
        document.getElementById('pay-filter-contract').innerHTML = fOpts;
        // Roky do filtru (posledních 15 + aktuální)
        const yearSel = document.getElementById('pay-filter-year');
        if (yearSel) {
            const now = new Date().getFullYear();
            const existing = yearSel.querySelectorAll('option');
            if (existing.length <= 1) {
                let yopts = '<option value="">— Všechny —</option>';
                for (let y = now; y >= now - 15; y--) yopts += '<option value="' + y + '">' + y + '</option>';
                yearSel.innerHTML = yopts;
            }
        }
        // Našeptávač u všech filtrů
        if (typeof UI.createSearchableSelect === 'function') {
            ['pay-filter-property', 'pay-filter-tenant', 'pay-filter-contract', 'pay-filter-year', 'pay-filter-month', 'pay-filter-type'].forEach(id => {
                if (!document.querySelector('.searchable-select-wrap[data-for="' + id + '"]')) {
                    UI.createSearchableSelect(id);
                }
            });
        }
        if (typeof UI.updateSearchableSelectDisplay === 'function') {
            ['pay-filter-property', 'pay-filter-tenant', 'pay-filter-contract', 'pay-filter-year', 'pay-filter-month', 'pay-filter-type'].forEach(UI.updateSearchableSelectDisplay);
        }
        updateYearSelects();
    }

    function getPaymentsEmptyMsg(filteredToZero) {
        if (filteredToZero) return 'Žádné platby nevyhovují filtrům.';
        if (filterContractId) return 'Žádné platby pro tuto smlouvu.';
        if (filterPropertyId) return 'Žádné platby pro tuto nemovitost.';
        if (filterTenantId) return 'Žádné platby pro tohoto nájemníka.';
        return 'Žádné platby.';
    }

    let _paySortState = { order: [{ key: 'period_year', dir: 'desc' }, { key: 'period_month', dir: 'desc' }] };

    function getPaySortValue(p, key) {
        switch (key) {
            case 'tenant_name': return (p.tenant_name || '').toLowerCase();
            case 'period_year': return Number(p.period_year) || 0;
            case 'period_month': return Number(p.period_month) || 0;
            case 'payment_type': return (p.payment_type || 'rent').toLowerCase();
            case 'amount': return parseFloat(p.amount) || 0;
            case 'payment_date': return p.payment_date || '';
            case 'note': return (p.note || '').toLowerCase();
            default: return '';
        }
    }

    function comparePayValues(va, vb) {
        if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb);
        return va < vb ? -1 : (va > vb ? 1 : 0);
    }

    function sortPayments(data, state) {
        const order = state.order && state.order.length ? state.order : [{ key: 'period_year', dir: 'desc' }, { key: 'period_month', dir: 'desc' }];
        return [...data].sort((a, b) => {
            for (let i = 0; i < order.length; i++) {
                const { key, dir } = order[i];
                const cmp = comparePayValues(getPaySortValue(a, key), getPaySortValue(b, key));
                if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
            }
            return 0;
        });
    }

    // ── apply client-side filters (rok, měsíc, typ, vyhledávání) ─────────
    function applyPaymentFilters(rows) {
        const year = document.getElementById('pay-filter-year');
        const month = document.getElementById('pay-filter-month');
        const type = document.getElementById('pay-filter-type');
        const search = document.getElementById('pay-filter-search');
        let out = rows || [];
        if (year && year.value) {
            const y = parseInt(year.value, 10);
            out = out.filter(p => Number(p.period_year) === y);
        }
        if (month && month.value) {
            const m = parseInt(month.value, 10);
            out = out.filter(p => Number(p.period_month) === m);
        }
        if (type && type.value) {
            out = out.filter(p => (p.payment_type || 'rent') === type.value);
        }
        if (search && search.value.trim()) {
            const q = search.value.trim().toLowerCase();
            out = out.filter(p => {
                const tenant = (p.tenant_name || '').toLowerCase();
                const property = (p.property_name || '').toLowerCase();
                const note = (p.note || '').toLowerCase();
                const counterpart = (p.counterpart_account || '').toLowerCase();
                const amountStr = String(p.amount || '');
                return tenant.includes(q) || property.includes(q) || note.includes(q) || counterpart.includes(q) || amountStr.includes(q);
            });
        }
        return out;
    }

    // ── render payments table ───────────────────────────────────────────
    async function renderPayments(forceRefetch = true) {
        if (forceRefetch) {
            let params = {};
            if (filterContractId) {
                params = { contracts_id: filterContractId };
            } else if (filterPropertyId) {
                params = { properties_id: filterPropertyId };
                const yearSel = document.getElementById('pay-filter-year');
                const monthSel = document.getElementById('pay-filter-month');
                const y = yearSel && yearSel.value ? parseInt(yearSel.value, 10) : 0;
                const m = monthSel && monthSel.value ? parseInt(monthSel.value, 10) : 0;
                if (y) params.period_year = y;
                if (m) params.period_month = m;
            }
            const approvedFilter = document.getElementById('pay-filter-approved');
            if (approvedFilter && approvedFilter.checked) params.approved = '0';
            try {
                _payCache = await Api.crudList('payments', params);
            } catch (e) { return; }
        }
        const filtered = applyPaymentFilters(_payCache);
        const sorted = sortPayments(filtered, _paySortState);
        const rowsWithClass = sorted.map(p => ({ ...p, _rowClass: 'pay-type-' + (p.payment_type || 'rent') }));
        UI.renderTable('pay-table',
            [
                { label: 'Smlouva', sortKey: 'tenant_name' },
                { label: 'Stav', hideMobile: true },
                { label: 'Období', sortKey: 'period_year' },
                { label: 'Typ', sortKey: 'payment_type', hideMobile: true },
                { label: 'Částka', sortKey: 'amount' },
                { label: 'Datum', sortKey: 'payment_date', hideMobile: true },
                { label: 'Způsob', hideMobile: true },
                { label: 'Protiúčet', hideMobile: true },
                { label: 'Vs. nájemné', hideMobile: true },
                { label: 'Poznámka', sortKey: 'note', hideMobile: true },
                { label: 'Akce', act: true },
            ],
            rowsWithClass,
            (p) => {
                const rent = Number(p.monthly_rent);
                const amt  = Number(p.amount);
                const typeLabels = { rent: 'Nájem', deposit: 'Kauce', deposit_return: 'Vrácení kauce', energy: 'Doplatek energie', other: 'Jiné' };
                const typeLabel = typeLabels[p.payment_type] || 'Nájem';
                const isRent = p.payment_type === 'rent';
                const diff = isRent ? amt - rent : null;

                let diffHtml;
                if (diff !== null) {
                    if      (diff < 0)  diffHtml = '<span style="color:var(--red)">−' + UI.fmt(Math.abs(diff)) + ' Kč</span>';
                    else if (diff > 0)  diffHtml = '<span style="color:var(--green)">+' + UI.fmt(diff) + ' Kč</span>';
                    else                diffHtml = '<span style="color:var(--green)">✓ přesně</span>';
                } else {
                    diffHtml = '<span style="color:var(--txt3)">—</span>';
                }

                const methodLabel = p.payment_method === 'cash' ? 'Hotovost' : (p.account_number ? 'Účet ' + UI.esc(p.account_number) : 'Na účet');
                const batchHint = p.payment_batch_id ? '<br><span class="tag tag-batch" title="Součást jedné platby">dávka</span>' : '';
                const linkedReq = p.linked_payment_request_id ? ('<br><span class="tag tag-request-linked" title="Úhrada požadavku">Úhrada pož.: ' + (p.linked_request_note ? UI.esc(p.linked_request_note) : (UI.fmt(Number(p.linked_request_amount)) + ' Kč')) + '</span>') : '';
                const approvedBadge = !p.approved_at ? '<span class="badge badge-warning" title="Platba čeká na schválení (např. po načtení z FIO)">Ke schválení</span>' : '<span class="badge badge-ok" title="Schváleno">Schváleno</span>';
                return (
                    '<td><strong>' + UI.esc(p.tenant_name) + '</strong><br><span style="color:var(--txt3);font-size:.8em">' + UI.esc(p.property_name) + '</span></td>' +
                    '<td class="col-hide-mobile">' + approvedBadge + '</td>' +
                    '<td>' + UI.MONTHS[p.period_month] + ' ' + p.period_year + batchHint + '</td>' +
                    '<td class="col-hide-mobile">' + UI.esc(typeLabel) + '</td>' +
                    '<td>' + UI.fmt(amt) + ' Kč</td>' +
                    '<td class="col-hide-mobile">' + (p.payment_date ? UI.fmtDate(p.payment_date) : '—') + '</td>' +
                    '<td class="col-hide-mobile">' + UI.esc(methodLabel) + '</td>' +
                    '<td class="col-hide-mobile">' + (p.counterpart_account ? UI.esc(p.counterpart_account) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                    '<td class="col-hide-mobile">' + diffHtml + '</td>' +
                    '<td class="col-note cell-note-wrap col-hide-mobile">' + (p.note ? '<span class="cell-note-truncate" title="' + UI.esc(p.note) + '">' + UI.esc(p.note) + '</span>' : '<span style="color:var(--txt3)">—</span>') + linkedReq + '</td>' +
                    '<td class="td-act">' +
                        '<button class="btn btn-ghost btn-sm" onclick="PaymentsView.edit(' + (p.payments_id ?? p.id) + ')">Úprava</button>' +
                        '<button class="btn btn-danger btn-sm" onclick="PaymentsView.del(' + (p.payments_id ?? p.id) + ')">Smazat</button>' +
                    '</td>'
                );
            },
            { emptyMsg: getPaymentsEmptyMsg(filtered.length === 0 && _payCache.length > 0), sortable: { order: _paySortState.order }, striped: true }
        );

        if (filtered.length > 0) {
            const sum = filtered.reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const table = document.getElementById('pay-table').querySelector('table');
            if (table) {
                const tfoot = document.createElement('tfoot');
                tfoot.innerHTML =
                    '<tr class="tbl-total-row">' +
                    '<td colspan="3"><strong>Celkem</strong></td>' +
                    '<td><strong>' + UI.fmt(sum) + ' Kč</strong></td>' +
                    '<td colspan="7" class="col-hide-mobile"></td>' +
                    '</tr>';
                table.appendChild(tfoot);
            }
        }
    }

    // ── exposed actions ─────────────────────────────────────────────────

    function edit(id) {
        const row = _payCache.find(r => (r.payments_id ?? r.id) == id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('payments', id, 'Smazat tuto platbu?', renderPayments);
    }

    // ── cross-view entry points ─────────────────────────────────────────
    // Volané z ContractsView / DashboardView
    function navigateWithFilter(contractId) {
        filterContractId = contractId;
        App.navigateWithHistory('payments');
    }

    // Prefill form (z dashboard quick-add tag)
    function prefill(contractId, year, month, rent) {
        form.startAdd();
        document.getElementById('pay-contract').value = contractId;
        document.getElementById('pay-year').value     = year;
        document.getElementById('pay-month').value    = month;
        document.getElementById('pay-amount').value   = rent;
        document.getElementById('pay-date').value     = todayISO();
    }

    // ── parse hash params (payments&year=2024&properties_id=5) ───────────
    function applyHashParams() {
        const raw = (location.hash.slice(1) || '').toLowerCase();
        if (!raw.startsWith('payments')) return;
        const parts = raw.split('&').slice(1);
        let year = '', propId = '';
        parts.forEach(p => {
            const eq = p.indexOf('=');
            if (eq > 0) {
                const k = p.slice(0, eq);
                const v = decodeURIComponent(p.slice(eq + 1));
                if (k === 'year') year = v;
                if (k === 'properties_id') propId = v;
            }
        });
        filterContractId = 0;
        filterPropertyId = parseInt(propId, 10) || 0;
        const propSel = document.getElementById('pay-filter-property');
        const yearSel = document.getElementById('pay-filter-year');
        if (propSel && filterPropertyId) propSel.value = String(filterPropertyId);
        if (yearSel && year) yearSel.value = year;
        if (typeof UI.updateSearchableSelectDisplay === 'function') {
            if (propSel) UI.updateSearchableSelectDisplay('pay-filter-property');
            if (yearSel) UI.updateSearchableSelectDisplay('pay-filter-year');
        }
    }

    function initPayTableSortClick() {
        const el = document.getElementById('pay-table');
        if (!el || el.dataset.sortBound) return;
        el.dataset.sortBound = '1';
        el.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-sort]');
            if (!th) return;
            const key = th.getAttribute('data-sort');
            if (!key) return;
            const order = _paySortState.order || [];
            const idx = order.findIndex(o => o.key === key);
            if (e.ctrlKey || e.metaKey) {
                if (idx >= 0) order[idx].dir = order[idx].dir === 'asc' ? 'desc' : 'asc';
                else order.push({ key, dir: 'asc' });
                _paySortState.order = order;
            } else {
                _paySortState.order = idx >= 0 && order.length === 1
                    ? [{ key, dir: order[idx].dir === 'asc' ? 'desc' : 'asc' }]
                    : [{ key, dir: 'asc' }];
            }
            renderPayments(false);
        });
    }

    // ── view loader ─────────────────────────────────────────────────────
    async function load() {
        initForm();
        initPayTableSortClick();
        form.exitEdit();
        await fillDropdowns();
        applyHashParams();
        await renderPayments(true);
        // Předvyplnění z FIO (Bankovní účty → Načíst z FIO → Přidat platbu)
        try {
            const raw = sessionStorage.getItem('paymentsFioPrefill');
            if (raw) {
                sessionStorage.removeItem('paymentsFioPrefill');
                const p = JSON.parse(raw);
                form.startAdd();
                const dateEl = document.getElementById('pay-date');
                const amountEl = document.getElementById('pay-amount');
                const accountEl = document.getElementById('pay-account');
                const counterpartEl = document.getElementById('pay-counterpart-account');
                const noteEl = document.getElementById('pay-note');
                const methodEl = document.getElementById('pay-method');
                if (dateEl && p.payment_date) dateEl.value = p.payment_date;
                if (amountEl && p.amount != null && p.amount !== '') amountEl.value = p.amount;
                if (accountEl && p.bank_accounts_id) accountEl.value = p.bank_accounts_id;
                if (counterpartEl && p.counterpart_account) counterpartEl.value = p.counterpart_account;
                if (noteEl && p.note) noteEl.value = p.note;
                if (methodEl) methodEl.value = 'account';
                const accWrap = document.getElementById('pay-account-wrap');
                if (accWrap) accWrap.style.display = '';
            }
        } catch (_) {}
    }

    return { load, edit, del, navigateWithFilter, prefill };
})();

App.registerView('payments', PaymentsView.load);
window.PaymentsView = PaymentsView;
