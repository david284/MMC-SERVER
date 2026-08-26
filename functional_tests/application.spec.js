const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const path = require('path')
const { expect } = require('chai')
const { io } = require('socket.io-client')

const applicationRoot = path.join(__dirname, '..')
const testOutputDirectory = path.join(__dirname, 'test_output', 'application')
const functionalTestLogsDirectory = path.join(testOutputDirectory, 'logs')
const applicationOutputFile = path.join(functionalTestLogsDirectory, 'application-output.log')
const startupTimeout = 10000

describe('MMC Server functional tests', function() {
  let application
  let socket
  let serverStatus
  let moduleNames
  let applicationOutput = ''
  let socketServerUrl
  let testDirectory

  before(function(done) {
    this.timeout(startupTimeout + 1000)

    getAvailableSocketPort().then((socketServerPort) => {
      fs.rmSync(testOutputDirectory, { recursive: true, force: true })
      fs.mkdirSync(testOutputDirectory, { recursive: true })
      socketServerUrl = `http://127.0.0.1:${socketServerPort}`
      application = spawn(process.execPath, ['main.js'], {
        cwd: applicationRoot,
        env: {
          ...process.env,
          MMC_SERVER_DISABLE_UI: '1',
          MMC_SERVER_HTTP_PORT: '0',
          MMC_SERVER_SOCKET_PORT: socketServerPort.toString(),
          MMC_SERVER_APP_STORAGE_DIRECTORY: path.join(testOutputDirectory, 'storage')
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
      const timeout = setTimeout(() => {
        finishStartup(new Error(`Timed out waiting for MMC Server startup. Output:\n${applicationOutput}`))
      }, startupTimeout)
      let startupFinished = false

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
    }).catch(done)
  })

  after(function(done) {
    if (socket) {
      socket.disconnect()
    }

    if (!application || application.exitCode !== null) {
      finishCleanup()
      return
    }

    let shutdownFinished = false
    const timeout = setTimeout(() => {
      finishShutdown(new Error('MMC Server did not exit cleanly after SIGTERM'))
    }, 5000)
    application.once('exit', (code, signal) => {
      try {
        expect(code).to.equal(0)
        expect(signal).to.equal(null)
        finishShutdown()
      } catch (error) {
        finishShutdown(error)
      }
    })
    application.kill('SIGTERM')

    function finishShutdown(error) {
      if (shutdownFinished) {
        return
      }
      shutdownFinished = true
      clearTimeout(timeout)
      finishCleanup(error)
    }

    function finishCleanup(error) {
      fs.mkdirSync(functionalTestLogsDirectory, { recursive: true })
      fs.writeFileSync(applicationOutputFile, applicationOutput)
      done(error)
    }
  })

  it('connects a Socket.IO client', function() {
    expect(socket.connected).to.equal(true)
  })

  it('sends initial server status and module names', function() {
    expect(serverStatus).to.have.nested.property('busConnection.state')
    expect(serverStatus.mode).to.equal('STARTUP')
    expect(moduleNames).to.be.an('object')
    expect(serverStatus.appStorageDirectory).to.equal(path.join(testOutputDirectory, 'storage'))
    expect(serverStatus.currentUserDirectory).to.equal(path.join(testOutputDirectory, 'storage'))
  })

  it('sends initial events after a client reconnects', function(done) {
    this.timeout(startupTimeout + 1000)
    socket.disconnect()

    socket = io(socketServerUrl, {
      autoConnect: false,
      reconnection: false,
      timeout: 1000
    })

    let connected = false
    let reconnectedServerStatus
    let reconnectedModuleNames
    let reconnectFinished = false
    const timeout = setTimeout(() => {
      finishReconnect(new Error(`Timed out waiting for MMC Server reconnection. Output:\n${applicationOutput}`))
    }, startupTimeout)

    socket.on('connect', () => {
      connected = true
      completeWhenReady()
    })
    socket.on('SERVER_STATUS', (status) => {
      reconnectedServerStatus = status
      completeWhenReady()
    })
    socket.on('MODULE_NAMES', (modules) => {
      reconnectedModuleNames = modules
      completeWhenReady()
    })
    socket.connect()

    function completeWhenReady() {
      if (connected && reconnectedServerStatus && reconnectedModuleNames) {
        expect(reconnectedServerStatus).to.have.nested.property('busConnection.state')
        expect(reconnectedServerStatus.mode).to.equal('STARTUP')
        expect(reconnectedModuleNames).to.be.an('object')
        finishReconnect()
      }
    }

    function finishReconnect(error) {
      if (reconnectFinished) {
        return
      }
      reconnectFinished = true
      clearTimeout(timeout)
      done(error)
    }
  })

  it('shuts down cleanly with a connected Socket.IO client', function(done) {
    this.timeout(startupTimeout + 1000)

    let clientDisconnected = false
    let applicationExited = false
    let shutdownFinished = false
    const timeout = setTimeout(() => {
      finishShutdown(new Error(`Timed out waiting for MMC Server shutdown. Output:\n${applicationOutput}`))
    }, startupTimeout)

    socket.once('disconnect', () => {
      clientDisconnected = true
      completeWhenReady()
    })
    application.once('exit', (code, signal) => {
      try {
        expect(code).to.equal(0)
        expect(signal).to.equal(null)
        applicationExited = true
        completeWhenReady()
      } catch (error) {
        finishShutdown(error)
      }
    })
    application.kill('SIGTERM')

    function completeWhenReady() {
      if (clientDisconnected && applicationExited) {
        verifyNewConnectionsFail()
      }
    }

    function verifyNewConnectionsFail() {
      const disconnectedClient = io(socketServerUrl, {
        autoConnect: false,
        reconnection: false,
        timeout: 1000
      })
      disconnectedClient.once('connect', () => {
        disconnectedClient.disconnect()
        finishShutdown(new Error('Socket.IO client connected after MMC Server shutdown'))
      })
      disconnectedClient.once('connect_error', () => {
        disconnectedClient.disconnect()
        finishShutdown()
      })
      disconnectedClient.connect()
    }

    function finishShutdown(error) {
      if (shutdownFinished) {
        return
      }
      shutdownFinished = true
      clearTimeout(timeout)
      done(error)
    }
  })

  function appendApplicationOutput(data) {
    applicationOutput += data.toString()
  }
})

function getAvailableSocketPort() {
  return new Promise((resolve, reject) => {
    const portFinder = net.createServer()
    portFinder.once('error', reject)
    portFinder.listen(0, '127.0.0.1', () => {
      const { port } = portFinder.address()
      portFinder.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve(port)
        }
      })
    })
  })
}
