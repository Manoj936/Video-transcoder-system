/*
1: We will download the original video

2: We will start the transcoding process

3: We will push the transcoded file to another bucket

*/

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from "fluent-ffmpeg";


const RESOLUTIONS = [
    {name : '360p', width: 480 , height: 360},
    {name : '480p', width: 858 , height: 480},
    {name : '720p', width: 1280 , height: 720}
]
const Client = new S3Client({
  region: process.env.region,
  credentials: {
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey,
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const KEY = process.env.KEY;

async function init() {
  // download the original video
  const downloadCommand = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: KEY,
  });
  const result = await Client.send(downloadCommand);

  const originalFilePath = `OriginalVideo.mp4`
  await fs.writeFile(originalFilePath , result.body);
  const originalVideoPath = path.resolve(originalFilePath);

}

init();
