/**
 * Navbar Component
 * 
 * This module handles all navbar functionality including:
 * - Navigation and routing
 * - Theme toggle and management
 * - Instance selection and switching
 * - Authentication state display
 * - Mobile responsive behavior
 * 
 * @fileoverview Main navigation component for Lemmeric
 */

// Core configuration and utilities
import { 
    getAllInstances, 
    getCurrentInstance, 
    setCurrentInstance, 
    getCurrentTheme, 
    setCurrentTheme,
    addCustomInstance,
    isSingleInstanceMode,
    getInstanceBranding,
    updateFaviconFromBranding
} from '../config.js';
import { authManager } from '../auth.js';

/**
 * Navbar component class
 * 
 * Manages all navigation functionality including theme, instance selection, and authentication
 */
class Navbar {
    /**
     * Initialize the navbar component
     * @param {boolean} skipHTMLLoad - Whether to skip loading HTML content
     */
    constructor(skipHTMLLoad = false) {
        // Core component state
        this.elements = {};
        this.currentPage = null;
        this.authStatus = { isAuthenticated: false, user: null };
        this.skipHTMLLoad = skipHTMLLoad;
        
        // Only auto-init if HTML load is not skipped (normal case)
        if (!skipHTMLLoad) {
            this.init();
        }
    }

    // ========================================
    // INITIALIZATION METHODS
    // ========================================

    /**
     * Initialize the navbar
     * @async
     */
    async init() {
        try {
            // Only load HTML if not skipped (for cases where HTML is already loaded)
            if (!this.skipHTMLLoad) {
                await this.loadNavbarHTML();
            }
            
            this.bindElements();
            this.setupEventListeners();
            this.setupAuthListeners();
            this.loadTheme();
            this.updateNavigation();
            
            // Update navbar branding if in single instance mode
            if (isSingleInstanceMode()) {
                await this.updateNavbarBranding();
            }
            
            // Try to load existing user session before updating auth UI
            await authManager.loadCurrentUser();
            
            // Get the current user and update auth status
            const currentUser = authManager.getCurrentUser();
            if (currentUser) {
                this.authStatus = { isAuthenticated: true, user: currentUser };
            }
            
            // Update auth UI after user session is loaded
            this.updateAuthUI();
        } catch (error) {
            console.error('Failed to initialize navbar:', error);
        }
    }

    /**
     * Load navbar HTML from component file
     */
    async loadNavbarHTML() {
        try {
            const response = await fetch('/components/navbar.html');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const navbarHTML = await response.text();
            
            // Insert navbar at the beginning of body
            document.body.insertAdjacentHTML('afterbegin', navbarHTML);
        } catch (error) {
            console.error('Failed to load navbar component:', error);
            throw error;
        }
    }

    /**
     * Bind DOM elements
     */
    bindElements() {
        this.elements = {
            navHome: document.getElementById('nav-home'),
            navCommunities: document.getElementById('nav-communities'),
            searchForm: document.getElementById('search-form'),
            searchInput: document.getElementById('search-input'),
            searchBtn: document.getElementById('search-btn'),
            signInBtn: document.getElementById('sign-in-btn'),
            guestSettingsBtn: document.getElementById('guest-settings-btn'),
            createBtn: document.getElementById('create-btn'),
            siteTitle: document.getElementById('site-title')
        };
    }

