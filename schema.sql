-- Users Table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

-- Queries Table
CREATE TABLE queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    is_public INTEGER DEFAULT 0,
    share_id TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tags Table (One-to-many relationship)
CREATE TABLE query_tags (
    query_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (query_id, tag),
    FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
);
