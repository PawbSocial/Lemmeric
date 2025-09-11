/**
 * User Sidebar Component for Lemmeric
 * Displays user information in a sidebar format, similar to Community Sidebar
 */

import { DOM } from '../utils.js';
import { APIUtils } from '../api.js';
import { processSidebarContent } from '../markdown-it-setup.js';
import { authManager } from '../auth.js';

export class UserSidebarComponent {
    constructor(userData) {
        this.user = userData;
        this.element = null;
    }

    /**
     * Render the user sidebar
     * @returns {HTMLElement} User sidebar element
     */
    render() {
        this.element = DOM.createElement('div', {
            className: 'user-sidebar'
        }, [
            this.renderUserInfoCard(),
            this.renderStatsCard(),
            this.renderModeratedCommunitiesCard()
        ]);

        return this.element;
    }

    /**
     * Render the main user information card
     * @returns {HTMLElement} User info card element
     */
    renderUserInfoCard() {
        const cardElements = [];

        // Banner image (if available)
        if (this.user.banner) {
            cardElements.push(
                DOM.createElement('img', {
                    src: this.user.banner,
                    alt: `${this.user.displayName || this.user.name} banner`,
                    className: 'img-fluid mb-3 rounded-top',
                    style: 'width: 100%; max-height: 120px; object-fit: cover;',
                    onerror: function() {
                        this.style.display = 'none';
                    }
                })
            );
        }

        // Header with avatar and user name
        const headerElement = this.renderUserHeader();
        cardElements.push(headerElement);

        // Instance information
        const instanceElement = this.renderInstanceInfo();
        if (instanceElement) cardElements.push(instanceElement);

        // User bio/description
        const bioElement = this.renderUserBio();
        if (bioElement) cardElements.push(bioElement);

        // Join date
        const joinDateElement = this.renderJoinDate();
        if (joinDateElement) cardElements.push(joinDateElement);

        // Status indicators (admin, bot, etc.)
        const statusElement = this.renderUserStatus();
        if (statusElement) cardElements.push(statusElement);

        // Send message button
        const sendMessageElement = this.renderSendMessageButton();
        if (sendMessageElement) cardElements.push(sendMessageElement);

        // Edit button (only for current user)
        const editButtonElement = this.renderEditButton();
        if (editButtonElement) cardElements.push(editButtonElement);

        return DOM.createElement('div', {
            className: 'card border-secondary mb-3'
        }, [
            DOM.createElement('div', {
                className: 'card-header d-flex justify-content-between align-items-center'
            }, [
                DOM.createElement('h6', {
                    className: 'mb-0'
                }, 'User'),
                editButtonElement ? this.renderEditButton() : null
            ].filter(Boolean)),
            DOM.createElement('div', {
                className: 'card-body'
            }, cardElements)
        ]);
    }

