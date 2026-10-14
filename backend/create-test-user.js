
const bcrypt = require("bcrypt");
const db = require("./db");

async function createTestUser() {
    try {
        const username = "student1";
        const password = "Student@123";
        const role = "Student";

        const passwordHash = await bcrypt.hash(password, 10);

        await db.execute(
            `INSERT INTO users (username, password_hash, role)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE
             password_hash = VALUES(password_hash),
             role = VALUES(role)`,
            [username, passwordHash, role]
        );

        console.log("Test student account created successfully.");
        console.log("Username: student1");
        console.log("Password: Student@123");
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await db.end();
    }
}

createTestUser();
