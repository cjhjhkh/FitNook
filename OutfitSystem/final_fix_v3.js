const mysql = require('mysql2/promise');
const config = require('./config/db');

async function fixDatabase() {
    let connection;
    try {
        console.log('正在连接数据库...');
        connection = await mysql.createConnection(config);
        console.log('数据库连接成功');

        // 1. 检测 users 表 id 类型
        console.log('正在检测 users.id 类型...');
        const [columns] = await connection.query(`
            SELECT DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
        `, [config.database]);

        if (columns.length === 0) {
            console.error('错误: 找不到 users 表或 id 列');
            process.exit(1);
        }

        const userIdType = columns[0].DATA_TYPE.toUpperCase();
        console.log(`users.id 类型为: ${userIdType}`);

        // 确定目标类型，如果是 BIGINT 就用 BIGINT，否则用 INT
        const targetType = userIdType === 'BIGINT' ? 'BIGINT' : 'INT';

        // 2. 统一外键类型
        const tablesToFix = [
            'social_posts', 
            'outfits', 
            'outfit_calendar', 
            'user_profiles', 
            'suitcases',
            'wardrobe',
            'chat_sessions'
        ];

        for (const table of tablesToFix) {
            try {
                // 检查表是否存在
                const [tableExists] = await connection.query(`SHOW TABLES LIKE ?`, [table]);
                if (tableExists.length === 0) {
                    console.log(`跳过: 表 ${table} 不存在`);
                    continue;
                }

                console.log(`正在检查 ${table}.user_id 类型...`);
                // 检查当前类型
                const [colInfo] = await connection.query(`
                    SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'user_id'
                `, [config.database, table]);
                
                if (colInfo.length > 0) {
                    const currentType = colInfo[0].DATA_TYPE.toUpperCase();
                    // 这里简化判断，只要不是完全一致就尝试修改
                    // 但要注意 bigint 和 bigint(20) 在这里可能都显示为 bigint
                    // 无论如何，执行一次 MODIFY 一般是安全的
                    console.log(`正在修正 ${table}.user_id 类型从 ${currentType} 为 ${targetType}...`);
                    await connection.query(`ALTER TABLE ${table} MODIFY COLUMN user_id ${targetType} NOT NULL`);
                    console.log(`表 ${table} user_id 修正成功`);
                }
            } catch (err) {
                console.warn(`警告: 修正 ${table}.user_id 失败: ${err.message}`);
            }
        }

        // 3. 修正 outfit_calendar 日期字段
        console.log('检查 outfit_calendar 表结构...');
        try {
            const [calCols] = await connection.query(`SHOW COLUMNS FROM outfit_calendar`);
            const hasCalendarDate = calCols.some(c => c.Field === 'calendar_date');
            const hasDate = calCols.some(c => c.Field === 'date');

            if (hasCalendarDate && !hasDate) {
                console.log('检测到旧字段 calendar_date，正在重命名为 date...');
                await connection.query(`ALTER TABLE outfit_calendar CHANGE calendar_date date DATE NOT NULL`);
            } else if (!hasDate && !hasCalendarDate) {
                 console.log('outfit_calendar 缺少 date 字段，正在添加...');
                 // 尝试添加 date 字段
                 try {
                    await connection.query(`ALTER TABLE outfit_calendar ADD COLUMN date DATE NOT NULL`);
                 } catch (e) {
                    await connection.query(`ALTER TABLE outfit_calendar ADD COLUMN date DATE`);
                 }
            }
        } catch (e) {
            console.log('outfit_calendar 处理出错 (可能表不存在):', e.message);
        }

        // 4. 补全 outfits 缺少的字段
        console.log('检查 outfits 表字段...');
        try {
            const [outfitCols] = await connection.query(`SHOW COLUMNS FROM outfits`);
            const outfitFields = outfitCols.map(c => c.Field);
            
            if (!outfitFields.includes('temperature')) {
                console.log('outfits 添加 temperature 字段...');
                await connection.query(`ALTER TABLE outfits ADD COLUMN temperature VARCHAR(50)`);
            }
            if (!outfitFields.includes('weather')) {
                console.log('outfits 添加 weather 字段...');
                await connection.query(`ALTER TABLE outfits ADD COLUMN weather VARCHAR(50)`);
            }
             if (!outfitFields.includes('image_url')) {
                console.log('outfits 添加 image_url 字段...');
                await connection.query(`ALTER TABLE outfits ADD COLUMN image_url TEXT`);
            }
        } catch (e) {
            console.log('outfits 处理出错:', e.message);
        }

        // 5. 补全 social_posts 缺少的字段
        console.log('检查 social_posts 表字段...');
        try {
            const [postCols] = await connection.query(`SHOW COLUMNS FROM social_posts`);
            const postFields = postCols.map(c => c.Field);

            if (!postFields.includes('location')) {
                 console.log('social_posts 添加 location 字段...');
                 await connection.query(`ALTER TABLE social_posts ADD COLUMN location VARCHAR(255)`);
            }
            if (!postFields.includes('outfit_id')) {
                 console.log('social_posts 添加 outfit_id 字段...');
                 await connection.query(`ALTER TABLE social_posts ADD COLUMN outfit_id INT`);
            }
            if (!postFields.includes('tags')) {
                 console.log('social_posts 添加 tags 字段...');
                 await connection.query(`ALTER TABLE social_posts ADD COLUMN tags JSON`);
            }
        } catch (e) {
             console.log('social_posts 处理出错:', e.message);
        }
        
        // 6. 确保 chat 相关表结构
        console.log('确保 chat 相关表结构...');
        try {
             // 检查 chat_sessions 是否存在
            const [chatExists] = await connection.query(`SHOW TABLES LIKE 'chat_sessions'`);
            if (chatExists.length === 0) {
                 await connection.query(`
                    CREATE TABLE chat_sessions (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id ${targetType} NOT NULL,
                        title VARCHAR(100),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        is_deleted BOOLEAN DEFAULT FALSE,
                        max_tokens INT DEFAULT 2000,
                        model VARCHAR(50) DEFAULT 'gpt-3.5-turbo'
                    )
                `);
                console.log('创建 chat_sessions 表成功');
            } else {
                console.log('chat_sessions 表已存在');
            }
            
            const [msgExists] = await connection.query(`SHOW TABLES LIKE 'chat_messages'`);
            if (msgExists.length === 0) {
                await connection.query(`
                    CREATE TABLE chat_messages (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        session_id INT NOT NULL,
                        role ENUM('user', 'assistant', 'system') NOT NULL,
                        content TEXT,
                        image_url TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        is_read BOOLEAN DEFAULT FALSE,
                        INDEX idx_session (session_id)
                    )
                `);
                console.log('创建 chat_messages 表成功');
            } else {
                console.log('chat_messages 表已存在');
            }

        } catch (e) {
            console.log('chat 表处理出错:', e.message);
        }

        console.log('===== 数据库修复完成 =====');

    } catch (err) {
        console.error('发生全局错误:', err);
    } finally {
        if (connection) await connection.end();
        process.exit(0);
    }
}

fixDatabase();