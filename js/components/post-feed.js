/**
 * PostFeed Component for Lemmeric
 * 
 * This module provides a reusable component for displaying post feeds across different pages.
 * It handles data fetching, pagination, infinite scrolling, and post rendering with a
 * consistent interface for all post feed implementations.
 * 
 * @fileoverview Reusable post feed component with pagination and infinite scroll
 */

// Core utilities and configuration
import { DOM } from '../utils.js';
import { CONFIG } from '../config.js';

// Components
import { PostListManager } from './post.js';

/**
 * PostFeed component class
 * 
 * Manages post feed display with pagination, infinite scroll, and data fetching
 */
export class PostFeed {
    /**
     * Initialize the PostFeed component
     * @param {HTMLElement} container - Container element for the feed
     * @param {Object} options - Configuration options
     */
    constructor(container, options = {}) {
        // Required container element
        this.container = container;
        
        // Configuration options
        this.options = {
            // Data fetching function - must be provided
            fetchFunction: null,
            
            // Pagination options
            initialPage: 1,
            pageSize: CONFIG.DEFAULT_PAGE_SIZE || 20,
            
            // UI options
            emptyMessage: 'No posts found',
            emptyDescription: 'There are no posts to display.',
            emptyIcon: 'bi-inbox',
            loadingMessage: 'Loading posts...',
            
            // Behavior options
            enableInfiniteScroll: true,
            showCommunityInfo: false, // Whether to show community info in posts
            
            // Callbacks
            onLoadStart: null,
            onLoadComplete: null,
            onLoadError: null,
            onPostsLoaded: null,
            
            ...options
        };
        
        // State
        this.state = {
            isLoading: false,
            hasMorePosts: true,
            currentPage: this.options.initialPage,
            posts: [],
            initialLoadComplete: false // Track if initial load is complete
        };
        

        
        // Managers
        this.postListManager = new PostListManager(this.container);
        
        // Bind methods
        this.loadPosts = this.loadPosts.bind(this);
        this.loadMorePosts = this.loadMorePosts.bind(this);
        this.refresh = this.refresh.bind(this);
        
        // Don't setup infinite scroll immediately - wait for initial load
        // this.setupInfiniteScroll() will be called after first successful load
    }
    
