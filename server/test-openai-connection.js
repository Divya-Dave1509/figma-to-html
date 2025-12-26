require('dotenv').config();
const axios = require('axios');

async function testConnection() {
    const apiKey = process.env.OPENAI_API_KEY;
    console.log(`Testing OpenAI connection with key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'Not Set'}`);

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o",
            messages: [
                { role: "user", content: "Hello, are you working?" }
            ],
            max_tokens: 10
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Connection Successful!');
        console.log('Response:', response.data.choices[0].message.content);
    } catch (error) {
        console.error('❌ Connection Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testConnection();
