const db = require("./db");

async function testConnection() {
    try {
        const connection = await db.getConnection();
        console.log("MySQL database connected successfully!");

        const [rows] = await connection.query("SHOW TABLES");
        console.log("Tables in database:", rows);

        connection.release();
        await db.end();
    } catch (error) {
        console.error("Database connection failed:", error.message);
        await db.end();
        process.exitCode = 1;
    }
}

testConnection();