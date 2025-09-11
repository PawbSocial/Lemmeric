/**
 * Create Community Page JavaScript
 * Handles community creation form submission and validation
 */

import { LemmyAPI } from './api.js';
import { CONFIG, getInstanceConfig, isAuthenticated, getAuthToken, getUserData } from './config.js';
import { ErrorUtils } from './utils.js';
import { authManager } from './auth.js';

class CreateCommunityPage {
    constructor() {
        this.api = new LemmyAPI();
        this.form = document.getElementById('create-community-form');
        this.submitBtn = document.getElementById('submit-btn');
        this.submitText = document.getElementById('submit-text');
        this.submitSpinner = document.getElementById('submit-spinner');
        this.formMessages = document.getElementById('form-messages');
        this.errorMessage = document.getElementById('error-message');
        this.successMessage = document.getElementById('success-message');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeTooltips();
        this.setupAuthListeners();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Real-time validation
        const nameInput = document.getElementById('community-name');
        const titleInput = document.getElementById('community-title');
        
        nameInput.addEventListener('input', () => {
            this.validateCommunityName();
            this.updateUrlPreview();
        });
        titleInput.addEventListener('input', () => this.validateCommunityTitle());
        
        // File upload handling
        this.setupFileUploads();
    }

    initializeTooltips() {
        // Initialize Bootstrap tooltips
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    setupAuthListeners() {
        // Listen for authentication state changes
        this.authListener = (event, data) => {
            if (event === 'login' || event === 'userLoaded') {
                // User logged in, recheck auth status
                this.checkAuthStatus();
            } else if (event === 'logout') {
                // User logged out, disable form
                this.showError('You have been logged out. Please log in again to create a community.');
                this.disableForm();
            }
        };
        
        authManager.addListener(this.authListener);
        
        // Clean up listener when page is unloaded
        window.addEventListener('beforeunload', () => {
            if (this.authListener) {
                authManager.removeListener(this.authListener);
            }
        });
    }

    async checkAuthStatus() {
        try {
            // Check if user is authenticated using the proper auth system
            if (!isAuthenticated()) {
                this.showError('You must be logged in to create a community.');
                this.disableForm();
                return;
            }

            // Get the current user data
            const currentUser = getUserData();
            if (!currentUser) {
                this.showError('User session not found. Please log in again.');
                this.disableForm();
                return;
            }

            // Verify token is still valid and get site data
            const response = await this.api.getSite();
            if (!response) {
                this.showError('Authentication failed. Please log in again.');
                this.disableForm();
                return;
            }

            // Check if user has permission to create communities
            const siteData = response.site_view || response;
            if (!siteData.site) {
                this.showError('Unable to verify site permissions.');
                this.disableForm();
                return;
            }

            // Load available languages
            await this.loadLanguages(response);

            // Update page header to show user info
            this.updatePageHeader(currentUser);

            console.log('User authenticated, can create community:', currentUser.displayName || currentUser.name);
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showError('Unable to verify authentication. Please try logging in again.');
            this.disableForm();
        }
    }

    async loadLanguages(siteData) {
        try {
            const languages = siteData.all_languages || [];
            const languageSelect = document.getElementById('community-languages');
            
            // Clear existing options except the first one
            languageSelect.innerHTML = '<option value="0" selected>Undetermined</option>';
            
            // Add available languages
            languages.forEach(lang => {
                const option = document.createElement('option');
                option.value = lang.id;
                option.textContent = lang.name;
                languageSelect.appendChild(option);
            });
            
            console.log('Loaded languages:', languages.length);
        } catch (error) {
            console.error('Failed to load languages:', error);
            // Don't show error to user as this is not critical
        }
    }

    validateCommunityName() {
        const nameInput = document.getElementById('community-name');
        const value = nameInput.value.trim();
        const pattern = /^[a-z0-9_]+$/;
        
        // Reserved words that cannot be used as community names
        const reservedWords = [
            'admin', 'moderator', 'mod', 'api', 'www', 'mail', 'ftp', 'root', 'support',
            'help', 'about', 'contact', 'privacy', 'terms', 'legal', 'settings', 'config',
            'create', 'edit', 'delete', 'remove', 'ban', 'unban', 'report', 'flag',
            'login', 'logout', 'register', 'signup', 'signin', 'auth', 'session',
            'post', 'comment', 'vote', 'like', 'dislike', 'subscribe', 'unsubscribe',
            'community', 'communities', 'user', 'users', 'profile', 'profiles',
            'search', 'explore', 'discover', 'trending', 'popular', 'new', 'hot',
            'all', 'local', 'subscribed', 'saved', 'bookmarked', 'favorites'
        ];
        
        if (value.length < 3) {
            this.setFieldError(nameInput, 'Community name must be at least 3 characters long.');
            return false;
        }
        
        if (value.length > 20) {
            this.setFieldError(nameInput, 'Community name must be 20 characters or less.');
            return false;
        }
        
        if (!pattern.test(value)) {
            this.setFieldError(nameInput, 'Community name can only contain lowercase letters, numbers, and underscores.');
            return false;
        }
        
        if (reservedWords.includes(value.toLowerCase())) {
            this.setFieldError(nameInput, 'This name is reserved and cannot be used for a community.');
            return false;
        }
        
        // Check for consecutive underscores
        if (value.includes('__')) {
            this.setFieldError(nameInput, 'Community name cannot contain consecutive underscores.');
            return false;
        }
        
        // Check if it starts or ends with underscore
        if (value.startsWith('_') || value.endsWith('_')) {
            this.setFieldError(nameInput, 'Community name cannot start or end with an underscore.');
            return false;
        }
        
        this.clearFieldError(nameInput);
        return true;
    }

    validateCommunityTitle() {
        const titleInput = document.getElementById('community-title');
        const value = titleInput.value.trim();
        
        if (value.length < 3) {
            this.setFieldError(titleInput, 'Display title must be at least 3 characters long.');
            return false;
        }
        
        if (value.length > 100) {
            this.setFieldError(titleInput, 'Display title must be 100 characters or less.');
            return false;
        }
        
        this.clearFieldError(titleInput);
        return true;
    }


    setFieldError(input, message) {
        input.classList.add('is-invalid');
        let feedback = input.parentNode.querySelector('.invalid-feedback');
        if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            input.parentNode.appendChild(feedback);
        }
        feedback.textContent = message;
    }

