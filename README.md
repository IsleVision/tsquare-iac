# Tsquare IaC Project

This project is a boilerplate for developing AWS infrastructure using the [AWS Cloud Development Kit (CDK)](https://docs.aws.amazon.com/cdk/v2/guide/) with TypeScript. It defines an infrastructure stack that provisions resources such as an Amazon VPC, RDS PostgreSQL instance, EC2 instance, SQS queue, and S3 bucket.

The application includes:
- **API server**: Built with Express.js to handle job creation and querying.
- **Worker process**: Polls from an SQS queue, processes jobs, uploads results to S3, and updates job status in RDS.
- **Infrastructure as Code (IaC)**: Managed by AWS CDK to provision and manage AWS resources.

## Getting Started

### Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org) (v18.x or later)
- [npm](https://www.npmjs.com/)
- [AWS CLI](https://aws.amazon.com/cli/) configured with your credentials
- [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html): Install via `npm install -g aws-cdk`

### Useful Commands

| Command | Description |
|--------|-------------|
| `npm run build` | Compiles TypeScript code into JavaScript. |
| `npm run watch` | Watches for changes and compiles automatically. |
| `npm run test` | Runs Jest unit tests. |
| `npx cdk synth` | Synthesizes the CDK stack into a CloudFormation template. |
| `npx cdk deploy` | Deploys the stack to your default AWS account/region. |
| `npx cdk diff` | Compares deployed stack with current state. |
| `npx cdk destroy` | Removes all resources deployed by the stack. |

## Architecture Overview

The infrastructure consists of:

- **VPC**: A virtual private cloud with two availability zones.
- **RDS PostgreSQL**: A managed relational database instance.
- **SQS Queue**: Used to decouple job submission and processing.
- **S3 Bucket**: Stores job result files.
- **EC2 Instance**: Hosts both the API and worker processes.
- **IAM Role**: Grants necessary permissions to the EC2 instance for accessing AWS services.


## Control Flow

1. **API receives job request** (`POST /jobs`)
2. **Stores job in RDS with status PENDING**
3. **Publishes job message to SQS queue**
4. **Worker polls SQS queue for new messages**
5. **Processes job (simulated)**
6. **Uploads result to S3**
7. **Updates job status to COMPLETED in RDS with result URL**

![flow diagram.png](flow%20diagram.png)
## Application Structure

```
tsquare_iac/
├── bin/                  # CDK entry point
│   └── tsquare_iac.ts
├── lib/                  # CDK stack definitions
│   └── tsquare_iac-stack.ts
├── src/
│   ├── api/              # Express API server
│   │   ├── index.ts
│   │   └── routes.ts
│   └── worker/           # Job processor
│       └── index.ts
├── test/                 # Unit tests
├── README.md             # Project documentation
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── cdk.json              # CDK configuration
```


