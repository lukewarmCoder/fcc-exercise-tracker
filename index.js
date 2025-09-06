import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

const MONGO_URI = process.env.MONGO_URI;
await mongoose.connect(MONGO_URI, { dbName: 'fcc_exercise_tracker' });

const ExerciseSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    duration: { type: Number, required: true },
    date: { type: Date, required: true }
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  exercises: { type: [ExerciseSchema], default: [] }
});

const User = mongoose.model('User', UserSchema);

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

app.post('/api/users', async (req, res, next) => {
  try {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });

    const user = await User.create({ username });
    return res.json({ username: user.username, _id: user._id });
  } catch (err) {
    next(err);
  }
});

app.get('/api/users', async (req, res, next) => {
  try {
    const users = await User.find({}, { username: 1 }).lean();
    res.json(users.map(u => ({ username: u.username, _id: u._id })));
  } catch (err) {
    next(err);
  }
});

app.post('/api/users/:_id/exercises', async (req, res, next) => {
  try {
    const { _id } = req.params;
    const { description, duration, date } = req.body || {};

    if (!description) return res.status(400).json({ error: 'description is required' });
    const durNum = Number(duration);
    if (!duration || Number.isNaN(durNum)) return res.status(400).json({ error: 'duration (number) is required' });

    let when = date ? new Date(date) : new Date();
    if (isNaN(when.getTime())) when = new Date();

    const user = await User.findById(_id);
    if (!user) return res.status(404).json({ error: 'user not found' });

    const ex = { description, duration: durNum, date: when };
    user.exercises.push(ex);
    await user.save();

    res.json({
      _id: user._id,
      username: user.username,
      date: when.toDateString(),
      duration: durNum,
      description
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/users/:_id/logs', async (req, res, next) => {
  try {
    const { _id } = req.params;
    const { from, to, limit } = req.query;

    const user = await User.findById(_id).lean();
    if (!user) return res.status(404).json({ error: 'user not found' });

    let logs = user.exercises || [];

    let fromDate, toDate;
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) fromDate = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) toDate = d;
    }

    if (fromDate) logs = logs.filter(e => new Date(e.date) >= fromDate);
    if (toDate) logs = logs.filter(e => new Date(e.date) <= toDate);

    logs.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Apply limit
    const n = Number(limit);
    if (!Number.isNaN(n) && n > 0) logs = logs.slice(0, n);

    const formatted = logs.map(e => ({
      description: e.description,
      duration: e.duration,
      date: new Date(e.date).toDateString()
    }));

    res.json({
      username: user.username,
      count: formatted.length,
      _id: user._id,
      log: formatted
    });
  } catch (err) {
    next(err);
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Your app is listening on port ' + PORT);
});