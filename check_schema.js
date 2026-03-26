const db = require('./OutfitSystem/config/db');

async function checkSchema() {
    console.log('开始检查 Schema...');
    try {
        const [users] = await db.query('SHOW CREATE TABLE users');
        console.log('--- Users Table ---');
        console.log(users[0]['Create Table']);
        
        const [outfits] = await db.query('SHOW CREATE TABLE outfits');
        console.log('--- Outfits Table ---');
        console.log(outfits[0]['Create Table']);
        
    } catch (e) {
        console.error('查询出错:', e);
    } finally {
        process.exit(0);
    }
}

checkSchema();
