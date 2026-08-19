// Standalone worker: polls the SQS queue that's subscribed to the SNS topic
// task events are published to (see src/services/sns.js), and "delivers" the
// notification (here: logs it — in a real deployment this would email/Slack
// the assignee). Run separately from the API process: `npm run worker`.
// This models the SNS -> SQS -> consumer fan-out pattern from the infra/
// Terraform (sns_sqs.tf) without needing a second AWS-hosted process.

import 'dotenv/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

const queueUrl = process.env.SQS_QUEUE_URL;
const enabled = Boolean(queueUrl && process.env.AWS_ACCESS_KEY_ID);

if (!enabled) {
  console.log('[worker] SQS_QUEUE_URL / AWS credentials not set — worker has nothing to poll. Exiting.');
  console.log('[worker] Set SQS_QUEUE_URL and AWS creds in server/.env to run this against a real queue.');
  process.exit(0);
}

const client = new SQSClient({ region: process.env.AWS_REGION });

function handleNotification(body) {
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    console.warn('[worker] received non-JSON message, skipping:', body);
    return;
  }
  // SNS wraps the original message in an envelope with a `Message` field
  // when delivering to an SQS subscriber.
  const inner = payload.Message ? JSON.parse(payload.Message) : payload;
  console.log(`[worker] notify: task#${inner.task?.id} "${inner.task?.title}" -> ${inner.eventType}`);
}

async function poll() {
  console.log(`[worker] polling ${queueUrl}`);
  while (true) {
    const { Messages } = await client.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 5,
      WaitTimeSeconds: 15,
    }));

    for (const message of Messages ?? []) {
      handleNotification(message.Body);
      await client.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }));
    }
  }
}

poll().catch((err) => {
  console.error('[worker] fatal error:', err);
  process.exit(1);
});
