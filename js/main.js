/**
 * Main application file for Lemmeric
 * Initializes the app and handles navigation, data loading, and state management
 */

import { CONFIG, getCurrentInstance, setCurrentInstance, getCurrentSort, setCurrentSort, getCurrentTheme, setCurrentTheme, getAllInstances, addCustomInstance, validateInstanceUrl, getCurrentListingType, setCurrentListingType, getInstanceConfig } from './config.js';
import { LemmyAPI, APIUtils } from './api.js';
import { DOM, PerformanceUtils } from './utils.js';
import { PostListManager } from './components/post.js';
import { PostFeed } from './components/post-feed.js';
import { router } from './router.js';
import { processSidebarContent, processTaglineContent } from './markdown-it-setup.js';
import { authManager } from './auth.js';
import { VERSION_INFO } from './version.js';

class LemmericApp {
    constructor() {
        this.api = null;
        this.postFeed = null;
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMorePosts = true;
        
        // DOM elements (navbar elements are now handled by navbar component)
        this.elements = {
            sortSelector: document.getElementById('sort-selector'),
            listingTypeSelector: document.getElementById('listing-type-selector'),
            postsContainer: document.getElementById('posts-container'),
            sidebarInstanceInfo: document.getElementById('instance-info'),
            sidebarTrendingCommunities: document.getElementById('trending-communities'),
            sidebarCommunitiesHeader: document.querySelector('#trending-communities').parentElement.querySelector('.card-header h6'),
            sidebarInstanceAdmins: document.getElementById('instance-admins'),
            sidebarStats: document.getElementById('site-stats'),
            sidebarTaglines: document.getElementById('taglines-content'),
            sidebarTaglinesCard: document.getElementById('taglines-card'),
            pagination: document.getElementById('pagination'),
            contentTitle: document.getElementById('content-title'),
            // Mobile modal elements
            mobileInstanceInfo: document.getElementById('mobile-instance-info'),
            mobileInstanceAdmins: document.getElementById('mobile-instance-admins'),
            mobileSiteStats: document.getElementById('mobile-site-stats'),
            mobileTrendingCommunities: document.getElementById('mobile-trending-communities'),
            mobileTaglines: document.getElementById('mobile-taglines-content'),
            mobileTaglinesCard: document.getElementById('mobile-taglines-card')
        };
        
        // State
        this.state = {
            currentInstance: getCurrentInstance(),
            currentSort: getCurrentSort(),
            currentTheme: getCurrentTheme(),
            currentListingType: getCurrentListingType()
        };
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.cacheElements();
            this.setupEventListeners();
            this.setupAPI();
            this.setupRouter();
            this.initializeUI();
            
            // Load initial data
            await this.loadInitialData();
            
            console.log('Lemmeric initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Lemmeric:', error);
            this.showError('Failed to initialize application');
        }
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        // Validate required elements (instanceSelector now handled by navbar component)
        const requiredElements = ['sortSelector', 'listingTypeSelector', 'postsContainer'];
        for (const elementName of requiredElements) {
            if (!this.elements[elementName]) {
                throw new Error(`Required element not found: ${elementName}`);
            }
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Sort selector
        this.elements.sortSelector.addEventListener('change', (e) => {
            this.handleSortChange(e.target.value);
        });

        // Listing type selector
        this.elements.listingTypeSelector.addEventListener('change', (e) => {
            this.handleListingTypeChange(e.target.value);
        });

        // Listen for instance changes from navbar component
        window.addEventListener('instanceChanged', (e) => {
            this.handleInstanceChange(e.detail.instance);
        });

        // Listen for authentication changes
        authManager.addListener((event, data) => {
            this.handleAuthChange(event, data);
        });

        // Infinite scrolling
        this.setupInfiniteScrolling();

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Window events
        window.addEventListener('online', () => {
            DOM.showToast('Connection restored', 'success');
        });

        window.addEventListener('offline', () => {
            DOM.showToast('Connection lost', 'warning');
        });
    }

    /**
     * Setup infinite scrolling
     */
    setupInfiniteScrolling() {
        if (!CONFIG.FEATURES.INFINITE_SCROLL) return;

        const scrollHandler = PerformanceUtils.throttle(() => {
            if (this.isLoading || !this.hasMorePosts) return;

            const contentArea = document.getElementById('content-area');
            if (!contentArea) return;

            const scrollHeight = contentArea.scrollHeight;
            const scrollTop = contentArea.scrollTop;
            const clientHeight = contentArea.clientHeight;

            if (scrollTop + clientHeight >= scrollHeight - 1000) {
                this.loadMorePosts();
            }
        }, 100);

        // Add scroll listener to content area instead of window
        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.addEventListener('scroll', scrollHandler);
        }
        
