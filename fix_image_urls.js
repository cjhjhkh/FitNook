const db = require('./OutfitSystem/config/db');

async function fixImageUrls() {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.query('SELECT id, image_url FROM clothes WHERE image_url LIKE "http://101.251.176.123%"');
        
        console.log(`Found ${rows.length} records to fix.`);
        
        for (const row of rows) {
            const newUrl = row.image_url.replace('http://101.251.176.123:20012', 'http://127.0.0.1:9000');
            await connection.query('UPDATE clothes SET image_url = ? WHERE id = ?', [newUrl, row.id]);
            console.log(`Fixed ID ${row.id}: ${newUrl}`);
        }
        
        console.log('All done.');
        connection.release();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixImageUrls();
