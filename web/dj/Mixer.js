// Mixer.js — UI bindings for mixer controls → AudioRouter

export class Mixer {
    constructor(audioRouter) {
        this.router = audioRouter;
        this._bindControls();
    }

    _bindControls() {
        // Crossfader
        const crossfader = document.getElementById('crossfader');
        if (crossfader) {
            crossfader.addEventListener('input', (e) => {
                this.router.setCrossfade(e.target.value / 100);
            });
        }

        // Channel volume faders
        ['a', 'b'].forEach(ch => {
            const deckId = ch.toUpperCase();

            const volFader = document.getElementById(`vol-${ch}`);
            if (volFader) {
                volFader.addEventListener('input', (e) => {
                    this.router.setChannelVolume(deckId, e.target.value / 100);
                });
            }

            // EQ knobs
            ['high', 'mid', 'low'].forEach(band => {
                const knob = document.getElementById(`eq-${ch}-${band}`);
                if (knob) {
                    knob.addEventListener('input', (e) => {
                        this.router.setEQ(deckId, band, parseFloat(e.target.value));
                    });

                    // Double-click to reset
                    knob.addEventListener('dblclick', () => {
                        knob.value = 0;
                        this.router.setEQ(deckId, band, 0);
                    });
                }

                // EQ Kill button
                const killBtn = document.getElementById(`eq-kill-${ch}-${band}`);
                if (killBtn) {
                    killBtn.addEventListener('click', () => {
                        const killed = this.router.toggleEQKill(deckId, band);
                        killBtn.classList.toggle('active', killed);
                    });
                }
            });
        });

        // Master volume
        const masterVol = document.getElementById('master-volume');
        if (masterVol) {
            masterVol.addEventListener('input', (e) => {
                this.router.setMasterVolume(e.target.value / 100);
            });
        }

        // Fader curve select
        const faderCurveSelect = document.getElementById('fader-curve-select');
        if (faderCurveSelect) {
            faderCurveSelect.addEventListener('change', (e) => {
                this.router.setFaderCurve(e.target.value);
            });
        }

        // Limiter toggle
        const limiterBtn = document.getElementById('limiter-toggle');
        if (limiterBtn) {
            limiterBtn.addEventListener('click', () => {
                const enabled = !this.router.limiterEnabled;
                this.router.setLimiterEnabled(enabled);
                limiterBtn.classList.toggle('active', enabled);
            });
        }

        // Auto-gain toggle
        const autoGainBtn = document.getElementById('autogain-toggle');
        if (autoGainBtn) {
            autoGainBtn.addEventListener('click', () => {
                const enabled = !this.router.autoGainEnabled;
                this.router.setAutoGain(enabled);
                autoGainBtn.classList.toggle('active', enabled);
            });
        }
    }

    // Programmatic crossfader nudge (for keyboard shortcuts)
    nudgeCrossfader(delta) {
        const crossfader = document.getElementById('crossfader');
        if (!crossfader) return;

        const newVal = Math.max(0, Math.min(100, parseInt(crossfader.value) + delta));
        crossfader.value = newVal;
        this.router.setCrossfade(newVal / 100);
    }

    // Programmatic volume nudge
    nudgeVolume(deckId, delta) {
        const ch = deckId.toLowerCase();
        const fader = document.getElementById(`vol-${ch}`);
        if (!fader) return;

        const newVal = Math.max(0, Math.min(100, parseInt(fader.value) + delta));
        fader.value = newVal;
        this.router.setChannelVolume(deckId, newVal / 100);
    }
}
