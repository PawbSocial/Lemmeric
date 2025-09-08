/**
 * API service for interacting with Lemmy instances
 * Handles all HTTP requests with proper error handling and rate limiting
 */

import { CONFIG, getInstanceConfig, getAuthToken } from './config.js';

/**
 * Rate limiting storage
 */
const rateLimitStore = new Map();

/**
 * Request cache for reducing duplicate requests
 */
const requestCache = new Map();

/**
 * Base API class for making requests to Lemmy instances
 */
export class LemmyAPI {
    constructor(instanceName = null) {
        this.instanceConfig = getInstanceConfig(instanceName);
        this.baseURL = this.instanceConfig.api;
    }

    /**
     * Check if we're being rate limited
     * @returns {boolean} True if rate limited
     */
    isRateLimited() {
        const key = this.instanceConfig.url;
        const now = Date.now();
        const window = rateLimitStore.get(key) || { requests: [], windowStart: now };
        
        // Clean old requests outside the window
        window.requests = window.requests.filter(time => now - time < CONFIG.API.RATE_LIMIT.WINDOW_MS);
        
        if (window.requests.length >= CONFIG.API.RATE_LIMIT.MAX_REQUESTS) {
            return true;
        }
        
        // Add current request
        window.requests.push(now);
        rateLimitStore.set(key, window);
        return false;
    }

    /**
     * Make a request with retry logic and error handling
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise} Response data
     */
    async makeRequest(endpoint, options = {}, retryCount = 0) {
        if (this.isRateLimited()) {
            throw new Error(CONFIG.ERRORS.RATE_LIMITED);
        }

        let url = `${this.baseURL}${endpoint}`;
        const cacheKey = `${url}_${JSON.stringify(options)}`;
        
        // Check cache for GET requests (but skip caching for /site endpoint during auth)
        if ((!options.method || options.method === 'GET') && requestCache.has(cacheKey) && endpoint !== '/site') {
            const cached = requestCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
                return cached.data;
            }
            requestCache.delete(cacheKey);
        }

        const requestOptions = {
            method: 'GET',
            headers: {
                'accept': 'application/json',
            },
            mode: 'cors',
            credentials: 'omit',
            ...options,
            signal: AbortSignal.timeout(CONFIG.API.TIMEOUT)
        };

        // Set Content-Type header only if not using FormData
        if (!(options.body instanceof FormData)) {
            requestOptions.headers['content-type'] = 'application/json';
        }

        // Add authentication BEFORE merging custom headers
        const isAuthEndpoint = endpoint.includes('/login') || endpoint.includes('/register');
        
        if (!isAuthEndpoint) {
            const authToken = getAuthToken();
            
            if (authToken) {
                // New format (0.19+): Authorization header (use lowercase to match Lemmy API)
                requestOptions.headers['authorization'] = `Bearer ${authToken}`;
                
                // For POST/PUT requests, try Authorization header first, fallback to body if needed
                if (requestOptions.method === 'POST' || requestOptions.method === 'PUT') {
                    // Start with just the Authorization header (API v3 standard)
                    console.log('Using Authorization header for POST/PUT request');
                } else {
                    // For GET requests, add auth to URL
                    const separator = url.includes('?') ? '&' : '?';
                    url = `${url}${separator}auth=${encodeURIComponent(authToken)}`;
                }
            } else {
                console.warn('No auth token found for request to:', endpoint);
            }
        }

        // Merge custom headers with defaults (but preserve auth headers)
        if (options.headers) {
            requestOptions.headers = { ...requestOptions.headers, ...options.headers };
        }

