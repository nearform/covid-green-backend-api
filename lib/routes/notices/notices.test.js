const getConfig = require('../../../lib/config')
const faker = require('faker')
const jwt = require('jsonwebtoken')

describe('exposure routes', () => {
  let server, options

  beforeAll(async () => {
    options = await getConfig()

    server = require('fastify')()
    server.register(require('../../plugins/jwt'), options)
    server.register(require('../../plugins/pg'), options)
    server.register(require('.'), options)

    await server.ready()
  })

  beforeEach(() => {
    jest.resetAllMocks()
  })

  afterAll(() => server.close())

  it('should create new notice and return key', async () => {
    const token = jwt.sign(
      { id: faker.lorem.word() },
      options.security.jwtSecret
    )

    const key = faker.random.uuid()
    const results = [{ id: key }]

    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: results })

    server.pg.write.query = mockQuery

    const response = await server.inject({
      method: 'POST',
      url: '/notices/create',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    const payload = JSON.parse(response.payload)

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(response.statusCode).toEqual(200)
    expect(payload).toEqual({ key })
  })

  it('should verify key', async () => {
    const mockQuery = jest.fn()
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ count: 1 }] })
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ count: 0 }] })

    server.pg.read.query = mockQuery

    const makeCall = key =>
      server.inject({
        method: 'POST',
        url: '/notices/verify',
        body: { key }
      })

    const call1 = await makeCall(faker.random.uuid())
    const call2 = await makeCall(faker.random.uuid())

    expect(JSON.parse(call1.body)).toEqual({ ok: true })
    expect(JSON.parse(call2.body)).toEqual({ ok: false })
    expect(mockQuery).toHaveBeenCalledTimes(2)
  })

  describe('send', () => {
    it('should queue email', async () => {
      const mockQuery = jest.fn()
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{}] })
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{}] })

      server.pg.write.query = mockQuery

      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid()
        }
      })

      expect(response.statusCode).toEqual(204)
      expect(mockQuery).toHaveBeenCalledTimes(2)
    })
  })
})
