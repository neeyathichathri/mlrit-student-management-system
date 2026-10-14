console.log("script.js loaded successfully");
function goToLogin(role) {
    window.location.href = "login.html?role=" + encodeURIComponent(role);
}

const params = new URLSearchParams(window.location.search);
const selectedRole = params.get("role");

const roleNames = {
    Student: "Student Login",
    Faculty: "Faculty Login",
    Admin: "Admin Login"
};

const dashboardPages = {
    Student: "student-dashboard.html",
    Faculty: "faculty-dashboard.html",
    Admin: "admin-dashboard.html"
};

const heading = document.getElementById("roleHeading") ||
                document.getElementById("loginTitle");

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

if (heading) {
    heading.textContent = roleNames[selectedRole] || "MLRIT Login";
}

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        message.textContent = "Logging in...";

        try {
            const response = await fetch("http://localhost:3000/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                message.textContent = data.message || "Login failed.";
                return;
            }

            const actualRole = String(data.user.role || "").trim().toLowerCase();
            const chosenRole = String(selectedRole || "").trim().toLowerCase();

            if (!dashboardPages[data.user.role]) {
                message.textContent = "Invalid user role.";
                return;
            }

            if (actualRole !== chosenRole) {
                message.textContent =
                    "Please go back to the home page and select the correct role.";
                return;
            }

            sessionStorage.setItem("token", data.token);
            sessionStorage.setItem("user", JSON.stringify(data.user));

            window.location.href = dashboardPages[data.user.role];

        } catch (error) {
            console.error("Login connection error:", error);
            message.textContent =
                "Cannot connect to the server. Check the browser Console for details.";
        }
    });
}

async function protectDashboard(requiredRole) {
    const token = sessionStorage.getItem("token");
    const savedUser = sessionStorage.getItem("user");

    if (!token || !savedUser) {
        window.location.href = "login.html?role=" +
            encodeURIComponent(requiredRole);
        return;
    }

    try {
        const response = await fetch("http://localhost:3000/api/profile", {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (!response.ok) {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("user");
            window.location.href = "login.html?role=" +
                encodeURIComponent(requiredRole);
            return;
        }

        const data = await response.json();

        if (data.user.role !== requiredRole) {
            alert("Access denied! You cannot access this dashboard.");
            window.location.href = "index.html";
        }

    } catch (error) {
        console.error("Dashboard connection error:", error);
        alert("Cannot connect to the server. Please check the backend.");
    }
}
