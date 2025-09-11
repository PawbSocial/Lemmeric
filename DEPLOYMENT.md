# Lemmeric Deployment Guide

## Overview

Lemmeric is a modern, vanilla JavaScript implementation of a Lemmy client that provides a clean, fast interface for browsing Lemmy instances. This document explains how to deploy the application with proper URL routing and configuration.

## Features

### Core Features
- **Multi-Instance Support**: Switch between different Lemmy instances seamlessly
- **Single Instance Mode**: Deploy as a custom UI for your own Lemmy instance
- **Post Browsing**: View posts with card and list view modes
- **Community Browsing**: Explore communities and their posts
- **User Profiles**: View user profiles and their content
- **Global Search**: Search across posts, comments, communities, and users
- **Post Creation**: Create new posts and communities
- **Inbox**: View private messages and notifications
- **Settings**: Customize appearance and behavior
- **Dark/Light Theme**: Toggle between themes with system preference detection
- **Responsive Design**: Works great on desktop, tablet, and mobile devices
- **Infinite Scrolling**: Automatically loads more content as you scroll

## URL Structure

The application uses these URL patterns:

- `/` - Home page (main feed)
- `/post/123` - Individual post page (where 123 is the post ID)
- `/c/community-name` - Community page
- `/c/community-name@instance.com` - Remote community page
- `/u/username` - User profile page
- `/u/username@instance.com` - Remote user profile page
- `/communities` - Communities listing page
- `/search` - Global search page
- `/create-post` - Create new post page
- `/create-community` - Create new community page
- `/inbox` - Private messages and notifications
- `/settings` - User settings page

## Files Structure

```
lemmeric/
├── index.html              # Main page (home feed)
├── post.html               # Post viewing page
├── community.html          # Community page
├── communities.html        # Communities listing page
├── user.html              # User profile page
├── search.html            # Global search page
├── create_post.html       # Create new post page
├── create-community.html  # Create new community page
├── inbox.html             # Private messages and notifications
├── settings.html          # User settings page
├── .htaccess              # Apache configuration
├── nginx.conf.example     # Nginx configuration example
├── dev-server.py          # Python development server
├── js/
│   ├── config.js          # Main configuration file
│   ├── main.js            # Main application logic
│   ├── api.js             # Lemmy API client
│   ├── auth.js            # Authentication handling
│   ├── utils.js           # Utility functions
│   ├── router.js          # URL routing
│   ├── post-page.js       # Post page controller
│   ├── community-page.js  # Community page controller
│   ├── communities-page.js # Communities listing controller
│   ├── user-page.js       # User profile controller
│   ├── search-page.js     # Search page controller
│   ├── create-post.js     # Post creation controller
│   ├── create-community.js # Community creation controller
│   ├── inbox-page.js      # Inbox controller
│   ├── settings-page.js   # Settings controller
│   ├── version.js         # Version information
│   ├── markdown-it.js     # Markdown rendering
│   ├── markdown-it-setup.js # Markdown configuration
│   └── components/
│       ├── post.js        # Post component
│       ├── post-detail.js # Post detail component
│       ├── post-feed.js   # Post feed component
│       ├── community.js   # Community component
│       ├── community-sidebar.js # Community sidebar
│       ├── community-edit-modal.js # Community edit modal
│       ├── user-sidebar.js # User sidebar
│       ├── user-edit-modal.js # User edit modal
│       ├── instance.js    # Instance component
│       ├── navbar.js      # Navigation component
│       └── searchable-select.js # Searchable select component
├── assets/
│   ├── css/
│   │   ├── main.css       # Main styles
│   │   └── themes.css     # Theme configurations
│   └── images/
│       ├── Lemmeric Logo.png
│       ├── Lemmeric Logo - No BG.png
│       └── Lemmeric-404.png
├── components/
│   └── navbar.html        # Navigation component template
└── original-lemmy-ui/     # Original TypeScript/Inferno codebase (reference)
```

## Server Configuration

### Apache (.htaccess)

The included `.htaccess` file handles URL rewriting automatically:

```apache
RewriteEngine On

# Handle post URLs: /post/123 -> /post.html?id=123
RewriteRule ^post/([0-9]+)/?$ post.html?id=$1 [L,QSA]

# Handle community URLs: /c/community-name -> /community.html?name=community-name
RewriteRule ^c/([^/]+)/?$ community.html?name=$1 [L,QSA]

# Handle remote community URLs: /c/community-name@instance.com -> /community.html?name=community-name&instance=instance.com
RewriteRule ^c/([^/]+)@([^/]+)/?$ community.html?name=$1&instance=$2 [L,QSA]

# Handle user URLs: /u/username -> /user.html?name=username
RewriteRule ^u/([^/]+)/?$ user.html?name=$1 [L,QSA]

# Handle remote user URLs: /u/username@instance.com -> /user.html?name=username&instance=instance.com
RewriteRule ^u/([^/]+)@([^/]+)/?$ user.html?name=$1&instance=$2 [L,QSA]

# Handle other pages
RewriteRule ^communities/?$ communities.html [L,QSA]
RewriteRule ^search/?$ search.html [L,QSA]
RewriteRule ^create-post/?$ create_post.html [L,QSA]
RewriteRule ^create-community/?$ create-community.html [L,QSA]
RewriteRule ^inbox/?$ inbox.html [L,QSA]
RewriteRule ^settings/?$ settings.html [L,QSA]

# Optional: Redirect query parameter URLs to clean URLs
RewriteCond %{THE_REQUEST} \s/+post\.html\?id=([0-9]+) [NC]
RewriteRule ^ /post/%1? [R=301,L]

RewriteCond %{THE_REQUEST} \s/+community\.html\?name=([^&\s]+) [NC]
RewriteRule ^ /c/%1? [R=301,L]

RewriteCond %{THE_REQUEST} \s/+user\.html\?name=([^&\s]+) [NC]
RewriteRule ^ /u/%1? [R=301,L]
```

