// js/app.js – boot, router, session

const App = (() => {
    let currentUser = null;
    let currentView = '';

    // ── views registry: view name → loader function ─────────────────────
    // Populated by each view module via App.registerView()
    const views = {};

    function registerView(name, loaderFn) {
        views[name] = loaderFn;
    }

    // ── navigation ──────────────────────────────────────────────────────
    function navigate(viewName, forceReload = false) {
        if (!views[viewName]) return;
        if (!forceReload && currentView === viewName) return;
        currentView = viewName;

        // nav links highlighting
        document.querySelectorAll('.nav-link').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.view === viewName)
        );
        // show/hide views
        document.querySelectorAll('.view').forEach(v =>
            v.classList.toggle('active', v.id === 'view-' + viewName)
        );
        // call loader and return its promise
        return views[viewName]();
    }

    // History API – zpět/dopředu v prohlížeči
    function navigateWithHistory(viewName) {
        if (!views[viewName]) return;
        const hash = viewName || 'dashboard';
        if (location.hash.slice(1) !== hash) {
            location.hash = hash;
        }
        return navigate(viewName || 'dashboard');
    }

    function onHashChange() {
        const viewName = (location.hash.slice(1) || 'dashboard').toLowerCase();
        if (views[viewName]) navigate(viewName);
    }

    // ── login screen ────────────────────────────────────────────────────
    function showLogin()  {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }
    function hideLogin()  {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display  = 'flex';
    }

    // ── mount app after successful auth ─────────────────────────────────
    function mountApp(user) {
        currentUser = user;
        Api.setCsrf(user.csrf);

        document.getElementById('nav-username').textContent = user.name;
        // Users tab: only for admin
        document.getElementById('nav-users').style.display = user.role === 'admin' ? '' : 'none';

        hideLogin();
        // Našeptávač adres
        if (typeof AddressAutocomplete !== 'undefined') {
            AddressAutocomplete.create('prop-address');
            AddressAutocomplete.create('ten-address');
            AddressAutocomplete.create('modal-tenant-address');
        }
        // Sidebar: collapsed on mobile
        const sb = document.getElementById('sidebar');
        if (window.innerWidth <= 768) sb.classList.add('collapsed');
        else sb.classList.remove('collapsed');
        // History: inicializace z hashe, nebo dashboard
        const initialView = (location.hash.slice(1) || 'dashboard').toLowerCase();
        if (views[initialView]) {
            navigate(initialView);
            if (!location.hash) location.hash = initialView;
        } else {
            navigate('dashboard');
            location.hash = 'dashboard';
        }
    }

    // ── login button ────────────────────────────────────────────────────
    document.getElementById('btn-login').addEventListener('click', async () => {
        const btn  = document.getElementById('btn-login');
        const errEl = document.getElementById('login-error');
        errEl.textContent = '';
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';

        try {
            const user = await Api.authLogin(
                document.getElementById('login-email').value.trim(),
                document.getElementById('login-pass').value
            );
            document.getElementById('login-pass').value = '';
            mountApp(user);
        } catch (e) {
            errEl.textContent = e.message;
        } finally {
            btn.disabled = false;
            btn.textContent = 'Přihlásit se';
        }
    });

    // Enter key on password field triggers login
    document.getElementById('login-pass').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btn-login').click();
    });

    // ── logout button ───────────────────────────────────────────────────
    document.getElementById('btn-logout').addEventListener('click', async () => {
        try { await Api.authLogout(); } catch(e) { /* ignore */ }
        currentUser = null;
        showLogin();
    });

    // ── nav link clicks ─────────────────────────────────────────────────
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateWithHistory(btn.dataset.view);
            sidebarClose();
        });
    });

    // ── hashchange (zpět/dopředu v prohlížeči) ───────────────────────────
    window.addEventListener('hashchange', onHashChange);

    // ── sidebar: hamburger & close ───────────────────────────────────────
    function sidebarOpen() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar').classList.remove('collapsed');
    }
    function sidebarClose() {
        const sb = document.getElementById('sidebar');
        sb.classList.remove('open');
        if (window.innerWidth <= 768) sb.classList.add('collapsed');
    }
    document.getElementById('btn-hamburger').addEventListener('click', sidebarOpen);
    document.getElementById('btn-sidebar-close').addEventListener('click', sidebarClose);

    // ── boot: check existing session ────────────────────────────────────
    (async () => {
        try {
            const user = await Api.authCheck();
            mountApp(user);
        } catch (e) {
            showLogin();
        }
    })();

    // ── public ──────────────────────────────────────────────────────────
    return {
        registerView,
        navigate,
        navigateWithHistory,
        getUser: () => currentUser,
    };
})();
