const db = require('./config/db');

async function createTable() {
    try {
        console.log('正在创建 outfit_calendar 表...');
        const createSql = `
            CREATE TABLE IF NOT EXISTS outfit_calendar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL COMMENT '用户ID',
                outfit_id INT NOT NULL COMMENT '搭配ID',
                date DATE NOT NULL COMMENT '日期',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_date (user_id, date),
                INDEX idx_outfit (outfit_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        await db.query(createSql);
        console.log('✅ outfit_calendar 表创建成功');

    } catch (err) {
        console.error('❌ 创建表失败:', err);
    } finally {
        process.exit();
    }
}

createTable();
