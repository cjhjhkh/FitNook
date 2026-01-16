const mysql = require('mysql2/promise');

async function diagnose() {
    console.log('Starting diagnosis...');
    const connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: 'cmmm',
        database: 'wardrobe_db'
    });

    try {
        console.log('Connected to database.');
        
        const [itemCols] = await connection.query('SHOW COLUMNS FROM outfit_items');
        const itemFields = itemCols.map(c => c.Field);
        console.log('outfit_items fields:', itemFields);
        
        if (!itemFields.includes('image_url')) {
            console.log('Adding image_url to outfit_items...');
            await connection.query("ALTER TABLE outfit_items ADD COLUMN image_url varchar(255) DEFAULT NULL COMMENT '单品图片快照'");
            console.log('Added image_url to outfit_items.');
        } else {
            console.log('image_url already exists in outfit_items.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await connection.end();
    }
}

diagnose();
