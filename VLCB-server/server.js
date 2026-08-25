'use strict';
const winston = require('winston');
const path = require('path');

const name = 'server.js';
winston.info({message: name + ': Loaded'});

let defaultConfig;

const status = {
  busConnection: {
    state: true
  },
  mode: 'STARTUP'
};

function getDependencies(overrides) {
  return {
    config: overrides.config || getDefaultConfig(),
    socketServerFactory: overrides.socketServerFactory || require('./socketServer').socketServer,
    cbusServerFactory: overrides.cbusServerFactory || require('./cbusServer'),
    messageRouterFactory: overrides.messageRouterFactory || require('./messageRouter'),
    mergAdminNodeFactory: overrides.mergAdminNodeFactory || require('./mergAdminNode.js'),
    programNodeFactory: overrides.programNodeFactory || require('./programNodeMMC.js'),
    status: overrides.status || status
  };
}

function getDefaultConfig() {
  if (!defaultConfig) {
    defaultConfig = require('./configuration.js')(__dirname, path.join(process.cwd(), 'logs'));
    defaultConfig.setSocketServerPort(5552);
  }
  return defaultConfig;
}

async function disposeResources(resources) {
  const errors = [];

  for (const resource of resources.reverse()) {
    try {
      if (typeof resource.close === 'function') {
        await resource.close();
      } else if (typeof resource.dispose === 'function') {
        await resource.dispose();
      }
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(errors, 'Failed to close server resources');
  }
}

exports.run = async function run(overrides = {}) {
  const dependencies = getDependencies(overrides);
  const resources = [];
  let closePromise;

  try {
    const cbusServer = await dependencies.cbusServerFactory(dependencies.config);
    resources.push(cbusServer);

    const messageRouter = await dependencies.messageRouterFactory(dependencies.config);
    resources.push(messageRouter);

    const mergAdminNode = await dependencies.mergAdminNodeFactory(dependencies.config);
    resources.push(mergAdminNode);

    const programNode = await dependencies.programNodeFactory(dependencies.config);
    resources.push(programNode);

    const socketServer = await dependencies.socketServerFactory(
      dependencies.config,
      mergAdminNode,
      messageRouter,
      cbusServer,
      programNode,
      dependencies.status
    );
    resources.push(socketServer);

    await socketServer.listening;

    return {
      cbusServer,
      messageRouter,
      mergAdminNode,
      programNode,
      socketServer,
      status: dependencies.status,
      close() {
        if (!closePromise) {
          closePromise = disposeResources([...resources]);
        }
        return closePromise;
      }
    };
  } catch (startupError) {
    try {
      await disposeResources(resources);
    } catch (cleanupError) {
      startupError.cleanupError = cleanupError;
    }
    throw startupError;
  }
};
