# Extending the server

Use these recipes with [TESTING.md](../../TESTING.md). The server normally uses
dependency injection at the Socket.IO boundary, so the existing mocks in
`unit_tests/` are the starting point for behaviour tests.

## Add a client command

1. Find the closest `socket.on(...)` handler in `VLCB-server/socketServer.js`.
2. Define the event name, validate the required payload fields, and delegate to
   the appropriate injected service (`node`, `config`, `programNode`, or
   transport). Keep protocol encoding out of the Socket.IO handler.
3. If the command affects CBUS, add/reuse a method on `mergAdminNode` that
   encodes with `cbuslibrary` and queues via `CBUS_Queue`.
4. Add a Socket.IO test in `unit_tests/socketServer.spec.js`. Existing tests
   use `mock_messageRouter` and wait for queued messages to reach it.
5. If the bundled client must emit or consume the event, make the corresponding
   client-source change in its own source repository/build process; do not hand
   edit the generated files in `public/`.

## Handle a CBUS opcode or event

1. Confirm the decoded fields and opcode using `cbuslibrary` and the CBUS
   specification appropriate to the module/protocol change.
2. Add the smallest handler to `mergAdminNode.actions`, keyed by the opcode
   string used by decoded messages. Let `processGridConnectMessage` retain the
   existing validation and pre/post processing.
3. Update node/event state through the existing helpers such as `eventSend`,
   `updateNodeConfig`, or the event-variable storage methods; they control
   persistence and client updates.
4. Add focused cases in `unit_tests/mergAdminNode.spec.js`; add transport
   coverage in `messageRouter.spec.js` only when the wire route changes.

## Add configuration or persisted data

1. Locate the ownership boundary in `VLCB-server/configuration.js`: application
   settings, layout data, node data, backups, logs, or descriptors.
2. Add defaults and backward-compatible migration in `readAppSettings` when
   adding an application setting. Use the existing read/write methods rather
   than direct filesystem calls from Socket.IO or protocol code.
3. Add a `configuration.spec.js` test using its isolated test directories.
4. Expose the setting to clients only through an explicit Socket.IO response or
   the existing `SERVER_STATUS` payload, as appropriate.

## Change serial lifecycle behaviour

1. Keep byte/frame validation in `serialGC.js`; keep TCP fan-out and serial
   reconnect policy in `cbusServer.js`.
2. Preserve the division between serial reconnect (`cbusServer`) and TCP
   endpoint reconnect (`messageRouter`). Both currently retry every five
   seconds once enabled.
3. Make close/disposal safe: `cbusServer.close`, `messageRouter.close`, and
   `mergAdminNode.dispose` remove timers/listeners for tests and reuse.
4. Cover serial framing with `serialGC.spec.js` and bridge lifecycle with
   `cbusServer.spec.js`. Use the `MOCK_PORT` serial binding instead of hardware.

## Test a transport or protocol change

1. Start with a focused unit test in the matching `unit_tests/*.spec.js` file.
2. Use `mock_cbusServer` to inject/observe Grid Connect frames for router tests.
3. Run `npm test`, then `npm run lint`; run `npm run test:coverage` before
   submitting the change when practical.
4. Update these architecture documents when a component responsibility, event
   contract, connection mode, or runtime flow changes.
