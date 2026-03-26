const db = require('./config/db');

async function ensureColumns() {
    try {
        console.log('正在检查 outfits 表结构...');
        const [columns] = await db.query('SHOW COLUMNS FROM outfits');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('temperature')) {
            console.log('添加 temperature 字段...');
            await db.query('ALTER TABLE outfits ADD COLUMN temperature VARCHAR(50) DEFAULT NULL AFTER weather');
        } else {
            console.log('temperature 字段已存在');
        }

        if (!columnNames.includes('image_url')) {
            console.log('添加 image_url 字段...');
            await db.query('ALTER TABLE outfits ADD COLUMN image_url TEXT DEFAULT NULL AFTER temperature');
        } else {
            console.log('image_url 字段已存在');
        }

        console.log('outfits 表结构检查完成。');
        process.exit(0);
    } catch (err) {
        console.error('检查失败:', err);
        process.exit(1);
    }
}

ensureColumns();
