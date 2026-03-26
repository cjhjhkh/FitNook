const db = require('./config/db');

async function fixMissingProfiles() {
    console.log('🔍 开始检查 User Profiles 表...');
    let connection;
    try {
        connection = await db.getConnection();

        // 1. 检查 user_profiles 表是否存在
        const [tables] = await connection.query("SHOW TABLES LIKE 'user_profiles'");
        if (tables.length === 0) {
            console.log('⚠️ user_profiles 表不存在，正在创建...');
            await connection.query(`
                CREATE TABLE user_profiles (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    nickname VARCHAR(100) DEFAULT '新用户',
                    avatar_url VARCHAR(500) DEFAULT '',
                    height INT NULL,
                    weight INT NULL,
                    body_shape VARCHAR(50) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uniq_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
            console.log('✅ user_profiles 表创建成功');
        } else {
            console.log('✅ user_profiles 表已存在');
        }

        // 2. 检查字段完整性 (nickname, avatar_url)
        console.log('🔍 检查字段完整性...');
        const [columns] = await connection.query("DESCRIBE user_profiles");
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('nickname')) {
            await connection.query("ALTER TABLE user_profiles ADD COLUMN nickname VARCHAR(100) DEFAULT '新用户'");
            console.log('✅ 添加 nickname 字段');
        }
        if (!columnNames.includes('avatar_url')) {
            await connection.query("ALTER TABLE user_profiles ADD COLUMN avatar_url VARCHAR(500) DEFAULT ''");
            console.log('✅ 添加 avatar_url 字段');
        }

        // 3. 为现有 User 补充 Profile
        console.log('🔄 同步现有用户数据...');
        const [users] = await connection.query("SELECT id, account FROM users");
        for (const user of users) {
            // 修正：user_profiles 表 user_id 是主键，不一定有 id 字段，直接查 user_id
            const [profiles] = await connection.query("SELECT user_id FROM user_profiles WHERE user_id = ?", [user.id]);
            if (profiles.length === 0) {
                // 如果没有 profile，创建一个默认的
                // 默认昵称使用账号名（去掉邮箱后缀等）
                const defaultName = user.account.split('@')[0];
                await connection.query(
                    "INSERT INTO user_profiles (user_id, nickname) VALUES (?, ?)", 
                    [user.id, defaultName]
                );
                console.log(`➕ 为用户 ID ${user.id} (${user.account}) 创建了默认 Profile`);
            }
        }

        console.log('🎉 用户资料表检查完成！');

    } catch (err) {
        console.error('❌ 脚本执行失败:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

fixMissingProfiles();
