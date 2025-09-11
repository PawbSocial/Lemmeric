# Lemmeric - A Modern Lemmy UI

![Lemmeric Banner](assets/images/Lemmeric%20Banner.png)

A modern, vanilla JavaScript implementation of a Lemmy client that provides a clean, fast interface for browsing Lemmy instances without any frameworks or build tools.

## Features

### 🚀 Core Features
- **Browse Posts**: View posts from any Lemmy instance with card and list view modes
- **Multi-Instance Support**: Switch between different Lemmy instances seamlessly
- **Single Instance Mode**: Deploy as a custom UI for your own Lemmy instance
- **Community Browsing**: Explore communities and their posts
- **User Profiles**: View user profiles and their content
- **Post Creation**: Create new posts and communities
- **Inbox**: View private messages and notifications
- **Settings**: Customize appearance and behavior
- **Dark/Light Theme**: Toggle between themes with system preference detection
- **Responsive Design**: Works great on desktop, tablet, and mobile devices
- **Infinite Scrolling**: Automatically loads more content as you scroll
- **Global Search**: Search across posts, comments, communities, and users with advanced filters
- **URL Routing**: Clean URLs that match Lemmy's standard format
- **Authentication**: Login and user management
- **Voting System**: Upvote/downvote posts and comments

### 🎨 User Interface
- **Bootstrap 5.3.3**: Modern, accessible UI components
- **Bootstrap Icons**: Comprehensive icon set with brand-specific icons
- **Brand Recognition**: Automatic brand logos for common sites (YouTube, Google, GitHub, etc.)
- **Custom CSS Variables**: Easy theming and customization
- **Smooth Animations**: Subtle transitions and loading states

### ⚡ Performance
- **No Build Process**: Direct browser execution with ES6 modules
- **Lazy Loading**: Images and components load as needed
- **Request Caching**: Reduces duplicate API calls
- **Rate Limiting**: Prevents API abuse

### 🔧 Developer Features
- **Modern JavaScript**: ES6+ features, async/await, modules
- **Component-Based**: Reusable, modular components
- **Error Handling**: Comprehensive error handling and user feedback
- **Accessibility**: WCAG compliant with screen reader support

## Getting Started

