/**
 * Post Detail component for Lemmeric
 * Handles rendering detailed post view with comments
 */

import { DOM, TextUtils, URLUtils, AnimationUtils, PerformanceUtils } from '../utils.js';
import { LemmyAPI, APIUtils } from '../api.js';
import { getCurrentInstance } from '../config.js';
import { processPostContent, processCommentContent } from '../markdown-it-setup.js';
import { authManager } from '../auth.js';

// Import bootstrap for modal functionality
let bootstrap;
if (typeof window !== 'undefined') {
    bootstrap = window.bootstrap;
}

export class PostDetailComponent {
    constructor(postData) {
        this.post = APIUtils.formatPost(postData);
        this.api = new LemmyAPI();
        this.element = null;
        this.comments = [];
        this.formattedComments = [];
        this.communityModerators = [];
        this.instanceAdmins = [];
        this.communityId = null;
        this.isLoadingComments = false;
        this.currentCommentSort = 'Top'; // Track current comment sort order

        // Bind event handlers
        this.handleCommentActions = this.handleCommentActions.bind(this);
        this.handlePostActions = this.handlePostActions.bind(this);
    }

    /**
     * Render the detailed post view
     * @returns {HTMLElement} Post detail element
     */
    async render() {
        this.element = DOM.createElement('div', {
            className: 'post-detail'
        }, [
            this.renderPostHeader(),
            this.renderPostContent(),
            this.renderPostActions(),
            DOM.createElement('hr', { className: 'my-4' }),
            this.renderCrosspostSection(),
            this.renderCommentsSection()
        ].filter(Boolean));

        // Load comments with default sort
        this.loadComments();

        // Add event delegation for comment actions
        this.element.addEventListener('click', this.handleCommentActions);

        // Add event delegation for post actions
        this.element.addEventListener('click', this.handlePostActions);

        // Add event listener for comment sort dropdown
        const sortDropdown = this.element.querySelector('#comment-sort');
        if (sortDropdown) {
            sortDropdown.addEventListener('change', this.handleCommentSortChange.bind(this));
        }

        // Add event listeners for comment form
        this.setupCommentFormEventListeners();

        return this.element;
    }

