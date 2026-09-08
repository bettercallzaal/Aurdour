// Toast.js — Lightweight toast notification system for AURDOUR DJ
// Provides non-blocking user feedback for operations, errors, and status changes

export class Toast {
    static _container = null;
    static _counter = 0;

    static _ensureContainer() {
        if (Toast._container && document.body.contains(Toast._container)) {
            return Toast._container;
        }
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
        Toast._container = container;
        return container;
    }

    static _show(message, type = 'info', duration = 4000) {
        const container = Toast._ensureContainer();
        const id = `toast-${++Toast._counter}`;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.id = id;

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        switch (type) {
            case 'success': icon.textContent = '\u2713'; break;
            case 'error':   icon.textContent = '\u2717'; break;
            case 'warning': icon.textContent = '\u26A0'; break;
            case 'info':    icon.textContent = '\u2139'; break;
        }

        const msgEl = document.createElement('span');
        msgEl.className = 'toast-message';
        msgEl.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.textContent = '\u00D7';
        closeBtn.addEventListener('click', () => Toast._dismiss(toast));

        toast.appendChild(icon);
        toast.appendChild(msgEl);
        toast.appendChild(closeBtn);
        container.appendChild(toast);

        // Trigger slide-in animation on next frame
        requestAnimationFrame(() => {
            toast.classList.add('toast-visible');
        });

        // Auto-dismiss
        const timer = setTimeout(() => Toast._dismiss(toast), duration);
        toast._dismissTimer = timer;

        return toast;
    }

    static _dismiss(toast) {
        if (!toast || !toast.parentNode) return;
        if (toast._dismissTimer) clearTimeout(toast._dismissTimer);

        toast.classList.remove('toast-visible');
        toast.classList.add('toast-leaving');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, { once: true });

        // Fallback removal if transitionend doesn't fire
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 500);
    }

    static success(message) {
        return Toast._show(message, 'success', 4000);
    }

    static error(message) {
        return Toast._show(message, 'error', 6000);
    }

    static info(message) {
        return Toast._show(message, 'info', 4000);
    }

    static warning(message) {
        return Toast._show(message, 'warning', 4000);
    }
}
