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

    /** Přiřadit platbu k požadavku (nastaví payment_requests.payments_id a paid_at). */
    function paymentRequestLink(paymentRequestId, paymentsId) {
        return post('/api/crud.php?table=payment_requests', { action: 'link_payment_request', table: 'payment_requests', payment_request_id: paymentRequestId, payments_id: paymentsId });
    }

    /** Odpojit platbu od požadavku (zruší payment_requests.payments_id a paid_at). */
    function paymentRequestUnlink(paymentRequestId) {
        return post('/api/crud.php?table=payment_requests', { action: 'unlink_payment_request', table: 'payment_requests', payment_request_id: paymentRequestId });
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
        crudList, crudGet, crudAdd, crudEdit, crudDelete, paymentsEditBatch, paymentsDeleteBatch, paymentRequestLink, paymentRequestUnlink,
        dashboardLoad,
        search,
        usersList, usersAdd, usersDelete, usersChangePassword,
        aresLookup,
    };
})();
