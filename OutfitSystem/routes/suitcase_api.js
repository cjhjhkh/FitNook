const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 辅助函数：标准化 items 结构
// items 存储格式: JSON字符串 "[{cloth_id:1, checked:true}, ...]" 或简单的 "[1, 2]"
const normalizeItems = (items) => {
    let parsed = [];
    try {
        parsed = typeof items === 'string' ? JSON.parse(items || '[]') : (items || []);
    } catch (e) {
        console.error('解析 items JSON 失败:', e);
        parsed = [];
    }

    if (!Array.isArray(parsed)) return [];
    
    return parsed.map(i => {
        if (typeof i === 'number' || typeof i === 'string') {
            return { cloth_id: parseInt(i), checked: false };
        } else if (typeof i === 'object' && i !== null) {
            return { 
                cloth_id: parseInt(i.cloth_id || i.id), 
                checked: !!i.checked 
            };
        }
        return null;
    }).filter(i => i && i.cloth_id);
};

// 辅助函数：标准化 outfits 结构
// outfits 存储格式: JSON字符串 "[1, 2]" (ID数组) 或 "[{id:1}, ...]"
const normalizeOutfits = (outfits) => {
    let parsed = [];
    try {
        parsed = typeof outfits === 'string' ? JSON.parse(outfits || '[]') : (outfits || []);
    } catch (e) {
        console.error('解析 outfits JSON 失败:', e);
        parsed = [];
    }

    if (!Array.isArray(parsed)) return [];

    return parsed.map(o => {
        if (typeof o === 'number' || typeof o === 'string') {
            return { id: parseInt(o) };
        } else if (typeof o === 'object' && o !== null) {
            return { id: parseInt(o.id || o.outfit_id) };
        }
        return null;
    }).filter(o => o && o.id);
};

