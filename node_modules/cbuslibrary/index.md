
# cbusLibrary
### Library for decoding and encoding CBUS Layout Control Bus (LCB) messages, including extended messages used for firmware download
There is a very comprehensive set of tests for this - see <strong>tests</strong> section further below. <br>
The decoding and encoding of standard (11 bit) CAN ID messages follows the CBUS specification available here 
<a href="https://www.merg.org.uk/merg_wiki/doku.php?id=public:cbuspublic:developerguide">CBUS dev guide</a><br>
At the time of writing, there isn't a formal definition of extended (29 bit) CAN ID message formats, so the methods are based on current implementations

<h3>Full API details available <a href="cbusLibrary.html">here</a></h3>

## Installation
    npm install cbuslibrary
   (note all lower case - npm no longer allows uppercase)
## Usage
    const cbusLib = require('cbusLibrary')
An instance of the class is created automatically, so can be used immediately

## General information

### decoding
for decoding, there's one common function (as the opcode is embedded in the message)
    var cbusMsg = cbusLib.decode(<message to be decoded>)
    
The decode function returns a collection of values, with "encoded", "ID_TYPE" and "text" being standard for all messages
See an expanded description of 'eventName' further below

example CBUS (11 bit Id) message decode:

    {
      "encoded": ":SB780ND200010000FF00;",
      "ID_TYPE":"S",
      "mnemonic": "EVLRN",
      "opCode": "D2",
      "nodeNumber": 1,
      "eventNumber": 0,
      "eventName": "00010000",
      "eventVariableIndex": 255,
      "eventVariableValue": 0,
      "text": "EVLRN (D2) nodeNumber 1 eventNumber 0 eventName 00010000 Event Variable Index 255 Event Variable Value 0"
    }

Note that some properties have full names to avoid confusion (e.g. eventVariableIndex, rather than EV#)

example extended (29 bit Id) message decode:

    {
        "encoded":":X00080004N000000000D040000;",
        "ID_TYPE":"X",
        "operation":"PUT",
        "type":"CONTROL",
        "address":"000000",
        "RESVD":0,
        "CTLBT":13,
        "SPCMD":4,
        "CPDTL":0,
        "CPDTH":0
        "text": {"encoded":":X00080004N000000000D040000;","ID_TYPE":"X","operation":"PUT","type":"CONTROL","address":"000000","RESVD":0,"CTLBT":13,"SPCMD":4,"CPDTL":0,"CPDTH":0}
    }

    

### encoding
For encoding standard CBUS messages, there's one function encode() thats takes a JSON object, which needs the 'mnemonic' for the specific opcode, and any parameters the opcode requires<br>
The format of the JSON object follows exactly the same syntax as the result from the decode() function above<br>
Each opcode also it's own function, that has individual parameters, as the type & number of parameters vary with opCode
<ul style="list-style-type:none;"><li>var encode = cbusLib.encodeEVLRN(nodeNumber, eventNumber, VariableIndex, eventVariableValue);</li></ul>

There are only separate functions for encoding extended CBUS messages currently

### eventIdentifier
An event is identified by 4 bytes made up from either the node number plus the event number in the case of a 'long' event,
or in a 'short' event just the 2 byte device number (with the top bytes set to zero)<br>
The 'eventIdentifier' is used to provide the correct value depending on the type of event ('long' or 'short'), in an 8 digit hexadecimal string with leading zero's<br>
i.e.<br>
'long' event  = node number + event number<br>
'short' event =    0000     + device number<br>
<br>
The command 'ENRSP' also expects this four byte 'eventIdentifier' as a parameter as well as the node number<br>


### CAN header (11 bit CAN identifier)

There are default values for the 11 bit CAN header used when encoding messages, but these can be changed using the following function

<ul style="list-style-type:none;"><li>setCanHeader(MjPri, CAN_ID)</li></ul>
  
Once set, the new values will continue to be used for subsequent encodes (or until the program is restarted)<br>
    
Note that MinPri is specifically defined for each opCode, so is set for each individual opCode and not expected to be changed

### CAN header (29 bit CAN identifier)

The absence of a definition for the 29 bit identifier means that the identifier is hard coded to match existing 
<ul style="list-style-type:none;">
<li>0000N000&ltA&gt for FCU originated messages</li>
<li>8000N000&ltA&gt for module originated messages</li>
</ul>
where: &ltA&gt is a bit mapped character, bit 0 being control/data, and bit 1 being put/get

## Tests

There is a comprehensive suite of unit tests for all the message decode/encodes, which also create a log file

### How to run all tests
<ul style="list-style-type:none;"><li>npm test</li></ul>
Will run al the tests - note there are more than 27,000 tests, and although doesn't take too long, it does create a huge log file

### How to run specific test
You can also run a specific test, which produces a much more workable log file
<ul style="list-style-type:none;"><li>npm test -- --grep "EVLRN"</li></ul>

### Tests log file
For all tests, the log file is created in /tests/logs, and is overwritten on each test run

## Documentation

The project uses JSDocs to generate most of the documentation

### How to run jsdoc 
<ul style="list-style-type:none;"><li>npm run jsdoc</li></ul>
This creates the documents in the 'out' folder, and are copied manually in the root project directory when finalised



