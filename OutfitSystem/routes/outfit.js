const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 创建穿搭
router.post('/', async (req, res) => {
    const { 
        account, 
        name, 
        bg_color, 
        description, 
        weather, 
        temperature, // 新增
        image_url, // 新增：接收合成图 URL
        scene_ids, 
        season_ids, 
        items 
    } = req.body;

    if (!account || !items || items.length === 0) {
        return res.status(400).json({ code: 400, msg: '参数不完整或画布为空' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. 获取用户ID
        const [userRows] = await connection.query('SELECT id FROM users WHERE account = ?', [account]);
        if (userRows.length === 0) {
            throw new Error('用户不存在');
        }
        const userId = userRows[0].id;

        // 2. 插入穿搭主表
        // 注意：需要在数据库 outfits 表中添加 temperature 字段
        const [outfitResult] = await connection.query(`
            INSERT INTO outfits (user_id, name, bg_color, description, weather, temperature, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, name, bg_color || '#ffffff', description || '', weather || '', temperature || '', image_url || null]);
        
        const outfitId = outfitResult.insertId;

        // 3. 插入穿搭单品表
        if (items && items.length > 0) {
            const itemValues = [];
            for (const item of items) {
                // 兼容 cloth_id 和 id 字段，并过滤无效ID
                const clothId = item.cloth_id || item.id;
                if (clothId) {
                    itemValues.push([
                        outfitId,
                        clothId,
                        item.image_url,
                        item.position_x,
                        item.position_y,
                        item.scale,
                        item.rotation,
                        item.z_index,
                        item.is_flipped ? 1 : 0,
                        item.is_locked ? 1 : 0
                    ]);
                }
            }

            if (itemValues.length > 0) {
                await connection.query(`
                    INSERT INTO outfit_items 
                    (outfit_id, cloth_id, image_url, position_x, position_y, scale, rotation, z_index, is_flipped, is_locked)
                    VALUES ?
                `, [itemValues]);
            }
        }

        // 4. 插入标签关联 (场景 & 季节)
        const tagRelations = [];
        if (scene_ids && scene_ids.length > 0) {
            scene_ids.forEach(tagId => tagRelations.push([outfitId, tagId, 'OUTFIT']));
        }
        if (season_ids && season_ids.length > 0) {
            season_ids.forEach(tagId => tagRelations.push([outfitId, tagId, 'OUTFIT']));
        }

        if (tagRelations.length > 0) {
            await connection.query(`
                INSERT INTO entity_tag_relation (entity_id, tag_id, entity_type)
                VALUES ?
            `, [tagRelations]);
        }

        await connection.commit();
        res.json({ code: 200, msg: '穿搭保存成功', data: { id: outfitId } });

    } catch (err) {
        await connection.rollback();
        console.error('保存穿搭失败:', err);
        res.status(500).json({ code: 500, msg: '保存失败', error: err.message });
    } finally {
        connection.release();
    }
});

// 获取穿搭列表
router.get('/', async (req, res) => {
    const { account, page = 1, limit = 10, scene, season } = req.query;
    const offset = (page - 1) * limit;

    try {
        // 1. 获取用户ID
        const [userRows] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
        if (userRows.length === 0) return res.status(404).json({ code: 404, msg: '用户不存在' });
        const userId = userRows[0].id;

        // 构建筛选条件
        let whereClause = 'WHERE o.user_id = ?';
        const params = [userId];

        // 筛选场景
        if (scene && scene !== 'all') {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM entity_tag_relation etr 
                JOIN tags t ON etr.tag_id = t.tag_id 
                WHERE etr.entity_id = o.id 
                AND etr.entity_type = 'OUTFIT' 
                AND t.tag_type = 'SCENE' 
                AND t.tag_name = ?
            )`;
            params.push(scene);
        }

        // 筛选季节
        if (season && season !== 'all') {
            whereClause += ` AND EXISTS (
                SELECT 1 FROM entity_tag_relation etr 
                JOIN tags t ON etr.tag_id = t.tag_id 
                WHERE etr.entity_id = o.id 
                AND etr.entity_type = 'OUTFIT' 
                AND t.tag_type = 'SEASON' 
                AND t.tag_name = ?
            )`;
            params.push(season);
        }

        // 2. 查询列表
        const querySql = `
            SELECT o.id, o.name, o.bg_color, o.weather, o.temperature, o.description, 
                   COALESCE(NULLIF(o.image_url, ''), (
                       SELECT COALESCE(NULLIF(oi.image_url, ''), c.image_url)
                       FROM outfit_items oi
                       LEFT JOIN clothes c ON oi.cloth_id = c.id
                       WHERE oi.outfit_id = o.id 
                       ORDER BY oi.z_index ASC 
                       LIMIT 1
                   )) as image_url,
                   o.created_at 
            FROM outfits o
            ${whereClause}
            ORDER BY o.created_at DESC 
            LIMIT ? OFFSET ?
        `;
        
        // 添加分页参数
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await db.query(querySql, params);

        if (rows.length > 0) {
            const outfitIds = rows.map(r => r.id);
            
            // 3. 填充 Items (每个搭配取前4张图用于预览)
            // 修复：关联 clothes 表，获取 cloth_image_url 作为回退，防止图片缺失
            const [allItems] = await db.query(`
                SELECT oi.outfit_id, oi.image_url, oi.position_x, oi.position_y, oi.scale, oi.rotation, oi.z_index, oi.is_flipped,
                       c.image_url as cloth_image_url
                FROM outfit_items oi
                LEFT JOIN clothes c ON oi.cloth_id = c.id
                WHERE oi.outfit_id IN (?)
                ORDER BY oi.z_index ASC
            `, [outfitIds]);

            // 4. 填充 Tags
            const [allTags] = await db.query(`
                SELECT etr.entity_id as outfit_id, t.tag_name, t.tag_type
                FROM entity_tag_relation etr
                JOIN tags t ON etr.tag_id = t.tag_id
                WHERE etr.entity_id IN (?) AND etr.entity_type = 'OUTFIT'
            `, [outfitIds]);

            // 5. 组装数据
            rows.forEach(row => {
                row.items = allItems
                    .filter(i => i.outfit_id === row.id)
                    .map(i => ({
                        image_url: i.image_url || i.cloth_image_url, // 优先用快照图，否则用原图
                        x: i.position_x !== null ? i.position_x : 0.5,
                        y: i.position_y !== null ? i.position_y : 0.5,
                        scale: i.scale || 1,
                        rotate: i.rotation || 0,
                        zIndex: i.z_index || 0,
                        isFlipped: i.is_flipped
                    }));
                
                const tags = allTags.filter(t => t.outfit_id === row.id);
                row.scene = tags.filter(t => t.tag_type === 'SCENE').map(t => t.tag_name).join('/');
                row.season = tags.filter(t => t.tag_type === 'SEASON').map(t => t.tag_name).join('/');
            });
        }

        // 3. 查询总数 (带筛选)
        const countSql = `SELECT COUNT(*) as total FROM outfits o ${whereClause}`;
        const countParams = params.slice(0, params.length - 2);
        
        const [countRows] = await db.query(countSql, countParams);

        res.json({
            code: 200,
            data: rows,
            total: countRows[0].total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '获取列表失败' });
    }
});

// 获取穿搭详情
router.get('/:id', async (req, res) => {
    const outfitId = req.params.id;

    try {
        // 1. 主信息
        const [outfitRows] = await db.query('SELECT * FROM outfits WHERE id = ?', [outfitId]);
        if (outfitRows.length === 0) return res.status(404).json({ code: 404, msg: '穿搭不存在' });
        const outfit = outfitRows[0];

        // 2. 单品信息
        // 修复：加入 ORDER BY z_index ASC 确保画布图层顺序正确
        const [items] = await db.query(`
            SELECT oi.*, c.name as cloth_name, c.image_url as cloth_image_url 
            FROM outfit_items oi
            LEFT JOIN clothes c ON oi.cloth_id = c.id
            WHERE oi.outfit_id = ?
            ORDER BY oi.z_index ASC
        `, [outfitId]);

        // 3. 标签信息
        const [tags] = await db.query(`
            SELECT t.tag_id, t.tag_name, t.tag_type
            FROM entity_tag_relation etr
            JOIN tags t ON etr.tag_id = t.tag_id
            WHERE etr.entity_id = ? AND etr.entity_type = 'OUTFIT'
        `, [outfitId]);

        outfit.items = items.map(item => ({
            ...item,
            // 优先使用保存时的快照链接，如果没有（或失效），回退到原衣物图片的链接
            image_url: item.image_url || item.cloth_image_url
        }));
        outfit.tags = tags;

        res.json({ code: 200, data: outfit });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '获取详情失败' });
    }
});

