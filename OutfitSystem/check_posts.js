const db = require('./config/db');

async function check() {
    try {
        const [posts] = await db.query('SELECT id, content, image_url FROM social_posts LIMIT 5');
        console.log('Current Posts:', JSON.stringify(posts, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
