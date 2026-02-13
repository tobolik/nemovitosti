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

    const PAYMENT_REQUEST_TYPE_LABELS = { rent: 'Nájem', energy: 'Energie', settlement: 'Vyúčtování', deposit: 'Kauce', deposit_return: 'Vrácení kauce', other: 'Jiné' };

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
                const noteText = (pr.note || '').trim();
                const note = noteText ? '<span class="cell-note-truncate" title="' + UI.esc(noteText) + '">' + UI.esc(noteText) + '</span>' : '—';
                const prId = pr.payment_requests_id ?? pr.id;
                const paidAtFormatted = pr.paid_at ? UI.fmtDate(pr.paid_at) : '';
                const paid = pr.paid_at
                    ? ' <span class="badge badge-ok" title="Uhrazeno ' + (paidAtFormatted ? paidAtFormatted : '') + '">uhrazeno' + (paidAtFormatted ? ' (' + paidAtFormatted + ')' : '') + '</span>'
                    : '';
                html += '<tr><td>' + UI.esc(typeLabel) + paid + '</td><td>' + amt + ' Kč</td><td>' + due + '</td><td class="col-note cell-note-wrap">' + note + '</td><td class="td-act">' +
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

    // ── Vyúčtování energií + Vyúčtování kauce (v2 – tabulkový výpis) ──
    let _settlementInited = false;
    const TYPE_LABELS = { rent: 'Nájem', energy: 'Energie', settlement: 'Vyúčtování', deposit: 'Kauce', deposit_return: 'Vrácení kauce', other: 'Jiné' };

    // Pomocná: API volání na settlement.php
    async function settlementApi(body) {
        const resp = await fetch('/api/settlement.php', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': Api.getCsrf() },
            body: JSON.stringify(body)
        });
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error || 'Chyba');
        return data.data || data;
    }

    // ── Načtení a vykreslení tabulky vyúčtování ─────────────────────
    async function loadSettlements(type) {
        const cid = _paymentRequestsContractsId;
        if (!cid) return;
        const containerId = type === 'energy' ? 'con-energy-settlements-table' : 'con-deposit-settlements-table';
        const sectionEl = document.getElementById(type === 'energy' ? 'con-energy-settlements-section' : 'con-deposit-settlements-section');
        try {
            const d = await settlementApi({ action: 'settlements_list', contracts_id: cid, type });
            const settlements = d.settlements || [];
            if (sectionEl) sectionEl.style.display = '';

            UI.renderTable(containerId,
                [
                    { label: 'Datum', sortKey: 'settled_at' },
                    { label: 'Název' },
                    { label: 'Skutečnost' },
                    { label: 'Zálohy' },
                    { label: 'Rozdíl' },
                    { label: 'Stav' },
                    { label: 'Akce', act: true },
                ],
                settlements,
                (s) => {
                    const locked = !!s.locked_at;
                    const lockBadge = locked
                        ? '<span class="badge badge-locked" title="Zamčeno ' + UI.fmtDate(s.locked_at) + '">zamčeno</span>'
                        : '<span class="badge badge-unlocked">otevřeno</span>';
                    const diff = parseFloat(s.settlement_amount) || 0;
                    const diffLabel = diff > 0 ? 'nedoplatek' : (diff < 0 ? 'přeplatek' : 'vyrovnáno');
                    const diffClass = diff > 0 ? 'text-danger' : (diff < 0 ? 'text-success' : '');

                    let actHtml = '';
                    if (locked) {
                        actHtml += '<button type="button" class="btn btn-ghost btn-sm btn-settle-unlock" data-id="' + s.entity_id + '" title="Odemknout pro editaci">Odemknout</button> ';
                    } else {
                        actHtml += '<button type="button" class="btn btn-ghost btn-sm btn-settle-edit" data-id="' + s.entity_id + '" data-type="' + type + '">Upravit</button> ';
                        actHtml += '<button type="button" class="btn btn-ghost btn-sm btn-settle-lock" data-id="' + s.entity_id + '">Zamknout</button> ';
                        actHtml += '<button type="button" class="btn btn-danger btn-sm btn-settle-delete" data-id="' + s.entity_id + '">Smazat</button>';
                    }

                    // Items tooltip
                    const items = s.items || [];
                    const itemsTip = items.map(it => {
                        const tl = TYPE_LABELS[it.pr_type] || it.pr_type;
                        const period = it.period_year && it.period_month ? ' ' + it.period_month + '/' + it.period_year : '';
                        return tl + period + ': ' + UI.fmt(it.amount) + ' Kč' + (it.paid_at ? ' (uhrazeno)' : '');
                    }).join('\n');

                    return '<td>' + UI.fmtDate(s.settled_at) + '</td>' +
                        '<td>' + UI.esc(s.label || '—') + '</td>' +
                        '<td title="' + UI.esc(itemsTip) + '">' + UI.fmt(s.actual_amount) + ' Kč</td>' +
                        '<td title="' + UI.esc(itemsTip) + '">' + UI.fmt(s.advances_sum) + ' Kč</td>' +
                        '<td class="' + diffClass + '">' + UI.fmt(Math.abs(diff)) + ' Kč <small>(' + diffLabel + ')</small></td>' +
                        '<td>' + lockBadge + '</td>' +
                        '<td class="td-act">' + actHtml + '</td>';
                },
                { emptyMsg: 'Žádná vyúčtování.', striped: true }
            );

            // Připojit event handlery
            const container = document.getElementById(containerId);
            if (!container) return;

            container.querySelectorAll('.btn-settle-lock').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Zamknout toto vyúčtování?')) return;
                    try {
                        await settlementApi({ action: 'settlement_lock', settlement_id: parseInt(btn.dataset.id, 10) });
                        loadSettlements(type);
                    } catch (e) { alert(e.message); }
                };
            });

            container.querySelectorAll('.btn-settle-unlock').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Odemknout vyúčtování pro editaci?')) return;
                    try {
                        await settlementApi({ action: 'settlement_unlock', settlement_id: parseInt(btn.dataset.id, 10) });
                        loadSettlements(type);
                    } catch (e) { alert(e.message); }
                };
            });

            container.querySelectorAll('.btn-settle-delete').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Opravdu smazat toto vyúčtování? Smaže se i vytvořený požadavek na platbu.')) return;
                    try {
                        await settlementApi({ action: 'settlement_delete', settlement_id: parseInt(btn.dataset.id, 10) });
                        loadSettlements(type);
                        loadPaymentRequests(_paymentRequestsContractsId);
                    } catch (e) { alert(e.message); }
                };
            });

            container.querySelectorAll('.btn-settle-edit').forEach(btn => {
                btn.onclick = () => openSettlementForm(btn.dataset.type, parseInt(btn.dataset.id, 10));
            });

        } catch (e) {
            const el = document.getElementById(containerId);
            if (el) el.innerHTML = '<div class="alert alert-err show">' + UI.esc(e.message) + '</div>';
        }
    }

    // ── Otevření formuláře (modal) pro nové/editace vyúčtování ──────
    async function openSettlementForm(type, editSettlementId) {
        const cid = _paymentRequestsContractsId;
        if (!cid) return;

        const titleEl = document.getElementById('settlement-form-title');
        const alertEl = document.getElementById('settlement-form-alert');
        const labelEl = document.getElementById('settlement-form-label');
        const itemsEl = document.getElementById('settlement-form-items');
        const actualEl = document.getElementById('settlement-form-actual');
        const advancesEl = document.getElementById('settlement-form-advances');
        const diffEl = document.getElementById('settlement-form-diff');
        const reqLabelEl = document.getElementById('settlement-form-req-label');
        const noteEl = document.getElementById('settlement-form-note');
        const lockEl = document.getElementById('settlement-form-lock');
        const saveBtn = document.getElementById('btn-settlement-form-save');

        if (alertEl) { alertEl.className = 'alert'; alertEl.textContent = ''; }
        if (labelEl) labelEl.value = '';
        if (actualEl) actualEl.value = '';
        if (reqLabelEl) reqLabelEl.value = '';
        if (noteEl) noteEl.value = '';
        if (lockEl) lockEl.checked = false;

        const isEdit = !!editSettlementId;
        if (titleEl) titleEl.textContent = isEdit
            ? (type === 'energy' ? 'Upravit vyúčtování energií' : 'Upravit vyúčtování kauce')
            : (type === 'energy' ? 'Nové vyúčtování energií' : 'Nové vyúčtování kauce');

        // Načíst dostupné zálohy/požadavky
        let availableItems = [];
        let existingSettlement = null;
        let existingItemIds = [];

        try {
            if (type === 'energy') {
                const info = await settlementApi({ action: 'energy_info', contracts_id: cid });
                availableItems = (info.items || []).map(it => ({
                    entity_id: it.entity_id,
                    amount: parseFloat(it.amount) || 0,
                    label: (it.note || 'Energie') + (it.period_year && it.period_month ? ' ' + it.period_month + '/' + it.period_year : ''),
                    paid: !!it.paid_at,
                    paid_at: it.paid_at || null,
                    in_settlement: it.in_settlement,
                    settled_by: it.settled_by_request_id,
                }));
            } else {
                const info = await settlementApi({ action: 'deposit_info', contracts_id: cid });
                availableItems = (info.unpaid_requests || []).map(it => ({
                    entity_id: it.entity_id,
                    amount: Math.abs(parseFloat(it.amount) || 0),
                    label: (TYPE_LABELS[it.type] || it.type) + (it.note ? ' – ' + it.note : '') +
                        (it.period_year && it.period_month ? ' ' + it.period_month + '/' + it.period_year : ''),
                    paid: false,
                    in_settlement: it.in_settlement,
                    settled_by: null,
                }));
            }

            // Při editaci: načíst detail vyúčtování
            if (isEdit) {
                const listData = await settlementApi({ action: 'settlements_list', contracts_id: cid, type });
                existingSettlement = (listData.settlements || []).find(s => s.entity_id === editSettlementId);
                if (existingSettlement) {
                    existingItemIds = (existingSettlement.items || []).map(it => parseInt(it.payment_requests_id));
                    if (labelEl) labelEl.value = existingSettlement.label || '';
                    if (actualEl) actualEl.value = existingSettlement.actual_amount;
                    if (noteEl) noteEl.value = existingSettlement.note || '';
                }
            }
        } catch (e) {
            if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = e.message; }
            UI.modalOpen('modal-settlement-form');
            return;
        }

        // Filtrovat: zobrazit jen ty, které nejsou v jiném vyúčtování (nebo jsou v tomto)
        const filteredItems = availableItems.filter(it => {
            if (isEdit && existingItemIds.includes(it.entity_id)) return true;
            return !it.in_settlement;
        });

        // Vykreslit checkboxy
        if (itemsEl) {
            if (!filteredItems.length) {
                itemsEl.innerHTML = '<div class="text-muted">Žádné dostupné zálohy/požadavky.</div>';
            } else {
                let html = '<div style="margin-bottom:6px;font-weight:600">Zahrnuté zálohy / požadavky:</div>';
                filteredItems.forEach(it => {
                    const checked = isEdit ? existingItemIds.includes(it.entity_id) : true;
                    const paidTag = it.paid ? ' <span class="badge badge-ok" style="font-size:.7rem">Uhrazeno' + (it.paid_at ? ' (' + UI.fmtDate(it.paid_at) + ')' : '') + '</span>' : '';
                    html += '<label style="display:block;padding:3px 0;cursor:pointer">' +
                        '<input type="checkbox" class="settle-item-cb" data-id="' + it.entity_id + '" data-amount="' + it.amount + '"' + (checked ? ' checked' : '') + '> ' +
                        UI.esc(it.label) + ': <strong>' + UI.fmt(it.amount) + ' Kč</strong>' + paidTag + '</label>';
                });
                itemsEl.innerHTML = html;
            }
        }

        // Funkce pro update součtů
        const diffInfoEl = document.getElementById('settlement-form-diff-info');
        const updateSums = () => {
            let sum = 0;
            let paidSum = 0;
            if (itemsEl) {
                itemsEl.querySelectorAll('.settle-item-cb:checked').forEach(cb => {
                    const amt = parseFloat(cb.dataset.amount) || 0;
                    const id = parseInt(cb.dataset.id, 10);
                    sum += amt;
                    if (type === 'energy') {
                        const item = filteredItems.find(it => it.entity_id === id);
                        if (item?.paid) paidSum += amt;
                    }
                });
            }
            if (advancesEl) advancesEl.value = UI.fmt(sum) + ' Kč';
            const actual = parseFloat(actualEl?.value) || 0;
            const diff = (type === 'energy') ? (actual - paidSum) : (actual - sum);
            if (diffEl) {
                if (Math.abs(diff) < 0.005) {
                    diffEl.value = 'Vyrovnáno';
                    diffEl.style.color = '';
                } else if (diff > 0) {
                    diffEl.value = UI.fmt(diff) + ' Kč (nedoplatek)';
                    diffEl.style.color = '#dc2626';
                } else {
                    diffEl.value = UI.fmt(Math.abs(diff)) + ' Kč (přeplatek)';
                    diffEl.style.color = '#16a34a';
                }
            }
            if (diffInfoEl) {
                if (isEdit && existingSettlement?.settlement_request) {
                    const sr = existingSettlement.settlement_request;
                    const parts = ['Zaevidováno v požadavcích'];
                    if (sr.paid_at) parts.push('uhrazeno ' + UI.fmtDate(sr.paid_at));
                    diffInfoEl.textContent = parts.join(', ');
                } else {
                    diffInfoEl.textContent = '';
                }
            }
        };

        if (itemsEl) {
            itemsEl.querySelectorAll('.settle-item-cb').forEach(cb => { cb.onchange = updateSums; });
        }
        if (actualEl) actualEl.oninput = updateSums;
        updateSums();

        // Save handler
        if (saveBtn) {
            saveBtn.onclick = async () => {
                const actual = parseFloat(actualEl?.value);
                if (isNaN(actual)) {
                    if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = 'Zadejte platnou skutečnou částku.'; }
                    return;
                }
                const ids = [];
                if (itemsEl) {
                    itemsEl.querySelectorAll('.settle-item-cb:checked').forEach(cb => {
                        ids.push(parseInt(cb.dataset.id, 10));
                    });
                }
                if (!ids.length) {
                    if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = 'Vyberte alespoň jednu zálohu/požadavek.'; }
                    return;
                }

                try {
                    if (isEdit) {
                        await settlementApi({
                            action: 'settlement_update',
                            settlement_id: editSettlementId,
                            actual_amount: actual,
                            request_ids: ids,
                            label: labelEl?.value || '',
                            request_label: reqLabelEl?.value || '',
                            note: noteEl?.value || '',
                            lock: lockEl?.checked || false,
                        });
                    } else {
                        await settlementApi({
                            action: 'settlement_save',
                            contracts_id: cid,
                            type,
                            actual_amount: actual,
                            request_ids: ids,
                            label: labelEl?.value || '',
                            request_label: reqLabelEl?.value || '',
                            note: noteEl?.value || '',
                            lock: lockEl?.checked || false,
                        });
                    }
                    UI.modalClose('modal-settlement-form');
                    loadSettlements(type);
                    loadPaymentRequests(_paymentRequestsContractsId);
                } catch (e) {
                    if (alertEl) { alertEl.className = 'alert alert-err show'; alertEl.textContent = e.message; }
                }
            };
        }

        UI.modalOpen('modal-settlement-form');
    }

    // ── Zobrazit/skrýt sekce vyúčtování ─────────────────────────────
    function showSettlementsSection(type) {
        const wrapEl = document.getElementById('con-settlements-wrap');
        if (wrapEl) wrapEl.style.display = '';
        const sectionEl = document.getElementById(type === 'energy' ? 'con-energy-settlements-section' : 'con-deposit-settlements-section');
        if (sectionEl) sectionEl.style.display = '';
        loadSettlements(type);
    }

    function hideSettlementsSections() {
        const wrapEl = document.getElementById('con-settlements-wrap');
        if (wrapEl) wrapEl.style.display = 'none';
        ['con-energy-settlements-section', 'con-deposit-settlements-section'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    function initSettlementHandlers() {
        if (_settlementInited) return;
        _settlementInited = true;

        const btnEnergy = document.getElementById('btn-energy-settlement');
        if (btnEnergy) {
            btnEnergy.onclick = () => {
                showSettlementsSection('energy');
                // Otevřít rovnou formulář pro nové vyúčtování
                openSettlementForm('energy', null);
            };
        }

        const btnDeposit = document.getElementById('btn-deposit-settlement');
        if (btnDeposit) {
            btnDeposit.onclick = () => {
                showSettlementsSection('deposit');
                openSettlementForm('deposit', null);
            };
        }
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
                const lastMonthVal = document.getElementById('con-last-month-rent').value.trim();
                return {
                    properties_id: Number(document.getElementById('con-property').value),
                    tenants_id:    Number(document.getElementById('con-tenant').value),
                    contract_start: document.getElementById('con-start').value,
                    contract_end:   document.getElementById('con-end').value || '',
                    monthly_rent:   document.getElementById('con-rent').value,
                    first_month_rent: firstMonthVal ? parseFloat(firstMonthVal) : null,
                    last_month_rent: lastMonthVal ? parseFloat(lastMonthVal) : null,
                    contract_url:   document.getElementById('con-contract-url').value.trim() || null,
                    deposit_amount: depAmt ? parseFloat(depAmt) : null,
                    deposit_paid_date: document.getElementById('con-deposit-paid-date').value || null,
                    deposit_return_date: document.getElementById('con-deposit-return-date').value || null,
                    note:           document.getElementById('con-note').value.trim(),
                    default_payment_method: (() => { const v = document.getElementById('con-default-payment-method').value; return v === 'account' || v === 'cash' ? v : null; })(),
                    default_bank_accounts_id: (() => { const v = document.getElementById('con-default-account').value; const n = parseInt(v, 10); return (v && !isNaN(n) && n > 0) ? n : null; })(),
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
                document.getElementById('con-last-month-rent').value = row.last_month_rent ?? '';
                document.getElementById('con-contract-url').value = row.contract_url || '';
                document.getElementById('con-deposit-amount').value = row.deposit_amount ?? '';
                document.getElementById('con-deposit-paid-date').value = row.deposit_paid_date ? row.deposit_paid_date.slice(0, 10) : '';
                document.getElementById('con-deposit-return-date').value = row.deposit_return_date ? row.deposit_return_date.slice(0, 10) : '';
                document.getElementById('con-note').value     = row.note           || '';
                const defMethod = (row.default_payment_method === 'account' || row.default_payment_method === 'cash') ? row.default_payment_method : '';
                document.getElementById('con-default-payment-method').value = defMethod;
                const defAccWrap = document.getElementById('con-default-account-wrap');
                if (defAccWrap) defAccWrap.style.display = defMethod === 'account' ? '' : 'none';
                const defAcc = document.getElementById('con-default-account');
                if (defAcc) {
                    const accId = row.default_bank_accounts_id != null ? Number(row.default_bank_accounts_id) : 0;
                    defAcc.value = accId > 0 ? String(accId) : '';
                }
                if (typeof UI.updateSearchableSelectDisplay === 'function') {
                    UI.updateSearchableSelectDisplay('con-property');
                    UI.updateSearchableSelectDisplay('con-tenant');
                    // Po přepnutí z Platby se musí znovu aktivovat zobrazení – odložíme o jeden frame
                    requestAnimationFrame(() => {
                        UI.updateSearchableSelectDisplay('con-property');
                        UI.updateSearchableSelectDisplay('con-tenant');
                    });
                }
                toggleFirstMonthRentVisibility();
                toggleLastMonthRentVisibility();
                const contractsId = row.contracts_id ?? row.id;
                loadRentChanges(contractsId);
                loadPaymentRequests(contractsId);
                document.getElementById('con-rent-changes-wrap').style.display = 'block';
                const settleBtns = document.getElementById('con-settlement-btns');
                if (settleBtns) settleBtns.style.display = 'flex';
                // Načíst existující vyúčtování
                const settleWrap = document.getElementById('con-settlements-wrap');
                if (settleWrap) settleWrap.style.display = '';
                loadSettlements('energy');
                loadSettlements('deposit');
            },
            resetForm() {
                ['con-property','con-tenant','con-start','con-end','con-rent','con-first-month-rent','con-contract-url','con-deposit-amount','con-deposit-paid-date','con-deposit-return-date','con-note','con-default-payment-method','con-default-account']
                    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
                const defAccWrap = document.getElementById('con-default-account-wrap');
                if (defAccWrap) defAccWrap.style.display = 'none';
                document.getElementById('con-first-month-wrap').style.display = 'none';
                document.getElementById('con-rent-changes-wrap').style.display = 'none';
                const prWrap = document.getElementById('con-payment-requests-wrap');
                if (prWrap) prWrap.style.display = 'none';
                const settleBtns = document.getElementById('con-settlement-btns');
                if (settleBtns) settleBtns.style.display = 'none';
                hideSettlementsSections();
            },
            async onSaved(result, editMode) {
                loadList();
                if (!editMode || !result) return;
                const end = result.contract_end;
                if (!end || end === '') return;
                const today = new Date().toISOString().slice(0, 10);
                if (end > today) return;
                const cid = result.contracts_id ?? result.id;
                let unpaidCount = 0;
                let energyItemsCount = 0;
                try {
                    const depResp = await fetch('/api/settlement.php', {
                        method: 'POST', credentials: 'include',
                        headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': Api.getCsrf() },
                        body: JSON.stringify({ action: 'deposit_info', contracts_id: cid })
                    });
                    const depData = await depResp.json();
                    if (depData.ok && depData.data) unpaidCount = (depData.data.unpaid_requests || []).length;
                    const enResp = await fetch('/api/settlement.php', {
                        method: 'POST', credentials: 'include',
                        headers: { 'Content-Type': 'application/json', 'X-Csrf-Token': Api.getCsrf() },
                        body: JSON.stringify({ action: 'energy_info', contracts_id: cid })
                    });
                    const enData = await enResp.json();
                    if (enData.ok && enData.data) energyItemsCount = (enData.data.items || []).length;
                } catch (_) { return; }
                if (unpaidCount > 0 || energyItemsCount > 0) {
                    form.startEdit(result);
                    const parts = [];
                    if (unpaidCount > 0) parts.push('Na smlouvě jsou nedoplatky.');
                    if (energyItemsCount > 0) parts.push('Jsou zde zálohy na energie.');
                    alertShow('con-alert', parts.join(' ') + ' Zobrazte vyúčtování kauce nebo vyúčtování energií pomocí tlačítek níže.', 'ok');
                }
            },
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

    function isLastDayOfMonth(dateStr) {
        if (!dateStr || dateStr.length < 10) return false;
        const d = new Date(dateStr + 'T12:00:00');
        if (isNaN(d.getTime())) return false;
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return d.getDate() === lastDay;
    }

    function toggleLastMonthRentVisibility() {
        const endVal = document.getElementById('con-end').value;
        const wrap = document.getElementById('con-last-month-wrap');
        if (!wrap) return;
        if (!endVal || endVal.length < 10) {
            wrap.style.display = 'none';
            return;
        }
        wrap.style.display = isLastDayOfMonth(endVal) ? 'none' : 'block';
    }

    document.getElementById('con-start').addEventListener('change', toggleFirstMonthRentVisibility);
    document.getElementById('con-end').addEventListener('change', toggleLastMonthRentVisibility);
    const conDefaultMethodEl = document.getElementById('con-default-payment-method');
    const conDefaultAccWrap = document.getElementById('con-default-account-wrap');
    if (conDefaultMethodEl && conDefaultAccWrap) {
        conDefaultMethodEl.addEventListener('change', function () {
            conDefaultAccWrap.style.display = conDefaultMethodEl.value === 'account' ? '' : 'none';
        });
    }

    // ── fill dropdowns ──────────────────────────────────────────────────
    async function fillDropdowns() {
        const [props, tens, bankAccounts] = await Promise.all([
            Api.crudList('properties'),
            Api.crudList('tenants'),
            Api.crudList('bank_accounts'),
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

        const accSel = document.getElementById('con-default-account');
        if (accSel) {
            const list = bankAccounts || [];
            accSel.innerHTML = '<option value="">— Vyberte účet —</option>' +
                list.map(b => {
                    const bid = b.bank_accounts_id ?? b.id;
                    return '<option value="' + bid + '">' + UI.esc(b.name) + (b.account_number ? ' – ' + UI.esc(b.account_number) : '') + '</option>';
                }).join('');
        }
    }

    // ── řazení tabulky smluv (jedna úroveň = jeden sloupec; Ctrl+Klik = přidat další) ──────────────────────────────────────────────
    let _sortState = { order: [{ key: 'property_name', dir: 'asc' }] };

    function getContractSortValue(c, key) {
        switch (key) {
            case 'property_name': return (c.property_name || '').toLowerCase();
            case 'tenant_name': return (c.tenant_name || '').trim().toLowerCase();
            case 'contract_start': return c.contract_start || '';
            case 'contract_end': return c.contract_end || '9999-99-99';
            case 'monthly_rent': return parseFloat(c.monthly_rent) || 0;
            case 'deposit_amount': return parseFloat(c.deposit_amount) || 0;
            default: return '';
        }
    }

    function compareValues(va, vb) {
        if (Array.isArray(va) && Array.isArray(vb)) {
            return (va[0] || '').localeCompare(vb[0] || '') || (va[1] || '').localeCompare(vb[1] || '');
        }
        if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb);
        return va < vb ? -1 : (va > vb ? 1 : 0);
    }

    function sortContracts(data, state) {
        const order = state.order && state.order.length ? state.order : [{ key: 'property_name', dir: 'asc' }];
        return [...data].sort((a, b) => {
            for (let i = 0; i < order.length; i++) {
                const { key, dir } = order[i];
                const va = getContractSortValue(a, key);
                const vb = getContractSortValue(b, key);
                const cmp = compareValues(va, vb);
                if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
            }
            return 0;
        });
    }

    function applySortAndRender() {
        const sorted = sortContracts(_cache, _sortState);
        const conTable = document.getElementById('con-table');
        if (!conTable) return;
        UI.renderTable('con-table',
            [
                { label: 'Nemovitost', sortKey: 'property_name' },
                { label: 'Nájemník', sortKey: 'tenant_name' },
                { label: 'Od', sortKey: 'contract_start', hideMobile: true },
                { label: 'Do', sortKey: 'contract_end', hideMobile: true },
                { label: 'Nájemné', sortKey: 'monthly_rent' },
                { label: 'Kauce', sortKey: 'deposit_amount', hideMobile: true },
                { label: 'Smlouva', hideMobile: true, colClass: 'col-contract' },
                { label: 'Poznámka', hideMobile: true },
                { label: 'Akce', act: true },
            ],
            sorted,
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
                const noteText = (c.note || '').trim();
                const noteCell = noteText
                    ? '<span class="cell-note-truncate" title="' + UI.esc(noteText) + '">' + UI.esc(noteText) + '</span>'
                    : '<span style="color:var(--txt3)">—</span>';
                return (
                    '<td>' + UI.esc(c.property_name) + '</td>' +
                    '<td><strong>' + UI.esc(c.tenant_name) + '</strong></td>' +
                    '<td class="col-hide-mobile">' + (c.contract_start ? UI.fmtDate(c.contract_start) : '—') + '</td>' +
                    '<td class="col-hide-mobile">' + (c.contract_end ? UI.fmtDate(c.contract_end) : '<span style="color:var(--txt3)">neurčitá</span>') + '</td>' +
                    '<td>' + UI.fmt(c.monthly_rent) + ' Kč</td>' +
                    '<td class="col-hide-mobile">' + depositCell + '</td>' +
                    '<td class="col-contract col-hide-mobile">' + contractLink + '</td>' +
                    '<td class="col-note cell-note-wrap col-hide-mobile">' + noteCell + '</td>' +
                    '<td class="td-act">' +
                        '<button class="btn btn-ghost btn-sm" onclick="ContractsView.edit(' + (c.contracts_id ?? c.id) + ')">Úprava</button>' +
                        '<button class="btn btn-ghost btn-sm" onclick="PaymentsView.navigateWithFilter(' + (c.contracts_id ?? c.id) + ')">Platby</button>' +
                        '<button class="btn btn-danger btn-sm" onclick="ContractsView.del(' + (c.contracts_id ?? c.id) + ')">Smazat</button>' +
                    '</td>'
                );
            },
            { emptyMsg: 'Žádné smlouvy.', sortable: { order: _sortState.order }, striped: true }
        );
    }

    async function loadList() {
        try {
            const data = await Api.crudList('contracts');
            _cache = data;
            if (!_cache || !_cache.length) {
                document.getElementById('con-table').innerHTML = '<div class="empty">Žádné smlouvy.</div>';
                return;
            }
            applySortAndRender();
        } catch (e) { return; }
    }

    function edit(id) {
        const row = _cache.find(r => (r.contracts_id ?? r.id) == id);
        if (row) {
            const entityId = row.contracts_id ?? row.id;
            history.replaceState(null, '', '#contracts&edit=' + entityId);
            form.startEdit(row);
        }
    }

    function del(id) {
        UI.confirmDelete('contracts', id, 'Smazat tuto smlouvu?', () => {
            _cache = [];
            loadList();
        });
    }

    function initTableSortClick() {
        const conTable = document.getElementById('con-table');
        if (!conTable || conTable.dataset.sortBound) return;
        conTable.dataset.sortBound = '1';
        conTable.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-sort]');
            if (!th) return;
            const key = th.getAttribute('data-sort');
            if (!key) return;
            const order = _sortState.order || [];
            const idx = order.findIndex(o => o.key === key);
            if (e.ctrlKey || e.metaKey) {
                if (idx >= 0) {
                    order[idx].dir = order[idx].dir === 'asc' ? 'desc' : 'asc';
                } else {
                    order.push({ key, dir: 'asc' });
                }
                _sortState.order = order;
            } else {
                if (idx >= 0 && order.length === 1) {
                    _sortState.order = [{ key, dir: order[idx].dir === 'asc' ? 'desc' : 'asc' }];
                } else {
                    _sortState.order = [{ key, dir: 'asc' }];
                }
            }
            applySortAndRender();
        });
    }

    async function load() {
        initForm();
        form.exitEdit();
        initTenantModal();
        initRentChangesHandlers();
        initSettlementHandlers();
        initTableSortClick();
        _cache = [];
        await fillDropdowns();
        await loadList();
        prefillFromCalendarIfPending();
        if (typeof UI.createSearchableSelect === 'function') {
            UI.createSearchableSelect('con-property');
            UI.createSearchableSelect('con-tenant');
        }

        const cancelBtn = document.getElementById('btn-con-cancel');
        if (cancelBtn && !cancelBtn.dataset.hashListener) {
            cancelBtn.dataset.hashListener = '1';
            cancelBtn.addEventListener('click', () => {
                setTimeout(() => { history.replaceState(null, '', '#contracts'); }, 0);
            });
        }

        try {
            const raw = sessionStorage.getItem('dashboard-open-edit');
            if (raw) {
                const { view, id } = JSON.parse(raw);
                if (view === 'contracts' && id) {
                    sessionStorage.removeItem('dashboard-open-edit');
                    const numId = parseInt(id, 10);
                    if (!isNaN(numId)) setTimeout(() => ContractsView.edit(numId), 0);
                    return;
                }
            }
        } catch (_) {}

        const hashRaw = (location.hash.slice(1) || '').toLowerCase();
        if (hashRaw.startsWith('contracts')) {
            const parts = hashRaw.split('&').slice(1);
            let editId = null;
            let tenantsId = null;
            parts.forEach(p => {
                const eq = p.indexOf('=');
                if (eq > 0) {
                    const key = p.slice(0, eq);
                    const val = decodeURIComponent(p.slice(eq + 1));
                    if (key === 'edit') editId = val;
                    else if (key === 'tenants_id') tenantsId = val;
                }
            });
            if (editId) {
                const numId = parseInt(editId, 10);
                if (!isNaN(numId)) {
                    setTimeout(async () => {
                        const row = _cache.find(r => (r.contracts_id ?? r.id) == numId);
                        if (row) {
                            ContractsView.edit(numId);
                        } else {
                            try {
                                const r = await Api.crudGet('contracts', numId);
                                if (r) {
                                    form.startEdit(r);
                                    history.replaceState(null, '', '#contracts&edit=' + (r.contracts_id ?? r.id));
                                }
                            } catch (_) {}
                        }
                    }, 0);
                }
            } else if (tenantsId) {
                const numTenantsId = parseInt(tenantsId, 10);
                if (!isNaN(numTenantsId)) {
                    form.startAdd();
                    const tenantSel = document.getElementById('con-tenant');
                    if (tenantSel) {
                        tenantSel.value = String(numTenantsId);
                        if (typeof UI.updateSearchableSelectDisplay === 'function') UI.updateSearchableSelectDisplay('con-tenant');
                    }
                }
            }
        }
    }

    let _pendingPrefill = null;
    function prefillFromCalendar(propertyId, monthKey, propertyName) {
        _pendingPrefill = { propertyId, monthKey, propertyName };
    }
    function prefillFromCalendarIfPending() {
        if (!_pendingPrefill) return;
        const { propertyId, monthKey } = _pendingPrefill;
        _pendingPrefill = null;
        form.startAdd();
        const propEl = document.getElementById('con-property');
        if (propEl) {
            propEl.value = String(propertyId);
        }
        const startEl = document.getElementById('con-start');
        if (startEl) startEl.value = monthKey + '-01';
    }

    function getCache() { return _cache; }

    return { load, edit, del, getCache, prefillFromCalendar };
})();

App.registerView('contracts', ContractsView.load);
window.ContractsView = ContractsView;