### Nginx

Add this to your server block in `nginx.conf`:

```nginx
location / {
    try_files $uri $uri/ @fallback;
}

# Handle post URLs: /post/123 -> /post.html?id=123
location ~ ^/post/([0-9]+)/?$ {
    try_files /post.html?id=$1 =404;
}

# Handle community URLs: /c/community-name -> /community.html?name=community-name
location ~ ^/c/([^/]+)/?$ {
    try_files /community.html?name=$1 =404;
}

# Handle remote community URLs: /c/community-name@instance.com -> /community.html?name=community-name&instance=instance.com
location ~ ^/c/([^/]+)@([^/]+)/?$ {
    try_files /community.html?name=$1&instance=$2 =404;
}

# Handle user URLs: /u/username -> /user.html?name=username
location ~ ^/u/([^/]+)/?$ {
    try_files /user.html?name=$1 =404;
}

# Handle remote user URLs: /u/username@instance.com -> /user.html?name=username&instance=instance.com
location ~ ^/u/([^/]+)@([^/]+)/?$ {
    try_files /user.html?name=$1&instance=$2 =404;
}

# Handle other pages
location ~ ^/(communities|search|create-post|create-community|inbox|settings)/?$ {
    try_files /$1.html =404;
}

# Fallback for other routes
location @fallback {
    try_files /index.html =404;
}
```

### Node.js/Express

If using Express.js:

```javascript
// Post routes
app.get('/post/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'post.html'));
});

// Community routes
app.get('/c/:name', (req, res) => {
    res.sendFile(path.join(__dirname, 'community.html'));
});

app.get('/c/:name@:instance', (req, res) => {
    res.sendFile(path.join(__dirname, 'community.html'));
});

// User routes
app.get('/u/:name', (req, res) => {
    res.sendFile(path.join(__dirname, 'user.html'));
});

app.get('/u/:name@:instance', (req, res) => {
    res.sendFile(path.join(__dirname, 'user.html'));
});

// Other pages
app.get('/communities', (req, res) => {
    res.sendFile(path.join(__dirname, 'communities.html'));
});

app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'search.html'));
});

app.get('/create-post', (req, res) => {
    res.sendFile(path.join(__dirname, 'create_post.html'));
});

app.get('/create-community', (req, res) => {
    res.sendFile(path.join(__dirname, 'create-community.html'));
});

app.get('/inbox', (req, res) => {
    res.sendFile(path.join(__dirname, 'inbox.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'settings.html'));
});

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
```

### Python/Flask

If using Flask:

```python
# Post routes
@app.route('/post/<int:post_id>')
def post_page(post_id):
    return send_from_directory('.', 'post.html')

# Community routes
@app.route('/c/<name>')
def community_page(name):
    return send_from_directory('.', 'community.html')

@app.route('/c/<name>@<instance>')
def remote_community_page(name, instance):
    return send_from_directory('.', 'community.html')

# User routes
@app.route('/u/<name>')
def user_page(name):
    return send_from_directory('.', 'user.html')

@app.route('/u/<name>@<instance>')
def remote_user_page(name, instance):
    return send_from_directory('.', 'user.html')

# Other pages
@app.route('/communities')
def communities_page():
    return send_from_directory('.', 'communities.html')

@app.route('/search')
def search_page():
    return send_from_directory('.', 'search.html')

@app.route('/create-post')
def create_post_page():
    return send_from_directory('.', 'create_post.html')

@app.route('/create-community')
def create_community_page():
    return send_from_directory('.', 'create-community.html')

@app.route('/inbox')
def inbox_page():
    return send_from_directory('.', 'inbox.html')

@app.route('/settings')
def settings_page():
    return send_from_directory('.', 'settings.html')

# Home page
@app.route('/')
def home():
    return send_from_directory('.', 'index.html')
```

## Configuration

### Single Instance Mode

To deploy Lemmeric as a custom UI for your own Lemmy instance, edit `js/config.js`:

```javascript
export const CONFIG = {
    // Enable single instance mode
    SINGLE_INSTANCE_MODE: true,
    
    // Set your instance URL
    SINGLE_INSTANCE_URL: 'https://your-instance.com',
    
    // ... rest of configuration
};
```

