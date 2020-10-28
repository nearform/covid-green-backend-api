const fp = require('fastify-plugin')
const { BadRequest } = require('http-errors')

const schema = require('./schema')
const { insert, reserve, consume, free, isAvailable } = require('./query')

async function notices(server, options) {
  async function createNewNotice() {
    const res = await server.pg.write.query(insert())
    return res.rows[0]
  }

  async function reserveKeyIfAvailable(key) {
    const { rowCount } = await server.pg.write.query(reserve(key))
    if (rowCount === 0) {
      throw new BadRequest('Invalid key')
    }
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

  async function sendEmail(name, recepients) {
    server.log.info('implement me')
  }

  server.route({
    method: 'POST',
    url: '/notices/create',
    schema: schema.create,
    handler: async request => {
      request.authenticate()

      const { id: key } = await createNewNotice()

      return { key }
    }
  })

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

  server.route({
    method: 'POST',
    url: '/notices/send',
    schema: schema.send,
    handler: async (request, response) => {
      const { key, fullName, recepients } = request.body

      await reserveKeyIfAvailable(key)

      try {
        await sendEmail(fullName, recepients)
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
