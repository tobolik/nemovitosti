// js/api.js – centralizovaný fetch wrapper
// Všechny API volání procházejí sem. CSRF token se injectuje automaticky.

const Api = (() => {
    let _csrf = '';

    // ── core fetch ──────────────────────────────────────────────────────
    async function request(url, opts = {}) {
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
        Object.keys(params).forEach(k => { url += '&' + k + '=' + params[k]; });
        return get(url);
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

    // ════════════════════════════════════════════════════════════════════
    // DASHBOARD
    // ════════════════════════════════════════════════════════════════════
    function dashboardLoad(year) {
        const url = year ? '/api/dashboard.php?year=' + year : '/api/dashboard.php';
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

    // ── public interface ────────────────────────────────────────────────
    return {
        setCsrf, getCsrf,
        authCheck, authLogin, authLogout,
        crudList, crudAdd, crudEdit, crudDelete,
        dashboardLoad,
        usersList, usersAdd, usersDelete, usersChangePassword,
        aresLookup,
    };
})();
