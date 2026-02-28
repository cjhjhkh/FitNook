const db = require('./config/db');

async function createTable() {
    try {
        console.log('正在创建 diaries 表...');
        const createSql = `
            CREATE TABLE IF NOT EXISTS diaries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL DEFAULT 1 COMMENT '用户ID',
                log_date DATE NOT NULL COMMENT '日记日期',
                content TEXT COMMENT '日记内容',
                image_list JSON COMMENT '图片列表',
                linked_items JSON COMMENT '关联单品或搭配ID列表',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user_date (user_id, log_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await db.query(createSql);
        console.log('✅ diaries 表创建成功');

    } catch (err) {
        console.error('❌ 创建表失败:', err);
    } finally {
        process.exit();
    }
}

createTable();
