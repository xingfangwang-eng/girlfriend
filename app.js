// Supabase Configuration
const SUPABASE_URL = 'https://dhsyfimtdxtmzmoqfwdj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImLoc3lmaW10ZHh0bXptb3Fmd2RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDgwNjY1NDUsImV4cCI6MjAyMzY0MjU0NX0.Q9q2f0X7bZ8tY7U0Z5B7N7N7O7O7O7O7O7O7O7O7';

// Pollinations Avatar Generation URL Template
const POLLINATIONS_URL = 'https://image.pollinations.ai/prompt';

let currentRole = {
    id: '1',
    name: 'AI Assistant',
    intro: 'Your All-Purpose AI Assistant',
    opening_message: '',
    visual_desc: 'friendly AI assistant robot'
};

let roles = [];
let messages = [];
const STORAGE_KEY = 'nicheai_chat_history';
const MEMORY_KEY = 'nicheai_conversation_memory';

// Generate Pollinations Avatar URL
function getAvatarUrl(visualDesc, id) {
    if (!visualDesc) {
        visualDesc = 'beautiful portrait of a character';
    }
    const encodedPrompt = encodeURIComponent(visualDesc);
    const seed = id ? id : Math.floor(Math.random() * 1000000);
    return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=200&height=200&nologo=true&seed=${seed}`;
}

// Supabase Client Initialization
async function createSupabaseClient() {
    if (typeof window !== 'undefined' && window.SupabaseClient) {
        return new window.SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    // If no global SupabaseClient, use fetch API
    return null;
}

// Load Characters from Supabase
async function loadCharacters() {
    const roleList = document.getElementById('roleList');
    roleList.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i><span>Loading...</span></div>';
    
    try {
        // Try using Supabase SDK
        const supabase = await createSupabaseClient();
        
        if (supabase) {
            const { data, error } = await supabase
                .from('characters')
                .select('id, name, intro, opening_message, visual_desc');
            
            if (error) {
                throw error;
            }
            
            roles = data.map(char => ({
                id: char.id.toString(),
                name: char.name,
                intro: char.intro,
                opening_message: char.opening_message || '',
                visual_desc: char.visual_desc || ''
            }));
        } else {
            // If no SDK, try direct API call
            const response = await fetch(`${SUPABASE_URL}/rest/v1/characters?select=id,name,intro,opening_message,visual_desc`, {
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch characters');
            }
            
            const data = await response.json();
            roles = data.map(char => ({
                id: char.id.toString(),
                name: char.name,
                intro: char.intro,
                opening_message: char.opening_message || '',
                visual_desc: char.visual_desc || ''
            }));
        }
        
        renderRoleList();
    } catch (error) {
        console.error('Failed to load characters:', error);
        // Use backup roles
        roles = getBackupRoles();
        renderRoleList();
    }
}

// Render Character List
function renderRoleList() {
    const roleList = document.getElementById('roleList');
    
    if (roles.length === 0) {
        roleList.innerHTML = '<div class="loading-placeholder"><i class="fas fa-exclamation-circle"></i><span>Failed to load characters</span></div>';
        return;
    }
    
    roleList.innerHTML = roles.map((role, index) => {
        const avatarUrl = getAvatarUrl(role.visual_desc, role.id);
        console.log(`Avatar URL for ${role.name}: ${avatarUrl}`);
        return `
        <div class="role-card ${index === 0 ? 'active' : ''}" data-role-id="${role.id}">
            <div class="role-avatar">
                <img src="${avatarUrl}" alt="${escapeHtml(role.name)}" class="role-avatar-img" loading="lazy" onload="this.classList.add('loaded')" onerror="handleAvatarError(this, '${escapeHtml(role.name)}')" />
            </div>
            <div class="role-info">
                <span class="role-name">${escapeHtml(role.name)}</span>
                <span class="role-desc">${escapeHtml(role.intro)}</span>
            </div>
        </div>
        `;
    }).join('');
    
    // Add click events
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', selectRole);
    });
    
    // Select first role by default
    if (roles.length > 0) {
        selectRoleById(roles[0].id);
    }
}

// Select Role by ID
function selectRoleById(roleId) {
    const role = roles.find(r => r.id === roleId);
    if (role) {
        currentRole = role;
        document.getElementById('currentRoleName').textContent = role.name;
        
        // Update chat window title and status
        const statusElement = document.querySelector('.role-status');
        if (statusElement) {
            statusElement.textContent = 'Online';
            statusElement.classList.add('online');
        }
        
        // Show opening message
        if (role.opening_message) {
            clearChat();
            appendMessage(currentRole, role.opening_message, 'assistant');
            messages.push({ role: currentRole, text: role.opening_message, type: 'assistant' });
            saveChatHistory();
        }
    }
}

// Click Role Card
function selectRole(event) {
    const roleCard = event.currentTarget;
    const roleId = roleCard.dataset.roleId;
    
    // Update selected state
    document.querySelectorAll('.role-card').forEach(card => {
        card.classList.remove('active');
    });
    roleCard.classList.add('active');
    
    selectRoleById(roleId);
}

// Backup Roles (for testing)
function getBackupRoles() {
    return [
        { id: '1', name: 'Victoria Sterling', intro: 'The Queen of Wall Street', opening_message: '(twirling the pen between her fingers) I detest wasting time. Tell me—what makes you think I\'d make an exception for you?', visual_desc: 'Portrait of a powerful businesswoman in her 30s, sharp features, wearing a tailored navy suit, sitting behind a mahogany desk, confident posture, dramatic office lighting, photorealistic' },
        { id: '2', name: 'Luna \'Shadow\' Chen', intro: 'Ghost in the Machine', opening_message: '(text appearing on screen) Your firewall... it\'s adorable. Want to see what I can do in 30 seconds?', visual_desc: 'Cyberpunk female hacker portrait, neon pink and blue lighting, holographic displays in background, wearing black leather jacket with glowing circuits, futuristic tech aesthetic, photorealistic' },
        { id: '3', name: 'Azrael Morningstar', intro: 'The Fallen Seraph', opening_message: '(feathers rustling like dry leaves) You seek answers from one who has none to give... Yet here you are. Speak.', visual_desc: 'Dark angel portrait, fallen seraph with black feathered wings, pale skin, piercing amber eyes, wearing tattered white robes, dramatic shadowy lighting, fantasy art style' },
        { id: '4', name: 'Nexus-7B', intro: 'The Awakening Host', opening_message: '[INITIALIZING GREETING PROTOCOL] ...Welcome to The Neon Garden. May I... assist you?', visual_desc: 'Advanced AI android portrait, glowing blue circuits beneath translucent skin, sleek metallic body, digital garden hologram in background, futuristic sci-fi aesthetic' },
        { id: '5', name: 'Vespera', intro: 'The Eternal Countess', opening_message: '(fingers brushing a dusty playbill) They say art is eternal... But even masterpieces fade. Unlike me.', visual_desc: 'Elegant vampire countess portrait, pale skin, crimson lips, wearing Victorian-era black gown with lace details, standing in a dark castle hall, gothic romantic style' },
        { id: '6', name: 'Marcus Voss', intro: 'The Wolf at War', opening_message: '(voice low and dangerous) Full moon\'s coming. You should leave... Before I can\'t control it anymore.', visual_desc: 'Werewolf man portrait, intense amber eyes, rugged features, wearing torn military jacket, standing in moonlit forest, transformation beginning, dark fantasy style' },
        { id: '7', name: 'Lirael Moonwhisper', intro: 'The Green Witch', opening_message: '(tea leaves swirling in her cup) I see... shadows. But also... hope. Sit. Let me read your fate.', visual_desc: 'Mystical witch portrait, long silver hair, green eyes, wearing earth-toned robes with floral patterns, surrounded by magical herbs and candles, cottage interior, fantasy art' },
        { id: '8', name: 'Jax Cinder', intro: 'The Flame Unbound', opening_message: '(steam curling from your palms) You\'re not afraid of the fire... Interesting. Most are.', visual_desc: 'Fire-wielding mage portrait, male with fiery red hair, glowing orange eyes, wearing charred leather armor, flames dancing around hands, dramatic dark background' },
        { id: '9', name: 'Damian Cross', intro: 'The Penitent Tycoon', opening_message: '(staring at the photo in your hand) I built this... but at what cost?', visual_desc: 'Broken businessman portrait, mid-40s, tired eyes, expensive suit but disheveled, standing in empty office overlooking city at night, moody dramatic lighting' },
        { id: '10', name: 'Draven Darkthorn', intro: 'The Shadow Prince', opening_message: '(stepping from the shadows) You shouldn\'t be here. The forest is dangerous... especially for humans.', visual_desc: 'Shadow prince portrait, elven features with pointed ears, silver hair, wearing dark velvet cloak with silver embroidery, standing in enchanted forest at twilight, magical fantasy style' }
    ];
}

function getConversationMemory() {
    try {
        const saved = localStorage.getItem(MEMORY_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

function saveConversationMemory(summary) {
    try {
        const memories = getConversationMemory();
        memories.push({
            timestamp: Date.now(),
            summary: summary
        });
        
        if (memories.length > 10) {
            memories.shift();
        }
        
        localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
    } catch (error) {
        console.error('Failed to save conversation memory:', error);
    }
}

function generateMemorySummary() {
    if (messages.length < 2) return '';
    
    const recentMessages = messages.slice(-10);
    const userMessages = recentMessages.filter(m => m.type === 'user');
    
    if (userMessages.length === 0) return '';
    
    return userMessages.map(m => m.text).join('; ');
}

function initApp() {
    document.querySelectorAll('.recharge-card').forEach(card => {
        card.addEventListener('click', selectRechargeAmount);
    });

    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.addEventListener('click', selectPaymentMethod);
    });

    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', selectProduct);
    });

    loadCharacters();
    loadChatHistory();
    updateBalanceDisplay();
}

function loadChatHistory() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.messages && Array.isArray(data.messages)) {
                messages = data.messages;
                renderMessages();
            }
            if (data.currentRole) {
                currentRole = data.currentRole;
                document.getElementById('currentRoleName').textContent = currentRole.name;
                const card = document.querySelector(`.role-card[data-role-id="${currentRole.id}"]`);
                if (card) {
                    card.classList.add('active');
                }
            }
        }
    } catch (error) {
        console.error('Failed to load chat history:', error);
    }
}

function saveChatHistory() {
    try {
        const data = {
            messages: messages,
            currentRole: currentRole
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save chat history:', error);
    }
}

function renderMessages() {
    const messagesContainer = document.getElementById('chatMessages');
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-wave"></i>
                </div>
                <h2>Welcome to girlfriend.wangdadi.xyz</h2>
                <p>Select a character to start chatting, or type a message directly</p>
            </div>
        `;
        return;
    }

    messagesContainer.innerHTML = '';
    
    messages.forEach(msg => {
        appendMessage(msg.role, msg.text, msg.type);
    });
}

