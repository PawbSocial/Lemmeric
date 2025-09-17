/**
 * Authentication service for Lemmeric
 * 
 * This module handles user authentication, session management, and user data
 * persistence across different Lemmy instances. It provides a centralized
 * way to manage login, logout, and user state throughout the application.
 * 
 * @fileoverview Authentication and user session management
 */

import { 
    getAuthToken, 
    setAuthToken, 
    removeAuthToken, 
    getUserData, 
    setUserData, 
    removeUserData, 
    isAuthenticated,
    getCurrentInstance 
} from './config.js';
import { LemmyAPI } from './api.js';

// ========================================
// AUTHENTICATION MANAGER CLASS
// ========================================

/**
 * Authentication manager class
 * Handles user authentication and session management
 */
export class AuthManager {
    constructor() {
        this.api = null;
        this.currentUser = null;
        this.listeners = new Set();
        this.lastAuthCheck = null;
    }

    // ========================================
    // INITIALIZATION METHODS
    // ========================================

    /**
     * Initialize with current instance
     */
    init() {
        this.api = new LemmyAPI();
        this.loadCurrentUser();
    }

    // ========================================
    // EVENT HANDLING METHODS
    // ========================================

    /**
     * Add event listener for authentication changes
     * @param {Function} callback - Callback function
     */
    addListener(callback) {
        this.listeners.add(callback);
    }

