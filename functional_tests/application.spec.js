const { spawn } = require('child_process')
const path = require('path')
const { expect } = require('chai')
const { io } = require('socket.io-client')

const applicationRoot = path.join(__dirname, '..')
const socketServerUrl = 'http://127.0.0.1:5552'
const startupTimeout = 10000

describe('MMC Server functional tests', function() {
  let application
  let socket
  let serverStatus
  let moduleNames
  let applicationOutput = ''

  before(function(done) {
    this.timeout(startupTimeout + 1000)

    application = spawn(process.execPath, ['main.js'], {
      cwd: applicationRoot,
      env: {
        ...process.env,
        MMC_SERVER_DISABLE_UI: '1',
        MMC_SERVER_HTTP_PORT: '0'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    application.stdout.on('data', appendApplicationOutput)
    application.stderr.on('data', appendApplicationOutput)
    application.once('error', finishStartup)
    application.once('exit', (code, signal) => {
      finishStartup(new Error(`MMC Server exited before startup (code: ${code}, signal: ${signal}). Output:\n${applicationOutput}`))
    })

    socket = io(socketServerUrl, {
      autoConnect: false,
      reconnectionDelay: 100,
      reconnectionDelayMax: 500,
      timeout: 1000
    })

    let connected = false
    let startupFinished = false
    const timeout = setTimeout(() => {
      finishStartup(new Error(`Timed out waiting for MMC Server startup. Output:\n${applicationOutput}`))
    }, startupTimeout)

    socket.on('connect', () => {
      connected = true
      completeWhenReady()
    })
    socket.on('SERVER_STATUS', (status) => {
      serverStatus = status
      completeWhenReady()
    })
    socket.on('MODULE_NAMES', (modules) => {
      moduleNames = modules
      completeWhenReady()
    })

    socket.connect()

    function completeWhenReady() {
      if (connected && serverStatus && moduleNames) {
        finishStartup()
      }
    }

    function finishStartup(error) {
      if (startupFinished) {
        return
      }
      startupFinished = true
      clearTimeout(timeout)
      done(error)
    }
  })

  after(function(done) {
    if (socket) {
      socket.disconnect()
    }

    if (!application || application.exitCode !== null) {
      done()
      return
    }

    const timeout = setTimeout(() => {
      application.kill('SIGKILL')
    }, 5000)
    application.once('exit', () => {
      clearTimeout(timeout)
      done()
    })
    application.kill('SIGTERM')
  })

  it('connects a Socket.IO client', function() {
    expect(socket.connected).to.equal(true)
  })

  it('sends initial server status and module names', function() {
    expect(serverStatus).to.have.nested.property('busConnection.state')
    expect(serverStatus.mode).to.equal('STARTUP')
    expect(moduleNames).to.be.an('object')
  })

  function appendApplicationOutput(data) {
    applicationOutput += data.toString()
  }
})
