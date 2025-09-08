/**
 * Instance component for Lemmeric
 * Handles rendering and interactions for instances
 */

import { DOM } from '../utils.js';
import { CONFIG } from '../config.js';

export class InstanceComponent {
    constructor(instanceName, instanceData, container) {
        this.instanceName = instanceName;
        this.instanceData = instanceData;
        this.container = container;
        this.element = null;
        this.stats = null;
    }

    /**
     * Render the instance component
     * @returns {HTMLElement} Instance element
     */
    render() {
        this.element = DOM.createElement('div', {
            className: 'card instance-card mb-3',
            'data-instance': this.instanceName
        }, [
            DOM.createElement('div', {
                className: 'card-body'
            }, [
                this.renderHeader(),
                this.renderDescription(),
                this.renderStats(),
                this.renderActions()
            ])
        ]);

        this.attachEventListeners();
        return this.element;
    }

    /**
     * Render instance header
     * @returns {HTMLElement} Header element
     */
    renderHeader() {
        return DOM.createElement('div', {
            className: 'd-flex align-items-center mb-2'
        }, [
            DOM.createElement('div', {
                className: 'instance-icon me-3 bg-primary rounded-circle d-flex align-items-center justify-content-center',
                style: 'width: 48px; height: 48px;'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-globe text-white'
                })
            ]),
            DOM.createElement('div', {
                className: 'flex-grow-1'
            }, [
                DOM.createElement('h5', {
                    className: 'mb-1'
                }, this.instanceData.name),
                DOM.createElement('small', {
                    className: 'text-muted'
                }, this.instanceData.url.replace('https://', '').replace('http://', ''))
            ])
        ]);
    }

    /**
     * Render instance description
     * @returns {HTMLElement} Description element
     */
    renderDescription() {
        return DOM.createElement('p', {
            className: 'text-muted mb-2'
        }, this.instanceData.description || 'No description available');
    }

    /**
     * Render instance statistics
     * @returns {HTMLElement} Stats element
     */
    renderStats() {
        const statsContainer = DOM.createElement('div', {
            className: 'instance-stats mb-3'
        });

        if (this.stats) {
            statsContainer.appendChild(DOM.createElement('div', {
                className: 'row text-center'
            }, [
                DOM.createElement('div', {
                    className: 'col-3'
                }, [
                    DOM.createElement('div', {
                        className: 'fw-bold'
                    }, this.stats.users.toLocaleString()),
                    DOM.createElement('div', {
                        className: 'small text-muted'
                    }, 'Users')
                ]),
                DOM.createElement('div', {
                    className: 'col-3'
                }, [
                    DOM.createElement('div', {
                        className: 'fw-bold'
                    }, this.stats.posts.toLocaleString()),
                    DOM.createElement('div', {
                        className: 'small text-muted'
                    }, 'Posts')
                ]),
                DOM.createElement('div', {
                    className: 'col-3'
                }, [
                    DOM.createElement('div', {
                        className: 'fw-bold'
                    }, this.stats.comments.toLocaleString()),
                    DOM.createElement('div', {
                        className: 'small text-muted'
                    }, 'Comments')
                ]),
                DOM.createElement('div', {
                    className: 'col-3'
                }, [
                    DOM.createElement('div', {
                        className: 'fw-bold'
                    }, this.stats.communities.toLocaleString()),
                    DOM.createElement('div', {
                        className: 'small text-muted'
                    }, 'Communities')
                ])
            ]));
        } else {
            statsContainer.appendChild(DOM.createElement('div', {
                className: 'd-flex justify-content-center'
            }, [
                DOM.createElement('div', {
                    className: 'spinner-border spinner-border-sm me-2'
                }),
                DOM.createElement('span', {
                    className: 'text-muted'
                }, 'Loading stats...')
            ]));
        }

        return statsContainer;
    }

    /**
     * Render instance actions
     * @returns {HTMLElement} Actions element
     */
    renderActions() {
        return DOM.createElement('div', {
            className: 'd-flex gap-2'
        }, [
            DOM.createElement('button', {
                className: 'btn btn-sm btn-primary',
                'data-action': 'switch-instance'
            }, 'Switch to this instance'),
            DOM.createElement('a', {
                href: this.instanceData.url,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'btn btn-sm btn-outline-secondary'
            }, [
                'Visit Site ',
                DOM.createElement('i', {
                    className: 'bi bi-box-arrow-up-right'
                })
            ])
        ]);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (!this.element) return;

        this.element.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'switch-instance') {
                e.preventDefault();
                this.handleSwitchInstance();
            }
        });
    }

    /**
     * Handle switch instance action
     */
    handleSwitchInstance() {
        // Dispatch custom event for the main app to handle
        const event = new CustomEvent('switchInstance', {
            detail: { instanceName: this.instanceName }
        });
        document.dispatchEvent(event);
        
        DOM.showToast(`Switching to ${this.instanceData.name}...`, 'info');
    }

    /**
     * Update stats data
     * @param {Object} stats - Instance statistics
     */
    updateStats(stats) {
        this.stats = stats;
        
        // Re-render stats section
        const statsContainer = this.element.querySelector('.instance-stats');
        if (statsContainer) {
            const newStats = this.renderStats();
            statsContainer.parentNode.replaceChild(newStats, statsContainer);
        }
    }

    /**
     * Mark instance as current
     */
    markAsCurrent() {
        if (this.element) {
            this.element.classList.add('border-primary');
            
            const switchButton = this.element.querySelector('[data-action="switch-instance"]');
            if (switchButton) {
                switchButton.textContent = 'Current Instance';
                switchButton.classList.remove('btn-primary');
                switchButton.classList.add('btn-success');
                switchButton.disabled = true;
            }
        }
    }

    /**
     * Remove current instance marking
     */
    unmarkAsCurrent() {
        if (this.element) {
            this.element.classList.remove('border-primary');
            
            const switchButton = this.element.querySelector('[data-action="switch-instance"]');
            if (switchButton) {
                switchButton.textContent = 'Switch to this instance';
                switchButton.classList.remove('btn-success');
                switchButton.classList.add('btn-primary');
                switchButton.disabled = false;
            }
        }
    }

    /**
     * Destroy the component
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.instanceData = null;
        this.container = null;
    }
}

/**
 * Instance list manager for handling multiple instances
 */