    /**
     * Setup infinite scroll
     */
    setupInfiniteScroll() {
        // Only setup infinite scroll if we have posts and infinite scroll is enabled
        if (this.state.posts.length === 0 || !this.options.enableInfiniteScroll) {
            console.log('PostFeed: Skipping infinite scroll setup - no posts or disabled');
            return;
        }
        
        // Create scroll observer
        this.scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && this.state.hasMorePosts && !this.state.isLoading) {
                    console.log('PostFeed: Infinite scroll triggered, loading more posts');
                    this.loadMorePosts();
                }
            });
        }, {
            rootMargin: '100px' // Trigger 100px before reaching the bottom
        });
        
        // Create sentinel element for infinite scroll
        this.scrollSentinel = DOM.createElement('div', {
            className: 'scroll-sentinel',
            style: 'height: 1px; margin-top: 20px;'
        });
        
        if (this.container) {
            this.container.appendChild(this.scrollSentinel);
        }
        
        this.scrollObserver.observe(this.scrollSentinel);
        console.log('PostFeed: Infinite scroll setup complete');
    }
    
    // ========================================
    // DATA LOADING METHODS
    // ========================================

    /**
     * Load posts for the feed
     * @param {boolean} reset - Whether to reset the feed (start from page 1)
     * @param {Object} params - Additional parameters to pass to fetch function
     * @async
     */
    async loadPosts(reset = true, params = {}) {
        if (this.state.isLoading) return;
        
        if (!this.options.fetchFunction) {
            console.error('PostFeed: fetchFunction is required');
            return;
        }
        
        try {
            this.state.isLoading = true;
            
            // Call onLoadStart callback
            if (this.options.onLoadStart) {
                this.options.onLoadStart();
            }
            
            if (reset) {
                this.state.currentPage = this.options.initialPage;
                this.state.hasMorePosts = true;
                this.state.posts = [];
                this.postListManager.clearPosts();
                this.showLoading();
                console.log('PostFeed reset: currentPage set to', this.state.currentPage);
            }
            
            // Call the fetch function with current parameters
            const fetchParams = {
                page: this.state.currentPage,
                limit: this.options.pageSize,
                ...params
            };
            
            console.log('PostFeed fetchParams:', fetchParams, 'reset:', reset);
            
            const response = await this.options.fetchFunction(fetchParams);
            
            if (reset) {
                DOM.clearChildren(this.container);
            }
            
            // Handle the response
            if (response && response.posts && response.posts.length > 0) {
                this.state.posts = reset ? response.posts : [...this.state.posts, ...response.posts];
                this.postListManager.addPosts(response.posts);
                this.state.hasMorePosts = response.posts.length === this.options.pageSize;
                
                console.log('PostFeed loaded', response.posts.length, 'posts, hasMore:', this.state.hasMorePosts);
                
                // Enable infinite scroll after initial load is complete
                if (reset && this.options.enableInfiniteScroll && !this.state.initialLoadComplete) {
                    this.setupInfiniteScroll();
                    this.state.initialLoadComplete = true;
                    console.log('PostFeed infinite scroll enabled after initial load');
                }
                
                // Ensure scroll sentinel stays at the bottom after adding posts
                if (this.scrollSentinel && this.scrollSentinel.parentElement) {
                    this.scrollSentinel.parentElement.appendChild(this.scrollSentinel);
                }
                
                // Call onPostsLoaded callback
                if (this.options.onPostsLoaded) {
                    this.options.onPostsLoaded(response.posts, this.state.posts.length);
                }
            } else {
                this.state.hasMorePosts = false;
                if (reset && this.state.posts.length === 0) {
                    this.showEmpty();
                }
            }
            
            this.hideLoading();
            
            // Call onLoadComplete callback
            if (this.options.onLoadComplete) {
                this.options.onLoadComplete(response);
            }
            
        } catch (error) {
            console.error('PostFeed: Failed to load posts:', error);
            
            if (reset) {
                this.showError(`Failed to load posts: ${error.message}`);
            } else {
                DOM.showToast('Failed to load more posts', 'error');
            }
            
            // Call onLoadError callback
            if (this.options.onLoadError) {
                this.options.onLoadError(error);
            }
        } finally {
            this.state.isLoading = false;
        }
    }
    
    /**
     * Load more posts (for infinite scroll)
     */
    async loadMorePosts(params = {}) {
        if (this.state.isLoading || !this.state.hasMorePosts) {
            console.log('PostFeed: loadMorePosts skipped - loading:', this.state.isLoading, 'hasMore:', this.state.hasMorePosts);
            return;
        }
        
        console.log('PostFeed: Loading more posts, current page:', this.state.currentPage);
        this.state.currentPage++;
        await this.loadPosts(false, params);
    }
    
    /**
     * Refresh the feed
     */
    async refresh(params = {}) {
        await this.loadPosts(true, params);
        DOM.showToast('Posts refreshed', 'success');
    }
    
    /**
     * Update fetch parameters and reload
     */
    async updateParams(params = {}) {
        await this.loadPosts(true, params);
    }
    
    /**
     * Show loading state
     */
    showLoading() {
        if (this.state.posts.length === 0) {
            this.container.innerHTML = `
                <div class="d-flex justify-content-center p-4">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">${this.options.loadingMessage}</span>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingDiv = this.container.querySelector('.d-flex.justify-content-center');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }
    
    /**
     * Show empty state
     */
    showEmpty() {
        this.container.innerHTML = `
            <div class="text-center py-5">
                <div class="mb-3">
                    <i class="${this.options.emptyIcon} display-1 text-muted"></i>
                </div>
                <h5 class="text-muted">${this.options.emptyMessage}</h5>
                <p class="text-muted">${this.options.emptyDescription}</p>
            </div>
        `;
    }
    
    /**
     * Show error state
     */
    showError(message) {
        this.container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                ${message}
            </div>
        `;
    }
    
    /**
     * Get current posts
     */
    getPosts() {
        return this.state.posts;
    }
    
    /**
     * Get loading state
     */
    isLoading() {
        return this.state.isLoading;
    }
    
    /**
     * Get whether there are more posts to load
     */
    hasMore() {
        return this.state.hasMorePosts;
    }
    
    /**
     * Mark a post as viewed
     */
    markPostAsViewed(postId) {
        this.postListManager.markAsViewed(postId);
    }
    
    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Clear all posts from the feed
     */
    clear() {
        this.state.posts = [];
        this.state.currentPage = this.options.initialPage;
        this.state.hasMorePosts = true;
        this.state.initialLoadComplete = false; // Reset infinite scroll state
        this.postListManager.clearPosts();
        DOM.clearChildren(this.container);
        
        // Clean up existing infinite scroll if it exists
        if (this.scrollObserver) {
            this.scrollObserver.disconnect();
            this.scrollObserver = null;
        }
        if (this.scrollSentinel && this.scrollSentinel.parentElement) {
            this.scrollSentinel.parentElement.removeChild(this.scrollSentinel);
            this.scrollSentinel = null;
        }
        
        console.log('PostFeed cleared, infinite scroll reset');
    }
    
    /**
     * Enable infinite scroll
     */
    enableInfiniteScroll() {
        if (!this.scrollObserver) {
            this.options.enableInfiniteScroll = true; // Update the option
            this.setupInfiniteScroll();
        }
    }
    
    /**
     * Destroy the post feed
     */
    destroy() {
        // Clean up scroll observer
        if (this.scrollObserver) {
            this.scrollObserver.disconnect();
        }
        
        // Remove scroll sentinel
        if (this.scrollSentinel && this.scrollSentinel.parentElement) {
            this.scrollSentinel.parentElement.removeChild(this.scrollSentinel);
        }
        
        // Clean up post list manager
        if (this.postListManager) {
            this.postListManager.destroy();
        }
        
        // Clear references
        this.container = null;
        this.options = null;
        this.state = null;
        this.postListManager = null;
        this.scrollObserver = null;
        this.scrollSentinel = null;
    }
} 