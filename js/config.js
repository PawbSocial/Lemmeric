/**
 * Configuration file for Lemmeric
 * 
 * This file contains all configuration settings, API endpoints, and instance
 * configurations for the Lemmeric application.
 * 
 * @fileoverview Central configuration management for Lemmeric
 * 
 * INSTANCE DEPLOYMENT INSTRUCTIONS:
 * 
 * To deploy Lemmeric as your own instance's UI:
 * 1. Set SINGLE_INSTANCE_MODE to true
 * 2. Update SINGLE_INSTANCE_URL to your instance domain (e.g., 'https://your-instance.com')
 * 3. Customize other settings as needed
 * 
 * SINGLE INSTANCE MODE:
 * - Removes instance selector from the UI
 * - Uses your instance's branding (name, icon, description)
 * - Locks the interface to your specific instance
 * - Automatically fetches instance info from your API
 * 
 * MULTI-INSTANCE MODE (default):
 * - Allows users to switch between different Lemmy instances
 * - Shows instance selector in the UI
 * - Uses Lemmeric branding
 * - Supports custom instance additions
 */

// ========================================
// MAIN CONFIGURATION OBJECT
// ========================================

export const CONFIG = {
    // ========================================
    // INSTANCE DEPLOYMENT SETTINGS
    // ========================================
    
    // Instance deployment mode
    // Set to true to enable single-instance mode for instance owners
    // This will remove instance selector, use instance branding, and lock to default instance
    SINGLE_INSTANCE_MODE: false,
    
    // Single instance configuration (used when SINGLE_INSTANCE_MODE is true)
    // This should be the full URL of your instance (e.g., 'https://your-instance.com')
    SINGLE_INSTANCE_URL: 'https://pawb.social',
    
    // ========================================
    // DEFAULT SETTINGS
    // ========================================
    
    // Default instance settings
    DEFAULT_INSTANCE: 'lemmy.world',
    DEFAULT_SORT: 'Active',
    DEFAULT_TYPE: 'Local',
    DEFAULT_PAGE_SIZE: 20,
    
    // ========================================
    // INSTANCE CONFIGURATIONS
    // ========================================
    
    // API endpoints for different instances
    INSTANCES: {
        'lemmy.world': {
            name: 'Lemmy World',
            url: 'https://lemmy.world',
            api: 'https://lemmy.world/api/v3',
            description: 'General purpose instance',
            icon: null
        },
        'lemmy.ml': {
            name: 'Lemmy ML',
            url: 'https://lemmy.ml',
            api: 'https://lemmy.ml/api/v3',
            description: 'Original Lemmy instance',
            icon: null
        },
        'beehaw.org': {
            name: 'Beehaw',
            url: 'https://beehaw.org',
            api: 'https://beehaw.org/api/v3',
            description: 'A community focused instance',
            icon: null
        },
        'lemmy.ca': {
            name: 'Lemmy Canada',
            url: 'https://lemmy.ca',
            api: 'https://lemmy.ca/api/v3',
            description: 'Canadian Lemmy instance',
            icon: null
        },
        'sh.itjust.works': {
            name: 'Sh.itjust.works',
            url: 'https://sh.itjust.works',
            api: 'https://sh.itjust.works/api/v3',
            description: 'General purpose instance',
            icon: null
        },
        'pawb.social': {
            name: 'Pawb Social',
            url: 'https://pawb.social',
            api: 'https://pawb.social/api/v3',
            description: 'Fediverse communities for furries by furries',
            icon: null
        }
    },
    
    // ========================================
    // UI CONFIGURATION
    // ========================================
    
    // Sort options
    SORT_OPTIONS: [
        { value: 'Active', label: 'Active', icon: 'bi-lightning-fill' },
        { value: 'Hot', label: 'Hot', icon: 'bi-fire' },
        { value: 'New', label: 'New', icon: 'bi-clock-fill' },
        { value: 'TopDay', label: 'Top Day', icon: 'bi-trophy-fill' },
        { value: 'TopWeek', label: 'Top Week', icon: 'bi-trophy' },
        { value: 'TopMonth', label: 'Top Month', icon: 'bi-award' },
        { value: 'TopYear', label: 'Top Year', icon: 'bi-star-fill' },
        { value: 'TopAll', label: 'Top All', icon: 'bi-gem' },
        { value: 'MostComments', label: 'Most Comments', icon: 'bi-chat-dots' },
        { value: 'NewComments', label: 'New Comments', icon: 'bi-chat-text' }
    ],
    
    // Listing types
    LISTING_TYPES: [
        { value: 'All', label: 'All' },
        { value: 'Local', label: 'Local' },
        { value: 'Subscribed', label: 'Subscribed' }
    ],
    
    // Theme settings
    THEMES: {
        LIGHT: 'light',
        DARK: 'dark'
    },
    
    // ========================================
    // STORAGE CONFIGURATION
    // ========================================
    
    // Local storage keys
    STORAGE_KEYS: {
        THEME: 'lemmeric_theme',
        INSTANCE: 'lemmeric_instance',
        SORT: 'lemmeric_sort',
        LISTING_TYPE: 'lemmeric_listing_type',
        VISITED_POSTS: 'lemmeric_visited_posts',
        CUSTOM_INSTANCES: 'lemmeric_custom_instances',
        AUTH_TOKEN: 'lemmeric_auth_token',
        USER_DATA: 'lemmeric_user_data'
    },
    
    // ========================================
    // API CONFIGURATION
    // ========================================
    
    // API request settings
    API: {
        TIMEOUT: 10000, // 10 seconds
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000, // 1 second
        
        // Rate limiting
        RATE_LIMIT: {
            MAX_REQUESTS: 60,
            WINDOW_MS: 60000 // 1 minute
        }
    },
    
    // ========================================
    // CONTENT CONFIGURATION
    // ========================================
    
    // Content settings
    CONTENT: {
        MAX_TITLE_LENGTH: 200,
        MAX_CONTENT_PREVIEW: 300,
        MAX_COMMUNITIES_SIDEBAR: 10,
        IMAGE_PROXY_ENABLED: true,
        NSFW_BLUR: true
    },
    
    // ========================================
    // FEATURE CONFIGURATION
    // ========================================
    
    // Features toggles
    FEATURES: {
        INFINITE_SCROLL: true,
        AUTO_REFRESH: false,
        KEYBOARD_SHORTCUTS: true,
        ACCESSIBILITY_MODE: false
    },
    
    // ========================================
    // ERROR MESSAGES
    // ========================================
    
    // Error messages
    ERRORS: {
        NETWORK: 'Network error. Please check your connection.',
        INSTANCE_DOWN: 'Instance appears to be down. Try another instance.',
        INVALID_RESPONSE: 'Invalid response from server.',
        RATE_LIMITED: 'Too many requests. Please wait a moment.',
        UNKNOWN: 'An unknown error occurred.'
    },
    
    // ========================================
    // URL PATTERNS AND SHORTCUTS
    // ========================================
    
    // URL patterns
    URL_PATTERNS: {
        POST: /^\/post\/(\d+)$/,
        COMMUNITY: /^\/c\/([^/]+)(?:@([^/]+))?$/,
        USER: /^\/u\/([^/]+)(?:@([^/]+))?$/,
        INSTANCE: /^\/instance\/([^/]+)$/
    },
    
    // Keyboard shortcuts
    KEYBOARD_SHORTCUTS: {
        'k': 'Previous post',
        'j': 'Next post',
        'o': 'Open post',
        'c': 'Open comments',
        'h': 'Go home',
        't': 'Toggle theme',
        'r': 'Refresh',
        '/': 'Search',
        '?': 'Show help'
    }
};

