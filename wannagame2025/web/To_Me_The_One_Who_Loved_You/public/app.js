(() => {
    const state = {
        token: localStorage.getItem('token') || '',
        user: null,
        messages: [],
        sent: [],
    };

    try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) state.user = JSON.parse(storedUser);
    } catch (_) {}

    const setAuth = (token, user) => {
        state.token = token;
        state.user = user;
        localStorage.setItem('token', token || '');
        localStorage.setItem('user', user ? JSON.stringify(user) : '');
        updateAuthUi();
    };

    const logout = () => {
        setAuth('', null);
        state.messages = [];
        state.sent = [];
        renderMessages();
        renderSent();
    };

    const updateAuthUi = () => {
        const whoami = document.getElementById('whoami');
        const authStatus = document.getElementById('authStatus');
        const sendStatus = document.getElementById('sendStatus');
        if (whoami) {
            whoami.textContent = state.user ? `Signed in as ${state.user.username}` : 'Guest';
        }
        if (authStatus) authStatus.textContent = state.user ? 'Signed in.' : 'Not signed in.';
        if (sendStatus) sendStatus.textContent = state.user ? 'Ready to send.' : 'Login to send.';
    };

    const setInboxStatus = (text) => {
        const el = document.getElementById('inboxStatus');
        if (el) el.textContent = text;
    };
    const setSentStatus = (text) => {
        const el = document.getElementById('sentStatus');
        if (el) el.textContent = text;
    };

    const api = async (path, method = 'POST', payload = {}) => {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (state.token) {
            opts.headers.Authorization = `Bearer ${state.token}`;
        }
        if (method !== 'GET') opts.body = JSON.stringify(payload);
        const res = await fetch(path, opts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Request failed');
        return data;
    };

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const toB64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const b64EncodeText = (text) => btoa(unescape(encodeURIComponent(text)));
    const b64DecodeText = (b64) => decodeURIComponent(escape(atob(b64)));

    const deriveKey = async (secret, salt) => {
        const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    };

    const encryptLocal = async (plaintext, secret) => {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(secret, salt);
        const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
        const payload = { alg: 'AES-GCM', salt: toB64(salt), iv: toB64(iv), ct: toB64(cipherBuffer) };
        return btoa(JSON.stringify(payload));
    };

    const decryptLocal = async (payload, secret) => {
        let data;
        try {
            data = JSON.parse(atob(payload));
        } catch (_) {
            throw new Error('Bad payload');
        }
        const key = await deriveKey(secret, fromB64(data.salt));
        const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(data.iv) }, key, fromB64(data.ct));
        return decoder.decode(plainBuffer);
    };

    const escapeHtml = (str) => str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtTime = (ts) => {
        const d = new Date((ts || 0) * 1000);
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
    };

    const renderList = (items, targetId, role) => {
        const target = document.getElementById(targetId);
        if (!target) return;
        if (!items.length) {
            target.innerHTML = '<div class="muted">No messages yet.</div>';
            return;
        }
        target.innerHTML = items
            .map(
                (m) => `
            <div class="card message" data-id="${m.id}" data-encrypted="${m.encrypted ? '1' : '0'}" data-body="${encodeURIComponent(m.body)}">
                <div class="meta">
                    <div class="row" style="gap:6px; align-items:center;">
                        <span class="badge ${m.encrypted ? 'warn' : ''}">${m.encrypted ? 'ENCRYPTED' : 'PLAIN'}</span>
                        <strong>${role === 'inbox' ? escapeHtml(m.from) : escapeHtml(m.to)}</strong>
                    </div>
                    <span class="muted">${fmtTime(m.created_at)}</span>
                </div>
                <div class="body" data-content="body">${m.encrypted ? `<code>${escapeHtml(m.body)}</code>` : escapeHtml(m.body)}</div>
                ${m.encrypted ? '<button class="secondary" data-action="decrypt">Decrypt with secret</button>' : ''}
            </div>`
            )
            .join('');
    };

    const renderMessages = () => renderList(state.messages, 'inbox', 'inbox');
    const renderSent = () => renderList(state.sent, 'sent', 'sent');

    const loadMessages = async () => {
        if (!state.user) return;
        try {
            const data = await api('/api/messages', 'GET');
            state.messages = data.messages || [];
            renderMessages();
            setInboxStatus('Inbox refreshed.');
        } catch (e) {
            setInboxStatus(`Fetch inbox failed: ${e.message}`);
        }
    };

    const loadSent = async () => {
        if (!state.user) return;
        try {
            const data = await api('/api/messages/sent', 'GET');
            state.sent = data.messages || [];
            renderSent();
            setSentStatus('Sent refreshed.');
        } catch (e) {
            setSentStatus(`Fetch sent failed: ${e.message}`);
        }
    };

    const initDashboard = () => {
        updateAuthUi();
        const status = document.getElementById('status');
        const setStatus = (text) => status && (status.textContent = text);
        const setSendStatus = (text) => {
            const el = document.getElementById('sendStatus');
            if (el) el.textContent = text;
        };

        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            logout();
            window.location.href = '/login';
        });

        document.getElementById('sendBtn')?.addEventListener('click', async () => {
            if (!state.user) {
                setSendStatus('Login first.');
                return;
            }
            const to = document.getElementById('toUser')?.value.trim() || '';
            const body = document.getElementById('msgBody')?.value || '';
            const encrypt = document.getElementById('encryptToggle')?.checked;
            const secret = document.getElementById('secret')?.value || '';
            if (!to || !body) {
                setSendStatus('Recipient and message required.');
                return;
            }
            let payloadBody = body;
            if (encrypt) {
                if (!secret) {
                    setSendStatus('Enter shared secret.');
                    return;
                }
                try {
                    payloadBody = await encryptLocal(body, secret);
                } catch (e) {
                    setSendStatus(`Encrypt failed: ${e.message}`);
                    return;
                }
            }
            try {
                await api('/api/messages', 'POST', { to, message: payloadBody, encrypted: !!encrypt });
                setSendStatus('Sent.');
                const msgEl = document.getElementById('msgBody');
                if (msgEl) msgEl.value = '';
                await loadMessages();
                await loadSent();
            } catch (e) {
                setSendStatus(e.message);
            }
        });

        document.getElementById('refreshBtn')?.addEventListener('click', () => {
            loadMessages();
            loadSent();
        });
        document.getElementById('inboxRefreshTop')?.addEventListener('click', loadMessages);
        document.getElementById('sentRefreshTop')?.addEventListener('click', loadSent);

        const inbox = document.getElementById('inbox');
        inbox?.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action="decrypt"]');
            if (!btn) return;
            const card = btn.closest('.message');
            const ciphertext = decodeURIComponent(card.dataset.body || '');
            const secret = document.getElementById('viewSecret')?.value || document.getElementById('secret')?.value || '';
            if (!secret) {
                setInboxStatus('Enter secret to decrypt.');
                return;
            }
            try {
                const plain = await decryptLocal(ciphertext, secret);
                const bodyEl = card.querySelector('[data-content="body"]');
                if (bodyEl) bodyEl.innerHTML = escapeHtml(plain);
                btn.remove();
                setInboxStatus('Decrypted.');
            } catch (err) {
                setInboxStatus(`Decrypt failed: ${err.message}`);
            }
        });

        const sentBox = document.getElementById('sent');
        sentBox?.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action="decrypt"]');
            if (!btn) return;
            const card = btn.closest('.message');
            const ciphertext = decodeURIComponent(card.dataset.body || '');
            const secret = document.getElementById('viewSecretSent')?.value || document.getElementById('secret')?.value || '';
            if (!secret) {
                setSentStatus('Enter secret to decrypt.');
                return;
            }
            try {
                const plain = await decryptLocal(ciphertext, secret);
                const bodyEl = card.querySelector('[data-content="body"]');
                if (bodyEl) bodyEl.innerHTML = escapeHtml(plain);
                btn.remove();
                setSentStatus('Decrypted.');
            } catch (err) {
                setSentStatus(`Decrypt failed: ${err.message}`);
            }
        });

        const srvCall = async (path, payload) => {
            setStatus('Working...');
            const res = await fetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            setStatus(res.ok ? 'OK' : data.message || 'Error');
            if (!res.ok) throw new Error(data.message || 'Request failed');
            return data;
        };

        document.getElementById('srvEncryptBtn')?.addEventListener('click', async () => {
            const text = document.getElementById('plain')?.value || '';
            const key = document.getElementById('srvKey')?.value.trim() || '';
            if (!text) {
                setStatus('Plaintext is empty.');
                return;
            }
            if (!key) {
                setStatus('Key is empty.');
                return;
            }
            try {
                const data = await srvCall('/api/encrypt', { text, key });
                document.getElementById('cipherOut').textContent = data.ciphertext || '';
                const cipherEl = document.getElementById('cipher');
                if (cipherEl) cipherEl.value = data.ciphertext || '';
            } catch (_) {}
        });

        document.getElementById('srvDecryptBtn')?.addEventListener('click', async () => {
            const ciphertext = document.getElementById('cipher')?.value || '';
            const key = document.getElementById('srvKey')?.value.trim() || '';
            if (!ciphertext) {
                setStatus('Ciphertext is empty.');
                return;
            }
            if (!key) {
                setStatus('Key is empty.');
                return;
            }
            try {
                const data = await srvCall('/api/decrypt', { ciphertext, key });
                document.getElementById('plainOut').textContent = data.plaintext || '';
                const plainEl = document.getElementById('plain');
                if (plainEl) plainEl.value = data.plaintext || '';
            } catch (_) {}
        });

        document.getElementById('clearPlain')?.addEventListener('click', () => {
            const plainEl = document.getElementById('plain');
            if (plainEl) plainEl.value = '';
            const out = document.getElementById('cipherOut');
            if (out) out.textContent = '';
            setStatus('Cleared plaintext.');
        });

        document.getElementById('clearCipher')?.addEventListener('click', () => {
            const cipherEl = document.getElementById('cipher');
            if (cipherEl) cipherEl.value = '';
            const out = document.getElementById('plainOut');
            if (out) out.textContent = '';
            setStatus('Cleared ciphertext.');
        });

        if (state.token && state.user) {
            loadMessages();
            loadSent();
        }
    };

    const initLogin = () => {
        updateAuthUi();
        const status = document.getElementById('loginStatus');
        document.getElementById('loginBtn')?.addEventListener('click', async () => {
            const username = document.getElementById('loginUser')?.value.trim() || '';
            const password = document.getElementById('loginPass')?.value || '';
            try {
                const data = await api('/api/login', 'POST', { username, password });
                setAuth(data.token, data.user);
                if (status) status.textContent = 'Signed in.';
                window.location.href = '/dashboard';
            } catch (e) {
                if (status) status.textContent = e.message;
            }
        });
    };

    const initRegister = () => {
        updateAuthUi();
        const status = document.getElementById('regStatus');
        document.getElementById('registerBtn')?.addEventListener('click', async () => {
            const username = document.getElementById('regUser')?.value.trim() || '';
            const password = document.getElementById('regPass')?.value || '';
            try {
                const data = await api('/api/register', 'POST', { username, password });
                setAuth(data.token, data.user);
                if (status) status.textContent = 'Registered and signed in.';
                window.location.href = '/dashboard';
            } catch (e) {
                if (status) status.textContent = e.message;
            }
        });
    };

    document.addEventListener('DOMContentLoaded', () => {
        const page = document.body.dataset.page || 'dashboard';
        if (page === 'dashboard') initDashboard();
        if (page === 'login') initLogin();
        if (page === 'register') initRegister();
    });
})();
