const db = require('./OutfitSystem/config/db');

async function check() {
    try {
        console.log('Checking tables...');
        const tables = ['users', 'user_profiles', 'social_posts', 'clothes', 'outfits', 'favorites'];
        for (const t of tables) {
            try {
                const [cols] = await db.query(`DESCRIBE ${t}`);
                console.log(`\nTable ${t}:`);
                console.log(cols.map(c => `${c.Field} (${c.Type})`).join(', '));
            } catch (e) {
                console.log(`\nTable ${t} NOT FOUND or Error: ${e.message}`);
            }
        }
    } catch (err) {
        console.error('Script error:', err);
    } finally {
        // Force exit after a delay to ensure logs are flushed
        setTimeout(() => process.exit(0), 1000);
    }
}
check();
