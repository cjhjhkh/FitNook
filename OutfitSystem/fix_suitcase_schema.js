const db = require('./config/db');

async function fix() {
    try {
        console.log('Checking table suitcases...');
        const [rows] = await db.query("SHOW TABLES LIKE 'suitcases'");
        
        if (rows.length === 0) {
            console.log('Table suitcases not found. Creating...');
            await db.query(`
                CREATE TABLE suitcases (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    destination VARCHAR(255) DEFAULT '',
                    start_date DATE DEFAULT NULL,
                    end_date DATE DEFAULT NULL,
                    items JSON DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
            console.log('Table created.');
        } else {
            console.log('Table suitcases exists. Checking columns...');
            const [cols] = await db.query("SHOW COLUMNS FROM suitcases");
            const fields = cols.map(c => c.Field);
            
            const checks = [
                { name: 'destination', sql: "ALTER TABLE suitcases ADD COLUMN destination VARCHAR(255) DEFAULT ''" },
                { name: 'start_date', sql: "ALTER TABLE suitcases ADD COLUMN start_date DATE DEFAULT NULL" },
                { name: 'end_date', sql: "ALTER TABLE suitcases ADD COLUMN end_date DATE DEFAULT NULL" },
                { name: 'items', sql: "ALTER TABLE suitcases ADD COLUMN items JSON DEFAULT NULL" }
            ];

            for (const check of checks) {
                if (!fields.includes(check.name)) {
                    console.log(`Missing column ${check.name}, adding...`);
                    await db.query(check.sql);
                }
            }
        }
        console.log('✅ Suitcases table schema is ready.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

fix();
