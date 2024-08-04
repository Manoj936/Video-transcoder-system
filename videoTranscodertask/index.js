import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "node:fs/promises";

import fsNonPrms from "fs"; // Import fs for createReadStream
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
  { name: "360p", width: 480, height: 360, bitrate: "800k" },
  { name: "480p", width: 858, height: 480, bitrate: "1400k" },
  { name: "720p", width: 1280, height: 720, bitrate: "2800k" },
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

async function uploadToS3(filePath, bucket, key) {
  const fileStream = await fsNonPrms.createReadStream(filePath);
  const parallelUploads3 = new Upload({
    client: Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: fileStream,
    },
  });

  parallelUploads3.on("httpUploadProgress", (progress) => {
    console.log(progress);
  });

  await parallelUploads3.done();
}

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

    const vidDir = `VID_${uuidv4()}`;
    await fs.mkdir(vidDir);
  
    const promises = RESOLUTIONS.map((res) => {
      return new Promise((resolve, reject) => {
        const vidOutputPath = path.join(vidDir, `${generateUnique6DigitNumber()}-${res.name}.mp4`);
        ffmpeg(originalVideoPath)
          .videoCodec("libx264")
          .audioCodec("aac")
          .size(`${res.width}x${res.height}`)
          .output(vidOutputPath)
          .on("start", () => {
            console.log(`${new Date().toISOString()} - Transcoding started for ${res.name}`);
          })
          .on("end", async () => {
            try {
              const files = await fs.readdir(vidDir);
              const uploadPromises = files.map((file) =>
                uploadToS3(path.join(vidDir, file), FINAL_BUCKET_NAME, `${vidDir}/${file}`)
              );
              await Promise.all(uploadPromises);
              console.log(`${new Date().toISOString()} - Upload success for ${res.name}`);
              resolve();
            } catch (uploadError) {
              reject(uploadError);
            }
          })
          .on("error", (error) => {
            console.error(`${new Date().toISOString()} - Error during transcoding: ${error.message}`);
            reject(error);
          })
          .run();
      });
    });
    await Promise.all(promises);
    await fs.unlink(originalVideoPath); // Clean up original file
    await fs.rmdir(vidDir, { recursive: true }); // Clean up HLS directory

    console.log(
      `${new Date().toISOString()} - Transcoding and upload complete`
    );
    process.exit(0); // Exit the Node.js process
  } catch (error) {
    console.error(`${new Date().toISOString()} - Error: ${error.message}`);
    process.exit(1); // Exit the Node.js process with error
  }
}

init();
