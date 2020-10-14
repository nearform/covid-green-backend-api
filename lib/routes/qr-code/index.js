const crypto = require('crypto')
const fp = require('fastify-plugin')
const jwt = require('jsonwebtoken')
const schema = require('./schema')
const util = require('util')
const AWS = require('aws-sdk')
const { NotFound } = require('http-errors')
const {
  emailAddressInsert,
  emailAddressSelect,
  emailAddressDelete,
  qrCodeInsert,
  riskyVenueSelect,
  venueTypesSelect
} = require('./query')

const randomBytes = util.promisify(crypto.randomBytes)

async function qrCode(server, options, done) {
  const ses = new AWS.SES({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  })
  const sqs = new AWS.SQS({ region: process.env.AWS_REGION })

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
      const verificationCode = Math.floor(100000 + Math.random() * 900000)

      await server.pg.write.query(
        emailAddressInsert({
          emailAddress: await encrypt(emailAddress),
          verificationCode
        })
      )

      /*await ses.sendEmail({
        Destination: {
          ToAddresses: [emailAddress]
        },
        Message: {
          Body: {
            Text: {
              Data: `Your verification code is ${verificationCode}`
            }
          },

          Subject: {
            Data: `Here is your verification code`
          }
        },
        Source: 'pat.mcgrath@nearform.com'
      })*/

      return { verificationCode }
    }
  })

  server.route({
    method: 'PUT',
    url: '/email',
    schema: schema.verify,
    handler: async request => {
      const { emailAddress, verificationCode } = request.body

      const { rowCount, rows } = await server.pg.write.query(
        emailAddressSelect({
          verificationCode,
          lifetime: options.qr.emailAddressVerifyLifetime
        })
      )

      if (rowCount === 0) {
        throw new NotFound('Invalid or expired verificationCode')
      }

      const [{ id, encryptedEmail }] = rows

      if (emailAddress !== decrypt(encryptedEmail)) {
        throw new NotFound('Email address does not match')
      }

      await server.pg.write.query(emailAddressDelete({ id }))

      return {
        token: jwt.sign({ emailAddress }, options.qr.secret, {
          algorithm: 'ES256',
          expiresIn: `${options.qr.emailAddressVerifyLifetime}m`,
          subject: 'emailAddress'
        })
      }
    }
  })

  server.route({
    method: 'GET',
    url: '/venues/types',
    schema: schema.types,
    handler: async () => {
      const { rows } = await server.pg.read.query(venueTypesSelect())

      return {
        venueTypes: rows
      }
    }
  })

  server.route({
    method: 'POST',
    url: '/venues',
    schema: schema.create,
    handler: async (request, response) => {
      const {
        receiverEmail,
        receiverFirstName,
        venueType,
        venueName,
        venueAddress,
        contactEmail,
        contactPhone
      } = request.body

      const {
        rows: [{ id }]
      } = await server.pg.write.query(
        qrCodeInsert({
          venueType,
          venueName,
          venueAddress,
          contactEmail: await encrypt(contactEmail),
          contactPhone: await encrypt(contactPhone)
        })
      )

      const body = {
        token: jwt.sign({ venueName, venueAddress, id }, options.qr.secret, {
          algorithm: 'ES256'
        }),
        appUrl: options.qr.appUrl,
        bucketName: options.qr.bucketName,
        id,
        name: venueName,
        location: venueAddress,
        receiverEmail,
        receiverName: receiverFirstName
      }

      const message = {
        QueueUrl: options.qr.queueUrl,
        MessageBody: JSON.stringify(body)
      }

      await sqs.sendMessage(message).promise()

      response.status(204)
    }
  })

  server.route({
    method: 'GET',
    url: '/venues/risky',
    schema: schema.risky,
    handler: async () => {
      const { rows } = await server.pg.read.query(riskyVenueSelect())

      return {
        riskyVenues: rows
      }
    }
  })

  done()
}

module.exports = fp(qrCode)
