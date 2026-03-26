const db = require('./config/db');

async function checkTables() {
    try {
        console.log('正在检查数据库表结构...');
        
        // 1. Check outfits table for temperature column
        const [outfitColumns] = await db.query('SHOW COLUMNS FROM outfits LIKE "temperature"');
        if (outfitColumns.length === 0) {
            console.log('outfits 表缺少 temperature 字段，正在添加...');
            await db.query('ALTER TABLE outfits ADD COLUMN temperature VARCHAR(50) DEFAULT "" AFTER weather');
            console.log('temperature 字段添加成功');
        } else {
            console.log('outfits 表已包含 temperature 字段');
        }

        // 2. Check outfit_calendar table
        const [calendarTable] = await db.query('SHOW TABLES LIKE "outfit_calendar"');
        if (calendarTable.length === 0) {
            console.log('outfit_calendar 表不存在，正在创建...');
            await db.query(`
                CREATE TABLE IF NOT EXISTS outfit_calendar (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    outfit_id INT NOT NULL,
                    date DATE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_date (user_id, date),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
            console.log('outfit_calendar 表创建成功');
        } else {
            console.log('outfit_calendar 表已存在');
        }
        
        console.log('检查完成');
        process.exit(0);
    } catch (err) {
        console.error('检查失败:', err);
        process.exit(1);
    }
}

checkTables();
