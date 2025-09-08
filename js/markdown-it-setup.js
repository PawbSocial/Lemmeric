/**
 * Markdown-it Setup for Lemmeric
 * 
 * This module configures markdown-it with the same plugins and settings
 * as the original Lemmy UI for full compatibility.
 */

// Use the global markdown-it library (UMD version)
// The UMD version exposes 'markdownit' globally

// Plugin imports (these will be loaded as script tags in HTML)
// markdown-it-sub, markdown-it-sup, markdown-it-footnote, 
// markdown-it-container, markdown-it-html5-embed

/**
 * Custom plugin for handling line breaks more intelligently
 * This prevents excessive paragraph breaks while maintaining readability
 */
function intelligentLineBreakPlugin(md) {
    // Add a core ruler that processes text before markdown parsing
    md.core.ruler.push('intelligent-linebreaks', (state) => {
        // Process the source text to normalize line breaks
        let source = state.src;
        
        // Replace multiple consecutive newlines with single newlines
        // This prevents excessive paragraph breaks while maintaining structure
        source = source.replace(/\n{3,}/g, '\n\n');
        
        // Update the source
        state.src = source;
    });
    
    // Override the paragraph renderer to handle inline line breaks and prevent wrapping inside list items
    const defaultParagraphRenderer = md.renderer.rules.paragraph_open;
    
    md.renderer.rules.paragraph_open = function (tokens, idx, options, env, self) {
        // Check if we're inside a list item
        let insideListItem = false;
        for (let i = idx - 1; i >= 0; i--) {
            if (tokens[i].type === 'list_item_open') {
                insideListItem = true;
                break;
            } else if (tokens[i].type === 'list_item_close') {
                break;
            }
        }
        
        // If inside a list item, don't create paragraph tags
        if (insideListItem) {
            return '';
        }
        
        // Use default paragraph renderer for non-list content
        if (defaultParagraphRenderer) {
            return defaultParagraphRenderer(tokens, idx, options, env, self);
        }
        return '<p>';
    };
    
    // Override the paragraph close renderer to prevent closing tags inside list items
    const defaultParagraphCloseRenderer = md.renderer.rules.paragraph_close;
    
    md.renderer.rules.paragraph_close = function (tokens, idx, options, env, self) {
        // Check if we're inside a list item
        let insideListItem = false;
        for (let i = idx - 1; i >= 0; i--) {
            if (tokens[i].type === 'list_item_open') {
                insideListItem = true;
                break;
            } else if (tokens[i].type === 'list_item_close') {
                break;
            }
        }
        
        // If inside a list item, don't create paragraph closing tags
        if (insideListItem) {
            return '';
        }
        
        // Use default paragraph close renderer for non-list content
        if (defaultParagraphCloseRenderer) {
            return defaultParagraphCloseRenderer(tokens, idx, options, env, self);
        }
        return '</p>';
    };
    
    // Override the text renderer to handle single newlines as line breaks
    const defaultTextRenderer = md.renderer.rules.text;
    
    md.renderer.rules.text = function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        let content = token.content;
        
        // Replace single newlines with <br> tags for better line spacing
        // But only within paragraphs, not at the beginning or end
        if (content.includes('\n')) {
            content = content.replace(/\n/g, '<br>\n');
        }
        
        // Use default text renderer with modified content
        if (defaultTextRenderer) {
            const originalContent = token.content;
            token.content = content;
            const result = defaultTextRenderer(tokens, idx, options, env, self);
            token.content = originalContent; // Restore original content
            return result;
        }
        
        return md.utils.escapeHtml(content);
    };
    
    // Override the list item renderer to prevent paragraph wrapping
    const defaultListItemRenderer = md.renderer.rules.list_item_open;
    
    md.renderer.rules.list_item_open = function (tokens, idx, options, env, self) {
        // Use default list item open renderer
        if (defaultListItemRenderer) {
            return defaultListItemRenderer(tokens, idx, options, env, self);
        }
        return '<li>';
    };
    
    // Override the list item close renderer
    const defaultListItemCloseRenderer = md.renderer.rules.list_item_close;
    
    md.renderer.rules.list_item_close = function (tokens, idx, options, env, self) {
        // Use default list item close renderer
        if (defaultListItemCloseRenderer) {
            return defaultListItemCloseRenderer(tokens, idx, options, env, self);
        }
        return '</li>';
    };
    

}

/**
 * Custom plugin for processing video links and converting them to embedded players
 */
