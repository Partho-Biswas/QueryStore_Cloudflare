require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000; // Use port from environment or default to 3000

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from the project root

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('Successfully connected to MongoDB Atlas!');
}).catch(err => {
    console.error('Error connecting to MongoDB Atlas:', err);
    process.exit(1); // Exit if we can't connect to the database
});

// --- Mongoose Schema & Model ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);

// Mongoose Schema & Model for Queries
const querySchema = new mongoose.Schema({
    title: { type: String, required: true },
    text: { type: String, required: true },
    tags: [{ type: String, trim: true }],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isPublic: { type: Boolean, default: false },
    shareId: { type: String, unique: true, sparse: true }, // sparse index allows multiple nulls
    createdAt: { type: Date, default: Date.now }
});

const Query = mongoose.model('Query', querySchema);


// --- API Endpoints ---

// POST /signup - Create a new user
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({ username, passwordHash });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully.', user: { username: newUser.username } });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'An error occurred during signup.' });
    }
});

// POST /login - Authenticate a user and return a JWT
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Create and sign a JWT
        const payload = {
            user: {
                id: user.id,
                username: user.username
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }, // Token expires in 1 hour
            (err, token) => {
                if (err) throw err;
                res.status(200).json({ token, user: { username: user.username } });
            }
        );
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'An error occurred during login.' });
    }
});

// --- Public API Endpoint ---
// GET /api/public/queries/:shareId - Get a shared query
app.get('/api/public/queries/:shareId', async (req, res) => {
    try {
        const query = await Query.findOne({ shareId: req.params.shareId, isPublic: true });
        if (!query) {
            return res.status(404).json({ message: 'Shared query not found.' });
        }
        // Return only non-sensitive data
        res.status(200).json({
            title: query.title,
            text: query.text,
            tags: query.tags,
            createdAt: query.createdAt
        });
    } catch (error) {
        console.error('Error fetching shared query:', error);
        res.status(500).json({ message: 'Error fetching shared query.' });
    }
});


// --- Query API Endpoints (Protected) ---
const auth = require('./authMiddleware');

// GET /api/queries - Get all queries for the logged-in user
app.get('/api/queries', auth, async (req, res) => {
    try {
        const queries = await Query.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(queries);
    } catch (error) {
        console.error('Error fetching queries:', error);
        res.status(500).json({ message: 'Error fetching queries.' });
    }
});

// GET /api/tags - Get all unique tags for the logged-in user
app.get('/api/tags', auth, async (req, res) => {
    try {
        const tags = await Query.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
            { $unwind: '$tags' },
            { $group: { _id: '$tags' } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, tag: '$_id' } }
        ]);
        res.status(200).json(tags.map(t => t.tag));
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ message: 'Error fetching tags.' });
    }
});

// POST /api/queries - Create a new query for the logged-in user
app.post('/api/queries', auth, async (req, res) => {
    const { title, text, tags } = req.body;

    if (!title || !text) {
        return res.status(400).json({ message: 'Title and text are required.' });
    }

    try {
        const processedTags = tags ? tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag) : [];
        const newQuery = new Query({
            title,
            text,
            tags: processedTags,
            user: req.user.id
        });
        await newQuery.save();
        res.status(201).json(newQuery);
    } catch (error) {
        console.error('Error creating query:', error);
        res.status(500).json({ message: 'Error creating query.' });
    }
});

// DELETE /api/queries/:id - Delete a query
app.delete('/api/queries/:id', auth, async (req, res) => {
    try {
        const query = await Query.findOneAndDelete({ _id: req.params.id, user: req.user.id });
        if (!query) {
            return res.status(404).json({ message: 'Query not found or user not authorized.' });
        }
        res.status(200).json({ message: 'Query deleted successfully.' });
    } catch (error) {
        console.error('Error deleting query:', error);
        res.status(500).json({ message: 'Error deleting query.' });
    }
});

// PUT /api/queries/:id - Update a query
app.put('/api/queries/:id', auth, async (req, res) => {
    const { title, text, tags } = req.body;

    if (!title || !text) {
        return res.status(400).json({ message: 'Title and text are required.' });
    }

    try {
        const processedTags = tags ? tags.map(tag => tag.trim().toLowerCase()).filter(tag => tag) : [];
        const updatedQuery = await Query.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { title, text, tags: processedTags },
            { new: true, runValidators: true }
        );

        if (!updatedQuery) {
            return res.status(404).json({ message: 'Query not found or user not authorized.' });
        }

        res.status(200).json(updatedQuery);
    } catch (error) {
        console.error('Error updating query:', error);
        res.status(500).json({ message: 'Error updating query.' });
    }
});

// POST /api/queries/:id/share - Generate a shareable link for a query
app.post('/api/queries/:id/share', auth, async (req, res) => {
    try {
        const query = await Query.findOne({ _id: req.params.id, user: req.user.id });

        if (!query) {
            return res.status(404).json({ message: 'Query not found or user not authorized.' });
        }

        // If the query is already public, just return the existing shareId
        if (query.isPublic && query.shareId) {
            return res.status(200).json({ shareId: query.shareId });
        }

        // Otherwise, generate a new shareId and make the query public
        const shareId = crypto.randomBytes(12).toString('hex');
        query.shareId = shareId;
        query.isPublic = true;
        await query.save();

        res.status(200).json({ shareId });
    } catch (error) {
        console.error('Error sharing query:', error);
        res.status(500).json({ message: 'Error sharing query.' });
    }
});

// --- Start the Server ---
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = { app, mongoose, server };

