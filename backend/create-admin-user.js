
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
require("dotenv").config();

async function createAdmin() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 3306
    });

    try {
        const username = "admin1";
        const password = "Admin@123";
        const hashedPassword = await bcrypt.hash(password, 10);

        const [existing] = await connection.execute(
            "SELECT id FROM users WHERE username = ?",
            [username]
        );

        if (existing.length > 0) {
            console.log("Admin account already exists.");
            return;
        }

        await connection.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            [username, hashedPassword, "Admin"]
        );

        console.log("Admin account created successfully!");
        console.log("Username: admin1");
        console.log("Password: Admin@123");
    } finally {
        await connection.end();
    }
}

createAdmin().catch(error => {
    console.error("Error creating Admin account:", error.message);
    process.exitCode = 1;
});
