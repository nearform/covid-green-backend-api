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

const emailAddressUpdate = ({ id }) =>
  SQL`UPDATE email_addresses
      SET verification_code = NULL
      WHERE id = ${id}`

const riskyVenueSelect = () =>
  SQL`SELECT venue_id AS "id", start_time AS "from", end_time AS "to"
      FROM risky_venues
      WHERE start_time <= CURRENT_TIMESTAMP
      AND end_time >= CURRENT_TIMESTAMP`

module.exports = {
  emailAddressInsert,
  emailAddressSelect,
  emailAddressUpdate,
  riskyVenueSelect
}
