/* jshint esversion: 11 */

const STORAGE_TOKEN  = 'demitard_ai_token';
const STORAGE_URL    = 'demitard_ai_url';
const STORAGE_MODEL  = 'demitard_ai_model';
const STORAGE_TITLES = 'demitard_ai_titles';
const DEFAULT_URL    = 'http://localhost:8000';

// ── State ─────────────────────────────────────────────────────────────────────

let apiUrl    = localStorage.getItem(STORAGE_URL)   || DEFAULT_URL;
let token     = localStorage.getItem(STORAGE_TOKEN) || null;
let modelName = localStorage.getItem(STORAGE_MODEL) || '';
let currentChatId  = null;
let isStreaming     = false;
let conversations   = [];

function getTitles() {
    try { return JSON.parse(localStorage.getItem(STORAGE_TITLES) || '{}'); }
    catch { return {}; }
}

function saveTitle(chatId, title) {
    const titles = getTitles();
    titles[chatId] = title;
    localStorage.setItem(STORAGE_TITLES, JSON.stringify(titles));
}

function removeTitle(chatId) {
    const titles = getTitles();
    delete titles[chatId];
    localStorage.setItem(STORAGE_TITLES, JSON.stringify(titles));
}

function formatChatDate(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadConversations() {
    try {
        const res = await apiFetch('/chats');
        conversations = await res.json();
    } catch {
        conversations = [];
    }
    renderConversations();
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function inlineMarkdown(text) {
    // Extract inline code first so its content isn't processed
    const codes = [];
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
        const i = codes.length;
        codes.push(`<code class="md-code">${escapeHtml(code)}</code>`);
        return `\x01${i}\x01`;
    });
    // Escape remaining HTML
    text = text.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
    // Bold + italic combos (order matters: longest first)
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/___(.+?)___/g,        '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.+?)\*\*/g,      '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g,          '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g,          '<em>$1</em>');
    text = text.replace(/_(.+?)_/g,            '<em>$1</em>');
    // Restore inline code
    text = text.replace(/\x01(\d+)\x01/g, (_, i) => codes[+i]);
    return text;
}