// 获取行李箱列表
// GET /api/suitcases/list
router.get('/list', async (req, res) => {
    try {
        const { account } = req.query;
        if (!account) return res.json({ code: 400, msg: '缺少用户信息' });

        const [users] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
        if (users.length === 0) return res.json({ code: 404, msg: '用户不存在' });
        const userId = users[0].id;

        const [rows] = await db.query(`
            SELECT id, name, destination, start_date, end_date, items, outfits, status, created_at
            FROM suitcases 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [userId]);

        const list = rows.map(row => {
            const items = normalizeItems(row.items);
            const outfits = normalizeOutfits(row.outfits);
            return {
                ...row,
                itemCount: items.length,
                outfitCount: outfits.length,
                start_date: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : '',
                end_date: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : ''
            };
        });

        res.json({ code: 200, data: list });
    } catch (err) {
        console.error('获取行李箱列表失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 获取行李箱详情
// GET /api/suitcases/detail?id=1
router.get('/detail', async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) return res.json({ code: 400, msg: '缺少参数 id' });

        const [rows] = await db.query('SELECT * FROM suitcases WHERE id = ?', [id]);
        if (rows.length === 0) return res.json({ code: 404, msg: '行李箱不存在' });

        const suitcase = rows[0];
        
        // 1. 处理 Items (单品衣物)
        let itemsList = normalizeItems(suitcase.items);
        
        if (itemsList.length > 0) {
            const clothIds = itemsList.map(i => i.cloth_id);
            // 批量查询衣物详情
            // Fixed: 移除了不存在的 category 字段
            const [clothes] = await db.query(`SELECT id, name, image_url FROM clothes WHERE id IN (?)`, [clothIds]);
            
            // 将详情合并回 itemsList
            itemsList = itemsList.map(item => {
                const detail = clothes.find(c => c.id === item.cloth_id);
                return detail ? { ...item, ...detail } : item;
            });
        }

        // 2. 处理 Outfits (搭配)
        let outfitsList = normalizeOutfits(suitcase.outfits);
        let outfitsDetail = [];

        if (outfitsList.length > 0) {
            const outfitIds = outfitsList.map(o => o.id);
            
            // 批量查询搭配基本信息
            // 修复：获取 image_url 作为封面
            const [outfits] = await db.query(`SELECT id, name, bg_color, image_url, created_at FROM outfits WHERE id IN (?)`, [outfitIds]);
            
            // 批量查询搭配对应的单品图片 (用于生成封面)
            const [outfitItems] = await db.query(`
                SELECT oi.outfit_id, oi.cloth_id, oi.image_url, c.name as cloth_name, c.image_url as cloth_image_url
                FROM outfit_items oi
                LEFT JOIN clothes c ON oi.cloth_id = c.id
                WHERE oi.outfit_id IN (?)
                ORDER BY oi.z_index ASC
            `, [outfitIds]);

            outfitsDetail = outfits.map(o => {
                // 找到该搭配下的所有单品
                const items = outfitItems.filter(i => i.outfit_id === o.id);
                
                // 提取图片链接 (优先用合成图，没有则用原图)
                const visualItems = items.map(i => ({
                    id: i.cloth_id,
                    name: i.cloth_name || '未命名单品',
                    image_url: i.image_url || i.cloth_image_url
                })).filter(i => i.image_url);

                // 优先使用搭配主图，其次使用第一件单品图
                const cover = o.image_url || (visualItems.length > 0 ? visualItems[0].image_url : null);

                return {
                    id: o.id,
                    name: o.name || `搭配 ${o.id}`,
                    cover: cover,
                    itemCount: visualItems.length,
                    items: visualItems // 返回单品列表，供前端展示和降级显示封面
                };
            });
        }

        res.json({
            code: 200,
            data: {
                ...suitcase,
                items: itemsList,
                outfits: outfitsDetail, // 返回详细对象供前端展示
                
                // 格式化日期
                start_date: suitcase.start_date ? new Date(suitcase.start_date).toISOString().split('T')[0] : '',
                end_date: suitcase.end_date ? new Date(suitcase.end_date).toISOString().split('T')[0] : ''
            }
        });

    } catch (err) {
        console.error('获取行李箱详情失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 创建行李箱
// POST /api/suitcases/create
router.post('/create', async (req, res) => {
    try {
        const { name, destination, start_date, end_date, account, description } = req.body;
        
        if (!account) return res.json({ code: 400, msg: '缺少用户信息' });
        
        const [users] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
        if (users.length === 0) return res.json({ code: 404, msg: '用户不存在' });
        const userId = users[0].id;

        const sql = `
            INSERT INTO suitcases (user_id, name, destination, start_date, end_date, description, items, outfits, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        const [result] = await db.query(sql, [
            userId,
            name || '新行程',
            destination || '',
            start_date || null,
            end_date || null,
            description || '',
            '[]', 
            '[]', 
            'planning'
        ]);

        res.json({ code: 200, data: { id: result.insertId }, msg: '创建成功' });
    } catch (err) {
        console.error('创建行李箱失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 更新行李箱
// POST /api/suitcases/update
router.post('/update', async (req, res) => {
    try {
        const { id, name, destination, start_date, end_date, description, status, items, outfits } = req.body;
        
        if (!id) return res.json({ code: 400, msg: '缺少参数 id' });

        // 构建动态 SQL
        let fields = [];
        let params = [];

        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (destination !== undefined) { fields.push('destination = ?'); params.push(destination); }
        // 注意：日期清空可能传 null 或 ''
        if (start_date !== undefined) { fields.push('start_date = ?'); params.push(start_date || null); }
        if (end_date !== undefined) { fields.push('end_date = ?'); params.push(end_date || null); }
        if (description !== undefined) { fields.push('description = ?'); params.push(description); }
        if (status !== undefined) { fields.push('status = ?'); params.push(status); }
        
        if (items !== undefined) { 
            // 确保 items 是 JSON 字符串
            const itemsStr = typeof items === 'string' ? items : JSON.stringify(items);
            fields.push('items = ?'); 
            params.push(itemsStr); 
        }
        
        if (outfits !== undefined) { 
            fields.push('outfits = ?'); 
            params.push(typeof outfits === 'string' ? outfits : JSON.stringify(outfits));
        }

        if (fields.length === 0) {
            return res.json({ code: 200, msg: '无修改' });
        }

        fields.push('updated_at = NOW()');
        
        // 追加 ID 到参数列表末尾
        params.push(id);

        const sql = `UPDATE suitcases SET ${fields.join(', ')} WHERE id = ?`;
        await db.query(sql, params);

        res.json({ code: 200, msg: '更新成功' });

    } catch (err) {
        console.error('更新行李箱失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 删除行李箱
// DELETE /api/suitcases/delete
router.post('/delete', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.json({ code: 400, msg: '缺少参数 id' });

        await db.query('DELETE FROM suitcases WHERE id = ?', [id]);
        res.json({ code: 200, msg: '删除成功' });
    } catch (err) {
        console.error('删除行李箱失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 批量删除行李箱
// POST /api/suitcases/batch-delete
router.post('/batch-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.json({ code: 400, msg: '请提供要删除的ID列表' });
        }

        await db.query('DELETE FROM suitcases WHERE id IN (?)', [ids]);
        res.json({ code: 200, msg: '批量删除成功' });
    } catch (err) {
        console.error('批量删除行李箱失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 批量添加内容 (从选择器页面回调)
// POST /api/suitcases/add-content
router.post('/add-content', async (req, res) => {
    try {
        const { id, cloth_ids, outfit_ids } = req.body;
        if (!id) return res.json({ code: 400, msg: '缺少参数 id' });

        const [rows] = await db.query('SELECT items, outfits FROM suitcases WHERE id = ?', [id]);
        if (rows.length === 0) return res.json({ code: 404, msg: '行李箱不存在' });

        let currentItems = normalizeItems(rows[0].items);
        let currentOutfits = normalizeOutfits(rows[0].outfits);
        
        // 记录现有的 cloth_id 集合，用于去重
        const existingItemIds = new Set(currentItems.map(i => i.cloth_id));

        // 1. 先处理直接勾选的衣物
        if (cloth_ids && Array.isArray(cloth_ids)) {
            cloth_ids.forEach(cid => {
                const cIdInt = parseInt(cid);
                if (!existingItemIds.has(cIdInt)) {
                    currentItems.push({ cloth_id: cIdInt, checked: false });
                    existingItemIds.add(cIdInt);
                }
            });
        }

        // 2. 处理搭配 (不仅添加搭配本身，还要把搭配里的单品自动加进去)
        if (outfit_ids && Array.isArray(outfit_ids)) {
            const existingOutfitIds = new Set(currentOutfits.map(o => o.id));
            const newOutfitIds = [];

            outfit_ids.forEach(oid => {
                const oIdInt = parseInt(oid);
                if (!existingOutfitIds.has(oIdInt)) {
                    currentOutfits.push({ id: oIdInt });
                    existingOutfitIds.add(oIdInt); // 避免重复添加搭配
                }
                // 无论搭配是否已存在，都尝试检查单品是否需要补全 (防止用户误删单品)
                newOutfitIds.push(oIdInt);
            });

            // 如果有涉及到的搭配，查询它们包含的单品
            if (newOutfitIds.length > 0) {
                const [outfitItems] = await db.query(
                    'SELECT cloth_id FROM outfit_items WHERE outfit_id IN (?)', 
                    [newOutfitIds]
                );
                
                // 将搭配里的单品合并到 items 列表
                outfitItems.forEach(row => {
                    const cId = parseInt(row.cloth_id);
                    if (!existingItemIds.has(cId)) {
                        currentItems.push({ cloth_id: cId, checked: false });
                        existingItemIds.add(cId);
                    }
                });
            }
        }

        await db.query('UPDATE suitcases SET items = ?, outfits = ?, updated_at = NOW() WHERE id = ?', [
            JSON.stringify(currentItems),
            JSON.stringify(currentOutfits),
            id
        ]);

        res.json({ code: 200, msg: '添加成功' });

    } catch (err) {
        console.error('添加内容失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 获取所有行程日期范围 (简易版，供日历使用)
// GET /api/suitcases/ranges?account=xxx
router.get('/ranges', async (req, res) => {
    try {
        const { account } = req.query;
        if (!account) return res.json({ code: 400, msg: '缺少用户信息' });

        const [users] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
        if (users.length === 0) return res.json({ code: 404, msg: '用户不存在' });
        const userId = users[0].id;

        const [rows] = await db.query(`
            SELECT id, name, destination, start_date, end_date
            FROM suitcases 
            WHERE user_id = ? AND start_date IS NOT NULL AND end_date IS NOT NULL
            ORDER BY start_date ASC
        `, [userId]);

        const ranges = rows.map(row => ({
            id: row.id,
            name: row.name,
            destination: row.destination,
            start_date: new Date(row.start_date).toISOString().split('T')[0],
            end_date: new Date(row.end_date).toISOString().split('T')[0]
        }));

        res.json({ code: 200, data: ranges });
    } catch (err) {
        console.error('获取行程范围失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

module.exports = router;