const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./db");
const { authenticateToken, allowRoles } = require("./auth");

const app = express();
const path = require("path");
const pool = require("./db");
app.get("/api/db-test", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT 1 AS result");
        res.json({
            success: true,
            message: "Database connection successful!",
            result: rows[0].result
        });
    } catch (error) {
        console.error("Database test failed:", error.message);
        res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

app.use(express.static(path.join(__dirname, "../frontend")));
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Home API
app.get("/", (req, res) => {
    res.send("MLRIT Student Management System Backend is running!");
});

// Test API
app.get("/api/test", (req, res) => {
    res.json({
        message: "Backend API is working successfully!"
    });
});

// Login API
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Please enter both username and password."
            });
        }

        const [users] = await db.execute(
            "SELECT id, username, password_hash, role FROM users WHERE username = ?",
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

        const user = users[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                message: "Server configuration error."
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            message: "Login successful!",
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({
            message: "Something went wrong. Please try again."
        });
    }
});

// General Profile API
app.get(
    "/api/profile",
    authenticateToken,
    (req, res) => {
        res.json({
            message: "You are logged in successfully.",
            user: req.user
        });
    }
);

// Student Profile API
app.get(
    "/api/student/profile",
    authenticateToken,
    allowRoles("Student"),
    async (req, res) => {
        try {
            const [students] = await db.execute(
                `SELECT student_id, full_name, email, department, year_of_study
                 FROM students
                 WHERE user_id = ?`,
                [req.user.id]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    message: "Student profile not found."
                });
            }

            res.json(students[0]);
        } catch (error) {
            console.error("Student profile error:", error.message);
            res.status(500).json({
                message: "Unable to fetch student profile."
            });
        }
    }
);

// Student Marks API

// Student Marks API
app.get(
    "/api/student/marks",
    authenticateToken,
    allowRoles("Student"),
    async (req, res) => {
        try {
            const [students] = await db.execute(
                "SELECT id FROM students WHERE user_id = ?",
                [req.user.id]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    message: "Student profile not found."
                });
            }

            const [marks] = await db.execute(
                `SELECT
                    subject,
                    marks_obtained,
                    max_marks,
                    academic_year,
                    semester
                 FROM marks
                 WHERE student_id = ?
                 ORDER BY academic_year, semester, subject`,
                [students[0].id]
            );

            res.json(marks);
        } catch (error) {
            console.error("Student marks error:", error);
            res.status(500).json({
                message: "Unable to fetch student marks."
            });
        }
    }
);


// Student Attendance API
app.get(
    "/api/student/attendance",
    authenticateToken,
    allowRoles("Student"),
    async (req, res) => {
        try {
            const [students] = await db.execute(
                "SELECT id FROM students WHERE user_id = ?",
                [req.user.id]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    message: "Student profile not found."
                });
            }

            const [attendance] = await db.execute(
                `SELECT
                    subject,
                    classes_attended,
                    total_classes,
                    academic_year,
                    semester
                 FROM attendance
                 WHERE student_id = ?
                 ORDER BY academic_year, semester, subject`,
                [students[0].id]
            );

            const result = attendance.map(item => ({
                subject: item.subject,
                classes_attended: item.classes_attended,
                total_classes: item.total_classes,
                academic_year: item.academic_year,
                semester: item.semester,
                percentage: Number(item.total_classes) > 0
                    ? Math.round(
                        Number(item.classes_attended) /
                        Number(item.total_classes) * 100
                    )
                    : 0
            }));

            res.json(result);
        } catch (error) {
            console.error("Student attendance error:", error);
            res.status(500).json({
                message: "Unable to fetch student attendance."
            });
        }
    }
);

// Faculty Students API - Faculty and Admin
app.get(
    "/api/faculty/students",
    authenticateToken,
    allowRoles("Faculty", "Admin"),
    async (req, res) => {
        try {
            const [students] = await db.execute(
                `SELECT id, student_id, full_name, email,
                        department, year_of_study
                 FROM students
                 ORDER BY student_id`
            );

            res.json(students);
        } catch (error) {
            console.error("Faculty students error:", error.message);
            res.status(500).json({
                message: "Unable to fetch students."
            });
        }
    }
);

