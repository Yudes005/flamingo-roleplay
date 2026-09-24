const MAX_MESSAGES = 8;

let currentChannel = 'rp';
let chatIsOpen = false;

const messagesEl = document.getElementById('chat-messages');
const controlsEl = document.getElementById('chat-controls');
const inputEl = document.getElementById('chat-input');

function escapeHtml(str) {
    const div = document.createElement('div');
    div.innerText = str == null ? '' : str;
    return div.innerHTML;
}

// pretvara hex boju kategorije (npr '#4fa4ff') u rgba() sa zadatom providnoscu,
// za "meku" pozadinu iza ikonice reklame - isti princip kao na tabletu.
function hexToRgba(hex, alpha) {
    const h = String(hex || '#ffd400').replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) || 0;
    const g = parseInt(h.substring(2, 4), 16) || 0;
    const b = parseInt(h.substring(4, 6), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function pruneMessages() {
    while (messagesEl.children.length > MAX_MESSAGES) {
        messagesEl.removeChild(messagesEl.firstChild);
    }
}

// Kad je chat zatvoren, poruke posle FADE_AFTER ms polako izblede (kad se
// chat otvori, opet se vide sve poslednje poruke).
const FADE_AFTER = 15000;

function addMessageEl(el) {
    messagesEl.appendChild(el);
    pruneMessages();
    setTimeout(function () { el.classList.add('faded'); }, FADE_AFTER);
}

function badge(cls, label) {
    return '<span class="chat-badge ' + cls + '">' + label + '</span>';
}

function channelTag(data) {
    if (data.channel === 'nonrp') return badge('b-nonrp', 'NON-RP');
    if (data.channel === 'rp') return badge('b-rp', 'RP');
    return '';
}

function kindTag(kind) {
    if (kind === 'me') return badge('b-me', 'ME');
    if (kind === 'do') return badge('b-do', 'DO');
    if (kind === 'todo') return badge('b-todo', 'TODO');
    if (kind === 'try') return badge('b-try', 'TRY');
    return '';
}

function renderMessage(data) {
    const row = document.createElement('div');
    row.className = 'chat-msg k-' + (data.kind || 'chat') + ' c-' + (data.channel || 'rp');
    const tag = '<span class="chat-badges">' + kindTag(data.kind) + channelTag(data) + '</span>';

    if (data.kind === 'me') {
        row.innerHTML = tag + '<span class="chat-me">* ' + escapeHtml(data.author) + ' ' + escapeHtml(data.text) + ' *</span>';
    } else if (data.kind === 'do') {
        row.innerHTML = tag + '<span class="chat-ooc">(( ' + escapeHtml(data.text) + ' ))</span>';
    } else if (data.kind === 'todo') {
        row.innerHTML = tag + '<span class="chat-ooc">(( Pokušaj: ' + escapeHtml(data.text) + ' ))</span>';
    } else if (data.kind === 'try') {
        const verdict = data.success
            ? '<span class="chat-try-success">USPEŠNO</span>'
            : '<span class="chat-try-fail">NEUSPEŠNO</span>';
        row.innerHTML = tag + '<span class="chat-try">' + escapeHtml(data.author) + ' pokušava da: ' + escapeHtml(data.text) + ' — ' + verdict + '</span>';
    } else {
        row.innerHTML =
            tag +
            '<span class="chat-author" style="color:' + (data.authorColor || '#e21e6b') + '">' +
            escapeHtml(data.author) + ' <em>' + escapeHtml(data.authorId) + '</em></span>' +
            '<span class="chat-text">' + escapeHtml(data.text) + '</span>';
    }

    addMessageEl(row);
}

function renderStaffMessage(data) {
    const row = document.createElement('div');
    row.className = 'chat-msg k-staff';
    row.innerHTML =
        '<span class="chat-badges">' + badge('b-staff', 'STAFF') + '</span>' +
        '<span class="chat-author" style="color:' + (data.color || '#ffd400') + '">' +
        '<em class="rank">' + escapeHtml(data.rank) + '</em> ' + escapeHtml(data.name) + '</span>' +
        '<span class="chat-text">' + escapeHtml(data.message) + '</span>';
    addMessageEl(row);
}

function renderSystem(data) {
    const row = document.createElement('div');
    row.className = 'chat-msg chat-system';
    row.style.color = data.color || '#ffffff';
    row.textContent = data.text;
    addMessageEl(row);
}

function renderAd(data) {
    const row = document.createElement('div');
    row.className = 'chat-msg chat-ad';
    const accent = data.titleColor || data.borderColor || '#ffd400';
    row.style.borderLeftColor = data.borderColor || 'rgba(255, 255, 255, 0.7)';

    row.innerHTML =
        '<div class="chat-ad-head">' +
            '<i class="fa-solid fa-' + (data.icon || 'bullhorn') + '" style="background:' + hexToRgba(accent, 0.18) + ';color:' + accent + '"></i>' +
            '<span class="chat-ad-subtitle">' + escapeHtml(data.subtitle) + '</span>' +
        '</div>' +
        '<div class="chat-ad-meta">' +
            '<span class="chat-ad-meta-item"><i class="fa-solid fa-user"></i>' + escapeHtml(data.sender) + '</span>' +
            (data.contact ? '<span class="chat-ad-meta-sep">•</span><span class="chat-ad-meta-item"><i class="fa-solid fa-phone"></i>' + escapeHtml(data.contact) + '</span>' : '') +
        '</div>';

    addMessageEl(row);
}

function setOpen(isOpen, canSeeStaffTab) {
    chatIsOpen = isOpen;

    if (isOpen) {
        const staffTab = document.getElementById('chat-tab-staff');
        staffTab.style.display = canSeeStaffTab ? '' : 'none';

        // ako igrač u međuvremenu izgubi staff/duty status, ne ostavljaj ga
        // "zaglavljenog" na STAFF kanalu koji više ne vidi
        if (!canSeeStaffTab && currentChannel === 'staff') {
            currentChannel = 'rp';
            document.querySelectorAll('.chat-tab').forEach(function (t) { t.classList.remove('active'); });
            document.querySelector('.chat-tab[data-channel="rp"]').classList.add('active');
            applyChannelIndicator('rp');
        }

        controlsEl.classList.remove('hidden');
        document.body.classList.add('chat-open');
        inputEl.value = '';
        updateInputDecor();
        inputEl.focus();
    } else {
        controlsEl.classList.add('hidden');
        document.body.classList.remove('chat-open');
        document.getElementById('chat-quick-cmds').classList.add('hidden');
        document.getElementById('chat-actions-btn').classList.remove('active');
        inputEl.blur();
    }
}

function closeChatToGame() {
    fetch('https://' + GetParentResourceName() + '/closeChat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({})
    });
}

