const { DynamoDBClient, CreateTableCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
});

const params = {
  TableName: "Todos",
  AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
  KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
  BillingMode: "PAY_PER_REQUEST"
};

async function run() {
  try {
    const data = await client.send(new CreateTableCommand(params));
    console.log("✅ Table 'Todos' successfully created in LocalStack! STATUS:", data.TableDescription.TableStatus);
  } catch (err) {
    console.error("❌ Error creating table:", err.message);
  }
}
run();
