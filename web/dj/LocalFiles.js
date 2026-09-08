// LocalFiles.js — Upload, store, and manage local audio files in IndexedDB
// Persists audio blobs across sessions so users don't need to re-upload

export class LocalFiles {
    constructor() {
        this._db = null;
        this._ready = this._openDB();
    }

    async _openDB() {
        return new Promise((resolve) => {
            const req = indexedDB.open('aurdour-localfiles', 2);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    const store = db.createObjectStore('files', { keyPath: 'id' });
                    store.createIndex('title', 'title', { unique: false });
                }
            };
            req.onsuccess = (e) => {
                this._db = e.target.result;
                resolve();
            };
            req.onerror = () => {
                console.warn('[LocalFiles] IndexedDB open failed');
                resolve();
            };
        });
    }

    async _ensureDB() {
        await this._ready;
        return this._db;
    }

    // Check available storage quota
    async checkQuota(neededBytes) {
        if (navigator.storage && navigator.storage.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            const available = quota - usage;
            if (neededBytes > available) {
                console.warn(`[LocalFiles] Not enough storage: need ${(neededBytes / 1024 / 1024).toFixed(1)}MB, available ${(available / 1024 / 1024).toFixed(1)}MB`);
                return false;
            }
        }
        return true;
    }

    // Store an uploaded file and return its track metadata
    async addFile(file) {
        const db = await this._ensureDB();
        if (!db) return null;

        // Check storage quota before reading file
        const hasSpace = await this.checkQuota(file.size * 1.2); // 20% overhead for IndexedDB
        if (!hasSpace) {
            throw new Error(`Not enough storage for "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB). Try removing some uploaded tracks.`);
        }

        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const arrayBuffer = await file.arrayBuffer();

        // Parse title/artist from filename (supports "Artist - Title.mp3" format)
        const name = file.name.replace(/\.[^/.]+$/, '');
        const parts = name.split(' - ');
        const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : name;
        const artist = parts.length > 1 ? parts[0].trim() : '';

        // Get duration using a temporary audio element
        const duration = await this._getAudioDuration(file);

        const record = {
            id,
            title,
            artist,
            duration,
            bpm: null,
            key: null,
            genre: '',
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            blob: arrayBuffer,
            addedAt: Date.now(),
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            const req = store.put(record);
            req.onsuccess = () => {
                console.log(`[LocalFiles] Stored: "${title}" (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
                resolve(this._toTrack(record));
            };
            req.onerror = () => {
                console.error('[LocalFiles] Failed to store file');
                reject(req.error);
            };
        });
    }

    // Add multiple files at once
    async addFiles(fileList) {
        const tracks = [];
        for (const file of fileList) {
            if (this._isAudioFile(file)) {
                try {
                    const track = await this.addFile(file);
                    if (track) tracks.push(track);
                } catch (e) {
                    console.warn(`[LocalFiles] Skipped "${file.name}":`, e);
                }
            }
        }
        return tracks;
    }

    // Get all stored tracks (metadata only, no blob)
    async getAllTracks() {
        const db = await this._ensureDB();
        if (!db) return [];

        return new Promise((resolve) => {
            const tx = db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const req = store.getAll();
            req.onsuccess = () => {
                const tracks = (req.result || [])
                    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
                    .map(r => this._toTrack(r));
                resolve(tracks);
            };
            req.onerror = () => resolve([]);
        });
    }

    // Get a blob URL for playing a stored track
    // Caller should call revokeAudioUrl() when done with the URL
    async getAudioUrl(trackId) {
        // Revoke previous URL for this track if any
        if (this._activeUrls && this._activeUrls[trackId]) {
            URL.revokeObjectURL(this._activeUrls[trackId]);
        }

        const db = await this._ensureDB();
        if (!db) return null;

        return new Promise((resolve) => {
            const tx = db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const req = store.get(trackId);
            req.onsuccess = () => {
                const record = req.result;
                if (!record || !record.blob) {
                    resolve(null);
                    return;
                }
                const blob = new Blob([record.blob], { type: record.fileType || 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                if (!this._activeUrls) this._activeUrls = {};
                this._activeUrls[trackId] = url;
                resolve(url);
            };
            req.onerror = () => resolve(null);
        });
    }

    // Remove a stored track
    async removeFile(trackId) {
        const db = await this._ensureDB();
        if (!db) return;

        return new Promise((resolve) => {
            const tx = db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            store.delete(trackId);
            tx.oncomplete = () => {
                console.log(`[LocalFiles] Removed: ${trackId}`);
                resolve();
            };
            tx.onerror = () => resolve();
        });
    }

    // Update BPM/key for a stored track (after auto-detection)
    async updateMeta(trackId, updates) {
        const db = await this._ensureDB();
        if (!db) return;

        return new Promise((resolve) => {
            const tx = db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            const req = store.get(trackId);
            req.onsuccess = () => {
                const record = req.result;
                if (!record) { resolve(); return; }
                Object.assign(record, updates);
                store.put(record);
                resolve();
            };
            req.onerror = () => resolve();
        });
    }

    // Clear all stored files
    async clearAll() {
        const db = await this._ensureDB();
        if (!db) return;
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').clear();
    }

    // Convert DB record to a track object the Library can use
    _toTrack(record) {
        return {
            id: record.id,
            title: record.title,
            artist: record.artist,
            duration: record.duration,
            bpm: record.bpm,
            key: record.key,
            genre: record.genre,
            fileName: record.fileName,
            source: 'local-upload',
            _localId: record.id,
        };
    }

    _isAudioFile(file) {
        const types = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm'];
        const exts = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.opus', '.webm'];
        return types.includes(file.type) || exts.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    _getAudioDuration(file) {
        return new Promise((resolve) => {
            const audio = new Audio();
            const url = URL.createObjectURL(file);
            audio.addEventListener('loadedmetadata', () => {
                const dur = isFinite(audio.duration) ? Math.round(audio.duration) : 0;
                URL.revokeObjectURL(url);
                resolve(dur);
            });
            audio.addEventListener('error', () => {
                URL.revokeObjectURL(url);
                resolve(0);
            });
            audio.src = url;
        });
    }
}