        // Fallback to window scroll for smaller screens
        window.addEventListener('scroll', PerformanceUtils.throttle(() => {
            if (window.innerWidth <= 991.98) { // Bootstrap lg breakpoint
                if (this.isLoading || !this.hasMorePosts) return;

                const scrollHeight = document.documentElement.scrollHeight;
                const scrollTop = document.documentElement.scrollTop;
                const clientHeight = document.documentElement.clientHeight;

                if (scrollTop + clientHeight >= scrollHeight - 1000) {
                    this.loadMorePosts();
                }
            }
        }, 100));
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        if (!CONFIG.FEATURES.KEYBOARD_SHORTCUTS) return;

        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'r':
                    if (e.ctrlKey || e.metaKey) return; // Allow browser refresh
                    e.preventDefault();
                    this.refreshPosts();
                    break;
                case 't':
                    e.preventDefault();
                    if (window.navbar) {
                        window.navbar.toggleTheme();
                    }
                    break;
                case 'h':
                    e.preventDefault();
                    router.navigate('/');
                    break;
                case '/':
                    e.preventDefault();
                    // Focus search (when implemented)
                    break;
            }
        });
    }

    /**
     * Setup API instance
     */
    setupAPI() {
        this.api = new LemmyAPI(this.state.currentInstance);
    }

    /**
     * Setup router
     */
    setupRouter() {
        // Setup route handlers
        router.addRoute('/', (params, query) => {
            this.handleHomeRoute(params, query);
        });

        router.addRoute('/post/:id', (params, query) => {
            this.handlePostRoute(params, query);
        });

        router.addRoute('/c/:community', (params, query) => {
            this.handleCommunityRoute(params, query);
        });

        router.addRoute('/search', (params, query) => {
            this.handleSearchRoute(params, query);
        });

        // Listen for router events
        window.addEventListener('router:home', () => {
            this.navigateToHome();
        });

        // Store reference to app for router handlers
        window.lemmericApp = this;
        
        // Make getAllInstances globally accessible for markdown processor
        window.getAllInstances = getAllInstances;
    }

    /**
     * Handle home route
     * @param {Object} params - Route parameters 
     * @param {URLSearchParams} query - Query parameters
     */
    async handleHomeRoute(params, query) {
        // Clear all loading states
        this.clearAllLoadingStates();
        
        // Show main posts view
        this.showPostsView();
        
        // Apply query parameters if present
        if (query.has('sort')) {
            const sort = query.get('sort');
            if (this.elements.sortSelector.querySelector(`option[value="${sort}"]`)) {
                await this.handleSortChange(sort);
            }
        }
        
        if (query.has('type')) {
            const type = query.get('type');
            const typeInput = this.elements.listingTypeSelector.querySelector(`input[value="${type}"]`);
            if (typeInput) {
                typeInput.checked = true;
                await this.handleListingTypeChange(type);
            }
        }
    }

    /**
     * Handle post route - redirect to post page
     * @param {Object} params - Route parameters
     * @param {URLSearchParams} query - Query parameters  
     */
    async handlePostRoute(params, query) {
        const postId = params.id;
        
        if (!postId) {
            console.error('No post ID provided');
            this.navigateToHome();
            return;
        }

        try {
            // Construct the URL with hash fragment if present
            const hash = window.location.hash;
            const postUrl = `/post/${postId}${hash}`;
            
            // Redirect to the dedicated post page
            window.location.href = postUrl;
        } catch (error) {
            console.error('Failed to navigate to post page:', error);
            this.navigateToHome();
        }
    }

    /**
     * Handle community route - redirect to community page
     * @param {Object} params - Route parameters
     * @param {URLSearchParams} query - Query parameters
     */
    async handleCommunityRoute(params, query) {
        const communityName = params.community;
        
        if (!communityName) {
            console.error('No community name provided');
            this.navigateToHome();
            return;
        }

        try {
            // Redirect to the dedicated community page
            window.location.href = `/c/${communityName}`;
        } catch (error) {
            console.error('Failed to navigate to community page:', error);
            this.navigateToHome();
        }
    }

    /**
     * Handle search route - redirect to search page
     * @param {Object} params - Route parameters
     * @param {URLSearchParams} query - Query parameters
     */
    async handleSearchRoute(params, query) {
        try {
            // Check if we're already on the search page
            if (window.location.pathname === '/search') {
                // Already on search page, just update the search
                if (window.lemmericSearchPage && typeof window.lemmericSearchPage.loadSearchFromURL === 'function') {
                    window.lemmericSearchPage.loadSearchFromURL();
                }
            } else {
                // Redirect to the dedicated search page
                window.location.href = `/search${window.location.search}`;
            }
        } catch (error) {
            console.error('Failed to navigate to search page:', error);
            this.navigateToHome();
        }
    }

    /**
     * Navigate to home and show posts view
     */
    navigateToHome() {
        // Remove any loading overlay
        this.clearAllLoadingStates();
        
        this.showPostsView();
        this.updateNavigation();
    }

    /**
     * Show main posts view
     */
    showPostsView() {
        // Ensure we're on the posts view
        document.getElementById('content-title').textContent = 'Posts';
        
        // Update navigation
        this.elements.navHome?.classList.add('active');
        this.elements.navCommunities?.classList.remove('active');
        this.elements.navInstances?.classList.remove('active');

        // Only load posts if the container is truly empty or if we haven't loaded any posts yet
        const postsContainer = this.elements.postsContainer;
        if (postsContainer) {
            // Check for actual post elements, not just any children (loading spinners, etc.)
            const hasPostElements = postsContainer.querySelector('.post-card') !== null;
            const hasLoadingSpinner = postsContainer.querySelector('.spinner-border') !== null;
            
            // If we have loading content but no posts, clear it
            if (hasLoadingSpinner && !hasPostElements) {
                DOM.clearChildren(postsContainer);
            }
            
            if (!hasPostElements && !this.isLoading) {
                this.loadPosts();
            }
        }
    }

    /**
     * Show loading overlay
     */
    showLoadingOverlay() {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = DOM.createElement('div', {
                id: 'loading-overlay',
                className: 'position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center',
                style: 'background: rgba(0,0,0,0.5); z-index: 1040;'
            }, [
                DOM.createElement('div', {
                    className: 'spinner-border text-light',
                    style: 'width: 3rem; height: 3rem;'
                })
            ]);
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }

    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Remove loading overlay completely
     */
    removeLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * Clear all loading states from the application
     */
    clearAllLoadingStates() {
        // Remove loading overlay
        this.removeLoadingOverlay();
        
        // Clear any loading spinners from posts container
        const postsContainer = this.elements.postsContainer;
        if (postsContainer) {
            const loadingElements = postsContainer.querySelectorAll('.spinner-border, .d-flex.justify-content-center.align-items-center');
            loadingElements.forEach(element => {
                // Only remove loading elements that don't contain post cards
                if (!element.querySelector('.post-card')) {
                    element.remove();
                }
            });
        }
        
        // Reset loading state
        this.isLoading = false;
    }

    /**
     * Initialize UI elements
     */
    initializeUI() {
        // Set initial values
        this.elements.sortSelector.value = this.state.currentSort;
        this.setListingTypeSelector(this.state.currentListingType);
        
        // Initialize post feed
        this.postFeed = new PostFeed(this.elements.postsContainer, {
            fetchFunction: async (params) => {
                return await this.api.getPosts({
                    sort: this.state.currentSort,
                    type: this.state.currentListingType,
                    page: params.page,
                    limit: params.limit
                });
            },
            emptyMessage: 'No posts found',
            emptyDescription: 'There are no posts to display.',
            onLoadComplete: (response) => {
                this.updateNavigation();
            },
            onLoadError: (error) => {
                // If subscribed feed fails and user is authenticated, suggest fallback
                if (this.state.currentListingType === 'Subscribed' && authManager.isAuthenticated()) {
                    console.error('Subscribed feed failed, suggesting fallback');
                } else {
                    console.error('Failed to load posts:', error);
                }
            }
        });

        // Set up selector options
        this.populateSortSelector();
        
        // Initialize Subscribed button state based on authentication
        this.updateSubscribedButtonState(authManager.isAuthenticated());
    }

    // populateInstanceSelector moved to navbar component

    /**
     * Populate sort selector with configured options
     */
    populateSortSelector() {
        DOM.clearChildren(this.elements.sortSelector);
        
        CONFIG.SORT_OPTIONS.forEach(option => {
            const optionElement = DOM.createElement('option', {
                value: option.value
            }, option.label);
            
            this.elements.sortSelector.appendChild(optionElement);
        });
        
        this.elements.sortSelector.value = this.state.currentSort;
    }

    /**
     * Set the listing type selector to the specified value
     * @param {string} listingType - The listing type to select
     */
    setListingTypeSelector(listingType) {
        const radioButton = this.elements.listingTypeSelector.querySelector(`input[value="${listingType}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }
    }

    /**
     * Load initial data
     */
    async loadInitialData() {
        // Auto-switch to Subscribed feed if user is authenticated and currently on All (only on initial load)
        if (authManager.currentUser && authManager.isAuthenticated() && this.state.currentListingType === 'All') {
            this.updateListingTypeUI('Subscribed');
        }
        
        // Load posts first for main content
        await this.postFeed.loadPosts();
        
        // Load sidebar data in parallel
        Promise.allSettled([
            this.loadInstanceInfo(),
            this.loadTaglines(),
            this.loadTrendingCommunities(),
            this.loadInstanceAdmins(),
            this.loadSiteStats()
        ]).then(() => {
            console.log('Sidebar data loaded');
        });
    }

    /**
     * Load posts from the API (now handled by PostFeed)
     */
    async loadPosts(reset = true) {
        return await this.postFeed.loadPosts(reset);
    }

    /**
     * Load more posts for infinite scrolling (now handled by PostFeed)
     */
    async loadMorePosts() {
        return await this.postFeed.loadMorePosts();
    }

    /**
     * Refresh posts
     */
    async refreshPosts() {
        await this.postFeed.refresh();
    }

    /**
     * Load instance information
     */
    async loadInstanceInfo() {
        try {
            const siteData = await this.api.getSite();
            const site = siteData.site_view?.site;
            const counts = siteData.site_view?.counts;
            
            DOM.clearChildren(this.elements.sidebarInstanceInfo);
            DOM.clearChildren(this.elements.mobileInstanceInfo);
            
            if (!site) {
                const noInfoMessage = DOM.createElement('p', { className: 'text-muted small' }, 'No instance information available');
                this.elements.sidebarInstanceInfo.appendChild(noInfoMessage.cloneNode(true));
                this.elements.mobileInstanceInfo.appendChild(noInfoMessage);
                return;
            }

            // Instance banner (if available)
            const bannerElement = site.banner ? 
                DOM.createElement('img', {
                    src: site.banner,
                    alt: `${site.name} banner`,
                    className: 'img-fluid mb-3 rounded',
                    style: 'width: 100%; max-height: 120px; object-fit: cover;'
                }) : null;

            // Instance icon and name
            const headerElement = DOM.createElement('div', { className: 'd-flex align-items-center mb-2' }, [
                site.icon ? 
                    DOM.createElement('img', {
                        src: site.icon,
                        alt: `${site.name} icon`,
                        className: 'me-2 rounded',
                        style: 'width: 24px; height: 24px; object-fit: cover;'
                    }) : null,
                DOM.createElement('h6', { className: 'mb-0 fw-bold' }, site.name)
            ].filter(Boolean));

            // Instance description
            const descriptionElement = site.description ? 
                DOM.createElement('p', { 
                    className: 'text-muted mb-2 small' 
                }, site.description) : null;

            // Sidebar content (rendered as HTML if present)
            const sidebarElement = site.sidebar ? 
                DOM.createElement('div', { 
                    className: 'instance-sidebar small mb-3',
                    innerHTML: processSidebarContent(site.sidebar)
                }) : null;

            // Assemble all elements
            const infoElement = DOM.createElement('div', {}, [
                bannerElement,
                headerElement,
                descriptionElement,
                sidebarElement
            ].filter(Boolean));
            
            // Clone for mobile modal
            const mobileInfoElement = DOM.createElement('div', {}, [
                bannerElement ? bannerElement.cloneNode(true) : null,
                headerElement.cloneNode(true),
                descriptionElement ? descriptionElement.cloneNode(true) : null,
                sidebarElement ? sidebarElement.cloneNode(true) : null
            ].filter(Boolean));
            
            this.elements.sidebarInstanceInfo.appendChild(infoElement);
            this.elements.mobileInstanceInfo.appendChild(mobileInfoElement);

        } catch (error) {
            console.error('Failed to load instance info:', error);
            DOM.showError(this.elements.sidebarInstanceInfo, 'Failed to load instance info');
            DOM.showError(this.elements.mobileInstanceInfo, 'Failed to load instance info');
        }
    }

    /**
     * Load taglines from the current instance
     */
    async loadTaglines() {
        try {
            const taglineContent = await this.api.getRandomTagline();
            
            DOM.clearChildren(this.elements.sidebarTaglines);
            DOM.clearChildren(this.elements.mobileTaglines);
            
            if (!taglineContent || taglineContent.trim() === '') {
                // Hide the taglines card if no content is available
                this.elements.sidebarTaglinesCard.style.display = 'none';
                this.elements.mobileTaglinesCard.style.display = 'none';
                return;
            }

            // Show the taglines card since we have content
            this.elements.sidebarTaglinesCard.style.display = 'block';
            this.elements.mobileTaglinesCard.style.display = 'block';

            // Create tagline element with proper markdown processing
            const processedTagline = processTaglineContent(taglineContent);
            const taglineElement = DOM.createElement('div', {
                className: 'tagline-content small',
                innerHTML: processedTagline
            });

            // Clone for mobile modal
            const mobileTaglineElement = taglineElement.cloneNode(true);
            
            this.elements.sidebarTaglines.appendChild(taglineElement);
            this.elements.mobileTaglines.appendChild(mobileTaglineElement);

        } catch (error) {
            console.error('Failed to load taglines:', error);
            // Hide the card on error
            this.elements.sidebarTaglinesCard.style.display = 'none';
            this.elements.mobileTaglinesCard.style.display = 'none';
        }
    }

    /**
     * Load local communities from the current instance
     */
    async loadTrendingCommunities() {
        try {
            // Update header with current instance name
            const currentInstanceConfig = getInstanceConfig();
            if (this.elements.sidebarCommunitiesHeader && currentInstanceConfig && currentInstanceConfig.name) {
                this.elements.sidebarCommunitiesHeader.textContent = `Trending Local Communities (${currentInstanceConfig.name})`;
            } else if (this.elements.sidebarCommunitiesHeader) {
                this.elements.sidebarCommunitiesHeader.textContent = 'Trending Local Communities';
            }

            const communities = await this.api.getTrendingCommunities(CONFIG.CONTENT.MAX_COMMUNITIES_SIDEBAR);
            
            DOM.clearChildren(this.elements.sidebarTrendingCommunities);
            DOM.clearChildren(this.elements.mobileTrendingCommunities);
            
            if (communities.length === 0) {
                const noCommunitiesMessage = DOM.createElement('p', { className: 'text-muted small' }, 'No communities found');
                this.elements.sidebarTrendingCommunities.appendChild(noCommunitiesMessage.cloneNode(true));
                this.elements.mobileTrendingCommunities.appendChild(noCommunitiesMessage);
                return;
            }

            communities.forEach(community => {
                // Generate proper community URL for both local and remote communities
                let communityUrl = `/c/${community.community.name}`;
                
                // For remote/federated communities, include the instance domain
                if (community.community.local === false && community.community.actor_id) {
                    try {
                        const actorUrl = new URL(community.community.actor_id);
                        communityUrl = `/c/${community.community.name}@${actorUrl.hostname}`;
                    } catch (e) {
                        console.warn('Failed to parse community actor_id:', community.community.actor_id);
                        // Fallback to local format if parsing fails
                    }
                }

                const communityElement = DOM.createElement('div', {
                    className: 'community-item d-block p-2 rounded hover-effect',
                    style: 'cursor: pointer; color: inherit; text-decoration: none;',
                    title: community.community.description || `Visit c/${community.community.name}`,
                    role: 'button',
                    tabindex: '0'
                }, [
                    DOM.createElement('div', { className: 'community-info d-flex align-items-center' }, [
                        // Community icon (if available)
                        community.community.icon ? 
                            DOM.createElement('img', {
                                src: community.community.icon,
                                alt: community.community.title || community.community.name,
                                className: 'rounded me-2',
                                style: 'width: 24px; height: 24px; object-fit: cover;',
                                onerror: function() {
                                    this.style.display = 'none';
                                }
                            }) :
                            DOM.createElement('div', {
                                className: 'bg-secondary rounded me-2 d-flex align-items-center justify-content-center',
                                style: 'width: 24px; height: 24px;'
                            }, [
                                DOM.createElement('i', {
                                    className: 'bi bi-people-fill text-white',
                                    style: 'font-size: 12px;'
                                })
                            ]),
                        
                        DOM.createElement('div', { className: 'flex-grow-1 text-start' }, [
                            DOM.createElement('div', { 
                                className: 'community-name fw-semibold small mb-0',
                                style: 'color: var(--bs-body-color);'
                            }, community.community.title || community.community.name),
                            DOM.createElement('small', { 
                                className: 'text-muted d-block',
                                style: 'font-size: 0.75rem;'
                            }, `${APIUtils.formatNumber(community.counts.subscribers)} subscribers`)
                        ])
                    ])
                ]);

                // Add click handler for navigation
                const handleNavigation = () => {
                    window.location.href = communityUrl;
                };

                communityElement.addEventListener('click', handleNavigation);
                
                // Add keyboard support
                communityElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNavigation();
                    }
                });

                this.elements.sidebarTrendingCommunities.appendChild(communityElement);
                
                // Create mobile element with same handlers
                const mobileElement = DOM.createElement('div', {
                    className: 'community-item d-block p-2 rounded hover-effect',
                    style: 'cursor: pointer; color: inherit; text-decoration: none;',
                    title: community.community.description || `Visit c/${community.community.name}`,
                    role: 'button',
                    tabindex: '0'
                }, [
                    DOM.createElement('div', { className: 'community-info d-flex align-items-center' }, [
                        // Community icon (if available)
                        community.community.icon ? 
                            DOM.createElement('img', {
                                src: community.community.icon,
                                alt: community.community.title || community.community.name,
                                className: 'rounded me-2',
                                style: 'width: 24px; height: 24px; object-fit: cover;',
                                onerror: function() {
                                    this.style.display = 'none';
                                }
                            }) :
                            DOM.createElement('div', {
                                className: 'bg-secondary rounded me-2 d-flex align-items-center justify-content-center',
                                style: 'width: 24px; height: 24px;'
                            }, [
                                DOM.createElement('i', {
                                    className: 'bi bi-people-fill text-white',
                                    style: 'font-size: 12px;'
                                })
                            ]),
                        
                        DOM.createElement('div', { className: 'flex-grow-1 text-start' }, [
                            DOM.createElement('div', { 
                                className: 'community-name fw-semibold small mb-0',
                                style: 'color: var(--bs-body-color);'
                            }, community.community.title || community.community.name),
                            DOM.createElement('small', { 
                                className: 'text-muted d-block',
                                style: 'font-size: 0.75rem;'
                            }, `${APIUtils.formatNumber(community.counts.subscribers)} subscribers`)
                        ])
                    ])
                ]);

                mobileElement.addEventListener('click', handleNavigation);
                mobileElement.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNavigation();
                    }
                });

                this.elements.mobileTrendingCommunities.appendChild(mobileElement);
            });

        } catch (error) {
            console.error('Failed to load trending communities:', error);
            DOM.showError(this.elements.sidebarTrendingCommunities, 'Failed to load communities');
            DOM.showError(this.elements.mobileTrendingCommunities, 'Failed to load communities');
        }
    }

    /**
     * Load instance admins
     */
    async loadInstanceAdmins() {
        try {
            const siteData = await this.api.getSite();
            const admins = siteData.admins || [];
            
            DOM.clearChildren(this.elements.sidebarInstanceAdmins);
            DOM.clearChildren(this.elements.mobileInstanceAdmins);
            
            if (admins.length === 0) {
                const noAdminsMessage = DOM.createElement('p', { className: 'text-muted small' }, 'No admin information available');
                this.elements.sidebarInstanceAdmins.appendChild(noAdminsMessage.cloneNode(true));
                this.elements.mobileInstanceAdmins.appendChild(noAdminsMessage);
                return;
            }

            // Create admins list
            const adminsList = DOM.createElement('div', { className: 'admins-list' });
            const mobileAdminsList = DOM.createElement('div', { className: 'admins-list' });
            
            admins.forEach(admin => {
                const person = admin.person || admin; // Handle both PersonView and Person objects
                
                // Generate proper admin URL for both local and remote admins
                let adminUrl = `/u/${person.name}`;
                
                // For remote admins, include the instance domain
                if (person.local === false && person.actor_id) {
                    try {
                        const actorUrl = new URL(person.actor_id);
                        adminUrl = `/u/${person.name}@${actorUrl.hostname}`;
                    } catch (e) {
                        console.warn('Failed to parse admin actor_id:', person.actor_id);
                        // Fallback to local format if parsing fails
                    }
                }
                
                const adminElement = DOM.createElement('div', {
                    className: 'admin-item d-flex align-items-center mb-2'
                }, [
                    // Avatar (if available)
                    person.avatar ? 
                        DOM.createElement('img', {
                            src: person.avatar,
                            alt: `${person.display_name || person.name} avatar`,
                            className: 'rounded-circle me-2',
                            style: 'width: 24px; height: 24px; object-fit: cover;'
                        }) :
                        DOM.createElement('div', {
                            className: 'bg-secondary rounded-circle me-2 d-flex align-items-center justify-content-center',
                            style: 'width: 24px; height: 24px; font-size: 12px; color: white;'
                        }, (person.display_name || person.name).charAt(0).toUpperCase()),
                    
                    // Admin info
                    DOM.createElement('div', { className: 'admin-info flex-grow-1' }, [
                        DOM.createElement('a', { 
                            href: adminUrl,
                            className: 'admin-name fw-semibold small text-decoration-none',
                            title: `View profile: ${person.display_name || person.name}`,
                            style: 'color: inherit; cursor: pointer;'
                        }, person.display_name || person.name),
                        person.display_name && person.name !== person.display_name ?
                            DOM.createElement('div', { 
                                className: 'admin-username text-muted',
                                style: 'font-size: 0.75rem;'
                            }, `u/${person.name}`) : null
                    ].filter(Boolean))
                ]);

                adminsList.appendChild(adminElement);
                mobileAdminsList.appendChild(adminElement.cloneNode(true));
            });

            this.elements.sidebarInstanceAdmins.appendChild(adminsList);
            this.elements.mobileInstanceAdmins.appendChild(mobileAdminsList);

        } catch (error) {
            console.error('Failed to load instance admins:', error);
            DOM.showError(this.elements.sidebarInstanceAdmins, 'Failed to load admins');
            DOM.showError(this.elements.mobileInstanceAdmins, 'Failed to load admins');
        }
    }

    /**
     * Load site statistics
     */
    async loadSiteStats() {
        try {
            const stats = await this.api.getInstanceStats();
            const siteData = await this.api.getSite();
            
            DOM.clearChildren(this.elements.sidebarStats);
            DOM.clearChildren(this.elements.mobileSiteStats);
            
            const statsElement = DOM.createElement('div', {}, [
                DOM.createElement('div', { className: 'instance-stat' }, [
                    DOM.createElement('span', {}, 'Users:'),
                    DOM.createElement('span', {}, stats.users.toLocaleString())
                ]),
                DOM.createElement('div', { className: 'instance-stat' }, [
                    DOM.createElement('span', {}, 'Posts:'),
                    DOM.createElement('span', {}, stats.posts.toLocaleString())
                ]),
                DOM.createElement('div', { className: 'instance-stat' }, [
                    DOM.createElement('span', {}, 'Comments:'),
                    DOM.createElement('span', {}, stats.comments.toLocaleString())
                ]),
                DOM.createElement('div', { className: 'instance-stat' }, [
                    DOM.createElement('span', {}, 'Communities:'),
                    DOM.createElement('span', {}, stats.communities.toLocaleString())
                ]),
                siteData.version ? DOM.createElement('div', { className: 'instance-stat' }, [
                    DOM.createElement('span', {}, 'Version:'),
                    DOM.createElement('code', { className: 'small' }, `Lemmy ${siteData.version}`)
                ]) : null,
                DOM.createElement('div', { className: 'instance-stat' }, [
                    DOM.createElement('span', {}, 'UI Version:'),
                    DOM.createElement('a', { 
                        href: VERSION_INFO.repository, 
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        className: 'text-decoration-none'
                    }, [
                        DOM.createElement('code', { className: 'small' }, `${VERSION_INFO.name} ${VERSION_INFO.version}`)
                    ])
                ])
            ].filter(Boolean));
            
            this.elements.sidebarStats.appendChild(statsElement);
            this.elements.mobileSiteStats.appendChild(statsElement.cloneNode(true));

        } catch (error) {
            console.error('Failed to load site stats:', error);
            DOM.showError(this.elements.sidebarStats, 'Failed to load statistics');
            DOM.showError(this.elements.mobileSiteStats, 'Failed to load statistics');
        }
    }

    /**
     * Handle instance change
     */
    async handleInstanceChange(instanceName) {
        if (instanceName === this.state.currentInstance) return;

        try {
            this.state.currentInstance = instanceName;
            setCurrentInstance(instanceName);
            
            // Setup new API instance
            this.setupAPI();
            
            // Update favicon based on new instance branding
            const { updateFaviconFromBranding } = await import('./config.js');
            updateFaviconFromBranding();
            
            // Reload data
            await this.loadInitialData();
            
            const allInstances = getAllInstances();
            DOM.showToast(`Switched to ${allInstances[instanceName].name}`, 'success');

        } catch (error) {
            console.error('Failed to change instance:', error);
            DOM.showToast('Failed to switch instance', 'error');
            
            // Revert selector (handled by navbar component now)
            // this.elements.instanceSelector.value = this.state.currentInstance;
        }
    }

    /**
     * Handle sort change
     */
    async handleSortChange(sortType) {
        if (sortType === this.state.currentSort) return;

        this.state.currentSort = sortType;
        setCurrentSort(sortType);
        
        await this.postFeed.updateParams();
    }

    /**
     * Handle listing type change
     */
    async handleListingTypeChange(listingType) {
        if (listingType === this.state.currentListingType) return;

        this.state.currentListingType = listingType;
        setCurrentListingType(listingType);
        
        await this.postFeed.updateParams();
    }

    /**
     * Handle authentication state changes
     */
    async handleAuthChange(event, data) {
        switch (event) {
            case 'login':
            case 'userLoaded':
                // Enable the Subscribed option
                this.updateSubscribedButtonState(true);
                
                // When user logs in or is loaded, switch to Subscribed feed if currently on All
                if (this.state.currentListingType === 'All') {
                    this.updateListingTypeUI('Subscribed');
                    await this.postFeed.updateParams();
                }
                break;
            case 'logout':
                // Disable the Subscribed option
                this.updateSubscribedButtonState(false);
                
                // When user logs out, switch back to All feed if currently on Subscribed
                if (this.state.currentListingType === 'Subscribed') {
                    this.updateListingTypeUI('All');
                    await this.postFeed.updateParams();
                }
                break;
        }
    }

    // Theme handling moved to navbar component

    /**
     * Update navigation state (now handled by navbar component)
     */
    updateNavigation() {
        // Navigation state is now handled by the navbar component
        if (window.navbar) {
            window.navbar.updateNavigation();
        }
    }

    /**
     * Show no posts message
     */
    showNoPosts() {
        this.elements.postsContainer.appendChild(
            DOM.createElement('div', {
                className: 'text-center p-4'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-inbox display-1 text-muted'
                }),
                DOM.createElement('h5', { 
                    className: 'mt-3 text-muted' 
                }, 'No posts found'),
                DOM.createElement('p', { 
                    className: 'text-muted' 
                }, 'Try changing the sort order or switching instances.')
            ])
        );
    }

    /**
     * Show no subscribed posts message
     */
    showNoSubscribedPosts() {
        this.elements.postsContainer.appendChild(
            DOM.createElement('div', {
                className: 'text-center p-4'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-heart display-1 text-muted'
                }),
                DOM.createElement('h5', { 
                    className: 'mt-3 text-muted' 
                }, 'No subscribed posts found'),
                DOM.createElement('p', { 
                    className: 'text-muted mb-3' 
                }, 'You haven\'t subscribed to any communities yet, or there are no new posts.'),
                DOM.createElement('div', {
                    className: 'd-flex gap-2 justify-content-center flex-wrap'
                }, [
                    DOM.createElement('button', {
                        className: 'btn btn-outline-primary',
                        onclick: () => this.switchToAllPosts()
                    }, 'Browse All Posts'),
                    DOM.createElement('button', {
                        className: 'btn btn-outline-secondary',
                        onclick: () => window.location.href = '/communities'
                    }, 'Find Communities')
                ])
            ])
        );
    }

    /**
     * Update listing type UI without triggering a reload
     */
    updateListingTypeUI(listingType) {
        const radioInput = this.elements.listingTypeSelector.querySelector(`input[value="${listingType}"]`);
        if (radioInput) {
            radioInput.checked = true;
            this.state.currentListingType = listingType;
            setCurrentListingType(listingType);
        }
    }

    /**
     * Switch to All posts feed
     */
    switchToAllPosts() {
        this.handleListingTypeChange('All');
    }

    /**
     * Update the enabled/disabled state of the Subscribed button
     */
    updateSubscribedButtonState(enabled) {
        const subscribedInput = document.getElementById('listing-subscribed');
        const subscribedLabel = document.querySelector('label[for="listing-subscribed"]');
        
        if (subscribedInput && subscribedLabel) {
            subscribedInput.disabled = !enabled;
            
            if (enabled) {
                subscribedLabel.title = 'View posts from subscribed communities';
                subscribedLabel.classList.remove('disabled');
            } else {
                subscribedLabel.title = 'Requires login';
                subscribedLabel.classList.add('disabled');
            }
        }
    }

    /**
     * Show communities page (placeholder)
     */
    showCommunities() {
        window.location.href = '/communities';
    }

    /**
     * Show instances page (placeholder)
     */
    showInstances() {
        DOM.showToast('Instances page coming soon!', 'info');
    }

    /**
     * Show error message
     */
    showError(message) {
        DOM.showToast(message, 'error');
    }

    // Instance modal handling moved to navbar component

    /**
     * Load current page data (called by navbar component)
     */
    loadCurrentPageData() {
        // Reload posts for the current page
        if (this.postFeed) {
            this.postFeed.loadPosts(true);
        }
    }

    /**
     * Cleanup and destroy the app
     */
    destroy() {
        if (this.postFeed) {
            this.postFeed.destroy();
        }
        
        // Remove event listeners
        window.removeEventListener('scroll', this.scrollHandler);
        
        this.elements = {};
        this.api = null;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.lemmericApp = new LemmericApp();
});

// Export for potential external use
export default LemmericApp; 