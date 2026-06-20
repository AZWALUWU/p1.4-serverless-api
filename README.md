# Complete Engineering Guide: Serverless Todo API (LocalStack to AWS Cloud)

This guide documents the step-by-step engineering process of building, debugging, and deploying a production-ready, full-stack serverless CRUD REST API. The architecture leverages **AWS Lambda**, **Amazon API Gateway**, and **Amazon DynamoDB**, utilizing **Serverless Framework** and **LocalStack** for local emulation.

---

## 1. Prerequisites

Before beginning, ensure your local development environment has the following components installed:

* **Node.js** (v18.x or higher recommended)
* **Docker Desktop** (Required to run LocalStack containers)
* **Postman** (For API testing)
* **AWS CLI** (Optional, for advanced infrastructure validation)

---

## Step 1: Project Initialization & Dependencies

Initialize a clean Node.js environment and install the required AWS SDK v3 clients along with development tools.

### Commands

```bash
# Create and move to the project root directory
mkdir serverless-todo-api
cd serverless-todo-api

# Initialize package.json
npm init -y

# Install production dependencies (AWS SDK v3)
npm install @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb

# Install development dependencies (Serverless v3 Framework & LocalStack plugin)
npm install -D serverless@3 serverless-localstack

```

### Explanation

* `@aws-sdk/client-dynamodb` & `@aws-sdk/util-dynamodb`: The official modular AWS SDK v3 for interacting with DynamoDB.
* `serverless@3`: We explicitly lock down version 3 of the Serverless Framework to allow headless offline deployment without mandatory cloud account setups.
* `serverless-localstack`: The bridge plugin that intercepts Serverless commands and reroutes them to our local LocalStack container instead of the actual AWS endpoints.

---

## Step 2: Local Infrastructure Setup via Docker & LocalStack

To emulate an AWS environment completely offline, create a `docker-compose.yml` file in the root directory.

### Script (`docker-compose.yml`)

```yaml
services:
  localstack:
    container_name: localstack_main
    image: localstack/localstack:3.5.0
    ports:
      - "127.0.0.1:4566:4566"
      - "127.0.0.1:4510-4559:4510-4559"
    environment:
      - AWS_DEFAULT_REGION=us-east-1
    volumes:
      - "${LOCALSTACK_VOLUME_DIR:-./volume}:/var/lib/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"

```

### Commands

```powershell
# Spin up the LocalStack container in detached (background) mode
docker-compose up -d

```

### Explanation

* Removing the explicit `SERVICES` environment variable tells LocalStack v3 to enable its multi-service core engine automatically. This prevents service-to-service communication failures (e.g., Lambda failing to talk to CloudWatch Logs or CloudFormation).

---

## Step 3: Database Initialization Script

Create a script named `create-table.js` in the root folder to initialize the local DynamoDB database table.

### Script (`create-table.js`)

```javascript
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

```

### Commands

```powershell
node create-table.js

```

---

## Step 4: Developing Core Lambda Logics (`src/`)

Create a subfolder named `src/` to hold your Lambda source code files.

### 4.1 DynamoDB Client (`src/dynamoClient.js`)

This client handles dynamic routing between local container networks and live AWS endpoints.

```javascript
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

```

> **Key Architecture Detail:** Using `process.env.LOCALSTACK_HOSTNAME` prevents `ECONNREFUSED` errors by mapping the correct internal gateway IP when Lambda triggers inside isolated Docker networks.

### 4.2 Create Todo Handler (`src/createTodo.js`)

Uses native Node.js `crypto` to bypass external dependency risks within ephemeral containers.

```javascript
const { PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const crypto = require("crypto");
const dynamoClient = require("./dynamoClient");

exports.handler = async (event) => {
  try {
    let body = {};
    if (event.body) {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    }
    const { title, description } = body;

    if (!title) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "Title is required" })
      };
    }

    const todoItem = {
      id: crypto.randomUUID(),
      title,
      description: description || "",
      completed: false,
      createdAt: new Date().toISOString()
    };

    await dynamoClient.send(new PutItemCommand({
      TableName: "Todos",
      Item: marshall(todoItem)
    }));

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Todo created successfully", data: todoItem })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Failed to create todo", error: error.message })
    };
  }
};

```

### 4.3 Get All Todos Handler (`src/getTodos.js`)

```javascript
const { ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const dynamoClient = require("./dynamoClient");

exports.handler = async () => {
  try {
    const { Items } = await dynamoClient.send(new ScanCommand({ TableName: "Todos" }));
    const result = Items ? Items.map(item => unmarshall(item)) : [];
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to fetch data", error: error.message })
    };
  }
};

```

### 4.4 Get Single Todo By ID (`src/getTodo.js`)

```javascript
const { GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const dynamoClient = require("./dynamoClient");

exports.handler = async (event) => {
  try {
    const { id } = event.pathParameters;
    const { Item } = await dynamoClient.send(new GetItemCommand({
      TableName: "Todos",
      Key: marshall({ id })
    }));

    if (!Item) {
      return { statusCode: 404, body: JSON.stringify({ message: "Todo not found" }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(unmarshall(Item))
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

```

### 4.5 Update Todo Handler (`src/updateTodo.js`)

