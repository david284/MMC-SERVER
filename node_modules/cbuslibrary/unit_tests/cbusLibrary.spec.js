const expect = require('chai').expect;
var itParam = require('mocha-param');
var winston = require('./config/winston_test.js');

const cbusLib = require('./../cbusLibrary.js')

function decToHex(num, len) {return parseInt(num & (2 ** (4*len) - 1)).toString(16).toUpperCase().padStart(len, '0');}

function stringToHex(string) {
  // expects UTF-8 string
  var bytes = new TextEncoder().encode(string);
  return Array.from(
    bytes,
    byte => byte.toString(16).padStart(2, "0")
  ).join("");
}

function hexToString(hex) {
    // returns UTF-8 string
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i !== bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new TextDecoder().decode(bytes);
}




describe('cbusMessage tests', function(){


	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '======================================================================'});
		winston.info({message: '------------------------ cbusMessage tests -------------------------'});
		winston.info({message: '======================================================================'});
		winston.info({message: ' '});
        
		done();
	});

	beforeEach(function() {
   		winston.info({message: ' '});   // blank line to separate tests
        // ensure expected CAN header is reset before each test run
        cbusLib.setCanHeader(2, 60)
	});

	after(function() {
   		winston.info({message: ' '});   // blank line to separate tests
	});																										

	function GetTestCase_dec2hex () {
		var testCases = [];
        testCases.push({'number':-128, 'length': '2','expected':'80'});
        testCases.push({'number':-1, 'length': '2','expected':'FF'});
        testCases.push({'number':0, 'length': '2','expected':'00'});
        testCases.push({'number':1, 'length': '2','expected':'01'});
        testCases.push({'number':127, 'length': '2','expected':'7F'});
        //
        testCases.push({'number':-2048, 'length': '3','expected':'800'});
        testCases.push({'number':-128, 'length': '3','expected':'F80'});
        testCases.push({'number':-1, 'length': '3','expected':'FFF'});
        testCases.push({'number':0, 'length': '3','expected':'000'});
        testCases.push({'number':1, 'length': '3','expected':'001'});
        testCases.push({'number':127, 'length': '3','expected':'07F'});
        testCases.push({'number':2047, 'length': '3','expected':'7FF'});
        //
        testCases.push({'number':-32768, 'length': '4','expected':'8000'});
        testCases.push({'number':-128, 'length': '4','expected':'FF80'});
        testCases.push({'number':-1, 'length': '4','expected':'FFFF'});
        testCases.push({'number':0, 'length': '4','expected':'0000'});
        testCases.push({'number':1, 'length': '4','expected':'0001'});
        testCases.push({'number':127, 'length': '4','expected':'007F'});
        testCases.push({'number':32767, 'length': '4','expected':'7FFF'});
		return testCases;
	}

	itParam("decToHex test ${JSON.stringify(value))", GetTestCase_dec2hex(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN dec2hex test ' + JSON.stringify(value)});
        var result = decToHex(value.number, value.length);
		winston.info({message: 'cbusMessage test: Result ' + result});
		expect(result).to.equal(value.expected, 'dec2hex test');
	})
	

	
	function GetTestCase_canHeader () {
		var testCases = [];
		for (MJ = 1; MJ < 4; MJ++) {
			if (MJ == 1) MjPri = 0;
			if (MJ == 2) MjPri = 1;
			if (MJ == 3) MjPri = 3;
            for (ID = 1; ID < 4; ID++) {
                if (ID == 1) CAN_ID = 0;
                if (ID == 2) CAN_ID = 1;
                if (ID == 3) CAN_ID = 127;
                testCases.push({'MjPri':MjPri, 'CAN_ID':CAN_ID});
            }
		}
		return testCases;
	}

    // MinPri is pre-defined for each opcode, and using RQNP has a MinPri of 3, so thats fixed and no need to test
    // the tests for other opCodes test the changing of the MinPri value
	itParam("canHeader test MjPri ${value.MjPri} CAN_ID ${value.CAN_ID}", GetTestCase_canHeader(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN canHeader test ' + JSON.stringify(value)});
		var identifier = parseInt(value.MjPri << 14) + parseInt(3 << 12) + parseInt(value.CAN_ID << 5) 
		expected = ":S" + decToHex(identifier, 4) + "N10" + ";";
        cbusLib.setCanHeader(value.MjPri, value.CAN_ID)
        var encode = cbusLib.encodeRQNP();
        var canHeader = cbusLib.getCanHeader();
		winston.info({message: 'cbusMessage test: canHeader encode ' + encode});
		winston.info({message: 'cbusMessage test: canHeader decode ' + JSON.stringify(canHeader)});
		expect(encode).to.equal(expected, 'encode test');
        expect(canHeader.MjPri).to.equal(value.MjPri, 'MjPri test');
		expect(canHeader.CAN_ID).to.equal(value.CAN_ID, 'CAN_ID test');
	})
	

    // Generic encode test cases
    //
	function GetTestCase_encode () {
		var testCases = [];
		testCases.push({'test':{'mnemonic': 'ACK'}, 'expected': ':SA780N00;'});
		testCases.push({'test':{'mnemonic': 'NAK'}, 'expected': ':SA780N01;'});
		testCases.push({'test':{'mnemonic': 'HLT'}, 'expected': ':S8780N02;'});
		testCases.push({'test':{'mnemonic': 'BON'}, 'expected': ':S9780N03;'});
		testCases.push({'test':{'mnemonic': 'TOF'}, 'expected': ':S9780N04;'});
		testCases.push({'test':{'mnemonic': 'TON'}, 'expected': ':S9780N05;'});
		testCases.push({'test':{'mnemonic': 'ESTOP'}, 'expected': ':S9780N06;'});
		testCases.push({'test':{'mnemonic': 'ARST'}, 'expected': ':S8780N07;'});
		testCases.push({'test':{'mnemonic': 'RTOF'}, 'expected': ':S9780N08;'});
		testCases.push({'test':{'mnemonic': 'RTON'}, 'expected': ':S9780N09;'});
		testCases.push({'test':{'mnemonic': 'RESTP'}, 'expected': ':S8780N0A;'});
		testCases.push({'test':{'mnemonic': 'RSTAT'}, 'expected': ':SA780N0C;'});
		testCases.push({'test':{'mnemonic': 'QNN'}, 'expected': ':SB780N0D;'});
		testCases.push({'test':{'mnemonic': 'RQNP'}, 'expected': ':SB780N10;'});
		testCases.push({'test':{'mnemonic': 'RQMN'}, 'expected': ':SA780N11;'});
		testCases.push({'test':{'mnemonic': 'GSTOP'}, 'expected': ':S9780N12;'});
		testCases.push({'test':{'mnemonic': 'KLOC', 'session': '1'}, 'expected': ':SA780N2101;'});
		testCases.push({'test':{'mnemonic': 'QLOC', 'session': '1'}, 'expected': ':SA780N2201;'});
		testCases.push({'test':{'mnemonic': 'DKEEP', 'session': '1'}, 'expected': ':SA780N2301;'});
		testCases.push({'test':{'mnemonic': 'DBG1', 'status': '1'}, 'expected': ':SA780N3001;'});
		testCases.push({'test':{'mnemonic': 'EXTC', 'Ext_OPC': '1'}, 'expected': ':SB780N3F01;'});
		testCases.push({'test':{'mnemonic': 'RLOC', 'address': '1'}, 'expected': ':SA780N400001;'});
		testCases.push({'test':{'mnemonic': 'QCON', 'conID': '1', 'index': '2'}, 'expected': ':SA780N410102;'});
		testCases.push({'test':{'mnemonic': 'SNN', 'nodeNumber': '1'}, 'expected': ':SB780N420001;'});
		testCases.push({'test':{'mnemonic': 'ALOC', 'session': '1', 'allocationCode': '2'}, 'expected': ':SA780N430102;'});
		testCases.push({'test':{'mnemonic': 'STMOD', 'session': '1', 'modeByte': '2'}, 'expected': ':SA780N440102;'});
		testCases.push({'test':{'mnemonic': 'PCON', 'session': '1', 'consistAddress': '2'}, 'expected': ':SA780N450102;'});
		testCases.push({'test':{'mnemonic': 'KCON', 'session': '1', 'consistAddress': '2'}, 'expected': ':SA780N460102;'});
		testCases.push({'test':{'mnemonic': 'DSPD', 'session': '1', 'speed': '2', 'direction':'Reverse'}, 'expected': ':SA780N470102;'});
		testCases.push({'test':{'mnemonic': 'DFLG', 'session': '1', 'flags': '2'}, 'expected': ':SA780N480102;'});
		testCases.push({'test':{'mnemonic': 'DFNON', 'session': '1', 'functionNumber': '2'}, 'expected': ':SA780N490102;'});
		testCases.push({'test':{'mnemonic': 'DFNOF', 'session': '1', 'functionNumber': '2'}, 'expected': ':SA780N4A0102;'});
		testCases.push({'test':{'mnemonic': 'SSTAT', 'session': '1', 'status': '2'}, 'expected': ':SB780N4C0102;'});
		testCases.push({'test':{'mnemonic': 'NNRSM', 'nodeNumber': '1'}, 'expected': ':SB780N4F0001;'});
		testCases.push({'test':{'mnemonic': 'RQNN', 'nodeNumber': '1'}, 'expected': ':SB780N500001;'});
		testCases.push({'test':{'mnemonic': 'NNREL', 'nodeNumber': '1'}, 'expected': ':SB780N510001;'});
		testCases.push({'test':{'mnemonic': 'NNACK', 'nodeNumber': '1'}, 'expected': ':SB780N520001;'});
		testCases.push({'test':{'mnemonic': 'NNLRN', 'nodeNumber': '1'}, 'expected': ':SB780N530001;'});
		testCases.push({'test':{'mnemonic': 'NNULN', 'nodeNumber': '1'}, 'expected': ':SB780N540001;'});
		testCases.push({'test':{'mnemonic': 'NNCLR', 'nodeNumber': '1'}, 'expected': ':SB780N550001;'});
		testCases.push({'test':{'mnemonic': 'NNEVN', 'nodeNumber': '1'}, 'expected': ':SB780N560001;'});
		testCases.push({'test':{'mnemonic': 'NERD', 'nodeNumber': '1'}, 'expected': ':SB780N570001;'});
		testCases.push({'test':{'mnemonic': 'RQEVN', 'nodeNumber': '1'}, 'expected': ':SB780N580001;'});
		testCases.push({'test':{'mnemonic': 'WRACK', 'nodeNumber': '1'}, 'expected': ':SB780N590001;'});
		testCases.push({'test':{'mnemonic': 'RQDAT', 'nodeNumber': '1'}, 'expected': ':SB780N5A0001;'});
		testCases.push({'test':{'mnemonic': 'RQDDS', 'nodeNumber': '1'}, 'expected': ':SB780N5B0001;'});
		testCases.push({'test':{'mnemonic': 'BOOTM', 'nodeNumber': '1'}, 'expected': ':SB780N5C0001;'});
		testCases.push({'test':{'mnemonic': 'ENUM', 'nodeNumber': '1'}, 'expected': ':SB780N5D0001;'});
		testCases.push({'test':{'mnemonic': 'NNRST', 'nodeNumber': '1'}, 'expected': ':SB780N5E0001;'});
		testCases.push({'test':{'mnemonic': 'EXTC1', 'Ext_OPC': '1', 'byte1':'2'}, 'expected': ':SB780N5F0102;'});
		testCases.push({'test':{'mnemonic': 'DFUN', 'session': '1', 'Fn1': '2', 'Fn2':'3'}, 'expected': ':SA780N60010203;'});
		testCases.push({'test':{'mnemonic': 'GLOC', 'address': '1', 'flags':'2'}, 'expected': ':SA780N61000102;'});
		testCases.push({'test':{'mnemonic': 'ERR', 'data1': '1', 'data2':'2', 'errorNumber': '3'}, 'expected': ':SA780N63010203;'});
		testCases.push({'test':{'mnemonic': 'SQU', 'nodeNumber': '1', 'capacityIndex':'2'}, 'expected': ':S8780N66000102;'});
		testCases.push({'test':{'mnemonic': 'CMDERR', 'nodeNumber': '1', 'errorNumber':'2'}, 'expected': ':SB780N6F000102;'});
		testCases.push({'test':{'mnemonic': 'EVNLF', 'nodeNumber': '1', 'EVSPC':'2'}, 'expected': ':SB780N70000102;'});
		testCases.push({'test':{'mnemonic': 'NVRD', 'nodeNumber': '1', 'nodeVariableIndex':'2'}, 'expected': ':SB780N71000102;'});
		testCases.push({'test':{'mnemonic': 'NENRD', 'nodeNumber': '1', 'eventIndex':'2'}, 'expected': ':SB780N72000102;'});
		testCases.push({'test':{'mnemonic': 'RQNPN', 'nodeNumber': '1', 'parameterIndex':'2'}, 'expected': ':SB780N73000102;'});
		testCases.push({'test':{'mnemonic': 'NUMEV', 'nodeNumber': '1', 'eventCount':'2'}, 'expected': ':SB780N74000102;'});
		testCases.push({'test':{'mnemonic': 'CANID', 'nodeNumber': '1', 'CAN_ID':'2'}, 'expected': ':SB780N75000102;'});
		testCases.push({'test':{'mnemonic': 'MODE', 'nodeNumber': '1', 'ModeNumber':'2'}, 'expected': ':SB780N76000102;'});
		testCases.push({'test':{'mnemonic': 'RQSD', 'nodeNumber': '1', 'ServiceIndex':'2'}, 'expected': ':SB780N78000102;'});
		testCases.push({'test':{'mnemonic': 'EXTC2', 'Ext_OPC': '1', 'byte1':'2', 'byte2':'3'}, 'expected': ':SB780N7F010203;'});
		testCases.push({'test':{'mnemonic': 'RDCC3', 'repetitions': '1', 'byte0':'2', 'byte1':'3', 'byte2':'4'}, 'expected': ':SA780N8001020304;'});
		testCases.push({'test':{'mnemonic': 'WCVO', 'session': '1', 'CV':'2', 'value':'3'}, 'expected': ':SA780N8201000203;'});
		testCases.push({'test':{'mnemonic': 'WCVB', 'session': '1', 'CV':'2', 'value':'3'}, 'expected': ':SA780N8301000203;'});
		testCases.push({'test':{'mnemonic': 'QCVS', 'session': '1', 'CV':'2', 'mode':'3'}, 'expected': ':SA780N8401000203;'});
		testCases.push({'test':{'mnemonic': 'PCVS', 'session': '1', 'CV':'2', 'value':'3'}, 'expected': ':SA780N8501000203;'});
		testCases.push({'test':{'mnemonic': 'RDGN', 'nodeNumber': '1', 'ServiceIndex':'2',  'DiagnosticCode':'3'}, 'expected': ':SB780N8700010203;'});
		testCases.push({'test':{'mnemonic': 'NVSETRD', 'nodeNumber': '1', 'nodeVariableIndex':'2',  'nodeVariableValue':'3'}, 'expected': ':SB780N8E00010203;'});
		testCases.push({'test':{'mnemonic': 'ACON', 'nodeNumber': '1', 'eventNumber':'2'}, 'expected': ':SB780N9000010002;'});
		testCases.push({'test':{'mnemonic': 'ACOF', 'nodeNumber': '1', 'eventNumber':'2'}, 'expected': ':SB780N9100010002;'});
		testCases.push({'test':{'mnemonic': 'AREQ', 'nodeNumber': '1', 'eventNumber':'2'}, 'expected': ':SB780N9200010002;'});
		testCases.push({'test':{'mnemonic': 'ARON', 'nodeNumber': '1', 'eventNumber':'2'}, 'expected': ':SB780N9300010002;'});
		testCases.push({'test':{'mnemonic': 'AROF', 'nodeNumber': '1', 'eventNumber':'2'}, 'expected': ':SB780N9400010002;'});
		testCases.push({'test':{'mnemonic': 'EVULN', 'nodeNumber': '1', 'eventNumber':'2'}, 'expected': ':SB780N9500010002;'});
		testCases.push({'test':{'mnemonic': 'NVSET', 'nodeNumber': '1', 'nodeVariableIndex':'2', 'nodeVariableValue':'3'}, 'expected': ':SB780N9600010203;'});
		testCases.push({'test':{'mnemonic': 'NVANS', 'nodeNumber': '1', 'nodeVariableIndex':'2', 'nodeVariableValue':'3'}, 'expected': ':SB780N9700010203;'});
		testCases.push({'test':{'mnemonic': 'ASON', 'nodeNumber': '1', 'deviceNumber':'2'}, 'expected': ':SB780N9800010002;'});
		testCases.push({'test':{'mnemonic': 'ASOF', 'nodeNumber': '1', 'deviceNumber':'2'}, 'expected': ':SB780N9900010002;'});
		testCases.push({'test':{'mnemonic': 'ASRQ', 'nodeNumber': '1', 'deviceNumber':'2'}, 'expected': ':SB780N9A00010002;'});
		testCases.push({'test':{'mnemonic': 'PARAN', 'nodeNumber': '1', 'parameterIndex':'2', 'parameterValue':'3'}, 'expected': ':SB780N9B00010203;'});
		testCases.push({'test':{'mnemonic': 'REVAL', 'nodeNumber': '1', 'eventIndex':'2', 'eventVariableIndex':'3'}, 'expected': ':SB780N9C00010203;'});
		testCases.push({'test':{'mnemonic': 'ARSON', 'nodeNumber': '1', 'deviceNumber':'2'}, 'expected': ':SB780N9D00010002;'});
		testCases.push({'test':{'mnemonic': 'ARSOF', 'nodeNumber': '1', 'deviceNumber':'2'}, 'expected': ':SB780N9E00010002;'});
		testCases.push({'test':{'mnemonic': 'EXTC3', 'Ext_OPC': '1', 'byte1':'2', 'byte2':'3', 'byte3':'4'}, 'expected': ':SB780N9F01020304;'});
		testCases.push({'test':{'mnemonic': 'RDCC4', 'repetitions': '1', 'byte0':'2', 'byte1':'3', 'byte2':'4', 'byte3':'5'}, 'expected': ':SA780NA00102030405;'});
		testCases.push({'test':{'mnemonic': 'WCVS', 'session': '1', 'CV':'2', 'mode':'3', 'value':'4'}, 'expected': ':SA780NA20100020304;'});
		testCases.push({'test':{'mnemonic': 'HEARTB', 'nodeNumber': '1', 'SequenceCount':'2', 'StatusByte1':'3', 'StatusByte2':'4'}, 'expected': ':SB780NAB0001020304;'});
		testCases.push({'test':{'mnemonic': 'SD', 'nodeNumber': '1', 'ServiceIndex':'2',  'ServiceType':'3', 'ServiceVersion':'4'}, 'expected': ':SB780NAC0001020304;'});
		testCases.push({'test':{'mnemonic': 'GRSP', 'nodeNumber': '1', 'requestOpCode':'02', 'serviceType':'3', 'result':'4'}, 'expected': ':SB780NAF0001020304;'});
		testCases.push({'test':{'mnemonic': 'ACON1', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3'}, 'expected': ':SB780NB00001000203;'});
		testCases.push({'test':{'mnemonic': 'ACOF1', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3'}, 'expected': ':SB780NB10001000203;'});
		testCases.push({'test':{'mnemonic': 'REQEV', 'nodeNumber': '1', 'eventNumber':'2', 'eventVariableIndex':'3'}, 'expected': ':SB780NB20001000203;'});
		testCases.push({'test':{'mnemonic': 'ARON1', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3'}, 'expected': ':SB780NB30001000203;'});
		testCases.push({'test':{'mnemonic': 'AROF1', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3'}, 'expected': ':SB780NB40001000203;'});
		testCases.push({'test':{'mnemonic': 'NEVAL', 'nodeNumber': '1', 'eventIndex':'2', 'eventVariableIndex':'3', 'eventVariableValue':'4'}, 'expected': ':SB780NB50001020304;'});
		testCases.push({'test':{'mnemonic': 'PNN', 'nodeNumber': '1', 'manufacturerId':'2', 'moduleId':'3', 'flags':'4'}, 'expected': ':SB780NB60001020304;'});
		testCases.push({'test':{'mnemonic': 'ASON1', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3'}, 'expected': ':SB780NB80001000203;'});
		testCases.push({'test':{'mnemonic': 'ASOF1', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3'}, 'expected': ':SB780NB90001000203;'});
		testCases.push({'test':{'mnemonic': 'ARSON1', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3'}, 'expected': ':SB780NBD0001000203;'});
		testCases.push({'test':{'mnemonic': 'ARSOF1', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3'}, 'expected': ':SB780NBE0001000203;'});
		testCases.push({'test':{'mnemonic': 'EXTC4', 'Ext_OPC': '1', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte4':'5'}, 'expected': ':SB780NBF0102030405;'});
		testCases.push({'test':{'mnemonic': 'RDCC5', 'repetitions': '1', 'byte0':'2', 'byte1':'3', 'byte2':'4', 'byte3':'5', 'byte4':'6'}, 'expected': ':SA780NC0010203040506;'});
		testCases.push({'test':{'mnemonic': 'WCVOA', 'address': '1', 'CV':'2', 'mode':'3', 'value':'4'}, 'expected': ':SA780NC1000100020304;'});
		testCases.push({'test':{'mnemonic': 'CABDAT', 'address': '1', 'datcode':'2', 'aspect1':'3', 'aspect2':'4', 'speed':'5'}, 'expected': ':SA780NC2000102030405;'});
		testCases.push({'test':{'mnemonic': 'DGN', 'nodeNumber': '1', 'ServiceIndex':'2', 'DiagnosticCode':'3', 'DiagnosticValue':'4'}, 'expected': ':SB780NC7000102030004;'});
		testCases.push({'test':{'mnemonic': 'FCLK', 'minutes': '1', 'hours':'2', 'dayOfWeek':'3', 'dayOfMonth':'4', 'month':'5',  'div':'6', 'temperature':'7'}, 'expected': ':SB780NCF010253060407;'});
		testCases.push({'test':{'mnemonic': 'ACON2', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': ':SB780ND0000100020304;'});
		testCases.push({'test':{'mnemonic': 'ACOF2', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': ':SB780ND1000100020304;'});
		testCases.push({'test':{'mnemonic': 'EVLRN', 'nodeNumber': '1', 'eventNumber':'2', 'eventVariableIndex':'3', 'eventVariableValue':'4'}, 'expected': ':SB780ND2000100020304;'});
		testCases.push({'test':{'mnemonic': 'EVANS', 'nodeNumber': '1', 'eventNumber':'2', 'eventVariableIndex':'3', 'eventVariableValue':'4'}, 'expected': ':SB780ND3000100020304;'});
		testCases.push({'test':{'mnemonic': 'ARON2', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': ':SB780ND4000100020304;'});
		testCases.push({'test':{'mnemonic': 'AROF2', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': ':SB780ND5000100020304;'});
		testCases.push({'test':{'mnemonic': 'ASON2', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': ':SB780ND8000100020304;'});
		testCases.push({'test':{'mnemonic': 'ASOF2', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': ':SB780ND9000100020304;'});
		testCases.push({'test':{'mnemonic': 'ARSON2', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': ':SB780NDD000100020304;'});
		testCases.push({'test':{'mnemonic': 'ARSOF2', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': ':SB780NDE000100020304;'});
		testCases.push({'test':{'mnemonic': 'EXTC5', 'Ext_OPC': '1', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte4':'5', 'byte5':'6'}, 'expected': ':SB780NDF010203040506;'});
		testCases.push({'test':{'mnemonic': 'RDCC6', 'repetitions': '1', 'byte0':'2', 'byte1':'3', 'byte2':'4', 'byte3':'5', 'byte4':'6', 'byte5':'7'}, 'expected': ':SA780NE001020304050607;'});
		testCases.push({'test':{'mnemonic': 'PLOC', 'session': '1', 'address':'2', 'speed':'3', 'direction':'Forward', 'Fn1':'5', 'Fn2':'6', 'Fn3':'7'}, 'expected': ':SA780NE101000283050607;'});
		testCases.push({'test':{'mnemonic': 'NAME', 'name': '1234567'}, 'expected': ':SB780NE231323334353637;'});
		testCases.push({'test':{'mnemonic': 'STAT', 'nodeNumber':'1', 'CS':'2', 'flags':'3', 'major':'4', 'minor':'5', 'build':'6'}, 'expected': ':SA780NE300010203040506;'});
		testCases.push({'test':{'mnemonic': 'ESD', 'nodeNumber':'1', 'ServiceIndex':'2', 'Data1':'3', 'Data2':'4', 'Data3':'5', 'Data4':'6'}, 'expected': ':SA780NE700010203040506;'});
		testCases.push({'test':{'mnemonic': 'PARAMS', 'param1': '1', 'param2':'2', 'param3':'3', 'param4':'4', 'param5':'5', 'param6':'6', 'param7':'7'}, 'expected': ':SB780NEF01020304050607;'});
		testCases.push({'test':{'mnemonic': 'ACON3', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': ':SB780NF000010002030405;'});
		testCases.push({'test':{'mnemonic': 'ACOF3', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': ':SB780NF100010002030405;'});
		testCases.push({'test':{'mnemonic': 'ENRSP', 'nodeNumber': '1', 'eventIdentifier':'00000002', 'eventIndex':'3'}, 'expected': ':SB780NF200010000000203;'});
		testCases.push({'test':{'mnemonic': 'ARON3', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': ':SB780NF300010002030405;'});
		testCases.push({'test':{'mnemonic': 'AROF3', 'nodeNumber': '1', 'eventNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': ':SB780NF400010002030405;'});
		testCases.push({'test':{'mnemonic': 'EVLRNI', 'nodeNumber':'1', 'eventNumber':'2', 'eventNumberIndex':'3', 'eventVariableIndex':'4', 'eventVariableValue':'5'}, 'expected': ':SB780NF500010002030405;'});
		testCases.push({'test':{'mnemonic': 'ACDAT', 'nodeNumber': '1', 'data1':'2', 'data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': ':SA780NF600010203040506;'});
		testCases.push({'test':{'mnemonic': 'ARDAT', 'nodeNumber': '1', 'data1':'2', 'data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': ':SA780NF700010203040506;'});
		testCases.push({'test':{'mnemonic': 'ASON3', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': ':SB780NF800010002030405;'});
		testCases.push({'test':{'mnemonic': 'ASOF3', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': ':SB780NF900010002030405;'});
		testCases.push({'test':{'mnemonic': 'DDES', 'deviceNumber':'1', 'data1':'2', 'data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': ':SA780NFA00010203040506;'});
		testCases.push({'test':{'mnemonic': 'DDRS', 'deviceNumber':'1', 'data1':'2', 'data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': ':SA780NFB00010203040506;'});
		testCases.push({'test':{'mnemonic': 'ARSON3', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': ':SB780NFD00010002030405;'});
		testCases.push({'test':{'mnemonic': 'ARSOF3', 'nodeNumber': '1', 'deviceNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': ':SB780NFE00010002030405;'});
		testCases.push({'test':{'mnemonic': 'EXTC6', 'Ext_OPC': '1', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte4':'5', 'byte5':'6', 'byte6':'7'}, 'expected': ':SB780NFF01020304050607;'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"PUT","type":"CONTROL","address":"000001","CTLBT":"2","SPCMD":"3","CPDTL":"4","CPDTH":"5"}, 'expected': ':X00080000N0100000002030405;'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"PUT","type":"DATA","data":[1,2,3,4,5,6,7,8]}, 'expected': ':X00080001N0102030405060708;'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"RESPONSE","response":'1'}, 'expected': ':X80080000N01;'});
		return testCases;
	}

    //
    //
	itParam("Generic encode test - ${JSON.stringify(value.test)}", GetTestCase_encode(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN Generic encode test '});
        var encode = cbusLib.encode(value.test);
		winston.info({message: 'cbusMessage test: Generic encode ' + JSON.stringify(encode)});
		expect(encode.mnemonic).to.equal(value.test.mnemonic, 'mnemonic');
        expect(encode.encoded).to.equal(value.expected, 'encoded');
        // now run encoded value into the decoder to see if encode/decode json matches
        // checks that decode() will accept JSON
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: decode result ' + JSON.stringify(decode)});
        // check all encode JSON properties exist in decode result (may be extra properties in decode we're not worried about)
        winston.info({message: 'cbusMessage test: --------------------------'});
            Object.entries(value.test).forEach(function([key, item]){
                winston.info({message: 'cbusMessage test: ' + key + ' : ' + item});
                // ensure we compare like with like, so convert both sides to strings
                expect(decode[key].toString()).to.equal(value.test[key].toString());
            });
        winston.info({message: 'cbusMessage test: --------------------------'});
        // now check that if we put the decode back into the encode, we stll get the same encoding
        var encode2 = cbusLib.encode(decode);
        expect(encode2.encoded).to.equal(value.expected, 'encoded#2');
		winston.info({message: 'cbusMessage test: encode2 ' + JSON.stringify(encode2)});
	})


    // Generic encode fail test cases
    //
	function GetTestCase_encodeFail () {
		var testCases = [];
		testCases.push({'test':{'fail':1}, 'expected':'encode: unable to determine message type - no ID_TYPE present'});
		testCases.push({'test':{'mnemonic': 'unknown'}, 'expected':'encode standard: \'unknown\' not supported'});
		testCases.push({'test':{'mnemonic': 'KLOC'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'QLOC'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'DKEEP'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'DBG1'}, 'expected': 'encode: property \'status\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC'}, 'expected': 'encode: property \'Ext_OPC\' missing'});
		testCases.push({'test':{'mnemonic': 'RLOC'}, 'expected': 'encode: property \'address\' missing'});
		testCases.push({'test':{'mnemonic': 'QCON', 'index': '2'}, 'expected': 'encode: property \'conID\' missing'});
		testCases.push({'test':{'mnemonic': 'QCON', 'conID':'1'}, 'expected': 'encode: property \'index\' missing'});
		testCases.push({'test':{'mnemonic': 'SNN'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ALOC', 'allocationCode': '2'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'ALOC', 'session':'1'}, 'expected': 'encode: property \'allocationCode\' missing'});
		testCases.push({'test':{'mnemonic': 'STMOD', 'modeByte': '2'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'STMOD', 'session':'1'}, 'expected': 'encode: property \'modeByte\' missing'});
		testCases.push({'test':{'mnemonic': 'PCON', 'consistAddress': '2'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'PCON', 'session':'1'}, 'expected': 'encode: property \'consistAddress\' missing'});
		testCases.push({'test':{'mnemonic': 'KCON', 'consistAddress': '2'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'KCON', 'session':'1'}, 'expected': 'encode: property \'consistAddress\' missing'});
		testCases.push({'test':{'mnemonic': 'DSPD', 'speed':'1','direction': 'Reverse'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'DSPD', 'session':'1','direction': 'Reverse'}, 'expected': 'encode: property \'speed\' missing'});
		testCases.push({'test':{'mnemonic': 'DSPD', 'session':'1','speed': '2'}, 'expected': 'encode: property \'direction\' missing'});
		testCases.push({'test':{'mnemonic': 'DFLG', 'flags': '2'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'DFLG', 'session':'1'}, 'expected': 'encode: property \'flags\' missing'});
		testCases.push({'test':{'mnemonic': 'DFNON', 'functionNumber': '2'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'DFNON', 'session':'1'}, 'expected': 'encode: property \'functionNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'DFNOF', 'functionNumber': '2'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'DFNOF', 'session':'1'}, 'expected': 'encode: property \'functionNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'SSTAT', 'status': '2'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'SSTAT', 'session':'1'}, 'expected': 'encode: property \'status\' missing'});
		testCases.push({'test':{'mnemonic': 'NNRSM'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'RQNN'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NNREL'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NNACK'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NNLRN'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NNULN'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NNCLR'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NNEVN'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NERD'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'RQEVN'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'WRACK'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'RQDAT'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'RQDDS'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'BOOTM'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ENUM'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NNRST'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC1', 'byte1':'2'}, 'expected': 'encode: property \'Ext_OPC\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC1', 'Ext_OPC':'1'}, 'expected': 'encode: property \'byte1\' missing'});
		testCases.push({'test':{'mnemonic': 'DFUN', 'Fn1':'2', 'Fn2': '3'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'DFUN', 'session':'1', 'Fn2': '3'}, 'expected': 'encode: property \'Fn1\' missing'});
		testCases.push({'test':{'mnemonic': 'DFUN', 'session':'1', 'Fn1': '2'}, 'expected': 'encode: property \'Fn2\' missing'});
		testCases.push({'test':{'mnemonic': 'GLOC', 'flags':'1'}, 'expected': 'encode: property \'address\' missing'});
		testCases.push({'test':{'mnemonic': 'GLOC', 'address':'1'}, 'expected': 'encode: property \'flags\' missing'});
		testCases.push({'test':{'mnemonic': 'ERR', 'data2':'2', 'errorNumber': '3'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ERR', 'data1':'2', 'errorNumber': '3'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ERR', 'data1':'2', 'data2': '3'}, 'expected': 'encode: property \'errorNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'SQU', 'capacityIndex': '2'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'SQU', 'nodeNumber':'1'}, 'expected': 'encode: property \'capacityIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'CMDERR', 'errorNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'CMDERR', 'nodeNumber':'2'}, 'expected': 'encode: property \'errorNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EVNLF', 'EVSPC': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EVNLF', 'nodeNumber':'2'}, 'expected': 'encode: property \'EVSPC\' missing'});
		testCases.push({'test':{'mnemonic': 'NVRD', 'nodeVariableIndex': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NVRD', 'nodeNumber':'2'}, 'expected': 'encode: property \'nodeVariableIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'NENRD', 'eventIndex': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NENRD', 'nodeNumber':'2'}, 'expected': 'encode: property \'eventIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'RQNPN', 'parameterIndex': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'RQNPN', 'nodeNumber':'2'}, 'expected': 'encode: property \'parameterIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'NUMEV', 'eventCount': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NUMEV', 'nodeNumber':'2'}, 'expected': 'encode: property \'eventCount\' missing'});
		testCases.push({'test':{'mnemonic': 'CANID', 'CAN_ID': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'CANID', 'nodeNumber':'2'}, 'expected': 'encode: property \'CAN_ID\' missing'});
		testCases.push({'test':{'mnemonic': 'MODE', 'ModeNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'MODE', 'nodeNumber':'2'}, 'expected': 'encode: property \'ModeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'RQSD', 'ServiceIndex': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'RQSD', 'nodeNumber':'2'}, 'expected': 'encode: property \'ServiceIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC2', 'byte1':'2', 'byte2':'3'}, 'expected': 'encode: property \'Ext_OPC\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC2', 'Ext_OPC':'1', 'byte2':'3'}, 'expected': 'encode: property \'byte1\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC2', 'Ext_OPC':'1', 'byte1':'2'}, 'expected': 'encode: property \'byte2\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC3', 'byte0':'2', 'byte1':'3', 'byte2':'4'}, 'expected': 'encode: property \'repetitions\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC3', 'repetitions':'2', 'byte1':'3', 'byte2':'4'}, 'expected': 'encode: property \'byte0\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC3', 'repetitions':'2', 'byte0':'3', 'byte2':'4'}, 'expected': 'encode: property \'byte1\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC3', 'repetitions':'2', 'byte0':'3', 'byte1':'4'}, 'expected': 'encode: property \'byte2\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVO', 'CV':'1', 'value':'3'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVO', 'session':'1', 'value':'3'}, 'expected': 'encode: property \'CV\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVO', 'session':'1', 'CV':'2'}, 'expected': 'encode: property \'value\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVB', 'CV':'1', 'value':'3'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVB', 'session':'1', 'value':'3'}, 'expected': 'encode: property \'CV\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVB', 'session':'1', 'CV':'2'}, 'expected': 'encode: property \'value\' missing'});
		testCases.push({'test':{'mnemonic': 'QCVS', 'CV':'1', 'mode':'3'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'QCVS', 'session':'1', 'mode':'3'}, 'expected': 'encode: property \'CV\' missing'});
		testCases.push({'test':{'mnemonic': 'QCVS', 'session':'1', 'CV':'2'}, 'expected': 'encode: property \'mode\' missing'});
		testCases.push({'test':{'mnemonic': 'PCVS', 'CV':'1', 'value':'3'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'PCVS', 'session':'1', 'value':'3'}, 'expected': 'encode: property \'CV\' missing'});
		testCases.push({'test':{'mnemonic': 'PCVS', 'session':'1', 'CV':'2'}, 'expected': 'encode: property \'value\' missing'});
		testCases.push({'test':{'mnemonic': 'RDGN', 'ServiceIndex':2, 'DiagnosticCode': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'RDGN', 'nodeNumber':'1', 'DiagnosticCode': '3'}, 'expected': 'encode: property \'ServiceIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'RDGN', 'nodeNumber':'1', 'ServiceIndex': '2'}, 'expected': 'encode: property \'DiagnosticCode\' missing'});
		testCases.push({'test':{'mnemonic': 'NVSETRD', 'nodeVariableIndex':2, 'nodeVariableValue': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NVSETRD', 'nodeNumber':'1', 'nodeVariableValue': '3'}, 'expected': 'encode: property \'nodeVariableIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'NVSETRD', 'nodeNumber':'1', 'nodeVariableIndex': '2'}, 'expected': 'encode: property \'nodeVariableValue\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON', 'eventNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON', 'nodeNumber':'2'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF', 'eventNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF', 'nodeNumber':'2'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'AREQ', 'eventNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'AREQ', 'nodeNumber':'2'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON', 'eventNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON', 'nodeNumber':'2'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF', 'eventNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF', 'nodeNumber':'2'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EVULN', 'eventNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EVULN', 'nodeNumber':'2'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NVSET', 'nodeVariableIndex':'2', 'nodeVariableValue':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NVSET', 'nodeNumber':'2', 'nodeVariableValue':'3'}, 'expected': 'encode: property \'nodeVariableIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'NVSET', 'nodeNumber':'2', 'nodeVariableIndex':'3'}, 'expected': 'encode: property \'nodeVariableValue\' missing'});
		testCases.push({'test':{'mnemonic': 'NVANS', 'nodeVariableIndex':'2', 'nodeVariableValue':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NVANS', 'nodeNumber':'2', 'nodeVariableValue':'3'}, 'expected': 'encode: property \'nodeVariableIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'NVANS', 'nodeNumber':'2', 'nodeVariableIndex':'3'}, 'expected': 'encode: property \'nodeVariableValue\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON', 'deviceNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON', 'nodeNumber':'2'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF', 'deviceNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF', 'nodeNumber':'2'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASRQ', 'deviceNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASRQ', 'nodeNumber':'2'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'PARAN', 'parameterIndex':'2', 'parameterValue':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'PARAN', 'nodeNumber':'2', 'parameterValue':'3'}, 'expected': 'encode: property \'parameterIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'PARAN', 'nodeNumber':'2', 'parameterIndex':'3'}, 'expected': 'encode: property \'parameterValue\' missing'});
		testCases.push({'test':{'mnemonic': 'REVAL', 'eventIndex':'2', 'eventVariableIndex':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'REVAL', 'nodeNumber':'2', 'eventVariableIndex':'3'}, 'expected': 'encode: property \'eventIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'REVAL', 'nodeNumber':'2', 'eventIndex':'3'}, 'expected': 'encode: property \'eventVariableIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON', 'deviceNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON', 'nodeNumber':'2'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF', 'deviceNumber': '3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF', 'nodeNumber':'2'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC3', 'byte1':'2', 'byte2':'3', 'byte3':'4'}, 'expected': 'encode: property \'Ext_OPC\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC3', 'Ext_OPC':'1', 'byte2':'3', 'byte3':'4'}, 'expected': 'encode: property \'byte1\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC3', 'Ext_OPC':'1', 'byte1':'2', 'byte3':'4'}, 'expected': 'encode: property \'byte2\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC3', 'Ext_OPC':'1', 'byte1':'2', 'byte2':'3'}, 'expected': 'encode: property \'byte3\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC4', 'byte0':'2', 'byte1':'3', 'byte2':'4', 'byte3':'5'}, 'expected': 'encode: property \'repetitions\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC4', 'repetitions':'2', 'byte1':'3', 'byte2':'4', 'byte3':'5'}, 'expected': 'encode: property \'byte0\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC4', 'repetitions':'2', 'byte0':'3', 'byte2':'4', 'byte3':'5'}, 'expected': 'encode: property \'byte1\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC4', 'repetitions':'2', 'byte0':'3', 'byte1':'4', 'byte3':'5'}, 'expected': 'encode: property \'byte2\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC4', 'repetitions':'2', 'byte0':'3', 'byte1':'4', 'byte2':'5'}, 'expected': 'encode: property \'byte3\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVS', 'CV':'2', 'mode':'3', 'value':'4'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVS', 'session':'1', 'mode':'3', 'value':'4'}, 'expected': 'encode: property \'CV\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVS', 'session':'1', 'CV':'2', 'value':'4'}, 'expected': 'encode: property \'mode\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVS', 'session':'1', 'CV':'2', 'mode':'3'}, 'expected': 'encode: property \'value\' missing'});
		testCases.push({'test':{'mnemonic': 'HEARTB', 'SequenceCount':'2', 'StatusByte1':'3', 'StatusByte2':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'HEARTB', 'nodeNumber':'1', 'StatusByte1':'3', 'StatusByte2':'4'}, 'expected': 'encode: property \'SequenceCount\' missing'});
		testCases.push({'test':{'mnemonic': 'HEARTB', 'nodeNumber':'1', 'SequenceCount':'2', 'StatusByte2':'4'}, 'expected': 'encode: property \'StatusByte1\' missing'});
		testCases.push({'test':{'mnemonic': 'HEARTB', 'nodeNumber':'1', 'SequenceCount':'2', 'StatusByte1':'3'}, 'expected': 'encode: property \'StatusByte2\' missing'});
		testCases.push({'test':{'mnemonic': 'SD', 'ServiceIndex':2, 'ServiceType': '3', 'ServiceVersion': '4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'SD', 'nodeNumber':'1', 'ServiceType': '3', 'ServiceVersion': '4'}, 'expected': 'encode: property \'ServiceIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'SD', 'nodeNumber':'1', 'ServiceIndex': '2', 'ServiceVersion': '4'}, 'expected': 'encode: property \'ServiceType\' missing'});
		testCases.push({'test':{'mnemonic': 'SD', 'nodeNumber':'1', 'ServiceIndex': '2', 'ServiceType': '3',}, 'expected': 'encode: property \'ServiceVersion\' missing'});
		testCases.push({'test':{'mnemonic': 'GRSP', 'requestOpCode':'2', 'serviceType':'3', 'result':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'GRSP', 'nodeNumber':'1', 'serviceType':'3', 'result':'4'}, 'expected': 'encode: property \'requestOpCode\' missing'});
		testCases.push({'test':{'mnemonic': 'GRSP', 'nodeNumber':'1', 'requestOpCode':'2', 'result':'4'}, 'expected': 'encode: property \'serviceType\' missing'});
		testCases.push({'test':{'mnemonic': 'GRSP', 'nodeNumber':'1', 'requestOpCode':'2', 'serviceType':'3'}, 'expected': 'encode: property \'result\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON1', 'eventNumber': '2', 'data1':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON1', 'nodeNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON1', 'nodeNumber':'2', 'eventNumber':'2'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF1', 'eventNumber': '2', 'data1':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF1', 'nodeNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF1', 'nodeNumber':'2', 'eventNumber':'2'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'REQEV', 'eventNumber': '2', 'eventVariableIndex':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'REQEV', 'nodeNumber':'2', 'eventVariableIndex':'3'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'REQEV', 'nodeNumber':'2', 'eventNumber':'2'}, 'expected': 'encode: property \'eventVariableIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON1', 'eventNumber': '2', 'data1':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON1', 'nodeNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON1', 'nodeNumber':'2', 'eventNumber':'2'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF1', 'eventNumber': '2', 'data1':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF1', 'nodeNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF1', 'nodeNumber':'2', 'eventNumber':'2'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'NEVAL', 'eventIndex':'2', 'eventVariableIndex':'3', 'eventVariableValue':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'NEVAL', 'nodeNumber':'1', 'eventVariableIndex':'3', 'eventVariableValue':'4'}, 'expected': 'encode: property \'eventIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'NEVAL', 'nodeNumber':'1', 'eventIndex':'2', 'eventVariableValue':'4'}, 'expected': 'encode: property \'eventVariableIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'NEVAL', 'nodeNumber':'1', 'eventIndex':'2', 'eventVariableIndex':'3'}, 'expected': 'encode: property \'eventVariableValue\' missing'});
		testCases.push({'test':{'mnemonic': 'PNN', 'manufacturerId':'2', 'moduleId':'3', 'flags':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'PNN', 'nodeNumber':'1', 'moduleId':'3', 'flags':'4'}, 'expected': 'encode: property \'manufacturerId\' missing'});
		testCases.push({'test':{'mnemonic': 'PNN', 'nodeNumber':'1', 'manufacturerId':'2', 'flags':'4'}, 'expected': 'encode: property \'moduleId\' missing'});
		testCases.push({'test':{'mnemonic': 'PNN', 'nodeNumber':'1', 'manufacturerId':'2', 'moduleId':'3'}, 'expected': 'encode: property \'flags\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON1', 'deviceNumber': '2', 'data1':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON1', 'nodeNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON1', 'nodeNumber':'2', 'deviceNumber':'2'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF1', 'deviceNumber': '2', 'data1':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF1', 'nodeNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF1', 'nodeNumber':'2', 'deviceNumber':'2'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON1', 'deviceNumber': '2', 'data1':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON1', 'nodeNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON1', 'nodeNumber':'2', 'deviceNumber':'2'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF1', 'deviceNumber': '2', 'data1':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF1', 'nodeNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF1', 'nodeNumber':'2', 'deviceNumber':'2'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC4', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte4':'5'}, 'expected': 'encode: property \'Ext_OPC\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC4', 'Ext_OPC':'1', 'byte2':'3', 'byte3':'4', 'byte4':'5'}, 'expected': 'encode: property \'byte1\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC4', 'Ext_OPC':'1', 'byte1':'2', 'byte3':'4', 'byte4':'5'}, 'expected': 'encode: property \'byte2\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC4', 'Ext_OPC':'1', 'byte1':'2', 'byte2':'3', 'byte4':'5'}, 'expected': 'encode: property \'byte3\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC4', 'Ext_OPC':'1', 'byte1':'2', 'byte2':'3', 'byte3':'4'}, 'expected': 'encode: property \'byte4\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC5', 'byte0':'2', 'byte1':'3', 'byte2':'4', 'byte3':'5', 'byte4':'6'}, 'expected': 'encode: property \'repetitions\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC5', 'repetitions':'2', 'byte1':'3', 'byte2':'4', 'byte3':'5', 'byte4':'6'}, 'expected': 'encode: property \'byte0\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC5', 'repetitions':'2', 'byte0':'3', 'byte2':'4', 'byte3':'5', 'byte4':'6'}, 'expected': 'encode: property \'byte1\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC5', 'repetitions':'2', 'byte0':'3', 'byte1':'4', 'byte3':'5', 'byte4':'6'}, 'expected': 'encode: property \'byte2\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC5', 'repetitions':'2', 'byte0':'3', 'byte1':'4', 'byte2':'5', 'byte4':'6'}, 'expected': 'encode: property \'byte3\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC5', 'repetitions':'2', 'byte0':'3', 'byte1':'4', 'byte2':'5', 'byte3':'5'}, 'expected': 'encode: property \'byte4\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVOA', 'CV':'2', 'mode':'3', 'value':'4'}, 'expected': 'encode: property \'address\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVOA', 'address':'1', 'mode':'3', 'value':'4'}, 'expected': 'encode: property \'CV\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVOA', 'address':'1', 'CV':'2', 'value':'4'}, 'expected': 'encode: property \'mode\' missing'});
		testCases.push({'test':{'mnemonic': 'WCVOA', 'address':'1', 'CV':'2', 'mode':'3'}, 'expected': 'encode: property \'value\' missing'});
		testCases.push({'test':{'mnemonic': 'CABDAT', 'datcode':'2', 'aspect1':'3', 'aspect2':'4', 'speed':'5'}, 'expected': 'encode: property \'address\' missing'});
		testCases.push({'test':{'mnemonic': 'CABDAT', 'address':'1', 'aspect1':'3', 'aspect2':'4', 'speed':'5'}, 'expected': 'encode: property \'datcode\' missing'});
		testCases.push({'test':{'mnemonic': 'CABDAT', 'address':'1', 'datcode':'2', 'aspect2':'4', 'speed':'5'}, 'expected': 'encode: property \'aspect1\' missing'});
		testCases.push({'test':{'mnemonic': 'CABDAT', 'address':'1', 'datcode':'2', 'aspect1':'3', 'speed':'5'}, 'expected': 'encode: property \'aspect2\' missing'});
		testCases.push({'test':{'mnemonic': 'CABDAT', 'address':'1', 'datcode':'2', 'aspect1':'3', 'aspect2':'4'}, 'expected': 'encode: property \'speed\' missing'});
		testCases.push({'test':{'mnemonic': 'DGN', 'ServiceIndex':'2', 'DiagnosticCode':'3', 'DiagnosticValue':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'DGN', 'nodeNumber':'1', 'DiagnosticCode':'3', 'DiagnosticValue':'4'}, 'expected': 'encode: property \'ServiceIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'DGN', 'nodeNumber':'1', 'ServiceIndex':'2', 'DiagnosticValue':'4'}, 'expected': 'encode: property \'DiagnosticCode\' missing'});
		testCases.push({'test':{'mnemonic': 'DGN', 'nodeNumber':'1', 'ServiceIndex':'2', 'DiagnosticCode':'3'}, 'expected': 'encode: property \'DiagnosticValue\' missing'});
		testCases.push({'test':{'mnemonic': 'FCLK', 'hours':'2', 'dayOfWeek':'3', 'dayOfMonth':'4', 'month':'5', 'div':'5', 'temperature':'6'}, 'expected': 'encode: property \'minutes\' missing'});
		testCases.push({'test':{'mnemonic': 'FCLK', 'minutes':'2', 'dayOfWeek':'3', 'dayOfMonth':'4', 'month':'5', 'div':'5', 'temperature':'6'}, 'expected': 'encode: property \'hours\' missing'});
		testCases.push({'test':{'mnemonic': 'FCLK', 'minutes':'2', 'hours':'3', 'dayOfMonth':'4', 'month':'5', 'div':'5', 'temperature':'6'}, 'expected': 'encode: property \'dayOfWeek\' missing'});
		testCases.push({'test':{'mnemonic': 'FCLK', 'minutes':'2', 'hours':'3', 'dayOfWeek':'4', 'month':'5', 'div':'5', 'temperature':'6'}, 'expected': 'encode: property \'dayOfMonth\' missing'});
		testCases.push({'test':{'mnemonic': 'FCLK', 'minutes':'2', 'hours':'3', 'dayOfWeek':'4', 'dayOfMonth':'5', 'div':'5', 'temperature':'6'}, 'expected': 'encode: property \'month\' missing'});
		testCases.push({'test':{'mnemonic': 'FCLK', 'minutes':'2', 'hours':'3', 'dayOfWeek':'4', 'dayOfMonth':'5', 'month':'5', 'temperature':'6'}, 'expected': 'encode: property \'div\' missing'});
		testCases.push({'test':{'mnemonic': 'FCLK', 'minutes':'2', 'hours':'3', 'dayOfWeek':'4', 'dayOfMonth':'5', 'month':'5', 'div':'6'}, 'expected': 'encode: property \'temperature\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON2', 'eventNumber': '2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON2', 'nodeNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON2', 'nodeNumber':'2', 'eventNumber':'2', 'data2':'4'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON2', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF2', 'eventNumber': '2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF2', 'nodeNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF2', 'nodeNumber':'2', 'eventNumber':'2', 'data2':'4'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF2', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'EVLRN', 'eventNumber': '2', 'eventVariableIndex':'3', 'eventVariableValue':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EVLRN', 'nodeNumber':'2', 'eventVariableIndex':'3', 'eventVariableValue':'4'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EVLRN', 'nodeNumber':'2', 'eventNumber':'2', 'eventVariableValue':'4'}, 'expected': 'encode: property \'eventVariableIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'EVLRN', 'nodeNumber':'2', 'eventNumber':'2', 'eventVariableIndex':'3'}, 'expected': 'encode: property \'eventVariableValue\' missing'});
		testCases.push({'test':{'mnemonic': 'EVANS', 'eventNumber': '2', 'eventVariableIndex':'3', 'eventVariableValue':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EVANS', 'nodeNumber':'2', 'eventVariableIndex':'3', 'eventVariableValue':'4'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EVANS', 'nodeNumber':'2', 'eventNumber':'2', 'eventVariableValue':'4'}, 'expected': 'encode: property \'eventVariableIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'EVANS', 'nodeNumber':'2', 'eventNumber':'2', 'eventVariableIndex':'3'}, 'expected': 'encode: property \'eventVariableValue\' missing'});
        testCases.push({'test':{'mnemonic': 'ARON2', 'eventNumber': '2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON2', 'nodeNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON2', 'nodeNumber':'2', 'eventNumber':'2', 'data2':'4'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON2', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF2', 'eventNumber': '2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF2', 'nodeNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF2', 'nodeNumber':'2', 'eventNumber':'2', 'data2':'4'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF2', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON2', 'deviceNumber': '2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON2', 'nodeNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON2', 'nodeNumber':'2', 'deviceNumber':'2', 'data2':'4'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON2', 'nodeNumber':'2', 'deviceNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF2', 'deviceNumber': '2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF2', 'nodeNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF2', 'nodeNumber':'2', 'deviceNumber':'2', 'data2':'4'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF2', 'nodeNumber':'2', 'deviceNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON2', 'deviceNumber': '2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON2', 'nodeNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON2', 'nodeNumber':'2', 'deviceNumber':'2', 'data2':'4'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON2', 'nodeNumber':'2', 'deviceNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF2', 'deviceNumber': '2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF2', 'nodeNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF2', 'nodeNumber':'2', 'deviceNumber':'2', 'data2':'4'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF2', 'nodeNumber':'2', 'deviceNumber':'2', 'data1':'3'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC5', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte4':'5', 'byte5':'6'}, 'expected': 'encode: property \'Ext_OPC\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC5', 'Ext_OPC':'1', 'byte2':'3', 'byte3':'4', 'byte4':'5', 'byte5':'6'}, 'expected': 'encode: property \'byte1\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC5', 'Ext_OPC':'1', 'byte1':'2', 'byte3':'4', 'byte4':'5', 'byte5':'6'}, 'expected': 'encode: property \'byte2\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC5', 'Ext_OPC':'1', 'byte1':'2', 'byte2':'3', 'byte4':'5', 'byte5':'6'}, 'expected': 'encode: property \'byte3\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC5', 'Ext_OPC':'1', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte5':'6'}, 'expected': 'encode: property \'byte4\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC5', 'Ext_OPC':'1', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte4':'5'}, 'expected': 'encode: property \'byte5\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC6', 'byte0':'2', 'byte1':'3', 'byte2':'4', 'byte3':'5', 'byte4':'6', 'byte5':'7'}, 'expected': 'encode: property \'repetitions\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC6', 'repetitions':'2', 'byte1':'3', 'byte2':'4', 'byte3':'5', 'byte4':'6', 'byte5':'7'}, 'expected': 'encode: property \'byte0\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC6', 'repetitions':'2', 'byte0':'3', 'byte2':'4', 'byte3':'5', 'byte4':'6', 'byte5':'7'}, 'expected': 'encode: property \'byte1\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC6', 'repetitions':'2', 'byte0':'3', 'byte1':'4', 'byte3':'5', 'byte4':'6', 'byte5':'7'}, 'expected': 'encode: property \'byte2\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC6', 'repetitions':'2', 'byte0':'3', 'byte1':'4', 'byte2':'5', 'byte4':'6', 'byte5':'7'}, 'expected': 'encode: property \'byte3\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC6', 'repetitions':'2', 'byte0':'3', 'byte1':'4', 'byte2':'5', 'byte3':'5', 'byte5':'7'}, 'expected': 'encode: property \'byte4\' missing'});
		testCases.push({'test':{'mnemonic': 'RDCC6', 'repetitions':'2', 'byte0':'3', 'byte1':'4', 'byte2':'5', 'byte3':'4', 'byte4':'6'}, 'expected': 'encode: property \'byte5\' missing'});
		testCases.push({'test':{'mnemonic': 'PLOC', 'address':'3', 'speed':'4', 'direction':'5', 'Fn1':'4', 'Fn2':'6', 'Fn3':'3'}, 'expected': 'encode: property \'session\' missing'});
		testCases.push({'test':{'mnemonic': 'PLOC', 'session':'2', 'speed':'4', 'direction':'5', 'Fn1':'4', 'Fn2':'6', 'Fn3':'3'}, 'expected': 'encode: property \'address\' missing'});
		testCases.push({'test':{'mnemonic': 'PLOC', 'session':'2', 'address':'3', 'direction':'5', 'Fn1':'4', 'Fn2':'6', 'Fn3':'3'}, 'expected': 'encode: property \'speed\' missing'});
		testCases.push({'test':{'mnemonic': 'PLOC', 'session':'2', 'address':'3', 'speed':'5', 'Fn1':'4', 'Fn2':'6', 'Fn3':'3'}, 'expected': 'encode: property \'direction\' missing'});
		testCases.push({'test':{'mnemonic': 'PLOC', 'session':'2', 'address':'3', 'speed':'5', 'direction':'4', 'Fn2':'6', 'Fn3':'3'}, 'expected': 'encode: property \'Fn1\' missing'});
		testCases.push({'test':{'mnemonic': 'PLOC', 'session':'2', 'address':'3', 'speed':'5', 'direction':'4', 'Fn1':'6', 'Fn3':'3'}, 'expected': 'encode: property \'Fn2\' missing'});
		testCases.push({'test':{'mnemonic': 'PLOC', 'session':'2', 'address':'3', 'speed':'5', 'direction':'4', 'Fn1':'6', 'Fn2':'3'}, 'expected': 'encode: property \'Fn3\' missing'});
		testCases.push({'test':{'mnemonic': 'NAME'}, 'expected': 'encode: property \'name\' missing'});
		testCases.push({'test':{'mnemonic': 'STAT', 'CS':'2', 'flags':'3', 'major':'5', 'minor':'4', 'build':'6'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'STAT', 'nodeNumber':'1', 'flags':'3', 'major':'4', 'minor':'5', 'build':'6'}, 'expected': 'encode: property \'CS\' missing'});
		testCases.push({'test':{'mnemonic': 'STAT', 'nodeNumber':'1', 'CS':'2', 'major':'4', 'minor':'5', 'build':'6'}, 'expected': 'encode: property \'flags\' missing'});
		testCases.push({'test':{'mnemonic': 'STAT', 'nodeNumber':'1', 'CS':'2', 'flags':'3', 'minor':'5', 'build':'6'}, 'expected': 'encode: property \'major\' missing'});
		testCases.push({'test':{'mnemonic': 'STAT', 'nodeNumber':'1', 'CS':'2', 'flags':'3', 'major':'4', 'build':'6'}, 'expected': 'encode: property \'minor\' missing'});
		testCases.push({'test':{'mnemonic': 'STAT', 'nodeNumber':'1', 'CS':'2', 'flags':'3', 'major':'4', 'minor':'5'}, 'expected': 'encode: property \'build\' missing'});
		testCases.push({'test':{'mnemonic': 'ESD', 'ServiceIndex':'2', 'Data1':'3', 'Data2':'5', 'Data3':'4', 'Data4':'6'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ESD', 'nodeNumber':'1', 'Data1':'3', 'Data2':'4', 'Data3':'5', 'Data4':'6'}, 'expected': 'encode: property \'ServiceIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'ESD', 'nodeNumber':'1', 'ServiceIndex':'2', 'Data2':'4', 'Data3':'5', 'Data4':'6'}, 'expected': 'encode: property \'Data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ESD', 'nodeNumber':'1', 'ServiceIndex':'2', 'Data1':'3', 'Data3':'5', 'Data4':'6'}, 'expected': 'encode: property \'Data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ESD', 'nodeNumber':'1', 'ServiceIndex':'2', 'Data1':'3', 'Data2':'4', 'Data4':'6'}, 'expected': 'encode: property \'Data3\' missing'});
		testCases.push({'test':{'mnemonic': 'ESD', 'nodeNumber':'1', 'ServiceIndex':'2', 'Data1':'3', 'Data2':'4', 'Data3':'5'}, 'expected': 'encode: property \'Data4\' missing'});
		testCases.push({'test':{'mnemonic': 'PARAMS', 'param2':'2', 'param3':'3', 'param4':'4', 'param5':'5', 'param6':'6', 'param7':'7'}, 'expected': 'encode: property \'param1\' missing'});
		testCases.push({'test':{'mnemonic': 'PARAMS', 'param1':'1', 'param3':'3', 'param4':'4', 'param5':'5', 'param6':'6', 'param7':'7'}, 'expected': 'encode: property \'param2\' missing'});
		testCases.push({'test':{'mnemonic': 'PARAMS', 'param1':'1', 'param2':'3', 'param4':'4', 'param5':'5', 'param6':'6', 'param7':'7'}, 'expected': 'encode: property \'param3\' missing'});
		testCases.push({'test':{'mnemonic': 'PARAMS', 'param1':'1', 'param2':'3', 'param3':'4', 'param5':'5', 'param6':'6', 'param7':'7'}, 'expected': 'encode: property \'param4\' missing'});
		testCases.push({'test':{'mnemonic': 'PARAMS', 'param1':'1', 'param2':'3', 'param3':'4', 'param4':'5', 'param6':'6', 'param7':'7'}, 'expected': 'encode: property \'param5\' missing'});
		testCases.push({'test':{'mnemonic': 'PARAMS', 'param1':'1', 'param2':'3', 'param3':'4', 'param4':'5', 'param5':'6', 'param7':'7'}, 'expected': 'encode: property \'param6\' missing'});
		testCases.push({'test':{'mnemonic': 'PARAMS', 'param1':'1', 'param2':'3', 'param3':'4', 'param4':'5', 'param5':'6', 'param6':'7'}, 'expected': 'encode: property \'param7\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON3', 'eventNumber': '2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON3', 'nodeNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON3', 'nodeNumber':'2', 'eventNumber':'2', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON3', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3', 'data3':'5'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ACON3', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF3', 'eventNumber': '2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF3', 'nodeNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF3', 'nodeNumber':'2', 'eventNumber':'2', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF3', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3', 'data3':'5'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ACOF3', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'ENRSP', 'eventIdentifier': '00000002', 'eventIndex':'3'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ENRSP', 'nodeNumber': '1', 'eventIndex':'3'}, 'expected': 'encode: property \'eventIdentifier\' missing'});
		testCases.push({'test':{'mnemonic': 'ENRSP', 'nodeNumber': '1', 'eventIdentifier':'2'}, 'expected': 'encode: property \'eventIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON3', 'eventNumber': '2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON3', 'nodeNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON3', 'nodeNumber':'2', 'eventNumber':'2', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON3', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3', 'data3':'5'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ARON3', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF3', 'eventNumber': '2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF3', 'nodeNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF3', 'nodeNumber':'2', 'eventNumber':'2', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF3', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3', 'data3':'5'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'AROF3', 'nodeNumber':'2', 'eventNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'EVLRNI', 'eventNumber': '2', 'eventNumberIndex':'3', 'eventVariableIndex':'4', 'eventVariableValue':'5'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EVLRNI', 'nodeNumber': '1', 'eventNumberIndex':'3', 'eventVariableIndex':'4', 'eventVariableValue':'5'}, 'expected': 'encode: property \'eventNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'EVLRNI', 'nodeNumber': '1', 'eventNumber': '2', 'eventVariableIndex':'4', 'eventVariableValue':'5'}, 'expected': 'encode: property \'eventNumberIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'EVLRNI', 'nodeNumber': '1', 'eventNumber': '2', 'eventNumberIndex':'3', 'eventVariableValue':'5'}, 'expected': 'encode: property \'eventVariableIndex\' missing'});
		testCases.push({'test':{'mnemonic': 'EVLRNI', 'nodeNumber': '1', 'eventNumber': '2', 'eventNumberIndex':'3', 'eventVariableIndex':'4'}, 'expected': 'encode: property \'eventVariableValue\' missing'});
		testCases.push({'test':{'mnemonic': 'ACDAT', 'data1':'2', 'data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ACDAT', 'nodeNumber':'1','data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ACDAT', 'nodeNumber':'1','data1':'2', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ACDAT', 'nodeNumber':'1','data1':'2', 'data2':'3', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'ACDAT', 'nodeNumber':'1','data1':'2', 'data2':'3', 'data3':'5', 'data5':'6'}, 'expected': 'encode: property \'data4\' missing'});
		testCases.push({'test':{'mnemonic': 'ACDAT', 'nodeNumber':'1','data1':'2', 'data2':'3', 'data3':'5', 'data4':'5'}, 'expected': 'encode: property \'data5\' missing'});
		testCases.push({'test':{'mnemonic': 'ARDAT', 'data1':'2', 'data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARDAT', 'nodeNumber':'1','data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ARDAT', 'nodeNumber':'1','data1':'2', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ARDAT', 'nodeNumber':'1','data1':'2', 'data2':'3', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'ARDAT', 'nodeNumber':'1','data1':'2', 'data2':'3', 'data3':'5', 'data5':'6'}, 'expected': 'encode: property \'data4\' missing'});
		testCases.push({'test':{'mnemonic': 'ARDAT', 'nodeNumber':'1','data1':'2', 'data2':'3', 'data3':'5', 'data4':'5'}, 'expected': 'encode: property \'data5\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON3', 'deviceNumber': '2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON3', 'nodeNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON3', 'nodeNumber':'2', 'deviceNumber':'2', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON3', 'nodeNumber':'2', 'deviceNumber':'2', 'data1':'3', 'data3':'5'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ASON3', 'nodeNumber':'2', 'deviceNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF3', 'deviceNumber': '2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF3', 'nodeNumber':'1', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF3', 'nodeNumber':'1', 'deviceNumber':'2', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF3', 'nodeNumber':'1', 'deviceNumber':'2', 'data1':'3', 'data3':'5'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ASOF3', 'nodeNumber':'1', 'deviceNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'DDES', 'data1':'2', 'data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'DDES', 'deviceNumber':'1', 'data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'DDES', 'deviceNumber':'1', 'data1':'2', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'DDES', 'deviceNumber':'1', 'data1':'2', 'data2':'3', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'DDES', 'deviceNumber':'1', 'data1':'2', 'data2':'3', 'data3':'4', 'data5':'6'}, 'expected': 'encode: property \'data4\' missing'});
		testCases.push({'test':{'mnemonic': 'DDES', 'deviceNumber':'1', 'data1':'2', 'data2':'3', 'data3':'4', 'data4':'5'}, 'expected': 'encode: property \'data5\' missing'});
		testCases.push({'test':{'mnemonic': 'DDRS', 'data1':'2', 'data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'DDRS', 'deviceNumber':'1', 'data2':'3', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'DDRS', 'deviceNumber':'1', 'data1':'2', 'data3':'4', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'DDRS', 'deviceNumber':'1', 'data1':'2', 'data2':'3', 'data4':'5', 'data5':'6'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'DDRS', 'deviceNumber':'1', 'data1':'2', 'data2':'3', 'data3':'4', 'data5':'6'}, 'expected': 'encode: property \'data4\' missing'});
		testCases.push({'test':{'mnemonic': 'DDRS', 'deviceNumber':'1', 'data1':'2', 'data2':'3', 'data3':'4', 'data4':'5'}, 'expected': 'encode: property \'data5\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON3', 'deviceNumber': '2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON3', 'nodeNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON3', 'nodeNumber':'2', 'deviceNumber':'2', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON3', 'nodeNumber':'2', 'deviceNumber':'2', 'data1':'3', 'data3':'5'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSON3', 'nodeNumber':'2', 'deviceNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF3', 'deviceNumber': '2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'nodeNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF3', 'nodeNumber':'2', 'data1':'3', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'deviceNumber\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF3', 'nodeNumber':'2', 'deviceNumber':'2', 'data2':'4', 'data3':'5'}, 'expected': 'encode: property \'data1\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF3', 'nodeNumber':'2', 'deviceNumber':'2', 'data1':'3', 'data3':'5'}, 'expected': 'encode: property \'data2\' missing'});
		testCases.push({'test':{'mnemonic': 'ARSOF3', 'nodeNumber':'2', 'deviceNumber':'2', 'data1':'3', 'data2':'4'}, 'expected': 'encode: property \'data3\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC6', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte4':'5', 'byte5':'6'}, 'expected': 'encode: property \'Ext_OPC\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC6', 'Ext_OPC':'1', 'byte2':'3', 'byte3':'4', 'byte4':'5', 'byte5':'6', 'byte6':'7'}, 'expected': 'encode: property \'byte1\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC6', 'Ext_OPC':'1', 'byte1':'2', 'byte3':'4', 'byte4':'5', 'byte5':'6', 'byte6':'7'}, 'expected': 'encode: property \'byte2\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC6', 'Ext_OPC':'1', 'byte1':'2', 'byte2':'3', 'byte4':'5', 'byte5':'6', 'byte6':'7'}, 'expected': 'encode: property \'byte3\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC6', 'Ext_OPC':'1', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte5':'6', 'byte6':'7'}, 'expected': 'encode: property \'byte4\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC6', 'Ext_OPC':'1', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte4':'5', 'byte6':'7'}, 'expected': 'encode: property \'byte5\' missing'});
		testCases.push({'test':{'mnemonic': 'EXTC6', 'Ext_OPC':'1', 'byte1':'2', 'byte2':'3', 'byte3':'4', 'byte4':'5', 'byte5':'6'}, 'expected': 'encode: property \'byte6\' missing'});
		testCases.push({'test':{"operation":"PUT","type":"CONTROL","address":"000001","CTLBT":"2","SPCMD":"3","CPDTL":"4","CPDTH":"5"}, 'expected': 'encode: unable to determine message type - no ID_TYPE present'});
		testCases.push({'test':{"ID_TYPE":"X","type":"CONTROL","address":"000001","CTLBT":"2","SPCMD":"3","CPDTL":"4","CPDTH":"5"}, 'expected': 'encode extended: property \'operation\' missing'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"PUT","address":"000001","CTLBT":"2","SPCMD":"3","CPDTL":"4","CPDTH":"5"}, 'expected': 'encode extended: property \'type\' missing'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"PUT","type":"CONTROL","CTLBT":"2","SPCMD":"3","CPDTL":"4","CPDTH":"5"}, 'expected': 'encode extended: property \'address\' missing'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"PUT","type":"CONTROL","address":"000001","SPCMD":"3","CPDTL":"4","CPDTH":"5"}, 'expected': 'encode extended: property \'CTLBT\' missing'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"PUT","type":"CONTROL","address":"000001","CTLBT":"2","CPDTL":"4","CPDTH":"5"}, 'expected': 'encode extended: property \'SPCMD\' missing'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"PUT","type":"CONTROL","address":"000001","CTLBT":"2","SPCMD":"3","CPDTH":"5"}, 'expected': 'encode extended: property \'CPDTL\' missing'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"PUT","type":"CONTROL","address":"000001","CTLBT":"2","SPCMD":"3","CPDTL":"4"}, 'expected': 'encode extended: property \'CPDTH\' missing'});
		testCases.push({'test':{"operation":"PUT","type":"DATA","data":[1,2,3,4,5,6,7,8]}, 'expected': 'encode: unable to determine message type - no ID_TYPE present'});
		testCases.push({'test':{"ID_TYPE":"X","type":"DATA","data":[1,2,3,4,5,6,7,8]}, 'expected': 'encode extended: property \'operation\' missing'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"PUT","data":[1,2,3,4,5,6,7,8]}, 'expected': 'encode extended: property \'type\' missing'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"PUT","type":"DATA"}, 'expected': 'encode extended: property \'data\' missing'});
		testCases.push({'test':{"operation":"RESPONSE","response":'1'}, 'expected': 'encode: unable to determine message type - no ID_TYPE present'});
		testCases.push({'test':{"ID_TYPE":"X","response":'1'}, 'expected': 'encode extended: property \'operation\' missing'});
		testCases.push({'test':{"ID_TYPE":"X","operation":"RESPONSE"}, 'expected': 'encode extended: property \'response\' missing'});
		return testCases;
	}

    //
    //
	itParam("Generic encode fail test - ${JSON.stringify(value.test)}", GetTestCase_encodeFail(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN Generic encode failure test '});
        expect(() => cbusLib.encode(value.test)).to.throw(Error).with.property('message', value.expected);
	})


    // 00 ACK
    //
	it("ACK test", function () {
		winston.info({message: 'cbusMessage test: BEGIN ACK test '});
		expected = ":SA780N00" + ";";
        var encode = cbusLib.encodeACK();
		winston.info({message: 'cbusMessage test: ACK encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ACK decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('ACK', 'mnemonic');
		expect(decode.opCode).to.equal('00', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 01 NAK
    //
	it("NAK test", function () {
		winston.info({message: 'cbusMessage test: BEGIN ACK test '});
		expected = ":SA780N01" + ";";
        var encode = cbusLib.encodeNAK();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NAK encode ' + encode});
		winston.info({message: 'cbusMessage test: NAK decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('NAK', 'mnemonic');
		expect(decode.opCode).to.equal('01', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 02 HLT
    //
	it("HLT test", function () {
		winston.info({message: 'cbusMessage test: BEGIN HLT test '});
		expected = ":S8780N02" + ";";
        var encode = cbusLib.encodeHLT();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: HLT encode ' + encode});
		winston.info({message: 'cbusMessage test: HLT decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('HLT', 'mnemonic');
		expect(decode.opCode).to.equal('02', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 03 BON
    //
	it("BON test", function () {
		winston.info({message: 'cbusMessage test: BEGIN BON test '});
		expected = ":S9780N03" + ";";
        var encode = cbusLib.encodeBON();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: BON encode ' + encode});
		winston.info({message: 'cbusMessage test: BON decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('BON', 'mnemonic');
		expect(decode.opCode).to.equal('03', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 04 TOF
    //
	it("TOF test", function () {
		winston.info({message: 'cbusMessage test: BEGIN TOF test '});
		expected = ":S9780N04" + ";";
        var encode = cbusLib.encodeTOF();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: TOF encode ' + encode});
		winston.info({message: 'cbusMessage test: TOF decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('TOF', 'mnemonic');
		expect(decode.opCode).to.equal('04', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 05 TON
    //
	it("TON test", function () {
		winston.info({message: 'cbusMessage test: BEGIN TON test '});
		expected = ":S9780N05" + ";";
        var encode = cbusLib.encodeTON();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: TON encode ' + encode});
		winston.info({message: 'cbusMessage test: TON decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('TON', 'mnemonic');
		expect(decode.opCode).to.equal('05', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 06 ESTOP
    //
	it("ESTOP test", function () {
		winston.info({message: 'cbusMessage test: BEGIN ESTOP test '});
		expected = ":S9780N06" + ";";
        var encode = cbusLib.encodeESTOP();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ESTOP encode ' + encode});
		winston.info({message: 'cbusMessage test: ESTOP decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('ESTOP', 'mnemonic');
		expect(decode.opCode).to.equal('06', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 07 ARST
    //
	it("ARST test", function () {
		winston.info({message: 'cbusMessage test: BEGIN ARST test '});
		expected = ":S8780N07" + ";";
        var encode = cbusLib.encodeARST();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ARST encode ' + encode});
		winston.info({message: 'cbusMessage test: ARST decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('ARST', 'mnemonic');
		expect(decode.opCode).to.equal('07', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 08 RTOF
    //
	it("RTOF test", function () {
		winston.info({message: 'cbusMessage test: BEGIN RTOF test '});
		expected = ":S9780N08" + ";";
        var encode = cbusLib.encodeRTOF();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: RTOF encode ' + encode});
		winston.info({message: 'cbusMessage test: RTOF decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('RTOF', 'mnemonic');
		expect(decode.opCode).to.equal('08', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 09 RTON
    //
	it("RTON test", function () {
		winston.info({message: 'cbusMessage test: BEGIN RTON test '});
		expected = ":S9780N09" + ";";
        var encode = cbusLib.encodeRTON();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: RTON encode ' + encode});
		winston.info({message: 'cbusMessage test: RTON decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('RTON', 'mnemonic');
		expect(decode.opCode).to.equal('09', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 0A RESTP
    //
	it("RESTP test", function () {
		winston.info({message: 'cbusMessage test: BEGIN RESTP test '});
		expected = ":S8780N0A" + ";";
        var encode = cbusLib.encodeRESTP();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: RESTP encode ' + encode});
		winston.info({message: 'cbusMessage test: RESTP decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('RESTP', 'mnemonic');
		expect(decode.opCode).to.equal('0A', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 0C RSTAT
    //
	it("RSTAT test", function () {
		winston.info({message: 'cbusMessage test: BEGIN RSTAT test '});
		expected = ":SA780N0C" + ";";
        var encode = cbusLib.encodeRSTAT();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: RSTAT encode ' + encode});
		winston.info({message: 'cbusMessage test: RSTAT decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('RSTAT', 'mnemonic');
		expect(decode.opCode).to.equal('0C', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 0D QNN
    //
	it("QNN test", function () {
		winston.info({message: 'cbusMessage test: BEGIN QNN test '});
		expected = ":SB780N0D" + ";";
        var encode = cbusLib.encodeQNN();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: QNN encode ' + encode});
		winston.info({message: 'cbusMessage test: QNN decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('QNN', 'mnemonic');
		expect(decode.opCode).to.equal('0D', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 10 RQNP
    //
	it("RQNP test", function () {
		winston.info({message: 'cbusMessage test: BEGIN RQNP test '});
		expected = ":SB780N10" + ";";
        var encode = cbusLib.encodeRQNP();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: RQNP encode ' + encode});
		winston.info({message: 'cbusMessage test: RQNP decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('RQNP', 'mnemonic');
		expect(decode.opCode).to.equal('10', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 11 RQMN
    //
	it("RQMN test", function () {
		winston.info({message: 'cbusMessage test: BEGIN RQMN test '});
		expected = ":SA780N11" + ";";
        var encode = cbusLib.encodeRQMN();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: RQMN encode ' + encode});
		winston.info({message: 'cbusMessage test: RQMN decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('RQMN', 'mnemonic');
		expect(decode.opCode).to.equal('11', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 12 GSTOP
    //
	it("GSTOP test", function () {
		winston.info({message: 'cbusMessage test: BEGIN GSTOP test '});
		expected = ":S9780N12" + ";";
        var encode = cbusLib.encodeGSTOP();
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: GSTOP encode ' + encode});
		winston.info({message: 'cbusMessage test: GSTOP decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('GSTOP', 'mnemonic');
		expect(decode.opCode).to.equal('12', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 21 KLOC test cases
    //
	function GetTestCase_KLOC () {
		var testCases = [];
		for (S = 1; S < 4; S++) {
			if (S == 1) session = 0;
			if (S == 2) session = 1;
			if (S == 3) session = 255;
			testCases.push({'session':session});
		}
		return testCases;
	}


    // 21 KLOC
    //
	itParam("KLOC: test session ${value.session}", GetTestCase_KLOC(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN KLOC test ' + JSON.stringify(value)});
		expected = ":SA780N21" + decToHex(value.session, 2) + ";";
        var encode = cbusLib.encodeKLOC(value.session);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: KLOC encode ' + encode});
		winston.info({message: 'cbusMessage test: KLOC decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
		expect(decode.mnemonic).to.equal('KLOC', 'mnemonic');
		expect(decode.opCode).to.equal('21', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 22 QLOC test cases
    //
	function GetTestCase_QLOC () {
		var testCases = [];
		for (S = 1; S < 4; S++) {
			if (S == 1) session = 0;
			if (S == 2) session = 1;
			if (S == 3) session = 255;
			testCases.push({'session':session});
		}
		return testCases;
	}


    // 22 QLOC
    //
	itParam("QLOC test: session ${value.session}", GetTestCase_QLOC(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN QLOC test ' + JSON.stringify(value)});
		expected = ":SA780N22" + decToHex(value.session, 2) + ";";
        var encode = cbusLib.encodeQLOC(value.session);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: QLOC encode ' + encode});
		winston.info({message: 'cbusMessage test: QLOC decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
		expect(decode.mnemonic).to.equal('QLOC', 'mnemonic');
		expect(decode.opCode).to.equal('22', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 23 DKEEP test cases
    //
	function GetTestCase_DKEEP () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;

			testCases.push({'session':session});
		}
		return testCases;
	}


    // 23 DKEEP
    //
	itParam("DKEEP test: session ${value.session}", GetTestCase_DKEEP(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN DKEEP test ' + JSON.stringify(value)});
		expected = ":SA780N23" + decToHex(value.session, 2) + ";";
        var encode = cbusLib.encodeDKEEP(value.session);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: DKEEP encode ' + encode});
		winston.info({message: 'cbusMessage test: DKEEP decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
		expect(decode.mnemonic).to.equal('DKEEP', 'mnemonic');
		expect(decode.opCode).to.equal('23', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 30 DBG1 test cases
    //
	function GetTestCase_DBG1 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;

			testCases.push({'status':arg1});
		}
		return testCases;
	}


    // 30 DBG1
    //
	itParam("DBG1 test: status ${value.status}", GetTestCase_DBG1(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN DBG1 test ' + JSON.stringify(value)});
		expected = ":SA780N30" + decToHex(value.status, 2) + ";";
        var encode = cbusLib.encodeDBG1(value.status);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: DBG1 encode ' + encode});
		winston.info({message: 'cbusMessage test: DBG1 decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.status).to.equal(value.status, 'status');
		expect(decode.mnemonic).to.equal('DBG1', 'mnemonic');
		expect(decode.opCode).to.equal('30', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 3F EXTC test cases
    //
	function GetTestCase_EXTC () {
		var testCases = [];
		for (eIndex = 1; eIndex < 4; eIndex++) {
			if (eIndex == 1) Ext_OPC = 0;
			if (eIndex == 2) Ext_OPC = 1;
			if (eIndex == 3) Ext_OPC = 255;

			testCases.push({'Ext_OPC':Ext_OPC});
		}
		return testCases;
	}


    // 3F EXTC
    //
	itParam("EXTC test: Ext_OPC ${value.Ext_OPC}", GetTestCase_EXTC(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN EXTC test ' + JSON.stringify(value)});
		expected = ":SB780N3F" + decToHex(value.Ext_OPC, 2) + ";";
        var encode = cbusLib.encodeEXTC(value.Ext_OPC);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: EXTC encode ' + encode});
		winston.info({message: 'cbusMessage test: EXTC decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.Ext_OPC).to.equal(value.Ext_OPC, 'Ext_OPC');
		expect(decode.mnemonic).to.equal('EXTC', 'mnemonic');
		expect(decode.opCode).to.equal('3F', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 40 RLOC test cases
    //
	function GetTestCase_RLOC () {
		var testCases = [];
		for (aIndex = 1; aIndex < 4; aIndex++) {
			if (aIndex == 1) address = 0;
			if (aIndex == 2) address = 1;
			if (aIndex == 3) address = 65535;

			testCases.push({'address':address});
		}
		return testCases;
	}


    // 40 RLOC
    //
	itParam("RLOC test: address ${value.address}", GetTestCase_RLOC(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN RLOC test ' + JSON.stringify(value)});
		expected = ":SA780N40" + decToHex(value.address, 4) + ";";
        var encode = cbusLib.encodeRLOC(value.address);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: RLOC encode ' + encode});
		winston.info({message: 'cbusMessage test: RLOC decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.address).to.equal(value.address, 'address');
		expect(decode.mnemonic).to.equal('RLOC', 'mnemonic');
		expect(decode.opCode).to.equal('40', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 41 QCON test cases
    //
	function GetTestCase_QCON () {
		var testCases = [];
		for (CID = 1; CID < 4; CID++) {
			if (CID == 1) conID = 0;
			if (CID == 2) conID = 1;
			if (CID == 3) conID = 255;
            for (aIndex = 1; aIndex < 4; aIndex++) {
                if (aIndex == 1) Index = 0;
                if (aIndex == 2) Index = 1;
                if (aIndex == 3) Index = 255;

                testCases.push({'conID':conID, 'index':Index});
            }
        }
		return testCases;
	}


    // 41 QCON
    //
	itParam("QCON test: conID ${value.conID} index ${value.index}", GetTestCase_QCON(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN QCON test ' + JSON.stringify(value)});
		expected = ":SA780N41" + decToHex(value.conID, 2) + decToHex(value.index, 2) + ";";
        var encode = cbusLib.encodeQCON(value.conID, value.index);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: QCON encode ' + encode});
		winston.info({message: 'cbusMessage test: QCON decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.conID).to.equal(value.conID, 'conID');
        expect(decode.index).to.equal(value.index, 'index');
		expect(decode.mnemonic).to.equal('QCON', 'mnemonic');
		expect(decode.opCode).to.equal('41', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 42 SNN
    //
	function GetTestCase_SNN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("SNN test nodeNumber ${value.nodeNumber}", GetTestCase_SNN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN SNN test ' + JSON.stringify(value)});
		expected = ":SB780N42" + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeSNN(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: SNN encode ' + encode});
		winston.info({message: 'cbusMessage test: SNN decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
		expect(decode.mnemonic).to.equal('SNN', 'mnemonic');
		expect(decode.opCode).to.equal('42', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 43 ALOC test cases
    //
	function GetTestCase_ALOC () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;
			for (ACIndex = 1; ACIndex < 4; ACIndex++) {
				if (ACIndex == 1) allocationCode = 0;
				if (ACIndex == 2) allocationCode = 1;
				if (ACIndex == 3) allocationCode = 255;
				testCases.push({'session':session, 'allocationCode':allocationCode});
			}
		}
		return testCases;
	}
    
    
    // 43 ALOC
    //
	itParam("ALOC test: session ${value.session} allocationCode ${value.allocationCode}", GetTestCase_ALOC(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN ALOC test ' + JSON.stringify(value)});
		expected = ":SA780N43" + decToHex(value.session, 2) + decToHex(value.allocationCode, 2) + ";";
        var encode = cbusLib.encodeALOC(value.session, value.allocationCode);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ALOC encode ' + encode});
		winston.info({message: 'cbusMessage test: ALOC decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.allocationCode).to.equal(value.allocationCode, 'allocationCode');
		expect(decode.mnemonic).to.equal('ALOC', 'mnemonic');
		expect(decode.opCode).to.equal('43', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ');
        expect(decode.text).to.include('(' + decode.opCode + ')');
	})


    // 44 STMOD test cases
    //
	function GetTestCase_STMOD () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;
			for (ACIndex = 1; ACIndex < 4; ACIndex++) {
				if (ACIndex == 1) modeByte = 0;
				if (ACIndex == 2) modeByte = 1;
				if (ACIndex == 3) modeByte = 255;
				testCases.push({'session':session, 'modeByte':modeByte});
			}
		}
		return testCases;
	}
    
    
    // 44 STMOD
    //
	itParam("STMOD test: session ${value.session} modeByte ${value.modeByte}", GetTestCase_STMOD(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN STMOD test ' + JSON.stringify(value)});
		expected = ":SA780N44" + decToHex(value.session, 2) + decToHex(value.modeByte, 2) + ";";
        var encode = cbusLib.encodeSTMOD(value.session, value.modeByte);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: STMOD encode ' + encode});
		winston.info({message: 'cbusMessage test: STMOD decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.modeByte).to.equal(value.modeByte, 'modeByte');
		expect(decode.mnemonic).to.equal('STMOD', 'mnemonic');
		expect(decode.opCode).to.equal('44', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ');
        expect(decode.text).to.include('(' + decode.opCode + ')');
	})


    // 45 PCON test cases
    //
	function GetTestCase_PCON () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;
			for (ACIndex = 1; ACIndex < 4; ACIndex++) {
				if (ACIndex == 1) consistAddress = 0;
				if (ACIndex == 2) consistAddress = 1;
				if (ACIndex == 3) consistAddress = 255;
				testCases.push({'session':session, 'consistAddress':consistAddress});
			}
		}
		return testCases;
	}
    
    
    // 45 PCON
    //
	itParam("PCON test: session ${value.session} consistAddress ${value.consistAddress}", GetTestCase_PCON(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN PCON test ' + JSON.stringify(value)});
		expected = ":SA780N45" + decToHex(value.session, 2) + decToHex(value.consistAddress, 2) + ";";
        var encode = cbusLib.encodePCON(value.session, value.consistAddress);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: PCON encode ' + encode});
		winston.info({message: 'cbusMessage test: PCON decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.consistAddress).to.equal(value.consistAddress, 'consistAddress');
		expect(decode.mnemonic).to.equal('PCON', 'mnemonic');
		expect(decode.opCode).to.equal('45', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ');
        expect(decode.text).to.include('(' + decode.opCode + ')');
	})


    // 46 KCON test cases
    //
	function GetTestCase_KCON () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;
			for (ACIndex = 1; ACIndex < 4; ACIndex++) {
				if (ACIndex == 1) consistAddress = 0;
				if (ACIndex == 2) consistAddress = 1;
				if (ACIndex == 3) consistAddress = 255;
				testCases.push({'session':session, 'consistAddress':consistAddress});
			}
		}
		return testCases;
	}
    
    
    // 46 KCON
    //
	itParam("KCON test: session ${value.session} consistAddress ${value.consistAddress}", GetTestCase_KCON(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN KCON test ' + JSON.stringify(value)});
		expected = ":SA780N46" + decToHex(value.session, 2) + decToHex(value.consistAddress, 2) + ";";
        var encode = cbusLib.encodeKCON(value.session, value.consistAddress);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: KCON encode ' + encode});
		winston.info({message: 'cbusMessage test: KCON decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.consistAddress).to.equal(value.consistAddress, 'consistAddress');
		expect(decode.mnemonic).to.equal('KCON', 'mnemonic');
		expect(decode.opCode).to.equal('46', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ');
        expect(decode.text).to.include('(' + decode.opCode + ')');
	})


    // 47 DSPD test cases
    //
	function GetTestCase_DSPD () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;
			for (speedIndex = 1; speedIndex < 4; speedIndex++) {
				if (speedIndex == 1) speed = 0;
				if (speedIndex == 2) speed = 1;
				if (speedIndex == 3) speed = 127;
				for (directionIndex = 1; directionIndex < 3; directionIndex++) {
					if (directionIndex == 1) direction = 'Forward';
					if (directionIndex == 2) direction = 'Reverse';
					testCases.push({'session':session, 'speed':speed, 'direction':direction});
				}
			}
		}
		return testCases;
	}
    
    
    // 47 DSPD
    //
	itParam("DSPD test: session ${value.session} speed ${value.speed} direction ${value.direction}", GetTestCase_DSPD(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN DSPD test ' + JSON.stringify(value)});
        var speedDir = value.speed + parseInt((value.direction == 'Reverse') ? 0 : 128)
		expected = ":SA780N47" + decToHex(value.session, 2) + decToHex(speedDir, 2) + ";";
        var encode = cbusLib.encodeDSPD(value.session, value.speed, value.direction);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: DSPD encode ' + encode});
		winston.info({message: 'cbusMessage test: DSPD decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.speed).to.equal(value.speed, 'speed');
        expect(decode.direction).to.equal(value.direction, 'direction');
		expect(decode.mnemonic).to.equal('DSPD', 'mnemonic');
		expect(decode.opCode).to.equal('47', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ');
        expect(decode.text).to.include('(' + decode.opCode + ')');
	})


    // 48 DFLG test cases
    //
	function GetTestCase_DFLG () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;
			for (ACIndex = 1; ACIndex < 4; ACIndex++) {
				if (ACIndex == 1) flags = 0;
				if (ACIndex == 2) flags = 1;
				if (ACIndex == 3) flags = 255;
				testCases.push({'session':session, 'flags':flags});
			}
		}
		return testCases;
	}
    
    
    // 48 DFLG
    //
	itParam("DFLG test: session ${value.session} flags ${value.flags}", GetTestCase_DFLG(), function (value) {
        var mnemonic = 'DFLG'
		winston.info({message: 'cbusMessage test: BEGIN ' + mnemonic + ' test ' + JSON.stringify(value)});
		expected = ":SA780N48" + decToHex(value.session, 2) + decToHex(value.flags, 2) + ";";
        var encode = cbusLib.encodeDFLG(value.session, value.flags);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + mnemonic + ' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + mnemonic + ' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.flags).to.equal(value.flags, 'flags');
		expect(decode.mnemonic).to.equal(mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal('48', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ');
        expect(decode.text).to.include('(' + decode.opCode + ')');
	})


    // 49 & 4A DFNONF test cases
    //
	function GetTestCase_DFNONF () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;
			for (ACIndex = 1; ACIndex < 4; ACIndex++) {
				if (ACIndex == 1) Function = 0;
				if (ACIndex == 2) Function = 1;
				if (ACIndex == 3) Function = 255;
				testCases.push({'session':session, 'functionNumber':Function});
			}
		}
		return testCases;
	}
    
    
    // 49 DFNON
    //
	itParam("DFNON test: session ${value.session} function ${value.functionNumber}", GetTestCase_DFNONF(), function (value) {
        var mnemonic = 'DFNON'
		winston.info({message: 'cbusMessage test: BEGIN ' + mnemonic + ' test ' + JSON.stringify(value)});
		expected = ":SA780N49" + decToHex(value.session, 2) + decToHex(value.functionNumber, 2) + ";";
        var encode = cbusLib.encodeDFNON(value.session, value.functionNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + mnemonic + ' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + mnemonic + ' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.functionNumber).to.equal(value.functionNumber, 'functionNumber');
		expect(decode.mnemonic).to.equal(mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal('49', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ');
        expect(decode.text).to.include('(' + decode.opCode + ')');
	})


    // 4A DFNOF
    //
	itParam("DFNOF test: session ${value.session} function ${value.functionNumber}", GetTestCase_DFNONF(), function (value) {
        var mnemonic = 'DFNOF'
		winston.info({message: 'cbusMessage test: BEGIN ' + mnemonic + ' test ' + JSON.stringify(value)});
		expected = ":SA780N4A" + decToHex(value.session, 2) + decToHex(value.functionNumber, 2) + ";";
        var encode = cbusLib.encodeDFNOF(value.session, value.functionNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + mnemonic + ' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + mnemonic + ' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.functionNumber).to.equal(value.functionNumber, 'functionNumber');
		expect(decode.mnemonic).to.equal(mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal('4A', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ');
        expect(decode.text).to.include('(' + decode.opCode + ')');
	})


    // 4C SSTAT test cases
    //
	function GetTestCase_SSTAT () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;
			for (ACIndex = 1; ACIndex < 4; ACIndex++) {
				if (ACIndex == 1) Status = 0;
				if (ACIndex == 2) Status = 1;
				if (ACIndex == 3) Status = 255;
				testCases.push({'session':session, 'status':Status});
			}
		}
		return testCases;
	}
    
    
    // 4C SSTAT
    //
	itParam("SSTAT test: session ${value.session} status ${value.status}", GetTestCase_SSTAT(), function (value) {
        var mnemonic = 'SSTAT'
		winston.info({message: 'cbusMessage test: BEGIN ' + mnemonic + ' test ' + JSON.stringify(value)});
		expected = ":SB780N4C" + decToHex(value.session, 2) + decToHex(value.status, 2) + ";";
        var encode = cbusLib.encodeSSTAT(value.session, value.status);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + mnemonic + ' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + mnemonic + ' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.status).to.equal(value.status, 'status');
		expect(decode.mnemonic).to.equal(mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal('4C', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ');
        expect(decode.text).to.include('(' + decode.opCode + ')');
	})


    // 4F NNRSM testcases
    //
	function GetTestCase_NNRSM () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NNRSM test nodeNumber ${value.nodeNumber}", GetTestCase_NNRSM(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NNRSM test ' + JSON.stringify(value)});
		expected = ":SB780N4F" + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeNNRSM(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NNRSM encode ' + encode});
		winston.info({message: 'cbusMessage test: NNRSM decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
		expect(decode.mnemonic).to.equal('NNRSM', 'mnemonic');
		expect(decode.opCode).to.equal('4F', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 50 RQNN testcases
    //
	function GetTestCase_RQNN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("RQNN test nodeNumber ${value.nodeNumber}", GetTestCase_RQNN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN RQNN test ' + JSON.stringify(value)});
		expected = ":SB780N50" + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeRQNN(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: RQNN encode ' + encode});
		winston.info({message: 'cbusMessage test: RQNN decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
		expect(decode.mnemonic).to.equal('RQNN', 'mnemonic');
		expect(decode.opCode).to.equal('50', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 51 NNREL testcases
    //
	function GetTestCase_NNREL () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
			testCases.push({'mnemonic':'NNREL', 'opCode':'51', 'nodeNumber':arg1});
		}
		return testCases;
	}

	itParam("NNREL test nodeNumber ${value.nodeNumber}", GetTestCase_NNREL(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeNNREL(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
	})


    // 52 NNACK
    //
	function GetTestCase_NNACK () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NNACK test nodeNumber ${value.nodeNumber}", GetTestCase_NNACK(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NNACK test ' + JSON.stringify(value)});
		expected = ":SB780N52" + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeNNACK(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NNACK encode ' + encode});
		winston.info({message: 'cbusMessage test: NNACK decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
		expect(decode.mnemonic).to.equal('NNACK', 'mnemonic');
		expect(decode.opCode).to.equal('52', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 53 NNLRN
    //
	function GetTestCase_NNLRN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NNLRN test nodeNumber ${value.nodeNumber}", GetTestCase_NNLRN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NNLRN test ' + JSON.stringify(value)});
		expected = ":SB780N53" + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeNNLRN(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NNLRN encode ' + encode});
		winston.info({message: 'cbusMessage test: NNLRN decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
		expect(decode.mnemonic).to.equal('NNLRN', 'mnemonic');
		expect(decode.opCode).to.equal('53', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 54 NNULN
    //
	function GetTestCase_NNULN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}


	itParam("NNULN test nodeNumber ${value.nodeNumber}", GetTestCase_NNULN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NNULN test ' + JSON.stringify(value)});
		expected = ":SB780N54" + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeNNULN(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NNULN encode ' + encode});
		winston.info({message: 'cbusMessage test: NNULN decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
		expect(decode.mnemonic).to.equal('NNULN', 'mnemonic');
		expect(decode.opCode).to.equal('54', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 55 NNCLR
    //
	function GetTestCase_NNCLR () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}


	itParam("NNCLR test nodeNumber ${value.nodeNumber}", GetTestCase_NNCLR(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NNCLR test ' + JSON.stringify(value)});
		expected = ":SB780N55" + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeNNCLR(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NNCLR encode ' + encode});
		winston.info({message: 'cbusMessage test: NNCLR decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
		expect(decode.mnemonic).to.equal('NNCLR', 'mnemonic');
		expect(decode.opCode).to.equal('55', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 56 NNEVN testcases
    //
	function GetTestCase_NNEVN () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
			testCases.push({'mnemonic':'NNEVN', 'opCode':'56', 'nodeNumber':arg1});
		}
		return testCases;
	}

	itParam("NNEVN test nodeNumber ${value.nodeNumber}", GetTestCase_NNEVN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeNNEVN(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
	})


    // 57 NERD
    //
	function GetTestCase_NERD () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("NERD test nodeNumber ${value.nodeNumber}", GetTestCase_NERD(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NERD test ' + JSON.stringify(value)});
		expected = ":SB780N57" + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeNERD(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NERD encode ' + encode});
		winston.info({message: 'cbusMessage test: NERD decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
		expect(decode.mnemonic).to.equal('NERD', 'mnemonic');
		expect(decode.opCode).to.equal('57', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 58 RQEVN
    //
	function GetTestCase_RQEVN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("RQEVN test nodeNumber ${value.nodeNumber}", GetTestCase_RQEVN(),  function (value) {
		winston.info({message: 'cbusMessage test: BEGIN RQEVN test ' + JSON.stringify(value)});
		expected = ":SB780N58" + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeRQEVN(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: RQEVN encode ' + encode});
		winston.info({message: 'cbusMessage test: RQEVN decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
		expect(decode.mnemonic).to.equal('RQEVN', 'mnemonic');
		expect(decode.opCode).to.equal('58', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 59 WRACK
    //
	function GetTestCase_WRACK () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			testCases.push({'nodeNumber':nodeNumber});
		}
		return testCases;
	}

	itParam("WRACK test nodeNumber ${value.nodeNumber}", GetTestCase_WRACK(),  function (value) {
		winston.info({message: 'cbusMessage test: BEGIN RQEVN test ' + JSON.stringify(value)});
		expected = ":SB780N59" + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeWRACK(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: WRACK encode ' + encode});
		winston.info({message: 'cbusMessage test: WRACK decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
		expect(decode.mnemonic).to.equal('WRACK', 'mnemonic');
		expect(decode.opCode).to.equal('59', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 5A RQDAT testcases
    //
	function GetTestCase_RQDAT () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
			testCases.push({'mnemonic':'RQDAT', 'opCode':'5A', 'nodeNumber':arg1});
		}
		return testCases;
	}

	itParam("RQDAT test nodeNumber ${value.nodeNumber}", GetTestCase_RQDAT(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeRQDAT(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
	})


    // 5B RQDDS testcases
    //
	function GetTestCase_RQDDS () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
			testCases.push({'mnemonic':'RQDDS', 'opCode':'5B', 'nodeNumber':arg1});
		}
		return testCases;
	}

	itParam("RQDDS test nodeNumber ${value.nodeNumber}", GetTestCase_RQDDS(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeRQDDS(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
	})


    // 5C BOOTM testcases
    //
	function GetTestCase_BOOTM () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
			testCases.push({'mnemonic':'BOOTM', 'opCode':'5C', 'nodeNumber':arg1});
		}
		return testCases;
	}

	itParam("BOOTM test nodeNumber ${value.nodeNumber}", GetTestCase_BOOTM(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeBOOTM(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
	})


    // 5D ENUM testcases
    //
	function GetTestCase_ENUM () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
			testCases.push({'mnemonic':'ENUM', 'opCode':'5D', 'nodeNumber':arg1});
		}
		return testCases;
	}

	itParam("ENUM test nodeNumber ${value.nodeNumber}", GetTestCase_ENUM(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeENUM(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
	})


    // 5E NNRST testcases
    //
	function GetTestCase_NNRST () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
			testCases.push({'mnemonic':'NNRST', 'opCode':'5E', 'nodeNumber':arg1});
		}
		return testCases;
	}

	itParam("NNRST test nodeNumber ${value.nodeNumber}", GetTestCase_NNRST(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + ";";
        var encode = cbusLib.encodeNNRST(value.nodeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
	})


    // 5F EXTC1 testcases
    //
	function GetTestCase_EXTC1 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    testCases.push({'mnemonic':'EXTC1', 'opCode':'5F', 'Ext_OPC':arg1, 'byte1':arg2});
                }
		}
		return testCases;
	}

	itParam("EXTC1 test Ext_OPC ${value.Ext_OPC} byte1 ${value.byte1}", GetTestCase_EXTC1(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.Ext_OPC, 2) + decToHex(value.byte1, 2) + ";";
        var encode = cbusLib.encodeEXTC1(value.Ext_OPC, value.byte1);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.Ext_OPC).to.equal(value.Ext_OPC, 'Ext_OPC');
        expect(decode.byte1).to.equal(value.byte1, 'byte1');
	})


    // 60 DFUN testcases
    //
	function GetTestCase_DFUN () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;
			for (Fn1Index = 1; Fn1Index < 4; Fn1Index++) {
				if (Fn1Index == 1) Fn1 = 0;
				if (Fn1Index == 2) Fn1 = 1;
				if (Fn1Index == 3) Fn1 = 255;
				for (Fn2Index = 1; Fn2Index < 4; Fn2Index++) {
					if (Fn2Index == 1) Fn2 = 0;
					if (Fn2Index == 2) Fn2 = 1;
					if (Fn2Index == 3) Fn2 = 255;
					testCases.push({'session':session, 'Fn1':Fn1, 'Fn2':Fn2});
				}
			}
		}
		return testCases;
	}

    // 60 DFUN
    //
	itParam("DFUN test: session ${value.session} Fn1 ${value.Fn1} Fn2 ${value.Fn2}", GetTestCase_DFUN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN DFUN test ' + JSON.stringify(value)});
		expected = ":SA780N60" + decToHex(value.session, 2) + decToHex(value.Fn1, 2) + decToHex(value.Fn2, 2) + ";";
        var encode = cbusLib.encodeDFUN(value.session, value.Fn1, value.Fn2);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: DFUN encode ' + encode});
		winston.info({message: 'cbusMessage test: DFUN decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.Fn1).to.equal(value.Fn1, 'Fn1');
        expect(decode.Fn2).to.equal(value.Fn2, 'Fn2');
		expect(decode.mnemonic).to.equal('DFUN', 'mnemonic');
		expect(decode.opCode).to.equal('60', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})




    // 61 GLOC testcases
    //
	function GetTestCase_GLOC () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    testCases.push({'mnemonic':'GLOC', 'opCode':'61', 
                                'address':arg1, 
                                'flags':arg2});
                }
		}
		return testCases;
	}

	itParam("GLOC test address ${value.address} flags ${value.flags}", GetTestCase_GLOC(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.address, 4) + decToHex(value.flags, 2) + ";";
        var encode = cbusLib.encodeGLOC(value.address, value.flags);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.address).to.equal(value.address, 'address');
        expect(decode.flags).to.equal(value.flags, 'flags');
	})


    // 63 ERR test case
    //
	function GetTestCase_ERR () {
		var testCases = [];
		for (D1 = 1; D1 < 4; D1++) {
			if (D1 == 1) data1 = 0;
			if (D1 == 2) data1 = 1;
			if (D1 == 3) data1 = 255;
            for (D2 = 1; D2 < 4; D2++) {
                if (D2 == 1) data2 = 0;
                if (D2 == 2) data2 = 1;
                if (D2 == 3) data2 = 255;
                for (errorIndex = 1; errorIndex < 4; errorIndex++) {
                    if (errorIndex == 1) errorNumber = 0;
                    if (errorIndex == 2) errorNumber = 1;
                    if (errorIndex == 3) errorNumber = 255;
                    testCases.push({'data1':data1, 'data2':data2, 'errorNumber':errorNumber});
                }
            }
		}
		return testCases;
	}

    // 63 ERR
    //
	itParam("ERR test: data1 ${value.data1} data2 ${value.data2} errorNumber ${value.errorNumber}", GetTestCase_ERR(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN ERR test ' + JSON.stringify(value)});
		expected = ":SA780N63" + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.errorNumber, 2) + ";";
        var encode = cbusLib.encodeERR(value.data1, value.data2, value.errorNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ERR encode ' + encode});
		winston.info({message: 'cbusMessage test: ERR decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.data1).to.equal(value.data1, 'data1');
        expect(decode.data2).to.equal(value.data2, 'data2');
        expect(decode.errorNumber).to.equal(value.errorNumber, 'errorNumber');
		expect(decode.mnemonic).to.equal('ERR', 'mnemonic');
		expect(decode.opCode).to.equal('63', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 66 SQU
    //
	function GetTestCase_SQU () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (a2 = 1; a2 < 4; a2++) {
				if (a2 == 1) arg2 = 0;
				if (a2 == 2) arg2 = 1;
				if (a2 == 3) arg2 = 255;
				testCases.push({'nodeNumber':nodeNumber, 'capacityIndex':arg2});
			}
		}
		return testCases;
	}

	itParam("SQU test nodeNumber ${value.nodeNumber} capacityIndex ${value.capacityIndex}", GetTestCase_SQU(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN SQU test ' + JSON.stringify(value)});
		expected = ":S8780N66" + decToHex(value.nodeNumber, 4) + decToHex(value.capacityIndex, 2) + ";";
        var encode = cbusLib.encodeSQU(value.nodeNumber, value.capacityIndex);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: SQU encode ' + encode});
		winston.info({message: 'cbusMessage test: SQU decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.capacityIndex).to.equal(value.capacityIndex, 'capacityIndex');
		expect(decode.mnemonic).to.equal('SQU', 'mnemonic');
		expect(decode.opCode).to.equal('66', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 6F CMDERR
    //
	function GetTestCase_CMDERR () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (errorIndex = 1; errorIndex < 4; errorIndex++) {
				if (errorIndex == 1) errorNumber = 0;
				if (errorIndex == 2) errorNumber = 1;
				if (errorIndex == 3) errorNumber = 255;
				testCases.push({'nodeNumber':nodeNumber, 'errorNumber':errorNumber});
			}
		}
		return testCases;
	}

	itParam("CMDERR test nodeNumber ${value.nodeNumber} errorNumber ${value.errorNumber}", GetTestCase_CMDERR(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN CMDERR test ' + JSON.stringify(value)});
		expected = ":SB780N6F" + decToHex(value.nodeNumber, 4) + decToHex(value.errorNumber, 2) + ";";
        var encode = cbusLib.encodeCMDERR(value.nodeNumber, value.errorNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: CMDERR encode ' + encode});
		winston.info({message: 'cbusMessage test: CMDERR decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.errorNumber).to.equal(value.errorNumber, 'errorNumber');
		expect(decode.mnemonic).to.equal('CMDERR', 'mnemonic');
		expect(decode.opCode).to.equal('6F', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 70 EVNLF testcases
    //
	function GetTestCase_EVNLF () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    testCases.push({'mnemonic':'EVNLF', 'opCode':'70', 
                                'nodeNumber':arg1, 
                                'EVSPC':arg2});
                }
		}
		return testCases;
	}

	itParam("EVNLF test nodeNumber ${value.nodeNumber} EVSPC ${value.EVSPC}", GetTestCase_EVNLF(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.EVSPC, 2) + ";";
        var encode = cbusLib.encodeEVNLF(value.nodeNumber, value.EVSPC);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.EVSPC).to.equal(value.EVSPC, 'EVSPC');
	})


    // 71 NVRD
    //
	function GetTestCase_NVRD () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (NVindex = 1; NVindex < 4; NVindex++) {
				if (NVindex == 1) nvIndex = 0;
				if (NVindex == 2) nvIndex = 1;
				if (NVindex == 3) nvIndex = 255;
				testCases.push({'nodeNumber':nodeNumber, 'nvIndex':nvIndex});
			}
		}
		return testCases;
	}


	itParam("NVRD test nodeNumber ${value.nodeNumber} nvIndex ${value.nvIndex}", GetTestCase_NVRD(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NVRD test ' + JSON.stringify(value)});
		expected = ":SB780N71" + decToHex(value.nodeNumber, 4) + decToHex(value.nvIndex, 2) + ";";
        var encode = cbusLib.encodeNVRD(value.nodeNumber, value.nvIndex);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NVRD encode ' + encode});
		winston.info({message: 'cbusMessage test: NVRD decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.nodeVariableIndex).to.equal(value.nvIndex, 'nodeVariableIndex');
		expect(decode.mnemonic).to.equal('NVRD', 'mnemonic');
		expect(decode.opCode).to.equal('71', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 72 NENRD
    //
	function GetTestCase_NENRD () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (Eindex = 1; Eindex < 4; Eindex++) {
				if (Eindex == 1) eventIndex = 0;
				if (Eindex == 2) eventIndex = 1;
				if (Eindex == 3) eventIndex = 255;
				testCases.push({'nodeNumber':nodeNumber, 'eventIndex':eventIndex});
			}
		}
		return testCases;
	}

	itParam("NENRD test nodeNumber ${value.nodeNumber} eventIndex ${value.eventIndex}", GetTestCase_NENRD(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NENRD test ' + JSON.stringify(value)});
		expected = ":SB780N72" + decToHex(value.nodeNumber, 4) + decToHex(value.eventIndex, 2) + ";";
        var encode = cbusLib.encodeNENRD(value.nodeNumber, value.eventIndex);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NENRD encode ' + encode});
		winston.info({message: 'cbusMessage test: NENRD decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventIndex).to.equal(value.eventIndex, 'eventIndex');
		expect(decode.mnemonic).to.equal('NENRD', 'mnemonic');
		expect(decode.opCode).to.equal('72', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 73 RQNPN test case
    //
	function GetTestCase_RQNPN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (Pindex = 1; Pindex < 4; Pindex++) {
				if (Pindex == 1) paramIndex = 0;
				if (Pindex == 2) paramIndex = 1;
				if (Pindex == 3) paramIndex = 255;
				testCases.push({'nodeNumber':nodeNumber, 'paramIndex':paramIndex});
			}
		}
		return testCases;
	}


	itParam("RQNPN test nodeNumber ${value.nodeNumber} paramIndex ${value.paramIndex}", GetTestCase_RQNPN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN RQNPN test ' + JSON.stringify(value)});
		expected = ":SB780N73" + decToHex(value.nodeNumber, 4) + decToHex(value.paramIndex, 2) + ";";
        var encode = cbusLib.encodeRQNPN(value.nodeNumber, value.paramIndex);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: RQNPN encode ' + encode});
		winston.info({message: 'cbusMessage test: RQNPN decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.parameterIndex).to.equal(value.paramIndex, 'parameterIndex');
		expect(decode.mnemonic).to.equal('RQNPN', 'mnemonic');
		expect(decode.opCode).to.equal('73', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 74 NUMEV
    //
	function GetTestCase_NUMEV () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (Pindex = 1; Pindex < 4; Pindex++) {
				if (Pindex == 1) eventCount = 0;
				if (Pindex == 2) eventCount = 1;
				if (Pindex == 3) eventCount = 255;
				testCases.push({'nodeNumber':nodeNumber, 'eventCount':eventCount});
			}
		}
		return testCases;
	}


	itParam("NUMEV test nodeNumber ${value.nodeNumber} eventCount ${value.eventCount}", GetTestCase_NUMEV(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NUMEV test ' + JSON.stringify(value)});
		expected = ":SB780N74" + decToHex(value.nodeNumber, 4) + decToHex(value.eventCount, 2) + ";";
        var encode = cbusLib.encodeNUMEV(value.nodeNumber, value.eventCount);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NUMEV encode ' + encode});
		winston.info({message: 'cbusMessage test: NUMEV decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventCount).to.equal(value.eventCount, 'eventCount');
		expect(decode.mnemonic).to.equal('NUMEV', 'mnemonic');
		expect(decode.opCode).to.equal('74', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 75 CANID testcases
    //
	function GetTestCase_CANID () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    testCases.push({'mnemonic':'CANID', 
                                'opCode':'75', 
                                'nodeNumber':arg1, 
                                'CAN_ID':arg2});
                }
		}
		return testCases;
	}

    // 75 CANID
    //
	itParam("CANID test nodeNumber ${value.nodeNumber} CAN_ID ${value.CAN_ID}", GetTestCase_CANID(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.CAN_ID, 2) + ";";
        var encode = cbusLib.encodeCANID(value.nodeNumber, value.CAN_ID);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.CAN_ID).to.equal(value.CAN_ID, 'CAN_ID');
	})


    // 76 MODE testcases
    //
	function GetTestCase_MODE () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    testCases.push({'mnemonic':'MODE', 
                                'opCode':'76', 
                                'nodeNumber':arg1, 
                                'ModeNumber':arg2});
                }
		}
		return testCases;
	}

    // 76 MODE
    //
	itParam("MODE test nodeNumber ${value.nodeNumber} ModeNumber ${value.ModeNumber}", GetTestCase_MODE(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.ModeNumber, 2) + ";";
        var encode = cbusLib.encodeMODE(value.nodeNumber, value.ModeNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.ModeNumber).to.equal(value.ModeNumber, 'ModeNumber');
	})


    // 78 RQSD testcases
    //
	function GetTestCase_RQSD () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    testCases.push({'mnemonic':'RQSD', 
                                'opCode':'78', 
                                'nodeNumber':arg1, 
                                'ServiceIndex':arg2});
                }
		}
		return testCases;
	}

    // 77 RQSD
    //
	itParam("RQSD test nodeNumber ${value.nodeNumber} ServiceIndex ${value.ServiceIndex}", GetTestCase_RQSD(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.ServiceIndex, 2) + ";";
        var encode = cbusLib.encodeRQSD(value.nodeNumber, value.ServiceIndex);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.ServiceIndex).to.equal(value.ServiceIndex, 'ServiceIndex');
	})


    // 7F EXTC2 testcases
    //
	function GetTestCase_EXTC2 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        testCases.push({'mnemonic':'EXTC2', 'opCode':'7F', 'Ext_OPC':arg1, 'byte1':arg2, 'byte2':arg3});
                    }
                }
		}
		return testCases;
	}

    // 7F EXTC2
    //
	itParam("EXTC2 test Ext_OPC ${value.Ext_OPC} byte1 ${value.byte1} byte2 ${value.byte2}", GetTestCase_EXTC2(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.Ext_OPC, 2) + decToHex(value.byte1, 2) + decToHex(value.byte2, 2) + ";";
        var encode = cbusLib.encodeEXTC2(value.Ext_OPC, value.byte1, value.byte2);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.Ext_OPC).to.equal(value.Ext_OPC, 'Ext_OPC');
        expect(decode.byte1).to.equal(value.byte1, 'byte1');
        expect(decode.byte2).to.equal(value.byte2, 'byte2');
	})


    // 80 RDCC3 testcases
    //
	function GetTestCase_RDCC3 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            testCases.push({'mnemonic':'RDCC3', 
                                            'opCode':'80', 
                                            'repetitions':arg1, 
                                            'byte0':arg2, 
                                            'byte1':arg3, 
                                            'byte2':arg4});
                        }
                    }
                }
		}
		return testCases;
	}

    // 80 RDCC3
    //
	itParam("RDCC3 test repetitions ${value.repetitions} byte0 ${value.byte0} byte1 ${value.byte1} byte2 ${value.byte2}", GetTestCase_RDCC3(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.repetitions, 2) + decToHex(value.byte0, 2) + decToHex(value.byte1, 2) + decToHex(value.byte2, 2) + ";";
        var encode = cbusLib.encodeRDCC3(value.repetitions, value.byte0, value.byte1, value.byte2);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.repetitions).to.equal(value.repetitions, 'repetitions');
        expect(decode.byte0).to.equal(value.byte0, 'byte0');
        expect(decode.byte1).to.equal(value.byte1, 'byte1');
        expect(decode.byte2).to.equal(value.byte2, 'byte2');
	})


    // 82 WCVO testcases
    //
	function GetTestCase_WCVO () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        testCases.push({'mnemonic':'WCVO', 
                                        'opCode':'82', 
                                        'session':arg1, 
                                        'CV':arg2, 
                                        'value':arg3});
                    }
                }
		}
		return testCases;
	}

    // 82 WCVO
    //
	itParam("WCVO test session ${value.session} CV ${value.CV} value ${value.value}", GetTestCase_WCVO(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.session, 2) + decToHex(value.CV, 4) + decToHex(value.value, 2) + ";";
        var encode = cbusLib.encodeWCVO(value.session, value.CV, value.value);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.CV).to.equal(value.CV, 'CV');
        expect(decode.value).to.equal(value.value, 'value');
	})


    // 83 WCVB testcases
    //
	function GetTestCase_WCVB () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        testCases.push({'mnemonic':'WCVB', 
                                        'opCode':'83', 
                                        'session':arg1, 
                                        'CV':arg2, 
                                        'value':arg3});
                    }
                }
		}
		return testCases;
	}

    // 83 WCVB
    //
	itParam("WCVB test session ${value.session} CV ${value.CV} value ${value.value}", GetTestCase_WCVB(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.session, 2) + decToHex(value.CV, 4) + decToHex(value.value, 2) + ";";
        var encode = cbusLib.encodeWCVB(value.session, value.CV, value.value);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.CV).to.equal(value.CV, 'CV');
        expect(decode.value).to.equal(value.value, 'value');
	})


    // 84 QCVS testcases
    //
	function GetTestCase_QCVS () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        testCases.push({'mnemonic':'QCVS', 
                                        'opCode':'84', 
                                        'session':arg1, 
                                        'CV':arg2, 
                                        'mode':arg3});
                    }
                }
		}
		return testCases;
	}

    // 84 QCVS
    //
	itParam("QCVS test session ${value.session} CV ${value.CV} value ${value.mode}", GetTestCase_QCVS(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.session, 2) + decToHex(value.CV, 4) + decToHex(value.mode, 2) + ";";
        var encode = cbusLib.encodeQCVS(value.session, value.CV, value.mode);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.CV).to.equal(value.CV, 'CV');
        expect(decode.mode).to.equal(value.mode, 'mode');
	})


    // 85 PCVS testcases
    //
	function GetTestCase_PCVS () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        testCases.push({'mnemonic':'PCVS', 
                                        'opCode':'85', 
                                        'session':arg1, 
                                        'CV':arg2, 
                                        'value':arg3});
                    }
                }
		}
		return testCases;
	}

    // 85 PCVS
    //
	itParam("PCVS test session ${value.session} CV ${value.CV} value ${value.value}", GetTestCase_PCVS(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.session, 2) + decToHex(value.CV, 4) + decToHex(value.value, 2) + ";";
        var encode = cbusLib.encodePCVS(value.session, value.CV, value.value);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.CV).to.equal(value.CV, 'CV');
        expect(decode.value).to.equal(value.value, 'value');
	})


    // 87 RDGN testcases
    //
	function GetTestCase_RDGN () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
						testCases.push({'mnemonic':'RDGN', 
									'opCode':'87', 
									'nodeNumber':arg1, 
									'ServiceIndex':arg2,
									'DiagnosticCode':arg3});
					}
                }
		}
		return testCases;
	}

    // 87 RDGN
    //
	itParam("RDGN test nodeNumber ${value.nodeNumber} ServiceIndex ${value.ServiceIndex} DiagnosticCode ${value.DiagnosticCode}", GetTestCase_RDGN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.ServiceIndex, 2) + decToHex(value.DiagnosticCode, 2) + ";";
        var encode = cbusLib.encodeRDGN(value.nodeNumber, value.ServiceIndex, value.DiagnosticCode);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.ServiceIndex).to.equal(value.ServiceIndex, 'ServiceIndex');
        expect(decode.DiagnosticCode).to.equal(value.DiagnosticCode, 'DiagnosticCode');
	})


    // 8E NVSETRD testcases
    //
	function GetTestCase_NVSETRD () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
						testCases.push({'mnemonic':'NVSETRD', 
									'opCode':'8E', 
									'nodeNumber':arg1, 
									'nodeVariableIndex':arg2,
									'nodeVariableValue':arg3});
					}
                }
		}
		return testCases;
	}

    // 8E NVSETRD
    //
	itParam("NVSETRD test nodeNumber ${value.nodeNumber} nodeVariableIndex ${value.nodeVariableIndex} nodeVariableValue ${value.nodeVariableValue}", GetTestCase_NVSETRD(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.nodeVariableIndex, 2) + decToHex(value.nodeVariableValue, 2) + ";";
        var encode = cbusLib.encodeNVSETRD(value.nodeNumber, value.nodeVariableIndex, value.nodeVariableValue);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.nodeVariableIndex).to.equal(value.nodeVariableIndex, 'nodeVariableIndex');
        expect(decode.nodeVariableValue).to.equal(value.nodeVariableValue, 'nodeVariableValue');
	})


    // 90/91 ACON & ACOF test cases
    //
	function GetTestCase_ACONF () {
		var testCases = []
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (EN = 1; EN < 4; EN++) {
				if (EN == 1) eventNumber = 0;
				if (EN == 2) eventNumber = 1;
				if (EN == 3) eventNumber = 65535;
                testCases.push({'nodeNumber':nodeNumber,
                                'eventNumber':eventNumber})
            }
        }
		return testCases;
    }        

    // 90 ACON
    //
	itParam("ACON test: nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber}", GetTestCase_ACONF(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN ACON test ' + JSON.stringify(value)});
		expected = ":SB780N90" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + ";";
        var encode = cbusLib.encodeACON(value.nodeNumber, value.eventNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ACON encode ' + encode});
		winston.info({message: 'cbusMessage test: ACON decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
        expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
        expect(decode.eventData.hex).to.equal('', 'eventdata.hex');
		expect(decode.mnemonic).to.equal('ACON', 'mnemonic');
		expect(decode.opCode).to.equal('90', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 91 ACOF
    //
	itParam("ACOF test: nodeNumber ${value.nodeNumber} event ${value.eventNumber}", GetTestCase_ACONF(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN ACOF test ' + JSON.stringify(value)});
		expected = ":SB780N91" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + ";";
        var encode = cbusLib.encodeACOF(value.nodeNumber, value.eventNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ACOF encode ' + encode});
		winston.info({message: 'cbusMessage test: ACOF decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
        expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
        expect(decode.eventData.hex).to.equal('', 'eventdata.hex');
		expect(decode.mnemonic).to.equal('ACOF', 'mnemonic');
		expect(decode.opCode).to.equal('91', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 92 AREQ testcases
    //
	function GetTestCase_AREQ () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                testCases.push({'mnemonic':'AREQ', 
                                'opCode':'92', 
                                'nodeNumber':arg1, 
                                'eventNumber':arg2,
                })                                
            }
		}
		return testCases;
	}

    // 92 AREQ
    //
	itParam("AREQ test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber}", GetTestCase_AREQ(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + ";";
        var encode = cbusLib.encodeAREQ(value.nodeNumber, value.eventNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
        expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
	})


    // 93 ARON testcases
    //
	function GetTestCase_ARON () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                testCases.push({'mnemonic':'ARON', 
                                'opCode':'93', 
                                'nodeNumber':arg1, 
                                'eventNumber':arg2,
                })                                
            }
		}
		return testCases;
	}

    // 93 ARON
    //
	itParam("ARON test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber}", GetTestCase_ARON(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + ";";
        var encode = cbusLib.encodeARON(value.nodeNumber, value.eventNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
        expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
	})


    // 94 AROF testcases
    //
	function GetTestCase_AROF () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                testCases.push({'mnemonic':'AROF', 
                                'opCode':'94', 
                                'nodeNumber':arg1, 
                                'eventNumber':arg2,
                })                                
            }
		}
		return testCases;
	}

    // 94 AROF
    //
	itParam("AROF test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber}", GetTestCase_AROF(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + ";";
        var encode = cbusLib.encodeAROF(value.nodeNumber, value.eventNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
        expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
	})


    // 95 EVULN test cases
    //
	function GetTestCase_EVULN () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                testCases.push({'mnemonic':'EVULN', 
                                'opCode':'95', 
                                'nodeNumber':arg1, 
                                'eventNumber':arg2,
                })                                
            }
		}
		return testCases;
	}

	itParam("EVULN test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber}", GetTestCase_EVULN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN EVULN test ' + JSON.stringify(value)});
		expected = ":SB780N95" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + ";";
        var encode = cbusLib.encodeEVULN(value.nodeNumber, value.eventNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: EVULN encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: EVULN decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('EVULN', 'mnemonic');
		expect(decode.opCode).to.equal('95', 'opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
        expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 96 NVSET
    //
	function GetTestCase_NVSET () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (NVindex = 1; NVindex < 4; NVindex++) {
				if (NVindex == 1) nvIndex = 0;
				if (NVindex == 2) nvIndex = 1;
				if (NVindex == 3) nvIndex = 255;
				for (NVvalue = 1; NVvalue < 4; NVvalue++) {
					if (NVvalue == 1) nvValue = 0;
					if (NVvalue == 2) nvValue = 1;
					if (NVvalue == 3) nvValue = 255;
					testCases.push({'nodeNumber':nodeNumber, 'nvIndex':nvIndex, 'nvValue':nvValue});
				}
			}
		}
		return testCases;
	}

	itParam("NVSET test nodeNumber ${value.nodeNumber} nvIndex ${value.nvIndex} nvValue ${value.nvValue}", GetTestCase_NVSET(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NVSET test ' + JSON.stringify(value)});
		expected = ":SB780N96" + decToHex(value.nodeNumber, 4) + decToHex(value.nvIndex, 2) + decToHex(value.nvValue, 2) + ";";
        var encode = cbusLib.encodeNVSET(value.nodeNumber, value.nvIndex, value.nvValue);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NVSET encode ' + encode});
		winston.info({message: 'cbusMessage test: NVSET decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.nodeVariableIndex).to.equal(value.nvIndex, 'nodeVariableIndex');
        expect(decode.nodeVariableValue).to.equal(value.nvValue, 'nodeVariableValue');
		expect(decode.mnemonic).to.equal('NVSET', 'mnemonic');
		expect(decode.opCode).to.equal('96', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 97 NVANS
    //
	function GetTestCase_NVANS () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (NVindex = 1; NVindex < 4; NVindex++) {
				if (NVindex == 1) nvIndex = 0;
				if (NVindex == 2) nvIndex = 1;
				if (NVindex == 3) nvIndex = 255;
				for (NVvalue = 1; NVvalue < 4; NVvalue++) {
					if (NVvalue == 1) nvValue = 0;
					if (NVvalue == 2) nvValue = 1;
					if (NVvalue == 3) nvValue = 255;
					testCases.push({'nodeNumber':nodeNumber, 'nvIndex':nvIndex, 'nvValue':nvValue});
				}
			}
		}
		return testCases;
	}

	itParam("NVANS test nodeNumber ${value.nodeNumber} nvIndex ${value.nvIndex} nvValue ${value.nvValue}", GetTestCase_NVANS(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN NVANS test ' + JSON.stringify(value)});
		expected = ":SB780N97" + decToHex(value.nodeNumber, 4) + decToHex(value.nvIndex, 2) + decToHex(value.nvValue, 2) + ";";
        var encode = cbusLib.encodeNVANS(value.nodeNumber, value.nvIndex, value.nvValue);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: NVANS encode ' + encode});
		winston.info({message: 'cbusMessage test: NVANS decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.nodeVariableIndex).to.equal(value.nvIndex, 'nodeVariableIndex');
        expect(decode.nodeVariableValue).to.equal(value.nvValue, 'nodeVariableValue');
		expect(decode.mnemonic).to.equal('NVANS', 'mnemonic');
		expect(decode.opCode).to.equal('97', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 98/99 ASON & ASOF test cases
    //
	function GetTestCase_ASONF () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (DN = 1; DN < 4; DN++) {
				if (DN == 1) deviceNumber = 0;
				if (DN == 2) deviceNumber = 1;
				if (DN == 3) deviceNumber = 65535;
                testCases.push({'nodeNumber':nodeNumber,
                                'deviceNumber':deviceNumber})
            }
        }
		return testCases;
    }        


    // 98 ASON
    //
	itParam("ASON test nodeNumber ${value.nodeNumber} eventNumber ${value.deviceNumber}", GetTestCase_ASONF(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN ASON test ' + JSON.stringify(value)});
		expected = ":SB780N98" + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + ";";
        var encode = cbusLib.encodeASON(value.nodeNumber, value.deviceNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ASON encode ' + encode});
		winston.info({message: 'cbusMessage test: ASON decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
        expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
        expect(decode.eventData.hex).to.equal('', 'eventdata.hex');
		expect(decode.mnemonic).to.equal('ASON', 'mnemonic');
		expect(decode.opCode).to.equal('98', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 99 ASOF
    //
	itParam("ASOF test nodeNumber ${value.nodeNumber} eventNumber ${value.deviceNumber}", GetTestCase_ASONF(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN ASOF test ' + JSON.stringify(value)});
		expected = ":SB780N99" + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + ";";
        var encode = cbusLib.encodeASOF(value.nodeNumber, value.deviceNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ASOF encode ' + encode});
		winston.info({message: 'cbusMessage test: ASOF decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
        expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
        expect(decode.eventData.hex).to.equal('', 'eventdata.hex');
		expect(decode.mnemonic).to.equal('ASOF', 'mnemonic');
		expect(decode.opCode).to.equal('99', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 9A ASRQ testcases
    //
	function GetTestCase_ASRQ () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                testCases.push({'mnemonic':'ASRQ', 
                                'opCode':'9A', 
                                'nodeNumber':arg1, 
                                'deviceNumber':arg2,
                })                                
            }
		}
		return testCases;
	}

    // 9A ASRQ
    //
	itParam("ASRQ test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber}", GetTestCase_ASRQ(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + ";";
        var encode = cbusLib.encodeASRQ(value.nodeNumber, value.deviceNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.deviceNumber).to.equal(value.deviceNumber, 'eventNumber');
        expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
	})


    // 9B PARAN
    //
	function GetTestCase_PARAN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (PI = 1; PI < 4; PI++) {
				if (PI == 1) parameterIndex = 0;
				if (PI == 2) parameterIndex = 1;
				if (PI == 3) parameterIndex = 255;
				for (PV = 1; PV < 4; PV++) {
					if (PV == 1) parameterValue = 0;
					if (PV == 2) parameterValue = 1;
					if (PV == 3) parameterValue = 255;
					testCases.push({'nodeNumber':nodeNumber, 'parameterIndex':parameterIndex, 'parameterValue':parameterValue});
				}
			}
		}
		return testCases;
	}

	itParam("PARAN test nodeNumber ${value.nodeNumber} parameterIndex ${value.parameterIndex} parameterValue ${value.parameterValue}", GetTestCase_PARAN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN PARAN test ' + JSON.stringify(value)});
		expected = ":SB780N9B" + decToHex(value.nodeNumber, 4) + decToHex(value.parameterIndex, 2) + decToHex(value.parameterValue, 2) + ";";
        var encode = cbusLib.encodePARAN(value.nodeNumber, value.parameterIndex, value.parameterValue);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: PARAN encode ' + encode});
		winston.info({message: 'cbusMessage test: PARAN decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.parameterIndex).to.equal(value.parameterIndex, 'parameterIndex');
        expect(decode.parameterValue).to.equal(value.parameterValue, 'parameterValue');
		expect(decode.mnemonic).to.equal('PARAN', 'mnemonic');
		expect(decode.opCode).to.equal('9B', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 9C REVAL
    //
	function GetTestCase_REVAL () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (ENindex = 1; ENindex < 4; ENindex++) {
				if (ENindex == 1) eventIndex = 0;
				if (ENindex == 2) eventIndex = 1;
				if (ENindex == 3) eventIndex = 255;
				for (EVindex = 1; EVindex < 4; EVindex++) {
					if (EVindex == 1) eventVariableIndex = 0;
					if (EVindex == 2) eventVariableIndex = 1;
					if (EVindex == 3) eventVariableIndex = 255;
					testCases.push({'nodeNumber':nodeNumber, 'eventIndex':eventIndex, 'eventVariableIndex':eventVariableIndex});
				}
			}
		}
		return testCases;
	}

	itParam("REVAL test nodeNumber ${value.nodeNumber} eventIndex ${value.eventIndex} eventVariableIndex ${value.eventVariableIndex}", GetTestCase_REVAL(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN REVAL test ' + JSON.stringify(value)});
		expected = ":SB780N9C" + decToHex(value.nodeNumber, 4) + decToHex(value.eventIndex, 2) + decToHex(value.eventVariableIndex, 2) + ";";
        var encode = cbusLib.encodeREVAL(value.nodeNumber, value.eventIndex, value.eventVariableIndex);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: REVAL encode ' + encode});
		winston.info({message: 'cbusMessage test: REVAL decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventIndex).to.equal(value.eventIndex, 'eventIndex');
        expect(decode.eventVariableIndex).to.equal(value.eventVariableIndex, 'eventVariableIndex');
		expect(decode.mnemonic).to.equal('REVAL', 'mnemonic');
		expect(decode.opCode).to.equal('9C', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // 9D ARSON testcases
    //
	function GetTestCase_ARSON () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                testCases.push({'mnemonic':'ARSON', 
                                'opCode':'9D', 
                                'nodeNumber':arg1, 
                                'deviceNumber':arg2,
                })                                
            }
		}
		return testCases;
	}

    // 9D ARSON
    //
	itParam("ARSON test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber}", GetTestCase_ARSON(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + ";";
        var encode = cbusLib.encodeARSON(value.nodeNumber, value.deviceNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.deviceNumber).to.equal(value.deviceNumber, 'eventNumber');
        expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
	})


    // 9E ARSOF testcases
    //
	function GetTestCase_ARSOF () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                testCases.push({'mnemonic':'ARSOF', 
                                'opCode':'9E', 
                                'nodeNumber':arg1, 
                                'deviceNumber':arg2,
                })                                
            }
		}
		return testCases;
	}

    // 9E ARSOF
    //
	itParam("ARSOF test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber}", GetTestCase_ARSOF(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + ";";
        var encode = cbusLib.encodeARSOF(value.nodeNumber, value.deviceNumber);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.deviceNumber).to.equal(value.deviceNumber, 'eventNumber');
        expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
	})


    // 9F EXTC3 testcases
    //
	function GetTestCase_EXTC3 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            testCases.push({'mnemonic':'EXTC3', 
                                            'opCode':'9F', 
                                            'Ext_OPC':arg1, 
                                            'byte1':arg2, 
                                            'byte2':arg3, 
                                            'byte3':arg4});
                        }
                    }
                }
		}
		return testCases;
	}

    // 9F EXTC3
    //
	itParam("EXTC3 test Ext_OPC ${value.Ext_OPC} byte1 ${value.byte1} byte2 ${value.byte2} byte3 ${value.byte3}", 
    GetTestCase_EXTC3(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.Ext_OPC, 2) + decToHex(value.byte1, 2) + decToHex(value.byte2, 2) + decToHex(value.byte3, 2) + ";";
        var encode = cbusLib.encodeEXTC3(value.Ext_OPC, value.byte1, value.byte2, value.byte3);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.Ext_OPC).to.equal(value.Ext_OPC, 'Ext_OPC');
        expect(decode.byte1).to.equal(value.byte1, 'byte1');
        expect(decode.byte2).to.equal(value.byte2, 'byte2');
        expect(decode.byte3).to.equal(value.byte3, 'byte3');
	})


    // A0 RDCC4 testcases
    //
	function GetTestCase_RDCC4 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                testCases.push({'mnemonic':'RDCC4', 
                                                'opCode':'A0', 
                                                'repetitions':arg1, 
                                                'byte0':arg2, 
                                                'byte1':arg3, 
                                                'byte2':arg4, 
                                                'byte3':arg5});
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // A0 RDCC4
    //
	itParam("RDCC4 test repetitions ${value.repetitions} byte0 ${value.byte0} byte1 ${value.byte1} byte2 ${value.byte2} byte3 ${value.byte3}", 
        GetTestCase_RDCC4(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.repetitions, 2) + decToHex(value.byte0, 2) + decToHex(value.byte1, 2) + decToHex(value.byte2, 2) + decToHex(value.byte3, 2) + ";";
        var encode = cbusLib.encodeRDCC4(value.repetitions, value.byte0, value.byte1, value.byte2, value.byte3);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.repetitions).to.equal(value.repetitions, 'repetitions');
        expect(decode.byte0).to.equal(value.byte0, 'byte0');
        expect(decode.byte1).to.equal(value.byte1, 'byte1');
        expect(decode.byte2).to.equal(value.byte2, 'byte2');
        expect(decode.byte3).to.equal(value.byte3, 'byte3');
	})


    // A2 WCVS testcases
    //
	function GetTestCase_WCVS () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            testCases.push({'mnemonic':'WCVS', 
                                            'opCode':'A2', 
                                            'session':arg1, 
                                            'CV':arg2, 
                                            'mode':arg3, 
                                            'value':arg4});
                        }
                    }
                }
		}
		return testCases;
	}

    // A2 WCVS
    //
	itParam("WCVS test session ${value.session} CV ${value.CV} mode ${value.mode} value ${value.value}", 
        GetTestCase_WCVS(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.session, 2) + decToHex(value.CV, 4) + decToHex(value.mode, 2) + decToHex(value.value, 2) + ";";
        var encode = cbusLib.encodeWCVS(value.session, value.CV, value.mode, value.value);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.session).to.equal(value.session, 'session');
        expect(decode.CV).to.equal(value.CV, 'CV');
        expect(decode.mode).to.equal(value.mode, 'mode');
        expect(decode.value).to.equal(value.value, 'value');
	})


    // AB HEARTB test cases
    //
	function GetTestCase_HEARTB () {
		var testCases = []
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
			for (a2 = 1; a2 < 4; a2++) {
				if (a2 == 1) arg2 = 0;
				if (a2 == 2) arg2 = 1;
				if (a2 == 3) arg2 = 255;
				for (a3 = 1; a3 < 4; a3++) {
					if (a3 == 1) arg3 = 0;
					if (a3 == 2) arg3 = 1;
					if (a3 == 3) arg3 = 255;
					for (a4 = 1; a4 < 4; a4++) {
						if (a4 == 1) arg4 = 0;
						if (a4 == 2) arg4 = 1;
						if (a4 == 3) arg4 = 255;
						testCases.push({'mnemonic':'HEARTB', 
                                        'opCode':'AB',
										'nodeNumber':arg1,
										'SequenceCount':arg2,
										'StatusByte1':arg3,
										'StatusByte2':arg4})
					}
                }
            }
        }
		return testCases;
    }        


    // AB HEARTB
    //
	itParam("HEARTB test nodeNumber ${value.nodeNumber} SequenceCount ${value.SequenceCount} StatusByte1 ${value.StatusByte1} StatusByte2 ${value.StatusByte2}", 
        GetTestCase_HEARTB(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.SequenceCount, 2) + decToHex(value.StatusByte1, 2) + decToHex(value.StatusByte2, 2) + ";";
        var encode = cbusLib.encodeHEARTB(value.nodeNumber, value.SequenceCount, value.StatusByte1, value.StatusByte2);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'SequenceCount');
        expect(decode.SequenceCount).to.equal(value.SequenceCount, 'SequenceCount');
        expect(decode.StatusByte1).to.equal(value.StatusByte1, 'StatusByte1');
        expect(decode.StatusByte2).to.equal(value.StatusByte2, 'StatusByte2');
	})


    // AC SD testcases
    //
	function GetTestCase_SD () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
						for (a4 = 1; a4 < 4; a4++) {
							if (a4 == 1) arg4 = 0;
							if (a4 == 2) arg4 = 1;
							if (a4 == 3) arg4 = 255;
							testCases.push({'mnemonic':'SD', 
										'opCode':'AC', 
										'nodeNumber':arg1, 
										'ServiceIndex':arg2,
										'ServiceType':arg3,
										'ServiceVersion':arg4});
						}
					}
                }
		}
		return testCases;
	}

    // AC SD
    //
	itParam("SD test nodeNumber ${value.nodeNumber} ServiceIndex ${value.ServiceIndex} ServiceType ${value.ServiceType} ServiceVersion ${value.ServiceVersion}", GetTestCase_SD(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.ServiceIndex, 2) + decToHex(value.ServiceType, 2) + decToHex(value.ServiceVersion, 2) + ";";
        var encode = cbusLib.encodeSD(value.nodeNumber, value.ServiceIndex, value.ServiceType, value.ServiceVersion);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.ServiceIndex).to.equal(value.ServiceIndex, 'ServiceIndex');
        expect(decode.ServiceType).to.equal(value.ServiceType, 'ServiceType');
        expect(decode.ServiceVersion).to.equal(value.ServiceVersion, 'ServiceVersion');
	})


    // AF GRSP test cases
    //
	function GetTestCase_GRSP () {
		var testCases = []
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
			for (a2 = 1; a2 < 4; a2++) {
				if (a2 == 1) arg2 = '00';
				if (a2 == 2) arg2 = '01';
				if (a2 == 3) arg2 = 'FF';
				for (a3 = 1; a3 < 4; a3++) {
					if (a3 == 1) arg3 = 0;
					if (a3 == 2) arg3 = 1;
					if (a3 == 3) arg3 = 255;
					for (a4 = 1; a4 < 4; a4++) {
						if (a4 == 1) arg4 = 0;
						if (a4 == 2) arg4 = 1;
						if (a4 == 3) arg4 = 255;
						testCases.push({'mnemonic':'GRSP', 
                                        'opCode':'AF',
										'nodeNumber':arg1,
										'requestOpCode':arg2,
										'serviceType':arg3,
										'result':arg4})
					}
                }
            }
        }
		return testCases;
    }        


    // AF GRSP
    //
	itParam("GRSP test ${JSON.stringify(value)}", 
        GetTestCase_GRSP(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + value.requestOpCode + decToHex(value.serviceType, 2) + decToHex(value.result, 2) + ";";
        var encode = cbusLib.encodeGRSP(value.nodeNumber, value.requestOpCode, value.serviceType, value.result);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.requestOpCode).to.equal(value.requestOpCode, 'requestOpCode');
        expect(decode.serviceType).to.equal(value.serviceType, 'serviceType');
        expect(decode.result).to.equal(value.result, 'result');
	})


    // B0/B1 ACON1 & ACOF1 test cases
    //
	function GetTestCase_ACONF1 () {
		var testCases = []
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (EN = 1; EN < 4; EN++) {
				if (EN == 1) eventNumber = 0;
				if (EN == 2) eventNumber = 1;
				if (EN == 3) eventNumber = 65535;
                for (D1 = 1; D1 < 4; D1++) {
                    if (D1 == 1) data1 = 0;
                    if (D1 == 2) data1 = 1;
                    if (D1 == 3) data1 = 255;
                    testCases.push({'nodeNumber':nodeNumber,
                                    'eventNumber':eventNumber,
                                    'data1':data1})
                }
            }
        }
		return testCases;
    }        


    // B0 ACON1
    //
	itParam("ACON1 test: nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1}",
        GetTestCase_ACONF2(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ACON1 test ' + JSON.stringify(value)});
            expected = ":SB780NB0" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + ";";
            var encode = cbusLib.encodeACON1(value.nodeNumber, value.eventNumber, value.data1);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ACON1 encode ' + encode});
            winston.info({message: 'cbusMessage test: ACON1 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.mnemonic).to.equal('ACON1', 'mnemonic');
            expect(decode.opCode).to.equal('B0', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // B1 ACOF1
    //
	itParam("ACOF1 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1}",
        GetTestCase_ACONF1(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ACOF2 test ' + JSON.stringify(value)});
            expected = ":SB780NB1" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + ";";
            var encode = cbusLib.encodeACOF1(value.nodeNumber, value.eventNumber, value.data1);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ACOF1 encode ' + encode});
            winston.info({message: 'cbusMessage test: ACOF1 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.mnemonic).to.equal('ACOF1', 'mnemonic');
            expect(decode.opCode).to.equal('B1', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // B2 REQEV testcases
    //
	function GetTestCase_REQEV () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    testCases.push({'mnemonic':'REQEV', 
                                    'opCode':'B2', 
                                    'nodeNumber':arg1, 
                                    'eventNumber':arg2,
                                    'eventVariableIndex':arg3,
                    })
                }
            }
		}
		return testCases;
	}

    // B2 REQEV
    //
	itParam("REQEV test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} eventVariableIndex ${value.eventVariableIndex}", 
        GetTestCase_REQEV(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.eventVariableIndex, 2) + ";";
            var encode = cbusLib.encodeREQEV(value.nodeNumber, value.eventNumber, value.eventVariableIndex);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            expect(encode).to.equal(expected, 'encode');
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.eventVariableIndex).to.equal(value.eventVariableIndex, 'eventVariableIndex');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
	})


    // B3 ARON1 testcases
    //
	function GetTestCase_ARON1 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    testCases.push({'mnemonic':'ARON1', 
                                    'opCode':'B3', 
                                    'nodeNumber':arg1, 
                                    'eventNumber':arg2,
                                    'data1':arg3,
                    })                                
                }
            }
		}
		return testCases;
	}

    // B3 ARON1
    //
	itParam("ARON1 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1}", 
        GetTestCase_ARON1(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + ";";
            var encode = cbusLib.encodeARON1(value.nodeNumber, value.eventNumber, value.data1);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
	})


    // B4 AROF1 testcases
    //
	function GetTestCase_AROF1 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    testCases.push({'mnemonic':'AROF1', 
                                    'opCode':'B4', 
                                    'nodeNumber':arg1, 
                                    'eventNumber':arg2,
                                    'data1':arg3,
                    })                                
                }
            }
		}
		return testCases;
	}

    // B4 AROF1
    //
	itParam("AROF1 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1}", 
        GetTestCase_AROF1(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + ";";
            var encode = cbusLib.encodeAROF1(value.nodeNumber, value.eventNumber, value.data1);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
	})


    // B5 NEVAL
    //
	function GetTestCase_NEVAL () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (ENindex = 1; ENindex < 4; ENindex++) {
				if (ENindex == 1) eventIndex = 0;
				if (ENindex == 2) eventIndex = 1;
				if (ENindex == 3) eventIndex = 255;
                for (EVindex = 1; EVindex < 4; EVindex++) {
                    if (EVindex == 1) eventVariableIndex = 0;
                    if (EVindex == 2) eventVariableIndex = 1;
                    if (EVindex == 3) eventVariableIndex = 255;
                    for (EVvalue = 1; EVvalue < 4; EVvalue++) {
                        if (EVvalue == 1) eventVariableValue = 0;
                        if (EVvalue == 2) eventVariableValue = 1;
                        if (EVvalue == 3) eventVariableValue = 255;
                        testCases.push({'nodeNumber':nodeNumber, 'eventIndex':eventIndex, 'eventVariableIndex':eventVariableIndex, 'eventVariableValue':eventVariableValue});
                    }
                }
			}
		}
		return testCases;
	}

	itParam("NEVAL test nodeNumber ${value.nodeNumber} eventIndex ${value.eventIndex} eventVariableIndex ${value.eventVariableIndex} eventVariableValue ${value.eventVariableValue}", 
        GetTestCase_NEVAL(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN NEVAL test ' + JSON.stringify(value)});
            expected = ":SB780NB5" + decToHex(value.nodeNumber, 4) + decToHex(value.eventIndex, 2) + decToHex(value.eventVariableIndex, 2) + decToHex(value.eventVariableValue, 2) + ";";
            var encode = cbusLib.encodeNEVAL(value.nodeNumber, value.eventIndex, value.eventVariableIndex, value.eventVariableValue);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: NEVAL encode ' + encode});
            winston.info({message: 'cbusMessage test: NEVAL decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventIndex).to.equal(value.eventIndex, 'eventIndex');
            expect(decode.eventVariableIndex).to.equal(value.eventVariableIndex, 'eventVariableIndex');
            expect(decode.eventVariableValue).to.equal(value.eventVariableValue, 'eventVariableValue');
            expect(decode.mnemonic).to.equal('NEVAL', 'mnemonic');
            expect(decode.opCode).to.equal('B5', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // B6 PNN
    //
	function GetTestCase_PNN () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (MAN = 1; MAN < 4; MAN++) {
				if (MAN == 1) manufacturerId = 0;
				if (MAN == 2) manufacturerId = 1;
				if (MAN == 3) manufacturerId = 255;
                for (MOD = 1; MOD < 4; MOD++) {
                    if (MOD == 1) moduleId = 0;
                    if (MOD == 2) moduleId = 1;
                    if (MOD == 3) moduleId = 255;
                    for (FL = 1; FL < 4; FL++) {
                        if (FL == 1) flags = 0;
                        if (FL == 2) flags = 1;
                        if (FL == 3) flags = 255;
                        testCases.push({'nodeNumber':nodeNumber, 'manufacturerId':manufacturerId, 'moduleId':moduleId, 'flags':flags});
                    }
                }
			}
		}
		return testCases;
	}
    // PNN Format: [<MjPri><MinPri=3><CANID>]<B6><NN Hi><NN Lo><Manuf Id><Module Id><Flags>
	itParam("PNN test nodeNumber ${value.nodeNumber} manufacturerId ${value.manufacturerId} moduleId ${value.moduleId} flags ${value.flags}", 
        GetTestCase_PNN(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN NEVAL test ' + JSON.stringify(value)});
            expected = ":SB780NB6" + decToHex(value.nodeNumber, 4) + decToHex(value.manufacturerId, 2) + decToHex(value.moduleId, 2) + decToHex(value.flags, 2) + ";";
            var encode = cbusLib.encodePNN(value.nodeNumber, value.manufacturerId, value.moduleId, value.flags);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: PNN encode ' + encode});
            winston.info({message: 'cbusMessage test: PNN decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.manufacturerId).to.equal(value.manufacturerId, 'manufacturerId');
            expect(decode.moduleId).to.equal(value.moduleId, 'moduleId');
            expect(decode.flags).to.equal(value.flags, 'flags');
            expect(decode.mnemonic).to.equal('PNN', 'mnemonic');
            expect(decode.opCode).to.equal('B6', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // B8/B9 ASON1 & ASOF1 test cases
    //
	function GetTestCase_ASONF1 () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (DN = 1; DN < 4; DN++) {
				if (DN == 1) deviceNumber = 0;
				if (DN == 2) deviceNumber = 1;
				if (DN == 3) deviceNumber = 65535;
                for (D1 = 1; D1 < 4; D1++) {
                    if (D1 == 1) data1 = 0;
                    if (D1 == 2) data1 = 1;
                    if (D1 == 3) data1 = 255;
                    testCases.push({'nodeNumber':nodeNumber,
                                    'deviceNumber':deviceNumber,
                                    'data1':data1})
                }
            }
        }
		return testCases;
    }        


    // B8 ASON1
    //
	itParam("ASON1 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1}",
        GetTestCase_ASONF1(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ASON1 test ' + JSON.stringify(value)});
            expected = ":SB780NB8" + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + ";";
            var encode = cbusLib.encodeASON1(value.nodeNumber, value.deviceNumber, value.data1);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ASON1 encode ' + encode});
            winston.info({message: 'cbusMessage test: ASON1 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
            expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.mnemonic).to.equal('ASON1', 'mnemonic');
            expect(decode.opCode).to.equal('B8', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // B9 ASOF1
    //
	itParam("ASOF1 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1}",
        GetTestCase_ASONF1(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ASOF2 test ' + JSON.stringify(value)});
            expected = ":SB780NB9" + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + ";";
            var encode = cbusLib.encodeASOF1(value.nodeNumber, value.deviceNumber, value.data1);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ASOF1 encode ' + encode});
            winston.info({message: 'cbusMessage test: ASOF1 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
            expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.mnemonic).to.equal('ASOF1', 'mnemonic');
            expect(decode.opCode).to.equal('B9', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // BD ARSON1 testcases
    //
	function GetTestCase_ARSON1 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    testCases.push({'mnemonic':'ARSON1', 
                                    'opCode':'BD', 
                                    'nodeNumber':arg1, 
                                    'deviceNumber':arg2,
                                    'data1':arg3,
                    })                                
                }
            }
		}
		return testCases;
	}

    // BD ARSON1
    //
	itParam("ARSON1 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1}", 
        GetTestCase_ARSON1(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + ";";
            var encode = cbusLib.encodeARSON1(value.nodeNumber, value.deviceNumber, value.data1);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
            expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
	})


    // BE ARSOF1 testcases
    //
	function GetTestCase_ARSOF1 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    testCases.push({'mnemonic':'ARSOF1', 
                                    'opCode':'BE', 
                                    'nodeNumber':arg1, 
                                    'deviceNumber':arg2,
                                    'data1':arg3,
                    })                                
                }
            }
		}
		return testCases;
	}

    // BE ARSOF1
    //
	itParam("ARSOF1 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1}", 
        GetTestCase_ARSOF1(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + ";";
            var encode = cbusLib.encodeARSOF1(value.nodeNumber, value.deviceNumber, value.data1);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
            expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
	})


    // BF EXTC4 testcases
    //
	function GetTestCase_EXTC4 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                testCases.push({'mnemonic':'EXTC4', 
                                                'opCode':'BF', 
                                                'Ext_OPC':arg1, 
                                                'byte1':arg2, 
                                                'byte2':arg3, 
                                                'byte3':arg4, 
                                                'byte4':arg5});
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // BF EXTC4
    //
	itParam("EXTC4 test Ext_OPC ${value.Ext_OPC} byte1 ${value.byte1} byte2 ${value.byte2} byte3 ${value.byte3} byte4 ${value.byte4}", 
    GetTestCase_EXTC4(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.Ext_OPC, 2) + decToHex(value.byte1, 2) + decToHex(value.byte2, 2) + decToHex(value.byte3, 2) + decToHex(value.byte4, 2) + ";";
        var encode = cbusLib.encodeEXTC4(value.Ext_OPC, value.byte1, value.byte2, value.byte3, value.byte4);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.Ext_OPC).to.equal(value.Ext_OPC, 'Ext_OPC');
        expect(decode.byte1).to.equal(value.byte1, 'byte1');
        expect(decode.byte2).to.equal(value.byte2, 'byte2');
        expect(decode.byte3).to.equal(value.byte3, 'byte3');
        expect(decode.byte4).to.equal(value.byte4, 'byte4');
	})


    // C0 RDCC5 testcases
    //
	function GetTestCase_RDCC5 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    testCases.push({'mnemonic':'RDCC5', 
                                                    'opCode':'C0', 
                                                    'repetitions':arg1, 
                                                    'byte0':arg2, 
                                                    'byte1':arg3, 
                                                    'byte2':arg4, 
                                                    'byte3':arg5, 
                                                    'byte4':arg6});
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // C0 RDCC5
    //
	itParam("RDCC5 test repetitions ${value.repetitions} byte0 ${value.byte0} byte1 ${value.byte1} byte2 ${value.byte2} byte3 ${value.byte3} byte4 ${value.byte4}", 
        GetTestCase_RDCC5(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.repetitions, 2) + decToHex(value.byte0, 2) + decToHex(value.byte1, 2) + decToHex(value.byte2, 2) + decToHex(value.byte3, 2) + decToHex(value.byte4, 2) + ";";
        var encode = cbusLib.encodeRDCC5(value.repetitions, value.byte0, value.byte1, value.byte2, value.byte3, value.byte4);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.repetitions).to.equal(value.repetitions, 'repetitions');
        expect(decode.byte0).to.equal(value.byte0, 'byte0');
        expect(decode.byte1).to.equal(value.byte1, 'byte1');
        expect(decode.byte2).to.equal(value.byte2, 'byte2');
        expect(decode.byte3).to.equal(value.byte3, 'byte3');
        expect(decode.byte4).to.equal(value.byte4, 'byte4');
	})


    // C1 WCVOA testcases
    //
	function GetTestCase_WCVOA () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            testCases.push({'mnemonic':'WCVOA', 
                                            'opCode':'C1', 
                                            'address':arg1, 
                                            'CV':arg2, 
                                            'mode':arg3, 
                                            'value':arg4});
                        }
                    }
                }
		}
		return testCases;
	}

    // C1 WCVOA
    //
	itParam("WCVOA test address ${value.address} CV ${value.CV} mode ${value.mode} value ${value.value}", GetTestCase_WCVOA(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.address, 4) + decToHex(value.CV, 4) + decToHex(value.mode, 2) + decToHex(value.value, 2) + ";";
        var encode = cbusLib.encodeWCVOA(value.address, value.CV, value.mode, value.value);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.address).to.equal(value.address, 'address');
        expect(decode.CV).to.equal(value.CV, 'CV');
        expect(decode.mode).to.equal(value.mode, 'mode');
        expect(decode.value).to.equal(value.value, 'value');
	})


    // C2 CABDAT testcases
    //
	function GetTestCase_CABDAT () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
							for (a5 = 1; a5 < 4; a5++) {
								if (a5 == 1) arg5 = 0;
								if (a5 == 2) arg5 = 1;
								if (a5 == 3) arg5 = 255;
								testCases.push({'mnemonic':'CABDAT', 
												'opCode':'C2', 
												'address':arg1, 
												'datcode':arg2, 
												'aspect1':arg3, 
												'aspect2':arg4, 
												'speed':arg5});
							}
                        }
                    }
                }
		}
		return testCases;
	}

    // C2 CABDAT
    //
	itParam("CABDAT test address ${value.address} datcode ${value.datcode} aspect1 ${value.aspect1} aspect2 ${value.aspect2} speed ${value.speed}", GetTestCase_CABDAT(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.address, 4) + decToHex(value.datcode, 2) + decToHex(value.aspect1, 2) + decToHex(value.aspect2, 2) + decToHex(value.speed, 2) + ";";
        var encode = cbusLib.encodeCABDAT(value.address, value.datcode, value.aspect1, value.aspect2, value.speed);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.address).to.equal(value.address, 'address');
        expect(decode.datcode).to.equal(value.datcode, 'datcode');
        expect(decode.aspect1).to.equal(value.aspect1, 'aspect1');
        expect(decode.aspect2).to.equal(value.aspect2, 'aspect2');
        expect(decode.speed).to.equal(value.speed, 'speed');
	})


    // C7 DGN testcases
    //
	function GetTestCase_DGN () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 255;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
					for (a4 = 1; a4 < 4; a4++) {
						if (a4 == 1) arg4 = 0;
						if (a4 == 2) arg4 = 1;
						if (a4 == 3) arg4 = 65535;
						testCases.push({'mnemonic':'DGN', 
										'opCode':'C7', 
										'nodeNumber':arg1, 
										'ServiceIndex':arg2,
										'DiagnosticCode':arg3,
										'DiagnosticValue':arg4,
						})
					}
				}
            }
		}
		return testCases;
	}

    // C7 DGN
    //
	itParam("DGN test ${JSON.stringify(value)}", 
        GetTestCase_DGN(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.ServiceIndex, 2) + decToHex(value.DiagnosticCode, 2) + decToHex(value.DiagnosticValue, 4) + ";";
            var encode = cbusLib.encodeDGN(value.nodeNumber, value.ServiceIndex, value.DiagnosticCode, value.DiagnosticValue);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.ServiceIndex).to.equal(value.ServiceIndex, 'deviceNumber');
            expect(decode.DiagnosticCode).to.equal(value.DiagnosticCode, 'DiagnosticCode');
            expect(decode.DiagnosticValue).to.equal(value.DiagnosticValue, 'DiagnosticValue');
	})


    // CF FCLK testcases
    //
	function GetTestCase_FCLK () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) { //minutes
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) { // hours
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 3; a3++) { // day of week
                        if (a3 == 1) arg3 = 1;
                        if (a3 == 2) arg3 = 7;
                        for (a4 = 1; a4 < 3; a4++) { // month
                            if (a4 == 1) arg4 = 1;
                            if (a4 == 2) arg4 = 12;
                            for (a5 = 1; a5 < 4; a5++) { // div
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) { // day of month
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    for (a7 = 1; a7 < 7; a7++) { // temperature
                                        if (a7 == 1) arg7 = -128;
                                        if (a7 == 2) arg7 = -127;
                                        if (a7 == 3) arg7 = -1;
                                        if (a7 == 4) arg7 = 0;
                                        if (a7 == 5) arg7 = 1;
                                        if (a7 == 6) arg7 = 127;
                                        testCases.push({'mnemonic':'FCLK', 
                                                        'opCode':'CF', 
                                                        'minutes':arg1, 
                                                        'hours':arg2, 
                                                        'dayOfWeek':arg3, 
                                                        'month':arg4, 
                                                        'div':arg5, 
                                                        'dayOfMonth':arg6, 
                                                        'temperature':arg7});
                                    }
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // CF FCLK
    //
	itParam("FCLK test ${JSON.stringify(value)}", GetTestCase_FCLK(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
        var wdmon = value.dayOfWeek + (16 * value.month);
		expected = ":SB780N" + value.opCode + decToHex(value.minutes, 2) + decToHex(value.hours, 2) + decToHex(wdmon, 2) + decToHex(value.div, 2) + decToHex(value.dayOfMonth, 2) + decToHex((value.temperature & 0xFF), 2) + ";";
        var encode = cbusLib.encodeFCLK(value.minutes, value.hours, value.dayOfWeek, value.dayOfMonth, value.month, value.div, value.temperature);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.minutes).to.equal(value.minutes, 'minutes');
        expect(decode.hours).to.equal(value.hours, 'hours');
        expect(decode.dayOfWeek).to.equal(value.dayOfWeek, 'dayOfWeek');
        expect(decode.dayOfMonth).to.equal(value.dayOfMonth, 'dayOfMonth');
        expect(decode.month).to.equal(value.month, 'month');
        expect(decode.div).to.equal(value.div, 'div');
        expect(decode.temperature).to.equal(value.temperature, 'temperature');
	})


    // D0/D1 ACON2 & ACOF2 test cases
    //
	function GetTestCase_ACONF2 () {
		var testCases = []
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (EN = 1; EN < 4; EN++) {
				if (EN == 1) eventNumber = 0;
				if (EN == 2) eventNumber = 1;
				if (EN == 3) eventNumber = 65535;
                for (D1 = 1; D1 < 4; D1++) {
                    if (D1 == 1) data1 = 0;
                    if (D1 == 2) data1 = 1;
                    if (D1 == 3) data1 = 255;
                    for (D2 = 1; D2 < 4; D2++) {
                        if (D2 == 1) data2 = 0;
                        if (D2 == 2) data2 = 1;
                        if (D2 == 3) data2 = 255;
                        testCases.push({'nodeNumber':nodeNumber,
                                        'eventNumber':eventNumber,
                                        'data1':data1,
                                        'data2':data2})
                    }
                }
            }
        }
		return testCases;
    }        


    // D0 ACON2
    //
	itParam("ACON2 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1} data2 ${value.data2}",
        GetTestCase_ACONF2(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ACON2 test ' + JSON.stringify(value)});
            expected = ":SB780ND0" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + ";";
            var encode = cbusLib.encodeACON2(value.nodeNumber, value.eventNumber, value.data1, value.data2);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ACON3 encode ' + encode});
            winston.info({message: 'cbusMessage test: ACON3 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
            expect(decode.mnemonic).to.equal('ACON2', 'mnemonic');
            expect(decode.opCode).to.equal('D0', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // D1 ACOF2
    //
	itParam("ACOF2 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1} data2 ${value.data2}",
        GetTestCase_ACONF2(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ACOF2 test ' + JSON.stringify(value)});
            expected = ":SB780ND1" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + ";";
            var encode = cbusLib.encodeACOF2(value.nodeNumber, value.eventNumber, value.data1, value.data2);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ACOF2 encode ' + encode});
            winston.info({message: 'cbusMessage test: ACOF2 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
            expect(decode.mnemonic).to.equal('ACOF2', 'mnemonic');
            expect(decode.opCode).to.equal('D1', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // D2 EVLRN test cases
    //
	function GetTestCase_EVLRN () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    for (a4 = 1; a4 < 4; a4++) {
                        if (a4 == 1) arg4 = 0;
                        if (a4 == 2) arg4 = 1;
                        if (a4 == 3) arg4 = 255;
                        testCases.push({'mnemonic':'EVLRN', 
                                        'opCode':'D2', 
                                        'nodeNumber':arg1, 
                                        'eventNumber':arg2,
                                        'eventVariableIndex':arg3,
                                        'eventVariableValue':arg4,
                        })
                    }                        
                }
            }
		}
		return testCases;
	}

    // D2 EVLRN
    //
	itParam("EVLRN test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} eventVariableIndex ${value.eventVariableIndex} eventVariableValue ${value.eventVariableValue}", GetTestCase_EVLRN(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN EVLRN test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.eventVariableIndex, 2) + decToHex(value.eventVariableValue, 2) + ";";
        var encode = cbusLib.encodeEVLRN(value.nodeNumber, value.eventNumber, value.eventVariableIndex, value.eventVariableValue);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: EVLRN encode ' + encode});
        expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: EVLRN decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
        expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
        expect(decode.eventIdentifier).to.equal(expected.substr(9, 8), 'eventIdentifier');
        expect(decode.eventVariableIndex).to.equal(value.eventVariableIndex, 'eventVariableIndex');
        expect(decode.eventVariableValue).to.equal(value.eventVariableValue, 'eventVariableValue');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // D3 EVANS testcases
    //
	function GetTestCase_EVANS () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    for (a4 = 1; a4 < 4; a4++) {
                        if (a4 == 1) arg4 = 0;
                        if (a4 == 2) arg4 = 1;
                        if (a4 == 3) arg4 = 255;
                        testCases.push({'mnemonic':'EVANS', 
                                        'opCode':'D3', 
                                        'nodeNumber':arg1, 
                                        'eventNumber':arg2,
                                        'eventVariableIndex':arg3,
                                        'eventVariableValue':arg4,
                        })
                    }                        
                }
            }
		}
		return testCases;
	}

    // D3 EVANS
    //
	itParam("EVANS test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} eventVariableIndex ${value.eventVariableIndex} eventVariableValue ${value.eventVariableValue}", 
        GetTestCase_EVANS(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.eventVariableIndex, 2) + decToHex(value.eventVariableValue, 2) + ";";
            var encode = cbusLib.encodeEVANS(value.nodeNumber, value.eventNumber, value.eventVariableIndex, value.eventVariableValue);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            expect(encode).to.equal(expected, 'encode');
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(expected.substr(9, 8), 'eventIdentifier');
            expect(decode.eventVariableIndex).to.equal(value.eventVariableIndex, 'eventVariableIndex');
            expect(decode.eventVariableValue).to.equal(value.eventVariableValue, 'eventVariableValue');
	})


    // D4 ARON2 testcases
    //
	function GetTestCase_ARON2 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    for (a4 = 1; a4 < 4; a4++) {
                        if (a4 == 1) arg4 = 0;
                        if (a4 == 2) arg4 = 1;
                        if (a4 == 3) arg4 = 255;
                        testCases.push({'mnemonic':'ARON2', 
                                        'opCode':'D4', 
                                        'nodeNumber':arg1, 
                                        'eventNumber':arg2,
                                        'data1':arg3,
                                        'data2':arg4,
                        })
                    }                        
                }
            }
		}
		return testCases;
	}

    // D4 ARON2
    //
	itParam("ARON2 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1} data2 ${value.data2}", 
        GetTestCase_ARON2(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + ";";
            var encode = cbusLib.encodeARON2(value.nodeNumber, value.eventNumber, value.data1, value.data2);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
	})


    // D5 AROF2 testcases
    //
	function GetTestCase_AROF2 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    for (a4 = 1; a4 < 4; a4++) {
                        if (a4 == 1) arg4 = 0;
                        if (a4 == 2) arg4 = 1;
                        if (a4 == 3) arg4 = 255;
                        testCases.push({'mnemonic':'AROF2', 
                                        'opCode':'D5', 
                                        'nodeNumber':arg1, 
                                        'eventNumber':arg2,
                                        'data1':arg3,
                                        'data2':arg4,
                        })
                    }                        
                }
            }
		}
		return testCases;
	}

    // D5 AROF2
    //
	itParam("AROF2 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1} data2 ${value.data2}", 
        GetTestCase_AROF2(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + ";";
            var encode = cbusLib.encodeAROF2(value.nodeNumber, value.eventNumber, value.data1, value.data2);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
	})


    // D8/D9 ASON2 & ASOF2 test cases
    //
	function GetTestCase_ASONF2 () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (DN = 1; DN < 4; DN++) {
				if (DN == 1) deviceNumber = 0;
				if (DN == 2) deviceNumber = 1;
				if (DN == 3) deviceNumber = 65535;
                for (D1 = 1; D1 < 4; D1++) {
                    if (D1 == 1) data1 = 0;
                    if (D1 == 2) data1 = 1;
                    if (D1 == 3) data1 = 255;
                    for (D2 = 1; D2 < 4; D2++) {
                        if (D2 == 1) data2 = 0;
                        if (D2 == 2) data2 = 1;
                        if (D2 == 3) data2 = 255;
                        testCases.push({'nodeNumber':nodeNumber,
                                        'deviceNumber':deviceNumber,
                                        'data1':data1,
                                        'data2':data2})
                    }
                }
            }
        }
		return testCases;
    }        


    // D8 ASON2
    //
	itParam("ASON2 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1} data2 ${value.data2}",
        GetTestCase_ASONF2(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ASON2 test ' + JSON.stringify(value)});
            expected = ":SB780ND8" + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + ";";
            var encode = cbusLib.encodeASON2(value.nodeNumber, value.deviceNumber, value.data1, value.data2);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ASON2 encode ' + encode});
            winston.info({message: 'cbusMessage test: ASON2 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
            expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
            expect(decode.mnemonic).to.equal('ASON2', 'mnemonic');
            expect(decode.opCode).to.equal('D8', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // D9 ASOF2
    //
	itParam("ASOF2 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1} data2 ${value.data2}",
        GetTestCase_ASONF2(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ASOF2 test ' + JSON.stringify(value)});
            expected = ":SB780ND9" + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + ";";
            var encode = cbusLib.encodeASOF2(value.nodeNumber, value.deviceNumber, value.data1, value.data2);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ASOF2 encode ' + encode});
            winston.info({message: 'cbusMessage test: ASOF2 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
            expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
            expect(decode.mnemonic).to.equal('ASOF2', 'mnemonic');
            expect(decode.opCode).to.equal('D9', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // DD ARSON2 testcases
    //
	function GetTestCase_ARSON2 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    for (a4 = 1; a4 < 4; a4++) {
                        if (a4 == 1) arg4 = 0;
                        if (a4 == 2) arg4 = 1;
                        if (a4 == 3) arg4 = 255;
                        testCases.push({'mnemonic':'ARSON2', 
                                        'opCode':'DD', 
                                        'nodeNumber':arg1, 
                                        'deviceNumber':arg2,
                                        'data1':arg3,
                                        'data2':arg4,
                        })
                    }                        
                }
            }
		}
		return testCases;
	}

    // DD ARSON2
    //
	itParam("ARSON2 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1} data2 ${value.data2}", 
        GetTestCase_ARSON2(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + ";";
            var encode = cbusLib.encodeARSON2(value.nodeNumber, value.deviceNumber, value.data1, value.data2);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
            expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data1');
	})


    // DE ARSOF2 testcases
    //
	function GetTestCase_ARSOF2 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 65535;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    for (a4 = 1; a4 < 4; a4++) {
                        if (a4 == 1) arg4 = 0;
                        if (a4 == 2) arg4 = 1;
                        if (a4 == 3) arg4 = 255;
                        testCases.push({'mnemonic':'ARSOF2', 
                                        'opCode':'DE', 
                                        'nodeNumber':arg1, 
                                        'deviceNumber':arg2,
                                        'data1':arg3,
                                        'data2':arg4,
                        })
                    }                        
                }
            }
		}
		return testCases;
	}

    // DE ARSOF2
    //
	itParam("ARSOF2 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1} data2 ${value.data2}", 
        GetTestCase_ARSOF2(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + ";";
            var encode = cbusLib.encodeARSOF2(value.nodeNumber, value.deviceNumber, value.data1, value.data2);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
            expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data1');
	})


    // DF EXTC5 testcases
    //
	function GetTestCase_EXTC5 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    testCases.push({'mnemonic':'EXTC5', 
                                                    'opCode':'DF', 
                                                    'Ext_OPC':arg1, 
                                                    'byte1':arg2, 
                                                    'byte2':arg3, 
                                                    'byte3':arg4, 
                                                    'byte4':arg5, 
                                                    'byte5':arg6});
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // DF EXTC5
    //
	itParam("EXTC5 test Ext_OPC ${value.Ext_OPC} byte1 ${value.byte1} byte2 ${value.byte2} byte3 ${value.byte3} byte4 ${value.byte4} byte5 ${value.byte5}", 
    GetTestCase_EXTC5(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.Ext_OPC, 2) + decToHex(value.byte1, 2) + decToHex(value.byte2, 2) + decToHex(value.byte3, 2) + decToHex(value.byte4, 2) + decToHex(value.byte5, 2) + ";";
        var encode = cbusLib.encodeEXTC5(value.Ext_OPC, value.byte1, value.byte2, value.byte3, value.byte4, value.byte5);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.Ext_OPC).to.equal(value.Ext_OPC, 'Ext_OPC');
        expect(decode.byte1).to.equal(value.byte1, 'byte1');
        expect(decode.byte2).to.equal(value.byte2, 'byte2');
        expect(decode.byte3).to.equal(value.byte3, 'byte3');
        expect(decode.byte4).to.equal(value.byte4, 'byte4');
        expect(decode.byte5).to.equal(value.byte5, 'byte5');
	})


    // E0 RDCC6 testcases
    //
	function GetTestCase_RDCC6 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    for (a7 = 1; a7 < 4; a7++) {
                                        if (a7 == 1) arg7 = 0;
                                        if (a7 == 2) arg7 = 1;
                                        if (a7 == 3) arg7 = 255;
                                        testCases.push({'mnemonic':'RDCC6', 
                                                        'opCode':'E0', 
                                                        'repetitions':arg1, 
                                                        'byte0':arg2, 
                                                        'byte1':arg3, 
                                                        'byte2':arg4, 
                                                        'byte3':arg5, 
                                                        'byte4':arg6, 
                                                        'byte5':arg7});
                                    }
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // E0 RDCC6
    //
	itParam("RDCC6 test repetitions ${value.repetitions} byte0 ${value.byte0} byte1 ${value.byte1} byte2 ${value.byte2} byte3 ${value.byte3} byte4 ${value.byte4} byte5 ${value.byte5}", 
        GetTestCase_RDCC6(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.repetitions, 2) + decToHex(value.byte0, 2) + decToHex(value.byte1, 2) + decToHex(value.byte2, 2) + decToHex(value.byte3, 2) + decToHex(value.byte4, 2) + decToHex(value.byte5, 2) + ";";
        var encode = cbusLib.encodeRDCC6(value.repetitions, value.byte0, value.byte1, value.byte2, value.byte3, value.byte4, value.byte5);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.repetitions).to.equal(value.repetitions, 'repetitions');
        expect(decode.byte0).to.equal(value.byte0, 'byte0');
        expect(decode.byte1).to.equal(value.byte1, 'byte1');
        expect(decode.byte2).to.equal(value.byte2, 'byte2');
        expect(decode.byte3).to.equal(value.byte3, 'byte3');
        expect(decode.byte4).to.equal(value.byte4, 'byte4');
        expect(decode.byte5).to.equal(value.byte5, 'byte5');
	})


    // E1 PLOC test cases
    //
	function GetTestCase_PLOC () {
		var testCases = [];
		for (sessionIndex = 1; sessionIndex < 4; sessionIndex++) {
			if (sessionIndex == 1) session = 0;
			if (sessionIndex == 2) session = 1;
			if (sessionIndex == 3) session = 255;
			for (AD = 1; AD < 4; AD++) {
				if (AD == 1) address = 0;
				if (AD == 2) address = 1;
				if (AD == 3) address = 65535;
                for (SP = 1; SP < 4; SP++) {
                    if (SP == 1) speed = 0;
                    if (SP == 2) speed = 1;
                    if (SP == 3) speed = 127;
                    for (DIR = 1; DIR < 3; DIR++) {
                        if (DIR == 1) direction = 'Reverse';
                        if (DIR == 2) direction = 'Forward';
                        for (Fn1Index = 1; Fn1Index < 4; Fn1Index++) {
                            if (Fn1Index == 1) Fn1 = 0;
                            if (Fn1Index == 2) Fn1 = 1;
                            if (Fn1Index == 3) Fn1 = 255;
                            for (Fn2Index = 1; Fn2Index < 4; Fn2Index++) {
                                if (Fn2Index == 1) Fn2 = 0;
                                if (Fn2Index == 2) Fn2 = 1;
                                if (Fn2Index == 3) Fn2 = 255;
                                for (Fn3Index = 1; Fn3Index < 4; Fn3Index++) {
                                    if (Fn3Index == 1) Fn3 = 0;
                                    if (Fn3Index == 2) Fn3 = 1;
                                    if (Fn3Index == 3) Fn3 = 255;
                                    testCases.push({'session':session, 
                                        'address':address,
                                        'speed': speed,
                                        'direction': direction,
                                        'Fn1':Fn1, 
                                        'Fn2':Fn2,
                                        'Fn3':Fn3});
                                }
                            }
                        }
                    }
                }
            }
		}
		return testCases;
	}


    // E1 PLOC
    //
	itParam("PLOC test session ${value.session} address ${value.address} speed ${value.speed} direction ${value.direction} Fn1 ${value.Fn1} Fn2 ${value.Fn2} Fn3 ${value.Fn3}",
        GetTestCase_PLOC(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN PLOC test ' + JSON.stringify(value)});
            // PLOC Format: [<MjPri><MinPri=2><CANID>]<E1><Session><AddrH><AddrL><Speed/Dir><Fn1><Fn2><Fn3>
            var speedDir = value.speed + parseInt((value.direction == 'Reverse') ? 0 : 128)
            expected = ":SA780NE1" + decToHex(value.session, 2) + decToHex(value.address, 4) + decToHex(speedDir, 2) +
                decToHex(value.Fn1, 2) + decToHex(value.Fn2, 2) + decToHex(value.Fn3, 2) + ";";
            var encode = cbusLib.encodePLOC(value.session, value.address, value.speed, value.direction, value.Fn1, value.Fn2, value.Fn3);
            winston.info({message: 'cbusMessage test: PLOC encode ' + encode});
            expect(encode).to.equal(expected, 'encode');
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: PLOC decode ' + JSON.stringify(decode)});
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.session).to.equal(value.session, 'session');
            expect(decode.address).to.equal(value.address, 'address');
            expect(decode.speed).to.equal(value.speed, 'speed');
            expect(decode.direction).to.equal(value.direction, 'direction');
            expect(decode.Fn1).to.equal(value.Fn1, 'Fn1');
            expect(decode.Fn2).to.equal(value.Fn2, 'Fn2');
            expect(decode.Fn3).to.equal(value.Fn3, 'Fn3');
            expect(decode.mnemonic).to.equal('PLOC', 'mnemonic');
            expect(decode.opCode).to.equal('E1', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // E2 NAME testcases
    //
	function GetTestCase_NAME () {
		var testCases = [];
		for (a1 = 1; a1 < 5; a1++) {
			if (a1 == 1) {arg1 = ''; arg2 = '       ';}
			if (a1 == 2) {arg1 = '1'; arg2 = '1      '}
			if (a1 == 3) {arg1 = '1234567'; arg2 = '1234567';}
			if (a1 == 4) {arg1 = '12345678'; arg2 = '1234567';}
			testCases.push({'mnemonic':'NAME', 'opCode':'E2', 'name':arg1, 'expectedName':arg2});
		}
		return testCases;
	}


    // E2 NAME
    //
	itParam("NAME test name ${value.name}", GetTestCase_NAME(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + stringToHex(value.expectedName) + ";";
        var encode = cbusLib.encodeNAME(value.name);
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.name).to.equal(value.expectedName, 'expectedName');
	})


    // E3 STAT testcases
    //
	function GetTestCase_STAT () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    testCases.push({'mnemonic':'STAT', 
                                                    'opCode':'E3', 
                                                    'nodeNumber':arg1, 
                                                    'CS':arg2, 
                                                    'flags':arg3, 
                                                    'major':arg4, 
                                                    'minor':arg5, 
                                                    'build':arg6});
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // E3 STAT
    //
	itParam("STAT test nodeNumber ${value.nodeNumber} CS ${value.CS} flags ${value.flags} major ${value.major} minor ${value.minor} build ${value.build}", 
    GetTestCase_STAT(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.CS, 2) + decToHex(value.flags, 2) + decToHex(value.major, 2) + decToHex(value.minor, 2) + decToHex(value.build, 2) + ";";
        var encode = cbusLib.encodeSTAT(value.nodeNumber, value.CS, value.flags, value.major, value.minor, value.build);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.CS).to.equal(value.CS, 'CS');
        expect(decode.flags).to.equal(value.flags, 'flags');
        expect(decode.major).to.equal(value.major, 'major');
        expect(decode.minor).to.equal(value.minor, 'minor');
        expect(decode.build).to.equal(value.build, 'build');
	})


    // E7 ESD testcases
    //
	function GetTestCase_ESD () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    testCases.push({'mnemonic':'ESD', 
                                                    'opCode':'E7', 
                                                    'nodeNumber':arg1, 
                                                    'ServiceIndex':arg2, 
                                                    'Data1':arg3, 
                                                    'Data2':arg4, 
                                                    'Data3':arg5, 
                                                    'Data4':arg6});
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // E7 ESD
    //
	itParam("ESD test nodeNumber ${value.nodeNumber} ServiceIndex ${value.ServiceIndex} Data1 ${value.Data1} Data2 ${value.Data2} Data3 ${value.Data3} Data4 ${value.Data4}", 
    GetTestCase_ESD(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.ServiceIndex, 2) + decToHex(value.Data1, 2) + decToHex(value.Data2, 2) + decToHex(value.Data3, 2) + decToHex(value.Data4, 2) + ";";
        var encode = cbusLib.encodeESD(value.nodeNumber, value.ServiceIndex, value.Data1, value.Data2, value.Data3, value.Data4);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.ServiceIndex).to.equal(value.ServiceIndex, 'ServiceIndex');
        expect(decode.Data1).to.equal(value.Data1, 'Data1');
        expect(decode.Data2).to.equal(value.Data2, 'Data2');
        expect(decode.Data3).to.equal(value.Data3, 'Data3');
        expect(decode.Data4).to.equal(value.Data4, 'Data4');
	})


    // EF PARAMS testcases
    //
	function GetTestCase_PARAMS () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    for (a7 = 1; a7 < 4; a7++) {
                                        if (a7 == 1) arg7 = 0;
                                        if (a7 == 2) arg7 = 1;
                                        if (a7 == 3) arg7 = 255;
                                        testCases.push({'mnemonic':'PARAMS', 
                                                        'opCode':'EF', 
                                                        'param1':arg1, 
                                                        'param2':arg2, 
                                                        'param3':arg3, 
                                                        'param4':arg4, 
                                                        'param5':arg5, 
                                                        'param6':arg6, 
                                                        'param7':arg7});
                                    }
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // EF PARAMS
    //
	itParam("PARAMS test param1 ${value.param1} param2 ${value.param2} param3 ${value.param3} param4 ${value.param4} param5 ${value.param5} param6 ${value.param6} param7 ${value.param7}", 
        GetTestCase_PARAMS(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.param1, 2) + decToHex(value.param2, 2) + decToHex(value.param3, 2) + decToHex(value.param4, 2) + decToHex(value.param5, 2) + decToHex(value.param6, 2) + decToHex(value.param7, 2) + ";";
        var encode = cbusLib.encodePARAMS(value.param1, value.param2, value.param3, value.param4, value.param5, value.param6, value.param7);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.param1).to.equal(value.param1, 'param1');
        expect(decode.param2).to.equal(value.param2, 'param2');
        expect(decode.param3).to.equal(value.param3, 'param3');
        expect(decode.param4).to.equal(value.param4, 'param4');
        expect(decode.param5).to.equal(value.param5, 'param5');
        expect(decode.param6).to.equal(value.param6, 'param6');
        expect(decode.param7).to.equal(value.param7, 'param7');
	})


    // F0 ACON3 & ACOF3 test cases
    //
	function GetTestCase_ACONF3 () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (EN = 1; EN < 4; EN++) {
				if (EN == 1) eventNumber = 0;
				if (EN == 2) eventNumber = 1;
				if (EN == 3) eventNumber = 65535;
                for (D1 = 1; D1 < 4; D1++) {
                    if (D1 == 1) data1 = 0;
                    if (D1 == 2) data1 = 1;
                    if (D1 == 3) data1 = 255;
                    for (D2 = 1; D2 < 4; D2++) {
                        if (D2 == 1) data2 = 0;
                        if (D2 == 2) data2 = 1;
                        if (D2 == 3) data2 = 255;
                        for (D3 = 1; D3 < 4; D3++) {
                            if (D3 == 1) data3 = 0;
                            if (D3 == 2) data3 = 1;
                            if (D3 == 3) data3 = 255;
                            testCases.push({'nodeNumber':nodeNumber,
                                            'eventNumber':eventNumber,
                                            'data1':data1,
                                            'data2':data2,
                                            'data3':data3})
                        }
                    }
                }
            }
        }
		return testCases;
    }        


    // F0 ACON3
    //
	itParam("ACON3 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3}",
        GetTestCase_ACONF3(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ACON3 test ' + JSON.stringify(value)});
            expected = ":SB780NF0" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + ";";
            var encode = cbusLib.encodeACON3(value.nodeNumber, value.eventNumber, value.data1, value.data2, value.data3);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ACON3 encode ' + encode});
            winston.info({message: 'cbusMessage test: ACON3 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
            expect(decode.data3).to.equal(value.data3, 'data3');
            expect(decode.mnemonic).to.equal('ACON3', 'mnemonic');
            expect(decode.opCode).to.equal('F0', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // F1 ACOF3
    //
	itParam("ACOF3 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3}",
        GetTestCase_ACONF3(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ACOF3 test ' + JSON.stringify(value)});
            expected = ":SB780NF1" + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + ";";
            var encode = cbusLib.encodeACOF3(value.nodeNumber, value.eventNumber, value.data1, value.data2, value.data3);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ACOF3 encode ' + encode});
            winston.info({message: 'cbusMessage test: ACOF3 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
            expect(decode.data3).to.equal(value.data3, 'data3');
            expect(decode.mnemonic).to.equal('ACOF3', 'mnemonic');
            expect(decode.opCode).to.equal('F1', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // F2 ENRSP
    //
	function GetTestCase_ENRSP () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
            for (EV = 1; EV < 4; EV++) {
                if (EV == 1) eventIdentifier = '00000000';
                if (EV == 2) eventIdentifier = '00000001';
                if (EV == 3) eventIdentifier = 'FFFFFFFF';
                for (EVindex = 1; EVindex < 4; EVindex++) {
                    if (EVindex == 1) eventIndex = 0;
                    if (EVindex == 2) eventIndex = 1;
                    if (EVindex == 3) eventIndex = 255;
					testCases.push({'nodeNumber':nodeNumber, 'eventIdentifier':eventIdentifier, 'eventIndex':eventIndex});
				}
			}
		}
		return testCases;
	}

	itParam("ENRSP test nodeNumber ${value.nodeNumber} eventIdentifier ${value.eventIdentifier} eventIndex ${value.eventIndex}", GetTestCase_ENRSP(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN ENRSP test ' + JSON.stringify(value)});
        // ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
		expected = ":SB780NF2" + decToHex(value.nodeNumber, 4) + value.eventIdentifier + decToHex(value.eventIndex, 2) + ";";
        var encode = cbusLib.encodeENRSP(value.nodeNumber, value.eventIdentifier, value.eventIndex);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ENRSP encode ' + encode});
		winston.info({message: 'cbusMessage test: ENRSP decode ' + JSON.stringify(decode)});
        expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventIdentifier).to.equal(value.eventIdentifier, 'eventIdentifier');
        expect(decode.eventIndex).to.equal(value.eventIndex, 'eventIndex');
        expect(decode.mnemonic).to.equal('ENRSP', 'mnemonic');
        expect(decode.opCode).to.equal('F2', 'opCode');
        expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
    })


    // F3 ARON3 testcases
    //
	function GetTestCase_ARON3 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                testCases.push({'mnemonic':'ARON3', 
                                                'opCode':'F3', 
                                                'nodeNumber':arg1, 
                                                'eventNumber':arg2, 
                                                'data1':arg3, 
                                                'data2':arg4, 
                                                'data3':arg5}
                                );
                            }
                        }
                    }
                }
		}
		return testCases;
	}


    // F3 ARON3
    //
	itParam("ARON3 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3}", 
        GetTestCase_ARON3(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + ";";
        var encode = cbusLib.encodeARON3(value.nodeNumber, value.eventNumber, value.data1, value.data2, value.data3);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.eventNumber).to.equal(value.eventNumber, 'param2');
        expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
        expect(decode.data1).to.equal(value.data1, 'data1');
        expect(decode.data2).to.equal(value.data2, 'data2');
        expect(decode.data3).to.equal(value.data3, 'data3');
	})


    // F4 AROF3 testcases
    //
	function GetTestCase_AROF3 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                testCases.push({'mnemonic':'AROF3', 
                                                'opCode':'F4', 
                                                'nodeNumber':arg1, 
                                                'eventNumber':arg2, 
                                                'data1':arg3, 
                                                'data2':arg4, 
                                                'data3':arg5}
                                );
                            }
                        }
                    }
                }
		}
		return testCases;
	}


    // F4 AROF3
    //
	itParam("AROF3 test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3}", 
        GetTestCase_AROF3(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + ";";
            var encode = cbusLib.encodeAROF3(value.nodeNumber, value.eventNumber, value.data1, value.data2, value.data3);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            expect(encode).to.equal(expected, 'encode');
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'param2');
            expect(decode.eventIdentifier).to.equal(decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
            expect(decode.data3).to.equal(value.data3, 'data3');
	})


    // F5 EVLRNI testcases
    //
	function GetTestCase_EVLRNI () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                testCases.push({'mnemonic':'EVLRNI', 
                                                'opCode':'F5', 
                                                'nodeNumber':arg1, 
                                                'eventNumber':arg2, 
                                                'eventNumberIndex':arg3, 
                                                'eventVariableIndex':arg4, 
                                                'eventVariableValue':arg5});
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // F5 EVLRNI
    //
	itParam("EVLRNI test nodeNumber ${value.nodeNumber} eventNumber ${value.eventNumber} eventNumberIndex ${value.eventNumberIndex} eventVariableIndex ${value.eventVariableIndex} eventVariableValue ${value.eventVariableValue}", 
        GetTestCase_EVLRNI(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
            expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.eventNumber, 4) + decToHex(value.eventNumberIndex, 2) + decToHex(value.eventVariableIndex, 2) + decToHex(value.eventVariableValue, 2) + ";";
            var encode = cbusLib.encodeEVLRNI(value.nodeNumber, value.eventNumber, value.eventNumberIndex, value.eventVariableIndex, value.eventVariableValue);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
            expect(encode).to.equal(expected, 'encode');
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
            expect(decode.opCode).to.equal(value.opCode, 'opCode');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.eventNumber).to.equal(value.eventNumber, 'eventNumber');
            expect(decode.eventIdentifier).to.equal(expected.substr(9, 8), 'eventIdentifier');
            expect(decode.eventNumberIndex).to.equal(value.eventNumberIndex, 'eventNumberIndex');
            expect(decode.eventVariableIndex).to.equal(value.eventVariableIndex, 'eventVariableIndex');
            expect(decode.eventVariableValue).to.equal(value.eventVariableValue, 'eventVariableValue');
            expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
	})


    // F6  ACDAT testcases
    //
	function GetTestCase_ACDAT () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    testCases.push({'mnemonic':'ACDAT', 
                                                    'opCode':'F6', 
                                                    'nodeNumber':arg1, 
                                                    'data1':arg2, 
                                                    'data2':arg3, 
                                                    'data3':arg4, 
                                                    'data4':arg5, 
                                                    'data5':arg6});
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // F6 ACDAT
    //
	itParam("ACDAT test nodeNumber ${value.nodeNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3} data4 ${value.data4} data5 ${value.data5}", 
    GetTestCase_ACDAT(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + decToHex(value.data4, 2) + decToHex(value.data5, 2) + ";";
        var encode = cbusLib.encodeACDAT(value.nodeNumber, value.data1, value.data2, value.data3, value.data4, value.data5);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.data1).to.equal(value.data1, 'data1');
        expect(decode.data2).to.equal(value.data2, 'data2');
        expect(decode.data3).to.equal(value.data3, 'data3');
        expect(decode.data4).to.equal(value.data4, 'data4');
        expect(decode.data5).to.equal(value.data5, 'data5');
	})


    // F7  ARDAT testcases
    //
	function GetTestCase_ARDAT () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    testCases.push({'mnemonic':'ARDAT', 
                                                    'opCode':'F7', 
                                                    'nodeNumber':arg1, 
                                                    'data1':arg2, 
                                                    'data2':arg3, 
                                                    'data3':arg4, 
                                                    'data4':arg5, 
                                                    'data5':arg6});
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // F7 ARDAT
    //
	itParam("ARDAT test nodeNumber ${value.nodeNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3} data4 ${value.data4} data5 ${value.data5}", 
    GetTestCase_ARDAT(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + decToHex(value.data4, 2) + decToHex(value.data5, 2) + ";";
        var encode = cbusLib.encodeARDAT(value.nodeNumber, value.data1, value.data2, value.data3, value.data4, value.data5);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.data1).to.equal(value.data1, 'data1');
        expect(decode.data2).to.equal(value.data2, 'data2');
        expect(decode.data3).to.equal(value.data3, 'data3');
        expect(decode.data4).to.equal(value.data4, 'data4');
        expect(decode.data5).to.equal(value.data5, 'data5');
	})


    // F8/F9 ASON3 & ASOF3 test cases
    //
	function GetTestCase_ASONF3 () {
		var testCases = [];
		for (NN = 1; NN < 4; NN++) {
			if (NN == 1) nodeNumber = 0;
			if (NN == 2) nodeNumber = 1;
			if (NN == 3) nodeNumber = 65535;
			for (DN = 1; DN < 4; DN++) {
				if (DN == 1) deviceNumber = 0;
				if (DN == 2) deviceNumber = 1;
				if (DN == 3) deviceNumber = 65535;
                for (D1 = 1; D1 < 4; D1++) {
                    if (D1 == 1) data1 = 0;
                    if (D1 == 2) data1 = 1;
                    if (D1 == 3) data1 = 255;
                    for (D2 = 1; D2 < 4; D2++) {
                        if (D2 == 1) data2 = 0;
                        if (D2 == 2) data2 = 1;
                        if (D2 == 3) data2 = 255;
                        for (D3 = 1; D3 < 4; D3++) {
                            if (D3 == 1) data3 = 0;
                            if (D3 == 2) data3 = 1;
                            if (D3 == 3) data3 = 255;
                            testCases.push({'nodeNumber':nodeNumber,
                                            'deviceNumber':deviceNumber,
                                            'data1':data1,
                                            'data2':data2,
                                            'data3':data3})
                        }
                    }
                }
            }
        }
		return testCases;
    }        


    // F8 ASON3
    //
	itParam("ASON3 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3}",
        GetTestCase_ASONF3(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ASON3 test ' + JSON.stringify(value)});
            expected = ":SB780NF8" + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + ";";
            var encode = cbusLib.encodeASON3(value.nodeNumber, value.deviceNumber, value.data1, value.data2, value.data3);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ASON3 encode ' + encode});
            winston.info({message: 'cbusMessage test: ASON3 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
            expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
            expect(decode.data3).to.equal(value.data3, 'data3');
            expect(decode.mnemonic).to.equal('ASON3', 'mnemonic');
            expect(decode.opCode).to.equal('F8', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // F9 ASOF3
    //
	itParam("ASOF3 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3}",
        GetTestCase_ASONF3(), function (value) {
            winston.info({message: 'cbusMessage test: BEGIN ASOF3 test ' + JSON.stringify(value)});
            expected = ":SB780NF9" + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + ";";
            var encode = cbusLib.encodeASOF3(value.nodeNumber, value.deviceNumber, value.data1, value.data2, value.data3);
            var decode = cbusLib.decode(encode);
            winston.info({message: 'cbusMessage test: ASOF3 encode ' + encode});
            winston.info({message: 'cbusMessage test: ASOF3 decode ' + JSON.stringify(decode)});
            expect(encode).to.equal(expected, 'encode');
            expect(decode.encoded).to.equal(expected, 'encoded');
            expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
            expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
            expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
            expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
            expect(decode.data1).to.equal(value.data1, 'data1');
            expect(decode.data2).to.equal(value.data2, 'data2');
            expect(decode.data3).to.equal(value.data3, 'data3');
            expect(decode.mnemonic).to.equal('ASOF3', 'mnemonic');
            expect(decode.opCode).to.equal('F9', 'opCode');
            expect(decode.text).to.include(decode.mnemonic + ' ', 'text mnemonic');
            expect(decode.text).to.include('(' + decode.opCode + ')', 'text opCode');
	})


    // FA DDES testcases
    //
	function GetTestCase_DDES () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    testCases.push({'mnemonic':'DDES', 
                                                    'opCode':'FA', 
                                                    'deviceNumber':arg1, 
                                                    'data1':arg2, 
                                                    'data2':arg3, 
                                                    'data3':arg4, 
                                                    'data4':arg5, 
                                                    'data5':arg6});
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // FA DDES
    //
	itParam("DDES test deviceNumber ${value.deviceNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3} data4 ${value.data4} data5 ${value.data5}", 
    GetTestCase_DDES(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + decToHex(value.data4, 2) + decToHex(value.data5, 2) + ";";
        var encode = cbusLib.encodeDDES(value.deviceNumber, value.data1, value.data2, value.data3, value.data4, value.data5);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
        expect(decode.data1).to.equal(value.data1, 'data1');
        expect(decode.data2).to.equal(value.data2, 'data2');
        expect(decode.data3).to.equal(value.data3, 'data3');
        expect(decode.data4).to.equal(value.data4, 'data4');
        expect(decode.data5).to.equal(value.data5, 'data5');
	})


    // FB DDRS testcases
    //
	function GetTestCase_DDRS () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    testCases.push({'mnemonic':'DDRS', 
                                                    'opCode':'FB', 
                                                    'deviceNumber':arg1, 
                                                    'data1':arg2, 
                                                    'data2':arg3, 
                                                    'data3':arg4, 
                                                    'data4':arg5, 
                                                    'data5':arg6});
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // FB DDRS
    //
	itParam("DDRS test deviceNumber ${value.deviceNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3} data4 ${value.data4} data5 ${value.data5}", 
    GetTestCase_DDRS(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SA780N" + value.opCode + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + decToHex(value.data4, 2) + decToHex(value.data5, 2) + ";";
        var encode = cbusLib.encodeDDRS(value.deviceNumber, value.data1, value.data2, value.data3, value.data4, value.data5);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
        expect(decode.data1).to.equal(value.data1, 'data1');
        expect(decode.data2).to.equal(value.data2, 'data2');
        expect(decode.data3).to.equal(value.data3, 'data3');
        expect(decode.data4).to.equal(value.data4, 'data4');
        expect(decode.data5).to.equal(value.data5, 'data5');
	})


    // FC Unsupported opCode
    //
	it("Unsupported opCode test",  function () {
		winston.info({message: 'Unsupported opCode test: BEGIN '});
		expected = ":SA780N" + 'FC' + '00000000000000' + ";";
        var decode = cbusLib.decode(expected);
		winston.info({message: 'Unsupported opCode test: decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal('UNSUPPORTED', 'mnemonic');
		expect(decode.opCode).to.equal('FC', 'opCode');
        expect(decode.text).to.include('UNSUPPORTED ', 'text mnemonic');
        expect(decode.text).to.include('(FC)', 'text opcode');
	})


    // FD ARSON3 testcases
    //
	function GetTestCase_ARSON3 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                testCases.push({'mnemonic':'ARSON3', 
                                                'opCode':'FD', 
                                                'nodeNumber':arg1, 
                                                'deviceNumber':arg2, 
                                                'data1':arg3, 
                                                'data2':arg4, 
                                                'data3':arg5});
                            }
                        }
                    }
                }
		}
		return testCases;
	}


    // FD ARSON3
    //
	itParam("ARSON3 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3}", 
    GetTestCase_ARSON3(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + ";";
        var encode = cbusLib.encodeARSON3(value.nodeNumber, value.deviceNumber, value.data1, value.data2, value.data3);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
        expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
        expect(decode.data1).to.equal(value.data1, 'data1');
        expect(decode.data2).to.equal(value.data2, 'data2');
        expect(decode.data3).to.equal(value.data3, 'data3');
	})


    // FE ARSOF3 testcases
    //
	function GetTestCase_ARSOF3 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 65535;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 65535;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                testCases.push({'mnemonic':'ARSOF3', 
                                                'opCode':'FE', 
                                                'nodeNumber':arg1, 
                                                'deviceNumber':arg2, 
                                                'data1':arg3, 
                                                'data2':arg4, 
                                                'data3':arg5});
                            }
                        }
                    }
                }
		}
		return testCases;
	}


    // FE ARSOF3
    //
	itParam("ARSOF3 test nodeNumber ${value.nodeNumber} deviceNumber ${value.deviceNumber} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3}", 
    GetTestCase_ARSOF3(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.nodeNumber, 4) + decToHex(value.deviceNumber, 4) + decToHex(value.data1, 2) + decToHex(value.data2, 2) + decToHex(value.data3, 2) + ";";
        var encode = cbusLib.encodeARSOF3(value.nodeNumber, value.deviceNumber, value.data1, value.data2, value.data3);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
        expect(decode.deviceNumber).to.equal(value.deviceNumber, 'deviceNumber');
        expect(decode.eventIdentifier).to.equal('0000' + decToHex(value.deviceNumber, 4), 'eventIdentifier');        
        expect(decode.data1).to.equal(value.data1, 'data1');
        expect(decode.data2).to.equal(value.data2, 'data2');
        expect(decode.data3).to.equal(value.data3, 'data3');
	})


    // FF EXTC6 testcases
    //
	function GetTestCase_EXTC6 () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
                for (a2 = 1; a2 < 4; a2++) {
                    if (a2 == 1) arg2 = 0;
                    if (a2 == 2) arg2 = 1;
                    if (a2 == 3) arg2 = 255;
                    for (a3 = 1; a3 < 4; a3++) {
                        if (a3 == 1) arg3 = 0;
                        if (a3 == 2) arg3 = 1;
                        if (a3 == 3) arg3 = 255;
                        for (a4 = 1; a4 < 4; a4++) {
                            if (a4 == 1) arg4 = 0;
                            if (a4 == 2) arg4 = 1;
                            if (a4 == 3) arg4 = 255;
                            for (a5 = 1; a5 < 4; a5++) {
                                if (a5 == 1) arg5 = 0;
                                if (a5 == 2) arg5 = 1;
                                if (a5 == 3) arg5 = 255;
                                for (a6 = 1; a6 < 4; a6++) {
                                    if (a6 == 1) arg6 = 0;
                                    if (a6 == 2) arg6 = 1;
                                    if (a6 == 3) arg6 = 255;
                                    for (a7 = 1; a7 < 4; a7++) {
                                        if (a7 == 1) arg7 = 0;
                                        if (a7 == 2) arg7 = 1;
                                        if (a7 == 3) arg7 = 255;
                                        testCases.push({'mnemonic':'EXTC6', 
                                                        'opCode':'FF', 
                                                        'Ext_OPC':arg1, 
                                                        'byte1':arg2, 
                                                        'byte2':arg3, 
                                                        'byte3':arg4, 
                                                        'byte4':arg5, 
                                                        'byte5':arg6,
                                                        'byte6':arg7,
                                        })
                                    }
                                }
                            }
                        }
                    }
                }
		}
		return testCases;
	}

    // FF EXTC6
    //
	itParam("EXTC6 test Ext_OPC ${value.Ext_OPC} byte1 ${value.byte1} byte2 ${value.byte2} byte3 ${value.byte3} byte4 ${value.byte4} byte5 ${value.byte5} byte6 ${value.byte6}", 
    GetTestCase_EXTC6(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN '  + value.mnemonic +' test ' + JSON.stringify(value)});
		expected = ":SB780N" + value.opCode + decToHex(value.Ext_OPC, 2) + decToHex(value.byte1, 2) + decToHex(value.byte2, 2) + decToHex(value.byte3, 2) + decToHex(value.byte4, 2) + decToHex(value.byte5, 2) + decToHex(value.byte6, 2) + ";";
        var encode = cbusLib.encodeEXTC6(value.Ext_OPC, value.byte1, value.byte2, value.byte3, value.byte4, value.byte5, value.byte6);
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' encode ' + encode});
		winston.info({message: 'cbusMessage test: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
		expect(encode).to.equal(expected, 'encode');
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
		expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
		expect(decode.opCode).to.equal(value.opCode, 'opCode');
        expect(decode.text).to.include(value.mnemonic + ' ', 'text mnemonic');
        expect(decode.text).to.include('(' + value.opCode + ')', 'text opCode');
        expect(decode.Ext_OPC).to.equal(value.Ext_OPC, 'Ext_OPC');
        expect(decode.byte1).to.equal(value.byte1, 'byte1');
        expect(decode.byte2).to.equal(value.byte2, 'byte2');
        expect(decode.byte3).to.equal(value.byte3, 'byte3');
        expect(decode.byte4).to.equal(value.byte4, 'byte4');
        expect(decode.byte5).to.equal(value.byte5, 'byte5');
        expect(decode.byte6).to.equal(value.byte6, 'byte6');
	})


//
// Extended ID messages
//

    // PUT CONTROL
    //
	function GetTestCase_PUT_CONTROL () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = '000000';
			if (a1 == 2) arg1 = '000001';
			if (a1 == 3) arg1 = 'FFFFFF';
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 255;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    for (a4 = 1; a4 < 4; a4++) {
                        if (a4 == 1) arg4 = 0;
                        if (a4 == 2) arg4 = 1;
                        if (a4 == 3) arg4 = 255;
                        for (a5 = 1; a5 < 4; a5++) {
                            if (a5 == 1) arg5 = 0;
                            if (a5 == 2) arg5 = 1;
                            if (a5 == 3) arg5 = 255;
                            testCases.push({'address':arg1, 
                                'CTLBT':arg2, 
                                'SPCMD':arg3, 
                                'CPDTL':arg4, 
                                'CPDTH':arg5});
                        }
                    }
                }
            }
		}
		return testCases;
	}

    // EXT_PUT_CONTROL test
    //
	itParam("EXT_PUT_CONTROL test address ${value.address} CTLBT ${value.CTLBT} SPCMD ${value.SPCMD} CPDTL ${value.CPDTL} CPDTH ${value.CPDTH}", 
        GetTestCase_PUT_CONTROL(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN EXT_PUT_CONTROL test ' + JSON.stringify(value)});
		expected = ":X00080000N" + value.address.substr(4, 2) + value.address.substr(2, 2) + value.address.substr(0, 2) + 
            '00' +                          // RESVD - not used, always set to 0
            decToHex(value.CTLBT, 2) + 
            decToHex(value.SPCMD, 2) + 
            decToHex(value.CPDTL, 2) + 
            decToHex(value.CPDTH, 2) + ";";
        var encode = cbusLib.encode_EXT_PUT_CONTROL(value.address, value.CTLBT, value.SPCMD, value.CPDTL, value.CPDTH);
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: encode ' + encode});
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: decode ' + decode.text});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('X', 'ID_TYPE');
		expect(decode.operation).to.equal('PUT', 'operation');
		expect(decode.type).to.equal('CONTROL', 'type');
        expect(decode.address).to.equal(value.address, 'address');
        expect(decode.RESVD).to.equal(0, 'RESVD');
        expect(decode.CTLBT).to.equal(value.CTLBT, 'CTLBT');
        expect(decode.SPCMD).to.equal(value.SPCMD, 'SPCMD');
        expect(decode.CPDTL).to.equal(value.CPDTL, 'CPDTL');
        expect(decode.CPDTH).to.equal(value.CPDTH, 'CPDTH');
        expect(decode.text).to.include('PUT', 'text operation');
        expect(decode.text).to.include('CONTROL', 'text type');
        // ok - try encoding the decode, to see if we still get the expected encode
        var encode2 = cbusLib.encode(decode);
		winston.info({message: 'cbusMessage test: encode2 ' + JSON.stringify(encode2)});
		expect(encode2.encoded).to.equal(expected, 'encoded');
    })


    // PUT DATA
    //
	function GetTestCase_PUT_DATA () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
            for (a2 = 1; a2 < 4; a2++) {
                if (a2 == 1) arg2 = 0;
                if (a2 == 2) arg2 = 1;
                if (a2 == 3) arg2 = 255;
                for (a3 = 1; a3 < 4; a3++) {
                    if (a3 == 1) arg3 = 0;
                    if (a3 == 2) arg3 = 1;
                    if (a3 == 3) arg3 = 255;
                    for (a4 = 1; a4 < 4; a4++) {
                        if (a4 == 1) arg4 = 0;
                        if (a4 == 2) arg4 = 1;
                        if (a4 == 3) arg4 = 255;
                        for (a5 = 1; a5 < 4; a5++) {
                            if (a5 == 1) arg5 = 0;
                            if (a5 == 2) arg5 = 1;
                            if (a5 == 3) arg5 = 255;
                            for (a6 = 1; a6 < 4; a6++) {
                                if (a6 == 1) arg6 = 0;
                                if (a6 == 2) arg6 = 1;
                                if (a6 == 3) arg6 = 255;
                                for (a7 = 1; a7 < 4; a7++) {
                                    if (a7 == 1) arg7 = 0;
                                    if (a7 == 2) arg7 = 1;
                                    if (a7 == 3) arg7 = 255;
                                    for (a8 = 1; a8 < 4; a8++) {
                                        if (a8 == 1) arg8 = 0;
                                        if (a8 == 2) arg8 = 1;
                                        if (a8 == 3) arg8 = 255;
                                        testCases.push({'data0':arg1, 
                                            'data1':arg2, 
                                            'data2':arg3, 
                                            'data3':arg4, 
                                            'data4':arg5, 
                                            'data5':arg6, 
                                            'data6':arg7, 
                                            'data7':arg8});
                                    }
                                }
                            }
                        }
                    }
                }
            }
		}
		return testCases;
	}

    // EXT_PUT_DATA test
    //
	itParam("EXT_PUT_DATA test data0 ${value.data0} data1 ${value.data1} data2 ${value.data2} data3 ${value.data3} data4 ${value.data4} data5 ${value.data5} data6 ${value.data6} data7 ${value.data7}", 
        GetTestCase_PUT_DATA(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN EXT_PUT_DATA test ' + JSON.stringify(value)});
		expected = ":X00080001N" + 
            decToHex(value.data0, 2) + 
            decToHex(value.data1, 2) + 
            decToHex(value.data2, 2) + 
            decToHex(value.data3, 2) + 
            decToHex(value.data4, 2) + 
            decToHex(value.data5, 2) + 
            decToHex(value.data6, 2) + 
            decToHex(value.data7, 2) + ";";
        var testData = [value.data0, value.data1, value.data2, value.data3, value.data4, value.data5, value.data6, value.data7]
        var encode = cbusLib.encode_EXT_PUT_DATA(testData);
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: encode ' + encode});
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: decode ' + decode.text});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('X', 'ID_TYPE');
		expect(decode.operation).to.equal('PUT', 'operation');
		expect(decode.type).to.equal('DATA', 'type');
        expect(decode.text).to.include('PUT', 'text operation');
        expect(decode.text).to.include('DATA', 'text type');
        // ok - try encoding the decode, to see if we still get the expected encode
        var encode2 = cbusLib.encode(decode);
		winston.info({message: 'cbusMessage test: encode2 ' + JSON.stringify(encode2)});
		expect(encode2.encoded).to.equal(expected, 'encoded');
    })


    // EXT_RESPONSE
    //
	function GetTestCase_EXT_RESPONSE () {
		var testCases = [];
		for (a1 = 1; a1 < 4; a1++) {
			if (a1 == 1) arg1 = 0;
			if (a1 == 2) arg1 = 1;
			if (a1 == 3) arg1 = 255;
            testCases.push({'response':arg1});
		}
		return testCases;
	}


    // EXT_RESPONSE test
    //
	itParam("EXT_RESPONSE test response ${value.response}", GetTestCase_EXT_RESPONSE(), function (value) {
		winston.info({message: 'cbusMessage test: BEGIN EXT_RESPONSE test ' + JSON.stringify(value)});
		expected = ":X80080000N" + decToHex(value.response, 2) + ";";
        var encode = cbusLib.encode_EXT_RESPONSE(value.response);
		expect(encode).to.equal(expected, 'encode');
		winston.info({message: 'cbusMessage test: encode ' + encode});
        var decode = cbusLib.decode(encode);
		winston.info({message: 'cbusMessage test: decode ' + decode.text});
		expect(decode.encoded).to.equal(expected, 'encoded');
		expect(decode.ID_TYPE).to.equal('X', 'ID_TYPE');
		expect(decode.operation).to.equal('RESPONSE', 'operation');
		expect(decode.response).to.equal(value.response, 'response');
        // ok - try encoding the decode, to see if we still get the expected encode
        var encode2 = cbusLib.encode(decode);
		winston.info({message: 'cbusMessage test: encode2 ' + JSON.stringify(encode2)});
		expect(encode2.encoded).to.equal(expected, 'encoded');
    })


})

