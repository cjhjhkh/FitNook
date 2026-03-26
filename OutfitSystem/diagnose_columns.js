const db = require('./config/db');

async function checkColumns() {
    try {
        console.log('--- Checking clothes table ---');
        const [clothesCols] = await db.query('SHOW COLUMNS FROM clothes');
        console.log(JSON.stringify(clothesCols.map(c => c.Field)));

        console.log('\n--- Checking outfits table ---');
        const [outfitsCols] = await db.query('SHOW COLUMNS FROM outfits');
        console.log(JSON.stringify(outfitsCols.map(c => c.Field)));

        console.log('\n--- Checking outfit_items table ---');
        const [outfitItemsCols] = await db.query('SHOW COLUMNS FROM outfit_items');
        console.log(JSON.stringify(outfitItemsCols.map(c => c.Field)));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkColumns();
