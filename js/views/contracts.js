// js/views/contracts.js

const ContractsView = (() => {
    let form   = null;
    let _cache = [];  // contracts with joined names

    // ── modal: nový nájemník ────────────────────────────────────────────
    let _tenantModalInited = false;
    function initTenantModal() {
        if (_tenantModalInited) return;
        _tenantModalInited = true;
        const btnAdd = document.getElementById('btn-con-add-tenant');
        const btnSave = document.getElementById('btn-modal-tenant-save');
        const wrapAres = document.getElementById('modal-tenant-ares-wrap');
        const btnAres = document.getElementById('modal-tenant-ares-btn');
        const typeEl = document.getElementById('modal-tenant-type');
        const alertEl = document.getElementById('modal-tenant-alert');

        if (!btnAdd) return;

        const wrapIcDic = document.getElementById('modal-tenant-ic-dic-wrap');
        const wrapBirth = document.getElementById('modal-tenant-birth-wrap');

        btnAdd.addEventListener('click', () => {
            ['modal-tenant-name','modal-tenant-email','modal-tenant-phone','modal-tenant-address','modal-tenant-ic','modal-tenant-dic','modal-tenant-note','modal-tenant-birth'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            if (typeEl) typeEl.value = 'person';
            if (alertEl) { alertEl.className = 'alert'; alertEl.textContent = ''; }
            toggleTenantTypeVisibility();
            UI.modalOpen('modal-tenant');
        });

        function toggleTenantTypeVisibility() {
            const isCompany = typeEl && typeEl.value === 'company';
            if (wrapAres) wrapAres.style.display = isCompany ? 'block' : 'none';
            if (wrapIcDic) wrapIcDic.style.display = isCompany ? 'flex' : 'none';
            if (wrapBirth) wrapBirth.style.display = !isCompany ? 'block' : 'none';
        }
        if (typeEl) typeEl.addEventListener('change', toggleTenantTypeVisibility);
        toggleTenantTypeVisibility();

        if (btnAres) btnAres.addEventListener('click', async () => {
            const ic = (document.getElementById('modal-tenant-ic')?.value || '').replace(/\D/g, '');
            if (ic.length !== 8) {
                UI.alertShow('modal-tenant-alert', 'Zadejte platné IČ (8 číslic).', 'err');
                return;
            }
            btnAres.disabled = true;
            btnAres.textContent = '…';
            try {
                const data = await Api.aresLookup(ic);
                const nameEl = document.getElementById('modal-tenant-name');
                const addrEl = document.getElementById('modal-tenant-address');
                const icEl = document.getElementById('modal-tenant-ic');
                const dicEl = document.getElementById('modal-tenant-dic');
                if (nameEl) nameEl.value = data.name || '';
                if (addrEl) addrEl.value = data.address || '';
                if (icEl) icEl.value = data.ic || ic;
                if (dicEl) dicEl.value = data.dic || '';
                UI.alertShow('modal-tenant-alert', 'Data načtena z ARES.', 'ok');
            } catch (e) {
                UI.alertShow('modal-tenant-alert', e.message || 'ARES nedostupný.', 'err');
            } finally {
                btnAres.disabled = false;
                btnAres.textContent = 'Načíst z ARES';
            }
        });

        if (btnSave) btnSave.addEventListener('click', async () => {
            const name = (document.getElementById('modal-tenant-name')?.value || '').trim();
            if (!name) {
                UI.alertShow('modal-tenant-alert', 'Jméno / Název je povinné.', 'err');
                return;
            }
            const isCompany = (typeEl?.value) === 'company';
            const birthVal = (document.getElementById('modal-tenant-birth')?.value || '').trim() || null;
            const icVal = isCompany ? ((document.getElementById('modal-tenant-ic')?.value || '').trim() || null) : null;
            const dicVal = isCompany ? ((document.getElementById('modal-tenant-dic')?.value || '').trim() || null) : null;
            btnSave.disabled = true;
            try {
                const data = await Api.crudAdd('tenants', {
                    name:    name,
                    type:   (typeEl?.value) || 'person',
                    birth_date: !isCompany ? birthVal : null,
                    email:  (document.getElementById('modal-tenant-email')?.value || '').trim(),
                    phone:  (document.getElementById('modal-tenant-phone')?.value || '').trim(),
                    address: (document.getElementById('modal-tenant-address')?.value || '').trim(),
                    ic:     icVal,
                    dic:    dicVal,
                    note:   (document.getElementById('modal-tenant-note')?.value || '').trim(),
                });
                await fillDropdowns();
                const tenantSel = document.getElementById('con-tenant');
                const newId = data.tenants_id ?? data.id;
                if (tenantSel) tenantSel.value = String(newId);
                if (typeof UI.updateSearchableSelectDisplay === 'function') UI.updateSearchableSelectDisplay('con-tenant');
                UI.modalClose('modal-tenant');
            } catch (e) {
                UI.alertShow('modal-tenant-alert', e.message || 'Chyba při ukládání.', 'err');
            } finally {
                btnSave.disabled = false;
            }
        });
    }

    let _rentChangesContractsId = null;
    let _paymentRequestsContractsId = null;

    const PAYMENT_REQUEST_TYPE_LABELS = { energy: 'Doplatek energie', settlement: 'Vyúčtování', deposit: 'Kauce', deposit_return: 'Vrácení kauce', other: 'Jiné' };

    async function loadPaymentRequests(contractsId) {
        _paymentRequestsContractsId = contractsId;
        const listEl = document.getElementById('con-payment-requests-list');
        const wrapEl = document.getElementById('con-payment-requests-wrap');
        if (!listEl || !wrapEl) return;
        try {
            const data = await Api.crudList('payment_requests', { contracts_id: contractsId });
            if (!data || !data.length) {
                listEl.innerHTML = '<div class="text-muted" style="font-size:.85rem;padding:8px 0">Žádné požadavky na platbu.</div>';
                wrapEl.style.display = 'block';
                return;
            }
            let html = '<table class="tbl tbl-sm" style="margin-bottom:0"><thead><tr><th>Typ</th><th>Částka</th><th>Splatnost</th><th>Poznámka</th><th class="th-act"></th></tr></thead><tbody>';
            data.forEach(pr => {
                const typeLabel = PAYMENT_REQUEST_TYPE_LABELS[pr.type] || pr.type;
                const amt = UI.fmt(pr.amount ?? 0);
                const due = pr.due_date ? UI.fmtDate(pr.due_date) : '—';
                const note = (pr.note || '').trim() ? UI.esc(pr.note) : '—';
                const prId = pr.payment_requests_id ?? pr.id;
                const paidAtFormatted = pr.paid_at ? UI.fmtDate(pr.paid_at) : '';
                const paid = pr.paid_at
                    ? ' <span class="badge badge-ok" title="Uhrazeno ' + (paidAtFormatted ? paidAtFormatted : '') + '">uhrazeno' + (paidAtFormatted ? ' (' + paidAtFormatted + ')' : '') + '</span>'
                    : '';
                html += '<tr><td>' + UI.esc(typeLabel) + paid + '</td><td>' + amt + ' Kč</td><td>' + due + '</td><td class="col-note">' + note + '</td><td class="td-act">' +
                    '<button type="button" class="btn btn-ghost btn-sm btn-edit-pay-req" data-pr-id="' + prId + '">Upravit</button> ' +
                    '<button type="button" class="btn btn-danger btn-sm btn-del-pay-req" data-pr-id="' + prId + '">Smazat</button></td></tr>';
            });
            html += '</tbody></table>';
            listEl.innerHTML = html;
            listEl.querySelectorAll('.btn-edit-pay-req').forEach(btn => {
                btn.onclick = () => {
                    const prId = parseInt(btn.dataset.prId, 10);
                    if (typeof window.openPaymentRequestEdit === 'function') {
                        window.openPaymentRequestEdit(prId, () => loadPaymentRequests(_paymentRequestsContractsId));
                    }
                };
            });
            listEl.querySelectorAll('.btn-del-pay-req').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Smazat tento požadavek na platbu?')) return;
                    try {
                        await Api.crudDelete('payment_requests', parseInt(btn.dataset.prId, 10));
                        loadPaymentRequests(_paymentRequestsContractsId);
                    } catch (e) { alert(e.message || 'Chyba při mazání.'); }
                };
            });
            wrapEl.style.display = 'block';
        } catch (e) {
            listEl.innerHTML = '<div class="alert alert-err show">' + UI.esc(e.message || 'Chyba při načítání.') + '</div>';
            wrapEl.style.display = 'block';
        }
    }

    async function loadRentChanges(contractsId) {
        _rentChangesContractsId = contractsId;
        const listEl = document.getElementById('con-rent-changes-list');
        if (!listEl) return;
        try {
            const data = await Api.crudList('contract_rent_changes', { contracts_id: contractsId });
            if (!data || !data.length) {
                listEl.innerHTML = '<div class="text-muted" style="font-size:.85rem;padding:8px 0">Žádné změny nájemného.</div>';
                return;
            }
            let html = '<table class="tbl tbl-sm" style="margin-bottom:0"><thead><tr><th>Platné od</th><th>Nájemné (Kč)</th><th class="th-act"></th></tr></thead><tbody>';
            data.forEach(rc => {
                const dt = rc.effective_from ? UI.fmtDate(rc.effective_from) : '—';
                const amt = UI.fmt(rc.amount ?? 0);
                const rcEntityId = rc.contract_rent_changes_id ?? rc.id;
                html += '<tr><td>' + dt + '</td><td>' + amt + '</td><td class="td-act">' +
                    '<button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="' + rcEntityId + '" data-effective="' + (rc.effective_from || '') + '" data-amount="' + (rc.amount ?? '') + '">Upravit</button> ' +
                    '<button type="button" class="btn btn-danger btn-sm" data-action="del" data-id="' + rcEntityId + '">Smazat</button></td></tr>';
            });
            html += '</tbody></table>';
            listEl.innerHTML = html;
            listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.onclick = () => {
                    document.getElementById('con-rc-effective').value = btn.dataset.effective || '';
                    document.getElementById('con-rc-amount').value = btn.dataset.amount || '';
                    btn.dataset.editId = btn.dataset.id;
                    const addBtn = document.getElementById('btn-con-rc-add');
                    if (addBtn) addBtn.textContent = 'Uložit';
                };
            });
            listEl.querySelectorAll('[data-action="del"]').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Smazat tuto změnu nájemného?')) return;
                    try {
                        await Api.crudDelete('contract_rent_changes', parseInt(btn.dataset.id, 10));
                        document.querySelector('#con-rent-changes-list [data-edit-id]')?.removeAttribute('data-edit-id');
                        document.getElementById('con-rc-effective').value = '';
                        document.getElementById('con-rc-amount').value = '';
                        const addBtn = document.getElementById('btn-con-rc-add');
                        if (addBtn) addBtn.textContent = '+ Přidat';
                        loadRentChanges(_rentChangesContractsId);
                    } catch (e) { alert(e.message); }
                };
            });
        } catch (e) {
            listEl.innerHTML = '<div class="alert alert-err show">' + UI.esc(e.message || 'Chyba při načítání.') + '</div>';
        }
    }

    function initRentChangesHandlers() {
        const btnAdd = document.getElementById('btn-con-rc-add');
        const effectiveEl = document.getElementById('con-rc-effective');
        const amountEl = document.getElementById('con-rc-amount');
        if (!btnAdd) return;
        btnAdd.onclick = async () => {
            if (!_rentChangesContractsId) return;
            const editId = document.querySelector('#con-rent-changes-list [data-edit-id]')?.dataset?.editId;
            const effective = (effectiveEl?.value || '').trim();
            const amount = parseFloat(amountEl?.value) || 0;
            if (!effective) { alert('Vyplňte datum „Platné od“.'); return; }
            if (!UI.isDateValid(effective)) { alert('Zadejte platné datum.'); return; }
            if (amount <= 0) { alert('Zadejte kladnou částku.'); return; }
            try {
                if (editId) {
                    await Api.crudEdit('contract_rent_changes', parseInt(editId, 10), {
                        contracts_id: _rentChangesContractsId,
                        amount,
                        effective_from: effective,
                    });
                    document.querySelector('#con-rent-changes-list [data-edit-id]')?.removeAttribute('data-edit-id');
                } else {
                    await Api.crudAdd('contract_rent_changes', {
                        contracts_id: _rentChangesContractsId,
                        amount,
                        effective_from: effective,
                    });
                }
                effectiveEl.value = '';
                amountEl.value = '';
                if (btnAdd) btnAdd.textContent = '+ Přidat';
                loadRentChanges(_rentChangesContractsId);
            } catch (e) { alert(e.message); }
        };
    }

    function initForm() {
        if (form) return;
        form = UI.createCrudForm({
            table:      'contracts',
            alertId:    'con-alert',
            titleId:    'con-form-title',
            saveId:     'btn-con-save',
            cancelId:   'btn-con-cancel',
            editIdField:'con-edit-id',
            formCardId: 'con-form-card',
            addBtnId:   'btn-con-add',
            addLabel:   'Přidat smlouvu',
            editLabel:  'Uložit změny',
            successAddMsg: 'Smlouva byla úspěšně přidána.',
            successEditMsg: 'Smlouva byla úspěšně aktualizována.',
            validate(values) {
                if (!values.properties_id || values.properties_id <= 0) return 'Vyberte nemovitost.';
                if (!values.tenants_id || values.tenants_id <= 0) return 'Vyberte nájemníka.';
                if (!values.contract_start) return 'Vyplňte začátek smlouvy.';
                if (!UI.isDateValid(values.contract_start)) return 'Začátek smlouvy: zadejte platné datum (např. únor má max. 29 dní).';
                if (values.contract_end && !UI.isDateValid(values.contract_end)) return 'Konec smlouvy: zadejte platné datum (např. únor má max. 29 dní).';
                if (values.deposit_return_date && !values.contract_end) return 'Při vyplnění data vrácení kauce musí být vyplněno datum ukončení smlouvy.';
                return null;
            },
            getValues() {
                const depAmt = document.getElementById('con-deposit-amount').value.trim();
                const firstMonthVal = document.getElementById('con-first-month-rent').value.trim();
                return {
                    properties_id: Number(document.getElementById('con-property').value),
                    tenants_id:    Number(document.getElementById('con-tenant').value),
                    contract_start: document.getElementById('con-start').value,
                    contract_end:   document.getElementById('con-end').value || '',
                    monthly_rent:   document.getElementById('con-rent').value,
                    first_month_rent: firstMonthVal ? parseFloat(firstMonthVal) : null,
                    contract_url:   document.getElementById('con-contract-url').value.trim() || null,
                    deposit_amount: depAmt ? parseFloat(depAmt) : null,
                    deposit_paid_date: document.getElementById('con-deposit-paid-date').value || null,
                    deposit_return_date: document.getElementById('con-deposit-return-date').value || null,
                    note:           document.getElementById('con-note').value.trim(),
                };
            },
            fillForm(row) {
                document.getElementById('con-edit-id').value = String(row.contracts_id ?? row.id);
                document.getElementById('con-property').value = row.properties_id || '';
                document.getElementById('con-tenant').value   = row.tenants_id   || '';
                document.getElementById('con-start').value    = row.contract_start || '';
                document.getElementById('con-end').value      = row.contract_end   || '';
                document.getElementById('con-rent').value     = row.monthly_rent   || '';
                document.getElementById('con-first-month-rent').value = row.first_month_rent ?? '';
                document.getElementById('con-contract-url').value = row.contract_url || '';
                document.getElementById('con-deposit-amount').value = row.deposit_amount ?? '';
                document.getElementById('con-deposit-paid-date').value = row.deposit_paid_date ? row.deposit_paid_date.slice(0, 10) : '';
                document.getElementById('con-deposit-return-date').value = row.deposit_return_date ? row.deposit_return_date.slice(0, 10) : '';
                document.getElementById('con-note').value     = row.note           || '';
                if (typeof UI.updateSearchableSelectDisplay === 'function') {
                    UI.updateSearchableSelectDisplay('con-property');
                    UI.updateSearchableSelectDisplay('con-tenant');
                }
                toggleFirstMonthRentVisibility();
                const contractsId = row.contracts_id ?? row.id;
                loadRentChanges(contractsId);
                loadPaymentRequests(contractsId);
                document.getElementById('con-rent-changes-wrap').style.display = 'block';
            },
            resetForm() {
                ['con-property','con-tenant','con-start','con-end','con-rent','con-first-month-rent','con-contract-url','con-deposit-amount','con-deposit-paid-date','con-deposit-return-date','con-note']
                    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
                document.getElementById('con-first-month-wrap').style.display = 'none';
                document.getElementById('con-rent-changes-wrap').style.display = 'none';
                const prWrap = document.getElementById('con-payment-requests-wrap');
                if (prWrap) prWrap.style.display = 'none';
            },
            onSaved: loadList,
        });
    }

    function toggleFirstMonthRentVisibility() {
        const startVal = document.getElementById('con-start').value;
        const wrap = document.getElementById('con-first-month-wrap');
        if (!wrap) return;
        if (!startVal || startVal.length < 10) {
            wrap.style.display = 'none';
            return;
        }
        const day = parseInt(startVal.slice(8, 10), 10);
        wrap.style.display = day !== 1 ? 'block' : 'none';
    }
    document.getElementById('con-start').addEventListener('change', toggleFirstMonthRentVisibility);

    // ── fill dropdowns ──────────────────────────────────────────────────
    async function fillDropdowns() {
        const [props, tens] = await Promise.all([
            Api.crudList('properties'),
            Api.crudList('tenants'),
        ]);

        // Použijeme properties_id (entity_id) pro stabilitu při soft-update nemovitosti
        document.getElementById('con-property').innerHTML =
            '<option value="">— Vyberte nemovitost —</option>' +
            props.map(p =>
                '<option value="' + (p.properties_id ?? p.id) + '">' + UI.esc(p.name) + ' – ' + UI.esc(p.address) + '</option>'
            ).join('');

        // Použijeme tenants_id (entity_id) pro stabilitu při soft-update nájemníka
        document.getElementById('con-tenant').innerHTML =
            '<option value="">— Vyberte nájemníka —</option>' +
            tens.map(t =>
                '<option value="' + (t.tenants_id ?? t.id) + '">' + UI.esc(t.name) + '</option>'
            ).join('');
    }

    // ── table ───────────────────────────────────────────────────────────
    async function loadList() {
        let data;
        try { data = await Api.crudList('contracts'); _cache = data; }
        catch (e) { return; }

        UI.renderTable('con-table',
            [
                { label: 'Nemovitost' },
                { label: 'Nájemník' },
                { label: 'Od', hideMobile: true },
                { label: 'Do', hideMobile: true },
                { label: 'Nájemné' },
                { label: 'Kauce', hideMobile: true },
                { label: 'Smlouva', hideMobile: true },
                { label: 'Poznámka', hideMobile: true },
                { label: 'Akce', act: true },
            ],
            data,
            (c) => {
                const contractUrl = c.contract_url;
                const contractLink = contractUrl
                    ? '<a href="' + UI.esc(contractUrl) + '" target="_blank" rel="noopener" class="contract-preview-trigger" data-url="' + UI.esc(contractUrl) + '" title="Náhled nájemní smlouvy (najeď myší)">📄</a>'
                    : '<span style="color:var(--txt3)">—</span>';
                const dep = parseFloat(c.deposit_amount) || 0;
                const depReturned = c.deposit_return_date;
                const contractEnded = c.contract_end && c.contract_end <= new Date().toISOString().slice(0, 10);
                let depositCell = '—';
                if (dep > 0) {
                    if (depReturned) {
                        depositCell = UI.fmt(dep) + ' Kč <span class="badge badge-ok" title="Vráceno ' + (c.deposit_return_date ? UI.fmtDate(c.deposit_return_date) : '') + '">vráceno</span>';
                    } else if (contractEnded) {
                        depositCell = UI.fmt(dep) + ' Kč <span class="badge badge-danger" title="K vrácení po skončení smlouvy">k vrácení</span>';
                    } else {
                        depositCell = UI.fmt(dep) + ' Kč';
                    }
                }
                return (
                    '<td>' + UI.esc(c.property_name) + '</td>' +
                    '<td><strong>' + UI.esc(c.tenant_name) + '</strong></td>' +
                    '<td class="col-hide-mobile">' + UI.esc(c.contract_start) + '</td>' +
                    '<td class="col-hide-mobile">' + (c.contract_end ? UI.esc(c.contract_end) : '<span style="color:var(--txt3)">neurčitá</span>') + '</td>' +
                    '<td>' + UI.fmt(c.monthly_rent) + ' Kč</td>' +
                    '<td class="col-hide-mobile">' + depositCell + '</td>' +
                    '<td class="col-hide-mobile">' + contractLink + '</td>' +
                    '<td class="col-note col-hide-mobile">' + (c.note ? UI.esc(c.note) : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                    '<td class="td-act">' +
                        '<button class="btn btn-ghost btn-sm" onclick="ContractsView.edit(' + (c.contracts_id ?? c.id) + ')">Úprava</button>' +
                        '<button class="btn btn-ghost btn-sm" onclick="PaymentsView.navigateWithFilter(' + (c.contracts_id ?? c.id) + ')">Platby</button>' +
                        '<button class="btn btn-danger btn-sm" onclick="ContractsView.del(' + (c.contracts_id ?? c.id) + ')">Smazat</button>' +
                    '</td>'
                );
            },
            { emptyMsg: 'Žádné smlouvy.' }
        );
    }

    function edit(id) {
        const row = _cache.find(r => (r.contracts_id ?? r.id) == id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('contracts', id, 'Smazat tuto smlouvu?', () => {
            _cache = [];
            loadList();
        });
    }

    async function load() {
        initForm();
        form.exitEdit();
        initTenantModal();
        initRentChangesHandlers();
        _cache = [];
        await fillDropdowns();
        if (typeof UI.createSearchableSelect === 'function') {
            UI.createSearchableSelect('con-property');
            UI.createSearchableSelect('con-tenant');
        }
        await loadList();
        prefillFromCalendarIfPending();
        try {
            const raw = sessionStorage.getItem('dashboard-open-edit');
            if (raw) {
                const { view, id } = JSON.parse(raw);
                if (view === 'contracts' && id) {
                    sessionStorage.removeItem('dashboard-open-edit');
                    const numId = parseInt(id, 10);
                    if (!isNaN(numId)) setTimeout(() => ContractsView.edit(numId), 0);
                }
            }
        } catch (_) {}
    }

    let _pendingPrefill = null;
    function prefillFromCalendar(propertyId, monthKey, propertyName) {
        _pendingPrefill = { propertyId, monthKey, propertyName };
    }
    async function prefillFromCalendarIfPending() {
        if (!_pendingPrefill) return;
        const { propertyId, monthKey } = _pendingPrefill;
        _pendingPrefill = null;
        await fillDropdowns();
        form.startAdd();
        document.getElementById('con-property').value = propertyId;
        document.getElementById('con-start').value = monthKey + '-01';
    }

    function getCache() { return _cache; }

    return { load, edit, del, getCache, prefillFromCalendar };
})();

App.registerView('contracts', ContractsView.load);
window.ContractsView = ContractsView;
