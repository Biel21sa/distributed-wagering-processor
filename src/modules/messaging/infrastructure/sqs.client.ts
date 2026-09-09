import {
  SQSClient,
} from '@aws-sdk/client-sqs';

export const sqsClient =
  new SQSClient({
    region:
      process.env.AWS_REGION ??
      'us-east-1',

    endpoint:
      process.env.SQS_ENDPOINT ??
      'http://localhost:4566',

    credentials: {
      accessKeyId:
        'test',

      secretAccessKey:
        'test',
    },
  });