const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const path = require('path')
const { expect } = require('chai')
const { io } = require('socket.io-client')

const applicationRoot = path.join(__dirname, '..')
const testOutputDirectory = path.join(__dirname, 'test_output', 'socket-port-configuration')
const functionalTestLogsDirectory = path.join(testOutputDirectory, 'logs')
const applicationOutputFile = path.join(functionalTestLogsDirectory, 'application-output.log')
const defaultSocketPort = 5552
const startupTimeout = 10000

describe('MMC Server Socket.IO port configuration', function() {
  const applications = []

  before(function() {
    fs.rmSync(testOutputDirectory, { recursive: true, force: true })
  })

  after(function() {
    fs.mkdirSync(functionalTestLogsDirectory, { recursive: true })
    fs.writeFileSync(applicationOutputFile, applications.map((application) => application.output()).join('\n'))
  })

  it('starts Socket.IO on the requested port', async function() {
    this.timeout(startupTimeout + 1000)
    const socketPort = await getAvailableSocketPort()
    const application = startApplication(socketPort, applications)
    let socket
    try {
      socket = await connectSocket(socketPort, application)
      expect(socket.connected).to.equal(true)
    } finally {
      if (socket) {
        socket.disconnect()
      }
      await stopApplication(application)
    }
  })

  for (const invalidPort of ['not-a-port', '-1']) {
    it(`falls back to the default Socket.IO port for ${invalidPort}`, async function() {
      this.timeout(startupTimeout + 1000)
      await verifyPortAvailable(defaultSocketPort)
      const application = startApplication(invalidPort, applications)
      let socket
      try {
        socket = await connectSocket(defaultSocketPort, application)
        expect(socket.connected).to.equal(true)
      } finally {
        if (socket) {
          socket.disconnect()
        }
        await stopApplication(application)
      }
    })
  }

  it('reports a Socket.IO port conflict and exits cleanly', async function() {
    this.timeout(startupTimeout + 1000)
    const portReservation = await reserveAvailablePort()
    const socketPort = portReservation.address().port
    const application = startApplication(socketPort, applications)

    const { code, signal } = await waitForExit(application.process)

    expect(code).to.equal(1)
    expect(signal).to.equal(null)
    expect(application.output()).to.match(/VLCB startup failed: listen EADDRINUSE/)

    await closeServer(portReservation)
    await expectConnectionFailure(socketPort)
  })
})

function startApplication(socketPort, applications) {
  let output = ''
  fs.mkdirSync(testOutputDirectory, { recursive: true })
  const applicationProcess = spawn(process.execPath, ['main.js'], {
    cwd: applicationRoot,
    env: {
      ...process.env,
      MMC_SERVER_DISABLE_UI: '1',
      MMC_SERVER_HTTP_PORT: '0',
      MMC_SERVER_SOCKET_PORT: socketPort.toString(),
      MMC_SERVER_APP_STORAGE_DIRECTORY: path.join(testOutputDirectory, 'storage'),
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  applicationProcess.stdout.on('data', appendOutput)
  applicationProcess.stderr.on('data', appendOutput)

  function appendOutput(data) {
    output += data.toString()
  }

  const application = { process: applicationProcess, output: () => output }
  applications.push(application)
  return application
}

function connectSocket(socketPort, application) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${socketPort}`, {
      autoConnect: false,
      reconnectionDelay: 100,
      reconnectionDelayMax: 500,
      timeout: 1000
    })
    const timeout = setTimeout(() => {
      finish(new Error(`Timed out connecting to Socket.IO on port ${socketPort}. Output:\n${application.output()}`))
    }, startupTimeout)

    socket.once('connect', () => finish())
    socket.connect()

    function finish(error) {
      clearTimeout(timeout)
      if (error) {
        socket.disconnect()
        reject(error)
      } else {
        resolve(socket)
      }
    }
  })
}

async function stopApplication(application) {
  const exit = waitForExit(application.process)
  application.process.kill('SIGTERM')
  const { code, signal } = await exit
  expect(code).to.equal(0)
  expect(signal).to.equal(null)
}

function waitForExit(process) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('MMC Server did not exit cleanly.'))
    }, startupTimeout)
    process.once('error', finish)
    process.once('exit', (code, signal) => finish(null, { code, signal }))

    function finish(error, result) {
      clearTimeout(timeout)
      if (error) {
        reject(error)
      } else {
        resolve(result)
      }
    }
  })
}

function getAvailableSocketPort() {
  return new Promise((resolve, reject) => {
    const portFinder = net.createServer()
    portFinder.once('error', reject)
    portFinder.listen(0, '127.0.0.1', () => {
      const { port } = portFinder.address()
      portFinder.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

function verifyPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const portFinder = net.createServer()
    portFinder.once('error', reject)
    portFinder.listen(port, '127.0.0.1', () => {
      portFinder.close((error) => error ? reject(error) : resolve())
    })
  })
}

function reserveAvailablePort() {
  return new Promise((resolve, reject) => {
    const portReservation = net.createServer()
    portReservation.once('error', reject)
    portReservation.listen(0, '127.0.0.1', () => resolve(portReservation))
  })
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

function expectConnectionFailure(socketPort) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${socketPort}`, {
      autoConnect: false,
      reconnection: false,
      timeout: 1000
    })
    const timeout = setTimeout(() => {
      socket.disconnect()
      reject(new Error(`Timed out waiting for Socket.IO connection failure on port ${socketPort}`))
    }, startupTimeout)

    socket.once('connect', () => {
      clearTimeout(timeout)
      socket.disconnect()
      reject(new Error(`Socket.IO unexpectedly connected on port ${socketPort}`))
    })
    socket.once('connect_error', () => {
      clearTimeout(timeout)
      socket.disconnect()
      resolve()
    })
    socket.connect()
  })
}
