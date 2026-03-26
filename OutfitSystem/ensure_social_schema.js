const db = require('./config/db');

async function ensureSchema() {
    console.log('开始检查数据库表结构...');

    try {
        // 1. 检查 outfits 表
        console.log('检查 outfits 表...');
        const outfitsColumns = await db.query("SHOW COLUMNS FROM outfits");
        // RowDataPacket { Field: 'id', Type: 'int', ... }
        const outfitFields = outfitsColumns[0].map(c => c.Field);

        if (!outfitFields.includes('image_url')) {
            console.log('outfits 表缺少 image_url 字段，正在添加...');
            await db.query("ALTER TABLE outfits ADD COLUMN image_url VARCHAR(255) COMMENT '穿搭合成图URL'");
        } else {
            console.log('outfits.image_url 已存在。');
        }

        if (!outfitFields.includes('bg_color')) {
            console.log('outfits 表缺少 bg_color 字段，正在添加...');
            await db.query("ALTER TABLE outfits ADD COLUMN bg_color VARCHAR(50) DEFAULT '#f7f8fa' COMMENT '背景色'");
        }

        if (!outfitFields.includes('temperature')) {
            console.log('outfits 表缺少 temperature 字段，正在添加...');
            await db.query("ALTER TABLE outfits ADD COLUMN temperature VARCHAR(50) COMMENT '适宜温度'");
        }

        // 2. 检查 social_posts 表
        console.log('检查 social_posts 表...');
        // 先检查表是否存在
        const checkTable = await db.query("SHOW TABLES LIKE 'social_posts'");
        if (checkTable[0].length === 0) {
            console.log('social_posts 表不存在，正在创建...');
            await db.query(`
                CREATE TABLE IF NOT EXISTS social_posts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    outfit_id INT,
                    content TEXT,
                    image_urls JSON COMMENT '图片列表',
                    likes INT DEFAULT 0,
                    comments_count INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            `);
            console.log('social_posts 表创建成功。');
        } else {
            const postsColumns = await db.query("SHOW COLUMNS FROM social_posts");
            const postFields = postsColumns[0].map(c => c.Field);

            if (!postFields.includes('image_urls')) {
                console.log('social_posts 表缺少 image_urls 字段，正在添加...');
                // 如果有旧的 image_url 字段，可能需要迁移数据，这里简单处理直接添加
                await db.query("ALTER TABLE social_posts ADD COLUMN image_urls JSON COMMENT '图片列表'");
                
                // 尝试迁移旧数据 (如果有 image_url)
                if (postFields.includes('image_url')) {
                     console.log('正在将旧的 image_url 数据迁移到 image_urls...');
                     await db.query(`
                        UPDATE social_posts 
                        SET image_urls = JSON_ARRAY(image_url) 
                        WHERE image_url IS NOT NULL AND (image_urls IS NULL OR JSON_LENGTH(image_urls) = 0)
                     `);
                }
            } else {
                console.log('social_posts.image_urls 已存在。');
            }

            // 检查 view_count
            if (!postFields.includes('view_count')) {
                await db.query("ALTER TABLE social_posts ADD COLUMN view_count INT DEFAULT 0");
                console.log('添加了 view_count 字段');
            }
        }
        
        // 3. 检查 social_likes 表 (点赞)
        console.log('检查 social_likes 表...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS social_likes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                post_id BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (user_id, post_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);

        // 4. 检查 social_comments 表 (评论)
        console.log('检查 social_comments 表...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS social_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                post_id BIGINT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);
        
        // 5. 检查 outfit_calendar 表 (日历)
        console.log('检查 outfit_calendar 表...');
        // 先检查表是否存在
        const checkCalTable = await db.query("SHOW TABLES LIKE 'outfit_calendar'");
        
        if (checkCalTable[0].length === 0) {
            console.log('outfit_calendar 表不存在，正在创建...');
            await db.query(`
                 CREATE TABLE IF NOT EXISTS outfit_calendar (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    outfit_id BIGINT NOT NULL,
                    date DATE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE
                ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
            `);
        } else {
             // 检查字段名
            const calColumns = await db.query("SHOW COLUMNS FROM outfit_calendar");
            const calFields = calColumns[0].map(c => c.Field);
            
            if (calFields.includes('calendar_date') && !calFields.includes('date')) {
                console.log('发现旧字段 calendar_date，正在重命名为 date...');
                await db.query("ALTER TABLE outfit_calendar CHANGE calendar_date date DATE NOT NULL");
            } else if (!calFields.includes('date')) {
                console.log('outfit_calendar 缺少 date 字段，正在添加...');
                await db.query("ALTER TABLE outfit_calendar ADD COLUMN date DATE NOT NULL");
            }
        }

        // 6. 检查 user_profiles 表 (用户信息)
        console.log('检查 user_profiles 表...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL UNIQUE,
                nickname VARCHAR(100),
                avatar_url VARCHAR(255),
                height INT,
                weight INT,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `);

        // 7. 确保所有用户在 user_profiles 都有记录
        console.log('同步 user_profiles 数据...');
        await db.query(`
            INSERT IGNORE INTO user_profiles (user_id, nickname)
            SELECT id, CONCAT('User', SUBSTRING(account, -4))
            FROM users
        `);

        console.log('数据库结构检查完成！');
        process.exit(0);

    } catch (error) {
        console.error('数据库检查失败:', error);
        process.exit(1);
    }
}

ensureSchema();
