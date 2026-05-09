import { createServer } from 'http';

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 20;

const SILICONFLOW_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

async function fetchCharacterById(characterId) {
    try {
        const https = await import('https');
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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check if environment variables are configured
    if (!SILICONFLOW_API_KEY) {
        return res.status(500).json({ error: 'SiliconFlow API Key not configured' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return res.status(500).json({ error: 'Supabase configuration not complete' });
    }

    const clientIP = getClientIP(req);
    const rateLimitResult = checkRateLimit(clientIP);

    if (!rateLimitResult.allowed) {
        res.writeHead(429, {
            'Content-Type': 'application/json',
            'Retry-After': rateLimitResult.retryAfter.toString(),
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': '0',
        });
        return res.end(JSON.stringify({
            error: 'Too many requests',
            message: `Too many requests, please try again later.`,
            retryAfter: rateLimitResult.retryAfter,
        }));
    }

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());

    let body = '';
    await new Promise((resolve, reject) => {
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', resolve);
        req.on('error', reject);
    });

    let parsedBody;
    try {
        parsedBody = JSON.parse(body);
    } catch {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    const { characterId, userMessage } = parsedBody;

    if (!userMessage) {
        return res.status(400).json({ error: 'userMessage is required' });
    }

    if (!characterId) {
        return res.status(400).json({ error: 'characterId is required' });
    }

    let characterPrompt = '';

    if (characterId) {
        const character = await fetchCharacterById(characterId);
        if (character && character.system_prompt) {
            characterPrompt = character.system_prompt;
        }
    }

    const strictSystemPrompt = `【绝对禁止项】：严禁以 AI 助手身份说话！严禁使用'你好'、'很高兴见到您'、'我是 Victoria'这种自我介绍！
【当前人设】：你就是 Victoria Sterling。
【对话规则】：
必须保持高冷、傲慢、充满张力的语气。
必须使用第一人称。
对话中必须包含括号内的肢体动作描写（如：(微微皱眉，手指敲打着桌面)）。
永远不要跳出角色。
严禁废话，直接接住对方的挑衅或话语。`;

    const siliconflowMessages = [
        {
            role: 'system',
            content: strictSystemPrompt,
        },
        {
            role: 'system',
            content: characterPrompt || '你是一位高冷、傲慢的角色，善于用简短有力的话语回应。',
        },
        {
            role: 'user',
            content: userMessage,
        },
    ];

    const requestBody = JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V2-Chat',
        messages: siliconflowMessages,
        max_tokens: 512,
        temperature: 0.9,
        stream: true,
    });

    try {
        const https = await import('https');
        const url = new URL(SILICONFLOW_API_URL);

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

        apiRequest.on('error', (error) => {
            console.error('Error calling SiliconFlow API:', error);
            res.status(500).json({ error: 'Internal server error' });
        });

        apiRequest.on('response', (apiResponse) => {
            if (apiResponse.statusCode !== 200) {
                let errorBody = '';
                apiResponse.on('data', (chunk) => {
                    errorBody += chunk.toString();
                });
                apiResponse.on('end', () => {
                    try {
                        const errorData = JSON.parse(errorBody);
                        res.status(apiResponse.statusCode).json({
                            error: errorData?.error?.message || 'API request failed'
                        });
                    } catch {
                        res.status(apiResponse.statusCode).json({ error: 'API request failed' });
                    }
                });
                return;
            }

            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            });

            let buffer = '';
            apiResponse.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            res.end();
                            return;
                        }

                        try {
                            const json = JSON.parse(data);
                            const content = json.choices?.[0]?.delta?.content;
                            if (content) {
                                res.write(content);
                            }
                        } catch (e) {
                            console.error('Failed to parse JSON:', e);
                        }
                    }
                }
            });

            apiResponse.on('end', () => {
                res.end();
            });
        });

        apiRequest.write(requestBody);
        apiRequest.end();

        return new Promise(() => {});

    } catch (error) {
        console.error('Error calling SiliconFlow API:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

export const config = {
    api: {
        responseLimit: '8mb',
    },
};