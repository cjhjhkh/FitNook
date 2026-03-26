const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { callQwen, callQwenStream } = require('../utils/ai');

// --- 辅助函数：构建 AI 上下文 ---
async function buildUserContext(userId) {
    try {
        // 1. 获取用户基础画像
        const [profiles] = await db.query('SELECT nickname, gender, style_preference, body_shape FROM user_profiles WHERE user_id = ?', [userId]);
        const profile = profiles[0] || {};

        // 2. 获取用户衣橱概览 (提取前 30 件代表性单品：常穿的 + 最近买的)
        // 限制数量以防 Prompt 过长
        const [clothes] = await db.query(`
            (SELECT id, name, category, color, season, location FROM clothes WHERE user_id = ? ORDER BY wear_count DESC LIMIT 20)
            UNION
            (SELECT id, name, category, color, season, location FROM clothes WHERE user_id = ? ORDER BY record_time DESC LIMIT 10)
        `, [userId, userId]);

        const wardrobeDesc = clothes.map(c => 
            `- ${c.name} (${c.color || '未知色'} ${c.category || '单品'}, 适合${c.season || '全'}季)`
        ).join('\n');

        return `
你现在的身份是 FitNook 智能搭配助手，你的用户是 ${profile.nickname || '朋友'}。
用户特征：${profile.gender || '未知性别'}, 偏好${profile.style_preference || '日常'}风格, 体型${profile.body_shape || '标准'}。

用户的核心衣橱清单如下（仅供参考，不必每次都列举，用户问具体搭配时再提取）：
${wardrobeDesc}

请用简短、亲切、专业的口吻回答用户关于穿搭的问题。
如果建议搭配，请优先从上述清单中选择具体的单品名称推荐。
不要输出大段的废话，直接给出建议。
        `.trim();

    } catch (err) {
        console.error('Context Build Error:', err);
        return '你是一个有用的时尚搭配助手。';
    }
}

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
 * 发送消息并获取 AI 回复 (支持流式)
 */
