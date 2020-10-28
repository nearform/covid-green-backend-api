const SQL = require('@nearform/sql')

function insert() {
  return SQL`
    INSERT INTO notices DEFAULT VALUES
    RETURNING id
  `
}

function reserve(key) {
  return SQL`
    UPDATE notices
    SET status = 'reserved'
    WHERE id = ${key}
    AND status = 'available'
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
