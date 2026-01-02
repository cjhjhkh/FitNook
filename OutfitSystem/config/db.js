const mysql = require('mysql2');

const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'cmmm',
  database: 'wardrobe_db',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool.promise();
console.log('✅ 数据库连接池初始化成功');