When single instance mode is enabled:
- Instance selector is removed from the UI
- Your instance's branding (name, icon, description) is used
- Users are locked to your instance only
- Branding information is fetched from your instance's `/site` API endpoint

### Multi-Instance Mode

For multi-instance support (default), configure instances in `js/config.js`:

```javascript
export const CONFIG = {
    // Disable single instance mode
    SINGLE_INSTANCE_MODE: false,
    
    // Configure available instances
    INSTANCES: {
        'lemmy.world': {
            name: 'Lemmy World',
            url: 'https://lemmy.world',
            api: 'https://lemmy.world/api/v3',
            description: 'General purpose instance',
            icon: null
        },
        // Add more instances...
    },
    
    // ... rest of configuration
};
```

### Customization Options

The `CONFIG` object in `js/config.js` contains various settings:

- **Default Settings**: Instance, sort order, listing type, page size
- **Theme Settings**: Light/dark theme preferences
- **API Settings**: Timeouts, retries, rate limiting
- **Content Settings**: Title length, preview length, image proxy
- **Feature Toggles**: Infinite scroll, auto refresh, keyboard shortcuts
- **Storage Keys**: Local storage key names for persistence

## Development Server

For local development, you can use any static file server. Here are some options:

### Python (Recommended)
```bash
# Use the included development server
python dev-server.py

# Or use Python's built-in server
python -m http.server 8000
```

### Node.js
```bash
npx http-server -p 8000
```

### PHP
```bash
php -S localhost:8000
```

## Key Features

### Multi-Page Architecture
- **Home Page** (`index.html`): Main feed with posts from selected instance
- **Post Page** (`post.html`): Individual post view with comments
- **Community Page** (`community.html`): Community-specific posts and information
- **Communities Page** (`communities.html`): Browse and discover communities
- **User Page** (`user.html`): User profile and their posts/comments
- **Search Page** (`search.html`): Global search across all content types
- **Create Post** (`create_post.html`): Create new posts
- **Create Community** (`create-community.html`): Create new communities
- **Inbox** (`inbox.html`): Private messages and notifications
- **Settings** (`settings.html`): User preferences and configuration

### URL Routing System
- Clean URLs that match Lemmy's standard format
- Support for both local and remote content
- Proper browser navigation (back/forward buttons)
- Shareable links for all content types
- SEO-friendly URLs for better indexing

### Component-Based Architecture
- Modular JavaScript components for reusability
- Consistent UI patterns across all pages
- Shared functionality through common modules
- Easy maintenance and updates

### Responsive Design
- Mobile-first approach with Bootstrap 5.3.3
- Adaptive layouts for all screen sizes
- Touch-friendly interface elements
- Optimized for both desktop and mobile use

## Browser Compatibility

The application supports:
- Modern browsers with ES6 module support
- Chrome 61+
- Firefox 60+
- Safari 10.1+
- Edge 16+

## SEO Benefits

Using dedicated pages provides:
- Better search engine indexing
- Proper social media link previews
- Improved accessibility
- Standard browser navigation behavior
- Clean, shareable URLs

## Lemmy Federation Compatibility

The URL format matches Lemmy's standard patterns, ensuring:
- Cross-instance link sharing works correctly
- Proper integration with Lemmy federation
- Consistent user experience across Lemmy instances
- Support for both local and remote content

## Dependencies

Lemmeric uses CDN-based dependencies (no build process required):
- **Bootstrap 5.3.3**: UI framework and components
- **Bootstrap Icons 1.11.0**: Icon library
- **Markdown-it**: Markdown rendering with plugins
- **No Node.js/npm required**: Pure vanilla JavaScript implementation

## Performance

- **No Build Process**: Direct browser execution
- **Lazy Loading**: Images and components load as needed
- **Request Caching**: Reduces duplicate API calls
- **Rate Limiting**: Prevents API abuse
- **Minimal Bundle Size**: ~50KB vs 2MB+ for original

## Troubleshooting

### Pages not loading
- Check that your web server is configured to handle URL rewriting
- Verify that all HTML files exist and are accessible
- Check browser console for JavaScript errors
- Ensure all JavaScript files are served with correct MIME types

### URLs not rewriting
- Ensure mod_rewrite is enabled (Apache)
- Check that `.htaccess` file is being read
- Verify Nginx configuration is correct
- Test with a simple rewrite rule first

### JavaScript module errors
- Check that ES6 modules are supported in your browser
- Verify all import paths are correct
- Ensure all files are served over HTTP/HTTPS (not file://)
- Check for CORS issues if serving from different domains

### Configuration issues
- Verify `js/config.js` is properly configured
- Check that instance URLs are correct and accessible
- Ensure API endpoints are reachable
- Test with a known working instance first

### Single instance mode not working
- Verify `SINGLE_INSTANCE_MODE` is set to `true`
- Check that `SINGLE_INSTANCE_URL` is correct
- Ensure the instance API is accessible
- Check browser console for API errors 