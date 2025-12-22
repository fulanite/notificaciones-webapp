/**
 * SGND - Offline Support Module
 */

const offline = {
    queue: [],
    isOnline: navigator.onLine,

    // Initialize offline support
    init() {
        // Load existing queue
        this.loadQueue();

        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Initial status
        this.updateBanner();
    },

    // Handle going online
    async handleOnline() {
        this.isOnline = true;
        this.updateBanner();

        // Sync pending items
        if (this.queue.length > 0) {
            utils.showToast('Conexión restaurada. Sincronizando datos...', 'info');
            await this.syncQueue();
        }
    },

    // Handle going offline
    handleOffline() {
        this.isOnline = false;
        this.updateBanner();
        utils.showToast('Sin conexión. Los cambios se guardarán localmente.', 'warning');
    },

    // Update offline banner
    updateBanner() {
        const banner = document.getElementById('offline-banner');
        if (!banner) return;

        if (this.isOnline) {
            banner.classList.add('hidden');
        } else {
            banner.classList.remove('hidden');
        }
    },

    // Add item to offline queue
    addToQueue(action, data) {
        const item = {
            id: utils.generateId(),
            action,
            data,
            timestamp: new Date().toISOString(),
            retries: 0
        };

        this.queue.push(item);
        this.saveQueue();
        this.updateSyncBadge();

        return item.id;
    },

    // Sync queue with server
    async syncQueue() {
        if (this.queue.length === 0) return;

        const itemsToSync = [...this.queue];
        let successCount = 0;

        for (const item of itemsToSync) {
            try {
                await this.processQueueItem(item);
                this.removeFromQueue(item.id);
                successCount++;
            } catch (error) {
                console.error('Sync error:', error);
                item.retries++;

                if (item.retries >= 3) {
                    // Max retries reached, mark as failed
                    item.failed = true;
                    utils.showToast(`Error al sincronizar: ${item.action}`, 'error');
                }
            }
        }

        this.saveQueue();
        this.updateSyncBadge();

        if (successCount > 0) {
            utils.showToast(`${successCount} elemento(s) sincronizado(s)`, 'success');
        }
    },

    // Process a single queue item
    async processQueueItem(item) {
        switch (item.action) {
            case 'create_notification':
                return await db.createNotification(item.data);

            case 'update_notification':
                return await db.updateNotification(item.data.id, item.data.updates);

            case 'register_result':
                return await db.registerResult(
                    item.data.id,
                    item.data.result,
                    item.data.userId
                );

            default:
                throw new Error(`Unknown action: ${item.action}`);
        }
    },

    // Remove item from queue
    removeFromQueue(id) {
        this.queue = this.queue.filter(item => item.id !== id);
    },

    // Save queue to localStorage
    saveQueue() {
        try {
            localStorage.setItem(CONFIG.OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
        } catch (error) {
            console.error('Error saving offline queue:', error);
        }
    },

    // Load queue from localStorage
    loadQueue() {
        try {
            const stored = localStorage.getItem(CONFIG.OFFLINE_QUEUE_KEY);
            if (stored) {
                this.queue = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading offline queue:', error);
            this.queue = [];
        }
    },

    // Update sync badge
    updateSyncBadge() {
        const badge = document.getElementById('sync-pending');
        if (!badge) return;

        const pendingCount = this.queue.filter(item => !item.failed).length;

        if (pendingCount > 0) {
            badge.textContent = pendingCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    // Get pending count
    getPendingCount() {
        return this.queue.filter(item => !item.failed).length;
    },

    // Get failed items
    getFailedItems() {
        return this.queue.filter(item => item.failed);
    },

    // Retry failed items
    async retryFailed() {
        const failedItems = this.getFailedItems();

        for (const item of failedItems) {
            item.failed = false;
            item.retries = 0;
        }

        this.saveQueue();
        await this.syncQueue();
    },

    // Clear failed items
    clearFailed() {
        this.queue = this.queue.filter(item => !item.failed);
        this.saveQueue();
        this.updateSyncBadge();
    },

    // Cache data locally
    cacheData(key, data) {
        try {
            const cacheItem = {
                data,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem(`sgnd_cache_${key}`, JSON.stringify(cacheItem));
        } catch (error) {
            console.error('Cache error:', error);
        }
    },

    // Get cached data
    getCachedData(key, maxAge = 3600000) { // Default 1 hour
        try {
            const stored = localStorage.getItem(`sgnd_cache_${key}`);
            if (!stored) return null;

            const cacheItem = JSON.parse(stored);
            const age = new Date() - new Date(cacheItem.timestamp);

            if (age > maxAge) {
                localStorage.removeItem(`sgnd_cache_${key}`);
                return null;
            }

            return cacheItem.data;
        } catch (error) {
            return null;
        }
    }
};
