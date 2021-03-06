const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const postsRouter = require('./routes/postsRouter');
const usersRouter = require('./routes/usersRouter');
const verifyToken = require('./middleware/verifyToken');

require('dotenv').config();

mongoose.connect('mongodb://localhost:27017/blog', { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false });

const app = express();
const db = mongoose.connection;

app.use(cors());
app.use(express.json());
app.use(verifyToken);
app.use('/posts', postsRouter);
app.use('/users', usersRouter);
app.use((req, res) => {
    res.status(404).send('Route not found');
});

db.on('open', () => {
    console.log('MongoDB database connected');
    app.listen(5000, () => console.log('Server started on port 5000'));
});