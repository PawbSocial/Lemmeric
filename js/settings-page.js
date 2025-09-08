/**
 * Settings Page App for Lemmeric
 * Handles user settings and preferences
 */

import { 
    getAllInstances, 
    getCurrentInstance, 
    setCurrentInstance, 
    getCurrentTheme, 
    setCurrentTheme,
    getLargeImagesSetting,
    setLargeImagesSetting,
    getThumbnailDisplaySetting,
    setThumbnailDisplaySetting,
    getUserData,
    setUserData,
    isSingleInstanceMode
} from './config.js';
import { authManager } from './auth.js';

class LemmericSettingsApp {
    constructor() {
        this.currentUser = null;
        this.settings = {
            general: {
                defaultInstance: getCurrentInstance(),
                defaultSort: 'Active',
                defaultListing: 'Local'
            },
            appearance: {
                theme: getCurrentTheme(),
                showAvatars: true,
                thumbnailDisplay: getThumbnailDisplaySetting(),
                largeImages: getLargeImagesSetting()
            },
            account: {
                showNsfw: false,
                showScores: true,
                sendNotifications: true
            }
        };

        // UI elements cache
        this.elements = {};
        
        this.init();
    }

    /**
     * Initialize the settings app
     */
    async init() {
        try {
            console.log('Initializing Settings Page App...');
            
            // Cache DOM elements
            this.cacheElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load current settings
            await this.loadSettings();
            
            // Try to load current user from auth manager
            await authManager.loadCurrentUser();
            
            // Load user data if authenticated
            this.currentUser = authManager.getCurrentUser();
            
            if (this.currentUser) {
                this.loadAccountInfo();
                // Use setTimeout to ensure DOM is fully ready, then check admin status
                setTimeout(async () => {
                    await this.checkAdminStatus();
                }, 100);
            }
            
            // Update UI based on authentication status
            this.updateAuthenticationUI();
            
        } catch (error) {
            console.error('Failed to initialize Settings Page App:', error);
            this.showError('Failed to initialize settings page');
        }
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            // Navigation
            backBtn: document.getElementById('back-btn'),
            adminTabItem: document.getElementById('admin-tab-item'),
            accountTabItem: document.getElementById('account-tab')?.closest('li'),
            
            // General settings
            defaultInstance: document.getElementById('default-instance'),
            defaultSort: document.getElementById('default-sort'),
            defaultListing: document.getElementById('default-listing'),
            
            // Appearance settings
            themeCards: document.querySelectorAll('.theme-card'),
            themeLightRadio: document.getElementById('theme-light'),
            themeDarkRadio: document.getElementById('theme-dark'),
            showAvatars: document.getElementById('show-avatars'),
            thumbnailDisplay: document.getElementById('thumbnail-display'),
            largeImages: document.getElementById('large-images'),
            
            // Account settings
            accountInfo: document.getElementById('account-info'),
            showNsfw: document.getElementById('show-nsfw'),
            showScores: document.getElementById('show-scores'),
            sendNotifications: document.getElementById('send-notifications'),
            
            // Privacy settings
            clearCacheBtn: document.getElementById('clear-cache-btn'),
            clearAllDataBtn: document.getElementById('clear-all-data-btn'),
            
            // Save button
            saveBtn: document.getElementById('save-settings-btn')
        };
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Back button
        if (this.elements.backBtn) {
            this.elements.backBtn.addEventListener('click', () => {
                window.history.back();
            });
        }

        // Theme cards
        this.elements.themeCards.forEach(card => {
            card.addEventListener('click', () => {
                const theme = card.dataset.theme;
                this.selectTheme(theme);
            });
        });

        // Theme radio buttons
        if (this.elements.themeLightRadio) {
            this.elements.themeLightRadio.addEventListener('change', () => {
                if (this.elements.themeLightRadio.checked) {
                    this.selectTheme('light');
                }
            });
        }