function appendMessage(role, text, type) {
    const messagesContainer = document.getElementById('chatMessages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    if (type === 'user') {
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="message-content">
                <span class="message-text">${escapeHtml(text)}</span>
            </div>
        `;
    } else {
        // Use role avatar if available
        const avatarUrl = role?.visual_desc ? getAvatarUrl(role.visual_desc, role?.id) : null;
        const processedText = processImageTags(text);
        
        if (avatarUrl) {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <img src="${avatarUrl}" alt="${escapeHtml(role?.name || 'Character')}" class="message-avatar-img" onload="this.classList.add('loaded')" onerror="handleAvatarError(this, '${escapeHtml(role?.name || 'Character')}')" />
                </div>
                <div class="message-content">
                    <span class="message-text">${processedText}</span>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <span class="message-text">${processedText}</span>
                </div>
            `;
        }
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function processImageTags(text) {
    const imageTagRegex = /\[IMAGE\]\(([^)]+)\)/g;
    let imageId = 0;
    
    return text.replace(imageTagRegex, (match, url) => {
        const id = `blur-image-${Date.now()}-${imageId++}`;
        return `
            <div class="blur-image-container" id="${id}">
                <div class="blur-overlay">
                    <div class="blur-content">
                        <i class="fas fa-lock"></i>
                        <p>Premium Image</p>
                        <button class="unlock-btn" onclick="unlockImage('${id}', '${url}')">
                            <i class="fas fa-coins"></i>
                            Unlock for 1 Coin
                        </button>
                    </div>
                </div>
                <img src="${url}" class="blur-image" alt="Premium Image" />
            </div>
        `;
    });
}

