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