### Prerequisites
- A modern web browser with ES6 module support
- A web server (for development, you can use Cursor's Live Server plugin)

### Installation
1. Clone or download this repository
2. Open `index.html` in your web browser via a web server
3. That's it! No build process needed

### Using with Cursor Live Server
1. Open the project folder in Cursor
2. Right-click on `index.html`
3. Select "Open with Live Server"
4. The app will open in your default browser

## Project Structure

```
lemmeric-lemmy-ui/
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
├── assets/
│   ├── css/
│   │   ├── main.css       # Main styles
│   │   └── themes.css     # Theme configurations
│   └── images/
│       ├── Lemmeric Logo.png
│       ├── Lemmeric Logo - No BG.png
│       └── Lemmeric-404.png
├── js/
│   ├── config.js          # Main configuration file
│   ├── api.js             # Lemmy API client
│   ├── auth.js            # Authentication handling
│   ├── utils.js           # Utility functions
│   ├── main.js            # Main application logic
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
├── components/
│   └── navbar.html        # Navigation component template
└── original-lemmy-ui/     # Original TypeScript/Inferno codebase (reference)
```

## Configuration

### Supported Instances
The app comes pre-configured with several popular Lemmy instances:
- lemmy.world
- lemmy.ml
- beehaw.org
- lemmy.ca
- sh.itjust.works

### Adding New Instances
Edit `js/config.js` and add entries to the `INSTANCES` object:

```javascript
'your-instance.com': {
    name: 'Your Instance Name',
    url: 'https://your-instance.com',
    api: 'https://your-instance.com/api/v3',
    description: 'Description of your instance',
    icon: null
}
```

### Customizing Settings
The `CONFIG` object in `js/config.js` contains various settings you can modify:
- Default sort order
- Page size
- Theme preferences
- Feature toggles
- API timeouts

## Usage

### Browsing Posts
- Select an instance from the dropdown in the top navigation
- Choose a sort order (Active, Hot, New, Top Day, etc.)
- Scroll to load more posts automatically
- Click on post titles to open external links
- Use the view toggle to switch between card and list views
- **Vote on posts** by clicking the upvote/downvote buttons (requires login)
- View real-time vote counts and ratios
- Enjoy brand-specific icons for popular sites (YouTube videos show YouTube logo, GitHub links show GitHub logo, etc.)

### Keyboard Shortcuts
- `r` - Refresh posts
- `t` - Toggle theme
- `h` - Go to home/posts view

### Theme Switching
Click the sun/moon icon in the navigation to toggle between light and dark themes. The app remembers your preference and also respects your system's color scheme preference.

### URL Routing & Link Sharing
The app now supports proper URL routing for posts, making it compatible with Lemmy's link sharing system:

- **Post URLs**: Direct links to posts use the format `/post/{id}` (e.g., `yoursite.com/post/12345`)
- **Shareable Links**: When you share a post, others can open the direct link and view the post
- **Browser Navigation**: Back/forward buttons work correctly with post navigation
- **Deep Linking**: You can bookmark or share direct links to specific posts
- **Query Parameters**: URLs support additional parameters like `?comments=true` to focus on comments

#### How It Works
- Click any post title to navigate to `/post/{id}` and open the post details
- The URL updates in your browser's address bar
- Share the URL with others to link directly to that post
- Use browser back/forward buttons to navigate between posts and the home feed
- The app automatically handles loading post data when accessing direct post URLs

### Global Search Functionality
Lemmeric provides comprehensive search capabilities across all Lemmy content types:

#### Search Features
- **Global Search**: Search across posts, comments, communities, and users from the navbar
- **Advanced Filters**: Filter by content type, sort order, and listing type
- **Real-time Results**: Instant search results with proper pagination
- **Smart Navigation**: Click any search result to navigate directly to the content
- **URL Sharing**: Search results are shareable via URL with all parameters preserved

#### Search Types
- **Posts**: Find posts by title, content, or community
- **Comments**: Search through comment content and context
- **Communities**: Discover communities by name or description
- **Users**: Find users by username or bio information
- **All**: Combined search across all content types

#### How to Use
1. **Quick Search**: Use the search bar in the top navigation
2. **Advanced Search**: Navigate to `/search` for detailed filtering options
3. **Filter Results**: Choose content type, sort order, and listing preferences
4. **Navigate Results**: Click any result to view the full content
5. **Load More**: Use pagination to explore additional results

#### Search Parameters
- **Query**: Your search terms
- **Type**: All, Posts, Comments, Communities, Users, or URLs
- **Sort**: Top All, Top Day, Hot, New, Old, Most Comments, etc.
- **Listing**: All, Local, or Subscribed content

This makes Lemmeric fully compatible with how links are shared across the Lemmy ecosystem.

### Interactive Voting System
Lemmeric provides full voting functionality that integrates seamlessly with your Lemmy account:

#### Features
- **Upvote/Downvote Posts**: Click the arrow buttons to vote on posts in both feed and detail views
- **Real-time Updates**: Vote counts update immediately after voting
- **Visual Feedback**: Voted posts show clear visual indicators with color coding
- **Toggle Voting**: Click the same vote button again to remove your vote
- **Authentication Required**: Voting requires login to your Lemmy account
- **Persistent State**: Your votes are remembered and displayed consistently across sessions

#### How It Works
1. **Login Required**: Voting buttons prompt for login if not authenticated
2. **Smart Toggle**: Upvoting an already upvoted post removes the vote
3. **Visual Indicators**: Upvoted posts show blue, downvoted posts show red
4. **Live Counts**: Vote numbers update instantly without page refresh
5. **Error Handling**: Clear feedback if voting fails

### Brand Icons Enhancement
Lemmeric automatically recognizes links to popular websites and displays their brand-specific icons instead of generic link icons:

#### Supported Brands
- **Social Media**: YouTube, Facebook, Instagram, Twitter/X, LinkedIn, Reddit, TikTok, Discord, Twitch, and more
- **Technology**: Google, Microsoft, Apple, Amazon, GitHub, GitLab, Stack Overflow, Dropbox
- **Streaming & Media**: Spotify, Netflix, Vimeo, Twitch
- **Gaming**: Steam, Xbox, PlayStation, Nintendo
- **Professional**: WordPress, Medium, Behance, Dribbble
- **Shopping**: PayPal, Stripe, eBay, Etsy
- **Reference**: Wikipedia, Bing, Quora
- **Communication**: Messenger, Skype, WhatsApp, Telegram

#### How It Works
The system automatically detects domains from post URLs and displays:
- Brand-specific Bootstrap Icons in post metadata when available
- Brand names instead of domain URLs to reduce redundancy
- Consistent UI colors that match the overall design
- External link indicators in titles for all external links
- Fallback to generic link icons and domain names for unknown sites

This enhancement makes it easier to quickly identify the type of content being shared without having to read the full domain name.

## API Integration

The app uses the Lemmy API v3 to fetch data. All API calls include:
- Automatic retries with exponential backoff
- Request caching to reduce server load
- Rate limiting to prevent abuse
- Comprehensive error handling

### Supported API Endpoints
- `/api/v3/post/list` - Fetch posts
- `/api/v3/community/list` - Fetch communities
- `/api/v3/site` - Get instance information
- Additional endpoints for future features

## Browser Compatibility

- **Chrome/Edge**: 88+
- **Firefox**: 78+
- **Safari**: 14+

The app uses modern JavaScript features like:
- ES6 modules
- Async/await
- Fetch API
- CSS custom properties
- IntersectionObserver

## Version Management

Lemmeric uses a semantic versioning system to track releases. The current version is displayed in the Statistics panel on the home page.

### Version Format
- **MAJOR.MINOR.PATCH** (e.g., 1.0.0)
- **MAJOR**: Breaking changes
- **MINOR**: New features, backward compatible  
- **PATCH**: Bug fixes, backward compatible

### Updating Versions
To update the version number, manually edit `js/version.js` and change the `LEMMERIC_VERSION` constant:

```javascript
export const LEMMERIC_VERSION = '1.1.0';  // Update this line
export const BUILD_DATE = '2024-12-20';   // Update this line
```

### Version Files
- `js/version.js` - Contains current version, build date, and repository URL
- **Important**: This file should NOT be copied by users to preserve their settings
- Update this file manually during releases to reflect the current version
- Update the `REPOSITORY_URL` when you set up your GitHub repository

## Contributing

Since this is a vanilla JavaScript project, contributing is straightforward:

1. No build tools to set up
2. Edit files directly
3. Test in browser
4. Submit pull requests

### Development Guidelines
- Use ES6+ features
- Follow existing code style
- Add JSDoc comments for functions
- Test across browsers
- Ensure accessibility compliance

## Roadmap

### Phase 1 (Completed)
- ✅ View posts from instances
- ✅ Multi-instance support
- ✅ Theme switching
- ✅ Responsive design
- ✅ URL routing and link sharing
- ✅ Global search functionality
- ✅ Community browsing
- ✅ User profiles
- ✅ Post details with comments
- ✅ User authentication
- ✅ Posting and commenting
- ✅ Voting system

### Phase 2 (Current)
- 🔄 Inbox and notifications
- 🔄 Settings and preferences
- 🔄 Advanced search filters
- 🔄 Community management

### Phase 3 (Future)
- 📝 Moderation tools
- 📝 Admin features
- 📝 Advanced customization
- 📝 Mobile app features

## Comparison with Original

| Feature | Original (TypeScript/Inferno) | Lemmeric (Vanilla JS) |
|---------|----------------------------|----------------------|
| Dependencies | 65+ packages | 0 (CDN only) |
| Build Time | 30-60s | None |
| Hot Reload | Yes | Live Server |
| Performance | Good | Excellent |
| Framework | Inferno.js | Vanilla JavaScript |
| Build Tools | Webpack, Babel, TypeScript | None |
| Development | Complex setup | Simple file editing |

## License

This project is licensed under the **BSD 3-Clause License**. See the [LICENSE](LICENSE) file for details.

### What this means:
- ✅ **Free to use** - Anyone can use, modify, and distribute this software
- ✅ **Commercial use allowed** - Can be used in commercial products
- ✅ **Attribution required** - Must include copyright notice when redistributing
- ✅ **No warranty** - Provided "as is" without any guarantees
- ✅ **No endorsement** - Cannot use the author's name to promote derived works

## Acknowledgments

- Thank you to the Pawb.Social admin team for helping to provide feedback during the development of this new front-end for Lemmy.🐾
- To [Cursor](https://cursor.com/en) for making such an incredible application, because this project would not have been created without it.

## Support

If you encounter issues or have questions:
1. Check the browser console for error messages
2. Ensure you're using a modern browser
3. Try a different Lemmy instance
4. Open an issue with details about your browser and the problem
