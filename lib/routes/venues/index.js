const crypto = require('crypto')
const fp = require('fastify-plugin')
const schema = require('./schema')
const util = require('util')
const {
  emailAddressInsert,
  emailAddressSelect,
  emailAddressUpdate,
  riskyVenueSelect
} = require('./query')
const { NotFound } = require('http-errors')

const randomBytes = util.promisify(crypto.randomBytes)

async function venues(server, options, done) {
  const encrypt = async value => {
    const key = Buffer.from(options.security.encryptKey)
    const iv = await randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    const buffer = cipher.update(value.toString())
    const encrypted = Buffer.concat([buffer, cipher.final()])

    return `${iv.toString('hex')}${encrypted.toString('hex')}`
  }

  const decrypt = mobile => {
    const key = Buffer.from(options.security.encryptKey)
    const iv = Buffer.from(mobile.substr(0, 32), 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    const buffer = decipher.update(mobile.substr(32), 'hex')

    return Buffer.concat([buffer, decipher.final()]).toString()
  }

  server.route({
    method: 'POST',
    url: '/email',
    schema: schema.email,
    handler: async (request, response) => {
      const { emailAddress } = request.body
      const nonce = (await randomBytes(32)).toString('hex')

      await server.pg.write.query(
        emailAddressInsert({
          emailAddress: await encrypt(emailAddress),
          nonce
        })
      )

      response.status(204)
    }
  })

  server.route({
    method: 'PUT',
    url: '/email',
    schema: schema.verify,
    handler: async request => {
      const { nonce } = request.body

      const { rowCount, rows } = await server.pg.write.query(
        emailAddressUpdate({
          nonce,
          lifetime: options.venues.emailAddressVerifyLifetime
        })
      )

      if (rowCount === 0) {
        throw new NotFound('Invalid or expired nonce')
      }

      const [{ id }] = rows

      return { id }
    }
  })

  server.route({
    method: 'GET',
    url: '/risky',
    schema: schema.risky,
    handler: async () => {
      const { rows } = await server.pg.read.query(riskyVenueSelect())

      return {
        venues: rows
      }
    }
  })

  done()
}

module.exports = fp(venues)
