const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const path = require('path')
const { expect, test } = require('@playwright/test')

const applicationRoot = path.join(__dirname, '..')
const testOutputDirectory = path.join(__dirname, 'test_output', 'application')
const logsDirectory = path.join(testOutputDirectory, 'logs')
const socketPort = 5552
const startupTimeout = 10000

let application
let applicationOutput = ''
let applicationUrl

test.beforeAll(async () => {
  fs.rmSync(testOutputDirectory, { recursive: true, force: true })
  fs.mkdirSync(logsDirectory, { recursive: true })
  await verifyPortAvailable(socketPort)
  const httpPort = await getAvailablePort()
  applicationUrl = `http://127.0.0.1:${httpPort}`

  application = spawn(process.execPath, ['main.js'], {
    cwd: applicationRoot,
    env: {
      ...process.env,
      MMC_SERVER_DISABLE_UI: '1',
      MMC_SERVER_HTTP_PORT: httpPort.toString(),
      MMC_SERVER_SOCKET_PORT: socketPort.toString(),
      MMC_SERVER_APP_STORAGE_DIRECTORY: path.join(testOutputDirectory, 'storage')
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  application.stdout.on('data', appendApplicationOutput)
  application.stderr.on('data', appendApplicationOutput)
  await waitForPort(httpPort)
})

test.afterAll(async () => {
  await stopApplication()
  fs.writeFileSync(path.join(logsDirectory, 'application-output.log'), applicationOutput)
})

test('loads the MMC client and opens its Socket.IO connection', async ({ page }) => {
  const socketConnection = page.waitForEvent('websocket', {
    predicate: (webSocket) => webSocket.url().includes(`:${socketPort}/socket.io/`)
  })

  await page.goto(applicationUrl)
  await expect(page).toHaveTitle('MMC')
  await expect(page.locator('#q-app')).not.toBeEmpty()
  await socketConnection
})

test('displays the startup state after connecting', async ({ page }) => {
  await page.goto(applicationUrl)

  await expect(page.getByText('Startup', { exact: true })).toBeVisible()
  await expect(page.getByText('Connection details', { exact: true })).toBeVisible()
})

test('opens the startup information dialog', async ({ page }) => {
  await page.goto(applicationUrl)
  await page.getByRole('button', { name: 'INFO', exact: true }).click()

  await expect(page.getByText('Information about the Startup Dialog', { exact: true })).toBeVisible()
})

function appendApplicationOutput(data) {
  applicationOutput += data.toString()
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

function verifyPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => server.close((error) => error ? reject(error) : resolve()))
  })
}

function waitForPort(port) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + startupTimeout
    const attempt = () => {
      const socket = net.connect(port, '127.0.0.1')
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        if (application.exitCode !== null) {
          reject(new Error(`MMC Server exited before startup. Output:\n${applicationOutput}`))
        } else if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for MMC Server startup. Output:\n${applicationOutput}`))
        } else {
          setTimeout(attempt, 50)
        }
      })
    }
    attempt()
  })
}

async function stopApplication() {
  if (!application || application.exitCode !== null) {
    return
  }
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('MMC Server did not exit cleanly after SIGTERM')), startupTimeout)
    application.once('exit', (code, signal) => {
      clearTimeout(timeout)
      if (code === 0 && signal === null) {
        resolve()
      } else {
        reject(new Error(`MMC Server exited with code ${code} and signal ${signal}`))
      }
    })
    application.kill('SIGTERM')
  })
}
