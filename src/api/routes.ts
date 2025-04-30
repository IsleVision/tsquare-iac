import express from 'express';
import AWS from 'aws-sdk';
import {v4 as uuidv4} from 'uuid';
import {Client} from 'pg';

const router = express.Router();

const s3 = new AWS.S3();
const sqs = new AWS.SQS();

const client = new Client({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
});

client.connect();

router.post('/jobs',
    async (req, res) => {
        const {designId, camera, userId} = req.body;
        const jobId = uuidv4();

        try {
            await client.query(
                'INSERT INTO jobs (job_id, design_id, camera, user_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
                [jobId, designId, camera, userId, 'PENDING']
            );

            const params = {
                QueueUrl: process.env.QUEUE_URL!,
                MessageBody: JSON.stringify({jobId, designId, camera, userId}),
            };

            await sqs.sendMessage(params).promise();

            res.status(201).json({jobId});
        } catch (error) {
            console.error('Error creating job:', error);
            res.status(500).json({error: 'Internal Server Error'});
        }
    });

router.get('/jobs/:jobId',
    async (req, res) => {
        const {jobId} = req.params;

        try {
            const result = await client.query(
                'SELECT * FROM jobs WHERE job_id = $1',
                [jobId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({error: 'Job not found'});
            }

            const job = result.rows[0];
            return res.status(200).json({
                jobId: job.job_id,
                status: job.status,
                resultUrl: job.result_url,
                createdAt: job.created_at,
                updatedAt: job.updated_at,
            });
        } catch (error) {
            console.error('Error retrieving job:', error);
            return res.status(500).json({error: 'Internal Server Error'});
        }
    });

export default router;