function videoEmbedPlugin(md) {
    // Add a core ruler that processes text tokens
    md.core.ruler.push('youtube-embed', (state) => {
        for (let i = 0; i < state.tokens.length; i++) {
            if (state.tokens[i].type !== 'inline') {
                continue;
            }
            
            const inlineTokens = state.tokens[i].children || [];
            for (let j = inlineTokens.length - 1; j >= 0; j--) {
                if (inlineTokens[j].type === 'text') {
                    const text = inlineTokens[j].content;
                    
                    // Check if this text contains plain video URLs
                    const videoRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|vimeo\.com\/|dailymotion\.com\/video\/)([a-zA-Z0-9_-]+))/g;
                    const matches = Array.from(text.matchAll(videoRegex));
                    
                    if (matches.length > 0) {
                        let processedText = text;
                        
                        // Replace video URLs with embedded players
                        processedText = processedText.replace(videoRegex, (fullUrl, url, videoId) => {
                            let embedUrl, title, platform;
                            
                            if (fullUrl.includes('youtube.com') || fullUrl.includes('youtu.be')) {
                                embedUrl = `https://www.youtube.com/embed/${videoId}`;
                                title = 'YouTube video player';
                                platform = 'YouTube';
                            } else if (fullUrl.includes('vimeo.com')) {
                                embedUrl = `https://player.vimeo.com/video/${videoId}`;
                                title = 'Vimeo video player';
                                platform = 'Vimeo';
                            } else if (fullUrl.includes('dailymotion.com')) {
                                embedUrl = `https://www.dailymotion.com/embed/video/${videoId}`;
                                title = 'Dailymotion video player';
                                platform = 'Dailymotion';
                            }
                            
                            if (embedUrl) {
                                return `<div class="ratio ratio-16x9 mb-3"><iframe src="${embedUrl}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="rounded"></iframe></div>`;
                            }
                            
                            return fullUrl; // Return original URL if no platform matched
                        });
                        
                        // If the text was modified, replace the token
                        if (processedText !== text) {
                            // Create a new HTML token with the processed content
                            const htmlToken = new state.Token('html_inline', '', 0);
                            htmlToken.content = processedText;
                            
                            inlineTokens.splice(j, 1, htmlToken);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Custom plugin for processing Lemmy community and user links
 * Uses your existing working implementation from utils.js
 */
function localInstanceLinkParser(md) {
    // Add a core ruler that processes text tokens
    md.core.ruler.push('replace-text', (state) => {
        for (let i = 0; i < state.tokens.length; i++) {
            if (state.tokens[i].type !== 'inline') {
                continue;
            }
            
            const inlineTokens = state.tokens[i].children || [];
            for (let j = inlineTokens.length - 1; j >= 0; j--) {
                if (inlineTokens[j].type === 'text') {
                    const text = inlineTokens[j].content;
                    
                    // Process community and user links using markdown-it's token system
                    let hasChanges = false;
                    const newTokens = [];
                    let lastIndex = 0;
                    
                    // Find all matches in the text - more specific patterns to avoid overlaps
                    const communityRemoteRegex = /!([a-zA-Z0-9_-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
                    const userRemoteRegex = /@([a-zA-Z0-9_-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
                    const communityLocalRegex = /!([a-zA-Z0-9_-]+)(?![a-zA-Z0-9.-]*@)/g;
                    const userLocalRegex = /@([a-zA-Z0-9_-]+)(?![a-zA-Z0-9.-]*@)/g;
                    
                    // Combine all regex patterns to find all matches
                    const allMatches = [];
                    let match;
                    
                    // Remote community links
                    while ((match = communityRemoteRegex.exec(text)) !== null) {
                        allMatches.push({ ...match, type: 'community-remote', index: match.index });
                    }
                    
                    // Remote user mentions
                    while ((match = userRemoteRegex.exec(text)) !== null) {
                        allMatches.push({ ...match, type: 'user-remote', index: match.index });
                    }
                    
                    // Local community links
                    while ((match = communityLocalRegex.exec(text)) !== null) {
                        allMatches.push({ ...match, type: 'community-local', index: match.index });
                    }
                    
                    // Local user mentions
                    while ((match = userLocalRegex.exec(text)) !== null) {
                        allMatches.push({ ...match, type: 'user-local', index: match.index });
                    }
                    
                    // Sort matches by index to process in order
                    allMatches.sort((a, b) => a.index - b.index);
                    
                    // Remove overlapping matches (keep only the first one)
                    const filteredMatches = [];
                    for (let i = 0; i < allMatches.length; i++) {
                        const current = allMatches[i];
                        const isOverlapping = filteredMatches.some(existing => 
                            (current.index >= existing.index && current.index < existing.index + existing[0].length) ||
                            (existing.index >= current.index && existing.index < current.index + current[0].length)
                        );
                        
                        if (!isOverlapping) {
                            filteredMatches.push(current);
                        }
                    }
                    
                    // Process each match
                    for (const match of filteredMatches) {
                        // Add text before this match
                        if (match.index > lastIndex) {
                            const textToken = new state.Token('text', '', 0);
                            textToken.content = text.slice(lastIndex, match.index);
                            newTokens.push(textToken);
                        }
                        
                        // Create link token based on match type
                        const linkOpenToken = new state.Token('link_open', 'a', 1);
                        
                        if (match.type === 'community-remote') {
                            linkOpenToken.attrs = [
                                ['href', `/c/${match[1]}@${match[2]}`],
                                ['class', 'community-link text-primary'],
                                ['rel', 'noopener noreferrer'],
                                ['title', `View community !${match[1]}@${match[2]}`]
                            ];
                        } else if (match.type === 'user-remote') {
                            linkOpenToken.attrs = [
                                ['href', `/u/${match[1]}@${match[2]}`],
                                ['class', 'user-link text-primary'],
                                ['data-user', match[1]],
                                ['data-instance', match[2]],
                                ['title', `User @${match[1]}@${match[2]}`]
                            ];
                        } else if (match.type === 'community-local') {
                            linkOpenToken.attrs = [
                                ['href', `/c/${match[1]}`],
                                ['class', 'community-link text-primary'],
                                ['rel', 'noopener noreferrer'],
                                ['title', `View community !${match[1]}`]
                            ];
                        } else if (match.type === 'user-local') {
                            linkOpenToken.attrs = [
                                ['href', `/u/${match[1]}`],
                                ['class', 'user-link text-primary'], // Changed from text-muted to text-primary
                                ['data-user', match[1]],
                                ['title', `User @${match[1]}`]
                            ];
                        }
                        
                        const textToken = new state.Token('text', '', 0);
                        textToken.content = match[0];
                        
                        const linkCloseToken = new state.Token('link_close', 'a', -1);
                        
                        newTokens.push(linkOpenToken, textToken, linkCloseToken);
                        lastIndex = match.index + match[0].length;
                        hasChanges = true;
                    }
                    
                    // Add remaining text after last match
                    if (lastIndex < text.length) {
                        const textToken = new state.Token('text', '', 0);
                        textToken.content = text.slice(lastIndex);
                        newTokens.push(textToken);
                    }
                    
                    // If we made changes, replace the original token with our new tokens
                    if (hasChanges) {
                        inlineTokens.splice(j, 1, ...newTokens);
                    }
                }
            }
        }
    });
}

/**
 * Configure markdown-it with Lemmy-compatible settings
 */
export function setupMarkdownIt() {
    // Base configuration matching Lemmy's settings
    const markdownItConfig = {
        html: false,
        linkify: true,
        typographer: true,
        breaks: false  // Changed from true to false to prevent excessive paragraph breaks
    };

    // Check if markdown-it library is available
    if (typeof window.markdownit === 'undefined') {
        console.error('Markdown-it library not loaded. Please ensure js/markdown-it.js is loaded before this script.');
        throw new Error('Markdown-it library not available');
    }
    
    // Create main markdown-it instance
    const md = new window.markdownit(markdownItConfig);

    // Add plugins in the same order as Lemmy
    if (window.markdownitSub) {
        md.use(window.markdownitSub);
    }
    
    if (window.markdownitSup) {
        md.use(window.markdownitSup);
    }
    
    if (window.markdownitFootnote) {
        md.use(window.markdownitFootnote);
    }
    
    if (window.markdownitContainer) {
        // Custom spoiler container configuration (exactly like Lemmy)
        const spoilerConfig = {
            validate: (params) => {
                return params.trim().match(/^spoiler\s+(.*)$/);
            },
            render: (tokens, idx) => {
                const m = tokens[idx].info.trim().match(/^spoiler\s+(.*)$/);
                if (tokens[idx].nesting === 1) {
                    // opening tag
                    const summary = md.utils.escapeHtml(m[1]);
                    return `<details><summary>${summary}</summary>\n`;
                } else {
                    // closing tag
                    return "</details>\n";
                }
            }
        };
        
        md.use(window.markdownitContainer, 'spoiler', spoilerConfig);
    }
    
    if (window.markdownitHtml5Embed) {
        // HTML5 embed configuration (exactly like Lemmy)
        const html5EmbedConfig = {
            html5embed: {
                useImageSyntax: true, // Enables video/audio embed with ![]() syntax
                attributes: {
                    audio: 'controls preload="metadata"',
                    video: 'width="100%" max-height="100%" controls loop preload="metadata"'
                }
            }
        };
        
        md.use(window.markdownitHtml5Embed, html5EmbedConfig);
    }
    
    // Add our custom intelligent line break plugin
    intelligentLineBreakPlugin(md);
    
    // Add our custom video embed plugin
    videoEmbedPlugin(md);
    
    // Add our custom Lemmy link parser plugin (must be last)
    localInstanceLinkParser(md);

    // Custom renderer rules to match Lemmy's styling
    const defaultImageRenderer = md.renderer.rules.image;
    md.renderer.rules.image = function (tokens, idx, options, env, self) {
        const item = tokens[idx];
        const url = item.attrs.length > 0 ? item.attrs[0][1] : "";
        const altText = item.attrs.length > 1 ? item.attrs[1][1] : "";
        const title = item.attrs.length > 2 ? item.attrs[2][1] : "";
        
        // Check if this is a custom emoji (Lemmy-style)
        const splitTitle = title.split(/ (.*)/, 2);
        const isEmoji = splitTitle[0] === "emoji";
        let shortcode;
        
        if (isEmoji) {
            shortcode = splitTitle[1];
        }
        
        // For now, render all images normally
        // TODO: Add custom emoji support later
        if (defaultImageRenderer) {
            return defaultImageRenderer(tokens, idx, options, env, self);
        }
        
        return `<img src="${url}" alt="${altText}" title="${title}" class="img-fluid rounded" loading="lazy">`;
    };

    // Table styling to match Lemmy's Bootstrap classes
    md.renderer.rules.table_open = function () {
        return '<table class="table">';
    };

    // Link security (add rel attributes like Lemmy)
    const defaultLinkRenderer = md.renderer.rules.link_open || 
        function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };
    
    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        tokens[idx].attrPush(['rel', 'noopener noreferrer']);
        return defaultLinkRenderer(tokens, idx, options, env, self);
    };

    return md;
}

/**
 * Create a markdown-it instance without images (for previews)
 */
export function setupMarkdownItNoImages() {
    const md = setupMarkdownIt();
    md.disable('image');
    return md;
}

/**
 * Create a limited markdown-it instance (for titles, etc.)
 */
export function setupMarkdownItLimited() {
    const md = new MarkdownIt('zero').enable([
        'emphasis',
        'backticks',
        'strikethrough'
    ]);
    return md;
}

/**
 * Process markdown with full features
 */
export function processMarkdown(text, options = {}) {
    if (!text || typeof text !== 'string') return '';
    
    const md = setupMarkdownIt();
    
    // Apply any custom options
    if (options.noImages) {
        md.disable('image');
    }
    
    return md.render(text);
}

/**
 * Process markdown inline (for titles, etc.)
 */
export function processMarkdownInline(text) {
    if (!text || typeof text !== 'string') return '';
    
    const md = setupMarkdownItLimited();
    return md.renderInline(text);
}

/**
 * Process sidebar content (enhanced processing without line break conversion)
 */
export function processSidebarContent(content) {
    if (!content || typeof content !== 'string') return '';
    
    const md = setupMarkdownIt();
    // Disable images for sidebar content (usually limited space)
    md.disable('image');
    return md.render(content);
}

/**
 * Process tagline content (enhanced processing with line break preservation)
 */
export function processTaglineContent(content) {
    if (!content || typeof content !== 'string') return '';
    
    const md = setupMarkdownIt();
    // Enable line breaks for taglines
    return md.render(content);
}

/**
 * Process content without images (for previews or notifications)
 */
export function processContentNoImages(content) {
    if (!content || typeof content !== 'string') return '';
    
    const md = setupMarkdownIt();
    md.disable('image');
    return md.render(content);
}

/**
 * Process content with simple markdown only (for limited contexts)
 */
export function processSimple(content) {
    if (!content || typeof content !== 'string') return '';
    
    const md = setupMarkdownItLimited();
    return md.render(content);
}

/**
 * Process post content (full features enabled)
 */
export function processPostContent(content) {
    return processMarkdown(content, {
        noImages: false
    });
}

/**
 * Process comment content (full features enabled)
 */
export function processCommentContent(content) {
    return processMarkdown(content, {
        noImages: false
    });
}



// Export the setup function for use in other modules
export { setupMarkdownIt as default };
