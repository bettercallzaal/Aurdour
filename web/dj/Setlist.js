// Setlist.js — Track queue manager and play history

export class Setlist {
    constructor(library, loadTrackCallback) {
        this.queue = []; // { id, title, artist, dataFile }
        this.history = []; // { title, artist, startTime, endTime }
        this.loadTrack = loadTrackCallback;
        this.library = library;
        this.dragIndex = null;

        this._initUI();
    }

    _initUI() {
        const queueList = document.getElementById('setlist-queue');
        const historyList = document.getElementById('setlist-history');
        const exportBtn = document.getElementById('setlist-export');
        const clearBtn = document.getElementById('setlist-clear');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportSet());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.queue = [];
                this._renderQueue();
            });
        }
    }

    addToQueue(track) {
        this.queue.push({
            id: track.id || Date.now(),
            title: track.title,
            artist: track.artist,
            dataFile: track.dataFile,
        });
        this._renderQueue();
    }

    removeFromQueue(index) {
        this.queue.splice(index, 1);
        this._renderQueue();
    }

    moveInQueue(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.queue.length) return;
        if (toIndex < 0 || toIndex >= this.queue.length) return;
        const [item] = this.queue.splice(fromIndex, 1);
        this.queue.splice(toIndex, 0, item);
        this._renderQueue();
    }

    loadNext(deckId) {
        if (this.queue.length === 0) return;
        const track = this.queue.shift();
        this.loadTrack(deckId, track.dataFile);
        this.logPlay(track.title, track.artist);
        this._renderQueue();
    }

    logPlay(title, artist) {
        this.history.push({
            title,
            artist,
            startTime: new Date().toISOString(),
        });
        this._renderHistory();
    }

    exportSet() {
        const lines = ['AURDOUR DJ SET', `Date: ${new Date().toLocaleDateString()}`, ''];

        this.history.forEach((entry, i) => {
            const time = new Date(entry.startTime).toLocaleTimeString();
            lines.push(`${i + 1}. ${entry.title} - ${entry.artist} [${time}]`);
        });

        if (this.queue.length > 0) {
            lines.push('', '--- UPCOMING ---');
            this.queue.forEach((entry, i) => {
                lines.push(`${i + 1}. ${entry.title} - ${entry.artist}`);
            });
        }

        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `setlist-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    _renderQueue() {
        const list = document.getElementById('setlist-queue');
        if (!list) return;
        list.textContent = '';

        if (this.queue.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'setlist-empty';
            empty.textContent = 'Queue empty — add tracks from library';
            list.appendChild(empty);
            return;
        }

        this.queue.forEach((track, i) => {
            const item = document.createElement('div');
            item.className = 'setlist-item';
            item.draggable = true;
            item.dataset.index = i;

            const num = document.createElement('span');
            num.className = 'setlist-num';
            num.textContent = i + 1;

            const info = document.createElement('span');
            info.className = 'setlist-info';
            info.textContent = `${track.title} — ${track.artist || ''}`;

            const actions = document.createElement('span');
            actions.className = 'setlist-actions';

            const loadA = document.createElement('button');
            loadA.className = 'btn-load btn-load-a btn-xs';
            loadA.textContent = 'A';
            loadA.addEventListener('click', () => {
                this.loadTrack('A', track.dataFile);
                this.logPlay(track.title, track.artist);
                this.queue.splice(i, 1);
                this._renderQueue();
            });

            const loadB = document.createElement('button');
            loadB.className = 'btn-load btn-load-b btn-xs';
            loadB.textContent = 'B';
            loadB.addEventListener('click', () => {
                this.loadTrack('B', track.dataFile);
                this.logPlay(track.title, track.artist);
                this.queue.splice(i, 1);
                this._renderQueue();
            });

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-setlist-remove';
            removeBtn.textContent = '\u00d7';
            removeBtn.addEventListener('click', () => this.removeFromQueue(i));

            actions.appendChild(loadA);
            actions.appendChild(loadB);
            actions.appendChild(removeBtn);
            item.appendChild(num);
            item.appendChild(info);
            item.appendChild(actions);

            // Drag and drop
            item.addEventListener('dragstart', (e) => {
                this.dragIndex = i;
                item.classList.add('dragging');
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this.dragIndex = null;
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (this.dragIndex !== null && this.dragIndex !== i) {
                    this.moveInQueue(this.dragIndex, i);
                }
            });

            list.appendChild(item);
        });
    }

    _renderHistory() {
        const list = document.getElementById('setlist-history');
        if (!list) return;
        list.textContent = '';

        this.history.slice().reverse().forEach(entry => {
            const item = document.createElement('div');
            item.className = 'history-item';
            const time = new Date(entry.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            item.textContent = `${time} — ${entry.title}`;
            list.appendChild(item);
        });
    }
}
