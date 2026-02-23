import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { jwt, sign, verify } from 'hono/jwt'
import bcrypt from 'bcryptjs'
import { MongoClient, ObjectId } from 'mongodb'

// --- 2026 Cloudflare Socket Polyfill ---
// This fixes the "socket.once is not a function" error
import { Socket } from 'node:net'
if (Socket && !Socket.prototype.once) {
  Socket.prototype.once = function(event, listener) {
    const wrapper = (...args) => {
      this.removeListener(event, wrapper);
      listener.apply(this, args);
    };
    return this.on(event, wrapper);
  };
}

const app = new Hono().basePath('/api')

// --- Database Helper ---
let client
async function getDb(env) {
  if (!client) {
    if (!env.MONGO_URI) throw new Error('MONGO_URI is missing');
    
    // Optimized options for Cloudflare Workers
    client = new MongoClient(env.MONGO_URI, {
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 1, // Workers should use small pools
      minPoolSize: 0,
      retryWrites: true,
    })
    await client.connect()
  }
  return client.db()
}

// --- Health Check ---
app.get('/health', async (c) => {
  try {
    const db = await getDb(c.env);
    await db.command({ ping: 1 });
    return c.json({ status: 'ok', message: 'Connected to MongoDB Atlas!' });
  } catch (err) {
    console.error('Health check failed:', err);
    return c.json({ status: 'error', message: err.message }, 500);
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

// --- Auth Endpoints ---

app.post('/signup', async (c) => {
  const { username, password } = await c.req.json()
  if (!username || !password) return c.json({ message: 'Username and password are required.' }, 400)

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
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
  }

  const token = await sign(payload, c.env.JWT_SECRET)
  return c.json({ token, user: { username: user.username } })
})

// --- Public Endpoints ---

app.get('/public/queries/:shareId', async (c) => {
  const shareId = c.req.param('shareId')
  const db = await getDb(c.env)
  const queries = db.collection('queries')

  const query = await queries.findOne({ shareId, isPublic: true })
  if (!query) return c.json({ message: 'Shared query not found.' }, 404)

  return c.json({
    title: query.title,
    text: query.text,
    tags: query.tags,
    createdAt: query.createdAt
  })
})

// --- Protected Query Endpoints ---

app.get('/queries', authMiddleware, async (c) => {
  const user = c.get('user')
  const db = await getDb(c.env)
  const queries = db.collection('queries')

  const result = await queries.find({ user: user.id }).sort({ createdAt: -1 }).toArray()
  return c.json(result)
})

app.get('/tags', authMiddleware, async (c) => {
  const user = c.get('user')
  const db = await getDb(c.env)
  const queries = db.collection('queries')

  const tags = await queries.aggregate([
    { $match: { user: user.id } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags' } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, tag: '$_id' } }
  ]).toArray()

  return c.json(tags.map(t => t.tag))
})

app.post('/queries', authMiddleware, async (c) => {
  const user = c.get('user')
  const { title, text, tags } = await c.req.json()
  if (!title || !text) return c.json({ message: 'Title and text are required.' }, 400)

  const processedTags = tags ? tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag) : []
  const db = await getDb(c.env)
  const queries = db.collection('queries')

  const newQuery = {
    title,
    text,
    tags: processedTags,
    user: user.id,
    isPublic: false,
    createdAt: new Date()
  }

  const result = await queries.insertOne(newQuery)
  return c.json({ ...newQuery, _id: result.insertedId }, 201)
})

app.delete('/queries/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = await getDb(c.env)
  const queries = db.collection('queries')

  const result = await queries.deleteOne({ _id: new ObjectId(id), user: user.id })
  if (result.deletedCount === 0) return c.json({ message: 'Query not found or unauthorized.' }, 404)

  return c.json({ message: 'Query deleted successfully.' })
})

app.put('/queries/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const { title, text, tags } = await c.req.json()

  if (!title || !text) return c.json({ message: 'Title and text are required.' }, 400)

  const processedTags = tags ? tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag) : []
  const db = await getDb(c.env)
  const queries = db.collection('queries')

  const result = await queries.findOneAndUpdate(
    { _id: new ObjectId(id), user: user.id },
    { $set: { title, text, tags: processedTags } },
    { returnDocument: 'after' }
  )

  if (!result) return c.json({ message: 'Query not found or unauthorized.' }, 404)
  return c.json(result)
})

app.post('/queries/:id/share', authMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = await getDb(c.env)
  const queries = db.collection('queries')

  const query = await queries.findOne({ _id: new ObjectId(id), user: user.id })
  if (!query) return c.json({ message: 'Query not found or unauthorized.' }, 404)

  if (query.isPublic && query.shareId) return c.json({ shareId: query.shareId })

  const shareId = crypto.randomUUID().replace(/-/g, '').slice(0, 24)
  await queries.updateOne(
    { _id: query._id },
    { $set: { shareId, isPublic: true } }
  )

  return c.json({ shareId })
})

export const onRequest = handle(app)
