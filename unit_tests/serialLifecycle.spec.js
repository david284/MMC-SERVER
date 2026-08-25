'use strict';

require('./config/winston_test.js');
const EventEmitter = require('events').EventEmitter;
const expect = require('chai').expect;
const serialGC = require('../VLCB-server/serialGC');
const cbusServer = require('../VLCB-server/cbusServer');

function createSerialPortStub(listResult = []) {
  const ports = [];
  let portCreatedResolve;
  const portCreated = new Promise((resolve) => { portCreatedResolve = resolve });

  class SerialPortStub extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.isOpen = false;
      ports.push(this);
      portCreatedResolve(this);
    }

    close(callback) {
      this.isOpen = false;
      callback()
    }
  }

  SerialPortStub.list = async () => listResult;
  return {SerialPortStub, ports, portCreated};
}

describe('serial connection lifecycle tests', function() {
  it('does not report success until the serial port emits open', async function() {
    const stub = createSerialPortStub([{path: 'COM1'}]);
    const serial = serialGC.create({SerialPort: stub.SerialPortStub});
    let connected = false;
    const connectPromise = serial.connect('COM1').then((result) => {
      connected = result;
      return result;
    });

    await stub.portCreated;
    expect(connected).to.equal(false);
    expect(stub.ports).to.have.length(1);

    stub.ports[0].isOpen = true;
    stub.ports[0].emit('open');
    expect(await connectPromise).to.equal(true);
    await serial.close();
  });

  it('discovers a CANUSB device and connects after it opens', async function() {
    const stub = createSerialPortStub([{
      path: 'COM2',
      vendorId: '04D8',
      productId: 'F80C'
    }]);
    const serial = serialGC.create({SerialPort: stub.SerialPortStub});
    const connectPromise = serial.connect();

    const port = await stub.portCreated;
    expect(port.options.path).to.equal('COM2');
    port.isOpen = true;
    port.emit('open');
    expect(await connectPromise).to.equal(true);
    await serial.close();
  });

  it('returns false when no serial device is selected or discovered', async function() {
    const stub = createSerialPortStub([]);
    const serial = serialGC.create({SerialPort: stub.SerialPortStub});

    expect(await serial.connect()).to.equal(false);
    expect(stub.ports).to.have.length(0);
  });

  it('returns false when opening a serial port fails', async function() {
    const stub = createSerialPortStub([{path: 'COM1'}]);
    const serial = serialGC.create({SerialPort: stub.SerialPortStub});
    const connectPromise = serial.connect('COM1');

    await stub.portCreated;
    serial.once('error', () => {});
    stub.ports[0].emit('error', new Error('open failed'));
    expect(await connectPromise).to.equal(false);
  });

  it('settles a pending connection safely when closed before the port opens', async function() {
    const stub = createSerialPortStub([{path: 'COM1'}]);
    const serial = serialGC.create({SerialPort: stub.SerialPortStub});
    const connectPromise = serial.connect('COM1');
    const port = await stub.portCreated;

    await serial.close();
    port.isOpen = true;
    expect(() => port.emit('open')).not.to.throw();

    expect(await connectPromise).to.equal(false);
    expect(port.isOpen).to.equal(false);
  });

  for (const methodName of ['getSerialPorts', 'getCANUSBx']) {
    it(`${methodName} propagates device-list failures`, async function() {
      const stub = createSerialPortStub([]);
      const serial = serialGC.create({SerialPort: stub.SerialPortStub});
      stub.SerialPortStub.list = async () => { throw new Error('enumeration failed') };

      let result;
      try {
        await serial[methodName]();
      } catch (error) {
        result = error;
      }
      expect(result.message).to.equal('enumeration failed');
    });
  }

  it('prevents overlapping reconnection attempts and clears the reconnect timer on disposal', async function() {
    const serial = new EventEmitter();
    let releaseConnect;
    let connectCalls = 0;
    serial.connect = async () => {
      connectCalls += 1;
      await new Promise((resolve) => { releaseConnect = resolve });
      return true;
    };
    serial.close = async () => {};
    serial.write = () => {};

    const timers = [];
    const clearedTimers = [];
    const config = {eventBus: new EventEmitter()};
    const cbus = cbusServer(config, {
      serialGC: serial,
      setInterval: (callback) => {
        timers.push(callback);
        return callback;
      },
      clearInterval: (timer) => clearedTimers.push(timer)
    });
    cbus.enableSerialReconnect = true;
    cbus.targetSerial = 'COM1';

    cbus.serialConnectIntervalFunction();
    cbus.serialConnectIntervalFunction();
    expect(connectCalls).to.equal(1);

    const closePromise = cbus.close();
    releaseConnect();
    await closePromise;

    expect(clearedTimers).to.include(timers[0]);
    expect(cbus.enableSerialReconnect).to.equal(false);
    expect(serial.listenerCount('data')).to.equal(0);
    expect(serial.listenerCount('close')).to.equal(0);
    expect(serial.listenerCount('error')).to.equal(0);
    expect(serial.listenerCount('open')).to.equal(0);
  });

  it('reattaches serial listeners when a disposed CBUS server is reused', async function() {
    const serial = new EventEmitter();
    serial.connect = async () => true;
    serial.close = async () => {};
    serial.write = () => {};
    const config = {eventBus: new EventEmitter()};
    const cbus = cbusServer(config, {
      serialGC: serial,
      setInterval: () => ({}),
      clearInterval: () => {}
    });

    await cbus.close();
    expect(serial.listenerCount('data')).to.equal(0);
    cbus.server = {listening: true};

    expect(await cbus.connect(0, 'COM1')).to.equal(true);
    expect(serial.listenerCount('data')).to.equal(1);
    expect(serial.listenerCount('close')).to.equal(1);
    expect(serial.listenerCount('error')).to.equal(1);
    expect(serial.listenerCount('open')).to.equal(1);

    cbus.detachSerialListeners();
  });
});
