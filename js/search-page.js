/**
 * Search Page Component
 * Handles search functionality and results display
 */

import { LemmyAPI } from './api.js';
import { getCurrentInstance } from './config.js';
import { DOM } from './utils.js';
import { router } from './router.js';

class SearchPage {
    constructor() {
        this.api = null;
        this.currentPage = 1;
        this.currentSearchParams = null;
        this.searchResults = [];
        this.isLoading = false;
        this.hasMoreResults = false;
        
        this.elements = {};
        this.init();
    }

    /**
     * Initialize the search page
     */
    async init() {
        try {
            this.api = new LemmyAPI(getCurrentInstance());
            this.bindElements();
            this.setupEventListeners();
            
            // Ensure we're showing the new layout
            this.ensureNewLayout();
            
            // Load search from URL
            this.loadSearchFromURL();
            
            console.log('Search page initialized successfully');
        } catch (error) {
            console.error('Failed to initialize search page:', error);
            this.showError('Failed to initialize search page');
        }
    }

    /**
     * Bind DOM elements
     */
    bindElements() {
        this.elements = {
            searchForm: document.getElementById('search-filters-form'),
            searchQuery: document.getElementById('search-query'),
            searchType: document.getElementById('search-type'),
            searchSort: document.getElementById('search-sort'),
            searchListing: document.getElementById('search-listing'),
            searchSubmit: document.getElementById('search-submit'),
            searchResultsContainer: document.getElementById('search-results-container'),
            searchLoading: document.getElementById('search-loading'),
            searchNoResults: document.getElementById('search-no-results'),
            searchError: document.getElementById('search-error'),
            searchErrorMessage: document.getElementById('search-error-message'),
            searchRetry: document.getElementById('search-retry'),
            searchResultsList: document.getElementById('search-results-list'),
            searchLoadMore: document.getElementById('search-load-more'),
            loadMoreBtn: document.getElementById('load-more-btn')
        };
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search form submission
        if (this.elements.searchForm) {
            this.elements.searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.performSearch();
            });
        }



        // Retry button
        if (this.elements.searchRetry) {
            this.elements.searchRetry.addEventListener('click', () => {
                this.performSearch();
            });
        }

        // Load more button
        if (this.elements.loadMoreBtn) {
            this.elements.loadMoreBtn.addEventListener('click', () => {
                this.loadMoreResults();
            });
        }

        // Handle URL changes
        window.addEventListener('popstate', () => {
            this.loadSearchFromURL();
        });

        // Listen for navbar search submissions
        window.addEventListener('navbar:search', (event) => {
            const query = event.detail.query;
            if (query && this.elements.searchQuery) {
                this.elements.searchQuery.value = query;
                this.performSearch();
            }
        });
    }

    /**
     * Load search parameters from URL
     */
    loadSearchFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        const type = urlParams.get('type') || 'All';
        const sort = urlParams.get('sort') || 'TopAll';
        const listing = urlParams.get('listing') || 'All';

        if (query) {
            this.elements.searchQuery.value = query;
            this.elements.searchType.value = type;
            this.elements.searchSort.value = sort;
            this.elements.searchListing.value = listing;
            
            // Also update the navbar search input if available
            // Wait a bit for navbar to be ready
            setTimeout(() => {
                if (window.navbar && window.navbar.elements && window.navbar.elements.searchInput) {
                    window.navbar.elements.searchInput.value = query;
                }
            }, 100);
            
            // Perform the search
            this.performSearch();
        }
    }

    /**
     * Perform search with current parameters
     */
    async performSearch() {
        const query = this.elements.searchQuery.value.trim();
        if (!query) return;

        const searchParams = {
            query: query,
            type: this.elements.searchType.value,
            sort: this.elements.searchSort.value,
            listingType: this.elements.searchListing.value,
            page: 1,
            limit: 20
        };

        this.currentSearchParams = searchParams;
        this.currentPage = 1;
        this.searchResults = [];

        // Update URL
        const queryString = new URLSearchParams({
            q: query,
            type: searchParams.type,
            sort: searchParams.sort,
            listing: searchParams.listing
        }).toString();
        
        router.navigate(`/search?${queryString}`, true);

        // Perform search
        await this.executeSearch(searchParams);
    }

    /**
     * Execute search API call
     */
    async executeSearch(searchParams) {
        try {
            this.setLoading(true);
            this.hideAllStates();

            const response = await this.api.search(searchParams);
            
            if (response.error) {
                throw new Error(response.error);
            }

            this.processSearchResults(response, true);
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showError(error.message || 'Search failed. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Load more search results
     */
    async loadMoreResults() {
        if (this.isLoading || !this.hasMoreResults) return;

        try {
            this.setLoading(true);
            
            const nextPageParams = {
                ...this.currentSearchParams,
                page: this.currentPage + 1
            };

            const response = await this.api.search(nextPageParams);
            
            if (response.error) {
                throw new Error(response.error);
            }

            this.processSearchResults(response, false);
            this.currentPage++;
            
        } catch (error) {
            console.error('Failed to load more results:', error);
            this.showError('Failed to load more results. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Process search results from API response
     */
    processSearchResults(response, isNewSearch) {
        if (isNewSearch) {
            this.searchResults = [];
        }

        // Extract results based on search type
        let newResults = [];
        if (response.posts) {
            newResults = response.posts.map(post => ({ ...post, resultType: 'post' }));
        }
        if (response.comments) {
            newResults = [...newResults, ...response.comments.map(comment => ({ ...comment, resultType: 'comment' }))];
        }
        if (response.communities) {
            newResults = [...newResults, ...response.communities.map(community => ({ ...community, resultType: 'community' }))];
        }
        if (response.users) {
            newResults = [...newResults, ...response.users.map(user => ({ ...user, resultType: 'user' }))];
        }

        this.searchResults = [...this.searchResults, ...newResults];
        this.hasMoreResults = newResults.length >= 20; // Assuming 20 is the limit

        this.renderSearchResults();
        this.updateLoadMoreButton();
    }

    /**
     * Render search results
     */
    renderSearchResults() {
        if (!this.elements.searchResultsList) return;

        if (this.searchResults.length === 0) {
            this.showNoResults();
            return;
        }

        this.elements.searchResultsList.style.display = 'block';
        this.elements.searchResultsList.innerHTML = '';

        this.searchResults.forEach((result, index) => {
            const resultElement = this.createResultElement(result, index);
            this.elements.searchResultsList.appendChild(resultElement);
        });
    }

    /**
     * Create a single search result element
     */
    createResultElement(result, index) {
        const resultDiv = DOM.createElement('div', {
            className: 'card mb-3 search-result-item'
        });

        switch (result.resultType) {
            case 'post':
                return this.createPostResult(result, resultDiv);
            case 'comment':
                return this.createCommentResult(result, resultDiv);
            case 'community':
                return this.createCommunityResult(result, resultDiv);
            case 'user':
                return this.createUserResult(result, resultDiv);
            default:
                return this.createGenericResult(result, resultDiv);
        }
    }

    /**
     * Create post search result
     */
    createPostResult(post, container) {
        const postData = post.post;
        const communityData = post.community;
        const creatorData = post.creator;
        const counts = post.counts;

        container.innerHTML = `
            <div class="card-body">
                <div class="d-flex align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-2">
                            <span class="badge bg-primary me-2">Post</span>
                            <small class="text-muted">
                                <i class="bi bi-people me-1"></i>
                                <a href="#" class="text-decoration-none community-link" data-community="${communityData.name}@${communityData.actor_id.split('/')[2]}">
                                    c/${communityData.name}
                                </a>
                                <span class="mx-1">•</span>
                                <i class="bi bi-person me-1"></i>
                                <a href="#" class="text-decoration-none user-link" data-user="${creatorData.name}@${creatorData.actor_id.split('/')[2]}">
                                    u/${creatorData.name}
                                </a>
                            </small>
                        </div>
                        <h5 class="card-title mb-2">
                            <a href="#" class="text-decoration-none post-link" data-post-id="${postData.id}">
                                ${this.escapeHtml(postData.name)}
                            </a>
                        </h5>
                        ${postData.body ? `<p class="card-text text-muted">${this.escapeHtml(this.truncateText(postData.body, 200))}</p>` : ''}
                        <div class="d-flex align-items-center text-muted small">
                            <span class="me-3">
                                <i class="bi bi-arrow-up me-1"></i>${counts.upvotes}
                            </span>
                            <span class="me-3">
                                <i class="bi bi-chat me-1"></i>${counts.comments}
                            </span>
                            <span>
                                <i class="bi bi-clock me-1"></i>${this.formatRelativeTime(postData.published)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        this.addResultEventListeners(container, post);
        return container;
    }

    /**
     * Create comment search result
     */
    createCommentResult(comment, container) {
        const commentData = comment.comment;
        const postData = comment.post;
        const communityData = comment.community;
        const creatorData = comment.creator;
        const counts = comment.counts;

        container.innerHTML = `
            <div class="card-body">
                <div class="d-flex align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-2">
                            <span class="badge bg-info me-2">Comment</span>
                            <small class="text-muted">
                                <i class="bi bi-people me-1"></i>
                                <a href="#" class="text-decoration-none community-link" data-community="${communityData.name}@${communityData.actor_id.split('/')[2]}">
                                    c/${communityData.name}
                                </a>
                                <span class="mx-1">•</span>
                                <i class="bi bi-person me-1"></i>
                                <a href="#" class="text-decoration-none user-link" data-user="${creatorData.name}@${creatorData.actor_id.split('/')[2]}">
                                    u/${creatorData.name}
                                </a>
                            </small>
                        </div>
                        <h6 class="card-title mb-2">
                            <a href="#" class="text-decoration-none post-link" data-post-id="${postData.id}">
                                ${this.escapeHtml(postData.name)}
                            </a>
                        </h6>
                        <p class="card-text">${this.escapeHtml(this.truncateText(commentData.content, 300))}</p>
                        <div class="d-flex align-items-center text-muted small">
                            <span class="me-3">
                                <i class="bi bi-arrow-up me-1"></i>${counts.upvotes}
                            </span>
                            <span>
                                <i class="bi bi-clock me-1"></i>${this.formatRelativeTime(commentData.published)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        this.addResultEventListeners(container, comment);
        return container;
    }

    /**
     * Create community search result
     */
    createCommunityResult(community, container) {
        const communityData = community.community;
        const counts = community.counts;

        container.innerHTML = `
            <div class="card-body">
                <div class="d-flex align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-2">
                            <span class="badge bg-success me-2">Community</span>
                            <small class="text-muted">
                                ${communityData.local ? '<span class="text-success">Local</span>' : '<span class="text-muted">Remote</span>'}
                            </small>
                        </div>
                        <h5 class="card-title mb-2">
                            <a href="#" class="text-decoration-none community-link" data-community="${communityData.name}@${communityData.actor_id.split('/')[2]}">
                                c/${communityData.name}
                            </a>
                        </h5>
                        ${communityData.description ? `<p class="card-text text-muted">${this.escapeHtml(this.truncateText(communityData.description, 200))}</p>` : ''}
                        <div class="d-flex align-items-center text-muted small">
                            <span class="me-3">
                                <i class="bi bi-people me-1"></i>${counts.subscribers} subscribers
                            </span>
                            <span class="me-3">
                                <i class="bi bi-file-text me-1"></i>${counts.posts} posts
                            </span>
                            <span>
                                <i class="bi bi-clock me-1"></i>${this.formatRelativeTime(communityData.published)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        this.addResultEventListeners(container, community);
        return container;
    }

    /**
     * Create user search result
     */
    createUserResult(user, container) {
        const userData = user.person;
        const counts = user.counts;

        container.innerHTML = `
            <div class="card-body">
                <div class="d-flex align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-2">
                            <span class="badge bg-warning me-2">User</span>
                            <small class="text-muted">
                                ${userData.local ? '<span class="text-success">Local</span>' : '<span class="text-muted">Remote</span>'}
                            </small>
                        </div>
                        <h5 class="card-title mb-2">
                            <a href="#" class="text-decoration-none user-link" data-user="${userData.name}@${userData.actor_id.split('/')[2]}">
                                u/${userData.name}
                            </a>
                        </h5>
                        ${userData.bio ? `<p class="card-text text-muted">${this.escapeHtml(this.truncateText(userData.bio, 200))}</p>` : ''}
                        <div class="d-flex align-items-center text-muted small">
                            <span class="me-3">
                                <i class="bi bi-file-text me-1"></i>${counts.post_count} posts
                            </span>
                            <span class="me-3">
                                <i class="bi bi-chat me-1"></i>${counts.comment_count} comments
                            </span>
                            <span>
                                <i class="bi bi-clock me-1"></i>${this.formatRelativeTime(userData.published)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners
        this.addResultEventListeners(container, user);
        return container;
    }

    /**
     * Create generic result for unknown types
     */
    createGenericResult(result, container) {
        container.innerHTML = `
            <div class="card-body">
                <div class="d-flex align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="card-title mb-2">Unknown Result Type</h6>
                        <p class="card-text text-muted">This result type is not yet supported.</p>
                    </div>
                </div>
            </div>
        `;
        return container;
    }

    /**
     * Add event listeners to result elements
     */
    addResultEventListeners(container, result) {
        // Post links
        const postLinks = container.querySelectorAll('.post-link');
        postLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const postId = link.dataset.postId;
                router.navigate(`/post/${postId}`);
            });
        });

        // Community links
        const communityLinks = container.querySelectorAll('.community-link');
        communityLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const community = link.dataset.community;
                router.navigate(`/c/${community}`);
            });
        });

        // User links
        const userLinks = container.querySelectorAll('.user-link');
        userLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const user = link.dataset.user;
                router.navigate(`/u/${user}`);
            });
        });
    }

    /**
     * Update load more button visibility
     */
    updateLoadMoreButton() {
        if (this.elements.searchLoadMore) {
            this.elements.searchLoadMore.style.display = this.hasMoreResults ? 'block' : 'none';
        }
    }

    /**
     * Set loading state
     */
    setLoading(loading) {
        this.isLoading = loading;
        if (this.elements.searchSubmit) {
            this.elements.searchSubmit.disabled = loading;
            this.elements.searchSubmit.innerHTML = loading ? 
                '<span class="spinner-border spinner-border-sm me-1"></span>Searching...' : 
                '<i class="bi bi-search me-1"></i>Search';
        }
    }

    /**
     * Hide all result states
     */
    hideAllStates() {
        if (this.elements.searchLoading) this.elements.searchLoading.style.display = 'none';
        if (this.elements.searchNoResults) this.elements.searchNoResults.style.display = 'none';
        if (this.elements.searchError) this.elements.searchError.style.display = 'none';
        if (this.elements.searchResultsList) this.elements.searchResultsList.style.display = 'none';
        if (this.elements.searchLoadMore) this.elements.searchLoadMore.style.display = 'none';
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.hideAllStates();
        if (this.elements.searchLoading) this.elements.searchLoading.style.display = 'block';
    }

    /**
     * Show no results state
     */
    showNoResults() {
        this.hideAllStates();
        if (this.elements.searchNoResults) this.elements.searchNoResults.style.display = 'block';
    }

    /**
     * Show error state
     */
    showError(message) {
        this.hideAllStates();
        if (this.elements.searchError) {
            this.elements.searchError.style.display = 'block';
            if (this.elements.searchErrorMessage) {
                this.elements.searchErrorMessage.textContent = message;
            }
        }
    }

    /**
     * Ensure the new sidebar layout is properly displayed
     */
    ensureNewLayout() {
        // Check if we have the proper sidebar structure
        const sidebar = document.querySelector('.search-sidebar');
        const resultsArea = document.querySelector('.search-results-area');
        
        if (!sidebar || !resultsArea) {
            console.warn('New layout not detected, forcing page reload');
            // If the new layout isn't detected, reload the page to get the fresh HTML
            window.location.reload();
            return;
        }
        
        console.log('New sidebar layout detected and ready');
    }

    /**
     * Utility functions
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    formatRelativeTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }
}

// Initialize search page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.lemmericSearchPage = new SearchPage();
});
