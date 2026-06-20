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
