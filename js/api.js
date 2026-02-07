// js/api.js – centralizovaný fetch wrapper
// Všechny API volání procházejí sem. CSRF token se injectuje automaticky.

const Api = (() => {
    let _csrf = '';

    // ── core fetch ──────────────────────────────────────────────────────
    async function request(url, opts = {}, retried = false) {
        const headers = { 'Content-Type': 'application/json' };
        if (_csrf && opts.method && opts.method !== 'GET') {
            headers['X-Csrf-Token'] = _csrf;
        }
        const res = await fetch(url, { ...opts, headers });
        const text = await res.text();
        let json;
        try {
            json = text ? JSON.parse(text) : {};
        } catch (e) {
            const hint = text.includes('config.php') || text.includes('Fatal error')
                ? ' Zkontrolujte, zda existuje config.php a databáze je dostupná.'
                : '';
            throw new Error('Server vrátil neplatnou odpověď.' + hint);
        }
        // 403 CSRF – obnovit token a zkusit znovu (1×)
        if (!json.ok && res.status === 403 && (json.error || '').includes('CSRF') && !retried && opts.method && opts.method !== 'GET') {
            try {
                const authRes = await fetch('/api/auth.php');
                const authJson = await authRes.json();
                if (authJson.ok && authJson.data && authJson.data.csrf) {
                    _csrf = authJson.data.csrf;
                    return request(url, opts, true);
                }
            } catch (e) { /* ignorovat */ }
        }
        if (!json.ok) throw new Error(json.error || 'Chyba serveru');
        return json.data;
    }

    function post(url, payload) {
        return request(url, { method: 'POST', body: JSON.stringify(payload) });
    }

    function get(url) {
        return request(url);
    }

    // ── setter / getter csrf ────────────────────────────────────────────
    function setCsrf(token) { _csrf = token; }
    function getCsrf()      { return _csrf; }

    // ════════════════════════════════════════════════════════════════════
    // AUTH
    // ════════════════════════════════════════════════════════════════════
    async function authCheck() {
        // Vrátí current user (+ csrf) nebo hodí error
        return get('/api/auth.php');
    }

    async function authLogin(email, password) {
        return post('/api/auth.php', { action: 'login', email, password });
    }

    async function authLogout() {
        return post('/api/auth.php', { action: 'logout' });
    }

    // ════════════════════════════════════════════════════════════════════
    // GENERIC CRUD  (properties | tenants | contracts | payments)
    // ════════════════════════════════════════════════════════════════════
    function crudList(table, params = {}) {
        let url = '/api/crud.php?table=' + table;
        Object.keys(params).forEach(k => { url += '&' + k + '=' + encodeURIComponent(params[k]); });
        return get(url);
    }

    function crudGet(table, id) {
        return get('/api/crud.php?table=' + encodeURIComponent(table) + '&id=' + encodeURIComponent(id));
    }

    function crudAdd(table, data) {
        return post('/api/crud.php?table=' + table, { action: 'add', table, ...data });
    }

    function crudEdit(table, id, data) {
        return post('/api/crud.php?table=' + table, { action: 'edit', table, id, ...data });
    }

    function crudDelete(table, id) {
        return post('/api/crud.php?table=' + table, { action: 'delete', table, id });
    }

    function paymentsEditBatch(batchId, data) {
        return post('/api/crud.php?table=payments', { action: 'editBatch', table: 'payments', payment_batch_id: batchId, ...data });
    }

    function paymentsDeleteBatch(batchId) {
        return post('/api/crud.php?table=payments', { action: 'deleteBatch', table: 'payments', payment_batch_id: batchId });
    }

    /** Načtení pohybů z FIO banky pro daný účet a období. */
    function fioFetch(bankAccountsId, from, to) {
        const params = new URLSearchParams({ bank_accounts_id: bankAccountsId });
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        return get('/api/fio-fetch.php?' + params.toString());
    }

    /** Import z FIO do payment_imports (uloží pohyby ke kontrole). */
    function fioImport(bankAccountsId, from, to) {
        return post('/api/fio-import.php', { bank_accounts_id: bankAccountsId, from: from || undefined, to: to || undefined });
    }

    /** Seznam importů (filtry: bank_accounts_id, from, to, to_review, history). */
    function paymentImportsList(params) {
        const q = new URLSearchParams();
        if (params && params.bank_accounts_id) q.set('bank_accounts_id', params.bank_accounts_id);
        if (params && params.from) q.set('from', params.from);
        if (params && params.to) q.set('to', params.to);
        if (params && params.to_review === true) q.set('to_review', '1');
        if (params && params.history === true) q.set('history', '1');
        return get('/api/crud.php?table=payment_imports' + (q.toString() ? '&' + q.toString() : ''));
    }

    /** Úprava importu (párování: contracts_id, period_year, period_month, period_year_to?, period_month_to?, payment_type). */
    function paymentImportEdit(id, data) {
        return post('/api/crud.php?table=payment_imports', { action: 'edit', table: 'payment_imports', id: id, ...data });
    }

    /** Smazání importu. */
    function paymentImportDelete(id) {
        return post('/api/crud.php?table=payment_imports', { action: 'delete', table: 'payment_imports', id: id });
    }

    /** Hromadné schválení importů → vytvoření plateb. */
    function paymentImportsApprove(importIds) {
        return post('/api/payment-imports-approve.php', { import_ids: importIds });
    }

    /** Hromadné schválení plateb (např. po načtení z FIO). payment_ids = pole entity_id. */
    function paymentsApprove(paymentIds) {
        return post('/api/payments-approve.php', { payment_ids: paymentIds });
    }

    /** Přiřadit platbu k požadavku (nastaví payment_requests.payments_id a paid_at). */
    function paymentRequestLink(paymentRequestId, paymentsId) {
        return post('/api/crud.php?table=payment_requests', { action: 'link_payment_request', table: 'payment_requests', payment_request_id: paymentRequestId, payments_id: paymentsId });
    }

    /** Odpojit platbu od požadavku (zruší payment_requests.payments_id a paid_at). */
    function paymentRequestUnlink(paymentRequestId) {
        return post('/api/crud.php?table=payment_requests', { action: 'unlink_payment_request', table: 'payment_requests', payment_request_id: paymentRequestId });
    }

    /** Uzavřít požadavek bez platby (nastaví paid_at, payments_id = null, note = důvod). Poznámka je povinná. */
    function paymentRequestCloseWithoutPayment(paymentRequestId, note) {
        return post('/api/crud.php?table=payment_requests', { action: 'close_request_without_payment', table: 'payment_requests', payment_request_id: paymentRequestId, note: note });
    }

    // ════════════════════════════════════════════════════════════════════
    // DASHBOARD
    // ════════════════════════════════════════════════════════════════════
    function dashboardLoad(year, showEnded, extended) {
        let url = '/api/dashboard.php';
        const params = [];
        if (year) params.push('year=' + year);
        if (showEnded) params.push('show_ended=1');
        if (extended) params.push('extended=1');
        if (params.length) url += '?' + params.join('&');
        return get(url);
    }

    async function propertyStats(propertiesId, year) {
        let url = '/api/property-stats.php?properties_id=' + encodeURIComponent(propertiesId);
        if (year) url += '&year=' + encodeURIComponent(year);
        return get(url);
    }

    // ════════════════════════════════════════════════════════════════════
    // USERS
    // ════════════════════════════════════════════════════════════════════
    function usersList() {
        return get('/api/users.php');
    }

    function usersAdd(data) {
        return post('/api/users.php', { action: 'add', ...data });
    }

    function usersDelete(id) {
        return post('/api/users.php', { action: 'delete', id });
    }

    function usersChangePassword(id, password) {
        return post('/api/users.php', { action: 'change_password', id, password });
    }

    // ════════════════════════════════════════════════════════════════════
    // GLOBÁLNÍ VYHLEDÁVÁNÍ
    // ════════════════════════════════════════════════════════════════════
    async function search(q) {
        const qs = String(q ?? '').trim();
        if (!qs) return { tenants: [], properties: [], contracts: [] };
        return get('/api/search.php?q=' + encodeURIComponent(qs));
    }

    // ════════════════════════════════════════════════════════════════════
    // ARES – načtení firmy podle IČ
    // ════════════════════════════════════════════════════════════════════
    async function aresLookup(ico) {
        const icoClean = String(ico).replace(/\D/g, '');
        if (icoClean.length !== 8) throw new Error('IČ musí mít 8 číslic.');
        return get('/api/ares-lookup.php?ico=' + encodeURIComponent(icoClean));
    }

    // ── public interface ────────────────────────────────────────────────
    return {
        setCsrf, getCsrf,
        authCheck, authLogin, authLogout,
        crudList, crudGet, crudAdd, crudEdit, crudDelete, paymentsEditBatch, paymentsDeleteBatch, paymentsApprove, paymentRequestLink, paymentRequestUnlink, paymentRequestCloseWithoutPayment,
        fioFetch, fioImport,
        paymentImportsList, paymentImportEdit, paymentImportDelete, paymentImportsApprove,
        dashboardLoad,
        propertyStats,
        search,
        usersList, usersAdd, usersDelete, usersChangePassword,
        aresLookup,
    };
})();
