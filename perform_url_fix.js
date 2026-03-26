const db = require('./OutfitSystem/config/db');

async function fixImageUrls() {
    console.log('开始修复图片 URL...');
    let connection;
    try {
        connection = await db.getConnection();
        
        // 1. 修复 clothes 表
        const [clothes] = await connection.query('SELECT id, image_url FROM clothes WHERE image_url LIKE "%:9000%"');
        console.log(`在 clothes 表中发现 ${clothes.length} 条旧 URL`);
        
        for (const item of clothes) {
            // 旧 URL 示例: http://127.0.0.1:9000/wardrobe/111/filename.png
            // 提取文件名: filename.png
            const parts = item.image_url.split('/');
            const filename = parts[parts.length - 1];
            
            // 新 URL: http://localhost:3000/uploads/wardrobe/filename.png
            const newUrl = `http://localhost:3000/uploads/wardrobe/${filename}`;
            
            await connection.query('UPDATE clothes SET image_url = ? WHERE id = ?', [newUrl, item.id]);
            console.log(`[Clothes] ID ${item.id}: ${filename} -> ${newUrl}`);
        }

        // 2. 修复 outfit_items 表
        const [outfitItems] = await connection.query('SELECT id, image_url FROM outfit_items WHERE image_url LIKE "%:9000%"');
        console.log(`在 outfit_items 表中发现 ${outfitItems.length} 条旧 URL`);

        for (const item of outfitItems) {
            const parts = item.image_url.split('/');
            const filename = parts[parts.length - 1];
            const newUrl = `http://localhost:3000/uploads/wardrobe/${filename}`;
            
            await connection.query('UPDATE outfit_items SET image_url = ? WHERE id = ?', [newUrl, item.id]);
        }

        // 3. 修复 outfits 表 (如果有合成图)
        const [outfits] = await connection.query('SELECT id, image_url FROM outfits WHERE image_url LIKE "%:9000%"');
        console.log(`在 outfits 表中发现 ${outfits.length} 条旧 URL`);
        
        for (const item of outfits) {
             const parts = item.image_url.split('/');
            const filename = parts[parts.length - 1];
            const newUrl = `http://localhost:3000/uploads/wardrobe/${filename}`;
            await connection.query('UPDATE outfits SET image_url = ? WHERE id = ?', [newUrl, item.id]);
        }

        console.log('✅ 所有数据库 URL 修复完成！');

    } catch (err) {
        console.error('❌ 修复失败:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

fixImageUrls();