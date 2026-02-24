# 🗃️ QueryStore

QueryStore is a modern, edge-native SQL snippet manager built for speed and simplicity. It allows developers to store, organize, and share their most-used SQL queries in a secure, serverless environment.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Cloudflare_Pages-orange.svg)
![Database](https://img.shields.io/badge/database-Cloudflare_D1-blue.svg)

## 🚀 Features

- **Edge-Native Performance**: Powered by Cloudflare Pages and D1 for ultra-low latency worldwide.
- **Secure Authentication**: JWT-based auth with `bcryptjs` password hashing.
- **SQL Intelligence**: Built-in syntax highlighting for clear query readability.
- **Smart Tagging**: Organize your queries with a custom tagging system and instant filtering.
- **Public Sharing**: Generate unique, secure links to share specific queries with teammates.
- **Local Timezone Support**: Automatically displays query timestamps in your local time.
- **Safety First**: Double-confirmation logic for editing sensitive code.

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript, Bootstrap 5, Highlight.js
- **Backend**: [Hono](https://hono.dev/) (Web Framework for the Edge)
- **Runtime**: Cloudflare Pages Functions
- **Database**: Cloudflare D1 (SQL/SQLite)
- **Auth**: JSON Web Tokens (JWT)

## 💻 Local Development

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-upgrading/) (`npm install -g wrangler`)

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YourUsername/QueryStore_Cloudflare.git
   cd QueryStore_Cloudflare
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up local environment**:
   Create a `.dev.vars` file in the root directory:
   ```text
   JWT_SECRET=your_super_secret_key
   ```

4. **Initialize Local Database**:
   ```bash
   # Run your schema.sql if you have it, or let wrangler create it
   npx wrangler d1 execute querystore-db --local --file=./schema.sql
   ```

5. **Run the development server**:
   ```bash
   npx wrangler pages dev . --d1 DB
   ```
   Visit: `http://localhost:8788`

## 🌐 Deployment

### Automated (GitHub)
Pushing to the `main` branch automatically triggers a deployment to Cloudflare Pages.

### Manual Configuration
Ensure the following are set in the Cloudflare Dashboard:
1. **D1 Binding**: Bind the variable `DB` to your `querystore-db`.
2. **Environment Variables**: Add `JWT_SECRET` in **Settings > Functions**.
3. **Compatibility Date**: Set to `2024-01-01` or newer.

## 📂 Project Structure

```text
├── functions/api/      # Hono API (Cloudflare Functions)
├── index.html          # Main Dashboard
├── auth.html           # Login/Signup Page
├── share.html          # Public Share Page
├── app.js              # Main Frontend Logic
├── styles.css          # Custom Styling
└── wrangler.jsonc      # Cloudflare Configuration
```

## 🔒 Security

QueryStore takes security seriously:
- Passwords are never stored in plain text (salted and hashed).
- Environment variables are managed securely via Cloudflare Secrets.
- JWT tokens are signed with the `HS256` algorithm.

---
Built with ❤️ using Cloudflare Workers and Hono.
