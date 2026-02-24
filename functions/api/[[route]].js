import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { jwt, sign, verify } from 'hono/jwt'
import bcrypt from 'bcryptjs'

const app = new Hono().basePath('/api')

// --- Auth Endpoints ---

app.post('/signup', async (c) => {
  const { username, password } = await c.req.json()
  const db = c.env.DB;

  try {
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash(password, salt)
    
    await db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .bind(username, passwordHash)
      .run();

    return c.json({ message: 'User created successfully.' }, 201)
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return c.json({ message: 'Username already exists.' }, 409)
    }
    return c.json({ message: 'Error during signup.' }, 500)
  }
})

app.post('/login', async (c) => {
  const { username, password } = await c.req.json()
  const db = c.env.DB;

  const user = await db.prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .first();

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return c.json({ message: 'Invalid credentials.' }, 401)
  }

  const payload = {
    user: { id: user.id, username: user.username },
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  }
  const token = await sign(payload, c.env.JWT_SECRET)
  return c.json({ token, user: { username: user.username } })
})

// --- Public API Endpoint ---
app.get('/public/queries/:shareId', async (c) => {
  const db = c.env.DB;
  const shareId = c.req.param('shareId');

  const query = await db.prepare(`
    SELECT q.*, GROUP_CONCAT(t.tag) as tags 
    FROM queries q 
    LEFT JOIN query_tags t ON q.id = t.query_id 
    WHERE q.share_id = ? AND q.is_public = 1
    GROUP BY q.id
  `).bind(shareId).first();

  if (!query) {
    return c.json({ message: 'Shared query not found.' }, 404);
  }

  return c.json({
    title: query.title,
    text: query.text,
    tags: query.tags ? query.tags.split(',') : [],
    createdAt: query.created_at
  });
})

// --- Protected Query API Endpoints ---

// Middleware-like check for queries
const getAuthPayload = async (c) => {
  if (!c.env.JWT_SECRET) {
    console.error('CRITICAL: JWT_SECRET environment variable is missing!');
    return null;
  }
  const auth = c.req.header('Authorization');
  if (!auth) return null;
  const token = auth.split(' ')[1];
  try {
    return await verify(token, c.env.JWT_SECRET);
  } catch (e) {
    console.error('JWT Verification failed:', e.message);
    return null;
  }
}

app.get('/queries', async (c) => {
  const payload = await getAuthPayload(c);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  const db = c.env.DB;

  const { results: queries } = await db.prepare(`
    SELECT q.*, GROUP_CONCAT(t.tag) as tags 
    FROM queries q 
    LEFT JOIN query_tags t ON q.id = t.query_id 
    WHERE q.user_id = ? 
    GROUP BY q.id 
    ORDER BY q.created_at DESC
  `).bind(payload.user.id).all();

  const formattedQueries = queries.map(q => ({
    ...q,
    _id: q.id, 
    tags: q.tags ? q.tags.split(',') : []
  }));

  return c.json(formattedQueries)
})

app.get('/tags', async (c) => {
  const payload = await getAuthPayload(c);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  const db = c.env.DB;

  const { results: tags } = await db.prepare(`
    SELECT DISTINCT t.tag 
    FROM query_tags t
    JOIN queries q ON t.query_id = q.id
    WHERE q.user_id = ?
    ORDER BY t.tag ASC
  `).bind(payload.user.id).all();

  return c.json(tags.map(t => t.tag));
})

app.post('/queries', async (c) => {
  const payload = await getAuthPayload(c);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  const db = c.env.DB;
  
  const { title, text, tags } = await c.req.json()
  
  const info = await db.prepare('INSERT INTO queries (user_id, title, text) VALUES (?, ?, ?)')
    .bind(payload.user.id, title, text)
    .run();
  
  const queryId = info.meta.last_row_id;

  if (tags && tags.length > 0) {
    const tagValues = tags.map(t => t.trim().toLowerCase()).filter(t => t);
    for (const tag of tagValues) {
        await db.prepare('INSERT INTO query_tags (query_id, tag) VALUES (?, ?)').bind(queryId, tag).run();
    }
  }

  return c.json({ _id: queryId, title, text, tags }, 201)
})

app.delete('/queries/:id', async (c) => {
  const payload = await getAuthPayload(c);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  const db = c.env.DB;
  const id = c.req.param('id');

  const info = await db.prepare('DELETE FROM queries WHERE id = ? AND user_id = ?')
    .bind(id, payload.user.id)
    .run();

  if (info.meta.changes === 0) {
    return c.json({ message: 'Query not found or unauthorized.' }, 404);
  }

  return c.json({ message: 'Query deleted successfully.' });
})

app.put('/queries/:id', async (c) => {
  const payload = await getAuthPayload(c);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  const db = c.env.DB;
  const id = c.req.param('id');
  const { title, text, tags } = await c.req.json();

  const info = await db.prepare('UPDATE queries SET title = ?, text = ? WHERE id = ? AND user_id = ?')
    .bind(title, text, id, payload.user.id)
    .run();

  if (info.meta.changes === 0) {
    return c.json({ message: 'Query not found or unauthorized.' }, 404);
  }

  // Update tags: Delete old, insert new
  await db.prepare('DELETE FROM query_tags WHERE query_id = ?').bind(id).run();
  if (tags && tags.length > 0) {
    const tagValues = tags.map(t => t.trim().toLowerCase()).filter(t => t);
    for (const tag of tagValues) {
        await db.prepare('INSERT INTO query_tags (query_id, tag) VALUES (?, ?)').bind(id, tag).run();
    }
  }

  return c.json({ message: 'Query updated successfully.' });
})

app.post('/queries/:id/share', async (c) => {
  const payload = await getAuthPayload(c);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  const db = c.env.DB;
  const id = c.req.param('id');

  const query = await db.prepare('SELECT share_id, is_public FROM queries WHERE id = ? AND user_id = ?')
    .bind(id, payload.user.id)
    .first();

  if (!query) {
    return c.json({ message: 'Query not found or unauthorized.' }, 404);
  }

  if (query.is_public && query.share_id) {
    return c.json({ shareId: query.share_id });
  }

  const shareId = crypto.randomUUID().split('-')[0] + crypto.randomUUID().split('-')[1]; // Simple unique ID
  await db.prepare('UPDATE queries SET share_id = ?, is_public = 1 WHERE id = ?')
    .bind(shareId, id)
    .run();

  return c.json({ shareId });
})

export const onRequest = handle(app)
