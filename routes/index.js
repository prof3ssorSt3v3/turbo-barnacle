import express from 'express';
import { v4 as uuidv4 } from 'uuid';
// import Redis from 'ioredis';
const router = express.Router();
/*
const { REDIS_URL } = process.env;
const renderRedis = new Redis(REDIS_URL);
renderRedis.set("animal", "cat");

renderRedis.get("animal").then((result) => {
  console.log(result); // Prints "cat"
});
*/

function createcode() {
  //create the 4 digit code
  return Array(4)
    .fill(0, 0, 4)
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
      'GET /start-session': ['requires {String device_id}', 'returns {data: {String message, String session_id, String code }}'],
      'GET /join-session': ['requires {String device_id, int code}', 'returns {data: {String message, String session_id }}'],
      'GET /vote-movie': ['requires {String session_id, int movie_id, Boolean vote}', 'returns {data: {String message, int movie_id, Boolean match}}'],
    },
  });
  //TODO: add the list of API endpoints
});

// Create a new session
router.get('/start-session', (req, res) => {
  //requires {String device_id}
  console.log(req.query);
  console.log(req.query.device_id);

  if (req.query.device_id) {
    //returns {data: {String message, String session_id, String code }}
    res.status(200).json({ data: { message: 'new session created.', code: createcode(), session_id: createSession(), code: createcode() } });
  } else {
    res.status(400).json({ code: 123, message: 'Missing device_id property.' });
  }
});

// Join a session
router.get('/join-session', (req, res) => {
  //requires {String device_id, int code}
  console.log(req.query);
  console.log(req.query.code);
  console.log(req.query.device_id);

  if (req.query.device_id && req.query.code) {
    //returns {data: {String message, String session_id }}
    res.status(200).json({ data: { message: 'new session created.', session_id: createSession() } });
  } else {
    res.status(400).json({ code: 123, message: 'Missing required parameter.' });
  }
});

// Vote for movie
router.get('/vote-movie', (req, res) => {
  //requires {String session_id, int movie_id, Boolean vote}
  // console.log(req.query);
  console.log(req.query.movie_id);
  console.log(req.query.vote);

  if (req.query.session_id && req.query.movie_id && req.query.vote) {
    //returns {data: {String message, int movie_id, Boolean match}}
    // if the vote is true then ~25% of the time return true
    let vote = req.query.vote;
    console.log(typeof vote);
    let match = false;
    if (vote == true || vote == 'true') {
      // console.log(req.query.vote);
      let num = Math.random() * 4;
      match = num > 3.0 ? true : false;
      console.log(num, match);
    }
    res.status(200).json({ data: { message: 'thanks for voting.', movie_id: req.query.movie_id, match: match } });
  } else {
    res.status(400).json({ code: 123, message: 'Missing required parameters.' });
  }
});

export default router;

//curl -d '{json}' -H 'Content-Type: application/json' https://example.com/login
