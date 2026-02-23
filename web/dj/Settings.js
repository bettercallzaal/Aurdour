// Settings.js — Settings panel UI for preferences, output routing, crossfader curve

export class Settings {
    constructor(djPlayer) {
        this.dj = djPlayer;
        this.panelOpen = false;
        this._undoStack = [];
        this._redoStack = [];

        this._initUI();
        this._initOutputSelector();
    }

    _initUI() {
        const settingsBtn = document.getElementById('settings-btn');
        const settingsPanel = document.getElementById('settings-panel');
        const closeBtn = document.getElementById('settings-close');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.panelOpen = !this.panelOpen;
                settingsPanel?.classList.toggle('hidden', !this.panelOpen);
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.panelOpen = false;
                settingsPanel?.classList.add('hidden');
            });
        }

        // Crossfader curve
        const cfCurve = document.getElementById('setting-cf-curve');
        if (cfCurve) {
            cfCurve.addEventListener('change', (e) => {
                this.dj.audioRouter.setCrossfaderCurve(e.target.value);
            });
        }

        // Key shift
        ['a', 'b'].forEach(ch => {
            const keyShift = document.getElementById(`keyshift-${ch}`);
            if (keyShift) {
                keyShift.addEventListener('input', (e) => {
                    const semitones = parseInt(e.target.value);
                    this._applyKeyShift(ch.toUpperCase(), semitones);
                    const display = document.getElementById(`keyshift-${ch}-display`);
                    if (display) display.textContent = `${semitones >= 0 ? '+' : ''}${semitones}`;
                });
            }
        });

        // Export/Import settings
        document.getElementById('settings-export')?.addEventListener('click', () => {
            this.dj.storage.exportAll();
        });

        document.getElementById('settings-import')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.dj.storage.importAll(file);
                    location.reload();
                }
            });
            input.click();
        });

        // MIDI profile save/load
        document.getElementById('midi-save-profile')?.addEventListener('click', () => {
            const name = prompt('Profile name:');
            if (name) {
                const profiles = this.dj.storage.get('midi_profiles', {});
                profiles[name] = { ...this.dj.midi.mappings };
                this.dj.storage.set('midi_profiles', profiles);
                this._renderMidiProfiles();
            }
        });
    }

    async _initOutputSelector() {
        const headphoneSelect = document.getElementById('setting-headphone-output');
        if (!headphoneSelect) return;

        try {
            // Need permission first
            await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
            const devices = await this.dj.audioRouter.getOutputDevices();

            headphoneSelect.textContent = '';
            const defaultOpt = document.createElement('option');
            defaultOpt.value = '';
            defaultOpt.textContent = 'Default';
            headphoneSelect.appendChild(defaultOpt);

            devices.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.deviceId;
                opt.textContent = d.label || `Output ${d.deviceId.slice(0, 8)}`;
                headphoneSelect.appendChild(opt);
            });

            headphoneSelect.addEventListener('change', async (e) => {
                if (e.target.value) {
                    await this.dj.audioRouter.setHeadphoneDevice(e.target.value);
                }
            });
        } catch (e) {
            console.log('Could not enumerate audio outputs');
        }
    }

    _applyKeyShift(deckId, semitones) {
        const deck = this.dj.decks[deckId];
        if (!deck || !deck.isLoaded) return;
        // Key shift via detune on the audio element
        // Web Audio doesn't have native pitch shift without tempo change
        // but we can use playbackRate + preservesPitch
        // For true pitch shift, we'd need a PitchShifter node (not available natively)
        // Approximate: adjust playback rate slightly while keylock compensates
        const ratio = Math.pow(2, semitones / 12);
        const media = deck.getMediaElement();
        if (media) {
            media.playbackRate = deck.currentRate * ratio;
            media.preservesPitch = true; // this keeps the pitch, so we invert
            // Actually for key shift: we want to CHANGE pitch without tempo
            // preservesPitch = false + rate change = both pitch and tempo change
            // preservesPitch = true + rate change = tempo change only
            // true key shift requires DSP. For now, toggle preservesPitch off to shift
            media.preservesPitch = false;
        }
    }

    _renderMidiProfiles() {
        const listEl = document.getElementById('midi-profiles-list');
        if (!listEl) return;
        const profiles = this.dj.storage.get('midi_profiles', {});
        listEl.textContent = '';

        Object.keys(profiles).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'btn-toolbar btn-sm';
            btn.textContent = name;
            btn.addEventListener('click', () => {
                this.dj.midi.mappings = { ...profiles[name] };
                this.dj.storage.saveMidiMappings(this.dj.midi.mappings);
            });
            listEl.appendChild(btn);
        });
    }

    // ===== UNDO / REDO =====

    pushUndo(action) {
        this._undoStack.push(action);
        this._redoStack = [];
        if (this._undoStack.length > 50) this._undoStack.shift();
    }

    undo() {
        if (this._undoStack.length === 0) return;
        const action = this._undoStack.pop();
        this._redoStack.push(action);
        if (action.undo) action.undo();
    }

    redo() {
        if (this._redoStack.length === 0) return;
        const action = this._redoStack.pop();
        this._undoStack.push(action);
        if (action.redo) action.redo();
    }
}
