
import {SQSClient , ReceiveMessageCommand} from '@aws-sdk/client-sqs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const sqsClient = new SQSClient({
region : process.env.AWSREGION,
credentials:{
    accessKeyId: process.env.AWSACCESSKEYID,
    secretAccessKey : process.env.AWSSECRETACCESSKEY,
}
})

async function Init(){
    const command = new ReceiveMessageCommand ({
        QueueUrl : process.env.QueueUrl ,
        MaxNumberOfMessages : 1,
        WaitTimeSeconds : 10
    })
    //Subscribing to the sqs events
    while(true){
       const {Messages} =  await sqsClient.send(command)
       if(!Messages){
        console.log('No messages');
        continue;
       }
       try{
        for(let message of Messages){
            const {MessageId , Body} = message;
            // Receive the event
            console.log(MessageId , Body , "Message Received")
            // Validate the event
            const event = JSON.parse(Body)

            // Ignore test event
            if("Service" in event && "Event" in event ){
                if(event.Event === 's3:TestEvent') continue;
            }

            for(const record of event.Records){
                const { s3} = record;
                const {bucket , object : {key}} = s3
                //Spin up docker container
            }
    
            //delete the message from the queue
           }
       }
       catch(err){
        console.log(err)
       }
    }
}

Init()