        if (this.elements.themeDarkRadio) {
            this.elements.themeDarkRadio.addEventListener('change', () => {
                if (this.elements.themeDarkRadio.checked) {
                    this.selectTheme('dark');
                }
            });
        }

        // Save button
        if (this.elements.saveBtn) {
            this.elements.saveBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }

        // Clear cache button
        if (this.elements.clearCacheBtn) {
            this.elements.clearCacheBtn.addEventListener('click', () => {
                this.clearCache();
            });
        }

        // Clear all data button
        if (this.elements.clearAllDataBtn) {
            this.elements.clearAllDataBtn.addEventListener('click', () => {
                this.clearAllData();
            });
        }

        // Large images setting - apply immediately on change
        if (this.elements.largeImages) {
            this.elements.largeImages.addEventListener('change', () => {
                this.applyLargeImagesSetting(this.elements.largeImages.checked);
            });
        }

        // Thumbnail display setting - apply immediately on change
        if (this.elements.thumbnailDisplay) {
            this.elements.thumbnailDisplay.addEventListener('change', () => {
                this.applyThumbnailDisplaySetting(this.elements.thumbnailDisplay.value);
            });
        }
    }

    /**
     * Load current settings
     */
    async loadSettings() {
        try {
            // Load settings from localStorage or defaults
            const savedSettings = localStorage.getItem('lemmeric-settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            }

            // Populate instance selector
            await this.populateInstanceSelector();
            
            // Apply settings to form
            this.applySettingsToForm();
            
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /**
     * Populate instance selector
     */
    async populateInstanceSelector() {
        const selector = this.elements.defaultInstance;
        if (!selector) return;

        // Hide instance selector if in single instance mode
        if (isSingleInstanceMode()) {
            const container = document.getElementById('instance-selector-container');
            if (container) {
                container.style.display = 'none';
            }
            return;
        }

        try {
            // Clear existing options
            selector.innerHTML = '';

            const allInstances = getAllInstances();
            Object.entries(allInstances).forEach(([key, instance]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = instance.name || key;
                if (instance.isCustom) {
                    option.dataset.custom = 'true';
                }
                selector.appendChild(option);
            });

            // Set current instance
            const currentInstance = getCurrentInstance();
            if (selector.querySelector(`option[value="${currentInstance}"]`)) {
                selector.value = currentInstance;
            }

        } catch (error) {
            console.error('Error populating instance selector:', error);
        }
    }

    /**
     * Apply settings to form elements
     */
    applySettingsToForm() {
        // General settings
        if (this.elements.defaultInstance) {
            this.elements.defaultInstance.value = this.settings.general.defaultInstance;
        }
        if (this.elements.defaultSort) {
            this.elements.defaultSort.value = this.settings.general.defaultSort;
        }
        if (this.elements.defaultListing) {
            this.elements.defaultListing.value = this.settings.general.defaultListing;
        }

        // Appearance settings
        this.selectTheme(this.settings.appearance.theme);
        if (this.elements.showAvatars) {
            this.elements.showAvatars.checked = this.settings.appearance.showAvatars;
        }
        if (this.elements.thumbnailDisplay) {
            this.elements.thumbnailDisplay.value = this.settings.appearance.thumbnailDisplay;
        }
        if (this.elements.largeImages) {
            this.elements.largeImages.checked = this.settings.appearance.largeImages;
        }
        
        // Apply settings immediately
        this.applyLargeImagesSetting(this.settings.appearance.largeImages);
        this.applyThumbnailDisplaySetting(this.settings.appearance.thumbnailDisplay);

        // Account settings
        if (this.elements.showNsfw) {
            this.elements.showNsfw.checked = this.settings.account.showNsfw;
        }
        if (this.elements.showScores) {
            this.elements.showScores.checked = this.settings.account.showScores;
        }
        if (this.elements.sendNotifications) {
            this.elements.sendNotifications.checked = this.settings.account.sendNotifications;
        }
    }

    /**
     * Select theme and update UI
     */
    selectTheme(theme) {
        // Update theme cards
        this.elements.themeCards.forEach(card => {
            card.classList.remove('selected');
            if (card.dataset.theme === theme) {
                card.classList.add('selected');
            }
        });

        // Update radio buttons
        if (theme === 'light' && this.elements.themeLightRadio) {
            this.elements.themeLightRadio.checked = true;
        } else if (theme === 'dark' && this.elements.themeDarkRadio) {
            this.elements.themeDarkRadio.checked = true;
        }

        // Apply theme immediately
        setCurrentTheme(theme);
        document.documentElement.setAttribute('data-theme', theme);

        // Update settings
        this.settings.appearance.theme = theme;
    }

    /**
     * Load account information
     */
    loadAccountInfo() {
        const container = this.elements.accountInfo;
        if (!container || !this.currentUser) return;

        container.innerHTML = `
            <div class="row">
                <div class="col-md-4 text-center">
                    ${this.currentUser.avatar ? 
                        `<img src="${this.currentUser.avatar}" alt="Avatar" class="rounded-circle mb-3" style="width: 80px; height: 80px;">` :
                        `<i class="bi bi-person-circle display-4 mb-3"></i>`
                    }
                </div>
                <div class="col-md-8">
                    <h6><i class="bi bi-person me-1"></i>Username</h6>
                    <p class="text-muted">${this.currentUser.name}</p>
                    
                    ${this.currentUser.displayName ? `
                        <h6><i class="bi bi-card-text me-1"></i>Display Name</h6>
                        <p class="text-muted">${this.currentUser.displayName}</p>
                    ` : ''}
                    
                    ${this.currentUser.email ? `
                        <h6><i class="bi bi-envelope me-1"></i>Email</h6>
                        <p class="text-muted">${this.currentUser.email}</p>
                    ` : ''}
                    
                    <h6><i class="bi bi-calendar me-1"></i>Member Since</h6>
                    <p class="text-muted">${new Date(this.currentUser.published).toLocaleDateString()}</p>
                </div>
            </div>
        `;
    }

    /**
     * Check if current user is an admin and show/hide admin tab accordingly
     */
    async checkAdminStatus() {
        if (!this.currentUser || !this.elements.adminTabItem) {
            return;
        }

        try {
            // Get site data to check admin list
            const api = authManager.api;
            const siteResponse = await api.getSite();
            
            if (!siteResponse) {
                this.elements.adminTabItem.style.display = 'none';
                return;
            }

            // Check if user is an admin by comparing with site admin list
            const admins = siteResponse.admins || [];
            const isAdmin = admins.some(admin => {
                const adminPerson = admin.person || admin;
                return adminPerson.id === this.currentUser.id || adminPerson.name === this.currentUser.name;
            });

            if (isAdmin) {
                // Show admin tab
                this.elements.adminTabItem.style.display = 'block';
                // Update current user object with admin flag
                this.currentUser.admin = true;
            } else {
                // Hide admin tab
                this.elements.adminTabItem.style.display = 'none';
                // Update current user object with admin flag
                this.currentUser.admin = false;
            }
            
        } catch (error) {
            console.error('Error checking admin status:', error);
            // Hide admin tab on error
            this.elements.adminTabItem.style.display = 'none';
        }
    }

    /**
     * Update UI based on authentication status
     */
    updateAuthenticationUI() {
        // Show/hide Account tab based on authentication status
        if (this.elements.accountTabItem) {
            if (this.currentUser) {
                // User is authenticated - show Account tab
                this.elements.accountTabItem.style.display = 'block';
            } else {
                // User is not authenticated - hide Account tab
                this.elements.accountTabItem.style.display = 'none';
                
                // Ensure Lemmeric tab is active if Account tab was active
                const accountTab = document.getElementById('account-tab');
                const lemmericTab = document.getElementById('lemmeric-tab');
                if (accountTab && lemmericTab && accountTab.classList.contains('active')) {
                    // Switch to Lemmeric tab
                    accountTab.classList.remove('active');
                    lemmericTab.classList.add('active');
                    
                    // Update tab content as well
                    const accountContent = document.getElementById('account-content');
                    const lemmericContent = document.getElementById('lemmeric-content');
                    if (accountContent && lemmericContent) {
                        accountContent.classList.remove('show', 'active');
                        lemmericContent.classList.add('show', 'active');
                    }
                }
            }
        }
    }

    /**
     * Apply large images setting
     */
    applyLargeImagesSetting(enabled) {
        setLargeImagesSetting(enabled);
    }

    /**
     * Apply thumbnail display setting
     */
    applyThumbnailDisplaySetting(mode) {
        setThumbnailDisplaySetting(mode);
    }

    /**
     * Save settings
     */
    saveSettings() {
        try {
            // Update settings from form
            if (this.elements.defaultInstance) {
                this.settings.general.defaultInstance = this.elements.defaultInstance.value;
                setCurrentInstance(this.elements.defaultInstance.value);
            }
            if (this.elements.defaultSort) {
                this.settings.general.defaultSort = this.elements.defaultSort.value;
            }
            if (this.elements.defaultListing) {
                this.settings.general.defaultListing = this.elements.defaultListing.value;
            }
            if (this.elements.showAvatars) {
                this.settings.appearance.showAvatars = this.elements.showAvatars.checked;
            }
            if (this.elements.thumbnailDisplay) {
                this.settings.appearance.thumbnailDisplay = this.elements.thumbnailDisplay.value;
                // Apply the setting immediately
                this.applyThumbnailDisplaySetting(this.elements.thumbnailDisplay.value);
            }
            if (this.elements.largeImages) {
                this.settings.appearance.largeImages = this.elements.largeImages.checked;
                // Apply the setting immediately
                this.applyLargeImagesSetting(this.elements.largeImages.checked);
            }
            if (this.elements.showNsfw) {
                this.settings.account.showNsfw = this.elements.showNsfw.checked;
            }
            if (this.elements.showScores) {
                this.settings.account.showScores = this.elements.showScores.checked;
            }
            if (this.elements.sendNotifications) {
                this.settings.account.sendNotifications = this.elements.sendNotifications.checked;
            }
            
            // Save to localStorage
            localStorage.setItem('lemmeric-settings', JSON.stringify(this.settings));
            
            // Show success message
            this.showToast('Settings saved successfully!', 'success');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showToast('Failed to save settings', 'error');
        }
    }

    /**
     * Clear cache
     */
    clearCache() {
        try {
            // Clear specific cache items but keep auth and settings
            const itemsToKeep = ['lemmeric-auth-token', 'lemmeric-user-data', 'lemmeric-settings'];
            const itemsToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('lemmeric-') && !itemsToKeep.includes(key)) {
                    itemsToRemove.push(key);
                }
            }
            
            itemsToRemove.forEach(key => localStorage.removeItem(key));
            
            this.showToast('Cache cleared successfully!', 'success');
        } catch (error) {
            console.error('Error clearing cache:', error);
            this.showToast('Failed to clear cache', 'error');
        }
    }

    /**
     * Clear all data
     */
    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This will log you out and reset all settings to defaults.')) {
            try {
                localStorage.clear();
                this.showToast('All data cleared!', 'success');
                
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
                
            } catch (error) {
                console.error('Error clearing all data:', error);
                this.showToast('Failed to clear data', 'error');
            }
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Simple alert for now - can be enhanced later
        alert(message);
    }

    /**
     * Show error message
     */
    showError(message) {
        this.showToast(message, 'error');
    }


}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.lemmericSettingsApp = new LemmericSettingsApp();
});

// Export for other modules
export { LemmericSettingsApp }; 