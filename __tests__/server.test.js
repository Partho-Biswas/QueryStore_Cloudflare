const request = require('supertest');
const { app, mongoose, server } = require('../server');
const User = mongoose.model('User');

describe('Auth API', () => {
    // Close the server and database connection after all tests
    afterAll(async () => {
        await server.close();
        await mongoose.connection.close();
    });

    // Clean up the database before each test
    beforeEach(async () => {
        await User.deleteMany({});
    });

    describe('POST /signup', () => {
        it('should create a new user', async () => {
            const res = await request(app)
                .post('/signup')
                .send({
                    username: 'testuser',
                    passwordHash: 'password123'
                });
            expect(res.statusCode).toEqual(201);
            expect(res.body.message).toBe('User created successfully.');
        });

        it('should not create a user that already exists', async () => {
            await new User({ username: 'testuser', passwordHash: 'password123' }).save();
            const res = await request(app)
                .post('/signup')
                .send({
                    username: 'testuser',
                    passwordHash: 'password123'
                });
            expect(res.statusCode).toEqual(409);
        });
    });

    describe('POST /login', () => {
        beforeEach(async () => {
            // Create a user to test login
            await new User({ username: 'testuser', passwordHash: 'password123' }).save();
        });

        it('should login a user with correct credentials', async () => {
            const res = await request(app)
                .post('/login')
                .send({
                    username: 'testuser',
                    passwordHash: 'password123'
                });
            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toBe('Login successful.');
        });

        it('should not login a user with incorrect credentials', async () => {
            const res = await request(app)
                .post('/login')
                .send({
                    username: 'testuser',
                    passwordHash: 'wrongpassword'
                });
            expect(res.statusCode).toEqual(401);
        });

        it('should not login a user that does not exist', async () => {
            const res = await request(app)
                .post('/login')
                .send({
                    username: 'nonexistentuser',
                    passwordHash: 'password123'
                });
            expect(res.statusCode).toEqual(404);
        });
    });
});
