// js/views/users.js

const UsersView = (() => {

    // ── add user ────────────────────────────────────────────────────────
    (function initAddButton() {
        document.getElementById('btn-usr-add').addEventListener('click', async () => {
            try {
                await Api.usersAdd({
                    name:     document.getElementById('usr-name').value.trim(),
                    email:    document.getElementById('usr-email').value.trim(),
                    password: document.getElementById('usr-pass').value,
                    role:     document.getElementById('usr-role').value,
                });
                UI.alertShow('usr-alert', 'Uživatel přidán.', 'ok');
                ['usr-name','usr-email','usr-pass'].forEach(id =>
                    document.getElementById(id).value = ''
                );
                loadList();
            } catch (e) {
                UI.alertShow('usr-alert', e.message, 'err');
            }
        });
    })();

    // ── password modal ──────────────────────────────────────────────────
    (function initModal() {
        // overlay click closes
        document.querySelector('#modal-pass .modal-ov').addEventListener('click', () =>
            UI.modalClose('modal-pass')
        );

        document.getElementById('btn-modal-pass-save').addEventListener('click', async () => {
            const uid  = Number(document.getElementById('modal-pass-uid').value);
            const pass = document.getElementById('modal-pass-input').value;
            try {
                await Api.usersChangePassword(uid, pass);
                UI.alertShow('modal-pass-alert', 'Heslo změněno.', 'ok');
                setTimeout(() => UI.modalClose('modal-pass'), 1200);
            } catch (e) {
                UI.alertShow('modal-pass-alert', e.message, 'err');
            }
        });
    })();

    function openPassModal(uid, name) {
        document.getElementById('modal-pass-uid').value  = uid;
        document.getElementById('modal-pass-name').textContent = name;
        document.getElementById('modal-pass-input').value = '';
        // hide any previous alert
        document.getElementById('modal-pass-alert').classList.remove('show');
        UI.modalOpen('modal-pass');
    }

    // ── list ────────────────────────────────────────────────────────────
    async function loadList() {
        let data;
        try { data = await Api.usersList(); }
        catch (e) { return; }

        const me = App.getUser();

        UI.renderTable('usr-table',
            [
                { label: 'Jméno' },
                { label: 'E-mail' },
                { label: 'Rolle' },
                { label: 'Akce', act: true },
            ],
            data,
            (u) => {
                const isSelf = u.id === me.id;
                return (
                    '<td><strong>' + UI.esc(u.name) + '</strong> ' +
                        (isSelf ? '<span class="badge badge-info">vy</span>' : '') +
                    '</td>' +
                    '<td>' + UI.esc(u.email) + '</td>' +
                    '<td><span class="badge ' + (u.role === 'admin' ? 'badge-admin' : 'badge-user') + '">' +
                        (u.role === 'admin' ? 'Admin' : 'Uživatel') +
                    '</span></td>' +
                    '<td class="td-act">' +
                        '<button class="btn btn-ghost btn-sm" onclick="UsersView.openPass(' + u.id + ',\'' + UI.esc(u.name).replace(/'/g,"\\'") + '\')">Heslo</button>' +
                        (!isSelf
                            ? '<button class="btn btn-danger btn-sm" onclick="UsersView.del(' + u.id + ',\'' + UI.esc(u.name).replace(/'/g,"\\'") + '\')">Smazat</button>'
                            : '') +
                    '</td>'
                );
            },
            { emptyMsg: 'Žádní uživatelé.' }
        );
    }

    // ── exposed ─────────────────────────────────────────────────────────
    function openPass(uid, name) { openPassModal(uid, name); }

    async function del(uid, name) {
        if (!confirm('Smaznout uživatele "' + name + '"?')) return;
        try {
            await Api.usersDelete(uid);
            loadList();
        } catch (e) {
            UI.alertShow('usr-alert', e.message, 'err');
        }
    }

    async function load() {
        await loadList();
    }

    return { load, openPass, del };
})();

App.registerView('users', UsersView.load);
window.UsersView = UsersView;