router.post('/send', async (req, res) => {
    const { sessionId, userId, content, msgType = 'text', linkedEntities, stream = true } = req.body; 

    // 如果没有 sessionId，先创建一个
    let currentSessionId = sessionId;
    if (!currentSessionId) {
         try {
             // 截取前20个字作为标题
             const title = content ? content.substring(0, 20) : '新对话';
             const [sessResult] = await db.query('INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)', [userId, title]);
             currentSessionId = sessResult.insertId;
         } catch (e) {
             console.error("Create session failed:", e);
             return res.status(500).json({ code: 500, msg: '创建会话失败' });
         }
    }

    try {
        // 1. 保存用户消息
        const dbMsgType = (msgType || 'text').toUpperCase(); // text -> TEXT
        const linkedJson = linkedEntities ? JSON.stringify(linkedEntities) : null;
        
        await db.query(
            'INSERT INTO chat_logs (session_id, sender_type, media_type, content, linked_entities) VALUES (?, ?, ?, ?, ?)',
            [currentSessionId, 'USER', dbMsgType, content, linkedJson]
        );

        // 2. 构建 Prompt
        const systemPrompt = await buildUserContext(userId);
        
        const [historyLogs] = await db.query(
            'SELECT sender_type, content FROM chat_logs WHERE session_id = ? ORDER BY msg_id DESC LIMIT 6', 
            [currentSessionId]
        );
        
        const messages = [
            { role: 'system', content: systemPrompt },
            ...historyLogs.reverse().map(log => ({
                role: log.sender_type === 'USER' ? 'user' : 'assistant',
                content: log.content
            })),
            { role: 'user', content: content }
        ];

        console.log(`🤖 Calling Qwen (Stream: ${stream}) with messages count:`, messages.length);

        if (stream) {
            // --- 流式处理分支 ---
            
            // 设置 SSE 响应头
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // 告诉前端 Session ID (第一帧)
            res.write(`data: ${JSON.stringify({ sessionId: currentSessionId, type: 'meta' })}\n\n`);

            const aiStream = await callQwenStream(messages);
            let fullContent = '';

            aiStream.on('data', (chunk) => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('data:')) {
                        const jsonStr = line.replace('data:', '').trim();
                        if (jsonStr === '[DONE]') continue; // Qwen 结束标识
                        
                        try {
                            const data = JSON.parse(jsonStr);
                            const delta = data.choices && data.choices[0].delta && data.choices[0].delta.content;
                            if (delta) {
                                fullContent += delta;
                                // 转发数据块
                                res.write(`data: ${JSON.stringify({ content: delta, type: 'delta' })}\n\n`);
                            }
                        } catch (e) {
                            // 忽略部分 JSON 解析错误
                        }
                    }
                }
            });

            aiStream.on('end', async () => {
                // 3. 流结束后保存 AI 消息
                if (fullContent) {
                    try {
                        await db.query(
                            'INSERT INTO chat_logs (session_id, sender_type, media_type, content) VALUES (?, ?, ?, ?)',
                            [currentSessionId, 'AI', 'TEXT', fullContent]
                        );
                        await db.query('UPDATE chat_sessions SET updated_at = NOW() WHERE session_id = ?', [currentSessionId]);
                    } catch (dbErr) {
                        console.error('Save AI Stream Log Error:', dbErr);
                    }
                }
                res.write('data: [DONE]\n\n');
                res.end();
            });

            aiStream.on('error', (err) => {
                console.error('AI Stream Error:', err);
                res.write(`data: ${JSON.stringify({ error: 'AI服务异常' })}\n\n`);
                res.end();
            });

        } else {
            // --- 非流式处理分支 (保留原有逻辑作为降级) ---
            const aiResponseContent = await callQwen(messages);
            
            await db.query(
                 'INSERT INTO chat_logs (session_id, sender_type, media_type, content) VALUES (?, ?, ?, ?)',
                 [currentSessionId, 'AI', 'TEXT', aiResponseContent]
            );

            await db.query('UPDATE chat_sessions SET updated_at = NOW() WHERE session_id = ?', [currentSessionId]);

            res.json({
                code: 200,
                data: {
                    sessionId: currentSessionId,
                    msg_type: 'text', 
                    content: aiResponseContent,
                    linked_entities: [] 
                }
            });
        }

    } catch (err) {
        console.error('Send Message Error:', err);
        // 如果 header 还没发，返回 JSON 错误
        if (!res.headersSent) {
            res.status(500).json({ code: 500, message: '系统繁忙' });
        } else {
            res.end();
        }
    }
});

/**
 * GET /logs
 * 获取某会话的详细记录
 */
router.get('/logs', async (req, res) => {
    const { sessionId } = req.query;
    try {
        const query = `
            SELECT msg_id, sender_type, media_type, content, image_url, linked_entities, created_at 
            FROM chat_logs 
            WHERE session_id = ? 
            ORDER BY created_at ASC
        `;
        const [rows] = await db.query(query, [sessionId]);
        
        // 格式化一下返回给前端
        // 修正：将 DB 大写枚举转回前端小写格式
        const formatted = rows.map(r => ({
            msg_id: r.msg_id,
            role: r.sender_type === 'USER' ? 'user' : 'assistant', // USER -> user, AI -> assistant
            type: (r.media_type || 'TEXT').toLowerCase(), // TEXT -> text
            content: r.content,
            image_url: r.image_url,
            linked_entities: r.linked_entities ? (typeof r.linked_entities === 'string' ? JSON.parse(r.linked_entities) : r.linked_entities) : [],
            created_at: r.created_at
        }));

        res.json({ code: 200, data: formatted });
    } catch (err) {
        console.error('Get Logs Error:', err);
        res.status(500).json({ code: 500, message: 'Server error' });
    }
});

module.exports = router;