function renderMarkdown(raw) {
    const blocks = [];

    // 1. Extract fenced code blocks (```lang\ncode\n```)
    let text = raw.replace(/```(\w*)\r?\n?([\s\S]*?)```/g, (_, lang, code) => {
        const i = blocks.length;
        const langHtml = lang ? `<span class="md-lang">${escapeHtml(lang)}</span>` : '';
        blocks.push(
            `<div class="md-code-block">${langHtml}<pre><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre></div>`
        );
        return `\x00BLOCK${i}\x00`;
    });

    // 2. Line-by-line block processing
    const lines = text.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Block placeholder
        const bm = line.match(/\x00BLOCK(\d+)\x00/);
        if (bm) { out.push(blocks[+bm[1]]); i++; continue; }

        // Headers (#, ##, ###)
        const hm = line.match(/^(#{1,3}) (.+)/);
        if (hm) {
            const lvl = hm[1].length;
            out.push(`<h${lvl} class="md-h${lvl}">${inlineMarkdown(hm[2].trim())}</h${lvl}>`);
            i++; continue;
        }

        // Horizontal rule
        if (/^([-*_] *){3,}$/.test(line.trim())) {
            out.push('<hr class="md-hr">'); i++; continue;
        }

        // Unordered list (-, *, +)
        if (/^[-*+] /.test(line)) {
            const items = [];
            while (i < lines.length && /^[-*+] /.test(lines[i])) {
                items.push(`<li>${inlineMarkdown(lines[i].replace(/^[-*+] /, ''))}</li>`);
                i++;
            }
            out.push(`<ul class="md-ul">${items.join('')}</ul>`);
            continue;
        }

        // Ordered list (1., 2., ...)
        if (/^\d+\. /.test(line)) {
            const items = [];
            while (i < lines.length && /^\d+\. /.test(lines[i])) {
                items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\. /, ''))}</li>`);
                i++;
            }
            out.push(`<ol class="md-ol">${items.join('')}</ol>`);
            continue;
        }

        // Blank line → paragraph break
        if (line.trim() === '') {
            if (out.length && out[out.length - 1] !== '<br>') out.push('<br>');
            i++; continue;
        }

        // Regular text line
        out.push(inlineMarkdown(line) + '<br>');
        i++;
    }

    // Remove trailing <br>
    while (out.length && out[out.length - 1] === '<br>') out.pop();

    return out.join('\n');
}

// ── DOM refs ──────────────────────────────────────────────────────────────────

const authOverlay      = document.getElementById('auth-overlay');
const chatInterface    = document.getElementById('chat-interface');
const settingsModal    = document.getElementById('settings-modal');
const apiUrlInput      = document.getElementById('api-url-input');
const modelInput       = document.getElementById('model-input');
const loginForm        = document.getElementById('login-form');
const registerForm     = document.getElementById('register-form');
const tabLogin         = document.getElementById('tab-login');
const tabRegister      = document.getElementById('tab-register');
const authError        = document.getElementById('auth-error');
const loginEmail       = document.getElementById('login-email');
const loginPassword    = document.getElementById('login-password');
const registerEmail    = document.getElementById('register-email');
const registerName     = document.getElementById('register-name');
const registerPassword = document.getElementById('register-password');
const loginBtn         = document.getElementById('login-btn');
const registerBtn      = document.getElementById('register-btn');
const userDisplay      = document.getElementById('user-display');
const logoutBtn        = document.getElementById('logout-btn');
const settingsBtn      = document.getElementById('settings-btn');
const authSettingsBtn  = document.getElementById('auth-settings-btn');
const saveSettingsBtn  = document.getElementById('save-settings-btn');
const cancelSettingsBtn= document.getElementById('cancel-settings-btn');
const newChatBtn       = document.getElementById('new-chat-btn');
const conversationList = document.getElementById('conversation-list');
const messagesEl       = document.getElementById('messages');
const messageInput     = document.getElementById('message-input');
const sendBtn          = document.getElementById('send-btn');
const thinkingMode     = document.getElementById('thinking-mode');

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${apiUrl}${path}`, { ...options, headers });
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const body = await res.json(); msg = body.detail || JSON.stringify(body); } catch {}
        throw new Error(msg);
    }
    return res;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function showAuthError(msg) {
    authError.textContent = msg;
    authError.classList.remove('hidden');
}

function clearAuthError() {
    authError.textContent = '';
    authError.classList.add('hidden');
}

async function doLogin(email, password) {
    const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    token = data.access_token;
    localStorage.setItem(STORAGE_TOKEN, token);
}

async function doRegister(email, password, display_name) {
    const body = { email, password };
    if (display_name) body.display_name = display_name;
    const res = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    token = data.access_token;
    localStorage.setItem(STORAGE_TOKEN, token);
}

async function fetchMe() {
    const res = await apiFetch('/auth/me');
    return res.json();
}

function logout() {
    token = null;
    localStorage.removeItem(STORAGE_TOKEN);
    currentChatId = null;
    showAuthScreen();
}

// ── UI mode switches ──────────────────────────────────────────────────────────

function showAuthScreen() {
    authOverlay.classList.remove('hidden');
    chatInterface.classList.add('hidden');
    clearAuthError();
}

function showChatScreen(user) {
    authOverlay.classList.add('hidden');
    chatInterface.classList.remove('hidden');
    userDisplay.textContent = user.display_name || user.email;
    loadConversations();
}

// ── Settings Modal ────────────────────────────────────────────────────────────

function openSettings() {
    apiUrlInput.value = apiUrl;
    modelInput.value  = modelName;
    settingsModal.classList.remove('hidden');
    apiUrlInput.focus();
}

function closeSettings() {
    settingsModal.classList.add('hidden');
}

