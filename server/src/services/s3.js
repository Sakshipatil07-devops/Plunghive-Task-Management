import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const bucket = process.env.S3_BUCKET_NAME;
const enabled = Boolean(bucket && process.env.AWS_ACCESS_KEY_ID);

const client = enabled ? new S3Client({ region: process.env.AWS_REGION }) : null;

export const s3 = {
  enabled,

  async createUploadUrl(key, contentType) {
    if (!enabled) return { mocked: true, uploadUrl: null, key };
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    return { mocked: false, uploadUrl, key };
  },

  async createDownloadUrl(key) {
    if (!enabled || !key) return null;
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn: 300 });
  },

  async deleteObject(key) {
    if (!enabled || !key) return;
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  },
};
