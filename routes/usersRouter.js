const router = require('express').Router;
const User = require('../models/User');
const Post = require('../models/Post');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class UserError extends Error {
    constructor(status, msg, ...params) {
        super(params);
        this.status = status;
        this.msg = msg;
    }
}

const usersRouter = router();

usersRouter.post('/login', async(req, res) => {
    try {
        if (!req.body) throw new UserError(400, 'Missing user data');
        if (!req.body.email || !req.body.password) throw new UserError(400, 'Missing user data');
        else if (req.body.email) {
            const user = await User.findOne({ email: req.body.email });
            if (!user) throw new UserError(404, 'No user found');
            if (user.password !== crypto.createHmac('sha256', 'password').update(req.body.password).digest('hex')) throw new UserError(400, 'Invalid password');
            const authToken = jwt.sign({ username: user.username, email: user.email, posts: user.posts }, process.env.AUTH_TOKEN_SECRET, { expiresIn: '15min' });
            const refreshToken = jwt.sign({ username: user.username, email: user.email, posts: user.posts }, process.env.REFRESH_TOKEN_SECRET);
            if (!authToken) throw new UserError(500, 'Login error');
            if (!refreshToken) throw new UserError(500, 'Login error');
            user.refreshToken = refreshToken;
            await user.save();
            return res.status(200).json({
                authToken,
                refreshToken
            });
        }
    } catch(err) {
        return res.status(err.status).json({ message: err.msg });
    }
});

usersRouter.get('/logout', async(req, res) => {
    if (!req.authenticated) throw new UserError(403, 'No logged in user');
    const user = await User.findOne({ username: req.user.username });
    if (!user) throw new UserError(500, 'Error logging out');
    user.refreshToken = '';
    await user.save();
    return res.status(200).send('Logged out successfully');
});

usersRouter.get('/token', async(req, res) => {
    if (!req.params || !req.params.refreshToken) throw new UserError(400, 'Missing refresh token');
    const tokenUser = jwt.verify(req.params.refreshToken, process.env.REFRESH_TOKEN_SECRET);
    if (!tokenUser) throw new UserError(403, 'Invalid token');
    const user = await User.findOne({ refreshToken });
    if (!user) throw new UserError(404, 'No user found');
    const authToken = jwt.sign({ username: user.username, email: user.email, posts: user.posts }, process.env.AUTH_TOKEN_SECRET, { expiresIn: '15min' });
    return res.status(200).json({
        authToken,
        refreshToken
    });
});

usersRouter.get('/', async(req, res) => {
    try {
        const users = await User.find();
        if (!users) throw new UserError(500, 'Error getting users');
        if (users.length === 0) throw new UserError(404, 'No users found');
        return res.status(200).json(users.map(user => ({ ...user._doc })));
    } catch(err) {
        return res.status(err.status).json({ message: err.msg }); 
    }
});

usersRouter.get('/:username', async(req, res) => {
    try {
        if (!req.params) throw new UserError(400, 'Missing user data');
        if (!req.params.username) throw new UserError(400, 'Missing user data');
        const user = await User.findOne({ username: req.params.username });
        if (!user) throw new UserError(404, 'No user found');
        return res.status(200).json({ ...user._doc });
    } catch(err) {
        return res.status(err.status).json({ message: err.msg });
    }
});

usersRouter.post('/', async(req, res) => {
    try {
        if (!req.body) throw new UserError(400, 'Missing user data');
        if (!req.body.username || !req.body.email || !req.body.password) throw new UserError(400, 'Missing user data');
        const user = await User.findOne({ username: req.body.username });
        if (user) throw new UserError(400, 'User already exists');
        else {
            const user = await User.findOne({ email: req.body.email });
            if (user) throw new UserError(400, 'User already exists');
            else {
                const refreshToken = jwt.sign({ username: req.body.username, email: req.body.email, posts: 0 }, process.env.REFRESH_TOKEN_SECRET);
                const authToken = jwt.sign({ username: req.body.username, email: req.body.email, posts: 0 }, process.env.AUTH_TOKEN_SECRET, { expiresIn: '15min' });
                if (!authToken) throw new UserError(500, 'Error creating user');
                if (!refreshToken) throw new UserError(500, 'Error creating user');
                const user = new User({ username: req.body.username, email: req.body.email, password: crypto.createHmac('sha256', 'password').update(req.body.password).digest('hex'), posts: 0, refreshToken });
                await user.save();
                return res.status(200).json({
                    authToken,
                    refreshToken
                });
            }
        }
    } catch(err) {
        if (err instanceof UserError) return res.status(err.status).send({ message: err.msg });
        else return res.status(500).send({ message: 'Error creating user' });
    }
});

usersRouter.put('/', async(req, res) => {
    try {
        if (!req.authenticated) throw new UserError(403, 'No logged in user');
        if (!req.body) throw new UserError(400, 'Missing user data');
        if (!req.body.username && !req.body.email && !req.body.password) throw new UserError(400, 'Missing user data');
        const user = await User.findOne({ username: req.user.username });
        if (!user) throw new UserError(404, 'No user found');
        if (req.body.username) {
            const u = await User.findOne({ username: req.body.username });
            if (u) throw new UserError(400, 'Username already exists');
            await Post.updateMany({ author: user.username }, { author: req.body.username });
            user.username = req.body.username;
        }
        if (req.body.email) {
            const u = await User.findOne({ email: req.body.email });
            if (u) throw new UserError(400, 'Email already exists');
            user.email = req.body.email;
        }
        if (req.body.password) user.password = crypto.createHmac('sha256', 'password').update(req.body.password).digest('hex');
        const refreshToken = jwt.sign({ username: user.username, email: user.email, posts: user.posts }, process.env.REFRESH_TOKEN_SECRET);
        const authToken = jwt.sign({ username: user.username, email: user.email, posts: user.posts }, process.env.AUTH_TOKEN_SECRET, { expiresIn: '15min' });
        user.refreshToken = refreshToken;
        await user.save();
        if (!authToken) throw new UserError(500, 'Error updating user');
        if (!refreshToken) throw new UserError(500, 'Error updating user');
        return res.status(200).json({
            authToken,
            refreshToken
        });
    } catch(err) {
        if (err instanceof UserError) return res.status(err.status).send({ message: err.msg });
        else return res.status(500).send({ message: 'Error updating user' });
    }
});

usersRouter.delete('/', async(req, res) => {
    try {
        if (!req.authenticated) throw new UserError(403, 'No logged in user');
        const user = await User.findOneAndRemove({ username: req.user.username });
        if (!user) throw new UserError(500, 'Error deleting user');
        await Post.deleteMany({ author: user.username });
        return res.status(200).json({ ...user._doc });
    } catch(err) {
        if (err instanceof UserError) return res.status(err.status).send({ message: err.msg });
        else return res.status(500).send({ message: 'Error deleting user' });
    }
});

module.exports = usersRouter;