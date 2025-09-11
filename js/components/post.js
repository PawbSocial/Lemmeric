/**
 * Post component for Lemmeric
 * 
 * This module provides components for rendering and managing individual posts.
 * It handles post display, interactions, voting, and various post types including
 * text posts, image posts, and link posts with proper formatting and styling.
 * 
 * @fileoverview Post rendering and interaction components
 */

// Core utilities and API
import { DOM, TextUtils, URLUtils, AnimationUtils, PerformanceUtils } from '../utils.js';
import { APIUtils } from '../api.js';

/**
 * Post component class
 * 
 * Manages individual post rendering and interactions
 */
export class PostComponent {
    /**
     * Initialize the post component
     * @param {Object} postData - Raw post data from API
     * @param {HTMLElement} container - Container element for the post
     */
    constructor(postData, container) {
        // Core component data
        this.post = APIUtils.formatPost(postData);
        this.container = container;
        this.element = null;
    }

    // ========================================
    // RENDERING METHODS
    // ========================================

    /**
     * Render the post component
     * @returns {HTMLElement} Post element
     */
    render() {
        this.element = DOM.createElement('article', {
            className: 'card post-card',
            'data-post-id': this.post.id,
            'data-deleted': this.post.deleted || false,
            role: 'article'
        });

        this.element.appendChild(this.renderCardView());
        this.attachEventListeners();
        return this.element;
    }

    /**
     * Render card view layout
     * @returns {HTMLElement} Card content
     */
    renderCardView() {
        const isLargeImagesEnabled = document.body.classList.contains('large-images-enabled');
        const thumbnailMode = this.getThumbnailDisplayMode();
        
        // Check if this is an actual image post (URL points to an image)
        const isImagePost = this.post.url && URLUtils.isImageUrl(this.post.url);
        const isPictrsImagePost = !this.post.url && this.post.thumbnail && this.post.thumbnail.includes('/pictrs/');
        const isActualImagePost = isImagePost || isPictrsImagePost;
        
        // Determine if we should show the thumbnail as a large header image
        let shouldShowLargeImage = false;
        
        if (isActualImagePost) {
            // For actual image posts, always follow the Large Post Images toggle
            shouldShowLargeImage = isLargeImagesEnabled && !!this.post.thumbnail;
        } else {
            // For external link posts, follow the thumbnail dropdown setting
            shouldShowLargeImage = (thumbnailMode === 'match-media' && isLargeImagesEnabled && !!this.post.thumbnail);
        }
        
        if (shouldShowLargeImage) {
            // Large images mode: render with card header
            const cardContainer = DOM.createElement('div', { 
                className: isActualImagePost ? 'post-card-container image-post' : 'post-card-container'
            });
            
            // Add image as card header
            const cardHeader = this.renderCardHeader();
            if (cardHeader) {
                cardContainer.appendChild(cardHeader);
            }
            
            // Add card body with content (no thumbnail)
            const cardBody = DOM.createElement('div', {
                className: 'card-body'
            }, [
                this.renderHeader(),
                this.renderTitle(),
                this.renderContent(),
                this.renderActions()
            ]);
            
            cardContainer.appendChild(cardBody);
            return cardContainer;
        } else {
            // Default mode: original layout
            return DOM.createElement('div', {
                className: 'card-body'
            }, [
                this.renderHeader(),
                this.renderTitle(),
                this.renderContent(),
                this.renderThumbnail(),
                this.renderActions()
            ]);
        }
    }

    /**
     * Render card header with full-width image (for large images mode)
     * @returns {HTMLElement|null} Card header element
     */
    renderCardHeader() {
        // Don't show card headers for deleted posts
        if (this.post.deleted || !this.post.thumbnail) return null;

        return DOM.createElement('div', {
            className: 'post-card-header'
        }, [
            DOM.createElement('img', {
                src: this.post.thumbnail,
                className: 'post-card-header-image',
                alt: this.post.title,
                loading: 'lazy',
                'data-action': 'view-post',
                title: 'Click to view post',
                onerror: function() {
                    this.parentElement.style.display = 'none';
                }
            })
        ]);
    }

