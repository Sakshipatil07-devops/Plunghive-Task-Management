import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from './cloudwatch.js';

const topicArn = process.env.SNS_TOPIC_ARN;
const enabled = Boolean(topicArn && process.env.AWS_ACCESS_KEY_ID);

const client = enabled ? new SNSClient({ region: process.env.AWS_REGION }) : null;

export const sns = {
  enabled,

  // Publishes a task lifecycle event (created/updated/deleted). In production
  // this fans out via an SNS -> SQS subscription to the worker in
  // src/worker/sqsWorker.js, and could add more subscribers (email, Slack)
  // later without touching this publish call.
  async publishTaskEvent(eventType, task) {
    const message = JSON.stringify({ eventType, task, at: new Date().toISOString() });

    if (!enabled) {
      logger.info(`[sns:mock] ${eventType} task#${task.id}`);
      return { mocked: true };
    }

    await client.send(new PublishCommand({
      TopicArn: topicArn,
      Message: message,
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: eventType },
      },
    }));
    return { mocked: false };
  },
};
