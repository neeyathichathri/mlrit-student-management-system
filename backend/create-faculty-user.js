
const bcrypt = require("bcrypt");
require("dotenv").config();
const db = require("./db");

async function createFaculty() {
    try {
        const username = "faculty1";
        const password = "Faculty@123";
        const passwordHash = await bcrypt.hash(password, 10);

        await db.execute(
            `INSERT INTO users (username, password_hash, role)
             VALUES (?, ?, 'Faculty')`,
            [username, passwordHash]
        );

        console.log("Faculty account created successfully!");
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            console.log("Faculty account already exists.");
        } else {
            console.error("Error:", error.message);
        }
    } finally {
        await db.end();
    }
}

createFaculty();
