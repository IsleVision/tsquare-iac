import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib/core';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class TsquareIacStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
    });

    // Create an IAM role for the EC2 instance
    const role = new iam.Role(this, 'EC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    // Attach necessary policies to the role
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonRDSFullAccess'));
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess'));

    // Create an RDS PostgreSQL instance
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.MICRO),
      vpc,
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      multiAz: false,
      allocatedStorage: 20,
    });

    // Create an SQS queue
    const queue = new sqs.Queue(this, 'RenderQueue');

    // Create an S3 bucket
    const bucket = new s3.Bucket(this, 'RenderResults');

    // Create a single EC2 instance for API and Worker
    const apiWorkerInstance = new ec2.Instance(this, 'ApiWorkerInstance', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      role,
    });

    // Copy your application code to the EC2 instance
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
        'yum update -y',
        'yum install -y nodejs npm',
        'mkdir -p /home/ec2-user/app',
        'cd /home/ec2-user/app',
        'curl -L https://github.com/IsleVision/tsquare-iac/archive/refs/heads/main.zip -o main.zip',
        'unzip main.zip',
        'mv tsquare-iac-main/* .',
        'rm -rf tsquare-iac-main main.zip',
        'npm install',
        `export DATABASE_HOST=${database.dbInstanceEndpointAddress}`,
        `export DATABASE_PORT=${database.dbInstanceEndpointPort}`,
        `export DATABASE_NAME=${database.instanceIdentifier}`,
        `export DATABASE_USER=${database.secret?.secretValueFromJson('username').unsafeUnwrap()}`,
        `export DATABASE_PASSWORD=${database.secret?.secretValueFromJson('password').unsafeUnwrap()}`,
        `export QUEUE_URL=${queue.queueUrl}`,
        `export BUCKET_NAME=${bucket.bucketName}`,
        // Initialize the database table
        `psql -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USER -d $DATABASE_NAME -c "CREATE TABLE IF NOT EXISTS jobs ( job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), design_id VARCHAR(255) NOT NULL, camera VARCHAR(255), result_url VARCHAR(1024), status VARCHAR(50) NOT NULL, user_id VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"`,
        'npm run start:api &',
        'npm run start:worker'
    );

    apiWorkerInstance.addUserData(userData.render());
  }
}
