const db = require('./config/db');

async function init() {
    try {
        console.log('开始初始化日历相关表...');
        
        // 1. 检查 outfits 表 temperature 字段
        try {
            const [columns] = await db.query('SHOW COLUMNS FROM outfits LIKE "temperature"');
            if (columns.length === 0) {
                console.log('添加 temperature 字段到 outfits 表...');
                await db.query('ALTER TABLE outfits ADD COLUMN temperature VARCHAR(50) DEFAULT "" AFTER weather');
            }
        } catch (e) {
            console.error('检查 outfits 表失败:', e);
        }

        // 2. 创建 update_schema_temp.js 提到的 outfit_calendar 表
        const createTableSql = `
            CREATE TABLE IF NOT EXISTS outfit_calendar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                outfit_id INT NOT NULL,
                date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY idx_user_date (user_id, date),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        
        await db.query(createTableSql);
        console.log('outfit_calendar 表检查/创建完成');

        process.exit(0);
    } catch (err) {
        console.error('初始化失败:', err);
        process.exit(1);
    }
}

init();
