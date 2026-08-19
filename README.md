# PluginHive Task Manager

A small cloud-native task tracker built to demonstrate React.js + Node.js +
AWS for the PluginHive interview. Every AWS service in the job listing has a
real, explainable job to do in the architecture below — nothing was bolted
on just to tick a box.

## What it does

- Sign in / sign out (JWT-based session)
- One admin account per company (PluginHive) that can see and manage every
  employee's tasks; employees only ever see their own — admins add new
  employee accounts from the Employees page, no self-signup
- Create, update, delete, and search tasks (title, description, assignee, status)
- Attach a file to a task (uploaded straight to S3 via a presigned URL)
- Task list responses are cached (Redis-shaped cache, TTL-based, invalidated on writes)
- Every create/update/delete publishes an event that fans out to a background worker
- Structured app logs ship to CloudWatch Logs
- A top nav bar with a live task-status summary (to-do / in-progress / done)

## Architecture

```
Browser (React/Vite)
      |
      v
Express API (Node.js) ──serves the built React bundle too
      |
      ├── SQLite (source of truth) + FTS5 (local search index)
      ├── S3            → task attachments, via presigned PUT/GET URLs
      ├── SNS            → publishes task.created / task.updated / task.deleted
      │       └── SQS    → subscribed to the topic
      │             └── worker process → consumes & "delivers" notifications
      ├── CloudWatch Logs → structured request/event logs
      └── in-memory cache → same get/set/del shape as an ioredis client
```

| AWS service | Role | Where |
|---|---|---|
| **S3** | Task attachment storage, accessed only via presigned URLs (bucket itself is private) | `server/src/services/s3.js`, `infra/s3.tf` |
| **SNS → SQS** | Task events fan out from a topic to a queue; a worker polls the queue | `server/src/services/sns.js`, `server/src/worker/sqsWorker.js`, `infra/sns_sqs.tf` |
| **IAM** | Two least-privilege roles: an ECS execution role (pull image, write logs) and a task role scoped to only this app's S3 bucket / SNS topic / SQS queue / OpenSearch domain | `infra/iam.tf` |
| **CloudWatch** | App logs, a dashboard (5xx count, CPU), and a 5xx alarm | `server/src/services/cloudwatch.js`, `infra/cloudwatch.tf` |
| **ECS Fargate** | Runs the containerized Node app (which also serves the built React bundle — one service, one image) | `server/Dockerfile`, `infra/ecs.tf` |
| **ALB** | Public entry point, routes to the Fargate service's target group, health-checks `/api/health` | `infra/alb.tf` |
| **ElastiCache (Redis)** | Production cache for task-list/search responses. Locally this is a same-shaped in-memory module (`server/src/services/cache.js`) — swapping to real Redis is a one-file change, no call-site changes | `infra/redis.tf` |
| **OpenSearch** | Full-text search index over tasks in production. Locally, SQLite FTS5 plays the same *primary store + derived search index* role without needing a live OpenSearch domain | `infra/opensearch.tf`, `server/src/db/db.js` |

## Sign in & accounts

The API is behind auth — every `/api/tasks` request needs a valid session.
There's exactly one seeded account, the company admin:

| Username | Password | Role |
|---|---|---|
| `sakshi12` | `plunghive12` | admin |

Everyone else is added by the admin, from the **Employees** page (visible
only to admins) — pick a name, username, password, and role (employee or
admin). There's no public sign-up. Once added, an employee logs in with
those credentials and only ever sees their own tasks; the admin can see and
act on *everyone's* tasks, with a "Viewing tasks for" filter to jump between
the whole company and one employee at a time.

Ownership is enforced server-side (`server/src/routes/tasks.js`), not just
hidden in the UI — an employee hitting another employee's task by ID
directly gets a 404, not the task.

Sessions are JWTs (`server/src/middleware/auth.js`), signed with
`JWT_SECRET` (falls back to a dev-only default — set a real one in
`server/.env` before this goes anywhere shared), valid for 8 hours, sent as
`Authorization: Bearer <token>`. Logout is just discarding the token
client-side — there's no server-side session store to invalidate, which is
the standard trade-off with JWTs (a stolen token is valid until it expires;
a real deployment would add refresh tokens / a revocation list).

### Why local SQLite instead of a managed database?

The job listing doesn't call for a database service, so SQLite (via Node's
built-in `node:sqlite` module — no native build step) is the source of
truth, with FTS5 as a derived search index. That's a legitimate,
explainable pattern (primary store + search index), and it's exactly what
OpenSearch would do in production against a "real" primary store.

## Running it locally

Requires Node.js 22.5+ (for `node:sqlite`) — nothing else. No Docker, no AWS
account needed to run and demo the app.

```bash
# terminal 1
cd server
cp .env.example .env   # optional — leave blank to run fully local
npm install
npm run dev

# terminal 2
cd client
npm install
npm run dev
```

Open http://localhost:5173 — you'll land on the login page first (see
[Sign in & accounts](#sign-in--accounts) for the admin login). The nav bar
shows live dots for S3/SNS/CloudWatch — grey means "not configured, running
local-only" (uploads/notifications still work, they just don't touch AWS).

## Enabling real AWS integration

1. Create an IAM user with programmatic access (or use the roles Terraform
   creates once deployed).
2. Fill in `server/.env` — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
   `S3_BUCKET_NAME`, `SNS_TOPIC_ARN`, `SQS_QUEUE_URL`.
3. Restart the server. The status dots go green; uploads land in S3,
   task events publish to SNS.
4. Run the worker separately to see the SNS → SQS flow consumed:
   `cd server && npm run worker`

## Infrastructure as Code

`infra/` has the complete Terraform for a production deployment — VPC
(default VPC, no NAT Gateway to avoid the biggest silent cost), ALB, ECS
Fargate service, ECR repo, ElastiCache Redis, OpenSearch domain, IAM roles,
CloudWatch dashboard + alarm.

```bash
cd infra
terraform init
terraform plan     # review only — see what WOULD be created
```

**`terraform apply` has intentionally not been run.** Standing up
OpenSearch + ElastiCache + Fargate + ALB runs real, billed AWS resources
around the clock — not something to leave running unattended. `terraform
plan` proves the configuration is valid and shows exactly what would be
created; happy to walk through applying it live if asked in the interview.

Smallest instance sizes throughout (`t3.small.search`, `cache.t3.micro`,
256 CPU / 512 MB Fargate task) keep the cost of an actual deploy low if we
do want to demo it live.

## Project structure

```
PluginHive-TaskManager/
  client/          React app (Vite)
  server/
    src/routes/     Express routes (auth, CRUD, search, attachments)
    src/middleware/ JWT auth guard
    src/services/   s3, sns, cloudwatch, cache — each has a `.enabled` flag
                     and no-ops safely when AWS isn't configured
    src/worker/     standalone SQS consumer
    src/db/         SQLite schema + FTS5 search index + the seeded admin account
    Dockerfile      multi-stage: builds client, bundles into the server image
  infra/            Terraform for the full 8-service AWS architecture
```