// 更新穿搭
router.put('/:id', async (req, res) => {
    const outfitId = req.params.id;
    const { 
        name, 
        bg_color, 
        description, 
        weather, 
        temperature, // 新增
        image_url, // 新增：接收合成图 URL
        scene_ids, 
        season_ids, 
        items 
    } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ code: 400, msg: '画布不能为空' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. 对于 Items，进行数据补全：如果前端没传 image_url，从 clothes 表查
        const clothIds = items.map(i => i.cloth_id || i.id).filter(id => id);
        let clothMap = {};
        if (clothIds.length > 0) {
            const [clothRows] = await connection.query('SELECT id, image_url FROM clothes WHERE id IN (?)', [clothIds]);
            clothRows.forEach(row => {
                clothMap[row.id] = row.image_url;
            });
        }

        // 2. 更新主表
        let updateSql = 'UPDATE outfits SET name = ?, bg_color = ?, description = ?, weather = ?, temperature = ?';
        const updateParams = [name, bg_color, description, weather, temperature || ''];

        if (image_url !== undefined) {
             updateSql += ', image_url = ?';
             updateParams.push(image_url);
        }

        updateSql += ' WHERE id = ?';
        updateParams.push(outfitId);

        await connection.query(updateSql, updateParams);

        // 3. 更新 Items (先删后插)
        await connection.query('DELETE FROM outfit_items WHERE outfit_id = ?', [outfitId]);
        
        if (items && items.length > 0) {
            const itemValues = [];
            for (const item of items) {
                const clothId = item.cloth_id || item.id;
                if (clothId) {
                    const finalImageUrl = item.image_url || clothMap[clothId] || '';

                    itemValues.push([
                        outfitId,
                        clothId,
                        finalImageUrl,
                        item.position_x,
                        item.position_y,
                        item.scale,
                        item.rotation,
                        item.z_index,
                        item.is_flipped ? 1 : 0,
                        item.is_locked ? 1 : 0
                    ]);
                }
            }

            if (itemValues.length > 0) {
                await connection.query(`
                    INSERT INTO outfit_items 
                    (outfit_id, cloth_id, image_url, position_x, position_y, scale, rotation, z_index, is_flipped, is_locked)
                    VALUES ?
                `, [itemValues]);
            }
        }

        // 4. 更新 Tags (先删后插)
        await connection.query(`DELETE FROM entity_tag_relation WHERE entity_id = ? AND entity_type = 'OUTFIT'`, [outfitId]);

        const tagRelations = [];
        if (scene_ids && scene_ids.length > 0) {
            scene_ids.forEach(tagId => tagRelations.push([outfitId, tagId, 'OUTFIT']));
        }
        if (season_ids && season_ids.length > 0) {
            season_ids.forEach(tagId => tagRelations.push([outfitId, tagId, 'OUTFIT']));
        }

        if (tagRelations.length > 0) {
            await connection.query(`
                INSERT INTO entity_tag_relation (entity_id, tag_id, entity_type)
                VALUES ?
            `, [tagRelations]);
        }

        await connection.commit();
        res.json({ code: 200, msg: '更新成功' });

    } catch (err) {
        await connection.rollback();
        console.error('更新穿搭失败:', err);
        res.status(500).json({ code: 500, msg: '更新失败', error: err.message });
    } finally {
        connection.release();
    }
});

