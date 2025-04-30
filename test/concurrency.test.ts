// tests/concurrency.test.ts
import axios from 'axios';
import {v4 as uuidv4} from 'uuid';

describe('Concurrency Test', () => {
    const apiUrl = 'http://localhost:3000'; // Adjust the URL to match your API endpoint

    it('should handle 10 concurrent job submissions and ensure FIFO order and completion', async () => {

        const jobIds: String[] = [];
        const promises: Promise<void>[] = [];

        // Submit 10 jobs concurrently
        for (let i = 0; i < 10; i++) {
            promises.push(
                axios.post(`${apiUrl}/jobs`, {designId: i, camera: 'default', userId: 'user1'})
                    .then(response => {
                        jobIds.push(
                             response.data.jobId,
                        );
                    })
            );
        }

        await Promise.all(promises);

        expect(jobIds.length).toBe(10);

        interface JobInfo {
            jobId: string;
            createdAt: number;
            updatedAt: number;
        }

        // Check the order and status of the jobs
        let jobInfos : JobInfo[] = [];
        for (let i = 0; i < 10; i++) {
            let jobStatus = 'PENDING';
            let retries = 0;
            const maxRetries = 20; // Adjust the number of retries as needed
            const retryInterval = 1000; // 1 second

            while (jobStatus !== 'COMPLETED' && retries < maxRetries) {
                const response = await axios.get(`${apiUrl}/jobs/${jobIds[i]}`);
                jobStatus = response.data.status;

                if (jobStatus === 'COMPLETED') {
                    jobInfos.push({
                        jobId: response.data.jobId,
                        createdAt: new Date(response.data.createdAt).getTime(),
                        updatedAt: new Date(response.data.updatedAt).getTime(),
                        });
                    expect(response.data.resultUrl).toContain(jobIds[i]);
                    break;
                }

                retries++;
                await new Promise(resolve => setTimeout(resolve, retryInterval));
            }

            expect(jobStatus).toBe('COMPLETED');
        }
        expect(jobInfos.length).toBe(10);
        jobInfos.sort((a, b) => a.createdAt - b.createdAt);
      // Assert updatedAt is in ascending order
      for (let i = 1; i < jobInfos.length; i++) {
        expect(jobInfos[i].updatedAt).toBeGreaterThanOrEqual(jobInfos[i - 1].updatedAt);
      }
    }, 60000); // Timeout to handle concurrent operations and retries
});
