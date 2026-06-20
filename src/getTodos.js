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
