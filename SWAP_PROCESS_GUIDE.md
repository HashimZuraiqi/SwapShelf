# 📚 Complete Active Swap Process Guide

## Overview
This guide explains how the book swap process works from start to finish, including the Schedule Meeting feature.

---

## 🔄 5-Step Swap Process

### **Step 1: Send Swap Request** 
**Status:** `Pending` 🕐

**How to:**
1. Browse available books in the "Find Matches" tab
2. Click "Start Swap" on a book you want
3. Select a book from your library to offer
4. Write a personal message (minimum 10 characters)
5. Click "Send Swap Request"

**What happens:**
- The book owner receives a notification
- Your request appears in "My Requests" tab
- The owner can accept or reject your request

---

### **Step 2: Request Accepted**
**Status:** `Accepted` ✅

**How to:**
- Wait for the book owner to review and accept your request
- You'll receive a notification when accepted

**What you can do:**
- Click "Chat with Partner" to discuss details
- View the swap in "Active Swaps" tab
- Proceed to schedule a meeting

---

### **Step 3: Schedule Meeting** 
**Status:** `Accepted` → `In Progress` 📅

**How to:**
1. Go to "Active Swaps" tab
2. Find your accepted swap
3. Click "Schedule Meeting" button
4. Fill in the meeting form:
   - **Location**: Enter a public place (library, coffee shop, park)
   - **Date & Time**: Choose when to meet
   - **Notes**: Add parking info or specific instructions
5. Click "Schedule Meeting"

**Meeting Form Fields:**
```javascript
{
  location: "Central Library, Main Entrance",
  datetime: "2025-10-15T14:30",
  notes: "I'll be wearing a blue jacket. Parking available in Lot B."
}
```

**What happens:**
- Meeting details are saved to the swap
- Your swap partner receives notification with meeting details
- Swap status may update to "In Progress"

**Safety Tips (Shown in Modal):**
- ✅ Meet in public, well-lit locations
- ✅ Bring a friend or tell someone where you're going
- ✅ Check book condition before finalizing
- ✅ Meet during daylight hours when possible

---

### **Step 4: Exchange Books**
**Status:** `In Progress` 🔄

**What to do:**
1. **Before Meeting:**
   - Review the meeting details
   - Chat with your partner to confirm
   - Bring the book in agreed condition

2. **During Meeting:**
   - Verify each other's identity
   - Inspect both books carefully
   - Check for:
     - Correct title and edition
     - Condition matches description
     - No missing pages or damage
   - Exchange books

3. **After Meeting:**
   - Proceed to confirm completion

---

### **Step 5: Confirm Completion**
**Status:** `Completed` 🎉

**How to:**
1. Go to "Active Swaps" tab
2. Click "Confirm Completion" on your swap
3. Confirm you received the book

**What happens:**
- Both parties must confirm completion
- Once both confirm:
  - ✨ **+10 Reward Points** earned!
  - 🏆 Swap appears in your history
  - 📝 Option to rate your swap partner
  - 📚 Books are marked as swapped

---

## 🛠️ Technical Implementation

### Frontend Functions

#### 1. **Schedule Meeting**
```javascript
function scheduleMeeting(swapId) {
    showMeetingScheduleModal(swapId);
}
```

#### 2. **Meeting Form Submission**
```javascript
$.ajax({
    url: `/api/swaps/${swapId}/meeting`,
    method: 'PUT',
    contentType: 'application/json',
    data: JSON.stringify({
        location: "Central Library",
        datetime: "2025-10-15T14:30",
        notes: "Optional notes"
    })
})
```

#### 3. **View Swap Process Guide**
```javascript
function showSwapProcessGuide() {
    // Shows comprehensive 5-step guide modal
}
```

#### 4. **Open Chat**
```javascript
function openChat(swapId) {
    // Opens chat with swap partner
}
```

---

## 📋 Required Backend API Endpoint

You need to create this endpoint in your backend:

### **PUT `/api/swaps/:swapId/meeting`**

**Request Body:**
```json
{
  "location": "Central Library, Main Entrance",
  "datetime": "2025-10-15T14:30:00",
  "notes": "I'll be wearing a blue jacket"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Meeting scheduled successfully",
  "swap": {
    "_id": "swap_id",
    "status": "Accepted",
    "meeting": {
      "location": "Central Library, Main Entrance",
      "datetime": "2025-10-15T14:30:00",
      "notes": "I'll be wearing a blue jacket",
      "scheduledAt": "2025-10-10T10:00:00Z"
    }
  }
}
```

