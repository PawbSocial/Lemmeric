/**
 * Community component for Lemmeric
 * Handles rendering and interactions for communities
 */

import { DOM, TextUtils } from '../utils.js';
import { APIUtils } from '../api.js';

export class CommunityComponent {
    constructor(communityData, container) {
        this.community = APIUtils.formatCommunity(communityData);
        this.container = container;
        this.element = null;
    }

    /**
     * Render the community component
     * @returns {HTMLElement} Community element
     */
    render() {
        this.element = DOM.createElement('div', {
            className: 'card community-card mb-3',
            'data-community-id': this.community.id
        }, [
            DOM.createElement('div', {
                className: 'card-body'
            }, [
                this.renderHeader(),
                this.renderDescription(),
                this.renderStats()
            ])
        ]);

        this.attachEventListeners();
        return this.element;
    }

    /**
     * Render community header
     * @returns {HTMLElement} Header element
     */
    renderHeader() {
        return DOM.createElement('div', {
            className: 'd-flex align-items-center mb-2'
        }, [
            this.community.icon ? DOM.createElement('img', {
                src: this.community.icon,
                className: 'community-icon me-3',
                style: 'width: 48px; height: 48px; border-radius: 50%;',
                alt: ''
            }) : DOM.createElement('div', {
                className: 'community-icon-placeholder me-3 bg-secondary rounded-circle d-flex align-items-center justify-content-center',
                style: 'width: 48px; height: 48px;'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-people-fill text-white'
                })
            ]),
            DOM.createElement('div', {
                className: 'flex-grow-1'
            }, [
                DOM.createElement('h5', {
                    className: 'mb-1'
                }, this.community.title || this.community.name),
                DOM.createElement('small', {
                    className: 'text-muted'
                }, `c/${this.community.name}`)
            ])
        ]);
    }

    /**
     * Render community description
     * @returns {HTMLElement|null} Description element
     */
    renderDescription() {
        if (!this.community.description) return null;

        const description = TextUtils.truncate(
            TextUtils.stripHTML(this.community.description),
            200
        );

        return DOM.createElement('p', {
            className: 'text-muted mb-2'
        }, description);
    }

    /**
     * Render community statistics
     * @returns {HTMLElement} Stats element
     */
    renderStats() {
        return DOM.createElement('div', {
            className: 'd-flex justify-content-between align-items-center'
        }, [
            DOM.createElement('div', {
                className: 'community-stats d-flex gap-3'
            }, [
                DOM.createElement('span', {
                    className: 'small text-muted'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-people me-1'
                    }),
                    `${APIUtils.formatNumber(this.community.stats.subscribers)} subscribers`
                ]),
                DOM.createElement('span', {
                    className: 'small text-muted'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-file-text me-1'
                    }),
                    `${APIUtils.formatNumber(this.community.stats.posts)} posts`
                ])
            ]),
            DOM.createElement('button', {
                className: 'btn btn-sm btn-outline-primary',
                'data-action': 'view-community'
            }, 'View Community')
        ]);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (!this.element) return;

        this.element.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'view-community') {
                e.preventDefault();
                this.handleViewCommunity();
            }
        });
    }

    /**
     * Handle view community action
     */
    handleViewCommunity() {
        DOM.showToast('Community pages coming soon!', 'info');
    }

    /**
     * Destroy the component
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.community = null;
        this.container = null;
    }
}

export default CommunityComponent; 