const S = require('fluent-schema')

const key = S.string()
  .format('uuid')
  .required()

const create = {
  response: {
    200: S.object().prop('key', key)
  }
}

const send = {
  body: S.object().prop('key', key),
  response: {
    204: S.null()
  }
}

module.exports = {
  create,
  send
}
