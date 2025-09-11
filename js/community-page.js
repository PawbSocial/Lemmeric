/**
 * Community page application file for Lemmeric
 * 
 * This module handles the community page functionality including:
 * - Community-specific post feeds
 * - Community sidebar with information and moderation tools
 * - Community editing and management
 * - Community subscription and interaction features
 * 
 * @fileoverview Community page controller and functionality
 */

// Core configuration and utilities
import { 
    CONFIG, 
    getCurrentInstance, 
    setCurrentInstance, 
    getCurrentSort, 
    setCurrentSort, 
    getCurrentTheme, 
    setCurrentTheme, 
    getAllInstances, 
    addCustomInstance, 
    validateInstanceUrl 
} from './config.js';
import { LemmyAPI, APIUtils } from './api.js';
import { DOM, PerformanceUtils } from './utils.js';
import { router } from './router.js';
import { authManager } from './auth.js';

// Components
import { PostListManager } from './components/post.js';
import { PostFeed } from './components/post-feed.js';
import { CommunitySidebarComponent } from './components/community-sidebar.js';
import { CommunityEditModal } from './components/community-edit-modal.js';

/**
 * Community page application class
 * 
 * Manages community-specific functionality including posts, sidebar, and moderation
 */
class LemmericCommunityApp {
    /**
     * Initialize the community page application
     */
    constructor() {
        // Core application state
        this.api = null;
        this.postFeed = null;
        this.communityName = null;
        this.communityData = null;
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMorePosts = true;
        this.editModal = null;
        this.currentUser = null;
        this.moderators = [];
        
        // Cache DOM elements for performance
        this.elements = {
            sortSelector: document.getElementById('sort-selector'),
            postsContainer: document.getElementById('posts-container'),
            communityTitle: document.getElementById('community-title'),
            communitySidebarContainer: document.getElementById('community-sidebar-container'),
            pagination: document.getElementById('pagination'),
            mobileCommunityInfo: document.getElementById('mobile-community-info')
        };
        
        // State
        this.state = {
            currentInstance: getCurrentInstance(),
            currentSort: getCurrentSort(),
            currentTheme: getCurrentTheme()
        };
        
        this.init();
    }

    // ========================================
    // INITIALIZATION METHODS
    // ========================================

    /**
     * Initialize the application
     * @async
     */
    async init() {
        try {
            this.cacheElements();
            this.setupEventListeners();
                    this.setupAPI();
        this.setupRouter();
        this.initializeUI();
        this.initializeEditModal();
            
            // Get community name from URL
            const newCommunityName = this.getCommunityNameFromURL();
            if (!newCommunityName) {
                this.showError('Invalid community URL');
                return;
            }
            
            // Check if we're loading a different community than before
            if (this.communityName !== newCommunityName) {
                this.communityName = newCommunityName;
                this.communityData = null; // Reset community data
            }
            
            // Load initial data
            await this.loadInitialData();
            
            console.log('Community page initialized successfully for:', this.communityName);
        } catch (error) {
            console.error('Failed to initialize community page:', error);
            this.showError('Failed to initialize community page');
        }
    }

    /**
     * Get community name from current URL
     * @returns {string|null} Community name or null if invalid
     */
    getCommunityNameFromURL() {
        // Check if we have a query parameter (from dev server rewrite)
        const urlParams = new URLSearchParams(window.location.search);
        const nameParam = urlParams.get('name');
        if (nameParam) {
            return decodeURIComponent(nameParam);
        }
        
        // Fallback: check URL path directly (for production)
        const path = window.location.pathname;
        const match = path.match(/^\/c\/([^\/]+)\/?$/);
        return match ? decodeURIComponent(match[1]) : null;
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        // Validate required elements (navbar elements now handled by navbar component)
        const requiredElements = ['sortSelector', 'postsContainer', 'communityTitle', 'communitySidebarContainer'];
        for (const elementName of requiredElements) {
            if (!this.elements[elementName]) {
                throw new Error(`Required element not found: ${elementName}`);
            }
        }
    }

