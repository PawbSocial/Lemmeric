/**
 * Community Sidebar Component for Lemmeric
 * Displays community information in a sidebar format, similar to Instance Info card
 */

import { DOM } from '../utils.js';
import { APIUtils } from '../api.js';
import { processSidebarContent } from '../markdown-it-setup.js';

export class CommunitySidebarComponent {
    constructor(communityData, moderators = [], currentUser = null) {
        this.community = communityData;
        this.moderators = moderators;
        this.currentUser = currentUser;
        this.element = null;
    }

    /**
     * Render the community sidebar
     * @returns {HTMLElement} Community sidebar element
     */
    render() {
        this.element = DOM.createElement('div', {
            className: 'community-sidebar'
        }, [
            this.renderCommunityInfoCard(),
            this.renderModeratorsCard(),
            this.renderStatsCard()
        ]);

        return this.element;
    }

    /**
     * Render the main community information card (similar to Instance Info)
     * @returns {HTMLElement} Community info card element
     */
    renderCommunityInfoCard() {
        const cardElements = [];

        // Banner image (if available)
        if (this.community.banner) {
            cardElements.push(
                DOM.createElement('img', {
                    src: this.community.banner,
                    alt: `${this.community.title || this.community.name} banner`,
                    className: 'img-fluid mb-3 rounded-top',
                    style: 'width: 100%; max-height: 120px; object-fit: cover;',
                    onerror: function() {
                        this.style.display = 'none';
                    }
                })
            );
        }

        // Header with icon and community name
        const headerElement = this.renderCommunityHeader();
        cardElements.push(headerElement);

        // Instance information
        const instanceElement = this.renderInstanceInfo();
        if (instanceElement) cardElements.push(instanceElement);

        // Community description
        const descriptionElement = this.renderCommunityDescription();
        if (descriptionElement) cardElements.push(descriptionElement);

        // Status indicators (NSFW, removed, etc.)
        const statusElement = this.renderCommunityStatus();
        if (statusElement) cardElements.push(statusElement);

        // Edit button (if user is moderator)
        const editButtonElement = this.renderEditButton();

        return DOM.createElement('div', {
            className: 'card border-secondary mb-3'
        }, [
            DOM.createElement('div', {
                className: 'card-header d-flex justify-content-between align-items-center'
            }, [
                DOM.createElement('h6', {
                    className: 'mb-0'
                }, 'Community'),
                editButtonElement ? DOM.createElement('div', {
                    className: 'btn-group btn-group-sm'
                }, [editButtonElement]) : null
            ].filter(Boolean)),
            DOM.createElement('div', {
                className: 'card-body'
            }, cardElements)
        ]);
    }

