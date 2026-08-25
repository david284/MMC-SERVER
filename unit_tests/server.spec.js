'use strict';

require('./config/winston_test.js');
const expect = require('chai').expect;
const server = require('../VLCB-server/server.js');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

function createTestDependencies(options = {}) {
  const calls = [];
  const config = {};
  const status = {mode: 'TEST'};
  const listening = options.listening || Promise.resolve();

  function resource(name) {
    return {
      name,
      close: async () => calls.push(`close:${name}`)
    };
  }

  const resources = {
    cbusServer: resource('cbusServer'),
    messageRouter: resource('messageRouter'),
    mergAdminNode: {
      name: 'mergAdminNode',
      dispose: () => calls.push('dispose:mergAdminNode')
    },
    programNode: resource('programNode'),
    socketServer: {
      ...resource('socketServer'),
      listening
    }
  };

  return {
    calls,
    config,
    status,
    resources,
    dependencies: {
      config,
      status,
      cbusServerFactory: async (receivedConfig) => {
        calls.push('create:cbusServer');
        expect(receivedConfig).to.equal(config);
        return resources.cbusServer;
      },
      messageRouterFactory: async (receivedConfig) => {
        calls.push('create:messageRouter');
        expect(receivedConfig).to.equal(config);
        return resources.messageRouter;
      },
      mergAdminNodeFactory: async (receivedConfig) => {
        calls.push('create:mergAdminNode');
        expect(receivedConfig).to.equal(config);
        return resources.mergAdminNode;
      },
      programNodeFactory: async (receivedConfig) => {
        calls.push('create:programNode');
        expect(receivedConfig).to.equal(config);
        return resources.programNode;
      },
      socketServerFactory: async (...args) => {
        calls.push('create:socketServer');
        expect(args).to.deep.equal([
          config,
          resources.mergAdminNode,
          resources.messageRouter,
          resources.cbusServer,
          resources.programNode,
          status
        ]);
        return resources.socketServer;
      }
    }
  };
}

describe('server lifecycle tests', function() {
  it('creates all components and waits for the socket server to listen', async function() {
    const listening = deferred();
    const test = createTestDependencies({listening: listening.promise});
    let started = false;

    const runPromise = server.run(test.dependencies).then((lifecycle) => {
      started = true;
      return lifecycle;
    });

    await Promise.resolve();
    expect(started).to.equal(false);
    listening.resolve();

    const lifecycle = await runPromise;
    expect(lifecycle.status).to.equal(test.status);
    expect(test.calls.slice(0, 5)).to.deep.equal([
      'create:cbusServer',
      'create:messageRouter',
      'create:mergAdminNode',
      'create:programNode',
      'create:socketServer'
    ]);

    await lifecycle.close();
  });

  it('cleans up partially initialized resources after a factory fails', async function() {
    const test = createTestDependencies();
    const startupError = new Error('router creation failed');
    test.dependencies.messageRouterFactory = async () => {
      throw startupError;
    };

    let result;
    try {
      await server.run(test.dependencies);
    } catch (error) {
      result = error;
    }

    expect(result).to.equal(startupError);
    expect(test.calls).to.deep.equal([
      'create:cbusServer',
      'close:cbusServer'
    ]);
  });

  it('propagates listener errors and closes every initialized resource', async function() {
    const listenerError = new Error('listen failed');
    const test = createTestDependencies({listening: Promise.reject(listenerError)});

    let result;
    try {
      await server.run(test.dependencies);
    } catch (error) {
      result = error;
    }

    expect(result).to.equal(listenerError);
    expect(test.calls.slice(-5)).to.deep.equal([
      'close:socketServer',
      'close:programNode',
      'dispose:mergAdminNode',
      'close:messageRouter',
      'close:cbusServer'
    ]);
  });

  it('closes resources in reverse order and is safe to close repeatedly', async function() {
    const test = createTestDependencies();
    const lifecycle = await server.run(test.dependencies);

    await Promise.all([lifecycle.close(), lifecycle.close()]);

    expect(test.calls.slice(-5)).to.deep.equal([
      'close:socketServer',
      'close:programNode',
      'dispose:mergAdminNode',
      'close:messageRouter',
      'close:cbusServer'
    ]);
  });

  it('continues cleanup when one resource fails to close', async function() {
    const test = createTestDependencies();
    const closeError = new Error('socket close failed');
    test.resources.socketServer.close = async () => {
      test.calls.push('close:socketServer');
      throw closeError;
    };
    const lifecycle = await server.run(test.dependencies);

    let result;
    try {
      await lifecycle.close();
    } catch (error) {
      result = error;
    }

    expect(result).to.equal(closeError);
    expect(test.calls.slice(-5)).to.deep.equal([
      'close:socketServer',
      'close:programNode',
      'dispose:mergAdminNode',
      'close:messageRouter',
      'close:cbusServer'
    ]);
  });
});
