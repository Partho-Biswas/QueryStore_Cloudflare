import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { jwt, sign, verify } from 'hono/jwt'
import bcrypt from 'bcryptjs'

const app = new Hono().basePath('/api')

// --- Data API Helper ---
async function atlasFetch(c, action, body) {
  const url = `${c.env.MONGODB_API_URL}/action/${action}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Request-Headers': '*',
      'api-key': c.env.MONGODB_API_KEY,
    },
    body: JSON.stringify({
      collection: body.collection,
      database: c.env.MONGODB_DATABASE,
      dataSource: c.env.MONGODB_CLUSTER,
      ...body,
    }),
  });
  return response.json();
}

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

  const existing = await atlasFetch(c, 'findOne', {
    collection: 'users',
    filter: { username }
  });

  if (existing.document) return c.json({ message: 'Username already exists.' }, 409)

  const salt = await bcrypt.genSalt(10)
  const passwordHash = await bcrypt.hash(password, salt)

  await atlasFetch(c, 'insertOne', {
    collection: 'users',
    document: { username, passwordHash }
  });

  return c.json({ message: 'User created successfully.' }, 201)
})

app.post('/login', async (c) => {
  const { username, password } = await c.req.json()
  const result = await atlasFetch(c, 'findOne', {
    collection: 'users',
    filter: { username }
  });

  const user = result.document;
  if (!user) return c.json({ message: 'Invalid credentials.' }, 401)

  const isMatch = await bcrypt.compare(password, user.passwordHash)
  if (!isMatch) return c.json({ message: 'Invalid credentials.' }, 401)

  const payload = {
    user: { id: user._id, username: user.username },
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
  }

  const token = await sign(payload, c.env.JWT_SECRET)
  return c.json({ token, user: { username: user.username } })
})

// --- Public Endpoints ---

app.get('/public/queries/:shareId', async (c) => {
  const shareId = c.req.param('shareId')
  const result = await atlasFetch(c, 'findOne', {
    collection: 'queries',
    filter: { shareId, isPublic: true }
  });

  const query = result.document;
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
  const result = await atlasFetch(c, 'find', {
    collection: 'queries',
    filter: { user: user.id },
    sort: { createdAt: -1 }
  });
  return c.json(result.documents)
})

app.get('/tags', authMiddleware, async (c) => {
  const user = c.get('user')
  // Note: Data API doesn't support aggregate as easily in one call via find, 
  // but we can fetch tags and process or use the 'aggregate' action.
  const result = await atlasFetch(c, 'aggregate', {
    collection: 'queries',
    pipeline: [
      { $match: { user: user.id } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags' } },
      { $sort: { _id: 1 } }
    ]
  });

  return c.json(result.documents.map(t => t._id))
})

app.post('/queries', authMiddleware, async (c) => {
  const user = c.get('user')
  const { title, text, tags } = await c.req.json()
  if (!title || !text) return c.json({ message: 'Title and text are required.' }, 400)

  const processedTags = tags ? tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag) : []
  const newQuery = {
    title,
    text,
    tags: processedTags,
    user: user.id,
    isPublic: false,
    createdAt: { "$date": new Date().toISOString() }
  }

  const result = await atlasFetch(c, 'insertOne', {
    collection: 'queries',
    document: newQuery
  });
  return c.json({ ...newQuery, _id: result.insertedId }, 201)
})

app.delete('/queries/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const result = await atlasFetch(c, 'deleteOne', {
    collection: 'queries',
    filter: { _id: { "$oid": id }, user: user.id }
  });

  if (result.deletedCount === 0) return c.json({ message: 'Query not found or unauthorized.' }, 404)
  return c.json({ message: 'Query deleted successfully.' })
})

app.put('/queries/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const { title, text, tags } = await c.req.json()

  if (!title || !text) return c.json({ message: 'Title and text are required.' }, 400)

  const processedTags = tags ? tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag) : []
  const result = await atlasFetch(c, 'findOneAndUpdate', {
    collection: 'queries',
    filter: { _id: { "$oid": id }, user: user.id },
    update: { $set: { title, text, tags: processedTags } },
    returnDocument: 'after'
  });

  if (!result.document) return c.json({ message: 'Query not found or unauthorized.' }, 404)
  return c.json(result.document)
})

app.post('/queries/:id/share', authMiddleware, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  
  const findResult = await atlasFetch(c, 'findOne', {
    collection: 'queries',
    filter: { _id: { "$oid": id }, user: user.id }
  });

  const query = findResult.document;
  if (!query) return c.json({ message: 'Query not found or unauthorized.' }, 404)

  if (query.isPublic && query.shareId) return c.json({ shareId: query.shareId })

  const shareId = crypto.randomUUID().replace(/-/g, '').slice(0, 24)
  await atlasFetch(c, 'updateOne', {
    collection: 'queries',
    filter: { _id: { "$oid": id } },
    update: { $set: { shareId, isPublic: true } }
  });

  return c.json({ shareId })
})

export const onRequest = handle(app)
