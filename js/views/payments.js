// js/views/payments.js

const PaymentsView = (() => {
    let form = null;
    let contractsCache = [];   // all active contracts (with names)
    let bankAccountsCache = []; // bank accounts for select
    let filterContractId = 0;  // current filter

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
                if (!values.payment_date) return 'Vyplňte datum platby.';
                if (!UI.isDateValid(values.payment_date)) return 'Datum platby: zadejte platné datum (např. únor má max. 29 dní).';
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
                const accVal = method === 'account' ? (accountEl.value || '').trim() : null;
                const base = {
                    contracts_id: Number(document.getElementById('pay-contract').value),
                    amount:       document.getElementById('pay-amount').value,
                    payment_date: document.getElementById('pay-date').value,
                    note:         document.getElementById('pay-note').value.trim(),
                    payment_method: method,
                    account_number: accVal || null,
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
            fillForm(row) {
                document.getElementById('pay-contract').value = row.contracts_id || '';
                document.getElementById('pay-year').value     = row.period_year  || '';
                document.getElementById('pay-month').value    = row.period_month || '';
                document.getElementById('pay-amount').value   = row.amount       || '';
                document.getElementById('pay-date').value     = row.payment_date || '';
                document.getElementById('pay-method').value  = row.payment_method === 'cash' ? 'cash' : 'account';
                const accSel = document.getElementById('pay-account');
                const accNum = row.account_number || '';
                if (accNum && !bankAccountsCache.some(b => b.account_number === accNum)) {
                    accSel.appendChild(new Option(accNum, accNum));
                }
                accSel.value = accNum;
                document.getElementById('pay-note').value     = row.note         || '';
                const accWrap = document.getElementById('pay-account-wrap');
                accWrap.style.display = row.payment_method === 'cash' ? 'none' : 'block';
            },
            resetForm() {
                document.getElementById('pay-contract').value = '';
                document.getElementById('pay-amount').value   = '';
                document.getElementById('pay-note').value     = '';
                document.getElementById('pay-date').value     = todayISO();
                document.getElementById('pay-method').value   = 'account';
                const primary = bankAccountsCache.find(b => b.is_primary);
                document.getElementById('pay-account').value = primary ? primary.account_number : '';
                document.getElementById('pay-bulk').checked   = false;
                document.getElementById('pay-single-row').style.display = '';
                document.getElementById('pay-range-row').style.display = 'none';
                document.getElementById('pay-account-wrap').style.display = 'block';
            },
            onSaved: renderPayments,
        });

        // Auto-fill amount when contract selection changes
        document.getElementById('pay-contract').addEventListener('change', function () {
            const val = Number(this.value);
            const c   = contractsCache.find(x => (x.contracts_id ?? x.id) === val);
            if (c) {
                const bulk = document.getElementById('pay-bulk').checked;
                const amtEl = document.getElementById('pay-amount');
                if (!amtEl.value) {
                    amtEl.value = bulk ? Math.round(c.monthly_rent * 12) : c.monthly_rent;
                }
            }
        });

        // Filter dropdown change
        document.getElementById('pay-filter-contract').addEventListener('change', function () {
            filterContractId = Number(this.value);
            renderPayments();
        });

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

    // ── fill bank account select ───────────────────────────────────────
    function fillBankAccountSelect(selId) {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const primary = bankAccountsCache.find(b => b.is_primary);
        const defaultVal = primary ? primary.account_number : '';
        sel.innerHTML = '<option value="">— Vyberte účet —</option>' +
            bankAccountsCache.map(b =>
                '<option value="' + UI.esc(b.account_number) + '"' + (b.account_number === defaultVal ? ' selected' : '') + '>' +
                    UI.esc(b.name) + (b.account_number ? ' – ' + UI.esc(b.account_number) : '') +
                '</option>'
            ).join('');
    }

    // ── fill contract dropdowns (form + filter) ────────────────────────
    async function fillDropdowns() {
        [contractsCache, bankAccountsCache] = await Promise.all([
            Api.crudList('contracts'),
            Api.crudList('bank_accounts'),
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

        // Filter dropdown
        const fOpts = '<option value="">— Všechny smlouvy —</option>' +
            contractsCache.map(c =>
                '<option value="' + cid(c) + '"' + (filterContractId === cid(c) ? ' selected' : '') + '>' +
                    UI.esc(c.tenant_name) + ' – ' + UI.esc(c.property_name) +
                '</option>'
            ).join('');
        document.getElementById('pay-filter-contract').innerHTML = fOpts;
    }

    // ── render payments table ───────────────────────────────────────────
    async function renderPayments() {
        const params = filterContractId ? { contracts_id: filterContractId } : {};
        let data;
        try { data = await Api.crudList('payments', params); }
        catch (e) { return; }

        // cache pro edit()
        _payCache = data;

        UI.renderTable('pay-table',
            [
                { label: 'Nájemník – Nemovitost' },
                { label: 'Období' },
                { label: 'Částka' },
                { label: 'Datum platby' },
                { label: 'Způsob platby' },
                { label: 'Vs. nájemné' },
                { label: 'Poznámka' },
                { label: 'Akce', act: true },
            ],
            data,
            (p) => {
                const rent = Number(p.monthly_rent);
                const amt  = Number(p.amount);
                const diff = amt - rent;

                let diffHtml;
                if      (diff < 0)  diffHtml = '<span style="color:var(--red)">−' + UI.fmt(Math.abs(diff)) + ' Kč</span>';
                else if (diff > 0)  diffHtml = '<span style="color:var(--green)">+' + UI.fmt(diff) + ' Kč</span>';
                else                diffHtml = '<span style="color:var(--green)">✓ přesně</span>';

                const methodLabel = p.payment_method === 'cash' ? 'Hotovost' : (p.account_number ? 'Účet ' + UI.esc(p.account_number) : 'Na účet');
                const batchHint = p.payment_batch_id ? ' <span class="tag tag-batch" title="Součást jedné platby">dávka</span>' : '';
                return (
                    '<td><strong>' + UI.esc(p.tenant_name) + '</strong> – ' + UI.esc(p.property_name) + '</td>' +
                    '<td>' + UI.MONTHS[p.period_month] + ' ' + p.period_year + batchHint + '</td>' +
                    '<td>' + UI.fmt(amt) + ' Kč</td>' +
                    '<td>' + UI.esc(p.payment_date) + '</td>' +
                    '<td>' + UI.esc(methodLabel) + '</td>' +
                    '<td>' + diffHtml + '</td>' +
                    '<td>' + (p.note ? UI.esc(p.note) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                    '<td class="td-act">' +
                        '<button class="btn btn-ghost btn-sm" onclick="PaymentsView.edit(' + p.id + ')">Úprava</button>' +
                        '<button class="btn btn-danger btn-sm" onclick="PaymentsView.del(' + p.id + ')">Smazat</button>' +
                    '</td>'
                );
            },
            { emptyMsg: filterContractId ? 'Žádné platby pro tuto smlouvu.' : 'Žádné platby.' }
        );
    }

    // ── exposed actions ─────────────────────────────────────────────────
    let _payCache = [];

    function edit(id) {
        const row = _payCache.find(r => r.id === id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('payments', id, 'Smaznout tuto platbu?', renderPayments);
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

    // ── view loader ─────────────────────────────────────────────────────
    async function load() {
        initForm();
        form.exitEdit();
        await fillDropdowns();
        await renderPayments();
    }

    return { load, edit, del, navigateWithFilter, prefill };
})();

App.registerView('payments', PaymentsView.load);
window.PaymentsView = PaymentsView;