    /**
     * Render post header with community and author info
     * @returns {HTMLElement} Header element
     */
    renderHeader() {
        // Generate proper community URL for both local and remote communities
        let communityUrl = `/c/${this.post.community.name}`;
        
        // For remote/federated communities, include the instance domain
        if (!this.post.community.local && this.post.community.actor_id) {
            try {
                const actorUrl = new URL(this.post.community.actor_id);
                communityUrl = `/c/${this.post.community.name}@${actorUrl.hostname}`;
            } catch (e) {
                console.warn('Failed to parse community actor_id:', this.post.community.actor_id);
                // Fallback to local format if parsing fails
            }
        }
        
        return DOM.createElement('div', {
            className: 'post-header'
        }, [
            DOM.createElement('a', {
                href: communityUrl,
                className: 'post-community',
                'data-community': this.post.community.name,
                title: this.post.community.title || this.post.community.name
            }, [
                this.post.community.icon ? DOM.createElement('img', {
                    src: this.post.community.icon,
                    className: 'community-icon me-1',
                    style: 'width: 20px; height: 20px; border-radius: 50%;',
                    alt: ''
                }) : DOM.createElement('i', {
                    className: 'bi bi-people-fill me-1'
                }),
                DOM.createElement('span', {}, `c/${this.post.community.name}`)
            ]),
            DOM.createElement('span', {
                className: 'post-author text-muted'
            }, [
                'by ',
                DOM.createElement('a', {
                    href: this.generateUserUrl(this.post.author.name),
                    className: 'text-muted text-decoration-none',
                    'data-user': this.post.author.name,
                    title: `View profile: ${this.post.author.displayName || this.post.author.name}`
                }, this.post.author.displayName || this.post.author.name),
                ' • ',
                DOM.createElement('time', {
                    dateTime: this.post.published.toISOString(),
                    title: this.post.published.toLocaleString()
                }, APIUtils.formatTime(this.post.published))
            ])
        ]);
    }

