// Library.js — Track browser: loads manifest, renders table, search, load-to-deck

export class Library {
    constructor(onLoadTrack) {
        this.tracks = [];
        this.filteredTracks = [];
        this.onLoadTrack = onLoadTrack; // callback(deckId, dataFilePath)
        this.onAddToQueue = null; // set by Setlist
        this.tableBody = document.getElementById('library-body');
        this.searchInput = document.getElementById('library-search');
        this.selectedIndex = -1;
        this.selectedTrack = null;

        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this._filterAndRender());
        }
    }

    // Browse encoder support for MIDI controllers
    selectNext() {
        if (this.filteredTracks.length === 0) return;
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredTracks.length - 1);
        this.selectedTrack = this.filteredTracks[this.selectedIndex];
        this._highlightRow();
    }

    selectPrev() {
        if (this.filteredTracks.length === 0) return;
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.selectedTrack = this.filteredTracks[this.selectedIndex];
        this._highlightRow();
    }

    loadToDeck(track, deckId) {
        if (track && track.dataFile) {
            this.onLoadTrack(deckId, track.dataFile);
        }
    }

    _highlightRow() {
        if (!this.tableBody) return;
        const rows = this.tableBody.querySelectorAll('tr');
        rows.forEach((row, i) => {
            row.classList.toggle('selected', i === this.selectedIndex);
        });
        // Scroll selected row into view
        if (rows[this.selectedIndex]) {
            rows[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    async loadManifest() {
        try {
            const resp = await fetch('data/manifest.json');
            const data = await resp.json();
            this.tracks = data.tracks || [];
            this._filterAndRender();
        } catch (err) {
            console.error('Failed to load manifest:', err);
            if (this.tableBody) {
                this.tableBody.textContent = '';
                const row = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 7;
                td.style.textAlign = 'center';
                td.style.color = '#666';
                td.textContent = 'No tracks found. Run pipeline.sh to add tracks.';
                row.appendChild(td);
                this.tableBody.appendChild(row);
            }
        }
    }

    _filterAndRender() {
        const query = (this.searchInput?.value || '').toLowerCase();
        this.filteredTracks = query
            ? this.tracks.filter(t =>
                (t.title || '').toLowerCase().includes(query) ||
                (t.artist || '').toLowerCase().includes(query) ||
                (t.genre || '').toLowerCase().includes(query))
            : [...this.tracks];
        this.selectedIndex = -1;
        this.selectedTrack = null;
        this._render(this.filteredTracks);
    }

    _render(tracks) {
        if (!this.tableBody) return;
        this.tableBody.textContent = '';

        if (tracks.length === 0) {
            const row = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.style.textAlign = 'center';
            td.style.color = '#666';
            td.textContent = 'No tracks';
            row.appendChild(td);
            this.tableBody.appendChild(row);
            return;
        }

        tracks.forEach(track => {
            const row = document.createElement('tr');

            const tdTitle = document.createElement('td');
            tdTitle.className = 'lib-title';
            tdTitle.textContent = track.title || '-';

            const tdArtist = document.createElement('td');
            tdArtist.className = 'lib-artist';
            tdArtist.textContent = track.artist || '-';

            const tdBpm = document.createElement('td');
            tdBpm.className = 'lib-bpm';
            tdBpm.textContent = track.bpm || '-';

            const tdKey = document.createElement('td');
            tdKey.className = 'lib-key';
            tdKey.textContent = track.key || '-';

            const tdDuration = document.createElement('td');
            tdDuration.className = 'lib-duration';
            tdDuration.textContent = this._formatDuration(track.duration);

            const tdActions = document.createElement('td');
            tdActions.className = 'lib-actions';

            const btnA = document.createElement('button');
            btnA.className = 'btn-load btn-load-a';
            btnA.title = 'Load to Deck A';
            btnA.textContent = 'A';
            btnA.addEventListener('click', () => this.onLoadTrack('A', track.dataFile));

            const btnB = document.createElement('button');
            btnB.className = 'btn-load btn-load-b';
            btnB.title = 'Load to Deck B';
            btnB.textContent = 'B';
            btnB.addEventListener('click', () => this.onLoadTrack('B', track.dataFile));

            const btnQ = document.createElement('button');
            btnQ.className = 'btn-load';
            btnQ.title = 'Add to setlist queue';
            btnQ.textContent = '+';
            btnQ.style.color = '#8b5cf6';
            btnQ.addEventListener('click', () => {
                if (this.onAddToQueue) this.onAddToQueue(track);
            });

            tdActions.appendChild(btnA);
            tdActions.appendChild(btnB);
            tdActions.appendChild(btnQ);

            row.appendChild(tdTitle);
            row.appendChild(tdArtist);
            row.appendChild(tdBpm);
            row.appendChild(tdKey);
            row.appendChild(tdDuration);
            row.appendChild(tdActions);

            // Double-click row to load into next available deck
            row.addEventListener('dblclick', () => {
                this.onLoadTrack(null, track.dataFile);
            });

            this.tableBody.appendChild(row);
        });
    }

    _formatDuration(seconds) {
        if (!seconds) return '-';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}
