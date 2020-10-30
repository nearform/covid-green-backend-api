jest.mock('aws-sdk')

const getConfig = require('../../../lib/config')
const faker = require('faker')
const jwt = require('jsonwebtoken')
const { SQS } = require('aws-sdk')

const { free, insert } = require('./query')

const mockSendPromise = jest.fn()
const mockSend = jest.fn()

SQS.mockImplementation(() => ({
  sendMessage: mockSend
}))

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
    mockSendPromise.mockResolvedValue({})
    mockSend.mockReturnValue({ promise: mockSendPromise })
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

    const selfIsolationEndDate = '2020-10-30'
    const response = await server.inject({
      method: 'POST',
      url: '/notices/create',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        selfIsolationEndDate
      }
    })

    const payload = JSON.parse(response.payload)

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery).toHaveBeenCalledWith(insert(selfIsolationEndDate))
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
      const selfIsolationEndDate = new Date()

      const mockQuery = jest.fn()
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ endDate: selfIsolationEndDate }]
      })
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{}] })

      server.pg.write.query = mockQuery

      const params = {
        key: faker.random.uuid(),
        senderEmail: faker.internet.email(),
        senderFullName: faker.random.words(),
        recipients: [faker.internet.email()],
        sendToAdmin: true
      }
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: params
      })

      expect(response.statusCode).toEqual(204)
      expect(mockQuery).toHaveBeenCalledTimes(2)
      expect(mockSend).toHaveBeenCalledTimes(1)
      expect(mockSend).toHaveBeenCalledWith({
        QueueUrl: options.aws.noticesQueueUrl,
        MessageBody: JSON.stringify({
          ...params,
          date: selfIsolationEndDate
        })
      })
    })

    it('should require valid key', async () => {
      const mockQuery = jest.fn()
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })

      server.pg.write.query = mockQuery

      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid(),
          senderEmail: faker.internet.email(),
          senderFullName: faker.random.words(),
          recipients: [faker.internet.email()]
        }
      })

      expect(response.statusCode).toEqual(400)
      expect(mockQuery).toHaveBeenCalledTimes(1)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should free key if send email fails', async () => {
      const mockQuery = jest.fn()
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ endDate: new Date() }]
      })
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{}] })

      mockSendPromise.mockRejectedValue(new Error())

      server.pg.write.query = mockQuery

      const key = faker.random.uuid()
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key,
          senderEmail: faker.internet.email(),
          senderFullName: faker.random.words(),
          recipients: [faker.internet.email()],
          sendToAdmin: true
        }
      })

      expect(response.statusCode).toEqual(500)
      expect(mockQuery).toHaveBeenCalledTimes(2)
      expect(mockQuery).toHaveBeenCalledWith(free(key))
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should require senderEmail', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid(),
          senderFullName: faker.random.words(),
          recipients: [faker.internet.email()]
        }
      })

      expect(response.statusCode).toEqual(400)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should require senderFullName', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid(),
          senderEmail: faker.internet.email(),
          recipients: [faker.internet.email()]
        }
      })

      expect(response.statusCode).toEqual(400)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should require at least a recipient', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid(),
          senderEmail: faker.internet.email(),
          senderFullName: faker.random.words(),
          recipients: []
        }
      })

      expect(response.statusCode).toEqual(400)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should require at most 3 recipients', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/notices/send',
        body: {
          key: faker.random.uuid(),
          senderEmail: faker.internet.email(),
          senderFullName: faker.random.words(),
          recipients: [
            faker.internet.email(),
            faker.internet.email(),
            faker.internet.email(),
            faker.internet.email()
          ]
        }
      })

      expect(response.statusCode).toEqual(400)
      expect(mockSend).not.toHaveBeenCalled()
    })
  })
})
