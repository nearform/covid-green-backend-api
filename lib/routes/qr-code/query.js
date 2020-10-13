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
  receiverEmail,
  receiverFirstName,
  receiverSurname,
  locationType,
  locationName,
  locationAddress,
  contactEmail,
  contactPhone
}) =>
  SQL`
    INSERT INTO qr_code (
      receiver_email,
      receiver_first_name,
      receiver_surname,
      location_type,
      location_name,
      location_address,
      contact_email,
      contact_phone
    )
    VALUES (
      ${receiverEmail},
      ${receiverFirstName},
      ${receiverSurname},
      ${locationType},
      ${locationName},
      ${locationAddress},
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

module.exports = {
  emailAddressInsert,
  emailAddressSelect,
  emailAddressDelete,
  qrCodeInsert,
  riskyVenueSelect,
  venueTypesSelect
}
