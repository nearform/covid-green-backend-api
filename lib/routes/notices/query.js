const SQL = require('@nearform/sql')

function insert(endDate) {
  return SQL`
    INSERT INTO notices (self_isolation_end_date) VALUES (${endDate})
    RETURNING id
  `
}

function reserve(key) {
  return SQL`
    UPDATE notices
    SET status = 'reserved'
    WHERE id = ${key}
    AND status = 'available'
    RETURNING self_isolation_end_date AS "endDate"
  `
}

function consume(key) {
  return SQL`
    UPDATE notices
    SET status = 'used'
    WHERE id = ${key}
  `
}

function free(key) {
  return SQL`
    UPDATE notices
    SET status = 'available'
    WHERE id = ${key}
    AND status = 'reserved'
  `
}

function isAvailable(key) {
  return SQL`
    SELECT COUNT(id)::int AS count
    FROM notices
    WHERE id = ${key}
    AND status = 'available'`
}

module.exports = {
  isAvailable,
  insert,
  reserve,
  consume,
  free
}