    /**
     * Remove event listener
     * @param {Function} callback - Callback function
     */
    removeListener(callback) {
        this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of authentication changes
     * @param {string} event - Event type ('login', 'logout', 'userUpdate')
     * @param {Object} data - Event data
     */
    notifyListeners(event, data = null) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Error in auth listener:', error);
            }
        });
    }

    // ========================================
    // AUTHENTICATION METHODS
    // ========================================

    /**
     * Load current user data from storage and validate token
     */
    async loadCurrentUser() {
        // Rate limiting: prevent too many rapid auth checks
        const now = Date.now();
        if (this.lastAuthCheck && (now - this.lastAuthCheck) < 2000) {
            return;
        }
        this.lastAuthCheck = now;

        const userData = getUserData();
        const hasToken = isAuthenticated();
        
        if (userData && hasToken) {
            // We have stored user data and a token, but let's validate the token
            try {
                // Try to get fresh user info to validate the token
                const userInfo = await this.api.getCurrentUser();
                
                if (userInfo.my_user) {
                    // Token is valid, update user data and notify
                    const person = userInfo.my_user.local_user_view.person;
                    const localUser = userInfo.my_user.local_user_view.local_user;
                    const counts = userInfo.my_user.local_user_view.counts;
                    
                    const refreshedUserData = {
                        ...userData,
                        displayName: person.display_name,
                        avatar: person.avatar,
                        banner: person.banner,
                        bio: person.bio,
                        counts: counts
                    };
                    
                    setUserData(refreshedUserData);
                    this.currentUser = refreshedUserData;
                    this.notifyListeners('userLoaded', refreshedUserData);
                } else {
                    // Token is invalid, clean up
                    this.logout(false);
                }
            } catch (error) {
                // Token validation failed, clean up stored data
                console.warn('Stored token validation failed, logging out:', error.message);
                this.logout(false);
            }
        }
    }

    /**
     * Login with username and password
     * @param {string} username - Username or email
     * @param {string} password - Password
     * @param {boolean} rememberMe - Whether to persist login
     * @param {string} totpToken - Optional TOTP 2FA token
     * @returns {Promise<Object>} Login result
     */
    async login(username, password, rememberMe = false, totpToken = null) {
        console.log('AuthManager.login called with:', { username, totpToken: totpToken ? 'provided' : 'not provided' });
        
        try {
            if (!this.api) {
                throw new Error('Authentication service not initialized');
            }

            // Perform login request
            const loginResponse = await this.api.login(username, password, totpToken);
            
            if (!loginResponse.jwt) {
                throw new Error('Login failed: No token received');
            }

            // Store the JWT token
            setAuthToken(loginResponse.jwt);
            
            // Verify token was stored correctly
            const storedToken = getAuthToken();
            if (!storedToken) {
                throw new Error('Token storage failed');
            }

            // Create a new API instance to ensure it has the token
            const currentInstance = getCurrentInstance();
            this.api = new LemmyAPI(currentInstance);

            // Give the server a moment to process the login session
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get user information (single attempt to avoid rate limiting)
            const userInfo = await this.api.getCurrentUser();
            
            if (!userInfo?.my_user) {
                // Instead of retrying immediately, we'll let the normal auth checks handle it
                throw new Error('User data not yet available - try refreshing the page');
            }

            // Format and store user data (from /site endpoint structure)
            const person = userInfo.my_user.local_user_view.person;
            const localUser = userInfo.my_user.local_user_view.local_user;
            const counts = userInfo.my_user.local_user_view.counts;
            
            const userData = {
                id: person.id,
                name: person.name,
                displayName: person.display_name,
                email: localUser.email,
                avatar: person.avatar,
                banner: person.banner,
                bio: person.bio,
                admin: person.admin,
                banned: person.banned,
                published: person.published,
                updated: person.updated,
                show_nsfw: localUser.show_nsfw,
                show_scores: localUser.show_scores,
                show_avatars: localUser.show_avatars,
                send_notifications_to_email: localUser.send_notifications_to_email,
                counts: counts,
                rememberMe: rememberMe,
                loginTime: new Date().toISOString()
            };

            setUserData(userData);
            this.currentUser = userData;

            // Notify listeners
            this.notifyListeners('login', userData);

            return {
                success: true,
                user: userData,
                message: 'Login successful'
            };
        } catch (error) {
            console.error('Login error:', error);
            
            // Check if 2FA is required BEFORE cleaning up state
            if (error.responseData && error.responseData.error === 'missing_totp_token') {
                console.log('2FA required - detected from response data');
                return {
                    success: false,
                    requires2FA: true,
                    error: 'Two-factor authentication required'
                };
            }
            
            // Fallback check for 2FA requirement in error message
            if (error.message && error.message.includes('missing_totp_token')) {
                return {
                    success: false,
                    requires2FA: true,
                    error: 'Two-factor authentication required'
                };
            }
            
            // Clean up any partial login state only if not 2FA
            this.logout(false);
            
            // Provide more specific error messages
            let errorMessage = 'Login failed';
            if (error.message.includes('incorrect_login')) {
                errorMessage = 'Incorrect username or password. Make sure you have an account on this instance.';
            } else if (error.message.includes('Unauthorized')) {
                errorMessage = 'Invalid credentials. Please check your username and password.';
            } else if (error.message.includes('Network')) {
                errorMessage = 'Network error. Please check your internet connection.';
            } else if (error.message.includes('400')) {
                errorMessage = 'Invalid request format. Please try again.';
            } else if (error.message.includes('Failed to get user information')) {
                errorMessage = 'Login successful but failed to retrieve user profile. Please try refreshing the page.';
            } else {
                errorMessage = error.message || 'Login failed';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Logout current user
     * @param {boolean} notifyServer - Whether to notify server of logout
     */
    async logout(notifyServer = true) {
        try {
            // Notify server if requested and we have a valid token
            if (notifyServer && isAuthenticated() && this.api) {
                try {
                    await this.api.logout();
                } catch (error) {
                    console.warn('Server logout failed:', error);
                    // Continue with local logout even if server logout fails
                }
            }
        } catch (error) {
            console.warn('Logout warning:', error);
        } finally {
            // Always clean up local state
            const instance = getCurrentInstance();
            removeAuthToken(instance);
            removeUserData(instance);
            this.currentUser = null;
            
            // Notify listeners
            this.notifyListeners('logout');
        }
    }

    /**
     * Get current user data
     * @returns {Object|null} Current user data or null if not authenticated
     */
    getCurrentUser() {
        return this.currentUser;
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Check if user is currently authenticated
     * @returns {boolean} True if authenticated
     */
    isAuthenticated() {
        return isAuthenticated() && this.currentUser !== null;
    }

    /**
     * Get authentication status for UI updates
     * @returns {Object} Authentication status object
     */
    getAuthStatus() {
        return {
            isAuthenticated: this.isAuthenticated(),
            user: this.currentUser,
            instance: getCurrentInstance()
        };
    }

    /**
     * Switch instance and handle authentication
     * @param {string} instanceName - New instance name
     */
    switchInstance(instanceName) {
        // Update API instance
        this.api = new LemmyAPI(instanceName);
        
        // Load user data for new instance
        this.loadCurrentUser();
        
        // Notify listeners of instance switch
        this.notifyListeners('instanceSwitch', { 
            instance: instanceName,
            authStatus: this.getAuthStatus()
        });
    }

    /**
     * Refresh user data from server
     * @returns {Promise<boolean>} Success status
     */
    async refreshUserData() {
        if (!this.isAuthenticated()) {
            return false;
        }

        try {
            const userInfo = await this.api.getCurrentUser();
            
            if (userInfo.my_user) {
                const person = userInfo.my_user.local_user_view.person;
                const localUser = userInfo.my_user.local_user_view.local_user;
                const counts = userInfo.my_user.local_user_view.counts;
                
                const userData = {
                    ...this.currentUser,
                    displayName: person.display_name,
                    email: localUser.email,
                    avatar: person.avatar,
                    banner: person.banner,
                    bio: person.bio,
                    show_nsfw: localUser.show_nsfw,
                    show_scores: localUser.show_scores,
                    show_avatars: localUser.show_avatars,
                    send_notifications_to_email: localUser.send_notifications_to_email,
                    counts: counts
                };

                setUserData(userData);
                this.currentUser = userData;
                this.notifyListeners('userUpdate', userData);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Failed to refresh user data:', error);
            return false;
        }
    }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

// Create and export singleton instance
export const authManager = new AuthManager();

// Initialize on import
authManager.init();

// Export default for convenience
export default authManager; 