# CBUS domain and protocol concepts

## Essential terms

| Term | Meaning in MMC-SERVER |
| --- | --- |
| CBUS | The CAN-based protocol/network that MMC administers. The server uses `cbuslibrary` to encode and decode its messages. |
| Node | A CBUS module identified by a node number. `mergAdminNode` keeps an in-memory `nodeConfig.nodes` record and persists it through `configuration`. |
| Event | An accessory action/state keyed by node and event number. The server tracks long and short events separately for bus-display purposes. |
| Opcode | The CBUS command byte. `mergAdminNode.actions` maps standard-message opcode strings to handlers; unrecognised ones use `DEFAULT`. |
| Node variable (NV) | A value addressed by node number and variable index. Socket handlers request or set them through `mergAdminNode` methods. |
| Event variable (EV) | A value associated with a taught event. The code supports access by event identifier and, for legacy paths, by event index. |
| Module descriptor (MDF) | JSON metadata describing a module. System descriptors live under `VLCB-server/config/modules`; imported/user descriptors are managed by `configuration`. |
| Grid Connect | The textual framing used by the transport. Frames start with `:` and terminate with `;`; `serialGC` validates the basic shape before serial transmission. |
| Modified Grid Connect | The project's Grid Connect TCP/serial interchange format. `messageRouter` and `cbusServer` split a TCP chunk on `;` and handle each complete frame. |

## Identifiers and event types

For a long event, the event identifier is the hexadecimal node number followed
by the hexadecimal event number. For a short event, the stored display
identifier uses node number `0000`, while the internal bus key is prefixed with
`S`; long-event keys are prefixed with `L`. This distinction is implemented in
`mergAdminNode.eventSend`.

`ACON`/`ACOF` are long accessory on/off operations; `ASON`/`ASOF` are short
accessory on/off operations. Incoming variants are handled in the opcode action
table and outgoing variants are encoded by `cbuslibrary` before entering
`CBUS_Queue`.

## Shared event bus

`configuration.eventBus` is the cross-component protocol. The key routes are:

| Event | Producer | Consumer | Purpose |
| --- | --- | --- | --- |
| `GRID_CONNECT_SEND` | Administration/programmer | Message router | Send an encoded frame to the selected TCP endpoint. |
| `GRID_CONNECT_RECEIVE` | Message router | Administration/programmer | Deliver an incoming encoded frame. |
| `CBUS_TRAFFIC` | Message router | Socket server | Publish decoded inbound/outbound traffic to clients. |
| `SERVER_NOTIFICATION`, `NETWORK_CONNECTION_FAILURE`, `SERIAL_CONNECTION_FAILURE` | Transport components | Socket server | Surface connection status to clients. |

Use an existing event when the semantics already match; document and test any
new cross-component event because it is an interface between modules.