////////////////////////////////////////////////////////////
// DO NOT EDIT BELOW THIS LINE - EDITABLE CONFIGURATION ENDS HERE
////////////////////////////////////////////////////////////

// ========================================
// INSTANCE MANAGEMENT FUNCTIONS
// ========================================

/**
 * Get the current instance configuration
 * @param {string} instanceName - Name of the instance
 * @returns {Object} Instance configuration
 */
export function getInstanceConfig(instanceName = null) {
    const instance = instanceName || getCurrentInstance();
    
    // In single instance mode, create a config from the URL
    if (isSingleInstanceMode()) {
        try {
            const url = new URL(instance);
            const domain = url.hostname;
            return {
                name: domain,
                url: instance,
                api: `${instance}/api/v3`,
                description: 'Single instance deployment',
                icon: null
            };
        } catch (error) {
            console.error('Invalid SINGLE_INSTANCE_URL:', instance, error);
            // Fallback to a safe default
            return {
                name: 'Instance',
                url: instance,
                api: `${instance}/api/v3`,
                description: 'Single instance deployment',
                icon: null
            };
        }
    }
    
    const allInstances = getAllInstances();
    return allInstances[instance] || allInstances[CONFIG.DEFAULT_INSTANCE];
}

/**
 * Check if single instance mode is enabled
 * @returns {boolean} True if single instance mode is enabled
 */