export class InstanceListManager {
    constructor(container) {
        this.container = container;
        this.instances = new Map();
        this.currentInstanceName = null;
    }

    /**
     * Add instances to the list
     */
    addInstances() {
        const fragment = document.createDocumentFragment();

        Object.entries(CONFIG.INSTANCES).forEach(([instanceName, instanceData]) => {
            const instanceComponent = new InstanceComponent(instanceName, instanceData, this.container);
            const instanceElement = instanceComponent.render();
            
            this.instances.set(instanceName, instanceComponent);
            fragment.appendChild(instanceElement);
        });

        this.container.appendChild(fragment);
        
        // Load stats for each instance
        this.loadInstanceStats();
    }

    /**
     * Load statistics for all instances
     */
    async loadInstanceStats() {
        const promises = Array.from(this.instances.keys()).map(async (instanceName) => {
            try {
                const { LemmyAPI } = await import('../api.js');
                const api = new LemmyAPI(instanceName);
                const stats = await api.getInstanceStats();
                
                const instance = this.instances.get(instanceName);
                if (instance) {
                    instance.updateStats(stats);
                }
            } catch (error) {
                console.error(`Failed to load stats for ${instanceName}:`, error);
            }
        });

        await Promise.allSettled(promises);
    }

    /**
     * Set current instance
     * @param {string} instanceName - Current instance name
     */
    setCurrentInstance(instanceName) {
        // Unmark previous current instance
        if (this.currentInstanceName && this.instances.has(this.currentInstanceName)) {
            this.instances.get(this.currentInstanceName).unmarkAsCurrent();
        }

        // Mark new current instance
        this.currentInstanceName = instanceName;
        if (this.instances.has(instanceName)) {
            this.instances.get(instanceName).markAsCurrent();
        }
    }

    /**
     * Clear all instances
     */
    clearInstances() {
        this.instances.forEach(instance => instance.destroy());
        this.instances.clear();
        DOM.clearChildren(this.container);
    }

    /**
     * Destroy the instance list manager
     */
    destroy() {
        this.clearInstances();
        this.container = null;
    }
}

export default InstanceComponent; 