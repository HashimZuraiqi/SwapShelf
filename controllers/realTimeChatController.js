const { ChatRoom, ChatMessage } = require('../models/RealTimeChat');
const User = require('../models/User');

class RealTimeChatController {
  // Find or create chat room between users
  static async findOrCreateRoom(req, res) {
    try {
      const { participantId } = req.body;
      const currentUserId = req.session.user._id || req.session.user.id;
      
      console.log('Creating room between:', currentUserId, 'and', participantId);

      // Check if room already exists
      let room = await ChatRoom.findOne({
        participants: {
          $all: [
            { $elemMatch: { user: currentUserId } },
            { $elemMatch: { user: participantId } }
          ]
        },
        roomType: 'direct'
      }).populate('participants.user', 'username avatar');

      if (!room) {
        room = new ChatRoom({
          participants: [
            { user: currentUserId },
            { user: participantId }
          ],
          roomType: 'direct'
        });
        await room.save();
        await room.populate('participants.user', 'username avatar');
      }

      res.json({ success: true, room });
    } catch (error) {
      console.error('Find/Create room error:', error);
      res.status(500).json({ error: 'Failed to create chat room' });
    }
  }

  // Get messages for a room
  static async getRoomMessages(req, res) {
    try {
      const { roomId } = req.params;
      const messages = await ChatMessage.find({ room: roomId })
        .populate('sender', 'username avatar')
        .sort({ createdAt: 1 })
        .limit(50);

      res.json({ success: true, messages });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  // Send message
  static async sendMessage(req, res) {
    try {
      const { roomId, content } = req.body;
      const senderId = req.session.user._id || req.session.user.id;

      const message = new ChatMessage({
        room: roomId,
        sender: senderId,
        content: content.trim()
      });

      await message.save();
      await message.populate('sender', 'username avatar');

      // Update room's lastMessage
      await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: message._id });

      res.json({ success: true, message });
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // Get user's rooms
  static async getUserRooms(req, res) {
    try {
      const userId = req.session.user._id || req.session.user.id;
      const rooms = await ChatRoom.find({
        'participants.user': userId,
        isActive: true
      })
        .populate('participants.user', 'username avatar')
        .populate('lastMessage')
        .sort({ updatedAt: -1 });

      res.json({ success: true, rooms });
    } catch (error) {
      console.error('Get user rooms error:', error);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  }
}

module.exports = RealTimeChatController;