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

function isIterable(obj) {
  return typeof obj[Symbol.iterator] === 'function';
}

router.get('/', (request, response) => {
  // clear out old sessions from 'codes'
  const LIMIT = 1000 * 60 * 90; //90 minutes
  redisClient.get('codes').then((codes) => {
    codes = JSON.parse(codes);
    codes = codes.filter((item) => {
      //remove entries that are more than 90 minutes old
      if (item.timestamp + LIMIT < Date.now() || !('timestamp' in item)) {
        //remove
        return false;
      } else {
        //keep
        return true;
      }
    });
    redisClient.set('codes', JSON.stringify(codes));
  });
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
        // console.log(codes.toString());
        codes = JSON.parse(codes);
        let timestamp = Date.now();
        if (codes == null) {
          //first ever "codes" object in the array
          codes = [{ code, session_id, device_ids: [device_id], timestamp }];
        } else {
          //codes array exists but creating a new entry
          let device_ids = [device_id];
          codes.push({ code, session_id, device_ids, timestamp });
        }
        redisClient
          .set('codes', JSON.stringify(codes))
          .then(function () {
            return redisClient.get('sessions');
            //create the initial entry in sessions too
          })
          .then(function (sessions) {
            sessions = JSON.parse(sessions);
            if (sessions == null) {
              //first ever session
              return redisClient.set('sessions', JSON.stringify([{ session_id, movie_ids: {} }]));
            } else {
              //new session to be joined by other players
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
        let match = false;
        let newcodes = codes.map((obj) => {
          if (obj.code == code) {
            match = true;
            session_id = obj.session_id; //get the session_id
            let deviceSet = new Set(obj.device_ids);
            deviceSet.add(device_id);
            console.log(`added ${device_id} to ${session_id}`);
            // obj.device_ids.push(device_id); //add the device_id
            obj.device_ids = Array.from(deviceSet);
            return obj;
          } else {
            return obj;
          }
        });
        if (match == false) {
          res.status(400).json({ code: 786, message: 'No match for code.' });
        } else {
          redisClient
            .set('codes', JSON.stringify(newcodes))
            .then(() => {
              //the entry in sessions [] should already exist
              //send the message and session back to user
              //returns {data: {String message, String session_id }}
              res.status(200).json({ data: { message: 'session joined.', session_id } });
            })
            .catch((err) => {
              res.status(400).json({ code: 543, message: 'Failed to create session' });
              console.log(`Failed Redis set ${err}`);
            });
        }
      })
      .catch((err) => {
        res.status(400).json({ code: 786, message: 'Failed to read code.' });
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
    let submitted_movie = movie_id;
    redisClient
      .get('codes')
      .then((codes) => {
        codes = JSON.parse(codes);
        let codeobj = codes.find((obj) => {
          // console.log(`match ${obj.session_id}`);
          if (obj.session_id == session_id) return true;
        });
        console.log(codeobj);
        if (codeobj == null) {
          res.status(400).json({ code: 765, message: 'Invalid session id.' });
          return;
        }
        let numPlayers = codeobj?.device_ids.length ?? 0;
        //[{"session_id":"abcd", "device_ids":[1234, 4567], code: "abcd" },]
        if (numPlayers > 0) {
          //we could change this to numPlayers > 1 to avoid instant match with one person
          redisClient
            .get('sessions')
            .then((sessions) => {
              sessions = JSON.parse(sessions);
              if (sessions == null) {
                //error handling
                sessions = [];
              }
              let userSession = sessions.find((s) => s.session_id == session_id);
              if (!userSession) {
                res.status(400).json({ code: 149, message: `Error: Not a valid session id` });
                return;
              }
              if (userSession && (vote == true || vote == 'true')) {
                //if they voted true then increment the count
                let count = 1;
                if (movie_id in userSession.movie_ids) {
                  if (typeof userSession.movie_ids[movie_id] == 'number') {
                    //add to previous vote count
                    count = userSession.movie_ids[movie_id] + 1;
                  }
                  userSession.movie_ids[movie_id] = count;
                  console.log(`Users voted true for ${movie_id} ${count} times.`);
                  if (numPlayers == count) {
                    //we have a winner!
                    match = true;
                  }
                } else {
                  //first vote for this movie
                  userSession.movie_ids[movie_id] = 1;
                }
              }

              if (match == false) {
                //check for other possible winners in the movie_ids array of userSession
                console.log(`User voted true OR false. It did not match but might be an older match for NOT ${movie_id}`);
                console.log(userSession.movie_ids);
                let movieVotes = Object.entries(userSession.movie_ids);
                for (const [mid, voteCount] of movieVotes) {
                  //this loop will be in the order that movie ids were added to the array
                  if (voteCount == numPlayers) {
                    //all the players voted yes
                    match = true;
                    movie_id = mid;
                    break;
                  }
                }
              }
              redisClient
                .set('sessions', JSON.stringify(sessions))
                .then(() => {
                  //now set
                  res.status(200).json({ data: { message: 'thanks for voting.', movie_id, match, num_devices: numPlayers, submitted_movie } });
                })
                .catch((err) => {
                  res.status(400).json({ code: 890, message: `Error: ${err}` });
                  // console.log(`Failed Redis set sessions ${err}`);
                });
            })
            .catch((err) => {
              res.status(400).json({ code: 892, message: `Error: ${err}` });
              // console.log(`Failed Redis get sessions ${err}`);
            });
        } else {
          res.status(400).json({ code: 932, message: 'No device ids for this session.' });
        }
      })
      .catch((err) => {
        res.status(400).json({ code: 894, message: `Error: ${err}` });
        // console.log(`Failed Redis get codes ${err}`);
      });
    // });
  } else {
    res.status(400).json({ code: 123, message: 'Missing required parameters.' });
  }
});

export default router;

//curl -d '{json}' -H 'Content-Type: application/json' https://example.com/login
