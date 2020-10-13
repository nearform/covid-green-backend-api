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
  const enableRoute = true
  const enableEmail = false

  if (enableRoute) {
    const ses = new AWS.SES({ region: process.env.AWS_REGION })
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

        if (enableEmail) {
          ses.sendEmail(
            {
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
              Source: 'sourceEmailAddress'
            },
            (err, response) => console.log(err, response)
          )
        } else {
          console.log(`Verification code is ${verificationCode}`)
        }

        response.status(204)
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

    server.route({
      method: 'GET',
      url: '/venue-types',
      schema: schema.venueTypes,
      handler: async () => {
        const { rows } = await server.pg.read.query(venueTypesSelect())

        return {
          venueTypes: rows
        }
      }
    })

    server.route({
      method: 'POST',
      url: '/qr-code',
      schema: schema.posterDetails,
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
            contactEmail: encrypt(contactEmail),
            contactPhone: encrypt(contactPhone)
          })
        )

        const body = {
          token: jwt.sign({ venueName, venueAddress }, options.qr.secret, {
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
  }

  done()
}

module.exports = fp(qrCode)
