const db = require('./config/db');

async function test() {
    try {
        console.log('正在检查 diaries 表结构...');
        const [columns] = await db.query('DESCRIBE diaries');
        console.log('表结构:', columns.map(c => `${c.Field}`).join(', '));

        console.log('正在尝试插入测试数据...');
        const testData = {
            user_id: 1,
            log_date: '2026-01-19',
            content: 'Test content',
            image_list: JSON.stringify(['http://example.com/1.jpg'])
        };

        const [result] = await db.query(`
            INSERT INTO diaries (user_id, log_date, content, image_list, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `, [testData.user_id, testData.log_date, testData.content, testData.image_list]);
        
        console.log('插入成功, ID:', result.insertId);

        // 清理测试数据
        await db.query('DELETE FROM diaries WHERE id = ?', [result.insertId]);
        console.log('测试数据清理完毕');

    } catch (err) {
        console.error('诊断过程中发生错误:', err);
    } finally {
        process.exit();
    }
}

test();
