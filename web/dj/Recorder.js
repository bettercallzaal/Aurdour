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

    _saveRecording() {
        const mimeType = this._getMimeType();
        const ext = this._getExtension(mimeType);
        const blob = new Blob(this.chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `aurdour-mix-${timestamp}.${ext}`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();

        URL.revokeObjectURL(url);
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
