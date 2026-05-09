const fetch = require('node-fetch');

const SUPABASE_URL = 'https://dhsyfimtdxtmzmoqfwdj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImLoc3lmaW10ZHh0bXptb3Fmd2RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgwNjY1NDUsImV4cCI6MjAyMzY0MjU0NX0.Q9q2f0X7bZ8tY7U0Z5B7N7N7O7O7O7O7O7O7O7O7';

async function testConnection() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/characters?select=id,name&limit=3`, {
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('HTTP状态码:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('错误响应:', errorText);
            return;
        }

        const data = await response.json();
        console.log('成功获取角色:', data);
    } catch (error) {
        console.error('请求失败:', error.message);
    }
}

testConnection();