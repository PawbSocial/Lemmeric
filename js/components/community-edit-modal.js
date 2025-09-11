/**
 * Community Edit Modal Component for Lemmeric
 * Handles community editing functionality with image upload support
 */

import { LemmyAPI } from '../api.js';
import { CONFIG, isAuthenticated } from '../config.js';
import { DOM, ErrorUtils } from '../utils.js';
import { authManager } from '../auth.js';

export class CommunityEditModal {
    constructor() {
        this.api = new LemmyAPI();
        this.modal = null;
        this.community = null;
        this.iconFile = null;
        this.bannerFile = null;
        
        this.init();
    }

    /**
     * Initialize the modal
     */
    init() {
        this.modal = new bootstrap.Modal(document.getElementById('editCommunityModal'));
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Form submission
        const submitBtn = document.getElementById('edit-community-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => this.handleSubmit(e));
        }

        // File upload handling
        this.setupFileUploads();

        // Listen for edit community events
        window.addEventListener('editCommunity', (e) => this.handleEditCommunity(e));

        // Listen for authentication changes
        authManager.addListener((event, data) => {
            this.handleAuthChange(event, data);
        });
    }

    /**
     * Setup file upload functionality
     */
    setupFileUploads() {
        // Icon upload
        const iconUpload = document.getElementById('edit-community-icon-upload');
        const iconArea = document.getElementById('edit-icon-upload-area');
        const iconPreview = document.getElementById('edit-icon-preview');
        const iconPlaceholder = document.getElementById('edit-icon-placeholder');
        const iconPreviewImg = document.getElementById('edit-icon-preview-img');
        const removeIconBtn = document.getElementById('edit-remove-icon');

        // Banner upload
        const bannerUpload = document.getElementById('edit-community-banner-upload');
        const bannerArea = document.getElementById('edit-banner-upload-area');
        const bannerPreview = document.getElementById('edit-banner-preview');
        const bannerPlaceholder = document.getElementById('edit-banner-placeholder');
        const bannerPreviewImg = document.getElementById('edit-banner-preview-img');
        const removeBannerBtn = document.getElementById('edit-remove-banner');

        if (iconArea && iconUpload) {
            // Icon upload handlers
            iconArea.addEventListener('click', () => iconUpload.click());
            iconUpload.addEventListener('change', (e) => this.handleFileUpload(e, 'icon'));
            removeIconBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFile('icon');
            });

            // Drag and drop handlers
            this.setupDragAndDrop(iconArea, iconUpload, 'icon');
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
        const input = document.getElementById(`edit-community-${type}-upload`);
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
     * Handle edit community event
     */
    handleEditCommunity(event) {
        this.community = event.detail.community;
        this.populateForm();
        this.modal.show();
    }

    /**
     * Populate form with current community data
     */
    populateForm() {
        if (!this.community) return;

        // Set basic fields
        const titleInput = document.getElementById('edit-community-title');
        const descriptionInput = document.getElementById('edit-community-description');
        const nsfwInput = document.getElementById('edit-community-nsfw');
        const postingRestrictedInput = document.getElementById('edit-community-posting-restricted');
        const visibilityInput = document.getElementById('edit-community-visibility');

        if (titleInput) titleInput.value = this.community.title || '';
        if (descriptionInput) descriptionInput.value = this.community.description || '';
        if (nsfwInput) nsfwInput.checked = this.community.nsfw || false;
        if (postingRestrictedInput) postingRestrictedInput.checked = this.community.posting_restricted_to_mods || false;
        if (visibilityInput) visibilityInput.value = this.community.visibility || 'Public';

        // Set current images
        this.setCurrentImages();
    }

