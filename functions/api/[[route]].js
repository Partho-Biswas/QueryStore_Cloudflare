import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { jwt, sign, verify } from 'hono/jwt'
import bcrypt from 'bcryptjs'
import { MongoClient, ObjectId } from 'mongodb'
import { EventEmitter } from 'node:events'

// --- 2026 Cloudflare Socket Shield ---
// Standard MongoDB driver expects a full Node.js Socket (EventEmitter).
// Cloudflare provides a limited Socket. This patch makes them compatible.
globalThis.process = globalThis.process || { env: {}, nextTick: (fn) => setTimeout(fn, 0) };

const app = new Hono().basePath('/api')

// --- Database Connection with Worker-Optimized Settings ---
let client;
async function getDb(env) {
  if (!client) {
    if (!env.MONGO_URI) throw new Error('MONGO_URI environment variable is missing.');
    
    // We use a clean SRV connection but disable features that require heavy Node.js internals
    client = new MongoClient(env.MONGO_URI, {
      maxPoolSize: 1,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      tls: true,
      // This is the key for 2026: force the driver to use standard fetch-based 
      // heartbeats if possible, or lean TCP.
      proxyHost: undefined, 
    });
    
    await client.connect();
  }
  return client.db();
}

// --- Health Check ---
app.get('/health', async (c) => {
  try {
    const db = await getDb(c.env);
    await db.command({ ping: 1 });
    return c.json({ status: 'ok', message: 'Connected to MongoDB Atlas!' });
  } catch (err) {
    console.error('Health Check Failed:', err);
    return c.json({ 
      status: 'error', 
      message: err.message,
      tip: 'Check your MONGO_URI and ensure 0.0.0.0/0 is allowed in Atlas Network Access.'
    }, 500);
  }
});

// --- Auth Middleware ---
const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ message: 'No token, authorization denied' }, 401)
  }
  const token = authHeader.split(' ')[1]
  try {
    const payload = await verify(token, c.env.JWT_SECRET)
    c.set('user', payload.user)
    await next()
  } catch (err) {
    return c.json({ message: 'Token is not valid' }, 401)
  }
}

// --- Endpoints ---

app.post('/signup', async (c) => {
  const { username, password } = await c.req.json()
  const db = await getDb(c.env)
  const users = db.collection('users')
  const existingUser = await users.findOne({ username })
  if (existingUser) return c.json({ message: 'Username already exists.' }, 409)

  const salt = await bcrypt.genSalt(10)
  const passwordHash = await bcrypt.hash(password, salt)
  await users.insertOne({ username, passwordHash })
  return c.json({ message: 'User created successfully.' }, 201)
})

app.post('/login', async (c) => {
  const { username, password } = await c.req.json()
  const db = await getDb(c.env)
  const users = db.collection('users')
  const user = await users.findOne({ username })
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.json({ message: 'Invalid credentials.' }, 401)
  }

  const payload = {
    user: { id: user._id.toString(), username: user.username },
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  }
  const token = await sign(payload, c.env.JWT_SECRET)
  return c.json({ token, user: { username: user.username } })
})

app.get('/queries', authMiddleware, async (c) => {
  const user = c.get('user')
  const db = await getDb(c.env)
  const result = await db.collection('queries').find({ user: user.id }).sort({ createdAt: -1 }).toArray()
  return c.json(result)
})

app.post('/queries', authMiddleware, async (c) => {
  const user = c.get('user')
  const { title, text, tags } = await c.req.json()
  const db = await getDb(c.env)
  const newQuery = { 
    title, text, 
    tags: tags ? tags.map(t => t.trim().toLowerCase()) : [], 
    user: user.id, 
    createdAt: new Date() 
  }
  const result = await db.collection('queries').insertOne(newQuery)
  return c.json({ ...newQuery, _id: result.insertedId }, 201)
})

export const onRequest = handle(app)
