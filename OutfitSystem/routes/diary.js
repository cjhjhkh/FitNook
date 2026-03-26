const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 获取指定月份的日记概览 (用于日历视图)
// GET /api/diary/month?account=xxx&year=2023&month=10
router.get('/month', async (req, res) => {
    try {
        const { account, year, month } = req.query;
        if (!account || !year || !month) {
            return res.status(400).json({ code: 400, msg: '参数不完整' });
        }

        // 获取用户ID
        const [userRows] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
        if (userRows.length === 0) return res.status(404).json({ code: 404, msg: '用户不存在' });
        const userId = userRows[0].id;

        // 构造日期范围
        const monthPrefix = `${year}-${month.toString().padStart(2, '0')}`;

        const [rows] = await db.query(`
            SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') as log_date_str, content, image_list 
            FROM diaries 
            WHERE user_id = ? AND DATE_FORMAT(log_date, '%Y-%m') = ?
            ORDER BY log_date ASC
        `, [userId, monthPrefix]);

        // 处理 image_list，只返回第一张作为封面
        const result = rows.map(row => {
            let cover = '';
            try {
                // MySQL JSON 类型会被驱动自动解析，如果是字符串则手动解析
                const images = (typeof row.image_list === 'string') ? JSON.parse(row.image_list) : row.image_list;
                if (Array.isArray(images) && images.length > 0) {
                    cover = images[0];
                }
            } catch (e) {
                console.error('JSON parse error', e);
            }
            // 格式化日期：直接使用数据库返回的字符串，避免时区偏移
            const dateStr = row.log_date_str;

            return {
                id: row.id,
                date: dateStr,
                cover: cover,
                content: row.content || '', // 增加能够返回内容摘要
                hasContent: !!row.content
            };
        });

        res.json({ code: 200, data: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 获取日记列表 (分页)
// GET /api/diary/list?account=xxx&page=1&pageSize=10
router.get('/list', async (req, res) => {
    try {
        const { account, page = 1, pageSize = 10 } = req.query;
        if (!account) return res.status(400).json({ code: 400, msg: '用户未登录' });

        const offset = (page - 1) * pageSize;

        // 获取用户ID
        const [userRows] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
        if (userRows.length === 0) return res.status(404).json({ code: 404, msg: '用户不存在' });
        const userId = userRows[0].id;

        const [rows] = await db.query(`
            SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') as log_date_str, content, image_list, created_at
            FROM diaries
            WHERE user_id = ?
            ORDER BY log_date DESC, created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, parseInt(pageSize), parseInt(offset)]);

        const list = rows.map(row => {
             let images = [];
            try {
                images = (typeof row.image_list === 'string') ? JSON.parse(row.image_list) : row.image_list;
            } catch (e) {}
            
            return {
                id: row.id,
                date: row.log_date_str,
                content: row.content,
                images: images
            };
        });

        res.json({ code: 200, data: list });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 获取日记详情
// GET /api/diary/detail/:id
router.get('/detail/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(`
            SELECT d.id, d.user_id, DATE_FORMAT(d.log_date, '%Y-%m-%d') as log_date_str, 
                   d.content, d.image_list, d.linked_items, d.suitcase_id, d.created_at, d.updated_at 
            FROM diaries d 
            WHERE d.id = ?
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ code: 404, msg: '日记不存在' });
        }
        
        const row = rows[0];
        let images = [];
        try {
            images = (typeof row.image_list === 'string') ? JSON.parse(row.image_list) : row.image_list;
        } catch (e) {}

        let linkedItems = [];
        try {
            // 兼容: 可能是 JSON 字符串，也可能是对象（如果驱动处理了）
            linkedItems = (typeof row.linked_items === 'string') ? JSON.parse(row.linked_items) : (row.linked_items || []);
        } catch (e) {
            linkedItems = [];
        }

        // 如果有关联行程，查询行程名称
        let suitcaseName = null;
        if (row.suitcase_id) {
            const [suitcaseRows] = await db.query('SELECT name FROM suitcases WHERE id = ?', [row.suitcase_id]);
            if (suitcaseRows.length > 0) {
                suitcaseName = suitcaseRows[0].name;
            }
        }

        // 解析并填充关联物品详情
        let enrichedItems = []; // 最终返回给前端的详细列表
        
        if (Array.isArray(linkedItems) && linkedItems.length > 0) {
            // 提取 outfit IDs (支持 {type:'outfit', id:1} 或直接 1)
            const outfitIds = linkedItems
                .map(i => (i && typeof i === 'object' && i.type === 'outfit') ? i.id : null)
                .filter(id => id);

            if (outfitIds.length > 0) {
                // 修复：确保 IN 查询不为空数组，虽然上面已经 filter 保证了长度 > 0
                const [outfits] = await db.query(`SELECT id, name, image_url, bg_color FROM outfits WHERE id IN (?)`, [outfitIds]);
                
                // 将详情映射回 linkedItems 顺序
                enrichedItems = linkedItems.map(item => {
                    if (item && item.type === 'outfit') {
                        const detail = outfits.find(o => o.id == item.id);
                        if (detail) {
                            return {
                                type: 'outfit',
                                id: detail.id,
                                name: detail.name || '未命名搭配',
                                image: detail.image_url, 
                                bg_color: detail.bg_color
                            };
                        }
                    }
                    return item; 
                });
            } else {
                enrichedItems = linkedItems;
            }
        }

        const data = {
            id: row.id,
            log_date: row.log_date_str,
            content: row.content,
            images: images,
            linked_items: enrichedItems,
            suitcase_id: row.suitcase_id,
            suitcase_name: suitcaseName
        };

        res.json({ code: 200, data });
    } catch (err) {
        console.error('获取日记详情失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 创建日记
// POST /api/diary/create
router.post('/create', async (req, res) => {
    try {
        const { user_id, account, date, content, images, linked_items, suitcase_id } = req.body;
        
        // 解析 images 和 linked_items，确保是 JSON 字符串，防止二次 stringify 导致转义问题
        // 前端传来的 images 应该是数组
        const imageListJson = JSON.stringify(images || []);
        const linkedItemsJson = JSON.stringify(linked_items || []);

        let finalUserId = user_id;

        // 如果传了 account，优先查 user_id
        if (account) {
            const [users] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
            if (users.length > 0) {
                finalUserId = users[0].id;
            } else {
                 return res.json({ code: 404, msg: '用户不存在' });
            }
        }

        if (!finalUserId || !date) {
            return res.json({ code: 400, msg: '缺少必要参数' });
        }
        
        // 检查当日是否已存在日记
        const [existing] = await db.query(
            'SELECT id FROM diaries WHERE user_id = ? AND log_date = ?',
            [finalUserId, date]
        );
        
        if (existing.length > 0) {
            return res.json({ code: 409, msg: '该日期已存在日记，请使用更新接口' });
        }
        
        const [result] = await db.query(
            'INSERT INTO diaries (user_id, log_date, content, image_list, linked_items, suitcase_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
            [finalUserId, date, content || '', imageListJson, linkedItemsJson, suitcase_id || null]
        );
        
        res.json({ code: 200, msg: '创建成功', data: { id: result.insertId } });
    } catch (err) {
        console.error('创建日记失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 更新日记
// POST /api/diary/update/:id
router.post('/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { date, content, images, linked_items, suitcase_id } = req.body;
        
        console.log(`[Diary] Update request for ID: ${id}`, req.body);

        let fields = [];
        let values = [];
        
        if (date !== undefined) { fields.push('log_date = ?'); values.push(date); }
        if (content !== undefined) { fields.push('content = ?'); values.push(content); }
        if (images !== undefined) { fields.push('image_list = ?'); values.push(JSON.stringify(images)); }
        if (linked_items !== undefined) { fields.push('linked_items = ?'); values.push(JSON.stringify(linked_items || [])); }
        // 允许清空 suitcase_id
        if (suitcase_id !== undefined) { fields.push('suitcase_id = ?'); values.push(suitcase_id || null); }

        if (fields.length === 0) {
            return res.json({ code: 200, msg: '无内容需要更新' });
        }

        fields.push('updated_at = NOW()');
        
        const sql = `UPDATE diaries SET ${fields.join(', ')} WHERE id = ?`;
        values.push(id);
        
        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ code: 404, msg: '日记不存在或未作修改' });
        }
        
        console.log(`[Diary] Update success for ID: ${id}`);
        res.json({ code: 200, msg: '更新成功' });

    } catch (err) {
        console.error('更新日记失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 删除日记
// DELETE /api/diary/delete/:id
router.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[Diary] Delete request for ID: ${id}`);

        const [result] = await db.query('DELETE FROM diaries WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
             console.warn(`[Diary] Delete failed - ID not found: ${id}`);
             return res.status(404).json({ code: 404, msg: '日记不存在或已删除' });
        }

        console.log(`[Diary] Delete success for ID: ${id}`);
        res.json({ code: 200, msg: '删除成功' });
    } catch (err) {
        console.error('[Diary] Delete error:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

module.exports = router;