    /**
     * Render post title
     * @returns {HTMLElement} Title element
     */
    renderTitle() {
        const titleElement = DOM.createElement('h5', {
            className: 'post-title'
        });

        // Always make the title clickable to open our modal
        const titleLink = DOM.createElement('a', {
            href: '#',
            className: 'post-title-link',
            'data-action': 'view-post',
            title: this.post.deleted ? 'View deleted post' : 'View post'
        }, this.post.title);

        titleElement.appendChild(titleLink);

        // Add post type indicators for posts with URLs
        if (this.post.url) {
            if (URLUtils.isImageUrl(this.post.url)) {
                // Special indicator for image posts
                titleElement.appendChild(DOM.createElement('i', {
                    className: 'bi bi-image ms-2 text-primary',
                    style: 'font-size: 0.9em;',
                    title: 'Image post'
                }));
            } else if (URLUtils.isVideoUrl(this.post.url)) {
                // Special indicator for video posts
                titleElement.appendChild(DOM.createElement('i', {
                    className: 'bi bi-camera-video ms-2 text-success',
                    style: 'font-size: 0.9em;',
                    title: 'Video post'
                }));
            } else if (URLUtils.isAudioUrl(this.post.url)) {
                // Special indicator for audio posts
                titleElement.appendChild(DOM.createElement('i', {
                    className: 'bi bi-music-note ms-2 text-info',
                    style: 'font-size: 0.9em;',
                    title: 'Audio post'
                }));
            } else if (URLUtils.isYouTubeUrl(this.post.url)) {
                // Special indicator for YouTube posts
                titleElement.appendChild(DOM.createElement('i', {
                    className: 'bi bi-youtube ms-2 text-danger',
                    style: 'font-size: 0.9em;',
                    title: 'YouTube video'
                }));
            } else {
                // Always use external link indicator for titles (brand icons are shown in meta info)
                titleElement.appendChild(DOM.createElement('i', {
                    className: 'bi bi-box-arrow-up-right ms-2 text-muted',
                    style: 'font-size: 0.8em;',
                    title: 'External link'
                }));
            }
        } else if (this.post.thumbnail && this.post.thumbnail.includes('/pictrs/')) {
            // Handle image-only posts (no URL but has pictrs image)
            titleElement.appendChild(DOM.createElement('i', {
                className: 'bi bi-image ms-2 text-primary',
                style: 'font-size: 0.9em;',
                title: 'Image post'
            }));
        }

        if (this.post.nsfw) {
            titleElement.appendChild(DOM.createElement('span', {
                className: 'badge bg-danger ms-2'
            }, 'NSFW'));
        }

        // Add deleted post indicator
        if (this.post.deleted) {
            titleElement.appendChild(DOM.createElement('span', {
                className: 'badge bg-danger ms-2 d-inline-flex align-items-center',
                style: 'font-size: 0.7rem;',
                title: 'This post has been deleted'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-trash me-1'
                }),
                'Deleted'
            ]));
        }

        return titleElement;
    }

    /**
     * Render post content/body
     * @returns {HTMLElement|null} Content element
     */
    renderContent() {
        // If post is deleted, show content with deleted indicator below
        if (this.post.deleted) {
            // Create content container with original content first
            const contentContainer = DOM.createElement('div', {});
            
            // Add original content first
            if (this.post.content) {
                const content = TextUtils.truncate(
                    TextUtils.stripHTML(this.post.content), 
                    300
                );
                
                if (content.trim()) {
                    contentContainer.appendChild(DOM.createElement('div', {
                        className: 'post-content text-muted'
                    }, [
                        DOM.createElement('p', {
                            className: 'mb-2'
                        }, content),
                        content !== this.post.content ? DOM.createElement('a', {
                            href: '#',
                            className: 'text-primary',
                            'data-action': 'view-post'
                        }, 'Read more...') : null
                    ].filter(Boolean)));
                }
            }
            
            // Add deleted indicator below content
            const deletedIndicator = DOM.createElement('div', {
                className: 'deleted-post-indicator mt-2 p-2 border rounded text-center',
                style: 'cursor: pointer;',
                title: 'Click to view post details'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-trash text-danger me-1'
                }),
                DOM.createElement('span', {
                    className: 'text-muted small'
                }, this.getDeletedByText()),
                DOM.createElement('div', {
                    className: 'mt-1'
                }, [
                    DOM.createElement('small', {
                        className: 'text-muted',
                        style: 'font-size: 0.65rem; opacity: 0.8;'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-arrow-right me-1'
                        }),
                        'Click to view details'
                    ])
                ])
            ]);
            
            contentContainer.appendChild(deletedIndicator);
            return contentContainer;
        }

        if (!this.post.content) return null;

        const content = TextUtils.truncate(
            TextUtils.stripHTML(this.post.content), 
            300
        );

        if (!content.trim()) return null;

        return DOM.createElement('div', {
            className: 'post-content text-muted'
        }, [
            DOM.createElement('p', {
                className: 'mb-2'
            }, content),
            content !== this.post.content ? DOM.createElement('a', {
                href: '#',
                className: 'text-primary',
                'data-action': 'view-post'
            }, 'Read more...') : null
        ].filter(Boolean));
    }

    /**
     * Get text indicating who deleted the post
     * @returns {string} Text describing who deleted the post
     */
    getDeletedByText() {
        // Check if we have information about who deleted the post
        if (this.post.deleted_by) {
            // If we have specific deleted_by info, use it
            if (this.post.deleted_by === this.post.author?.name) {
                return 'Post deleted by author';
            } else if (this.post.deleted_by === 'moderator') {
                return 'Post deleted by moderator';
            } else if (this.post.deleted_by === 'admin') {
                return 'Post deleted by admin';
            } else {
                return `Post deleted by ${this.post.deleted_by}`;
            }
        }
        
        // Default to author deletion (most common case)
        return 'Post deleted by author';
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Get the current thumbnail display mode
     * @returns {string} Thumbnail display mode: 'small', 'match-media', or 'none'
     */
    getThumbnailDisplayMode() {
        if (document.body.classList.contains('thumbnail-display-small')) return 'small';
        if (document.body.classList.contains('thumbnail-display-match-media')) return 'match-media';
        if (document.body.classList.contains('thumbnail-display-none')) return 'none';
        
        // Default to 'small' - but let's make sure the class is applied
        if (!document.body.classList.contains('thumbnail-display-small') && 
            !document.body.classList.contains('thumbnail-display-match-media') && 
            !document.body.classList.contains('thumbnail-display-none')) {
            // Apply default class
            document.body.classList.add('thumbnail-display-small');
        }
        
        return 'small'; // default
    }

    /**
     * Render post thumbnail
     * @returns {HTMLElement|null} Thumbnail element
     */
    renderThumbnail() {
        // Don't show thumbnails for deleted posts
        if (this.post.deleted || !this.post.thumbnail) return null;
        
        const thumbnailMode = this.getThumbnailDisplayMode();
        const isLargeImagesEnabled = document.body.classList.contains('large-images-enabled');
        
        // Check if this is an actual image post (URL points to an image)
        const isImagePost = this.post.url && URLUtils.isImageUrl(this.post.url);
        const isPictrsImagePost = !this.post.url && this.post.thumbnail && this.post.thumbnail.includes('/pictrs/');
        const isActualImagePost = isImagePost || isPictrsImagePost;
        
        if (isActualImagePost) {
            // For actual image posts, always show thumbnail when large images is OFF
            // When large images is ON, this won't be called because renderCardView() will use large header instead
            return DOM.createElement('div', {
                className: 'thumbnail-container'
            }, [
                DOM.createElement('img', {
                    src: this.post.thumbnail,
                    className: 'post-thumbnail image-post-thumbnail float-end ms-3',
                    alt: '',
                    loading: 'lazy',
                    onerror: function() {
                        this.style.display = 'none';
                    }
                })
            ]);
        } else {
            // For external link posts, follow the thumbnail dropdown setting
            if (thumbnailMode === 'none') return null;
            
            // If large images is enabled but we're set to small thumbnails, show small thumbnail
            // If large images is enabled and we're set to match-media, this won't be called (large header used instead)
            return DOM.createElement('div', {
                className: 'thumbnail-container'
            }, [
                DOM.createElement('img', {
                    src: this.post.thumbnail,
                    className: 'post-thumbnail external-link-thumbnail float-end ms-3',
                    alt: '',
                    loading: 'lazy',
                    onerror: function() {
                        this.style.display = 'none';
                    }
                })
            ]);
        }
    }

    /**
     * Render post actions (votes, comments, etc.)
     * @returns {HTMLElement} Actions element
     */
    renderActions() {
        const actionsContainer = DOM.createElement('div', {
            className: 'post-actions-container'
        });

        // If post is deleted, don't show actions (they're shown in content instead)
        if (this.post.deleted) {
            return actionsContainer;
        }

        // Main actions row
        const actionsRow = DOM.createElement('div', {
            className: 'post-actions'
        }, [
            this.renderVoteButtons(),
            this.renderCommentButton(),
            this.renderShareButton(),
            this.renderMetaInfo()
        ]);

        actionsContainer.appendChild(actionsRow);

        // Add vote ratio bar below the actions row
        const voteRatioBar = this.renderVoteRatioBar();
        if (voteRatioBar) {
            actionsContainer.appendChild(voteRatioBar);
        }

        return actionsContainer;
    }

    /**
     * Render voting buttons (without the ratio bar)
     * @returns {HTMLElement} Vote buttons element
     */
    renderVoteButtons() {
        // Determine initial button classes based on user's vote
        const upvoteClasses = ['vote-btn', 'upvote-btn'];
        const downvoteClasses = ['vote-btn', 'downvote-btn'];
        
        if (this.post.myVote === 1) {
            upvoteClasses.push('voted');
        } else if (this.post.myVote === -1) {
            downvoteClasses.push('voted');
        }

        return DOM.createElement('div', {
            className: 'vote-buttons'
        }, [
            DOM.createElement('button', {
                className: upvoteClasses.join(' '),
                'data-action': 'upvote',
                'aria-label': `Upvote post (${this.post.stats.upvotes} upvotes)`,
                title: this.post.myVote === 1 ? 'Remove upvote' : 'Upvote'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-arrow-up me-1'
                }),
                DOM.createElement('span', {
                    className: 'vote-count'
                }, APIUtils.formatNumber(this.post.stats.upvotes))
            ]),
            DOM.createElement('button', {
                className: downvoteClasses.join(' '),
                'data-action': 'downvote',
                'aria-label': `Downvote post (${this.post.stats.downvotes} downvotes)`,
                title: this.post.myVote === -1 ? 'Remove downvote' : 'Downvote'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-arrow-down me-1'
                }),
                DOM.createElement('span', {
                    className: 'vote-count'
                }, APIUtils.formatNumber(this.post.stats.downvotes))
            ])
        ]);
    }

    /**
     * Render vote ratio bar
     * @returns {HTMLElement|null} Vote ratio bar element
     */
    renderVoteRatioBar() {
        const totalVotes = this.post.stats.upvotes + this.post.stats.downvotes;
        if (totalVotes === 0) return null;

        const upvotePercentage = (this.post.stats.upvotes / totalVotes) * 100;
        const downvotePercentage = (this.post.stats.downvotes / totalVotes) * 100;
        
        return DOM.createElement('div', {
            className: 'vote-ratio-container mt-2 d-flex align-items-center'
        }, [
            DOM.createElement('div', {
                className: 'vote-ratio-bar',
                title: `${this.post.stats.upvotes} upvotes (${upvotePercentage.toFixed(1)}%) • ${this.post.stats.downvotes} downvotes (${downvotePercentage.toFixed(1)}%)`
            }, [
                DOM.createElement('div', {
                    className: 'upvote-bar',
                    style: `width: ${upvotePercentage}%`
                }),
                DOM.createElement('div', {
                    className: 'downvote-bar',
                    style: `width: ${downvotePercentage}%`
                })
            ]),
            DOM.createElement('span', {
                className: 'vote-percentage text-muted ms-2'
            }, `${upvotePercentage.toFixed(0)}%`)
        ]);
    }

    /**
     * Render comment button
     * @returns {HTMLElement} Comment button element
     */
    renderCommentButton() {
        return DOM.createElement('a', {
            href: '#',
            className: 'btn btn-sm btn-outline-secondary',
            'data-action': 'view-comments',
            'aria-label': `View ${this.post.stats.comments} comments`
        }, [
            DOM.createElement('i', {
                className: 'bi bi-chat me-1'
            }),
            DOM.createElement('span', {}, APIUtils.formatNumber(this.post.stats.comments))
        ]);
    }

    /**
     * Render share button
     * @returns {HTMLElement} Share button element
     */
    renderShareButton() {
        return DOM.createElement('button', {
            className: 'btn btn-sm btn-outline-secondary',
            'data-action': 'share',
            'aria-label': 'Share post',
            title: 'Share'
        }, [
            DOM.createElement('i', {
                className: 'bi bi-share'
            })
        ]);
    }

    /**
     * Render meta information
     * @returns {HTMLElement} Meta element
     */
    renderMeta() {
        const meta = DOM.createElement('div', {
            className: 'post-meta small text-muted'
        });

        if (this.post.url) {
            meta.appendChild(DOM.createElement('span', {}, [
                DOM.createElement('i', {
                    className: 'bi bi-link-45deg me-1'
                }),
                URLUtils.getDomain(this.post.url)
            ]));
        }

        return meta;
    }

    /**
     * Render meta info for actions row
     * @returns {HTMLElement} Meta info element
     */
    renderMetaInfo() {
        const metaInfo = DOM.createElement('div', {
            className: 'ms-auto text-muted small'
        });

        // Show appropriate post type information
        if (this.post.url) {
            // Check if it's an image URL (only the main URL, not thumbnail)
            if (URLUtils.isImageUrl(this.post.url)) {
                // Show "Image" for image posts
                metaInfo.appendChild(DOM.createElement('span', {
                    className: 'd-flex align-items-center',
                    title: 'Image post'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-image me-1'
                    }),
                    'Image'
                ]));
            } else if (URLUtils.isVideoUrl(this.post.url)) {
                // Show "Video" for video posts
                metaInfo.appendChild(DOM.createElement('span', {
                    className: 'd-flex align-items-center',
                    title: 'Video post'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-camera-video me-1'
                    }),
                    'Video'
                ]));
            } else if (URLUtils.isAudioUrl(this.post.url)) {
                // Show "Audio" for audio posts
                metaInfo.appendChild(DOM.createElement('span', {
                    className: 'd-flex align-items-center',
                    title: 'Audio post'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-music-note me-1'
                    }),
                    'Audio'
                ]));
            } else if (URLUtils.isYouTubeUrl(this.post.url)) {
                // Show "YouTube" for YouTube posts
                metaInfo.appendChild(DOM.createElement('span', {
                    className: 'd-flex align-items-center',
                    title: 'YouTube video'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-youtube me-1'
                    }),
                    'YouTube'
                ]));
            } else {
                // Only show external link if it's not a Lemmy instance URL
                const domain = URLUtils.getDomain(this.post.url);
                const isLemmyInstance = domain.includes('lemmy.') || domain.includes('kbin.') || domain.includes('fedia.');
                
                if (!isLemmyInstance) {
                    // Check for brand icon first
                    const brandIcon = URLUtils.getBrandIcon(this.post.url);
                    if (brandIcon) {
                        // Use brand-specific icon only (no domain text to avoid redundancy)
                        metaInfo.appendChild(DOM.createElement('span', {
                            className: 'd-flex align-items-center',
                            title: `${brandIcon.title} link`
                        }, [
                            DOM.createElement('i', {
                                className: `bi ${brandIcon.icon} me-1`
                            }),
                            brandIcon.title
                        ]));
                    } else {
                        // Fallback to regular link icon with domain (strip www. prefix)
                        const cleanDomain = domain.replace(/^www\./, '');
                        metaInfo.appendChild(DOM.createElement('span', {
                            className: 'd-flex align-items-center',
                            title: `External link to ${domain}`
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-link-45deg me-1'
                            }),
                            cleanDomain
                        ]));
                    }
                }
            }
        } else if (this.post.thumbnail && this.post.thumbnail.includes('/pictrs/')) {
            // Handle case where there's no URL but we have a pictrs image (image-only post)
            metaInfo.appendChild(DOM.createElement('span', {
                className: 'd-flex align-items-center',
                title: 'Image post'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-image me-1'
                }),
                'Image'
            ]));
        } else if (this.post.content) {
            // Show "Text" for text-only posts
            metaInfo.appendChild(DOM.createElement('span', {
                className: 'd-flex align-items-center',
                title: 'Text post'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-file-text me-1'
                }),
                'Text'
            ]));
        }

        return metaInfo;
    }

    // ========================================
    // EVENT HANDLING METHODS
    // ========================================

    /**
     * Attach event listeners to the post element
     */
    attachEventListeners() {
        if (!this.element) return;

        // For deleted posts, only allow viewing the post (not voting, sharing, etc.)
        if (this.post.deleted) {
            // Allow clicking on the deleted post indicator area and title
            this.element.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                const isDeletedIndicator = e.target.closest('.deleted-post-indicator');
                
                if (action === 'view-post' || isDeletedIndicator) {
                    e.preventDefault();
                    this.handleViewPost();
                }
            });
            return;
        }

        // Handle all click events through delegation
        this.element.addEventListener('click', (e) => {
            e.preventDefault();
            
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            switch (action) {
                case 'upvote':
                    this.handleVote('upvote');
                    break;
                case 'downvote':
                    this.handleVote('downvote');
                    break;
                case 'view-post':
                    this.handleViewPost();
                    break;
                case 'view-comments':
                    this.handleViewComments();
                    break;
                case 'share':
                    this.handleShare();
                    break;
            }
        });

        // Handle community and user links
        this.element.addEventListener('click', (e) => {
            const communityLink = e.target.closest('[data-community]');
            const userLink = e.target.closest('[data-user]');

            if (communityLink) {
                e.preventDefault();
                this.handleCommunityClick(communityLink.dataset.community);
            } else if (userLink) {
                e.preventDefault();
                this.handleUserClick(userLink.dataset.user);
            }
        });

        // Keyboard navigation
        this.element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                if (e.target.classList.contains('post-title-link')) {
                    e.preventDefault();
                    this.handleViewPost();
                }
            }
        });

        // Initialize vote button states
        this.updateVoteButtons();
    }

    /**
     * Handle voting actions
     * @param {string} voteType - 'upvote' or 'downvote'
     */
    async handleVote(voteType) {
        // Don't allow voting on deleted posts
        if (this.post.deleted) {
            this.showNotification('Cannot vote on deleted posts', 'warning');
            return;
        }

        // Import authManager and API at runtime to avoid circular dependencies
        const { authManager } = await import('../auth.js');
        const { LemmyAPI } = await import('../api.js');
        
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            this.showNotification('Please log in to vote', 'info');
            return;
        }

        try {
            const button = this.element.querySelector(`[data-action="${voteType}"]`);
            if (button) {
                button.classList.add('disabled');
            }

            // Determine vote score based on current vote state and action
            let newVoteScore;
            const currentVote = this.post.myVote || 0;
            
            if (voteType === 'upvote') {
                // If already upvoted, remove vote; otherwise upvote
                newVoteScore = currentVote === 1 ? 0 : 1;
            } else if (voteType === 'downvote') {
                // If already downvoted, remove vote; otherwise downvote
                newVoteScore = currentVote === -1 ? 0 : -1;
            }

            // Make API call to vote
            const api = new LemmyAPI();
            const voteResponse = await api.votePost(this.post.id, newVoteScore);
            
            if (voteResponse && voteResponse.post_view) {
                // Update post data with new vote information
                const updatedPost = voteResponse.post_view;
                this.post.myVote = updatedPost.my_vote || 0;
                this.post.stats.upvotes = updatedPost.counts?.upvotes || 0;
                this.post.stats.downvotes = updatedPost.counts?.downvotes || 0;
                this.post.stats.score = updatedPost.counts?.score || 0;
                
                // Update UI to reflect new vote state
                this.updateVoteButtons();
                this.updateVoteCounts();
                
                // Show success message only for vote removal
                if (newVoteScore === 0) {
                    this.showNotification('Vote removed', 'success');
                }
            }

        } catch (error) {
            console.error('Error voting on post:', error);
            this.showNotification('Failed to vote. Please try again.', 'error');
        } finally {
            // Re-enable buttons
            const button = this.element.querySelector(`[data-action="${voteType}"]`);
            if (button) {
                button.classList.remove('disabled');
            }
        }
    }

    /**
     * Handle view post action
     */
    async handleViewPost() {
        try {
            if (!this.post.id) {
                this.showNotification('Post ID is missing', 'error');
                return;
            }
            
            // Allow viewing deleted posts (they show deleted state on post page)
            // Navigate to clean URL (works with Python dev server and production)
            window.location.href = `/post/${this.post.id}`;
        } catch (error) {
            console.error('Failed to navigate to post:', error);
            this.showNotification('Failed to load post details', 'error');
        }
    }

    /**
     * Handle view comments action
     */
    async handleViewComments() {
        try {
            // Don't allow viewing comments on deleted posts
            if (this.post.deleted) {
                this.showNotification('Cannot view comments on deleted posts', 'warning');
                return;
            }

            // Navigate to clean URL with comments parameter
            window.location.href = `/post/${this.post.id}?comments=true`;
        } catch (error) {
            console.error('Failed to navigate to comments:', error);
            this.showNotification('Failed to load comments', 'error');
        }
    }

    /**
     * Handle share action
     */
    async handleShare() {
        try {
            // Don't allow sharing deleted posts
            if (this.post.deleted) {
                this.showNotification('Cannot share deleted posts', 'warning');
                return;
            }

            // Generate clean post URL using the current instance
            const postUrl = `${window.location.origin}/post/${this.post.id}`;
            
            const shareData = {
                title: this.post.title,
                url: postUrl,
                text: TextUtils.truncate(this.post.content || '', 100)
            };

            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(shareData.url);
                this.showNotification('Link copied to clipboard!', 'success');
            }
        } catch (error) {
            console.error('Share failed:', error);
            this.showNotification('Unable to share post', 'error');
        }
    }

    /**
     * Generate proper user URL for both local and remote users
     * @param {string} username - Username
     * @returns {string} User URL
     */
    generateUserUrl(username) {
        // Check if we have author instance information
        if (this.post.author && !this.post.author.local && this.post.author.actor_id) {
            try {
                const actorUrl = new URL(this.post.author.actor_id);
                return `/u/${username}@${actorUrl.hostname}`;
            } catch (e) {
                console.warn('Failed to parse user actor_id:', this.post.author.actor_id);
                // Fallback to local format if parsing fails
            }
        }
        
        // Default to local user format
        return `/u/${username}`;
    }

    /**
     * Handle community link click
     * @param {string} communityName - Community name
     */
    handleCommunityClick(communityName) {
        try {
            // Generate proper community URL for both local and remote communities
            let communityUrl = `/c/${communityName}`;
            
            // For remote/federated communities, include the instance domain
            if (!this.post.community.local && this.post.community.actor_id) {
                try {
                    const actorUrl = new URL(this.post.community.actor_id);
                    communityUrl = `/c/${communityName}@${actorUrl.hostname}`;
                } catch (e) {
                    console.warn('Failed to parse community actor_id:', this.post.community.actor_id);
                    // Fallback to local format if parsing fails
                }
            }
            
            // Navigate to community page
            window.location.href = communityUrl;
        } catch (error) {
            console.error('Failed to navigate to community:', error);
            this.showNotification('Failed to navigate to community', 'error');
        }
    }

    /**
     * Handle user link click
     * @param {string} username - Username
     */
    handleUserClick(username) {
        try {
            const userUrl = this.generateUserUrl(username);
            window.location.href = userUrl;
        } catch (error) {
            console.error('Failed to navigate to user:', error);
            this.showNotification('Failed to navigate to user profile', 'error');
        }
    }

    /**
     * Show notification message
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     */
    showNotification(message, type = 'info') {
        DOM.showToast(message, type);
    }

    /**
     * Update vote button states based on current vote
     */
    updateVoteButtons() {
        if (!this.element) return;

        const upvoteBtn = this.element.querySelector('[data-action="upvote"]');
        const downvoteBtn = this.element.querySelector('[data-action="downvote"]');
        
        // Remove existing vote state classes
        upvoteBtn?.classList.remove('voted');
        downvoteBtn?.classList.remove('voted');
        
        // Add appropriate classes based on current vote
        if (this.post.myVote === 1) {
            upvoteBtn?.classList.add('voted');
        } else if (this.post.myVote === -1) {
            downvoteBtn?.classList.add('voted');
        }
    }

    /**
     * Update vote count displays
     */
    updateVoteCounts() {
        if (!this.element) return;

        // Update individual vote counts in buttons
        const upvoteCount = this.element.querySelector('[data-action="upvote"] .vote-count');
        const downvoteCount = this.element.querySelector('[data-action="downvote"] .vote-count');
        
        if (upvoteCount) {
            upvoteCount.textContent = APIUtils.formatNumber(this.post.stats.upvotes);
        }
        if (downvoteCount) {
            downvoteCount.textContent = APIUtils.formatNumber(this.post.stats.downvotes);
        }

        // Update vote ratio bar if it exists
        this.updateVoteRatioBar();
    }

    /**
     * Update vote ratio bar
     */
    updateVoteRatioBar() {
        if (!this.element) return;

        const ratioBar = this.element.querySelector('.vote-ratio-bar');
        if (!ratioBar) return;

        const totalVotes = this.post.stats.upvotes + this.post.stats.downvotes;
        if (totalVotes === 0) {
            ratioBar.style.display = 'none';
            return;
        }

        ratioBar.style.display = 'flex';
        const upvotePercentage = (this.post.stats.upvotes / totalVotes) * 100;
        
        const upvoteBar = ratioBar.querySelector('.upvote-bar');
        const downvoteBar = ratioBar.querySelector('.downvote-bar');
        
        if (upvoteBar) upvoteBar.style.width = `${upvotePercentage}%`;
        if (downvoteBar) downvoteBar.style.width = `${100 - upvotePercentage}%`;
    }

    /**
     * Update the post data and re-render if needed
     * @param {Object} newPostData - Updated post data
     */
    update(newPostData) {
        this.post = APIUtils.formatPost(newPostData);
        
        if (this.element) {
            // Update vote counts and states
            this.updateVoteButtons();
            this.updateVoteCounts();

            // Update comment count
            const commentButton = this.element.querySelector('[data-action="view-comments"] span');
            if (commentButton) {
                commentButton.textContent = APIUtils.formatNumber(this.post.stats.comments);
            }
        }
    }

    /**
     * Destroy the component and clean up
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.post = null;
        this.container = null;
    }
}

/**
 * Post list manager for handling multiple posts
 */
