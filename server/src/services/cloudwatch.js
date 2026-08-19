import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  CreateLogStreamCommand,
  DescribeLogStreamsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

const logGroup = process.env.CLOUDWATCH_LOG_GROUP;
const logStream = process.env.CLOUDWATCH_LOG_STREAM;
const enabled = Boolean(logGroup && logStream && process.env.AWS_ACCESS_KEY_ID);

const client = enabled ? new CloudWatchLogsClient({ region: process.env.AWS_REGION }) : null;
let sequenceToken;
let streamReady = false;

async function ensureStream() {
  if (streamReady) return;
  try {
    await client.send(new CreateLogStreamCommand({ logGroupName: logGroup, logStreamName: logStream }));
  } catch (err) {
    if (err.name !== 'ResourceAlreadyExistsException') throw err;
  }
  const described = await client.send(
    new DescribeLogStreamsCommand({ logGroupName: logGroup, logStreamNamePrefix: logStream })
  );
  sequenceToken = described.logStreams?.[0]?.uploadSequenceToken;
  streamReady = true;
}

async function shipToCloudWatch(level, message) {
  try {
    await ensureStream();
    const result = await client.send(new PutLogEventsCommand({
      logGroupName: logGroup,
      logStreamName: logStream,
      logEvents: [{ timestamp: Date.now(), message: `[${level.toUpperCase()}] ${message}` }],
      sequenceToken,
    }));
    sequenceToken = result.nextSequenceToken;
  } catch (err) {
    // Never let logging failures break the request path.
    console.error('[cloudwatch] failed to ship log event:', err.message);
  }
}

function line(level, message) {
  const stamped = `${new Date().toISOString()} [${level}] ${message}`;
  if (level === 'error') console.error(stamped);
  else console.log(stamped);
  if (enabled) void shipToCloudWatch(level, message);
}

export const logger = {
  enabled,
  info: (message) => line('info', message),
  error: (message) => line('error', message),
};