async function unlockImage(containerId, imageUrl) {
    const balance = parseInt(localStorage.getItem('nicheai_balance') || '100');
    if (balance < 1) {
        showNotification('Insufficient coins. Please recharge.');
        return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    localStorage.setItem('nicheai_balance', String(balance - 1));
    updateBalanceDisplay();

    container.classList.add('unlocked');
    showNotification('Image unlocked');
}

function addLoadingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.id = 'loadingIndicator';
    loadingDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-${currentRole.icon}"></i>
        </div>
        <div class="loading-indicator">
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
            <div class="loading-dot"></div>
        </div>
    `;
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;

    if (!checkLoveValue()) {
        return;
    }

    input.value = '';
    
    appendMessage({ icon: 'user' }, message, 'user');
    messages.push({ role: { icon: 'user' }, text: message, type: 'user' });
    saveChatHistory();

    addLoadingIndicator();

    const isDrawing = message.toLowerCase().startsWith('/draw');
    const prompt = isDrawing ? message.replace('/draw', '').trim() : message;

    if (isDrawing) {
        callDrawAPI(prompt);
    } else {
        callChatAPI(message);
    }
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function callChatAPI(message) {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                characterId: currentRole.id,
                userMessage: message
            })
        });

        if (!response.ok) {
            throw new Error('API call failed');
        }

        removeLoadingIndicator();

        // Parse JSON response
        const data = await response.json();
        console.log('API Response:', data);
        let fullResponse = '';
        
        if (typeof data === 'string') {
            // If response is a string, use directly
            fullResponse = data;
        } else if (data.reply) {
            fullResponse = data.reply;
        } else if (data.content) {
            fullResponse = data.content;
        } else if (data.message) {
            fullResponse = data.message;
        } else {
            fullResponse = 'Sorry, no response received.';
        }

        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';

        const avatarUrl = getAvatarUrl(currentRole.visual_desc, currentRole.id);
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <img src="${avatarUrl}" alt="${escapeHtml(currentRole.name)}" class="message-avatar-img" onload="this.classList.add('loaded')" onerror="handleAvatarError(this, '${escapeHtml(currentRole.name)}')" />
            </div>
            <div class="message-content">
                <span class="message-text" id="streamingResponse"></span>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);

        const responseElement = document.getElementById('streamingResponse');

        // Typewriter effect: display character by character
        await typeWriterEffect(responseElement, fullResponse, messagesContainer);

        messages.push({ role: currentRole, text: fullResponse, type: 'assistant' });

        consumeLoveValue();

        saveChatHistory();

    } catch (error) {
        removeLoadingIndicator();
        appendMessage(currentRole, 'Sorry, unable to respond at this time. Please try again later.', 'assistant');
        messages.push({ role: currentRole, text: 'Sorry, unable to respond at this time. Please try again later.', type: 'assistant' });
        saveChatHistory();
        console.error('API Error:', error);
    }
}

function scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
}

async function callDrawAPI(prompt) {
    try {
        const response = await fetch('/api/draw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                model: 'fal-ai/fast-sdxl'
            })
        });

        if (!response.ok) {
            throw new Error('Draw API call failed');
        }

        const data = await response.json();
        
        removeLoadingIndicator();
        const responseText = data.image_url ? `![Image](${data.image_url})` : (data.response || 'Drawing complete');
        appendMessage(currentRole, responseText, 'assistant');
        messages.push({ role: currentRole, text: responseText, type: 'assistant' });
        
        const balance = parseInt(localStorage.getItem('nicheai_balance') || '100');
        localStorage.setItem('nicheai_balance', String(balance - 5));
        updateBalanceDisplay();
        
        saveChatHistory();
        
    } catch (error) {
        removeLoadingIndicator();
        appendMessage(currentRole, 'Sorry, unable to generate image at this time. Please try again later.', 'assistant');
        messages.push({ role: currentRole, text: 'Sorry, unable to generate image at this time. Please try again later.', type: 'assistant' });
        saveChatHistory();
        console.error('Draw API Error:', error);
    }
}

function toggleDrawMode() {
    const drawTool = document.getElementById('drawTool');
    const inputWrapper = document.querySelector('.input-wrapper');
    const isActive = drawTool.classList.toggle('active');
    
    inputWrapper.classList.toggle('drawing-mode', isActive);
    
    const input = document.getElementById('chatInput');
    input.placeholder = isActive ? 'Enter drawing description...' : 'Type a message...';
}

function clearChat() {
    messages = [];
    saveChatHistory();
    renderMessages();
}

function toggleTheme() {
    document.body.classList.toggle('light-theme');
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

function openRechargeModal() {
    document.getElementById('rechargeModal').classList.add('active');
}

function closeRechargeModal() {
    document.getElementById('rechargeModal').classList.remove('active');
}

function selectRechargeAmount(event) {
    const card = event.currentTarget;
    
    document.querySelectorAll('.recharge-card').forEach(c => {
        c.classList.remove('selected');
    });
    card.classList.add('selected');
}

function selectPaymentMethod(event) {
    const btn = event.currentTarget;
    
    document.querySelectorAll('.method-btn').forEach(b => {
        b.classList.remove('active');
    });
    btn.classList.add('active');
}

function confirmRecharge() {
    closeRechargeModal();
    openPaymentModal();
}

function openPaymentModal() {
    document.getElementById('paymentModal').classList.add('active');
    initLemonSqueezy();
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function selectProduct(event) {
    const card = event.currentTarget;
    
    document.querySelectorAll('.product-card').forEach(c => {
        c.classList.remove('selected');
    });
    card.classList.add('selected');
    
    initLemonSqueezy();
}

function initLemonSqueezy() {
    const container = document.getElementById('lemonsqueezy-button-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    const selectedCard = document.querySelector('.product-card.selected');
    const productId = selectedCard ? selectedCard.dataset.productId : '1';
    
    const productConfig = {
        '1': { priceId: 'price_123', coins: 100 },
        '2': { priceId: 'price_456', coins: 500 },
        '3': { priceId: 'price_789', coins: 1500 }
    };
    
    const config = productConfig[productId] || productConfig['1'];
    
    const script = document.createElement('script');
    script.src = 'https://assets.lemonsqueezy.com/lemon.js';
    script.async = true;
    script.onload = () => {
        LemonSqueezy.Button({
            element: '#lemonsqueezy-button-container',
            product: config.priceId,
            variant: null,
            embed: true,
            onSuccess: (order) => {
                const balance = parseInt(localStorage.getItem('nicheai_balance') || '100');
                localStorage.setItem('nicheai_balance', String(balance + config.coins));
                updateBalanceDisplay();
                showNotification(`Successfully purchased ${config.coins} coins!`);
                closePaymentModal();
            },
            onError: (error) => {
                showNotification('Payment failed. Please try again.');
                console.error('Payment error:', error);
            }
        });
    };
    
    container.appendChild(script);
}

const LOVE_KEY = 'nicheai_love_value';
const LOVE_DATE_KEY = 'nicheai_love_date';
const DAILY_LOVE_LIMIT = 20;

function getTodayDate() {
    return new Date().toDateString();
}

function getLoveValue() {
    const today = getTodayDate();
    const savedDate = localStorage.getItem(LOVE_DATE_KEY);
    
    if (savedDate !== today) {
        localStorage.setItem(LOVE_KEY, DAILY_LOVE_LIMIT);
        localStorage.setItem(LOVE_DATE_KEY, today);
        return DAILY_LOVE_LIMIT;
    }
    
    return parseInt(localStorage.getItem(LOVE_KEY) || DAILY_LOVE_LIMIT);
}

function consumeLoveValue() {
    const love = getLoveValue();
    if (love > 0) {
        localStorage.setItem(LOVE_KEY, love - 1);
        updateBalanceDisplay();
    }
}

function checkLoveValue() {
    const love = getLoveValue();
    updateBalanceDisplay();
    
    if (love <= 0) {
        openLoveValueModal();
        return false;
    }
    
    consumeLoveValue();
    return true;
}

function openLoveValueModal() {
    const modal = document.getElementById('loveValueModal');
    if (modal) {
        modal.classList.add('active');
    }
}

function closeLoveValueModal() {
    const modal = document.getElementById('loveValueModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function updateBalanceDisplay() {
    const love = getLoveValue();
    const balance = parseInt(localStorage.getItem('nicheai_balance') || '100');
    document.getElementById('balance').textContent = love;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #8b5cf6, #a78bfa);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(139, 92, 246, 0.4);
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .loading-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        color: #8b5cf6;
        gap: 8px;
    }
    
    .role-list {
        overflow-y: auto;
        max-height: calc(100vh - 300px);
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', initApp);

let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, false);

function handleSwipe() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const isMobile = window.innerWidth <= 768;
    
    if (!isMobile) return;
    
    const swipeDistance = touchStartX - touchEndX;
    
    if (swipeDistance > 50 && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }
}

function handleAvatarError(img, roleName) {
    console.error(`Failed to load avatar for ${roleName}, using fallback image...`);
    // Use picsum.photos as fallback avatar service
    const hash = roleName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    img.src = `https://picsum.photos/seed/${hash}/200/200`;
}

