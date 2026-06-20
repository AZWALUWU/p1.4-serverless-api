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