    // ========================================
    // EVENT HANDLING METHODS
    // ========================================

    /**
     * Setup event listeners for the community page
     */
    setupEventListeners() {
        // Listen for instance changes from navbar component
        window.addEventListener('instanceChanged', (e) => {
            this.handleInstanceChange(e.detail.instance);
        });

        // Sort selector
        this.elements.sortSelector.addEventListener('change', (e) => {
            this.handleSortChange(e.target.value);
        });

        // Note: Create Post button is handled by the navbar component
        // The navbar will check for community context when the button is clicked

        // Infinite scrolling
        this.setupInfiniteScrolling();

        // Window events
        window.addEventListener('online', () => {
            DOM.showToast('Connection restored', 'success');
        });

        window.addEventListener('offline', () => {
            DOM.showToast('Connection lost', 'warning');
        });

        // Listen for authentication changes
        authManager.addListener((event, data) => {
            this.handleAuthChange(event, data);
        });

        // Listen for community updates
        window.addEventListener('communityUpdated', (e) => {
            this.handleCommunityUpdated(e.detail.community);
        });
    }

    /**
     * Setup infinite scrolling
     */
    setupInfiniteScrolling() {
        if (!CONFIG.FEATURES.INFINITE_SCROLL) return;

        const scrollHandler = PerformanceUtils.throttle(() => {
            if (this.isLoading || !this.hasMorePosts) return;

            const contentArea = document.getElementById('community-content-area');
            if (!contentArea) return;

            const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
            const threshold = scrollHeight - clientHeight - 200; // 200px before bottom

            if (scrollTop >= threshold) {
                this.loadMorePosts();
            }
        }, 250);

        window.addEventListener('scroll', scrollHandler);
    }

    /**
     * Setup API instance
     */
    setupAPI() {
        this.api = new LemmyAPI(this.state.currentInstance);
    }

    /**
     * Setup router for community page
     */
    setupRouter() {
        // Listen for instance changes that might affect URLs
        router.addRoute('/c/:community', async (params, query) => {
            // Handle community route
            if (params.community !== this.communityName) {
                // Community changed, reload
                window.location.reload();
            }
        });
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        this.populateSortSelector();
        
        // Clean up existing post feed if it exists
        if (this.postFeed) {
            this.postFeed.destroy();
            this.postFeed = null;
        }
        
        // Initialize post feed with explicit initial page and disabled infinite scroll initially
        this.postFeed = new PostFeed(this.elements.postsContainer, {
            initialPage: 1, // Explicitly ensure we start at page 1
            enableInfiniteScroll: false, // Disable infinite scroll during initialization
            fetchFunction: async (params) => {
                // Use community ID if we have community data, otherwise fall back to name
                const communityIdentifier = this.communityData ? 
                    this.communityData.community.id : 
                    this.communityName;

                return await this.api.getCommunityPosts(
                    communityIdentifier,
                    this.state.currentSort,
                    params.page
                );
            },
            emptyMessage: 'No posts found',
            emptyDescription: 'This community doesn\'t have any posts yet, or they might not be visible from this instance.',
            emptyIcon: 'bi-inbox'
        });
    }

    /**
     * Initialize edit modal
     */
    initializeEditModal() {
        this.editModal = new CommunityEditModal();
    }

    // populateInstanceSelector moved to navbar component