export function isSingleInstanceMode() {
    return CONFIG.SINGLE_INSTANCE_MODE === true;
}

// ========================================
// BRANDING AND FAVICON FUNCTIONS
// ========================================

/**
 * Get instance branding information (name and icon)
 * This is fetched from the instance's /site API endpoint
 * @returns {Promise<Object>} Instance branding data with name and icon
 */
export async function getInstanceBranding() {
    if (!isSingleInstanceMode()) {
        // Return default branding for multi-instance mode
        return {
            name: 'Lemmeric',
            icon: '/assets/images/Lemmeric Logo - No BG.png',
            description: 'A modern Lemmy UI'
        };
    }

    try {
        // Import API dynamically to avoid circular dependencies
        const { LemmyAPI } = await import('./api.js');
        const api = new LemmyAPI();
        const siteInfo = await api.getSite();
        
        if (siteInfo && siteInfo.site_view && siteInfo.site_view.site) {
            const site = siteInfo.site_view.site;
            return {
                name: site.name || site.title || 'Lemmeric',
                icon: site.icon || '/assets/images/Lemmeric Logo - No BG.png',
                description: site.description || site.tagline || 'A modern Lemmy UI'
            };
        }
    } catch (error) {
        console.warn('Failed to fetch instance branding, using default:', error);
    }
    
    // Fallback to default branding
    return {
        name: 'Lemmeric',
        icon: '/assets/images/Lemmeric Logo - No BG.png',
        description: 'A modern Lemmy UI'
    };
}

/**
 * Set the favicon based on instance branding
 * Uses Lemmeric logo when in multi-instance mode or when instance has no icon
 * @param {string} iconUrl - URL of the icon to use as favicon
 */
export function setFavicon(iconUrl) {
    // Remove existing favicon links
    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach(link => link.remove());
    
    // Create new favicon link
    const faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    faviconLink.type = 'image/png';
    faviconLink.href = iconUrl;
    
    // Add to document head
    document.head.appendChild(faviconLink);
}

/**
 * Update favicon based on current instance branding
 * This should be called when instance branding changes
 */
export async function updateFaviconFromBranding() {
    try {
        const branding = await getInstanceBranding();
        
        // Only use the instance icon if it's not the default Lemmeric logo
        // This ensures we use the Lemmeric logo when appropriate
        if (branding.icon && !branding.icon.includes('Lemmeric Logo')) {
            setFavicon(branding.icon);
        } else {
            // Use Lemmeric logo as favicon
            setFavicon('/assets/images/Lemmeric Logo - No BG.png');
        }
    } catch (error) {
        console.warn('Failed to update favicon from branding:', error);
        // Fallback to Lemmeric logo
        setFavicon('/assets/images/Lemmeric Logo - No BG.png');
    }
}

// ========================================
// INSTANCE STATE FUNCTIONS
// ========================================

/**
 * Get the current instance from storage or default
 * @returns {string} Instance name
 */
export function getCurrentInstance() {
    // In single instance mode, always return the configured single instance
    if (isSingleInstanceMode()) {
        return CONFIG.SINGLE_INSTANCE_URL;
    }
    
    return localStorage.getItem(CONFIG.STORAGE_KEYS.INSTANCE) || CONFIG.DEFAULT_INSTANCE;
}

