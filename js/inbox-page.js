/**
 * Inbox Page App for Lemmeric
 * Handles notifications, messages, and admin notifications
 */

import { authManager } from './auth.js';

class LemmericInboxApp {
    constructor() {
        this.currentUser = null;
        this.isAdmin = false;
        this.inbox = {
            notifications: [],
            messages: [],
            reports: [],
            applications: []
        };
        this.currentFilter = {
            notifications: 'all',
            messages: 'all',
            reports: 'all',
            applications: 'pending'
        };

        this.pagination = {
            reports: {
                currentPage: 1,
                hasMore: true,
                loading: false
            },
            applications: {
                currentPage: 1,
                hasMore: true,
                loading: false
            }
        };

        // UI elements cache
        this.elements = {};
        
        this.init();
    }

    /**
     * Initialize the inbox app
     */
    async init() {
        try {
            console.log('Initializing Inbox Page App...');
            
            // Load navbar
            await this.loadNavbar();
            
            // Cache DOM elements
            this.cacheElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Check if we have a valid auth token first
            const { isAuthenticated } = await import('./config.js');
            const hasToken = isAuthenticated();
            
            if (!hasToken) {
                // Redirect to home if not authenticated
                window.location.href = '/';
                return;
            }
            
            // Try to load current user from auth manager
            await authManager.loadCurrentUser();
            
            // Load user data if authenticated
            this.currentUser = authManager.getCurrentUser();
            
            // If we still don't have user data but we're authenticated, 
            // it might be a timing issue - try to proceed anyway
            if (!this.currentUser && hasToken) {
                // Force a fresh auth check without rate limiting
                try {
                    await authManager.refreshUserData();
                    this.currentUser = authManager.getCurrentUser();
                } catch (error) {
                    console.warn('Failed to refresh user data:', error);
                }
            }
            
            if (this.currentUser || hasToken) {
                await this.checkAdminStatus();
                await this.loadInboxData();
            } else {
                // Final fallback - redirect to home if truly not authenticated
                window.location.href = '/';
                return;
            }
            
        } catch (error) {
            console.error('Failed to initialize Inbox Page App:', error);
            this.showError('Failed to initialize inbox page');
        }
    }

    /**
     * Load navbar component
     */
    async loadNavbar() {
        try {
            const response = await fetch('/components/navbar.html');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const navbarHTML = await response.text();
            
            // Insert navbar at the beginning of body
            document.body.insertAdjacentHTML('afterbegin', navbarHTML);
            
            // Initialize navbar after loading (skip HTML load since we already loaded it)
            const { Navbar } = await import('./components/navbar.js');
            window.navbar = new Navbar(true); // true = skip HTML loading
            await window.navbar.init();
            
        } catch (error) {
            console.error('Error loading navbar:', error);
        }
    }

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            // Navigation
            backBtn: document.getElementById('back-btn'),
            markAllReadBtn: document.getElementById('mark-all-read-btn'),
            
            // Tabs
            adminNotificationsTabItem: document.getElementById('admin-notifications-tab-item'),
            userNotificationsBadge: document.getElementById('user-notification-badge'),
            messagesBadge: document.getElementById('messages-badge'),
            adminNotificationsBadge: document.getElementById('admin-notification-badge'),
            
            // User notifications
            userNotificationsLoading: document.getElementById('user-notifications-loading'),
            userNotificationsList: document.getElementById('user-notifications-list'),
            userNotificationsEmpty: document.getElementById('user-notifications-empty'),
            
            // Messages
            messagesLoading: document.getElementById('messages-loading'),
            messagesList: document.getElementById('messages-list'),
            messagesEmpty: document.getElementById('messages-empty'),
            
            // Reports
            reportsLoading: document.getElementById('reports-loading'),
            reportsList: document.getElementById('reports-list'),
            reportsEmpty: document.getElementById('reports-empty'),
            reportsCount: document.getElementById('reports-count'),
            
            // Applications  
            applicationsLoading: document.getElementById('applications-loading'),
            applicationsList: document.getElementById('applications-list'),
            applicationsEmpty: document.getElementById('applications-empty'),
            applicationsCount: document.getElementById('applications-count'),
            
            // Filters
            filterAll: document.getElementById('filter-all'),
            filterUnread: document.getElementById('filter-unread'),
            filterMentions: document.getElementById('filter-mentions'),
            filterReplies: document.getElementById('filter-replies'),
            
            // Reports filters
            reportsFilterAll: document.getElementById('reports-filter-all'),
            reportsFilterPosts: document.getElementById('reports-filter-posts'),
            reportsFilterComments: document.getElementById('reports-filter-comments'),
            reportsFilterMessages: document.getElementById('reports-filter-messages'),
            reportsCompletedToggle: document.getElementById('reports-completed-toggle'),
            
