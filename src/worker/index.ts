import {SQS, Message} from '@aws-sdk/client-sqs';
import {S3} from '@aws-sdk/client-s3';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const s3 = new S3();
const sqs = new SQS();
const client = new Client({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

client.connect();

const queueUrl = process.env.QUEUE_URL;
const bucketName = process.env.BUCKET_NAME;

async function processMessage(message: Message) {
  if (!message.Body) return;

  const job = JSON.parse(message.Body);
  const { jobId, designId, camera, userId } = job;

  console.log(`Processing job ${jobId}`);

  // Simulate rendering
  const result = `Result for job ${jobId}`;
  const resultKey = `${jobId}.txt`;
  const resultPath = path.join('/tmp', resultKey);

  fs.writeFileSync(resultPath, result);

  const s3Params = {
    Bucket: bucketName!,
    Key: resultKey,
    Body: fs.createReadStream(resultPath),
  };

  try {

    // Emulate 3-second rendering delay
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await s3.putObject(s3Params);

    await client.query(
      'UPDATE jobs SET status = $1, result_url = $2, updated_at = NOW() WHERE job_id = $3',
      ['COMPLETED', `http://${bucketName}.s3.amazonaws.com/${resultKey}`, jobId]
    );

    console.log(`Job ${jobId} completed`);

    // Delete the message from the queue
    const deleteParams = {
      QueueUrl: queueUrl!,
      ReceiptHandle: message.ReceiptHandle!,
    };

    await sqs.deleteMessage(deleteParams);
  } catch (error) {
    console.error('Error processing job:', error);
  }
}

async function pollQueue() {
  const params = {
    QueueUrl: queueUrl!,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,
  };

  try {
    const data = await sqs.receiveMessage(params);

    if (data?.Messages) {
      for (const message of data.Messages) {
        await processMessage(message);
      }
    }
  } catch (error) {
    console.error('Error polling queue:', error);
  }
  finally {
    setTimeout(pollQueue, 10000);
  }
}

pollQueue();
