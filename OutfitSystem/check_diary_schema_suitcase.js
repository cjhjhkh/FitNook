const db = require('./config/db');

async function checkAndUpdateSchema() {
    console.log('🔍 开始检查 diaries 表结构...');
    try {
        const connection = await db.getConnection();

        // 1. 检查 suitcase_id 字段是否存在
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'diaries' AND COLUMN_NAME = 'suitcase_id'
        `);

        if (columns.length === 0) {
            console.log('⚠️ 未发现 suitcase_id 字段，正在添加...');
            await connection.query(`
                ALTER TABLE diaries 
                ADD COLUMN suitcase_id INT NULL COMMENT '关联的行程ID' AFTER linked_items
            `);
            console.log('✅ suitcase_id 字段添加成功！');
        } else {
            console.log('✅ suitcase_id 字段已存在。');
        }

        connection.release();
        console.log('🎉 数据库检查完成！');
        process.exit(0);
    } catch (err) {
        console.error('❌ 检查失败:', err);
        process.exit(1);
    }
}

checkAndUpdateSchema();