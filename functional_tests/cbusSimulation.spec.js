const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const path = require('path')
const cbusLib = require('cbuslibrary')
const { expect } = require('chai')
const { io } = require('socket.io-client')

const simulatorDirectory = process.env.MMC_CBUS_SIMULATOR_DIRECTORY
const applicationRoot = path.join(__dirname, '..')
const testOutputDirectory = path.join(__dirname, 'test_output', 'cbus-simulation')
const logsDirectory = path.join(testOutputDirectory, 'logs')
const startupTimeout = 10000
const simulatorPort = 5550

const describeSimulator = simulatorDirectory ? describe : describe.skip

describeSimulator('MMC Server CBUS simulation', function() {
  let simulator
  let application
  let socket
  let socketPort
  let applicationOutput = ''
  let simulatorOutput = ''

  before(async function() {
    this.timeout(startupTimeout * 2)
    expect(fs.existsSync(path.join(simulatorDirectory, 'server.js'))).to.equal(true,
      `MMC_CBUS_SIMULATOR_DIRECTORY must point to a CbusNetworkSimulator checkout: ${simulatorDirectory}`)

    fs.rmSync(testOutputDirectory, { recursive: true, force: true })
    fs.mkdirSync(logsDirectory, { recursive: true })
    await verifyPortAvailable(simulatorPort)

    simulator = startSimulator()
    await waitForPort(simulatorPort, simulator, () => simulatorOutput)

    socketPort = await getAvailableSocketPort()
    application = startProcess(process.execPath, ['main.js'], applicationRoot, appendApplicationOutput, {
      MMC_SERVER_DISABLE_UI: '1',
      MMC_SERVER_HTTP_PORT: '0',
      MMC_SERVER_SOCKET_PORT: socketPort.toString(),
      MMC_SERVER_APP_STORAGE_DIRECTORY: path.join(testOutputDirectory, 'storage')
    })
    socket = await connectSocket(socketPort, application, () => applicationOutput)
  })

  after(async function() {
    if (socket) {
      socket.disconnect()
    }
    await stopProcess(application)
    await stopProcess(simulator)
    fs.writeFileSync(path.join(logsDirectory, 'application-output.log'), applicationOutput)
    fs.writeFileSync(path.join(logsDirectory, 'simulator-output.log'), simulatorOutput)
  })

  it('connects to the supported simulated CBUS network and relays long accessory commands', async function() {
    this.timeout(startupTimeout * 2)
    const notifications = []
    const traffic = []
    const events = []
    socket.on('SERVER_NOTIFICATION', (notification) => notifications.push(notification))
    socket.on('CBUS_TRAFFIC', (data) => traffic.push(data))
    socket.on('BUS_EVENTS', (data) => events.push(data))

    const response = await emitWithAck(socket, 'START_CONNECTION', {
      mode: 'Network',
      host: '127.0.0.1',
      hostPort: simulatorPort
    })
    expect(response).to.deep.include({ success: true, status: true })

    await waitFor(() => notifications.some((notification) => notification.message === 'Network port connected'),
      'MMC Server to report the simulated network connection')

    socket.emit('ACCESSORY_LONG_ON', { nodeNumber: 1, eventNumber: 2 })

    await waitFor(() => traffic.some((data) => data.direction === 'Out' && data.json.mnemonic === 'ACON' &&
      data.json.nodeNumber === 1 && data.json.eventNumber === 2), 'the simulated CBUS network to receive ACON 1:2')
    await waitFor(() => simulatorOutput.includes('Received message') && simulatorOutput.includes('ACON'),
      'CbusNetworkSimulator to process ACON 1:2')

    socket.emit('ACCESSORY_LONG_OFF', { nodeNumber: 1, eventNumber: 2 })

    await waitFor(() => events.some((data) => Object.values(data).some((event) =>
      event.nodeNumber === 1 && event.eventNumber === 2 && event.status === 'off' && event.type === 'long')),
    'ACCESSORY_LONG_OFF to create an ACOF bus event')
  })

  it('relays a simulated node response back to Socket.IO clients', async function() {
    this.timeout(startupTimeout)
    const traffic = []
    socket.on('CBUS_TRAFFIC', (data) => traffic.push(data))

    socket.emit('SEND_CBUS_MESSAGE', cbusLib.encodeRQNPN(10, 1))

    await waitFor(() => traffic.some((data) => data.direction === 'In' && data.json.mnemonic === 'PARAN' &&
      data.json.nodeNumber === 10 && data.json.parameterIndex === 1),
    'the simulator response to be relayed as inbound CBUS traffic')
  })

  it('relays a simulator accessory event that updates the bus event state', async function() {
    this.timeout(startupTimeout)
    const events = []
    socket.on('BUS_EVENTS', (data) => events.push(data))

    sendSimulatorCommand('acon1 40 1 1')

    await waitFor(() => events.some((data) => Object.values(data).some((event) =>
      event.nodeNumber === 40 && event.eventNumber === 1 && event.status === 'on' && event.type === 'long')),
    'the simulator accessory event to update bus event state')
  })

  it('notifies clients of a network failure and reconnection', async function() {
    this.timeout(startupTimeout * 2)
    const notifications = []
    const failures = []
    socket.on('SERVER_NOTIFICATION', (notification) => notifications.push(notification))
    socket.on('NETWORK_CONNECTION_FAILURE', (failure) => failures.push(failure))

    await stopProcess(simulator)
    await waitFor(() => failures.some((failure) => failure.message === 'Network error - retrying connection'),
      'a network failure notification')

    simulator = startSimulator()
    await waitForPort(simulatorPort, simulator, () => simulatorOutput)
    await waitFor(() => notifications.some((notification) => notification.message === 'Network port connected'),
      'a network reconnection notification')
  })

  function startSimulator() {
    return startProcess(process.execPath, ['server.js'], simulatorDirectory, appendSimulatorOutput)
  }

  function sendSimulatorCommand(command) {
    simulator.stdin.write(`${command}\n`)
  }

  function appendApplicationOutput(data) {
    applicationOutput += data.toString()
  }

  function appendSimulatorOutput(data) {
    simulatorOutput += data.toString()
  }
})