// Faculty Manage Marks API
app.post("/api/faculty/marks", authenticateToken, allowRoles("Faculty"), async (req, res) => {
  try {
    const {
      student_id,
      subject,
      marks_obtained,
      max_marks,
      academic_year,
      semester
    } = req.body;

    if (
      !student_id ||
      !subject ||
      academic_year === undefined ||
      semester === undefined ||
      marks_obtained === undefined ||
      max_marks === undefined
    ) {
      return res.status(400).json({ message: "Please fill in all fields." });
    }

    const year = Number(academic_year);
    const sem = Number(semester);
    const marks = Number(marks_obtained);
    const max = Number(max_marks);

    if (![1, 2, 3].includes(year) || ![1, 2].includes(sem)) {
      return res.status(400).json({ message: "Invalid academic year or semester." });
    }

    if (
      !Number.isFinite(marks) ||
      !Number.isFinite(max) ||
      max <= 0 ||
      marks < 0 ||
      marks > max
    ) {
      return res.status(400).json({
        message: "Marks must be between 0 and the maximum marks."
      });
    }

    const [students] = await pool.query(
      "SELECT id, year_of_study FROM students WHERE student_id = ?",
      [student_id]
    );

    if (students.length === 0) {
      return res.status(404).json({ message: "Student not found." });
    }

    const student = students[0];

    if (Number(student.year_of_study) !== year) {
      return res.status(400).json({
        message: "The selected academic year does not match the student's current year."
      });
    }

    const [existingMarks] = await pool.query(
      `SELECT id
       FROM marks
       WHERE student_id = ?
         AND subject = ?
         AND academic_year = ?
         AND semester = ?
       ORDER BY id ASC`,
      [student.id, subject, year, sem]
    );

    if (existingMarks.length > 0) {
      const existingId = existingMarks[0].id;

      await pool.query(
        `UPDATE marks
         SET marks_obtained = ?, max_marks = ?
         WHERE id = ?`,
        [marks, max, existingId]
      );

      if (existingMarks.length > 1) {
        await pool.query(
          `DELETE FROM marks
           WHERE student_id = ?
             AND subject = ?
             AND academic_year = ?
             AND semester = ?
             AND id != ?`,
          [student.id, subject, year, sem, existingId]
        );
      }

      return res.json({
        message: "Existing marks updated successfully."
      });
    }

    await pool.query(
      `INSERT INTO marks
       (student_id, subject, marks_obtained, max_marks, academic_year, semester)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [student.id, subject, marks, max, year, sem]
    );

    res.status(201).json({
      message: "Marks added successfully."
    });

  } catch (error) {
    console.error("Error adding or updating marks:", error);
    res.status(500).json({
      message: "Failed to add or update marks."
    });
  }
});



// Faculty Manage Attendance API
app.post("/api/faculty/attendance", authenticateToken, allowRoles("Faculty"), async (req, res) => {
  try {
    const {
      student_id,
      subject,
      classes_attended,
      total_classes,
      academic_year,
      semester
    } = req.body;

    if (
      !student_id ||
      !subject ||
      academic_year === undefined ||
      semester === undefined ||
      classes_attended === undefined ||
      total_classes === undefined
    ) {
      return res.status(400).json({ message: "Please fill in all fields." });
    }

    const year = Number(academic_year);
    const sem = Number(semester);
    const attended = Number(classes_attended);
    const total = Number(total_classes);

    if (![1, 2, 3].includes(year) || ![1, 2].includes(sem)) {
      return res.status(400).json({ message: "Invalid academic year or semester." });
    }

    if (
      !Number.isInteger(attended) ||
      !Number.isInteger(total) ||
      attended < 0 ||
      total <= 0 ||
      attended > total
    ) {
      return res.status(400).json({
        message: "Enter valid attendance values. Classes attended cannot exceed total classes."
      });
    }

    const [students] = await pool.query(
      "SELECT id, year_of_study FROM students WHERE student_id = ?",
      [student_id]
    );

    if (students.length === 0) {
      return res.status(404).json({ message: "Student not found." });
    }

    if (Number(students[0].year_of_study) !== year) {
      return res.status(400).json({
        message: "The selected academic year does not match the student's current year."
      });
    }

    await pool.query(
      `INSERT INTO attendance
       (student_id, subject, classes_attended, total_classes, academic_year, semester)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [students[0].id, subject, attended, total, year, sem]
    );

    res.status(201).json({ message: "Attendance added successfully." });
  } catch (error) {
    console.error("Error adding attendance:", error);
    res.status(500).json({ message: "Failed to add attendance." });
  }
});