function sendMessageToGame(text, channel) {
    fetch('https://' + GetParentResourceName() + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ text: text, channel: channel })
    });
}

window.addEventListener('message', function (event) {
    const msg = event.data;

    if (msg.action === 'open') {
        setOpen(true, msg.canSeeStaffTab);
    }

    if (msg.action === 'close') {
        setOpen(false);
    }

    if (msg.action === 'message') {
        renderMessage(msg.data);
    }

    if (msg.action === 'system') {
        renderSystem(msg.data);
    }

    if (msg.action === 'ad') {
        renderAd(msg.data);
    }

    if (msg.action === 'staffMessage') {
        renderStaffMessage(msg.data);
    }

    if (msg.action === 'setSuppressed') {
        document.body.classList.toggle('hud-hidden', !!msg.hidden);
    }

    if (msg.action === 'setChatEnabled') {
        document.body.classList.toggle('chat-manual-hidden', !msg.enabled);
    }
});

function applyChannelIndicator(channel) {
    if (channel === 'nonrp') {
        inputEl.placeholder = 'OOC poruka (NON-RP)...';
        inputEl.classList.remove('channel-staff');
        inputEl.classList.add('channel-nonrp');
    } else if (channel === 'staff') {
        inputEl.placeholder = 'Poruka staff timu...';
        inputEl.classList.remove('channel-nonrp');
        inputEl.classList.add('channel-staff');
    } else {
        inputEl.placeholder = 'Poruka...';
        inputEl.classList.remove('channel-nonrp', 'channel-staff');
    }
}

document.querySelectorAll('.chat-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
        document.querySelectorAll('.chat-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        currentChannel = tab.dataset.channel;
        applyChannelIndicator(currentChannel);
        inputEl.focus();
    });
});

document.querySelectorAll('.chat-cmd-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
        inputEl.value = btn.dataset.cmd;
        document.getElementById('chat-quick-cmds').classList.add('hidden');
        document.getElementById('chat-actions-btn').classList.remove('active');
        updateInputDecor();
        inputEl.focus();
    });
});

// ACTIONS dugme otvara/zatvara brze komande (ME / DO / TRY / TODO)
document.getElementById('chat-actions-btn').addEventListener('click', function () {
    const box = document.getElementById('chat-quick-cmds');
    box.classList.toggle('hidden');
    this.classList.toggle('active', !box.classList.contains('hidden'));
    inputEl.focus();
});

// Dok se kuca: brojač znakova + oznaka komande (/me, /do, /try, /todo)
const CMD_TAGS = { me: 'ME', do: 'DO', try: 'TRY', todo: 'TODO' };
function updateInputDecor() {
    const v = inputEl.value;
    const count = document.getElementById('chat-count');
    count.textContent = v.length + '/150';
    count.classList.toggle('warn', v.length >= 130);
    document.getElementById('chat-bar').classList.toggle('has-text', v.trim().length > 0);

    const m = v.match(/^\/(me|do|try|todo)\b/i);
    const tag = document.getElementById('chat-cmd-tag');
    if (m) {
        const k = m[1].toLowerCase();
        tag.textContent = CMD_TAGS[k];
        tag.className = 'k-' + k;
    } else {
        tag.className = 'hidden';
    }
}
inputEl.addEventListener('input', updateInputDecor);

// Strelica = isto kao Enter
document.getElementById('chat-send').addEventListener('click', function () {
    const text = inputEl.value.trim();
    if (text.length > 0) sendMessageToGame(text, currentChannel);
    closeChatToGame();
});

inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeChatToGame();
        return;
    }

    if (e.key === 'Enter') {
        const text = inputEl.value.trim();

        if (text.length > 0) {
            sendMessageToGame(text, currentChannel);
        }

        closeChatToGame();
    }
});