function startProcess(command, args, cwd, appendOutput, environment = {}) {
  const childProcess = spawn(command, args, {
    cwd,
    env: { ...process.env, ...environment },
    stdio: ['pipe', 'pipe', 'pipe']
  })
  childProcess.stdout.on('data', appendOutput)
  childProcess.stderr.on('data', appendOutput)
  return childProcess
}

function connectSocket(port, application, output) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      autoConnect: false,
      reconnectionDelay: 100,
      reconnectionDelayMax: 500,
      timeout: 1000
    })
    const timeout = setTimeout(() => finish(new Error(`Timed out connecting to MMC Server. Output:\n${output()}`)), startupTimeout)
    socket.once('connect', () => finish())
    socket.once('connect_error', () => {})
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

function emitWithAck(socket, event, data) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event} acknowledgement`)), startupTimeout)
    socket.emit(event, data, (response) => {
      clearTimeout(timeout)
      resolve(response)
    })
  })
}

function waitForPort(port, childProcess, output) {
  return waitFor(() => new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1')
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  }), `CbusNetworkSimulator on port ${port}. Output:\n${output()}`, childProcess)
}

async function waitFor(condition, description, childProcess) {
  const deadline = Date.now() + startupTimeout
  while (Date.now() < deadline) {
    if (childProcess && childProcess.exitCode !== null) {
      throw new Error(`${description} exited before becoming ready`)
    }
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for ${description}`)
}

async function stopProcess(childProcess) {
  if (!childProcess || childProcess.exitCode !== null) {
    return
  }
  const exit = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Process did not exit cleanly after SIGTERM')), startupTimeout)
    childProcess.once('exit', (code, signal) => {
      clearTimeout(timeout)
      if ((code === 0 && signal === null) || signal === 'SIGTERM') {
        resolve()
      } else {
        reject(new Error(`Process exited with code ${code} and signal ${signal}`))
      }
    })
  })
  childProcess.kill('SIGTERM')
  await exit
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
    portFinder.listen(port, '127.0.0.1', () => portFinder.close((error) => error ? reject(error) : resolve()))
  })
}
