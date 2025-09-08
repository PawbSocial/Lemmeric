/**
 * Communities page application file for Lemmeric
 * Handles community browsing with featured community cards and full community listing
 */

import { CONFIG, getCurrentInstance, setCurrentInstance, getCurrentTheme, setCurrentTheme, getAllInstances, addCustomInstance, validateInstanceUrl } from './config.js';
import { LemmyAPI, APIUtils } from './api.js';
import { DOM, PerformanceUtils } from './utils.js';
import { router } from './router.js';

class LemmericCommunitiesApp {
    constructor() {
        this.api = null;
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreCommunities = true;
        this.allCommunities = [];
        this.filteredCommunities = [];
        this.currentFilters = {
            search: '',
            type: 'Local',  // Default to Local communities for instances
            sort: 'TopMonth'  // Default to TopMonth to match trending communities behavior
        };
        
        // DOM elements (navbar elements now handled by navbar component)
        this.elements = {
            contentTitle: document.getElementById('content-title'),
            communitiesSubtitle: document.getElementById('communities-subtitle'),
            featuredCommunities: document.getElementById('featured-communities'),
            communitiesContainer: document.getElementById('communities-container'),
            communitiesCount: document.getElementById('communities-count'),
            pagination: document.getElementById('pagination'),
            
            // Filter elements
            communitySearch: document.getElementById('community-search'),
            communityTypeFilter: document.getElementById('community-type-filter'),
            communitySortFilter: document.getElementById('community-sort-filter'),
            
            // Mobile filter elements
            mobileCommunitySearch: document.getElementById('mobile-community-search'),
            mobileCommunityTypeFilter: document.getElementById('mobile-community-type-filter'),
            mobileCommunitySortFilter: document.getElementById('mobile-community-sort-filter'),
            
            // Sidebar
            communitiesStats: document.getElementById('communities-stats'),
            
            // Mobile sidebar
            mobileCommunitiesStats: document.getElementById('mobile-communities-stats')
        };
        
        // State
        this.state = {
            currentInstance: getCurrentInstance(),
            currentTheme: getCurrentTheme()
        };
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Add communities page class for styling
            document.body.classList.add('communities-page');
            
            this.cacheElements();
            this.setupEventListeners();
            this.setupAPI();
            this.setupRouter();
            this.setupInfiniteScrolling();
            this.initializeUI();
            
            // Load initial data
            await this.loadInitialData();
            
            console.log('Communities page initialized successfully');
        } catch (error) {
            console.error('Failed to initialize communities page:', error);
            this.showError('Failed to initialize communities page');
        }
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        // Validate required elements (navbar elements now handled by navbar component)
        const requiredElements = ['featuredCommunities', 'communitiesContainer'];
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
        // Listen for instance changes from navbar component
        window.addEventListener('instanceChanged', (e) => {
            this.handleInstanceChange(e.detail.instance);
        });

        // Filter event listeners
        this.elements.communitySearch?.addEventListener('input', (e) => {
            this.handleFilterChange('search', e.target.value);
        });

        this.elements.communityTypeFilter?.addEventListener('change', (e) => {
            this.handleFilterChange('type', e.target.value);
        });

        this.elements.communitySortFilter?.addEventListener('change', (e) => {
            this.handleFilterChange('sort', e.target.value);
        });

        // Mobile filter sync
        this.elements.mobileCommunitySearch?.addEventListener('input', (e) => {
            if (this.elements.communitySearch) {
                this.elements.communitySearch.value = e.target.value;
            }
            this.handleFilterChange('search', e.target.value);
        });

        this.elements.mobileCommunityTypeFilter?.addEventListener('change', (e) => {
            if (this.elements.communityTypeFilter) {
                this.elements.communityTypeFilter.value = e.target.value;
            }
            this.handleFilterChange('type', e.target.value);
        });

