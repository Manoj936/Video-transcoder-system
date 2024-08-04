import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { setTimeout } from "timers/promises";

dotenv.config();

const sqsClient = new SQSClient({
  region: process.env.AWSREGION,
  credentials: {
    accessKeyId: process.env.AWSACCESSKEYID,
    secretAccessKey: process.env.AWSSECRETACCESSKEY,
  },
});

const ecsClient = new ECSClient({
  region: process.env.AWSREGION,
  credentials: {
    accessKeyId: process.env.AWSACCESSKEYID,
    secretAccessKey: process.env.AWSSECRETACCESSKEY,
  },
});

async function Init() {
  const command = new ReceiveMessageCommand({
    QueueUrl: process.env.QueueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10,
  });

  while (true) {
    try {
      const { Messages } = await sqsClient.send(command);
      if (!Messages) {
        console.log("No messages");
        continue;
      }

      for (let message of Messages) {
        const { MessageId, Body, ReceiptHandle } = message;
        console.log(`${new Date().toISOString()} - Message Received: ${MessageId}`);

        const event = JSON.parse(Body);

        if ("Service" in event && "Event" in event && event.Event === "s3:TestEvent") {
          continue;
        }

        for (const record of event.Records) {
          const { s3 } = record;
          const { bucket, object: { key } } = s3;

          const runTaskCommand = new RunTaskCommand({
            taskDefinition: process.env.TaskARN,
            cluster: process.env.ClusterARN,
            launchType: "FARGATE",
            networkConfiguration: {
              awsvpcConfiguration: {
                subnets: [process.env.SUBNET1, process.env.SUBNET2, process.env.SUBNET3],
                securityGroups: [process.env.SG1],
                assignPublicIp: "ENABLED",
              },
            },
            overrides: {
              containerOverrides: [
                {
                  name: "videotranscoder",
                  environment: [
                    { name: "BUCKET_NAME", value: bucket.name },
                    { name: "KEY", value: key },
                    { name: "region", value: process.env.AWSREGION },
                    { name: "accessKeyId", value: process.env.AWSACCESSKEYID },
                    { name: "secretAccessKey", value: process.env.AWSSECRETACCESSKEY },
                    { name: "FINAL_BUCKET_NAME", value: process.env.FINAL_BUCKET_NAME },
                  ],
                },
              ],
            },
          });

          await ecsClient.send(runTaskCommand);
          await sqsClient.send(new DeleteMessageCommand({
            QueueUrl: process.env.QueueUrl,
            ReceiptHandle,
          }));
        }
      }
    } catch (err) {
      console.error(`${new Date().toISOString()} - Error: ${err.message}`);
      await setTimeout(5000); // Adding delay to prevent rapid looping on error
    }
  }
}

Init();
