class RealTimeChatWidget {
  constructor() {
    this.socket = null;
    this.currentRoom = null;
    this.currentUser = null;
    this.isMinimized = false;
    this.init();
  }

  init() {
    this.createChatWidget();
    this.connectSocket();
    this.bindEvents();
    this.loadUserData();
  }

  createChatWidget() {
    const chatHTML = `
      <div id="real-chat-widget" class="chat-widget minimized">
        <div class="chat-header" id="chat-header">
          <div class="header-content">
            <i class="fas fa-comments"></i>
            <span class="header-title">SwapShelf Chat</span>
            <div class="header-actions">
              <button id="minimize-btn" class="btn-icon">
                <i class="fas fa-minus"></i>
              </button>
            </div>
          </div>
        </div>
        
        <div class="chat-body" id="chat-body">
          <div class="chat-tabs">
            <button class="tab-btn active" data-tab="search">
              <i class="fas fa-search"></i> Find Users
            </button>
            <button class="tab-btn" data-tab="rooms">
              <i class="fas fa-comments"></i> Chats
            </button>
          </div>
          
          <div class="tab-content">
            <!-- Search Tab -->
            <div class="tab-panel active" id="search-panel">
              <div class="search-section">
                <div class="search-box">
                  <input type="text" id="user-search" placeholder="Search users..." autocomplete="off">
                  <i class="fas fa-search search-icon"></i>
                </div>
                <div id="search-results" class="search-results"></div>
              </div>
            </div>
            
            <!-- Rooms Tab -->
            <div class="tab-panel" id="rooms-panel">
              <div id="rooms-list" class="rooms-list"></div>
            </div>
            
            <!-- Chat Panel -->
            <div class="chat-panel" id="chat-panel" style="display: none;">
              <div class="chat-room-header">
                <button id="back-btn" class="btn-back">
                  <i class="fas fa-arrow-left"></i>
                </button>
                <div class="room-info">
                  <span id="room-title">Chat</span>
                </div>
              </div>
              <div id="messages-container" class="messages-container"></div>
              <div class="message-input-area">
                <div class="input-group">
                  <input type="text" id="message-input" placeholder="Type your message..." autocomplete="off">
                  <button id="send-btn" class="btn-send">
                    <i class="fas fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatHTML);
  }

  connectSocket() {
    this.socket = io();
    
    this.socket.on('connect', () => {
      console.log('Connected to chat server');
    });

    this.socket.on('newMessage', (message) => {
      this.handleNewMessage(message);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
    });
  }

  bindEvents() {
    // Header events
    document.getElementById('chat-header').addEventListener('click', () => {
      this.toggleWidget();
    });

    document.getElementById('minimize-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimizeWidget();
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // User search
    const searchInput = document.getElementById('user-search');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.searchUsers(e.target.value);
      }, 300);
    });

    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
      this.showTabPanels();
    });

    // Send message
    document.getElementById('send-btn').addEventListener('click', () => {
      this.sendMessage();
    });

    document.getElementById('message-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });
  }

  async loadUserData() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        this.currentUser = await response.json();
        console.log('Current user loaded:', this.currentUser);
        this.loadUserRooms();
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }

  toggleWidget() {
    const widget = document.getElementById('real-chat-widget');
    if (this.isMinimized) {
      widget.classList.remove('minimized');
      this.isMinimized = false;
    } else {
      this.minimizeWidget();
    }
  }

  expandWidget() {
    const widget = document.getElementById('real-chat-widget');
    widget.classList.remove('minimized');
    this.isMinimized = false;
  }

  minimizeWidget() {
    const widget = document.getElementById('real-chat-widget');
    widget.classList.add('minimized');
    this.isMinimized = true;
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}-panel`);
    });

    if (tabName === 'rooms') {
      this.loadUserRooms();
    }
  }

  async searchUsers(query) {
    if (!query.trim()) {
      document.getElementById('search-results').innerHTML = '';
      return;
    }

    try {
      const response = await fetch(`/api/chat/search-users?query=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.success) {
        this.displaySearchResults(data.users);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  }

  displaySearchResults(users) {
    const resultsContainer = document.getElementById('search-results');
    
    if (users.length === 0) {
      resultsContainer.innerHTML = '<div class="no-results">No users found</div>';
      return;
    }

    const resultsHTML = users.map(user => `
      <div class="user-result" data-user-id="${user._id}">
        <div class="user-avatar">
          <img src="${user.avatar || '/images/default-avatar.png'}" alt="${user.username}">
        </div>
        <div class="user-info">
          <div class="username">${user.username}</div>
          <div class="user-email">${user.email}</div>
        </div>
        <button class="chat-btn" onclick="realTimeChat.startChat('${user._id}', '${user.username}')">
          <i class="fas fa-comment"></i>
        </button>
      </div>
    `).join('');

    resultsContainer.innerHTML = resultsHTML;
  }

  async startChat(userId, username) {
    try {
      // First expand the widget
      this.expandWidget();
      
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: userId })
      });

      const data = await response.json();
      if (data.success) {
        // Load messages for the room
        const messagesResponse = await fetch(`/api/chat/rooms/${data.room._id}/messages`);
        const messagesData = await messagesResponse.json();
        
        // Open the chat room and display messages
        this.openChatRoom(data.room, username);
        if (messagesData.success) {
          this.displayMessages(messagesData.messages);
        }
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  }

  async loadUserRooms() {
    try {
      const response = await fetch('/api/chat/rooms');
      const data = await response.json();

      if (data.success) {
        this.displayUserRooms(data.rooms);
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  }

  displayUserRooms(rooms) {
    const roomsList = document.getElementById('rooms-list');
    
    if (rooms.length === 0) {
      roomsList.innerHTML = '<div class="no-rooms">No conversations yet</div>';
      return;
    }

    const roomsHTML = rooms.map(room => {
      const currentUserId = this.currentUser._id || this.currentUser.id;
      const otherUser = room.participants.find(p => p.user._id !== currentUserId)?.user;
      return `
        <div class="room-item" onclick="realTimeChat.openChatRoomById('${room._id}', '${otherUser?.username}')">
          <div class="room-avatar">
            <img src="${otherUser?.avatar || '/images/default-avatar.png'}" alt="${otherUser?.username}">
          </div>
          <div class="room-info">
            <div class="room-name">${otherUser?.username}</div>
            <div class="last-message">${room.lastMessage?.content || 'No messages yet'}</div>
          </div>
          <div class="room-time">
            ${room.updatedAt ? new Date(room.updatedAt).toLocaleDateString() : ''}
          </div>
        </div>
      `;
    }).join('');

    roomsList.innerHTML = roomsHTML;
  }

  async openChatRoomById(roomId, username) {
    try {
      const response = await fetch(`/api/chat/rooms/${roomId}/messages`);
      const data = await response.json();

      if (data.success) {
        this.openChatRoom({ _id: roomId }, username);
        this.displayMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }

  openChatRoom(room, username) {
    this.currentRoom = room;
    
    // Hide tab panels and show chat
    document.querySelector('.chat-tabs').style.display = 'none';
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.style.display = 'none';
    });
    document.getElementById('chat-panel').style.display = 'block';
    
    // Update room title
    document.getElementById('room-title').textContent = username;
    
    // Join socket room
    if (this.socket) {
      this.socket.emit('joinRoom', room._id);
    }
  }

  showTabPanels() {
    document.querySelector('.chat-tabs').style.display = 'flex';
    document.getElementById('chat-panel').style.display = 'none';
    
    // Show active tab panel
    const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
    document.getElementById(`${activeTab}-panel`).style.display = 'block';
    
    this.currentRoom = null;
  }

  displayMessages(messages) {
    const container = document.getElementById('messages-container');
    const currentUserId = this.currentUser._id || this.currentUser.id;
    
    const messagesHTML = messages.map(msg => `
      <div class="message ${msg.sender._id === currentUserId ? 'own' : 'other'}">
        <div class="message-avatar">
          <img src="${msg.sender.avatar || '/images/default-avatar.png'}" alt="${msg.sender.username}">
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="sender-name">${msg.sender.username}</span>
            <span class="message-time">${new Date(msg.createdAt).toLocaleTimeString()}</span>
          </div>
          <div class="message-text">${msg.content}</div>
        </div>
      </div>
    `).join('');

    container.innerHTML = messagesHTML;
    container.scrollTop = container.scrollHeight;
  }

  async sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content || !this.currentRoom) return;

    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: this.currentRoom._id,
          content: content
        })
      });

      const data = await response.json();
      if (data.success) {
        input.value = '';
        this.addMessageToDisplay(data.message);
        
        // Emit to socket for real-time
        if (this.socket) {
          this.socket.emit('sendMessage', {
            roomId: this.currentRoom._id,
            message: data.message
          });
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  addMessageToDisplay(message) {
    const container = document.getElementById('messages-container');
    const currentUserId = this.currentUser._id || this.currentUser.id;
    const messageHTML = `
      <div class="message ${message.sender._id === currentUserId ? 'own' : 'other'}">
        <div class="message-avatar">
          <img src="${message.sender.avatar || '/images/default-avatar.png'}" alt="${message.sender.username}">
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="sender-name">${message.sender.username}</span>
            <span class="message-time">${new Date(message.createdAt).toLocaleTimeString()}</span>
          </div>
          <div class="message-text">${message.content}</div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', messageHTML);
    container.scrollTop = container.scrollHeight;
  }

  handleNewMessage(message) {
    if (this.currentRoom && message.room === this.currentRoom._id) {
      this.addMessageToDisplay(message);
    }
  }
}

// Initialize chat widget when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.realTimeChat = new RealTimeChatWidget();
});