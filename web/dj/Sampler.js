// Sampler.js — Soundboard/sample pad bank
// 8 pads that can load and trigger short audio clips via AudioBufferSourceNode

export class Sampler {
    constructor(audioRouter) {
        this.router = audioRouter;
        this.ctx = audioRouter.getAudioContext();
        this.pads = new Array(8).fill(null); // { buffer, name, color }
        this.activeSources = new Array(8).fill(null);

        // Sampler output chain: gain → master
        this.gain = this.ctx.createGain();
        this.gain.value = 0.8;
        this.gain.connect(audioRouter.masterGain);

        this._initPadListeners();
    }

    _initPadListeners() {
        const container = document.getElementById('sampler-pads');
        if (!container) return;

        container.querySelectorAll('.sample-pad').forEach(pad => {
            const index = parseInt(pad.dataset.pad);

            // Click to trigger
            pad.addEventListener('click', () => {
                if (this.pads[index]) {
                    this.triggerPad(index);
                }
            });

            // Allow loading audio files via file input
            pad.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this._promptLoadSample(index);
            });
        });

        // Load sample buttons
        document.querySelectorAll('.sample-load-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.pad);
                this._promptLoadSample(index);
            });
        });

        // Master sampler volume
        const volSlider = document.getElementById('sampler-volume');
        if (volSlider) {
            volSlider.addEventListener('input', (e) => {
                this.gain.gain.value = e.target.value / 100;
            });
        }
    }

    _promptLoadSample(padIndex) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await this.loadSampleFromFile(padIndex, file);
        });
        input.click();
    }

    async loadSampleFromFile(padIndex, file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

            const padColors = ['#ff0000', '#ff8800', '#ffdd00', '#00ff44', '#00ddff', '#0066ff', '#8800ff', '#ff44aa'];
            this.pads[padIndex] = {
                buffer: audioBuffer,
                name: file.name.replace(/\.[^/.]+$/, ''),
                color: padColors[padIndex],
            };

            this._updatePadUI(padIndex);
        } catch (err) {
            console.error(`Failed to load sample for pad ${padIndex}:`, err);
        }
    }

    async loadSampleFromURL(padIndex, url, name) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

            const padColors = ['#ff0000', '#ff8800', '#ffdd00', '#00ff44', '#00ddff', '#0066ff', '#8800ff', '#ff44aa'];
            this.pads[padIndex] = {
                buffer: audioBuffer,
                name: name || `Sample ${padIndex + 1}`,
                color: padColors[padIndex],
            };

            this._updatePadUI(padIndex);
        } catch (err) {
            console.error(`Failed to load sample from URL for pad ${padIndex}:`, err);
        }
    }

    triggerPad(padIndex) {
        const pad = this.pads[padIndex];
        if (!pad) return;

        this.router.resume();

        // Stop any currently playing instance on this pad
        if (this.activeSources[padIndex]) {
            try {
                this.activeSources[padIndex].stop();
            } catch (e) { /* already stopped */ }
        }

        const source = this.ctx.createBufferSource();
        source.buffer = pad.buffer;
        source.connect(this.gain);
        source.start();
        this.activeSources[padIndex] = source;

        // Visual feedback
        this._flashPad(padIndex);

        source.onended = () => {
            this.activeSources[padIndex] = null;
        };
    }

    stopPad(padIndex) {
        if (this.activeSources[padIndex]) {
            try {
                this.activeSources[padIndex].stop();
            } catch (e) { /* already stopped */ }
            this.activeSources[padIndex] = null;
        }
    }

    stopAll() {
        for (let i = 0; i < 8; i++) {
            this.stopPad(i);
        }
    }

    _updatePadUI(padIndex) {
        const container = document.getElementById('sampler-pads');
        if (!container) return;

        const padEl = container.children[padIndex];
        if (!padEl) return;

        const pad = this.pads[padIndex];
        if (pad) {
            padEl.classList.add('loaded');
            padEl.style.borderColor = pad.color;
            padEl.style.color = pad.color;
            padEl.querySelector('.sample-name').textContent = pad.name;
        } else {
            padEl.classList.remove('loaded');
            padEl.style.borderColor = '';
            padEl.style.color = '';
            padEl.querySelector('.sample-name').textContent = '';
        }
    }

    _flashPad(padIndex) {
        const container = document.getElementById('sampler-pads');
        if (!container) return;
        const padEl = container.children[padIndex];
        if (!padEl) return;

        padEl.classList.add('triggered');
        setTimeout(() => padEl.classList.remove('triggered'), 150);
    }
}
