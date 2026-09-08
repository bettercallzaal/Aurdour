// Library.js — Track browser with LOCAL, LIKED, and AUDIUS tabs

import { Toast } from './Toast.js';

export class Library {
    constructor(onLoadTrack) {
        this.tracks = [];
        this.filteredTracks = [];
        this.uploadedTracks = []; // local uploaded files from IndexedDB
        this.onLoadTrack = onLoadTrack; // callback(deckId, dataFilePath)
        this.onLoadDirect = null; // callback(deckId, streamUrl, meta) — set by player
        this.onLoadLocalFile = null; // callback(deckId, trackId) — set by player
        this.onAddToQueue = null; // set by Setlist
        this.playlists = null; // set by player — Playlists instance for liked tracks
        this.localFiles = null; // set by player — LocalFiles instance
        this.tableBody = document.getElementById('library-body');
        this.searchInput = document.getElementById('library-search');
        this.selectedIndex = -1;
        this.selectedTrack = null;

        // Audius
        this.audius = null; // set externally
        this.activeTab = 'local';
        this.audiusTracks = [];
        this._searchDebounce = null;

        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this._onSearchInput());
        }

        this._initTabs();
        this._initUploadButton();
    }

    _initTabs() {
        const tabs = document.querySelectorAll('.library-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.activeTab = tab.dataset.tab;
                this._onTabChange();
            });
        });
    }

    _initUploadButton() {
        const header = document.querySelector('.library-header');
        if (!header) return;

        // Hidden file input
        this._fileInput = document.createElement('input');
        this._fileInput.type = 'file';
        this._fileInput.accept = 'audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus,.webm';
        this._fileInput.multiple = true;
        this._fileInput.style.display = 'none';
        this._fileInput.id = 'library-file-upload';
        header.appendChild(this._fileInput);

        // Upload button
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'btn-upload';
        uploadBtn.id = 'library-upload-btn';
        uploadBtn.title = 'Upload audio files';
        uploadBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> <span>UPLOAD</span>`;

        // Insert before the search input
        const searchInput = header.querySelector('.library-search');
        if (searchInput) {
            header.insertBefore(uploadBtn, searchInput);
        } else {
            header.appendChild(uploadBtn);
        }

        // Drop zone overlay for the library area
        const library = document.getElementById('library');
        if (library) {
            library.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                library.classList.add('library-drag-over');
            });
            library.addEventListener('dragleave', (e) => {
                if (!library.contains(e.relatedTarget)) {
                    library.classList.remove('library-drag-over');
                }
            });
            library.addEventListener('drop', (e) => {
                e.preventDefault();
                library.classList.remove('library-drag-over');
                if (e.dataTransfer.files.length > 0) {
                    this._handleUploadedFiles(e.dataTransfer.files);
                }
            });
        }

        uploadBtn.addEventListener('click', () => this._fileInput.click());
        this._fileInput.addEventListener('change', () => {
            if (this._fileInput.files.length > 0) {
                this._handleUploadedFiles(this._fileInput.files);
                this._fileInput.value = '';
            }
        });
    }

    async _handleUploadedFiles(fileList) {
        if (!this.localFiles) {
            console.warn('[Library] LocalFiles not available');
            return;
        }

        const uploadBtn = document.getElementById('library-upload-btn');
        if (uploadBtn) {
            uploadBtn.classList.add('uploading');
            uploadBtn.querySelector('span').textContent = 'UPLOADING...';
        }

        try {
            const newTracks = await this.localFiles.addFiles(fileList);
            if (newTracks.length > 0) {
                this.uploadedTracks = await this.localFiles.getAllTracks();
                // Switch to local tab and re-render
                this.activeTab = 'local';
                document.querySelectorAll('.library-tab').forEach(t => {
                    t.classList.toggle('active', t.dataset.tab === 'local');
                });
                this._filterAndRender();
                Toast.success(`Uploaded ${newTracks.length} track${newTracks.length > 1 ? 's' : ''}`);
            }
        } catch (e) {
            console.error('[Library] Upload failed:', e);
            Toast.error('File upload failed');
        }

        if (uploadBtn) {
            uploadBtn.classList.remove('uploading');
            uploadBtn.querySelector('span').textContent = 'UPLOAD';
        }
    }

    async _loadUploadedTracks() {
        if (!this.localFiles) return;
        try {
            this.uploadedTracks = await this.localFiles.getAllTracks();
        } catch (e) {
            console.warn('[Library] Failed to load uploaded tracks:', e);
        }
    }

    _onTabChange() {
        const query = (this.searchInput?.value || '').trim();

        if (this.activeTab === 'local') {
            this.searchInput.placeholder = 'Search local tracks...';
            this._filterAndRender();
        } else if (this.activeTab === 'liked') {
            this.searchInput.placeholder = 'Search liked tracks...';
            this._renderLiked();
        } else if (this.activeTab === 'audius') {
            this.searchInput.placeholder = 'Search Audius...';
            if (query.length >= 2) {
                this._searchAudius(query);
            } else {
                this._loadAudiusTrending();
            }
        }
    }

    _onSearchInput() {
        if (this.activeTab === 'local') {
            this._filterAndRender();
        } else if (this.activeTab === 'liked') {
            this._renderLiked();
        } else if (this.activeTab === 'audius') {
            clearTimeout(this._searchDebounce);
            this._searchDebounce = setTimeout(() => {
                const query = (this.searchInput?.value || '').trim();
                if (query.length >= 2) {
                    this._searchAudius(query);
                } else if (query.length === 0) {
                    this._loadAudiusTrending();
                }
            }, 400);
        }
    }

    async _searchAudius(query) {
        if (!this.audius) return;
        this._renderLoading('Searching Audius...');
        try {
            this.audiusTracks = await this.audius.search(query);
            this._renderAudius(this.audiusTracks);
        } catch (e) {
            console.error('[Library] Audius search failed:', e);
            Toast.error('Audius search failed — try again');
            this._renderError('Audius search failed. Try again.');
        }
    }

    async _loadAudiusTrending() {
        if (!this.audius) return;
        this._renderLoading('Loading trending...');
        try {
            this.audiusTracks = await this.audius.getTrending(30);
            this._renderAudius(this.audiusTracks);
        } catch (e) {
            console.error('[Library] Audius trending failed:', e);
            this._renderError('Could not load Audius trending.');
        }
    }

    // Browse encoder support for MIDI controllers
    selectNext() {
        const list = this._getCurrentList();
        if (list.length === 0) return;
        this.selectedIndex = Math.min(this.selectedIndex + 1, list.length - 1);
        this.selectedTrack = list[this.selectedIndex];
        this._highlightRow();
    }

    selectPrev() {
        const list = this._getCurrentList();
        if (list.length === 0) return;
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.selectedTrack = list[this.selectedIndex];
        this._highlightRow();
    }

    _getCurrentList() {
        if (this.activeTab === 'liked') return this.playlists ? this.playlists.getLikedTracks() : [];
        if (this.activeTab === 'audius') return this.audiusTracks;
        return this.filteredTracks;
    }

    loadToDeck(track, deckId) {
        if (track && track.source === 'audius') {
            if (this.onLoadDirect) {
                this.onLoadDirect(deckId, track.streamUrl, track);
            }
        } else if (track && track.source === 'local-upload') {
            if (this.onLoadLocalFile) {
                this.onLoadLocalFile(deckId, track._localId);
            }
        } else if (track && track.dataFile) {
            this.onLoadTrack(deckId, track.dataFile);
        }
    }

    _highlightRow() {
        if (!this.tableBody) return;
        const rows = this.tableBody.querySelectorAll('tr');
        rows.forEach((row, i) => {
            row.classList.toggle('selected', i === this.selectedIndex);
        });
        if (rows[this.selectedIndex]) {
            rows[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    async loadManifest() {
        // Load uploaded tracks from IndexedDB
        await this._loadUploadedTracks();

        try {
            const resp = await fetch('data/manifest.json');
            const data = await resp.json();
            this.tracks = data.tracks || [];
        } catch (err) {
            console.warn('No manifest found, using uploaded tracks only');
            this.tracks = [];
        }

        this._filterAndRender();
    }

    _filterAndRender() {
        const query = (this.searchInput?.value || '').toLowerCase();
        // Merge manifest tracks + uploaded tracks
        const allTracks = [...this.uploadedTracks, ...this.tracks];
        this.filteredTracks = query
            ? allTracks.filter(t =>
                (t.title || '').toLowerCase().includes(query) ||
                (t.artist || '').toLowerCase().includes(query) ||
                (t.genre || '').toLowerCase().includes(query))
            : allTracks;
        this.selectedIndex = -1;
        this.selectedTrack = null;
        this._render(this.filteredTracks);
    }

    // ===== Heart button helper =====

    _createHeartBtn(track) {
        const btn = document.createElement('button');
        btn.className = 'btn-heart';
        const liked = this.playlists ? this.playlists.isLiked(track) : false;
        btn.classList.toggle('liked', liked);
        btn.title = liked ? 'Unlike' : 'Like';
        btn.innerHTML = liked
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.playlists) return;
            const nowLiked = this.playlists.toggleLike(track);
            btn.classList.toggle('liked', nowLiked);
            btn.title = nowLiked ? 'Unlike' : 'Like';
            btn.innerHTML = nowLiked
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
            // If on liked tab, re-render to remove unliked track
            if (this.activeTab === 'liked' && !nowLiked) {
                this._renderLiked();
            }
            // Pulse animation
            btn.style.transform = 'scale(1.3)';
            setTimeout(() => { btn.style.transform = ''; }, 200);
        });
        return btn;
    }

    // ===== Liked tab =====

    _renderLiked() {
        if (!this.tableBody) return;
        this.tableBody.textContent = '';
        this.selectedIndex = -1;
        this.selectedTrack = null;

        if (!this.playlists) {
            this._renderError('Playlists not available.');
            return;
        }

        let likedTracks = this.playlists.getLikedTracks();
        const query = (this.searchInput?.value || '').toLowerCase();
        if (query) {
            likedTracks = likedTracks.filter(t =>
                (t.title || '').toLowerCase().includes(query) ||
                (t.artist || '').toLowerCase().includes(query));
        }

        if (likedTracks.length === 0) {
            const row = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.style.textAlign = 'center';
            td.style.color = '#555577';
            td.style.padding = '20px';
            td.textContent = query ? 'No liked tracks match your search.' : 'No liked tracks yet. Click the heart on any track to add it here.';
            row.appendChild(td);
            this.tableBody.appendChild(row);
            return;
        }

        likedTracks.forEach(track => {
            const row = document.createElement('tr');

            const tdTitle = document.createElement('td');
            tdTitle.className = 'lib-title';
            if (track.artwork) {
                const img = document.createElement('img');
                img.src = track.artwork;
                img.className = 'audius-artwork';
                img.alt = '';
                img.width = 24;
                img.height = 24;
                tdTitle.appendChild(img);
            }
            const titleSpan = document.createElement('span');
            titleSpan.textContent = track.title || '-';
            tdTitle.appendChild(titleSpan);

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

            tdActions.appendChild(this._createHeartBtn(track));

            const btnA = document.createElement('button');
            btnA.className = 'btn-load btn-load-a';
            btnA.title = 'Load to Deck A';
            btnA.textContent = 'A';
            btnA.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadToDeck(track, 'A');
            });

            const btnB = document.createElement('button');
            btnB.className = 'btn-load btn-load-b';
            btnB.title = 'Load to Deck B';
            btnB.textContent = 'B';
            btnB.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadToDeck(track, 'B');
            });

            tdActions.appendChild(btnA);
            tdActions.appendChild(btnB);

            row.appendChild(tdTitle);
            row.appendChild(tdArtist);
            row.appendChild(tdBpm);
            row.appendChild(tdKey);
            row.appendChild(tdDuration);
            row.appendChild(tdActions);

            row.addEventListener('dblclick', () => {
                this.loadToDeck(track, null);
            });

            this.tableBody.appendChild(row);
        });
    }

    _renderLoading(msg) {
        if (!this.tableBody) return;
        this.tableBody.textContent = '';
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.style.textAlign = 'center';
        td.style.color = '#8888aa';
        td.style.padding = '20px';
        td.innerHTML = `<span class="audius-loading-spinner"></span> ${msg}`;
        row.appendChild(td);
        this.tableBody.appendChild(row);
    }

    _renderError(msg) {
        if (!this.tableBody) return;
        this.tableBody.textContent = '';
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.style.textAlign = 'center';
        td.style.color = '#ff6b6b';
        td.style.padding = '16px';
        td.textContent = msg;
        row.appendChild(td);
        this.tableBody.appendChild(row);
    }

    _renderAudius(tracks) {
        if (!this.tableBody) return;
        this.tableBody.textContent = '';
        this.selectedIndex = -1;
        this.selectedTrack = null;

        if (tracks.length === 0) {
            const row = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.style.textAlign = 'center';
            td.style.color = '#555577';
            td.style.padding = '16px';
            td.textContent = 'No tracks found on Audius';
            row.appendChild(td);
            this.tableBody.appendChild(row);
            return;
        }

        tracks.forEach(track => {
            const row = document.createElement('tr');

            // Title with artwork
            const tdTitle = document.createElement('td');
            tdTitle.className = 'lib-title';
            if (track.artwork) {
                const img = document.createElement('img');
                img.src = track.artwork;
                img.className = 'audius-artwork';
                img.alt = '';
                img.width = 24;
                img.height = 24;
                tdTitle.appendChild(img);
            }
            const titleSpan = document.createElement('span');
            titleSpan.textContent = track.title;
            tdTitle.appendChild(titleSpan);

            const tdArtist = document.createElement('td');
            tdArtist.className = 'lib-artist';
            tdArtist.textContent = track.artist;

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

            tdActions.appendChild(this._createHeartBtn(track));

            const btnA = document.createElement('button');
            btnA.className = 'btn-load btn-load-a';
            btnA.title = 'Load to Deck A';
            btnA.textContent = 'A';
            btnA.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onLoadDirect) this.onLoadDirect('A', track.streamUrl, track);
            });

            const btnB = document.createElement('button');
            btnB.className = 'btn-load btn-load-b';
            btnB.title = 'Load to Deck B';
            btnB.textContent = 'B';
            btnB.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onLoadDirect) this.onLoadDirect('B', track.streamUrl, track);
            });

            const btnQ = document.createElement('button');
            btnQ.className = 'btn-load';
            btnQ.title = 'Add to setlist queue';
            btnQ.textContent = '+';
            btnQ.style.color = '#8b5cf6';
            btnQ.addEventListener('click', (e) => {
                e.stopPropagation();
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

            row.addEventListener('dblclick', () => {
                // Load to next available deck
                if (this.onLoadDirect) this.onLoadDirect(null, track.streamUrl, track);
            });

            this.tableBody.appendChild(row);
        });
    }

    _render(tracks) {
        if (!this.tableBody) return;
        this.tableBody.textContent = '';

        if (tracks.length === 0) {
            const row = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.style.textAlign = 'center';
            td.style.color = '#555577';
            td.style.padding = '20px';
            td.innerHTML = 'No tracks found. <span style="color:#00d4ff;cursor:pointer" id="empty-upload-link">Upload audio files</span> or try the <span style="color:#c855f0">AUDIUS</span> tab.';
            row.appendChild(td);
            this.tableBody.appendChild(row);
            // Wire the upload link
            setTimeout(() => {
                document.getElementById('empty-upload-link')?.addEventListener('click', () => {
                    this._fileInput?.click();
                });
            }, 0);
            return;
        }

        tracks.forEach(track => {
            const isUploaded = track.source === 'local-upload';
            const row = document.createElement('tr');

            const tdTitle = document.createElement('td');
            tdTitle.className = 'lib-title';
            if (isUploaded) {
                const badge = document.createElement('span');
                badge.className = 'lib-upload-badge';
                badge.textContent = '↑';
                badge.title = 'Uploaded file';
                tdTitle.appendChild(badge);
            }
            const titleSpan = document.createElement('span');
            titleSpan.textContent = track.title || '-';
            tdTitle.appendChild(titleSpan);

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

            tdActions.appendChild(this._createHeartBtn(track));

            const loadHandler = (deckId) => {
                if (isUploaded && this.onLoadLocalFile) {
                    this.onLoadLocalFile(deckId, track._localId);
                } else if (track.dataFile) {
                    this.onLoadTrack(deckId, track.dataFile);
                }
            };

            const btnA = document.createElement('button');
            btnA.className = 'btn-load btn-load-a';
            btnA.title = 'Load to Deck A';
            btnA.textContent = 'A';
            btnA.addEventListener('click', () => loadHandler('A'));

            const btnB = document.createElement('button');
            btnB.className = 'btn-load btn-load-b';
            btnB.title = 'Load to Deck B';
            btnB.textContent = 'B';
            btnB.addEventListener('click', () => loadHandler('B'));

            const btnQ = document.createElement('button');
            btnQ.className = 'btn-load';
            btnQ.title = 'Add to setlist queue';
            btnQ.textContent = '+';
            btnQ.style.color = '#8b5cf6';
            btnQ.addEventListener('click', () => {
                if (this.onAddToQueue) this.onAddToQueue(track);
            });

            // Delete button for uploaded tracks
            if (isUploaded) {
                const btnDel = document.createElement('button');
                btnDel.className = 'btn-load btn-delete';
                btnDel.title = 'Remove from library';
                btnDel.textContent = '×';
                btnDel.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (this.localFiles) {
                        await this.localFiles.removeFile(track._localId);
                        this.uploadedTracks = await this.localFiles.getAllTracks();
                        this._filterAndRender();
                    }
                });
                tdActions.appendChild(btnDel);
            }

            tdActions.appendChild(btnA);
            tdActions.appendChild(btnB);
            tdActions.appendChild(btnQ);

            row.appendChild(tdTitle);
            row.appendChild(tdArtist);
            row.appendChild(tdBpm);
            row.appendChild(tdKey);
            row.appendChild(tdDuration);
            row.appendChild(tdActions);

            row.addEventListener('dblclick', () => loadHandler(null));

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