    /**
     * Populate sort selector
     */
    populateSortSelector() {
        const sortOptions = [
            { value: 'Active', label: 'Active' },
            { value: 'Hot', label: 'Hot' },
            { value: 'New', label: 'New' },
            { value: 'TopDay', label: 'Top Day' },
            { value: 'TopWeek', label: 'Top Week' }
        ];

        this.elements.sortSelector.innerHTML = '';
        sortOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            optionElement.selected = option.value === this.state.currentSort;
            this.elements.sortSelector.appendChild(optionElement);
        });
        
        // Explicitly set the select element value to ensure it's properly selected
        this.elements.sortSelector.value = this.state.currentSort;
    }

    // ========================================
    // DATA LOADING METHODS
    // ========================================

    /**
     * Load initial data for the community
     * @async
     */
    async loadInitialData() {
        try {
            // Ensure PostFeed starts completely fresh
            if (this.postFeed) {
                this.postFeed.clear();
            }
            
            // Load community info first, then posts
            await this.loadCommunityInfo();
            // loadPosts(true) will reset the state by default
            await this.postFeed.loadPosts(true);
            
            // Re-enable infinite scroll after initial load
            this.postFeed.enableInfiniteScroll();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('Failed to load community data');
        }
    }

    /**
     * Load community information
     */
    async loadCommunityInfo() {
        try {
            
            // Get community details
            const communityResponse = await this.api.getCommunity(this.communityName);
            if (!communityResponse || !communityResponse.community_view) {
                throw new Error('Community not found');
            }

            this.communityData = communityResponse.community_view;
            const community = this.communityData.community;
            
            // Update page title
            document.title = `${community.title || community.name} - Lemmeric`;
            
            // Update community title
            this.updateCommunityTitle(community);

            // Load moderators
            const moderatorsResponse = await this.api.getModerators(community.id);
            const moderators = moderatorsResponse?.moderators || [];
            this.moderators = moderators; // Store for later use

            // Get current user data for edit permissions
            this.currentUser = this.getCurrentUser();

            // Format community data for sidebar (similar to post page)
            const formattedCommunity = APIUtils.formatCommunity(this.communityData);

            // Render community sidebar
            this.renderCommunitySidebar(formattedCommunity, moderators, this.currentUser);

        } catch (error) {
            console.error('Failed to load community info:', error);
            this.showError(`Failed to load community: ${this.communityName}`);
        }
    }

    /**
     * Update community title in the header
     */
    updateCommunityTitle(community) {
        const titleElement = this.elements.communityTitle;
        titleElement.innerHTML = '';

        // Add community icon if available
        if (community.icon) {
            const icon = DOM.createElement('img', {
                src: community.icon,
                className: 'me-2 rounded',
                style: 'width: 32px; height: 32px; object-fit: cover;',
                alt: community.title || community.name,
                onerror: function() {
                    this.style.display = 'none';
                }
            });
            titleElement.appendChild(icon);
        }

        // Add community title/name
        const titleText = DOM.createElement('span', {}, community.title || community.name);
        titleElement.appendChild(titleText);

        // Add community name badge if title is different
        if (community.title && community.title !== community.name) {
            const nameBadge = DOM.createElement('small', {
                className: 'badge bg-secondary ms-2'
            }, `c/${community.name}`);
            titleElement.appendChild(nameBadge);
        }
    }

    /**
     * Render community sidebar
     */
    renderCommunitySidebar(communityData, moderators = [], currentUser = null) {
        const sidebarComponent = new CommunitySidebarComponent(communityData, moderators, currentUser);
        const sidebarElement = sidebarComponent.render();
        
        // Clear existing content and add new sidebar
        this.elements.communitySidebarContainer.innerHTML = '';
        this.elements.communitySidebarContainer.appendChild(sidebarElement);

        // Also update mobile modal if it exists
        if (this.elements.mobileCommunityInfo) {
            this.elements.mobileCommunityInfo.innerHTML = '';
            const mobileSidebar = sidebarComponent.render();
            this.elements.mobileCommunityInfo.appendChild(mobileSidebar);
        }
    }

    /**
     * Load community posts (now handled by PostFeed)
     */
    async loadCommunityPosts(reset = true) {
        return await this.postFeed.loadPosts(reset);
    }

    /**
     * Load more posts (for infinite scroll, now handled by PostFeed)
     */
    async loadMorePosts() {
        return await this.postFeed.loadMorePosts();
    }

    /**
     * Handle instance change
     */
    async handleInstanceChange(instanceName) {
        if (instanceName === this.state.currentInstance) return;
        
        try {
            setCurrentInstance(instanceName);
            this.state.currentInstance = instanceName;
            this.setupAPI();
            
            // Update favicon based on new instance branding
            const { updateFaviconFromBranding } = await import('./config.js');
            updateFaviconFromBranding();
            
            // Reload community data for new instance
            await this.loadInitialData();
            
            DOM.showToast(`Switched to ${instanceName}`, 'success');
        } catch (error) {
            console.error('Failed to switch instance:', error);
            DOM.showToast('Failed to switch instance', 'error');
        }
    }

    /**
     * Handle sort change
     */
    async handleSortChange(sortType) {
        if (sortType === this.state.currentSort) return;
        
        setCurrentSort(sortType);
        this.state.currentSort = sortType;
        
        // Reload posts with new sort
        await this.postFeed.updateParams();
    }

    /**
     * Handle authentication state changes
     */
    handleAuthChange(event, data) {
        // Note: Create Post button visibility is now handled by the navbar component
        if (event === 'login' || event === 'userLoaded') {
            // User logged in, update current user and refresh sidebar
            this.currentUser = this.getCurrentUser();
            if (this.communityData) {
                const formattedCommunity = APIUtils.formatCommunity(this.communityData);
                this.renderCommunitySidebar(formattedCommunity, this.moderators || [], this.currentUser);
            }
        } else if (event === 'logout') {
            // User logged out, clear current user and refresh sidebar
            this.currentUser = null;
            if (this.communityData) {
                const formattedCommunity = APIUtils.formatCommunity(this.communityData);
                this.renderCommunitySidebar(formattedCommunity, this.moderators || [], null);
            }
        }
    }

    /**
     * Get current user data
     */
    getCurrentUser() {
        try {
            return authManager.getCurrentUser();
        } catch (error) {
            console.warn('Failed to get current user:', error);
            return null;
        }
    }

    /**
     * Handle community updated event
     */
    handleCommunityUpdated(updatedCommunity) {
        // Update local community data
        this.communityData = updatedCommunity;
        
        // Update community title
        this.updateCommunityTitle(updatedCommunity.community);
        
        // Re-render sidebar with updated data
        const formattedCommunity = APIUtils.formatCommunity(this.communityData);
        this.renderCommunitySidebar(formattedCommunity, this.moderators || [], this.currentUser);
        
        // Show success message
        DOM.showToast('Community updated successfully!', 'success');
    }

    // Note: navigateToCreatePost is now handled by the navbar component
    // The navbar checks for community context automatically

    // Theme and navigation handling moved to navbar component

    /**
     * Show loading in posts container
     */
    showLoadingInContainer() {
        this.elements.postsContainer.innerHTML = `
            <div class="d-flex justify-content-center p-4">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading posts...</span>
                </div>
            </div>
        `;
    }

    /**
     * Hide loading in posts container
     */
    hideLoadingInContainer() {
        const loadingDiv = this.elements.postsContainer.querySelector('.d-flex.justify-content-center');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    /**
     * Show no posts message
     */
    showNoPosts() {
        this.elements.postsContainer.innerHTML = `
            <div class="text-center py-5">
                <div class="mb-3">
                    <i class="bi bi-inbox display-1 text-muted"></i>
                </div>
                <h5 class="text-muted">No posts found</h5>
                <p class="text-muted">This community doesn't have any posts yet, or they might not be visible from this instance.</p>
            </div>
        `;
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Show error message to user
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.elements.postsContainer.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                ${message}
            </div>
        `;
    }

    /**
     * Clean up and destroy the app
     */
    destroy() {
        if (this.postFeed) {
            this.postFeed.destroy();
            this.postFeed = null;
        }
        
        // Clean up other references
        this.api = null;
        this.communityData = null;
        this.elements = {};
    }

    // Navigation and instance management methods moved to navbar component
}

// ========================================
// APPLICATION INITIALIZATION
// ========================================

/**
 * Initialize the community page application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', () => {
    window.lemmericCommunityApp = new LemmericCommunityApp();
});

// Export for potential external use
export { LemmericCommunityApp }; 