    /**
     * Update navbar branding with instance-specific information
     * This is called when in single instance mode
     */
    async updateNavbarBranding() {
        try {
            const branding = await getInstanceBranding();
            
            if (this.elements.siteTitle) {
                // Update the logo
                const logoImg = this.elements.siteTitle.querySelector('img');
                if (logoImg && branding.icon) {
                    logoImg.src = branding.icon;
                    logoImg.alt = `${branding.name} Logo`;
                }
                
                // Find and replace the "Lemmeric" text with the instance name
                const textNodes = Array.from(this.elements.siteTitle.childNodes);
                const textNode = textNodes.find(node => 
                    node.nodeType === Node.TEXT_NODE && 
                    node.textContent.trim() === 'Lemmeric'
                );
                
                if (textNode) {
                    textNode.textContent = branding.name;
                } else {
                    // Fallback: find any text node and replace it
                    const anyTextNode = textNodes.find(node => node.nodeType === Node.TEXT_NODE);
                    if (anyTextNode) {
                        anyTextNode.textContent = branding.name;
                    }
                }
                
                // Update the favicon using centralized favicon management
                // This will use the instance icon if available, otherwise fall back to Lemmeric logo
                updateFaviconFromBranding();
                
                // Update the page title with instance name and description
                if (branding.name && branding.description) {
                    document.title = `${branding.name} | ${branding.description}`;
                } else if (branding.name) {
                    document.title = branding.name;
                }
            }
        } catch (error) {
            console.error('Failed to update navbar branding:', error);
        }
    }

    /**
     * Update the favicon with the instance icon
     * @param {string} iconUrl - URL of the icon to use as favicon
     */
    updateFavicon(iconUrl) {
        try {
            // Remove existing favicon links
            const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
            existingFavicons.forEach(link => link.remove());
            
            // Create new favicon link
            const faviconLink = document.createElement('link');
            faviconLink.rel = 'icon';
            faviconLink.type = this.getImageMimeType(iconUrl);
            faviconLink.href = iconUrl;
            
            // Add to document head
            document.head.appendChild(faviconLink);
            
            // Also update apple-touch-icon for mobile devices
            const appleTouchIcon = document.createElement('link');
            appleTouchIcon.rel = 'apple-touch-icon';
            appleTouchIcon.href = iconUrl;
            document.head.appendChild(appleTouchIcon);
            
            console.log('Favicon updated to:', iconUrl);
        } catch (error) {
            console.error('Failed to update favicon:', error);
        }
    }

