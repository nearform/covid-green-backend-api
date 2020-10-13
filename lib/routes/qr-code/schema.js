const S = require('fluent-schema')

// @TODO - need to confirm these and their format
const LOCATION_TYPES = {
  ACCOMMODATION: 'accommodation',
  MEDICAL_FACILITY: 'medical facility',
  NON_RESIDENTIAL_INSTITUTION: 'non-residential institution'
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
    .prop('locationType', S.enum(Object.values(LOCATION_TYPES)).required())
    // @TODO - consider max length for locationName & locationAddress
    // they'll be rendered on the poster so need to fit within a predefined space
    .prop('locationName', S.string().required())
    .prop('locationAddress', S.string().required())
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

module.exports = { posterDetails }