/**
 * Set the current instance
 * @param {string} instanceName - Name of the instance to set
 */
export function setCurrentInstance(instanceName) {
    // Prevent instance switching in single instance mode
    if (isSingleInstanceMode()) {
        console.warn('Instance switching is disabled in single instance mode');
        return false;
    }
    
    const allInstances = getAllInstances();
    if (allInstances[instanceName]) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.INSTANCE, instanceName);
        return true;
    }
    return false;
}

// ========================================
// THEME MANAGEMENT FUNCTIONS
// ========================================

/**
 * Get the current theme
 * @returns {string} Theme name
 */
export function getCurrentTheme() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 
           (window.matchMedia('(prefers-color-scheme: dark)').matches ? 
            CONFIG.THEMES.DARK : CONFIG.THEMES.LIGHT);
}

/**
 * Set the current theme
 * @param {string} theme - Theme to set
 */
export function setCurrentTheme(theme) {
    if (Object.values(CONFIG.THEMES).includes(theme)) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, theme);
        document.documentElement.setAttribute('data-theme', theme);
        return true;
    }
    return false;
}

/**
 * Get the large images setting
 * @returns {boolean} Whether large images is enabled
 */
export function getLargeImagesSetting() {
    const settings = localStorage.getItem('lemmeric-settings');
    if (settings) {
        try {
            const parsed = JSON.parse(settings);
            return parsed.appearance?.largeImages || false;
        } catch (e) {
            return false;
        }
    }
    return false;
}

/**
 * Set the large images setting
 * @param {boolean} enabled - Whether to enable large images
 */
export function setLargeImagesSetting(enabled) {
    const settings = localStorage.getItem('lemmeric-settings');
    let parsed = {};
    
    if (settings) {
        try {
            parsed = JSON.parse(settings);
        } catch (e) {
            // If parsing fails, start with empty object
        }
    }
    
    if (!parsed.appearance) {
        parsed.appearance = {};
    }
    
    parsed.appearance.largeImages = enabled;
    localStorage.setItem('lemmeric-settings', JSON.stringify(parsed));
    
    // Apply the setting immediately
    if (enabled) {
        document.body.classList.add('large-images-enabled');
    } else {
        document.body.classList.remove('large-images-enabled');
    }
}

/**
 * Get the thumbnail display setting
 * @returns {string} Thumbnail display mode: 'small', 'match-media', or 'none'
 */
export function getThumbnailDisplaySetting() {
    const settings = localStorage.getItem('lemmeric-settings');
    if (settings) {
        try {
            const parsed = JSON.parse(settings);
            return parsed.appearance?.thumbnailDisplay || 'small';
        } catch (e) {
            return 'small';
        }
    }
    return 'small';
}

/**
 * Set the thumbnail display setting
 * @param {string} mode - Thumbnail display mode: 'small', 'match-media', or 'none'
 */
export function setThumbnailDisplaySetting(mode) {
    const validModes = ['small', 'match-media', 'none'];
    if (!validModes.includes(mode)) {
        console.warn('Invalid thumbnail display mode:', mode);
        return;
    }

    const settings = localStorage.getItem('lemmeric-settings');
    let parsed = {};
    
    if (settings) {
        try {
            parsed = JSON.parse(settings);
        } catch (e) {
            // If parsing fails, start with empty object
        }
    }
    
    if (!parsed.appearance) {
        parsed.appearance = {};
    }
    
    parsed.appearance.thumbnailDisplay = mode;
    localStorage.setItem('lemmeric-settings', JSON.stringify(parsed));
    
    // Apply the setting immediately
    applyThumbnailDisplaySetting(mode);
}

/**
 * Apply thumbnail display setting to the document
 * @param {string} mode - Thumbnail display mode
 */
export function applyThumbnailDisplaySetting(mode) {
    // Remove existing classes
    document.body.classList.remove('thumbnail-display-small', 'thumbnail-display-match-media', 'thumbnail-display-none');
    
    // Add the appropriate class
    document.body.classList.add(`thumbnail-display-${mode}`);
}