    /**
     * Render post header with full details
     * @returns {HTMLElement} Header element
     */
    renderPostHeader() {
        // Generate proper community URL for both local and remote communities
        let communityUrl = `/c/${this.post.community.name}`;
        
        // For remote/federated communities, include the instance domain
        if (!this.post.community.local && this.post.community.actor_id) {
            try {
                const actorUrl = new URL(this.post.community.actor_id);
                communityUrl = `/c/${this.post.community.name}@${actorUrl.hostname}`;
            } catch (e) {
                // Fallback to local format
            }
        }

        // Check for crosspost status for header badge
        const crosspostMatch = this.post.content?.match(/cross[- ]?posted from:\s*(https?:\/\/([^\/\s]+))/i);
        const isCrosspost = (this.post.crossPosts && this.post.crossPosts.length > 0) || crosspostMatch;

        return DOM.createElement('div', {
            className: 'post-detail-header mb-3'
        }, [
            DOM.createElement('div', {
                className: 'd-flex align-items-center mb-2'
            }, [
                this.post.community.icon ? DOM.createElement('img', {
                    src: this.post.community.icon,
                    className: 'community-icon me-2',
                    style: 'width: 32px; height: 32px; border-radius: 50%;',
                    alt: ''
                }) : DOM.createElement('i', {
                    className: 'bi bi-people-fill me-2 text-primary'
                }),
                DOM.createElement('div', {
                    className: 'flex-grow-1'
                }, [
                    DOM.createElement('h6', {
                        className: 'mb-0'
                    }, [
                        DOM.createElement('a', {
                            href: communityUrl,
                            className: 'text-primary text-decoration-none',
                            'data-community': this.post.community.name,
                            onclick: (e) => {
                                e.preventDefault();
                                window.location.href = communityUrl;
                            }
                        }, `c/${this.post.community.name}`)
                    ]),
                    DOM.createElement('small', {
                        className: 'text-muted'
                    }, this.post.community.title || this.post.community.name)
                ])
            ]),
            DOM.createElement('h4', {
                className: 'post-title mb-2'
            }, this.post.title),
            DOM.createElement('div', {
                className: 'post-meta d-flex align-items-center gap-3 text-muted small'
            }, [
                DOM.createElement('span', {}, [
                    'by ',
                    this.renderPostAuthor()
                ]),
                DOM.createElement('time', {
                    dateTime: this.post.published.toISOString(),
                    title: this.post.published.toLocaleString()
                }, APIUtils.formatTime(this.post.published)),
                // Add crosspost badge if this post is crossposted
                isCrosspost ? DOM.createElement('span', {
                    className: 'badge bg-info',
                    style: 'font-size: 0.7rem;',
                    title: 'This post has been cross-posted from another community'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-arrow-repeat me-1'
                    }),
                    'Crosspost'
                ]) : null,
                this.post.nsfw ? DOM.createElement('span', {
                    className: 'badge bg-danger'
                }, 'NSFW') : null
            ].filter(Boolean))
        ]);
    }

    /**
     * Render full post content
     * @returns {HTMLElement} Content element
     */
    renderPostContent() {
        const contentContainer = DOM.createElement('div', {
            className: 'post-detail-content mb-3'
        });

        // Check for crosspost information in post content
        const crosspostMatch = this.post.content?.match(/cross[- ]?posted from:\s*(https?:\/\/([^\/\s]+))/i);
        const isCrosspost = (this.post.crossPosts && this.post.crossPosts.length > 0) || crosspostMatch;

        // Check if this is a YouTube video first (prioritize over image detection)
        const isYouTubeVideo = this.post.url && URLUtils.isYouTubeUrl(this.post.url);
        
        // Check if this is a direct video file (MP4, WebM, etc.)
        const isDirectVideo = this.post.url && URLUtils.isVideoUrl(this.post.url);
        
        // Check if this is a direct audio file (MP3, WAV, etc.)
        const isDirectAudio = this.post.url && URLUtils.isAudioUrl(this.post.url);
        
        // Determine if this is an image post (but not if it's a YouTube video, direct video, or direct audio)
        let imageUrl = null;
        let isImagePost = false;
        
        if (!isYouTubeVideo && !isDirectVideo && !isDirectAudio) {
            // Only treat as image post if the main URL is an image, or if there's no URL but we have an image thumbnail from pictrs
            if (this.post.url && URLUtils.isImageUrl(this.post.url)) {
                imageUrl = this.post.url;
                isImagePost = true;
            } else if (!this.post.url && this.post.thumbnail && this.post.thumbnail.includes('/pictrs/')) {
                // Only use thumbnail as the main image if there's no URL and it's from pictrs (internal image hosting)
                imageUrl = this.post.thumbnail;
                isImagePost = true;
            }
        }

        // If this appears to be an image post, render the image
        if (isImagePost && imageUrl) {
            contentContainer.appendChild(DOM.createElement('div', {
                className: 'post-image-container mb-3'
            }, [
                DOM.createElement('img', {
                    src: imageUrl,
                    className: 'post-image img-fluid rounded',
                    alt: this.post.title,
                    loading: 'lazy',
                    style: 'max-width: 100%; height: auto; cursor: pointer;',
                    onclick: () => {
                        // Open image in new tab when clicked
                        window.open(imageUrl, '_blank', 'noopener,noreferrer');
                    },
                    onerror: (event) => {
                        // Fallback to external link preview if image fails to load
                        const img = event.target;
                        const container = img.parentElement;
                        const contentContainer = container.parentElement;
                        
                        // Hide the image container
                        container.style.display = 'none';
                        
                        // Create fallback external link preview
                        const fallbackContainer = DOM.createElement('div', {
                            className: 'external-link-container mb-3 p-3 rounded'
                        }, [
                            DOM.createElement('div', {
                                className: 'row align-items-center'
                            }, [
                                DOM.createElement('div', {
                                    className: 'col'
                                }, [
                                    DOM.createElement('h6', {
                                        className: 'mb-1'
                                    }, [
                                        DOM.createElement('a', {
                                            href: imageUrl,
                                            target: '_blank',
                                            rel: 'noopener noreferrer',
                                            className: 'text-decoration-none'
                                        }, [
                                            'Failed to load image - View original',
                                            DOM.createElement('i', {
                                                className: 'bi bi-box-arrow-up-right ms-2'
                                            })
                                        ])
                                    ]),
                                    DOM.createElement('small', {
                                        className: 'text-muted'
                                    }, URLUtils.getDomain(imageUrl).replace(/^www\./, ''))
                                ])
                            ])
                        ]);
                        
                        contentContainer.appendChild(fallbackContainer);
                    }
                }),
                DOM.createElement('div', {
                    className: 'image-source mt-2 text-center'
                }, [
                    DOM.createElement('small', {
                        className: 'text-muted'
                    }, [
                        isCrosspost ? 'Crossposted from: ' : 'Source: ',
                        DOM.createElement('a', {
                            href: isCrosspost && crosspostMatch ? crosspostMatch[1] : (this.post.url || imageUrl),
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            className: 'text-muted'
                        }, isCrosspost && crosspostMatch ? crosspostMatch[2] : URLUtils.getDomain(this.post.url || imageUrl).replace(/^www\./, ''))
                    ])
                ])
            ]));
        } else if (isYouTubeVideo) {
            // Render YouTube video embed
            let embedUrl = null;
            
            // Use embed_video_url from API if available, otherwise generate from URL
            if (this.post.embedVideoUrl) {
                embedUrl = this.post.embedVideoUrl;
            } else {
                embedUrl = URLUtils.getYouTubeEmbedUrl(this.post.url);
            }
            
            if (embedUrl) {
                contentContainer.appendChild(DOM.createElement('div', {
                    className: 'youtube-video-container mb-4'
                }, [
                    DOM.createElement('div', {
                        className: 'ratio ratio-16x9 mb-3'
                    }, [
                        DOM.createElement('iframe', {
                            src: embedUrl,
                            title: this.post.embedTitle || this.post.title,
                            frameborder: '0',
                            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                            allowfullscreen: 'true',
                            loading: 'lazy',
                            className: 'rounded'
                        })
                    ]),
                    DOM.createElement('div', {
                        className: 'video-info d-flex align-items-center justify-content-between'
                    }, [
                        DOM.createElement('div', {
                            className: 'video-details'
                        }, [
                            this.post.embedTitle ? DOM.createElement('h6', {
                                className: 'mb-1 fw-bold'
                            }, this.post.embedTitle) : null,
                            this.post.embedDescription ? DOM.createElement('p', {
                                className: 'mb-1 text-muted small'
                            }, this.post.embedDescription.length > 200 ? 
                               this.post.embedDescription.substring(0, 200) + '...' : 
                               this.post.embedDescription) : null,
                            DOM.createElement('small', {
                                className: 'text-muted'
                            }, [
                                DOM.createElement('i', {
                                    className: 'bi bi-youtube me-1'
                                }),
                                'YouTube'
                            ])
                        ].filter(Boolean)),
                        DOM.createElement('a', {
                            href: this.post.url,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            className: 'btn btn-outline-primary btn-sm',
                            title: 'Watch on YouTube'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-box-arrow-up-right me-1'
                            }),
                            'YouTube'
                        ])
                    ])
                ]));
            }
        } else if (isDirectVideo) {
            // Render direct video file embed
            contentContainer.appendChild(DOM.createElement('div', {
                className: 'direct-video-container mb-4'
            }, [
                DOM.createElement('div', {
                    className: 'ratio ratio-16x9 mb-3'
                }, [
                    DOM.createElement('video', {
                        src: this.post.url,
                        controls: 'true',
                        preload: 'metadata',
                        className: 'w-100 h-100 rounded',
                        style: 'background: #000;',
                        onerror: (event) => {
                            // Fallback to external link preview if video fails to load
                            const video = event.target;
                            const container = video.parentElement;
                            const contentContainer = container.parentElement;
                            
                            // Hide the video container
                            container.style.display = 'none';
                            
                            // Create fallback external link preview
                            const fallbackContainer = DOM.createElement('div', {
                                className: 'external-link-container mb-3 p-3 rounded'
                            }, [
                                DOM.createElement('div', {
                                    className: 'row align-items-center'
                                }, [
                                    DOM.createElement('div', {
                                        className: 'col'
                                    }, [
                                        DOM.createElement('h6', {
                                            className: 'mb-1'
                                        }, [
                                            DOM.createElement('a', {
                                                href: this.post.url,
                                                target: '_blank',
                                                rel: 'noopener noreferrer',
                                                className: 'text-decoration-none'
                                            }, [
                                                'Failed to load video - View original',
                                                DOM.createElement('i', {
                                                    className: 'bi bi-box-arrow-up-right ms-2'
                                                })
                                            ])
                                        ]),
                                        DOM.createElement('small', {
                                            className: 'text-muted'
                                        }, URLUtils.getDomain(this.post.url).replace(/^www\./, ''))
                                    ])
                                ])
                            ]);
                            
                            contentContainer.appendChild(fallbackContainer);
                        }
                    })
                ]),
                DOM.createElement('div', {
                    className: 'video-info d-flex align-items-center justify-content-between'
                }, [
                    DOM.createElement('div', {
                        className: 'video-details'
                    }, [
                        this.post.title ? DOM.createElement('h6', {
                            className: 'mb-1 fw-bold'
                        }, this.post.title) : null,
                        DOM.createElement('small', {
                            className: 'text-muted'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-camera-video me-1'
                            }),
                            'Video file'
                        ])
                    ].filter(Boolean)),
                    DOM.createElement('a', {
                        href: this.post.url,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        className: 'btn btn-outline-primary btn-sm',
                        title: 'Download/View video'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-download me-1'
                        }),
                        'Download'
                    ])
                ])
            ]));
        } else if (isDirectAudio) {
            // Render direct audio file embed
            contentContainer.appendChild(DOM.createElement('div', {
                className: 'direct-audio-container mb-4'
            }, [
                DOM.createElement('div', {
                    className: 'audio-player-container p-3'
                }, [
                    DOM.createElement('audio', {
                        src: this.post.url,
                        controls: 'true',
                        preload: 'metadata',
                        className: 'w-100',
                        style: 'max-width: 100%;',
                        onerror: (event) => {
                            // Fallback to external link preview if audio fails to load
                            const audio = event.target;
                            const container = audio.parentElement;
                            const contentContainer = container.parentElement;
                            
                            // Hide the audio container
                            container.style.display = 'none';
                            
                            // Create fallback external link preview
                            const fallbackContainer = DOM.createElement('div', {
                                className: 'external-link-container mb-3 p-3 rounded'
                            }, [
                                DOM.createElement('div', {
                                    className: 'row align-items-center'
                                }, [
                                    DOM.createElement('div', {
                                        className: 'col'
                                    }, [
                                        DOM.createElement('h6', {
                                            className: 'mb-1'
                                        }, [
                                            DOM.createElement('a', {
                                                href: this.post.url,
                                                target: '_blank',
                                                rel: 'noopener noreferrer',
                                                className: 'text-decoration-none'
                                            }, [
                                                'Failed to load audio - View original',
                                                DOM.createElement('i', {
                                                    className: 'bi bi-box-arrow-up-right ms-2'
                                                })
                                            ])
                                        ]),
                                        DOM.createElement('small', {
                                            className: 'text-muted'
                                        }, URLUtils.getDomain(this.post.url).replace(/^www\./, ''))
                                    ])
                                ])
                            ]);
                            
                            contentContainer.appendChild(fallbackContainer);
                        }
                    })
                ]),
                DOM.createElement('div', {
                    className: 'audio-info d-flex align-items-center justify-content-between'
                }, [
                    DOM.createElement('div', {
                        className: 'audio-details'
                    }, [
                        this.post.title ? DOM.createElement('h6', {
                            className: 'mb-1 fw-bold'
                        }, this.post.title) : null,
                        DOM.createElement('small', {
                            className: 'text-muted'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-music-note me-1'
                            }),
                            'Audio file'
                        ])
                    ].filter(Boolean)),
                    DOM.createElement('a', {
                        href: this.post.url,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        className: 'btn btn-outline-primary btn-sm',
                        title: 'Download/Listen to audio'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-download me-1'
                        }),
                        'Download'
                    ])
                ])
            ]));
        } else if (this.post.url && this.post.embedTitle) {
            // Display embedded content for external URLs - prioritize this over crosspost detection
            const domain = URLUtils.getDomain(this.post.url);
            
            contentContainer.appendChild(DOM.createElement('div', {
                className: 'embedded-content-container mb-4 p-3 border rounded'
            }, [
                DOM.createElement('div', {
                    className: 'row align-items-center'
                }, [
                    this.post.thumbnail ? DOM.createElement('div', {
                        className: 'col-auto'
                    }, [
                        DOM.createElement('img', {
                            src: this.post.thumbnail,
                            className: 'rounded shadow-sm',
                            style: 'width: 150px; height: 100px; object-fit: cover;',
                            alt: '',
                            loading: 'lazy'
                        })
                    ]) : null,
                    DOM.createElement('div', {
                        className: 'col'
                    }, [
                        DOM.createElement('div', {
                            className: 'embedded-content-header d-flex align-items-start justify-content-between mb-2'
                        }, [
                            DOM.createElement('div', {
                                className: 'flex-grow-1'
                            }, [
                                DOM.createElement('h5', {
                                    className: 'embedded-title mb-1 fw-bold'
                                }, [
                                    DOM.createElement('a', {
                                        href: this.post.url,
                                        target: '_blank',
                                        rel: 'noopener noreferrer',
                                        className: 'text-decoration-none'
                                    }, this.post.embedTitle)
                                ]),
                                DOM.createElement('div', {
                                    className: 'embedded-source d-flex align-items-center mb-2'
                                }, [
                                    (() => {
                                        // Check for brand icon first
                                        const brandIcon = URLUtils.getBrandIcon(this.post.url);
                                        if (brandIcon) {
                                            return DOM.createElement('i', {
                                                className: `bi ${brandIcon.icon} me-1`
                                            });
                                        } else {
                                            return DOM.createElement('i', {
                                                className: 'bi bi-link-45deg me-1'
                                            });
                                        }
                                    })(),
                                    DOM.createElement('small', {
                                        className: 'text-muted fw-medium'
                                    }, domain.replace(/^www\./, ''))
                                ])
                            ]),
                            DOM.createElement('a', {
                                href: this.post.url,
                                target: '_blank',
                                rel: 'noopener noreferrer',
                                className: 'btn btn-outline-primary btn-sm flex-shrink-0 ms-2',
                                title: 'Visit external site'
                            }, [
                                DOM.createElement('i', {
                                    className: 'bi bi-box-arrow-up-right me-1'
                                }),
                                'Visit'
                            ])
                        ]),
                        this.post.embedDescription ? DOM.createElement('p', {
                            className: 'embedded-description mb-0 text-muted'
                        }, this.post.embedDescription) : null
                    ])
                ].filter(Boolean))
            ]));
        } else if (this.post.url && !isCrosspost) {
            // Always show external link preview for non-crosspost URLs that don't have other special handling
            const domain = URLUtils.getDomain(this.post.url);
            const isLemmyInstance = domain.includes('lemmy.') || domain.includes('kbin.') || domain.includes('fedia.');
            
            if (!isLemmyInstance) {
                // Regular external link preview
                contentContainer.appendChild(DOM.createElement('div', {
                    className: 'external-link-container mb-3 p-3 rounded'
                }, [
                    DOM.createElement('div', {
                        className: 'row align-items-center'
                    }, [
                        this.post.thumbnail ? DOM.createElement('div', {
                            className: 'col-auto'
                        }, [
                            DOM.createElement('img', {
                                src: this.post.thumbnail,
                                className: 'rounded',
                                style: 'width: 120px; height: 80px; object-fit: cover;',
                                alt: '',
                                loading: 'lazy'
                            })
                        ]) : null,
                        DOM.createElement('div', {
                            className: 'col'
                        }, [
                            DOM.createElement('h6', {
                                className: 'mb-1'
                            }, [
                                DOM.createElement('a', {
                                    href: this.post.url,
                                    target: '_blank',
                                    rel: 'noopener noreferrer',
                                    className: 'text-decoration-none'
                                }, [
                                    this.post.title,
                                    DOM.createElement('i', {
                                        className: 'bi bi-box-arrow-up-right ms-2'
                                    })
                                ])
                            ]),
                            DOM.createElement('small', {
                                className: 'text-muted'
                            }, URLUtils.getDomain(this.post.url).replace(/^www\./, ''))
                        ])
                    ].filter(Boolean))
                ]));
            }
        } else if (this.post.url && isCrosspost) {
            // For crossposts with URLs, still show a clickable link even if no preview
            const domain = URLUtils.getDomain(this.post.url);
            const isLemmyInstance = domain.includes('lemmy.') || domain.includes('kbin.') || domain.includes('fedia.');
            
            if (!isLemmyInstance) {
                // Show crosspost link preview
                contentContainer.appendChild(DOM.createElement('div', {
                    className: 'external-link-container mb-3 p-3 rounded'
                }, [
                    DOM.createElement('div', {
                        className: 'row align-items-center'
                    }, [
                        this.post.thumbnail ? DOM.createElement('div', {
                            className: 'col-auto'
                        }, [
                            DOM.createElement('img', {
                                src: this.post.thumbnail,
                                className: 'rounded',
                                style: 'width: 120px; height: 80px; object-fit: cover;',
                                alt: '',
                                loading: 'lazy'
                            })
                        ]) : null,
                        DOM.createElement('div', {
                            className: 'col'
                        }, [
                            DOM.createElement('h6', {
                                className: 'mb-1'
                            }, [
                                DOM.createElement('i', {
                                    className: 'bi bi-arrow-repeat me-2'
                                }),
                                'Crosspost with external link: ',
                                DOM.createElement('a', {
                                    href: this.post.url,
                                    target: '_blank',
                                    rel: 'noopener noreferrer',
                                    className: 'text-decoration-none'
                                }, [
                                    this.post.title,
                                    DOM.createElement('i', {
                                        className: 'bi bi-box-arrow-up-right ms-2'
                                    })
                                ])
                            ]),
                            DOM.createElement('small', {
                                className: 'text-muted'
                            }, URLUtils.getDomain(this.post.url).replace(/^www\./, ''))
                        ])
                    ].filter(Boolean))
                ]));
            }
        } else if (isCrosspost && crosspostMatch) {
            // Show crosspost information for crossposts without images or embedded content
            contentContainer.appendChild(DOM.createElement('div', {
                className: 'external-link-container mb-3 p-3 rounded'
            }, [
                DOM.createElement('div', {
                    className: 'row align-items-center'
                }, [
                    this.post.thumbnail ? DOM.createElement('div', {
                        className: 'col-auto'
                    }, [
                        DOM.createElement('img', {
                            src: this.post.thumbnail,
                            className: 'rounded',
                            style: 'width: 120px; height: 80px; object-fit: cover;',
                            alt: '',
                            loading: 'lazy'
                        })
                    ]) : null,
                    DOM.createElement('div', {
                        className: 'col'
                    }, [
                        DOM.createElement('h6', {
                            className: 'mb-1'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-arrow-repeat me-2'
                            }),
                            'Crosspost from ',
                            DOM.createElement('a', {
                                href: crosspostMatch[1],
                                target: '_blank',
                                rel: 'noopener noreferrer',
                                className: 'text-decoration-none'
                            }, crosspostMatch[2])
                        ]),
                        DOM.createElement('small', {
                            className: 'text-muted'
                        }, 'View original post')
                    ])
                ].filter(Boolean))
            ]));
        }

        // Post body content - clearly separated from embedded content
        if (this.post.content && this.post.content.trim()) {
            const processedContent = this.processPostContent(this.post.content);
            const postBodyElement = DOM.createElement('div', {
                className: 'post-body'
            });
            
            // Add a visual separator between embedded content and post body if both exist
            if (this.post.url && this.post.embedTitle && this.post.content.trim()) {
                const separator = DOM.createElement('hr', {
                    className: 'my-3',
                    style: 'border-top: 2px solid var(--bs-gray-300);'
                });
                contentContainer.appendChild(separator);
                
                // Add a subtle header for the post body
                const postBodyHeader = DOM.createElement('div', {
                    className: 'post-body-header mb-2'
                }, [
                    DOM.createElement('small', {
                        className: 'text-muted fw-medium'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-chat-text me-1'
                        }),
                        'Post Content'
                    ])
                ]);
                contentContainer.appendChild(postBodyHeader);
            }
            
            postBodyElement.innerHTML = processedContent;
            contentContainer.appendChild(postBodyElement);
        }

        // If post is deleted, show deleted indicator below content
        if (this.post.deleted) {
            contentContainer.appendChild(DOM.createElement('div', {
                className: 'deleted-post-indicator mt-3 p-3 border rounded text-center',
                style: 'cursor: pointer;',
                title: 'Post has been deleted by the author'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-trash text-danger me-2'
                }),
                DOM.createElement('span', {
                    className: 'text-muted'
                }, 'This post has been deleted by the author')
            ]));
        }

        // Final fallback: if there's a URL that wasn't handled by any of the above logic,
        // ensure it's always clickable
        if (this.post.url && !contentContainer.querySelector(`a[href="${this.post.url}"]`)) {
            contentContainer.appendChild(DOM.createElement('div', {
                className: 'external-link-fallback mt-3 p-3 border rounded'
            }, [
                DOM.createElement('div', {
                    className: 'd-flex align-items-center justify-content-between'
                }, [
                    DOM.createElement('div', {
                        className: 'flex-grow-1'
                    }, [
                        DOM.createElement('h6', {
                            className: 'mb-1'
                        }, [
                            DOM.createElement('a', {
                                href: this.post.url,
                                target: '_blank',
                                rel: 'noopener noreferrer',
                                className: 'text-decoration-none'
                            }, [
                                this.post.title || 'External Link',
                                DOM.createElement('i', {
                                    className: 'bi bi-box-arrow-up-right ms-2'
                                })
                            ])
                        ]),
                        DOM.createElement('small', {
                            className: 'text-muted'
                        }, URLUtils.getDomain(this.post.url).replace(/^www\./, ''))
                    ]),
                    DOM.createElement('a', {
                        href: this.post.url,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        className: 'btn btn-outline-primary btn-sm',
                        title: 'Visit external site'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-box-arrow-up-right me-1'
                        }),
                        'Visit'
                    ])
                ])
            ]));
        }

        return contentContainer;
    }

    /**
     * Process post content for display
     * @param {string} content - Raw post content
     * @returns {string} Processed HTML content
     */
    processPostContent(content) {
        // Use the centralized markdown processor
        return processPostContent(content);
    }

    /**
     * Render post actions
     * @returns {HTMLElement} Actions element
     */
    renderPostActions() {
        const actionsContainer = DOM.createElement('div', {
            className: 'post-detail-actions-container mb-3'
        });

        // Main actions row
        const actionsRow = DOM.createElement('div', {
            className: 'post-detail-actions d-flex align-items-center gap-3'
        }, [
            this.renderVoteButtons(),
            DOM.createElement('span', {
                className: 'text-muted'
            }, `${APIUtils.formatNumber(this.post.stats.comments)} comments`),
            DOM.createElement('button', {
                className: 'btn btn-sm btn-outline-secondary',
                'data-action': 'share'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-share me-1'
                }),
                'Share'
            ]),
            DOM.createElement('button', {
                className: 'btn btn-sm btn-outline-secondary',
                'data-action': 'save'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-bookmark me-1'
                }),
                'Save'
            ]),
            DOM.createElement('button', {
                className: 'btn btn-sm btn-outline-secondary',
                'data-action': 'crosspost'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-arrow-repeat me-1'
                }),
                'Cross-post'
            ]),
            // Post management dropdown (only for post author)
            this.shouldShowPostManagement() ? this.renderPostManagementDropdown() : null
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
     * @returns {HTMLElement} Vote buttons
     */
    renderVoteButtons() {
        // Determine button classes based on user's vote
        const upvoteClasses = ['btn', 'btn-sm', 'me-1'];
        const downvoteClasses = ['btn', 'btn-sm', 'ms-1'];
        
        if (this.post.myVote === 1) {
            upvoteClasses.push('voted');
            downvoteClasses.push('btn-outline-secondary');
        } else if (this.post.myVote === -1) {
            downvoteClasses.push('voted');
            upvoteClasses.push('btn-outline-secondary');
        } else {
            upvoteClasses.push('btn-outline-primary');
            downvoteClasses.push('btn-outline-primary');
        }

        return DOM.createElement('div', {
            className: 'vote-buttons d-flex align-items-center'
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
     * Render comments section
     * @returns {HTMLElement} Comments section
     */
    renderCommentsSection() {
        return DOM.createElement('div', {
            className: 'comments-section'
        }, [
            DOM.createElement('div', {
                className: 'd-flex justify-content-between align-items-center mb-3'
            }, [
                DOM.createElement('div', {
                    className: 'd-flex align-items-center gap-3'
                }, [
                    DOM.createElement('h5', {
                        className: 'mb-0'
                    }, 'Comments'),
                    DOM.createElement('button', {
                        className: 'btn btn-sm btn-outline-primary',
                        'data-action': 'show-comment-form',
                        title: 'Add a comment to this post'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-plus-circle me-1'
                        }),
                        'Add Comment'
                    ])
                ]),
                DOM.createElement('select', {
                    className: 'form-select form-select-sm',
                    style: 'width: auto;',
                    id: 'comment-sort'
                }, [
                    DOM.createElement('option', { value: 'Hot' }, 'Hot'),
                    DOM.createElement('option', { value: 'Top', selected: true }, 'Top'),
                    DOM.createElement('option', { value: 'New' }, 'New'),
                    DOM.createElement('option', { value: 'Old' }, 'Old')
                ])
            ]),
            this.renderCommentForm(),
            DOM.createElement('div', {
                className: 'comments-container',
                id: 'comments-container'
            }, [
                DOM.createElement('div', {
                    className: 'd-flex justify-content-center p-4'
                }, [
                    DOM.createElement('div', {
                        className: 'spinner-border',
                        role: 'status'
                    }, [
                        DOM.createElement('span', {
                            className: 'visually-hidden'
                        }, 'Loading comments...')
                    ])
                ])
            ])
        ]);
    }

    /**
     * Load comments for the post
     * @param {string} sortType - Sort type (Hot, Top, New, Old)
     */
    async loadComments(sortType = 'Top') {
        if (this.isLoadingComments) {
            return;
        }

        try {
            this.isLoadingComments = true;
            
            // Show loading spinner
            const container = document.getElementById('comments-container');
            if (container) {
                DOM.clearChildren(container);
                container.appendChild(DOM.createElement('div', {
                    className: 'd-flex justify-content-center p-4'
                }, [
                    DOM.createElement('div', {
                        className: 'spinner-border',
                        role: 'status'
                    }, [
                        DOM.createElement('span', {
                            className: 'visually-hidden'
                        }, 'Loading comments...')
                    ])
                ]));
            }
            
            // Extract community ID for moderator lookup
            this.communityId = this.post.community?.id || this.post.community?.community?.id || this.post.community_id;
            
            // If we still don't have a community ID, skip moderator fetching
            if (!this.communityId) {
                this.communityModerators = [];
                // Don't try to access commentsResponse here since it's not defined yet
                this.comments = [];
                this.instanceAdmins = [];
                this.renderComments();
                return;
            }
            
            // Fetch comments and site info in parallel
            const [commentsResponse, siteResponse] = await Promise.all([
                this.api.getComments(this.post.id, {
                    sort: sortType,
                    maxDepth: 8
                }),
                this.api.getSite().catch(err => {
                    return { admins: [] };
                })
            ]);

            // Try to get community details with moderators
            let communityModerators = [];
            try {
                const communityResponse = await this.api.makeRequest(`/community?id=${this.communityId}`);
                
                // Extract moderators from community response
                if (communityResponse.moderators && Array.isArray(communityResponse.moderators)) {
                    communityModerators = communityResponse.moderators.map(modObj => {
                        return modObj.moderator || modObj.person || modObj;
                    });
                }
            } catch (error) {
            }

            this.comments = commentsResponse.comments || [];


            this.communityModerators = communityModerators;
            this.instanceAdmins = siteResponse.admins || [];
            


            
            // Update post author indicators now that we have moderator/admin data
            this.updatePostAuthorIndicators();
            
            this.renderComments();

        } catch (error) {
            const container = document.getElementById('comments-container');
            if (container) {
                DOM.showError(container, 'Failed to load comments');
            }
        } finally {
            this.isLoadingComments = false;
        }
    }

    /**
     * Render comments tree
     */
    renderComments() {
        const container = document.getElementById('comments-container');
        if (!container) return;

        DOM.clearChildren(container);

        if (this.comments.length === 0) {
            container.appendChild(DOM.createElement('div', {
                className: 'text-center text-muted p-4'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-chat display-4 mb-2'
                }),
                DOM.createElement('p', {}, 'No comments yet'),
                DOM.createElement('small', {}, 'Be the first to comment!')
            ]));
            return;
        }

        // Build comment tree (this also formats the comments)
        const commentTree = this.buildCommentTree(this.comments);
        
        // Store the formatted comments in a flat array for easy searching
        this.formattedComments = [];
        const collectFormattedComments = (comments) => {
            comments.forEach(comment => {
                this.formattedComments.push(comment);
                if (comment.children && comment.children.length > 0) {
                    collectFormattedComments(comment.children);
                }
            });
        };
        collectFormattedComments(commentTree);
        
        // Render comment tree
        commentTree.forEach(comment => {
            container.appendChild(this.renderComment(comment, 0));
        });
    }

    /**
     * Build hierarchical comment tree using Lemmy's path-based threading
     * @param {Array} comments - Flat comment array
     * @returns {Array} Tree structure
     */
    buildCommentTree(comments) {
        const commentMap = new Map();
        const rootComments = [];

        // Create map and format comments
        comments.forEach(commentData => {
            const comment = this.formatComment(commentData);
            comment.children = [];
            commentMap.set(comment.id, comment);
        });

        // Build tree structure using path-based logic
        commentMap.forEach(comment => {
            const parentId = this.getCommentParentId(comment.path);
            if (parentId && commentMap.has(parentId)) {
                commentMap.get(parentId).children.push(comment);
            } else {
                rootComments.push(comment);
            }
        });

        return rootComments;
    }

    /**
     * Get parent comment ID from path (Lemmy's threading system)
     * @param {string} path - Comment path (e.g., "0.123.456")
     * @returns {number|null} Parent comment ID
     */
    getCommentParentId(path) {
        if (!path) return null;
        
        const split = path.split(".");
        // Remove the "0" at the beginning
        split.shift();
        
        // If there's more than one element, the parent is the second-to-last
        return split.length > 1 ? Number(split[split.length - 2]) : null;
    }

    /**
     * Get depth from comment path (Lemmy's threading system)
     * @param {string} path - Comment path (e.g., "0.123.456")
     * @returns {number} Comment depth
     */
    getDepthFromComment(path) {
        if (!path) return 0;
        
        const len = path.split(".").length;
        return len ? len - 2 : 0;
    }

    /**
     * Check if a user is a moderator of the current community
     * @param {string} userName - Username to check
     * @param {number} userId - User ID to check
     * @returns {boolean} True if user is a moderator
     */
    isUserModerator(userName, userId) {
        return this.communityModerators.some(mod => {
            const nameMatch = mod.name === userName;
            const idMatch = mod.id === userId;
            return nameMatch || idMatch;
        });
    }

    /**
     * Check if a user is an admin of the current instance
     * @param {string} userName - Username to check
     * @param {number} userId - User ID to check
     * @returns {boolean} True if user is an admin
     */
    isUserAdmin(userName, userId) {
        return this.instanceAdmins.some(admin => {
            const adminPerson = admin.person || admin;
            const nameMatch = adminPerson.name === userName;
            const idMatch = adminPerson.id === userId;
            return nameMatch || idMatch;
        });
    }

    /**
     * Format comment data
     * @param {Object} commentData - Raw comment data
     * @returns {Object} Formatted comment
     */
    formatComment(commentData) {
        const commentView = commentData.comment_view || commentData;
        const comment = commentView.comment;
        const creator = commentView.creator;
        const counts = commentView.counts;

        // Extract instance information from creator actor_id
        let creatorInstanceInfo = { host: 'Unknown', isLocal: true };
        if (creator.actor_id) {
            try {
                const url = new URL(creator.actor_id);
                creatorInstanceInfo.host = url.hostname;
                creatorInstanceInfo.isLocal = creator.local !== false;
            } catch (e) {
            }
        }

        return {
            id: comment.id,
            path: comment.path,
            depth: this.getDepthFromComment(comment.path),
            content: comment.content,
            published: new Date(comment.published),
            updated: comment.updated ? new Date(comment.updated) : null,
            // Check if comment is deleted
            deleted: comment.deleted || false,
            // User's vote on this comment (1 for upvote, -1 for downvote, 0 for no vote)
            myVote: commentView.my_vote || 0,
            author: {
                name: creator.name,
                displayName: creator.display_name,
                avatar: creator.avatar,
                id: creator.id,
                local: creator.local !== false,
                actor_id: creator.actor_id,
                instance: creatorInstanceInfo
            },
            stats: {
                upvotes: counts.upvotes,
                downvotes: counts.downvotes,
                score: counts.score
            },
            children: []
        };
    }

    /**
     * Render individual comment
     * @param {Object} comment - Comment data
     * @param {number} renderDepth - Rendering depth (for recursive calls)
     * @returns {HTMLElement} Comment element
     */
    renderComment(comment, renderDepth = 0) {
        // Use the depth calculated from the path, not the render depth
        const actualDepth = comment.depth || 0;
        const isNested = actualDepth > 0;
        const maxDepth = 6;
        const clampedDepth = Math.min(actualDepth, maxDepth);

        const commentElement = DOM.createElement('div', {
            className: `comment ${isNested ? 'nested-comment' : ''}`,
            'data-comment-id': comment.id,
            'data-depth': clampedDepth,
            'id': `comment-${comment.id}`
        });

        // Create comment header
        const headerElement = DOM.createElement('div', {
            className: 'comment-header d-flex align-items-center mb-2'
        }, [
            comment.author.avatar ? DOM.createElement('img', {
                src: comment.author.avatar,
                className: 'comment-avatar me-2',
                style: 'width: 24px; height: 24px; border-radius: 50%;',
                alt: ''
            }) : DOM.createElement('i', {
                className: 'bi bi-person-circle me-2 text-muted'
            }),
            this.renderCommentAuthor(comment),
            DOM.createElement('small', {
                className: 'text-muted me-2'
            }, APIUtils.formatTime(comment.published)),
            ...(comment.children && comment.children.length > 0 ? [DOM.createElement('small', {
                className: 'badge bg-secondary me-2',
                title: `${comment.children.length} ${comment.children.length === 1 ? 'reply' : 'replies'}`
            }, comment.children.length)] : [])
        ]);

        // Create comment content separately to handle innerHTML
        const commentContentElement = DOM.createElement('div', {
            className: 'comment-content mb-2'
        });
        
        // Check if comment is deleted
        if (comment.deleted) {
            // Show deleted comment indicator
            commentContentElement.appendChild(DOM.createElement('div', {
                className: 'deleted-comment-indicator p-3 border rounded text-center',
                title: 'This comment has been deleted'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-trash text-danger me-2'
                }),
                DOM.createElement('span', {
                    className: 'text-muted'
                }, 'This comment has been deleted'),
                DOM.createElement('br'),
                DOM.createElement('small', {
                    className: 'text-muted'
                }, 'The content is no longer available')
            ]));
        } else {
            // Show normal comment content
            commentContentElement.innerHTML = processCommentContent(comment.content);
        }
        
        // Create comment actions (including collapse button if needed)

        // Build action buttons using the dedicated method
        const actionButtons = this.renderCommentActions(comment);

        const commentActions = DOM.createElement('div', {
            className: 'comment-actions d-flex gap-2'
        }, actionButtons);

        // Create vote ratio bar (like YouTube like/dislike bar) - only for non-deleted comments
        let voteRatioBar = null;
        
        if (!comment.deleted && comment.stats) {
            const totalVotes = comment.stats.upvotes + comment.stats.downvotes;
            
            if (totalVotes > 0) {
                const upvotePercentage = (comment.stats.upvotes / totalVotes) * 100;
                const downvotePercentage = (comment.stats.downvotes / totalVotes) * 100;
                
                voteRatioBar = DOM.createElement('div', {
                    className: 'vote-ratio-container mt-2 d-flex align-items-center'
                }, [
                    DOM.createElement('div', {
                        className: 'vote-ratio-bar',
                        title: `${comment.stats.upvotes} upvotes (${upvotePercentage.toFixed(1)}%) • ${comment.stats.downvotes} downvotes (${downvotePercentage.toFixed(1)}%)`
                    }, [
                        DOM.createElement('div', {
                            className: 'vote-ratio-upvotes',
                            style: `width: ${upvotePercentage}%`
                        }),
                        DOM.createElement('div', {
                            className: 'vote-ratio-downvotes',
                            style: `width: ${downvotePercentage}%`
                        })
                    ]),
                    DOM.createElement('span', {
                        className: 'vote-percentage text-muted ms-2'
                    }, `${upvotePercentage.toFixed(0)}%`)
                ]);
            }
        }

        // Append all elements to the comment
        commentElement.appendChild(headerElement);
        commentElement.appendChild(commentContentElement);
        commentElement.appendChild(commentActions);
        
        // Add vote ratio bar if there are votes
        if (voteRatioBar) {
            commentElement.appendChild(voteRatioBar);
        }

        // Add children comments
        if (comment.children && comment.children.length > 0) {
            const childrenContainer = DOM.createElement('div', {
                className: 'comment-children',
                'data-children-for': comment.id
            });

            comment.children.forEach(child => {
                childrenContainer.appendChild(this.renderComment(child, renderDepth + 1));
            });

            commentElement.appendChild(childrenContainer);
        }

        return commentElement;
    }

    /**
     * Get the rendered element
     * @returns {HTMLElement} The post detail element
     */
    getElement() {
        return this.element;
    }

    /**
     * Destroy the component
     */
    destroy() {
        if (this.element) {
            this.element.removeEventListener('click', this.handleCommentActions);
            
            // Remove comment sort dropdown event listener
            const sortDropdown = this.element.querySelector('#comment-sort');
            if (sortDropdown) {
                sortDropdown.removeEventListener('change', this.handleCommentSortChange.bind(this));
            }
        }
        this.element = null;
        this.post = null;
        this.comments = [];
        this.formattedComments = [];
        this.api = null;
    }

    /**
     * Handle comment-related actions
     * @param {Event} event - Click event
     */
    handleCommentActions(event) {
        const target = event.target;
        const action = target.dataset.action || target.closest('[data-action]')?.dataset.action;

        if (!action) return;

        event.preventDefault();
        event.stopPropagation();

        const commentId = target.dataset.commentId || target.closest('[data-comment-id]')?.dataset.commentId;

        switch (action) {
            case 'toggle-collapse':
                this.toggleCommentCollapse(commentId);
                break;
            case 'upvote-comment':
                this.handleCommentVote(commentId, 1);
                break;
            case 'downvote-comment':
                this.handleCommentVote(commentId, -1);
                break;
            case 'reply-comment':
                this.handleCommentReply(commentId).catch(error => {
                });
                break;
            case 'edit-comment':
                this.handleEditComment(commentId);
                break;
            case 'delete-comment':
                this.handleDeleteComment(commentId);
                break;
            case 'report-comment':
                this.handleReportComment(commentId);
                break;
            case 'show-comment-form':
                this.showCommentForm();
                break;
            case 'close-comment-form':
                this.closeCommentForm();
                break;
            case 'preview-comment':
                this.previewComment();
                break;
            case 'clear-comment':
                this.clearComment();
                break;
            case 'close-preview':
                this.closeCommentPreview();
                break;
            case 'close-reply-form':
                this.hideAllReplyForms();
                break;
            case 'preview-reply':
                this.previewReply(commentId);
                break;
            case 'clear-reply':
                this.clearReply(commentId);
                break;
            case 'close-reply-preview':
                this.closeReplyPreview(commentId);
                break;
        }
    }

    /**
     * Toggle comment thread collapse/expand
     * @param {string} commentId - Comment ID to toggle
     */
    toggleCommentCollapse(commentId) {
        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        const childrenContainer = commentElement?.querySelector(`[data-children-for="${commentId}"]`);
        const collapseBtn = commentElement?.querySelector('[data-action="toggle-collapse"]');

        if (!commentElement || !childrenContainer || !collapseBtn) return;

        const isCollapsed = childrenContainer.style.display === 'none';

        if (isCollapsed) {
            // Expand
            childrenContainer.style.display = '';
            collapseBtn.innerHTML = [
                DOM.createElement('i', { className: 'bi bi-dash-square me-1' }),
                'Collapse'
            ].map(el => el.outerHTML || el).join('');
            collapseBtn.setAttribute('aria-label', 'Collapse comment thread');
        } else {
            // Collapse
            childrenContainer.style.display = 'none';
            collapseBtn.innerHTML = [
                DOM.createElement('i', { className: 'bi bi-plus-square me-1' }),
                'Expand'
            ].map(el => el.outerHTML || el).join('');
            collapseBtn.setAttribute('aria-label', 'Expand comment thread');
        }
    }

    /**
     * Handle comment voting
     * @param {string} commentId - Comment ID
     * @param {number} vote - Vote value (1 for upvote, -1 for downvote)
     */
    async handleCommentVote(commentId, vote) {
        // Import authManager and API at runtime to avoid circular dependencies
        const { authManager } = await import('../auth.js');
        
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            DOM.showToast('Please log in to vote', 'info');
            return;
        }

        try {
            // Find the comment in our data structure
            const comment = this.findCommentById(commentId);
            if (!comment) {
                return;
            }

            // Determine new vote score based on current vote state and action
            let newVoteScore;
            const currentVote = comment.myVote || 0;
            
            if (vote === 1) {
                // If already upvoted, remove vote; otherwise upvote
                newVoteScore = currentVote === 1 ? 0 : 1;
            } else if (vote === -1) {
                // If already downvoted, remove vote; otherwise downvote
                newVoteScore = currentVote === -1 ? 0 : -1;
            }

            // Disable vote buttons during request
            const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
            const voteButtons = commentElement?.querySelectorAll('[data-action*="vote-comment"]');
            voteButtons?.forEach(btn => btn.disabled = true);

            // Make API call to vote
            // Ensure comment ID is an integer
            const numericCommentId = parseInt(commentId);
            if (isNaN(numericCommentId)) {
                throw new Error(`Invalid comment ID: ${commentId}`);
            }
            const voteResponse = await this.api.voteComment(numericCommentId, newVoteScore);
            
            if (voteResponse && voteResponse.comment_view) {
                // Update comment data with new vote information
                const updatedComment = voteResponse.comment_view;
                comment.myVote = updatedComment.my_vote || 0;
                comment.stats.upvotes = updatedComment.counts?.upvotes || 0;
                comment.stats.downvotes = updatedComment.counts?.downvotes || 0;
                comment.stats.score = updatedComment.counts?.score || 0;
                
                // Update UI to reflect new vote state
                this.updateCommentVoteDisplay(commentId, comment);
                
                // Show success message only for vote removal
                if (newVoteScore === 0) {
                    DOM.showToast('Vote removed', 'success');
                }
            }

        } catch (error) {
            DOM.showToast('Failed to vote. Please try again.', 'error');
        } finally {
            // Re-enable vote buttons
            const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
            const voteButtons = commentElement?.querySelectorAll('[data-action*="vote-comment"]');
            voteButtons?.forEach(btn => btn.disabled = false);
        }
    }

    /**
     * Find a comment by ID in the comments tree
     * @param {string} commentId - Comment ID to find
     * @returns {Object|null} Comment object or null if not found
     */
    findCommentById(commentId) {
        // Use the flat array of formatted comments for faster lookup
        if (this.formattedComments && Array.isArray(this.formattedComments)) {
            for (const comment of this.formattedComments) {
                if (!comment || !comment.id) {
                    continue;
                }
                
                // Compare both as strings to handle integer/string mismatches
                if (comment.id.toString() === commentId.toString()) {
                    return comment;
                }
                // Also try numeric comparison in case of type issues
                if (parseInt(comment.id) === parseInt(commentId)) {
                    return comment;
                }
            }
        }
        
        // Fallback to tree search if formattedComments is not available
        const findInComments = (comments) => {
            if (!Array.isArray(comments)) {
                return null;
            }
            
            for (const comment of comments) {
                // Add null/undefined checks
                if (!comment || !comment.id) {
                    continue;
                }
                
                // Compare both as strings to handle integer/string mismatches
                if (comment.id.toString() === commentId.toString()) {
                    return comment;
                }
                // Also try numeric comparison in case of type issues
                if (parseInt(comment.id) === parseInt(commentId)) {
                    return comment;
                }
                if (comment.children && comment.children.length > 0) {
                    const found = findInComments(comment.children);
                    if (found) return found;
                }
            }
            return null;
        };
        
        return findInComments(this.comments);
    }

    /**
     * Update a comment in the tree structure
     * @param {string} commentId - Comment ID to update
     * @param {Object} updatedComment - Updated comment data
     */
    updateCommentInTree(commentId, updatedComment) {
        // Update in formatted comments array for faster access
        if (this.formattedComments && Array.isArray(this.formattedComments)) {
            const formattedIndex = this.formattedComments.findIndex(c => c.id === commentId);
            if (formattedIndex !== -1) {
                this.formattedComments[formattedIndex] = updatedComment;
            }
        }

        // Update in the tree structure
        const updateInComments = (comments) => {
            if (!Array.isArray(comments)) {
                return false;
            }
            
            for (let i = 0; i < comments.length; i++) {
                const comment = comments[i];
                if (!comment || !comment.id) {
                    continue;
                }
                
                // Compare both as strings to handle integer/string mismatches
                if (comment.id.toString() === commentId.toString() || 
                    parseInt(comment.id) === parseInt(commentId)) {
                    // Update the comment while preserving the children
                    const children = comment.children || [];
                    comments[i] = { ...updatedComment, children };
                    return true;
                }
                
                // Check children recursively
                if (comment.children && comment.children.length > 0) {
                    if (updateInComments(comment.children)) {
                        return true;
                    }
                }
            }
            return false;
        };
        
        updateInComments(this.comments);
    }

    /**
     * Get all comment IDs for debugging
     * @returns {Array} Array of comment IDs
     */
    getAllCommentIds() {
        // Use formatted comments if available
        if (this.formattedComments && Array.isArray(this.formattedComments)) {
            return this.formattedComments
                .filter(comment => comment && comment.id)
                .map(comment => comment.id);
        }
        
        // Fallback to tree traversal
        const ids = [];
        const collectIds = (comments) => {
            if (!Array.isArray(comments)) return;
            
            for (const comment of comments) {
                if (comment && comment.id) {
                    ids.push(comment.id);
                }
                if (comment && comment.children) {
                    collectIds(comment.children);
                }
            }
        };
        
        collectIds(this.comments);
        return ids;
    }

    /**
     * Update comment vote display after voting
     * @param {string} commentId - Comment ID
     * @param {Object} comment - Updated comment data
     */
    updateCommentVoteDisplay(commentId, comment) {
        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentElement) return;

        const upvoteBtn = commentElement.querySelector('[data-action="upvote-comment"]');
        const downvoteBtn = commentElement.querySelector('[data-action="downvote-comment"]');
        
        if (upvoteBtn && downvoteBtn) {
            // Reset classes
            upvoteBtn.className = 'btn btn-sm btn-link p-0';
            downvoteBtn.className = 'btn btn-sm btn-link p-0';
            
            // Apply appropriate classes based on current vote
            if (comment.myVote === 1) {
                upvoteBtn.classList.add('voted', 'upvote-btn');
                downvoteBtn.classList.add('text-muted');
                upvoteBtn.title = 'Remove upvote';
                downvoteBtn.title = 'Downvote';
            } else if (comment.myVote === -1) {
                downvoteBtn.classList.add('voted', 'downvote-btn');
                upvoteBtn.classList.add('text-muted');
                downvoteBtn.title = 'Remove downvote';
                upvoteBtn.title = 'Upvote';
            } else {
                upvoteBtn.classList.add('text-muted');
                downvoteBtn.classList.add('text-muted');
                upvoteBtn.title = 'Upvote';
                downvoteBtn.title = 'Downvote';
            }
        }

        // Update vote counts
        const upvoteCount = commentElement.querySelector('[data-action="upvote-comment"] .vote-count');
        const downvoteCount = commentElement.querySelector('[data-action="downvote-comment"] .vote-count');
        
        if (upvoteCount) {
            upvoteCount.textContent = APIUtils.formatNumber(comment.stats.upvotes);
        }
        if (downvoteCount) {
            downvoteCount.textContent = APIUtils.formatNumber(comment.stats.downvotes);
        }

        // Update vote ratio bar if it exists
        this.updateCommentVoteRatioBar(commentId, comment);
    }

    /**
     * Update comment vote ratio bar
     * @param {string} commentId - Comment ID
     * @param {Object} comment - Comment data
     */
    updateCommentVoteRatioBar(commentId, comment) {
        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentElement) return;

        const ratioBar = commentElement.querySelector('.vote-ratio-bar');
        if (!ratioBar) return;

        const totalVotes = comment.stats.upvotes + comment.stats.downvotes;
        if (totalVotes === 0) {
            const container = ratioBar.closest('.vote-ratio-container');
            if (container) container.style.display = 'none';
            return;
        }

        const container = ratioBar.closest('.vote-ratio-container');
        if (container) container.style.display = 'flex';
        
        const upvotePercentage = (comment.stats.upvotes / totalVotes) * 100;
        
        const upvoteBarElement = ratioBar.querySelector('.vote-ratio-upvotes, .upvote-bar');
        const downvoteBarElement = ratioBar.querySelector('.vote-ratio-downvotes, .downvote-bar');
        const percentageElement = commentElement.querySelector('.vote-percentage');
        
        if (upvoteBarElement) upvoteBarElement.style.width = `${upvotePercentage}%`;
        if (downvoteBarElement) downvoteBarElement.style.width = `${100 - upvotePercentage}%`;
        if (percentageElement) percentageElement.textContent = `${upvotePercentage.toFixed(0)}%`;
        
        // Update tooltip
        ratioBar.title = `${comment.stats.upvotes} upvotes (${upvotePercentage.toFixed(1)}%) • ${comment.stats.downvotes} downvotes (${(100 - upvotePercentage).toFixed(1)}%)`;
    }

    /**
     * Handle comment reply
     * @param {string} commentId - Parent comment ID
     */
    async handleCommentReply(commentId) {
        // Import authManager at runtime to avoid circular dependencies
        const { authManager } = await import('../auth.js');
        
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            DOM.showToast('Please log in to reply to comments', 'info');
            return;
        }

        // Hide any existing reply forms
        this.hideAllReplyForms();

        // Find the comment element
        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentElement) {
            return;
        }

        // Check if reply form already exists
        let existingForm = commentElement.querySelector('.reply-form');
        if (existingForm) {
            existingForm.remove();
            return;
        }

        // Create reply form
        const replyForm = this.renderReplyForm(commentId);
        
        // Insert the reply form after the comment actions
        const commentActions = commentElement.querySelector('.comment-actions');
        if (commentActions) {
            commentActions.parentNode.insertBefore(replyForm, commentActions.nextSibling);
        } else {
        }

        // Focus on the reply textarea
        const replyTextarea = replyForm.querySelector('.reply-textarea');
        if (replyTextarea) {
            replyTextarea.focus();
        } else {
        }
    }

    /**
     * Hide all reply forms
     */
    hideAllReplyForms() {
        const replyForms = document.querySelectorAll('.reply-form');
        replyForms.forEach(form => form.remove());
    }

    /**
     * Render reply form for a specific comment
     * @param {string} commentId - Parent comment ID
     * @returns {HTMLElement} Reply form element
     */
    renderReplyForm(commentId) {
        const replyForm = DOM.createElement('div', {
            className: 'reply-form mt-3 mb-2 p-3 border rounded bg-light'
        }, [
            DOM.createElement('div', {
                className: 'reply-form-header d-flex justify-content-between align-items-center mb-2'
            }, [
                DOM.createElement('small', {
                    className: 'text-muted fw-bold'
                }, 'Reply to comment'),
                DOM.createElement('button', {
                    type: 'button',
                    className: 'btn-close btn-close-sm',
                    'data-action': 'close-reply-form',
                    'data-comment-id': commentId,
                    title: 'Close reply form'
                })
            ]),
            DOM.createElement('form', {
                className: 'reply-form-content',
                'data-comment-id': commentId
            }, [
                DOM.createElement('div', {
                    className: 'mb-2'
                }, [
                    DOM.createElement('textarea', {
                        className: 'form-control reply-textarea',
                        rows: '3',
                        placeholder: 'Write your reply...',
                        required: true,
                        'data-action': 'reply-input'
                    })
                ]),
                DOM.createElement('div', {
                    className: 'd-flex justify-content-between align-items-center'
                }, [
                    DOM.createElement('div', {
                        className: 'reply-form-actions d-flex gap-2'
                    }, [
                        DOM.createElement('button', {
                            type: 'button',
                            className: 'btn btn-outline-secondary btn-sm',
                            'data-action': 'preview-reply',
                            'data-comment-id': commentId,
                            title: 'Preview reply'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-eye me-1'
                            }),
                            'Preview'
                        ]),
                        DOM.createElement('button', {
                            type: 'button',
                            className: 'btn btn-outline-secondary btn-sm',
                            'data-action': 'clear-reply',
                            'data-comment-id': commentId,
                            title: 'Clear reply'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-trash me-1'
                            }),
                            'Clear'
                        ])
                    ]),
                    DOM.createElement('button', {
                        type: 'submit',
                        className: 'btn btn-primary btn-sm',
                        'data-action': 'submit-reply',
                        'data-comment-id': commentId,
                        disabled: true
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-reply me-1'
                        }),
                        'Post Reply'
                    ])
                ])
            ]),
            DOM.createElement('div', {
                className: 'reply-preview mt-2',
                'data-reply-preview': commentId,
                style: 'display: none;'
            }, [
                DOM.createElement('div', {
                    className: 'card'
                }, [
                    DOM.createElement('div', {
                        className: 'card-header d-flex justify-content-between align-items-center py-2'
                    }, [
                        DOM.createElement('small', {
                            className: 'text-muted'
                        }, 'Preview'),
                        DOM.createElement('button', {
                            type: 'button',
                            className: 'btn-close btn-close-sm',
                            'data-action': 'close-reply-preview',
                            'data-comment-id': commentId,
                            title: 'Close preview'
                        })
                    ]),
                    DOM.createElement('div', {
                        className: 'card-body py-2'
                    }, [
                        DOM.createElement('div', {
                            'data-reply-preview-content': commentId
                        })
                    ])
                ])
            ])
        ]);

        // Add event listeners for the reply form
        this.setupReplyFormEventListeners(replyForm, commentId);

        return replyForm;
    }

    /**
     * Set up event listeners for reply forms
     * @param {HTMLElement} replyForm - Reply form element
     * @param {string} commentId - Parent comment ID
     */
    setupReplyFormEventListeners(replyForm, commentId) {
        // Handle form submission
        const form = replyForm.querySelector('.reply-form-content');
        if (form) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleReplySubmit(commentId);
            });
        } else {
        }

        // Also add a click event listener to the submit button as backup
        const submitBtn = replyForm.querySelector('[data-action="submit-reply"]');
        if (submitBtn) {
            submitBtn.addEventListener('click', (event) => {
                event.preventDefault();
                // Manually trigger form submission
                const form = replyForm.querySelector('.reply-form-content');
                if (form) {
                    try {
                        form.dispatchEvent(new Event('submit', { bubbles: true }));
                    } catch (error) {
                    }
                }
            });
        }

        // Add debugging for form validation
        const formForValidation = replyForm.querySelector('.reply-form-content');
        if (formForValidation) {
            formForValidation.addEventListener('invalid', (event) => {
            });
        }

        // Handle input changes to enable/disable submit button
        const textarea = replyForm.querySelector('.reply-textarea');
        if (textarea) {
            textarea.addEventListener('input', () => {
                this.handleReplyInputChange(commentId);
            });
        } else {
        }
    }

    /**
     * Handle reply input change
     * @param {string} commentId - Parent comment ID
     */
    handleReplyInputChange(commentId) {
        const replyForm = document.querySelector(`[data-comment-id="${commentId}"] .reply-form`);
        if (!replyForm) return;

        const textarea = replyForm.querySelector('.reply-textarea');
        const submitBtn = replyForm.querySelector('[data-action="submit-reply"]');
        
        if (!textarea || !submitBtn) return;

        const content = textarea.value.trim();
        submitBtn.disabled = !content;
    }

    /**
     * Handle reply form submission
     * @param {string} commentId - Parent comment ID
     */
    async handleReplySubmit(commentId) {
        // Import authManager at runtime to avoid circular dependencies
        const { authManager } = await import('../auth.js');
        
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            DOM.showToast('Please log in to reply to comments', 'info');
            return;
        }
        
        const replyForm = document.querySelector(`[data-comment-id="${commentId}"] .reply-form`);
        if (!replyForm) {
            return;
        }

        const textarea = replyForm.querySelector('.reply-textarea');
        const submitBtn = replyForm.querySelector('[data-action="submit-reply"]');
        
        if (!textarea || !submitBtn) {
            return;
        }

        const content = textarea.value.trim();
        if (!content) {
            DOM.showToast('Please enter a reply', 'info');
            return;
        }

        // Disable submit button and show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = [
            DOM.createElement('span', {
                className: 'spinner-border spinner-border-sm me-2'
            }),
            'Posting...'
        ].map(el => el.outerHTML || el).join('');

        try {
            // Create reply via API
            const replyData = {
                content: content,
                post_id: this.post.id,
                parent_id: parseInt(commentId)
            };

            const response = await this.api.createComment(replyData);
            
            if (response && response.comment_view) {
                // Show success message
                DOM.showToast('Reply posted successfully!', 'success');
                
                // Remove the reply form
                replyForm.remove();
                
                // Reload comments with current sort order to ensure we get the latest reply
                await this.loadComments(this.currentCommentSort);
                
                // Scroll to the new reply
                this.scrollToNewComment(response.comment_view.comment.id);
            } else {
                throw new Error('Invalid response from server');
            }

        } catch (error) {
            DOM.showToast('Failed to post reply. Please try again.', 'error');
            
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = [
                DOM.createElement('i', {
                    className: 'bi bi-reply me-1'
                }),
                'Post Reply'
            ].map(el => el.outerHTML || el).join('');
        }
    }

    /**
     * Preview reply content
     * @param {string} commentId - Parent comment ID
     */
    previewReply(commentId) {
        const replyForm = document.querySelector(`[data-comment-id="${commentId}"] .reply-form`);
        if (!replyForm) return;

        const textarea = replyForm.querySelector('.reply-textarea');
        const previewContainer = replyForm.querySelector(`[data-reply-preview="${commentId}"]`);
        const previewContent = replyForm.querySelector(`[data-reply-preview-content="${commentId}"]`);
        
        if (!textarea || !previewContainer || !previewContent) return;

        const content = textarea.value.trim();
        if (!content) {
            DOM.showToast('Please enter content to preview', 'info');
            return;
        }

        // Process markdown content
        previewContent.innerHTML = processCommentContent(content);
        previewContainer.style.display = 'block';
    }

    /**
     * Clear reply content
     * @param {string} commentId - Parent comment ID
     */
    clearReply(commentId) {
        const replyForm = document.querySelector(`[data-comment-id="${commentId}"] .reply-form`);
        if (!replyForm) return;

        const textarea = replyForm.querySelector('.reply-textarea');
        const submitBtn = replyForm.querySelector('[data-action="submit-reply"]');
        
        if (textarea) {
            textarea.value = '';
        }
        
        if (submitBtn) {
            submitBtn.disabled = true;
        }

        // Hide preview if it's showing
        this.closeReplyPreview(commentId);
    }

    /**
     * Close reply preview
     * @param {string} commentId - Parent comment ID
     */
    closeReplyPreview(commentId) {
        const replyForm = document.querySelector(`[data-comment-id="${commentId}"] .reply-form`);
        if (!replyForm) return;

        const previewContainer = replyForm.querySelector(`[data-reply-preview="${commentId}"]`);
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
    }

    /**
     * Handle comment edit
     * @param {string} commentId - Comment ID to edit
     */
    async handleEditComment(commentId) {
        // Import authManager at runtime to avoid circular dependencies
        const { authManager } = await import('../auth.js');
        
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            DOM.showToast('Please log in to edit comments', 'info');
            return;
        }

        // Find the comment to check if it's already deleted
        const comment = this.findCommentById(commentId);
        if (!comment) {
            DOM.showToast('Comment not found', 'error');
            return;
        }

        // Check if this is the current user's comment
        if (!this.isCurrentUserComment(comment)) {
            DOM.showToast('You can only edit your own comments', 'error');
            return;
        }

        // Check if comment is deleted
        if (comment.deleted) {
            DOM.showToast('Cannot edit deleted comments', 'error');
            return;
        }

        // Show the edit comment modal
        this.showEditCommentModal(commentId, comment);
    }

    /**
     * Handle comment deletion
     * @param {string} commentId - Comment ID to delete
     */
    async handleDeleteComment(commentId) {
        try {
            // Validate comment ID
            if (!commentId || isNaN(parseInt(commentId))) {
                DOM.showToast('Invalid comment ID', 'error');
                return;
            }
            
            // Check if user is authenticated
            if (!authManager.isAuthenticated()) {
                DOM.showToast('You must be logged in to delete comments', 'error');
                return;
            }

            // Find the comment to check if it's already deleted
            const comment = this.findCommentById(commentId);
            if (!comment) {
                DOM.showToast('Comment not found', 'error');
                return;
            }

            // Check if this is the current user's comment
            if (!this.isCurrentUserComment(comment)) {
                DOM.showToast('You can only delete your own comments', 'error');
                return;
            }

            // Toggle deleted state (if already deleted, undelete it)
            const newDeletedState = !comment.deleted;
            const actionText = newDeletedState ? 'deleting' : 'restoring';

            // Show loading state
            DOM.showToast(`${actionText.charAt(0).toUpperCase() + actionText.slice(1)} comment...`, 'info');

            // Call the API to delete/undelete the comment
            const response = await this.api.deleteComment({
                comment_id: parseInt(commentId),
                deleted: newDeletedState
            });

            if (response && response.comment_view) {
                // Update the comment in our tree structure
                this.updateCommentInTree(commentId, response.comment_view);

                // Show success message
                const successText = newDeletedState ? 'Comment deleted successfully' : 'Comment restored successfully';
                DOM.showToast(successText, 'success');

                // Update the comment element in the DOM to show deleted state
                const commentElement = this.element.querySelector(`[data-comment-id="${commentId}"]`);
                if (commentElement) {
                    if (newDeletedState) {
                        commentElement.classList.add('deleted-comment-indicator');
                        // Update the comment content to show deleted state
                        const contentElement = commentElement.querySelector('.comment-content');
                        if (contentElement) {
                            contentElement.innerHTML = '<em class="text-muted">[Comment deleted]</em>';
                        }
                        
                        // Hide vote buttons and other actions for deleted comments
                        const voteButtons = commentElement.querySelectorAll('[data-action*="vote"], [data-action="reply-comment"]');
                        voteButtons.forEach(btn => btn.style.display = 'none');
                    } else {
                        commentElement.classList.remove('deleted-comment-indicator');
                        // Restore the original comment content
                        const contentElement = commentElement.querySelector('.comment-content');
                        if (contentElement && comment.content) {
                            contentElement.innerHTML = processCommentContent(comment.content);
                        }
                        
                        // Show vote buttons and other actions for restored comments
                        const voteButtons = commentElement.querySelectorAll('[data-action*="vote"], [data-action="reply-comment"]');
                        voteButtons.forEach(btn => btn.style.display = '');
                    }
                    
                    // Update the comment options dropdown text
                    const deleteButton = commentElement.querySelector('[data-action="delete-comment"]');
                    if (deleteButton) {
                        const icon = deleteButton.querySelector('i');
                        const text = deleteButton.textContent || deleteButton.innerText;
                        
                        if (newDeletedState) {
                            if (icon) icon.className = 'bi bi-arrow-clockwise me-2';
                            deleteButton.textContent = 'Restore Comment';
                            deleteButton.title = 'Restore this comment';
                        } else {
                            if (icon) icon.className = 'bi bi-trash me-2';
                            deleteButton.textContent = 'Delete Comment';
                            deleteButton.title = 'Delete this comment permanently';
                        }
                    }
                    
                    // Re-render the comment actions to show/hide appropriate buttons
                    const actionsContainer = commentElement.querySelector('.comment-actions');
                    if (actionsContainer) {
                        // Clear and re-render actions
                        DOM.clearChildren(actionsContainer);
                        
                        // Get the updated comment data
                        const updatedComment = this.findCommentById(commentId);
                        if (updatedComment) {
                            // Re-render the actions
                            const newActions = this.renderCommentActions(updatedComment);
                            newActions.forEach(action => actionsContainer.appendChild(action));
                        }
                    }
                }
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            
            // Provide more specific error messages based on error type
            let errorMessage = 'Failed to delete comment. Please try again.';
            
            if (error.message && error.message.includes('rate')) {
                errorMessage = 'Rate limited. Please wait a moment before trying again.';
            } else if (error.message && error.message.includes('unauthorized')) {
                errorMessage = 'You are not authorized to delete this comment.';
            } else if (error.message && error.message.includes('not found')) {
                errorMessage = 'Comment not found or already deleted.';
            }
            
            DOM.showToast(errorMessage, 'error');
        }
    }

    /**
     * Handle comment reporting
     * @param {string} commentId - Comment ID to report
     */
    handleReportComment(commentId) {
        // TODO: Implement comment reporting functionality
        DOM.showToast('Report comment functionality coming soon!', 'info');
    }

    /**
     * Check if a comment belongs to the current user
     * @param {Object} comment - Comment data
     * @returns {boolean} True if comment belongs to current user
     */
    isCurrentUserComment(comment) {
        if (!authManager.isAuthenticated()) {
            return false;
        }
        
        const currentUser = authManager.getCurrentUser();
        if (!currentUser) {
            return false;
        }
        
        // Compare the current user's name with the comment author's name
        return currentUser.name === comment.author.name;
    }

    /**
     * Handle comment sort dropdown change
     * @param {Event} event - Change event
     */
    handleCommentSortChange(event) {
        const selectedSort = event.target.value;
        this.currentCommentSort = selectedSort; // Store current sort order
        this.loadComments(selectedSort);
    }

    /**
     * Render comment author with moderator and admin indicators
     * @param {Object} comment - Comment data
     * @returns {HTMLElement} Comment author element
     */
    renderCommentAuthor(comment) {
        const isModerator = this.isUserModerator(comment.author.name, comment.author.id);
        const isAdmin = this.isUserAdmin(comment.author.name, comment.author.id);
        const isOP = comment.author.name === this.post.author.name;
        
        // Create container for author and badges
        const authorContainer = DOM.createElement('div', {
            className: 'd-flex align-items-center me-2'
        });

        // Determine the display name and URL for the author
        let displayName = comment.author.displayName || comment.author.name;
        let authorUrl = `/u/${comment.author.name}`;
        
        // For remote users, format as "username@instance.tld" and include instance in URL
        if (!comment.author.local && comment.author.actor_id) {
            try {
                const actorUrl = new URL(comment.author.actor_id);
                const instanceHost = actorUrl.hostname;
                displayName = `${comment.author.displayName || comment.author.name}@${instanceHost}`;
                authorUrl = `/u/${comment.author.name}@${instanceHost}`;
            } catch (e) {
                // Fallback to local format if parsing fails
            }
        }

        // Create author name element as a clickable link with appropriate styling
        const authorName = DOM.createElement('a', {
            href: authorUrl,
            className: `comment-author text-decoration-none ${isModerator ? 'text-success fw-bold' : ''}`,
            title: isModerator ? 'Community Moderator' : '',
            'data-user': comment.author.name,
            onclick: (e) => {
                e.preventDefault();
                window.location.href = authorUrl;
            }
        }, displayName);
        
        authorContainer.appendChild(authorName);

        // Add OP indicator
        if (isOP) {
            authorContainer.appendChild(DOM.createElement('i', {
                className: 'bi bi-pencil-square text-primary ms-1',
                style: 'font-size: 0.7rem;',
                title: 'Original Poster'
            }));
        }

        // Add moderator badge
        if (isModerator) {
            authorContainer.appendChild(DOM.createElement('i', {
                className: 'bi bi-shield-fill text-success ms-1',
                style: 'font-size: 0.8rem;',
                title: 'Community Moderator'
            }));
        }

        // Add admin badge with shield icon
        if (isAdmin) {
            authorContainer.appendChild(DOM.createElement('span', {
                className: 'badge bg-danger ms-1',
                style: 'font-size: 0.7rem;',
                title: 'Instance Administrator'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-shield-fill'
                })
            ]));
        }

        return authorContainer;
    }

    /**
     * Render post author with moderator and admin indicators
     * @returns {HTMLElement} Post author element
     */
    renderPostAuthor() {
        const isModerator = this.isUserModerator(this.post.author.name, this.post.author.id);
        const isAdmin = this.isUserAdmin(this.post.author.name, this.post.author.id);
        
        // Create container for author and badges
        const authorContainer = DOM.createElement('span', {
            className: 'd-inline-flex align-items-center',
            id: 'post-author-container'
        });

        // Determine the display name and URL for the author
        let displayName = this.post.author.displayName || this.post.author.name;
        let authorUrl = `/u/${this.post.author.name}`;
        
        // For remote users, format as "username@instance.tld" and include instance in URL
        if (!this.post.author.local && this.post.author.actor_id) {
            try {
                const actorUrl = new URL(this.post.author.actor_id);
                const instanceHost = actorUrl.hostname;
                displayName = `${this.post.author.displayName || this.post.author.name}@${instanceHost}`;
                authorUrl = `/u/${this.post.author.name}@${instanceHost}`;
            } catch (e) {
                // Fallback to local format if parsing fails
            }
        }

        // Create author name element with appropriate styling and link
        const authorName = DOM.createElement('a', {
            href: authorUrl,
            className: `text-decoration-none ${isModerator ? 'text-success fw-bold' : 'text-muted'}`,
            'data-user': this.post.author.name,
            onclick: (e) => {
                e.preventDefault();
                window.location.href = authorUrl;
            }
        }, displayName);
        
        authorContainer.appendChild(authorName);

        // Add moderator badge
        if (isModerator) {
            authorContainer.appendChild(DOM.createElement('i', {
                className: 'bi bi-shield-fill text-success ms-1',
                style: 'font-size: 0.7rem;',
                title: 'Community Moderator'
            }));
        }

        // Add admin badge with shield icon
        if (isAdmin) {
            authorContainer.appendChild(DOM.createElement('span', {
                className: 'badge bg-danger ms-1',
                style: 'font-size: 0.6rem;',
                title: 'Instance Administrator'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-shield-fill'
                })
            ]));
        }

        return authorContainer;
    }

    /**
     * Update post author indicators after moderator/admin data is loaded
     */
    updatePostAuthorIndicators() {
        const container = document.getElementById('post-author-container');
        if (!container) return;

        // Replace the container with updated version
        const newContainer = this.renderPostAuthor();
        container.parentNode.replaceChild(newContainer, container);
    }

    /**
     * Render crosspost section showing which communities this post was cross-posted to
     * @returns {HTMLElement|null} Crosspost section element or null if no crossposts
     */
    renderCrosspostSection() {
        // Only show if there are crossposts
        if (!this.post.crossPosts || this.post.crossPosts.length === 0) {
            return null;
        }

        return DOM.createElement('div', {
            className: 'crosspost-section mb-3 mt-3'
        }, [
            DOM.createElement('small', {
                className: 'text-muted fw-medium d-block mb-2'
            }, 'Cross-posted in:'),
            DOM.createElement('div', {
                className: 'd-flex flex-wrap gap-3'
            }, this.post.crossPosts.map(crosspost => {
                // Extract instance from community actor_id
                let instanceDomain = '';
                if (crosspost.community.actor_id) {
                    try {
                        const url = new URL(crosspost.community.actor_id);
                        instanceDomain = url.hostname;
                    } catch (e) {
                        instanceDomain = 'unknown.instance';
                    }
                }

                // Format as !community@instance.tld
                const communityDisplayName = `!${crosspost.community.name}@${instanceDomain}`;

                return DOM.createElement('a', {
                    href: `/post/${crosspost.id}`,
                    className: 'text-primary text-decoration-none fw-medium',
                    'data-crosspost-id': crosspost.id,
                    onclick: (e) => {
                        e.preventDefault();
                        window.location.href = `/post/${crosspost.id}`;
                    },
                    title: `View this post in ${crosspost.community.title || crosspost.community.name}`
                }, communityDisplayName);
            }))
        ]);
    }

    /**
     * Render comment form for creating new comments
     * @returns {HTMLElement} Comment form element
     */
    renderCommentForm() {
        return DOM.createElement('div', {
            className: 'comment-form-section mb-4',
            id: 'comment-form-container',
            style: 'display: none;'
        }, [
            DOM.createElement('div', {
                className: 'comment-form-header d-flex justify-content-between align-items-center mb-3'
            }, [
                DOM.createElement('h6', {
                    className: 'mb-0'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-chat-dots me-2'
                    }),
                    'Add a Comment'
                ]),
                DOM.createElement('button', {
                    type: 'button',
                    className: 'btn-close btn-close-sm',
                    'data-action': 'close-comment-form',
                    title: 'Close comment form'
                })
            ]),
            DOM.createElement('form', {
                id: 'comment-form',
                className: 'comment-form'
            }, [
                DOM.createElement('div', {
                    className: 'mb-3'
                }, [
                    DOM.createElement('label', {
                        for: 'comment-content',
                        className: 'form-label visually-hidden'
                    }, 'Comment'),
                    DOM.createElement('textarea', {
                        className: 'form-control',
                        id: 'comment-content',
                        rows: '4',
                        placeholder: 'Write your comment here...',
                        required: true,
                        'data-action': 'comment-input'
                    }),
                    DOM.createElement('div', {
                        className: 'form-text'
                    }, [
                        'Supports ',
                        DOM.createElement('i', {
                            className: 'bi bi-link-45deg me-1'
                        }),
                        'Markdown',
                        ' formatting'
                    ])
                ]),
                DOM.createElement('div', {
                    className: 'd-flex justify-content-between align-items-center'
                }, [
                    DOM.createElement('div', {
                        className: 'comment-form-actions d-flex gap-2'
                    }, [
                        DOM.createElement('button', {
                            type: 'button',
                            className: 'btn btn-outline-secondary btn-sm',
                            'data-action': 'preview-comment',
                            title: 'Preview comment'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-eye me-1'
                            }),
                            'Preview'
                        ]),
                        DOM.createElement('button', {
                            type: 'button',
                            className: 'btn btn-outline-secondary btn-sm',
                            'data-action': 'clear-comment',
                            title: 'Clear comment'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-trash me-1'
                            }),
                            'Clear'
                        ])
                    ]),
                                            DOM.createElement('button', {
                            type: 'submit',
                            className: 'btn btn-primary',
                            'data-action': 'submit-comment',
                            disabled: true
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-send me-1'
                            }),
                            'Post Comment'
                        ])
                ])
            ]),
            DOM.createElement('div', {
                className: 'comment-preview mt-3',
                id: 'comment-preview',
                style: 'display: none;'
            }, [
                DOM.createElement('div', {
                    className: 'card'
                }, [
                    DOM.createElement('div', {
                        className: 'card-header d-flex justify-content-between align-items-center'
                    }, [
                        DOM.createElement('small', {
                            className: 'text-muted'
                        }, 'Preview'),
                        DOM.createElement('button', {
                            type: 'button',
                            className: 'btn-close btn-close-sm',
                            'data-action': 'close-preview',
                            title: 'Close preview'
                        })
                    ]),
                    DOM.createElement('div', {
                        className: 'card-body'
                    }, [
                        DOM.createElement('div', {
                            id: 'comment-preview-content'
                        })
                    ])
                ])
            ])
        ]);
    }

    /**
     * Set up event listeners for the comment form
     */
    setupCommentFormEventListeners() {
        // Use event delegation for form submission
        this.element.addEventListener('submit', (event) => {
            if (event.target.id === 'comment-form') {
                this.handleCommentSubmit(event);
            }
        });

        // Use event delegation for input changes
        this.element.addEventListener('input', (event) => {
            if (event.target.id === 'comment-content') {
                this.handleCommentInputChange();
            }
        });
        
        // Also add a direct click handler as backup
        this.element.addEventListener('click', (event) => {
            if (event.target.closest('[data-action="submit-comment"]')) {
                const form = event.target.closest('form');
                if (form && form.id === 'comment-form') {
                    form.dispatchEvent(new Event('submit', { bubbles: true }));
                }
            }
        });
    }

    /**
     * Show comment form
     */
    showCommentForm() {
        const container = document.getElementById('comment-form-container');
        if (!container) return;

        // Show the form
        container.style.display = 'block';
        

        
        // Focus on the textarea
        const textarea = document.getElementById('comment-content');
        if (textarea) {
            textarea.focus();
        }
        
        // Scroll to the form for better UX
        container.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }

    /**
     * Close comment form
     */
    closeCommentForm() {
        const container = document.getElementById('comment-form-container');
        if (!container) return;

        // Hide the form
        container.style.display = 'none';
        
        // Clear the form
        this.clearComment();
    }

    /**
     * Handle comment input changes
     */
    handleCommentInputChange() {
        const textarea = document.getElementById('comment-content');
        const submitBtn = document.querySelector('[data-action="submit-comment"]');
        
        if (!textarea || !submitBtn) return;

        const hasContent = textarea.value.trim().length > 0;
        submitBtn.disabled = !hasContent;
    }

    /**
     * Preview comment content
     */
    previewComment() {
        const textarea = document.getElementById('comment-content');
        const previewContainer = document.getElementById('comment-preview');
        const previewContent = document.getElementById('comment-preview-content');
        
        if (!textarea || !previewContainer || !previewContent) return;

        const content = textarea.value.trim();
        if (!content) {
            DOM.showToast('Please enter some content to preview', 'info');
            return;
        }

        // Process markdown content
        const processedContent = processCommentContent(content);
        previewContent.innerHTML = processedContent;
        previewContainer.style.display = 'block';
    }

    /**
     * Close comment preview
     */
    closeCommentPreview() {
        const previewContainer = document.getElementById('comment-preview');
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
    }

    /**
     * Clear comment form
     */
    clearComment() {
        const textarea = document.getElementById('comment-content');
        const submitBtn = document.querySelector('[data-action="submit-comment"]');
        const previewContainer = document.getElementById('comment-preview');
        
        if (textarea) {
            textarea.value = '';
            textarea.focus();
        }
        
        if (submitBtn) {
            submitBtn.disabled = true;
        }
        
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
    }

    /**
     * Handle comment form submission
     */
    async handleCommentSubmit(event) {
        event.preventDefault();
        
        // Import authManager at runtime to avoid circular dependencies
        const { authManager } = await import('../auth.js');
        
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            DOM.showToast('Please log in to comment', 'info');
            return;
        }

        const textarea = document.getElementById('comment-content');
        const submitBtn = document.querySelector('[data-action="submit-comment"]');
        
        if (!textarea || !submitBtn) return;

        const content = textarea.value.trim();
        if (!content) {
            DOM.showToast('Please enter a comment', 'info');
            return;
        }

        // Disable submit button and show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = [
            DOM.createElement('span', {
                className: 'spinner-border spinner-border-sm me-2'
            }),
            'Posting...'
        ].map(el => el.outerHTML || el).join('');

        try {
            // Create comment via API
            const commentData = {
                content: content,
                post_id: this.post.id
            };

            const response = await this.api.createComment(commentData);
            
            if (response && response.comment_view) {
                // Show success message
                DOM.showToast('Comment posted successfully!', 'success');
                
                // Clear the form
                this.clearComment();
                
                // Close the comment form panel
                this.closeCommentForm();
                
                // Reload comments with current sort order to show the new one
                await this.loadComments(this.currentCommentSort);
                
                // Scroll to the new comment
                this.scrollToNewComment(response.comment_view.comment.id);
            } else {
                throw new Error('Invalid response from server');
            }

        } catch (error) {
            DOM.showToast('Failed to post comment. Please try again.', 'error');
            
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = [
                DOM.createElement('i', {
                    className: 'bi bi-send me-1'
                }),
                'Post Comment'
            ].map(el => el.outerHTML || el).join('');
        }
    }

    /**
     * Render comment options dropdown menu
     * @param {Object} comment - Comment data
     * @returns {Array} Array of dropdown menu items
     */
    renderCommentOptions(comment) {
        const menuItems = [];
        
        // Check if this is the current user's comment
        const isOwnComment = this.isCurrentUserComment(comment);
        
        if (isOwnComment) {
            // User's own comment - show appropriate options based on deletion state
            if (!comment.deleted) {
                // Non-deleted comment - show edit and delete options
                menuItems.push(
                    DOM.createElement('li', {}, [
                        DOM.createElement('button', {
                            className: 'dropdown-item',
                            type: 'button',
                            'data-action': 'edit-comment',
                            'data-comment-id': comment.id,
                            title: 'Edit this comment'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-pencil me-2'
                            }),
                            'Edit Comment'
                        ])
                    ]),
                    DOM.createElement('li', {}, [
                        DOM.createElement('hr', {
                            className: 'dropdown-divider'
                        })
                    ])
                );
            }
            
            // Always show delete/restore option
            menuItems.push(
                DOM.createElement('li', {}, [
                    DOM.createElement('button', {
                        className: 'dropdown-item text-danger',
                        type: 'button',
                        'data-action': 'delete-comment',
                        'data-comment-id': comment.id,
                        title: comment.deleted ? 'Restore this comment' : 'Delete this comment permanently'
                    }, [
                        DOM.createElement('i', {
                            className: comment.deleted ? 'bi bi-arrow-clockwise me-2' : 'bi bi-trash me-2'
                        }),
                        comment.deleted ? 'Restore Comment' : 'Delete Comment'
                    ])
                ])
            );
        } else {
            // Other user's comment - show report option
            menuItems.push(
                DOM.createElement('li', {}, [
                    DOM.createElement('button', {
                        className: 'dropdown-item text-warning',
                        type: 'button',
                        'data-action': 'report-comment',
                        'data-comment-id': comment.id,
                        title: 'Report this comment'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-flag me-2'
                        }),
                        'Report Comment'
                    ])
                ])
            );
        }
        
        return menuItems;
    }

    /**
     * Render comment action buttons
     * @param {Object} comment - Comment data
     * @returns {Array} Array of action button elements
     */
    renderCommentActions(comment) {
        const actionButtons = [];
        
        // Determine vote button classes based on user's vote
        const upvoteClasses = ['btn', 'btn-sm', 'btn-link', 'p-0'];
        const downvoteClasses = ['btn', 'btn-sm', 'btn-link', 'p-0'];
        
        if (comment.myVote === 1) {
            upvoteClasses.push('voted', 'upvote-btn');
        } else {
            upvoteClasses.push('text-muted');
        }
        
        if (comment.myVote === -1) {
            downvoteClasses.push('voted', 'downvote-btn');
        } else {
            downvoteClasses.push('text-muted');
        }

        // Build action buttons based on comment state
        if (comment.deleted) {
            // For deleted comments, show options dropdown (for restore functionality) and collapse button if needed
            actionButtons.push(
                // Comment options dropdown (needed for restore functionality)
                DOM.createElement('div', {
                    className: 'dropdown comment-options-dropdown'
                }, [
                    DOM.createElement('button', {
                        className: 'btn btn-sm btn-link text-muted p-0 dropdown-toggle',
                        type: 'button',
                        'data-bs-toggle': 'dropdown',
                        'data-comment-id': comment.id,
                        'aria-expanded': 'false',
                        title: 'Comment options'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-three-dots-vertical'
                        })
                    ]),
                    DOM.createElement('ul', {
                        className: 'dropdown-menu dropdown-menu-end'
                    }, this.renderCommentOptions(comment))
                ])
            );
            
            // Add collapse button if comment has children
            if (comment.children && comment.children.length > 0) {
                actionButtons.push(DOM.createElement('button', {
                    className: 'btn btn-sm btn-link text-muted p-0',
                    'data-action': 'toggle-collapse',
                    'data-comment-id': comment.id,
                    'aria-label': 'Collapse comment thread'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-dash-square me-1'
                    }),
                    'Collapse'
                ]));
            }
        } else {
            // Normal comment actions for non-deleted comments
            actionButtons.push(
                DOM.createElement('button', {
                    className: upvoteClasses.join(' '),
                    'data-action': 'upvote-comment',
                    'data-comment-id': comment.id,
                    'aria-label': `Upvote (${comment.stats.upvotes} upvotes)`,
                    title: comment.myVote === 1 ? 'Remove upvote' : 'Upvote'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-arrow-up me-1'
                    }),
                    DOM.createElement('span', {
                        className: 'vote-count'
                    }, APIUtils.formatNumber(comment.stats.upvotes))
                ]),
                DOM.createElement('button', {
                    className: downvoteClasses.join(' '),
                    'data-action': 'downvote-comment',
                    'data-comment-id': comment.id,
                    'aria-label': `Downvote (${comment.stats.downvotes} downvotes)`,
                    title: comment.myVote === -1 ? 'Remove downvote' : 'Downvote'
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-arrow-down me-1'
                    }),
                    DOM.createElement('span', {
                        className: 'vote-count'
                    }, APIUtils.formatNumber(comment.stats.downvotes))
                ]),
                DOM.createElement('button', {
                    className: 'btn btn-sm btn-link text-muted p-0',
                    'data-action': 'reply-comment',
                    'data-comment-id': comment.id
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-reply me-1'
                    }),
                    'Reply'
                ]),
                // Comment options dropdown
                DOM.createElement('div', {
                    className: 'dropdown comment-options-dropdown'
                }, [
                    DOM.createElement('button', {
                        className: 'btn btn-sm btn-link text-muted p-0 dropdown-toggle',
                        type: 'button',
                        'data-bs-toggle': 'dropdown',
                        'data-comment-id': comment.id,
                        'aria-expanded': 'false',
                        title: 'Comment options'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-three-dots-vertical'
                        })
                    ]),
                    DOM.createElement('ul', {
                        className: 'dropdown-menu dropdown-menu-end'
                    }, this.renderCommentOptions(comment))
                ])
            );
        }



        return actionButtons;
    }

    /**
     * Scroll to a newly posted comment
     * @param {number} commentId - Comment ID to scroll to
     */
    scrollToNewComment(commentId) {
        // Wait a bit for the comment to be rendered
        setTimeout(() => {
            const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
            if (commentElement) {
                commentElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
                
                // Removed bright yellow highlighting - no longer needed for debugging
            }
        }, 500);
    }

    /**
     * Handle post-related actions
     * @param {Event} event - Click event
     */
    handlePostActions(event) {
        const target = event.target;
        const action = target.dataset.action || target.closest('[data-action]')?.dataset.action;

        if (!action) return;

        // Only handle post actions, not comment actions
        const isCommentAction = target.closest('.comment') || target.closest('.comment-actions');
        if (isCommentAction) return;

        event.preventDefault();
        event.stopPropagation();

        switch (action) {
            case 'share':
                this.handleShare();
                break;
            case 'save':
                this.handleSave();
                break;
            case 'crosspost':
                this.handleCrosspost();
                break;
            case 'edit-post':
                this.handleEditPost();
                break;
            case 'delete-post':
                this.handleDeletePost();
                break;
            case 'upvote':
                this.handleVote(1);
                break;
            case 'downvote':
                this.handleVote(-1);
                break;
        }
    }

    /**
     * Handle post sharing
     */
    async handleShare() {
        try {
            // Generate clean post URL using the current instance
            const postUrl = `${window.location.origin}/post/${this.post.id}`;
            
            const shareData = {
                title: this.post.title,
                url: postUrl,
                text: this.post.content ? TextUtils.truncate(this.post.content, 100) : this.post.title
            };

            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(shareData.url);
                DOM.showToast('Link copied to clipboard!', 'success');
            }
        } catch (error) {
            DOM.showToast('Unable to share post', 'error');
        }
    }

    /**
     * Handle post saving
     */
    async handleSave() {
        // TODO: Implement post saving functionality
    }

    /**
     * Handle cross-posting
     */
    async handleCrosspost() {
        // Import authManager at runtime to avoid circular dependencies
        const { authManager } = await import('../auth.js');
        
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            DOM.showToast('Please log in to cross-post', 'info');
            return;
        }

        // Show the cross-post modal
        this.showCrosspostModal();
    }

    /**
     * Show the cross-post modal
     */
    showCrosspostModal() {
        // Create and show the cross-post modal
        const modal = this.createCrosspostModal();
        document.body.appendChild(modal);
        
        // Initialize Bootstrap modal
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
        
        // Clean up when modal is hidden
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    /**
     * Create the cross-post modal
     * @returns {HTMLElement} Modal element
     */
    createCrosspostModal() {
        const modal = DOM.createElement('div', {
            className: 'modal fade',
            id: 'crosspostModal',
            tabindex: '-1',
            'aria-labelledby': 'crosspostModalLabel',
            'aria-hidden': 'true'
        }, [
            DOM.createElement('div', {
                className: 'modal-dialog modal-lg'
            }, [
                DOM.createElement('div', {
                    className: 'modal-content'
                }, [
                    DOM.createElement('div', {
                        className: 'modal-header'
                    }, [
                        DOM.createElement('h5', {
                            className: 'modal-title',
                            id: 'crosspostModalLabel'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-arrow-repeat me-2'
                            }),
                            'Cross-post to Another Community'
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
                        DOM.createElement('form', {
                            id: 'crosspost-form'
                        }, [
                            // Community Selection
                            DOM.createElement('div', {
                                className: 'mb-4'
                            }, [
                                DOM.createElement('label', {
                                    className: 'form-label'
                                }, [
                                    DOM.createElement('i', {
                                        className: 'bi bi-people me-1'
                                    }),
                                    'Target Community *'
                                ]),
                                DOM.createElement('div', {
                                    id: 'crosspost-community-select-container'
                                }),
                                DOM.createElement('div', {
                                    className: 'invalid-feedback',
                                    id: 'crosspost-community-invalid-feedback'
                                }, 'Please select a community for your cross-post.')
                            ]),
                            // Additional Text
                            DOM.createElement('div', {
                                className: 'mb-4'
                            }, [
                                DOM.createElement('label', {
                                    for: 'crosspost-additional-text',
                                    className: 'form-label'
                                }, [
                                    DOM.createElement('i', {
                                        className: 'bi bi-chat-text me-1'
                                    }),
                                    'Additional Text (Optional)'
                                ]),
                                DOM.createElement('textarea', {
                                    className: 'form-control',
                                    id: 'crosspost-additional-text',
                                    rows: '4',
                                    placeholder: 'Add any additional context or commentary for the cross-post...'
                                }),
                                DOM.createElement('div', {
                                    className: 'form-text'
                                }, 'You can add context or commentary to explain why you\'re cross-posting this content.')
                            ]),
                            // Preview Section
                            DOM.createElement('div', {
                                className: 'mb-4'
                            }, [
                                DOM.createElement('label', {
                                    className: 'form-label'
                                }, [
                                    DOM.createElement('i', {
                                        className: 'bi bi-eye me-1'
                                    }),
                                    'Cross-post Preview'
                                ]),
                                DOM.createElement('div', {
                                    className: 'crosspost-preview border rounded p-3'
                                }, [
                                    DOM.createElement('h6', {
                                        className: 'mb-2'
                                    }, this.post.title),
                                    this.post.url ? DOM.createElement('div', {
                                        className: 'mb-2'
                                    }, [
                                        DOM.createElement('small', {
                                            className: 'text-muted'
                                        }, [
                                            'Link: ',
                                            DOM.createElement('a', {
                                                href: this.post.url,
                                                target: '_blank',
                                                rel: 'noopener noreferrer'
                                            }, this.post.url)
                                        ])
                                    ]) : null,
                                    this.post.content ? DOM.createElement('div', {
                                        className: 'mb-2'
                                    }, [
                                        DOM.createElement('small', {
                                            className: 'text-muted'
                                        }, this.post.content.replace(/^/gm, '> '))
                                    ]) : null,
                                    null
                                ].filter(Boolean))
                            ])
                        ])
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
                            id: 'crosspost-submit-btn'
                        }, [
                            DOM.createElement('i', {
                                className: 'bi bi-arrow-repeat me-1'
                            }),
                            'Create Cross-post'
                        ])
                    ])
                ])
            ])
        ]);

        // Initialize community selection after modal is created
        this.initializeCrosspostCommunitySelect(modal);
        
        // Set up form submission
        this.setupCrosspostFormSubmission(modal);

        return modal;
    }

    /**
     * Initialize the community selection for cross-posting
     * @param {HTMLElement} modal - The modal element
     */
    async initializeCrosspostCommunitySelect(modal) {
        try {
            // Import SearchableSelect at runtime to avoid circular dependencies
            const { SearchableSelect } = await import('../components/searchable-select.js');
            
            // Load communities
            const response = await this.api.getCommunities({
                type_: 'All',
                sort: 'Active',
                limit: 50
            });
            
            const communities = response.communities || [];
            
            // Convert communities to SearchableSelect format and sort local first
            const communityOptions = this.formatCommunityOptions(communities);
            
            // Initialize SearchableSelect
            this.crosspostCommunitySelect = new SearchableSelect('crosspost-community-select-container', {
                placeholder: 'Select a community...',
                searchPlaceholder: 'Search communities...',
                initialOptions: communityOptions,
                onSelect: (option) => this.handleCrosspostCommunitySelect(option),
                onSearch: (searchText) => this.searchCrosspostCommunities(searchText)
            });

        } catch (error) {
            DOM.showToast('Failed to load communities', 'error');
        }
    }

    /**
     * Format community options for the searchable select
     * @param {Array} communities - Array of community data
     * @returns {Array} Formatted community options
     */
    formatCommunityOptions(communities) {
        return this.addGroupHeaders(communities
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

    /**
     * Format community name for display
     * @param {Object} community - Community data
     * @returns {string} Formatted community name
     */
    formatCommunityName(community) {
        const communityData = community.community;
        
        // Check if community is local to current instance
        if (communityData.local) {
            return communityData.name;
        } else {
            // For remote communities, use name@instance format
            try {
                const actorUrl = new URL(communityData.actor_id);
                const instance = actorUrl.hostname;
                return `${communityData.name}@${instance}`;
            } catch (error) {
                return `${communityData.name} (remote)`;
            }
        }
    }

    /**
     * Format community subtitle for display
     * @param {Object} community - Community data
     * @returns {string} Formatted community subtitle
     */
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

    /**
     * Add group headers to community options
     * @param {Array} communities - Array of community options
     * @returns {Array} Community options with headers
     */
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

    /**
     * Search communities for cross-posting
     * @param {string} searchText - Search query
     * @returns {Promise<Array>} Search results
     */
    async searchCrosspostCommunities(searchText) {
        if (!searchText || searchText.length < 2) {
            // Return initial communities for empty search
            const response = await this.api.getCommunities({
                type_: 'All',
                sort: 'Active',
                limit: 50
            });
            const communities = response.communities || [];
            return this.formatCommunityOptions(communities);
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
            return this.formatCommunityOptions(searchResults);
        } catch (error) {
            return [];
        }
    }

    /**
     * Handle community selection for cross-posting
     * @param {Object} option - Selected community option
     */
    handleCrosspostCommunitySelect(option) {
        this.selectedCrosspostCommunity = option.data;
        this.selectedCrosspostCommunityId = option.value;
        
        // Clear validation error
        const feedback = document.getElementById('crosspost-community-invalid-feedback');
        if (feedback) {
            feedback.style.display = 'none';
        }
    }

    /**
     * Set up cross-post form submission
     * @param {HTMLElement} modal - The modal element
     */
    setupCrosspostFormSubmission(modal) {
        const submitBtn = modal.querySelector('#crosspost-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.submitCrosspost();
            });
        }
    }

    /**
     * Submit the cross-post
     */
    async submitCrosspost() {
        // Validate form
        if (!this.selectedCrosspostCommunityId) {
            const feedback = document.getElementById('crosspost-community-invalid-feedback');
            if (feedback) {
                feedback.style.display = 'block';
            }
            return;
        }

        // Check if user is trying to cross-post to the same community
        if (this.selectedCrosspostCommunityId === this.post.community.id?.toString()) {
            DOM.showToast('You cannot cross-post to the same community', 'warning');
            return;
        }

        // Check if user is banned from the target community
        if (this.selectedCrosspostCommunity && this.selectedCrosspostCommunity.banned_from_community) {
            DOM.showToast('You are banned from posting in this community', 'error');
            return;
        }

        // Get additional text
        const additionalText = document.getElementById('crosspost-additional-text')?.value || '';
        
        // Disable submit button and show loading state
        const submitBtn = document.getElementById('crosspost-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = [
                DOM.createElement('span', {
                    className: 'spinner-border spinner-border-sm me-2'
                }),
                'Creating Cross-post...'
            ].map(el => el.outerHTML || el).join('');
        }

        try {
            // Prepare post data
            const postData = {
                name: this.post.title,
                community_id: parseInt(this.selectedCrosspostCommunityId),
                url: this.post.url || undefined,
                body: this.buildCrosspostBody(additionalText),
                nsfw: this.post.nsfw || false
            };

            // Remove undefined values
            Object.keys(postData).forEach(key => {
                if (postData[key] === undefined) {
                    delete postData[key];
                }
            });

            // Create the cross-post
            const response = await this.api.createPost(postData);
            
            if (response && response.post_view) {
                // Show success message
                DOM.showToast('Cross-post created successfully!', 'success');
                
                // Close modal
                const modal = document.getElementById('crosspostModal');
                if (modal) {
                    const bootstrapModal = bootstrap.Modal.getInstance(modal);
                    if (bootstrapModal) {
                        bootstrapModal.hide();
                    }
                }
                
                // Optionally redirect to the new post
                const newPostId = response.post_view.post.id;
                if (newPostId) {
                    setTimeout(() => {
                        window.location.href = `/post/${newPostId}`;
                    }, 1500);
                }
            } else {
                throw new Error('Invalid response from server');
            }

        } catch (error) {
            DOM.showToast('Failed to create cross-post. Please try again.', 'error');
            
            // Re-enable submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = [
                    DOM.createElement('i', {
                        className: 'bi bi-arrow-repeat me-1'
                    }),
                    'Create Cross-post'
                ].map(el => el.outerHTML || el).join('');
            }
        }
    }

    /**
     * Build the body content for the cross-post
     * @param {string} additionalText - Additional text from user
     * @returns {string} Formatted body content
     */
    buildCrosspostBody(additionalText) {
        let body = '';
        
        // Add original post content as blockquote if it exists
        if (this.post.content && this.post.content.trim()) {
            const quotedOriginal = this.post.content.replace(/^/gm, '> ');
            body += quotedOriginal;
        }
        
        // Add additional user text if provided (unquoted), separated by a horizontal rule
        if (additionalText && additionalText.trim()) {
            if (body) body += '\n\n---\n\n';
            body += additionalText.trim();
        }
        
        return body;
    }

    /**
     * Check if post management options should be shown
     * @returns {boolean} True if management options should be shown
     */
    shouldShowPostManagement() {
        // For now, just check if we have post author info
        // The actual auth check will happen when the user clicks the action
        // In the future, this could be enhanced to check if the current user is the author
        return this.post.author && this.post.author.name;
    }

    /**
     * Render post management dropdown for post author
     * @returns {HTMLElement} Post management dropdown
     */
    renderPostManagementDropdown() {
        const isDeleted = this.post.deleted;
        
        return DOM.createElement('div', {
            className: 'dropdown post-management-dropdown'
        }, [
            DOM.createElement('button', {
                className: 'btn btn-sm btn-outline-secondary dropdown-toggle',
                type: 'button',
                'data-bs-toggle': 'dropdown',
                'aria-expanded': 'false',
                title: 'Post management options'
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-gear me-1'
                }),
                'Manage'
            ]),
            DOM.createElement('ul', {
                className: 'dropdown-menu dropdown-menu-end'
            }, [
                // Edit option - only show if not deleted
                !isDeleted ? DOM.createElement('li', {}, [
                    DOM.createElement('button', {
                        className: 'dropdown-item',
                        type: 'button',
                        'data-action': 'edit-post',
                        title: 'Edit this post'
                    }, [
                        DOM.createElement('i', {
                            className: 'bi bi-pencil me-2'
                        }),
                        'Edit Post'
                    ])
                ]) : null,
                // Divider - only show if we have both edit and delete/restore
                !isDeleted ? DOM.createElement('li', {}, [
                    DOM.createElement('hr', {
                        className: 'dropdown-divider'
                    })
                ]) : null,
                // Delete/Restore option
                DOM.createElement('li', {}, [
                    DOM.createElement('button', {
                        className: `dropdown-item ${isDeleted ? 'text-success' : 'text-danger'}`,
                        type: 'button',
                        'data-action': 'delete-post',
                        title: isDeleted ? 'Restore this post' : 'Delete this post permanently'
                    }, [
                        DOM.createElement('i', {
                            className: `bi ${isDeleted ? 'bi-arrow-clockwise' : 'bi-trash'} me-2`
                        }),
                        isDeleted ? 'Restore Post' : 'Delete Post'
                    ])
                ])
            ].filter(Boolean))
        ]);
    }

    /**
     * Handle edit post
     */
    async handleEditPost() {
        // Import authManager at runtime to avoid circular dependencies
        const { authManager } = await import('../auth.js');
        
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            DOM.showToast('Please log in to edit posts', 'info');
            return;
        }

        // Check if current user is the post author
        const currentUser = authManager.getCurrentUser();
        if (!currentUser || currentUser.name !== this.post.author.name) {
            DOM.showToast('You can only edit your own posts', 'error');
            return;
        }

        // Show the edit post modal
        this.showEditPostModal();
    }

    /**
     * Show the edit post modal
     */
    showEditPostModal() {
        // Populate the form with current post data
        this.populateEditForm();
        
        // Set up event listeners for the edit form
        this.setupEditFormEventListeners();
        
        // Show the modal
        const editModal = new bootstrap.Modal(document.getElementById('editPostModal'));
        editModal.show();
    }

    /**
     * Populate the edit form with current post data
     */
    populateEditForm() {
        const titleField = document.getElementById('edit-post-title');
        const urlField = document.getElementById('edit-post-url');
        const bodyField = document.getElementById('edit-post-body');
        const nsfwField = document.getElementById('edit-post-nsfw');
        const languageField = document.getElementById('edit-post-language');

        if (titleField) titleField.value = this.post.title || '';
        if (urlField) urlField.value = this.post.url || '';
        if (bodyField) bodyField.value = this.post.content || '';
        if (nsfwField) nsfwField.checked = this.post.nsfw || false;
        if (languageField) {
            // Set the current language if available
            if (this.post.language_id) {
                languageField.value = this.post.language_id;
            }
        }

        // Update character counts
        this.updateEditCharacterCounts();
        
        // Load languages if not already loaded
        this.loadLanguagesForEdit();
    }

    /**
     * Set up event listeners for the edit form
     */
    setupEditFormEventListeners() {
        const form = document.getElementById('editPostForm');
        const titleField = document.getElementById('edit-post-title');
        const bodyField = document.getElementById('edit-post-body');
        const previewToggle = document.getElementById('edit-preview-toggle');
        const previewBtn = document.getElementById('edit-preview-btn');

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditPostSubmit();
            });
        }

        if (titleField) {
            titleField.addEventListener('input', () => {
                this.updateEditCharacterCounts();
            });
        }

        if (bodyField) {
            bodyField.addEventListener('input', () => {
                this.updateEditCharacterCounts();
            });
        }

        if (previewToggle) {
            previewToggle.addEventListener('click', () => {
                this.toggleEditPreview();
            });
        }

        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.showEditPreview();
            });
        }
    }

    /**
     * Update character counts for edit form
     */
    updateEditCharacterCounts() {
        const titleField = document.getElementById('edit-post-title');
        const bodyField = document.getElementById('edit-post-body');
        const titleCount = document.getElementById('edit-title-count');
        const bodyCount = document.getElementById('edit-body-count');

        if (titleField && titleCount) {
            titleCount.textContent = titleField.value.length;
        }

        if (bodyField && bodyCount) {
            bodyCount.textContent = bodyField.value.length;
        }
    }

    /**
     * Load languages for the edit form
     */
    async loadLanguagesForEdit() {
        try {
            const languageField = document.getElementById('edit-post-language');
            if (!languageField) return;

            // Check if languages are already loaded
            if (languageField.children.length > 1) return;

            const response = await this.api.getSite();
            if (response && response.all_languages) {
                // Clear loading option
                languageField.innerHTML = '';
                
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'No specific language';
                languageField.appendChild(defaultOption);

                // Add language options
                response.all_languages.forEach(lang => {
                    const option = document.createElement('option');
                    option.value = lang.id;
                    option.textContent = lang.name;
                    languageField.appendChild(option);
                });

                // Set current language if available
                if (this.post.language_id) {
                    languageField.value = this.post.language_id;
                }
            }
        } catch (error) {
        }
    }

    /**
     * Toggle edit preview
     */
    toggleEditPreview() {
        const previewContent = document.getElementById('edit-preview-content');
        const previewToggle = document.getElementById('edit-preview-toggle');
        
        if (!previewContent || !previewToggle) return;

        const isVisible = previewContent.style.display !== 'none';
        
        if (isVisible) {
            previewContent.style.display = 'none';
            previewToggle.innerHTML = [
                DOM.createElement('i', { className: 'bi bi-eye me-1' }),
                'Show Preview'
            ].map(el => el.outerHTML || el).join('');
        } else {
            this.showEditPreview();
            previewToggle.innerHTML = [
                DOM.createElement('i', { className: 'bi bi-eye-slash me-1' }),
                'Hide Preview'
            ].map(el => el.outerHTML || el).join('');
        }
    }

    /**
     * Show edit preview
     */
    async showEditPreview() {
        const titleField = document.getElementById('edit-post-title');
        const urlField = document.getElementById('edit-post-url');
        const bodyField = document.getElementById('edit-post-body');
        const previewContent = document.getElementById('edit-preview-content');
        
        if (!titleField || !previewContent) return;

        const title = titleField.value.trim();
        const url = urlField.value.trim();
        const body = bodyField.value.trim();

        if (!title && !body) {
            DOM.showToast('Please enter some content to preview', 'info');
            return;
        }

        // Create preview HTML
        let previewHTML = '';
        
        if (title) {
            previewHTML += `<h4 class="mb-3">${title}</h4>`;
        }
        
        if (url) {
            previewHTML += `<p class="mb-3"><a href="${url}" target="_blank" class="text-decoration-none">${url}</a></p>`;
        }
        
        if (body) {
            // Process markdown content
            try {
                        const { processPostContent } = await import('../markdown-it-setup.js');
        previewHTML += `<div class="post-body">${processPostContent(body)}</div>`;
            } catch (error) {
                // Fallback to plain text
                previewHTML += `<div class="post-body"><pre>${body}</pre></div>`;
            }
        }

        previewContent.innerHTML = previewHTML;
        previewContent.style.display = 'block';
    }

    /**
     * Handle edit post form submission
     */
    async handleEditPostSubmit() {
        const titleField = document.getElementById('edit-post-title');
        const urlField = document.getElementById('edit-post-url');
        const bodyField = document.getElementById('edit-post-body');
        const nsfwField = document.getElementById('edit-post-nsfw');
        const languageField = document.getElementById('edit-post-language');
        const submitBtn = document.getElementById('edit-post-submit');

        if (!titleField || !submitBtn) return;

        const title = titleField.value.trim();
        const url = urlField.value.trim();
        const body = bodyField.value.trim();
        const nsfw = nsfwField ? nsfwField.checked : false;
        const languageId = languageField && languageField.value ? parseInt(languageField.value) : undefined;

        if (!title) {
            DOM.showToast('Please provide a title for your post', 'error');
            return;
        }

        // Disable submit button and show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = [
            DOM.createElement('span', {
                className: 'spinner-border spinner-border-sm me-2'
            }),
            'Saving...'
        ].map(el => el.outerHTML || el).join('');

        try {
            // Prepare edit data
            const editData = {
                post_id: this.post.id,
                name: title
            };

            // Add optional fields if they have values
            if (url) editData.url = url;
            if (body) editData.body = body;
            if (nsfw !== undefined) editData.nsfw = nsfw;
            if (languageId) editData.language_id = languageId;

            // Call API to edit post
            const response = await this.api.editPost(editData);

            if (response && response.post_view) {
                // Update post data
                this.updatePostData(response.post_view);
                
                // Show success message
                DOM.showToast('Post updated successfully!', 'success');
                
                // Close the modal
                const editModal = bootstrap.Modal.getInstance(document.getElementById('editPostModal'));
                if (editModal) {
                    editModal.hide();
                }
                
                // Refresh the post display
                this.refreshPostDisplay();
            } else {
                throw new Error('Invalid response from server');
            }

        } catch (error) {
            
            let errorMessage = 'Failed to edit post. Please try again.';
            if (error.message && error.message.includes('rate')) {
                errorMessage = 'Rate limited. Please wait a moment before trying again.';
            } else if (error.message && error.message.includes('unauthorized')) {
                errorMessage = 'You are not authorized to edit this post.';
            } else if (error.message && error.message.includes('not found')) {
                errorMessage = 'Post not found or already deleted.';
            }
            
            DOM.showToast(errorMessage, 'error');
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = [
                DOM.createElement('i', { className: 'bi bi-check-circle me-1' }),
                'Save Changes'
            ].map(el => el.outerHTML || el).join('');
        }
    }

    /**
     * Update post data after successful edit
     * @param {Object} postView - Updated post view from API
     */
    updatePostData(postView) {
        const post = postView.post;
        
        // Update post properties
        this.post.title = post.name;
        this.post.content = post.body;
        this.post.url = post.url;
        this.post.nsfw = post.nsfw;
        this.post.language_id = post.language_id;
        this.post.updated = post.updated ? new Date(post.updated) : null;
    }

    /**
     * Refresh the post display after editing
     */
    refreshPostDisplay() {
        // Update post title
        const titleElement = this.element.querySelector('.post-title');
        if (titleElement) {
            titleElement.textContent = this.post.title;
        }

        // Update post content
        const contentElement = this.element.querySelector('.post-detail-content');
        if (contentElement) {
            // Re-render the entire content section
            const newContent = this.renderPostContent();
            contentElement.innerHTML = newContent.innerHTML;
        }

        // Update post meta to show "edited" indicator
        this.updatePostMeta();
    }

    /**
     * Update post meta information to show edit status
     */
    updatePostMeta() {
        const metaElement = this.element.querySelector('.post-meta');
        if (!metaElement || !this.post.updated) return;

        // Check if edit indicator already exists
        let editIndicator = metaElement.querySelector('.edit-indicator');
        
        if (!editIndicator) {
            editIndicator = DOM.createElement('span', {
                className: 'badge bg-secondary ms-2',
                title: `Edited ${this.post.updated.toLocaleString()}`
            }, [
                DOM.createElement('i', {
                    className: 'bi bi-pencil me-1'
                }),
                'Edited'
            ]);
            
            metaElement.appendChild(editIndicator);
        }
    }

    /**
     * Handle delete post
     */
    async handleDeletePost() {
        // Import authManager at runtime to avoid circular dependencies
        const { authManager } = await import('../auth.js');
        
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            DOM.showToast('Please log in to delete posts', 'info');
            return;
        }

        // Check if current user is the post author
        const currentUser = authManager.getCurrentUser();
        if (!currentUser || currentUser.name !== this.post.author.name) {
            DOM.showToast('You can only delete your own posts', 'error');
            return;
        }

        const isDeleted = this.post.deleted;
        const action = isDeleted ? 'restore' : 'delete';
        const actionText = isDeleted ? 'restore' : 'delete';
        
        // Show confirmation dialog
        const confirmMessage = isDeleted 
            ? 'Are you sure you want to restore this post?' 
            : 'Are you sure you want to delete this post? This action cannot be undone.';
            
        if (confirm(confirmMessage)) {
            try {
                // Show loading state
                DOM.showToast(`${actionText.charAt(0).toUpperCase() + actionText.slice(1)}ing post...`, 'info');

                // Call API to delete/restore post
                const response = await this.api.deletePost(this.post.id, !isDeleted);

                if (response && response.post_view) {
                    // Update post data
                    this.post.deleted = !isDeleted;
                    
                    // Show success message
                    const successMessage = isDeleted ? 'Post restored successfully' : 'Post deleted successfully';
                    DOM.showToast(successMessage, 'success');
                    
                    // Refresh the post display to show new state
                    this.refreshPostDisplay();
                    
                    // Re-render the management dropdown to show updated options
                    this.updatePostManagementDropdown();
                } else {
                    throw new Error('Invalid response from server');
                }

            } catch (error) {
                
                let errorMessage = `Failed to ${action} post. Please try again.`;
                if (error.message && error.message.includes('rate')) {
                    errorMessage = 'Rate limited. Please wait a moment before trying again.';
                } else if (error.message && error.message.includes('unauthorized')) {
                    errorMessage = `You are not authorized to ${action} this post.`;
                } else if (error.message && error.message.includes('not found')) {
                    errorMessage = 'Post not found or already deleted.';
                }
                
                DOM.showToast(errorMessage, 'error');
            }
        }
    }

    /**
     * Handle post voting
     * @param {number} vote - Vote value (1 for upvote, -1 for downvote)
     */
    async handleVote(vote) {
        // Import authManager and API at runtime to avoid circular dependencies
        const { authManager } = await import('../auth.js');
        
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            DOM.showToast('Please log in to vote', 'info');
            return;
        }

        try {
            // Determine new vote score based on current vote state and action
            let newVoteScore;
            const currentVote = this.post.myVote || 0;
            
            if (vote === 1) {
                // If already upvoted, remove vote; otherwise upvote
                newVoteScore = currentVote === 1 ? 0 : 1;
            } else if (vote === -1) {
                // If already downvoted, remove vote; otherwise downvote
                newVoteScore = currentVote === -1 ? 0 : -1;
            }

            // Disable vote buttons during request
            const voteButtons = document.querySelectorAll('[data-action="upvote"], [data-action="downvote"]');
            voteButtons.forEach(btn => btn.disabled = true);

            // Make API call to vote
            const voteResponse = await this.api.votePost(this.post.id, newVoteScore);
            
            if (voteResponse && voteResponse.post_view) {
                // Update post data with new vote information
                const updatedPost = voteResponse.post_view;
                this.post.myVote = updatedPost.my_vote || 0;
                this.post.stats.upvotes = updatedPost.counts?.upvotes || 0;
                this.post.stats.downvotes = updatedPost.counts?.downvotes || 0;
                this.post.stats.score = updatedPost.counts?.score || 0;
                
                // Update UI to reflect new vote state
                this.updateVoteDisplay();
                
                // Show success message only for vote removal
                if (newVoteScore === 0) {
                    DOM.showToast('Vote removed', 'success');
                }
            }

        } catch (error) {
            DOM.showToast('Failed to vote. Please try again.', 'error');
        } finally {
            // Re-enable vote buttons
            const voteButtons = document.querySelectorAll('[data-action="upvote"], [data-action="downvote"]');
            voteButtons.forEach(btn => btn.disabled = false);
        }
    }

    /**
     * Update vote display after voting
     */
    updateVoteDisplay() {
        // Update vote buttons
        const upvoteBtn = document.querySelector('[data-action="upvote"]');
        const downvoteBtn = document.querySelector('[data-action="downvote"]');
        
        if (upvoteBtn && downvoteBtn) {
            // Reset classes
            upvoteBtn.className = 'btn btn-sm me-1';
            downvoteBtn.className = 'btn btn-sm ms-1';
            
            // Apply appropriate classes based on current vote
            if (this.post.myVote === 1) {
                upvoteBtn.classList.add('voted');
                downvoteBtn.classList.add('btn-outline-secondary');
                upvoteBtn.title = 'Remove upvote';
                downvoteBtn.title = 'Downvote';
            } else if (this.post.myVote === -1) {
                downvoteBtn.classList.add('voted');
                upvoteBtn.classList.add('btn-outline-secondary');
                downvoteBtn.title = 'Remove downvote';
                upvoteBtn.title = 'Upvote';
            } else {
                upvoteBtn.classList.add('btn-outline-primary');
                downvoteBtn.classList.add('btn-outline-primary');
                upvoteBtn.title = 'Upvote';
                downvoteBtn.title = 'Downvote';
            }
        }

        // Update vote counts
        const upvoteCount = document.querySelector('[data-action="upvote"] .vote-count');
        const downvoteCount = document.querySelector('[data-action="downvote"] .vote-count');
        
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
        const ratioBar = document.querySelector('.vote-ratio-bar');
        if (!ratioBar) return;

        const totalVotes = this.post.stats.upvotes + this.post.stats.downvotes;
        if (totalVotes === 0) {
            const container = ratioBar.closest('.vote-ratio-container');
            if (container) container.style.display = 'none';
            return;
        }

        const container = ratioBar.closest('.vote-ratio-container');
        if (container) container.style.display = 'flex';
        
        const upvotePercentage = (this.post.stats.upvotes / totalVotes) * 100;
        
        const upvoteBarElement = ratioBar.querySelector('.vote-ratio-upvotes, .upvote-bar');
        const downvoteBarElement = ratioBar.querySelector('.vote-ratio-downvotes, .downvote-bar');
        const percentageElement = document.querySelector('.vote-percentage');
        
        if (upvoteBarElement) upvoteBarElement.style.width = `${upvotePercentage}%`;
        if (downvoteBarElement) downvoteBarElement.style.width = `${100 - upvotePercentage}%`;
        if (percentageElement) percentageElement.textContent = `${upvotePercentage.toFixed(0)}%`;
        
        // Update tooltip
        ratioBar.title = `${this.post.stats.upvotes} upvotes (${upvotePercentage.toFixed(1)}%) • ${this.post.stats.downvotes} downvotes (${(100 - upvotePercentage).toFixed(1)}%)`;
    }

    /**
     * Update the post management dropdown after state changes
     */
    updatePostManagementDropdown() {
        const dropdownContainer = this.element.querySelector('.post-management-dropdown');
        if (dropdownContainer) {
            // Replace the dropdown with updated version
            const newDropdown = this.renderPostManagementDropdown();
            dropdownContainer.parentNode.replaceChild(newDropdown, dropdownContainer);
        }
    }

    /**
     * Show the edit comment modal
     * @param {string} commentId - Comment ID to edit
     * @param {Object} comment - Comment data
     */
    showEditCommentModal(commentId, comment) {
        // Populate the form with current comment data
        this.populateEditCommentForm(commentId, comment);
        
        // Set up event listeners for the edit form
        this.setupEditCommentFormEventListeners(commentId);
        
        // Show the modal
        const editModal = new bootstrap.Modal(document.getElementById('editCommentModal'));
        editModal.show();
    }

    /**
     * Populate the edit comment form with current comment data
     * @param {string} commentId - Comment ID
     * @param {Object} comment - Comment data
     */
    populateEditCommentForm(commentId, comment) {
        const contentField = document.getElementById('edit-comment-content');
        const languageField = document.getElementById('edit-comment-language');

        if (contentField) contentField.value = comment.content || '';
        if (languageField) {
            // Set the current language if available
            if (comment.language_id) {
                languageField.value = comment.language_id;
            }
        }

        // Update character count
        this.updateEditCommentCharacterCount();
        
        // Load languages if not already loaded
        this.loadLanguagesForCommentEdit();
    }

    /**
     * Set up event listeners for the edit comment form
     * @param {string} commentId - Comment ID
     */
    setupEditCommentFormEventListeners(commentId) {
        const form = document.getElementById('editCommentForm');
        const contentField = document.getElementById('edit-comment-content');
        const previewToggle = document.getElementById('edit-comment-preview-toggle');
        const previewBtn = document.getElementById('edit-comment-preview-btn');

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEditCommentSubmit(commentId);
            });
        }

        if (contentField) {
            contentField.addEventListener('input', () => {
                this.updateEditCommentCharacterCount();
            });
        }

        if (previewToggle) {
            previewToggle.addEventListener('click', () => {
                this.toggleEditCommentPreview();
            });
        }

        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                this.showEditCommentPreview();
            });
        }
    }

    /**
     * Update character count for edit comment form
     */
    updateEditCommentCharacterCount() {
        const contentField = document.getElementById('edit-comment-content');
        const contentCount = document.getElementById('edit-comment-count');

        if (contentField && contentCount) {
            contentCount.textContent = contentField.value.length;
        }
    }

    /**
     * Load languages for the edit comment form
     */
    async loadLanguagesForCommentEdit() {
        try {
            const languageField = document.getElementById('edit-comment-language');
            if (!languageField) return;

            // Check if languages are already loaded
            if (languageField.children.length > 1) return;

            const response = await this.api.getSite();
            if (response && response.all_languages) {
                // Clear loading option
                languageField.innerHTML = '';
                
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'No specific language';
                languageField.appendChild(defaultOption);

                // Add language options
                response.all_languages.forEach(lang => {
                    const option = document.createElement('option');
                    option.value = lang.id;
                    option.textContent = lang.name;
                    languageField.appendChild(option);
                });

                // Set current language if available
                const contentField = document.getElementById('edit-comment-content');
                if (contentField && contentField.dataset.commentId) {
                    const comment = this.findCommentById(contentField.dataset.commentId);
                    if (comment && comment.language_id) {
                        languageField.value = comment.language_id;
                    }
                }
            }
        } catch (error) {
        }
    }

    /**
     * Toggle edit comment preview
     */
    toggleEditCommentPreview() {
        const previewContent = document.getElementById('edit-comment-preview-content');
        const previewToggle = document.getElementById('edit-comment-preview-toggle');
        
        if (!previewContent || !previewToggle) return;

        const isVisible = previewContent.style.display !== 'none';
        
        if (isVisible) {
            previewContent.style.display = 'none';
            previewToggle.innerHTML = [
                DOM.createElement('i', { className: 'bi bi-eye me-1' }),
                'Show Preview'
            ].map(el => el.outerHTML || el).join('');
        } else {
            this.showEditCommentPreview();
            previewToggle.innerHTML = [
                DOM.createElement('i', { className: 'bi bi-eye-slash me-1' }),
                'Hide Preview'
            ].map(el => el.outerHTML || el).join('');
        }
    }

    /**
     * Show edit comment preview
     */
    async showEditCommentPreview() {
        const contentField = document.getElementById('edit-comment-content');
        const previewContent = document.getElementById('edit-comment-preview-content');
        
        if (!contentField || !previewContent) return;

        const content = contentField.value.trim();

        if (!content) {
            DOM.showToast('Please enter some content to preview', 'info');
            return;
        }

        // Create preview HTML
        let previewHTML = '';
        
        if (content) {
            // Process markdown content
            try {
                        const { processCommentContent } = await import('../markdown-it-setup.js');
        previewHTML += `<div class="comment-content">${processCommentContent(content)}</div>`;
            } catch (error) {
                // Fallback to plain text
                previewHTML += `<div class="comment-content"><pre>${content}</pre></div>`;
            }
        }

        previewContent.innerHTML = previewHTML;
        previewContent.style.display = 'block';
    }

    /**
     * Handle edit comment form submission
     * @param {string} commentId - Comment ID to edit
     */
    async handleEditCommentSubmit(commentId) {
        const contentField = document.getElementById('edit-comment-content');
        const languageField = document.getElementById('edit-comment-language');
        const submitBtn = document.getElementById('edit-comment-submit');

        if (!contentField || !submitBtn) return;

        const content = contentField.value.trim();
        const languageId = languageField && languageField.value ? parseInt(languageField.value) : undefined;

        if (!content) {
            DOM.showToast('Please provide content for your comment', 'error');
            return;
        }

        // Disable submit button and show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = [
            DOM.createElement('span', {
                className: 'spinner-border spinner-border-sm me-2'
            }),
            'Saving...'
        ].map(el => el.outerHTML || el).join('');

        try {
            // Prepare edit data
            const editData = {
                comment_id: parseInt(commentId),
                content: content
            };

            // Add optional language_id if provided
            if (languageId) editData.language_id = languageId;

            // Call API to edit comment
            const response = await this.api.editComment(editData);

            if (response && response.comment_view) {
                // Update comment data
                this.updateCommentData(commentId, response.comment_view);
                
                // Show success message
                DOM.showToast('Comment updated successfully!', 'success');
                
                // Close the modal
                const editModal = bootstrap.Modal.getInstance(document.getElementById('editCommentModal'));
                if (editModal) {
                    editModal.hide();
                }
                
                // Refresh the comment display
                await this.refreshCommentDisplay(commentId);
                this.updateCommentInTree(commentId, response.comment_view);
            } else {
                throw new Error('Invalid response from server');
            }

        } catch (error) {
            
            let errorMessage = 'Failed to edit comment. Please try again.';
            if (error.message && error.message.includes('rate')) {
                errorMessage = 'Rate limited. Please wait a moment before trying again.';
            } else if (error.message && error.message.includes('unauthorized')) {
                errorMessage = 'You are not authorized to edit this comment.';
            } else if (error.message && error.message.includes('not found')) {
                errorMessage = 'Comment not found or already deleted.';
            }
            
            DOM.showToast(errorMessage, 'error');
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.innerHTML = [
                DOM.createElement('i', { className: 'bi bi-check-circle me-1' }),
                'Save Changes'
            ].map(el => el.outerHTML || el).join('');
        }
    }

    /**
     * Update comment data after successful edit
     * @param {string} commentId - Comment ID
     * @param {Object} commentView - Updated comment view from API
     */
    updateCommentData(commentId, commentView) {
        const comment = commentView.comment;
        const foundComment = this.findCommentById(commentId);
        
        if (foundComment) {
            // Update comment properties
            foundComment.content = comment.content;
            foundComment.language_id = comment.language_id;
            foundComment.updated = comment.updated ? new Date(comment.updated) : null;
        }
    }

    /**
     * Refresh the comment display after editing
     * @param {string} commentId - Comment ID
     */
    async refreshCommentDisplay(commentId) {
        const commentElement = this.element.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentElement) return;

        // Update comment content
        const contentElement = commentElement.querySelector('.comment-content');
        if (contentElement) {
            const comment = this.findCommentById(commentId);
            if (comment && comment.content) {
                try {
                    // Process markdown content
                            const { processCommentContent } = await import('../markdown-it-setup.js');
        contentElement.innerHTML = processCommentContent(comment.content);
                } catch (error) {
                    contentElement.innerHTML = `<pre>${comment.content}</pre>`;
                }
            }
        }

        // Update comment meta to show "edited" indicator
        this.updateCommentMeta(commentId);
    }

    /**
     * Update comment meta information to show edit status
     * @param {string} commentId - Comment ID
     */
    updateCommentMeta(commentId) {
        const commentElement = this.element.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentElement) return;

        const comment = this.findCommentById(commentId);
        if (!comment || !comment.updated) return;

        // Check if edit indicator already exists
        let editIndicator = commentElement.querySelector('.edit-indicator');
        
        if (!editIndicator) {
            // Find the time element to add the indicator after it
            const timeElement = commentElement.querySelector('time');
            if (timeElement) {
                editIndicator = DOM.createElement('span', {
                    className: 'badge bg-secondary ms-2',
                    title: `Edited ${comment.updated.toLocaleString()}`
                }, [
                    DOM.createElement('i', {
                        className: 'bi bi-pencil me-1'
                    }),
                    'Edited'
                ]);
                
                timeElement.parentNode.insertBefore(editIndicator, timeElement.nextSibling);
            }
        }
    }
}

export default PostDetailComponent; 