// Admin Faculty List API
app.get(
    "/api/admin/faculty",
    authenticateToken,
    allowRoles("Admin"),
    async (req, res) => {
        try {
            const [faculty] = await db.execute(
                `SELECT faculty_id, full_name, email, department
                 FROM faculty
                 ORDER BY faculty_id`
            );

            res.json(faculty);
        } catch (error) {
            console.error("Error fetching faculty:", error.message);
            res.status(500).json({
                message: "Unable to fetch faculty records."
            });
        }
    }
);
app.get(
    "/api/admin/students/next-id",
    authenticateToken,
    allowRoles("Admin"),
    async (req, res) => {
        try {
            const year = Number(req.query.year);

            if (!Number.isInteger(year) || year < 1 || year > 4) {
                return res.status(400).json({
                    message: "Year must be between 1 and 4."
                });
            }

            const [rows] = await db.execute(
                `SELECT student_id
                 FROM students
                 WHERE student_id REGEXP ?
                 ORDER BY CAST(SUBSTRING(student_id, 6, 4) AS UNSIGNED) DESC
                 LIMIT 1`,
                [`^MLRIT${year}[0-9]{4}$`]
            );

            let nextNumber = 1;

            if (rows.length > 0) {
                nextNumber =
                    Number(rows[0].student_id.substring(6)) + 1;
            }

            if (nextNumber > 9999) {
                return res.status(400).json({
                    message: "Student ID limit reached for this year."
                });
            }

            const studentId =
                "MLRIT" + year + String(nextNumber).padStart(4, "0");

            res.json({ student_id: studentId });

        } catch (error) {
            console.error("Student ID preview error:", error.message);

            res.status(500).json({
                message: "Unable to generate Student ID preview."
            });
        }
    }
);

// Admin Add Student API