/**
 * Get the current sort option
 * @returns {string} Sort option
 */
export function getCurrentSort() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.SORT) || CONFIG.DEFAULT_SORT;
}

/**
 * Set the current sort option
 * @param {string} sort - Sort option to set
 */
export function setCurrentSort(sort) {
    const validSorts = CONFIG.SORT_OPTIONS.map(option => option.value);
    if (validSorts.includes(sort)) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.SORT, sort);
        return true;
    }
    return false;
}

/**
 * Get the current listing type
 * @returns {string} Listing type
 */
export function getCurrentListingType() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.LISTING_TYPE) || CONFIG.DEFAULT_TYPE;
}

/**
 * Set the current listing type
 * @param {string} listingType - Listing type to set
 */
export function setCurrentListingType(listingType) {
    const validTypes = CONFIG.LISTING_TYPES.map(option => option.value);
    if (validTypes.includes(listingType)) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.LISTING_TYPE, listingType);
        return true;
    }
    return false;
}

// ========================================
// CUSTOM INSTANCE MANAGEMENT FUNCTIONS
// ========================================

/**
 * Get custom instances from local storage
 * @returns {Object} Custom instances object
 */
export function getCustomInstances() {
    try {
        const customInstances = localStorage.getItem(CONFIG.STORAGE_KEYS.CUSTOM_INSTANCES);
        return customInstances ? JSON.parse(customInstances) : {};
    } catch (error) {
        console.error('Failed to parse custom instances:', error);
        return {};
    }
}

/**
 * Add a custom instance
 * @param {string} key - Instance key (domain)
 * @param {Object} instanceConfig - Instance configuration
 * @returns {boolean} Success status
 */
export function addCustomInstance(key, instanceConfig) {
    try {
        const customInstances = getCustomInstances();
        customInstances[key] = {
            ...instanceConfig,
            isCustom: true
        };
        localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_INSTANCES, JSON.stringify(customInstances));
        return true;
    } catch (error) {
        console.error('Failed to add custom instance:', error);
        return false;
    }
}

/**
 * Remove a custom instance
 * @param {string} key - Instance key to remove
 * @returns {boolean} Success status
 */
export function removeCustomInstance(key) {
    try {
        const customInstances = getCustomInstances();
        delete customInstances[key];
        localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_INSTANCES, JSON.stringify(customInstances));
        return true;
    } catch (error) {
        console.error('Failed to remove custom instance:', error);
        return false;
    }
}

/**
 * Get all instances (built-in + custom)
 * @returns {Object} All instances
 */
export function getAllInstances() {
    return {
        ...CONFIG.INSTANCES,
        ...getCustomInstances()
    };
}

/**
 * Validate instance URL and extract domain
 * @param {string} url - Instance URL
 * @returns {Object} Validation result with domain and normalized URL
 */
export function validateInstanceUrl(url) {
    try {
        // Ensure URL has protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const normalizedUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
        
        return {
            isValid: true,
            domain,
            normalizedUrl,
            apiUrl: `${normalizedUrl}/api/v3`
        };
    } catch (error) {
        return {
            isValid: false,
            error: 'Invalid URL format'
        };
    }
}

// ========================================
// AUTHENTICATION FUNCTIONS
// ========================================

/**
 * Get the current authentication token for an instance
 * @param {string} instanceName - Name of the instance
 * @returns {string|null} JWT token or null if not authenticated
 */
export function getAuthToken(instanceName = null) {
    const instance = instanceName || getCurrentInstance();
    const tokens = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN) || '{}');
    const token = tokens[instance] || null;
    
    return token;
}

/**
 * Set the authentication token for an instance
 * @param {string} token - JWT token
 * @param {string} instanceName - Name of the instance
 */
export function setAuthToken(token, instanceName = null) {
    const instance = instanceName || getCurrentInstance();
    const tokens = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN) || '{}');
    tokens[instance] = token;
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, JSON.stringify(tokens));
}

