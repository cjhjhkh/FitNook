const express = require('express');
const router = express.Router();
const db = require('../config/db'); // 这是一个 mysql2 promise pool

// 1. 获取社区动态流 (Feed) - 简化版，支持分页
router.get('/feed', async (req, res) => {
    const userId = req.query.user_id || 0; // 当前查看的用户ID(可选，用于判断点赞状态)
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * pageSize;

    try {
        const [posts] = await db.query(`
            SELECT 
                p.*,
                u.nickname as user_nickname, 
                u.avatar_url as user_avatar,
                (SELECT COUNT(*) FROM social_likes WHERE post_id = p.id) as like_count,
                (SELECT COUNT(*) FROM social_comments WHERE post_id = p.id) as comment_count,
                EXISTS (SELECT 1 FROM social_likes WHERE post_id = p.id AND user_id = ?) as is_liked
            FROM social_posts p
            LEFT JOIN user_profiles u ON p.user_id = u.user_id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, pageSize, offset]);

        // 处理 image_urls 字段
        const processedPosts = posts.map(post => {
            // 确保 is_liked 是布尔值
            post.is_liked = !!post.is_liked;
            // 确保 image_urls 是数组
            if (typeof post.image_urls === 'string') {
                try {
                    post.image_urls = JSON.parse(post.image_urls);
                } catch (e) {
                    post.image_urls = [];
                }
            }
            return post;
        });

        res.json({ code: 200, data: processedPosts, msg: 'Success' });
    } catch (err) {
        console.error('获取动态失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 2. 发布动态
router.post('/publish', async (req, res) => {
    try {
        const { user_id, content, outfit_id, image_urls } = req.body;
        
        if (!user_id || (!content && (!image_urls || image_urls.length === 0))) {
             return res.status(400).json({ code: 400, msg: '参数不完整' });
        }

        const imageJson = JSON.stringify(image_urls || []);
        
        const [result] = await db.query(
            `INSERT INTO social_posts (user_id, content, image_urls, outfit_id) VALUES (?, ?, ?, ?)`,
            [user_id, content, imageJson, outfit_id || null]
        );

        res.json({ code: 200, data: { id: result.insertId }, msg: '发布成功' });
    } catch (err) {
        console.error('发布动态失败:', err);
        res.status(500).json({ code: 500, msg: '发布失败' });
    }
});

// 3. 动态详情 (包含关联搭配的名称)
router.get('/post/:id', async (req, res) => {
    const postId = req.params.id;
    const userId = req.query.user_id || 0;

    try {
        const [rows] = await db.query(`
            SELECT 
                p.*,
                u.nickname as user_nickname, 
                u.avatar_url as user_avatar,
                o.name as outfit_name,
                (SELECT COUNT(*) FROM social_likes WHERE post_id = p.id) as like_count,
                 (SELECT COUNT(*) FROM social_comments WHERE post_id = p.id) as comment_count,
                EXISTS (SELECT 1 FROM social_likes WHERE post_id = p.id AND user_id = ?) as is_liked,
                EXISTS (SELECT 1 FROM favorites WHERE item_id = p.id AND item_type = 'post' AND user_id = ?) as is_favorited
            FROM social_posts p
            LEFT JOIN user_profiles u ON p.user_id = u.user_id
            LEFT JOIN outfits o ON p.outfit_id = o.id
            WHERE p.id = ?
        `, [userId, userId, postId]);

        if (rows.length === 0) {
             return res.status(404).json({ code: 404, msg: '动态不存在' });
        }

        const post = rows[0];
        post.is_liked = !!post.is_liked;
        post.is_favorited = !!post.is_favorited; // 转换布尔值

        // 解析图片 JSON
        try {
            if (typeof post.image_urls === 'string') {
                post.image_urls = JSON.parse(post.image_urls);
            }
        } catch (e) {
            post.image_urls = [];
        }

        res.json({ code: 200, data: post, msg: 'Success' });
    } catch (err) {
        console.error('获取详情失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 4. 点赞/取消点赞
router.post('/like', async (req, res) => {
    const { user_id, post_id } = req.body;
    
    if (!user_id || !post_id) return res.status(400).json({ code: 400, msg: '参数缺失' });

    try {
        // 检查是否已经点赞
        const [existing] = await db.query(
            'SELECT id FROM social_likes WHERE user_id = ? AND post_id = ?', 
            [user_id, post_id]
        );

        if (existing.length > 0) {
            // 取消点赞
            await db.query('DELETE FROM social_likes WHERE id = ?', [existing[0].id]);
             res.json({ code: 200, data: { is_liked: false }, msg: '已取消点赞' });
        } else {
            // 点赞
            await db.query('INSERT INTO social_likes (user_id, post_id) VALUES (?, ?)', [user_id, post_id]);
             res.json({ code: 200, data: { is_liked: true }, msg: '点赞成功' });
        }
    } catch (err) {
        console.error('点赞操作失败:', err);
        res.status(500).json({ code: 500, msg: '操作失败' });
    }
});

// 5. 获取评论列表
router.get('/comments', async (req, res) => {
    const postId = req.query.post_id;
    if (!postId) return res.status(400).json({ code: 400, msg: '缺少参数' });

    try {
        const [comments] = await db.query(`
            SELECT 
                c.id, c.content, c.created_at,
                u.user_id as user_id, u.nickname as user_nickname, u.avatar_url as user_avatar
            FROM social_comments c
            LEFT JOIN user_profiles u ON c.user_id = u.user_id
            WHERE c.post_id = ?
            ORDER BY c.created_at DESC
        `, [postId]);

        res.json({ code: 200, data: comments, msg: 'Success' });
    } catch (err) {
        console.error('获取评论失败:', err);
        res.status(500).json({ code: 500, msg: '获取失败' });
    }
});

// 6. 发布评论
router.post('/comments', async (req, res) => {
    const { post_id, content, user_id, parent_id } = req.body;

    if (!user_id || !post_id || !content) {
         return res.status(400).json({ code: 400, msg: '参数不完整' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO social_comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)',
            [post_id, user_id, content, parent_id || null]
        );

        // 获取用户信息以便前端立即展示
        const [userRows] = await db.query('SELECT nickname, avatar_url as avatar FROM user_profiles WHERE user_id = ?', [user_id]);
        const user = userRows[0] || {};

        const newComment = {
            id: result.insertId,
            post_id, 
            content,
            user_id,
            user_nickname: user.nickname, 
            user_avatar: user.avatar,
            created_at: new Date()
        };

        res.json({ code: 200, data: newComment, msg: '评论成功' });

    } catch (err) {
        console.error('评论失败:', err);
        res.status(500).json({ code: 500, msg: '评论失败' });
    }
});

module.exports = router;