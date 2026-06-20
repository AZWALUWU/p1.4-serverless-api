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
