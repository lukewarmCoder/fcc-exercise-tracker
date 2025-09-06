const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true })); // for form data
app.use(express.json());
app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/views/index.html');
});

let users = []; // [{ _id, username, exercises: [{ description, duration, date }] }]
let nextId = 1;
const genId = () => String(nextId++);

function parseDateOrToday(input) {
  if (!input) return new Date();
  const d = new Date(input);
  return isNaN(d.getTime()) ? new Date() : d;
}

function isValidISODate(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return false;
  const d = new Date(yyyy_mm_dd);
  // Ensure the string parses to a real date and matches yyyy-mm-dd parts
  if (isNaN(d.getTime())) return false;
  const [y, m, day] = yyyy_mm_dd.split('-');
  return (
    d.getUTCFullYear() === Number(y) &&
    d.getUTCMonth() + 1 === Number(m) &&
    d.getUTCDate() === Number(day)
  );
}



app.post('/api/users', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username is required' });

  const newUser = { _id: genId(), username, exercises: [] };
  users.push(newUser);

  // Return only username and _id
  res.json({ username: newUser.username, _id: newUser._id });
});

app.get('/api/users', (req, res) => {
  const list = users.map(u => ({ username: u.username, _id: u._id }));
  res.json(list);
});

app.post('/api/users/:_id/exercises', (req, res) => {
  const { _id } = req.params;
  const { description, duration, date } = req.body || {};

  if (!description) return res.status(400).json({ error: 'description is required' });
  const durNum = Number(duration);
  if (!duration || Number.isNaN(durNum)) {
    return res.status(400).json({ error: 'duration (number) is required' });
  }

  const user = users.find(u => u._id === _id);
  if (!user) return res.status(404).json({ error: 'user not found' });

  const when = parseDateOrToday(date);
  const exercise = { description, duration: durNum, date: when };
  user.exercises.push(exercise);

  res.json({
    _id: user._id,
    username: user.username,
    date: when.toDateString(),
    duration: durNum,
    description
  });
});

app.get('/api/users/:_id/logs', (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;

  const user = users.find(u => u._id === _id);
  if (!user) return res.status(404).json({ error: 'user not found' });

  let logs = user.exercises.slice();

  // Filter by from/to (inclusive) if valid yyyy-mm-dd
  if (isValidISODate(from)) {
    const fromDate = new Date(from);
    logs = logs.filter(e => new Date(e.date) >= fromDate);
  }
  if (isValidISODate(to)) {
    const toDate = new Date(to);
    logs = logs.filter(e => new Date(e.date) <= toDate);
  }

  logs.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Apply limit
  const n = Number(limit);
  if (!Number.isNaN(n) && n > 0) {
    logs = logs.slice(0, n);
  }

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
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
});