/**
 * Remove authentication token for an instance
 * @param {string} instanceName - Name of the instance
 */
export function removeAuthToken(instanceName = null) {
    const instance = instanceName || getCurrentInstance();
    const tokens = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN) || '{}');
    delete tokens[instance];
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, JSON.stringify(tokens));
}

/**
 * Get user data for the current instance
 * @param {string} instanceName - Name of the instance
 * @returns {Object|null} User data or null if not authenticated
 */
export function getUserData(instanceName = null) {
    const instance = instanceName || getCurrentInstance();
    const userData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA) || '{}');
    return userData[instance] || null;
}

/**
 * Set user data for an instance
 * @param {Object} data - User data
 * @param {string} instanceName - Name of the instance
 */
export function setUserData(data, instanceName = null) {
    const instance = instanceName || getCurrentInstance();
    const userData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA) || '{}');
    userData[instance] = data;
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
}

/**
 * Remove user data for an instance
 * @param {string} instanceName - Name of the instance
 */
export function removeUserData(instanceName = null) {
    const instance = instanceName || getCurrentInstance();
    const userData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA) || '{}');
    delete userData[instance];
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
}

/**
 * Check if user is authenticated for an instance
 * @param {string} instanceName - Name of the instance
 * @returns {boolean} True if authenticated
 */
export function isAuthenticated(instanceName = null) {
    return getAuthToken(instanceName) !== null;
}

// ========================================
// MIGRATION AND INITIALIZATION FUNCTIONS
// ========================================

// Migration function to handle old localStorage keys
function migrateOldLocalStorageKeys() {
    try {
        // Migrate old instance key
        const oldInstance = localStorage.getItem('selectedInstance');
        if (oldInstance && !localStorage.getItem(CONFIG.STORAGE_KEYS.INSTANCE)) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.INSTANCE, oldInstance);
            localStorage.removeItem('selectedInstance');
            console.log('Migrated instance setting from old key');
        }

        // Migrate old theme key
        const oldTheme = localStorage.getItem('theme');
        if (oldTheme && !localStorage.getItem(CONFIG.STORAGE_KEYS.THEME)) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, oldTheme);
            localStorage.removeItem('theme');
            console.log('Migrated theme setting from old key');
        }

        // Migrate old custom instances key
        const oldCustomInstances = localStorage.getItem('customInstances');
        if (oldCustomInstances && !localStorage.getItem(CONFIG.STORAGE_KEYS.CUSTOM_INSTANCES)) {
            try {
                const customInstancesArray = JSON.parse(oldCustomInstances);
                const customInstancesObject = {};
                
                // Convert array format to object format
                customInstancesArray.forEach(instance => {
                    const key = instance.url ? instance.url.replace(/https?:\/\//, '').replace(/\//g, '') : 
                               instance.name?.replace(/\s+/g, '').toLowerCase();
                    customInstancesObject[key] = {
                        name: instance.name || instance.url,
                        url: instance.url,
                        api: `${instance.url}/api/v3`,
                        description: instance.description || 'Custom instance',
                        isCustom: true
                    };
                });
                
                localStorage.setItem(CONFIG.STORAGE_KEYS.CUSTOM_INSTANCES, JSON.stringify(customInstancesObject));
                localStorage.removeItem('customInstances');
                console.log('Migrated custom instances from old format');
            } catch (error) {
                console.warn('Failed to migrate custom instances:', error);
            }
        }
    } catch (error) {
        console.error('Error during localStorage migration:', error);
    }
}

// Initialize theme and migrate old settings on load
document.addEventListener('DOMContentLoaded', () => {
    migrateOldLocalStorageKeys();
    setCurrentTheme(getCurrentTheme());
    
    // Apply large images setting
    const largeImagesEnabled = getLargeImagesSetting();
    if (largeImagesEnabled) {
        document.body.classList.add('large-images-enabled');
    }
    
    // Apply thumbnail display setting
    const thumbnailDisplayMode = getThumbnailDisplaySetting();
    applyThumbnailDisplaySetting(thumbnailDisplayMode);
    
    // Update favicon based on instance branding
    updateFaviconFromBranding();
});