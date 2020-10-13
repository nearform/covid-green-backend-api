const SQL = require('@nearform/sql')

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

module.exports = { qrCodeInsert }
