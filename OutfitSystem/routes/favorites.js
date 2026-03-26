const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 添加收藏
router.post('/add', async (req, res) => {
    try {
        const { user_id, item_type, item_id } = req.body;
        
        if (!user_id || !item_type || !item_id) {
            return res.status(400).json({ code: 400, msg: '缺少必要参数' });
        }

        const query = `
            INSERT INTO favorites (user_id, item_type, item_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP
        `;
        
        await db.query(query, [user_id, item_type, item_id]);
        
        res.json({ code: 200, msg: '收藏成功' });
    } catch (error) {
        console.error('收藏失败:', error);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 取消收藏
router.post('/remove', async (req, res) => {
    try {
        const { user_id, item_type, item_id } = req.body;

        if (!user_id || !item_type || !item_id) {
            return res.status(400).json({ code: 400, msg: '缺少必要参数' });
        }

        const query = 'DELETE FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?';
        await db.query(query, [user_id, item_type, item_id]);

        res.json({ code: 200, msg: '已取消收藏' });
    } catch (error) {
        console.error('取消收藏失败:', error);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 检查是否已收藏
router.get('/check', async (req, res) => {
    try {
        const { user_id, item_type, item_id } = req.query;

        if (!user_id || !item_type || !item_id) {
            return res.status(400).json({ code: 400, msg: '缺少必要参数' });
        }

        const query = 'SELECT COUNT(*) as count FROM favorites WHERE user_id = ? AND item_type = ? AND item_id = ?';
        const [rows] = await db.query(query, [user_id, item_type, item_id]);

        res.json({ 
            code: 200, 
            data: { is_favorite: rows[0].count > 0 } 
        });
    } catch (error) {
        console.error('检查收藏状态失败:', error);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 获取收藏列表
router.get('/list', async (req, res) => {
    try {
        const { user_id, type } = req.query; // type: outfit, clothing, post
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        if (!user_id) {
            return res.status(400).json({ code: 400, msg: '缺少用户ID' });
        }

        let querySql = '';
        let countQuery = '';
        const params = [user_id, limit, offset];
        const countParams = [user_id];

        // 根据不同类型关联不同表
        if (type === 'outfit') {
            querySql = `
                SELECT 
                    f.item_id, 
                    f.created_at, 
                    o.id, 
                    o.name, 
                    o.description,
                    o.source,
                    COALESCE(NULLIF(o.image_url, ''), (
                       SELECT COALESCE(NULLIF(oi.image_url, ''), c.image_url)
                       FROM outfit_items oi
                       LEFT JOIN clothes c ON oi.cloth_id = c.id
                       WHERE oi.outfit_id = o.id 
                       ORDER BY oi.z_index ASC 
                       LIMIT 1
                    )) as image_url
                FROM favorites f
                JOIN outfits o ON f.item_id = o.id
                WHERE f.user_id = ? AND f.item_type = 'outfit'
                ORDER BY f.created_at DESC
                LIMIT ? OFFSET ?
            `;
            countQuery = "SELECT COUNT(*) as total FROM favorites f JOIN outfits o ON f.item_id = o.id WHERE f.user_id = ? AND f.item_type = 'outfit'";

        } else if (type === 'clothing') {
             querySql = `
                SELECT 
                    f.item_id,
                    f.created_at, 
                    c.name,
                    c.image_url
                FROM favorites f
                JOIN clothes c ON f.item_id = c.id
                WHERE f.user_id = ? AND f.item_type = 'clothing'
                ORDER BY f.created_at DESC
                LIMIT ? OFFSET ?
            `;
            countQuery = "SELECT COUNT(*) as total FROM favorites f JOIN clothes c ON f.item_id = c.id WHERE f.user_id = ? AND f.item_type = 'clothing'";

        } else if (type === 'post') {
             querySql = `
                SELECT 
                    f.item_id,
                    f.created_at, 
                    p.id,
                    p.title,
                    p.content,
                    p.image_urls,
                    u.nickname as author_name, 
                    u.avatar_url as author_avatar
                FROM favorites f
                JOIN social_posts p ON f.item_id = p.id
                LEFT JOIN user_profiles u ON p.user_id = u.user_id
                WHERE f.user_id = ? AND f.item_type = 'post'
                ORDER BY f.created_at DESC
                LIMIT ? OFFSET ?
            `;
            countQuery = "SELECT COUNT(*) as total FROM favorites f JOIN social_posts p ON f.item_id = p.id WHERE f.user_id = ? AND f.item_type = 'post'";

        } else {
             return res.json({ code: 200, data: { list: [], total: 0 } });
        }

        const [items] = await db.query(querySql, params);
        const [countResult] = await db.query(countQuery, countParams);

        // 数据后处理
        const formattedItems = items.map(item => {
             // 主要是处理 Post 的图片，其他类型的 SQL 已经处理好了 image_url
             if (type === 'post' && !item.image_url && item.image_urls) {
                  try {
                    let urls = JSON.parse(item.image_urls);
                    if (Array.isArray(urls) && urls.length > 0) {
                        item.image_url = urls[0];
                    } else if (typeof urls === 'string') {
                        item.image_url = urls;
                    }
                  } catch(e) { 
                      // 可能是逗号分隔的字符串，或者就是纯字符串
                      if (item.image_urls.includes(',')) {
                          item.image_url = item.image_urls.split(',')[0];
                      } else {
                          item.image_url = item.image_urls; 
                      }
                  }
             }
             return item;
         });

        res.json({
            code: 200,
            data: {
                list: formattedItems,
                total: countResult[0].total,
                page,
                limit
            }
        });

    } catch (error) {
        console.error('获取收藏列表失败:', error);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

module.exports = router;
