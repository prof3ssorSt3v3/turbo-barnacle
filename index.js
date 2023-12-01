'use strict';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRouter from './routes/index.js';

const app = express();

app.use(cors());
app.use(helmet());
app.use('/', apiRouter);

const port = 3030;
app.listen(port, () => console.log(`The server is listening on ${port}`));
