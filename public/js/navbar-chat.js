// ========== SWAPSHELF PROFESSIONAL CHAT MODAL SYSTEM ========== //
console.log('📂 navbar-chat.js loading...');

class SwapShelfChatInterface {
    constructor() {
        console.log('🏗️ SwapShelfChatInterface constructor called');
        this.socket = null;
        this.currentUser = null;
        this.currentChatUser = null;
        this.isOpen = false;
        this.currentRoomId = null;
        this.searchTimeout = null;
        this.contactSearchTimeout = null;
        this.handleSearchInput = null;
        this.handleContactSearchInput = null;
        this.init();
    }
    
    init() {
        console.log('🚀 Initializing chat interface...');
        
        // Test basic connectivity first
        this.testConnectivity();
        
        this.connectSocket();
        this.bindEvents();
        this.loadUserData();
        console.log('✅ Chat interface initialization complete');
    }
    
    async testConnectivity() {
        console.log('🧪 Testing basic connectivity...');
        try {
            const response = await fetch('/api/auth/me', {
                method: 'GET',
                credentials: 'include'
            });
            console.log('🧪 Connectivity test result:', response.status, response.statusText);
        } catch (error) {
            console.error('🧪 Connectivity test failed:', error);
        }
    }
    
    async loadUserData() {
        console.log('👤 Loading user data...');
        console.log('🔗 Making request to: /api/auth/me');
        
        try {
            const response = await fetch('/api/auth/me', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('📡 User data response status:', response.status);
            
            if (response.ok) {
                this.currentUser = await response.json();
                console.log('✅ Current user loaded:', this.currentUser);
            } else {
                console.error('❌ Failed to load user data');
                console.error('Response status:', response.status);
                const errorText = await response.text();
                console.error('Error response:', errorText);
            }
        } catch (error) {
            console.error('❌ Error loading user data:', error);
            console.error('Error details:', error.message);
        }
    }
    
    connectSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io({
                transports: ['websocket', 'polling'],
                upgrade: true,
                timeout: 20000,
                forceNew: false
            });
            
            this.socket.on('connect', () => {
                console.log('✅ Socket connected:', this.socket.id);
            });
            
            this.socket.on('disconnect', () => {
                console.log('❌ Socket disconnected');
            });
            
            this.socket.on('message', (messageData) => {
                this.handleIncomingMessage(messageData);
            });
            
            this.socket.on('error', (error) => {
                console.error('❌ Socket error:', error);
            });
        } else {
            console.warn('⚠️ Socket.io not available');
        }
    }
    
    bindEvents() {
        console.log('🔄 Binding chat events...');
        
        // Chat toggle
        const chatToggle = document.getElementById('chatToggle');
        console.log('📱 Chat toggle element:', chatToggle);
        
        if (chatToggle) {
            chatToggle.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('🎯 Chat button clicked!');
                this.toggleChat();
            });
            console.log('✅ Chat toggle event bound');
        } else {
            console.error('❌ Chat toggle element not found!');
        }
        
        // Close chat
        const chatCloseBtn = document.getElementById('chatCloseBtn');
        if (chatCloseBtn) {
            chatCloseBtn.addEventListener('click', () => {
                this.closeChat();
            });
        }
        
        // Modal overlay click
        const chatModalOverlay = document.querySelector('.chat-modal-overlay');
        if (chatModalOverlay) {
            chatModalOverlay.addEventListener('click', () => {
                this.closeChat();
            });
        }
        
        // Back to main panel
        const backToMain = document.getElementById('backToMain');
        if (backToMain) {
            backToMain.addEventListener('click', () => {
                console.log('🔙 Back button clicked');
                this.showMainPanels();
            });
        }
        
        // Message send button
        const sendBtn = document.getElementById('sendMessageBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }
        
        // Message input enter key
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
        
        // Contact search functionality
        const contactSearch = document.getElementById('contactSearch');
        if (contactSearch) {
            console.log('🔍 Setting up contact search event listener');
            let contactSearchTimeout;
            contactSearch.addEventListener('input', (e) => {
                console.log('🔍 Contact search input:', e.target.value);
                clearTimeout(contactSearchTimeout);
                contactSearchTimeout = setTimeout(() => {
                    const query = e.target.value.trim();
                    this.searchUsers(query);
                }, 300);
            });
            console.log('✅ Contact search event listener bound');
        } else {
            console.log('⚠️ Contact search element not found during initial binding');
        }
    }
    
    toggleChat() {
        console.log('🔄 Toggle chat called, current state:', this.isOpen);
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }
    
    openChat() {
        console.log('🔓 Opening chat modal...');
        const modal = document.querySelector('.chat-modal');
        console.log('📱 Modal element found:', modal);
        
        if (modal) {
            modal.classList.add('show');
            this.isOpen = true;
            console.log('✅ Chat modal opened');
            
            // Ensure proper panel visibility
            this.showMainPanels();
            
            // Load initial data
            this.loadConversations();
            
            // Setup search functionality with a small delay to ensure DOM is ready
            setTimeout(() => {
                this.setupSearchFunctionality();
                this.setupContactSearchFunctionality();
            }, 100);
        } else {
            console.error('❌ Chat modal element not found!');
        }
    }
    
    closeChat() {
        const modal = document.querySelector('.chat-modal');
        if (modal) {
            modal.classList.remove('show');
            this.isOpen = false;
            this.showMainPanels();
        }
    }
    
    showMainPanels() {
        console.log('🔄 Showing main panels...');
        
        // Clean up jump button
        const jumpBtn = document.querySelector('.jump-to-latest-btn');
        if (jumpBtn) {
            jumpBtn.remove();
        }
        
        // Hide chat view
        const chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.style.display = 'none';
        }
        
        // Show conversations panel
        const conversationsPanel = document.getElementById('conversationsPanel');
        if (conversationsPanel) {
            conversationsPanel.style.display = 'flex';
            conversationsPanel.classList.add('active');
        }
    }
    
    showChatView(user) {
        console.log('💬 Showing chat view for user:', user);
        
        // Hide conversations panel
        const conversationsPanel = document.getElementById('conversationsPanel');
        if (conversationsPanel) {
            conversationsPanel.style.display = 'none';
        }
        
        // Show chat view
        const chatView = document.getElementById('chatView');
        if (chatView) {
            chatView.style.display = 'flex';
        }
        
        this.currentChatUser = user;
        this.updateChatHeader(user);
        this.startConversationWithUser(user);
    }
    
    updateChatHeader(user) {
        const chatUsername = document.getElementById('currentChatName');
        const chatUserAvatar = document.getElementById('currentChatAvatar');
        
        if (chatUsername) {
            chatUsername.textContent = user.fullname || user.name || user.username;
        }
        
        if (chatUserAvatar) {
            chatUserAvatar.src = user.profileImage || '/images/default-avatar.png';
            chatUserAvatar.alt = user.fullname || user.name || user.username;
            chatUserAvatar.style.borderRadius = '50%';
            chatUserAvatar.style.objectFit = 'cover';
            chatUserAvatar.onerror = function() {
                this.src = '/images/default-avatar.png';
                this.style.background = 'linear-gradient(135deg, #3BB7FB, #F6B443)';
                this.style.borderRadius = '50%';
            };
        }
    }
    
    async loadContacts() {
        // Load exactly 5 default users to display by default
        console.log('📋 Loading default contacts...');
        
        try {
            const response = await fetch('/api/users/search?limit=5', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                let users = data.users || data;
                
                // Ensure we only show exactly 5 users
                if (users.length > 5) {
                    users = users.slice(0, 5);
                }
                
                console.log('✅ Default users loaded:', users.length);
                
                if (users.length > 0) {
                    this.displaySearchResults(users);
                } else {
                    this.showDefaultSearchMessage();
                }
            } else {
                console.error('❌ Failed to load default users:', response.status);
                this.showDefaultSearchMessage();
            }
        } catch (error) {
            console.error('❌ Error loading default users:', error);
            this.showDefaultSearchMessage();
        }
    }
    
    showDefaultSearchMessage() {
        const resultsContainer = document.getElementById('chatSearchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    Start typing to search for users to chat with...
                </div>
            `;
        }
    }
    
    searchConversations(query) {
        const conversations = document.querySelectorAll('.conversation-item');
        conversations.forEach(conv => {
            const name = conv.querySelector('.conversation-name').textContent.toLowerCase();
            if (name.includes(query.toLowerCase())) {
                conv.style.display = 'flex';
            } else {
                conv.style.display = 'none';
            }
        });
    }
    
    async searchUsers(query) {
        if (!query || query.trim() === '') {
            // Show default users when search is empty
            this.loadContacts();
            return;
        }
        
        if (query.length < 2) {
            const resultsContainer = document.getElementById('chatSearchResults');
            if (resultsContainer) {
                resultsContainer.innerHTML = '<div class="no-results">Type at least 2 characters to search</div>';
            }
            return;
        }
        
        try {
            const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Users search response:', data);
                // The API returns { users: [...] } so we need to extract the users array
                const users = data.users || data;
                this.displaySearchResults(users);
            } else {
                console.error('❌ Failed to search users:', response.status);
            }
        } catch (error) {
            console.error('❌ Error searching users:', error);
        }
    }
    
    displaySearchResults(users) {
        const resultsContainer = document.getElementById('chatSearchResults');
        console.log('🔍 Displaying search results in container:', resultsContainer);
        
        if (!resultsContainer) {
            console.error('❌ Search results container not found!');
            return;
        }
        
        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No users found</div>';
            return;
        }
        
        resultsContainer.innerHTML = users.map(user => `
            <div class="contact-item" data-user-id="${user._id}" style="cursor: pointer;">
                <div class="contact-avatar-container">
                    <img src="${user.profileImage || '/images/default-avatar.png'}" 
                         alt="${user.fullname || user.name || user.username}" 
                         class="contact-avatar"
                         onerror="this.src='/images/default-avatar.png'; this.style.background='linear-gradient(135deg, #3BB7FB, #F6B443)'; this.style.borderRadius='50%';"
                         onload="this.style.borderRadius='50%'; this.style.objectFit='cover';">
                    <div class="status-indicator ${user.isOnline ? '' : 'offline'}"></div>
                </div>
                <div class="contact-info">
                    <div class="contact-name">${user.fullname || user.name || user.username}</div>
                    <div class="contact-username">@${user.username}</div>
                </div>
                <div class="contact-action">
                    <button class="btn-chat-start">
                        <i class="bi bi-chat-dots"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add click handlers to contact items
        setTimeout(() => {
            document.querySelectorAll('.contact-item').forEach(item => {
                item.addEventListener('click', () => {
                    console.log('👤 Contact clicked:', item.dataset.userId);
                    const userId = item.dataset.userId;
                    const user = users.find(u => u._id === userId);
                    if (user) {
                        this.showChatView(user);
                    }
                });
            });
        }, 100);
    }
    
    async loadConversations(page = 1, searchQuery = '') {
        console.log('📝 Loading conversations...', { page, searchQuery });
        console.log('🔍 Search query received in loadConversations:', searchQuery);
        
        try {
            // Build URL with pagination and search parameters
            const params = new URLSearchParams({
                page: page,
                limit: 20, // Fixed number of conversations per page
                search: searchQuery
            });
            
            console.log('🌐 Making API request to:', `/api/chat/rooms?${params}`);
            
            const response = await fetch(`/api/chat/rooms?${params}`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Conversations loaded successfully:', data);
                
                // Handle both old format (array) and new format (object with pagination)
                if (Array.isArray(data)) {
                    // Old format - convert to new format for backward compatibility
                    const paginatedData = {
                        conversations: data,
                        currentPage: 1,
                        totalPages: 1,
                        totalCount: data.length,
                        hasMore: false
                    };
                    this.displayConversations(paginatedData);
                } else {
                    // New format with pagination data
                    this.displayConversations(data);
                }
            } else {
                console.error('❌ Failed to load conversations - Status:', response.status);
                const errorText = await response.text();
                console.error('Error details:', errorText);
                
                const resultsContainer = document.getElementById('conversationsList');
                if (resultsContainer) {
                    resultsContainer.innerHTML = '<div class="no-results">Unable to load conversations. Please try again.</div>';
                }
            }
        } catch (error) {
            console.error('❌ Error loading conversations:', error);
            const resultsContainer = document.getElementById('conversationsList');
            if (resultsContainer) {
                resultsContainer.innerHTML = '<div class="no-results">Error loading conversations. Please check your connection.</div>';
            }
        }
    }
    
    displayConversations(data) {
        const resultsContainer = document.getElementById('conversationsList');
        console.log('📋 Displaying conversations in container:', resultsContainer);
        console.log('📋 Conversation data structure:', data);
        
        if (!resultsContainer) {
            console.error('❌ Conversations container not found!');
            return;
        }
        
        // Extract conversations array and pagination info
        const conversations = data.conversations || data; // Handle both new and old format
        const currentPage = data.currentPage || 1;
        const totalPages = data.totalPages || 1;
        const totalCount = data.totalCount || conversations.length;
        
        console.log('📋 Conversations array length:', conversations ? conversations.length : 'undefined');
        console.log('📋 Pagination info:', { currentPage, totalPages, totalCount });
        console.log('📋 Current user for filtering:', this.currentUser);
        
        if (!conversations || conversations.length === 0) {
            console.log('📋 No conversations to display, showing empty message');
            resultsContainer.innerHTML = '<div class="no-results">No conversations yet. Start chatting with someone!</div>';
            this.hidePagination();
            return;
        }
        
        console.log('📋 Processing conversations for display...');
        
        const conversationHTML = conversations.map((room, index) => {
            console.log(`📋 Processing conversation ${index + 1}:`, room);
            
            // Handle different data structures
            let participant;
            let participantName;
            let participantAvatar;
            
            if (room.otherUser) {
                // New data structure with otherUser
                participant = room.otherUser;
                participantName = participant.name || participant.fullname || participant.username;
                participantAvatar = participant.profileImage || '/images/default-avatar.png';
                console.log(`📋 Using otherUser structure: ${participantName}`);
            } else if (room.participants) {
                // Original data structure with participants array
                participant = room.participants.find(p => p._id !== this.currentUser?._id);
                if (!participant) {
                    console.warn(`📋 Skipping conversation ${index + 1}: no valid participant found`);
                    return '';
                }
                participantName = participant.fullname || participant.name || participant.username;
                participantAvatar = participant.profileImage || '/images/default-avatar.png';
                console.log(`📋 Using participants array structure: ${participantName}`);
            } else {
                console.warn(`📋 Skipping conversation ${index + 1}: unknown data structure`, room);
                return '';
            }
            
            const lastMessage = room.lastMessage;
            const messagePreview = lastMessage ? 
                (lastMessage.sender === this.currentUser?._id ? 'You: ' : '') + 
                (lastMessage.content && lastMessage.content.length > 50 ? lastMessage.content.substring(0, 50) + '...' : lastMessage.content || 'New message')
                : 'No messages yet';
            const messageTime = lastMessage ? this.formatTime(lastMessage.createdAt || lastMessage.timestamp) : '';
            
            console.log(`📋 Generated HTML for conversation ${index + 1}: ${participantName}`);
            
            return `
                <div class="conversation-item" data-room-id="${room._id}" style="cursor: pointer;">
                    <div class="conversation-avatar-container">
                        <img src="${participantAvatar}" 
                             alt="${participantName}" 
                             class="conversation-avatar"
                             onerror="this.src='/images/default-avatar.png'; this.style.background='linear-gradient(135deg, #3BB7FB, #F6B443)'; this.style.borderRadius='50%';"
                             onload="this.style.borderRadius='50%'; this.style.objectFit='cover';">
                        <div class="status-indicator"></div>
                    </div>
                    <div class="conversation-info">
                        <div class="conversation-name">${participantName}</div>
                        <div class="conversation-preview">${messagePreview}</div>
                    </div>
                    <div class="conversation-meta">
                        <div class="conversation-time">${messageTime}</div>
                        ${room.unreadCount ? `<div class="unread-badge">${room.unreadCount}</div>` : ''}
                    </div>
                </div>
            `;
        }).filter(html => html.trim() !== ''); // Remove empty entries
        
        console.log('📋 Final conversation HTML array:', conversationHTML);
        console.log('📋 Setting innerHTML with', conversationHTML.length, 'conversations');
        
        resultsContainer.innerHTML = conversationHTML.join('');
        
        console.log('📋 Final resultsContainer innerHTML:', resultsContainer.innerHTML.substring(0, 200) + '...');
        
        // Setup pagination
        this.setupPagination(currentPage, totalPages, totalCount);
        
        // Add click handlers to conversation items
        setTimeout(() => {
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.addEventListener('click', () => {
                    console.log('💬 Conversation clicked:', item.dataset.roomId);
                    console.log('🔍 Available conversations:', conversations);
                    const roomId = item.dataset.roomId;
                    const conversation = conversations.find(c => c._id === roomId);
                    console.log('🎯 Found conversation:', conversation);
                    if (conversation) {
                        let participant;
                        if (conversation.otherUser) {
                            participant = conversation.otherUser;
                            console.log('👤 Using otherUser participant:', participant);
                        } else if (conversation.participants) {
                            participant = conversation.participants.find(p => p._id !== this.currentUser?._id);
                            console.log('👥 Using participants array, found:', participant);
                        }
                        
                        if (participant) {
                            // Ensure participant has the _id field for consistency
                            if (!participant._id && participant.id) {
                                participant._id = participant.id;
                            }
                            console.log('✅ Starting chat with participant:', participant);
                            this.showChatView(participant);
                            this.loadMessages(roomId);
                        } else {
                            console.error('❌ No valid participant found for conversation');
                        }
                    } else {
                        console.error('❌ Conversation not found in loaded conversations');
                    }
                });
            });
        }, 100);
    }
    
    async startConversationWithUser(user) {
        try {
            const response = await fetch('/api/chat/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ otherUserId: user._id })
            });
            
            if (response.ok) {
                const roomData = await response.json();
                this.currentRoomId = roomData._id;
                console.log('✅ Chat room ready:', this.currentRoomId);
                this.loadMessages(this.currentRoomId);
                
                if (this.socket) {
                    this.socket.emit('joinRoom', this.currentRoomId);
                }
            }
        } catch (error) {
            console.error('❌ Error starting conversation:', error);
        }
    }
    
    async loadMessages(roomId, page = 1, append = false) {
        console.log(`🔄 Loading messages for room: ${roomId}, page: ${page}`);
        
        if (!append) {
            // Show loading indicator for initial load
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '<div class="loading-messages">Loading messages...</div>';
            }
        }
        
        try {
            // Fixed pagination: 20 messages per page for optimal performance
            const limit = 20;
            const response = await fetch(`/api/chat/rooms/${roomId}/messages?page=${page}&limit=${limit}`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const messages = await response.json();
                console.log(`✅ Messages loaded: ${messages.length} messages for page ${page}`);
                
                // Store pagination info
                this.currentPage = page;
                this.messagesPerPage = limit;
                this.hasMoreMessages = messages.length === limit;
                
                if (append && page > 1) {
                    // Append older messages to the top
                    this.prependMessages(messages);
                } else {
                    // Display messages normally and add pagination controls
                    this.displayMessages(messages);
                    this.addPaginationControls();
                    
                    // Always scroll to bottom to show latest messages when loading page 1
                    if (page === 1) {
                        setTimeout(() => {
                            this.scrollToBottom(false); // Force scroll to latest message
                        }, 100);
                    }
                }
                
            } else {
                console.error('❌ Failed to load messages:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Error details:', errorText);
                this.showWelcomeMessage();
            }
        } catch (error) {
            console.error('❌ Error loading messages:', error);
            this.showWelcomeMessage();
        }
    }
    
    addPaginationControls() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        // Remove existing pagination controls
        const existingControls = messagesContainer.querySelector('.pagination-controls');
        if (existingControls) existingControls.remove();
        
        // Only show pagination if there are multiple pages
        if (this.currentPage > 1 || this.hasMoreMessages) {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'pagination-controls';
            paginationDiv.innerHTML = `
                <div class="pagination-info">
                    <span>Page ${this.currentPage} • ${this.messagesPerPage} messages per page</span>
                </div>
                <div class="pagination-buttons">
                    ${this.hasMoreMessages ? `
                        <button class="pagination-btn prev-btn" onclick="window.swapShelfChat.loadPreviousPage()">
                            <i class="bi bi-arrow-left"></i> Older Messages
                        </button>
                    ` : ''}
                    ${this.currentPage > 1 ? `
                        <button class="pagination-btn next-btn" onclick="window.swapShelfChat.loadNextPage()">
                            Newer Messages <i class="bi bi-arrow-right"></i>
                        </button>
                    ` : ''}
                </div>
            `;
            
            // Add pagination controls at the top
            messagesContainer.insertBefore(paginationDiv, messagesContainer.firstChild);
        }
    }
    
    async loadPreviousPage() {
        if (this.hasMoreMessages && this.currentRoomId) {
            const nextPage = this.currentPage + 1;
            await this.loadMessages(this.currentRoomId, nextPage);
        }
    }
    
    async loadNextPage() {
        if (this.currentPage > 1 && this.currentRoomId) {
            const prevPage = this.currentPage - 1;
            await this.loadMessages(this.currentRoomId, prevPage);
        }
    }
    
    prependMessages(messages) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        // Store current scroll position
        const oldScrollHeight = messagesContainer.scrollHeight;
        
        // Group new messages
        const groupedMessages = this.groupMessagesByDate(messages);
        let messagesHTML = '';
        
        Object.keys(groupedMessages).forEach(date => {
            messagesHTML += `<div class="date-separator">${date}</div>`;
            
            groupedMessages[date].forEach(message => {
                const senderId = message.sender?._id || message.sender;
                const isOwn = senderId === this.currentUser?._id;
                const senderInfo = message.sender || {};
                const senderName = senderInfo.fullname || senderInfo.name || senderInfo.username || 'Unknown';
                const senderAvatar = senderInfo.profileImage || '/images/default-avatar.png';
                const timestamp = message.createdAt || message.timestamp;
                
                messagesHTML += `
                    <div class="message ${isOwn ? 'sent' : 'received'}">
                        ${!isOwn ? `
                            <div class="message-avatar">
                                <img src="${senderAvatar}" 
                                     alt="${senderName}"
                                     class="avatar-img"
                                     onerror="this.src='/images/default-avatar.png';">
                            </div>
                        ` : '<div class="message-avatar-spacer"></div>'}
                        <div class="message-content">
                            <div class="message-text">${this.escapeHtml(message.content)}</div>
                            <div class="message-time">${this.formatTime(timestamp)}</div>
                        </div>
                    </div>
                `;
            });
        });
        
        // Create temporary container for new messages
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = messagesHTML;
        
        // Remove load more button
        const loadMoreBtn = messagesContainer.querySelector('.load-more-btn');
        if (loadMoreBtn) loadMoreBtn.remove();
        
        // Prepend new messages
        while (tempDiv.firstChild) {
            messagesContainer.insertBefore(tempDiv.firstChild, messagesContainer.firstChild);
        }
        
        // Maintain scroll position
        const newScrollHeight = messagesContainer.scrollHeight;
        messagesContainer.scrollTop = newScrollHeight - oldScrollHeight;
        
        // Update pagination controls after loading older messages
        this.addPaginationControls();
    }
    
    showWelcomeMessage() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer && this.currentChatUser) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-avatar">
                        <img src="${this.currentChatUser.profileImage || '/images/default-avatar.png'}" 
                             alt="${this.currentChatUser.fullname || this.currentChatUser.name || this.currentChatUser.username}"
                             style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
                    </div>
                    <h3>Chat with ${this.currentChatUser.fullname || this.currentChatUser.name || this.currentChatUser.username}</h3>
                    <p>This is the beginning of your conversation. Say hello! 👋</p>
                </div>
            `;
        }
    }
    
    displayMessages(messages) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            console.error('❌ Messages container not found');
            return;
        }
        
        if (messages.length === 0) {
            this.showWelcomeMessage();
            return;
        }
        
        // Show loading indicator for large message sets
        if (messages.length > 50) {
            messagesContainer.innerHTML = '<div class="loading-messages">Loading messages...</div>';
        }
        
        // Use requestAnimationFrame for smooth rendering of large message sets
        requestAnimationFrame(() => {
            const groupedMessages = this.groupMessagesByDate(messages);
            let messagesHTML = '';
            
            Object.keys(groupedMessages).forEach(date => {
                messagesHTML += `<div class="date-separator">${date}</div>`;
                
                groupedMessages[date].forEach((message, index) => {
                    // Handle different message data structures
                    const senderId = message.sender?._id || message.sender;
                    const isOwn = senderId === this.currentUser?._id;
                    const senderInfo = message.sender || {};
                    const senderName = senderInfo.fullname || senderInfo.name || senderInfo.username || 'Unknown';
                    const senderAvatar = senderInfo.profileImage || '/images/default-avatar.png';
                    const timestamp = message.createdAt || message.timestamp;
                    
                    // Check if this message is consecutive from same sender
                    const prevMessage = groupedMessages[date][index - 1];
                    const nextMessage = groupedMessages[date][index + 1];
                    const prevSender = prevMessage?.sender?._id || prevMessage?.sender;
                    const nextSender = nextMessage?.sender?._id || nextMessage?.sender;
                    
                    // Enhanced grouping logic for better sender visibility
                    const isFirstInGroup = prevSender !== senderId;
                    const isLastInGroup = nextSender !== senderId;
                    
                    // Show sender name more frequently - every 5 messages or if more than 10 minutes apart
                    let showSenderName = !isOwn && isFirstInGroup;
                    if (!isOwn && !showSenderName && prevMessage) {
                        const messageTime = new Date(timestamp);
                        const prevTime = new Date(prevMessage.createdAt || prevMessage.timestamp);
                        const timeDiff = messageTime - prevTime;
                        const minutesDiff = timeDiff / (1000 * 60);
                        
                        // Show sender name if more than 10 minutes apart or every 5th consecutive message
                        if (minutesDiff > 10) {
                            showSenderName = true;
                        } else {
                            // Count consecutive messages from same sender
                            let consecutiveCount = 1;
                            for (let i = index - 1; i >= 0; i--) {
                                const checkMessage = groupedMessages[date][i];
                                const checkSender = checkMessage?.sender?._id || checkMessage?.sender;
                                if (checkSender === senderId) {
                                    consecutiveCount++;
                                } else {
                                    break;
                                }
                            }
                            if (consecutiveCount % 5 === 1 && consecutiveCount > 1) {
                                showSenderName = true;
                            }
                        }
                    }
                    
                    const showAvatar = !isOwn && (isLastInGroup || showSenderName);
                    const showTimestamp = isLastInGroup || index === groupedMessages[date].length - 1;
                    
                    messagesHTML += `
                        <div class="message ${isOwn ? 'sent' : 'received'} ${isFirstInGroup ? 'first-in-group' : ''} ${isLastInGroup ? 'last-in-group' : ''} ${showSenderName ? 'show-sender' : ''}">
                            ${showAvatar ? `
                                <div class="message-avatar">
                                    <img src="${senderAvatar}" 
                                         alt="${senderName}"
                                         class="avatar-img"
                                         onerror="this.src='/images/default-avatar.png';">
                                </div>
                            ` : '<div class="message-avatar-spacer"></div>'}
                            <div class="message-content">
                                ${showSenderName ? `<div class="message-sender">${senderName}</div>` : ''}
                                <div class="message-text">${this.escapeHtml(message.content)}</div>
                                ${showTimestamp ? `<div class="message-time">${this.formatTime(timestamp)}</div>` : ''}
                            </div>
                        </div>
                    `;
                });
            });
            
            messagesContainer.innerHTML = messagesHTML;
            
            // Add or update jump to latest button if there are many messages
            this.updateJumpButton(messages.length > 15);
            
            // Smooth scroll to bottom with animation
            this.scrollToBottom(true);
            
            // Add intersection observer for auto-scroll detection
            this.setupAutoScroll();
        });
    }
    
    groupMessagesByDate(messages) {
        const groups = {};
        
        messages.forEach(message => {
            const timestamp = message.createdAt || message.timestamp;
            const date = new Date(timestamp);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            let dateKey;
            if (date.toDateString() === today.toDateString()) {
                dateKey = 'Today';
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateKey = 'Yesterday';
            } else {
                dateKey = date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
            
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(message);
        });
        
        return groups;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    scrollToBottom(smooth = false) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            console.warn('📜 Messages container not found for scrolling');
            return;
        }
        
        console.log('📜 SIMPLE SCROLL - Starting');
        
        // Wait for any pending DOM updates
        setTimeout(() => {
            // Simple, reliable scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            console.log('📜 Scrolled:', {
                scrollTop: messagesContainer.scrollTop,
                scrollHeight: messagesContainer.scrollHeight,
                clientHeight: messagesContainer.clientHeight,
                isAtBottom: (messagesContainer.scrollTop + messagesContainer.clientHeight) >= messagesContainer.scrollHeight - 5
            });
        }, 10);
    }
    
    jumpToLatest() {
        console.log('🚀 SIMPLE JUMP - Jump to latest triggered');
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) {
            console.error('❌ Messages container not found for jump to latest');
            return;
        }
        
        // Simple, direct scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        console.log('🚀 SIMPLE JUMP - Result:', {
            scrollTop: messagesContainer.scrollTop,
            scrollHeight: messagesContainer.scrollHeight,
            success: messagesContainer.scrollTop > (messagesContainer.scrollHeight - messagesContainer.clientHeight - 10)
        });
        
        // Visual feedback
        const jumpBtn = document.querySelector('.jump-to-latest-btn');
        if (jumpBtn) {
            jumpBtn.style.opacity = '0.3';
            setTimeout(() => {
                if (jumpBtn) jumpBtn.style.opacity = '1';
            }, 200);
        }
    }

    updateJumpButton(shouldShow) {
        let jumpBtn = document.querySelector('.jump-to-latest-btn');
        
        if (shouldShow && !jumpBtn) {
            // Create jump button if it doesn't exist
            const chatView = document.querySelector('.chat-view');
            if (chatView) {
                const jumpButtonHTML = `
                    <div class="jump-to-latest-btn" style="opacity: 0; pointer-events: none;">
                        <button class="jump-btn" onclick="window.swapShelfChat.jumpToLatest()">
                            <i class="bi bi-arrow-down-circle"></i>
                            Jump to Latest
                        </button>
                    </div>
                `;
                chatView.insertAdjacentHTML('beforeend', jumpButtonHTML);
            }
        } else if (!shouldShow && jumpBtn) {
            // Remove jump button if not needed
            jumpBtn.remove();
        }
    }
    
    // Debug function to test scrolling
    testScroll() {
        const container = document.getElementById('chatMessages');
        if (!container) {
            console.log('No container found');
            return;
        }
        
        const messages = container.querySelectorAll('.message');
        const firstMessage = messages[0];
        const lastMessage = messages[messages.length - 1];
        
        console.log('🔍 VISIBILITY DEBUG:', {
            containerHeight: container.clientHeight,
            scrollHeight: container.scrollHeight,
            scrollTop: container.scrollTop,
            canScroll: container.scrollHeight > container.clientHeight,
            messagesCount: messages.length,
            firstMessageTop: firstMessage ? firstMessage.offsetTop : 'none',
            lastMessageBottom: lastMessage ? (lastMessage.offsetTop + lastMessage.offsetHeight) : 'none',
            containerPadding: {
                top: getComputedStyle(container).paddingTop,
                bottom: getComputedStyle(container).paddingBottom
            }
        });
        
        // Check if last message is visible
        if (lastMessage) {
            const rect = lastMessage.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            console.log('🎯 Last message visibility:', {
                messageBottom: rect.bottom,
                containerBottom: containerRect.bottom,
                isVisible: rect.bottom <= containerRect.bottom,
                hiddenPixels: Math.max(0, rect.bottom - containerRect.bottom)
            });
        }
        
        // Test scroll
        container.scrollTop = 9999;
        console.log('After scroll test - scrollTop:', container.scrollTop);
    }
    
    setupAutoScroll() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        // Remove existing scroll listener if any
        if (this.scrollListener) {
            messagesContainer.removeEventListener('scroll', this.scrollListener);
        }
        
        // Track if user is near bottom for auto-scroll
        this.isNearBottom = true;
        
        this.scrollListener = () => {
            const threshold = 100; // pixels from bottom
            const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            this.isNearBottom = distanceFromBottom <= threshold;
            
            // Show/hide jump to latest button based on scroll position
            const jumpBtn = document.querySelector('.jump-to-latest-btn');
            if (jumpBtn) {
                if (this.isNearBottom) {
                    jumpBtn.style.opacity = '0';
                    jumpBtn.style.pointerEvents = 'none';
                } else {
                    jumpBtn.style.opacity = '1';
                    jumpBtn.style.pointerEvents = 'auto';
                }
            }
            
            console.log('📜 Scroll position - distance from bottom:', distanceFromBottom, 'isNearBottom:', this.isNearBottom);
        };
        
        messagesContainer.addEventListener('scroll', this.scrollListener);
    }
    
    addNewMessage(messageData) {
        // Add a single new message without re-rendering everything
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const isOwn = (messageData.sender?._id || messageData.sender) === this.currentUser?._id;
        const senderInfo = messageData.sender || {};
        const senderName = senderInfo.fullname || senderInfo.name || senderInfo.username || 'Unknown';
        const senderAvatar = senderInfo.profileImage || '/images/default-avatar.png';
        const timestamp = messageData.createdAt || messageData.timestamp;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isOwn ? 'sent' : 'received'} new-message`;
        messageElement.innerHTML = `
            ${!isOwn ? `
                <div class="message-avatar">
                    <img src="${senderAvatar}" 
                         alt="${senderName}"
                         class="avatar-img"
                         onerror="this.src='/images/default-avatar.png';">
                </div>
            ` : '<div class="message-avatar-spacer"></div>'}
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(messageData.content)}</div>
                <div class="message-time">${this.formatTime(timestamp)}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        
        // Always scroll to bottom for new messages (especially own messages)
        if (isOwn || this.isNearBottom) {
            this.scrollToBottom(true);
        }
        
        // Add animation class
        setTimeout(() => {
            messageElement.classList.add('message-appeared');
        }, 100);
    }
    
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput || !this.currentRoomId) return;
        
        const content = messageInput.value.trim();
        if (!content) return;
        
        // Clear input immediately for better UX
        messageInput.value = '';
        
        // Add temporary message with "sending" indicator
        const tempMessage = {
            content: content,
            sender: this.currentUser,
            createdAt: new Date().toISOString(),
            temporary: true
        };
        
        try {
            const response = await fetch(`/api/chat/rooms/${this.currentRoomId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    content: content
                })
            });
            
            if (response.ok) {
                // Message sent successfully - it will appear via socket or reload
                // Remove temporary message if we added one
                const tempMessages = document.querySelectorAll('.message.temporary');
                tempMessages.forEach(msg => msg.remove());
                
                // Reload messages to get the actual sent message and scroll to bottom
                setTimeout(() => {
                    this.loadMessages(this.currentRoomId).then(() => {
                        // Ensure we scroll to the latest message after reload
                        setTimeout(() => {
                            this.scrollToBottom(false);
                        }, 100);
                    });
                }, 500);
            } else {
                console.error('❌ Failed to send message:', response.status);
                // Restore the message input if sending failed
                messageInput.value = content;
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            // Restore the message input if sending failed
            messageInput.value = content;
        }
    }
    
    handleIncomingMessage(messageData) {
        if (messageData.roomId === this.currentRoomId) {
            // Reload messages to show the new one
            this.loadMessages(this.currentRoomId);
        }
        
        // Update conversation list if needed
        this.loadConversations();
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
        }
    }

    setupPagination(currentPage, totalPages, totalCount) {
        const paginationContainer = document.getElementById('chatPagination');
        const paginationInfo = document.getElementById('chatPaginationInfo');
        const pageNumbers = document.getElementById('chatPageNumbers');
        const prevBtn = document.getElementById('chatPrevPage');
        const nextBtn = document.getElementById('chatNextPage');

        if (!paginationContainer) return;

        // Show/hide pagination based on total pages
        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'block';

        // Update pagination info
        if (paginationInfo) {
            const startItem = ((currentPage - 1) * 20) + 1;
            const endItem = Math.min(currentPage * 20, totalCount);
            paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalCount} conversations`;
        }

        // Generate page numbers
        if (pageNumbers) {
            pageNumbers.innerHTML = this.generatePageNumbers(currentPage, totalPages);
        }

        // Update prev/next buttons
        if (prevBtn) {
            prevBtn.disabled = currentPage <= 1;
            prevBtn.onclick = () => {
                if (currentPage > 1) {
                    this.loadConversations(currentPage - 1, this.getCurrentSearchQuery());
                }
            };
        }

        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
            nextBtn.onclick = () => {
                if (currentPage < totalPages) {
                    this.loadConversations(currentPage + 1, this.getCurrentSearchQuery());
                }
            };
        }

        // Store current page for reference
        this.currentPage = currentPage;
        this.totalPages = totalPages;
    }

    generatePageNumbers(currentPage, totalPages) {
        let pages = [];
        const maxVisiblePages = 5;

        if (totalPages <= maxVisiblePages) {
            // Show all pages if we have few enough
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Smart pagination with ellipsis
            if (currentPage <= 3) {
                // Show first pages + ellipsis + last
                pages = [1, 2, 3, 4, '...', totalPages];
            } else if (currentPage >= totalPages - 2) {
                // Show first + ellipsis + last pages
                pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
            } else {
                // Show first + ellipsis + current area + ellipsis + last
                pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
            }
        }

        return pages.map(page => {
            if (page === '...') {
                return '<span class="page-ellipsis">...</span>';
            } else {
                const isActive = page === currentPage ? 'active' : '';
                return `<button class="page-number ${isActive}" onclick="window.swapShelfChat.loadConversations(${page}, window.swapShelfChat.getCurrentSearchQuery())">${page}</button>`;
            }
        }).join('');
    }

    hidePagination() {
        const paginationContainer = document.getElementById('chatPagination');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }
    }

    getCurrentSearchQuery() {
        const searchInput = document.getElementById('conversationSearch');
        console.log('🔍 Getting search query, input element:', searchInput);
        const query = searchInput ? searchInput.value.trim() : '';
        console.log('🔍 Current search query:', query);
        return query;
    }

    setupSearchFunctionality() {
        // Try multiple times to find the search input
        let attempts = 0;
        const maxAttempts = 5;
        
        const trySetupSearch = () => {
            const searchInput = document.getElementById('conversationSearch');
            console.log(`🔍 Attempt ${attempts + 1}: Setting up search functionality, input found:`, searchInput);
            
            if (searchInput) {
                // Remove any existing event listeners to prevent duplicates
                if (this.handleSearchInput) {
                    searchInput.removeEventListener('input', this.handleSearchInput);
                }
                
                // Create bound function for proper this context
                this.handleSearchInput = (e) => {
                    console.log('🔍 Search input event triggered! Input value:', e.target.value);
                    clearTimeout(this.searchTimeout);
                    this.searchTimeout = setTimeout(() => {
                        const query = e.target.value.trim();
                        console.log('🔍 Searching conversations with query:', query);
                        this.loadConversations(1, query); // Reset to page 1 when searching
                    }, 300); // Debounce for 300ms
                };
                
                // Add the event listener
                searchInput.addEventListener('input', this.handleSearchInput);
                console.log('✅ Search event listener attached successfully');
                
                // Test the search functionality immediately
                console.log('🧪 Testing search input element:', {
                    id: searchInput.id,
                    placeholder: searchInput.placeholder,
                    value: searchInput.value,
                    classList: searchInput.classList.toString(),
                    parentElement: searchInput.parentElement
                });
                
                // Add a click test
                searchInput.addEventListener('focus', () => {
                    console.log('🔍 Search input focused!');
                });
                
                // Test manual search
                window.testSearch = (query) => {
                    console.log('🧪 Manual search test with query:', query);
                    this.loadConversations(1, query);
                };
                console.log('🧪 Manual search test available: window.testSearch("test")');
                
                return true; // Success
            } else {
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`❌ Search input not found, retrying in 100ms (attempt ${attempts}/${maxAttempts})`);
                    setTimeout(trySetupSearch, 100);
                } else {
                    console.error('❌ Search input element not found after multiple attempts!');
                }
                return false;
            }
        };
        
        trySetupSearch();
    }
    
    setupContactSearchFunctionality() {
        // Try multiple times to find the contact search input
        let attempts = 0;
        const maxAttempts = 5;
        
        const trySetupContactSearch = () => {
            const contactSearchInput = document.getElementById('contactSearch');
            console.log(`🔍 Attempt ${attempts + 1}: Setting up contact search functionality, input found:`, contactSearchInput);
            
            if (contactSearchInput) {
                // Remove any existing event listeners to prevent duplicates
                if (this.handleContactSearchInput) {
                    contactSearchInput.removeEventListener('input', this.handleContactSearchInput);
                }
                
                // Create bound function for proper this context
                this.handleContactSearchInput = (e) => {
                    console.log('🔍 Contact search input event triggered! Input value:', e.target.value);
                    clearTimeout(this.contactSearchTimeout);
                    this.contactSearchTimeout = setTimeout(() => {
                        const query = e.target.value.trim();
                        console.log('🔍 Searching users with query:', query);
                        this.searchUsers(query);
                    }, 300); // Debounce for 300ms
                };
                
                // Add the event listener
                contactSearchInput.addEventListener('input', this.handleContactSearchInput);
                console.log('✅ Contact search event listener attached successfully');
                
                // Test the search functionality immediately
                console.log('🧪 Testing contact search input element:', {
                    id: contactSearchInput.id,
                    placeholder: contactSearchInput.placeholder,
                    value: contactSearchInput.value,
                    classList: contactSearchInput.classList.toString(),
                    parentElement: contactSearchInput.parentElement
                });
                
                // Add a focus test
                contactSearchInput.addEventListener('focus', () => {
                    console.log('🔍 Contact search input focused!');
                });
                
                // Test manual search
                window.testContactSearch = (query) => {
                    console.log('🧪 Manual contact search test with query:', query);
                    this.searchUsers(query);
                };
                console.log('🧪 Manual contact search test available: window.testContactSearch("test")');
                
                return true; // Success
            } else {
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`❌ Contact search input not found, retrying in 100ms (attempt ${attempts}/${maxAttempts})`);
                    setTimeout(trySetupContactSearch, 100);
                } else {
                    console.error('❌ Contact search input element not found after multiple attempts!');
                }
                return false;
            }
        };
        
        trySetupContactSearch();
    }
}

// Initialize the chat interface when DOM is loaded
console.log('📝 Setting up DOMContentLoaded listener...');
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM loaded, creating SwapShelfChatInterface...');
    window.swapShelfChat = new SwapShelfChatInterface();
    
    // Make test function globally available for debugging
    window.testChatScroll = () => window.swapShelfChat.testScroll();
    
    console.log('✅ SwapShelfChatInterface created and assigned to window.swapShelfChat');
    console.log('✅ Test function available as window.testChatScroll()');
});

// Make it globally available for debugging
window.SwapShelfChatInterface = SwapShelfChatInterface;
console.log('✅ navbar-chat.js loaded successfully');