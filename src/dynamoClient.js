const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const config = { region: "us-east-1" };

if (process.env.AWS_SAM_LOCAL || process.env.LOCALSTACK_HOSTNAME || process.env.NODE_ENV === "local") {
  // Use LOCALSTACK_HOSTNAME inside Docker container, fallback to localhost for scripts
  const host = process.env.LOCALSTACK_HOSTNAME || "localhost";
  config.endpoint = `http://${host}:4566`;
  config.credentials = { accessKeyId: "test", secretAccessKey: "test" };
}

const dynamoClient = new DynamoDBClient(config);
module.exports = dynamoClient;