        this.elements.mobileCommunitySortFilter?.addEventListener('change', (e) => {
            if (this.elements.communitySortFilter) {
                this.elements.communitySortFilter.value = e.target.value;
            }
            this.handleFilterChange('sort', e.target.value);
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
        // Add navigation handlers if needed
        window.addEventListener('popstate', () => {
            this.handleRouteChange();
        });
    }

    /**
     * Setup infinite scrolling
     */
    setupInfiniteScrolling() {
        if (!CONFIG.FEATURES.INFINITE_SCROLL) return;

        const scrollHandler = PerformanceUtils.throttle(() => {
            if (this.isLoading || !this.hasMoreCommunities) return;

            const contentArea = document.getElementById('content-area');
            if (!contentArea) return;

            const scrollHeight = contentArea.scrollHeight;
            const scrollTop = contentArea.scrollTop;
            const clientHeight = contentArea.clientHeight;

            if (scrollTop + clientHeight >= scrollHeight - 1000) {
                this.loadMoreCommunities();
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
                if (this.isLoading || !this.hasMoreCommunities) return;

                const scrollHeight = document.documentElement.scrollHeight;
                const scrollTop = document.documentElement.scrollTop;
                const clientHeight = document.documentElement.clientHeight;

                if (scrollTop + clientHeight >= scrollHeight - 1000) {
                    this.loadMoreCommunities();
                }
            }
        }, 100));
    }

    /**
     * Initialize UI state
     */
    initializeUI() {
        this.updatePageTitle();
        this.initializeFilters();
    }

    /**
     * Initialize filter UI elements to match current filter values
     */
    initializeFilters() {
        // Set desktop filter values
        if (this.elements.communitySearch) {
            this.elements.communitySearch.value = this.currentFilters.search;
        }
        if (this.elements.communityTypeFilter) {
            this.elements.communityTypeFilter.value = this.currentFilters.type;
        }
        if (this.elements.communitySortFilter) {
            this.elements.communitySortFilter.value = this.currentFilters.sort;
        }

        // Set mobile filter values
        if (this.elements.mobileCommunitySearch) {
            this.elements.mobileCommunitySearch.value = this.currentFilters.search;
        }
        if (this.elements.mobileCommunityTypeFilter) {
            this.elements.mobileCommunityTypeFilter.value = this.currentFilters.type;
        }
        if (this.elements.mobileCommunitySortFilter) {
            this.elements.mobileCommunitySortFilter.value = this.currentFilters.sort;
        }
    }

    /**
     * Update page title based on current instance
     */
    updatePageTitle() {
        const instanceConfig = CONFIG.INSTANCES[this.state.currentInstance];
        if (instanceConfig && this.elements.communitiesSubtitle) {
            this.elements.communitiesSubtitle.textContent = `Discover communities on ${instanceConfig.name}`;
        }
    }

    // populateInstanceSelector moved to navbar component

    /**
     * Load initial data for the page
     */
    async loadInitialData() {
        // Reset pagination state
        this.currentPage = 1;
        this.hasMoreCommunities = true;
        
        const loadPromises = [
            this.loadCommunities(),
            this.loadInstanceStats()
        ];

        await Promise.allSettled(loadPromises);
    }

    /**
     * Load communities data - updated to support infinite scroll
     */
    async loadCommunities(append = false) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        if (!append) {
            this.showLoadingInContainer();
        } else {
            // Show loading indicator at bottom for infinite scroll
            this.showBottomLoading();
        }