    /**
     * Set current community images
     */
    setCurrentImages() {
        // Icon
        if (this.community.icon) {
            const iconPreview = document.getElementById('edit-icon-preview');
            const iconPlaceholder = document.getElementById('edit-icon-placeholder');
            const iconPreviewImg = document.getElementById('edit-icon-preview-img');
            const removeIconBtn = document.getElementById('edit-remove-icon');

            if (iconPreviewImg) {
                iconPreviewImg.src = this.community.icon;
                iconPreview.classList.remove('d-none');
                iconPlaceholder.classList.add('d-none');
                if (removeIconBtn) removeIconBtn.style.display = 'block';
            }
        }

        // Banner
        if (this.community.banner) {
            const bannerPreview = document.getElementById('edit-banner-preview');
            const bannerPlaceholder = document.getElementById('edit-banner-placeholder');
            const bannerPreviewImg = document.getElementById('edit-banner-preview-img');
            const removeBannerBtn = document.getElementById('edit-remove-banner');

            if (bannerPreviewImg) {
                bannerPreviewImg.src = this.community.banner;
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
        
        if (!this.community) {
            this.showError('No community selected for editing.');
            return;
        }

        // Clear previous messages
        this.hideMessages();
        
        // Validate form
        if (!this.validateForm()) {
            return;
        }
        
        // Upload images first if any
        let iconUrl = this.community.icon;
        let bannerUrl = this.community.banner;
        let imageUploadWarning = false;
        
        if (this.iconFile) {
            try {
                const iconResponse = await this.api.uploadImage(this.iconFile, 'icon');
                iconUrl = iconResponse.url || iconResponse.files?.[0]?.file;
            } catch (error) {
                console.warn('Icon upload failed, keeping existing icon:', error);
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
        const formData = this.getFormData(iconUrl, bannerUrl);
        
        // Show loading state
        this.setLoading(true);
        
        try {
            const response = await this.api.editCommunity(formData);
            
            if (response && response.community_view) {
                let successMessage = 'Community updated successfully!';
                if (imageUploadWarning) {
                    successMessage += ' Note: Some images could not be uploaded.';
                }
                this.showSuccess(successMessage);
                
                // Dispatch event to notify parent components
                const event = new CustomEvent('communityUpdated', {
                    detail: {
                        community: response.community_view
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
            console.error('Community edit failed:', error);
            const errorMsg = this.formatEditError(error);
            this.showError(errorMsg);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Validate form
     */
    validateForm() {
        const titleInput = document.getElementById('edit-community-title');
        const title = titleInput.value.trim();
        
        if (title.length < 3) {
            this.showError('Community title must be at least 3 characters long.');
            return false;
        }
        
        if (title.length > 100) {
            this.showError('Community title must be 100 characters or less.');
            return false;
        }
        
        return true;
    }

    /**
     * Get form data
     */
    getFormData(iconUrl, bannerUrl) {
        const title = document.getElementById('edit-community-title').value.trim();
        const description = document.getElementById('edit-community-description').value.trim();
        const nsfw = document.getElementById('edit-community-nsfw').checked;
        const postingRestricted = document.getElementById('edit-community-posting-restricted').checked;
        const visibility = document.getElementById('edit-community-visibility').value;
        
        const formData = {
            community_id: this.community.id,
            title,
            nsfw,
            posting_restricted_to_mods: postingRestricted,
            visibility
        };
        
        // Only include optional fields if they have values
        if (description) formData.description = description;
        if (iconUrl) formData.icon = iconUrl;
        if (bannerUrl) formData.banner = bannerUrl;
        
        return formData;
    }

    /**
     * Format edit error
     */
    formatEditError(error) {
        const errorMessage = ErrorUtils.formatError(error);
        
        // Handle specific error messages
        if (errorMessage.includes('not_a_moderator')) {
            return 'You do not have permission to edit this community.';
        }
        if (errorMessage.includes('not_an_admin')) {
            return 'You do not have permission to edit communities on this instance.';
        }
        if (errorMessage.includes('rate_limit')) {
            return 'You are making changes too quickly. Please wait a moment and try again.';
        }
        
        return errorMessage || 'Failed to update community. Please try again.';
    }

    /**
     * Set loading state
     */
    setLoading(loading) {
        const submitBtn = document.getElementById('edit-community-submit-btn');
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