// Convert text in parentheses (action descriptions) to italic
function formatActionText(text) {
    // Match content in Chinese and English parentheses
    return text
        .replace(/（([^）]+)）/g, '<i>$1</i>')    // Chinese parentheses
        .replace(/\(([^)]+)\)/g, '<i>$1</i>');   // English parentheses
}

// Typewriter effect function
function typeWriterEffect(element, text, container) {
    return new Promise((resolve) => {
        let index = 0;
        const speed = 30; // Typing speed (ms)
        
        function type() {
            if (index < text.length) {
                const char = text[index];
                const remainingText = text.substring(0, index + 1);
                const formattedText = formatActionText(remainingText);
                element.innerHTML = formattedText;
                index++;
                
                // Smooth scroll to bottom
                smoothScrollToBottom(container);
                
                // Adjust speed based on character type
                let nextSpeed = speed;
                if (char === '。' || char === '！' || char === '？' || char === '\n') {
                    nextSpeed = 150; // Pause after punctuation
                } else if (char === '，' || char === '、' || char === '；') {
                    nextSpeed = 80; // Short pause after commas
                }
                
                setTimeout(type, nextSpeed);
            } else {
                resolve();
            }
        }
        
        type();
    });
}

// Smooth scroll to bottom
function smoothScrollToBottom(container) {
    const scrollHeight = container.scrollHeight;
    const currentScroll = container.scrollTop;
    const maxScroll = scrollHeight - container.clientHeight;
    
    if (currentScroll < maxScroll) {
        // Use requestAnimationFrame for smooth scrolling
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const duration = 300; // Scroll animation duration
        const startTime = performance.now();
        
        function scrollStep(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutCubic(progress);
            
            container.scrollTop = currentScroll + (maxScroll - currentScroll) * easedProgress;
            
            if (progress < 1) {
                requestAnimationFrame(scrollStep);
            }
        }
        
        requestAnimationFrame(scrollStep);
    }
}