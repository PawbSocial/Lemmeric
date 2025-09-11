/**
 * User Edit Modal Component for Lemmeric
 * Handles user profile editing functionality with image upload support
 */

import { LemmyAPI } from '../api.js';
import { CONFIG, isAuthenticated } from '../config.js';
import { DOM, ErrorUtils } from '../utils.js';
import { authManager } from '../auth.js';

export class UserEditModal {
    constructor() {
        this.api = new LemmyAPI();
        this.modal = null;
        this.user = null;
        this.avatarFile = null;
        this.bannerFile = null;
        
        this.init();
    }

    /**
     * Initialize the modal
     */
    init() {
        this.modal = new bootstrap.Modal(document.getElementById('editUserModal'));
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Form submission
        const submitBtn = document.getElementById('edit-user-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => this.handleSubmit(e));
        }

        // File upload handling
        this.setupFileUploads();

        // Listen for edit user events
        window.addEventListener('editUser', (e) => this.handleEditUser(e));

        // Listen for authentication changes
        authManager.addListener((event, data) => {
            this.handleAuthChange(event, data);
        });
    }

    /**
     * Setup file upload functionality
     */
    setupFileUploads() {
        // Avatar upload
        const avatarUpload = document.getElementById('edit-user-avatar-upload');
        const avatarArea = document.getElementById('edit-avatar-upload-area');
        const avatarPreview = document.getElementById('edit-avatar-preview');
        const avatarPlaceholder = document.getElementById('edit-avatar-placeholder');
        const avatarPreviewImg = document.getElementById('edit-avatar-preview-img');
        const removeAvatarBtn = document.getElementById('edit-remove-avatar');

        // Banner upload
        const bannerUpload = document.getElementById('edit-user-banner-upload');
        const bannerArea = document.getElementById('edit-banner-upload-area');
        const bannerPreview = document.getElementById('edit-banner-preview');
        const bannerPlaceholder = document.getElementById('edit-banner-placeholder');
        const bannerPreviewImg = document.getElementById('edit-banner-preview-img');
        const removeBannerBtn = document.getElementById('edit-remove-banner');

        if (avatarArea && avatarUpload) {
            // Avatar upload handlers
            avatarArea.addEventListener('click', () => avatarUpload.click());
            avatarUpload.addEventListener('change', (e) => this.handleFileUpload(e, 'avatar'));
            removeAvatarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFile('avatar');
            });