    clearFieldError(input) {
        input.classList.remove('is-invalid');
        const feedback = input.parentNode.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.remove();
        }
    }

    updateUrlPreview() {
        const nameInput = document.getElementById('community-name');
        const previewElement = document.getElementById('community-url-preview');
        const value = nameInput.value.trim();
        
        if (value.length >= 3) {
            const instanceConfig = getInstanceConfig();
            const baseUrl = instanceConfig.url.replace(/\/$/, ''); // Remove trailing slash
            previewElement.textContent = `${baseUrl}/c/${value}`;
            previewElement.className = 'text-success';
        } else {
            previewElement.textContent = 'Community URL will appear here as you type';
            previewElement.className = 'text-muted';
        }
    }

    updatePageHeader(user) {
        // Update the subtitle to show user info
        const subtitle = document.querySelector('#main-content .text-muted');
        if (subtitle) {
            subtitle.textContent = `Create a new community as ${user.displayName || user.name}`;
        }
    }

    setupFileUploads() {
        // Icon upload
        const iconUpload = document.getElementById('community-icon-upload');
        const iconArea = document.getElementById('icon-upload-area');
        const iconPreview = document.getElementById('icon-preview');
        const iconPlaceholder = document.getElementById('icon-placeholder');
        const iconPreviewImg = document.getElementById('icon-preview-img');
        const removeIconBtn = document.getElementById('remove-icon');

        // Banner upload
        const bannerUpload = document.getElementById('community-banner-upload');
        const bannerArea = document.getElementById('banner-upload-area');
        const bannerPreview = document.getElementById('banner-preview');
        const bannerPlaceholder = document.getElementById('banner-placeholder');
        const bannerPreviewImg = document.getElementById('banner-preview-img');
        const removeBannerBtn = document.getElementById('remove-banner');

        // Icon upload handlers
        iconArea.addEventListener('click', () => iconUpload.click());
        iconUpload.addEventListener('change', (e) => this.handleFileUpload(e, 'icon'));
        removeIconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFile('icon');
        });

        // Banner upload handlers
        bannerArea.addEventListener('click', () => bannerUpload.click());
        bannerUpload.addEventListener('change', (e) => this.handleFileUpload(e, 'banner'));
        removeBannerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFile('banner');
        });

        // Drag and drop handlers
        this.setupDragAndDrop(iconArea, iconUpload, 'icon');
        this.setupDragAndDrop(bannerArea, bannerUpload, 'banner');
    }

    setupDragAndDrop(area, input, type) {
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });

        area.addEventListener('dragleave', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                input.files = files;
                this.handleFileUpload({ target: input }, type);
            }
        });
    }

    handleFileUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showError('Image file is too large. Please select a file smaller than 10MB.');
            return;
        }

        // Show preview
        this.showImagePreview(file, type);

        // Store file for later upload
        this[`${type}File`] = file;
    }

    showImagePreview(file, type) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById(`${type}-preview`);
            const placeholder = document.getElementById(`${type}-placeholder`);
            const previewImg = document.getElementById(`${type}-preview-img`);

            previewImg.src = e.target.result;
            preview.classList.remove('d-none');
            placeholder.classList.add('d-none');
        };
        reader.readAsDataURL(file);
    }

    removeFile(type) {
        const preview = document.getElementById(`${type}-preview`);
        const placeholder = document.getElementById(`${type}-placeholder`);
        const input = document.getElementById(`community-${type}-upload`);

        preview.classList.add('d-none');
        placeholder.classList.remove('d-none');
        input.value = '';
        this[`${type}File`] = null;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        // Clear previous messages
        this.hideMessages();
        
        // Validate all fields
        const isNameValid = this.validateCommunityName();
        const isTitleValid = this.validateCommunityTitle();
        
        if (!isNameValid || !isTitleValid) {
            this.showError('Please fix the validation errors above.');
            return;
        }
        
        // Upload images first if any (optional - don't fail if upload doesn't work)
        let iconUrl = null;
        let bannerUrl = null;
        let imageUploadWarning = false;
        
        if (this.iconFile) {
            try {
                const iconResponse = await this.api.uploadImage(this.iconFile, 'icon');
                iconUrl = iconResponse.url || iconResponse.files?.[0]?.file;
                console.log('Icon uploaded successfully:', iconUrl);
            } catch (error) {
                console.warn('Icon upload failed, continuing without icon:', error);
                imageUploadWarning = true;
                // Don't fail the entire process, just skip the icon
            }
        }
        
        if (this.bannerFile) {
            try {
                const bannerResponse = await this.api.uploadImage(this.bannerFile, 'banner');
                bannerUrl = bannerResponse.url || bannerResponse.files?.[0]?.file;
                console.log('Banner uploaded successfully:', bannerUrl);
            } catch (error) {
                console.warn('Banner upload failed, continuing without banner:', error);
                imageUploadWarning = true;
                // Don't fail the entire process, just skip the banner
            }
        }
        
        // Prepare form data
        const formData = this.getFormData();
        
        // Add uploaded image URLs or fallback to URL inputs
        if (iconUrl) {
            formData.icon = iconUrl;
        } else {
            const iconUrlInput = document.getElementById('community-icon-url');
            if (iconUrlInput && iconUrlInput.value.trim()) {
                formData.icon = iconUrlInput.value.trim();
            }
        }
        
        if (bannerUrl) {
            formData.banner = bannerUrl;
        } else {
            const bannerUrlInput = document.getElementById('community-banner-url');
            if (bannerUrlInput && bannerUrlInput.value.trim()) {
                formData.banner = bannerUrlInput.value.trim();
            }
        }
        
        // Show loading state
        this.setLoading(true);
        
        try {
            console.log('Creating community with data:', formData);
            const response = await this.api.createCommunity(formData);
            
            if (response && response.community_view) {
                let successMessage = 'Community created successfully! Redirecting...';
                if (imageUploadWarning) {
                    successMessage += ' Note: Some images could not be uploaded. You can add them later by editing the community.';
                }
                this.showSuccess(successMessage);
                
                // Redirect to the new community after a short delay
                setTimeout(() => {
                    const communityName = response.community_view.community.name;
                    window.location.href = `/c/${encodeURIComponent(communityName)}`;
                }, 2000);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Community creation failed:', error);
            const errorMsg = this.formatCreateError(error);
            this.showError(errorMsg);
        } finally {
            this.setLoading(false);
        }
    }

    getFormData() {
        const name = document.getElementById('community-name').value.trim();
        const title = document.getElementById('community-title').value.trim();
        const description = document.getElementById('community-description').value.trim();
        const nsfw = document.getElementById('community-nsfw').checked;
        const visibility = document.getElementById('community-visibility').value;
        const postingRestricted = document.getElementById('community-posting-restricted').checked;
        
        // Get selected languages
        const languageSelect = document.getElementById('community-languages');
        const selectedLanguages = Array.from(languageSelect.selectedOptions)
            .map(option => parseInt(option.value))
            .filter(id => id !== 0); // Remove "Undetermined" option
        
        const formData = {
            name,
            title,
            nsfw,
            posting_restricted_to_mods: postingRestricted,
            visibility
        };
        
        // Only include optional fields if they have values
        if (description) formData.description = description;
        if (selectedLanguages.length > 0) formData.discussion_languages = selectedLanguages;
        
        return formData;
    }

    formatCreateError(error) {
        const errorMessage = ErrorUtils.formatError(error);
        
        // Handle specific error messages
        if (errorMessage.includes('community_already_exists')) {
            return 'A community with this name already exists. Please choose a different name.';
        }
        if (errorMessage.includes('invalid_name')) {
            return 'Community name is invalid. Please use only lowercase letters, numbers, and underscores.';
        }
        if (errorMessage.includes('not_an_admin')) {
            return 'You do not have permission to create communities on this instance.';
        }
        if (errorMessage.includes('rate_limit')) {
            return 'You are creating communities too quickly. Please wait a moment and try again.';
        }
        
        return errorMessage || 'Failed to create community. Please try again.';
    }

    setLoading(loading) {
        this.submitBtn.disabled = loading;
        this.submitText.style.display = loading ? 'none' : 'inline';
        this.submitSpinner.style.display = loading ? 'inline-block' : 'none';
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        this.successMessage.style.display = 'none';
        this.formMessages.style.display = 'block';
        
        // Scroll to error message
        this.formMessages.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    showSuccess(message) {
        this.successMessage.textContent = message;
        this.successMessage.style.display = 'block';
        this.errorMessage.style.display = 'none';
        this.formMessages.style.display = 'block';
    }

    hideMessages() {
        this.formMessages.style.display = 'none';
        this.errorMessage.style.display = 'none';
        this.successMessage.style.display = 'none';
    }

    disableForm() {
        this.form.querySelectorAll('input, textarea, select, button').forEach(element => {
            element.disabled = true;
        });
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CreateCommunityPage();
});
