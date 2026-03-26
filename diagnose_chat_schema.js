const db = require('./config/db');

async function checkSchema() {
    try {
        console.log('Checking table schemas...');
        const [sessionCols] = await db.query('SHOW COLUMNS FROM chat_sessions');
        console.log('chat_sessions columns:', sessionCols.map(c => c.Field));

        const [logCols] = await db.query('SHOW COLUMNS FROM chat_logs');
        console.log('chat_logs columns:', logCols.map(c => c.Field));
    } catch (e) {
        console.error('Error checking schema:', e.message);
    } finally {
        process.exit();
    }
}
checkSchema();