        try {
            // Use current filters and pagination
            console.log(`Loading communities page ${this.currentPage} with filters:`, this.currentFilters);
            
            const response = await this.api.getCommunities({
                sort: this.currentFilters.sort,
                type: this.currentFilters.type,
                page: this.currentPage,
                limit: 50  // API maximum is 50
            });

            console.log('Communities response:', response);

            const rawCommunities = response.communities || [];
            console.log('Found communities:', rawCommunities.length);

            // Check if we have more communities to load
            this.hasMoreCommunities = rawCommunities.length === 50;

            // Format communities using APIUtils for better data handling
            const communities = rawCommunities.map(community => {
                try {
                    return APIUtils.formatCommunity(community);
                } catch (error) {
                    console.warn('Failed to format community:', community, error);
                    return null;
                }
            }).filter(Boolean);

            console.log('Formatted communities:', communities.length);

            // Store communities
            if (append) {
                this.allCommunities = [...this.allCommunities, ...communities];
            } else {
                this.allCommunities = communities;
            }
            
            this.applyFilters();
            this.renderFeaturedCommunities();
            this.renderAllCommunities(append);
            this.updateCommunitiesCount();
            
        } catch (error) {
            console.error('Failed to load communities:', error);
            this.showError('Failed to load communities: ' + error.message);
        } finally {
            this.isLoading = false;
            if (!append) {
                this.hideLoadingInContainer();
            } else {
                this.hideBottomLoading();
            }
        }
    }

    /**
     * Load more communities for infinite scrolling
     */
    async loadMoreCommunities() {
        if (!this.hasMoreCommunities || this.isLoading) return;
        
        this.currentPage++;
        await this.loadCommunities(true);
    }

    /**
     * Apply current filters to communities list
     */
    applyFilters() {
        this.filteredCommunities = this.allCommunities.filter(community => {
            // Search filter
            if (this.currentFilters.search) {
                const searchTerm = this.currentFilters.search.toLowerCase();
                const nameMatch = community.name.toLowerCase().includes(searchTerm);
                const titleMatch = community.title.toLowerCase().includes(searchTerm);
                const descMatch = community.description?.toLowerCase().includes(searchTerm);
                
                if (!nameMatch && !titleMatch && !descMatch) {
                    return false;
                }
            }
            
            return true;
        });
    }

    /**
     * Render featured communities (top 12 as cards)
     */
    renderFeaturedCommunities() {
        if (!this.elements.featuredCommunities) return;

        DOM.clearChildren(this.elements.featuredCommunities);

        const featuredCommunities = this.filteredCommunities.slice(0, 12);
        
        if (featuredCommunities.length === 0) {
            const noFeaturedMessage = DOM.createElement('div', { 
                className: 'col-12 text-center text-muted py-4'
            }, 'No featured communities found');
            this.elements.featuredCommunities.appendChild(noFeaturedMessage);
            return;
        }

        featuredCommunities.forEach(community => {
            const communityCard = this.createCommunityCard(community);
            this.elements.featuredCommunities.appendChild(communityCard);
        });
    }

    /**
     * Render all communities list (after featured section)
     */
    renderAllCommunities(append = false) {
        if (!this.elements.communitiesContainer) return;

        if (!append) {
            DOM.clearChildren(this.elements.communitiesContainer);
        }

        // Show communities starting from index 12 (after featured)
        const remainingCommunities = this.filteredCommunities.slice(12);
        
        if (remainingCommunities.length === 0 && this.filteredCommunities.length <= 12) {
            return; // Only featured communities, no additional list needed
        }

        if (remainingCommunities.length === 0 && !append) {
            const noCommunities = DOM.createElement('div', {
                className: 'text-center text-muted py-4'
            }, 'No additional communities found');
            this.elements.communitiesContainer.appendChild(noCommunities);
            return;
        }

        remainingCommunities.forEach(community => {
            const communityRow = this.createCommunityListItem(community);
            this.elements.communitiesContainer.appendChild(communityRow);
        });
    }

    /**
     * Create a community card for featured section
     */
    createCommunityCard(community) {
        const cardCol = DOM.createElement('div', { className: 'col-md-6 col-xl-4 mb-3' });
        
        const card = DOM.createElement('div', { 
            className: 'card h-100 community-card shadow-sm border-0',
            style: 'cursor: pointer; transition: all 0.2s ease;'
        });
        
        // Add hover effects
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 2px 10px rgba(0,0,0,0.08)';
        });
        
        // Card header with icon and title
        const cardHeader = DOM.createElement('div', { 
            className: 'card-header border-0 bg-transparent',
            style: 'padding: 0.5rem 0.75rem 0.25rem 0.75rem;'
        });
        
        const headerContent = DOM.createElement('div', { 
            className: 'd-flex align-items-start',
            style: 'gap: 0.5rem;'
        });
        
        // Community icon
        const iconContainer = DOM.createElement('div', { className: 'flex-shrink-0' });
        if (community.icon) {
            const icon = DOM.createElement('img', {
                src: community.icon,
                className: 'rounded',
                style: 'width: 36px; height: 36px; object-fit: cover; border: 2px solid var(--bs-border-color);',
                alt: `${community.title} icon`
            });
            iconContainer.appendChild(icon);
        } else {
            const defaultIcon = DOM.createElement('div', {
                className: 'bg-primary rounded d-flex align-items-center justify-content-center text-white fw-bold',
                style: 'width: 36px; height: 36px; font-size: 16px; border: 2px solid var(--bs-border-color);'
            }, community.name.charAt(0).toUpperCase());
            iconContainer.appendChild(defaultIcon);
        }
        headerContent.appendChild(iconContainer);
        
        // Title and name container
        const titleContainer = DOM.createElement('div', { className: 'flex-grow-1 min-width-0' });
        
        const titleRow = DOM.createElement('div', { className: 'd-flex align-items-start justify-content-between' });
        
        const titleText = DOM.createElement('div', { className: 'me-2' });
        const title = DOM.createElement('h5', { 
            className: 'card-title mb-1 fw-bold',
            style: 'font-size: 0.95rem; line-height: 1.15; color: var(--bs-emphasis-color); margin-bottom: 0.125rem;'
        }, this.truncateText(community.title, 35));
        
        const subtitle = DOM.createElement('p', { 
            className: 'text-muted mb-0 small',
            style: 'font-size: 0.75rem; margin-bottom: 0.125rem;'
        }, `!${community.name}`);
        
        titleText.appendChild(title);
        titleText.appendChild(subtitle);
        titleRow.appendChild(titleText);

        // Instance badge for federated communities
        if (!community.local) {
            const instanceBadge = DOM.createElement('span', {
                className: 'badge bg-info text-dark flex-shrink-0',
                style: 'font-size: 0.6rem; padding: 0.2em 0.4em; line-height: 1.1;'
            }, community.instance.host);
            titleRow.appendChild(instanceBadge);
        }
        
        titleContainer.appendChild(titleRow);
        headerContent.appendChild(titleContainer);
        cardHeader.appendChild(headerContent);
        card.appendChild(cardHeader);
        
        // Card body with description
        const cardBody = DOM.createElement('div', { 
            className: 'card-body',
            style: 'padding: 0.25rem 0.75rem;'
        });
        
        if (community.description) {
            const description = DOM.createElement('p', { 
                className: 'card-text text-muted mb-2',
                style: 'font-size: 0.8rem; line-height: 1.3; height: 2.6em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; margin-bottom: 0.25rem;'
            }, community.description);
            cardBody.appendChild(description);
        } else {
            // Add minimal spacing even without description
            const spacer = DOM.createElement('div', { style: 'height: 2.6em;' });
            cardBody.appendChild(spacer);
        }
        
        card.appendChild(cardBody);
        
        // Card footer with stats
        const cardFooter = DOM.createElement('div', { 
            className: 'card-footer border-0 mt-auto',
            style: 'padding: 0.5rem 0.75rem; background-color: var(--card-bg); border-top: 1px solid var(--border-color);'
        });
        
        const statsRow = DOM.createElement('div', { 
            className: 'row text-center',
            style: 'margin: 0; gap: 0;'
        });
        
        const stats = [
            { value: community.stats.subscribers, label: 'Members', icon: 'bi-people' },
            { value: community.stats.posts, label: 'Posts', icon: 'bi-file-text' },
            { value: community.stats.users_active_month, label: 'Active', icon: 'bi-activity' }
        ];
        
        stats.forEach(stat => {
            const statCol = DOM.createElement('div', { 
                className: 'col-4',
                style: 'padding: 0 0.125rem;'
            });
            
            const statContainer = DOM.createElement('div', { 
                className: 'd-flex flex-column align-items-center',
                style: 'gap: 0.05rem;'
            });
            
            const statValue = DOM.createElement('div', { 
                className: 'fw-bold',
                style: 'font-size: 0.9rem; color: var(--bs-emphasis-color); margin-bottom: 0.1rem;'
            }, APIUtils.formatNumber(stat.value));
            
            const statLabel = DOM.createElement('small', { 
                className: 'text-muted d-flex align-items-center',
                style: 'font-size: 0.7rem;'
            });
            
            const statIcon = DOM.createElement('i', { 
                className: `${stat.icon} me-1`,
                style: 'font-size: 0.65rem;'
            });
            
            statLabel.appendChild(statIcon);
            statLabel.appendChild(document.createTextNode(stat.label));
            
            statContainer.appendChild(statValue);
            statContainer.appendChild(statLabel);
            statCol.appendChild(statContainer);
            statsRow.appendChild(statCol);
        });
        
        cardFooter.appendChild(statsRow);
        card.appendChild(cardFooter);
        
        // Click handler
        card.addEventListener('click', () => {
            this.navigateToCommunity(community);
        });
        
        cardCol.appendChild(card);
        return cardCol;
    }

    /**
     * Create a community list item for the main list
     */
    createCommunityListItem(community) {
        const item = DOM.createElement('div', { 
            className: 'card mb-3 community-list-item border-0 shadow-sm',
            style: 'cursor: pointer; transition: all 0.2s ease; border-radius: 8px;'
        });
        
        // Add hover effects
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateX(4px)';
            item.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.transform = 'translateX(0)';
            item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
        });
        
        const cardBody = DOM.createElement('div', { className: 'card-body py-4 px-4' });
        
        const row = DOM.createElement('div', { className: 'row align-items-center' });
        
        // Icon and title column
        const titleCol = DOM.createElement('div', { className: 'col-lg-8 col-md-7' });
        const titleContainer = DOM.createElement('div', { className: 'd-flex align-items-center' });
        
        // Community icon
        const iconContainer = DOM.createElement('div', { className: 'me-3 flex-shrink-0' });
        if (community.icon) {
            const icon = DOM.createElement('img', {
                src: community.icon,
                className: 'rounded',
                style: 'width: 56px; height: 56px; object-fit: cover; border: 2px solid var(--bs-border-color);',
                alt: `${community.title} icon`
            });
            iconContainer.appendChild(icon);
        } else {
            const defaultIcon = DOM.createElement('div', {
                className: 'bg-primary rounded d-flex align-items-center justify-content-center text-white fw-bold',
                style: 'width: 56px; height: 56px; font-size: 24px; border: 2px solid var(--bs-border-color);'
            }, community.name.charAt(0).toUpperCase());
            iconContainer.appendChild(defaultIcon);
        }
        titleContainer.appendChild(iconContainer);
        
        // Text content
        const textContainer = DOM.createElement('div', { className: 'flex-grow-1 min-width-0' });
        
        const titleRow = DOM.createElement('div', { className: 'd-flex align-items-center justify-content-between mb-1' });
        
        const titleText = DOM.createElement('div', { className: 'me-2' });
        const title = DOM.createElement('h5', { 
            className: 'mb-0 fw-bold',
            style: 'font-size: 1.15rem; color: var(--bs-emphasis-color);'
        }, community.title);
        titleText.appendChild(title);
        titleRow.appendChild(titleText);

        // Instance badge for federated communities
        if (!community.local) {
            const instanceBadge = DOM.createElement('span', {
                className: 'badge bg-info text-dark flex-shrink-0',
                style: 'font-size: 0.7rem; padding: 0.35em 0.65em;'
            }, community.instance.host);
            titleRow.appendChild(instanceBadge);
        }
        
        textContainer.appendChild(titleRow);
        
        const subtitle = DOM.createElement('p', { 
            className: 'text-muted mb-2 small',
            style: 'font-size: 0.9rem;'
        }, `!${community.name}`);
        textContainer.appendChild(subtitle);
        
        // Description if available
        if (community.description) {
            const description = DOM.createElement('p', { 
                className: 'text-muted mb-0 small',
                style: 'font-size: 0.85rem; line-height: 1.4; opacity: 0.8;'
            }, this.truncateText(community.description, 120));
            textContainer.appendChild(description);
        }
        
        titleContainer.appendChild(textContainer);
        titleCol.appendChild(titleContainer);
        
        // Stats column
        const statsCol = DOM.createElement('div', { className: 'col-lg-4 col-md-5 mt-3 mt-md-0' });
        const statsContainer = DOM.createElement('div', { className: 'row g-3 text-center' });
        
        const stats = [
            { value: community.stats.subscribers, label: 'Members', icon: 'bi-people', color: 'text-primary' },
            { value: community.stats.posts, label: 'Posts', icon: 'bi-file-text', color: 'text-success' },
            { value: community.stats.users_active_month, label: 'Active', icon: 'bi-activity', color: 'text-warning' }
        ];
        
        stats.forEach(stat => {
            const statCol = DOM.createElement('div', { className: 'col-4' });
            
            const statContainer = DOM.createElement('div', { className: 'd-flex flex-column align-items-center' });
            
            const statValue = DOM.createElement('div', { 
                className: `fw-bold mb-1 ${stat.color}`,
                style: 'font-size: 1.1rem;'
            }, APIUtils.formatNumber(stat.value));
            
            const statLabel = DOM.createElement('small', { 
                className: 'text-muted d-flex align-items-center justify-content-center',
                style: 'font-size: 0.75rem;'
            });
            
            const statIcon = DOM.createElement('i', { 
                className: `${stat.icon} me-1`,
                style: 'font-size: 0.7rem;'
            });
            
            statLabel.appendChild(statIcon);
            statLabel.appendChild(document.createTextNode(stat.label));
            
            statContainer.appendChild(statValue);
            statContainer.appendChild(statLabel);
            statCol.appendChild(statContainer);
            statsContainer.appendChild(statCol);
        });
        
        statsCol.appendChild(statsContainer);
        
        row.appendChild(titleCol);
        row.appendChild(statsCol);
        cardBody.appendChild(row);
        item.appendChild(cardBody);
        
        // Click handler
        item.addEventListener('click', () => {
            this.navigateToCommunity(community);
        });
        
        return item;
    }

    /**
     * Navigate to a specific community
     */
    navigateToCommunity(community) {
        // Navigate directly to community page without using router to avoid URL conflicts
        window.location.href = `/c/${community.name}`;
    }

    /**
     * Update communities count badge
     */
    updateCommunitiesCount() {
        if (this.elements.communitiesCount) {
            this.elements.communitiesCount.textContent = this.filteredCommunities.length.toLocaleString();
        }
    }

    /**
     * Handle filter changes and reset pagination for infinite scroll
     */
    async handleFilterChange(filterType, value) {
        this.currentFilters[filterType] = value;
        
        if (filterType === 'type' || filterType === 'sort') {
            // These require a new API call - reset pagination
            this.currentPage = 1;
            this.hasMoreCommunities = true;
            await this.loadCommunities();
        } else {
            // Search can be applied to existing data
            this.applyFilters();
            this.renderFeaturedCommunities();
            this.renderAllCommunities();
            this.updateCommunitiesCount();
        }
    }

    /**
     * Load instance statistics for communities stats sidebar
     */
    async loadInstanceStats() {
        try {
            const stats = await this.api.getInstanceStats();
            this.renderCommunitiesStats(stats);
        } catch (error) {
            console.error('Failed to load instance stats:', error);
        }
    }

    /**
     * Render communities-specific statistics
     */
    renderCommunitiesStats(stats) {
        const containers = [this.elements.communitiesStats, this.elements.mobileCommunitiesStats].filter(Boolean);
        
        containers.forEach(container => {
            DOM.clearChildren(container);
            
            const statsGrid = DOM.createElement('div', { className: 'row text-center' });
            
            const communitiesCol = DOM.createElement('div', { className: 'col-6' });
            communitiesCol.appendChild(DOM.createElement('div', { className: 'fw-bold h5 mb-0' }, stats.communities.toLocaleString()));
            communitiesCol.appendChild(DOM.createElement('small', { className: 'text-muted' }, 'Communities'));
            
            const usersCol = DOM.createElement('div', { className: 'col-6' });
            usersCol.appendChild(DOM.createElement('div', { className: 'fw-bold h5 mb-0' }, stats.users.toLocaleString()));
            usersCol.appendChild(DOM.createElement('small', { className: 'text-muted' }, 'Users'));
            
            statsGrid.appendChild(communitiesCol);
            statsGrid.appendChild(usersCol);
            container.appendChild(statsGrid);
        });
    }

    /**
     * Handle instance change
     */
    async handleInstanceChange(instanceName) {
        if (instanceName === this.state.currentInstance) return;
        
        this.state.currentInstance = instanceName;
        setCurrentInstance(instanceName);
        
        this.setupAPI();
        this.updatePageTitle();
        await this.loadInitialData();
    }

    // Theme and navigation handling moved to navbar component

    /**
     * Show loading spinner in container
     */
    showLoadingInContainer() {
        if (!this.elements.communitiesContainer) return;
        
        DOM.clearChildren(this.elements.communitiesContainer);
        const loadingDiv = DOM.createElement('div', {
            className: 'd-flex justify-content-center p-4'
        });
        const spinner = DOM.createElement('div', {
            className: 'spinner-border',
            role: 'status'
        });
        const srText = DOM.createElement('span', {
            className: 'visually-hidden'
        }, 'Loading communities...');
        
        spinner.appendChild(srText);
        loadingDiv.appendChild(spinner);
        this.elements.communitiesContainer.appendChild(loadingDiv);
    }

    /**
     * Hide loading spinner from container
     */
    hideLoadingInContainer() {
        // Loading will be cleared when new content is rendered
    }

    /**
     * Show loading indicator at bottom for infinite scroll
     */
    showBottomLoading() {
        if (!this.elements.communitiesContainer) return;
        
        // Remove existing bottom loading if present
        const existingLoader = this.elements.communitiesContainer.querySelector('.bottom-loading');
        if (existingLoader) {
            existingLoader.remove();
        }
        
        const loadingDiv = DOM.createElement('div', {
            className: 'd-flex justify-content-center p-4 bottom-loading'
        });
        const spinner = DOM.createElement('div', {
            className: 'spinner-border spinner-border-sm',
            role: 'status'
        });
        const srText = DOM.createElement('span', {
            className: 'visually-hidden'
        }, 'Loading more communities...');
        
        spinner.appendChild(srText);
        loadingDiv.appendChild(spinner);
        this.elements.communitiesContainer.appendChild(loadingDiv);
    }

    /**
     * Hide bottom loading indicator
     */
    hideBottomLoading() {
        if (!this.elements.communitiesContainer) return;
        
        const loadingDiv = this.elements.communitiesContainer.querySelector('.bottom-loading');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        DOM.showToast(message, 'error');
    }

    // Instance modal methods moved to navbar component

    /**
     * Truncate text to specified length
     */
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    /**
     * Handle route changes
     */
    handleRouteChange() {
        // Handle any route-specific logic here
        console.log('Route changed');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.lemmericCommunitiesApp = new LemmericCommunitiesApp();
});

export { LemmericCommunitiesApp }; 