app.post(
    "/api/admin/students",
    authenticateToken,
    allowRoles("Admin"),
    async (req, res) => {
        let connection;

        try {
            const {
                username,
                password,
                full_name,
                email,
                year_of_study
            } = req.body;

            if (
                typeof username !== "string" || !username.trim() ||
                typeof password !== "string" || !password ||
                typeof full_name !== "string" || !full_name.trim() ||
                typeof email !== "string" || !email.trim() ||
                year_of_study === undefined ||
                year_of_study === null
            ) {
                return res.status(400).json({
                    message: "Please fill in all student details."
                });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    message: "Password must contain at least 8 characters."
                });
            }

            const year = Number(year_of_study);

            if (!Number.isInteger(year) || year < 1 || year > 4) {
                return res.status(400).json({
                    message: "Year of study must be between 1 and 4."
                });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                return res.status(400).json({
                    message: "Please enter a valid email address."
                });
            }

            connection = await db.getConnection();
            await connection.beginTransaction();


            const [lastStudents] = await connection.execute(
                `SELECT student_id
                 FROM students
                 WHERE student_id REGEXP ?
                 ORDER BY CAST(SUBSTRING(student_id, 6, 4) AS UNSIGNED) DESC
                 LIMIT 1`,
                [`^MLRIT${year}[0-9]{4}$`]
            );

            let nextNumber = 1;

            if (lastStudents.length > 0) {
                nextNumber =
                    Number(lastStudents[0].student_id.substring(6)) + 1;
            }

            if (nextNumber > 9999) {
                await connection.rollback();

                return res.status(400).json({
                    message: "The student ID limit has been reached for this year."
                });
            }

            const studentId =
                "MLRIT" + year + String(nextNumber).padStart(4, "0");

            const passwordHash = await bcrypt.hash(password, 10);

            const [userResult] = await connection.execute(
                `INSERT INTO users (username, password_hash, role)
                 VALUES (?, ?, 'Student')`,
                [username.trim(), passwordHash]
            );

            await connection.execute(
                `INSERT INTO students
                 (user_id, student_id, full_name, email, department, year_of_study)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userResult.insertId,
                    studentId,
                    full_name.trim(),
                    email.trim(),
                    "CSE",
                    year
                ]
            );

            await connection.query("UNLOCK TABLES");
            await connection.commit();

            res.status(201).json({
                message: "Student added successfully!",
                student_id: studentId
            });

        } catch (error) {
            if (connection) {
                try {
                    await connection.query("UNLOCK TABLES");
                } catch (unlockError) {
                    // Ignore unlock errors during cleanup.
                }

                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    // Ignore rollback errors during cleanup.
                }
            }

            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Username, email, or student ID already exists."
                });
            }

            console.error("Add student error:", error.message);

            res.status(500).json({
                message: "Unable to add student. Please try again."
            });

        } finally {
            if (connection) connection.release();
        }
    }
);


// Admin Update Student API
app.put(
    "/api/admin/students/:id",
    authenticateToken,
    allowRoles("Admin"),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { full_name, email, department, year_of_study } = req.body;

            if (
                !Number.isInteger(Number(id)) ||
                Number(id) < 1 ||
                typeof full_name !== "string" || !full_name.trim() ||
                typeof email !== "string" || !email.trim() ||
                typeof department !== "string" || !department.trim() ||
                year_of_study === undefined ||
                year_of_study === null
            ) {
                return res.status(400).json({
                    message: "Please enter valid student details."
                });
            }

            const year = Number(year_of_study);

            if (!Number.isInteger(year) || year < 1 || year > 4) {
                return res.status(400).json({
                    message: "Year of study must be between 1 and 4."
                });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                return res.status(400).json({
                    message: "Please enter a valid email address."
                });
            }

            const [result] = await db.execute(
                `UPDATE students
                 SET full_name = ?, email = ?, department = ?, year_of_study = ?
                 WHERE id = ?`,
                [full_name.trim(), email.trim(), department.trim(), year, Number(id)]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Student not found."
                });
            }

            res.json({
                message: "Student updated successfully!"
            });
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "This email address is already in use."
                });
            }

            console.error("Update student error:", error.message);
            res.status(500).json({
                message: "Unable to update student. Please try again."
            });
        }
    }
);

// Admin Delete Student API
app.delete(
    "/api/admin/students/:id",
    authenticateToken,
    allowRoles("Admin"),
    async (req, res) => {
        let connection;

        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id < 1) {
                return res.status(400).json({
                    message: "Invalid student ID."
                });
            }

            connection = await db.getConnection();
            await connection.beginTransaction();

            const [students] = await connection.execute(
                "SELECT id, user_id FROM students WHERE id = ? FOR UPDATE",
                [id]
            );

            if (students.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    message: "Student not found."
                });
            }

            const student = students[0];

            await connection.execute(
                "DELETE FROM marks WHERE student_id = ?",
                [student.id]
            );

            await connection.execute(
                "DELETE FROM attendance WHERE student_id = ?",
                [student.id]
            );

            await connection.execute(
                "DELETE FROM students WHERE id = ?",
                [student.id]
            );

            await connection.execute(
                "DELETE FROM users WHERE id = ? AND role = 'Student'",
                [student.user_id]
            );

            await connection.commit();

            res.json({
                message: "Student and associated academic records deleted successfully."
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error("Rollback error:", rollbackError.message);
                }
            }

            console.error("Delete student error:", error.message);
            res.status(500).json({
                message: "Unable to delete student."
            });
        } finally {
            if (connection) connection.release();
        }
    }
);

// Admin Add Faculty API
app.post(
    "/api/admin/faculty",
    authenticateToken,
    allowRoles("Admin"),
    async (req, res) => {
        let connection;

        try {
            const {
                username,
                password,
                faculty_id,
                full_name,
                email,
                department
            } = req.body;

            if (
                typeof username !== "string" || !username.trim() ||
                typeof password !== "string" || !password ||
                typeof faculty_id !== "string" || !faculty_id.trim() ||
                typeof full_name !== "string" || !full_name.trim() ||
                typeof email !== "string" || !email.trim() ||
                typeof department !== "string" || !department.trim()
            ) {
                return res.status(400).json({
                    message: "Please fill in all faculty details."
                });
            }

            if (password.length < 8) {
                return res.status(400).json({
                    message: "Password must contain at least 8 characters."
                });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                return res.status(400).json({
                    message: "Please enter a valid email address."
                });
            }

            const passwordHash = await bcrypt.hash(password, 10);

            connection = await db.getConnection();
            await connection.beginTransaction();

            const [userResult] = await connection.execute(
                `INSERT INTO users (username, password_hash, role)
                 VALUES (?, ?, 'Faculty')`,
                [username.trim(), passwordHash]
            );

            await connection.execute(
                `INSERT INTO faculty
                 (user_id, faculty_id, full_name, email, department)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    userResult.insertId,
                    faculty_id.trim(),
                    full_name.trim(),
                    email.trim(),
                    department.trim()
                ]
            );

            await connection.commit();

            res.status(201).json({
                message: "Faculty member added successfully."
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error("Rollback error:", rollbackError.message);
                }
            }

            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "Username, Faculty ID, or another unique field already exists."
                });
            }

            console.error("Add faculty error:", error.message);
            res.status(500).json({
                message: "Unable to add faculty member."
            });
        } finally {
            if (connection) connection.release();
        }
    }
);

