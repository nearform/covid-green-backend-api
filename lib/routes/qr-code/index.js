const fp = require('fastify-plugin')
const jwt = require('jsonwebtoken')
const schema = require('./schema')
const { TooManyRequests } = require('http-errors')
const { qrCodeInsert } = require('./query')

async function qrCode(server, options, done) {
  const {
    routes: { qrCode },
    security: { qrCodeAppName, qrCodeVersion, qrCodeJwtSecret }
  } = options
  if (qrCode) {
    server.route({
      method: 'POST',
      url: '/qr-code',
      schema: schema.posterDetails,
      handler: async (request, response) => {
        const {
          receiverEmail,
          receiverFirstName,
          locationName,
          locationAddress
        } = request.body

        const {
          rowCount,
          rows: [{ id }]
        } = await server.pg.write.query(qrCodeInsert(request.body))

        if (rowCount === 0) {
          throw new TooManyRequests()
        }

        response.status(204)

        const token = jwt.sign(
          { locationName, locationAddress },
          qrCodeJwtSecret,
          { algorithm: 'ES256' }
        )

        // @TODO - replace with actual lambda call
        const triggerLambda = params =>
          console.log(`lambda triggered with ${JSON.stringify(params, 0, 2)}`)

        triggerLambda({
          id,
          token: `${qrCodeAppName}:${qrCodeVersion}:${token}`,
          name: locationName,
          location: locationAddress,
          receiverEmail,
          receiverName: receiverFirstName
        })
      }
    })
  }

  done()
}

module.exports = fp(qrCode)
