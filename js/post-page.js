/**
 * Post Page controller for Lemmeric
 * Handles the dedicated post page functionality
 */

import { PostDetailComponent } from './components/post-detail.js';
import { CommunitySidebarComponent } from './components/community-sidebar.js';
import { APIUtils, LemmyAPI } from './api.js';
import { getCurrentInstance, setCurrentInstance, getAllInstances, addCustomInstance } from './config.js';
import { DOM } from './utils.js';

class PostPage {
    constructor() {
        this.api = null;
        this.currentPostId = null;
        this.elements = {};
        this.init();
    }

    /**
     * Initialize the post page
     */
    async init() {
        try {
            // Get DOM elements
            this.cacheElements();
            
            // Initialize theme and instance selector
            this.initializeTheme();
            this.initializeInstanceSelector();
            
            // Initialize API
            this.api = new LemmyAPI(getCurrentInstance());
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Extract post ID from URL and load post
            await this.handleRoute();
            
        } catch (error) {
            console.error('Failed to initialize post page:', error);
            this.showError('Failed to initialize the page');
        }
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            postContainer: document.getElementById('post-container'),
            communitySidebarContainer: document.getElementById('community-sidebar-container'),
            instanceSelector: document.getElementById('instance-selector'),
            addInstanceBtn: document.getElementById('add-instance-btn'),
            themeToggle: document.getElementById('theme-toggle'),
            navHome: document.getElementById('nav-home'),
            siteTitle: document.getElementById('site-title')
        };
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Instance selector
        if (this.elements.instanceSelector) {
            this.elements.instanceSelector.addEventListener('change', this.handleInstanceChange.bind(this));
        }

        // Add instance button
        if (this.elements.addInstanceBtn) {
            this.elements.addInstanceBtn.addEventListener('click', this.handleAddInstance.bind(this));
        }

