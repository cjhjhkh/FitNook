
const db = require('./OutfitSystem/config/db');

async function check() {
    try {
        const [rows] = await db.query("DESCRIBE users");
        console.log('Users Table Structure:', JSON.stringify(rows.find(r => r.Field === 'id'), null, 2));
        
        const [posts] = await db.query("DESCRIBE social_posts");
        console.log('Social Posts Structure:', JSON.stringify(posts, null, 2));

        const [calendar] = await db.query("DESCRIBE outfit_calendar");
        console.log('Calendar Structure:', JSON.stringify(calendar, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();