saveSettingsBtn.addEventListener('click', () => {
    const url = apiUrlInput.value.trim().replace(/\/$/, '');
    if (url) { apiUrl = url; localStorage.setItem(STORAGE_URL, apiUrl); }
    modelName = modelInput.value.trim();
    localStorage.setItem(STORAGE_MODEL, modelName);
    closeSettings();
});

cancelSettingsBtn.addEventListener('click', closeSettings);
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettings(); });
settingsBtn.addEventListener('click', openSettings);
authSettingsBtn.addEventListener('click', openSettings);

// ── Auth tab switching ────────────────────────────────────────────────────────

tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    clearAuthError();
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    clearAuthError();
});

// ── Auth form handlers ────────────────────────────────────────────────────────

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    try {
        await doLogin(loginEmail.value.trim(), loginPassword.value);
        const user = await fetchMe();
        showChatScreen(user);
    } catch (err) {
        showAuthError(err.message);
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();
    registerBtn.disabled = true;
    registerBtn.textContent = 'Registering...';
    try {
        await doRegister(registerEmail.value.trim(), registerPassword.value, registerName.value.trim());
        const user = await fetchMe();
        showChatScreen(user);
    } catch (err) {
        showAuthError(err.message);
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register';
    }
});

logoutBtn.addEventListener('click', logout);

// ── Conversations sidebar ─────────────────────────────────────────────────────

function renderConversations() {
    conversationList.innerHTML = '';

    if (conversations.length === 0) {
        conversationList.innerHTML = '<p class="sidebar-empty">No conversations yet</p>';
        return;
    }

    const localTitles = getTitles();
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item' + (conv.chat_id === currentChatId ? ' active' : '');
        item.dataset.id = conv.chat_id;

        const titleText = conv.title || localTitles[conv.chat_id] || formatChatDate(conv.created_at);
        const titleEl = document.createElement('span');
        titleEl.className = 'conv-title';
        titleEl.textContent = titleText;
        titleEl.title = titleText;

        const del = document.createElement('button');
        del.className = 'conv-delete';
        del.textContent = '×';
        del.title = 'Delete conversation';
        del.addEventListener('click', (e) => { e.stopPropagation(); deleteConversation(conv.chat_id); });

        item.appendChild(titleEl);
        item.appendChild(del);
        item.addEventListener('click', () => selectConversation(conv.chat_id));
        conversationList.appendChild(item);
    });
}

async function selectConversation(id) {
    if (isStreaming) return;
    currentChatId = id;
    renderConversations();
    clearMessages();
    try {
        const res = await apiFetch(`/chat/${id}`);
        const data = await res.json();
        renderHistory(data.messages);
    } catch (err) {
        showSystemMessage(`Failed to load conversation: ${err.message}`);
    }
}

async function deleteConversation(id) {
    try { await apiFetch(`/chat/${id}`, { method: 'DELETE' }); } catch {}
    removeTitle(id);
    if (currentChatId === id) {
        currentChatId = null;
        clearMessages();
        messagesEl.innerHTML = '<div class="messages-empty"><p>Start a conversation</p></div>';
    }
    await loadConversations();
}

newChatBtn.addEventListener('click', () => {
    if (isStreaming) return;
    currentChatId = null;
    clearMessages();
    messagesEl.innerHTML = '<div class="messages-empty"><p>Start a conversation</p></div>';
    renderConversations();
    messageInput.focus();
});

// ── Message rendering ─────────────────────────────────────────────────────────

function clearMessages() { messagesEl.innerHTML = ''; }

function renderHistory(messages) {
    clearMessages();
    messages.forEach(msg => {
        const role = msg.role === 'human' ? 'user' : 'assistant';
        appendMessage(role, msg.content, msg.thinking);
    });
    scrollToBottom();
}

