const db = require('./config/db');

async function checkSchema() {
    console.log('🔍 正在检查 user_profiles 表结构...');
    try {
        const [rows] = await db.query('DESCRIBE user_profiles');
        console.log('表结构:', JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('❌ 查询失败:', err.message);
    }
    process.exit();
}

checkSchema();
