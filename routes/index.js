import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
const router = express.Router();
const { REDIS_URL } = process.env;
const renderRedis = new Redis(REDIS_URL);
/*
renderRedis.set("codes", [{"code":"1234", "session_id":"abcd", device_ids:[] },]);
renderRedis.set("sessions", [{"session_id":"abcd", "movie_ids":{123:2, 456:1} },]);

renderRedis.get("codes").then((result) => {
  console.log(result); 
});
*/

function createCode() {
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
  // create the code, create the session, save both plus device id
  if (req.query.device_id) {
    let session_id = createSession();
    let code = createCode();
    let { device_id } = req.query;
    renderRedis.get('codes').then((codes) => {
      // console.log(codes);
      let device_ids = [device_id];
      codes.push({ code, session_id, device_ids });
      renderRedis.set('codes', codes).then(function () {
        //returns {data: {String message, String session_id, String code }}
        res.status(200).json({ data: { message: 'new session created.', code, session_id } });
      });
    });
  } else {
    res.status(400).json({ code: 123, message: 'Missing device_id property.' });
  }
});

// Join a session
router.get('/join-session', (req, res) => {
  //requires {String device_id, int code}
  if (req.query.device_id && req.query.code) {
    let { device_id } = req.query;
    let { code } = req.query;
    let session_id = '';

    renderRedis.get('codes').then((codes) => {
      //find the matching code, add the device id, retrieve the session_id
      let newcodes = codes.map((obj) => {
        if (obj.code == code) {
          session_id = obj.session_id; //get the session_id
          obj.device_ids.push(device_id); //add the device_id
          return obj;
        } else {
          return obj;
        }
      });
      renderRedis.set('codes', newcodes).then(() => {
        //send the message and session back to user
        //returns {data: {String message, String session_id }}
        res.status(200).json({ data: { message: 'new session created.', session_id } });
      });
    });
  } else {
    res.status(400).json({ code: 123, message: 'Missing required parameter.' });
  }
});

// Vote for movie
router.get('/vote-movie', (req, res) => {
  //requires {String session_id, int movie_id, Boolean vote}
  // console.log(req.query);
  // console.log(req.query.movie_id);
  // console.log(req.query.vote);
  if (req.query.session_id && req.query.movie_id && req.query.vote) {
    //returns {data: {String message, int movie_id, Boolean match}}
    //save the YES votes in the movie_ids property as a movie_id key and integer
    //for the number of yes votes.
    //if the integer with the movie_id matches the number of device_ids for the
    //session_id then return true as match
    // if the vote is true then ~25% of the time return true
    let { vote, session_id, movie_id } = req.query;
    let match = false;
    renderRedis.get('codes').then((codes) => {
      let codeobj = codes.filter((obj) => {
        if (obj.session_id == session_id) return true;
      });
      let numPlayers = codeobj?.device_ids.length ?? 0;
      //[{"session_id":"abcd", "movie_ids":{123:2, 456:1} },]
      renderRedis.get('sessions').then((sessions) => {
        let currentsession;
        let newsessions = sessions.map((item) => {
          if ((vote == true || vote == 'true') && item.session_id == session_id) {
            let count = item.movie_ids[movie_id] ?? 0;
            count++;
            item.movie_ids[movie_id] = count;
            if (numPlayers == count) {
              //we have a winner!
              match = true;
            }
          }
          currentsession = item;
          return item;
        });
        if (match == false) {
          //check for other possible winners in the device_ids array
          let entries = currentsession.device_ids.entries();
          for (const [m, v] of entries) {
            if (v == numPlayers) {
              match = true;
              movie_id = m;
              break;
            }
          }
        }
        renderRedis.set('sessions', newsessions).then(() => {
          //now set
          res.status(200).json({ data: { message: 'thanks for voting.', movie_id, match } });
        });
      });
    });

    // if (vote == true || vote == 'true') {
    //   // console.log(req.query.vote);
    //   let num = Math.random() * 4;
    //   match = num > 3.0 ? true : false;
    //   console.log(num, match);
    // }
  } else {
    res.status(400).json({ code: 123, message: 'Missing required parameters.' });
  }
});

export default router;

//curl -d '{json}' -H 'Content-Type: application/json' https://example.com/login
