const mysql = require('mysql2/promise');

async function checkSchema() {
    console.log('开始诊断数据库表结构...');
    let connection;
    try {
        connection = await mysql.createConnection({
            host: '127.0.0.1',
            user: 'root',
            password: 'cmmm',
            database: 'wardrobe_db'
        });

        const tables = ['chat_sessions', 'chat_logs'];
        for (const table of tables) {
            console.log(`\n--- Table: ${table} ---`);
            try {
                const [rows] = await connection.query(`DESCRIBE ${table}`);
                rows.forEach(row => {
                    console.log(`Field: ${row.Field}, Type: ${row.Type}, Null: ${row.Null}, Key: ${row.Key}`);
                });
            } catch (e) {
                console.log(`Table ${table} does not exist or error: ${e.message}`);
            }
        }

    } catch (e) {
        console.error('数据库连接失败:', e);
    } finally {
        if (connection) await connection.end();
    }
}

checkSchema();
