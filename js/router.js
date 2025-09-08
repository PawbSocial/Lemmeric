/**
 * Router for Lemmeric
 * Handles URL routing and navigation history for proper Lemmy link sharing
 */

export class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.isHandlingNavigation = false;
        
        // Bind methods to maintain context
        this.handlePopState = this.handlePopState.bind(this);
        this.init();
    }

    /**
     * Initialize the router
     */
    init() {
        // Listen for browser navigation events
        window.addEventListener('popstate', this.handlePopState);
        
        // Handle initial route
        this.handleRoute();
    }

    /**
     * Register a route handler
     * @param {string} pattern - URL pattern (e.g., '/post/:id')
     * @param {Function} handler - Route handler function
     */
    addRoute(pattern, handler) {
        this.routes.set(pattern, handler);
    }

    /**
     * Navigate to a URL
     * @param {string} url - URL to navigate to
     * @param {boolean} replace - Whether to replace current history entry
     */
    navigate(url, replace = false) {
        if (this.isHandlingNavigation) return;
        
        if (replace) {
            window.history.replaceState({ url }, '', url);
        } else {
            window.history.pushState({ url }, '', url);
        }
        
        this.handleRoute();
    }

    /**
     * Handle browser back/forward navigation
     * @param {PopStateEvent} event - Popstate event
     */
    handlePopState(event) {
        this.handleRoute();
    }

    /**
     * Handle the current route
     */
    async handleRoute() {
        const path = window.location.pathname;
        const searchParams = new URLSearchParams(window.location.search);
        
        // Skip router handling for HTML files (standalone pages)
        if (path.endsWith('.html') && path !== '/' && path !== '/index.html') {
            // Allow normal browser navigation to HTML files
            return;
        }
        
        // Find matching route
        for (const [pattern, handler] of this.routes) {
            const match = this.matchRoute(pattern, path);
            if (match) {
                this.currentRoute = { pattern, params: match.params, query: searchParams };
                
                try {
                    await handler(match.params, searchParams);
                } catch (error) {
                    console.error('Route handler error:', error);
                }
                return;
            }
        }
        
        // No route matched, handle as home/default
        this.handleDefaultRoute();
    }

    /**
     * Match a route pattern against a path
     * @param {string} pattern - Route pattern
     * @param {string} path - URL path
     * @returns {Object|null} Match result with params
     */
    matchRoute(pattern, path) {
        // Convert pattern to regex
        const regexPattern = pattern
            .replace(/:[^/]+/g, '([^/]+)')  // :param -> capture group
            .replace(/\//g, '\\/');        // escape slashes
        
        const regex = new RegExp(`^${regexPattern}$`);
        const match = path.match(regex);
        
        if (!match) return null;
        
        // Extract parameter names
        const paramNames = pattern.match(/:[^/]+/g)?.map(p => p.slice(1)) || [];
        const params = {};
        
        paramNames.forEach((name, index) => {
            params[name] = match[index + 1];
        });
        
        return { params };
    }

    /**
     * Handle default route (home)
     */
    handleDefaultRoute() {
        this.currentRoute = { pattern: '/', params: {}, query: new URLSearchParams() };
        
        // Clean up any loading states if app is available
        if (window.lemmericApp && typeof window.lemmericApp.clearAllLoadingStates === 'function') {
            window.lemmericApp.clearAllLoadingStates();
        }
        
        // Trigger home view if not already there
        const event = new CustomEvent('router:home');
        window.dispatchEvent(event);
    }

    /**
     * Get current route information
     * @returns {Object} Current route info
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Check if currently on a specific route pattern
     * @param {string} pattern - Route pattern to check
     * @returns {boolean} Whether currently on this route
     */
    isCurrentRoute(pattern) {
        return this.currentRoute?.pattern === pattern;
    }

    /**
     * Generate URL for a route with parameters
     * @param {string} pattern - Route pattern
     * @param {Object} params - Route parameters
     * @param {Object} query - Query parameters
     * @returns {string} Generated URL
     */
    generateUrl(pattern, params = {}, query = {}) {
        let url = pattern;
        
        // Replace parameters
        for (const [key, value] of Object.entries(params)) {
            url = url.replace(`:${key}`, encodeURIComponent(value));
        }
        
        // Add query parameters
        const queryString = new URLSearchParams(query).toString();
        if (queryString) {
            url += `?${queryString}`;
        }
        
        return url;
    }

    /**
     * Navigate back in history
     */
    back() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            this.navigate('/', true);
        }
    }

    /**
     * Set flag to prevent navigation during route handling
     * @param {boolean} handling - Whether currently handling navigation
     */
    setHandlingNavigation(handling) {
        this.isHandlingNavigation = handling;
    }

    /**
     * Destroy the router
     */
    destroy() {
        window.removeEventListener('popstate', this.handlePopState);
        this.routes.clear();
    }
}

// Export singleton instance
export const router = new Router(); 