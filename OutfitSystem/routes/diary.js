const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 获取指定月份的日记概览 (用于日历视图)
// GET /api/diary/month?year=2023&month=10
router.get('/month', async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year || !month) {
            return res.status(400).json({ code: 400, msg: '缺少年份或月份参数' });
        }

        // 构造日期范围
        const startDate = `${year}-${month}-01`;
        // 计算下个月的第一天，然后减一天，或者直接用 LIKE 'YYYY-MM%'
        // 这里为了简单，直接查询 log_date 字符串匹配
        const monthPrefix = `${year}-${month.toString().padStart(2, '0')}`;

        const [rows] = await db.query(`
            SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') as log_date_str, content, image_list 
            FROM diaries 
            WHERE DATE_FORMAT(log_date, '%Y-%m') = ?
            ORDER BY log_date ASC
        `, [monthPrefix]);

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
// GET /api/diary/list?page=1&pageSize=10
router.get('/list', async (req, res) => {
    try {
        const { page = 1, pageSize = 10 } = req.query;
        const offset = (page - 1) * pageSize;

        const [rows] = await db.query(`
            SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') as log_date_str, content, image_list, created_at
            FROM diaries
            ORDER BY log_date DESC, created_at DESC
            LIMIT ? OFFSET ?
        `, [parseInt(pageSize), parseInt(offset)]);

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
            SELECT id, user_id, DATE_FORMAT(log_date, '%Y-%m-%d') as log_date_str, content, image_list, linked_items, created_at, updated_at 
            FROM diaries WHERE id = ?
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ code: 404, msg: '日记不存在' });
        }
        
        const row = rows[0];
        let images = [];
        try {
            images = (typeof row.image_list === 'string') ? JSON.parse(row.image_list) : row.image_list;
        } catch (e) {}

        const data = {
            id: row.id,
            log_date: row.log_date_str,
            content: row.content,
            image_list: images,
            linked_items: row.linked_items // 预留字段
        };

        res.json({ code: 200, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 创建日记
// POST /api/diary/create
router.post('/create', async (req, res) => {
    try {
        const { user_id, date, content, images, linked_items } = req.body;
        
        // 简单校验
        if (!date) {
            return res.status(400).json({ code: 400, msg: '日期不能为空' });
        }

        const imagesJson = JSON.stringify(images || []);
        const linkedItemsJson = JSON.stringify(linked_items || []); // 预留关联穿搭ID

        const [result] = await db.query(`
            INSERT INTO diaries (user_id, log_date, content, image_list, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [user_id || 0, date, content || '', imagesJson]);
        
        res.json({ code: 200, msg: '创建成功', data: { id: result.insertId } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 更新日记
// PUT /api/diary/update/:id
router.put('/update/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { date, content, images } = req.body;

        // 检查日记是否存在
        const [check] = await db.query('SELECT id FROM diaries WHERE id = ?', [id]);
        if (check.length === 0) {
            return res.status(404).json({ code: 404, msg: '日记不存在' });
        }

        const updates = [];
        const values = [];

        if (date) {
            updates.push('log_date = ?');
            values.push(date);
        }
        if (content !== undefined) {
             updates.push('content = ?');
             values.push(content);
        }
        if (images) {
            updates.push('image_list = ?');
            values.push(JSON.stringify(images));
        }

        if (updates.length > 0) {
            values.push(id);
            await db.query(`UPDATE diaries SET ${updates.join(', ')} WHERE id = ?`, values);
        }
        
        res.json({ code: 200, msg: '更新成功' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 删除日记
// DELETE /api/diary/delete/:id
router.delete('/delete/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query('DELETE FROM diaries WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
             return res.status(404).json({ code: 404, msg: '日记不存在或已删除' });
        }

        res.json({ code: 200, msg: '删除成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

module.exports = router;
