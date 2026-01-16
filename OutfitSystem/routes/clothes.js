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

// 常量定义：兜底标签名称
const FALLBACK_TAG_NAMES = {
    CATEGORY: ['其他', '未分类'],
    SCENE: ['通用'],
    SEASON: ['四季']
};

// helper: 获取指定名称和类型的标签ID
const getTagId = async (connection, names, type) => {
    if (!Array.isArray(names)) names = [names];
    const [rows] = await connection.query(
        'SELECT tag_id FROM tags WHERE tag_name IN (?) AND tag_type = ? LIMIT 1',
        [names, type]
    );
    return rows.length > 0 ? rows[0].tag_id : null;
};

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

            // 去重
            const uniqueCatIds = [...new Set(catIds)].filter(cid => cid && String(cid).trim());
            
            // 如果没有分类标签，添加默认分类
            if (uniqueCatIds.length === 0) {
                const fallbackId = await getTagId(connection, FALLBACK_TAG_NAMES.CATEGORY, 'CATEGORY');
                if (fallbackId) uniqueCatIds.push(fallbackId);
            }

            uniqueCatIds.forEach(cid => {
                tagRelations.push([newClothesId, cid, 'ITEM']);
            });

            // 4.2 场景标签
            let sIds = [];
            if (scene_ids && scene_ids !== '' && scene_ids !== '-') {
                sIds = Array.isArray(scene_ids) ? scene_ids : String(scene_ids).split(',');
                sIds = sIds.map(s => s.trim()).filter(s => s);
            }
            
            // 如果没有场景标签，添加默认场景
            if (sIds.length === 0) {
                const fallbackId = await getTagId(connection, FALLBACK_TAG_NAMES.SCENE, 'SCENE');
                if (fallbackId) sIds.push(fallbackId);
            }

            sIds.forEach(id => {
                tagRelations.push([newClothesId, id, 'ITEM']);
            });

            // 4.3 季节标签
            let seaIds = [];
            if (season_ids && season_ids !== '' && season_ids !== '-') {
                seaIds = Array.isArray(season_ids) ? season_ids : String(season_ids).split(',');
                seaIds = seaIds.map(s => s.trim()).filter(s => s);
            }

            // 如果没有季节标签，添加默认季节
            if (seaIds.length === 0) {
                const fallbackId = await getTagId(connection, FALLBACK_TAG_NAMES.SEASON, 'SEASON');
                if (fallbackId) seaIds.push(fallbackId);
            }

            seaIds.forEach(id => {
                tagRelations.push([newClothesId, id, 'ITEM']);
            });

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
    const { account, category_id, scene_id, season_id, color, keyword, page = 1, page_size = 20 } = req.query;

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

        // 修改筛选逻辑：
        // 1. 同类标签内部为 OR 关系 (使用 IN)
        // 2. 不同类标签之间为 AND 关系
        
        if (category_id) {
            const cats = String(category_id).split(',').map(s => s.trim()).filter(s => s);
            if (cats.length > 0) {
                // 只要包含其中任意一个分类标签即可
                filterSql += ` AND EXISTS (
                    SELECT 1 FROM entity_tag_relation 
                    WHERE entity_id = c.id AND entity_type = 'ITEM' AND tag_id IN (${cats.map(() => '?').join(',')})
                )`;
                filterParams.push(...cats);
            }
        }

        if (scene_id) {
            const scenes = String(scene_id).split(',').map(s => s.trim()).filter(s => s);
            if (scenes.length > 0) {
                // 只要包含其中任意一个场景标签即可
                filterSql += ` AND EXISTS (
                    SELECT 1 FROM entity_tag_relation 
                    WHERE entity_id = c.id AND entity_type = 'ITEM' AND tag_id IN (${scenes.map(() => '?').join(',')})
                )`;
                filterParams.push(...scenes);
            }
        }

        if (season_id) {
            const seasons = String(season_id).split(',').map(s => s.trim()).filter(s => s);
            if (seasons.length > 0) {
                // 只要包含其中任意一个季节标签即可
                filterSql += ` AND EXISTS (
                    SELECT 1 FROM entity_tag_relation 
                    WHERE entity_id = c.id AND entity_type = 'ITEM' AND tag_id IN (${seasons.map(() => '?').join(',')})
                )`;
                filterParams.push(...seasons);
            }
        }

        if (color) {
            filterSql += ` AND c.color LIKE ?`;
            filterParams.push(`%${color}%`);
        }

        // 新增：关键词搜索 (匹配名称、颜色或备注)
        if (keyword) {
            filterSql += ` AND (c.name LIKE ? OR c.color LIKE ? OR c.remarks LIKE ?)`;
            const kw = `%${keyword}%`;
            filterParams.push(kw, kw, kw);
        }

        // 获取总数
        const countSql = `SELECT COUNT(*) as total FROM (${filterSql}) as temp`;
        const [countRows] = await db.query(countSql, filterParams);
        const total = countRows[0].total;

        // 添加排序和分页
        filterSql += ` ORDER BY c.id DESC LIMIT ? OFFSET ?`;
        const limit = parseInt(page_size);
        const offset = (parseInt(page) - 1) * limit;
        filterParams.push(limit, offset);

        const [idRows] = await db.query(filterSql, filterParams);

        if (idRows.length === 0) {
            return res.json({ code: 200, data: { list: [], total } });
        }

        const ids = idRows.map(row => row.id);

        // 2. 第二步：根据 ID 获取完整信息
        // 去除别名，直接返回数据库字段 remarks
        let mainSql = `
            SELECT 
                c.id, c.name, c.image_url, c.price, c.remarks, c.record_time as created_at,
                c.location, c.wear_count, c.color, c.material,
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
        
        // 按照 ids 的顺序初始化 map，确保返回顺序正确
        ids.forEach(id => {
             clothesMap.set(id, {
                id: id,
                name: '',
                image_url: '',
                price: 0,
                remarks: '',
                location: '',
                wear_count: 0,
                color: '',
                material: '',
                created_at: null,
                category_names: [],
                scene_names: [],
                season_names: [],
                category_ids: [],
                scene_ids: [],
                season_ids: []
            });
        });

        rows.forEach(row => {
            if (clothesMap.has(row.id)) {
                const item = clothesMap.get(row.id);
                // 填充基础信息 (只需填充一次，或者覆盖)
                if (!item.image_url) {
                    item.name = row.name;
                    item.image_url = row.image_url;
                    item.price = row.price;
                    item.remarks = row.remarks;
                    item.location = row.location;
                    item.wear_count = row.wear_count;
                    item.color = row.color;
                    item.material = row.material;
                    item.created_at = row.created_at;
                }

                if (row.tag_type === 'CATEGORY') {
                    item.category_names.push(row.tag_name);
                    item.category_ids.push(row.tag_id);
                } else if (row.tag_type === 'SCENE') {
                    item.scene_names.push(row.tag_name);
                    item.scene_ids.push(row.tag_id);
                } else if (row.tag_type === 'SEASON') {
                    item.season_names.push(row.tag_name);
                    item.season_ids.push(row.tag_id);
                }
            }
        });

        res.json({ code: 200, data: { list: Array.from(clothesMap.values()), total } });
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
    // 接收 remarks, 增加 name, location, color, material, wear_count
    // 支持 category_ids (多选)
    const { name, category_id, category_ids, price, scene_ids, season_ids, remarks, location, color, material, wear_count } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. 更新基础表 (支持更新名称及新增字段)
        // 构建动态更新语句，避免覆盖未传递的字段
        const updates = [];
        const params = [];

        if (name !== undefined) { updates.push('name=?'); params.push(name); }
        if (price !== undefined) { updates.push('price=?'); params.push(price); }
        if (remarks !== undefined) { updates.push('remarks=?'); params.push(remarks); }
        if (location !== undefined) { updates.push('location=?'); params.push(location); }
        if (color !== undefined) { updates.push('color=?'); params.push(color); }
        if (material !== undefined) { updates.push('material=?'); params.push(material); }
        if (wear_count !== undefined) { updates.push('wear_count=?'); params.push(wear_count); }

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

        // 处理分类 (兼容单选 category_id 和多选 category_ids)
        const catIds = [];
        if (category_ids) {
            if (Array.isArray(category_ids)) catIds.push(...category_ids);
            else catIds.push(...String(category_ids).split(','));
        }
        if (category_id) catIds.push(category_id);
        
        const uniqueCatIds = [...new Set(catIds)].filter(cid => cid && String(cid).trim());

        // 默认分类逻辑
        if (uniqueCatIds.length === 0) {
            const fallbackId = await getTagId(connection, FALLBACK_TAG_NAMES.CATEGORY, 'CATEGORY');
            if (fallbackId) uniqueCatIds.push(fallbackId);
        }

        uniqueCatIds.forEach(cid => {
            newRelations.push([id, cid, 'ITEM']);
        });

        // 场景
        let sIds = [];
        if (scene_ids) {
            sIds = Array.isArray(scene_ids) ? scene_ids : (typeof scene_ids === 'string' ? scene_ids.split(',') : []);
            sIds = sIds.map(s => String(s).trim()).filter(s => s);
        }

        // 默认场景逻辑
        if (sIds.length === 0) {
            const fallbackId = await getTagId(connection, FALLBACK_TAG_NAMES.SCENE, 'SCENE');
            if (fallbackId) sIds.push(fallbackId);
        }

        sIds.forEach(tid => { newRelations.push([id, tid, 'ITEM']); });

        // 季节
        let seaIds = [];
        if (season_ids) {
            seaIds = Array.isArray(season_ids) ? season_ids : (typeof season_ids === 'string' ? season_ids.split(',') : []);
            seaIds = seaIds.map(s => String(s).trim()).filter(s => s);
        }

        // 默认季节逻辑
        if (seaIds.length === 0) {
            const fallbackId = await getTagId(connection, FALLBACK_TAG_NAMES.SEASON, 'SEASON');
            if (fallbackId) seaIds.push(fallbackId);
        }

        seaIds.forEach(tid => { newRelations.push([id, tid, 'ITEM']); });

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
            } catch (e) { }
        }

        await connection.commit();
        res.json({ code: 200, msg: '删除成功' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ code: 500, msg: '删除失败', error: error.message });
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

        // 清理互斥标签：如果某件衣物在某个类型下拥有了非兜底标签，则移除该类型下的兜底标签
        // 兜底标签列表
        const fallbackNames = [...FALLBACK_TAG_NAMES.CATEGORY, ...FALLBACK_TAG_NAMES.SCENE, ...FALLBACK_TAG_NAMES.SEASON];
        
        // 确保 ids 是数字数组
        const numericIds = ids.map(id => Number(id)).filter(id => !isNaN(id));
        
        if (numericIds.length > 0) {
            // 1. 找出哪些衣物在哪些类型下已经有了“真实标签” (非兜底标签)
            const checkSql = `
                SELECT DISTINCT etr.entity_id, t.tag_type
                FROM entity_tag_relation etr
                JOIN tags t ON etr.tag_id = t.tag_id
                WHERE etr.entity_id IN (?) 
                  AND etr.entity_type = 'ITEM'
                  AND t.tag_name NOT IN (?)
            `;
            
            const [rows] = await connection.query(checkSql, [numericIds, fallbackNames]);
            
            // 2. 如果有需要清理的情况，按类型分组执行删除
            if (rows.length > 0) {
                const types = ['CATEGORY', 'SCENE', 'SEASON'];
                for (const type of types) {
                    // 找出该类型下有真实标签的 entity_id
                    const idsToDeleteFallback = rows
                        .filter(r => r.tag_type === type)
                        .map(r => r.entity_id);
                    
                    if (idsToDeleteFallback.length > 0) {
                        // 删除这些衣物在该类型下的兜底标签
                        const typeFallbackNames = FALLBACK_TAG_NAMES[type];
                        
                        const deleteSql = `
                            DELETE etr 
                            FROM entity_tag_relation etr
                            JOIN tags t ON etr.tag_id = t.tag_id
                            WHERE etr.entity_id IN (?) 
                              AND etr.entity_type = 'ITEM'
                              AND t.tag_type = ?
                              AND t.tag_name IN (?)
                        `;
                        await connection.query(deleteSql, [idsToDeleteFallback, type, typeFallbackNames]);
                    }
                }
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

/**
 * [新建标签]
 * 支持一次添加多个，空格分隔
 */
router.post('/tags/add', async (req, res) => {
    const { names, type } = req.body;
    if (!names || !type) return res.status(400).json({ msg: '参数不完整' });
    
    const validTypes = ['CATEGORY', 'SCENE', 'SEASON'];
    if (!validTypes.includes(type)) return res.status(400).json({ msg: '无效的标签类型' });

    // 支持中文逗号或英文逗号或空格分隔
    const nameList = names.split(/[\s,，]+/).filter(s => s && s.trim());
    if (nameList.length === 0) return res.status(400).json({ msg: '标签名不能为空' });

    const connection = await db.getConnection();
    try {
        const values = nameList.map(name => [name, type]);
        
        // 使用 INSERT IGNORE 避免重复报错 (假设数据库有唯一约束，如果没有则会重复插入)
        // 如果没有唯一约束，建议先查后插，这里假设 tags 表设计合理
        await connection.query(
            'INSERT IGNORE INTO tags (tag_name, tag_type) VALUES ?',
            [values]
        );
        
        res.json({ code: 200, msg: '标签添加成功' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: '添加标签失败', error: err.message });
    } finally {
        connection.release();
    }
});

/**
 * [批量删除标签]
 * 级联删除：删除标签的同时，删除 entity_tag_relation 中所有引用该标签的记录
 */
router.post('/tags/batch-delete', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ msg: '参数错误' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. 删除关联表中的记录 (entity_tag_relation)
        await connection.query('DELETE FROM entity_tag_relation WHERE tag_id IN (?)', [ids]);

        // 2. 删除标签表中的记录 (tags)
        await connection.query('DELETE FROM tags WHERE tag_id IN (?)', [ids]);

        await connection.commit();
        res.json({ code: 200, msg: '标签删除成功' });
    } catch (err) {
        await connection.rollback();
        console.error('[tags.delete] 失败:', err);
        res.status(500).json({ code: 500, msg: '删除标签失败', error: err.message });
    } finally {
        connection.release();
    }
});

module.exports = router;