// 删除穿搭
router.delete('/:id', async (req, res) => {
    const outfitId = req.params.id;
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. 删除关联的单品记录
        await connection.query('DELETE FROM outfit_items WHERE outfit_id = ?', [outfitId]);

        // 2. 删除关联的标签记录
        await connection.query(`DELETE FROM entity_tag_relation WHERE entity_id = ? AND entity_type = 'OUTFIT'`, [outfitId]);

        // 3. 删除日历中的记录
        await connection.query('DELETE FROM outfit_calendar WHERE outfit_id = ?', [outfitId]);

        // 4. 删除主表记录
        await connection.query('DELETE FROM outfits WHERE id = ?', [outfitId]);

        await connection.commit();
        res.json({ code: 200, msg: '删除成功' });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ code: 500, msg: '删除失败' });
    } finally {
        connection.release();
    }
});

// --- 日历相关接口 ---

// 获取日历数据
router.get('/calendar/list', async (req, res) => {
    const { account, year, month } = req.query;
    if (!account || !year || !month) {
        return res.status(400).json({ code: 400, msg: '参数不完整' });
    }

    try {
        const [userRows] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
        if (userRows.length === 0) return res.status(404).json({ code: 404, msg: '用户不存在' });
        const userId = userRows[0].id;

        // 构建日期范围
        const startDate = `${year}-${month}-01`;
        
        const [rows] = await db.query(`
            SELECT oc.id, oc.date, oc.outfit_id, o.name, o.weather, o.temperature, o.bg_color,
                   COALESCE(NULLIF(o.image_url, ''), (SELECT image_url FROM outfit_items WHERE outfit_id = o.id ORDER BY z_index ASC LIMIT 1)) as cover,
                   (SELECT GROUP_CONCAT(t.tag_name SEPARATOR '/') 
                    FROM entity_tag_relation etr 
                    JOIN tags t ON etr.tag_id = t.tag_id 
                    WHERE etr.entity_id = o.id AND etr.entity_type = 'OUTFIT' AND t.tag_type = 'SCENE') as scene
            FROM outfit_calendar oc
            JOIN outfits o ON oc.outfit_id = o.id
            WHERE oc.user_id = ? 
            AND oc.date >= ? AND oc.date <= LAST_DAY(?)
            ORDER BY oc.date ASC
        `, [userId, startDate, startDate]);

        const calendarData = {};
        rows.forEach(row => {
            const d = new Date(row.date);
            const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

            if (!calendarData[key]) {
                calendarData[key] = [];
            }
            
            calendarData[key].push({
                id: row.id,
                outfit_id: row.outfit_id,
                name: row.name,
                weather: row.weather,
                temperature: row.temperature,
                bg_color: row.bg_color,
                cover: row.cover,
                scene: row.scene
            });
        });

        res.json({ code: 200, data: calendarData });

    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '获取日历失败' });
    }
});

// 添加到日历
router.post('/calendar', async (req, res) => {
    const { account, outfit_id, date } = req.body;
    
    if (!account || !outfit_id || !date) {
        return res.status(400).json({ code: 400, msg: '参数不完整' });
    }

    try {
        const [userRows] = await db.query('SELECT id FROM users WHERE account = ?', [account]);
        if (userRows.length === 0) return res.status(404).json({ code: 404, msg: '用户不存在' });
        const userId = userRows[0].id;

        await db.query(`
            INSERT INTO outfit_calendar (user_id, outfit_id, date)
            VALUES (?, ?, ?)
        `, [userId, outfit_id, date]);

        res.json({ code: 200, msg: '添加成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '添加失败' });
    }
});

// 从日历移除
router.delete('/calendar/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await db.query('DELETE FROM outfit_calendar WHERE id = ?', [id]);
        res.json({ code: 200, msg: '移除成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '移除失败' });
    }
});

module.exports = router;