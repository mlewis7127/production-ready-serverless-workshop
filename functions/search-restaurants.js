const Log = require('@dazn/lambda-powertools-logger')
const wrap = require('@dazn/lambda-powertools-pattern-basic')
const ssm = require('@middy/ssm')

const DocumentClient = require('aws-sdk/clients/dynamodb').DocumentClient
const dynamodb = new DocumentClient()

const { serviceName, stage } = process.env
const tableName = process.env.restaurants_table

const findRestaurantsByTheme = async (theme, count) => {
  Log.debug('finding restaurants from DynamoDB with theme ...', {
    count,
    theme
  })
  const req = {
    TableName: tableName,
    Limit: count,
    FilterExpression: "contains(themes, :theme)",
    ExpressionAttributeValues: { ":theme": theme }
  }

  const resp = await dynamodb.scan(req).promise()
  Log.debug('found restaurants', {
    count: resp.Items.length
  })
  return resp.Items
}

module.exports.handler = wrap(async (event, context) => {
  const req = JSON.parse(event.body)
  const theme = req.theme
  Log.info('got secret string', { secret: context.secretString })
  const restaurants = await findRestaurantsByTheme(theme, process.env.defaultResults)
  const response = {
    statusCode: 200,
    body: JSON.stringify(restaurants)
  }

  return response
}).use(ssm({
  cache: true,
  cacheExpiryInMillis: 5 * 60 * 1000, // 5 mins
  names: {
    config: `/${serviceName}/${stage}/search-restaurants/config`
  },
  onChange: () => {
    const config = JSON.parse(process.env.config)
    process.env.defaultResults = config.defaultResults
  }
})).use(ssm({
  cache: true,
  cacheExpiryInMillis: 5 * 60 * 1000, // 5 mins
  names: {
    secretString: `/${serviceName}/${stage}/search-restaurants/secretString`
  },
  setToContext: true,
  throwOnFailedCall: true
}))