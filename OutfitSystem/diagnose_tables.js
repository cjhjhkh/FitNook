const db = require('./config/db');

async function test() {
    try {
        console.log('正在检查数据库表...');
        
        // 检查 users 表
        const [users] = await db.query("SELECT * FROM users WHERE account = '111'");
        console.log('Account 111 exists:', users.length > 0);
        if(users.length === 0) {
             console.log('Creating user 111...');
             await db.query("INSERT INTO users (account, password, nickname) VALUES ('111', '123456', 'TestUser')");
        }

        // 检查 outfit_calendar 表
        try {
            const [columns] = await db.query('DESCRIBE outfit_calendar');
            console.log('outfit_calendar 表结构:', columns.map(c => c.Field).join(', '));
        } catch (e) {
            console.log('outfit_calendar 表不存在或报错:', e.message);
        }

         // 检查 diaries 表
        try {
            const [columns] = await db.query('DESCRIBE diaries');
            console.log('diaries 表结构:', columns.map(c => c.Field).join(', '));
        } catch (e) {
            console.log('diaries 表不存在或报错:', e.message);
        }

    } catch (err) {
        console.error('诊断错误:', err);
    } finally {
        process.exit();
    }
}

test();
