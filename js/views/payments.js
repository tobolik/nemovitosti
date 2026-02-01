// js/views/payments.js

const PaymentsView = (() => {
    let form = null;
    let contractsCache = [];   // all active contracts (with names)
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
            addLabel:   'Zaznamenat platbu',
            editLabel:  'Uložit změny',
            getValues() {
                return {
                    contract_id:  Number(document.getElementById('pay-contract').value),
                    period_year:  Number(document.getElementById('pay-year').value),
                    period_month: Number(document.getElementById('pay-month').value),
                    amount:       document.getElementById('pay-amount').value,
                    payment_date: document.getElementById('pay-date').value,
                    note:         document.getElementById('pay-note').value.trim(),
                };
            },
            fillForm(row) {
                document.getElementById('pay-contract').value = row.contract_id  || '';
                document.getElementById('pay-year').value     = row.period_year  || '';
                document.getElementById('pay-month').value    = row.period_month || '';
                document.getElementById('pay-amount').value   = row.amount       || '';
                document.getElementById('pay-date').value     = row.payment_date || '';
                document.getElementById('pay-note').value     = row.note         || '';
            },
            resetForm() {
                document.getElementById('pay-contract').value = '';
                document.getElementById('pay-amount').value   = '';
                document.getElementById('pay-note').value     = '';
                document.getElementById('pay-date').value     = todayISO();
            },
            onSaved: renderPayments,
        });

        // Auto-fill amount when contract selection changes
        document.getElementById('pay-contract').addEventListener('change', function () {
            const cid = Number(this.value);
            const c   = contractsCache.find(x => x.id === cid);
            if (c && !document.getElementById('pay-amount').value) {
                document.getElementById('pay-amount').value = c.monthly_rent;
            }
        });

        // Filter dropdown change
        document.getElementById('pay-filter-contract').addEventListener('change', function () {
            filterContractId = Number(this.value);
            renderPayments();
        });
    }

    // ── year dropdown (one-time init) ───────────────────────────────────
    (function initYearSelect() {
        const sel  = document.getElementById('pay-year');
        const now  = new Date().getFullYear();
        for (let y = now - 2; y <= now + 1; y++) {
            sel.innerHTML += '<option value="' + y + '"' + (y === now ? ' selected' : '') + '>' + y + '</option>';
        }
        // defaults
        document.getElementById('pay-month').value = new Date().getMonth() + 1;
        document.getElementById('pay-date').value  = todayISO();
    })();

    function todayISO() {
        return new Date().toISOString().slice(0, 10);
    }

    // ── fill contract dropdowns (form + filter) ────────────────────────
    async function fillDropdowns() {
        contractsCache = await Api.crudList('contracts');

        const opts = '<option value="">— Wyberte smlouvu —</option>' +
            contractsCache.map(c =>
                '<option value="' + c.id + '">' +
                    UI.esc(c.tenant_name) + ' – ' + UI.esc(c.property_name) +
                    ' (' + UI.fmt(c.monthly_rent) + ' Kč/měs.)' +
                '</option>'
            ).join('');
        document.getElementById('pay-contract').innerHTML = opts;

        // Filter dropdown
        const fOpts = '<option value="">— Všechny smlouvy —</option>' +
            contractsCache.map(c =>
                '<option value="' + c.id + '"' + (filterContractId === c.id ? ' selected' : '') + '>' +
                    UI.esc(c.tenant_name) + ' – ' + UI.esc(c.property_name) +
                '</option>'
            ).join('');
        document.getElementById('pay-filter-contract').innerHTML = fOpts;
    }

    // ── render payments table ───────────────────────────────────────────
    async function renderPayments() {
        const params = filterContractId ? { contract_id: filterContractId } : {};
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

                return (
                    '<td><strong>' + UI.esc(p.tenant_name) + '</strong> – ' + UI.esc(p.property_name) + '</td>' +
                    '<td>' + UI.MONTHS[p.period_month] + ' ' + p.period_year + '</td>' +
                    '<td>' + UI.fmt(amt) + ' Kč</td>' +
                    '<td>' + UI.esc(p.payment_date) + '</td>' +
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
        App.navigate('payments');
    }

    // Prefill form (z dashboard quick-add tag)
    function prefill(contractId, year, month, rent) {
        document.getElementById('pay-contract').value = contractId;
        document.getElementById('pay-year').value     = year;
        document.getElementById('pay-month').value    = month;
        document.getElementById('pay-amount').value   = rent;
        document.getElementById('pay-date').value     = todayISO();
    }

    // ── view loader ─────────────────────────────────────────────────────
    async function load() {
        initForm();
        await fillDropdowns();
        await renderPayments();
    }

    return { load, edit, del, navigateWithFilter, prefill };
})();

App.registerView('payments', PaymentsView.load);
