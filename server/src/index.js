import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tasksRouter } from './routes/tasks.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { s3 } from './services/s3.js';
import { sns } from './services/sns.js';
import { logger } from './services/cloudwatch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    aws: {
      s3: s3.enabled,
      sns: sns.enabled,
      cloudwatch: logger.enabled,
    },
  });
});

app.use('/api/auth', authRouter);
app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api/users', requireAuth, requireAdmin, usersRouter);

// In production the Express server also serves the built React bundle
// (single Fargate service / single ALB target group — see infra/ecs.tf).
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  logger.info(`server listening on :${port}`);
  console.log(`AWS integrations — S3: ${s3.enabled ? 'live' : 'local-only'}, SNS: ${sns.enabled ? 'live' : 'local-only'}, CloudWatch: ${logger.enabled ? 'live' : 'local-only'}`);
});
