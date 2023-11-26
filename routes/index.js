import express from 'express';
import { v4 as uuidv4 } from 'uuid';
const router = express.Router();

function createcode() {
  //create the 4 digit code
  return []
    .fill(0, 0, 3)
    .map((v) => Math.floor(Math.random() * 10).toString())
    .join('');
}

function createSession() {
  return uuidv4();
}

router.get('/', (request, response) => {
  response.status(200).json({
    data: {
      message: 'Hello from the Movie Night API!',
      '/start-session': ['requires {String device_id}', 'returns {data: {String message, String session_id }}'],
      '/join-session': ['requires {String device_id, int code}', 'returns {data: {String message, String session_id }}'],
      '/vote-movie': ['requires {String session_id, int movie_id, Boolean vote}', 'returns {data: {String message, int movie_id, Boolean match}}'],
    },
  });
  //TODO: add the list of API endpoints
});

// Create a new session
router.post('/start-session', async (req, res) => {
  //requires {String device_id}
  //returns {data: {String message, String session_id }}

  res.status(201).json({ data: { message: 'new session created.', code: createcode(), session_id: createSession() } });
});

// Join a session
router.post('/join-session', async (req, res) => {
  //requires {String device_id, int code}
  //returns {data: {String message, String session_id }}

  res.status(201).json({ data: { message: 'new session created.', session_id: createSession() } });
});

// Vote for movie
router.post('/vote-movie', async (req, res) => {
  //requires {String session_id, int movie_id, Boolean vote}
  //returns {data: {String message, int movie_id, Boolean match}}
  // if the vote is true then ~25% of the time return true
  let match = Math.random() * 4 < 1.0 ? true : false;
  res.status(201).json({ data: { message: 'thanks for voting.', movie_id: req.movie_id, match: match } });
});

export default router;

//curl -d '{json}' -H 'Content-Type: application/json' https://example.com/login
