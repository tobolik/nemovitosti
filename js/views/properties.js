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
            formCardId: 'prop-form-card',
            addBtnId:   'btn-prop-add',
            addLabel:   'Přidat nemovitost',
            editLabel:  'Uložit změny',
            successAddMsg: 'Nemovitost byla úspěšně přidána.',
            successEditMsg: 'Nemovitost byla úspěšně aktualizována.',
            validate(values) {
                if (values.purchase_date && !UI.isDateValid(values.purchase_date)) {
                    return 'Datum koupě: zadejte platné datum (např. únor má max. 29 dní).';
                }
                return null;
            },
            getValues() {
                return {
                    name:                   document.getElementById('prop-name').value.trim(),
                    address:                document.getElementById('prop-address').value.trim(),
                    size_m2:                document.getElementById('prop-size-m2').value || null,
                    purchase_price:         document.getElementById('prop-purchase-price').value || null,
                    purchase_date:          document.getElementById('prop-purchase-date').value || null,
                    purchase_contract_url:  document.getElementById('prop-purchase-contract-url').value.trim() || null,
                    valuation_date:         document.getElementById('prop-valuation-date').value || null,
                    valuation_amount:       document.getElementById('prop-valuation-amount').value || null,
                    type:                   document.getElementById('prop-type').value,
                    note:                   document.getElementById('prop-note').value.trim(),
                };
            },
            fillForm(row) {
                document.getElementById('prop-edit-id').value = String(row.properties_id ?? row.id);
                document.getElementById('prop-name').value                   = row.name                   || '';
                document.getElementById('prop-address').value                = row.address                || '';
                document.getElementById('prop-size-m2').value                 = row.size_m2                || '';
                document.getElementById('prop-purchase-price').value          = row.purchase_price         || '';
                document.getElementById('prop-purchase-date').value          = row.purchase_date          || '';
                document.getElementById('prop-purchase-contract-url').value   = row.purchase_contract_url || '';
                document.getElementById('prop-valuation-date').value         = row.valuation_date         || '';
                document.getElementById('prop-valuation-amount').value       = row.valuation_amount       || '';
                document.getElementById('prop-type').value                    = row.type                   || 'apartment';
                document.getElementById('prop-note').value                    = row.note                   || '';
                const tabUdaje = document.getElementById('prop-tab-udaje');
                const tabStatistiky = document.getElementById('prop-tab-statistiky');
                const tabs = document.getElementById('prop-tabs');
                if (tabUdaje) tabUdaje.style.display = '';
                if (tabStatistiky) tabStatistiky.style.display = 'none';
                if (tabs) {
                    tabs.querySelectorAll('.prop-tab').forEach(b => b.classList.remove('active'));
                    const btnUdaje = tabs.querySelector('.prop-tab[data-tab="udaje"]');
                    if (btnUdaje) btnUdaje.classList.add('active');
                }
            },
            resetForm() {
                ['prop-name','prop-address','prop-size-m2','prop-purchase-price','prop-purchase-date','prop-purchase-contract-url','prop-valuation-date','prop-valuation-amount','prop-note'].forEach(id =>
                    document.getElementById(id).value = ''
                );
                document.getElementById('prop-type').value = 'apartment';
                const tabUdaje = document.getElementById('prop-tab-udaje');
                const tabStatistiky = document.getElementById('prop-tab-statistiky');
                const tabs = document.getElementById('prop-tabs');
                if (tabUdaje) tabUdaje.style.display = '';
                if (tabStatistiky) tabStatistiky.style.display = 'none';
                if (tabs) {
                    tabs.querySelectorAll('.prop-tab').forEach(b => b.classList.remove('active'));
                    const btnUdaje = tabs.querySelector('.prop-tab[data-tab="udaje"]');
                    if (btnUdaje) btnUdaje.classList.add('active');
                }
            },
            onSaved: loadList,
        });
    }

    // ── list loader ─────────────────────────────────────────────────────
    async function loadList() {
        let data;
        try { data = await Api.crudList('properties'); }
        catch (e) { return; }
        _cache = data;

        UI.renderTable('prop-table',
            [
                { label: 'Název' },
                { label: 'Typ' },
                { label: 'Adresa', hideMobile: true },
                { label: 'Výměra', hideMobile: true },
                { label: 'Kupní cena', hideMobile: true },
                { label: 'Datum koupě', hideMobile: true },
                { label: 'Odhad / ROI', hideMobile: true, title: 'Odhadní cena k datu; ROI = roční nájem / odhadní cena' },
                { label: 'Vybraný nájem', title: 'Celkem vybraný nájem (platby typu nájem) za celou dobu' },
                { label: 'Smlouva', hideMobile: true },
                { label: 'Poznámka', hideMobile: true },
                { label: 'Akce', act: true },
            ],
            data,
            (p) => {
                const url = p.purchase_contract_url;
                const contractLink = url
                    ? '<a href="' + UI.esc(url) + '" target="_blank" rel="noopener" class="contract-preview-trigger" data-url="' + UI.esc(url) + '" title="Náhled smlouvy (najeď myší)">📄</a>'
                    : '<span style="color:var(--txt3)">—</span>';
                const valuationStr = p.valuation_amount != null && p.valuation_amount !== ''
                    ? (p.valuation_date ? UI.fmtDate(p.valuation_date) + ': ' : '') + UI.fmt(p.valuation_amount) + ' Kč'
                    : '—';
                const roiStr = p.roi_pct != null ? '<strong>' + Number(p.roi_pct) + ' %</strong>' : '—';
                const odhadRoiCell = valuationStr !== '—' || roiStr !== '—'
                    ? (valuationStr !== '—' ? valuationStr + '<br>' : '') + (roiStr !== '—' ? 'ROI ' + roiStr : '')
                    : '—';
                const totalRent = (p.total_rent_received != null && Number(p.total_rent_received) > 0)
                    ? '<strong>' + UI.fmt(p.total_rent_received) + ' Kč</strong>' : '—';
                return (
                    '<td><strong>' + UI.esc(p.name) + '</strong></td>' +
                    '<td>' + UI.esc(TYPE_LABELS[p.type] || p.type) + '</td>' +
                    '<td class="col-address col-hide-mobile">' + UI.esc(p.address) + '</td>' +
                    '<td class="col-hide-mobile">' + (p.size_m2 ? UI.fmt(p.size_m2) + ' m²' : '—') + '</td>' +
                    '<td class="col-hide-mobile">' + (p.purchase_price ? UI.fmt(p.purchase_price) + ' Kč' : '—') + '</td>' +
                    '<td class="col-hide-mobile">' + (p.purchase_date ? UI.fmtDate(p.purchase_date) : '—') + '</td>' +
                    '<td class="col-hide-mobile">' + odhadRoiCell + '</td>' +
                    '<td>' + totalRent + '</td>' +
                    '<td class="col-hide-mobile contract-preview-cell">' + contractLink + '</td>' +
                    '<td class="col-note cell-note-wrap col-hide-mobile">' + (p.note ? '<span class="cell-note-truncate" title="' + UI.esc(p.note) + '">' + UI.esc(p.note) + '</span>' : '<span style="color:var(--txt3)">—</span>') + '</td>' +
                    '<td class="td-act">' +
                        '<button class="btn btn-ghost btn-sm" onclick="PropertiesView.edit(' + p.id + ')">Úprava</button>' +
                        '<button class="btn btn-danger btn-sm" onclick="PropertiesView.del(' + p.id + ')">Smazat</button>' +
                    '</td>'
                );
            },
            { emptyMsg: 'Žádné nemovitosti. Přidejte první výše.' }
        );
    }

    // ── exposed actions (volané z onclick) ──────────────────────────────
    let _cache = [];

    function edit(id) {
        const row = _cache.find(r => (r.properties_id ?? r.id) == id);
        if (row) form.startEdit(row);
    }

    function del(id) {
        UI.confirmDelete('properties', id, 'Smazat tuto nemovitost?', () => {
            _cache = [];
            loadList();
        });
    }

    // ── záložka Statistiky ──────────────────────────────────────────────
    function initPropertyTabs() {
        const tabsEl = document.getElementById('prop-tabs');
        const tabUdaje = document.getElementById('prop-tab-udaje');
        const tabStatistiky = document.getElementById('prop-tab-statistiky');
        const statsContent = document.getElementById('prop-stats-content');
        if (!tabsEl || !tabUdaje || !tabStatistiky) return;
        tabsEl.querySelectorAll('.prop-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                tabsEl.querySelectorAll('.prop-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (tab === 'udaje') {
                    tabUdaje.style.display = '';
                    tabStatistiky.style.display = 'none';
                } else {
                    tabUdaje.style.display = 'none';
                    tabStatistiky.style.display = 'block';
                    const editId = (document.getElementById('prop-edit-id') && document.getElementById('prop-edit-id').value) || '';
                    if (!editId) {
                        statsContent.innerHTML = '<p class="text-muted">Pro zobrazení statistik nejdříve uložte nemovitost a otevřete ji znovu.</p>';
                    } else {
                        loadPropertyStats(editId, statsContent);
                    }
                }
            });
        });
    }

    function fmtKc(n) {
        if (n == null || isNaN(n)) return '—';
        return (UI.fmt(n) + '\u00A0Kč').replace(/\s/g, '\u00A0');
    }

    async function loadPropertyStats(propEntityId, container) {
        if (!container) return;
        container.innerHTML = '<p class="text-muted">Načítám…</p>';
        const year = new Date().getFullYear();
        try {
            const data = await Api.propertyStats(propEntityId, year);
            let html = '<div class="prop-stats-grid">' +
                '<div class="stat"><div class="stat-label">Vytížení (' + year + ')</div><div class="stat-val">' + (data.utilization_rate_year ?? 0) + ' %</div></div>' +
                '<div class="stat"><div class="stat-label">Vytížení (celkem)</div><div class="stat-val">' + (data.utilization_rate_overall ?? 0) + ' %</div></div>' +
                '<div class="stat"><div class="stat-label">Vybraný nájem celkem</div><div class="stat-val green">' + fmtKc(data.total_rent_received) + '</div></div>' +
                '<div class="stat"><div class="stat-label">Náklady celkem</div><div class="stat-val">' + fmtKc(data.total_costs) + '</div></div>' +
                '<div class="stat"><div class="stat-label">Roční nájem (aktuální)</div><div class="stat-val">' + fmtKc(data.annual_rent) + '</div></div>';
            if (data.appreciation_pct_vs_purchase != null) {
                const sign = data.appreciation_pct_vs_purchase >= 0 ? '+' : '';
                html += '<div class="stat"><div class="stat-label">Zhodnocení (k\u00A0kupní ceně)</div><div class="stat-val">' + sign + data.appreciation_pct_vs_purchase + ' %</div></div>';
            }
            if (data.roi_pct != null) {
                html += '<div class="stat"><div class="stat-label">ROI (k\u00A0tržní ceně)</div><div class="stat-val">' + data.roi_pct + ' %</div></div>';
            }
            html += '<div class="stat"><div class="stat-label">Počet nájemníků</div><div class="stat-val">' + (data.tenants_total ?? 0) + '</div></div>' +
                '<div class="stat"><div class="stat-label">z toho FO / PO</div><div class="stat-val">' + (data.tenants_person ?? 0) + ' / ' + (data.tenants_company ?? 0) + '</div></div>' +
                '<div class="stat"><div class="stat-label">Počet smluv</div><div class="stat-val">' + (data.contracts_count ?? 0) + '</div></div>' +
                '<div class="stat"><div class="stat-label">Prům. doba nájmu</div><div class="stat-val">' + (data.avg_tenancy_months ?? 0) + ' měs.</div></div>';
            if (data.current_tenant_name) {
                html += '<div class="stat"><div class="stat-label">Aktuální nájemník</div><div class="stat-val stat-val-stat-tenant">' + UI.esc(data.current_tenant_name) + '</div></div>';
            }
            html += '</div>';

            if (data.by_year && data.by_year.length > 0) {
                const maxRent = Math.max(1, ...data.by_year.map(r => r.rent_received || 0));
                let chartBarsRent = '';
                let chartBarsUtil = '';
                data.by_year.forEach(row => {
                    const rent = row.rent_received || 0;
                    const utilPct = Math.round(((row.months_occupied || 0) / 12) * 100);
                    const pctRent = maxRent > 0 ? (rent / maxRent) * 100 : 0;
                    const titleRent = row.year + ': ' + fmtKc(rent);
                    const titleUtil = row.year + ': ' + (row.months_occupied || 0) + '/12 měsíců (' + utilPct + ' %)';
                    chartBarsRent += '<div class="prop-stats-chart-bar-wrap" title="' + UI.esc(titleRent) + '">' +
                        '<div class="prop-stats-chart-bar rent" style="height:' + Math.max(4, pctRent) + '%"></div>' +
                        '<span class="prop-stats-chart-label">' + row.year + '</span></div>';
                    chartBarsUtil += '<div class="prop-stats-chart-bar-wrap" title="' + UI.esc(titleUtil) + '">' +
                        '<div class="prop-stats-chart-bar util" style="height:' + Math.max(4, utilPct) + '%"></div>' +
                        '<span class="prop-stats-chart-label">' + row.year + '</span></div>';
                });
                html += '<div class="prop-stats-charts-row">' +
                    '<div class="prop-stats-chart-section">' +
                    '<h4 class="prop-stats-chart-title">Vybraný nájem po letech</h4>' +
                    '<div class="prop-stats-chart-legend"><span class="dot-rent">vybraný nájem</span></div>' +
                    '<div class="prop-stats-chart">' + chartBarsRent + '</div>' +
                    '</div>' +
                    '<div class="prop-stats-chart-section">' +
                    '<h4 class="prop-stats-chart-title">Vytížení po letech</h4>' +
                    '<div class="prop-stats-chart-legend"><span class="dot-util">% obsazených měsíců</span></div>' +
                    '<div class="prop-stats-chart">' + chartBarsUtil + '</div>' +
                    '</div></div>';
            }

            const totalRent = data.total_rent_received || 0;
            const totalCosts = data.total_costs || 0;
            const totalAll = totalRent + totalCosts;
            if (totalAll > 0) {
                const pctRent = (totalRent / totalAll) * 100;
                const pctCosts = (totalCosts / totalAll) * 100;
                html += '<div class="prop-stats-chart-section">' +
                    '<h4 class="prop-stats-chart-title">Příjmy vs náklady (celkem)</h4>' +
                    '<div class="prop-stats-summary-bar">' +
                    '<div class="seg-rent" style="width:' + pctRent + '%" title="Vybraný nájem ' + fmtKc(totalRent) + '"></div>' +
                    '<div class="seg-costs" style="width:' + pctCosts + '%" title="Náklady ' + fmtKc(totalCosts) + '"></div>' +
                    '</div>' +
                    '<div class="prop-stats-summary-labels">' +
                    '<span class="l-rent">Příjmy (nájem) ' + fmtKc(totalRent) + '</span>' +
                    '<span class="l-costs">Náklady ' + fmtKc(totalCosts) + '</span>' +
                    '<span class="l-net">Čistý výnos ' + fmtKc(totalRent - totalCosts) + '</span>' +
                    '</div></div>';
            }

            if (data.deposits && data.deposits.length > 0) {
                html += '<h4 style="margin-top:20px;margin-bottom:8px;font-size:.9rem">Kauce</h4><div class="prop-stats-tags">';
                data.deposits.forEach(d => {
                    const tenant = (d.tenant_name ? UI.esc(d.tenant_name) + ': ' : '');
                    const paid = d.paid_date ? 'zaplaceno ' + UI.fmtDate(d.paid_date) : 'nezaplaceno';
                    const ret = d.return_date ? 'vráceno ' + UI.fmtDate(d.return_date) : 'dosud nevrácena';
                    html += '<span class="tag prop-deposit-tag" title="' + tenant + paid + ', ' + ret + '">' +
                        'Kauce ' + fmtKc(d.amount) + ' – ' + paid + ' – ' + ret + '</span> ';
                });
                html += '</div>';
            }

            if (data.by_year && data.by_year.length > 0) {
                html += '<h4 style="margin-top:20px;margin-bottom:8px;font-size:.9rem">Přehled po letech</h4>' +
                    '<table class="prop-stats-table"><thead><tr><th>Rok</th><th class="col-num">Obs. měs.</th><th class="col-num">Vytížení</th><th class="col-num">Vybraný nájem</th><th class="col-num">Prům./měs.</th></tr></thead><tbody>';
                data.by_year.forEach(row => {
                    const mo = row.months_occupied ?? 0;
                    const rent = row.rent_received ?? 0;
                    const utilPct = mo > 0 ? Math.round((mo / 12) * 100) : 0;
                    const avgMonth = mo > 0 ? Math.round((rent / mo) * 100) / 100 : 0;
                    html += '<tr><td>' + row.year + '</td><td class="col-num">' + mo + '</td><td class="col-num">' + utilPct + ' %</td><td class="col-num">' + fmtKc(rent) + '</td><td class="col-num">' + (mo > 0 ? fmtKc(avgMonth) : '—') + '</td></tr>';
                });
                html += '</tbody></table>';
            }
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = '<p class="alert alert-err">' + UI.esc(e.message || 'Chyba načtení statistik.') + '</p>';
        }
    }

    // ── view loader (volání z routeru) ──────────────────────────────────
    async function load() {
        initForm();
        initPropertyTabs();
        form.exitEdit();
        _cache = [];
        await loadList();
        try {
            const raw = sessionStorage.getItem('dashboard-open-edit');
            if (raw) {
                const { view, id } = JSON.parse(raw);
                if (view === 'properties' && id) {
                    sessionStorage.removeItem('dashboard-open-edit');
                    const numId = parseInt(id, 10);
                    if (!isNaN(numId)) setTimeout(() => PropertiesView.edit(numId), 0);
                }
            }
        } catch (_) {}
    }

    return { load, edit, del };
})();

App.registerView('properties', PropertiesView.load);
window.PropertiesView = PropertiesView;
