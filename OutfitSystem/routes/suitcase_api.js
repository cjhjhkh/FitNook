const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 获取所有行李箱行程范围 (用于日历渲染)
// GET /api/suitcases/ranges
router.get('/ranges', async (req, res) => {
    try {
        const { account } = req.query; // 增加 account 过滤

        let sql = `
            SELECT id, name, destination, start_date, end_date
            FROM suitcases
            WHERE start_date IS NOT NULL AND end_date IS NOT NULL
        `;
        const params = [];

        if (account) {
            // 先通过 account 换取 user_id
            const [users] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
            if (users.length > 0) {
                sql += ` AND user_id = ?`;
                params.push(users[0].id);
            }
        }
        
        sql += ` ORDER BY start_date DESC`;

        const [rows] = await db.query(sql, params);
        
        const list = rows.map(row => {
            // 格式化日期确保前端好处理
            return {
                id: row.id,
                name: row.name,
                destination: row.destination,
                start_date: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : null,
                end_date: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : null
            };
        });

        res.json({ code: 200, data: list });
    } catch (err) {
        console.error('获取行李箱行程失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

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
            SELECT * FROM suitcases 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        `, [userId]);

        // 解析 items JSON
        const list = rows.map(row => ({
            ...row,
            items: typeof row.items === 'string' ? JSON.parse(row.items || '[]') : (row.items || []),
            // 格式化日期
            start_date: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : '',
            end_date: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : ''
        }));

        res.json({ code: 200, data: list });
    } catch (err) {
        console.error('获取行李箱列表失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 辅助函数：标准化 items 结构为 [{ cloth_id: 1, checked: false }]
const normalizeItems = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map(i => {
        if (typeof i === 'number' || typeof i === 'string') {
            return { cloth_id: parseInt(i), checked: false };
        } else if (typeof i === 'object' && i !== null) {
            // 兼容可能存在的旧字段名，如 id
            return { 
                cloth_id: parseInt(i.cloth_id || i.id), 
                checked: !!i.checked 
            };
        }
        return null;
    }).filter(i => i && i.cloth_id);
};

// 辅助函数：标准化 outfits 结构为 [{ outfit_id: 1 }]
const normalizeOutfits = (outfits) => {
    if (!Array.isArray(outfits)) return [];
    return outfits.map(o => {
        if (typeof o === 'number' || typeof o === 'string') {
            return { outfit_id: parseInt(o) };
        } else if (typeof o === 'object' && o !== null) {
            return { outfit_id: parseInt(o.outfit_id || o.id) };
        }
        return null;
    }).filter(o => o && o.outfit_id);
};

// 获取单个行李箱详情
// GET /api/suitcases/detail
router.get('/detail', async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) return res.json({ code: 400, msg: '缺少参数 ID' });

        const [rows] = await db.query('SELECT * FROM suitcases WHERE id = ?', [id]);
        if (rows.length === 0) return res.json({ code: 404, msg: '未找到该行李箱' });

        const suitcase = rows[0];
        
        // 1. 解析并标准化 JSON 数据
        let rawItems = typeof suitcase.items === 'string' ? JSON.parse(suitcase.items || '[]') : (suitcase.items || []);
        let rawOutfits = typeof suitcase.outfits === 'string' ? JSON.parse(suitcase.outfits || '[]') : (suitcase.outfits || []);
        
        suitcase.items = normalizeItems(rawItems);
        suitcase.outfits = normalizeOutfits(rawOutfits);
        
        // 日期处理
        suitcase.start_date = suitcase.start_date ? new Date(suitcase.start_date).toISOString().split('T')[0] : '';
        suitcase.end_date = suitcase.end_date ? new Date(suitcase.end_date).toISOString().split('T')[0] : '';
        
        // 2. 填充单品详情 (Items)
        if (suitcase.items.length > 0) {
            const clothIds = suitcase.items.map(i => i.cloth_id);
            if (clothIds.length > 0) {
                // 修正：查询时增加 user_id 校验或不做校验（视业务而定，目前假设都是自己的或者公开的）
                // 修正：clothes 表中没有 category 字段，移除该字段查询
                const [clothes] = await db.query(`SELECT id, image_url, name FROM clothes WHERE id IN (?)`, [clothIds]);
                
                // 将详情 merge 回 items 数组
                suitcase.items = suitcase.items.map(item => {
                    const detail = clothes.find(c => c.id === item.cloth_id);
                    // 只有当找到了详情才返回（过滤掉已被物理删除的衣物）
                    if (detail) {
                        return { ...item, ...detail }; 
                    }
                    return null;
                }).filter(i => i !== null);
            } else {
                suitcase.items = []; // 虽然有结构但没ID的情况
            }
        }

        // 3. 填充穿搭详情 (Outfits)
        if (suitcase.outfits.length > 0) {
             const outfitIds = suitcase.outfits.map(o => o.outfit_id);
             
             if (outfitIds.length > 0) {
                 const [outfitConfig] = await db.query(`
                    SELECT o.id, o.name, o.bg_color, o.image_url, 
                           (SELECT image_url FROM outfit_items WHERE outfit_id = o.id ORDER BY z_index ASC LIMIT 1) as verify_image 
                    FROM outfits o 
                    WHERE o.id IN (?)
                 `, [outfitIds]);
                 
                 // 如果查到了搭配信息
                 if (outfitConfig.length > 0) {
                     // 补充搭配里的 items 信息，用于前端展示 "x件单品"
                     const [outfitItems] = await db.query(`
                        SELECT oi.outfit_id, oi.cloth_id 
                        FROM outfit_items oi 
                        WHERE oi.outfit_id IN (?)
                     `, [outfitIds]);
                     
                     // 映射结果
                     const detailMap = new Map();
                     outfitConfig.forEach(o => {
                         o.cover = o.image_url || o.verify_image; // 图片兜底
                         o.items = []; // 初始化 items 列表
                         detailMap.set(o.id, o);
                     });
                     
                     outfitItems.forEach(oi => {
                         if (detailMap.has(oi.outfit_id)) {
                             detailMap.get(oi.outfit_id).items.push({ cloth_id: oi.cloth_id });
                         }
                     });

                     suitcase.outfits_detail = Array.from(detailMap.values());
                 } else {
                     suitcase.outfits_detail = [];
                 }
             } else {
                 suitcase.outfits_detail = [];
             }
        } else {
            suitcase.outfits_detail = [];
        }

        res.json({ code: 200, data: suitcase });
    } catch (err) {
        console.error('获取行李箱详情失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 创建行李箱
// POST /api/suitcases/create
router.post('/create', async (req, res) => {
    try {
        const { account, name, destination, start_date, end_date, description, status } = req.body;
        if (!account || !name) return res.json({ code: 400, msg: '缺少必要参数' });

        const [users] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
        if (users.length === 0) return res.json({ code: 404, msg: '用户不存在' });
        const userId = users[0].id;

        const result = await db.query(`
            INSERT INTO suitcases (user_id, name, destination, start_date, end_date, description, status, items, outfits, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            userId, 
            name, 
            destination || '', 
            start_date || null, 
            end_date || null,
            description || '',
            status || 'planning',
            JSON.stringify([]), // items
            JSON.stringify([])  // outfits
        ]);

        res.json({ code: 200, msg: '创建成功', data: { id: result[0].insertId } });
    } catch (err) {
        console.error('创建行李箱失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 更新行李箱 (包括添加物品、更新状态)
// POST /api/suitcases/update
router.post('/update', async (req, res) => {
    try {
        const { id, name, destination, start_date, end_date, items, outfits, description, status } = req.body;
        if (!id) return res.json({ code: 400, msg: '缺少参数 ID' });

        let fields = [];
        let params = [];

        if (name !== undefined) { fields.push('name = ?'); params.push(name); }
        if (destination !== undefined) { fields.push('destination = ?'); params.push(destination); }
        if (start_date !== undefined) { fields.push('start_date = ?'); params.push(start_date || null); }
        if (end_date !== undefined) { fields.push('end_date = ?'); params.push(end_date || null); }
        if (description !== undefined) { fields.push('description = ?'); params.push(description); }
        if (status !== undefined) { fields.push('status = ?'); params.push(status); }

        if (items !== undefined) { 
            // 无论是前端传来的复杂对象还是简单ID，统一normalize
            const cleanItems = normalizeItems(items);
            fields.push('items = ?'); 
            params.push(JSON.stringify(cleanItems)); 
        }

        if (outfits !== undefined) {
             const cleanOutfits = normalizeOutfits(outfits);
             fields.push('outfits = ?');
             params.push(JSON.stringify(cleanOutfits));
        }

        if (fields.length === 0) return res.json({ code: 200, msg: '无变更' });

        params.push(id);
        await db.query(`UPDATE suitcases SET ${fields.join(', ')} WHERE id = ?`, params);

        res.json({ code: 200, msg: '更新成功' });
    } catch (err) {
        console.error('更新行李箱失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 增量添加内容 (穿搭/单品)
// POST /api/suitcases/add-content
router.post('/add-content', async (req, res) => {
    try {
        const { id, outfit_ids, cloth_ids } = req.body;
        if (!id) return res.json({ code: 400, msg: '缺少参数 ID' });

        // 1. 获取并标准化当前数据
        const [rows] = await db.query('SELECT items, outfits FROM suitcases WHERE id = ?', [id]);
        if (rows.length === 0) return res.json({ code: 404, msg: '行李箱不存在' });

        let currentItems = normalizeItems(typeof rows[0].items === 'string' ? JSON.parse(rows[0].items || '[]') : (rows[0].items || []));
        let currentOutfits = normalizeOutfits(typeof rows[0].outfits === 'string' ? JSON.parse(rows[0].outfits || '[]') : (rows[0].outfits || []));

        // 2. 处理穿搭增量
        // outfit_ids 应该是新选择的 ID 列表 [1, 2, 3]
        let itemsFromOutfits = [];
        const newOutfitIds = (outfit_ids || []).map(oid => parseInt(oid)).filter(Boolean);
        
        if (newOutfitIds.length > 0) {
            // 已存在的 ID 集合
            const existingOutfitIds = new Set(currentOutfits.map(o => o.outfit_id));
            
            newOutfitIds.forEach(oid => {
                if (!existingOutfitIds.has(oid)) {
                    currentOutfits.push({ outfit_id: oid }); // 添加新穿搭
                    existingOutfitIds.add(oid);
                }
            });

            // 查询新穿搭包含的所有衣物ID，准备自动加入到物品清单
            const [outfitItems] = await db.query(`
                SELECT cloth_id FROM outfit_items WHERE outfit_id IN (?)
            `, [newOutfitIds]);
            
            itemsFromOutfits = outfitItems.map(i => i.cloth_id);
        }

        // 3. 处理单品增量 (合并 显式勾选的单品 + 穿搭附带的单品)
        const explicitClothIds = (cloth_ids || []).map(cid => parseInt(cid)).filter(Boolean);
        const allNewClothIds = [...explicitClothIds, ...itemsFromOutfits];
        
        if (allNewClothIds.length > 0) {
            const existingClothIds = new Set(currentItems.map(i => i.cloth_id));
            
            allNewClothIds.forEach(cid => {
                if (!existingClothIds.has(cid)) {
                    currentItems.push({
                        cloth_id: cid,
                        checked: false // 默认为未打包
                    });
                    existingClothIds.add(cid);
                }
            });
        }

        // 4. 保存数据库
        await db.query(`
            UPDATE suitcases 
            SET items = ?, outfits = ? 
            WHERE id = ?
        `, [JSON.stringify(currentItems), JSON.stringify(currentOutfits), id]);

        res.json({ code: 200, msg: '添加成功' });

    } catch (err) {
        console.error('添加行李箱内容失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

// 删除行李箱
// POST /api/suitcases/delete
router.post('/delete', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.json({ code: 400, msg: '缺少参数 ID' });

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
            return res.json({ code: 400, msg: '请选择要删除的项目' });
        }

        // 确保 ids 都是数字
        const safeIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));

        if (safeIds.length === 0) {
            return res.json({ code: 400, msg: '无效的ID' });
        }

        await db.query('DELETE FROM suitcases WHERE id IN (?)', [safeIds]);
        res.json({ code: 200, msg: '批量删除成功' });
    } catch (err) {
        console.error('批量删除行李箱失败:', err);
        res.status(500).json({ code: 500, msg: '服务器错误' });
    }
});

module.exports = router;