const express = require('express');
const router = express.Router();
const db = require('../config/db');

// --- 辅助函数 ---
const generateAIResponse = (userMessage, relatedItems) => {
    // 这里是模拟 AI 的核心逻辑，真实场景会调用 OpenAI/Claude API
    // 简单的关键词匹配模拟
    if (userMessage.includes('面试')) {
        return `面试的话，建议穿得正式一点。我觉得你衣橱里的那件【${relatedItems[0]?.name || '白衬衫'}】就很不错，既专业又不失亲和力。`;
    }
    if (userMessage.includes('约会')) {
        return `约会嘛，当然要浪漫一点！试试那条【${relatedItems[0]?.name || '连衣裙'}】，搭配一点亮色的配饰，绝对让他眼前一亮。`;
    }
    if (userMessage.includes('冷') || userMessage.includes('冬')) {
        return `天气冷了要注意保暖哦。我看你有一件【${relatedItems[0]?.name || '厚外套'}】，里面叠穿一件针织衫，暖和又有层次感。`;
    }
    return `这个想法很有趣！我觉得你可以尝试把【${relatedItems[0]?.name || '这件衣服'}】作为核心，再搭配一些基础款，效果会很惊喜哦。`;
};

// --- 会话管理接口 ---

/**
 * POST /session
 * 创建新会话
 */
router.post('/session', async (req, res) => {
    const { userId, title } = req.body;
    try {
        const query = 'INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)';
        const [result] = await db.query(query, [userId, title || '新对话']);
        
        res.json({
            code: 200,
            data: { sessionId: result.insertId }
        });
    } catch (err) {
        console.error('Create Session Error:', err);
        res.status(500).json({ code: 500, message: 'Server error' });
    }
});

/**
 * GET /history
 * 获取会话列表
 */
router.get('/history', async (req, res) => {
    const { userId } = req.query;
    try {
        const query = 'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC';
        const [rows] = await db.query(query, [userId]);
        res.json({ code: 200, data: rows });
    } catch (err) {
        console.error('Get History Error:', err);
        res.status(500).json({ code: 500, message: 'Server error' });
    }
});

// --- 消息交互接口 ---

/**
 * POST /send
 * 发送消息并获取 AI 回复
 */
router.post('/send', async (req, res) => {
    const { sessionId, userId, content, type = 'text', relatedItemId } = req.body;
    
    // 如果没有 sessionId，先创建一个
    let currentSessionId = sessionId;
    if (!currentSessionId) {
         const [sessUrl] = await db.query('INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)', [userId, content.substring(0, 10)]);
         currentSessionId = sessUrl.insertId;
    }

    try {
        // 1. 保存用户消息
        await db.query(
            'INSERT INTO chat_logs (session_id, sender, type, content, related_item_id) VALUES (?, ?, ?, ?, ?)',
            [currentSessionId, 'user', type, content, relatedItemId || null]
        );

        // 2. 模拟 AI 思考 (获取关联数据)
        // 简单策略：随机找一件衣服作为上下文
        const [items] = await db.query('SELECT name FROM clothes WHERE user_id = ? ORDER BY RAND() LIMIT 1', [userId]);
        
        // 3. 生成 AI 回复
        const aiContent = generateAIResponse(content, items);
        
        // 4. 保存 AI 消息
        await db.query(
             'INSERT INTO chat_logs (session_id, sender, type, content) VALUES (?, ?, ?, ?)',
             [currentSessionId, 'ai', 'text', aiContent]
        );

        // 更新会话时间
        await db.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?', [currentSessionId]);

        res.json({
            code: 200,
            data: {
                reply: aiContent,
                sessionId: currentSessionId
            }
        });

    } catch (err) {
        console.error('Send Message Error:', err);
        res.status(500).json({ code: 500, message: 'Server error' });
    }
});

/**
 * GET /logs
 * 获取某会话的详细记录
 */
router.get('/logs', async (req, res) => {
    const { sessionId } = req.query;
    try {
        const query = 'SELECT * FROM chat_logs WHERE session_id = ? ORDER BY created_at ASC';
        const [rows] = await db.query(query, [sessionId]);
        res.json({ code: 200, data: rows });
    } catch (err) {
        console.error('Get Logs Error:', err);
        res.status(500).json({ code: 500, message: 'Server error' });
    }
});

module.exports = router;