// Admin Update Faculty API
app.put(
    "/api/admin/faculty/:id",
    authenticateToken,
    allowRoles("Admin"),
    async (req, res) => {
        try {
            const facultyId = req.params.id;
            const { new_faculty_id, full_name, email, department } = req.body;

            if (
                !facultyId.trim() ||
                typeof new_faculty_id !== "string" || !new_faculty_id.trim() ||
                typeof full_name !== "string" || !full_name.trim() ||
                typeof email !== "string" || !email.trim() ||
                typeof department !== "string" || !department.trim()
            ) {
                return res.status(400).json({
                    message: "Please enter all faculty details."
                });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                return res.status(400).json({
                    message: "Please enter a valid email address."
                });
            }

            const [result] = await db.execute(
                `UPDATE faculty
                 SET faculty_id = ?, full_name = ?, email = ?, department = ?
                 WHERE faculty_id = ?`,
                [
                    new_faculty_id.trim(),
                    full_name.trim(),
                    email.trim(),
                    department.trim(),
                    facultyId
                ]
            );

            if (result.affectedRows === 0) {
                const [existing] = await db.execute(
                    "SELECT faculty_id FROM faculty WHERE faculty_id = ?",
                    [new_faculty_id.trim()]
                );

                if (existing.length === 0) {
                    return res.status(404).json({
                        message: "Faculty member not found."
                    });
                }
            }

            res.json({
                message: "Faculty details updated successfully."
            });
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    message: "This Faculty ID or email is already in use."
                });
            }

            console.error("Update faculty error:", error.message);
            res.status(500).json({
                message: "Unable to update faculty details."
            });
        }
    }
);

// Admin Delete Faculty API
app.delete(
    "/api/admin/faculty/:id",
    authenticateToken,
    allowRoles("Admin"),
    async (req, res) => {
        let connection;

        try {
            const facultyId = req.params.id;

            connection = await db.getConnection();
            await connection.beginTransaction();

            const [facultyMembers] = await connection.execute(
                "SELECT user_id FROM faculty WHERE faculty_id = ? FOR UPDATE",
                [facultyId]
            );

            if (facultyMembers.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    message: "Faculty member not found."
                });
            }

            const userId = facultyMembers[0].user_id;

            await connection.execute(
                "DELETE FROM faculty WHERE faculty_id = ?",
                [facultyId]
            );

            await connection.execute(
                "DELETE FROM users WHERE id = ? AND role = 'Faculty'",
                [userId]
            );

            await connection.commit();

            res.json({
                message: "Faculty member and linked login deleted successfully."
            });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error("Rollback error:", rollbackError.message);
                }
            }

            console.error("Delete faculty error:", error.message);
            res.status(500).json({
                message: "Unable to delete faculty member."
            });
        } finally {
            if (connection) connection.release();
        }
    }
);

// Admin Test API
app.get(
    "/api/admin-test",
    authenticateToken,
    allowRoles("Admin"),
    (req, res) => {
        res.json({
            message: "Admin access granted."
        });
    }
);

// Admin View Student Marks API
app.get(
    "/api/admin/records/marks/:studentId",
    authenticateToken,
    allowRoles("Admin"),
    async (req, res) => {
        try {
            const { studentId } = req.params;

            const [students] = await db.execute(
                "SELECT id FROM students WHERE student_id = ?",
                [studentId]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    message: "Student not found."
                });
            }

            const [marks] = await db.execute(
                `SELECT subject, marks_obtained, max_marks
                 FROM marks
                 WHERE student_id = ?
                 ORDER BY subject`,
                [students[0].id]
            );

            res.json(marks);
        } catch (error) {
            console.error("Admin marks error:", error.message);
            res.status(500).json({
                message: "Unable to fetch student marks."
            });
        }
    }
);

// Admin View Student Attendance API
app.get(
    "/api/admin/records/attendance/:studentId",
    authenticateToken,
    allowRoles("Admin"),
    async (req, res) => {
        try {
            const { studentId } = req.params;

            const [students] = await db.execute(
                "SELECT id FROM students WHERE student_id = ?",
                [studentId]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    message: "Student not found."
                });
            }

            const [attendance] = await db.execute(
                `SELECT subject, classes_attended, total_classes
                 FROM attendance
                 WHERE student_id = ?
                 ORDER BY subject`,
                [students[0].id]
            );

            const result = attendance.map(item => ({
                subject: item.subject,
                classes_attended: item.classes_attended,
                total_classes: item.total_classes,
                percentage: Number(item.total_classes) > 0
                    ? Math.round(
                        Number(item.classes_attended) /
                        Number(item.total_classes) * 100
                    )
                    : 0
            }));

            res.json(result);
        } catch (error) {
            console.error("Admin attendance error:", error.message);
            res.status(500).json({
                message: "Unable to fetch student attendance."
            });
        }
    }
);

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
