let mysql = require('mysql2');

let pool = mysql.createPool( {
    host: 'localhost',
    user: 'root',
    password: 'MySQLpsw9027',
    database: 'Web-scraper'
} ).promise()

// const result = async () => {
//     const [data] = await pool.query('SELECT * FROM resultTable');
//     console.log(data);
// }
// console.log(result); 
// result();

module.exports = pool;