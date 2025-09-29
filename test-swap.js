const axios = require('axios');

async function testSwapAPI() {
    try {
        console.log('🧪 Testing swap API endpoint...');
        
        // We need to test with actual book IDs from the database
        // Let's use books that have owners
        const response = await axios.post('http://localhost:3000/api/swaps', {
            offeredBookId: '689e2ba746de4ed0a2716e50', // Example ID
            requestedBookId: '689e2ba746de4ed0a2716e51', // Example ID  
            message: 'Test chat request'
        }, {
            headers: {
                'Content-Type': 'application/json',
                // We need to include session cookies for authentication
                'Cookie': 'connect.sid=test'
            }
        });
        
        console.log('✅ Success:', response.data);
        
    } catch (error) {
        console.log('❌ Error:', error.response?.data || error.message);
        console.log('Status:', error.response?.status);
    }
}

testSwapAPI();