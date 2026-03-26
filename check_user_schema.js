const db = require('./OutfitSystem/config/db');

async function checkUserSchema() {
    try {
        const connection = await db.getConnection();
        console.log('正在检查 user_profiles 表结构...');

        const [columns] = await connection.query('SHOW COLUMNS FROM user_profiles');
        const existingColumns = columns.map(c => c.Field);

        const requiredColumns = [
            { name: 'avatar_url', type: 'VARCHAR(500) DEFAULT NULL' },
            { name: 'birthday', type: 'DATE DEFAULT NULL' },
            { name: 'gender', type: "ENUM('MALE', 'FEMALE', 'SECRET', 'OTHER') DEFAULT 'SECRET'" },
            { name: 'signature', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'skin_tone', type: 'VARCHAR(50) DEFAULT NULL' }
        ];

        for (const col of requiredColumns) {
            if (!existingColumns.includes(col.name)) {
                console.log(`字段 ${col.name} 不存在，正在添加...`);
                await connection.query(`ALTER TABLE user_profiles ADD COLUMN ${col.name} ${col.type}`);
                console.log(`字段 ${col.name} 添加成功`);
            } else {
                console.log(`字段 ${col.name} 已存在`);
            }
        }

        console.log('数据库结构检查完成');
        connection.release();
        process.exit(0);
    } catch (err) {
        console.error('检查失败:', err);
        process.exit(1);
    }
}

checkUserSchema();
