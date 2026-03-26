const db = require('./config/db');

async function checkAndFixSchema() {
    const connection = await db.getConnection();
    try {
        console.log('Checking user_profiles schema...');
        
        // 1. Get current columns
        const [columns] = await connection.query('SHOW COLUMNS FROM user_profiles');
        const existingColumns = columns.map(col => col.Field);
        
        // 2. Define required columns
        const requiredColumns = [
            { name: 'nickname', type: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'avatar_url', type: 'VARCHAR(500) DEFAULT NULL' },
            { name: 'height', type: 'FLOAT DEFAULT NULL' },
            { name: 'weight', type: 'FLOAT DEFAULT NULL' },
            { name: 'body_shape', type: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'style_preference', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'skin_tone', type: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'signature', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'gender', type: 'VARCHAR(20) DEFAULT NULL' }, // MALE, FEMALE, SECRET, OTHER
            { name: 'birthday', type: 'VARCHAR(20) DEFAULT NULL' }     // Modified: Store as 'YYYY-MM-DD' string
        ];

        // 3. Add missing columns
        for (const col of requiredColumns) {
            if (!existingColumns.includes(col.name)) {
                console.log(`Adding missing column: ${col.name}`);
                await connection.query(`ALTER TABLE user_profiles ADD COLUMN ${col.name} ${col.type}`);
            } else {
                console.log(`Column exists: ${col.name}`);
            }
        }

        console.log('Schema check completed.');

    } catch (err) {
        console.error('Schema check failed:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

checkAndFixSchema();