            // Drag and drop handlers
            this.setupDragAndDrop(avatarArea, avatarUpload, 'avatar');
        }

        if (bannerArea && bannerUpload) {
            // Banner upload handlers
            bannerArea.addEventListener('click', () => bannerUpload.click());
            bannerUpload.addEventListener('change', (e) => this.handleFileUpload(e, 'banner'));
            removeBannerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFile('banner');
            });

            // Drag and drop handlers
            this.setupDragAndDrop(bannerArea, bannerUpload, 'banner');
        }
    }

    /**
     * Setup drag and drop functionality
     */
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

    /**
     * Handle file upload
     */
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

    /**
     * Show image preview
     */
    showImagePreview(file, type) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById(`edit-${type}-preview`);
            const placeholder = document.getElementById(`edit-${type}-placeholder`);
            const previewImg = document.getElementById(`edit-${type}-preview-img`);
            const removeBtn = document.getElementById(`edit-remove-${type}`);

            if (previewImg) {
                previewImg.src = e.target.result;
                preview.classList.remove('d-none');
                placeholder.classList.add('d-none');
                if (removeBtn) removeBtn.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }

    /**
     * Remove file
     */
    removeFile(type) {
        const preview = document.getElementById(`edit-${type}-preview`);
        const placeholder = document.getElementById(`edit-${type}-placeholder`);
        const input = document.getElementById(`edit-user-${type}-upload`);
        const removeBtn = document.getElementById(`edit-remove-${type}`);

        if (preview && placeholder) {
            preview.classList.add('d-none');
            placeholder.classList.remove('d-none');
        }
        if (input) {
            input.value = '';
        }
        if (removeBtn) {
            removeBtn.style.display = 'none';
        }
        this[`${type}File`] = null;
    }

    /**
     * Handle edit user event
     */
    handleEditUser(event) {
        this.user = event.detail.user;
        this.populateForm();
        this.modal.show();
    }

    /**
     * Populate form with current user data
     */
    populateForm() {
        if (!this.user) return;

        // Set basic fields
        const displayNameInput = document.getElementById('edit-user-display-name');
        const bioInput = document.getElementById('edit-user-bio');
        const emailInput = document.getElementById('edit-user-email');
        const matrixUserIdInput = document.getElementById('edit-user-matrix-user-id');
        const showNsfwInput = document.getElementById('edit-user-show-nsfw');
        const botAccountInput = document.getElementById('edit-user-bot-account');

        if (displayNameInput) displayNameInput.value = this.user.displayName || '';
        if (bioInput) bioInput.value = this.user.bio || '';
        if (emailInput) emailInput.value = this.user.email || '';
        if (matrixUserIdInput) matrixUserIdInput.value = this.user.matrixUserId || '';
        if (showNsfwInput) showNsfwInput.checked = this.user.showNsfw || false;
        if (botAccountInput) botAccountInput.checked = this.user.botAccount || false;

        // Set current images
        this.setCurrentImages();
    }

    /**
     * Set current user images
     */
    setCurrentImages() {
        // Avatar
        if (this.user.avatar) {
            const avatarPreview = document.getElementById('edit-avatar-preview');
            const avatarPlaceholder = document.getElementById('edit-avatar-placeholder');
            const avatarPreviewImg = document.getElementById('edit-avatar-preview-img');
            const removeAvatarBtn = document.getElementById('edit-remove-avatar');

            if (avatarPreviewImg) {
                avatarPreviewImg.src = this.user.avatar;
                avatarPreview.classList.remove('d-none');
                avatarPlaceholder.classList.add('d-none');
                if (removeAvatarBtn) removeAvatarBtn.style.display = 'block';
            }
        }

        // Banner
        if (this.user.banner) {
            const bannerPreview = document.getElementById('edit-banner-preview');
            const bannerPlaceholder = document.getElementById('edit-banner-placeholder');
            const bannerPreviewImg = document.getElementById('edit-banner-preview-img');
            const removeBannerBtn = document.getElementById('edit-remove-banner');

            if (bannerPreviewImg) {
                bannerPreviewImg.src = this.user.banner;
                bannerPreview.classList.remove('d-none');
                bannerPlaceholder.classList.add('d-none');
                if (removeBannerBtn) removeBannerBtn.style.display = 'block';
            }
        }
    }

    /**
     * Handle form submission
     */
    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.user) {
            this.showError('No user selected for editing.');
            return;
        }

        // Clear previous messages
        this.hideMessages();
        
        // Validate form
        if (!this.validateForm()) {
            return;
        }
        
        // Upload images first if any
        let avatarUrl = this.user.avatar;
        let bannerUrl = this.user.banner;
        let imageUploadWarning = false;
        
        if (this.avatarFile) {
            try {
                const avatarResponse = await this.api.uploadImage(this.avatarFile, 'avatar');
                avatarUrl = avatarResponse.url || avatarResponse.files?.[0]?.file;
            } catch (error) {
                console.warn('Avatar upload failed, keeping existing avatar:', error);
                imageUploadWarning = true;
            }
        }
        
        if (this.bannerFile) {
            try {
                const bannerResponse = await this.api.uploadImage(this.bannerFile, 'banner');
                bannerUrl = bannerResponse.url || bannerResponse.files?.[0]?.file;
            } catch (error) {
                console.warn('Banner upload failed, keeping existing banner:', error);
                imageUploadWarning = true;
            }
        }
        
        // Prepare form data
        const formData = this.getFormData(avatarUrl, bannerUrl);
        
        // Show loading state
        this.setLoading(true);
        
        try {
            const response = await this.api.saveUserSettings(formData);
            
            if (response) {
                let successMessage = 'Profile updated successfully!';
                if (imageUploadWarning) {
                    successMessage += ' Note: Some images could not be uploaded.';
                }
                this.showSuccess(successMessage);
                
                // Dispatch event to notify parent components
                const event = new CustomEvent('userUpdated', {
                    detail: {
                        user: response
                    }
                });
                window.dispatchEvent(event);
                
                // Close modal after a short delay
                setTimeout(() => {
                    this.modal.hide();
                }, 1500);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('User settings save failed:', error);
            const errorMsg = this.formatSaveError(error);
            this.showError(errorMsg);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Validate form
     */
    validateForm() {
        const displayNameInput = document.getElementById('edit-user-display-name');
        const displayName = displayNameInput.value.trim();
        
        if (displayName && displayName.length < 3) {
            this.showError('Display name must be at least 3 characters long.');
            return false;
        }
        
        if (displayName && displayName.length > 20) {
            this.showError('Display name must be 20 characters or less.');
            return false;
        }
        
        return true;
    }

    /**
     * Get form data
     */
    getFormData(avatarUrl, bannerUrl) {
        const displayName = document.getElementById('edit-user-display-name').value.trim();
        const bio = document.getElementById('edit-user-bio').value.trim();
        const email = document.getElementById('edit-user-email').value.trim();
        const matrixUserId = document.getElementById('edit-user-matrix-user-id').value.trim();
        const showNsfw = document.getElementById('edit-user-show-nsfw').checked;
        const botAccount = document.getElementById('edit-user-bot-account').checked;
        
        const formData = {};
        
        // Only include fields that have values or are different from current values
        if (displayName && displayName !== this.user.displayName) formData.display_name = displayName;
        if (bio !== (this.user.bio || '')) formData.bio = bio;
        if (email && email !== (this.user.email || '')) formData.email = email;
        if (matrixUserId && matrixUserId !== (this.user.matrixUserId || '')) formData.matrix_user_id = matrixUserId;
        if (showNsfw !== (this.user.showNsfw || false)) formData.show_nsfw = showNsfw;
        if (botAccount !== (this.user.botAccount || false)) formData.bot_account = botAccount;
        if (avatarUrl && avatarUrl !== this.user.avatar) formData.avatar = avatarUrl;
        if (bannerUrl && bannerUrl !== this.user.banner) formData.banner = bannerUrl;
        
        return formData;
    }

    /**
     * Format save error
     */
    formatSaveError(error) {
        const errorMessage = ErrorUtils.formatError(error);
        
        // Handle specific error messages
        if (errorMessage.includes('not_an_admin')) {
            return 'You do not have permission to edit user settings.';
        }
        if (errorMessage.includes('rate_limit')) {
            return 'You are making changes too quickly. Please wait a moment and try again.';
        }
        
        return errorMessage || 'Failed to update profile. Please try again.';
    }

    /**
     * Set loading state
     */
    setLoading(loading) {
        const submitBtn = document.getElementById('edit-user-submit-btn');
        const submitText = document.getElementById('edit-submit-text');
        const submitSpinner = document.getElementById('edit-submit-spinner');
        
        if (submitBtn) submitBtn.disabled = loading;
        if (submitText) submitText.style.display = loading ? 'none' : 'inline';
        if (submitSpinner) submitSpinner.style.display = loading ? 'inline-block' : 'none';
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorMessage = document.getElementById('edit-error-message');
        const successMessage = document.getElementById('edit-success-message');
        const formMessages = document.getElementById('edit-form-messages');
        
        if (errorMessage) errorMessage.textContent = message;
        if (errorMessage) errorMessage.style.display = 'block';
        if (successMessage) successMessage.style.display = 'none';
        if (formMessages) formMessages.style.display = 'block';
        
        // Scroll to error message
        if (formMessages) {
            formMessages.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const errorMessage = document.getElementById('edit-error-message');
        const successMessage = document.getElementById('edit-success-message');
        const formMessages = document.getElementById('edit-form-messages');
        
        if (successMessage) successMessage.textContent = message;
        if (successMessage) successMessage.style.display = 'block';
        if (errorMessage) errorMessage.style.display = 'none';
        if (formMessages) formMessages.style.display = 'block';
    }

    /**
     * Hide messages
     */
    hideMessages() {
        const formMessages = document.getElementById('edit-form-messages');
        const errorMessage = document.getElementById('edit-error-message');
        const successMessage = document.getElementById('edit-success-message');
        
        if (formMessages) formMessages.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'none';
        if (successMessage) successMessage.style.display = 'none';
    }

    /**
     * Handle authentication changes
     */
    handleAuthChange(event, data) {
        if (event === 'logout') {
            this.modal.hide();
        }
    }
}
