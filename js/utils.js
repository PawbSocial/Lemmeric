/**
 * Utility functions for Lemmeric
 * Contains helper functions for DOM manipulation, sanitization, and common tasks
 */

/**
 * DOM utility functions
 */
export const DOM = {
    /**
     * Create an element with attributes and children
     * @param {string} tag - Element tag name
     * @param {Object} attributes - Element attributes
     * @param {Array|string} children - Child elements or text content
     * @returns {HTMLElement} Created element
     */
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Add children (only if innerHTML wasn't set)
        if (!attributes.innerHTML) {
            if (typeof children === 'string') {
                element.textContent = children;
            } else if (Array.isArray(children)) {
                children.forEach(child => {
                    if (typeof child === 'string') {
                        element.appendChild(document.createTextNode(child));
                    } else if (child instanceof HTMLElement) {
                        element.appendChild(child);
                    }
                });
            }
        }
        
        return element;
    },

    /**
     * Remove all child elements from a parent
     * @param {HTMLElement} parent - Parent element
     */
    clearChildren(parent) {
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }
    },

    /**
     * Show loading spinner in an element
     * @param {HTMLElement} element - Target element
     * @param {string} message - Loading message
     */
    showLoading(element, message = 'Loading...') {
        this.clearChildren(element);
        element.appendChild(this.createElement('div', {
            className: 'd-flex justify-content-center align-items-center p-4'
        }, [
            this.createElement('div', {
                className: 'spinner-border me-2',
                role: 'status'
            }, [
                this.createElement('span', {
                    className: 'visually-hidden'
                }, 'Loading...')
            ]),
            this.createElement('span', {}, message)
        ]));
    },

    /**
     * Show error message in an element
     * @param {HTMLElement} element - Target element
     * @param {string} message - Error message
     */
    showError(element, message = 'An error occurred') {
        this.clearChildren(element);
        element.appendChild(this.createElement('div', {
            className: 'alert alert-danger d-flex align-items-center',
            role: 'alert'
        }, [
            this.createElement('i', {
                className: 'bi bi-exclamation-triangle-fill me-2'
            }),
            this.createElement('div', {}, message)
        ]));
    },

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container') || 
            this.createToastContainer();
        
        const toast = this.createElement('div', {
            className: `toast align-items-center text-bg-${type} border-0`,
            role: 'alert'
        }, [
            this.createElement('div', {
                className: 'd-flex'
            }, [
                this.createElement('div', {
                    className: 'toast-body'
                }, message),
                this.createElement('button', {
                    type: 'button',
                    className: 'btn-close btn-close-white me-2 m-auto',
                    'data-bs-dismiss': 'toast'
                })
            ])
        ]);
        
        toastContainer.appendChild(toast);
        
        // Use Bootstrap toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remove from DOM after hiding
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    },

    /**
     * Create toast container if it doesn't exist
     * @returns {HTMLElement} Toast container
     */
    createToastContainer() {
        const container = this.createElement('div', {
            id: 'toast-container',
            className: 'toast-container position-fixed top-0 end-0 p-3',
            style: 'z-index: 1055'
        });
        document.body.appendChild(container);
        return container;
    }
};

/**
 * URL and link utility functions
 */