    /**
     * Determine the MIME type for an image URL
     * @param {string} url - Image URL
     * @returns {string} MIME type
     */
    getImageMimeType(url) {
        const extension = url.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'png':
                return 'image/png';
            case 'jpg':
            case 'jpeg':
                return 'image/jpeg';
            case 'gif':
                return 'image/gif';
            case 'svg':
                return 'image/svg+xml';
            case 'ico':
                return 'image/x-icon';
            case 'webp':
                return 'image/webp';
            default:
                return 'image/png'; // Default fallback
        }
    }

    // ========================================
    // EVENT HANDLING METHODS
    // ========================================

    /**
     * Setup event listeners for the navbar
     */
    setupEventListeners() {
        // Navigation links
        if (this.elements.navHome) {
            this.elements.navHome.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToHome();
            });
        }

        // Search form
        if (this.elements.searchForm) {
            this.elements.searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSearch();
            });
        }

        if (this.elements.navCommunities) {
            this.elements.navCommunities.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToCommunities();
            });
        }

        // Sign in button
        if (this.elements.signInBtn) {
            this.elements.signInBtn.addEventListener('click', () => {
                this.showSignInModal();
            });
        }

        // Guest settings button
        if (this.elements.guestSettingsBtn) {
            this.elements.guestSettingsBtn.addEventListener('click', () => {
                this.navigateToSettings();
            });
        }

        // Create button
        if (this.elements.createBtn) {
            this.elements.createBtn.addEventListener('click', () => {
                this.navigateToCreatePost();
            });
        }

        // Voyager link
        const voyagerLink = document.getElementById('voyager-link');
        if (voyagerLink) {
            voyagerLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openVoyagerApp();
            });
        }

        // Mobile menu toggle listener for Voyager suggestion
        this.setupMobileMenuListener();

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }

        // User profile button
        const userProfileBtn = document.getElementById('user-profile-link');
        if (userProfileBtn) {
            userProfileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToUserProfile();
            });
        }

        // User settings button
        const userSettingsBtn = document.getElementById('user-settings-link');
        if (userSettingsBtn) {
            userSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToSettings();
            });
        }

        // Notifications button
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToNotifications();
            });
        }

        // Admin notifications button
        const adminNotificationsBtn = document.getElementById('admin-notifications-btn');
        if (adminNotificationsBtn) {
            adminNotificationsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateToNotifications();
            });
        }

        // Modal switching functionality
        this.setupModalEventListeners();
    }

    /**
     * Navigate to home/feed page
     */
    navigateToHome() {
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
            // Already on home page, just reload the feed
            if (window.lemmericApp && window.lemmericApp.loadPosts) {
                window.lemmericApp.loadPosts();
            }
        } else {
            window.location.href = '/';
        }
    }

    /**
     * Handle search form submission
     */
    handleSearch() {
        const query = this.elements.searchInput.value.trim();
        if (!query) return;

        // Check if we're already on the search page
        if (window.location.pathname === '/search' || window.location.pathname === '/search.html') {
            // Emit event for search page to handle
            window.dispatchEvent(new CustomEvent('navbar:search', { detail: { query } }));
        } else {
            // Navigate to search page with query
            const searchUrl = `/search?q=${encodeURIComponent(query)}`;
            window.location.href = searchUrl;
        }
    }

    /**
     * Navigate to communities page
     */
    navigateToCommunities() {
        window.location.href = '/communities';
    }

    /**
     * Navigate to create post page
     */
    navigateToCreatePost() {
        // Check if we're on a community page and can get community context
        const communityData = this.getCurrentCommunityData();
        
        if (communityData) {
            const params = new URLSearchParams();
            params.set('community_id', communityData.id);
            params.set('community_name', communityData.name);
            window.location.href = `/create-post?${params.toString()}`;
        } else {
            window.location.href = '/create-post';
        }
    }

    /**
     * Get current community data if we're on a community page
     */
    getCurrentCommunityData() {
        // Check if we're on a community page
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        
        // If we have community data from the global community app
        if (window.lemmericCommunityApp && window.lemmericCommunityApp.communityData) {
            const community = window.lemmericCommunityApp.communityData.community;
            
            let communityName;
            if (community.local) {
                communityName = community.name;
            } else {
                // For remote communities, use name@instance format
                try {
                    const actorUrl = new URL(community.actor_id);
                    const instance = actorUrl.hostname;
                    communityName = `${community.name}@${instance}`;
                } catch (error) {
                    communityName = community.name;
                }
            }
            
            return {
                id: community.id,
                name: communityName
            };
        }
        
        // Fallback: try to extract from URL (but we won't have ID in this case)
        if (path.includes('/c/')) {
            // From dev server rewrite
            const nameParam = params.get('name');
            if (nameParam) {
                return {
                    id: null,
                    name: decodeURIComponent(nameParam)
                };
            }
            
            // From production URL path
            const match = path.match(/^\/c\/([^\/]+)\/?$/);
            if (match) {
                return {
                    id: null,
                    name: decodeURIComponent(match[1])
                };
            }
        }
        
        return null;
    }

    /**
     * Navigate to user profile page
     */
    navigateToUserProfile() {
        const user = authManager.getCurrentUser();
        if (user && user.name) {
            // Navigate to user profile page using the /u/ path pattern
            window.location.href = `/u/${user.name}`;
        } else {
            console.error('Cannot navigate to profile: User not authenticated or user data missing');
        }
    }

    /**
     * Navigate to settings page
     */
    navigateToSettings() {
        window.location.href = '/settings';
    }

    /**
     * Navigate to inbox page
     */
    navigateToNotifications() {
        window.location.href = '/inbox';
    }



    // ========================================
    // THEME MANAGEMENT METHODS
    // ========================================

    /**
     * Load and apply saved theme
     */
    loadTheme() {
        try {
            const savedTheme = getCurrentTheme();
            document.documentElement.setAttribute('data-theme', savedTheme);
        } catch (error) {
            console.error('Error loading theme:', error);
            // Fallback
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }



    /**
     * Update navigation state based on current page
     */
    updateNavigation() {
        // Remove active class from all nav links
        Object.values(this.elements).forEach(element => {
            if (element && element.classList) {
                element.classList.remove('active');
            }
        });

        // Determine current page and set active state
        const path = window.location.pathname;
        
        if (path === '/' || path === '/index.html' || path.includes('index')) {
            this.elements.navHome?.classList.add('active');
            this.currentPage = 'home';
        } else if (path.includes('communities')) {
            this.elements.navCommunities?.classList.add('active');
            this.currentPage = 'communities';
        } else if (path.includes('community')) {
            this.elements.navCommunities?.classList.add('active');
            this.currentPage = 'community';
        } else if (path.includes('user')) {
            // No specific nav item for user pages, but could be added
            this.currentPage = 'user';
        } else if (path.includes('post')) {
            // No specific nav item for post pages, but could be added
            this.currentPage = 'post';
        }
    }



    /**
     * Set active navigation item
     */
    setActiveNav(navItem) {
        // Remove active from all
        Object.values(this.elements).forEach(element => {
            if (element && element.classList) {
                element.classList.remove('active');
            }
        });

        // Set active
        if (this.elements[navItem]) {
            this.elements[navItem].classList.add('active');
        }
    }

    /**
     * Show sign in modal
     */
    showSignInModal() {
        const modal = document.getElementById('signInModal');
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    }

    /**
     * Show register modal
     */
    showRegisterModal() {
        const modal = document.getElementById('registerModal');
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    }

    /**
     * Setup modal event listeners for switching between sign in and register
     */
    setupModalEventListeners() {
        // Show register modal from sign in modal
        const showRegisterLink = document.getElementById('show-register');
        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Hide sign in modal
                const signInModal = bootstrap.Modal.getInstance(document.getElementById('signInModal'));
                if (signInModal) {
                    signInModal.hide();
                }
                // Show register modal
                setTimeout(() => this.showRegisterModal(), 300);
            });
        }

        // Show sign in modal from register modal
        const showSignInLink = document.getElementById('show-sign-in');
        if (showSignInLink) {
            showSignInLink.addEventListener('click', (e) => {
                e.preventDefault();
                // Hide register modal
                const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
                if (registerModal) {
                    registerModal.hide();
                }
                // Show sign in modal
                setTimeout(() => this.showSignInModal(), 300);
            });
        }

        // Password toggle functionality
        this.setupPasswordToggle('toggle-password', 'password');
        this.setupPasswordToggle('toggle-reg-password', 'reg-password');

        // Form submission handlers
        const signInSubmit = document.getElementById('sign-in-submit');
        if (signInSubmit) {
            signInSubmit.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSignIn();
            });
        }

        const registerSubmit = document.getElementById('register-submit');
        if (registerSubmit) {
            registerSubmit.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }
    }

    /**
     * Setup authentication event listeners
     */
    setupAuthListeners() {
        // Listen for authentication changes
        authManager.addListener((event, data) => {
            this.handleAuthChange(event, data);
        });
        
        // Handle instance switches
        authManager.addListener((event, data) => {
            if (event === 'instanceSwitch') {
                this.authStatus = data.authStatus;
                this.updateAuthUI();
            }
        });
    }

    /**
     * Handle authentication state changes
     */
    handleAuthChange(event, data) {
        switch (event) {
            case 'login':
                this.authStatus = { isAuthenticated: true, user: data };
                this.updateAuthUI();
                this.hideSignInModal();
                this.showToast('Login successful!', 'success');
                break;
            case 'logout':
                this.authStatus = { isAuthenticated: false, user: null };
                this.stopNotificationRefresh();
                this.updateAuthUI();
                this.showToast('Logged out successfully', 'info');
                break;
            case 'userLoaded':
                this.authStatus = { isAuthenticated: true, user: data };
                this.updateAuthUI();
                break;
            case 'userUpdate':
                this.authStatus = { isAuthenticated: true, user: data };
                this.updateAuthUI();
                break;
        }
    }

    /**
     * Update UI based on authentication status
     */
    updateAuthUI() {
        const signInBtn = document.getElementById('sign-in-btn');
        const guestSettingsBtn = document.getElementById('guest-settings-btn');
        const createBtn = document.getElementById('create-btn');
        const notificationsBtn = document.getElementById('notifications-btn');
        const adminNotificationsBtn = document.getElementById('admin-notifications-btn');
        const userMenu = document.getElementById('user-menu');
        
        if (this.authStatus.isAuthenticated && this.authStatus.user) {
            // User is logged in - show user menu, create button, and notifications, hide guest buttons
            if (signInBtn) signInBtn.style.display = 'none';
            if (guestSettingsBtn) guestSettingsBtn.style.display = 'none';
            if (createBtn) createBtn.style.display = 'block';
            if (notificationsBtn) notificationsBtn.style.display = 'block';
            if (userMenu) {
                userMenu.style.display = 'block';
                this.updateUserMenu(this.authStatus.user);
            }
            
            // Check if user is admin and show admin notifications accordingly
            this.checkAdminStatus();
        } else {
            // User is not logged in - show sign in button and guest settings, hide create button and notifications
            if (signInBtn) signInBtn.style.display = 'block';
            if (guestSettingsBtn) guestSettingsBtn.style.display = 'block';
            if (createBtn) createBtn.style.display = 'none';
            if (notificationsBtn) notificationsBtn.style.display = 'none';
            if (adminNotificationsBtn) adminNotificationsBtn.style.display = 'none';
            if (userMenu) userMenu.style.display = 'none';
        }
    }

    /**
     * Refresh authentication state from storage
     */
    async refreshAuthState() {
        try {
            // Try to load existing user session
            await authManager.loadCurrentUser();
            
            // Get the current user and update auth status
            const currentUser = authManager.getCurrentUser();
            if (currentUser) {
                this.authStatus = { isAuthenticated: true, user: currentUser };
            } else {
                this.authStatus = { isAuthenticated: false, user: null };
            }
            
            // Update auth UI after refreshing state
            this.updateAuthUI();
        } catch (error) {
            console.error('Failed to refresh auth state:', error);
            this.authStatus = { isAuthenticated: false, user: null };
            this.updateAuthUI();
        }
    }

    /**
     * Update user menu with user data
     */
    updateUserMenu(user) {
        const userAvatar = document.getElementById('user-avatar');
        const defaultAvatar = document.getElementById('default-avatar');
        const userName = document.getElementById('user-name');
        
        if (userAvatar && defaultAvatar) {
            if (user.avatar) {
                userAvatar.src = user.avatar;
                userAvatar.style.display = 'block';
                defaultAvatar.style.display = 'none';
            } else {
                userAvatar.style.display = 'none';
                defaultAvatar.style.display = 'block';
            }
        }
        
        if (userName) {
            userName.textContent = user.displayName || user.name;
        }

        // Load real notification counts
        this.loadNotificationCounts();
        
        // Set up periodic refresh of notification counts (every 30 seconds)
        this.startNotificationRefresh();
    }

    /**
     * Update notification display
     */
    updateNotifications(count) {
        const notificationIcon = document.getElementById('notification-icon');
        const notificationCount = document.getElementById('notification-count');
        
        if (notificationIcon && notificationCount) {
            notificationCount.textContent = count.toString();
            
            if (count > 0) {
                // Has notifications - use filled bell
                notificationIcon.className = 'bi bi-bell-fill me-1';
            } else {
                // No notifications - use outline bell
                notificationIcon.className = 'bi bi-bell me-1';
            }
        }
    }

    /**
     * Update admin notification display
     */
    updateAdminNotifications(count) {
        const adminNotificationIcon = document.getElementById('admin-notification-icon');
        const adminNotificationCount = document.getElementById('admin-notification-count');
        
        if (adminNotificationIcon && adminNotificationCount) {
            adminNotificationCount.textContent = count.toString();
            
            if (count > 0) {
                // Has admin notifications - use filled shield
                adminNotificationIcon.className = 'bi bi-shield-fill me-1';
            } else {
                // No admin notifications - use outline shield
                adminNotificationIcon.className = 'bi bi-shield me-1';
            }
        }
    }

    /**
     * Load notification counts from API
     */
    async loadNotificationCounts() {
        try {
            const api = authManager.api;
            const unreadCounts = await api.getUnreadCounts();
            
            if (unreadCounts) {
                // Calculate total notification count (replies + mentions + private_messages)
                const totalNotifications = (unreadCounts.replies || 0) + (unreadCounts.mentions || 0) + (unreadCounts.private_messages || 0);
                
                // Update notification display
                this.updateNotifications(totalNotifications);
            }
            
            // Load admin notifications if user is admin
            await this.loadAdminNotificationCounts();
            
        } catch (error) {
            console.error('Error loading notification counts:', error);
            // Fallback to 0 counts on error
            this.updateNotifications(0);
            this.updateAdminNotifications(0);
        }
    }

    /**
     * Load admin notification counts from API
     */
    async loadAdminNotificationCounts() {
        const adminNotificationsBtn = document.getElementById('admin-notifications-btn');
        
        // Only load if admin button is visible (user is admin)
        if (!adminNotificationsBtn || adminNotificationsBtn.style.display === 'none') {
            return;
        }

        try {
            const api = authManager.api;
            
            // Fetch unresolved reports and pending applications in parallel
            const [postReportsResponse, commentReportsResponse, messageReportsResponse, applicationsResponse] = await Promise.all([
                api.listPostReports({ unresolved_only: true, limit: 50, page: 1 }),
                api.listCommentReports({ unresolved_only: true, limit: 50, page: 1 }),
                api.listPrivateMessageReports({ unresolved_only: true, limit: 50, page: 1 }),
                api.listRegistrationApplications({ unread_only: false, limit: 50, page: 1 })
            ]);

            let unresolvedReportsCount = 0;
            let pendingApplicationsCount = 0;

            // Count unresolved post reports (already filtered by unresolved_only: true)
            if (postReportsResponse && postReportsResponse.post_reports) {
                unresolvedReportsCount += postReportsResponse.post_reports.length;
            }

            // Count unresolved comment reports (already filtered by unresolved_only: true)
            if (commentReportsResponse && commentReportsResponse.comment_reports) {
                unresolvedReportsCount += commentReportsResponse.comment_reports.length;
            }

            // Count unresolved message reports (already filtered by unresolved_only: true)
            if (messageReportsResponse && messageReportsResponse.private_message_reports) {
                unresolvedReportsCount += messageReportsResponse.private_message_reports.length;
            }

            // Count pending applications
            if (applicationsResponse && applicationsResponse.registration_applications) {
                pendingApplicationsCount = applicationsResponse.registration_applications.filter(app => {
                    const application = app.registration_application || {};
                    return !application.admin_id; // No admin has processed it yet
                }).length;
            }

            const totalAdminCount = unresolvedReportsCount + pendingApplicationsCount;
            this.updateAdminNotifications(totalAdminCount);

        } catch (error) {
            console.error('Error loading admin notification counts:', error);
            this.updateAdminNotifications(0);
        }
    }

    /**
     * Start periodic refresh of notification counts
     */
    startNotificationRefresh() {
        // Clear any existing interval
        if (this.notificationRefreshInterval) {
            clearInterval(this.notificationRefreshInterval);
        }
        
        // Only start if user is authenticated
        if (this.authStatus.isAuthenticated) {
            this.notificationRefreshInterval = setInterval(() => {
                this.loadNotificationCounts();
            }, 30000); // Refresh every 30 seconds
        }
    }

    /**
     * Stop notification refresh
     */
    stopNotificationRefresh() {
        if (this.notificationRefreshInterval) {
            clearInterval(this.notificationRefreshInterval);
            this.notificationRefreshInterval = null;
        }
    }

    /**
     * Public method to refresh notification counts (can be called from other pages)
     */
    refreshNotificationCounts() {
        if (this.authStatus.isAuthenticated) {
            this.loadNotificationCounts();
        }
    }

    /**
     * Check if user is admin and show/hide admin notifications
     */
    async checkAdminStatus() {
        const adminNotificationsBtn = document.getElementById('admin-notifications-btn');
        
        if (!adminNotificationsBtn) return;
        
        try {
            // Get site data to check if user is admin
            const api = authManager.api;
            const siteResponse = await api.getSite();
            
            if (siteResponse && siteResponse.my_user && siteResponse.admins) {
                const currentUserId = siteResponse.my_user.local_user_view.person.id;
                const isAdmin = siteResponse.admins.some(admin => admin.person.id === currentUserId);
                
                if (isAdmin) {
                    adminNotificationsBtn.style.display = 'block';
                    // Load real notification counts will handle admin notifications
                } else {
                    adminNotificationsBtn.style.display = 'none';
                }
            } else {
                adminNotificationsBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            adminNotificationsBtn.style.display = 'none';
        }
    }

    /**
     * Handle sign in form submission
     */
    async handleSignIn() {
        const username = document.getElementById('username')?.value.trim();
        const password = document.getElementById('password')?.value;
        const rememberMe = document.getElementById('remember-me')?.checked || false;
        
        // Validate input
        if (!username || !password) {
            this.showToast('Please enter both username and password', 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = document.getElementById('sign-in-submit');
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Signing In...';
        }
        
        try {
            // Attempt login
            const result = await authManager.login(username, password, rememberMe);
            
            if (result.success) {
                // Clear form
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
                document.getElementById('remember-me').checked = false;
            } else {
                this.showToast(result.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Login failed. Please try again.', 'error');
        } finally {
            // Restore button state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    /**
     * Handle register form submission
     */
    async handleRegister() {
        // Get form values
        const username = document.getElementById('reg-username')?.value.trim();
        const email = document.getElementById('reg-email')?.value.trim();
        const password = document.getElementById('reg-password')?.value;
        const confirmPassword = document.getElementById('reg-confirm-password')?.value;
        
        // Validate input
        if (!username || !email || !password || !confirmPassword) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showToast('Passwords do not match', 'error');
            return;
        }
        
        if (password.length < 8) {
            this.showToast('Password must be at least 8 characters long', 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = document.getElementById('register-submit');
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Creating Account...';
        }
        
        try {
            // Attempt registration
            const api = authManager.api;
            const result = await api.register(username, password, confirmPassword, email, false);
            
            if (result.jwt) {
                // Registration successful with immediate login
                const loginResult = await authManager.login(username, password, false);
                if (loginResult.success) {
                    this.showToast('Account created and logged in successfully!', 'success');
                    this.hideRegisterModal();
                    
                    // Clear form
                    document.getElementById('reg-username').value = '';
                    document.getElementById('reg-email').value = '';
                    document.getElementById('reg-password').value = '';
                    document.getElementById('reg-confirm-password').value = '';
                } else {
                    this.showToast('Account created! Please sign in.', 'success');
                    this.hideRegisterModal();
                    setTimeout(() => this.showSignInModal(), 300);
                }
            } else if (result.verify_email_sent) {
                this.showToast('Account created! Please check your email to verify your account.', 'success');
                this.hideRegisterModal();
                setTimeout(() => this.showSignInModal(), 300);
            } else {
                this.showToast('Account created! Please sign in.', 'success');
                this.hideRegisterModal();
                setTimeout(() => this.showSignInModal(), 300);
            }
        } catch (error) {
            console.error('Registration error:', error);
            let errorMessage = 'Registration failed. Please try again.';
            
            if (error.message.includes('email')) {
                errorMessage = 'Invalid email address or email already in use.';
            } else if (error.message.includes('username')) {
                errorMessage = 'Username already taken. Please choose another.';
            }
            
            this.showToast(errorMessage, 'error');
        } finally {
            // Restore button state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    /**
     * Handle logout
     */
    async handleLogout() {
        try {
            await authManager.logout();
        } catch (error) {
            console.error('Logout error:', error);
            this.showToast('Logout failed', 'error');
        }
    }

    /**
     * Hide sign in modal
     */
    hideSignInModal() {
        const modal = document.getElementById('signInModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) {
                bsModal.hide();
            }
        }
    }

    /**
     * Hide register modal
     */
    hideRegisterModal() {
        const modal = document.getElementById('registerModal');
        if (modal) {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) {
                bsModal.hide();
            }
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        // Create toast element if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '1055';
            document.body.appendChild(toastContainer);
        }
        
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remove toast element after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    /**
     * Setup password toggle functionality
     */
    setupPasswordToggle(toggleId, passwordId) {
        const toggleBtn = document.getElementById(toggleId);
        const passwordField = document.getElementById(passwordId);
        
        if (toggleBtn && passwordField) {
            toggleBtn.addEventListener('click', () => {
                const icon = toggleBtn.querySelector('i');
                if (passwordField.type === 'password') {
                    passwordField.type = 'text';
                    icon.className = 'bi bi-eye-slash';
                } else {
                    passwordField.type = 'password';
                    icon.className = 'bi bi-eye';
                }
            });
        }
    }

    /**
     * Open Voyager app in a new tab
     */
    openVoyagerApp() {
        const currentInstance = getCurrentInstance();
        
        if (currentInstance) {
            // Remove 'www.' prefix if present for cleaner URL
            const cleanInstance = currentInstance.replace(/^www\./, '');
            const voyagerUrl = `https://vger.app/posts/${cleanInstance}/local`;
            window.open(voyagerUrl, '_blank');
        } else {
            this.showToast('Could not determine current instance URL.', 'error');
        }
    }

    /**
     * Setup mobile menu listener for Voyager suggestion
     */
    setupMobileMenuListener() {
        const navbarCollapse = document.getElementById('navbarNav');
        const voyagerSuggestion = document.getElementById('voyager-suggestion');

        if (navbarCollapse && voyagerSuggestion) {
            // Listen for Bootstrap collapse events
            navbarCollapse.addEventListener('show.bs.collapse', () => {
                voyagerSuggestion.style.display = 'block';
                this.updateVoyagerInstanceName();
            });
            navbarCollapse.addEventListener('hide.bs.collapse', () => {
                voyagerSuggestion.style.display = 'none';
            });
            
            // Set initial state based on current collapse state
            if (navbarCollapse.classList.contains('show')) {
                voyagerSuggestion.style.display = 'block';
                this.updateVoyagerInstanceName();
            } else {
                voyagerSuggestion.style.display = 'none';
            }
        }
    }

    /**
     * Update the instance name in the Voyager suggestion
     */
    updateVoyagerInstanceName() {
        const instanceNameElement = document.getElementById('current-instance-name');
        if (instanceNameElement) {
            const currentInstance = getCurrentInstance();
            if (currentInstance) {
                // Remove 'www.' prefix and format nicely
                const cleanInstance = currentInstance.replace(/^www\./, '');
                instanceNameElement.textContent = cleanInstance;
            } else {
                instanceNameElement.textContent = 'your instance';
            }
        }
    }
}

// ========================================
// APPLICATION INITIALIZATION
// ========================================

// Export for ES module use
export { Navbar };

// Global initialization
window.Navbar = Navbar;

/**
 * Initialize the navbar component when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    window.navbar = new Navbar();
});