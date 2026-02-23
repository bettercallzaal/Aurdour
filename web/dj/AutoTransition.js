// AutoTransition.js — Automated crossfade transitions between decks

export class AutoTransition {
    constructor(audioRouter, mixer, decks) {
        this.router = audioRouter;
        this.mixer = mixer;
        this.decks = decks;
        this.running = false;
        this.animFrame = null;
        this.startTime = 0;
        this.duration = 8; // seconds
        this.curve = 'equal-power'; // linear, equal-power, cut
        this.direction = 'AtoB'; // AtoB or BtoA
        this.onComplete = null; // callback when transition finishes

        this._initUI();
    }

    _initUI() {
        const transBtn = document.getElementById('auto-trans-btn');
        const durSelect = document.getElementById('auto-trans-duration');
        const curveSelect = document.getElementById('auto-trans-curve');

        if (transBtn) {
            transBtn.addEventListener('click', () => {
                if (this.running) {
                    this.cancel();
                } else {
                    this.start();
                }
            });
        }

        if (durSelect) {
            durSelect.addEventListener('change', (e) => {
                this.duration = parseFloat(e.target.value);
            });
        }

        if (curveSelect) {
            curveSelect.addEventListener('change', (e) => {
                this.curve = e.target.value;
            });
        }
    }

    start() {
        if (this.running) return;

        const cf = document.getElementById('crossfader');
        const currentPos = cf ? parseInt(cf.value) / 100 : 0.5;

        // Determine direction from current position
        this.direction = currentPos <= 0.5 ? 'AtoB' : 'BtoA';
        this.startPos = currentPos;
        this.endPos = this.direction === 'AtoB' ? 1.0 : 0.0;

        // Auto-play the target deck if not playing
        const targetDeck = this.direction === 'AtoB' ? this.decks.B : this.decks.A;
        if (targetDeck.isLoaded && !targetDeck.isPlaying) {
            this.router.resume();
            targetDeck.play();
        }

        this.running = true;
        this.startTime = performance.now();

        const btn = document.getElementById('auto-trans-btn');
        if (btn) { btn.textContent = 'CANCEL'; btn.classList.add('active'); }

        this._animate();
    }

    cancel() {
        this.running = false;
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        const btn = document.getElementById('auto-trans-btn');
        if (btn) { btn.textContent = 'AUTO'; btn.classList.remove('active'); }
    }

    _animate() {
        if (!this.running) return;

        const elapsed = (performance.now() - this.startTime) / 1000;
        const progress = Math.min(1, elapsed / this.duration);

        let position;
        const range = this.endPos - this.startPos;

        switch (this.curve) {
            case 'linear':
                position = this.startPos + range * progress;
                break;
            case 'equal-power':
                // S-curve
                const t = progress * progress * (3 - 2 * progress);
                position = this.startPos + range * t;
                break;
            case 'cut':
                // Stay at start until last 10%, then quick cut
                if (progress < 0.9) {
                    position = this.startPos + range * 0.1 * (progress / 0.9);
                } else {
                    const cutProgress = (progress - 0.9) / 0.1;
                    position = this.startPos + range * (0.1 + 0.9 * cutProgress);
                }
                break;
            default:
                position = this.startPos + range * progress;
        }

        // Update crossfader
        const cfValue = Math.round(position * 100);
        const cf = document.getElementById('crossfader');
        if (cf) cf.value = cfValue;
        this.router.setCrossfade(position);

        if (progress >= 1) {
            this.running = false;
            // Optionally stop the source deck
            const sourceDeck = this.direction === 'AtoB' ? this.decks.A : this.decks.B;
            if (sourceDeck.isPlaying) sourceDeck.pause();

            const btn = document.getElementById('auto-trans-btn');
            if (btn) { btn.textContent = 'AUTO'; btn.classList.remove('active'); }

            if (this.onComplete) this.onComplete(this.direction);
            return;
        }

        this.animFrame = requestAnimationFrame(() => this._animate());
    }

    startProgrammatic(direction, duration) {
        if (this.running) return;

        this.direction = direction;
        this.duration = duration || this.duration;
        this.startPos = direction === 'AtoB' ? 0.0 : 1.0;
        this.endPos = direction === 'AtoB' ? 1.0 : 0.0;

        // Auto-play the target deck if not playing
        const targetDeck = direction === 'AtoB' ? this.decks.B : this.decks.A;
        if (targetDeck.isLoaded && !targetDeck.isPlaying) {
            this.router.resume();
            targetDeck.play();
        }

        this.running = true;
        this.startTime = performance.now();

        const btn = document.getElementById('auto-trans-btn');
        if (btn) { btn.textContent = 'CANCEL'; btn.classList.add('active'); }

        this._animate();
    }
}
