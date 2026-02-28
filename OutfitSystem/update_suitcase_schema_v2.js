const db = require('./config/db');

async function updateSuitcaseTable() {
    try {
        console.log('开始检查 suitcases 表结构...');
        
        // 1. 添加 description 字段
        try {
            await db.query(`ALTER TABLE suitcases ADD COLUMN description TEXT`);
            console.log('添加 description 字段成功');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('description 字段已存在');
            else console.error('添加 description 失败', e);
        }

        // 2. 添加 status 字段
        try {
            await db.query(`ALTER TABLE suitcases ADD COLUMN status VARCHAR(20) DEFAULT 'planning' COMMENT 'planning: 计划中, departed: 已出发'`);
            console.log('添加 status 字段成功');
        } catch (e) {
             if (e.code === 'ER_DUP_FIELDNAME') console.log('status 字段已存在');
             else console.error('添加 status 失败', e);
        }

        // 3. 添加 outfits 字段
        try {
            await db.query(`ALTER TABLE suitcases ADD COLUMN outfits JSON COMMENT '存储关联的穿搭ID列表'`);
            console.log('添加 outfits 字段成功');
        } catch (e) {
             if (e.code === 'ER_DUP_FIELDNAME') console.log('outfits 字段已存在');
             else console.error('添加 outfits 失败', e);
        }

        console.log('数据库升级完成');
        process.exit(0);
    } catch (err) {
        console.error('脚本运行出错:', err);
        process.exit(1);
    }
}

updateSuitcaseTable();