            // Applications filters
            applicationsFilterAll: document.getElementById('applications-filter-all'),
            applicationsFilterPending: document.getElementById('applications-filter-pending'),
            applicationsFilterApproved: document.getElementById('applications-filter-approved'),
            applicationsFilterDenied: document.getElementById('applications-filter-denied')
        };
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Back button
        if (this.elements.backBtn) {
            this.elements.backBtn.addEventListener('click', () => {
                window.history.back();
            });
        }

        // Mark all read button
        if (this.elements.markAllReadBtn) {
            this.elements.markAllReadBtn.addEventListener('click', () => {
                this.markAllRead();
            });
        }

        // User notification filters
        const userFilters = [
            { element: this.elements.filterAll, filter: 'all' },
            { element: this.elements.filterUnread, filter: 'unread' },
            { element: this.elements.filterMentions, filter: 'mentions' },
            { element: this.elements.filterReplies, filter: 'replies' }
        ];

        userFilters.forEach(({ element, filter }) => {
            if (element) {
                element.addEventListener('click', () => {
                    this.setNotificationFilter(filter);
                });
            }
        });



        // Reports filters
        const reportsFilters = [
            { element: this.elements.reportsFilterAll, filter: 'all' },
            { element: this.elements.reportsFilterPosts, filter: 'posts' },
            { element: this.elements.reportsFilterComments, filter: 'comments' },
            { element: this.elements.reportsFilterMessages, filter: 'messages' }
        ];

        reportsFilters.forEach(({ element, filter }) => {
            if (element) {
                element.addEventListener('click', () => {
                    // Only allow this if completed toggle is off
                    if (!this.elements.reportsCompletedToggle.checked) {
                        this.setReportsFilter(filter);
                    }
                });
            }
        });

        // Completed reports toggle
        if (this.elements.reportsCompletedToggle) {
            this.elements.reportsCompletedToggle.addEventListener('change', () => {
                if (this.elements.reportsCompletedToggle.checked) {
                    this.setReportsFilter('completed');
                } else {
                    this.setReportsFilter('all');
                }
            });
        }

        // Applications filters
        const applicationsFilters = [
            { element: this.elements.applicationsFilterPending, filter: 'pending' },
            { element: this.elements.applicationsFilterAll, filter: 'all' },
            { element: this.elements.applicationsFilterApproved, filter: 'approved' },
            { element: this.elements.applicationsFilterDenied, filter: 'denied' }
        ];

        applicationsFilters.forEach(({ element, filter }) => {
            if (element) {
                element.addEventListener('click', () => {
                    this.setApplicationsFilter(filter);
                });
            }
        });

        // Infinite scroll for reports
        if (this.elements.reportsList) {
            this.elements.reportsList.addEventListener('scroll', (e) => {
                this.handleReportsScroll(e);
            });
        }

        // Infinite scroll for applications
        if (this.elements.applicationsList) {
            this.elements.applicationsList.addEventListener('scroll', (e) => {
                this.handleApplicationsScroll(e);
            });
        }
    }

    /**
     * Check if user is admin and show admin tab if needed
     */
    async checkAdminStatus() {
        try {
            const api = authManager.api;
            const siteResponse = await api.getSite();
            
            if (siteResponse && siteResponse.my_user && siteResponse.admins) {
                const currentUserId = siteResponse.my_user.local_user_view.person.id;
                this.isAdmin = siteResponse.admins.some(admin => admin.person.id === currentUserId);
                
                if (this.isAdmin && this.elements.adminNotificationsTabItem) {
                    this.elements.adminNotificationsTabItem.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            this.isAdmin = false;
        }
    }

    /**
     * Load all inbox data
     */
    async loadInboxData() {
        try {
            // Load notifications
            await this.loadNotifications();
            
            // Load messages
            await this.loadMessages();
            
            // Load admin data if user is admin
            if (this.isAdmin) {
                await Promise.all([
                    this.loadReports(),
                    this.loadApplications()
                ]);
            }
            
        } catch (error) {
            console.error('Error loading inbox data:', error);
            this.showError('Failed to load inbox data');
        }
    }

    /**
     * Load user notifications
     */
    async loadNotifications() {
        try {
            // Show loading state
            if (this.elements.userNotificationsLoading) {
                this.elements.userNotificationsLoading.style.display = 'block';
            }
            if (this.elements.userNotificationsList) {
                this.elements.userNotificationsList.style.display = 'none';
            }
            if (this.elements.userNotificationsEmpty) {
                this.elements.userNotificationsEmpty.style.display = 'none';
            }

            const api = authManager.api;
            let allNotifications = [];

            // Fetch replies and mentions in parallel
            const [repliesResponse, mentionsResponse] = await Promise.all([
                api.getReplies({ unread_only: false, limit: 25 }),
                api.getMentions({ unread_only: false, limit: 25 })
            ]);

            // Process replies
            if (repliesResponse && repliesResponse.replies) {
                const replies = repliesResponse.replies.map(reply => {
                    const commentReply = reply.comment_reply;
                    const comment = reply.comment;
                    const post = reply.post;
                    const creator = reply.creator;

                    return {
                        id: commentReply.id,
                        type: 'reply',
                        title: `Reply to your ${comment.path === '0' ? 'post' : 'comment'}`,
                        content: `${creator.display_name || creator.name} replied: "${comment.content.substring(0, 100)}${comment.content.length > 100 ? '...' : ''}"`,
                        timestamp: new Date(comment.published),
                        read: commentReply.read,
                        url: `/post/${post.id}#comment-${comment.id}`,
                        rawData: reply
                    };
                });
                allNotifications.push(...replies);
            }

            // Process mentions
            if (mentionsResponse && mentionsResponse.mentions) {
                const mentions = mentionsResponse.mentions.map(mention => {
                    const personMention = mention.person_mention;
                    const comment = mention.comment;
                    const post = mention.post;
                    const creator = mention.creator;

                    return {
                        id: personMention.id,
                        type: 'mention',
                        title: `Mentioned in "${post.name}"`,
                        content: `${creator.display_name || creator.name} mentioned you: "${comment.content.substring(0, 100)}${comment.content.length > 100 ? '...' : ''}"`,
                        timestamp: new Date(comment.published),
                        read: personMention.read,
                        url: `/post/${post.id}#comment-${comment.id}`,
                        rawData: mention
                    };
                });
                allNotifications.push(...mentions);
            }

            // Sort by timestamp (newest first)
            allNotifications.sort((a, b) => b.timestamp - a.timestamp);

            this.inbox.notifications = allNotifications;
            this.renderNotifications();
            this.updateBadges();
            
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showItemError('notifications');
        } finally {
            // Hide loading state
            if (this.elements.userNotificationsLoading) {
                this.elements.userNotificationsLoading.style.display = 'none';
            }
        }
    }

    /**
     * Load messages
     */
    async loadMessages() {
        try {
            // Show loading state
            if (this.elements.messagesLoading) {
                this.elements.messagesLoading.style.display = 'block';
            }
            if (this.elements.messagesList) {
                this.elements.messagesList.style.display = 'none';
            }
            if (this.elements.messagesEmpty) {
                this.elements.messagesEmpty.style.display = 'none';
            }

            const api = authManager.api;
            console.log('Loading private messages...');
            
            // Fetch private messages from API
            const messagesResponse = await api.getPrivateMessages({
                unread_only: false,
                page: 1,
                limit: 50
            });
            
            console.log('Private messages response:', messagesResponse);
            
            // Process private messages
            this.inbox.messages = messagesResponse.private_messages.map(messageView => {
                const message = messageView.private_message;
                const creator = messageView.creator;
                const recipient = messageView.recipient;
                
                // Skip messages with missing user data
                if (!creator || !recipient) {
                    console.warn('Skipping message with missing user data:', messageView);
                    return null;
                }
                
                // Get current user data - try multiple sources
                const currentUser = this.currentUser || authManager.getCurrentUser();
                const currentUserId = currentUser?.id;
                
                // Determine if this is a sent or received message
                // If we don't have current user ID, we can't determine direction, so default to 'received'
                const isFromCurrentUser = currentUserId ? creator.id === currentUserId : false;
                const otherUser = isFromCurrentUser ? recipient : creator;
                
                // Create URL for the message conversation
                const messageUrl = `/messages/conversation/${message.id}`;
                
                return {
                    id: message.id,
                    type: isFromCurrentUser ? 'sent' : 'received',
                    from: otherUser.display_name || otherUser.name,
                    fromUser: otherUser,
                    content: message.content.length > 100 ? 
                             message.content.substring(0, 100) + '...' : 
                             message.content,
                    fullContent: message.content,
                    timestamp: new Date(message.published),
                    read: message.read,
                    url: messageUrl,
                    rawData: messageView
                };
            }).filter(message => message !== null);
            
            // Sort by timestamp (newest first)
            this.inbox.messages.sort((a, b) => b.timestamp - a.timestamp);
            
            console.log(`Loaded ${this.inbox.messages.length} private messages`);

            this.renderMessages();
            this.updateBadges();
            
        } catch (error) {
            console.error('Error loading messages:', error);
            this.showItemError('messages');
        } finally {
            // Hide loading state
            if (this.elements.messagesLoading) {
                this.elements.messagesLoading.style.display = 'none';
            }
        }
    }

    /**
     * Load admin notifications
     */
    /**
     * Load reports from the API
     */
    async loadReports(append = false) {
        if (!this.isAdmin) return;

        // Prevent multiple simultaneous requests
        if (this.pagination.reports.loading) return;
        this.pagination.reports.loading = true;

        try {
            const page = append ? this.pagination.reports.currentPage : 1;
            
            // Reset pagination state if not appending
            if (!append) {
                this.pagination.reports.currentPage = 1;
                this.pagination.reports.hasMore = true;
                this.inbox.reports = [];
            }

            // Show loading state (only for initial load)
            if (!append) {
                if (this.elements.reportsLoading) {
                    this.elements.reportsLoading.style.display = 'block';
                }
                if (this.elements.reportsList) {
                    this.elements.reportsList.style.display = 'none';
                }
                if (this.elements.reportsEmpty) {
                    this.elements.reportsEmpty.style.display = 'none';
                }
            }

            const api = authManager.api;
            let allReports = [];

            // Determine if we're fetching completed (resolved) or unresolved reports
            const isCompletedFilter = this.currentFilter.reports === 'completed';
            const unresolvedOnly = !isCompletedFilter;

            // Fetch different types of reports in parallel
            const [postReportsResponse, commentReportsResponse, messageReportsResponse] = await Promise.all([
                api.listPostReports({ unresolved_only: unresolvedOnly, limit: 20, page: page }),
                api.listCommentReports({ unresolved_only: unresolvedOnly, limit: 20, page: page }),
                api.listPrivateMessageReports({ unresolved_only: unresolvedOnly, limit: 20, page: page })
            ]);

            // Process post reports
            if (postReportsResponse && postReportsResponse.post_reports) {
                const postReports = postReportsResponse.post_reports
                    .filter(report => isCompletedFilter ? report.post_report.resolved : !report.post_report.resolved)
                    .map(report => ({
                        id: `post-${report.post_report.id}`,
                        type: 'post',
                        title: `Post Report: "${report.post.name}"`,
                        content: report.post_report.reason,
                        timestamp: new Date(report.post_report.published),
                        read: false,
                        url: `/post/${report.post.id}`,
                        originalId: report.post_report.id,
                        resolved: report.post_report.resolved,
                        resolver: report.resolver,
                        rawData: report
                    }));
                allReports.push(...postReports);
            }

            // Process comment reports
            if (commentReportsResponse && commentReportsResponse.comment_reports) {
                const commentReports = commentReportsResponse.comment_reports
                    .filter(report => isCompletedFilter ? report.comment_report.resolved : !report.comment_report.resolved)
                    .map(report => ({
                        id: `comment-${report.comment_report.id}`,
                        type: 'comment',
                        title: `Comment Report: "${report.post.name}"`,
                        content: report.comment_report.reason,
                        timestamp: new Date(report.comment_report.published),
                        read: false,
                        url: `/post/${report.post.id}#comment-${report.comment.id}`,
                        originalId: report.comment_report.id,
                        resolved: report.comment_report.resolved,
                        resolver: report.resolver,
                        rawData: report
                    }));
                allReports.push(...commentReports);
            }

            // Process private message reports
            if (messageReportsResponse && messageReportsResponse.private_message_reports) {
                const messageReports = messageReportsResponse.private_message_reports
                    .filter(report => isCompletedFilter ? report.private_message_report.resolved : !report.private_message_report.resolved)
                    .map(report => ({
                        id: `message-${report.private_message_report.id}`,
                        type: 'message',
                        title: `Message Report`,
                        content: report.private_message_report.reason,
                        timestamp: new Date(report.private_message_report.published),
                        read: false,
                        url: '#',
                        originalId: report.private_message_report.id,
                        resolved: report.private_message_report.resolved,
                        resolver: report.resolver,
                        rawData: report
                    }));
                allReports.push(...messageReports);
            }

            // Sort by timestamp (newest first)
            allReports.sort((a, b) => b.timestamp - a.timestamp);

            // Check if we have more data by examining each response
            const postReportsCount = (postReportsResponse && postReportsResponse.post_reports) ? postReportsResponse.post_reports.length : 0;
            const commentReportsCount = (commentReportsResponse && commentReportsResponse.comment_reports) ? commentReportsResponse.comment_reports.length : 0;
            const messageReportsCount = (messageReportsResponse && messageReportsResponse.private_message_reports) ? messageReportsResponse.private_message_reports.length : 0;
            
            // If any endpoint returned a full page (20 items), there might be more data
            if (postReportsCount === 20 || commentReportsCount === 20 || messageReportsCount === 20) {
                this.pagination.reports.currentPage++;
            } else {
                this.pagination.reports.hasMore = false;
            }

            // Append or replace reports
            if (append) {
                this.inbox.reports.push(...allReports);
            } else {
                this.inbox.reports = allReports;
            }

            this.renderReports(append);
            if (!append) {
                this.updateBadges();
            }
            
        } catch (error) {
            console.error('Error loading reports:', error);
            if (!append) {
                this.showItemError('reports');
            }
        } finally {
            this.pagination.reports.loading = false;
            
            // Hide loading state (only for initial load)
            if (!append && this.elements.reportsLoading) {
                this.elements.reportsLoading.style.display = 'none';
            }
        }
    }

    /**
     * Load registration applications from the API
     */
    async loadApplications(append = false) {
        if (!this.isAdmin) return;

        // Prevent multiple simultaneous requests
        if (this.pagination.applications.loading) return;
        this.pagination.applications.loading = true;

        try {
            const page = append ? this.pagination.applications.currentPage : 1;
            
            // Reset pagination state if not appending
            if (!append) {
                this.pagination.applications.currentPage = 1;
                this.pagination.applications.hasMore = true;
                this.inbox.applications = [];
            }

            // Show loading state (only for initial load)
            if (!append) {
                if (this.elements.applicationsLoading) {
                    this.elements.applicationsLoading.style.display = 'block';
                }
                if (this.elements.applicationsList) {
                    this.elements.applicationsList.style.display = 'none';
                }
                if (this.elements.applicationsEmpty) {
                    this.elements.applicationsEmpty.style.display = 'none';
                }
            }

            const api = authManager.api;
            
            // Fetch registration applications
            const applicationsResponse = await api.listRegistrationApplications({
                unread_only: false,
                limit: 20,
                page: page
            });

            let applications = [];
            if (applicationsResponse && applicationsResponse.registration_applications) {
                applications = applicationsResponse.registration_applications.map(app => {
                    // Extract data from the correct API structure
                    const creator = app.creator || {};
                    const creatorLocalUser = app.creator_local_user || {};
                    const application = app.registration_application || {};
                    const admin = app.admin || null;
                    
                    const username = creator.name || 'Unknown User';
                    const email = creatorLocalUser.email || 'No email provided';
                    
                    // Determine status based on admin_id and accepted_application
                    let status = 'pending';
                    if (application.admin_id) {
                        status = creatorLocalUser.accepted_application ? 'approved' : 'denied';
                    }
                    
                    return {
                        id: application.id,
                        type: 'application',
                        title: `Registration: ${username}`,
                        content: application.answer || 'No answer provided',
                        timestamp: new Date(application.published),
                        read: false,
                        status: status,
                        url: '#',
                        rawData: app,
                        username: username,
                        email: email,
                        admin: admin
                    };
                });
            }

            // Sort by timestamp (newest first)
            applications.sort((a, b) => b.timestamp - a.timestamp);

            // Check if we have more data
            if (applications.length < 20) { // Less than limit means no more data
                this.pagination.applications.hasMore = false;
            } else {
                this.pagination.applications.currentPage++;
            }

            // Append or replace applications
            if (append) {
                this.inbox.applications.push(...applications);
            } else {
                this.inbox.applications = applications;
            }

            this.renderApplications(append);
            if (!append) {
                this.updateBadges();
            }
            
        } catch (error) {
            console.error('Error loading applications:', error);
            if (!append) {
                this.showItemError('applications');
            }
        } finally {
            this.pagination.applications.loading = false;
            
            // Hide loading state (only for initial load)
            if (!append && this.elements.applicationsLoading) {
                this.elements.applicationsLoading.style.display = 'none';
            }
        }
    }

    /**
     * Render notifications
     */
    renderNotifications() {
        const container = this.elements.userNotificationsList;
        if (!container) return;

        const filteredNotifications = this.filterNotifications();

        if (filteredNotifications.length === 0) {
            container.style.display = 'none';
            if (this.elements.userNotificationsEmpty) {
                this.elements.userNotificationsEmpty.style.display = 'block';
            }
            return;
        }

        container.style.display = 'block';
        if (this.elements.userNotificationsEmpty) {
            this.elements.userNotificationsEmpty.style.display = 'none';
        }

        container.innerHTML = filteredNotifications.map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}" 
                 data-notification-id="${notification.id}" data-expanded="false">
                <div class="notification-content">
                    <div class="notification-header">
                        <div class="notification-icon-wrapper">
                            <i class="bi ${this.getNotificationIcon(notification.type)} notification-icon"></i>
                        </div>
                        <div class="notification-info">
                            <h6 class="notification-title">${notification.title}</h6>
                            <div class="notification-meta">
                                <span class="notification-time">${this.formatTimestamp(notification.timestamp)}</span>
                                ${!notification.read ? '<span class="notification-badge">New</span>' : ''}
                            </div>
                        </div>
                        <div class="notification-actions">
                            <div class="dropdown">
                                <button class="notification-menu-btn" type="button" data-bs-toggle="dropdown">
                                    <i class="bi bi-three-dots"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end">
                                    ${!notification.read ? '<li><a class="dropdown-item" href="#" onclick="inboxApp.markNotificationRead(' + notification.id + ')"><i class="bi bi-check me-2"></i>Mark as read</a></li>' : ''}
                                    <li><a class="dropdown-item text-danger" href="#" onclick="inboxApp.deleteNotification(' + notification.id + ')"><i class="bi bi-trash me-2"></i>Delete</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div class="notification-body">
                        <p class="notification-preview">${notification.content}</p>
                        <div class="notification-full-content" style="display: none;">
                            <div class="notification-expanded-text">
                                ${notification.rawData ? this.getFullNotificationContent(notification) : notification.content}
                            </div>
                        </div>
                    </div>
                    
                    <div class="notification-footer">
                        <button class="notification-btn notification-btn-primary expand-btn" onclick="inboxApp.toggleNotificationExpansion(${notification.id})">
                            <i class="bi bi-chevron-down expand-icon"></i>
                            <span class="expand-text">Show Full</span>
                        </button>
                        <button class="notification-btn notification-btn-secondary" onclick="event.preventDefault(); event.stopPropagation(); inboxApp.goToPost('${notification.url}');">
                            <i class="bi bi-arrow-right"></i>
                            <span>Go to Post</span>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click handlers for notifications (no auto-mark as read)
        container.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Only handle navigation for notification titles or content areas
                // Don't auto-mark as read - user must explicitly use the dropdown menu
                if (e.target.closest('.notification-title') || e.target.closest('.notification-preview')) {
                    const notificationId = parseInt(item.dataset.notificationId);
                    const notification = this.inbox.notifications.find(n => n.id === notificationId);
                    if (notification && notification.url) {
                        // Navigate to the post/comment without marking as read
                        this.goToPost(notification.url);
                    }
                }
            });
        });
    }

    /**
     * Render messages with messenger-style interface
     */
    renderMessages() {
        const container = this.elements.messagesList;
        if (!container) return;

        // Show all messages in messenger interface (no filtering needed)
        const allMessages = this.inbox.messages || [];

        if (allMessages.length === 0) {
            container.style.display = 'none';
            if (this.elements.messagesEmpty) {
                this.elements.messagesEmpty.style.display = 'block';
            }
            return;
        }

        container.style.display = 'block';
        if (this.elements.messagesEmpty) {
            this.elements.messagesEmpty.style.display = 'none';
        }

        // Group messages by conversation (other user)
        const conversations = this.groupMessagesByUser(allMessages);
        
        // Sort conversations by most recent activity (newest first)
        const sortedConversations = Object.entries(conversations).sort(([, convA], [, convB]) => {
            return convB.lastMessage.timestamp - convA.lastMessage.timestamp;
        });
        
        // Create messenger-style layout
        container.innerHTML = `
            <div class="messenger-container">
                <div class="conversations-panel">
                    <div class="conversations-header">
                        <h6 class="mb-0"><i class="bi bi-chat-dots me-2"></i>Conversations</h6>
                    </div>
                    <div class="conversations-list">
                        ${sortedConversations.map(([userId, conv]) => `
                            <div class="conversation-item ${conv.unreadCount > 0 ? 'has-unread' : ''}" 
                                 data-user-id="${userId}" 
                                 onclick="inboxApp.selectConversation('${userId}')">
                                <div class="conversation-avatar">
                                    ${conv.otherUser.avatar ? 
                                        `<img src="${conv.otherUser.avatar}" alt="${conv.otherUser.name}" class="avatar-img">` :
                                        `<div class="avatar-placeholder">${conv.otherUser.name.charAt(0).toUpperCase()}</div>`
                                    }
                                </div>
                                <div class="conversation-info">
                                    <div class="conversation-name">${conv.otherUser.display_name || conv.otherUser.name}</div>
                                    <div class="conversation-preview">${conv.lastMessage.content}</div>
                                    <div class="conversation-time">${this.formatTimestamp(conv.lastMessage.timestamp)}</div>
                                </div>
                                ${conv.unreadCount > 0 ? `<div class="unread-badge">${conv.unreadCount}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="chat-panel">
                    <div class="chat-placeholder">
                        <i class="bi bi-chat-quote display-1 text-muted"></i>
                        <h5 class="mt-3 text-muted">Select a conversation</h5>
                        <p class="text-muted">Choose a conversation from the left to view messages</p>
                    </div>
                </div>
            </div>
        `;

        // Initialize first conversation if any exist (most recent)
        if (sortedConversations.length > 0) {
            const firstUserId = sortedConversations[0][0];
            setTimeout(() => this.selectConversation(firstUserId), 100);
        }

        // Add messenger CSS if not already added
        this.addMessengerStyles();
    }

    /**
     * Group messages by conversation partner
     */
    groupMessagesByUser(messages) {
        const conversations = {};
        
        messages.forEach(message => {
            // For sent messages, the "other user" is the recipient
            // For received messages, the "other user" is the sender (fromUser)
            const otherUser = message.type === 'sent' ? 
                (message.rawData?.recipient || message.fromUser) : 
                message.fromUser;
            const otherUserId = otherUser.id;
            
            if (!conversations[otherUserId]) {
                conversations[otherUserId] = {
                    otherUser: otherUser,
                    messages: [],
                    lastMessage: null,
                    unreadCount: 0
                };
            }
            
            conversations[otherUserId].messages.push(message);
            
            // Update last message (most recent)
            if (!conversations[otherUserId].lastMessage || 
                message.timestamp > conversations[otherUserId].lastMessage.timestamp) {
                conversations[otherUserId].lastMessage = message;
            }
            
            // Count unread messages
            if (!message.read && message.type !== 'sent') {
                conversations[otherUserId].unreadCount++;
            }
        });
        
        // Sort messages within each conversation by timestamp
        Object.values(conversations).forEach(conv => {
            conv.messages.sort((a, b) => a.timestamp - b.timestamp);
        });
        
        return conversations;
    }

    /**
     * Select and display a conversation
     */
         selectConversation(userId) {
         const conversations = this.groupMessagesByUser(this.inbox.messages || []);
        const conversation = conversations[userId];
        
        if (!conversation) return;

        // Update active conversation
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-user-id="${userId}"]`)?.classList.add('active');

        // Render chat messages
        const chatPanel = document.querySelector('.chat-panel');
        if (!chatPanel) return;

                 chatPanel.innerHTML = `
             <div class="chat-header">
                 <div class="chat-user-info">
                     <div class="chat-avatar">
                         ${conversation.otherUser.avatar ? 
                             `<img src="${conversation.otherUser.avatar}" alt="${conversation.otherUser.name}" class="avatar-img">` :
                             `<div class="avatar-placeholder">${conversation.otherUser.name.charAt(0).toUpperCase()}</div>`
                         }
                     </div>
                     <div class="chat-user-details">
                         <h6 class="mb-0">
                             ${(() => {
                                 // Determine the proper URL and display for federated users
                                 let userUrl = `/u/${conversation.otherUser.name}`;
                                 let displayName = conversation.otherUser.display_name || conversation.otherUser.name;
                                 
                                 // Check if this is a federated user
                                 if (!conversation.otherUser.local && conversation.otherUser.actor_id) {
                                     try {
                                         const actorUrl = new URL(conversation.otherUser.actor_id);
                                         userUrl = `/u/${conversation.otherUser.name}@${actorUrl.hostname}`;
                                     } catch (e) {
                                         console.warn('Failed to parse user actor_id:', conversation.otherUser.actor_id);
                                     }
                                 }
                                 
                                 return `<a href="${userUrl}" class="text-decoration-none" 
                                           onclick="event.preventDefault(); window.location.href='${userUrl}';">
                                             ${displayName}
                                         </a>`;
                             })()}
                         </h6>
                         <small class="text-muted">
                             ${(() => {
                                 // Show proper username format for local vs federated users
                                 if (!conversation.otherUser.local && conversation.otherUser.actor_id) {
                                     try {
                                         const actorUrl = new URL(conversation.otherUser.actor_id);
                                         return `@${conversation.otherUser.name}@${actorUrl.hostname} <span class="badge bg-secondary ms-1" style="font-size: 0.65rem;">Remote</span>`;
                                     } catch (e) {
                                         return `@${conversation.otherUser.name}`;
                                     }
                                 } else {
                                     return `@${conversation.otherUser.name} <span class="badge bg-primary ms-1" style="font-size: 0.65rem;">Local</span>`;
                                 }
                             })()}
                         </small>
                     </div>
                 </div>
             </div>
            <div class="chat-messages">
                ${conversation.messages.map(message => `
                    <div class="message ${message.type === 'sent' ? 'message-sent' : 'message-received'} ${!message.read ? 'message-unread' : ''}">
                        <div class="message-bubble">
                            <div class="message-content">${message.fullContent}</div>
                            <div class="message-time">${this.formatTimestamp(message.timestamp)}</div>
                        </div>
                        <div class="message-actions">
                            <div class="dropdown">
                                <button class="btn btn-link btn-sm p-0" data-bs-toggle="dropdown">
                                    <i class="bi bi-three-dots"></i>
                                </button>
                                <ul class="dropdown-menu">
                                    ${!message.read && message.type !== 'sent' ? 
                                        `<li><a class="dropdown-item" href="#" onclick="inboxApp.markMessageRead(${message.id})"><i class="bi bi-check me-2"></i>Mark as read</a></li>` : 
                                        ''
                                    }
                                    ${message.type !== 'sent' ? 
                                        `<li><a class="dropdown-item text-warning" href="#" onclick="inboxApp.reportMessage(${message.id})"><i class="bi bi-flag me-2"></i>Report</a></li>` : 
                                        ''
                                    }
                                    <li><a class="dropdown-item text-danger" href="#" onclick="inboxApp.deleteMessage(${message.id})"><i class="bi bi-trash me-2"></i>Delete</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="chat-input">
                <div class="input-group">
                    <input type="text" class="form-control" placeholder="Type a message..." id="message-input-${userId}" 
                           onkeypress="if(event.key==='Enter') inboxApp.sendMessage('${userId}')">
                    <button class="btn btn-primary" onclick="inboxApp.sendMessage('${userId}')">
                        <i class="bi bi-send"></i>
                    </button>
                </div>
            </div>
        `;

        // Scroll to bottom of messages
        const messagesContainer = chatPanel.querySelector('.chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    /**
     * Mark all messages in a conversation as read
     */
         async markConversationRead(userId) {
         const conversations = this.groupMessagesByUser(this.inbox.messages || []);
        const conversation = conversations[userId];
        
        if (!conversation) return;

        // Mark all unread messages in this conversation as read
        for (const message of conversation.messages) {
            if (!message.read && message.type !== 'sent') {
                await this.markMessageRead(message.id);
            }
        }

        // Refresh the conversation view
        this.selectConversation(userId);
        this.renderMessages();
    }

    /**
     * Send a new message
     */
    async sendMessage(userId) {
        const input = document.getElementById(`message-input-${userId}`);
        if (!input || !input.value.trim()) return;

        const content = input.value.trim();
        const sendButton = document.querySelector('.chat-input .btn-primary');

        try {
            // Show loading state
            if (sendButton) {
                sendButton.disabled = true;
                sendButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            }

            // Check authentication
            if (!authManager || !authManager.isAuthenticated()) {
                throw new Error('You must be logged in to send messages');
            }

            // Find the user ID for the API (need the actual recipient ID from the conversation)
            const conversations = this.groupMessagesByUser(this.inbox.messages || []);
            const conversation = conversations[userId];
            
            if (!conversation || !conversation.otherUser) {
                throw new Error('Could not find conversation recipient');
            }

            // Send the message via API
            const api = authManager.api;
            const response = await api.createPrivateMessage({
                content: content,
                recipient_id: parseInt(conversation.otherUser.id) || parseInt(userId)
            });

            if (response) {
                // Clear input
                input.value = '';

                // Create a new message object to add to the conversation
                const currentUser = authManager.getCurrentUser();
                const newMessage = {
                    id: `temp-${Date.now()}`, // Temporary ID until we reload
                    content: content,
                    fullContent: content,
                    timestamp: new Date(),
                    read: true,
                    type: 'sent',
                    creator: currentUser?.person || { name: 'You', id: currentUser?.person?.id },
                    recipient: conversation.otherUser
                };

                // Add the message to the conversation immediately for instant feedback
                conversation.messages.push(newMessage);
                
                // Sort messages by timestamp
                conversation.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                // Update the conversation's latest message time for sorting
                conversation.latestMessageTime = newMessage.timestamp;

                // Also add to the main messages array for consistency
                this.inbox.messages.push(newMessage);

                // Re-render the chat view to show the new message immediately
                this.selectConversation(userId);

                // Also update the conversations list to show the new message
                this.renderMessages();

                // Reload messages from server with a longer delay to ensure server processing
                setTimeout(async () => {
                    console.log('Reloading messages from server...');
                    await this.loadMessages();
                    // Re-select the conversation to show updated data
                    this.selectConversation(userId);
                }, 3000); // Increased to 3 seconds

                console.log('Message sent successfully and displayed');
            }

        } catch (error) {
            console.error('Error sending message:', error);
            
            // Show error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger alert-dismissible fade show mt-2';
            errorDiv.innerHTML = `
                <i class="bi bi-exclamation-triangle me-2"></i>
                Failed to send message: ${error.message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            const chatInput = document.querySelector('.chat-input');
            if (chatInput) {
                chatInput.parentNode.insertBefore(errorDiv, chatInput);
                
                // Auto-remove error after 5 seconds
                setTimeout(() => {
                    if (errorDiv.parentNode) {
                        errorDiv.remove();
                    }
                }, 5000);
            }

        } finally {
            // Restore send button
            if (sendButton) {
                sendButton.disabled = false;
                sendButton.innerHTML = '<i class="bi bi-send"></i>';
            }
        }
    }

         /**
      * Add messenger-specific CSS styles
      */
     addMessengerStyles() {
         if (document.getElementById('messenger-styles')) return;

         const style = document.createElement('style');
         style.id = 'messenger-styles';
         style.textContent = `
             .messenger-container {
                 display: flex;
                 height: 600px;
                 border: 1px solid var(--bs-border-color);
                 border-radius: 0.5rem;
                 overflow: hidden;
                 background-color: var(--bs-body-bg);
             }

             .conversations-panel {
                 width: 300px;
                 border-right: 1px solid var(--bs-border-color);
                 display: flex;
                 flex-direction: column;
                 background-color: var(--bs-body-bg);
             }

             .conversations-header {
                 padding: 1rem;
                 background-color: var(--bs-tertiary-bg);
                 border-bottom: 1px solid var(--bs-border-color);
                 color: var(--bs-body-color);
             }

             .conversations-list {
                 flex: 1;
                 overflow-y: auto;
                 background-color: var(--bs-body-bg);
             }

             .conversation-item {
                 display: flex;
                 align-items: center;
                 padding: 0.75rem 1rem;
                 cursor: pointer;
                 border-bottom: 1px solid var(--bs-border-color-translucent);
                 transition: background-color 0.2s;
                 position: relative;
                 color: var(--bs-body-color);
             }

             .conversation-item:hover {
                 background-color: var(--bs-secondary-bg);
             }

             .conversation-item.active {
                 background-color: var(--bs-primary-bg-subtle);
                 border-left: 3px solid var(--bs-primary);
             }

             /* Fix for conversation item that might have a white background */
             .conversation-item * {
                 background-color: transparent !important;
             }

             .conversation-item.has-unread {
                 font-weight: 600;
             }

             .conversation-avatar {
                 width: 40px;
                 height: 40px;
                 margin-right: 0.75rem;
                 flex-shrink: 0;
             }

             .avatar-img {
                 width: 100%;
                 height: 100%;
                 border-radius: 50%;
                 object-fit: cover;
                 border: 2px solid var(--bs-border-color);
             }

             .avatar-placeholder {
                 width: 100%;
                 height: 100%;
                 border-radius: 50%;
                 background-color: var(--bs-primary);
                 color: white;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 font-weight: 600;
                 border: 2px solid var(--bs-border-color);
             }

             .conversation-info {
                 flex: 1;
                 min-width: 0;
             }

             .conversation-name {
                 font-weight: 500;
                 margin-bottom: 0.25rem;
                 white-space: nowrap;
                 overflow: hidden;
                 text-overflow: ellipsis;
                 color: var(--bs-body-color);
             }

             .conversation-preview {
                 font-size: 0.875rem;
                 color: var(--bs-secondary-color);
                 white-space: nowrap;
                 overflow: hidden;
                 text-overflow: ellipsis;
                 margin-bottom: 0.25rem;
             }

             .conversation-time {
                 font-size: 0.75rem;
                 color: var(--bs-secondary-color);
             }

             .unread-badge {
                 background-color: var(--bs-primary);
                 color: var(--bs-primary-text, white);
                 border-radius: 50%;
                 width: 20px;
                 height: 20px;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 font-size: 0.75rem;
                 font-weight: 600;
                 margin-left: 0.5rem;
             }

             .chat-panel {
                 flex: 1;
                 display: flex;
                 flex-direction: column;
                 background-color: var(--bs-body-bg);
             }

             .chat-placeholder {
                 flex: 1;
                 display: flex;
                 flex-direction: column;
                 align-items: center;
                 justify-content: center;
                 text-align: center;
                 background-color: var(--bs-body-bg);
                 color: var(--bs-secondary-color);
             }

             .chat-header {
                 padding: 1rem;
                 background-color: var(--bs-tertiary-bg);
                 border-bottom: 1px solid var(--bs-border-color);
                 display: flex;
                 align-items: center;
                 justify-content: space-between;
                 color: var(--bs-body-color);
             }

             .chat-user-info {
                 display: flex;
                 align-items: center;
             }

             .chat-avatar {
                 width: 40px;
                 height: 40px;
                 margin-right: 0.75rem;
             }

             .chat-messages {
                 flex: 1;
                 padding: 1rem;
                 overflow-y: auto;
                 background-color: var(--bs-body-bg);
             }

             /* Custom scrollbar for dark theme */
             .chat-messages::-webkit-scrollbar,
             .conversations-list::-webkit-scrollbar {
                 width: 6px;
             }

             .chat-messages::-webkit-scrollbar-track,
             .conversations-list::-webkit-scrollbar-track {
                 background: var(--bs-tertiary-bg);
             }

             .chat-messages::-webkit-scrollbar-thumb,
             .conversations-list::-webkit-scrollbar-thumb {
                 background: var(--bs-secondary-color);
                 border-radius: 3px;
             }

             .chat-messages::-webkit-scrollbar-thumb:hover,
             .conversations-list::-webkit-scrollbar-thumb:hover {
                 background: var(--bs-body-color);
             }

             .message {
                 display: flex;
                 margin-bottom: 1rem;
                 align-items: flex-start;
             }

             .message-sent {
                 justify-content: flex-end;
             }

             .message-sent .message-bubble {
                 background-color: var(--bs-primary);
                 color: var(--bs-primary-text, white);
                 margin-left: 3rem;
             }

             .message-received .message-bubble {
                 background-color: var(--bs-tertiary-bg);
                 color: var(--bs-body-color);
                 margin-right: 3rem;
                 border: 1px solid var(--bs-border-color);
             }

             /* Dark theme specific styling */
             [data-theme="dark"] .message-received .message-bubble {
                 background-color: var(--bs-gray-800);
                 border-color: var(--bs-gray-600);
                 color: var(--bs-gray-100);
             }

             [data-theme="dark"] .conversations-header,
             [data-theme="dark"] .chat-header {
                 background-color: var(--bs-gray-900);
                 border-color: var(--bs-gray-700);
             }

             [data-theme="dark"] .conversation-item:hover {
                 background-color: var(--bs-gray-800);
             }

             [data-theme="dark"] .conversation-item.active {
                 background-color: var(--bs-gray-800);
                 border-left-color: var(--bs-primary);
             }

             [data-theme="dark"] .avatar-img,
             [data-theme="dark"] .avatar-placeholder {
                 border-color: var(--bs-gray-600);
             }

             [data-theme="dark"] .chat-input {
                 background-color: var(--bs-gray-900);
                 border-color: var(--bs-gray-700);
             }

             [data-theme="dark"] .chat-input .form-control {
                 background-color: var(--bs-gray-800);
                 border-color: var(--bs-gray-600);
                 color: var(--bs-gray-100);
             }

             [data-theme="dark"] .chat-input .form-control:focus {
                 background-color: var(--bs-gray-800);
                 border-color: var(--bs-primary);
                 color: var(--bs-gray-100);
                 box-shadow: 0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.25);
             }

             [data-theme="dark"] .chat-input .form-control::placeholder {
                 color: var(--bs-gray-400);
             }

             .message-bubble {
                 padding: 0.75rem 1rem;
                 border-radius: 1rem;
                 max-width: 70%;
                 word-wrap: break-word;
                 position: relative;
                 box-shadow: 0 1px 2px rgba(0,0,0,0.1);
             }

             .message-content {
                 margin-bottom: 0.25rem;
                 line-height: 1.4;
             }

             .message-time {
                 font-size: 0.75rem;
                 opacity: 0.7;
             }

             .message-unread {
                 animation: slideIn 0.3s ease;
             }

             .message-actions {
                 opacity: 0;
                 transition: opacity 0.2s;
                 margin: 0 0.5rem;
                 align-self: center;
             }

             .message:hover .message-actions {
                 opacity: 1;
             }

             .chat-input {
                 padding: 1rem;
                 border-top: 1px solid var(--bs-border-color);
                 background-color: var(--bs-tertiary-bg);
             }

             .chat-input .form-control {
                 background-color: var(--bs-body-bg);
                 border-color: var(--bs-border-color);
                 color: var(--bs-body-color);
             }

             .chat-input .form-control:focus {
                 background-color: var(--bs-body-bg);
                 border-color: var(--bs-primary);
                 color: var(--bs-body-color);
                 box-shadow: 0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.25);
             }

             .chat-input .form-control::placeholder {
                 color: var(--bs-secondary-color);
             }

             @keyframes slideIn {
                 from {
                     opacity: 0;
                     transform: translateY(10px);
                 }
                 to {
                     opacity: 1;
                     transform: translateY(0);
                 }
             }

             @media (max-width: 768px) {
                 .conversations-panel {
                     width: 250px;
                 }
                 
                 .message-bubble {
                     max-width: 85%;
                 }
                 
                 .message-sent .message-bubble {
                     margin-left: 1rem;
                 }
                 
                 .message-received .message-bubble {
                     margin-right: 1rem;
                 }
             }

             /* Improved dark theme contrast */
             [data-theme="dark"] .messenger-container {
                 border-color: var(--bs-gray-700);
             }

             [data-theme="dark"] .chat-placeholder {
                 color: var(--bs-gray-400);
             }

             [data-theme="dark"] .conversation-preview,
             [data-theme="dark"] .conversation-time {
                 color: var(--bs-gray-400);
             }

             /* Clickable user name in chat header */
             .chat-user-details h6 a {
                 color: var(--bs-body-color);
                 transition: color 0.2s;
             }

             .chat-user-details h6 a:hover {
                 color: var(--bs-primary);
                 text-decoration: underline !important;
             }
         `;
         document.head.appendChild(style);
     }

    /**
     * Render admin notifications
     */
    /**
     * Render reports
     */
    renderReports(append = false) {
        const container = this.elements.reportsList;
        if (!container) return;

        const filteredReports = this.filterReports();

        if (filteredReports.length === 0 && !append) {
            container.style.display = 'none';
            if (this.elements.reportsEmpty) {
                this.elements.reportsEmpty.style.display = 'block';
            }
            return;
        }

        container.style.display = 'block';
        if (this.elements.reportsEmpty) {
            this.elements.reportsEmpty.style.display = 'none';
        }

        const reportHTML = filteredReports.map(report => `
            <div class="list-group-item list-group-item-action ${report.resolved ? 'border-start border-success border-3' : 'border-start border-danger border-3'} mb-3 shadow-sm" 
                 data-report-id="${report.id}">
                <div class="d-flex w-100 justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <i class="bi ${this.getReportIcon(report.type)} me-2 ${report.resolved ? 'text-success' : 'text-danger'}"></i>
                            <h6 class="mb-0 fw-bold">${report.title}</h6>
                            <span class="badge ${report.resolved ? 'bg-success' : 'bg-danger'} ms-2">
                                ${report.resolved ? 'Resolved' : 'New'}
                            </span>
                        </div>
                        <p class="mb-1 text-muted small">${report.content}</p>
                        ${report.resolved && report.resolver ? `
                            <div class="mt-2 p-2 bg-secondary rounded">
                                <small class="text-light">
                                    <strong>Resolved by ${report.resolver.name}</strong>
                                </small>
                            </div>
                        ` : ''}
                        <small class="text-muted">${this.formatTimestamp(report.timestamp)}</small>
                    </div>
                    <div class="dropdown">
                        <button class="btn btn-link btn-sm text-muted" type="button" data-bs-toggle="dropdown">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            ${!report.resolved ? `
                                <li><a class="dropdown-item" href="#" onclick="inboxApp.resolveReport('${report.id}')">
                                    <i class="bi bi-check-circle me-2"></i>Resolve Report
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                            ` : ''}
                            <li><a class="dropdown-item" href="#" onclick="inboxApp.viewReport('${report.id}')">
                                <i class="bi bi-eye me-2"></i>View Content
                            </a></li>
                            ${!report.resolved ? `
                                <li><hr class="dropdown-divider"></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="inboxApp.dismissReport('${report.id}')">
                                    <i class="bi bi-x-circle me-2"></i>Dismiss
                                </a></li>
                            ` : ''}
                        </ul>
                    </div>
                </div>
            </div>
        `).join('');

        // Append or replace content
        if (append) {
            container.insertAdjacentHTML('beforeend', reportHTML);
        } else {
            container.innerHTML = reportHTML;
        }

        // Add click handlers for new reports only (to avoid duplicate handlers)
        const newItems = append ? 
            container.querySelectorAll('.list-group-item:not([data-click-handler])') :
            container.querySelectorAll('.list-group-item');
            
        newItems.forEach(item => {
            item.setAttribute('data-click-handler', 'true');
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown')) {
                    const reportId = item.dataset.reportId;
                    this.handleReportClick(reportId);
                }
            });
        });
    }

    /**
     * Render applications
     */
    renderApplications(append = false) {
        const container = this.elements.applicationsList;
        if (!container) return;

        const filteredApplications = this.filterApplications();

        if (filteredApplications.length === 0 && !append) {
            container.style.display = 'none';
            if (this.elements.applicationsEmpty) {
                this.elements.applicationsEmpty.style.display = 'block';
            }
            return;
        }

        container.style.display = 'block';
        if (this.elements.applicationsEmpty) {
            this.elements.applicationsEmpty.style.display = 'none';
        }

        const applicationHTML = filteredApplications.map(app => `
            <div class="list-group-item list-group-item-action ${app.status === 'pending' ? 'border-start border-info border-3' : ''} mb-3 shadow-sm" 
                 data-application-id="${app.id}">
                <div class="d-flex w-100 justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <i class="bi bi-person-plus me-2 text-info"></i>
                            <h6 class="mb-0 fw-bold">${app.username}</h6>
                            <span class="badge ${this.getApplicationStatusClass(app.status)} ms-2">
                                ${app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                            </span>
                        </div>
                        <p class="mb-1 text-muted small"><strong>Email:</strong> ${app.email}</p>
                        <p class="mb-1 text-muted small">${app.content}</p>
                        ${app.status !== 'pending' && app.admin ? `
                            <div class="mt-2 p-2 bg-secondary rounded">
                                <small class="text-light">
                                    <strong>${app.status === 'approved' ? 'Approved' : 'Denied'} by ${app.admin.name}</strong>
                                    ${app.rawData.registration_application.deny_reason ? `<br><em>Reason: ${app.rawData.registration_application.deny_reason}</em>` : ''}
                                </small>
                            </div>
                        ` : ''}
                        <small class="text-muted">${this.formatTimestamp(app.timestamp)}</small>
                    </div>
                    <div class="dropdown">
                        <button class="btn btn-link btn-sm text-muted" type="button" data-bs-toggle="dropdown">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            ${app.status === 'pending' ? `
                                <li><a class="dropdown-item text-success" href="#" onclick="inboxApp.approveApplication(${app.id})">
                                    <i class="bi bi-check-circle me-2"></i>Approve
                                </a></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="inboxApp.denyApplication(${app.id})">
                                    <i class="bi bi-x-circle me-2"></i>Deny
                                </a></li>
                                <li><hr class="dropdown-divider"></li>
                            ` : ''}
                            <li><a class="dropdown-item" href="#" onclick="inboxApp.viewApplication(${app.id})">
                                <i class="bi bi-eye me-2"></i>View Details
                            </a></li>
                        </ul>
                    </div>
                </div>
            </div>
        `).join('');

        // Append or replace content
        if (append) {
            container.insertAdjacentHTML('beforeend', applicationHTML);
        } else {
            container.innerHTML = applicationHTML;
        }

        // Add click handlers for new applications only (to avoid duplicate handlers)
        const newItems = append ? 
            container.querySelectorAll('.list-group-item:not([data-click-handler])') :
            container.querySelectorAll('.list-group-item');
            
        newItems.forEach(item => {
            item.setAttribute('data-click-handler', 'true');
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.dropdown')) {
                    const applicationId = parseInt(item.dataset.applicationId);
                    this.handleApplicationClick(applicationId);
                }
            });
        });
    }

    /**
     * Filter notifications based on current filter
     */
    filterNotifications() {
        const filter = this.currentFilter.notifications;
        
        switch (filter) {
            case 'unread':
                return this.inbox.notifications.filter(n => !n.read);
            case 'mentions':
                return this.inbox.notifications.filter(n => n.type === 'mention');
            case 'replies':
                return this.inbox.notifications.filter(n => n.type === 'reply');
            default:
                return this.inbox.notifications;
        }
    }

    /**
     * Filter messages based on current filter
     */
    filterMessages() {
        const filter = this.currentFilter.messages;
        
        switch (filter) {
            case 'unread':
                return this.inbox.messages.filter(m => !m.read);
            case 'sent':
                return this.inbox.messages.filter(m => m.type === 'sent');
            default:
                return this.inbox.messages;
        }
    }

    /**
     * Filter reports based on current filter
     */
    filterReports() {
        const filter = this.currentFilter.reports;
        
        switch (filter) {
            case 'posts':
                return this.inbox.reports.filter(r => r.type === 'post');
            case 'comments':
                return this.inbox.reports.filter(r => r.type === 'comment');
            case 'messages':
                return this.inbox.reports.filter(r => r.type === 'message');
            case 'completed':
                // For completed filter, return all reports (they're already filtered as resolved in loadReports)
                return this.inbox.reports;
            default:
                return this.inbox.reports;
        }
    }

    /**
     * Filter applications based on current filter
     */
    filterApplications() {
        const filter = this.currentFilter.applications;
        
        switch (filter) {
            case 'pending':
                return this.inbox.applications.filter(a => a.status === 'pending');
            case 'approved':
                return this.inbox.applications.filter(a => a.status === 'approved');
            case 'denied':
                return this.inbox.applications.filter(a => a.status === 'denied');
            default:
                return this.inbox.applications;
        }
    }

    /**
     * Set notification filter
     */
    setNotificationFilter(filter) {
        this.currentFilter.notifications = filter;
        
        // Update active filter button
        const userFilterButtons = [this.elements.filterAll, this.elements.filterUnread, this.elements.filterMentions, this.elements.filterReplies];
        userFilterButtons.forEach(btn => btn?.classList.remove('active'));
        
        const activeButton = {
            'all': this.elements.filterAll,
            'unread': this.elements.filterUnread,
            'mentions': this.elements.filterMentions,
            'replies': this.elements.filterReplies
        }[filter];
        
        activeButton?.classList.add('active');
        
        this.renderNotifications();
    }

    /**
     * Set message filter
     */
    setMessageFilter(filter) {
        this.currentFilter.messages = filter;
        
        // Update active filter button
        const messageFilterButtons = [this.elements.messagesFilterAll, this.elements.messagesFilterUnread, this.elements.messagesFilterSent];
        messageFilterButtons.forEach(btn => btn?.classList.remove('active'));
        
        const activeButton = {
            'all': this.elements.messagesFilterAll,
            'unread': this.elements.messagesFilterUnread,
            'sent': this.elements.messagesFilterSent
        }[filter];
        
        activeButton?.classList.add('active');
        
        this.renderMessages();
    }

    /**
     * Set reports filter
     */
    setReportsFilter(filter) {
        this.currentFilter.reports = filter;
        
        if (filter === 'completed') {
            // When showing completed reports, disable regular filter buttons and check toggle
            const reportsFilterButtons = [this.elements.reportsFilterAll, this.elements.reportsFilterPosts, this.elements.reportsFilterComments, this.elements.reportsFilterMessages];
            reportsFilterButtons.forEach(btn => btn?.classList.remove('active'));
            
            if (this.elements.reportsCompletedToggle) {
                this.elements.reportsCompletedToggle.checked = true;
            }
        } else {
            // Update active filter button for regular filters
            const reportsFilterButtons = [this.elements.reportsFilterAll, this.elements.reportsFilterPosts, this.elements.reportsFilterComments, this.elements.reportsFilterMessages];
            reportsFilterButtons.forEach(btn => btn?.classList.remove('active'));
            
            const activeButton = {
                'all': this.elements.reportsFilterAll,
                'posts': this.elements.reportsFilterPosts,
                'comments': this.elements.reportsFilterComments,
                'messages': this.elements.reportsFilterMessages
            }[filter];
            
            activeButton?.classList.add('active');
            
            if (this.elements.reportsCompletedToggle) {
                this.elements.reportsCompletedToggle.checked = false;
            }
        }
        
        // Reset pagination and reload reports with new filter
        this.pagination.reports.currentPage = 1;
        this.pagination.reports.hasMore = true;
        this.loadReports();
    }

    /**
     * Set applications filter
     */
    setApplicationsFilter(filter) {
        this.currentFilter.applications = filter;
        
        // Update active filter button
        const applicationsFilterButtons = [this.elements.applicationsFilterAll, this.elements.applicationsFilterPending, this.elements.applicationsFilterApproved, this.elements.applicationsFilterDenied];
        applicationsFilterButtons.forEach(btn => btn?.classList.remove('active'));
        
        const activeButton = {
            'pending': this.elements.applicationsFilterPending,
            'all': this.elements.applicationsFilterAll,
            'approved': this.elements.applicationsFilterApproved,
            'denied': this.elements.applicationsFilterDenied
        }[filter];
        
        activeButton?.classList.add('active');
        
        // Reset pagination and reload applications with new filter
        this.pagination.applications.currentPage = 1;
        this.pagination.applications.hasMore = true;
        this.loadApplications();
    }

    /**
     * Update notification count badges
     */
    updateBadges() {
        // User notifications
        const unreadNotificationCount = this.inbox.notifications.filter(n => !n.read).length;
        if (this.elements.userNotificationsBadge) {
            this.elements.userNotificationsBadge.textContent = unreadNotificationCount;
            this.elements.userNotificationsBadge.style.display = unreadNotificationCount > 0 ? 'inline' : 'none';
        }

        // Messages (only count unread received messages, not sent)
        const unreadMessageCount = this.inbox.messages.filter(m => !m.read && m.type !== 'sent').length;
        if (this.elements.messagesBadge) {
            this.elements.messagesBadge.textContent = unreadMessageCount;
            this.elements.messagesBadge.style.display = unreadMessageCount > 0 ? 'inline' : 'none';
        }

        // Reports and applications counts
        const reportsCount = this.isAdmin ? this.inbox.reports.length : 0;
        const applicationsCount = this.isAdmin ? this.inbox.applications.filter(a => a.status === 'pending').length : 0;
        const totalAdminCount = reportsCount + applicationsCount;
        
        // For navbar badge, we want to show unresolved reports + pending applications regardless of current filter
        const unresolvedReportsCount = this.isAdmin ? this.inbox.reports.filter(r => !r.resolved).length : 0;
        const navbarAdminCount = unresolvedReportsCount + applicationsCount;
        
        if (this.isAdmin) {
            // Update reports count
            if (this.elements.reportsCount) {
                this.elements.reportsCount.textContent = reportsCount;
            }
            
            // Update applications count  
            if (this.elements.applicationsCount) {
                this.elements.applicationsCount.textContent = applicationsCount;
            }
            
            // Update admin tab badge with total
            if (this.elements.adminNotificationsBadge) {
                this.elements.adminNotificationsBadge.textContent = totalAdminCount;
                this.elements.adminNotificationsBadge.style.display = totalAdminCount > 0 ? 'inline' : 'none';
            }
        }

        // Update navbar notification badges
        this.updateNavbarBadges(unreadNotificationCount, navbarAdminCount);
        
        // Also refresh navbar counts from API to keep them in sync
        if (window.navbar && typeof window.navbar.refreshNotificationCounts === 'function') {
            window.navbar.refreshNotificationCounts();
        }
    }

    /**
     * Update navbar notification badges
     */
    updateNavbarBadges(notificationCount, adminCount) {
        // Calculate total notification count including messages for navbar
        const unreadMessageCount = this.inbox.messages.filter(m => !m.read && m.type !== 'sent').length;
        const totalNavbarCount = notificationCount + unreadMessageCount;
        
        // Check if window.navbar exists (when not on inbox page)
        if (window.navbar && typeof window.navbar.updateNotifications === 'function') {
            window.navbar.updateNotifications(totalNavbarCount);
            if (typeof window.navbar.updateAdminNotifications === 'function') {
                window.navbar.updateAdminNotifications(adminCount);
            }
        }
        
        // Also update any existing navbar elements directly (when on inbox page)
        const notificationBadge = document.querySelector('#notification-count');
        if (notificationBadge) {
            notificationBadge.textContent = totalNavbarCount > 0 ? totalNavbarCount : '';
            notificationBadge.style.display = totalNavbarCount > 0 ? 'inline' : 'none';
        }

        const adminBadge = document.querySelector('#admin-notification-count');
        if (adminBadge) {
            adminBadge.textContent = adminCount > 0 ? adminCount : '';
            adminBadge.style.display = adminCount > 0 ? 'inline' : 'none';
        }
    }

    /**
     * Get icon for notification type
     */
    getNotificationIcon(type) {
        const icons = {
            'mention': 'bi-at',
            'reply': 'bi-reply',
            'message': 'bi-envelope',
            'upvote': 'bi-arrow-up-circle',
            'award': 'bi-award'
        };
        return icons[type] || 'bi-bell';
    }

    /**
     * Get icon for report type
     */
    getReportIcon(type) {
        switch (type) {
            case 'post':
                return 'bi-file-text-fill';
            case 'comment':
                return 'bi-chat-fill';
            case 'message':
                return 'bi-envelope-fill';
            default:
                return 'bi-flag-fill';
        }
    }

    /**
     * Get CSS class for application status badge
     */
    getApplicationStatusClass(status) {
        switch (status) {
            case 'pending':
                return 'bg-warning';
            case 'approved':
                return 'bg-success';
            case 'denied':
                return 'bg-danger';
            case 'processed':
                return 'bg-secondary';
            default:
                return 'bg-secondary';
        }
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return timestamp.toLocaleDateString();
    }

    /**
     * Handle notification click
     */
    async handleNotificationClick(notificationId) {
        const notification = this.inbox.notifications.find(n => n.id === notificationId);
        if (notification) {
            // Mark as read
            if (!notification.read) {
                await this.markNotificationRead(notificationId);
            }
            // Navigate to the URL
            if (notification.url) {
                window.location.href = notification.url;
            }
        }
    }

    /**
     * Handle message click
     */
    handleMessageClick(messageId) {
        const message = this.inbox.messages.find(m => m.id === messageId);
        if (message) {
            // Mark as read
            if (!message.read) {
                this.markMessageRead(messageId);
            }
            // Navigate to the URL
            if (message.url) {
                window.location.href = message.url;
            }
        }
    }

    /**
     * Handle report click
     */
    handleReportClick(reportId) {
        this.viewReport(reportId);
    }

    /**
     * Handle application click
     */
    handleApplicationClick(applicationId) {
        const application = this.inbox.applications.find(a => a.id === applicationId);
        if (application) {
            this.viewApplication(applicationId);
        }
    }

    /**
     * Resolve a report
     */
    async resolveReport(reportId) {
        try {
            const report = this.inbox.reports.find(r => r.id === reportId);
            if (!report) return;

            const api = authManager.api;
            
            // Call appropriate resolve API based on report type
            if (report.type === 'post') {
                await api.resolvePostReport({ report_id: report.originalId, resolved: true });
            } else if (report.type === 'comment') {
                await api.resolveCommentReport({ report_id: report.originalId, resolved: true });
            } else if (report.type === 'message') {
                await api.resolvePrivateMessageReport({ report_id: report.originalId, resolved: true });
            }

            // Remove from local state
            this.inbox.reports = this.inbox.reports.filter(r => r.id !== reportId);
            this.renderReports();
            this.updateBadges();
            
            this.showSuccessToast('Report resolved successfully');
            
        } catch (error) {
            console.error('Error resolving report:', error);
            this.showError('Failed to resolve report');
        }
    }

    /**
     * View report details
     */
    viewReport(reportId) {
        const report = this.inbox.reports.find(r => r.id === reportId);
        if (!report) return;

        // Create modal to show report details
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'reportModal';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content bg-dark text-light">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title text-light">
                            <i class="bi ${this.getReportIcon(report.type)} me-2"></i>${report.title}
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-danger">Report Information</h6>
                                <p><strong>Type:</strong> <span class="badge bg-secondary">${report.type.charAt(0).toUpperCase() + report.type.slice(1)}</span></p>
                                <p><strong>Reported:</strong> ${this.formatTimestamp(report.timestamp)}</p>
                                <p><strong>Status:</strong> 
                                    <span class="badge ${report.resolved ? 'bg-success' : 'bg-danger'}">
                                        ${report.resolved ? 'Resolved' : 'Pending'}
                                    </span>
                                </p>
                                <p><strong>Reported by:</strong> ${this.getReporterInfo(report)}</p>
                                ${report.resolved && report.resolver ? `
                                    <p><strong>Resolved by:</strong> ${report.resolver.name}</p>
                                ` : ''}
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-danger">Reported User Information</h6>
                                ${this.getReportedUserInfo(report)}
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-danger">Content Actions</h6>
                                ${report.url && report.url !== '#' ? `
                                    <button type="button" class="btn btn-outline-info btn-sm mb-2" onclick="window.open('${report.url}', '_blank')">
                                        <i class="bi bi-box-arrow-up-right me-1"></i>View Original Content
                                    </button>
                                ` : ''}
                                ${!report.resolved ? `
                                    <div class="d-flex gap-2 flex-wrap align-items-center">
                                        <button type="button" class="btn btn-success btn-sm" onclick="inboxApp.resolveReportWithAction('${report.id}'); bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();">
                                            <i class="bi bi-check-circle me-1"></i>Resolve
                                        </button>
                                        <div class="dropdown">
                                            <button class="btn btn-outline-warning btn-sm dropdown-toggle" type="button" id="moderationActionsDropdown" data-bs-toggle="dropdown">
                                                <i class="bi bi-shield-exclamation me-1"></i>
                                                <span id="selectedAction">No Action</span>
                                            </button>
                                            <ul class="dropdown-menu dropdown-menu-dark">
                                                <li><a class="dropdown-item" href="#" onclick="inboxApp.selectModerationAction('no-action', 'No Action')">
                                                    <i class="bi bi-circle me-2"></i>No Action
                                                </a></li>
                                                <li><hr class="dropdown-divider"></li>
                                                <li><a class="dropdown-item text-warning" href="#" onclick="inboxApp.selectModerationAction('remove-content', 'Remove ${report.type === 'post' ? 'Post' : report.type === 'comment' ? 'Comment' : 'Message'}')">
                                                    <i class="bi bi-trash me-2"></i>Remove ${report.type === 'post' ? 'Post' : report.type === 'comment' ? 'Comment' : 'Message'}
                                                </a></li>
                                                <li><a class="dropdown-item text-danger" href="#" onclick="inboxApp.selectModerationAction('ban-user', 'Ban User from Instance')">
                                                    <i class="bi bi-person-x me-2"></i>Ban User from Instance
                                                </a></li>
                                                <li><a class="dropdown-item text-danger" href="#" onclick="inboxApp.selectModerationAction('purge-user', 'Purge User')">
                                                    <i class="bi bi-person-dash me-2"></i>Purge User
                                                </a></li>
                                            </ul>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="mt-3">
                            <h6 class="text-danger">Report Reason</h6>
                            <div class="p-3 bg-secondary rounded text-light">
                                ${report.content || 'No reason provided'}
                            </div>
                        </div>
                        ${report.rawData ? `
                            <div class="mt-3">
                                <h6 class="text-danger">Additional Details</h6>
                                <div class="p-3 bg-secondary rounded text-light">
                                    ${report.type === 'post' && report.rawData.post ? `
                                        <p><strong>Post Title:</strong> ${report.rawData.post.name}</p>
                                        <p><strong>Post Body:</strong> ${report.rawData.post.body ? report.rawData.post.body.substring(0, 200) + (report.rawData.post.body.length > 200 ? '...' : '') : 'No content'}</p>
                                    ` : report.type === 'comment' && report.rawData.comment ? `
                                        <p><strong>Comment:</strong> ${report.rawData.comment.content ? report.rawData.comment.content.substring(0, 200) + (report.rawData.comment.content.length > 200 ? '...' : '') : 'No content'}</p>
                                    ` : report.type === 'message' && report.rawData.private_message ? `
                                        <p><strong>Message:</strong> ${report.rawData.private_message.content ? report.rawData.private_message.content.substring(0, 200) + (report.rawData.private_message.content.length > 200 ? '...' : '') : 'No content'}</p>
                                    ` : 'No additional details available'}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer border-secondary">
                        ${!report.resolved ? `
                            <div class="d-flex gap-2 align-items-center me-auto">
                                <button type="button" class="btn btn-success" onclick="inboxApp.resolveReportWithAction('${report.id}'); bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();">
                                    <i class="bi bi-check-circle me-1"></i>Resolve Report
                                </button>
                                <div class="dropdown">
                                    <button class="btn btn-outline-warning dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                        <i class="bi bi-shield-exclamation me-1"></i>
                                        <span id="selectedActionFooter">No Action</span>
                                    </button>
                                    <ul class="dropdown-menu dropdown-menu-dark">
                                        <li><a class="dropdown-item" href="#" onclick="inboxApp.selectModerationAction('no-action', 'No Action')">
                                            <i class="bi bi-circle me-2"></i>No Action
                                        </a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item text-warning" href="#" onclick="inboxApp.selectModerationAction('remove-content', 'Remove ${report.type === 'post' ? 'Post' : report.type === 'comment' ? 'Comment' : 'Message'}')">
                                            <i class="bi bi-trash me-2"></i>Remove ${report.type === 'post' ? 'Post' : report.type === 'comment' ? 'Comment' : 'Message'}
                                        </a></li>
                                        <li><a class="dropdown-item text-danger" href="#" onclick="inboxApp.selectModerationAction('ban-user', 'Ban User from Instance')">
                                            <i class="bi bi-person-x me-2"></i>Ban User from Instance
                                        </a></li>
                                        <li><a class="dropdown-item text-danger" href="#" onclick="inboxApp.selectModerationAction('purge-user', 'Purge User')">
                                            <i class="bi bi-person-dash me-2"></i>Purge User
                                        </a></li>
                                    </ul>
                                </div>
                            </div>
                        ` : ''}
                        <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();

        // Clean up when modal is hidden
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    /**
     * Store selected moderation action
     */
    selectedModerationAction = 'no-action';

    /**
     * Select moderation action from dropdown
     */
    selectModerationAction(action, displayText) {
        this.selectedModerationAction = action;
        
        // Update both dropdown button texts (main content and footer)
        const selectedActionElements = document.querySelectorAll('#selectedAction, #selectedActionFooter');
        selectedActionElements.forEach(element => {
            if (element) {
                element.textContent = displayText;
            }
        });
    }

    /**
     * Resolve report with selected moderation action
     */
    async resolveReportWithAction(reportId) {
        try {
            const report = this.inbox.reports.find(r => r.id === reportId);
            if (!report) return;

            // If ban user is selected, show ban duration popup first
            if (this.selectedModerationAction === 'ban-user') {
                this.showBanDurationPopup(reportId, report);
                return;
            }

            const api = authManager.api;
            
            // First, perform the moderation action based on selection
            switch (this.selectedModerationAction) {
                case 'remove-content':
                    await this.performRemoveContent(report);
                    break;
                case 'purge-user':
                    await this.performPurgeUser(report);
                    break;
                case 'no-action':
                default:
                    // No additional action needed
                    break;
            }
            
            // Then resolve the report
            if (report.type === 'post') {
                await api.resolvePostReport({ report_id: report.originalId, resolved: true });
            } else if (report.type === 'comment') {
                await api.resolveCommentReport({ report_id: report.originalId, resolved: true });
            } else if (report.type === 'message') {
                await api.resolvePrivateMessageReport({ report_id: report.originalId, resolved: true });
            }

            // Remove from local state
            this.inbox.reports = this.inbox.reports.filter(r => r.id !== reportId);
            this.renderReports();
            this.updateBadges();
            
            // Reset selected action
            this.selectedModerationAction = 'no-action';
            
            const actionText = this.selectedModerationAction === 'no-action' ? 'resolved' : `resolved with ${this.getActionDisplayText()}`;
            this.showSuccessToast(`Report ${actionText} successfully`);
            
        } catch (error) {
            console.error('Error resolving report with action:', error);
            this.showError('Failed to resolve report');
        }
    }

    /**
     * Get display text for the selected action
     */
    getActionDisplayText() {
        switch (this.selectedModerationAction) {
            case 'remove-content':
                return 'content removal';
            case 'ban-user':
                return 'instance user ban';
            case 'purge-user':
                return 'user purge';
            default:
                return 'no action';
        }
    }

    /**
     * Get reporter information for display
     */
    getReporterInfo(report) {
        if (!report.rawData) {
            return '<span class="text-muted">Unknown</span>';
        }

        // The reporter is always report.rawData.creator
        const reporter = report.rawData.creator;
        if (reporter) {
            return `${reporter.display_name || reporter.name} <span class="badge bg-info">Reporter</span>`;
        }

        return '<span class="text-muted">Unknown</span>';
    }

    /**
     * Get reported user information for display
     */
    getReportedUserInfo(report) {
        if (!report.rawData) {
            return '<p class="text-muted">No user information available</p>';
        }

        let userInfo = '';
        
        if (report.type === 'post' && report.rawData.post) {
            // For post reports, the post_creator is the reported user (not post.creator)
            const postCreator = report.rawData.post_creator;
            if (postCreator) {
                userInfo = `
                    <p><strong>Username:</strong> ${postCreator.display_name || postCreator.name}</p>
                    <p><strong>User ID:</strong> ${postCreator.id}</p>
                    ${postCreator.local ? '<span class="badge bg-primary">Local User</span>' : '<span class="badge bg-secondary">Remote User</span>'}
                `;
            }
        } else if (report.type === 'comment' && report.rawData.comment) {
            // For comment reports, the comment_creator is the reported user (not comment.creator)
            const commentCreator = report.rawData.comment_creator;
            if (commentCreator) {
                userInfo = `
                    <p><strong>Username:</strong> ${commentCreator.display_name || commentCreator.name}</p>
                    <p><strong>User ID:</strong> ${commentCreator.id}</p>
                    ${commentCreator.local ? '<span class="badge bg-primary">Local User</span>' : '<span class="badge bg-secondary">Remote User</span>'}
                `;
            }
        } else if (report.type === 'message' && report.rawData.private_message) {
            // For message reports, the private_message_creator is the reported user
            const messageCreator = report.rawData.private_message_creator;
            if (messageCreator) {
                userInfo = `
                    <p><strong>Username:</strong> ${messageCreator.display_name || messageCreator.name}</p>
                    <p><strong>User ID:</strong> ${messageCreator.id}</p>
                    ${messageCreator.local ? '<span class="badge bg-primary">Local User</span>' : '<span class="badge bg-secondary">Remote User</span>'}
                `;
            }
        }

        if (!userInfo) {
            userInfo = '<p class="text-muted">No user information available</p>';
        }

        return userInfo;
    }

    /**
     * Perform content removal action
     */
    async performRemoveContent(report) {
        try {
            const api = authManager.api;
            
            if (report.type === 'post' && report.rawData?.post) {
                // Remove post
                await api.removePost({
                    post_id: report.rawData.post.id,
                    removed: true,
                    reason: 'Content removed due to report'
                });
            } else if (report.type === 'comment' && report.rawData?.comment) {
                // Remove comment
                await api.removeComment({
                    comment_id: report.rawData.comment.id,
                    removed: true,
                    reason: 'Content removed due to report'
                });
            }
            // Note: Private messages typically can't be "removed" in the same way
            
        } catch (error) {
            console.error('Error removing content:', error);
            throw error;
        }
    }

    /**
     * Show ban duration popup
     */
    showBanDurationPopup(reportId, report) {
        // Get the reported user information
        const reportedUser = this.getReportedUserForBan(report);
        if (!reportedUser) {
            this.showError('Could not identify user to ban');
            return;
        }

        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="banDurationModal" tabindex="-1" aria-labelledby="banDurationModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content bg-dark text-light">
                        <div class="modal-header border-secondary">
                            <h5 class="modal-title text-light" id="banDurationModalLabel">
                                <i class="bi bi-person-x me-2"></i>Ban User from Instance
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning">
                                <i class="bi bi-exclamation-triangle me-2"></i>
                                <strong>Warning:</strong> You are about to ban the following user from the entire instance due to reported content:
                            </div>
                            
                            <div class="p-3 bg-secondary rounded mb-3">
                                <p class="mb-1"><strong>Username:</strong> ${reportedUser.displayName || reportedUser.name}</p>
                                <p class="mb-1"><strong>User ID:</strong> ${reportedUser.id}</p>
                                <p class="mb-0"><strong>Type:</strong> ${reportedUser.local ? 'Local User' : 'Remote User'}</p>
                            </div>
                            
                            <form id="banDurationForm">
                                <div class="mb-3">
                                    <label for="banDuration" class="form-label">Ban Duration (days)</label>
                                    <input type="number" class="form-control bg-dark text-light border-secondary" 
                                           id="banDuration" min="1" max="3650" value="30" 
                                           placeholder="Enter number of days (1-3650)">
                                                                    <div class="form-text text-muted">
                                    Enter 0 for permanent ban, or specify number of days (1-3650). This is an administrative action that affects the entire instance.
                                </div>
                                </div>
                                <div class="mb-3">
                                    <label for="banReason" class="form-label">Ban Reason</label>
                                    <textarea class="form-control bg-dark text-light border-secondary" 
                                              id="banReason" rows="3" 
                                              placeholder="Reason for the ban...">Administratively banned due to reported content</textarea>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer border-secondary">
                            <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" id="confirmBanBtn">
                                <i class="bi bi-person-x me-1"></i>Confirm Ban
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('banDurationModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Get modal elements
        const modal = document.getElementById('banDurationModal');
        const confirmBtn = document.getElementById('confirmBanBtn');
        const durationInput = document.getElementById('banDuration');
        const reasonInput = document.getElementById('banReason');

        // Add event listeners
        confirmBtn.addEventListener('click', () => {
            const duration = parseInt(durationInput.value) || 0;
            const reason = reasonInput.value.trim() || 'Administratively banned due to reported content';
            
            if (duration < 0 || duration > 3650) {
                this.showError('Please enter a valid ban duration (0-3650 days)');
                return;
            }
            
            // Close the modal
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            bootstrapModal.hide();
            
            // Perform the ban with the specified duration
            this.performBanUserWithDuration(reportId, report, duration, reason);
        });
        
        // Show modal
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();

        // Focus on duration field
        setTimeout(() => durationInput.focus(), 500);
    }

    /**
     * Get reported user information for ban action
     */
    getReportedUserForBan(report) {
        if (!report.rawData) return null;
        
        let creator = null;
        
        if (report.type === 'post' && report.rawData.post) {
            // For post reports, the post_creator is the reported user (not post.creator)
            creator = report.rawData.post_creator;
        } else if (report.type === 'comment' && report.rawData.comment) {
            // For comment reports, the comment_creator is the reported user (not comment.creator)
            creator = report.rawData.comment_creator;
        } else if (report.type === 'message' && report.rawData.private_message) {
            // For message reports, the private_message_creator is the reported user
            creator = report.rawData.private_message_creator;
        }
        
        if (creator) {
            return {
                id: creator.id,
                name: creator.name,
                displayName: creator.display_name,
                local: creator.local
            };
        }
        
        return null;
    }

    /**
     * Perform ban user action with specified duration
     */
    async performBanUserWithDuration(reportId, report, durationDays, reason) {
        try {
            const api = authManager.api;
            
            // Get the user who created the reported content
            const reportedUser = this.getReportedUserForBan(report);
            if (!reportedUser) {
                throw new Error('Could not identify user to ban');
            }
            
            // Calculate expiration date if not permanent
            let expires = null;
            if (durationDays > 0) {
                expires = new Date();
                expires.setDate(expires.getDate() + durationDays);
                expires = expires.toISOString();
            }
            
            // Ban the user from the instance (administrative action)
            await api.banPerson({
                person_id: reportedUser.id,
                ban: true,
                reason: reason,
                expires: expires
            });
            
            // Now resolve the report
            if (report.type === 'post') {
                await api.resolvePostReport({ report_id: report.originalId, resolved: true });
            } else if (report.type === 'comment') {
                await api.resolveCommentReport({ report_id: report.originalId, resolved: true });
            } else if (report.type === 'message') {
                await api.resolvePrivateMessageReport({ report_id: report.originalId, resolved: true });
            }

            // Remove from local state
            this.inbox.reports = this.inbox.reports.filter(r => r.id !== reportId);
            this.renderReports();
            this.updateBadges();
            
            // Reset selected action
            this.selectedModerationAction = 'no-action';
            
            const durationText = durationDays === 0 ? 'permanently' : `for ${durationDays} days`;
            this.showSuccessToast(`User banned from instance ${durationText} and report resolved successfully`);
            
        } catch (error) {
            console.error('Error banning user with duration:', error);
            this.showError('Failed to ban user: ' + error.message);
        }
    }

    /**
     * Perform ban user action (legacy method - now handled by performBanUserWithDuration)
     */
    async performBanUser(report) {
        try {
            const api = authManager.api;
            
            // Get the user who created the reported content
            let userId = null;
            if (report.rawData?.creator) {
                userId = report.rawData.creator.id;
            }
            
            if (userId) {
                await api.banPerson({
                    person_id: userId,
                    ban: true,
                    reason: 'Administratively banned due to reported content',
                    expires: null // Permanent ban
                });
            }
            
        } catch (error) {
            console.error('Error banning user:', error);
            throw error;
        }
    }

    /**
     * Perform purge user action  
     */
    async performPurgeUser(report) {
        try {
            const api = authManager.api;
            
            // Get the user who created the reported content
            let userId = null;
            if (report.rawData?.creator) {
                userId = report.rawData.creator.id;
            }
            
            if (userId) {
                await api.purgePerson({
                    person_id: userId,
                    reason: 'User purged due to reported content'
                });
            }
            
        } catch (error) {
            console.error('Error purging user:', error);
            throw error;
        }
    }

    /**
     * Approve a registration application
     */
    async approveApplication(applicationId) {
        try {
            const application = this.inbox.applications.find(a => a.id === applicationId);
            if (!application) return;

            const api = authManager.api;
            await api.approveRegistrationApplication({
                id: applicationId,
                approve: true
            });

            // Update local state
            application.status = 'approved';
            this.renderApplications();
            this.updateBadges();
            
            this.showSuccessToast('Application approved successfully');
            
        } catch (error) {
            console.error('Error approving application:', error);
            this.showError('Failed to approve application');
        }
    }

    /**
     * Deny a registration application
     */
    async denyApplication(applicationId) {
        try {
            const application = this.inbox.applications.find(a => a.id === applicationId);
            if (!application) return;

            const api = authManager.api;
            await api.approveRegistrationApplication({
                id: applicationId,
                approve: false,
                deny_reason: 'Application denied by administrator'
            });

            // Update local state
            application.status = 'denied';
            this.renderApplications();
            this.updateBadges();
            
            this.showSuccessToast('Application denied');
            
        } catch (error) {
            console.error('Error denying application:', error);
            this.showError('Failed to deny application');
        }
    }

    /**
     * View application details
     */
    viewApplication(applicationId) {
        const application = this.inbox.applications.find(a => a.id === applicationId);
        if (!application) return;

        // Create modal to show application details
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'applicationModal';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content bg-dark text-light">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title text-light">
                            <i class="bi bi-person-plus me-2"></i>Registration Application
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-info">Applicant Information</h6>
                                <p><strong>Username:</strong> ${application.username}</p>
                                <p><strong>Email:</strong> ${application.email}</p>
                                <p><strong>Applied:</strong> ${this.formatTimestamp(application.timestamp)}</p>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-info">Application Status</h6>
                                <p><span class="badge ${this.getApplicationStatusClass(application.status)}">${application.status.charAt(0).toUpperCase() + application.status.slice(1)}</span></p>
                                ${application.status !== 'pending' && application.admin ? `
                                    <div class="mt-3 p-2 bg-secondary rounded">
                                        <p class="mb-1"><strong>${application.status === 'approved' ? 'Approved' : 'Denied'} by:</strong> ${application.admin.name}</p>
                                        ${application.rawData.registration_application.deny_reason ? `
                                            <p class="mb-0"><strong>Reason:</strong> ${application.rawData.registration_application.deny_reason}</p>
                                        ` : application.status === 'approved' ? `
                                            <p class="mb-0 text-success"><em>Application approved</em></p>
                                        ` : ''}
                                    </div>
                                ` : application.status === 'pending' ? `
                                    <p class="mt-2 text-warning"><em>Awaiting admin review</em></p>
                                ` : ''}
                            </div>
                        </div>
                        <div class="mt-3">
                            <h6 class="text-info">Application Answer</h6>
                            <div class="p-3 bg-secondary rounded text-light">
                                ${application.content || 'No answer provided'}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer border-secondary">
                        ${application.status === 'pending' ? `
                            <button type="button" class="btn btn-success" onclick="inboxApp.approveApplication(${applicationId}); bootstrap.Modal.getInstance(document.getElementById('applicationModal')).hide();">
                                <i class="bi bi-check-circle me-1"></i>Approve
                            </button>
                            <button type="button" class="btn btn-danger" onclick="inboxApp.denyApplication(${applicationId}); bootstrap.Modal.getInstance(document.getElementById('applicationModal')).hide();">
                                <i class="bi bi-x-circle me-1"></i>Deny
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();

        // Clean up when modal is hidden
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }

    /**
     * Mark notification as read
     */
    async markNotificationRead(notificationId) {
        try {
            const notification = this.inbox.notifications.find(n => n.id === notificationId);
            if (!notification || notification.read) return;

            const api = authManager.api;
            
            // For now, since we're getting 404s with the specific endpoints, 
            // let's just update the local state without calling the API
            // TODO: Implement proper API calls when the correct endpoints are identified
            
            console.log('Marking notification as read locally:', notification.type, notificationId);
            
            // Update local state only for now
            notification.read = true;
            this.renderNotifications();
            this.updateBadges();
            
            // Update navbar badge counts
            const unreadCount = this.inbox.notifications.filter(n => !n.read).length;
            const reportsCount = this.inbox.reports.length;
            const applicationsCount = this.inbox.applications.filter(a => a.status === 'pending').length;
            this.updateNavbarBadges(unreadCount, reportsCount + applicationsCount);
            
        } catch (error) {
            console.error('Error marking notification as read:', error);
            this.showError('Failed to mark notification as read');
        }
    }

    /**
     * Mark message as read
     */
    async markMessageRead(messageId) {
        try {
            const message = this.inbox.messages.find(m => m.id === messageId);
            if (!message || message.read) return;
            
            const api = authManager.api;
            
            // Mark message as read via API
            await api.markPrivateMessageAsRead(messageId);
            
            // Update local state
            message.read = true;
            this.renderMessages();
            this.updateBadges();
            
        } catch (error) {
            console.error('Error marking message as read:', error);
            this.showError('Failed to mark message as read');
        }
    }



    /**
     * Delete notification
     */
    deleteNotification(notificationId) {
        this.inbox.notifications = this.inbox.notifications.filter(n => n.id !== notificationId);
        this.renderNotifications();
        this.updateBadges();
        // TODO: Send API request to delete
    }

    /**
     * Delete message
     */
    deleteMessage(messageId) {
        this.inbox.messages = this.inbox.messages.filter(m => m.id !== messageId);
        this.renderMessages();
        this.updateBadges();
        // TODO: Send API request to delete
    }

    /**
     * Report a message to administrators
     */
    async reportMessage(messageId) {
        // Check if user is authenticated
        if (!authManager.isAuthenticated()) {
            console.log('Please log in to report messages');
            return;
        }

        // Show the report message modal
        this.showReportMessageModal(messageId);
    }

    /**
     * Show the report message modal
     */
    showReportMessageModal(messageId) {
        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="reportMessageModal" tabindex="-1" aria-labelledby="reportMessageModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="reportMessageModalLabel">Report Message</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="reportMessageForm">
                                <div class="mb-3">
                                    <label for="messageReportReason" class="form-label">Reason for Report</label>
                                    <textarea class="form-control" id="messageReportReason" rows="3" placeholder="Please provide a reason for reporting this message..." required></textarea>
                                    <div class="form-text">Your report will be reviewed by administrators.</div>
                                </div>
                                <div id="messageReportValidationMessage" class="alert" style="display: none;"></div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-warning" id="submitMessageReportBtn">
                                <span class="spinner-border spinner-border-sm me-2" role="status" style="display: none;"></span>
                                Submit Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('reportMessageModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Get modal elements
        const modal = document.getElementById('reportMessageModal');
        const form = document.getElementById('reportMessageForm');
        const reasonField = document.getElementById('messageReportReason');
        const submitBtn = document.getElementById('submitMessageReportBtn');
        const validationMessage = document.getElementById('messageReportValidationMessage');

        // Add event listeners
        submitBtn.addEventListener('click', () => this.submitMessageReport(modal, reasonField, submitBtn, validationMessage, messageId));
        
        // Show modal
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();

        // Focus on reason field
        setTimeout(() => reasonField.focus(), 500);
    }

    /**
     * Submit the message report
     */
    async submitMessageReport(modal, reasonField, submitBtn, validationMessage, messageId) {
        const reason = reasonField.value.trim();
        
        if (!reason) {
            this.showReportValidationMessage(validationMessage, 'Please provide a reason for the report.', 'danger');
            return;
        }

        // Show loading state
        submitBtn.disabled = true;
        const spinner = submitBtn.querySelector('.spinner-border');
        spinner.style.display = 'inline-block';

        try {
            // Import API at runtime to avoid circular dependencies
            const { LemmyAPI } = await import('./api.js');
            const api = new LemmyAPI();

            // Create the report
            const reportData = {
                private_message_id: parseInt(messageId, 10),
                reason: reason
            };

            // Submit the report via API
            await api.createPrivateMessageReport(reportData);
            
            // Show success message in validation area instead of toast
            this.showReportValidationMessage(validationMessage, 'Message report submitted successfully!', 'success');
            
            // Hide modal after a short delay to show success message
            setTimeout(() => {
                const bootstrapModal = bootstrap.Modal.getInstance(modal);
                bootstrapModal.hide();
            }, 1500);
            
        } catch (error) {
            console.error('Error submitting message report:', error);
            this.showReportValidationMessage(validationMessage, 'Failed to submit report. Please try again.', 'danger');
        } finally {
            // Reset loading state
            submitBtn.disabled = false;
            spinner.style.display = 'none';
        }
    }

    /**
     * Show validation message in the report modal
     */
    showReportValidationMessage(element, message, type) {
        element.textContent = message;
        element.className = `alert alert-${type}`;
        element.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }

    /**
     * Show success toast notification
     */
    showSuccessToast(message) {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }

        // Create toast
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');

        toast.innerHTML = `
            <div class="toast-header bg-success text-white">
                <i class="bi bi-check-circle me-2"></i>
                <strong class="me-auto">Success</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;

        toastContainer.appendChild(toast);

        // Show the toast
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 5000
        });
        bsToast.show();

        // Remove the toast element after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }



    /**
     * Mark all items as read
     */
    async markAllRead() {
        try {
            const api = authManager.api;
            
            // Mark all replies and mentions as read via API
            await api.markAllRepliesAsRead();
            
            // Mark all unread private messages as read
            const unreadMessages = this.inbox.messages.filter(m => !m.read && m.type !== 'sent');
            for (const message of unreadMessages) {
                try {
                    await api.markPrivateMessageAsRead(message.id);
                } catch (error) {
                    console.error(`Failed to mark message ${message.id} as read:`, error);
                }
            }
            
            // Update local state
            this.inbox.notifications.forEach(n => n.read = true);
            this.inbox.messages.forEach(m => m.read = true);
            
            // Note: Reports and applications don't have a "read" state in the same way
            // They are either resolved/processed or not
            
            this.renderNotifications();
            this.renderMessages();
            if (this.isAdmin) {
                this.renderReports();
                this.renderApplications();
            }
            this.updateBadges();
            
        } catch (error) {
            console.error('Error marking all as read:', error);
            this.showError('Failed to mark all as read');
        }
    }

    /**
     * Show item error
     */
    showItemError(type) {
        const containers = {
            'notifications': this.elements.userNotificationsList,
            'messages': this.elements.messagesList,
            'reports': this.elements.reportsList,
            'applications': this.elements.applicationsList
        };
        
        const container = containers[type];
        if (container) {
            container.innerHTML = `
                <div class="text-center p-5 text-danger">
                    <i class="bi bi-exclamation-triangle display-1"></i>
                    <h5 class="mt-3">Error loading ${type}</h5>
                    <p>Failed to load ${type}. Please try refreshing the page.</p>
                    <button class="btn btn-outline-primary" onclick="location.reload()">Refresh</button>
                </div>
            `;
            container.style.display = 'block';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error(message);
        // TODO: Implement toast notification system
    }

    /**
     * Toggle notification expansion
     */
    toggleNotificationExpansion(notificationId) {
        const item = document.querySelector(`[data-notification-id="${notificationId}"]`);
        if (!item) return;

        const isExpanded = item.dataset.expanded === 'true';
        const fullContent = item.querySelector('.notification-full-content');
        const preview = item.querySelector('.notification-preview');
        const expandBtn = item.querySelector('.expand-btn');
        const expandIcon = item.querySelector('.expand-icon');
        const expandText = item.querySelector('.expand-text');

        if (isExpanded) {
            // Collapse
            fullContent.style.display = 'none';
            preview.style.display = 'block';
            if (expandIcon) expandIcon.className = 'bi bi-chevron-down expand-icon';
            if (expandText) expandText.textContent = 'Show Full';
            item.dataset.expanded = 'false';
        } else {
            // Expand
            fullContent.style.display = 'block';
            preview.style.display = 'none';
            if (expandIcon) expandIcon.className = 'bi bi-chevron-up expand-icon';
            if (expandText) expandText.textContent = 'Show Less';
            item.dataset.expanded = 'true';
        }
    }

    /**
     * Get full notification content from raw data
     */
    getFullNotificationContent(notification) {
        if (!notification.rawData) return notification.content;

        try {
            if (notification.type === 'reply') {
                const comment = notification.rawData.comment;
                const post = notification.rawData.post;
                const creator = notification.rawData.creator;
                
                return `<strong>Reply from ${creator.display_name || creator.name}:</strong><br><br>
                        "${comment.content}"<br><br>
                        <small class="text-muted">In post: "${post.name}"</small>`;
            } else if (notification.type === 'mention') {
                const comment = notification.rawData.comment;
                const post = notification.rawData.post;
                const creator = notification.rawData.creator;
                
                return `<strong>Mention from ${creator.display_name || creator.name}:</strong><br><br>
                        "${comment.content}"<br><br>
                        <small class="text-muted">In post: "${post.name}"</small>`;
            }
        } catch (error) {
            console.error('Error formatting notification content:', error);
        }

        return notification.content;
    }

    /**
     * Show full message content in a modal
     */
    showFullMessage(messageId) {
        const message = this.inbox.messages.find(m => m.id === messageId);
        if (!message) return;

        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="fullMessageModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi ${message.type === 'sent' ? 'bi-envelope-arrow-up' : 'bi-envelope'} me-2"></i>
                                ${message.type === 'sent' ? 'Sent to' : 'Message from'} ${message.from}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <small class="text-muted">${this.formatTimestamp(message.timestamp)}</small>
                                ${message.type === 'sent' ? '<span class="badge bg-secondary ms-2">Sent</span>' : ''}
                                ${!message.read ? '<span class="badge bg-warning ms-2">Unread</span>' : ''}
                            </div>
                            <div class="border rounded p-3 bg-light">
                                <p class="mb-0" style="white-space: pre-wrap;">${message.fullContent}</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            ${!message.read && message.type !== 'sent' ? 
                                '<button type="button" class="btn btn-warning" onclick="inboxApp.markMessageRead(' + message.id + '); bootstrap.Modal.getInstance(document.getElementById(\'fullMessageModal\')).hide();"><i class="bi bi-check me-1"></i>Mark as Read</button>' : 
                                ''
                            }
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('fullMessageModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('fullMessageModal'));
        modal.show();

        // Clean up when modal is hidden
        document.getElementById('fullMessageModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    /**
     * Navigate to post
     */
    goToPost(url) {
        if (url) {
            // Parse the URL to extract post ID and comment hash
            const match = url.match(/^\/post\/(\d+)(#comment-\d+)?$/);
            if (match) {
                const postId = match[1];
                const commentHash = match[2] || '';
                
                // Direct navigation to post with clean URL
                try {
                    const directUrl = `/post/${postId}${commentHash}`;
                    window.location.href = directUrl;
                    return;
                } catch (error) {
                    // Fallback to original URL
                    window.location.href = url;
                }
            } else {
                // Direct fallback for non-standard URLs
                window.location.href = url;
            }
        }
    }

    /**
     * Handle scroll event for reports infinite loading
     */
    handleReportsScroll(e) {
        const container = e.target;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        // Check if user has scrolled near the bottom (within 200px)
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            this.loadMoreReports();
        }
    }

    /**
     * Handle scroll event for applications infinite loading
     */
    handleApplicationsScroll(e) {
        const container = e.target;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        // Check if user has scrolled near the bottom (within 200px)
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            this.loadMoreApplications();
        }
    }

    /**
     * Load more reports (infinite scroll)
     */
    async loadMoreReports() {
        if (!this.pagination.reports.hasMore || this.pagination.reports.loading) {
            return;
        }

        await this.loadReports(true);
    }

    /**
     * Load more applications (infinite scroll)
     */
    async loadMoreApplications() {
        if (!this.pagination.applications.hasMore || this.pagination.applications.loading) {
            return;
        }

        await this.loadApplications(true);
    }
}

// Initialize the app
const inboxApp = new LemmericInboxApp();

// Make it globally available for inline onclick handlers
window.inboxApp = inboxApp; 