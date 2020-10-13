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

const posterDetails = {
  body: S.object()
    .prop(
      'receiverEmail',
      S.string()
        .format(S.FORMATS.EMAIL)
        .required()
    )
    .prop('receiverFirstName', S.string().required())
    .prop('receiverSurname', S.string().required())
    .prop('venueType', S.string().required())
    // @TODO - consider max length for venueName & venueAddress
    // they'll be rendered on the poster so need to fit within a predefined space
    .prop('venueName', S.string().required())
    .prop('venueAddress', S.string().required())
    .prop(
      'contactEmail',
      S.string()
        .format(S.FORMATS.EMAIL)
        .required()
    )
    .prop('contactPhone', S.string().required()),
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
    .prop('verificationCode', S.string().required()),
  response: {
    200: S.object().prop('id', S.string().required())
  }
}

const venueTypes = {
  response: {
    200: S.object().prop(
      'venueTypes',
      S.array().items(
        S.object()
          .prop('id', S.string().required())
          .prop('name', S.string().required())
          .prop('details', S.string().required())
      )
    )
  }
}

module.exports = { email, posterDetails, risky, verify, venueTypes }
