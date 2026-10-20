const MAX_LENGTH = 2000;
const COOLDOWN_MS = 30000;
const COOLDOWN_KEY = 'contact:lastSent';

function init() {
    const panel = document.getElementById('contact-panel');
    const form = document.getElementById('contact-form');
    const openBtn = document.getElementById('contact-open-btn');
    const message = document.getElementById('contact-message');
    const trap = form?.querySelector('.contact-trap');
    const field = form?.querySelector('.contact-field');
    const status = document.getElementById('contact-status');
    const sendBtn = document.getElementById('contact-send');
    const sendLabel = sendBtn?.querySelector('.contact-send-label');
    if (!panel || !form || !openBtn) return;

    const getEndpoint = () => (form.dataset.endpoint || '').trim();

    function setStatus(text, isError = false) {
        status.textContent = text;
        status.classList.toggle('is-error', isError);
        field?.classList.toggle('has-status', Boolean(text));
    }

    function setOpen(open) {
        panel.hidden = !open;
        panel.setAttribute('aria-hidden', String(!open));
        openBtn.setAttribute('aria-expanded', String(open));
        panel.classList.toggle('is-open', open);
        if (open) {
            message.focus();
            if (!getEndpoint()) setStatus('not connected', true);
        } else {
            setStatus('');
            if (panel.contains(document.activeElement)) openBtn.focus();
        }
    }

    function cooldownLeft() {
        const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
        return Math.max(0, COOLDOWN_MS - (Date.now() - last));
    }

    openBtn.addEventListener('click', () => setOpen(panel.hidden));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    });

    message.addEventListener('input', () => {
        if (status.textContent) setStatus('');
    });

    message.addEventListener('focus', () => {
        if (status.textContent) setStatus('');
    });

    message.addEventListener('pointerdown', () => {
        if (status.textContent) setStatus('');
    });

    message.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const endpoint = getEndpoint();
        const text = message.value.trim();
        if (!text) {
            message.focus();
            return;
        }
        if (!endpoint) {
            setStatus('not connected', true);
            return;
        }
        if (trap && trap.value) {
            setStatus('message sent');
            form.reset();
            return;
        }
        const wait = cooldownLeft();
        if (wait > 0) {
            setStatus(`retry in ${Math.ceil(wait / 1000)}s`, true);
            return;
        }

        sendBtn.disabled = true;
        sendLabel.textContent = 'SENDING';
        setStatus('sending...');

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    message: text.slice(0, MAX_LENGTH),
                    page: location.href,
                    _subject: 'New message from your site',
                }),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
            form.reset();
            setStatus('message sent');
        } catch (error) {
            setStatus('send failed — try again', true);
        } finally {
            sendBtn.disabled = false;
            sendLabel.textContent = 'SEND';
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
