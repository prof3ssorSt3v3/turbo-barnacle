import express from 'express';
const router = express.Router();

router.get('/', (request, response) => {
  response.send('Hello from the Movie Night API!');
});

// Create a new session
router.post('/session', async (req, res) => {
  res.status(201).json({ data: 'new session created.' });
});

export default router;

//curl -d '{json}' -H 'Content-Type: application/json' https://example.com/login
