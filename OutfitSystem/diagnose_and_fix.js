const mysql = require('mysql2/promise');

async function run() {
    console.log('Starting diagnosis and fix...');
    const connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: 'cmmm',
        database: 'wardrobe_db'
    });

    try {
        // 1. Check outfit_items for image_url
        console.log('Checking outfit_items...');
        const [itemCols] = await connection.query('SHOW COLUMNS FROM outfit_items');
        const itemFields = itemCols.map(c => c.Field);
        if (!itemFields.includes('image_url')) {
            console.log('Adding image_url to outfit_items...');
            await connection.query("ALTER TABLE outfit_items ADD COLUMN image_url varchar(255) DEFAULT NULL COMMENT '单品图片快照'");
        } else {
            console.log('image_url exists in outfit_items.');
        }

        // 2. Check outfits for weather, temperature, image_url
        console.log('Checking outfits...');
        const [outfitCols] = await connection.query('SHOW COLUMNS FROM outfits');
        const outfitFields = outfitCols.map(c => c.Field);
        
        const missingFields = [];
        if (!outfitFields.includes('weather')) missingFields.push("ADD COLUMN weather varchar(50) DEFAULT NULL COMMENT '天气'");
        if (!outfitFields.includes('temperature')) missingFields.push("ADD COLUMN temperature varchar(20) DEFAULT NULL COMMENT '温度'");
        // 虽然报错没提 outfits 的 image_url，但为了完整性也加上
        if (!outfitFields.includes('image_url')) missingFields.push("ADD COLUMN image_url varchar(255) DEFAULT NULL COMMENT '穿搭预览图'");

        if (missingFields.length > 0) {
            const sql = `ALTER TABLE outfits ${missingFields.join(', ')}`;
            console.log('Executing:', sql);
            await connection.query(sql);
        } else {
            console.log('All fields exist in outfits.');
        }

        console.log('Done.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
        process.exit();
    }
}

run();