export class PostListManager {
    constructor(container) {
        this.container = container;
        this.posts = new Map();
        this.observer = null;
        this.setupIntersectionObserver();
    }

    /**
     * Setup intersection observer for lazy loading
     */
    setupIntersectionObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const postElement = entry.target;
                    const postId = postElement.dataset.postId;
                    
                    // Mark post as viewed
                    this.markAsViewed(postId);
                }
            });
        }, {
            threshold: 0.5,
            rootMargin: '0px 0px -50px 0px'
        });
    }

    /**
     * Add posts to the list
     * @param {Array} postsData - Array of post data
     */
    addPosts(postsData) {
        const fragment = document.createDocumentFragment();

        postsData.forEach(postData => {
            const postComponent = new PostComponent(postData, this.container);
            const postElement = postComponent.render();
            
            this.posts.set(postData.post.id, postComponent);
            fragment.appendChild(postElement);
            
            // Observe for viewport intersection
            this.observer.observe(postElement);
            
            // Add fade-in animation
            AnimationUtils.fadeIn(postElement);
        });

        this.container.appendChild(fragment);
    }

    /**
     * Clear all posts
     */
    clearPosts() {
        this.posts.forEach(post => {
            this.observer.unobserve(post.element);
            post.destroy();
        });
        this.posts.clear();
        DOM.clearChildren(this.container);
    }

    /**
     * Mark post as viewed
     * @param {string} postId - Post ID
     */
    markAsViewed(postId) {
        const post = this.posts.get(parseInt(postId));
        if (post && post.element) {
            post.element.classList.add('viewed');
        }
    }

    /**
     * Destroy the post list manager
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.clearPosts();
        this.container = null;
    }
}

export default PostComponent; 