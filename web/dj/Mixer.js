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
            });
        });

        // Master volume
        const masterVol = document.getElementById('master-volume');
        if (masterVol) {
            masterVol.addEventListener('input', (e) => {
                this.router.setMasterVolume(e.target.value / 100);
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
