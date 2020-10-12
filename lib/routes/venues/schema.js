const S = require('fluent-schema')

const email = {
  body: S.object().prop(
    'emailAddress',
    S.string()
      .format('email')
      .required()
  ),
  response: {
    204: S.null()
  }
}

const risky = {
  response: {
    200: S.object().prop(
      'venues',
      S.array().items(
        S.object()
          .prop('id', S.string().required())
          .prop(
            'from',
            S.string()
              .format('date-time')
              .required()
          )
          .prop(
            'to',
            S.string()
              .format('date-time')
              .required()
          )
      )
    )
  }
}

const verify = {
  body: S.object()
    .prop(
      'emailAddress',
      S.string()
        .format('email')
        .required()
    )
    .prop('nonce', S.string().required()),
  response: {
    200: S.object().prop('id', S.string().required())
  }
}

module.exports = { email, risky, verify }