    /**
     * Render community header with icon and name
     * @returns {HTMLElement} Community header element
     */
    renderCommunityHeader() {
        // Generate proper community URL for both local and remote communities
        let communityUrl = `/c/${this.community.name}`;
        
        // For remote/federated communities, include the instance domain
        if (!this.community.local && this.community.actor_id) {
            try {
                const actorUrl = new URL(this.community.actor_id);
                communityUrl = `/c/${this.community.name}@${actorUrl.hostname}`;
            } catch (e) {
                console.warn('Failed to parse community actor_id:', this.community.actor_id);
                // Fallback to local format
            }
        }

        let iconElement;
        
        if (this.community.icon) {
            // Create the actual community icon
            iconElement = DOM.createElement('img', {
                src: this.community.icon,
                alt: `${this.community.title || this.community.name} icon`,
                className: 'me-2 rounded',
                style: 'width: 32px; height: 32px; object-fit: cover;',
                onerror: function() {
                    // Replace the failed image with placeholder
                    const placeholder = DOM.createElement('div', {
                        className: 'me-2 bg-secondary rounded d-flex align-items-center justify-content-center',
                        style: 'width: 32px; height: 32px;'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-people-fill text-white',
                            style: 'font-size: 16px;'
                        })
                    ]);
                    this.parentNode.replaceChild(placeholder, this);
                }
            });
        } else {
            // Create placeholder icon
            iconElement = DOM.createElement('div', {
                className: 'me-2 bg-secondary rounded d-flex align-items-center justify-content-center',
                style: 'width: 32px; height: 32px;'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-people-fill text-white',
                    style: 'font-size: 16px;'
                })
            ]);
        }
        
        return DOM.createElement('div', {
            className: 'd-flex align-items-center mb-2'
        }, [
            iconElement,
            DOM.createElement('div', {}, [
                DOM.createElement('h6', {
                    className: 'mb-0 fw-bold'
                }, [
                    DOM.createElement('a', {
                        href: communityUrl,
                        className: 'text-decoration-none',
                        onclick: (e) => {
                            e.preventDefault();
                            window.location.href = communityUrl;
                        }
                    }, this.community.title || this.community.name)
                ]),
                DOM.createElement('small', {
                    className: 'text-muted'
                }, `c/${this.community.name}`)
            ])
        ]);
    }

    /**
     * Render instance information
     * @returns {HTMLElement|null} Instance info element or null
     */
    renderInstanceInfo() {
        if (!this.community.instance) return null;

        const isLocal = this.community.instance.isLocal;
        const host = this.community.instance.host;

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
     * Render community description
     * @returns {HTMLElement} Description element
     */
    renderCommunityDescription() {
        // Show the full description without truncation
        const description = this.community.description;

        return DOM.createElement('div', {
            className: 'mb-2'
        }, [
            DOM.createElement('div', {
                className: 'text-muted small',
                innerHTML: processSidebarContent(description),
                style: 'line-height: 1.4;'
            })
        ]);
    }

    /**
     * Render community status indicators
     * @returns {HTMLElement|null} Status element or null if no special status
     */
    renderCommunityStatus() {
        const statusItems = [];

        if (this.community.nsfw) {
            statusItems.push(
                DOM.createElement('span', {
                    className: 'badge bg-warning text-dark me-1'
                }, 'NSFW')
            );
        }

        if (this.community.posting_restricted_to_mods) {
            statusItems.push(
                DOM.createElement('span', {
                    className: 'badge bg-info text-dark me-1'
                }, 'Mods Only')
            );
        }

        if (this.community.removed) {
            statusItems.push(
                DOM.createElement('span', {
                    className: 'badge bg-danger me-1'
                }, 'Removed')
            );
        }

        if (this.community.deleted) {
            statusItems.push(
                DOM.createElement('span', {
                    className: 'badge bg-secondary me-1'
                }, 'Deleted')
            );
        }

        if (statusItems.length === 0) return null;

        return DOM.createElement('div', {
            className: 'mb-2'
        }, statusItems);
    }

    /**
     * Render moderators card
     * @returns {HTMLElement} Moderators card element
     */
    renderModeratorsCard() {
        if (!this.moderators || this.moderators.length === 0) {
            return DOM.createElement('div'); // Empty div if no moderators
        }

        return DOM.createElement('div', {
            className: 'card border-secondary mb-3'
        }, [
            DOM.createElement('div', {
                className: 'card-header'
            }, [
                DOM.createElement('h6', {
                    className: 'mb-0'
                }, 'Moderators')
            ]),
            DOM.createElement('div', {
                className: 'card-body'
            }, [
                DOM.createElement('div', {
                    className: 'moderators-list'
                }, this.moderators.slice(0, 8).map(mod => this.renderModerator(mod)))
            ])
        ]);
    }

    /**
     * Render a single moderator
     * @param {Object} moderator - Moderator data
     * @returns {HTMLElement} Moderator element
     */
    renderModerator(moderator) {
        const person = moderator.moderator || moderator.person || moderator;
        
        // Generate proper user URL for both local and remote users
        let userUrl = `/u/${person.name}`;
        
        // For remote/federated users, include the instance domain
        if (!person.local && person.actor_id) {
            try {
                const actorUrl = new URL(person.actor_id);
                userUrl = `/u/${person.name}@${actorUrl.hostname}`;
            } catch (e) {
                console.warn('Failed to parse user actor_id:', person.actor_id);
                // Fallback to local format
            }
        }
        
        return DOM.createElement('div', {
            className: 'd-flex align-items-center mb-2'
        }, [
            person.avatar ? DOM.createElement('img', {
                src: person.avatar,
                className: 'rounded-circle me-2',
                style: 'width: 24px; height: 24px; object-fit: cover;',
                alt: person.display_name || person.name,
                onerror: function() {
                    this.style.display = 'none';
                    this.nextElementSibling.style.display = 'flex';
                }
            }) : null,
            !person.avatar ? DOM.createElement('div', {
                className: 'bg-secondary rounded-circle me-2 d-flex align-items-center justify-content-center',
                style: 'width: 24px; height: 24px;'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-person-fill text-white',
                    style: 'font-size: 12px;'
                })
            ]) : null,
            DOM.createElement('small', {
                className: 'text-truncate'
            }, [
                DOM.createElement('a', {
                    href: userUrl,
                    className: 'text-decoration-none',
                    onclick: (e) => {
                        e.preventDefault();
                        window.location.href = userUrl;
                    }
                }, person.display_name || person.name)
            ])
        ].filter(Boolean));
    }

    /**
     * Render community statistics card
     * @returns {HTMLElement} Stats card element
     */
    renderStatsCard() {
        const stats = this.community.stats || {};
        const statItems = [];
        
        // Basic community stats
        statItems.push(this.renderStatItem('Subscribers', stats.subscribers || 0));
        statItems.push(this.renderStatItem('Posts', stats.posts || 0));
        statItems.push(this.renderStatItem('Comments', stats.comments || 0));
        
        // Additional stats if available
        if (stats.users_active_half_year > 0) {
            statItems.push(this.renderStatItem('Active (6 months)', stats.users_active_half_year));
        }
        
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
            }, statItems)
        ]);
    }

    /**
     * Render a single statistic item
     * @param {string} label - Statistic label
     * @param {number|string} value - Statistic value
     * @returns {HTMLElement} Stat item element
     */
    renderStatItem(label, value = '') {
        // Regular stats with label and value
        return DOM.createElement('div', {
            className: 'instance-stat'
        }, [
            DOM.createElement('span', {}, label),
            DOM.createElement('span', {
                className: 'fw-bold'
            }, typeof value === 'number' ? APIUtils.formatNumber(value) : value)
        ]);
    }

    /**
     * Render edit button (if user is moderator)
     * @returns {HTMLElement|null} Edit button element or null
     */
    renderEditButton() {
        // Check if current user is a moderator of this community
        if (!this.currentUser || !this.isUserModerator()) {
            return null;
        }

        return DOM.createElement('button', {
            className: 'btn btn-outline-primary btn-sm',
            type: 'button',
            'data-bs-toggle': 'modal',
            'data-bs-target': '#editCommunityModal',
            title: 'Edit Community',
            onclick: () => this.handleEditClick()
        }, [
            DOM.createElement('i', {
                className: 'bi bi-pencil me-1'
            }),
            'Edit'
        ]);
    }

    /**
     * Check if current user is a moderator of this community
     * @returns {boolean} True if user is moderator
     */
    isUserModerator() {
        if (!this.currentUser || !this.moderators) return false;
        
        return this.moderators.some(mod => {
            // Handle different moderator object structures
            const moderatorPerson = mod.moderator || mod.person || mod;
            return moderatorPerson && moderatorPerson.id === this.currentUser.id;
        });
    }

    /**
     * Handle edit button click
     */
    handleEditClick() {
        // Dispatch custom event to notify parent component
        const event = new CustomEvent('editCommunity', {
            detail: {
                community: this.community
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Update community data
     * @param {Object} communityData - New community data
     * @param {Array} moderators - New moderators data
     * @param {Object} currentUser - Current user data
     */
    update(communityData, moderators = [], currentUser = null) {
        this.community = communityData;
        this.moderators = moderators;
        this.currentUser = currentUser;
        
        if (this.element && this.element.parentNode) {
            const newElement = this.render();
            this.element.parentNode.replaceChild(newElement, this.element);
        }
    }
} 