function appendMessage(role, content, thinking) {
    const wrap = document.createElement('div');
    wrap.className = `message ${role}`;

    const roleLabel = document.createElement('span');
    roleLabel.className = 'message-role';
    roleLabel.textContent = role === 'user' ? 'You' : 'AI';

    if (thinking) {
        const thinkEl = document.createElement('details');
        thinkEl.className = 'thinking-block';
        const summary = document.createElement('summary');
        summary.textContent = 'Thinking';
        thinkEl.appendChild(summary);
        thinkEl.appendChild(document.createTextNode(thinking));
        wrap.appendChild(roleLabel.cloneNode(true));
        wrap.appendChild(thinkEl);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'assistant' && content) {
        bubble.innerHTML = renderMarkdown(content);
    } else {
        bubble.textContent = content;
    }

    if (!thinking) wrap.appendChild(roleLabel);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    return { wrap, bubble };
}

function showSystemMessage(text) {
    const p = document.createElement('p');
    p.style.cssText = 'font-family:Kode Mono,monospace;font-size:11px;color:#ff6666;text-align:center;padding:8px;margin:0';
    p.textContent = text;
    messagesEl.appendChild(p);
    scrollToBottom();
}

function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

// ── Streaming chat ────────────────────────────────────────────────────────────

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isStreaming) return;

    const mode = thinkingMode.checked ? 'thinking' : 'nothinking';

    messageInput.value = '';
    resizeTextarea();
    sendBtn.disabled = true;
    isStreaming = true;

    const emptyState = messagesEl.querySelector('.messages-empty');
    if (emptyState) emptyState.remove();

    appendMessage('user', text);
    scrollToBottom();

    const { wrap: aWrap, bubble: aBubble } = appendMessage('assistant', '');
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    aBubble.appendChild(cursor);
    scrollToBottom();

    let accText = '';
    let chatIdFromStream = null;

    try {
        const body = {
            message: text,
            mode,
            ...(currentChatId ? { chat_id: currentChatId } : {}),
            ...(modelName      ? { model: modelName }       : {}),
        };

        const response = await fetch(`${apiUrl}/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            let msg = `HTTP ${response.status}`;
            try { const b = await response.json(); msg = b.detail || JSON.stringify(b); } catch {}
            throw new Error(msg);
        }

        const reader  = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                let evt;
                try { evt = JSON.parse(line.slice(6)); } catch { continue; }

                if (evt.token !== undefined) {
                    accText += evt.token;
                    // Plain text while streaming; cursor stays visible
                    aBubble.textContent = accText;
                    aBubble.appendChild(cursor);
                    scrollToBottom();
                } else if (evt.done) {
                    chatIdFromStream = evt.chat_id;
                } else if (evt.error) {
                    throw new Error(evt.detail || evt.error);
                }
            }
        }

        // Streaming done — render markdown on the final content
        cursor.remove();
        aBubble.innerHTML = renderMarkdown(accText);

        if (chatIdFromStream) {
            const isNew = currentChatId !== chatIdFromStream;
            currentChatId = chatIdFromStream;
            if (isNew) {
                const title = text.length > 42 ? text.slice(0, 42) + '…' : text;
                saveTitle(currentChatId, title);
            }
            await loadConversations();
        }

    } catch (err) {
        cursor.remove();
        if (!accText) {
            aWrap.remove();
        } else {
            aBubble.innerHTML = renderMarkdown(accText);
        }
        showSystemMessage(err.message);
    } finally {
        isStreaming = false;
        sendBtn.disabled = false;
        messageInput.focus();
        scrollToBottom();
    }
}

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) sendMessage();
    }
});

messageInput.addEventListener('input', () => {
    resizeTextarea();
    sendBtn.disabled = messageInput.value.trim() === '' || isStreaming;
});

function resizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + 'px';
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    if (!token) { showAuthScreen(); return; }
    try {
        const user = await fetchMe();
        showChatScreen(user);
    } catch {
        localStorage.removeItem(STORAGE_TOKEN);
        token = null;
        showAuthScreen();
    }
}

init();
