# Runtime flows

These diagrams intentionally use representative messages rather than claiming
that every command follows the same path.

## Process startup

```mermaid
sequenceDiagram
  participant Main as main.js
  participant Config as configuration
  participant Services as server.js
  participant Socket as socketServer
  participant HTTP as Express
  Main->>Main: remove existing logs directory
  Main->>Services: require and run()
  Services->>Config: construct with VLCB-server and logs paths
  Config->>Config: create storage, settings, default layout and event bus
  Services->>Services: construct CBUS, router, admin node and programmer
  Services->>Socket: register handlers and listen on 5552
  Main->>HTTP: create app and listen on configured HTTP port
  Note over Socket: A client later sends START_CONNECTION\nto select the CBUS endpoint.
```

## Client command: accessory long on

`ACCESSORY_LONG_ON` is a concrete example. The analogous command uses
`sendACOF` for an off event.

```mermaid
sequenceDiagram
  participant Client as Socket.IO client
  participant Socket as socketServer
  participant Admin as mergAdminNode
  participant Router as messageRouter
  participant Endpoint as CBUS TCP endpoint
  Client->>Socket: ACCESSORY_LONG_ON(nodeNumber, eventNumber)
  Socket->>Admin: sendACON(nodeNumber, eventNumber)
  Admin->>Admin: encode ACON and append to CBUS_Queue
  Admin->>Admin: 10 ms sender dequeues after required gap
  Admin->>Router: eventBus GRID_CONNECT_SEND
  Router->>Router: decode and log outbound traffic
  Router->>Endpoint: Modified Grid Connect frame over TCP
  opt built-in endpoint
    Endpoint->>Endpoint: cbusServer writes validated frame to serialGC
  end
```

## Inbound CBUS event or message

For a locally bridged bus, serial input enters `cbusServer`; in Network mode a
remote endpoint sends the frame directly to `messageRouter`.

```mermaid
sequenceDiagram
  participant Bus as CBUS module
  participant Bridge as serialGC and cbusServer
  participant Router as messageRouter
  participant Admin as mergAdminNode
  participant Socket as socketServer
  participant Client as Socket.IO client
  Bus->>Bridge: Modified Grid Connect frame
  Bridge->>Router: broadcast frame over local TCP
  Router->>Router: decode, write traffic log
  Router->>Admin: eventBus GRID_CONNECT_RECEIVE
  Admin->>Admin: decode and validate frame
  Admin->>Admin: pre-process, opcode action, post-process
  opt accessory event opcode
    Admin->>Admin: update event state and mark events changed
    Admin->>Socket: events event (up to 200 ms update cycle)
    Socket->>Client: BUS_EVENTS
  end
  Router->>Socket: eventBus CBUS_TRAFFIC
  Socket->>Client: CBUS_TRAFFIC
```

Opcode dispatch is in the `actions` table in `mergAdminNode.js`. Pre- and
post-processing also create/update node records and may queue follow-up
parameter or event requests.

## Serial connection and reconnect

```mermaid
sequenceDiagram
  participant Client as Socket.IO client
  participant Socket as socketServer
  participant Bridge as cbusServer
  participant Serial as serialGC
  Client->>Socket: START_CONNECTION(SerialPort or Auto)
  Socket->>Bridge: connect(5550, serial path or empty)
  Bridge->>Bridge: listen on local TCP port 5550
  Bridge->>Serial: connect(target)
  alt target available
    Serial-->>Bridge: open
    Bridge->>Bridge: serialConnected = true
    Bridge->>Socket: SERVER_NOTIFICATION via event bus
  else target unavailable or later closes
    Serial-->>Bridge: error or close
    Bridge->>Socket: SERIAL_CONNECTION_FAILURE via event bus
    loop every 5 seconds while reconnect enabled
      Bridge->>Serial: connect(saved target)
    end
  end
```

`messageRouter` has a separate 5-second reconnect loop for its TCP endpoint
after a router error. The two mechanisms are independent: the bridge reconnects
to serial hardware, while the router reconnects to the selected TCP service.
