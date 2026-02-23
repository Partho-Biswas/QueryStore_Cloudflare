import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { jwt, sign, verify } from 'hono/jwt'
import bcrypt from 'bcryptjs'
import { MongoClient, ObjectId } from 'mongodb'

const app = new Hono().basePath('/api')

// --- Optimized 2026 Database Connection ---
// Cloudflare Workers in 2026 handle sockets better if we use these exact settings
let client;
async function getDb(env) {
  if (!client) {
    if (!env.MONGO_URI) throw new Error('MONGO_URI is missing');
    
    client = new MongoClient(env.MONGO_URI, {
      connectTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      maxPoolSize: 1,
      minPoolSize: 0,
      // In 2026, Cloudflare requires 'tls' to be explicitly handled for Atlas
      tls: true,
      tlsInsecure: false,
    });
    
    await client.connect();
  }
  return client.db();
}

// --- Health Check ---
app.get('/health', async (c) => {
  try {
    const db = await getDb(c.env);
    const ping = await db.command({ ping: 1 });
    return c.json({ status: 'ok', message: 'Successfully connected to MongoDB Atlas!', ping });
  } catch (err) {
    console.error('Connection failed:', err);
    return c.json({ 
      status: 'error', 
      message: err.message,
      tip: 'Ensure 0.0.0.0/0 is allowed in MongoDB Network Access'
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
  if (!user) return c.json({ message: 'Invalid credentials.' }, 401)

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) return c.json({ message: 'Invalid credentials.' }, 401)

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
  const queries = db.collection('queries')
  const result = await queries.find({ user: user.id }).sort({ createdAt: -1 }).toArray()
  return c.json(result)
})

app.post('/queries', authMiddleware, async (c) => {
  const user = c.get('user')
  const { title, text, tags } = await c.req.json()
  const processedTags = tags ? tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag) : []
  const db = await getDb(c.env)
  const newQuery = { title, text, tags: processedTags, user: user.id, isPublic: false, createdAt: new Date() }
  const result = await db.collection('queries').insertOne(newQuery)
  return c.json({ ...newQuery, _id: result.insertedId }, 201)
})

export const onRequest = handle(app)
