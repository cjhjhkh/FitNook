const db = require('./config/db');

async function ensureColumn() {
    try {
        console.log('正在检查 diaries 表结构...');
        const [columns] = await db.query('SHOW COLUMNS FROM diaries');
        const hasSuitcaseId = columns.some(col => col.Field === 'suitcase_id');

        if (!hasSuitcaseId) {
            console.log('检测到缺少 suitcase_id 字段，正在添加...');
            await db.query(`
                ALTER TABLE diaries
                ADD COLUMN suitcase_id INT NULL COMMENT '关联的行程ID' AFTER linked_items
            `);
            console.log('字段添加成功！');
        } else {
            console.log('suitcase_id 字段已存在，跳过。');
        }
        process.exit(0);
    } catch (err) {
        console.error('数据库操作失败:', err);
        process.exit(1);
    }
}

ensureColumn();
