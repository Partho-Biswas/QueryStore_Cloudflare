# QueryStore

<img width="256" height="256" style="border: 2px solid grey;" alt="image" src="https://cdn-icons-png.flaticon.com/512/1265/1265531.png" />

QueryStore is a secure and efficient web application designed for developers and data professionals to save, manage, and share text-based queries or code snippets. It provides a personalized workspace to store your frequently used SQL queries, code snippets, or any text-based notes, complete with tagging, search functionality, and secure sharing options.

## Live Demo
Experience QueryStore live: [https://querystore.onrender.com](https://querystore.onrender.com)

---

## ✨ Features

*   **User Authentication:** Secure sign-up and login system using JWT (JSON Web Tokens).
*   **CRUD Operations:** Create, Read, Update, and Delete your personal queries.
*   **Tagging System:** Organize queries with multiple tags for easy categorization and filtering.
*   **Full-Text Search:** Quickly find queries by searching their title or content.
*   **Code Highlighting:** Syntax highlighting for stored queries (using Highlight.js) to improve readability.
*   **Shareable Links:** Generate unique, public links for individual queries to share them securely.
*   **Responsive Design:** User-friendly interface built with Bootstrap 5.

---

## 🚀 Technologies Used

**Frontend:**
*   **HTML5, CSS3, JavaScript:** Core web technologies.
*   **Bootstrap 5:** For responsive and modern UI components.
*   **Highlight.js:** For syntax highlighting of code snippets.

**Backend:**
*   **Node.js:** JavaScript runtime environment.
*   **Express.js:** Fast, unopinionated, minimalist web framework for Node.js.
*   **Mongoose:** MongoDB object data modeling (ODM) for Node.js.

**Database:**
*   **MongoDB Atlas:** Cloud-hosted NoSQL database.

**Authentication & Security:**
*   **bcrypt:** For hashing user passwords.
*   **jsonwebtoken:** For creating and verifying JSON Web Tokens for authentication.
*   **CORS:** Middleware to enable Cross-Origin Resource Sharing.

---

## 📐 Architecture

QueryStore follows a classic client-server architecture:

1.  **Frontend (Client-side):** A single-page application built with plain HTML, CSS, and JavaScript. It communicates with the backend API to perform all operations.
2.  **Backend (Server-side):** A Node.js Express server that exposes a RESTful API. It handles:
    *   User authentication (signup, login).
    *   CRUD operations for queries.
    *   Interaction with the MongoDB database.
    *   Token-based authorization for protected routes.
3.  **Database:** MongoDB Atlas stores user information and query data.

---

## 📸 Screenshots

### Login 
<img width="1080" alt="image" style="border: 2px solid grey;" src="https://github.com/user-attachments/assets/8d1abe20-b7c8-49e4-a89c-24e00eced50f" />
*(Screenshot of `auth.html (for Login)`)*

### Signup Page
<img width="1080" alt="image" style="border: 2px solid grey;" src="https://github.com/user-attachments/assets/dd69521a-def0-4e46-ac2c-2731b568051e" />
*(Screenshot of `auth.html (for Signup)`)*

### Main Dashboard (Query List)
<img width="1080" alt="image" style="border: 2px solid grey;" src="https://github.com/user-attachments/assets/5d6ab980-b331-443c-95a7-4caf3f5fff31" />
*(Screenshot of `index.html` showing queries, tags, and search)*

### Edit Query Modal
<img width="500" alt="image" style="border: 2px solid grey;" src="https://github.com/user-attachments/assets/41d8636c-80e1-4891-9258-96b3ccc25eec" />
*(Screenshot of the edit modal pop-up)*

### Shareable Query View
<img width="400" alt="image" style="border: 2px solid grey;" src="https://github.com/user-attachments/assets/13695e39-2911-4a21-b352-1eb9e718bbe4" />
<img width="1080" alt="image" style="border: 2px solid grey;" src="https://github.com/user-attachments/assets/da8b53b5-abc0-4b2c-9bbd-57dea9426ed9" />

*(Screenshot of `share.html` displaying a public query)*

---

## 💻 Local Development Setup

Follow these steps to get QueryStore up and running on your local machine.

### Prerequisites

*   **Node.js (>=18.0.0):** Download and install from [nodejs.org](https://nodejs.org/).
*   **A code editor:** (e.g., VS Code).

### 1. Clone the Repository

```bash
git clone https://github.com/Partho-Biswas/QueryStore
cd QueryStore
```

### 2. Install Dependencies

In the project root directory, run:

```bash
npm install
```

### 3. Set Up MongoDB Atlas

QueryStore requires a MongoDB database. We recommend using [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) for a free cloud-hosted solution.

1.  **Create an Account:** Sign up for a free account.
2.  **Create a Free Cluster:** Follow the Atlas UI to create a new "Shared" (M0) cluster.
3.  **Configure Access:**
    *   Create a new **Database User** with a strong password.
    *   Configure **Network Access** to "Allow Access From Anywhere" (`0.0.0.0/0`) for development purposes (be more restrictive in production).
    *   **Get Connection String:** Obtain your unique connection string (looks like `mongodb+srv://user:<password>@cluster.xxxxx.mongodb.net/...`).

### 4. Configure Environment Variables

Create a file named `.env` in the root of your project directory and add the following:

```env
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secret_jwt_key
```
*   Replace `your_mongodb_atlas_connection_string` with the URI obtained from MongoDB Atlas. Remember to substitute `<password>` in the URI with your actual database user password.
*   Replace `your_secret_jwt_key` with a long, random string. You can generate one using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

**Important:** Ensure `.env` is included in your `.gitignore` to prevent sensitive information from being committed to version control.

---

## ▶️ Running the Application

### 1. Start the Backend Server

Open a terminal in the project root and run:

```bash
npm start
# or node server.js
```
You should see console messages indicating the server is running on `http://localhost:3000` and connected to MongoDB Atlas.

### 2. Launch the Frontend

Open `auth.html` or `index.html` directly in your web browser. The frontend will communicate with your local backend server.

---

## 🧪 Testing

The project includes unit tests for the backend. To run them:

```bash
npm test
```

---

## ☁️ Deployment Notes

This is a full-stack application and requires a hosting environment that supports Node.js. An example deployment can be found on Render: [https://querystore.onrender.com](https://querystore.onrender.com). It cannot be deployed on static-only hosts like GitHub Pages. When deploying, ensure your `MONGO_URI` and `JWT_SECRET` environment variables are securely configured in your hosting service's dashboard.

---

## 📄 License

This project is licensed under the ISC License. See the `LICENSE` file for details.

---

## © Copyright 2026 "Partho Biswas"
