/**
 * Create Post Page JavaScript Module
 * Handles post creation form functionality, validation, and API integration
 */

import { CONFIG, getCurrentInstance } from './config.js';
import { LemmyAPI } from './api.js';
import { DOM } from './utils.js';
import { processPostContent } from './markdown-it-setup.js';
import { authManager } from './auth.js';
import { SearchableSelect } from './components/searchable-select.js';

// Add UIUtils for toast notifications if DOM doesn't have showToast
const UIUtils = {
    showToast: (message, type = 'info') => {
        if (DOM?.showToast) {
            DOM.showToast(message, type);
        } else {
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }
};

class CreatePostManager {
    constructor() {
        this.api = new LemmyAPI(getCurrentInstance());
        this.form = null;
        this.communities = [];
        this.languages = [];
        this.selectedCommunity = null;
        this.selectedCommunityId = null;
        this.selectedCommunityName = null;
        this.isDraftSaved = false;
        this.communitySelect = null;
        this.previewUpdateTimeout = null;
        
        this.init();
    }

    async init() {
        try {
            // Set up form and load data first (communities/languages are public)
            this.setupForm();
            this.setupEventListeners();
            await this.loadInitialData();
            this.handleURLParams();
            
            // Wait for auth to be ready
            await authManager.init();
            
            // Check if user is logged in
            if (!authManager.isAuthenticated()) {
                this.showLoginRequired();
                return;
            }
            
        } catch (error) {
            console.error('Failed to initialize create post page:', error);
            UIUtils.showToast('Failed to initialize page', 'error');
        }
    }

    showLoginRequired() {
        const container = document.querySelector('#main-content .container');
        if (container) {
            container.innerHTML = `
                <div class="row justify-content-center">
                    <div class="col-md-6 text-center">
                        <div class="card">
                            <div class="card-body p-5">
                                <i class="bi bi-person-lock display-1 text-muted mb-3"></i>
                                <h3>Login Required</h3>
                                <p class="text-muted mb-4">You need to be logged in to create posts.</p>
                                <a href="/" class="btn btn-primary">
                                    <i class="bi bi-house-door me-1"></i>Go to Home
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    setupForm() {
        this.form = document.getElementById('create-post-form');
        
        // Character counters
        this.setupCharacterCounters();
        
        // Image preview
        this.setupImagePreview();
        
        // Live preview
        this.setupLivePreview();
    }

    setupCharacterCounters() {
        const titleField = document.getElementById('post-title');
        const bodyField = document.getElementById('post-body');
        const titleCounter = document.getElementById('title-count');
        const bodyCounter = document.getElementById('body-count');

        titleField.addEventListener('input', () => {
            titleCounter.textContent = titleField.value.length;
        });

        bodyField.addEventListener('input', () => {
            bodyCounter.textContent = bodyField.value.length;
        });
    }

    setupImagePreview() {
        const imageInput = document.getElementById('post-image');
        const uploadArea = document.getElementById('post-image-upload-area');
        const preview = document.getElementById('image-preview');
        const placeholder = document.getElementById('image-placeholder');
        const previewImg = document.getElementById('preview-img');
        const removeBtn = document.getElementById('remove-image');

        // Click to upload
        uploadArea.addEventListener('click', () => {
            imageInput.click();
        });

        // File input change
        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileUpload(file, preview, placeholder, previewImg);
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    this.handleFileUpload(file, preview, placeholder, previewImg);
                } else {
                    UIUtils.showToast('Please select an image file', 'warning');
                }
            }
        });

        // Remove image
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFile(imageInput, preview, placeholder, previewImg);
        });
    }

    handleFileUpload(file, preview, placeholder, previewImg) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            UIUtils.showToast('Please select a valid image file', 'warning');
            return;
        }

        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            UIUtils.showToast('Image file is too large. Please select a file smaller than 10MB', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            preview.classList.remove('d-none');
            placeholder.classList.add('d-none');
        };
        reader.readAsDataURL(file);
    }

    removeFile(imageInput, preview, placeholder, previewImg) {
        imageInput.value = '';
        preview.classList.add('d-none');
        placeholder.classList.remove('d-none');
        previewImg.src = '';
    }

    setupLivePreview() {
        const bodyField = document.getElementById('post-body');
        
        if (bodyField) {
            // Debounced preview update for better performance
            bodyField.addEventListener('input', () => {
                clearTimeout(this.previewUpdateTimeout);
                this.previewUpdateTimeout = setTimeout(() => {
                    this.updateLivePreview();
                }, 300); // 300ms delay for better performance
            });
        }
        
        // Initial preview update
        this.updateLivePreview();
    }

    updateLivePreview() {
        const body = document.getElementById('post-body')?.value || '';
        
        // Update desktop preview
        const desktopPreview = document.getElementById('live-preview-desktop');
        if (desktopPreview) {
            desktopPreview.innerHTML = this.generatePreviewContent(body);
        }
        
        // Update mobile preview
        const mobilePreview = document.getElementById('live-preview-mobile');
        if (mobilePreview) {
            mobilePreview.innerHTML = this.generatePreviewContent(body);
        }
    }

    generatePreviewContent(body) {
        let previewContent = '';
        
        // Body preview only
        if (body.trim()) {
            const processedBody = processPostContent(body);
            previewContent += `<div class="post-body-preview">${processedBody}</div>`;
        } else {
            previewContent += '<p class="text-muted"><em>No body content</em></p>';
        }
        
        return previewContent;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }
        
        // Save draft button
        const saveDraftBtn = document.getElementById('save-draft');
        if (saveDraftBtn) {
            saveDraftBtn.addEventListener('click', () => {
                this.saveDraft();
            });
        }
        
        // Auto-save draft periodically
        setInterval(() => {
            if (this.hasUnsavedChanges()) {
                this.autoSaveDraft();
            }
        }, 30000); // Auto-save every 30 seconds
    }

    async loadInitialData() {
        try {
            // Load in parallel
            await Promise.all([
                this.loadCommunities(),
                this.loadLanguages()
            ]);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            UIUtils.showToast('Failed to load page data', 'error');
        }
    }

    async loadCommunities() {
        try {
            // Load initial communities
            const response = await this.api.getCommunities({
                type_: 'All',
                sort: 'Active',
                limit: 50
            });
            
            this.communities = response.communities || [];
            
            // Convert communities to SearchableSelect format and sort local first
            const communityOptions = this.addGroupHeaders(this.communities
                .map(community => ({
                    value: community.community.id.toString(),
                    label: this.formatCommunityName(community),
                    subtitle: this.formatCommunitySubtitle(community),
                    data: community,
                    isLocal: community.community.local
                }))
                .sort((a, b) => {
                    // Local communities first, then by subscriber count
                    if (a.isLocal && !b.isLocal) return -1;
                    if (!a.isLocal && b.isLocal) return 1;
                    // Within same type (local/remote), sort by subscriber count
                    return b.data.counts.subscribers - a.data.counts.subscribers;
                }));
            
            // Initialize SearchableSelect
            this.communitySelect = new SearchableSelect('community-select-container', {
                placeholder: 'Select a community...',
                searchPlaceholder: 'Search communities...',
                initialOptions: communityOptions,
                onSelect: (option) => this.handleCommunitySelect(option),
                onSearch: (searchText) => this.searchCommunities(searchText)
            });

        } catch (error) {
            console.error('Failed to load communities:', error);
            UIUtils.showToast('Failed to load communities', 'error');
        }
    }

    async loadLanguages() {
        try {
            // Get site data to fetch available languages
            const siteData = await this.api.getSite();
            this.languages = siteData.all_languages || [];
            
            const select = document.getElementById('post-language');
            if (!select) {
                console.error('Language select element not found');
                return;
            }
            select.innerHTML = '<option value="">Select language (optional)...</option>';
            
            // Add common languages first
            const commonLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];
            const addedLanguages = new Set();
            
            commonLanguages.forEach(code => {
                const lang = this.languages.find(l => l.code === code);
                if (lang) {
                    const option = document.createElement('option');
                    option.value = lang.id;
                    option.textContent = lang.name;
                    select.appendChild(option);
                    addedLanguages.add(lang.id);
                }
            });
            
            // Add separator
            if (this.languages.length > commonLanguages.length) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '─────────────────';
                select.appendChild(separator);
            }
            
            // Add remaining languages
            this.languages
                .filter(lang => !addedLanguages.has(lang.id))
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(lang => {
                    const option = document.createElement('option');
                    option.value = lang.id;
                    option.textContent = lang.name;
                    select.appendChild(option);
                });

        } catch (error) {
            console.error('Failed to load languages:', error);
            const select = document.getElementById('post-language');
            select.innerHTML = '<option value="">Failed to load languages</option>';
        }
    }

    handleURLParams() {
        const params = new URLSearchParams(window.location.search);
        const communityId = params.get('community_id');
        const communityName = params.get('community_name');
        
        if (communityId && communityName) {
            // We have both ID and name - use them directly
            this.selectedCommunityId = parseInt(communityId);
            this.selectedCommunityName = communityName;
            
            // Use the same working pattern as before
            const waitForSearchableSelect = () => {
                if (this.communitySelect) {
                    setTimeout(() => {
                        this.populateSearchWithCommunity(communityName);
                    }, 200);
                } else {
                    setTimeout(waitForSearchableSelect, 100);
                }
            };
            waitForSearchableSelect();
        } else {
            // Fallback to old single community parameter for backwards compatibility
            const communityParam = params.get('community');
            if (communityParam) {
                const waitForSearchableSelect = () => {
                    if (this.communitySelect) {
                        setTimeout(() => {
                            this.populateSearchWithCommunity(communityParam);
                        }, 200);
                    } else {
                        setTimeout(waitForSearchableSelect, 100);
                    }
                };
                waitForSearchableSelect();
            }
        }
    }

    async searchCommunities(searchText) {
        if (!searchText || searchText.length < 2) {
            // Return initial communities for empty search, sorted with local first
            return this.addGroupHeaders(this.communities
                .map(community => ({
                    value: community.community.id.toString(),
                    label: this.formatCommunityName(community),
                    subtitle: this.formatCommunitySubtitle(community),
                    data: community,
                    isLocal: community.community.local
                }))
                .sort((a, b) => {
                    // Local communities first, then by subscriber count
                    if (a.isLocal && !b.isLocal) return -1;
                    if (!a.isLocal && b.isLocal) return 1;
                    return b.data.counts.subscribers - a.data.counts.subscribers;
                }));
        }

        try {
            // Search for communities using the search API
            const response = await this.api.search({
                q: searchText,
                type_: 'Communities',
                sort: 'TopAll',
                listing_type: 'All',
                limit: 20
            });

            const searchResults = response.communities || [];
            
            // Convert search results to SearchableSelect format and sort local first
            return this.addGroupHeaders(searchResults
                .map(community => ({
                    value: community.community.id.toString(),
                    label: this.formatCommunityName(community),
                    subtitle: this.formatCommunitySubtitle(community),
                    data: community,
                    isLocal: community.community.local
                }))
                .sort((a, b) => {
                    // Local communities first, then by relevance/subscriber count
                    if (a.isLocal && !b.isLocal) return -1;
                    if (!a.isLocal && b.isLocal) return 1;
                    return b.data.counts.subscribers - a.data.counts.subscribers;
                }));
        } catch (error) {
            console.error('Community search failed:', error);
            return [];
        }
    }

    formatCommunityName(community) {
        const communityData = community.community;
        
        // Check if community is local to current instance
        if (communityData.local) {
            // For local communities, use just the community name (not title)
            return communityData.name;
        } else {
            // For remote communities, use name@instance format
            try {
                const actorUrl = new URL(communityData.actor_id);
                const instance = actorUrl.hostname;
                return `${communityData.name}@${instance}`;
            } catch (error) {
                // Fallback if actor_id parsing fails
                return `${communityData.name} (remote)`;
            }
        }
    }

    formatCommunitySubtitle(community) {
        const counts = community.counts;
        const memberCount = `${counts.subscribers} members`;
        const communityData = community.community;
        
        // For local communities, show title (if different from name) and member count
        if (communityData.local) {
            if (communityData.title && communityData.title !== communityData.name) {
                return `${communityData.title} • ${memberCount}`;
            } else {
                return memberCount;
            }
        } else {
            // For remote communities, show member count and instance info
            try {
                const actorUrl = new URL(communityData.actor_id);
                const instance = actorUrl.hostname;
                return `${memberCount} • ${instance}`;
            } catch (error) {
                return `${memberCount} • remote`;
            }
        }
    }

    addGroupHeaders(communities) {
        if (communities.length === 0) return communities;
        
        const result = [];
        let hasLocal = false;
        let hasRemote = false;
        
        // Check what types we have
        communities.forEach(community => {
            if (community.isLocal) hasLocal = true;
            else hasRemote = true;
        });
        
        // Add local communities with header
        if (hasLocal) {
            if (hasRemote) { // Only add header if we have both types
                result.push({
                    value: 'header-local',
                    label: 'Local Communities',
                    disabled: true,
                    isHeader: true
                });
            }
            
            communities.filter(c => c.isLocal).forEach(community => {
                result.push(community);
            });
        }
        
        // Add remote communities with header
        if (hasRemote) {
            if (hasLocal) { // Only add header if we have both types
                result.push({
                    value: 'header-remote',
                    label: 'Federated Communities',
                    disabled: true,
                    isHeader: true
                });
            }
            
            communities.filter(c => !c.isLocal).forEach(community => {
                result.push(community);
            });
        }
        
        return result;
    }

    handleCommunitySelect(option) {
        this.selectedCommunity = option.data;
        
        // Remove any validation errors
        const container = document.getElementById('community-select-container');
        const invalidFeedback = document.getElementById('community-invalid-feedback');
        
        if (container) {
            container.classList.remove('is-invalid');
        }
        if (invalidFeedback) {
            invalidFeedback.style.display = 'none';
        }
    }

    populateSearchWithCommunity(communityParam) {
        // Just use the community name directly - no searching or matching needed
        this.selectedCommunityName = communityParam;
        
        // Update the display to show the selected community (same as before)
        const toggleButton = document.querySelector('.searchable-select-toggle .selected-text');
        if (toggleButton) {
            toggleButton.textContent = communityParam;
        }
    }

    updateCommunitySelectDisplay() {
        if (!this.selectedCommunityName) return;
        
        // Update the display to show the selected community
        const toggleButton = document.querySelector('.searchable-select-toggle .selected-text');
        if (toggleButton) {
            toggleButton.textContent = this.selectedCommunityName;
        }
        
        // If we have a community ID, also try to set the SearchableSelect's internal value
        if (this.selectedCommunityId && this.communitySelect) {
            try {
                // Set the value in the SearchableSelect component
                this.communitySelect.setValue(this.selectedCommunityId.toString());
            } catch (error) {
                // If setValue fails (maybe the community isn't in the loaded options), 
                // just update the display text which we already did above
                console.warn('Could not set SearchableSelect value, but display text updated');
            }
        }
        
        // Remove any validation errors since we have a selection
        const container = document.getElementById('community-select-container');
        const invalidFeedback = document.getElementById('community-invalid-feedback');
        
        if (container) {
            container.classList.remove('is-invalid');
        }
        if (invalidFeedback) {
            invalidFeedback.style.display = 'none';
        }
    }



    async handleSubmit() {
        if (!this.validateForm()) {
            return;
        }

        try {
            this.showLoading(true);
            
            const postData = await this.collectFormData();
            const response = await this.api.createPost(postData);
            
            if (response.post_view) {
                // Clear draft
                this.clearDraft();
                
                // Show success message
                UIUtils.showToast('Post created successfully!', 'success');
                
                // Redirect to the created post
                setTimeout(() => {
                    window.location.href = `/post/${response.post_view.post.id}`;
                }, 1000);
            } else {
                throw new Error('Invalid response from server');
            }
            
        } catch (error) {
            console.error('Failed to create post:', error);
            UIUtils.showToast(error.message || 'Failed to create post', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    validateForm() {
        const form = this.form;
        let isValid = true;

        // Clear previous validation states
        form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

        // Validate community selection
        const hasSelectedCommunityId = this.selectedCommunityId;
        const hasSelectedCommunityName = this.selectedCommunityName;
        const hasDropdownSelection = this.selectedCommunity || this.communitySelect?.getValue();
        
        if (!hasSelectedCommunityId && !hasSelectedCommunityName && !hasDropdownSelection) {
            const container = document.getElementById('community-select-container');
            const invalidFeedback = document.getElementById('community-invalid-feedback');
            if (container) {
                container.classList.add('is-invalid');
            }
            if (invalidFeedback) {
                invalidFeedback.style.display = 'block';
            }
            isValid = false;
        }

        // Validate title
        const title = document.getElementById('post-title');
        if (!title.value.trim()) {
            title.classList.add('is-invalid');
            isValid = false;
        }

        // Validate URL if provided
        const urlField = document.getElementById('post-url');
        if (urlField.value && !this.isValidURL(urlField.value)) {
            urlField.classList.add('is-invalid');
            isValid = false;
        }

        if (!isValid) {
            UIUtils.showToast('Please correct the highlighted fields', 'warning');
        }

        return isValid;
    }

    isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    async collectFormData() {
        const title = document.getElementById('post-title').value.trim();
        const body = document.getElementById('post-body').value.trim();
        const url = document.getElementById('post-url').value.trim();
        const nsfw = document.getElementById('post-nsfw').checked;
        const languageId = parseInt(document.getElementById('post-language').value) || undefined;

        const postData = {
            name: title,
            nsfw: nsfw
        };

        // Always use community_id as required by the API
        let communityId;
        
        if (this.selectedCommunityId) {
            // We have a direct community ID from URL parameters
            communityId = this.selectedCommunityId;
        } else if (this.selectedCommunityName) {
            // Find the community ID by name from our loaded communities (fallback for old URL format)
            const community = this.communities.find(c => {
                const communityName = c.community.name;
                const fullName = `${c.community.name}@${new URL(c.community.actor_id).hostname}`;
                
                return communityName === this.selectedCommunityName || 
                       fullName === this.selectedCommunityName ||
                       c.community.name.toLowerCase() === this.selectedCommunityName.toLowerCase();
            });
            
            if (community) {
                communityId = community.community.id;
            } else {
                // Fall back to using the dropdown selection if available
                const dropdownValue = this.communitySelect?.getValue();
                if (dropdownValue) {
                    communityId = parseInt(dropdownValue);
                } else {
                    throw new Error(`Community "${this.selectedCommunityName}" not found. Please select a community from the dropdown.`);
                }
            }
        } else {
            // Use dropdown selection
            communityId = parseInt(this.communitySelect?.getValue());
        }
        
        if (!communityId) {
            throw new Error('No community selected');
        }
        
        postData.community_id = communityId;

        if (body) {
            postData.body = body;
        }

        if (url) {
            postData.url = url;
        }

        if (languageId) {
            postData.language_id = languageId;
        }

        // Handle image upload if present
        const imageFile = document.getElementById('post-image').files[0];
        if (imageFile) {
            try {
                const imageUrl = await this.uploadImage(imageFile);
                if (imageUrl) {
                    if (!postData.url) {
                        postData.url = imageUrl;
                    } else {
                        // If there's already a URL, add image to body
                        postData.body = (postData.body || '') + `\n\n![Uploaded Image](${imageUrl})`;
                    }
                }
            } catch (error) {
                console.error('Failed to upload image:', error);
                UIUtils.showToast('Failed to upload image, proceeding without it', 'warning');
            }
        }

        return postData;
    }

    async uploadImage(file) {
        try {
            const imageResponse = await this.api.uploadImage(file, 'post');
            return imageResponse.url;
        } catch (error) {
            console.error('Image upload failed:', error);
            throw error;
        }
    }

    showPreview() {
        const title = document.getElementById('post-title').value.trim();
        const body = document.getElementById('post-body').value.trim();
        const url = document.getElementById('post-url').value.trim();
        const nsfw = document.getElementById('post-nsfw').checked;
        
        const communityName = this.selectedCommunityName || this.selectedCommunity?.community?.name || 'Unknown';

        let previewContent = '';
        
        // Post header
        previewContent += `
            <div class="post-preview-header mb-3">
                <h5 class="mb-1">${DOM.escapeHtml(title) || '<em>No title</em>'}</h5>
                <small class="text-muted">
                    Posted to c/${communityName}
                    ${nsfw ? '<span class="badge bg-warning text-dark ms-2">NSFW</span>' : ''}
                </small>
            </div>
        `;

        // URL preview
        if (url) {
            previewContent += `
                <div class="post-preview-url mb-3">
                    <a href="${url}" target="_blank" class="text-decoration-none">
                        <i class="bi bi-link-45deg me-1"></i>${url}
                    </a>
                </div>
            `;
        }

        // Body content
        if (body) {
            const processedBody = processPostContent(body);
            previewContent += `
                <div class="post-preview-body">
                    ${processedBody}
                </div>
            `;
        } else {
            previewContent += '<p class="text-muted"><em>No body content</em></p>';
        }

        document.getElementById('preview-content').innerHTML = previewContent;
        
        const modal = new bootstrap.Modal(document.getElementById('preview-modal'));
        modal.show();
    }

    saveDraft() {
        const draftData = {
            community: this.communitySelect?.getValue(),
            title: document.getElementById('post-title')?.value || '',
            body: document.getElementById('post-body')?.value || '',
            url: document.getElementById('post-url')?.value || '',
            nsfw: document.getElementById('post-nsfw')?.checked || false,
            language: document.getElementById('post-language')?.value || '',
            timestamp: Date.now()
        };

        localStorage.setItem('create_post_draft', JSON.stringify(draftData));
        this.isDraftSaved = true;
        UIUtils.showToast('Draft saved locally', 'success');
    }

    autoSaveDraft() {
        if (this.hasUnsavedChanges()) {
            this.saveDraft();
        }
    }

    hasUnsavedChanges() {
        const title = document.getElementById('post-title')?.value?.trim() || '';
        const body = document.getElementById('post-body')?.value?.trim() || '';
        const url = document.getElementById('post-url')?.value?.trim() || '';
        
        return title || body || url;
    }

    clearDraft() {
        localStorage.removeItem('create_post_draft');
        this.isDraftSaved = false;
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        const submitBtn = document.getElementById('submit-post');
        
        if (show) {
            overlay.style.display = 'flex';
            submitBtn.disabled = true;
        } else {
            overlay.style.display = 'none';
            submitBtn.disabled = false;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CreatePostManager();
});

export { CreatePostManager }; 