/**
 * User Page App for Lemmeric
 * Handles user profile viewing functionality
 */

import { LemmyAPI, APIUtils } from './api.js';
import { DOM } from './utils.js';
import { getAllInstances, getCurrentInstance, setCurrentInstance, getCurrentTheme, setCurrentTheme } from './config.js';
import { router } from './router.js';
import { PostListManager } from './components/post.js';
import { PostFeed } from './components/post-feed.js';
import { UserSidebarComponent } from './components/user-sidebar.js';
import { UserEditModal } from './components/user-edit-modal.js';
import { authManager } from './auth.js';

class LemmericUserApp {
    constructor() {
        this.userName = null;
        this.userData = null;
        this.isLoading = false;
        this.hasMorePosts = true;
        this.currentPage = 1;
        this.currentTab = 'posts'; // 'posts' or 'comments'
        this.postFeed = null;
        
        // Application state - get current instance from centralized storage
        this.state = {
            currentInstance: getCurrentInstance(),
            currentSort: 'New'
        };

        // UI elements cache
        this.elements = {};
        
        // Managers
        this.postListManager = null;
        this.api = null;
        this.editModal = null;
        this.currentUser = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            
            // Get user name from URL
            this.userName = this.getUserNameFromURL();
            
            if (!this.userName) {
                console.error('No username found in URL');
                // Don't immediately show error - wait for DOM elements to be cached
                this.initError = 'Invalid user URL - no username parameter found';
            } else {
            }

            // Load state from localStorage
            this.loadStateFromStorage();
            
            // Cache DOM elements
            this.cacheElements();
            
            // If we had an initialization error, show it now
            if (this.initError) {
                this.showError(this.initError);
                return;
            }
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup infinite scrolling
            this.setupInfiniteScrolling();
            
            // Setup router
            this.setupRouter();
            
            // Initialize API
            this.setupAPI();

            // Initialize UI
            this.initializeUI();
            
            // Initialize edit modal
            this.initializeEditModal();
            
            // Load initial data
            await this.loadInitialData();
            
        } catch (error) {
            console.error('Failed to initialize User Page App:', error);
            // Try to show error, but with better fallback handling
            try {
                this.showError('Failed to initialize user page');
            } catch (showErrorError) {
                console.error('Could not even show error:', showErrorError);
                // Ultimate fallback
                alert('Failed to initialize user page: ' + error.message);
            }
        }
    }

    /**
     * Extract username from current URL
     */
    getUserNameFromURL() {
        // Debug logging
        
        // First, try to get username from URL parameters (for rewritten URLs)
        const urlParams = new URLSearchParams(window.location.search);
        let username = urlParams.get('username');
        
        // If no username parameter, try to extract from the path (for clean URLs)
        if (!username) {
            const pathMatch = window.location.pathname.match(/^\/u\/([^\/]+)$/);
            if (pathMatch) {
                username = pathMatch[1];
            }
        } else {
        }
        
        return username;
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            userTitle: document.getElementById('user-title'),
            sortSelector: document.getElementById('sort-selector'),
            
            // Content areas
            postsContainer: document.getElementById('posts-container'),
            commentsContainer: document.getElementById('comments-container'),
            userSidebarContainer: document.getElementById('user-sidebar-container'),
            
            // Tabs
            postsTab: document.getElementById('posts-tab'),
            commentsTab: document.getElementById('comments-tab'),
            
            // Mobile modal
            mobileUserInfo: document.getElementById('mobile-user-info')
        };
        
        // Check for missing critical elements
        const criticalElements = ['userTitle', 'postsContainer', 'commentsContainer', 'userSidebarContainer'];
        const missingElements = criticalElements.filter(key => !this.elements[key]);
        
        if (missingElements.length > 0) {
            console.error('Missing critical DOM elements:', missingElements);
            throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
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

        // Listen for user updates
        window.addEventListener('userUpdated', (e) => {
            this.handleUserUpdated(e.detail.user);
        });

        // Sort selector change
        if (this.elements.sortSelector) {
            this.elements.sortSelector.addEventListener('change', (e) => {
                this.handleSortChange(e.target.value);
            });
        }

        // Tab switching
        if (this.elements.postsTab) {
            this.elements.postsTab.addEventListener('click', () => {
                this.switchToTab('posts');
            });
        }

        if (this.elements.commentsTab) {
            this.elements.commentsTab.addEventListener('click', () => {
                this.switchToTab('comments');
            });
        }
    }

    /**
     * Setup infinite scrolling
     */
    setupInfiniteScrolling() {
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
                    if (this.currentTab === 'posts') {
                        this.loadMorePosts();
                    } else {
                        this.loadMoreComments();
                    }
                }
            }, 100);
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
        // Listen for instance changes that might affect URLs
        router.addRoute('/u/:username', async (params, query) => {
            // Handle user route
            if (params.username !== this.userName) {
                // User changed, reload
                window.location.reload();
            }
        });
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        this.populateSortSelector();
        
        // Initialize post feed
        this.postFeed = new PostFeed(this.elements.postsContainer, {
            fetchFunction: async (params) => {
                if (this.currentTab === 'posts') {
                    // Ensure we're always passing the correct page parameter
                    const page = params.page || 1;
                    return await this.api.getUserPosts(
                        this.userName,
                        this.state.currentSort,
                        page
                    );
                } else {
                    // For comments, we'll handle this differently
                    return { posts: [] };
                }
            },
            emptyMessage: 'No posts found',
            emptyDescription: 'This user hasn\'t posted anything yet.',
            emptyIcon: 'bi-inbox'
        });
    }

    /**
     * Initialize edit modal
     */
    initializeEditModal() {
        this.editModal = new UserEditModal();
    }

    // populateInstanceSelector moved to navbar component

    /**
     * Populate sort selector
     */
    populateSortSelector() {
        const sortOptions = [
            { value: 'New', label: 'New' },
            { value: 'Old', label: 'Old' },
            { value: 'TopDay', label: 'Top Day' },
            { value: 'TopWeek', label: 'Top Week' },
            { value: 'TopMonth', label: 'Top Month' },
            { value: 'TopYear', label: 'Top Year' },
            { value: 'TopAll', label: 'Top All' }
        ];

        this.elements.sortSelector.innerHTML = '';
        sortOptions.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            optionElement.selected = option.value === this.state.currentSort;
            this.elements.sortSelector.appendChild(optionElement);
        });
    }

    /**
     * Load initial data for the user
     */
    async loadInitialData() {
        try {
            // Load user info first, then content
            await this.loadUserInfo();
            await this.loadUserContent(true);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showError('Failed to load user data');
        }
    }

    /**
     * Load user information
     */
    async loadUserInfo() {
        try {
            
            // Get user details and site information in parallel
            const [userResponse, siteResponse] = await Promise.all([
                this.api.getUser(this.userName),
                this.api.getSite()
            ]);
            
            if (!userResponse || !userResponse.person_view) {
                throw new Error('User not found');
            }

            this.userData = userResponse.person_view;
            const user = this.userData.person;
            
            // Check if user is an admin by comparing with site admin list
            const admins = siteResponse?.admins || [];
            const isAdmin = admins.some(admin => {
                const adminPerson = admin.person || admin;
                return adminPerson.id === user.id || adminPerson.name === user.name;
            });
            
            console.log('Admin check:', {
                userId: user.id,
                userName: user.name,
                admins: admins.map(a => ({ id: a.person?.id, name: a.person?.name })),
                isAdmin: isAdmin
            });
            
            // Add admin flag to user object
            user.admin = isAdmin;
            
            // Update page title
            document.title = `${user.display_name || user.name} - Lemmeric`;
            
            // Update user title
            this.updateUserTitle(user);

            // Get current user for edit permissions
            this.currentUser = this.getCurrentUser();

            // Format user data for sidebar - pass the full response
            const formattedUser = APIUtils.formatUser(userResponse);
            
            // Also add admin flag to formatted user data
            formattedUser.admin = isAdmin;

            // Render user sidebar
            this.renderUserSidebar(formattedUser);

        } catch (error) {
            console.error('Failed to load user info:', error);
            this.showError(`Failed to load user: ${this.userName}`);
        }
    }

    /**
     * Update user title in the header
     */
    updateUserTitle(user) {
        const titleElement = this.elements.userTitle;
        titleElement.innerHTML = '';

        // Add user avatar if available
        if (user.avatar) {
            const avatar = DOM.createElement('img', {
                src: user.avatar,
                className: 'me-2 rounded-circle',
                style: 'width: 32px; height: 32px; object-fit: cover;',
                alt: user.display_name || user.name,
                onerror: function() {
                    this.style.display = 'none';
                }
            });
            titleElement.appendChild(avatar);
        }

        // Add user display name/name
        const titleText = DOM.createElement('span', {}, user.display_name || user.name);
        titleElement.appendChild(titleText);

        // Add admin badge if user is admin
        if (user.admin) {
            const adminBadge = DOM.createElement('span', {
                className: 'badge bg-danger ms-2',
                title: 'Instance Administrator'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-shield-fill me-1'
                }),
                'Admin'
            ]);
            titleElement.appendChild(adminBadge);
        }

        // Add username badge if display name is different
        if (user.display_name && user.display_name !== user.name) {
            const nameBadge = DOM.createElement('small', {
                className: 'badge bg-secondary ms-2'
            }, `u/${user.name}`);
            titleElement.appendChild(nameBadge);
        }
    }

    /**
     * Render user sidebar
     */
    renderUserSidebar(userData) {
        const sidebarComponent = new UserSidebarComponent(userData);
        const sidebarElement = sidebarComponent.render();
        
        // Clear existing content and add new sidebar
        this.elements.userSidebarContainer.innerHTML = '';
        this.elements.userSidebarContainer.appendChild(sidebarElement);

        // Also update mobile modal if it exists
        if (this.elements.mobileUserInfo) {
            this.elements.mobileUserInfo.innerHTML = '';
            const mobileSidebar = sidebarComponent.render();
            this.elements.mobileUserInfo.appendChild(mobileSidebar);
        }
    }

    /**
     * Get current user from auth manager
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
     * Handle user updated event
     */
    handleUserUpdated(updatedUser) {
        // Update user data
        this.userData = updatedUser;
        
        // Update page title
        document.title = `${updatedUser.display_name || updatedUser.name} - Lemmeric`;
        
        // Update user title
        this.updateUserTitle(updatedUser);
        
        // Re-render sidebar with updated data
        const formattedUser = APIUtils.formatUser({ person_view: { person: updatedUser } });
        this.renderUserSidebar(formattedUser);
    }

    /**
     * Switch between posts and comments tabs
     */
    switchToTab(tab) {
        this.currentTab = tab;
        this.currentPage = 1;
        this.hasMorePosts = true;
        
        // Clear current content
        if (tab === 'posts') {
            // Ensure PostFeed is properly reset when switching to posts tab
            this.postFeed.clear();
        } else {
            DOM.clearChildren(this.elements.commentsContainer);
        }
        
        // Load content for the new tab
        this.loadUserContent(true);
    }

    /**
     * Load user content (posts or comments)
     */
    async loadUserContent(reset = true) {
        if (this.currentTab === 'posts') {
            // Use PostFeed for posts - ensure proper reset
            if (reset) {
                // Force PostFeed to reset to page 1
                this.postFeed.clear();
            }
            return await this.postFeed.loadPosts(reset);
        } else {
            // Handle comments separately (keep existing logic)
            if (this.isLoading) return;
            
            try {
                this.isLoading = true;
                
                if (reset) {
                    this.currentPage = 1;
                    this.hasMorePosts = true;
                    this.showLoadingInContainer();
                }


                const response = await this.api.getUserComments(
                    this.userName,
                    this.state.currentSort,
                    this.currentPage
                );

                if (!response) {
                    throw new Error(`Failed to load user comments`);
                }

                this.hideLoadingInContainer();

                // For comments, extract from the user response
                const comments = response.comments || [];
                
                if (comments.length === 0) {
                    if (this.currentPage === 1) {
                        this.showNoContent('comments');
                    }
                    this.hasMorePosts = false;
                } else {
                    // Render comments (simplified for now)
                    this.renderComments(comments);
                    
                    // Check if we can load more
                    this.hasMorePosts = comments.length >= 20;
                }

                this.currentPage++;

            } catch (error) {
                console.error(`Failed to load user comments:`, error);
                this.hideLoadingInContainer();
                if (this.currentPage === 1) {
                    this.showError(`Failed to load user comments`);
                }
            } finally {
                this.isLoading = false;
            }
        }
    }

    /**
     * Load more posts
     */
    async loadMorePosts() {
        if (this.currentTab !== 'posts') return;
        return await this.postFeed.loadMorePosts();
    }

    /**
     * Load more comments
     */
    async loadMoreComments() {
        if (!this.hasMorePosts || this.isLoading || this.currentTab !== 'comments') return;
        await this.loadUserContent(false);
    }

    /**
     * Render comments (simplified implementation)
     */
    renderComments(comments) {
        const container = this.elements.commentsContainer;
        
        comments.forEach(commentData => {
            // Handle different possible structures
            const commentView = commentData.comment_view || commentData;
            const comment = commentView.comment || commentData.comment;
            const creator = commentView.creator || commentData.creator;
            const post = commentView.post || commentData.post;
            
            // Create post link - link directly to the post
            let postLink;
            if (post && post.id) {
                const postUrl = `/post/${post.id}`;
                const postName = post.name || 'Unknown Post';
                
                // Truncate long post names to prevent formatting issues
                const truncatedName = postName.length > 50 ? 
                    postName.substring(0, 50).trim() + '...' : 
                    postName;
                
                postLink = DOM.createElement('a', {
                    href: postUrl,
                    className: 'text-decoration-none text-primary fw-medium',
                    title: `View post: ${postName}`, // Full title in tooltip
                    style: 'cursor: pointer;'
                }, truncatedName);
            } else {
                // Fallback if no post data
                postLink = DOM.createElement('span', {}, 'Unknown Post');
            }
            
            // Create author display with remote user support
            let authorDisplay;
            if (creator) {
                // Determine the display name and URL for the author
                let displayName = creator.display_name || creator.name || 'Unknown';
                let authorUrl = `/u/${creator.name}`;
                
                // For remote users, format as "username@instance.tld" and include instance in URL
                if (creator.local === false && creator.actor_id) {
                    try {
                        const url = new URL(creator.actor_id);
                        const instanceHost = url.hostname;
                        displayName = `${creator.display_name || creator.name}@${instanceHost}`;
                        authorUrl = `/u/${creator.name}@${instanceHost}`;
                    } catch (e) {
                        console.warn('Failed to parse creator actor_id:', creator.actor_id);
                    }
                }
                
                authorDisplay = DOM.createElement('a', {
                    href: authorUrl,
                    className: 'text-decoration-none text-muted',
                    'data-user': creator.name,
                    onclick: (e) => {
                        e.preventDefault();
                        window.location.href = authorUrl;
                    }
                }, `by ${displayName}`);
            } else {
                authorDisplay = DOM.createElement('span', {
                    className: 'text-muted'
                }, 'by Unknown');
            }
            
            const commentElement = DOM.createElement('div', {
                className: 'card mb-2'
            }, [
                DOM.createElement('div', {
                    className: 'card-body'
                }, [
                    DOM.createElement('div', {
                        className: 'd-flex justify-content-between align-items-start mb-2'
                    }, [
                        DOM.createElement('small', {
                            className: 'text-muted d-flex align-items-center flex-wrap'
                        }, [
                            DOM.createElement('span', {}, 'Comment on: '),
                            DOM.createElement('span', { className: 'ms-1' }, [postLink])
                        ]),
                        DOM.createElement('div', {
                            className: 'd-flex align-items-center'
                        }, [
                            DOM.createElement('small', {
                                className: 'me-2'
                            }, [authorDisplay]),
                            DOM.createElement('small', {
                                className: 'text-muted'
                            }, APIUtils.formatTime(new Date(comment.published)))
                        ])
                    ]),
                    DOM.createElement('p', {
                        className: 'mb-0'
                    }, comment.content || 'No content')
                ])
            ]);
            
            container.appendChild(commentElement);
        });
    }

    /**
     * Handle instance change
     */
    async handleInstanceChange(instanceName) {
        // Use centralized instance management
        setCurrentInstance(instanceName);
        this.state.currentInstance = instanceName;
        
        // Reinitialize API with new instance
        this.setupAPI();
        
        // Update favicon based on new instance branding
        const { updateFaviconFromBranding } = await import('./config.js');
        updateFaviconFromBranding();
        
        // Reload user data
        this.currentPage = 1;
        this.hasMorePosts = true;
        this.postListManager.clearPosts();
        DOM.clearChildren(this.elements.commentsContainer);
        
        await this.loadInitialData();
    }

    /**
     * Handle sort change
     */
    async handleSortChange(sortType) {
        this.state.currentSort = sortType;
        this.saveStateToStorage();
        
        // Reload current content with new sort
        this.currentPage = 1;
        this.hasMorePosts = true;
        
        if (this.currentTab === 'posts') {
            await this.postFeed.updateParams();
        } else {
            DOM.clearChildren(this.elements.commentsContainer);
            await this.loadUserContent(true);
        }
    }

    // Theme and navigation handling moved to navbar component

    /**
     * Show loading in container
     */
    showLoadingInContainer() {
        const container = this.currentTab === 'posts' ? 
            this.elements.postsContainer : 
            this.elements.commentsContainer;
            
        if (container && !container.querySelector('.spinner-border')) {
            const loadingElement = DOM.createElement('div', {
                className: 'd-flex justify-content-center p-4'
            }, [
                DOM.createElement('div', {
                    className: 'spinner-border',
                    role: 'status'
                }, [
                    DOM.createElement('span', {
                        className: 'visually-hidden'
                    }, `Loading ${this.currentTab}...`)
                ])
            ]);
            
            container.appendChild(loadingElement);
        }
    }

    /**
     * Hide loading in container
     */
    hideLoadingInContainer() {
        const container = this.currentTab === 'posts' ? 
            this.elements.postsContainer : 
            this.elements.commentsContainer;
            
        if (container) {
            const loadingElements = container.querySelectorAll('.d-flex.justify-content-center.p-4');
            loadingElements.forEach(element => {
                if (element.querySelector('.spinner-border')) {
                    element.remove();
                }
            });
        }
    }

    /**
     * Show no content message
     */
    showNoContent(type) {
        const container = type === 'posts' ? 
            this.elements.postsContainer : 
            this.elements.commentsContainer;
            
        const message = DOM.createElement('div', {
            className: 'text-center p-4'
        }, [
            DOM.createElement('i', {
                className: `bi ${type === 'posts' ? 'bi-file-text' : 'bi-chat-dots'} text-muted`,
                style: 'font-size: 3rem;'
            }),
            DOM.createElement('p', {
                className: 'text-muted mt-2'
            }, `No ${type} found for this user.`)
        ]);
        
        container.appendChild(message);
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('User Page Error:', message);
        
        // Try to show error in the current tab's container
        let container = null;
        
        if (this.elements && this.elements.postsContainer && this.elements.commentsContainer) {
            container = this.currentTab === 'posts' ? 
                this.elements.postsContainer : 
                this.elements.commentsContainer;
        } else {
            // Fallback: try to find containers directly
            container = document.getElementById('posts-container') || 
                       document.getElementById('comments-container');
        }
        
        if (container) {
            container.innerHTML = '';
            const errorElement = DOM.createElement('div', {
                className: 'alert alert-danger text-center'
            }, message);
            container.appendChild(errorElement);
        } else {
            // Last resort: create a simple error display
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger m-3';
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);
        }
    }

    // Navigation and instance management methods moved to navbar component

    /**
     * Load state from localStorage
     */
    loadStateFromStorage() {
        // Update instance from centralized storage (in case it changed)
        this.state.currentInstance = getCurrentInstance();
        
        // Load theme using centralized system
        const savedTheme = getCurrentTheme();
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        // Load user-specific settings (if any)
        const saved = localStorage.getItem('lemmeric-user-state');
        if (saved) {
            try {
                const savedState = JSON.parse(saved);
                // Only load sort preference, instance is managed centrally
                if (savedState.currentSort) {
                    this.state.currentSort = savedState.currentSort;
                }
            } catch (e) {
                console.warn('Failed to load saved user state:', e);
            }
        }
    }

    /**
     * Save state to localStorage
     */
    saveStateToStorage() {
        // Only save user-specific preferences (sort), instance is managed centrally
        const userState = {
            currentSort: this.state.currentSort
        };
        localStorage.setItem('lemmeric-user-state', JSON.stringify(userState));
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new LemmericUserApp();
    app.init();
}); 