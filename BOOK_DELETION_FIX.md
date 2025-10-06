# Book Deletion Fix After Swap Completion

## Issue
Books were not being removed from users' libraries after swap completion, even though the code attempted to delete them.

## Root Cause
The issue was with how book IDs were being accessed from the swap object. The swap model stores book information in nested structures:

```javascript
requestedBook: {
  id: ObjectId,  // Reference to Book
  title: String,
  author: String
}

offeredBooks: [{
  id: ObjectId,  // Reference to Book
  title: String,
  author: String
}]
```

When the swap is populated with `.populate('requestedBook.id')`, the `id` field becomes an object (the full book document) instead of just the ObjectId. The old code was trying to access `swap.requestedBook.id` directly, which could be:
- An ObjectId (if not populated)
- A full Book object (if populated) - in which case we need `._id`
- Undefined (if the book was already deleted)

## Solution
Updated the book deletion logic to handle all three cases by trying multiple paths to find the actual book ID:

```javascript
// For requested book
const requestedBookId = swap.requestedBook?.id?._id || swap.requestedBook?.id || swap.requestedBook?._id;

// For offered books
const bookIds = swap.offeredBooks
    .map(b => b.id?._id || b.id || b._id)
    .filter(id => id);
```

This ensures we can find the book ID regardless of:
1. Whether the book reference is populated or not
2. The structure of the book data in the swap object
3. Whether the book still exists

## Changes Made

### File: `controllers/swapController.js`

#### 1. `confirmBookReceived` function (lines ~1050-1095)
- Updated book deletion logic when both users confirm receipt
- Added detailed logging to track deletion process
- Added fallback ID extraction logic

#### 2. `completeSwap` function (lines ~478-498)
- Updated book deletion logic for manual swap completion
- Added same fallback ID extraction logic
- Improved logging for debugging

## Testing
To verify the fix works:

1. **Create a swap between two users**
2. **Both users confirm book receipt**
3. **Check both users' libraries** - the swapped books should be removed
4. **Check console logs** - should see:
   ```
   🗑️ Removing swapped books from libraries...
   🎯 Attempting to delete requested book with ID: [bookId]
   ✅ Deleted requested book: [bookId]
   🎯 Attempting to delete offered books with IDs: [bookIds]
   ✅ Deleted offered books count: X
   🎉 Book deletion process completed
   ```

## Additional Improvements

### Enhanced Logging
Added comprehensive logging to track the book deletion process:
- Shows swap data structure before deletion
- Shows book IDs being targeted for deletion
- Shows deletion results (success/not found)
- Helps debug any future issues

### Error Handling
The code now handles edge cases:
- Missing book references
- Already deleted books
- Populated vs non-populated references
- Empty offered books arrays

## Related Files
- `models/Swap.js` - Defines the swap schema with nested book references
- `controllers/swapController.js` - Handles swap completion and book deletion
- `models/Book.js` - Book model that gets deleted

## Notes
- Books are permanently deleted from the database, not just marked as unavailable
- This is intentional as the books have been physically exchanged
- Users should add the newly received books to their library manually
- The deletion happens automatically when both parties confirm receipt

## Future Considerations
1. Consider adding a "swap history" to track exchanged books
2. Add option to automatically add received book to user's library
3. Add confirmation dialog before permanent deletion
4. Consider soft delete (archive) instead of hard delete for record-keeping
