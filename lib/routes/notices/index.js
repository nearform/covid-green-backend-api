const fp = require('fastify-plugin')
const { SQS } = require('aws-sdk')
const { BadRequest } = require('http-errors')

const schema = require('./schema')
const { insert, reserve, consume, free, isAvailable } = require('./query')

async function notices(server, options) {
  if (!options.routes.notices) {
    console.log('Notices Endpoint: Off')
    return
  }

  console.log('Notices Endpoint: On')

  const sqs = new SQS({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  })

  async function createNewNotice(endDate) {
    const res = await server.pg.write.query(insert(endDate))
    return res.rows[0]
  }

  async function reserveKeyIfAvailable(key) {
    const { rowCount, rows } = await server.pg.write.query(reserve(key))
    if (rowCount === 0) {
      throw new BadRequest('Invalid key')
    }

    return rows[0]
  }

  function consumeKey(key) {
    return server.pg.write.query(consume(key))
  }

  function freeKey(key) {
    return server.pg.write.query(free(key))
  }

  async function isKeyAvailable(key) {
    const { rows } = await server.pg.read.query(isAvailable(key))
    return rows[0].count !== 0
  }

  async function sendEmail(params) {
    return sqs
      .sendMessage({
        QueueUrl: options.aws.noticesQueueUrl,
        MessageBody: JSON.stringify(params)
      })
      .promise()
  }

  /**
   * Allows users to create a self-isolation notice to others.
   *
   * This is the first step in the process and will create a unique key
   * to be used when the notice will be actually sent.
   *
   * See schema.js/verify for details on the input/output structure.
   *
   * All requests go through authentication which means both the user and device will be verified. This
   * process will prevent random people from submitting notices. Theoretically, only the app
   * can make this call.
   * However, no information about the user is used in generting the unique key.
   *
   * Responses:
   *  200: A new unique key for the notice has been generated.
   *  400: Validation error.
   */
  server.route({
    method: 'POST',
    url: '/notices/create',
    schema: schema.create,
    handler: async request => {
      request.authenticate()

      const { selfIsolationEndDate } = request.body

      const { id: key } = await createNewNotice(selfIsolationEndDate)

      return { key }
    }
  })

  /**
   * Allows clients to validate a unique key
   *
   * This is an optional first step in the process to send a self-isolation notice.
   *
   * See schema.js/verify for details on the input/output structure.
   *
   * Requests do not go through authentication which means the endpoint is open for anyone to use.
   *
   * Responses:
   *  200: Status of the key, ok:true if the key exists and has not been used, ok:false if the key either
   *       does not exist or has already been reserved or used.
   */
  server.route({
    method: 'POST',
    url: '/notices/verify',
    schema: schema.verify,
    handler: async request => {
      const { key } = request.body

      const ok = await isKeyAvailable(key)

      return { ok }
    }
  })

  /**
   * Allows users to send a self-isolation notice
   *
   * This the last step in the process and will enqueue the mail for sending.
   *
   * NOTE: Within the AWS notices queue the sender email, full name and unique key are stored together.
   * This should not be PII issue as the unique key has no link with user ids.
   * The implementation of the code reading off that AWS notices queue should also not store
   * the user email and full name.
   *
   * See schema.js/send for details on the input/output structure.
   *
   * Requests do not go through authentication which means the endpoint is open for anyone to use.
   * However, a valid unique key must be provided. If the key isn't provided or it is invalid or already used
   * the request will fail and no email will be sent.
   *
   * Responses:
   *  204: The email has been enqueued and the unique key invalidated.
   *  400: The key is not valid or has already been used. (Also: validation errors)
   */
  server.route({
    method: 'POST',
    url: '/notices/send',
    schema: schema.send,
    handler: async (request, response) => {
      const key = request.body.key

      const data = await reserveKeyIfAvailable(key)

      try {
        await sendEmail({
          ...request.body,
          date: data.endDate
        })
      } catch (err) {
        try {
          await freeKey(key)
        } catch {}
        throw err
      }

      await consumeKey(key)

      response.status(204)
    }
  })
}

module.exports = fp(notices)
