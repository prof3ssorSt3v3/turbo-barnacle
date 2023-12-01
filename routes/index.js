import Redis from 'ioredis';
// const { REDIS_URL } = process.env;
const REDIS_URL = 'redis://red-cll5ht6aov6s73f2m1c0:6379';
const redisClient = new Redis(REDIS_URL);
// console.log(REDIS_URL);

import express from 'express';
const router = express.Router();
import { v4 as uuidv4 } from 'uuid';
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
  // redisClient.set('codes', JSON.stringify([])).then(() => {
  //   redisClient.set('sessions', JSON.stringify([]));
  //reset
  response.status(200).json({
    data: {
      message: 'Hello from the Movie Night API! PLEASE NOTE THAT REDIS TESTING AND CHANGES ARE STILL UNDERWAY.',
      'GET /start-session': ['requires {String device_id}', 'returns {data: {String message, String session_id, String code }}'],
      'GET /join-session': ['requires {String device_id, int code}', 'returns {data: {String message, String session_id }}'],
      'GET /vote-movie': ['requires {String session_id, int movie_id, Boolean vote}', 'returns {data: {String message, int movie_id, Boolean match}}'],
    },
  });
  // });
});

// Create a new session
router.get('/start-session', (req, res) => {
  //requires {String device_id}
  // create the code, create the session, save both plus device id
  if ('device_id' in req.query) {
    // connect().then(() => {
    let session_id = createSession();
    let code = createCode();
    let { device_id } = req.query;
    redisClient
      .get('codes')
      .then((codes) => {
        // console.log(typeof codes);
        console.log(codes.toString());
        codes = JSON.parse(codes);
        let device_ids = [device_id];
        if (codes == null) {
          codes = [];
        }
        codes.push({ code, session_id, device_ids });
        redisClient
          .set('codes', JSON.stringify(codes))
          .then(function () {
            return redisClient.get('sessions');
            //create the initial entry in sessions too
          })
          .then(function (sessions) {
            sessions = JSON.parse(sessions);
            if (sessions == null) {
              return redisClient.set('sessions', JSON.stringify([{ session_id, movie_ids: {} }]));
            } else {
              sessions.push({ session_id, movie_ids: {} });
              return redisClient.set('sessions', JSON.stringify(sessions));
            }
          })
          .then(function () {
            //returns {data: {String message, String session_id, String code }}
            res.status(200).json({ data: { message: 'new session created.', code, session_id } });
          })
          .catch((err) => {
            console.log(`Failed Redis set ${err}`);
          });
      })
      .catch((err) => {
        console.log(`Failed Redis get ${err}`);
      });
    // });
  } else {
    res.status(400).json({ code: 123, message: 'Missing device_id property.' });
  }
});

// Join a session
router.get('/join-session', (req, res) => {
  //requires {String device_id, int code}
  if (req.query.device_id && req.query.code) {
    // connect().then(() => {
    let { device_id } = req.query;
    let { code } = req.query;
    let session_id = '';

    redisClient
      .get('codes')
      .then((codes) => {
        //find the matching code, add the device id, retrieve the session_id
        codes = JSON.parse(codes);
        let newcodes = codes.map((obj) => {
          if (obj.code == code) {
            session_id = obj.session_id; //get the session_id
            obj.device_ids.push(device_id); //add the device_id
            return obj;
          } else {
            return obj;
          }
        });
        redisClient
          .set('codes', JSON.stringify(newcodes))
          .then(() => {
            //the entry in sessions [] should already exist
            //send the message and session back to user
            //returns {data: {String message, String session_id }}
            res.status(200).json({ data: { message: 'new session created.', session_id } });
          })
          .catch((err) => {
            console.log(`Failed Redis set ${err}`);
          });
      })
      .catch((err) => {
        console.log(`Failed Redis get ${err}`);
      });
    // });
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
    // connect().then(() => {
    let { vote, session_id, movie_id } = req.query;
    let match = false;
    redisClient
      .get('codes')
      .then((codes) => {
        codes = JSON.parse(codes);
        let codeobj = codes.filter((obj) => {
          if (obj.session_id == session_id) return true;
        });
        let numPlayers = codeobj?.movie_ids.entries().length ?? 0;
        //[{"session_id":"abcd", "movie_ids":{123:2, 456:1} },]
        redisClient
          .get('sessions')
          .then((sessions) => {
            sessions = JSON.parse(sessions);
            if (sessions == null) {
              //error handling
              sessions = [];
            }
            let currentsession;
            let copysessions = sessions.map((item) => {
              if (numPlayers && (vote == true || vote == 'true') && item.session_id == session_id) {
                let count = 1;
                if (movie_id in item.movie_ids) {
                  count++;
                }
                //only add the movie id when they voted yes
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
              //check for other possible winners in the movie_ids array
              let movieVotes = currentsession.movie_ids.entries();
              for (const [m, v] of movieVotes) {
                //this loop will be in the order that movie ids were added to the array
                if (v == numPlayers) {
                  //all the players voted yes
                  match = true;
                  movie_id = m;
                  break;
                }
              }
            }
            renderRedis
              .set('sessions', JSON.stringify(copysessions))
              .then(() => {
                //now set
                res.status(200).json({ data: { message: 'thanks for voting.', movie_id, match } });
              })
              .catch((err) => {
                console.log(`Failed Redis set sessions ${err}`);
              });
          })
          .catch((err) => {
            console.log(`Failed Redis get sessions ${err}`);
          });
      })
      .catch((err) => {
        console.log(`Failed Redis get codes ${err}`);
      });
    // });
  } else {
    res.status(400).json({ code: 123, message: 'Missing required parameters.' });
  }
});

export default router;

//curl -d '{json}' -H 'Content-Type: application/json' https://example.com/login
