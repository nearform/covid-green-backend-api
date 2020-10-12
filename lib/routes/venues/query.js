const SQL = require('@nearform/sql')

const emailAddressInsert = ({ emailAddress, nonce }) =>
  SQL`INSERT INTO email_addresses (email_address, nonce)
      VALUES (${emailAddress}, ${nonce})
      RETURNING id`

const emailAddressUpdate = ({ lifetime, nonce }) =>
  SQL`UPDATE email_addresses
      SET nonce = NULL
      WHERE nonce = ${nonce}
      AND created_at >= CURRENT_TIMESTAMP - ${`${lifetime} mins`}::INTERVAL
      RETURNING id`

const riskyVenueSelect = () =>
  SQL`SELECT venue_id AS "id", start_time AS "from", end_time AS "to"
      FROM risky_venues
      WHERE start_time <= CURRENT_TIMESTAMP
      AND end_time >= CURRENT_TIMESTAMP`

module.exports = {
  emailAddressInsert,
  emailAddressUpdate,
  riskyVenueSelect
}
