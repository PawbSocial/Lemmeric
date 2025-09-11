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
            
            // Custom instance elements
            customInstanceForm: document.getElementById('custom-instance-form'),
            customInstanceDomain: document.getElementById('custom-instance-domain'),
            addCustomInstanceBtn: document.getElementById('add-custom-instance-btn'),
            cancelCustomInstanceBtn: document.getElementById('cancel-custom-instance-btn'),
            customInstancesList: document.getElementById('custom-instances-list'),
            customInstancesContainer: document.getElementById('custom-instances-container'),
            
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

        // Custom instance functionality
        if (this.elements.defaultInstance) {
            this.elements.defaultInstance.addEventListener('change', () => {
                this.handleInstanceSelectorChange();
            });
        }

        if (this.elements.addCustomInstanceBtn) {
            this.elements.addCustomInstanceBtn.addEventListener('click', () => {
                this.addCustomInstance();
            });
        }

        if (this.elements.cancelCustomInstanceBtn) {
            this.elements.cancelCustomInstanceBtn.addEventListener('click', () => {
                this.cancelCustomInstance();
            });
        }

        if (this.elements.customInstanceDomain) {
            this.elements.customInstanceDomain.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addCustomInstance();
                }
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

            // Add "Custom" option
            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = 'Add Custom Instance...';
            customOption.dataset.custom = 'true';
            selector.appendChild(customOption);

            // Set current instance
            const currentInstance = getCurrentInstance();
            if (selector.querySelector(`option[value="${currentInstance}"]`)) {
                selector.value = currentInstance;
            }

            // Load custom instances list
            await this.loadCustomInstancesList();

        } catch (error) {
            console.error('Error populating instance selector:', error);
        }
    }

    /**
     * Handle instance selector change
     */
    handleInstanceSelectorChange() {
        const selectedValue = this.elements.defaultInstance.value;
        
        if (selectedValue === 'custom') {
            this.showCustomInstanceForm();
        } else {
            this.hideCustomInstanceForm();
        }
    }

    /**
     * Show custom instance form
     */
    showCustomInstanceForm() {
        if (this.elements.customInstanceForm) {
            this.elements.customInstanceForm.style.display = 'block';
            this.elements.customInstanceDomain.focus();
        }
    }

    /**
     * Hide custom instance form
     */
    hideCustomInstanceForm() {
        if (this.elements.customInstanceForm) {
            this.elements.customInstanceForm.style.display = 'none';
            this.elements.customInstanceDomain.value = '';
        }
    }

    /**
     * Add custom instance
     */
    async addCustomInstance() {
        const domain = this.elements.customInstanceDomain.value.trim();
        
        if (!domain) {
            this.showToast('Please enter a domain', 'error');
            return;
        }

        // Validate domain format
        const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(domain)) {
            this.showToast('Please enter a valid domain (e.g., your-instance.com)', 'error');
            return;
        }

        try {
            // Check if instance already exists
            const allInstances = getAllInstances();
            if (allInstances[domain]) {
                this.showToast('This instance is already added', 'error');
                return;
            }

            // Test if the instance is accessible
            const testUrl = `https://${domain}/api/v3/site`;
            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const siteData = await response.json();
            
            // Create instance configuration
            const instanceConfig = {
                name: siteData.site_view?.site?.name || domain,
                url: `https://${domain}`,
                api: `https://${domain}/api/v3`,
                description: siteData.site_view?.site?.description || '',
                icon: siteData.site_view?.site?.icon || '',
                banner: siteData.site_view?.site?.banner || '',
                isCustom: true
            };

            // Add the custom instance
            const { addCustomInstance } = await import('./config.js');
            const success = addCustomInstance(domain, instanceConfig);

            if (success) {
                this.showToast(`Successfully added ${instanceConfig.name}`, 'success');
                this.hideCustomInstanceForm();
                this.populateInstanceSelector();
                this.loadCustomInstancesList();
                
                // Select the newly added instance
                this.elements.defaultInstance.value = domain;
            } else {
                this.showToast('Failed to add custom instance', 'error');
            }

        } catch (error) {
            console.error('Error adding custom instance:', error);
            this.showToast(`Failed to connect to ${domain}. Please check the domain and try again.`, 'error');
        }
    }

    /**
     * Cancel custom instance addition
     */
    cancelCustomInstance() {
        this.hideCustomInstanceForm();
        // Reset to previous selection
        const currentInstance = getCurrentInstance();
        this.elements.defaultInstance.value = currentInstance;
    }

    /**
     * Load custom instances list
     */
    async loadCustomInstancesList() {
        if (!this.elements.customInstancesList || !this.elements.customInstancesContainer) {
            return;
        }

        const customInstances = await this.getCustomInstances();
        const customInstanceKeys = Object.keys(customInstances);

        if (customInstanceKeys.length === 0) {
            this.elements.customInstancesList.style.display = 'none';
            return;
        }

        this.elements.customInstancesList.style.display = 'block';
        this.elements.customInstancesContainer.innerHTML = '';

        customInstanceKeys.forEach(key => {
            const instance = customInstances[key];
            const instanceElement = this.createCustomInstanceElement(key, instance);
            this.elements.customInstancesContainer.appendChild(instanceElement);
        });
    }

    /**
     * Create custom instance element
     */
    createCustomInstanceElement(key, instance) {
        const div = document.createElement('div');
        div.className = 'd-flex justify-content-between align-items-center p-2 border rounded mb-2';
        
        div.innerHTML = `
            <div class="d-flex align-items-center">
                ${instance.icon ? 
                    `<img src="${instance.icon}" alt="${instance.name}" class="rounded me-2" style="width: 24px; height: 24px;">` :
                    `<i class="bi bi-globe me-2"></i>`
                }
                <div>
                    <div class="fw-bold">${instance.name}</div>
                    <small class="text-muted">${instance.url}</small>
                </div>
            </div>
            <div class="d-flex gap-1">
                <button class="btn btn-outline-primary btn-sm" onclick="lemmericSettingsApp.selectCustomInstance('${key}')">
                    <i class="bi bi-check"></i>
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="lemmericSettingsApp.removeCustomInstance('${key}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        
        return div;
    }

    /**
     * Get custom instances
     */
    async getCustomInstances() {
        try {
            const { getCustomInstances } = await import('./config.js');
            return getCustomInstances();
        } catch (error) {
            console.error('Error getting custom instances:', error);
            return {};
        }
    }

    /**
     * Select custom instance
     */
    selectCustomInstance(key) {
        this.elements.defaultInstance.value = key;
        this.hideCustomInstanceForm();
    }

    /**
     * Remove custom instance
     */
    async removeCustomInstance(key) {
        if (!confirm(`Are you sure you want to remove this custom instance?`)) {
            return;
        }

        try {
            const { removeCustomInstance } = await import('./config.js');
            const success = removeCustomInstance(key);

            if (success) {
                this.showToast('Custom instance removed', 'success');
                this.populateInstanceSelector();
                this.loadCustomInstancesList();
                
                // If the removed instance was selected, reset to default
                if (this.elements.defaultInstance.value === key) {
                    const { getCurrentInstance } = await import('./config.js');
                    const currentInstance = getCurrentInstance();
                    this.elements.defaultInstance.value = currentInstance;
                }
            } else {
                this.showToast('Failed to remove custom instance', 'error');
            }
        } catch (error) {
            console.error('Error removing custom instance:', error);
            this.showToast('Failed to remove custom instance', 'error');
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