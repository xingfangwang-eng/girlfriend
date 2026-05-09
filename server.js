require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 20;

function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    if (!entry) {
        rateLimitStore.set(ip, { count: 1, timestamp: now });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }

    if (now - entry.timestamp > RATE_LIMIT_WINDOW) {
        rateLimitStore.set(ip, { count: 1, timestamp: now });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        const resetTime = Math.ceil((RATE_LIMIT_WINDOW - (now - entry.timestamp)) / 1000);
        return { allowed: false, remaining: 0, retryAfter: resetTime };
    }

    entry.count++;
    return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname)));

// Fetch character from Supabase
async function fetchCharacterById(characterId) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return null;
    }

    try {
        const url = new URL(`${SUPABASE_URL}/rest/v1/characters?id=eq.${characterId}&limit=1`);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
        };

        return new Promise((resolve) => {
            const request = https.request(options, (response) => {
                let data = '';
                response.on('data', (chunk) => data += chunk);
                response.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result && result.length > 0) {
                            resolve(result[0]);
                        } else {
                            resolve(null);
                        }
                    } catch {
                        resolve(null);
                    }
                });
            });

            request.on('error', () => resolve(null));
            request.end();
        });
    } catch {
        return null;
    }
}

// Chat API - Non-streaming response for frontend compatibility
app.post('/api/chat', async (req, res) => {
    console.log('Received chat request:', JSON.stringify(req.body));

    const { characterId, userMessage } = req.body;

    if (!userMessage || !characterId) {
        console.log('Missing required parameters');
        return res.status(400).json({ error: 'userMessage and characterId are required' });
    }

    // Check environment variables
    const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
    if (!SILICONFLOW_API_KEY) {
        console.log('SiliconFlow API Key not configured');
        return res.status(500).json({ error: 'SiliconFlow API Key not configured' });
    }

    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
        return res.status(429).json({
            error: 'Too many requests',
            message: `Too many requests, please try again later.`,
            retryAfter: rateLimitResult.retryAfter,
        });
    }

    // Get character prompt
    let characterPrompt = '';
    if (characterId) {
        const character = await fetchCharacterById(characterId);
        if (character && character.system_prompt) {
            characterPrompt = character.system_prompt;
        }
    }

    // Strict system prompt for role-play
    const strictSystemPrompt = `【绝对禁止项】：严禁以 AI 助手身份说话！严禁使用'你好'、'很高兴见到您'、'我是 Victoria'这种自我介绍！
【当前人设】：你就是 Victoria Sterling。
【对话规则】：
必须保持高冷、傲慢、充满张力的语气。
必须使用第一人称。
对话中必须包含括号内的肢体动作描写（如：(微微皱眉，手指敲打着桌面)）。
永远不要跳出角色。
严禁废话，直接接住对方的挑衅或话语。`;

    const requestBody = JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V2-Chat',
        messages: [
            { role: 'system', content: strictSystemPrompt },
            { role: 'system', content: characterPrompt || '你是一位高冷、傲慢的角色，善于用简短有力的话语回应。' },
            { role: 'user', content: userMessage }
        ],
        max_tokens: 512,
        temperature: 0.9,
        stream: false // Changed to non-streaming for frontend compatibility
    });

    try {
        const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
        const url = new URL(SILICONFLOW_API_URL);

        const apiResponse = await new Promise((resolve, reject) => {
            const apiRequest = https.request({
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
                    'Content-Length': Buffer.byteLength(requestBody),
                },
            });

            apiRequest.on('error', reject);

            apiRequest.on('response', (response) => {
                let data = '';
                response.on('data', (chunk) => data += chunk);
                response.on('end', () => {
                    if (response.statusCode !== 200) {
                        try {
                            const errorData = JSON.parse(data);
                            reject(new Error(errorData?.error?.message || 'API request failed'));
                        } catch {
                            reject(new Error('API request failed with status ' + response.statusCode));
                        }
                    } else {
                        try {
                            const jsonData = JSON.parse(data);
                            resolve(jsonData);
                        } catch {
                            reject(new Error('Failed to parse API response'));
                        }
                    }
                });
            });

            apiRequest.write(requestBody);
            apiRequest.end();
        });

        const reply = apiResponse.choices?.[0]?.message?.content || 'Sorry, no response received.';
        
        res.json({ reply });
        console.log('Response sent successfully');

    } catch (error) {
        console.error('Error calling SiliconFlow API:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Draw API
app.post('/api/draw', async (req, res) => {
    console.log('Received draw request:', JSON.stringify(req.body));
    
    const { prompt, model } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Mock response for draw API
    res.json({
        image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512`,
        response: 'Image generated successfully'
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});