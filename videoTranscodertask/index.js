import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { v4 as uuidv4 } from "uuid";

function generateUnique6DigitNumber() {
  let uniqueNumber;
  do {
    const uuid = uuidv4();
    uniqueNumber = parseInt(uuid.split("-").join("").substring(0, 6), 16);
  } while (uniqueNumber < 100000 || uniqueNumber > 999999);

  return uniqueNumber;
}

const RESOLUTIONS = [
  { name: "360p", width: 480, height: 360 },
  { name: "480p", width: 858, height: 480 },
  { name: "720p", width: 1280, height: 720 },
];

const Client = new S3Client({
  region: process.env.region,
  credentials: {
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey,
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const KEY = process.env.KEY;
const FINAL_BUCKET_NAME = process.env.FINAL_BUCKET_NAME;

async function init() {
  try {
    const downloadCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: KEY,
    });
    const result = await Client.send(downloadCommand);

    const originalFilePath = `OriginalVideo.mp4`;
    await fs.writeFile(originalFilePath, result.Body);
    const originalVideoPath = path.resolve(originalFilePath);

    const promises = RESOLUTIONS.map((res) => {
      const outPutFilePath = `${generateUnique6DigitNumber()}-${res.name}.mp4`;
      return new Promise((resolve, reject) => {
        ffmpeg(originalVideoPath)
          .output(outPutFilePath)
          .videoCodec("libx264")
          .audioCodec("aac")
          .size(`${res.width}x${res.height}`)
          .on("start", () => {
            console.log(`${new Date().toISOString()} - Transcoding started for ${res.name}`);
          })
          .on("end", async () => {
            try {
              const uploadCommand = new PutObjectCommand({
                Bucket: FINAL_BUCKET_NAME,
                Key: outPutFilePath,
                Body: await fs.readFile(outPutFilePath),
              });
              await Client.send(uploadCommand);
              console.log(`${new Date().toISOString()} - Upload success for ${res.name}`);
              await fs.unlink(outPutFilePath); // Clean up transcoded file
              resolve();
            } catch (uploadError) {
              reject(uploadError);
            }
          })
          .on("error", (error) => {
            console.error(`${new Date().toISOString()} - Error during transcoding: ${error.message}`);
            reject(error);
          })
          .format("mp4")
          .run();
      });
    });

    await Promise.all(promises);
    await fs.unlink(originalVideoPath); // Clean up original file
    process.exit(0); // Exit the Node.js process
  } catch (error) {
    console.error(`${new Date().toISOString()} - Error: ${error.message}`);
    process.exit(1); // Exit the Node.js process with error
  }
}

init();