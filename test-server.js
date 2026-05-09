require('dotenv').config();
const express = require('express');
const https = require('https');

const app = express();
const PORT = 3000;

// Rate limiting
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000;
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

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

app.use(express.json());
app.use(express.static(__dirname));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Chat API - Non-streaming mock response
app.post('/api/chat', async (req, res) => {
    console.log('\n=== Chat Request Received ===');
    console.log('Body:', JSON.stringify(req.body));
    
    const { characterId, userMessage } = req.body;
    
    // Validate input
    if (!userMessage) {
        console.log('Error: userMessage is required');
        return res.status(400).json({ error: 'userMessage is required' });
    }
    
    if (!characterId) {
        console.log('Error: characterId is required');
        return res.status(400).json({ error: 'characterId is required' });
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
    
    // Test mode - using mock responses regardless of API key
    
    // Mock responses based on Victoria's persona
    const mockResponses = [
        `(fingers brushing the edge of an expensive silk glove, a cold smile playing on crimson lips) ${userMessage}? What a tedious question.`,
        `(elegantly swirling the goblet, eyes dripping with disdain) Do you really think I care about such trivial matters?`,
        `(setting down the fountain pen, knuckles tapping the oak desk) Get to the point.`,
        `(eyebrow arched, fingers casually twirling a pearl necklace) Hmph, you dare speak to me like that.`,
        `(taking a sip of champagne, lips curled in amusement) Interesting... but not interesting enough.`,
        `(finger tapping temple, gaze sharp as a blade) Continue. I'm listening.`,
        `(a cold laugh, tossing the document onto the table) Is this supposed to be a challenge?`,
        `(slumping lazily in the chair, fingertips brushing red lips) You're wasting my time.`,
    ];
    
    const randomIndex = Math.floor(Math.random() * mockResponses.length);
    const mockResponse = mockResponses[randomIndex];
    
    console.log('Sending mock response:', mockResponse);
    
    // Simulate API delay
    setTimeout(() => {
        res.json({ reply: mockResponse });
    }, 500 + Math.random() * 1000);
});

// Draw API
app.post('/api/draw', async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    res.json({
        image_url: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512`,
        response: 'Image generated successfully'
    });
});

app.listen(PORT, () => {
    console.log(`Test server running on http://localhost:${PORT}`);
});