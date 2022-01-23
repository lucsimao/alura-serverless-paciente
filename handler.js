'use strict';
const AWS = require('aws-sdk');
const uuid = require('uuid');

const isOffline = () => process.env.IS_OFFLINE;

const dynamodbOfflineOptions = {
  region: 'localhost',
  endpoint: 'http://localhost:8000',
};

const dynamoDb = isOffline()
  ? new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions)
  : new AWS.DynamoDB.DocumentClient(dynamodbOfflineOptions);

const params = { TableName: process.env.PACIENTES_TABLE };

module.exports.listarPacientes = async (event) => {
  try {
    const queryString = {
      limit: 5,
      ...event.queryStringParameters,
    };

    const { limit, next } = queryString;
    const localParams = {
      ...params,
      Limit: limit,
    };

    if (next) {
      localParams.ExclusiveStartKey = {
        paciente_id: next,
      };
    }

    const data = await dynamoDb.scan(localParams).promise();
    const nextToken =
      data.LastEvaluatedKey !== undefined
        ? data.LastEvaluatedKey.paciente_id
        : null;

    const result = {
      items: data.Items,
      next_token: nextToken,
    };

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error('Error', err);
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : 'Exception',
        message: err.message ? err.message : 'Unknown error',
      }),
    };
  }
};

module.exports.obterPaciente = async (event) => {
  try {
    const { pacienteId } = event.pathParameters;

    const data = await dynamoDb
      .get({
        ...params,
        Key: { paciente_id: pacienteId },
      })
      .promise();

    const paciente = data.Item;

    if (!paciente) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Paciente não encontrado' }, null, 2),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(paciente, null, 2),
    };
  } catch (err) {
    console.error('Error', err);
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : 'Exception',
        message: err.message ? err.message : 'Unknown error',
      }),
    };
  }
};

module.exports.cadastrarPaciente = async (event) => {
  try {
    const dados = JSON.parse(event.body);

    const timestamp = new Date().getTime();
    const { nome, data_nascimento, email, telefone } = dados;

    const paciente = {
      paciente_id: uuid.v4(),
      nome,
      data_nascimento,
      email,
      telefone,
      status: true,
      criado_em: timestamp,
      atualizado_em: timestamp,
    };

    await dynamoDb
      .put({ TableName: process.env.PACIENTES_TABLE, Item: paciente })
      .promise();

    return {
      statusCode: 201,
    };
  } catch (err) {
    console.error('Error', err);
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : 'Exception',
        message: err.message ? err.message : 'Unknown error',
      }),
    };
  }
};

module.exports.atualizarPaciente = async (event) => {
  const { pacienteId } = event.pathParameters;

  try {
    const dados = JSON.parse(event.body);

    const timestamp = new Date().getTime();
    const { nome, data_nascimento, email, telefone } = dados;

    await dynamoDb
      .update({
        ...params,
        Key: { paciente_id: pacienteId },
        UpdateExpression:
          'SET nome = :nome, data_nascimento = :dt, email = :email, telefone = :telefone, atualizado_em = :atualizado_em',
        ConditionExpression: 'attribute_exists(paciente_id)',
        ExpressionAttributeValues: {
          ':nome': nome,
          ':dt': data_nascimento,
          ':email': email,
          ':telefone': telefone,
          ':atualizado_em': timestamp,
        },
      })
      .promise();

    return {
      statusCode: 204,
    };
  } catch (err) {
    console.error('Error', err);
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : 'Exception',
        message: err.message ? err.message : 'Unknown error',
      }),
    };
  }
};

module.exports.excluirPaciente = async (event) => {
  try {
    const { pacienteId } = event.pathParameters;

    await dynamoDb
      .delete({
        ...params,
        Key: { paciente_id: pacienteId },
        ConditionExpression: 'attribute_exists(paciente_id)',
      })
      .promise();

    return {
      statusCode: 204,
    };
  } catch (err) {
    console.error('Error', err);
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : 'Exception',
        message: err.message ? err.message : 'Unknown error',
      }),
    };
  }
};
