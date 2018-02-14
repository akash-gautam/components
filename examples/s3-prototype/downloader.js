const AWS = require('aws-sdk');
const uuidv4 = require('uuid/v4');

const dbClient = new AWS.DynamoDB.DocumentClient();

const putFileEntry = (fileUrl, fileName) =>
  new Promise((resolve, reject) => {
    const item = {
      id: uuidv4(),
      fileUrl,
      fileName
    };
    const params = {
      TableName: process.env.FILES_TABLE,
      Item: item
    };

    dbClient.put(params, err => {
      if (err) reject(err);
      else resolve(item);
    });
  });

module.exports.run = (event, context, callback) => {
  console.log('Event: ', event);
  putFileEntry(event.data.fileUrl, event.data.fileName)
    .then(() => {
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Success!'
        })
      };

      callback(null, response);
    })
    .catch(err => {
      console.log(err);
      callback('Something went wrong');
    });
};