const db = require('./config/db');

async function fixSchema() {
    console.log('开始执行最终数据库修复...');
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // 1. 修正 outfit_calendar 表结构
        // 将 user_id, outfit_id 修改为 BIGINT 以匹配主表
        // 确保 date 字段存在
        console.log('检查 outfit_calendar 表...');
        
        // 检查是否存在
        const [calendarExists] = await connection.query("SHOW TABLES LIKE 'outfit_calendar'");
        if (calendarExists.length > 0) {
            // 修改列类型
            await connection.query("ALTER TABLE outfit_calendar MODIFY COLUMN user_id BIGINT NOT NULL");
            await connection.query("ALTER TABLE outfit_calendar MODIFY COLUMN outfit_id BIGINT NOT NULL");
            console.log('outfit_calendar 列类型已修正为 BIGINT');
        } else {
             await connection.query(`
                CREATE TABLE IF NOT EXISTS outfit_calendar (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    outfit_id BIGINT NOT NULL,
                    date DATE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_date (user_id, date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
            console.log('创建了 outfit_calendar 表');
        }

        // 2. 补全 outfits 表字段
        console.log('检查 outfits 表字段...');
        const [outfitColumns] = await connection.query("SHOW COLUMNS FROM outfits");
        const outfitColumnNames = outfitColumns.map(c => c.Field);
        
        if (!outfitColumnNames.includes('temperature')) {
            await connection.query("ALTER TABLE outfits ADD COLUMN temperature VARCHAR(50) DEFAULT '' AFTER weather");
            console.log('添加了 temperature 字段');
        }
        if (!outfitColumnNames.includes('image_url')) {
            await connection.query("ALTER TABLE outfits ADD COLUMN image_url VARCHAR(500) DEFAULT NULL AFTER description"); // 存放合成图
            console.log('添加了 image_url 字段');
        }

        // 3. 确保 social_likes 表存在 (点赞用)
        console.log('检查 social_likes 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS social_likes (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                post_id BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (user_id, post_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        // 4. 确保 user_profiles 表存在 (社交用)
        console.log('检查 user_profiles 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id BIGINT PRIMARY KEY,
                nickname VARCHAR(100) DEFAULT '新用户',
                avatar_url VARCHAR(500) DEFAULT '',
                bio VARCHAR(255) DEFAULT '',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 5. 同步数据到 user_profiles
        console.log('同步用户数据到 user_profiles...');
        await connection.query(`
            INSERT IGNORE INTO user_profiles (user_id, nickname, avatar_url)
            SELECT id, 
                   COALESCE(username, CONCAT('User', id)), 
                   COALESCE(avatar, '')
            FROM users;
        `);

        await connection.commit();
        console.log('数据库修复完成！');
        process.exit(0);
    } catch (e) {
        await connection.rollback();
        console.error('数据库修复失败:', e);
        process.exit(1);
    } finally {
        connection.release();
    }
}

fixSchema();