        try {
            // Debug logging for POST requests
            if (requestOptions.method === 'POST') {
                console.log('Making POST request to:', url);
                console.log('Request options:', {
                    method: requestOptions.method,
                    headers: requestOptions.headers,
                    body: requestOptions.body
                });
            }
            
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(CONFIG.ERRORS.RATE_LIMITED);
                } else if (response.status === 401) {
                    // If we get a 401, try adding auth to the body as fallback
                    if (requestOptions.method === 'POST' && !isAuthEndpoint) {
                        console.log('Got 401, trying with auth in body instead...');
                        const authToken = getAuthToken();
                        if (authToken && requestOptions.body) {
                            try {
                                const bodyData = JSON.parse(requestOptions.body);
                                bodyData.auth = authToken;
                                requestOptions.body = JSON.stringify(bodyData);
                                
                                // Remove Authorization header for the retry
                                delete requestOptions.headers['authorization'];
                                
                                console.log('Retrying with auth in body:', requestOptions.body);
                                const retryResponse = await fetch(url, requestOptions);
                                
                                if (!retryResponse.ok) {
                                    const errorText = await retryResponse.text();
                                    throw new Error(`HTTP ${retryResponse.status}: ${retryResponse.statusText} - ${errorText}`);
                                }
                                
                                const data = await retryResponse.json();
                                return data;
                            } catch (e) {
                                console.error('Failed to retry with auth in body:', e);
                            }
                        }
                    }
                    
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
                } else if (response.status >= 500) {
                    throw new Error(CONFIG.ERRORS.INSTANCE_DOWN);
                } else {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
                }
            }

            const data = await response.json();
            
            // Cache successful GET requests (but not /site endpoint due to auth state)
            if ((!options.method || options.method === 'GET') && endpoint !== '/site') {
                requestCache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
            }
            
            return data;
            
        } catch (error) {
            if (error.name === 'AbortError' || error.name === 'TimeoutError') {
                throw new Error(CONFIG.ERRORS.NETWORK);
            }
            
            if (retryCount < CONFIG.API.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.API.RETRY_DELAY * (retryCount + 1)));
                return this.makeRequest(endpoint, options, retryCount + 1);
            }
            
            throw error;
        }
    }

    /**
     * Get posts from the instance
     * @param {Object} params - Query parameters
     * @returns {Promise} Posts data
     */
    async getPosts(params = {}) {
        const queryParams = new URLSearchParams({
            type_: params.type_ || params.type || 'All',
            sort: params.sort || 'Active',
            page: params.page || 1,
            limit: params.limit || CONFIG.DEFAULT_PAGE_SIZE
        });

        // Add any additional params that aren't already set
        Object.keys(params).forEach(key => {
            if (!queryParams.has(key)) {
                queryParams.set(key, params[key]);
            }
        });

        return this.makeRequest(`/post/list?${queryParams}`);
    }

    /**
     * Get a specific post by ID
     * @param {number} postId - Post ID
     * @returns {Promise} Post data
     */
    async getPost(postId) {
        return this.makeRequest(`/post?id=${postId}`);
    }

    /**
     * Upload an image file
     * @param {File} file - Image file to upload
     * @param {string} type - Type of image (icon, banner, etc.)
     * @returns {Promise} Upload response with image URL
     */
    async uploadImage(file, type = 'image') {
        const formData = new FormData();
        formData.append('images[]', file);
        
        // Use Pictrs endpoint directly (not through Lemmy API)
        const pictrsUrl = this.baseURL.replace('/api/v3', '') + '/pictrs/image';
        
        const authToken = getAuthToken();
        const headers = {
            'accept': 'application/json'
        };
        
        if (authToken) {
            headers['authorization'] = `Bearer ${authToken}`;
        }
        
        const response = await fetch(pictrsUrl, {
            method: 'POST',
            body: formData,
            headers: headers,
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Pictrs returns different format, convert to expected format
        if (data.msg === 'ok' && data.files && data.files.length > 0) {
            const baseUrl = this.baseURL.replace('/api/v3', '');
            const fullImageUrl = `${baseUrl}/pictrs/image/${data.files[0].file}`;
            
            return {
                url: fullImageUrl,
                delete_url: data.files[0].delete_token ? 
                    `${pictrsUrl}?delete=${data.files[0].delete_token}` : null
            };
        } else {
            throw new Error(data.msg || 'Upload failed');
        }
    }

    /**
     * Create a new community
     * @param {Object} params - Community parameters
     * @param {string} params.name - Community name (required)
     * @param {string} params.title - Community display title (required)
     * @param {string} [params.description] - Community description
     * @param {string} [params.icon] - Community icon URL
     * @param {string} [params.banner] - Community banner URL
     * @param {boolean} [params.nsfw] - NSFW flag
     * @param {boolean} [params.posting_restricted_to_mods] - Only mods can post
     * @param {number[]} [params.discussion_languages] - Discussion language IDs
     * @param {string} [params.visibility] - Community visibility (Public, LocalOnly)
     * @returns {Promise} Create community response
     */
    async createCommunity(params) {
        return this.makeRequest('/community', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }

    /**
     * Edit an existing community
     * @param {Object} params - Community edit parameters
     * @param {number} params.community_id - Community ID to edit (required)
     * @param {string} [params.title] - New community display title
     * @param {string} [params.description] - New community description
     * @param {string} [params.icon] - New community icon URL
     * @param {string} [params.banner] - New community banner URL
     * @param {boolean} [params.nsfw] - NSFW flag
     * @param {boolean} [params.posting_restricted_to_mods] - Only mods can post
     * @param {number[]} [params.discussion_languages] - Discussion language IDs
     * @param {string} [params.visibility] - Community visibility (Public, LocalOnly)
     * @returns {Promise} Edit community response
     */
    async editCommunity(params) {
        return this.makeRequest('/community', {
            method: 'PUT',
            body: JSON.stringify(params)
        });
    }

    /**
     * Save user settings/profile
     * @param {Object} params - User settings parameters
     * @param {string} [params.display_name] - User display name
     * @param {string} [params.bio] - User bio/description
     * @param {string} [params.avatar] - User avatar URL
     * @param {string} [params.banner] - User banner URL
     * @param {string} [params.email] - User email
     * @param {string} [params.matrix_user_id] - Matrix user ID
     * @param {boolean} [params.show_nsfw] - Show NSFW content
     * @param {boolean} [params.blur_nsfw] - Blur NSFW content
     * @param {boolean} [params.auto_expand] - Auto expand posts
     * @param {boolean} [params.show_scores] - Show post/comment scores
     * @param {boolean} [params.show_upvotes] - Show upvotes
     * @param {boolean} [params.show_downvotes] - Show downvotes
     * @param {boolean} [params.show_upvote_percentage] - Show upvote percentage
     * @param {boolean} [params.show_avatars] - Show user avatars
     * @param {boolean} [params.bot_account] - Mark as bot account
     * @param {boolean} [params.show_bot_accounts] - Show bot accounts
     * @param {boolean} [params.show_read_posts] - Show read posts
     * @param {boolean} [params.send_notifications_to_email] - Send email notifications
     * @param {boolean} [params.open_links_in_new_tab] - Open links in new tab
     * @param {string} [params.theme] - User theme preference
     * @param {string} [params.interface_language] - Interface language
     * @param {string} [params.default_listing_type] - Default listing type
     * @param {string} [params.default_post_sort_type] - Default post sort type
     * @param {string} [params.default_comment_sort_type] - Default comment sort type
     * @param {number[]} [params.discussion_languages] - Discussion languages
     * @returns {Promise} Save user settings response
     */
    async saveUserSettings(params) {
        return this.makeRequest('/user/save_user_settings', {
            method: 'PUT',
            body: JSON.stringify(params)
        });
    }

    /**
     * Create a new post
     * @param {Object} params - Post parameters
     * @param {string} params.name - Post title
     * @param {number} params.community_id - Community ID (required)
     * @param {string} [params.body] - Post body content
     * @param {string} [params.url] - Post URL
     * @param {boolean} [params.nsfw] - NSFW flag
     * @param {number} [params.language_id] - Language ID
     * @returns {Promise} Create post response
     */
    async createPost(params) {
        return this.makeRequest('/post', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }

    /**
     * Edit a post
     * @param {Object} params - Post edit parameters
     * @param {number} params.post_id - Post ID to edit
     * @param {string} [params.name] - New post title
     * @param {string} [params.url] - New post URL
     * @param {string} [params.body] - New post body content
     * @param {boolean} [params.nsfw] - NSFW flag
     * @param {number} [params.language_id] - Language ID
     * @returns {Promise} Edit post response
     */
    async editPost(params) {
        // Ensure post_id is a number
        const numericPostId = parseInt(params.post_id);
        if (isNaN(numericPostId)) {
            throw new Error(`Invalid post ID: ${params.post_id}`);
        }
        
        // Get auth token
        const authToken = getAuthToken();
        if (!authToken) {
            throw new Error('Authentication required to edit posts');
        }
        
        // Prepare request body with only provided parameters
        const requestBody = {
            post_id: numericPostId
        };
        
        // Add optional parameters if they exist
        if (params.name !== undefined) requestBody.name = params.name;
        if (params.url !== undefined) requestBody.url = params.url;
        if (params.body !== undefined) requestBody.body = params.body;
        if (params.nsfw !== undefined) requestBody.nsfw = params.nsfw;
        if (params.language_id !== undefined) requestBody.language_id = params.language_id;
        
        console.log('Edit post request body:', requestBody);
        
        const response = await this.makeRequest('/post', {
            method: 'PUT',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(requestBody)
        });
        
        return response;
    }

    /**
     * Delete or restore a post
     * @param {number} postId - Post ID to delete/restore
     * @param {boolean} deleted - True to delete, false to restore
     * @returns {Promise} Delete/restore post response
     */
    async deletePost(postId, deleted = true) {
        // Ensure postId is a number
        const numericPostId = parseInt(postId);
        if (isNaN(numericPostId)) {
            throw new Error(`Invalid post ID: ${postId}`);
        }
        
        // Get auth token
        const authToken = getAuthToken();
        if (!authToken) {
            throw new Error('Authentication required to delete/restore posts');
        }
        
        // Use the exact format from the working example
        const requestBody = {
            post_id: numericPostId,
            deleted: deleted
        };
        
        console.log(`${deleted ? 'Delete' : 'Restore'} post request body:`, requestBody);
        console.log('Post ID type:', typeof numericPostId, 'Value:', numericPostId);
        
        // Use the exact headers from the working example
        const response = await this.makeRequest('/post/delete', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(requestBody)
        });
        
        return response;
    }



    /**
     * Get comments for a post
     * @param {number} postId - Post ID
     * @param {Object} params - Query parameters
     * @returns {Promise} Comments data
     */
    async getComments(postId, params = {}) {
        const queryParams = new URLSearchParams({
            post_id: postId,
            sort: params.sort || 'Hot',
            max_depth: params.maxDepth || params.max_depth || 8,
            type_: params.type_ || params.type || 'All'
        });

        // Add any additional params that aren't already set
        Object.keys(params).forEach(key => {
            if (!queryParams.has(key)) {
                queryParams.set(key, params[key]);
            }
        });

        return this.makeRequest(`/comment/list?${queryParams}`);
    }

    /**
     * Get communities from the instance
     * @param {Object} params - Query parameters
     * @returns {Promise} Communities data
     */
    async getCommunities(params = {}) {
        const queryParams = new URLSearchParams({
            type_: params.type_ || params.type || 'All',
            sort: params.sort || 'Active',
            page: params.page || 1,
            limit: params.limit || 50
        });

        // Add any additional params that aren't already set
        Object.keys(params).forEach(key => {
            if (!queryParams.has(key)) {
                queryParams.set(key, params[key]);
            }
        });

        return this.makeRequest(`/community/list?${queryParams}`);
    }

    /**
     * Get a specific community
     * @param {string} name - Community name
     * @returns {Promise} Community data
     */
    async getCommunity(name) {
        return this.makeRequest(`/community?name=${encodeURIComponent(name)}`);
    }

    /**
     * Get community details with moderators
     * @param {string|number} communityId - Community ID or name
     * @returns {Promise} Detailed community data with moderators
     */
    async getCommunityDetails(communityId) {
        try {
            let queryParam;
            if (typeof communityId === 'number') {
                queryParam = `id=${communityId}`;
            } else {
                queryParam = `name=${encodeURIComponent(communityId)}`;
            }
            return this.makeRequest(`/community?${queryParam}`);
        } catch (error) {
            console.error('Failed to get community details:', error);
            throw error;
        }
    }

    /**
     * Get posts from a specific community
     * @param {string|number} communityId - Community ID or name
     * @param {string} sort - Sort method (Active, Hot, New, etc.)
     * @param {number} page - Page number
     * @returns {Promise} Community posts data
     */
    async getCommunityPosts(communityId, sort = 'Active', page = 1) {
        try {
            // Use the same approach as getPosts but with community parameters
            const params = {
                sort: sort,
                page: page,
                limit: CONFIG.DEFAULT_PAGE_SIZE,
                type_: 'All'
            };

            // Add community parameter based on type
            if (typeof communityId === 'number') {
                params.community_id = communityId;
                console.log('Using community_id:', communityId);
            } else {
                params.community_name = communityId;
                console.log('Using community_name:', communityId);
            }

            console.log('Community posts params:', params);
            
            // Use the same method as getPosts
            return this.getPosts(params);
        } catch (error) {
            console.error('Failed to get community posts:', error);
            throw error;
        }
    }

    /**
     * Get moderators for a community
     * @param {number} communityId - Community ID
     * @returns {Promise} Moderators data
     */
    async getModerators(communityId) {
        try {
            // Get community details which includes moderators array
            const response = await this.makeRequest(`/community?id=${communityId}`);
            
            // According to the API schema, moderators are directly in response.moderators
            const moderators = response.moderators || [];
            
            // Extract just the moderator user data from each moderator object
            const moderatorUsers = moderators.map(mod => {
                const moderatorUser = mod.moderator;
                return moderatorUser;
            });
            
            return { moderators: moderatorUsers };
        } catch (error) {
            console.error('Failed to get community moderators:', error);
            // Return empty moderators array if there's an error
            return { moderators: [] };
        }
    }

    /**
     * Get site information
     * @returns {Promise} Site data
     */
    async getSite() {
        return this.makeRequest('/site');
    }

    /**
     * Search for posts, communities, or users
     * @param {Object} params - Search parameters
     * @returns {Promise} Search results
     */
    async search(params = {}) {
        const queryParams = new URLSearchParams({
            q: params.query || params.q || '',
            type_: params.type_ || params.type || 'All',
            sort: params.sort || 'TopAll',
            listing_type: params.listingType || params.listing_type || 'All',
            page: params.page || 1,
            limit: params.limit || 20
        });

        // Add any additional params that aren't already set
        Object.keys(params).forEach(key => {
            if (!queryParams.has(key)) {
                queryParams.set(key, params[key]);
            }
        });

        return this.makeRequest(`/search?${queryParams}`);
    }

    /**
     * Get user information
     * @param {string} username - Username
     * @returns {Promise} User data
     */
    async getUser(username) {
        return this.makeRequest(`/user?username=${encodeURIComponent(username)}`);
    }

    /**
     * Get posts by a specific user
     * @param {number|string} userId - User ID or username
     * @param {string} sort - Sort type (New, Old, TopDay, TopWeek, TopMonth, TopYear, TopAll)
     * @param {number} page - Page number
     * @param {number} limit - Number of posts per page
     * @returns {Promise} User posts data
     */
    async getUserPosts(userId, sort = 'New', page = 1, limit = 20) {
        const params = new URLSearchParams({
            sort,
            page: page.toString(),
            limit: limit.toString(),
            saved_only: 'false'  // Get all posts, not just saved ones
        });

        // Handle both user ID and username
        if (typeof userId === 'string' && isNaN(userId)) {
            params.append('username', userId);
        } else {
            params.append('person_id', userId.toString());
        }

        console.log('getUserPosts API call:', {
            userId,
            sort,
            page,
            limit,
            params: params.toString()
        });

        return this.makeRequest(`/user?${params.toString()}`);
    }

    /**
     * Get comments by a specific user
     * @param {number|string} userId - User ID or username  
     * @param {string} sort - Sort type (New, Old, TopDay, TopWeek, TopMonth, TopYear, TopAll)
     * @param {number} page - Page number
     * @param {number} limit - Number of comments per page
     * @returns {Promise} User comments data
     */
    async getUserComments(userId, sort = 'New', page = 1, limit = 20) {
        const params = new URLSearchParams({
            sort,
            page: page.toString(),
            limit: limit.toString(),
            saved_only: 'false'  // Get all comments, not just saved ones
        });

        // Handle both user ID and username
        if (typeof userId === 'string' && isNaN(userId)) {
            params.append('username', userId);
        } else {
            params.append('person_id', userId.toString());
        }

        return this.makeRequest(`/user?${params.toString()}`);
    }

    /**
     * Get instance statistics and information
     * @returns {Promise} Instance stats
     */
    async getInstanceStats() {
        try {
            const siteData = await this.getSite();
            return {
                users: siteData.site_view?.counts?.users || 0,
                posts: siteData.site_view?.counts?.posts || 0,
                comments: siteData.site_view?.counts?.comments || 0,
                communities: siteData.site_view?.counts?.communities || 0,
                version: siteData.version || 'Unknown',
                name: siteData.site_view?.site?.name || this.instanceConfig.name,
                description: siteData.site_view?.site?.description || this.instanceConfig.description
            };
        } catch (error) {
            console.error('Failed to get instance stats:', error);
            return {
                users: 0,
                posts: 0,
                comments: 0,
                communities: 0,
                version: 'Unknown',
                name: this.instanceConfig.name,
                description: this.instanceConfig.description
            };
        }
    }

    /**
     * Get taglines from the instance
     * @returns {Promise} Taglines data
     */
    async getRandomTagline() {
        try {
            const siteData = await this.getSite();
            
            // Check if there's a single tagline in the site response
            if (siteData.tagline?.content) {
                return siteData.tagline.content;
            }
            
            // Check if there are multiple taglines
            if (siteData.taglines && Array.isArray(siteData.taglines) && siteData.taglines.length > 0) {
                // Pick a random tagline from the array
                const randomIndex = Math.floor(Math.random() * siteData.taglines.length);
                return siteData.taglines[randomIndex].content;
            }
            
            return null;
        } catch (error) {
            console.error('Failed to get tagline:', error);
            return null;
        }
    }

    /**
     * Get trending communities from the current instance (local only)
     * @param {number} limit - Number of communities to fetch
     * @returns {Promise} Local trending communities
     */
    async getTrendingCommunities(limit = 10) {
        try {
            const response = await this.getCommunities({
                sort: 'TopMonth',
                type: 'Local',
                limit: limit
            });
            return response.communities || [];
        } catch (error) {
            console.error('Failed to get trending communities:', error);
            return [];
        }
    }

    /**
     * Check if the instance is reachable
     * @returns {Promise<boolean>} True if reachable
     */
    async ping() {
        try {
            await this.makeRequest('/site');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Login to the instance
     * @param {string} username - Username or email
     * @param {string} password - Password
     * @returns {Promise} Login response with JWT
     */
    async login(username, password) {
        const loginData = {
            username_or_email: username,
            password: password
        };

        return this.makeRequest('/user/login', {
            method: 'POST',
            body: JSON.stringify(loginData)
        });
    }

    /**
     * Register a new account
     * @param {string} username - Username
     * @param {string} password - Password
     * @param {string} password_verify - Password confirmation
     * @param {string} email - Email address (optional)
     * @param {boolean} show_nsfw - Show NSFW content preference
     * @param {string} captcha_uuid - Captcha UUID if required
     * @param {string} captcha_answer - Captcha answer if required
     * @returns {Promise} Registration response
     */
    async register(username, password, password_verify, email = null, show_nsfw = false, captcha_uuid = null, captcha_answer = null) {
        const registerData = {
            username: username,
            password: password,
            password_verify: password_verify,
            show_nsfw: show_nsfw
        };

        if (email) {
            registerData.email = email;
        }

        if (captcha_uuid && captcha_answer) {
            registerData.captcha_uuid = captcha_uuid;
            registerData.captcha_answer = captcha_answer;
        }

        return this.makeRequest('/user/register', {
            method: 'POST',
            body: JSON.stringify(registerData)
        });
    }

    /**
     * Get current user info (requires authentication)
     * @returns {Promise} User information
     */
    async getCurrentUser() {
        // Use /site endpoint which returns current user info when authenticated
        return this.makeRequest('/site');
    }

    /**
     * Logout (invalidate JWT on server)
     * @returns {Promise} Logout response
     */
    async logout() {
        return this.makeRequest('/user/logout', {
            method: 'POST',
            body: JSON.stringify({})
        });
    }

    /**
     * Get user replies (comments on user's posts/comments)
     * @param {Object} params - Query parameters
     * @returns {Promise} Replies data
     */
    async getReplies(params = {}) {
        const queryParams = new URLSearchParams({
            sort: params.sort || 'New',
            page: params.page || 1,
            limit: params.limit || 50,
            unread_only: params.unread_only || false
        });

        return this.makeRequest(`/user/replies?${queryParams}`);
    }

    /**
     * Get user mentions (@username)
     * @param {Object} params - Query parameters  
     * @returns {Promise} Mentions data
     */
    async getMentions(params = {}) {
        const queryParams = new URLSearchParams({
            sort: params.sort || 'New',
            page: params.page || 1,
            limit: params.limit || 50,
            unread_only: params.unread_only || false
        });

        return this.makeRequest(`/user/mention?${queryParams}`);
    }

    /**
     * Get private messages
     * @param {Object} params - Query parameters
     * @returns {Promise} Private messages data
     */
    async getPrivateMessages(params = {}) {
        const queryParams = new URLSearchParams({
            page: params.page || 1,
            limit: params.limit || 50,
            unread_only: params.unread_only || false
        });

        return this.makeRequest(`/private_message/list?${queryParams}`);
    }

    /**
     * Mark a reply as read
     * @param {number} replyId - Reply ID
     * @returns {Promise} Mark read response
     */
    async markReplyAsRead(replyId) {
        return this.makeRequest('/user/mark_comment_reply_as_read', {
            method: 'POST',
            body: JSON.stringify({
                comment_reply_id: replyId,
                read: true
            })
        });
    }

    /**
     * Mark a mention as read
     * @param {number} mentionId - Mention ID
     * @returns {Promise} Mark read response
     */
    async markMentionAsRead(mentionId) {
        return this.makeRequest('/user/mark_person_mention_as_read', {
            method: 'POST',
            body: JSON.stringify({
                person_mention_id: mentionId,
                read: true
            })
        });
    }

    /**
     * Mark a private message as read
     * @param {number} messageId - Private message ID
     * @returns {Promise} Mark read response
     */
    async markPrivateMessageAsRead(messageId) {
        return this.makeRequest('/private_message/mark_as_read', {
            method: 'POST',
            body: JSON.stringify({
                private_message_id: messageId,
                read: true
            })
        });
    }

    /**
     * Create/send a private message
     * @param {Object} params - Message parameters
     * @param {string} params.content - Message content
     * @param {number} params.recipient_id - Recipient user ID
     * @returns {Promise} Create message response
     */
    async createPrivateMessage(params) {
        return this.makeRequest('/private_message', {
            method: 'POST',
            body: JSON.stringify({
                content: params.content,
                recipient_id: params.recipient_id
            })
        });
    }

    /**
     * Report a private message to administrators
     * @param {Object} params - Report parameters
     * @returns {Promise} Report response
     */
    async reportPrivateMessage(params) {
        return this.makeRequest('/private_message/report', {
            method: 'POST',
            body: JSON.stringify({
                private_message_id: params.private_message_id,
                reason: params.reason
            })
        });
    }

    /**
     * Mark all replies as read
     * @returns {Promise} Mark all read response
     */
    async markAllRepliesAsRead() {
        return this.makeRequest('/user/mark_all_as_read', {
            method: 'POST',
            body: JSON.stringify({})
        });
    }

    /**
     * Get unread notification counts
     * @returns {Promise} Unread counts response
     */
    async getUnreadCounts() {
        return this.makeRequest('/user/unread_count');
    }

    /**
     * List comment reports for admin/moderators
     */
    async listCommentReports(params = {}) {
        const queryParams = new URLSearchParams({
            unresolved_only: params.unresolved_only !== undefined ? params.unresolved_only : true,
            page: params.page || 1,
            limit: params.limit || 10
        });
        return this.makeRequest(`/comment/report/list?${queryParams}`);
    }

    /**
     * List post reports for admin/moderators
     */
    async listPostReports(params = {}) {
        const queryParams = new URLSearchParams({
            unresolved_only: params.unresolved_only !== undefined ? params.unresolved_only : true,
            page: params.page || 1,
            limit: params.limit || 10
        });
        return this.makeRequest(`/post/report/list?${queryParams}`);
    }

    /**
     * List private message reports for admins
     */
    async listPrivateMessageReports(params = {}) {
        const queryParams = new URLSearchParams({
            unresolved_only: params.unresolved_only !== undefined ? params.unresolved_only : true,
            page: params.page || 1,
            limit: params.limit || 10
        });
        return this.makeRequest(`/private_message/report/list?${queryParams}`);
    }

    /**
     * Resolve comment report
     */
    async resolveCommentReport(params) {
        return this.makeRequest('/comment/report/resolve', {
            method: 'PUT',
            body: JSON.stringify(params)
        });
    }

    /**
     * Resolve post report
     */
    async resolvePostReport(params) {
        return this.makeRequest('/post/report/resolve', {
            method: 'PUT',
            body: JSON.stringify(params)
        });
    }

    /**
     * Resolve private message report
     */
    async resolvePrivateMessageReport(params) {
        return this.makeRequest('/private_message/report/resolve', {
            method: 'PUT',
            body: JSON.stringify(params)
        });
    }

    /**
     * List registration applications for admins
     */
    async listRegistrationApplications(params = {}) {
        const queryParams = new URLSearchParams({
            unread_only: params.unread_only !== undefined ? params.unread_only : false,
            page: params.page || 1,
            limit: params.limit || 10
        });
        return this.makeRequest(`/admin/registration_application/list?${queryParams}`);
    }

    /**
     * Approve or deny registration application
     */
    async approveRegistrationApplication(params) {
        return this.makeRequest('/admin/registration_application/approve', {
            method: 'PUT',
            body: JSON.stringify(params)
        });
    }

    /**
     * Remove/hide a post
     * @param {Object} params - Parameters
     * @returns {Promise} API response
     */
    async removePost(params) {
        return this.makeRequest('/post/remove', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }

    /**
     * Remove/hide a comment
     * @param {Object} params - Parameters
     * @returns {Promise} API response
     */
    async removeComment(params) {
        return this.makeRequest('/comment/remove', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }

    /**
     * Delete/undelete a comment (soft delete)
     * @param {Object} params - Parameters
     * @param {number} params.comment_id - Comment ID to delete/undelete
     * @param {boolean} params.deleted - True to delete, false to undelete
     * @returns {Promise} API response
     */
    async deleteComment(params) {
        return this.makeRequest('/comment/delete', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }

    /**
     * Ban user from community
     * @param {Object} params - Parameters
     * @returns {Promise} API response
     */
    async banFromCommunity(params) {
        return this.makeRequest('/community/ban_user', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }

    /**
     * Purge user from instance
     * @param {Object} params - Parameters
     * @returns {Promise} API response
     */
    async purgePerson(params) {
        return this.makeRequest('/admin/purge/person', {
            method: 'POST',
            body: JSON.stringify(params)
        });
    }

    /**
     * Vote on a post
     * @param {number} postId - Post ID
     * @param {number} score - Vote score (1 for upvote, -1 for downvote, 0 to remove vote)
     * @returns {Promise} Vote response
     */
    async votePost(postId, score) {
        return this.makeRequest('/post/like', {
            method: 'POST',
            body: JSON.stringify({
                post_id: postId,
                score: score
            })
        });
    }

    /**
     * Vote on a comment
     * @param {number} commentId - Comment ID
     * @param {number} score - Vote score (1 for upvote, -1 for downvote, 0 to remove vote)
     * @returns {Promise} Vote response
     */
    async voteComment(commentId, score) {
        return this.makeRequest('/comment/like', {
            method: 'POST',
            body: JSON.stringify({
                comment_id: commentId,
                score: score
            })
        });
    }

    /**
     * Create a new comment
     * @param {Object} params - Comment parameters
     * @param {string} params.content - Comment content
     * @param {number} params.post_id - Post ID to comment on
     * @param {number} params.parent_id - Parent comment ID for replies (optional)
     * @returns {Promise} Comment creation response
     */
    async createComment(params) {
        const commentData = {
            content: params.content,
            post_id: params.post_id
        };

        // Add parent_id if this is a reply to another comment
        if (params.parent_id) {
            commentData.parent_id = params.parent_id;
        }

        return this.makeRequest('/comment', {
            method: 'POST',
            body: JSON.stringify(commentData)
        });
    }

    /**
     * Edit a comment
     * @param {Object} params - Comment edit parameters
     * @param {number} params.comment_id - Comment ID to edit
     * @param {string} params.content - New comment content
     * @param {number} [params.language_id] - Language ID
     * @returns {Promise} Edit comment response
     */
    async editComment(params) {
        // Ensure comment_id is a number
        const numericCommentId = parseInt(params.comment_id);
        if (isNaN(numericCommentId)) {
            throw new Error(`Invalid comment ID: ${params.comment_id}`);
        }
        
        // Get auth token
        const authToken = getAuthToken();
        if (!authToken) {
            throw new Error('Authentication required to edit comments');
        }
        
        // Prepare request body
        const requestBody = {
            comment_id: numericCommentId,
            content: params.content
        };
        
        // Add optional language_id if provided
        if (params.language_id !== undefined) {
            requestBody.language_id = params.language_id;
        }
        
        console.log('Edit comment request body:', requestBody);
        
        const response = await this.makeRequest('/comment', {
            method: 'PUT',
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(requestBody)
        });
        
        return response;
    }

    /**
     * Create a private message report
     * @param {Object} params - Report parameters
     * @param {number} params.private_message_id - Private message ID to report
     * @param {string} params.reason - Reason for the report
     * @returns {Promise} Report response
     */
    async createPrivateMessageReport(params) {
        return this.makeRequest('/private_message/report', {
            method: 'POST',
            body: JSON.stringify({
                private_message_id: params.private_message_id,
                reason: params.reason
            })
        });
    }

    /**
     * Create a post report
     * @param {Object} params - Report parameters
     * @param {number} params.post_id - Post ID to report
     * @param {string} params.reason - Reason for the report
     * @returns {Promise} Report response
     */
    async createPostReport(params) {
        return this.makeRequest('/post/report', {
            method: 'POST',
            body: JSON.stringify({
                post_id: params.post_id,
                reason: params.reason
            })
        });
    }

    /**
     * Create a comment report
     * @param {Object} params - Report parameters
     * @param {number} params.comment_id - Comment ID to report
     * @param {string} params.reason - Reason for the report
     * @returns {Promise} Report response
     */
    async createCommentReport(params) {
        return this.makeRequest('/comment/report', {
            method: 'POST',
            body: JSON.stringify({
                comment_id: params.comment_id,
                reason: params.reason
            })
        });
    }
}

/**
 * Utility functions for working with API data
 */
export const APIUtils = {
    /**
     * Format post data for display
     * @param {Object} post - Raw post data from API
     * @returns {Object} Formatted post data
     */
    formatPost(post) {
        if (!post) {
            console.error('formatPost: No post data provided');
            return null;
        }

        const postView = post.post_view || post;
        const postData = postView.post || postView;
        const creator = postView.creator;
        const community = postView.community;
        const counts = postView.counts;
        const crossPosts = post.cross_posts || [];

        if (!postData) {
            console.error('formatPost: No post data found in:', post);
            return null;
        }

        if (!postData.id) {
            console.error('formatPost: Post data missing id:', postData);
            return null;
        }

        return {
            id: postData.id,
            title: postData.name || postData.title || 'Untitled',
            content: postData.body || postData.content || '',
            url: postData.url,
            thumbnail: postData.thumbnail_url,
            nsfw: postData.nsfw || false,
            deleted: postData.deleted || false,
            published: new Date(postData.published),
            updated: postData.updated ? new Date(postData.updated) : null,
            // Include embedded content fields for external URLs
            embedTitle: postData.embed_title,
            embedDescription: postData.embed_description,
            embedVideoUrl: postData.embed_video_url,
            urlContentType: postData.url_content_type,
            // User's vote on this post (1 for upvote, -1 for downvote, 0 for no vote)
            myVote: postView.my_vote || 0,
            author: {
                name: creator?.name || 'Unknown',
                displayName: creator?.display_name || creator?.name || 'Unknown',
                avatar: creator?.avatar,
                local: creator?.local !== false,
                actor_id: creator?.actor_id
            },
            community: {
                id: community?.id,
                name: community?.name || 'unknown',
                title: community?.title || community?.name || 'Unknown Community',
                icon: community?.icon,
                local: community?.local !== false,
                actor_id: community?.actor_id
            },
            stats: {
                upvotes: counts?.upvotes || 0,
                downvotes: counts?.downvotes || 0,
                score: counts?.score || 0,
                comments: counts?.comments || 0
            },
            crossPosts: crossPosts.map(cp => {
                const cpView = cp.post_view || cp;
                const cpPost = cpView.post || cpView;
                const cpCommunity = cpView.community;
                return {
                    id: cpPost.id,
                    community: {
                        id: cpCommunity?.id,
                        name: cpCommunity?.name || 'unknown',
                        title: cpCommunity?.title || cpCommunity?.name || 'Unknown Community',
                        local: cpCommunity?.local || false,
                        actor_id: cpCommunity?.actor_id
                    }
                };
            })
        };
    },

    /**
     * Format community data for display
     * @param {Object} community - Raw community data from API
     * @returns {Object} Formatted community data
     */
    formatCommunity(community) {
        // Handle different API response structures
        // New API structure: { community: {...}, counts: {...}, subscribed: "...", blocked: true }
        // Old API structure: { community_view: { community: {...}, counts: {...} } }
        let communityData, counts;
        
        if (community.community) {
            // New API structure
            communityData = community.community;
            counts = community.counts;
        } else if (community.community_view) {
            // Old API structure  
            const communityView = community.community_view;
            communityData = communityView.community;
            counts = communityView.counts;
        } else {
            // Direct community object
            communityData = community;
            counts = community.counts || {};
        }

        if (!communityData) {
            console.error('formatCommunity: No community data found in:', community);
            return null;
        }

        // Extract instance information from actor_id
        let instanceInfo = { host: 'Unknown', isLocal: true };
        if (communityData.actor_id) {
            try {
                const url = new URL(communityData.actor_id);
                instanceInfo.host = url.hostname;
                instanceInfo.isLocal = communityData.local !== false;
            } catch (e) {
                console.warn('Failed to parse community actor_id:', communityData.actor_id);
            }
        }

        return {
            id: communityData.id,
            name: communityData.name,
            title: communityData.title,
            description: communityData.description,
            icon: communityData.icon,
            banner: communityData.banner,
            nsfw: communityData.nsfw,
            published: new Date(communityData.published),
            updated: communityData.updated ? new Date(communityData.updated) : null,
            actor_id: communityData.actor_id,
            local: communityData.local,
            removed: communityData.removed,
            deleted: communityData.deleted,
            posting_restricted_to_mods: communityData.posting_restricted_to_mods,
            instance: instanceInfo,
            stats: {
                subscribers: counts?.subscribers || 0,
                posts: counts?.posts || 0,
                comments: counts?.comments || 0,
                users_active_day: counts?.users_active_day || 0,
                users_active_week: counts?.users_active_week || 0,
                users_active_month: counts?.users_active_month || 0,
                users_active_half_year: counts?.users_active_half_year || 0,
                subscribers_local: counts?.subscribers_local || 0,
                // Include any additional counts that might be available
                ...counts
            },
            // Additional API fields
            subscribed: community.subscribed,
            blocked: community.blocked,
            banned_from_community: community.banned_from_community
        };
    },

    /**
     * Format user data for display
     * @param {Object} userResponse - Raw user data from API (complete response with person_view, posts, comments)
     * @returns {Object} Formatted user data
     */
    formatUser(userResponse) {
        // Extract the person_view, posts, comments, and moderates from the full response
        const personView = userResponse.person_view || userResponse;
        const userData = personView.person;
        const counts = personView.counts;
        const posts = userResponse.posts || [];
        const comments = userResponse.comments || [];
        const moderates = userResponse.moderates || [];

        // Calculate total post score by summing all post scores
        const postScore = posts.reduce((total, post) => {
            return total + (post.counts?.score || 0);
        }, 0);

        // Calculate total comment score by summing all comment scores  
        const commentScore = comments.reduce((total, comment) => {
            return total + (comment.counts?.score || 0);
        }, 0);

        // Extract instance information from actor_id
        let instanceInfo = { host: 'Unknown', isLocal: true };
        if (userData.actor_id) {
            try {
                const url = new URL(userData.actor_id);
                instanceInfo.host = url.hostname;
                instanceInfo.isLocal = userData.local !== false;
            } catch (e) {
                console.warn('Failed to parse user actor_id:', userData.actor_id);
            }
        }

        // Format moderated communities
        const moderatedCommunities = moderates.map(moderateEntry => {
            const community = moderateEntry.community;
            
            // Extract instance information from community actor_id
            let communityInstanceInfo = { host: 'Unknown', isLocal: true };
            if (community.actor_id) {
                try {
                    const url = new URL(community.actor_id);
                    communityInstanceInfo.host = url.hostname;
                    communityInstanceInfo.isLocal = community.local !== false;
                } catch (e) {
                    console.warn('Failed to parse community actor_id:', community.actor_id);
                }
            }

            return {
                id: community.id,
                name: community.name,
                title: community.title,
                description: community.description,
                icon: community.icon,
                banner: community.banner,
                nsfw: community.nsfw,
                local: community.local,
                actor_id: community.actor_id,
                instance: communityInstanceInfo
            };
        });

        return {
            id: userData.id,
            name: userData.name,
            displayName: userData.display_name,
            bio: userData.bio,
            avatar: userData.avatar,
            banner: userData.banner,
            published: userData.published ? new Date(userData.published) : null,
            updated: userData.updated ? new Date(userData.updated) : null,
            actor_id: userData.actor_id,
            local: userData.local,
            deleted: userData.deleted,
            admin: userData.admin,
            bot_account: userData.bot_account,
            banned: userData.banned,
            instance: instanceInfo,
            moderatedCommunities: moderatedCommunities,
            stats: {
                post_count: counts?.post_count || 0,
                comment_count: counts?.comment_count || 0,
                post_score: postScore,
                comment_score: commentScore,
                // Include any additional counts that might be available
                ...counts
            }
        };
    },

    /**
     * Format time for display
     * @param {Date} date - Date object
     * @returns {string} Formatted time string
     */
    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'just now';
    },

    /**
     * Format numbers for display (e.g., 1234 -> 1.2k)
     * @param {number} num - Number to format
     * @returns {string} Formatted number string
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }
};

// Export a default instance
export default new LemmyAPI(); 