        // Theme toggle
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', this.handleThemeToggle.bind(this));
        }

        // Navigation
        if (this.elements.navHome) {
            this.elements.navHome.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/';
            });
        }

        if (this.elements.siteTitle) {
            this.elements.siteTitle.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = '/';
            });
        }
    }

    /**
     * Handle the current route and extract post ID
     */
    async handleRoute() {
        const path = window.location.pathname;
        
        // Handle both /post/123 and /post.html?id=123 formats (legacy support)
        let postId = null;
        
        // First try to extract from URL path like /post/123
        const pathMatch = path.match(/^\/post\/(\d+)$/);
        if (pathMatch) {
            postId = parseInt(pathMatch[1], 10);
        }
        // Fallback to query parameter for /post.html?id=123 (legacy support)
        else if (path.includes('post.html')) {
            const urlParams = new URLSearchParams(window.location.search);
            const idParam = urlParams.get('id');
            if (idParam) {
                postId = parseInt(idParam, 10);
            }
        }
        
        if (postId && !isNaN(postId)) {
            this.currentPostId = postId;
            
            // Update page title
            document.title = `Lemmeric - Post ${postId}`;
            
            // Load and display the post
            await this.loadPost(postId);
            
            // Handle comment scrolling if there's a hash fragment
            this.handleCommentScrolling();
        } else {
            this.showError('Invalid post URL. Please check the post ID and try again.');
        }
    }

    /**
     * Load and display a post
     * @param {number} postId - The post ID to load
     */
    async loadPost(postId) {
        if (!this.elements.postContainer) {
            console.error('Post container not found');
            return;
        }

        try {
            // Show loading state
            this.showLoading();

            // Fetch post data
            const postData = await this.api.getPost(postId);
            
            if (!postData) {
                throw new Error('Post not found');
            }

            // Create and render post detail component
            const postDetail = new PostDetailComponent(postData);
            const postElement = await postDetail.render();

            // Clear container and add post
            DOM.clearChildren(this.elements.postContainer);
            this.elements.postContainer.appendChild(postElement);

            // Update page title with post title
            if (postData.title || postData.post?.name) {
                document.title = `${postData.title || postData.post.name} - Lemmeric`;
            }

            // Load community sidebar
            await this.loadCommunitySidebar(postData);

            // Handle comment scrolling after everything is loaded
            this.handleCommentScrollingAfterLoad();

        } catch (error) {
            console.error('Failed to load post:', error);
            this.showError(`Failed to load post: ${error.message}`);
        }
    }

    /**
     * Load and display community sidebar
     * @param {Object} postData - Post data containing community information
     */
    async loadCommunitySidebar(postData) {
        if (!this.elements.communitySidebarContainer) {
            console.warn('Community sidebar container not found');
            return;
        }

        try {
            // Extract community info from post data
            const postView = postData.post_view || postData;
            const community = postView.community;
            
            if (!community) {
                console.warn('No community data found in post');
                return;
            }

            // Show loading in sidebar
            this.elements.communitySidebarContainer.innerHTML = `
                <div class="d-flex justify-content-center p-3">
                    <div class="spinner-border spinner-border-sm" role="status">
                        <span class="visually-hidden">Loading community...</span>
                    </div>
                </div>
            `;

            // Get detailed community information
            const communityDetails = await this.api.getCommunityDetails(community.id);
            
            if (!communityDetails) {
                throw new Error('Failed to load community details');
            }

            // Format community data
            const formattedCommunity = APIUtils.formatCommunity(communityDetails.community_view);
            const moderators = communityDetails.moderators || [];

            // Create and render community sidebar
            const communitySidebar = new CommunitySidebarComponent(formattedCommunity, moderators);
            const sidebarElement = communitySidebar.render();

            // Clear container and add sidebar
            DOM.clearChildren(this.elements.communitySidebarContainer);
            this.elements.communitySidebarContainer.appendChild(sidebarElement);

        } catch (error) {
            console.error('Failed to load community sidebar:', error);
            
            // Show error in sidebar
            this.elements.communitySidebarContainer.innerHTML = `
                <div class="alert alert-warning alert-sm" role="alert">
                    <small>Failed to load community information</small>
                </div>
            `;
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (!this.elements.postContainer) return;

        this.elements.postContainer.innerHTML = `
            <div class="d-flex justify-content-center p-4">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading post...</span>
                </div>
            </div>
        `;
    }

    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        if (!this.elements.postContainer) return;

        this.elements.postContainer.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <h4 class="alert-heading">Error</h4>
                <p>${message}</p>
                <hr>
                <p class="mb-0">
                    <a href="/" class="btn btn-primary">
                                                    <i class="bi bi-list-columns me-1"></i>Go to Feed
                    </a>
                </p>
            </div>
        `;
    }

    /**
     * Handle comment scrolling from hash fragment
     */
    handleCommentScrolling() {
        const hash = window.location.hash;
        if (!hash) return;
        
        // Check if it's a comment hash like #comment-12345
        const commentMatch = hash.match(/^#comment-(\d+)$/);
        if (commentMatch) {
            const commentId = commentMatch[1];
            
            // Use a timeout to ensure the DOM is fully rendered
            setTimeout(() => {
                this.scrollToComment(commentId);
            }, 500);
        }
    }

    /**
     * Handle comment scrolling after post and comments are fully loaded
     */
    handleCommentScrollingAfterLoad() {
        const hash = window.location.hash;
        if (!hash) return;
        
        // Check if it's a comment hash like #comment-12345
        const commentMatch = hash.match(/^#comment-(\d+)$/);
        if (commentMatch) {
            const commentId = commentMatch[1];
            
            // Wait for comments to be fully loaded and try multiple times
            this.waitForCommentAndScroll(commentId, 0);
        }
    }

    /**
     * Wait for comment to be available and scroll to it
     * @param {string} commentId - The comment ID to scroll to
     * @param {number} attempt - Current attempt number
     */
    waitForCommentAndScroll(commentId, attempt = 0) {
        const maxAttempts = 10;
        const delay = 500;
        
        // Try to find the comment
        const selectors = [
            `#comment-${commentId}`,
            `[data-comment-id="${commentId}"]`,
            `[id="comment-${commentId}"]`,
            `.comment[data-id="${commentId}"]`
        ];
        
        let commentElement = null;
        for (const selector of selectors) {
            commentElement = document.querySelector(selector);
            if (commentElement) {
                break;
            }
        }
        
        if (commentElement) {
            // Found the comment, scroll to it
            setTimeout(() => {
                this.scrollToComment(commentId);
            }, 100);
            return; // Stop the retry loop once we find and scroll to the comment
        } else if (attempt < maxAttempts) {
            // Comment not found yet, try again
            setTimeout(() => {
                this.waitForCommentAndScroll(commentId, attempt + 1);
            }, delay);
        }
    }

    /**
     * Scroll to a specific comment
     * @param {string} commentId - The comment ID to scroll to
     */
    scrollToComment(commentId) {
        // Try different possible selectors for the comment
        const selectors = [
            `#comment-${commentId}`,
            `[data-comment-id="${commentId}"]`,
            `[id="comment-${commentId}"]`,
            `.comment[data-id="${commentId}"]`
        ];
        
        let commentElement = null;
        for (const selector of selectors) {
            commentElement = document.querySelector(selector);
            if (commentElement) {
                break;
            }
        }
        
        if (commentElement) {
            // Get current position to determine if scrolling is needed
            const elementRect = commentElement.getBoundingClientRect();
            const isVisible = elementRect.top >= 0 && elementRect.bottom <= window.innerHeight;
            
            if (!isVisible) {
                // Use scrollIntoView as primary method since it's most reliable
                try {
                    commentElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                } catch (error) {
                    // Fallback to window.scrollTo
                    const elementPosition = elementRect.top + window.pageYOffset;
                    const offset = 80; // Account for any fixed headers
                    const offsetPosition = elementPosition - offset;
                    
                    try {
                        window.scrollTo({
                            top: offsetPosition,
                            behavior: 'smooth'
                        });
                    } catch (fallbackError) {
                        // Silent fallback - scrolling failed but don't spam console
                    }
                }
            }
            
            // Highlight the comment briefly
            this.highlightComment(commentElement);
        }
    }

    /**
     * Highlight a comment element temporarily
     * @param {HTMLElement} commentElement - The comment element to highlight
     */
    highlightComment(commentElement) {
        // Add highlight class
        commentElement.classList.add('comment-highlighted');
        
        // Create highlight styles if they don't exist
        if (!document.getElementById('comment-highlight-styles')) {
            const style = document.createElement('style');
            style.id = 'comment-highlight-styles';
            style.textContent = `
                .comment-highlighted {
                    background-color: rgba(255, 193, 7, 0.2) !important;
                    border-left: 4px solid #ffc107 !important;
                    transition: background-color 0.3s ease, border-left 0.3s ease;
                }
                .comment-highlighted.fade-out {
                    background-color: transparent !important;
                    border-left: none !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Remove highlight after a longer delay for better visibility
        setTimeout(() => {
            commentElement.classList.add('fade-out');
            setTimeout(() => {
                commentElement.classList.remove('comment-highlighted', 'fade-out');
            }, 300);
        }, 8000);
    }

    /**
     * Handle instance change
     * @param {Event} event - Change event
     */
    async handleInstanceChange(event) {
        const newInstance = event.target.value;
        setCurrentInstance(newInstance);
        
        // Reinitialize API with new instance
        this.api = new LemmyAPI(newInstance);
        
        // Reload the current post from the new instance
        if (this.currentPostId) {
            await this.loadPost(this.currentPostId);
        }
    }

    /**
     * Handle add instance button
     */
    handleAddInstance() {
        // The modal will be handled by Bootstrap, but we can add any initialization here
        console.log('Add instance modal opened');
    }

    /**
     * Handle theme toggle
     */
    handleThemeToggle() {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-bs-theme', newTheme);
        
        // Update theme toggle icon
        const icon = this.elements.themeToggle.querySelector('i');
        if (icon) {
            if (newTheme === 'dark') {
                icon.className = 'bi bi-moon-fill';
            } else {
                icon.className = 'bi bi-sun-fill';
            }
        }
        
        // Store theme preference
        localStorage.setItem('theme', newTheme);
    }

    /**
     * Initialize stored theme
     */
    initializeTheme() {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme) {
            document.documentElement.setAttribute('data-bs-theme', storedTheme);
            
            // Update theme toggle icon
            const icon = this.elements.themeToggle?.querySelector('i');
            if (icon) {
                if (storedTheme === 'dark') {
                    icon.className = 'bi bi-moon-fill';
                } else {
                    icon.className = 'bi bi-sun-fill';
                }
            }
        }
    }

    /**
     * Initialize instance selector with stored instances
     */
    initializeInstanceSelector() {
        if (!this.elements.instanceSelector) return;

        const allInstances = getAllInstances();
        const currentInstance = getCurrentInstance();

        // Clear existing options
        this.elements.instanceSelector.innerHTML = '';

        // Add stored instances
        Object.entries(allInstances).forEach(([key, instance]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = instance.isCustom ? `${instance.name} (Custom)` : instance.name;
            
            if (key === currentInstance) {
                option.selected = true;
            }
            
            this.elements.instanceSelector.appendChild(option);
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.lemmericPostPage = new PostPage();
});

export default PostPage;