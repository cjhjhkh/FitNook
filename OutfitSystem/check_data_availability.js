const db = require('./config/db');

async function check() {
    try {
        const [users] = await db.query('SELECT id, account FROM users LIMIT 5');
        const [outfits] = await db.query('SELECT id, name FROM outfits LIMIT 5');
        console.log('Users:', JSON.stringify(users));
        console.log('Outfits:', JSON.stringify(outfits));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