```javascript
const { UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const dynamoClient = require("./dynamoClient");

exports.handler = async (event) => {
  try {
    const { id } = event.pathParameters;
    const { title, description, completed } = JSON.parse(event.body || "{}");

    const params = {
      TableName: "Todos",
      Key: marshall({ id }),
      UpdateExpression: "set title = :t, description = :d, completed = :c",
      ExpressionAttributeValues: marshall({
        ":t": title,
        ":d": description || "",
        ":c": completed ?? false
      }),
      ReturnValues: "ALL_NEW"
    };

    await dynamoClient.send(new UpdateItemCommand(params));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Todo updated successfully" })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

```

### 4.6 Delete Todo Handler (`src/deleteTodo.js`)

```javascript
const { DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const dynamoClient = require("./dynamoClient");

exports.handler = async (event) => {
  try {
    const { id } = event.pathParameters;
    await dynamoClient.send(new DeleteItemCommand({
      TableName: "Todos",
      Key: marshall({ id })
    }));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: "Todo item deleted successfully" })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

```

---

## Step 5: Infrastructure as Code (IaC) Configuration

Create a comprehensive `serverless.yml` in the project root directory. It maps functions to API Gateway HTTP events, injects dynamic environment contexts, establishes secure **IAM Least Privilege** roles for live deployment, and instructs AWS to spin up a native DynamoDB table.

### Configuration (`serverless.yml`)

```yaml
service: serverless-todo-api

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    NODE_ENV: ${opt:stage, 'dev'}
  
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - dynamodb:Scan
            - dynamodb:GetItem
            - dynamodb:PutItem
            - dynamodb:UpdateItem
            - dynamodb:DeleteItem
          Resource: "arn:aws:dynamodb:us-east-1:*:table/Todos"

plugins:
  - serverless-localstack

custom:
  localstack:
    stages:
      - local
    host: http://localhost:4566
    autostart: false

functions:
  createTodo:
    handler: src/createTodo.handler
    events:
      - http:
          path: todos
          method: post
          cors: true
  getTodos:
    handler: src/getTodos.handler
    events:
      - http:
          path: todos
          method: get
          cors: true
  getTodo:
    handler: src/getTodo.handler
    events:
      - http:
          path: todos/{id}
          method: get
          cors: true
  updateTodo:
    handler: src/updateTodo.handler
    events:
      - http:
          path: todos/{id}
          method: put
          cors: true
  deleteTodo:
    handler: src/deleteTodo.handler
    events:
      - http:
          path: todos/{id}
          method: delete
          cors: true

resources:
  Resources:
    TodosTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: Todos
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
        KeySchema:
          - AttributeName: id
            KeyType: HASH
        BillingMode: PAY_PER_REQUEST

```

---

## Step 6: Local Deployment & Postman Testing

### Commands

```powershell
# Deploy the stack directly into your LocalStack engine
npx serverless deploy --stage local

```

The terminal will generate a structured endpoint array pointing to an ID variable configuration resembling: `http://localhost:4566/restapis/ehlgjvk0kx/local/_user_request_/todos`

### Postman Integration Schema

To test seamlessly, save the file below as `serverless-todo-api.postman_collection.json` and import it into Postman. Update the `apiId` collection variable with the unique string returned by your terminal execution output (`ehlgjvk0kx`).

```json
{
	"info": {
		"_postman_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
		"name": "Serverless Todo API (LocalStack)",
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	},
	"item": [
		{
			"name": "Create Todo",
			"request": {
				"method": "POST",
				"header": [{ "key": "Content-Type", "value": "application/json" }],
				"body": {
					"mode": "raw",
					"raw": "{\n    \"title\": \"Build Serverless Architecture\",\n    \"description\": \"Complete Lambda and LocalStack integration\"\n}"
				},
				"url": {
					"raw": "http://localhost:4566/restapis/{{apiId}}/local/_user_request_/todos",
					"protocol": "http",
					"host": ["localhost"],
					"port": "4566",
					"path": ["restapis", "{{apiId}}", "local", "_user_request_", "todos"]
				}
			}
		},
		{
			"name": "Get All Todos",
			"request": {
				"method": "GET",
				"url": {
					"raw": "http://localhost:4566/restapis/{{apiId}}/local/_user_request_/todos",
					"protocol": "http",
					"host": ["localhost"],
					"port": "4566",
					"path": ["restapis", "{{apiId}}", "local", "_user_request_", "todos"]
				}
			}
		}
	],
	"variable": [
		{ "key": "apiId", "value": "ehlgjvk0kx", "type": "string" }
	]
}

```

---

## Step 7: Production Deployment to AWS Cloud

Once verified locally, push the infrastructure directly onto AWS Cloud using the global secure authentication tokens via IAM user accounts.

### Kredensial Setup Command

```powershell
npx serverless config credentials --provider aws --key YOUR_AWS_ACCESS_KEY_ID --secret YOUR_AWS_SECRET_ACCESS_KEY

```

### Production Deployment Command

```powershell
npx serverless deploy

```

### Verification Command

Run a direct query against the global live cloud endpoint returned by the deployment process:

```bash
curl https://6240198ci9.execute-api.us-east-1.amazonaws.com/dev/todos

```

### Expected Response

```json
[]

```

An empty array response status 200 confirms that API Gateway routed the traffic through Lambda, and Lambda queried the live cloud production NoSQL DynamoDB server cluster successfully.
