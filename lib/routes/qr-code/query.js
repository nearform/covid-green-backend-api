const SQL = require('@nearform/sql')

const emailAddressInsert = ({ emailAddress, verificationCode }) =>
  SQL`INSERT INTO email_addresses (email_address, verification_code)
      VALUES (${emailAddress}, ${verificationCode})
      RETURNING id`

const emailAddressSelect = ({ lifetime, verificationCode }) =>
  SQL`SELECT id, email_address AS "encryptedEmail"
      FROM email_addresses
      WHERE verification_code = ${verificationCode}
      AND created_at >= CURRENT_TIMESTAMP - ${`${lifetime} mins`}::INTERVAL`

const emailAddressDelete = ({ id }) =>
  SQL`DELETE FROM email_addresses
      WHERE id = ${id}`

const qrCodeInsert = ({
  venueType,
  venueName,
  venueAddress,
  contactEmail,
  contactPhone
}) =>
  SQL`
    INSERT INTO qr_code (
      venue_type,
      venue_name,
      venue_address,
      contact_email,
      contact_phone
    )
    VALUES (
      ${venueType},
      ${venueName},
      ${venueAddress},
      ${contactEmail},
      ${contactPhone}
    )
    RETURNING id
  `

const riskyVenueSelect = () =>
  SQL`SELECT venue_id AS "id", start_time AS "from", end_time AS "to"
      FROM risky_venues
      WHERE start_time <= CURRENT_TIMESTAMP
      AND end_time >= CURRENT_TIMESTAMP`

const venueTypesSelect = () =>
  SQL`SELECT *
      FROM venue_types`

const riskyVenueCheck = venueId =>
  SQL`SELECT venue_id AS "id", start_time AS "from", end_time AS "to"
      FROM risky_venues
      WHERE id = ${venueId}
      AND start_time <= CURRENT_TIMESTAMP
      AND end_time >= CURRENT_TIMESTAMP`

module.exports = {
  emailAddressInsert,
  emailAddressSelect,
  emailAddressDelete,
  qrCodeInsert,
  riskyVenueSelect,
  venueTypesSelect,
  riskyVenueCheck
}
