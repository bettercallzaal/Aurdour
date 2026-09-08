// Recorder.js — Record master output to downloadable audio file
// Uses MediaRecorder API + MediaStreamDestination from the audio graph
// Supports format selection: webm, ogg, mp4

export class Recorder {
    constructor(audioRouter) {
        this.router = audioRouter;
        this.ctx = audioRouter.getAudioContext();
        this.mediaRecorder = null;
        this.chunks = [];
        this.isRecording = false;
        this.startTime = 0;
        this.timerInterval = null;
        this.preferredFormat = 'webm';

        // Create a stream destination tapped from the master
        this.streamDest = this.ctx.createMediaStreamDestination();
        audioRouter.masterAnalyser.connect(this.streamDest);

        this._initUI();
    }

    _initUI() {
        const recBtn = document.getElementById('rec-btn');
        const formatSelect = document.getElementById('rec-format');

        if (recBtn) {
            recBtn.addEventListener('click', () => {
                if (this.isRecording) {
                    this.stop();
                } else {
                    this.start();
                }
            });
        }

        if (formatSelect) {
            formatSelect.addEventListener('change', (e) => {
                this.preferredFormat = e.target.value;
            });
        }
    }

    start() {
        if (this.isRecording) return;

        this.router.resume();
        this.chunks = [];

        this.mediaRecorder = new MediaRecorder(this.streamDest.stream, {
            mimeType: this._getMimeType(),
        });

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.chunks.push(e.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this._saveRecording();
        };

        this.mediaRecorder.start(1000); // collect data every second
        this.isRecording = true;
        this.startTime = Date.now();

        // UI update
        const recBtn = document.getElementById('rec-btn');
        if (recBtn) {
            recBtn.classList.add('recording');
            recBtn.textContent = 'STOP REC';
        }

        // Timer
        this.timerInterval = setInterval(() => this._updateTimer(), 100);
    }

    stop() {
        if (!this.isRecording || !this.mediaRecorder) return;

        this.mediaRecorder.stop();
        this.isRecording = false;

        const recBtn = document.getElementById('rec-btn');
        if (recBtn) {
            recBtn.classList.remove('recording');
            recBtn.textContent = 'REC';
        }

        clearInterval(this.timerInterval);
    }

    async _saveRecording() {
        const mimeType = this._getMimeType();
        const blob = new Blob(this.chunks, { type: mimeType });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

        // If user selected WAV, convert from webm to WAV using AudioContext
        if (this.preferredFormat === 'wav') {
            try {
                const wavBlob = await this._convertToWav(blob);
                this._downloadBlob(wavBlob, `aurdour-mix-${timestamp}.wav`);
                return;
            } catch (e) {
                console.warn('WAV conversion failed, saving original format:', e);
            }
        }

        const ext = this._getExtension(mimeType);
        this._downloadBlob(blob, `aurdour-mix-${timestamp}.${ext}`);
    }

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    async _convertToWav(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length;
        const bytesPerSample = 2; // 16-bit
        const dataSize = length * numChannels * bytesPerSample;

        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // WAV header
        const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
        view.setUint16(32, numChannels * bytesPerSample, true);
        view.setUint16(34, 16, true); // bits per sample

        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);

        // Interleave channels and write 16-bit PCM
        const channels = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channels.push(audioBuffer.getChannelData(ch));
        }

        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    _updateTimer() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const recTime = document.getElementById('rec-time');
        if (recTime) {
            const m = Math.floor(elapsed / 60);
            const s = Math.floor(elapsed % 60);
            recTime.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        }
    }

    _getMimeType() {
        const formatMap = {
            webm: ['audio/webm;codecs=opus', 'audio/webm'],
            ogg: ['audio/ogg;codecs=opus', 'audio/ogg'],
            mp4: ['audio/mp4', 'audio/mpeg'],
        };

        const candidates = formatMap[this.preferredFormat] || formatMap.webm;
        for (const type of candidates) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }

        // Fallback
        const allTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
        for (const type of allTypes) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return 'audio/webm';
    }

    _getExtension(mimeType) {
        if (mimeType.includes('webm')) return 'webm';
        if (mimeType.includes('ogg')) return 'ogg';
        if (mimeType.includes('mp4') || mimeType.includes('mpeg')) return 'm4a';
        return 'webm';
    }

    // Expose the stream for external use (e.g., WebRTC broadcasting)
    getOutputStream() {
        return this.streamDest.stream;
    }
}
