const db = require('./config/db');

async function addSuitcaseIdColumn() {
    try {
        console.log('正在检查 diaries 表结构...');
        const [columns] = await db.query('SHOW COLUMNS FROM diaries LIKE "suitcase_id"');
        
        if (columns.length === 0) {
            console.log('正在添加 suitcase_id 字段...');
            await db.query('ALTER TABLE diaries ADD COLUMN suitcase_id INT DEFAULT NULL COMMENT "关联的行程ID"');
            console.log('添加成功！');
        } else {
            console.log('suitcase_id 字段已存在，无需添加。');
        }
        process.exit(0);
    } catch (err) {
        console.error('检查或修改表结构失败:', err);
        process.exit(1);
    }
}

addSuitcaseIdColumn();
