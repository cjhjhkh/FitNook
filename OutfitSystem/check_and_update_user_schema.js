const db = require('./config/db');

async function updateSchema() {
    console.log('开始检查 user_profiles 表结构...');
    const connection = await db.getConnection();
    try {
        // 1. 检查 avatar_url
        try {
            await connection.query('SELECT avatar_url FROM user_profiles LIMIT 1');
        } catch (e) {
            console.log('添加 avatar_url 字段...');
            await connection.query('ALTER TABLE user_profiles ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL COMMENT "头像URL"');
        }

        // 2. 检查 gender
        try {
            await connection.query('SELECT gender FROM user_profiles LIMIT 1');
        } catch (e) {
            console.log('添加 gender 字段...');
            await connection.query("ALTER TABLE user_profiles ADD COLUMN gender ENUM('MALE', 'FEMALE', 'SECRET', 'OTHER') DEFAULT 'SECRET' COMMENT '性别'");
        }

        // 3. 检查 birthday
        try {
            await connection.query('SELECT birthday FROM user_profiles LIMIT 1');
        } catch (e) {
            console.log('添加 birthday 字段...');
            await connection.query('ALTER TABLE user_profiles ADD COLUMN birthday DATE DEFAULT NULL COMMENT "生日"');
        }

        // 4. 检查 signature
        try {
            await connection.query('SELECT signature FROM user_profiles LIMIT 1');
        } catch (e) {
            console.log('添加 signature 字段...');
            await connection.query('ALTER TABLE user_profiles ADD COLUMN signature VARCHAR(255) DEFAULT NULL COMMENT "个性签名"');
        }
        
        console.log('user_profiles 表结构检查完毕。');

    } catch (err) {
        console.error('Schema 更新失败:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

updateSchema();