export const URLUtils = {
    /**
     * Check if a URL is external
     * @param {string} url - URL to check
     * @returns {boolean} True if external
     */
    isExternal(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.origin !== window.location.origin;
        } catch {
            return false;
        }
    },

    /**
     * Check if a URL points to an image
     * @param {string} url - URL to check
     * @returns {boolean} True if URL appears to be an image
     */
    isImageUrl(url) {
        if (!url) return false;
        
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff', '.tif'];
            
            // Check if the pathname ends with an image extension
            if (imageExtensions.some(ext => pathname.endsWith(ext))) {
                return true;
            }
            
            // Check if this is a Lemmy image proxy URL
            if (pathname === '/api/v3/image_proxy' && urlObj.searchParams.has('url')) {
                const proxyUrl = urlObj.searchParams.get('url');
                if (proxyUrl) {
                    try {
                        const decodedUrl = decodeURIComponent(proxyUrl);
                        const decodedUrlObj = new URL(decodedUrl);
                        const decodedPathname = decodedUrlObj.pathname.toLowerCase();
                        return imageExtensions.some(ext => decodedPathname.endsWith(ext));
                    } catch {
                        // If we can't parse the proxied URL, fall back to checking if it contains image extensions
                        return imageExtensions.some(ext => proxyUrl.toLowerCase().includes(ext));
                    }
                }
            }
            
            return false;
        } catch {
            return false;
        }
    },

    /**
     * Check if a URL points to a video
     * @param {string} url - URL to check
     * @returns {boolean} True if URL appears to be a video
     */
    isVideoUrl(url) {
        if (!url) return false;
        
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.m4v', '.3gp'];
            
            // Check if the pathname ends with a video extension
            if (videoExtensions.some(ext => pathname.endsWith(ext))) {
                return true;
            }
            
            // Check if this is a Lemmy image proxy URL that might contain a video
            if (pathname === '/api/v3/image_proxy' && urlObj.searchParams.has('url')) {
                const proxyUrl = urlObj.searchParams.get('url');
                if (proxyUrl) {
                    try {
                        const decodedUrl = decodeURIComponent(proxyUrl);
                        const decodedUrlObj = new URL(decodedUrl);
                        const decodedPathname = decodedUrlObj.pathname.toLowerCase();
                        return videoExtensions.some(ext => decodedPathname.endsWith(ext));
                    } catch {
                        // If we can't parse the proxied URL, fall back to checking if it contains video extensions
                        return videoExtensions.some(ext => proxyUrl.toLowerCase().includes(ext));
                    }
                }
            }
            
            return false;
        } catch {
            return false;
        }
    },

    /**
     * Check if a URL points to an audio file
     * @param {string} url - URL to check
     * @returns {boolean} True if URL appears to be an audio file
     */
    isAudioUrl(url) {
        if (!url) return false;
        
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            const audioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma', '.opus', '.webm'];
            
            // Check if the pathname ends with an audio extension
            if (audioExtensions.some(ext => pathname.endsWith(ext))) {
                return true;
            }
            
            // Check if this is a Lemmy image proxy URL that might contain an audio file
            if (pathname === '/api/v3/image_proxy' && urlObj.searchParams.has('url')) {
                const proxyUrl = urlObj.searchParams.get('url');
                if (proxyUrl) {
                    try {
                        const decodedUrl = decodeURIComponent(proxyUrl);
                        const decodedUrlObj = new URL(decodedUrl);
                        const decodedPathname = decodedUrlObj.pathname.toLowerCase();
                        return audioExtensions.some(ext => decodedPathname.endsWith(ext));
                    } catch {
                        // If we can't parse the proxied URL, fall back to checking if it contains audio extensions
                        return audioExtensions.some(ext => proxyUrl.toLowerCase().includes(ext));
                    }
                }
            }
            
            return false;
        } catch {
            return false;
        }
    },

    /**
     * Get domain from URL
     * @param {string} url - URL
     * @returns {string} Domain
     */
    getDomain(url) {
        if (!url) return '';
        
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            // If URL parsing fails, try to extract domain manually
            const match = url.match(/https?:\/\/([^\/]+)/);
            return match ? match[1] : url;
        }
    },

    /**
     * Check if a URL is a YouTube video
     * @param {string} url - URL to check
     * @returns {boolean} True if URL is a YouTube video
     */
    isYouTubeUrl(url) {
        if (!url) return false;
        
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // Check for various YouTube domains
            return (hostname === 'youtube.com' || 
                    hostname === 'www.youtube.com' || 
                    hostname === 'youtu.be' || 
                    hostname === 'm.youtube.com');
        } catch {
            return false;
        }
    },

    /**
     * Extract YouTube video ID from URL
     * @param {string} url - YouTube URL
     * @returns {string|null} Video ID or null if not found
     */
    getYouTubeVideoId(url) {
        if (!url) return null;
        
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // For youtu.be short links
            if (hostname === 'youtu.be') {
                return urlObj.pathname.slice(1);
            }
            
            // For regular YouTube URLs
            if (hostname.includes('youtube.com')) {
                // Check for v parameter
                const vParam = urlObj.searchParams.get('v');
                if (vParam) {
                    return vParam;
                }
                
                // Check for embed URLs like /embed/VIDEO_ID
                const embedMatch = urlObj.pathname.match(/\/embed\/([^\/\?]+)/);
                if (embedMatch) {
                    return embedMatch[1];
                }
            }
            
            return null;
        } catch {
            return null;
        }
    },

    /**
     * Convert YouTube URL to embed URL
     * @param {string} url - YouTube URL
     * @returns {string|null} Embed URL or null if not YouTube
     */
    getYouTubeEmbedUrl(url) {
        const videoId = this.getYouTubeVideoId(url);
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    },

    /**
     * Create a safe external link
     * @param {string} url - Target URL
     * @param {string} text - Link text
     * @returns {HTMLElement} Anchor element
     */
    createExternalLink(url, text) {
        return DOM.createElement('a', {
            href: url,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'external-link'
        }, [
            text,
            DOM.createElement('i', {
                className: 'bi bi-box-arrow-up-right ms-1'
            })
        ]);
    },

    /**
     * Parse Lemmy-style mentions and links
     * @param {string} text - Text to parse
     * @param {string} currentInstanceUrl - Current Lemmy instance URL (optional)
     * @returns {string} Parsed text with links
     */
    parseLemmyLinks(text, currentInstanceUrl = null) {
        // Get current instance URL from global app if available
        if (!currentInstanceUrl && window.lemmericApp) {
            const allInstances = window.getAllInstances ? window.getAllInstances() : null;
            if (allInstances && window.lemmericApp.state) {
                const currentInstanceKey = window.lemmericApp.state.currentInstance;
                const instanceConfig = allInstances[currentInstanceKey];
                currentInstanceUrl = instanceConfig?.url;
            }
        }
        
        // Fallback to window location if no instance URL provided
        if (!currentInstanceUrl) {
            currentInstanceUrl = window.location.origin;
        }
        
        // Community mentions: !community@instance -> {currentInstanceUrl}/c/community@instance
        text = text.replace(/!([a-zA-Z0-9_-]+)@([a-zA-Z0-9.-]+)/g, 
            `<a href="${currentInstanceUrl}/c/$1@$2" class="community-link text-primary" rel="noopener noreferrer" title="View community !$1@$2 on ${currentInstanceUrl}">!$1@$2</a>`);
        
        // User mentions: @user@instance (keeping the original placeholder behavior for now)
        text = text.replace(/@([a-zA-Z0-9_-]+)@([a-zA-Z0-9.-]+)/g, 
            '<a href="#" class="user-link text-muted" data-user="$1" data-instance="$2" title="User @$1@$2">@$1@$2</a>');
        
        return text;
    },

    /**
     * Get brand icon for a given URL/domain
     * @param {string} url - URL or domain
     * @returns {object|null} Object with icon class, title, and color or null if no brand match
     */
    getBrandIcon(url) {
        if (!url) return null;
        
        try {
            let domain = url;
            
            // If it's a full URL, extract the domain
            if (url.startsWith('http')) {
                const urlObj = new URL(url);
                domain = urlObj.hostname.toLowerCase();
            } else {
                domain = domain.toLowerCase();
            }
            
            // Remove 'www.' prefix for cleaner matching
            domain = domain.replace(/^www\./, '');
            
            // Brand icon mappings - using actual Bootstrap Icons brand icons
            const brandMappings = {
                // Social Media
                'youtube.com': { icon: 'bi-youtube', title: 'YouTube', color: '#ff0000' },
                'youtu.be': { icon: 'bi-youtube', title: 'YouTube', color: '#ff0000' },
                'facebook.com': { icon: 'bi-facebook', title: 'Facebook', color: '#1877f2' },
                'instagram.com': { icon: 'bi-instagram', title: 'Instagram', color: '#e4405f' },
                'twitter.com': { icon: 'bi-twitter', title: 'Twitter', color: '#1da1f2' },
                'x.com': { icon: 'bi-twitter-x', title: 'X (Twitter)', color: '#000000' },
                'linkedin.com': { icon: 'bi-linkedin', title: 'LinkedIn', color: '#0077b5' },
                'reddit.com': { icon: 'bi-reddit', title: 'Reddit', color: '#ff4500' },
                'tiktok.com': { icon: 'bi-tiktok', title: 'TikTok', color: '#000000' },
                'discord.com': { icon: 'bi-discord', title: 'Discord', color: '#5865f2' },
                'twitch.tv': { icon: 'bi-twitch', title: 'Twitch', color: '#9146ff' },
                'snapchat.com': { icon: 'bi-snapchat', title: 'Snapchat', color: '#fffc00' },
                'pinterest.com': { icon: 'bi-pinterest', title: 'Pinterest', color: '#bd081c' },
                'whatsapp.com': { icon: 'bi-whatsapp', title: 'WhatsApp', color: '#25d366' },
                'telegram.org': { icon: 'bi-telegram', title: 'Telegram', color: '#0088cc' },
                't.me': { icon: 'bi-telegram', title: 'Telegram', color: '#0088cc' },
                'mastodon.social': { icon: 'bi-mastodon', title: 'Mastodon', color: '#6364ff' },
                'threads.net': { icon: 'bi-threads', title: 'Threads', color: '#000000' },
                'bluesky.app': { icon: 'bi-bluesky', title: 'Bluesky', color: '#0085ff' },
                
                // Technology Companies
                'google.com': { icon: 'bi-google', title: 'Google', color: '#4285f4' },
                'microsoft.com': { icon: 'bi-microsoft', title: 'Microsoft', color: '#00a1f1' },
                'apple.com': { icon: 'bi-apple', title: 'Apple', color: '#000000' },
                'amazon.com': { icon: 'bi-amazon', title: 'Amazon', color: '#ff9900' },
                'github.com': { icon: 'bi-github', title: 'GitHub', color: '#333333' },
                'gitlab.com': { icon: 'bi-gitlab', title: 'GitLab', color: '#fc6d26' },
                'stackoverflow.com': { icon: 'bi-stack-overflow', title: 'Stack Overflow', color: '#f58025' },
                'dropbox.com': { icon: 'bi-dropbox', title: 'Dropbox', color: '#0061ff' },
                
                // Streaming & Media
                'spotify.com': { icon: 'bi-spotify', title: 'Spotify', color: '#1ed760' },
                'netflix.com': { icon: 'bi-film', title: 'Netflix', color: '#e50914' }, // No Netflix icon in Bootstrap
                'twitch.tv': { icon: 'bi-twitch', title: 'Twitch', color: '#9146ff' },
                'vimeo.com': { icon: 'bi-vimeo', title: 'Vimeo', color: '#1ab7ea' },
                
                // Productivity & Business
                'slack.com': { icon: 'bi-slack', title: 'Slack', color: '#4a154b' },
                'zoom.us': { icon: 'bi-camera-video', title: 'Zoom', color: '#2d8cff' }, // No Zoom icon in Bootstrap
                'trello.com': { icon: 'bi-trello', title: 'Trello', color: '#0079bf' },
                
                // Gaming
                'steam.com': { icon: 'bi-steam', title: 'Steam', color: '#000000' },
                'steampowered.com': { icon: 'bi-steam', title: 'Steam', color: '#000000' },
                'xbox.com': { icon: 'bi-xbox', title: 'Xbox', color: '#107c10' },
                'playstation.com': { icon: 'bi-playstation', title: 'PlayStation', color: '#0070d1' },
                'nintendo.com': { icon: 'bi-nintendo-switch', title: 'Nintendo', color: '#e60012' },
                
                // Professional & Development
                'wordpress.com': { icon: 'bi-wordpress', title: 'WordPress', color: '#21759b' },
                'wordpress.org': { icon: 'bi-wordpress', title: 'WordPress', color: '#21759b' },
                'medium.com': { icon: 'bi-medium', title: 'Medium', color: '#000000' },
                'behance.net': { icon: 'bi-behance', title: 'Behance', color: '#1769ff' },
                'dribbble.com': { icon: 'bi-dribbble', title: 'Dribbble', color: '#ea4c89' },
                
                // Shopping & E-commerce
                'ebay.com': { icon: 'bi-shop', title: 'eBay', color: '#e53238' }, // No eBay icon in Bootstrap
                'etsy.com': { icon: 'bi-shop', title: 'Etsy', color: '#f16521' }, // No Etsy icon in Bootstrap
                'paypal.com': { icon: 'bi-paypal', title: 'PayPal', color: '#0070ba' },
                'stripe.com': { icon: 'bi-stripe', title: 'Stripe', color: '#635bff' },
                
                // Search & Reference
                'wikipedia.org': { icon: 'bi-wikipedia', title: 'Wikipedia', color: '#000000' },
                'bing.com': { icon: 'bi-bing', title: 'Bing', color: '#0078d4' },
                'duckduckgo.com': { icon: 'bi-search', title: 'DuckDuckGo', color: '#de5833' }, // No DDG icon in Bootstrap
                'quora.com': { icon: 'bi-quora', title: 'Quora', color: '#a82400' },
                
                // Cloud & Enterprise
                'dropbox.com': { icon: 'bi-dropbox', title: 'Dropbox', color: '#0061ff' },
                'ubuntu.com': { icon: 'bi-ubuntu', title: 'Ubuntu', color: '#e95420' },
                
                // News & Media
                'bbc.com': { icon: 'bi-newspaper', title: 'BBC', color: '#000000' }, // No BBC icon in Bootstrap
                'cnn.com': { icon: 'bi-newspaper', title: 'CNN', color: '#cc0000' }, // No CNN icon in Bootstrap
                'nytimes.com': { icon: 'bi-newspaper', title: 'New York Times', color: '#000000' }, // No NYT icon in Bootstrap
                
                // Chinese Platforms (limited Bootstrap Icons support)
                'weibo.com': { icon: 'bi-sina-weibo', title: 'Sina Weibo', color: '#e6162d' },
                'qq.com': { icon: 'bi-tencent-qq', title: 'Tencent QQ', color: '#eb1923' },
                'wechat.com': { icon: 'bi-wechat', title: 'WeChat', color: '#7bb32e' },
                'alipay.com': { icon: 'bi-alipay', title: 'Alipay', color: '#1677ff' },
                
                // Messaging & Communication
                'messenger.com': { icon: 'bi-messenger', title: 'Messenger', color: '#006aff' },
                'skype.com': { icon: 'bi-skype', title: 'Skype', color: '#00aff0' },
                'yelp.com': { icon: 'bi-yelp', title: 'Yelp', color: '#d32323' },
                
                // Other Platforms
                'opencollective.com': { icon: 'bi-opencollective', title: 'Open Collective', color: '#7fadf2' },
                'patreon.com': { icon: 'bi-heart', title: 'Patreon', color: '#ff424d' }, // No Patreon icon in Bootstrap
                'kickstarter.com': { icon: 'bi-cash-coin', title: 'Kickstarter', color: '#05ce78' }, // No Kickstarter icon in Bootstrap
            };
            
            // Check for exact domain match
            if (brandMappings[domain]) {
                return brandMappings[domain];
            }
            
            // Check for subdomain matches (e.g., m.youtube.com, www.youtube.com)
            for (const [brandDomain, iconData] of Object.entries(brandMappings)) {
                if (domain.endsWith('.' + brandDomain) || domain === brandDomain) {
                    return iconData;
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Error determining brand icon:', error);
            return null;
        }
    }
};

/**
 * Text and content utility functions
 */
export const TextUtils = {
    /**
     * Truncate text to specified length
     * @param {string} text - Text to truncate
     * @param {number} length - Maximum length
     * @returns {string} Truncated text
     */
    truncate(text, length = 100) {
        if (!text || text.length <= length) return text;
        return text.substring(0, length).trim() + '...';
    },

    /**
     * Strip HTML tags from text
     * @param {string} html - HTML string
     * @returns {string} Plain text
     */
    stripHTML(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }
};

/**
 * Storage utility functions
 */
export const StorageUtils = {
    /**
     * Get item from localStorage with JSON parsing
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} Stored value or default
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    },

    /**
     * Set item in localStorage with JSON stringification
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Remove item from localStorage
     * @param {string} key - Storage key
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Clear all localStorage items with a prefix
     * @param {string} prefix - Key prefix
     */
    clearWithPrefix(prefix) {
        Object.keys(localStorage)
            .filter(key => key.startsWith(prefix))
            .forEach(key => localStorage.removeItem(key));
    }
};

/**
 * Performance and optimization utilities
 */
export const PerformanceUtils = {
    /**
     * Debounce function execution
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function execution
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Create an intersection observer for lazy loading
     * @param {Function} callback - Callback function
     * @param {Object} options - Observer options
     * @returns {IntersectionObserver} Observer instance
     */
    createIntersectionObserver(callback, options = {}) {
        const defaultOptions = {
            root: null,
            rootMargin: '100px',
            threshold: 0.1
        };
        
        return new IntersectionObserver(callback, { ...defaultOptions, ...options });
    }
};

/**
 * Accessibility utilities
 */
export const A11yUtils = {
    /**
     * Set focus to an element
     * @param {HTMLElement} element - Element to focus
     */
    focus(element) {
        if (element && typeof element.focus === 'function') {
            element.focus();
        }
    },

    /**
     * Announce text to screen readers
     * @param {string} text - Text to announce
     */
    announce(text) {
        const announcement = DOM.createElement('div', {
            'aria-live': 'polite',
            'aria-atomic': 'true',
            className: 'sr-only'
        }, text);
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    },

    /**
     * Create skip link
     * @param {string} targetId - Target element ID
     * @param {string} text - Link text
     * @returns {HTMLElement} Skip link element
     */
    createSkipLink(targetId, text = 'Skip to main content') {
        return DOM.createElement('a', {
            href: `#${targetId}`,
            className: 'skip-link sr-only-focusable btn btn-primary position-absolute',
            style: 'top: 10px; left: 10px; z-index: 9999;'
        }, text);
    }
};

/**
 * Animation utilities
 */
export const AnimationUtils = {
    /**
     * Fade in an element
     * @param {HTMLElement} element - Element to animate
     * @param {number} duration - Animation duration in ms
     */
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.transition = `opacity ${duration}ms ease-in-out`;
        
        setTimeout(() => {
            element.style.opacity = '1';
        }, 10);
    },

    /**
     * Fade out an element
     * @param {HTMLElement} element - Element to animate
     * @param {number} duration - Animation duration in ms
     * @returns {Promise} Promise that resolves when animation completes
     */
    fadeOut(element, duration = 300) {
        return new Promise(resolve => {
            element.style.transition = `opacity ${duration}ms ease-in-out`;
            element.style.opacity = '0';
            
            setTimeout(() => {
                resolve();
            }, duration);
        });
    },

    /**
     * Slide down element
     * @param {HTMLElement} element - Element to animate
     * @param {number} duration - Animation duration in ms
     */
    slideDown(element, duration = 300) {
        element.style.height = '0';
        element.style.overflow = 'hidden';
        element.style.transition = `height ${duration}ms ease-in-out`;
        
        const targetHeight = element.scrollHeight;
        
        setTimeout(() => {
            element.style.height = targetHeight + 'px';
        }, 10);
        
        setTimeout(() => {
            element.style.height = '';
            element.style.overflow = '';
            element.style.transition = '';
        }, duration);
    }
};

