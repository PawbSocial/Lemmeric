/**
 * SearchableSelect Component
 * A dropdown component with search functionality, inspired by Lemmy's original UI
 */

export class SearchableSelect {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            console.error('SearchableSelect container not found:', containerId);
            throw new Error(`SearchableSelect container not found: ${containerId}`);
        }
        
        this.options = {
            placeholder: options.placeholder || 'Select an option...',
            searchPlaceholder: options.searchPlaceholder || 'Search...',
            noResultsText: options.noResultsText || 'No results found',
            loadingText: options.loadingText || 'Loading...',
            onSelect: options.onSelect || (() => {}),
            onSearch: options.onSearch || null,
            initialOptions: options.initialOptions || [],
            value: options.value || null,
            searchDelay: options.searchDelay || 300
        };
        
        this.state = {
            isOpen: false,
            searchText: '',
            options: [...this.options.initialOptions],
            loading: false,
            selectedValue: this.options.value,
            selectedIndex: 0
        };
        
        this.searchTimeout = null;
        
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            this.render();
            this.bindEvents();
            this.initializeDropdown();
        }, 0);
    }

    render() {
        const selectedOption = this.state.options.find(opt => opt.value === this.state.selectedValue);
        const displayText = selectedOption ? selectedOption.label : this.options.placeholder;
        
        this.container.innerHTML = `
            <div class="searchable-select dropdown">
                <button type="button" 
                        class="form-select searchable-select-toggle" 
                        data-bs-toggle="dropdown" 
                        aria-expanded="false">
                    <span class="selected-text">${this.escapeHtml(displayText)}</span>
                    <i class="bi bi-chevron-down ms-auto"></i>
                </button>
                <div class="dropdown-menu searchable-select-menu w-100">
                    <div class="p-2">
                        <div class="input-group input-group-sm">
                            <span class="input-group-text">
                                ${this.state.loading ? 
                                    '<span class="spinner-border spinner-border-sm" role="status"></span>' : 
                                    '<i class="bi bi-search"></i>'
                                }
                            </span>
                            <input type="text" 
                                   class="form-control searchable-select-input" 
                                   placeholder="${this.options.searchPlaceholder}"
                                   value="${this.escapeHtml(this.state.searchText)}"
                                   autocomplete="off">
                        </div>
                    </div>
                    <div class="searchable-select-options">
                        ${this.renderOptions()}
                    </div>
                </div>
            </div>
        `;
    }

    renderOptions() {
        if (this.state.loading) {
            return `<div class="dropdown-item-text text-center text-muted">${this.options.loadingText}</div>`;
        }

        const filteredOptions = this.filterOptions();
        
        if (filteredOptions.length === 0) {
            return `<div class="dropdown-item-text text-center text-muted">${this.options.noResultsText}</div>`;
        }

        return filteredOptions.map((option, index) => {
            const isSelected = option.value === this.state.selectedValue;
            const isActive = index === this.state.selectedIndex;
            
            // Handle header items
            if (option.isHeader) {
                return `
                    <div class="dropdown-header searchable-select-header">
                        <small class="fw-bold text-muted">${this.escapeHtml(option.label)}</small>
                    </div>
                `;
            }
            
            return `
                <button type="button" 
                        class="dropdown-item searchable-select-option ${isSelected ? 'active' : ''} ${isActive ? 'highlighted' : ''}"
                        data-value="${this.escapeHtml(option.value)}"
                        ${option.disabled ? 'disabled' : ''}>
                    ${this.escapeHtml(option.label)}
                    ${option.subtitle ? `<small class="text-muted d-block">${this.escapeHtml(option.subtitle)}</small>` : ''}
                </button>
            `;
        }).join('');
    }

    filterOptions() {
        // If onSearch is provided, parent handles filtering - return all options
        if (this.options.onSearch) {
            return this.state.options;
        }

        // For local filtering only
        if (!this.state.searchText || this.state.searchText.trim() === '') {
            return this.state.options;
        }

        // Local filtering
        const filtered = this.state.options.filter(option => 
            option.label.toLowerCase().includes(this.state.searchText.toLowerCase())
        );
        
        return filtered;
    }

    bindEvents() {
        // Toggle button click
        this.container.addEventListener('click', (e) => {
            if (e.target.matches('.searchable-select-toggle, .searchable-select-toggle *')) {
                this.handleToggle();
            }
        });

        // Option click
        this.container.addEventListener('click', (e) => {
            if (e.target.matches('.searchable-select-option')) {
                const value = e.target.dataset.value;
                this.selectOption(value);
            }
        });

        // Search input
        this.container.addEventListener('input', (e) => {
            if (e.target.matches('.searchable-select-input')) {
                this.handleSearch(e.target.value);
            }
        });

        // Keyboard navigation
        this.container.addEventListener('keydown', (e) => {
            if (e.target.matches('.searchable-select-input')) {
                this.handleKeyDown(e);
            }
        });

        // Focus search when dropdown opens
        this.container.addEventListener('shown.bs.dropdown', () => {
            const input = this.container.querySelector('.searchable-select-input');
            if (input) {
                setTimeout(() => {
                    input.focus();
                    // Don't clear search text automatically - let user clear it manually
                    // this.state.searchText = '';
                    // this.handleSearch('');
                }, 100);
            }
        });

        // Close dropdown when option selected
        this.container.addEventListener('hidden.bs.dropdown', () => {
            this.state.isOpen = false;
        });
    }

    handleToggle() {
        this.state.isOpen = !this.state.isOpen;
    }

    handleSearch(searchText) {
        this.state.searchText = searchText;
        this.state.selectedIndex = 0;

        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // For immediate local filtering, update display right away
        if (!this.options.onSearch) {
            this.updateOptionsDisplay();
            return;
        }

        // For remote search, debounce the API call
        this.searchTimeout = setTimeout(() => {
            this.setLoading(true);
            this.options.onSearch(searchText)
                .then(results => {
                    this.updateOptions(results);
                    this.setLoading(false);
                })
                .catch(error => {
                    console.error('Search error:', error);
                    this.setLoading(false);
                });
        }, this.options.searchDelay);
    }

    handleKeyDown(e) {
        const filteredOptions = this.filterOptions();
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.state.selectedIndex = Math.min(this.state.selectedIndex + 1, filteredOptions.length - 1);
                this.updateOptionsDisplay();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.state.selectedIndex = Math.max(this.state.selectedIndex - 1, 0);
                this.updateOptionsDisplay();
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredOptions[this.state.selectedIndex]) {
                    this.selectOption(filteredOptions[this.state.selectedIndex].value);
                }
                break;
            case 'Escape':
                this.closeDropdown();
                break;
        }
    }

    selectOption(value) {
        this.state.selectedValue = value;
        const selectedOption = this.state.options.find(opt => opt.value === value);
        
        if (selectedOption) {
            this.options.onSelect(selectedOption);
        }
        
        this.closeDropdown();
        this.render();
    }

    closeDropdown() {
        const toggleButton = this.container.querySelector('.searchable-select-toggle');
        if (toggleButton) {
            const dropdown = bootstrap.Dropdown.getInstance(toggleButton);
            if (dropdown) {
                dropdown.hide();
            }
        }
    }

    setLoading(loading) {
        this.state.loading = loading;
        this.updateSpinner();
        // Also update the options display to show/hide loading
        this.updateOptionsDisplay();
    }

    updateSpinner() {
        const spinner = this.container.querySelector('.input-group-text');
        if (spinner) {
            spinner.innerHTML = this.state.loading ? 
                '<span class="spinner-border spinner-border-sm" role="status"></span>' : 
                '<i class="bi bi-search"></i>';
        }
    }

    updateOptions(options) {
        this.state.options = options;
        this.state.selectedIndex = 0; // Reset selection to first item
        this.updateOptionsDisplay();
    }

    updateOptionsDisplay() {
        const optionsContainer = this.container.querySelector('.searchable-select-options');
        if (optionsContainer) {
            const newHTML = this.renderOptions();
            optionsContainer.innerHTML = newHTML;
        } else {
            console.error('Options container not found!');
        }
        
        // Update search input value to match state
        const searchInput = this.container.querySelector('.searchable-select-input');
        if (searchInput && searchInput.value !== this.state.searchText) {
            searchInput.value = this.state.searchText;
        }
    }

    setValue(value) {
        this.state.selectedValue = value;
        this.render();
    }

    getValue() {
        return this.state.selectedValue;
    }

    getSelectedOption() {
        return this.state.options.find(opt => opt.value === this.state.selectedValue);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    initializeDropdown() {
        // Ensure Bootstrap dropdown is properly initialized
        const toggleButton = this.container.querySelector('.searchable-select-toggle');
        if (toggleButton && window.bootstrap) {
            try {
                new bootstrap.Dropdown(toggleButton);
            } catch (error) {
                console.warn('Bootstrap dropdown initialization failed:', error);
            }
        }
    }

    destroy() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        this.container.innerHTML = '';
    }
} 