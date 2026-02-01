// js/views/dashboard.js

App.registerView('dashboard', async () => {
    let data;
    try { data = await Api.dashboardLoad(); }
    catch (e) { return; }

    // ── aggregate stats ─────────────────────────────────────────────────
    const totExp  = data.reduce((s, d) => s + d.expected_total, 0);
    const totPaid = data.reduce((s, d) => s + d.total_paid, 0);
    const totBal  = totExp - totPaid;

    document.getElementById('dash-stats').innerHTML =
        '<div class="stat">' +
            '<div class="stat-icon purple">📋</div>' +
            '<div class="stat-val">' + data.length + '</div>' +
            '<div class="stat-label">Aktivní smlouvy</div>' +
        '</div>' +
        '<div class="stat">' +
            '<div class="stat-icon purple">%</div>' +
            '<div class="stat-val">' + UI.fmt(totExp) + ' Kč</div>' +
            '<div class="stat-label">Celkem očekáváno</div>' +
        '</div>' +
        '<div class="stat stat-ok">' +
            '<div class="stat-icon green">✓</div>' +
            '<div class="stat-val green">' + UI.fmt(totPaid) + ' Kč</div>' +
            '<div class="stat-label">Celkem uhrazeno</div>' +
        '</div>' +
        '<div class="stat ' + (totBal > 0 ? 'stat-danger' : 'stat-ok') + '">' +
            '<div class="stat-icon ' + (totBal > 0 ? 'red' : 'green') + '">' + (totBal > 0 ? '!' : '✓') + '</div>' +
            '<div class="stat-val ' + (totBal > 0 ? 'red' : '') + '">' + UI.fmt(totBal) + ' Kč</div>' +
            '<div class="stat-label">Nesplacené</div>' +
        '</div>';

    // ── main table ──────────────────────────────────────────────────────
    if (!data.length) {
        document.getElementById('dash-table').innerHTML =
            '<div class="empty">Žádné aktivní smlouvy.<br>Začněte přidáním nemovitosti a nájemníka.</div>';
        return;
    }

    // Přiřadíme _rowClass pro zvýraznění řádků s dluhem
    data.forEach(d => { d._rowClass = d.balance > 0 ? 'row-warn' : ''; });

    UI.renderTable('dash-table',
        [
            { label: 'Nájemník' },
            { label: 'Nemovitost' },
            { label: 'Nájemné / měs.' },
            { label: 'Uhrazeno / Očekáváno' },
            { label: 'Stav' },
            { label: 'Neuhrazené měsíce' },
            { label: 'Akce', act: true },
        ],
        data,
        (d) => {
            const pct     = d.expected_total > 0 ? Math.min(100, (d.total_paid / d.expected_total) * 100) : 100;
            const hasDbt  = d.balance > 0;

            // Neuhrazené měsíce jako tagy s quick-add
            let tags = '';
            d.unpaid_months.forEach(u => {
                tags +=
                    '<span class="tag">' +
                        u.month + '/' + u.year +
                        ' <span class="tag-plus" onclick="DashboardView.quickPay(' +
                            d.contract_id + ',' + u.year + ',' + u.month + ',' + d.monthly_rent +
                        ')" title="Přidat platbu">+</span>' +
                    '</span>';
            });

            return (
                '<td><strong>' + UI.esc(d.tenant_name) + '</strong></td>' +
                '<td>' + UI.esc(d.property_name) + '</td>' +
                '<td>' + UI.fmt(d.monthly_rent) + ' Kč</td>' +
                '<td>' +
                    '<div class="prog-wrap">' +
                        '<div class="prog-bar"><div class="prog-fill ' + (hasDbt ? 'bad' : 'ok') + '" style="width:' + Math.round(pct) + '%"></div></div>' +
                        '<span class="prog-lbl">' + UI.fmt(d.total_paid) + ' / ' + UI.fmt(d.expected_total) + ' Kč</span>' +
                    '</div>' +
                '</td>' +
                '<td><span class="badge ' + (hasDbt ? 'badge-danger' : 'badge-ok') + '">' + (hasDbt ? 'Má dluh' : 'V pořádku') + '</span></td>' +
                '<td>' + (tags || '<span style="color:var(--txt3)">—</span>') + '</td>' +
                '<td class="td-act">' +
                    '<button class="btn btn-ghost btn-sm" onclick="PaymentsView.navigateWithFilter(' + d.contract_id + ')">Platby</button>' +
                '</td>'
            );
        },
        { emptyMsg: 'Žádné aktivní smlouvy.' }
    );
});

// Exposed globally so onclick in HTML can reach it
const DashboardView = {
    async quickPay(contractId, year, month, rent) {
        await App.navigate('payments');
        PaymentsView.prefill(contractId, year, month, rent);
    }
};