**Backend Implementation (Node.js/Express):**
```javascript
// In routes/swaps.js
router.put('/:swapId/meeting', requireAuth, async (req, res) => {
    try {
        const { swapId } = req.params;
        const { location, datetime, notes } = req.body;
        
        const swap = await Swap.findById(swapId);
        
        if (!swap) {
            return res.status(404).json({ error: 'Swap not found' });
        }
        
        // Verify user is part of this swap
        if (swap.requester.toString() !== req.user._id.toString() && 
            swap.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Update swap with meeting details
        swap.meeting = {
            location,
            datetime: new Date(datetime),
            notes,
            scheduledBy: req.user._id,
            scheduledAt: new Date()
        };
        
        await swap.save();
        
        // TODO: Send notification to other party
        // await sendMeetingNotification(swap);
        
        res.json({
            success: true,
            message: 'Meeting scheduled successfully',
            swap
        });
    } catch (error) {
        console.error('Error scheduling meeting:', error);
        res.status(500).json({ error: 'Failed to schedule meeting' });
    }
});
```

---

## 🗄️ Database Schema Update

Add meeting field to your Swap model:

```javascript
// In models/Swap.js
const swapSchema = new mongoose.Schema({
    // ... existing fields ...
    
    meeting: {
        location: {
            type: String,
            trim: true
        },
        datetime: {
            type: Date
        },
        notes: {
            type: String,
            trim: true
        },
        scheduledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        scheduledAt: {
            type: Date,
            default: Date.now
        }
    },
    
    // ... rest of schema ...
});
```

---

## 🎯 User Interface Features

### Active Swaps Tab
Shows all your active swaps with action buttons:
- 💬 **Chat with Partner**
- 📅 **Schedule Meeting**
- ✅ **Confirm Completion**
- ❌ **Cancel Swap**

### Meeting Details Display
Once scheduled, shows:
```
📍 Location: Central Library
🕐 Time: October 15, 2025 at 2:30 PM
📝 Notes: I'll be wearing a blue jacket
```

### Progress Tracker Modal
Visual workflow showing:
1. Request Sent ✓
2. Request Accepted ✓
3. Meeting Scheduled ✓ ← Current Step
4. Books Exchanged
5. Swap Completed

---

## 🔔 Notifications

Users should receive notifications for:
- ✉️ New swap request received
- ✅ Swap request accepted
- 📅 Meeting scheduled/updated
- ⏰ Meeting reminder (1 day before)
- 💬 New chat message
- ✓ Swap completion confirmed
- 🏆 Reward points earned

---

## 📱 Testing Checklist

- [ ] Schedule meeting with valid data
- [ ] Schedule meeting with past date (should fail)
- [ ] Schedule meeting without location (should fail)
- [ ] View scheduled meeting details
- [ ] Update existing meeting
- [ ] Chat with swap partner
- [ ] Confirm swap completion
- [ ] Verify reward points awarded
- [ ] Check notification delivery
- [ ] Test mobile responsiveness

---

## 🎨 UI/UX Enhancements

### Modal Styling
- Gradient backgrounds (#3BB7FB → #667eea)
- Dark theme with glass-morphism
- Smooth animations
- Safety tips prominently displayed

### Form Validation
- Minimum datetime validation (must be in future)
- Required fields: location, datetime
- Character limits on notes field
- Real-time validation feedback

### Success Messages
Shows formatted meeting details:
```
"Meeting scheduled for Monday, October 15, 2025 at 2:30 PM 
at Central Library! Your swap partner will be notified."
```

---

## 🚀 Quick Start for Users

1. **Accept a swap request**
2. **Click "Schedule Meeting"**
3. **Fill in the form:**
   - Where: Public location
   - When: Date and time
   - Notes: Any details
4. **Click "Schedule Meeting" button**
5. **Meet and exchange books**
6. **Confirm completion**
7. **Earn reward points! 🏆**

---

## 💡 Tips for Successful Swaps

### For Requesters:
- Write personalized messages
- Be flexible with meeting times
- Arrive on time
- Bring the book in promised condition

### For Book Owners:
- Respond to requests promptly
- Choose safe, convenient locations
- Communicate clearly
- Be honest about book condition

### For Both:
- Use the chat feature to coordinate
- Confirm meeting 1 day before
- Exchange contact info if comfortable
- Leave honest reviews after swap

---

## 📞 Support

If you encounter issues:
1. Check the Swap Process Guide modal (click info button)
2. Use the chat feature to communicate with your partner
3. Contact support if technical issues persist

---

## 🔮 Future Enhancements

- [ ] Calendar integration
- [ ] Meeting location suggestions (nearby libraries)
- [ ] Photo verification of books
- [ ] QR code for quick meeting check-in
- [ ] Rating system for swap partners
- [ ] Dispute resolution system
- [ ] Meeting reminders via email/SMS

---

**Happy Swapping! 📚✨**