    /**
     * Render user header with avatar and name
     * @returns {HTMLElement} User header element
     */
    renderUserHeader() {
        // Generate proper user URL for both local and remote users
        let userUrl = `/u/${this.user.name}`;
        
        // For remote/federated users, include the instance domain
        if (!this.user.local && this.user.actor_id) {
            try {
                const actorUrl = new URL(this.user.actor_id);
                userUrl = `/u/${this.user.name}@${actorUrl.hostname}`;
            } catch (e) {
                console.warn('Failed to parse user actor_id:', this.user.actor_id);
                // Fallback to local format
            }
        }

        let avatarElement;
        
        if (this.user.avatar) {
            // Create the actual user avatar
            avatarElement = DOM.createElement('img', {
                src: this.user.avatar,
                alt: `${this.user.displayName || this.user.name} avatar`,
                className: 'me-2 rounded-circle',
                style: 'width: 48px; height: 48px; object-fit: cover;',
                onerror: function() {
                    // Replace the failed image with placeholder
                    const placeholder = DOM.createElement('div', {
                        className: 'me-2 bg-secondary rounded-circle d-flex align-items-center justify-content-center',
                        style: 'width: 48px; height: 48px;'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-person-fill text-white',
                            style: 'font-size: 24px;'
                        })
                    ]);
                    this.parentNode.replaceChild(placeholder, this);
                }
            });
        } else {
            // Create placeholder avatar
            avatarElement = DOM.createElement('div', {
                className: 'me-2 bg-secondary rounded-circle d-flex align-items-center justify-content-center',
                style: 'width: 48px; height: 48px;'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-person-fill text-white',
                    style: 'font-size: 24px;'
                })
            ]);
        }
        
        return DOM.createElement('div', {
            className: 'd-flex align-items-center mb-3'
        }, [
            avatarElement,
            DOM.createElement('div', {}, [
                DOM.createElement('h6', {
                    className: 'mb-0 fw-bold'
                }, [
                    DOM.createElement('a', {
                        href: userUrl,
                        className: 'text-decoration-none',
                        onclick: (e) => {
                            e.preventDefault();
                            window.location.href = userUrl;
                        }
                    }, this.user.displayName || this.user.name)
                ]),
                DOM.createElement('small', {
                    className: 'text-muted'
                }, `u/${this.user.name}`)
            ])
        ]);
    }

    /**
     * Render instance information
     * @returns {HTMLElement|null} Instance info element or null
     */
    renderInstanceInfo() {
        if (!this.user.instance) return null;

        const isLocal = this.user.instance.isLocal;
        const host = this.user.instance.host;

        return DOM.createElement('div', {
            className: 'mb-2'
        }, [
            DOM.createElement('small', {
                className: 'text-muted'
            }, [
                DOM.createElement('i', {
                    className: `bi ${isLocal ? 'bi-house-fill' : 'bi-globe'} me-1`
                }),
                `Instance: ${host}`,
                isLocal ? DOM.createElement('span', {
                    className: 'badge bg-primary ms-2',
                    style: 'font-size: 0.6rem;'
                }, 'Local') : DOM.createElement('span', {
                    className: 'badge bg-secondary ms-2',
                    style: 'font-size: 0.6rem;'
                }, 'Remote')
            ])
        ]);
    }

    /**
     * Render user bio/description
     * @returns {HTMLElement|null} Bio element or null
     */
    renderUserBio() {
        if (!this.user.bio) return null;

        const bioHtml = processSidebarContent(this.user.bio);
        
        return DOM.createElement('div', {
            className: 'mb-3'
        }, [
            DOM.createElement('small', {
                className: 'text-muted fw-bold d-block mb-1'
            }, 'Bio:'),
            DOM.createElement('div', {
                className: 'user-bio',
                innerHTML: bioHtml
            })
        ]);
    }

    /**
     * Render join date
     * @returns {HTMLElement|null} Join date element or null
     */
    renderJoinDate() {
        if (!this.user.published) return null;

        const joinDate = new Date(this.user.published);
        const formattedDate = joinDate.toLocaleDateString();

        return DOM.createElement('div', {
            className: 'mb-2'
        }, [
            DOM.createElement('small', {
                className: 'text-muted'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-calendar-plus me-1'
                }),
                `Joined: ${formattedDate}`
            ])
        ]);
    }

    /**
     * Render user status indicators
     * @returns {HTMLElement|null} Status element or null
     */
    renderUserStatus() {
        const statusItems = [];

        if (this.user.admin) {
            statusItems.push(
                DOM.createElement('span', {
                    className: 'badge bg-danger me-1 mb-1',
                    title: 'This user is an administrator of this instance'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-shield-fill me-1'
                    }),
                    'Instance Admin'
                ])
            );
        }

        if (this.user.bot_account) {
            statusItems.push(
                DOM.createElement('span', {
                    className: 'badge bg-info me-1 mb-1'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-robot me-1'
                    }),
                    'Bot'
                ])
            );
        }

        if (this.user.deleted) {
            statusItems.push(
                DOM.createElement('span', {
                    className: 'badge bg-warning me-1 mb-1'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-exclamation-triangle me-1'
                    }),
                    'Deleted'
                ])
            );
        }

        if (this.user.banned) {
            statusItems.push(
                DOM.createElement('span', {
                    className: 'badge bg-dark me-1 mb-1'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-ban me-1'
                    }),
                    'Banned'
                ])
            );
        }

        if (statusItems.length === 0) return null;

        return DOM.createElement('div', {
            className: 'mb-2'
        }, statusItems);
    }

    /**
     * Render send message button
     * @returns {HTMLElement|null} Send message button element or null
     */
    renderSendMessageButton() {
        // Don't show send message button if not logged in
        if (!authManager || !authManager.isAuthenticated()) {
            return null;
        }

        // Don't show send message button for current user or deleted/banned users
        if (this.isCurrentUser() || this.user.deleted || this.user.banned) {
            return null;
        }

        return DOM.createElement('div', {
            className: 'mt-3 d-grid'
        }, [
            DOM.createElement('button', {
                type: 'button',
                className: 'btn btn-primary btn-sm',
                'data-bs-toggle': 'modal',
                'data-bs-target': '#sendMessageModal',
                onclick: () => this.openSendMessageModal()
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-envelope me-2'
                }),
                'Send Message'
            ])
        ]);
    }

    /**
     * Check if the displayed user is the current user
     * @returns {boolean} True if this is the current user
     */
    isCurrentUser() {
        // Get current user from auth manager
        if (!authManager) return false;
        
        const currentUser = authManager.getCurrentUser();
        if (!currentUser) return false;
        
        return currentUser.name === this.user.name;
    }

    /**
     * Render edit button (only for current user)
     * @returns {HTMLElement|null} Edit button element or null
     */
    renderEditButton() {
        if (!this.isCurrentUser()) {
            return null;
        }

        return DOM.createElement('button', {
            className: 'btn btn-outline-primary btn-sm',
            type: 'button',
            'data-bs-toggle': 'modal',
            'data-bs-target': '#editUserModal',
            title: 'Edit Profile',
            onclick: () => this.handleEditClick()
        }, [
            DOM.createElement('i', {
                className: 'bi bi-pencil me-1'
            }),
            'Edit'
        ]);
    }

    /**
     * Handle edit button click
     */
    handleEditClick() {
        // Dispatch custom event to open edit modal
        const event = new CustomEvent('editUser', {
            detail: {
                user: this.user
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Open the send message modal
     */
    openSendMessageModal() {
        // Create or update the modal
        this.createSendMessageModal();
        
        // Show the modal with a slight delay to ensure DOM is ready
        setTimeout(() => {
            const modal = document.getElementById('sendMessageModal');
            if (modal && window.bootstrap) {
                try {
                    const bsModal = new bootstrap.Modal(modal, {
                        backdrop: true,
                        keyboard: true,
                        focus: true
                    });
                    bsModal.show();
                } catch (error) {
                    console.error('Error initializing modal:', error);
                    // Fallback to simple display
                    modal.style.display = 'block';
                    modal.classList.add('show');
                }
            }
        }, 100);
    }

    /**
     * Create the send message modal
     */
    createSendMessageModal() {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('sendMessageModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = DOM.createElement('div', {
            className: 'modal fade',
            id: 'sendMessageModal',
            tabindex: '-1',
            'aria-labelledby': 'sendMessageModalLabel',
            'aria-hidden': 'true'
        }, [
            DOM.createElement('div', {
                className: 'modal-dialog'
            }, [
                DOM.createElement('div', {
                    className: 'modal-content'
                }, [
                    DOM.createElement('div', {
                        className: 'modal-header'
                    }, [
                        DOM.createElement('h5', {
                            className: 'modal-title',
                            id: 'sendMessageModalLabel'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-envelope me-2'
                            }),
                            `Send Message to ${this.user.displayName || this.user.name}`
                        ]),
                        DOM.createElement('button', {
                            type: 'button',
                            className: 'btn-close',
                            'data-bs-dismiss': 'modal',
                            'aria-label': 'Close'
                        })
                    ]),
                    DOM.createElement('div', {
                        className: 'modal-body'
                    }, [
                        DOM.createElement('div', {
                            className: 'd-flex align-items-center mb-3 p-2 bg-body-secondary rounded'
                        }, [
                            this.user.avatar ? 
                                DOM.createElement('img', {
                                    src: this.user.avatar,
                                    alt: `${this.user.displayName || this.user.name} avatar`,
                                    className: 'rounded-circle me-3',
                                    style: 'width: 40px; height: 40px; object-fit: cover;'
                                }) :
                                DOM.createElement('div', {
                                    className: 'bg-secondary rounded-circle d-flex align-items-center justify-content-center me-3',
                                    style: 'width: 40px; height: 40px;'
                                }, [
                                    DOM.createElement('i', {
                                        className: 'bi bi-person-fill text-white'
                                    })
                                ]),
                            DOM.createElement('div', {}, [
                                DOM.createElement('h6', {
                                    className: 'mb-0'
                                }, this.user.displayName || this.user.name),
                                DOM.createElement('small', {
                                    className: 'text-muted'
                                }, `u/${this.user.name}`)
                            ])
                        ]),
                        DOM.createElement('div', {
                            className: 'mb-3'
                        }, [
                            DOM.createElement('label', {
                                for: 'messageContent',
                                className: 'form-label'
                            }, 'Message'),
                            DOM.createElement('textarea', {
                                className: 'form-control',
                                id: 'messageContent',
                                rows: '4',
                                placeholder: 'Type your message here...',
                                maxlength: '10000'
                            })
                        ]),
                        DOM.createElement('div', {
                            className: 'text-muted small'
                        }, 'Maximum 10,000 characters')
                    ]),
                    DOM.createElement('div', {
                        className: 'modal-footer'
                    }, [
                        DOM.createElement('button', {
                            type: 'button',
                            className: 'btn btn-secondary',
                            'data-bs-dismiss': 'modal'
                        }, 'Cancel'),
                        DOM.createElement('button', {
                            type: 'button',
                            className: 'btn btn-primary',
                            onclick: () => this.sendMessage()
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-send me-2'
                            }),
                            'Send Message'
                        ])
                    ])
                ])
            ])
        ]);

        document.body.appendChild(modal);
    }

    /**
     * Send the message
     */
    async sendMessage() {
        const messageContent = document.getElementById('messageContent');
        if (!messageContent) return;

        const content = messageContent.value.trim();
        if (!content) {
            alert('Please enter a message before sending.');
            return;
        }

        try {
            // Show loading state
            const sendButton = document.querySelector('#sendMessageModal .btn-primary');
            if (sendButton) {
                sendButton.disabled = true;
                sendButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';
            }

            // Check authentication using imported authManager
            if (!authManager) {
                throw new Error('Authentication system not available');
            }

            // Check if user is authenticated using multiple methods
            const currentUser = authManager.getCurrentUser();
            const hasToken = authManager.isAuthenticated();
            
            
            if (!currentUser && !hasToken) {
                throw new Error('You must be logged in to send messages');
            }

            // Send the message via API
            const api = authManager.api;
            const response = await api.createPrivateMessage({
                content: content,
                recipient_id: this.user.id
            });

            if (response) {
                // Success - close modal and show success message
                const modal = bootstrap.Modal.getInstance(document.getElementById('sendMessageModal'));
                if (modal) {
                    modal.hide();
                }

                // Show success toast
                this.showToast('Message sent successfully!', 'success');
                
                // Clear the message content
                messageContent.value = '';
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            this.showToast('Failed to send message. Please try again.', 'error');
        } finally {
            // Reset button state
            const sendButton = document.querySelector('#sendMessageModal .btn-primary');
            if (sendButton) {
                sendButton.disabled = false;
                sendButton.innerHTML = '<i class="bi bi-send me-2"></i>Send Message';
            }
        }
    }

    /**
     * Show a toast notification
     */
    showToast(message, type = 'info') {
        // Use existing toast system if available, otherwise fallback to alert
        if (window.showToast) {
            window.showToast(message, type);
        } else if (window.DOM && window.DOM.showToast) {
            window.DOM.showToast(message, type);
        } else {
            alert(message);
        }
    }

    /**
     * Render user statistics card
     * @returns {HTMLElement} Stats card element
     */
    renderStatsCard() {
        return DOM.createElement('div', {
            className: 'card border-secondary mb-3'
        }, [
            DOM.createElement('div', {
                className: 'card-header'
            }, [
                DOM.createElement('h6', {
                    className: 'mb-0'
                }, 'Statistics')
            ]),
            DOM.createElement('div', {
                className: 'card-body'
            }, [
                this.renderStatItem('Posts', this.user.stats?.post_count),
                this.renderStatItem('Comments', this.user.stats?.comment_count),
                this.renderStatItem('Post Score', this.user.stats?.post_score),
                this.renderStatItem('Comment Score', this.user.stats?.comment_score)
            ])
        ]);
    }

    /**
     * Render a single stat item
     * @param {string} label - Stat label
     * @param {number|string} value - Stat value
     * @returns {HTMLElement} Stat item element
     */
    renderStatItem(label, value = '') {
        const displayValue = typeof value === 'number' ? 
            APIUtils.formatNumber(value) : 
            (value || '0');

        return DOM.createElement('div', {
            className: 'd-flex justify-content-between align-items-center mb-1'
        }, [
            DOM.createElement('small', {
                className: 'text-muted'
            }, label),
            DOM.createElement('small', {
                className: 'fw-bold'
            }, displayValue)
        ]);
    }

    /**
     * Render moderated communities card
     * @returns {HTMLElement} Moderated communities card element
     */
    renderModeratedCommunitiesCard() {
        // Since Lemmy API doesn't directly provide moderated communities in user endpoint,
        // we'll implement a placeholder for now and can enhance it later when the API supports it
        // or by querying the site's communities and checking moderator status
        
        return DOM.createElement('div', {
            className: 'card border-secondary mb-3'
        }, [
            DOM.createElement('div', {
                className: 'card-header'
            }, [
                DOM.createElement('h6', {
                    className: 'mb-0'
                }, 'Moderated Communities')
            ]),
            DOM.createElement('div', {
                className: 'card-body'
            }, [
                this.renderModeratedCommunitiesList()
            ])
        ]);
    }

    /**
     * Render the list of moderated communities
     * @returns {HTMLElement} Moderated communities list element
     */
    renderModeratedCommunitiesList() {
        const moderatedCommunities = this.user.moderatedCommunities || [];
        
        if (moderatedCommunities.length === 0) {
            return DOM.createElement('div', {
                className: 'text-center py-3'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-shield-check text-muted mb-2',
                    style: 'font-size: 2rem;'
                }),
                DOM.createElement('p', {
                    className: 'text-muted small mb-0'
                }, 'This user does not moderate'),
                DOM.createElement('p', {
                    className: 'text-muted small mb-0'
                }, 'any communities.')
            ]);
        }

        // Create communities list
        const communitiesList = DOM.createElement('div', { className: 'moderated-communities-list' });
        
        moderatedCommunities.forEach(community => {
            // Generate proper community URL for both local and remote communities
            let communityUrl = `/c/${community.name}`;
            
            // For remote/federated communities, include the instance domain
            if (!community.local && community.actor_id) {
                try {
                    const actorUrl = new URL(community.actor_id);
                    communityUrl = `/c/${community.name}@${actorUrl.hostname}`;
                } catch (e) {
                    console.warn('Failed to parse community actor_id:', community.actor_id);
                    // Fallback to local format if parsing fails
                }
            }

            const communityElement = DOM.createElement('div', {
                className: 'community-item d-block p-2 rounded hover-effect',
                style: 'cursor: pointer; color: inherit; text-decoration: none;',
                title: community.description || `Visit c/${community.name}`,
                role: 'button',
                tabindex: '0'
            }, [
                DOM.createElement('div', { className: 'community-info d-flex align-items-center' }, [
                    // Community icon (if available)
                    community.icon ? 
                        DOM.createElement('img', {
                            src: community.icon,
                            alt: community.title || community.name,
                            className: 'rounded me-2',
                            style: 'width: 24px; height: 24px; object-fit: cover;',
                            onerror: function() {
                                this.style.display = 'none';
                            }
                        }) :
                        DOM.createElement('div', {
                            className: 'bg-secondary rounded me-2 d-flex align-items-center justify-content-center',
                            style: 'width: 24px; height: 24px;'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-people-fill text-white',
                                style: 'font-size: 12px;'
                            })
                        ]),
                    
                    DOM.createElement('div', { className: 'flex-grow-1 text-start' }, [
                        DOM.createElement('div', { 
                            className: 'community-name fw-semibold small mb-0',
                            style: 'color: var(--bs-body-color);'
                        }, community.title || community.name),
                        DOM.createElement('small', { 
                            className: 'text-muted d-block',
                            style: 'font-size: 0.75rem;'
                        }, [
                            // Show NSFW indicator if applicable
                            community.nsfw ? DOM.createElement('span', {
                                className: 'badge badge-sm bg-danger me-1',
                                style: 'font-size: 0.6rem;'
                            }, 'NSFW') : null,
                            // Show instance info for remote communities
                            !community.local ? `${community.name}@${community.instance.host}` : `c/${community.name}`
                        ].filter(Boolean))
                    ]),
                    
                    // Moderator badge
                    DOM.createElement('div', { className: 'ms-auto' }, [
                        DOM.createElement('i', {
                            className: 'bi bi-shield-fill text-success',
                            style: 'font-size: 14px;',
                            title: 'Moderator'
                        })
                    ])
                ])
            ]);

            // Add click handler for navigation
            const handleNavigation = () => {
                window.location.href = communityUrl;
            };

            communityElement.addEventListener('click', handleNavigation);
            
            // Add keyboard support
            communityElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNavigation();
                }
            });

            communitiesList.appendChild(communityElement);
        });

        return communitiesList;
    }

    /**
     * Update the user sidebar with new data
     * @param {Object} userData - New user data
     */
    update(userData) {
        this.user = userData;
        if (this.element) {
            const newElement = this.render();
            this.element.parentNode.replaceChild(newElement, this.element);
        }
    }
} 