/**
 * Validation utilities
 */
export const ValidationUtils = {
    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Validate URL
     * @param {string} url - URL to validate
     * @returns {boolean} True if valid
     */
    isValidURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Check if string is empty or whitespace
     * @param {string} str - String to check
     * @returns {boolean} True if empty
     */
    isEmpty(str) {
        return !str || str.trim().length === 0;
    }
};

/**
 * Error formatting utilities
 */
export const ErrorUtils = {
    /**
     * Format error message for display
     * @param {string|Error} error - Error to format
     * @returns {string} Formatted error message
     */
    formatError(error) {
        if (typeof error === 'string') {
            return error;
        }
        
        if (error instanceof Error) {
            return error.message || 'An unknown error occurred';
        }
        
        if (error && typeof error === 'object') {
            return error.message || error.error || JSON.stringify(error);
        }
        
        return 'An unknown error occurred';
    }
};

/**
 * Toast notification utilities
 */
export const ToastUtils = {
    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type (success, error, warning, info)
     */
    showToast(message, type = 'success') {
        return DOM.showToast(message, type);
    }
};

export default {
    DOM,
    URLUtils,
    TextUtils,
    StorageUtils,
    PerformanceUtils,
    A11yUtils,
    AnimationUtils,
    ValidationUtils,
    ErrorUtils,
    ToastUtils
}; 