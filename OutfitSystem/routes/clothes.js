const express = require('express');
const router = express.Router();
const db = require('../config/db');
const minioClient = require('../config/minio');
const multer = require('multer');
const axios = require('axios');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// helper: 给 minio 上传加超时保护
const putObjectWithTimeout = (bucket, objectName, buffer, ms = 60000) => {
    console.log(`[MinIO] 开始上传: ${objectName}, 大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    return Promise.race([
        minioClient.putObject(bucket, objectName, buffer).then((res) => {
            console.log(`[MinIO] 上传完成: ${objectName}`);
            return res;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`MinIO 上传超时 (${ms / 1000}s)`)), ms))
    ]);
};

/**
 * [衣物录入] 
 * 适配新表结构：
 * 1. clothes 表字段变化: notes -> remarks
 * 2. 标签存储变化: 所有标签(分类/场景/季节)均存入 entity_tag_relation
 */
router.post('/add', upload.single('image'), async (req, res) => {
    console.log('[clothes.add] body=', req.body);
    
    // 直接接收 remarks，不再兼容 notes
    // 增加接收 name 字段
    let { account, name, category_id, category_ids, price, scene_ids, season_ids, remarks, image_url } = req.body;

    let fileBuffer = null;
    try {
        if (req.file && req.file.buffer) {
            fileBuffer = req.file.buffer;
        } else if (image_url) {
            console.log('[clothes.add] 通过 image_url 下载图片:', image_url);
            try {
                const resp = await axios.get(image_url, { responseType: 'arraybuffer', timeout: 15000 });
                fileBuffer = Buffer.from(resp.data);
            } catch (err) {
                console.error('[clothes.add] 下载远程图片失败:', err.message);
                return res.status(400).json({ msg: '无法下载远程图片', error: err.message });
            }
        }

        if (!fileBuffer || !account) return res.status(400).json({ msg: '参数不完整' });

        const bucketName = 'wardrobe';
        const objectName = `${account}/${Date.now()}-${(req.file && req.file.originalname) || 'remote.jpg'}`;

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. 上传图片到 MinIO
            await putObjectWithTimeout(bucketName, objectName, fileBuffer, 60000);
            const publicUrl = minioClient.getPublicUrl(bucketName, objectName);

            // 2. 获取用户 ID
            const [userRows] = await connection.query('SELECT id FROM users WHERE account = ?', [account]);
            if (userRows.length === 0) throw new Error('用户不存在');
            const userId = userRows[0].id;

            // 3. 插入主表 clothes (注意字段名变化)
            // 修正：name 字段为 NOT NULL，优先使用前端传入的 name，否则使用默认值
            const [result] = await connection.query(
                `INSERT INTO clothes (user_id, name, image_url, price, remarks) VALUES (?, ?, ?, ?, ?)`,
                [userId, name || '未命名单品', publicUrl, price || 0, remarks || '']
            );
            const newClothesId = result.insertId;

            // 4. 统一处理标签关联 (Category, Scene, Season)
            const tagRelations = [];
            
            // 4.1 分类标签
            // 兼容 category_id 和 category_ids
            const catIds = [];
            if (category_ids) {
                 if (Array.isArray(category_ids)) catIds.push(...category_ids);
                 else catIds.push(...String(category_ids).split(','));
            }
            if (category_id) catIds.push(category_id);
            
            // 去重并添加
            [...new Set(catIds)].forEach(cid => {
                if (cid && String(cid).trim()) tagRelations.push([newClothesId, cid, 'ITEM']);
            });

            // 4.2 场景标签
            if (scene_ids && scene_ids !== '' && scene_ids !== '-') {
                const sIds = Array.isArray(scene_ids) ? scene_ids : scene_ids.split(',');
                sIds.forEach(id => {
                    if (id && id.trim()) tagRelations.push([newClothesId, id.trim(), 'ITEM']);
                });
            }

            // 4.3 季节标签
            if (season_ids && season_ids !== '' && season_ids !== '-') {
                const seaIds = Array.isArray(season_ids) ? season_ids : season_ids.split(',');
                seaIds.forEach(id => {
                    if (id && id.trim()) tagRelations.push([newClothesId, id.trim(), 'ITEM']);
                });
            }

            // 批量插入标签关联
            if (tagRelations.length > 0) {
                await connection.query(
                    'INSERT INTO entity_tag_relation (entity_id, tag_id, entity_type) VALUES ?', 
                    [tagRelations]
                );
            }

            await connection.commit();
            console.log('Add clothes completed, id=', newClothesId);
            res.json({ code: 200, msg: '衣物录入成功', id: newClothesId, url: publicUrl });
        } catch (error) {
            await connection.rollback();
            console.error('[clothes.add] 事务失败:', error);
            return res.status(500).json({ code: 500, msg: '录入失败', error: error.message });
        } finally {
            if (connection) connection.release();
        }
    } catch (err) {
        console.error('[clothes.add] 未捕获异常:', err);
        return res.status(500).json({ code: 500, msg: '服务器内部错误', error: err.message });
    }
});

/**
 * [获取列表及复杂筛选]
 * 适配新表结构：通过 entity_tag_relation 和 tags 表进行筛选和数据聚合
 */
router.get('/list', async (req, res) => {
    const { account, category_id, scene_id, season_id } = req.query;

    try {
        // 1. 第一步：筛选出符合条件的衣物 ID
        let filterSql = `
            SELECT DISTINCT c.id 
            FROM clothes c
            INNER JOIN users u ON c.user_id = u.id
            LEFT JOIN entity_tag_relation etr ON c.id = etr.entity_id AND etr.entity_type = 'ITEM'
            WHERE u.account = ?
        `;
        const filterParams = [account];

        if (category_id) {
            const cats = category_id.split(',');
            filterSql += ` AND EXISTS (
                SELECT 1 FROM entity_tag_relation t1 
                WHERE t1.entity_id = c.id AND t1.entity_type = 'ITEM' AND t1.tag_id IN (?)
            )`;
            filterParams.push(cats);
        }
        if (scene_id) {
            const scenes = scene_id.split(',');
            filterSql += ` AND EXISTS (
                SELECT 1 FROM entity_tag_relation t2 
                WHERE t2.entity_id = c.id AND t2.entity_type = 'ITEM' AND t2.tag_id IN (?)
            )`;
            filterParams.push(scenes);
        }
        if (season_id) {
            const seasons = season_id.split(',');
            filterSql += ` AND EXISTS (
                SELECT 1 FROM entity_tag_relation t3 
                WHERE t3.entity_id = c.id AND t3.entity_type = 'ITEM' AND t3.tag_id IN (?)
            )`;
            filterParams.push(seasons);
        }

        const [idRows] = await db.query(filterSql, filterParams);
        
        if (idRows.length === 0) {
            return res.json({ code: 200, data: [] });
        }

        const ids = idRows.map(row => row.id);

        // 2. 第二步：根据 ID 获取完整信息
        // 去除别名，直接返回数据库字段 remarks
        let mainSql = `
            SELECT 
                c.id, c.image_url, c.price, c.remarks, c.record_time as created_at,
                t.tag_id, t.tag_name, t.tag_type
            FROM clothes c
            LEFT JOIN entity_tag_relation etr ON c.id = etr.entity_id AND etr.entity_type = 'ITEM'
            LEFT JOIN tags t ON etr.tag_id = t.tag_id
            WHERE c.id IN (?)
            ORDER BY c.id DESC
        `;

        const [rows] = await db.query(mainSql, [ids]);
        
        // 3. 数据格式化：将扁平的行数据聚合成对象
        const clothesMap = new Map();
        
        rows.forEach(row => {
            if (!clothesMap.has(row.id)) {
                clothesMap.set(row.id, {
                    id: row.id,
                    image_url: row.image_url,
                    price: row.price,
                    remarks: row.remarks, // 返回 remarks
                    created_at: row.created_at,
                    category_names: [], // 改为数组
                    scene_names: [],
                    season_names: []
                });
            }
            
            const item = clothesMap.get(row.id);
            if (row.tag_type === 'CATEGORY') {
                item.category_names.push(row.tag_name);
            } else if (row.tag_type === 'SCENE') {
                item.scene_names.push(row.tag_name);
            } else if (row.tag_type === 'SEASON') {
                item.season_names.push(row.tag_name);
            }
        });

        res.json({ code: 200, data: Array.from(clothesMap.values()) });
    } catch (err) {
        console.error('查询失败:', err);
        res.status(500).json({ code: 500, msg: '获取列表失败' });
    }
});

/**
 * [获取衣物详情]
 * 适配新表结构
 */
router.get('/detail/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. 获取基础信息
        const [clothes] = await db.query(`SELECT * FROM clothes WHERE id = ?`, [id]);
        if (clothes.length === 0) return res.status(404).json({ msg: '衣物未找到' });

        const item = clothes[0];
        // 不再兼容 notes，前端直接使用 remarks

        // 2. 获取所有关联标签
        const [tags] = await db.query(`
            SELECT t.tag_id as id, t.tag_name as name, t.tag_type 
            FROM tags t
            JOIN entity_tag_relation etr ON t.tag_id = etr.tag_id
            WHERE etr.entity_id = ? AND etr.entity_type = 'ITEM'
        `, [id]);

        const result = {
            ...item,
            category_ids: [],
            category_names: [],
            scenes: [],
            seasons: []
        };

        tags.forEach(t => {
            if (t.tag_type === 'CATEGORY') {
                result.category_ids.push(t.id);
                result.category_names.push(t.name);
            } else if (t.tag_type === 'SCENE') {
                result.scenes.push(t);
            } else if (t.tag_type === 'SEASON') {
                result.seasons.push(t);
            }
        });

        res.json({ code: 200, data: result });
    } catch (err) {
        res.status(500).json({ code: 500, msg: '获取详情失败' });
    }
});

/**
 * [更新衣物信息]
 * 适配新表结构：更新 clothes 表 + 重置 entity_tag_relation
 */
router.put('/update/:id', async (req, res) => {
    const { id } = req.params;
    // 接收 remarks, 增加 name
    const { name, category_id, price, scene_ids, season_ids, remarks } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. 更新基础表 (支持更新名称)
        // 构建动态更新语句，避免覆盖未传递的字段
        const updates = [];
        const params = [];
        
        if (name !== undefined) { updates.push('name=?'); params.push(name); }
        if (price !== undefined) { updates.push('price=?'); params.push(price); }
        if (remarks !== undefined) { updates.push('remarks=?'); params.push(remarks); }
        
        if (updates.length > 0) {
            params.push(id);
            await connection.query(
                `UPDATE clothes SET ${updates.join(', ')} WHERE id=?`,
                params
            );
        }

        // 2. 更新标签逻辑：先删除该衣物的所有标签关联，再重新插入
        await connection.query(`DELETE FROM entity_tag_relation WHERE entity_id = ? AND entity_type = 'ITEM'`, [id]);

        const newRelations = [];
        
        if (category_id) newRelations.push([id, category_id, 'ITEM']);
        
        if (scene_ids) {
            const sIds = Array.isArray(scene_ids) ? scene_ids : (typeof scene_ids === 'string' ? scene_ids.split(',') : []);
            sIds.forEach(tid => { if(tid) newRelations.push([id, tid, 'ITEM']); });
        }
        
        if (season_ids) {
            const seaIds = Array.isArray(season_ids) ? season_ids : (typeof season_ids === 'string' ? season_ids.split(',') : []);
            seaIds.forEach(tid => { if(tid) newRelations.push([id, tid, 'ITEM']); });
        }

        if (newRelations.length > 0) {
            await connection.query(
                'INSERT INTO entity_tag_relation (entity_id, tag_id, entity_type) VALUES ?', 
                [newRelations]
            );
        }

        await connection.commit();
        res.json({ code: 200, msg: '更新成功' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ code: 500, msg: '更新失败', error: error.message });
    } finally {
        connection.release();
    }
});

/**
 * [批量删除]
 * 适配新表结构：级联删除会自动处理关联表，但 MinIO 清理逻辑需保留
 */
router.post('/batch-delete', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ msg: '参数错误' });

    const bucketName = 'wardrobe';
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. 获取图片路径
        const [rows] = await connection.query('SELECT image_url FROM clothes WHERE id IN (?)', [ids]);

        // 2. 删除主表数据 (数据库设置了 ON DELETE CASCADE，会自动删除 entity_tag_relation)
        await connection.query('DELETE FROM clothes WHERE id IN (?)', [ids]);

        // 3. 清理 MinIO 文件
        if (rows.length > 0) {
            const objectNames = rows.map(r => {
                try {
                    const urlObj = new URL(r.image_url);
                    return urlObj.pathname.replace(new RegExp(`^/${bucketName}/`), '');
                } catch (e) { return null; }
            }).filter(n => n);

            if (objectNames.length > 0) {
                await minioClient.removeObjects(bucketName, objectNames);
            }
        }

        await connection.commit();
        res.json({ code: 200, msg: '批量删除成功' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ code: 500, msg: '删除失败', error: error.message });
    } finally {
        connection.release();
    }
});

/**
 * [删除单件衣物]
 * 适配新表结构
 */
router.delete('/delete/:id', async (req, res) => {
    const { id } = req.params;
    const bucketName = 'wardrobe';
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.query('SELECT image_url FROM clothes WHERE id = ?', [id]);
        const [result] = await connection.query('DELETE FROM clothes WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ msg: '衣物不存在' });
        }

        if (rows.length > 0 && rows[0].image_url) {
            try {
                const urlObj = new URL(rows[0].image_url);
                const objectName = urlObj.pathname.replace(new RegExp(`^/${bucketName}/`), '');
                if (objectName) await minioClient.removeObject(bucketName, objectName);
            } catch (e) {}
        }

        await connection.commit();
        res.json({ code: 200, msg: '删除成功' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ code: 500, msg: '删除失败' });
    } finally {
        connection.release();
    }
});

/**
 * [批量添加标签]
 * 适配新表结构：插入 entity_tag_relation
 */
router.post('/batch-add-tags', async (req, res) => {
    const { ids, category_id, category_ids, scene_ids, season_ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ msg: '请选择至少一件衣物' });
    }

    // 统一处理分类ID，兼容单选(category_id)和多选(category_ids)
    let targetCategoryIds = [];
    if (category_ids) {
        targetCategoryIds = Array.isArray(category_ids) ? category_ids : String(category_ids).split(',');
    } else if (category_id) {
        targetCategoryIds = [category_id];
    }
    // 过滤无效值
    targetCategoryIds = targetCategoryIds.filter(id => id && String(id).trim() !== '');

    // 校验：至少选择一种标签（分类、场景或季节）
    const hasCategory = targetCategoryIds.length > 0;
    const hasScene = scene_ids && (Array.isArray(scene_ids) ? scene_ids.length > 0 : String(scene_ids).trim() !== '');
    const hasSeason = season_ids && (Array.isArray(season_ids) ? season_ids.length > 0 : String(season_ids).trim() !== '');

    if (!hasCategory && !hasScene && !hasSeason) {
        return res.status(400).json({ msg: '请至少选择一个标签（分类、场景或季节）' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // const targetCategoryIds 已经在上面处理好了
        const targetSceneIds = scene_ids ? (Array.isArray(scene_ids) ? scene_ids : String(scene_ids).split(',')) : [];
        const targetSeasonIds = season_ids ? (Array.isArray(season_ids) ? season_ids : String(season_ids).split(',')) : [];
        
        const allTagIds = [...targetCategoryIds, ...targetSceneIds, ...targetSeasonIds].filter(id => id);

        for (const clothId of ids) {
            for (const tagId of allTagIds) {
                await connection.query(`
                    INSERT INTO entity_tag_relation (entity_id, tag_id, entity_type)
                    SELECT ?, ?, 'ITEM' FROM DUAL
                    WHERE NOT EXISTS (
                        SELECT 1 FROM entity_tag_relation 
                        WHERE entity_id = ? AND tag_id = ? AND entity_type = 'ITEM'
                    )
                `, [clothId, tagId, clothId, tagId]);
            }
        }

        await connection.commit();
        res.json({ code: 200, msg: '批量添加标签成功' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ code: 500, msg: '操作失败', error: error.message });
    } finally {
        connection.release();
    }
});

/**
 * [获取所有分类]
 * 适配新表结构：从 tags 表查 tag_type = 'CATEGORY'
 */
router.get('/categories', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT tag_id as id, tag_name as name FROM tags WHERE tag_type = 'CATEGORY'");
        res.json({ code: 200, data: rows });
    } catch (err) {
        res.status(500).json({ code: 500, msg: '获取分类失败' });
    }
});

/**
 * [获取所有场景]
 * 适配新表结构：从 tags 表查 tag_type = 'SCENE'
 */
router.get('/scenes', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT tag_id as id, tag_name as name FROM tags WHERE tag_type = 'SCENE'");
        res.json({ code: 200, data: rows });
    } catch (err) {
        res.status(500).json({ code: 500, msg: '获取场景失败' });
    }
});

/**
 * [获取所有季节]
 * 适配新表结构：从 tags 表查 tag_type = 'SEASON'
 */
router.get('/seasons', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT tag_id as id, tag_name as name FROM tags WHERE tag_type = 'SEASON'");
        res.json({ code: 200, data: rows });
    } catch (err) {
        res.status(500).json({ code: 500, msg: '获取季节失败' });
    }
});

module.exports = router;