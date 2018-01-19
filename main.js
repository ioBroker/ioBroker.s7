/* jshint -W097 */// jshint strict:false
/* jslint node: true */

'use strict';

var utils     = require(__dirname + '/lib/utils');
var adapter   = new utils.Adapter('s7');
var async     = require('async');
var snap7     = require('node-snap7');
var s7client  = snap7 ? new snap7.S7Client() : null;
var connected = false;
var iconvFrom;
var iconvTo;
var iconvToL;
var encoding = 'iso-8859-1';

/*try {
    var Iconv  = require('iconv').Iconv;
    iconvFrom  = new Iconv(encoding, 'UTF-8');
    iconvTo    = new Iconv('UTF-8', encoding);
} catch (e)*/ {
    iconvFrom = null;
    iconvTo   = null;
    iconvToL  = require('iconv-lite');
}

var nextPoll;
var ackObjects = {};

process.on('SIGINT', function () {
    if (adapter && adapter.setState) {
        adapter.setState('info.connection', false, true);
        adapter.setState('info.pdu',        '',    true);
        adapter.setState('info.poll_time',  '',    true);
    }
    if (nextPoll)  {
        clearTimeout(nextPoll);
    }
});

adapter.on('ready', function () {
    adapter.setState('info.connection', false, true);
    main.main();
});

var pulseList  = {};
var sendBuffer = {};
var objects    = {};
var enums      = {};
var infoRegExp = new RegExp(adapter.namespace.replace(/\./g, '\\.') + '\\.info\\.');

var errorCodes = {
    0x00000001: 'errTCPSocketCreation',
    0x00000002: 'errTCPConnectionTimeout',
    0x00000003: 'errTCPConnectionFailed',
    0x00000004: 'errTCPReceiveTimeout',
    0x00000005: 'errTCPDataReceive',
    0x00000006: 'errTCPSendTimeout',
    0x00000007: 'errTCPDataSend',
    0x00000008: 'errTCPConnectionReset',
    0x00000009: 'errTCPNotConnected',
    0x00002751: 'errTCPUnreachableHost',
    0x00010000: 'errIsoConnect',
    0x00030000: 'errIsoInvalidPDU',
    0x00040000: 'errIsoInvalidDataSize',
    0x00100000: 'errCliNegotiatingPDU',
    0x00200000: 'errCliInvalidParams',
    0x00300000: 'errCliJobPending',
    0x00400000: 'errCliTooManyItems',
    0x00500000: 'errCliInvalidWordLen',
    0x00600000: 'errCliPartialDataWritten',
    0x00700000: 'errCliSizeOverPDU',
    0x00800000: 'errCliInvalidPlcAnswer',
    0x00900000: 'errCliAddressOutOfRange',
    0x00A00000: 'errCliInvalidTransportSize',
    0x00B00000: 'errCliWriteDataSizeMismatch',
    0x00C00000: 'errCliItemNotAvailable',
    0x00D00000: 'errCliInvalidValue',
    0x00E00000: 'errCliCannotStartPLC',
    0x00F00000: 'errCliAlreadyRun',
    0x01000000: 'errCliCannotStopPLC',
    0x01100000: 'errCliCannotCopyRamToRom',
    0x01200000: 'errCliCannotCompress',
    0x01300000: 'errCliAlreadyStop',
    0x01400000: 'errCliFunNotAvailable',
    0x01500000: 'errCliUploadSequenceFailed',
    0x01600000: 'errCliInvalidDataSizeRecvd',
    0x01700000: 'errCliInvalidBlockType',
    0x01800000: 'errCliInvalidBlockNumber',
    0x01900000: 'errCliInvalidBlockSize',
    0x01D00000: 'errCliNeedPassword',
    0x01E00000: 'errCliInvalidPassword',
    0x01F00000: 'errCliNoPasswordToSetOrClear',
    0x02000000: 'errCliJobTimeout',
    0x02100000: 'errCliPartialDataRead',
    0x02200000: 'errCliBufferTooSmall',
    0x02300000: 'errCliFunctionRefused',
    0x02400000: 'errCliDestroying',
    0x02500000: 'errCliInvalidParamNumber',
    0x02600000: 'errCliCannotChangeParam',
    0x02700000: 'errCliFunctionNotImplemented'
};

var sysErrors = {
    10004: 'EINTR',
    10009: 'EBADF',
    10013: 'EACCES',
    10014: 'EFAULT',
    10022: 'EINVAL',
    10024: 'EMFILE',
    10035: 'EWOULDBLOCK',
    10036: 'EINPROGRESS',
    10037: 'EALREADY',
    10038: 'ENOTSOCK',
    10039: 'EDESTADDRREQ',
    10040: 'EMSGSIZE',
    10041: 'EPROTOTYPE',
    10042: 'ENOPROTOOPT',
    10043: 'EPROTONOSUPPORT',
    10044: 'ESOCKTNOSUPPORT',
    10045: 'EOPNOTSUPP',
    10046: 'EPFNOSUPPORT',
    10047: 'EAFNOSUPPORT',
    10048: 'EADDRINUSE',
    10049: 'EADDRNOTAVAIL',
    10050: 'ENETDOWN',
    10051: 'ENETUNREACH',
    10052: 'ENETRESET',
    10053: 'ECONNABORTED',
    10054: 'ECONNRESET',
    10055: 'ENOBUFS',
    10056: 'EISCONN',
    10057: 'ENOTCONN',
    10058: 'ESHUTDOWN',
    10059: 'ETOOMANYREFS',
    10060: 'ETIMEDOUT',
    10061: 'ECONNREFUSED',
    10062: 'ELOOP',
    10063: 'ENAMETOOLONG',
    10064: 'EHOSTDOWN',
    10065: 'EHOSTUNREACH',
    10091: 'SYSNOTREADY',
    10092: 'VERNOTSUPPORTED',
    10093: 'NOTINITIALISED',
    11001: 'HOST_NOT_FOUND',
    11002: 'TRY_AGAIN',
    11003: 'NO_RECOVERY',
    11004: 'NO_DATA'
};

adapter.on('stateChange', function (id, state) {
    if (state && !state.ack && id && !infoRegExp.test(id)) {
        if (objects[id]) {
            prepareWrite(id, state);
        } else {
            adapter.getObject(id, function (err, data) {
                if (!err) {
                    objects[id] = data;
                    prepareWrite(id, state);
                }
            });
        }
    }
});

function writeHelper(id, state) {
    sendBuffer[id] = state.val;

    if (Object.keys(sendBuffer).length === 1) {
        send();
    }
}

function prepareWrite(id, state) {
    if (objects[id].native.rw) {

        if (!objects[id].native.wp) {

            writeHelper(id, state);
            setTimeout(function () {
                adapter.setState(id, ackObjects[id.substring(adapter.namespace.length + 1)].val, true);
            }, main.acp.poll * 1.5);

        } else {
            if (pulseList[id] === undefined) {
                var _id = id.substring(adapter.namespace.length + 1);
                pulseList[id] = ackObjects[_id] ? ackObjects[_id].val : !state.val;

                setTimeout(function () {
                    writeHelper(id, {val: pulseList[id]});

                    setTimeout(function () {
                        if (ackObjects[_id]) {
                            adapter.setState(id, ackObjects[_id].val, true);
                        }
                        delete pulseList[id];
                    }, main.acp.poll * 1.5);

                }, main.acp.pulsetime);

                writeHelper(id, state);
            }
        }
    } else {
        setTimeout(function () {
            adapter.setState(id, ackObjects[id.substring(adapter.namespace.length + 1)].val, true);
        }, 0);
    }
}

function send() {

    var id = Object.keys(sendBuffer)[0];

    var type = objects[id].native.type;
    var val  = sendBuffer[id];
    var data = objects[id];

    if (!s7client) {
        return next('s7client not exists');
    }
    var buf;

    if (type === 'BOOL') {
        if (val === true || val === 1 || val === 'true' || val === '1') {
            buf = new Buffer([1]);
        } else {
            buf = new Buffer([0]);
        }

    } else if (type === 'BYTE') {
        buf = new Buffer(1);
        buf[0] = parseInt(val, 10) & 0xFF;

    } else if (type === 'WORD') {
        val = parseInt(val, 10);
        buf = new Buffer(2);
        buf.writeUInt16BE(parseInt(val, 10), 0, 2);

    } else if (type === 'DWORD') {
        buf = new Buffer(4);
        buf.writeUInt32BE(parseInt(val, 10), 0, 4);

    } else if (type === 'INT') {
        buf = new Buffer(2);
        buf.writeInt16BE(parseInt(val, 10), 0, 2);

    } else if (type === 'DINT') {
        buf = new Buffer(4);
        buf.writeInt32BE(parseInt(val, 10), 0, 4);

    } else if (type === 'REAL') {
        buf = new Buffer(4);
        buf.writeFloatBE(parseFloat(val), 0);
    } else if (type === 'STRING' || type === 'ARRAY') {

        if (typeof val === 'string' && val[0] === '{') {
            try {
                val = JSON.parse(val);
            } catch (err) {

            }
        }
        buf = new Buffer(data.native.len);
        if ((iconvTo || iconvToL) && type === 'STRING' && typeof val === 'string') {
            var buffer1 = iconvTo ? iconvTo.convert(val) : iconvToL.encode(val, encoding);
            buffer1.copy(buf, 0, 0, buffer1.byteLength > data.native.len ? data.native.len : buffer1.byteLength);
        } else {

            var s1;
            for (s1 = 0; s1 < val.length && s1 < data.native.len; s1++) {
                buf[s1] = val[s1];
            }
            // zero end string
            if (type === 'STRING') {
                if (s1 >= data.native.len) s1--;
                buf[s1] = 0;
            }
        }
    } else if (type === 'S7STRING') {
        buf = new Buffer(data.native.len + 2);
        buf[0] = data.native.len;
        if ((iconvTo || iconvToL) && typeof val === 'string') {
            var buffer2 = iconvTo ? iconvTo.convert(val) : iconvToL.encode(val, encoding);
            buffer2.copy(buf, 2, 0, buffer2.byteLength > data.native.len ? data.native.len : buffer2.byteLength);
            if (buffer2.byteLength < data.native.len) {
                // zero end
                buf[2 + buffer2.byteLength] = 0;
            }
            buf[1] = buffer2.byteLength;
        } else {
            var s2;
            for (s2 = 0; s2 < val.length && s2 < data.native.len; s2++) {
                buf[s2 + 2] = val[s2];
            }
            // zero end string
            if (s2 < data.native.len - 1) {
                buf[s2] = 0;
            }
            buf[1] = s2;
        }
    }

    var addr;

    if (data.native.cat === 'db') {

        if (type === 'BOOL') {
            addr = data.native.address * 8 + data.native.offsetBit;
            s7client.WriteArea(s7client.S7AreaDB, data.native.dbId, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err);
            });
        } else if (type === 'BYTE') {
            s7client.DBWrite(data.native.dbId, data.native.address, 1, buf, function (err) {
                next(err);
            });
        } else if (type === 'INT' || type === 'WORD') {
            s7client.DBWrite(data.native.dbId, data.native.address, 2, buf, function (err) {
                next(err);
            });
        } else if (type === 'REAL' || type === 'DINT' || type === 'DWORD') {
            s7client.DBWrite(data.native.dbId, data.native.address, 4, buf, function (err) {
                next(err);
            });
        } else if (type === 'STRING' || type === 'ARRAY' || type === 'S7STRING') {
            s7client.DBWrite(data.native.dbId, data.native.address, data.native.len, buf, function (err) {
                next(err);
            });
        }
    }

    if (data.native.cat === 'input') {
        if (type === 'BOOL') {
            addr = data.native.address * 8 + data.native.offsetBit;
            s7client.WriteArea(s7client.S7AreaPE, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err);
            });
        } else if (type === 'BYTE') {
            s7client.EBWrite(data.native.address, data.native.address, 1, buf, function (err) {
                next(err);
            });
        } else if (type === 'INT' || type === 'WORD') {
            s7client.EBWrite(data.native.address, data.native.address, 2, buf, function (err) {
                next(err);
            });
        } else if (type === 'REAL' || type === 'DINT' || type === 'DWORD') {
            s7client.EBWrite(data.native.address, data.native.address, 4, buf, function (err) {
                next(err);
            });
        } else if (type === 'STRING' || type === 'ARRAY' || type === 'S7STRING') {
            s7client.EBWrite(data.native.address, data.native.address, data.native.len, buf, function (err) {
                next(err);
            });
        }
    }
    if (data.native.cat === 'output') {

        if (type === 'BOOL') {
            addr = data.native.address * 8 + data.native.offsetBit;
            s7client.WriteArea(s7client.S7AreaPA, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err);
            });
        } else if (type === 'BYTE') {
            s7client.ABWrite(data.native.address, data.native.address, 1, buf, function (err) {
                next(err);
            });
        } else if (type === 'INT' || type === 'WORD') {
            s7client.ABWrite(data.native.address, data.native.address, 2, buf, function (err) {
                next(err);
            });
        } else if (type === 'REAL' || type === 'DINT' || type === 'DWORD') {
            s7client.ABWrite(data.native.address, data.native.address, 4, buf, function (err) {
                next(err);
            });
        } else if (type === 'STRING' || type === 'ARRAY' || type === 'S7STRING') {
            s7client.ABWrite(data.native.address, data.native.address, data.native.len, buf, function (err) {
                next(err);
            });
        }
    }
    if (data.native.cat === 'marker') {

        if (type === 'BOOL') {
            addr = data.native.address * 8 + data.native.offsetBit;
            s7client.WriteArea(s7client.S7AreaMK, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err);
            });
        } else if (type === 'BYTE') {
            s7client.MBWrite(data.native.address, 1, buf, function (err) {
                next(err);
            });
        } else if (type === 'INT' || type === 'WORD') {
            s7client.MBWrite(data.native.address, 2, buf, function (err) {
                next(err);
            });
        } else if (type === 'REAL' || type === 'DINT' || type === 'DWORD') {
            s7client.MBWrite(data.native.address, 4, buf, function (err) {
                next(err);
            });
        } else if (type === 'STRING' || type === 'ARRAY' || type === 'S7STRING') {
            s7client.MBWrite(data.native.address, data.native.len, buf, function (err) {
                next(err);
            });
        }
    }

    function next(err) {
        if (err) {
            adapter.log.error('DB write error. Code #' + err);
        }
        delete(sendBuffer[id]);
        if (Object.keys(sendBuffer).length) {
            send();
        }
    }
}

function addToEnum(enumName, id, callback) {
    adapter.getForeignObject(enumName, function (err, obj) {
        if (!err && obj) {
            var pos = obj.common.members.indexOf(id);
            if (pos === -1) {
                obj.common.members.push(id);
                adapter.setForeignObject(obj._id, obj, function (err) {
                    if (callback) callback(err);
                });
            } else {
                if (callback) callback(err);
            }
        } else {
            if (callback) callback(err);
        }
    });
}

function removeFromEnum(enumName, id, callback) {
    adapter.getForeignObject(enumName, function (err, obj) {
        if (!err && obj) {
            var pos = obj.common.members.indexOf(id);
            if (pos !== -1) {
                obj.common.members.splice(pos, 1);
                adapter.setForeignObject(obj._id, obj, function (err) {
                    if (callback) callback(err);
                });
            } else {
                if (callback) callback(err);
            }
        } else {
            if (callback) callback(err);
        }
    });
}

function syncEnums(enumGroup, id, newEnumName, callback) {
    if (!enums[enumGroup]) {
        adapter.getEnum(enumGroup, function (err, _enums) {
            enums[enumGroup] = _enums;
            syncEnums(enumGroup, id, newEnumName, callback);
        });
        return;
    }
    // try to find this id in enums
    var found = false;
    for (var e in enums[enumGroup]) {
        if (enums[enumGroup].hasOwnProperty(e)) {
            if (enums[enumGroup][e].common &&
                enums[enumGroup][e].common.members &&
                enums[enumGroup][e].common.members.indexOf(id) !== -1) {
                if (enums[enumGroup][e]._id !== newEnumName) {
                    removeFromEnum(enums[enumGroup][e]._id, id);
                } else {
                    found = true;
                }
            }
        }
    }
    if (!found && newEnumName) {
        addToEnum(newEnumName, id);
    }
}

function createExtendObject(id, objData, callback) {
    adapter.getObject(id, function (err, oldObj) {
        if (!err && oldObj) {
            adapter.extendObject(id, objData, callback);
        } else {
            adapter.setObjectNotExists(id, objData, callback);
        }
    });
}

function isDST(time) {
    var jan = new Date(time.getFullYear(), 0, 1);
    var jul = new Date(time.getFullYear(), 6, 1);
    return Math.min(jan.getTimezoneOffset(), jul.getTimezoneOffset()) - time.getTimezoneOffset();
}

var convertS7type = {
    BOOL:       'boolean',
    BYTE:       'number',
    WORD:       'number',
    DWORD:      'number',
    INT:        'number',
    DINT:       'number',
    STRING:     'string',
    S7STRING:   'string',
    S5TIME:     'number',
    ARRAY:      'array',
    S7TIME:     'number'
};

var main = {
    old_objects: [],
    new_objects: [],
    round:       2,

    inputs:      [],
    input_lsb:   '',
    input_msb:   '',
    input_size:  '',

    outputs:     [],
    output_lsb:  '',
    output_msb:  '',
    output_size: '',

    markers:     [],
    marker_lsb:  '',
    marker_msb:  '',
    marker_size: '',

    dbs:         [],
    db_size:     {},
    _db_size:    [],

    unit:        '',
    error_count: 0,

    main: function () {

        main.ac        = adapter.config;
        main.acp       = adapter.config.params;
        main.acp.poll  = parseInt(main.acp.poll,  10) || 1000; // default is 1 second
        main.acp.rack  = parseInt(main.acp.rack,  10) || 0;
        main.acp.slot  = parseInt(main.acp.slot,  10) || 2;
        main.acp.recon = parseInt(main.acp.recon, 10) || 60000;

        if (main.acp.round) {
            main.round = parseInt(main.acp.round, 10) || 2;
        } else {
            main.round = 2;
        }

        main.round = Math.pow(10, main.round);

        main.acp.pulsetime  = parseInt(main.acp.pulsetime, 10) || 1000;
        main.acp.timeOffset = parseInt(main.acp.timeOffset, 10) || 0;

        adapter.getForeignObjects(adapter.namespace + '.*', function (err, list) {

            main.old_objects = list;

            main.ac.inputs.sort(sortByAddress);
            main.ac.outputs.sort(sortByAddress);
            main.ac.markers.sort(sortByAddress);
            main.ac.dbs.sort(sortByAddress);

            var parts;
            var i;

            if (main.ac.inputs.length > 0) {
                for (i = main.ac.inputs.length - 1; i >= 0; i--) {
                    main.ac.inputs[i].Address = main.ac.inputs[i].Address.replace(/\+/g, '');
                    parts = main.ac.inputs[i].Address.split('.');
                    main.ac.inputs[i].offsetByte = parseInt(parts[0], 10);
                    main.ac.inputs[i].offsetBit  = parseInt(parts[1] || 0, 10);
                    main.ac.inputs[i].id = 'Inputs.' + main.ac.inputs[i].offsetByte + '.' + (main.ac.inputs[i].Name.replace(/[.\s]+/g, '_') || main.ac.inputs[i].offsetBit);

                    main.ac.inputs[i].len = 1;
                    if (main.ac.inputs[i].Type === 'WORD'  || main.ac.inputs[i].Type === 'INT'  || main.ac.inputs[i].Type === 'S5TIME') {
                        main.ac.inputs[i].len = 2;
                    } else
                    if (main.ac.inputs[i].Type === 'DWORD' || main.ac.inputs[i].Type === 'DINT' || main.ac.inputs[i].Type === 'REAL') {
                        main.ac.inputs[i].len = 4;
                    } else
                    if (main.ac.inputs[i].Type === 'S7TIME') {
                        main.ac.inputs[i].len = 8;
                    } else
                    if (main.ac.inputs[i].Type === 'ARRAY' || main.ac.inputs[i].Type === 'STRING' || main.ac.inputs[i].Type === 'S7STRING') {
                        main.ac.inputs[i].len = parseInt(main.ac.inputs[i].Length, 10);
                    }
                }
                main.input_lsb  = main.ac.inputs[0].offsetByte;
                main.input_msb  = main.ac.inputs[main.ac.inputs.length - 1].offsetByte + main.ac.inputs[main.ac.inputs.length - 1].len;
                main.input_size = main.input_msb - main.input_lsb;
            }

            if (main.ac.outputs.length > 0) {
                for (i = main.ac.outputs.length - 1; i >= 0; i--) {
                    main.ac.outputs[i].Address = main.ac.outputs[i].Address.replace(/\+/g, '');
                    parts = main.ac.outputs[i].Address.split('.');
                    main.ac.outputs[i].offsetByte = parseInt(parts[0], 10);
                    main.ac.outputs[i].offsetBit  = parseInt(parts[1] || 0, 10);
                    main.ac.outputs[i].id = 'Outputs.' + main.ac.outputs[i].offsetByte + '.' + (main.ac.outputs[i].Name.replace(/[.\s]+/g, '_') || main.ac.outputs[i].offsetBit);

                    main.ac.outputs[i].len = 1;
                    if (main.ac.outputs[i].Type === 'WORD'  || main.ac.outputs[i].Type === 'INT'  || main.ac.outputs[i].Type === 'S5TIME') {
                        main.ac.outputs[i].len = 2;
                    } else
                    if (main.ac.outputs[i].Type === 'DWORD' || main.ac.outputs[i].Type === 'DINT' || main.ac.outputs[i].Type === 'REAL') {
                        main.ac.outputs[i].len = 4;
                    } else
                    if (main.ac.outputs[i].Type === 'S7TIME') {
                        main.ac.outputs[i].len = 8;
                    } else
                    if (main.ac.outputs[i].Type === 'ARRAY' || main.ac.outputs[i].Type === 'STRING' || main.ac.outputs[i].Type === 'S7STRING') {
                        main.ac.outputs[i].len = parseInt(main.ac.outputs[i].Length, 10);
                    }
                }
                main.output_lsb  = main.ac.outputs[0].offsetByte;
                main.output_msb  = main.ac.outputs[main.ac.outputs.length - 1].offsetByte + main.ac.outputs[main.ac.outputs.length - 1].len;
                main.output_size = main.output_msb - main.output_lsb;
            }

            if (main.ac.markers.length > 0) {
                for (i = main.ac.markers.length - 1; i >= 0; i--) {
                    main.ac.markers[i].Address = main.ac.markers[i].Address.replace(/\+/g, '');
                    parts = main.ac.markers[i].Address.split('.');
                    main.ac.markers[i].offsetByte = parseInt(parts[0], 10);
                    main.ac.markers[i].offsetBit  = parseInt(parts[1] || 0, 10);
                    main.ac.markers[i].id = 'Markers.' + main.ac.markers[i].offsetByte + '.' + (main.ac.markers[i].Name.replace(/[.\s]+/g, '_') || main.ac.markers[i].offsetBit);

                    main.ac.markers[i].len = 1;
                    if (main.ac.markers[i].Type === 'WORD'  || main.ac.markers[i].Type === 'INT'  || main.ac.markers[i].Type === 'S5TIME') {
                        main.ac.markers[i].len = 2;
                    } else
                    if (main.ac.markers[i].Type === 'DWORD' || main.ac.markers[i].Type === 'DINT' || main.ac.markers[i].Type === 'REAL') {
                        main.ac.markers[i].len = 4;
                    } else
                    if (main.ac.markers[i].Type === 'S7TIME') {
                        main.ac.markers[i].len = 8;
                    } else
                    if (main.ac.markers[i].Type === 'ARRAY' || main.ac.markers[i].Type === 'STRING' || main.ac.markers[i].Type === 'S7STRING') {
                        main.ac.markers[i].len = parseInt(main.ac.markers[i].Length, 10);
                    }
                }
                main.marker_lsb  = main.ac.markers[0].offsetByte;
                main.marker_msb  = main.ac.markers[main.ac.markers.length - 1].offsetByte + main.ac.markers[main.ac.markers.length - 1].len;
                main.marker_size = main.marker_msb - main.marker_lsb;
            }

            if (main.ac.dbs.length > 0) {
                for (i = main.ac.dbs.length - 1; i >= 0; i--) {
                    parts = main.ac.dbs[i].Address.split(' ');
                    if (parts.length !== 2) {
                        adapter.log.error('Invalid format of address: ' + main.ac.dbs[i].Address);
                        adapter.log.error('Expected format is: "DB2 4" or "DB2 4.1"');
                        main.ac.dbs.splice(i, 1);
                        continue;
                    } else if (!parts[1].match(/^\+?\d+$/) && !parts[1].match(/^\+?\d+\.\d+$/)) {
                        adapter.log.error('Invalid format of offset: ' + main.ac.dbs[i].Address);
                        adapter.log.error('Expected format is: "DB2 4" or "DB2 4.1"');
                        main.ac.dbs.splice(i, 1);
                        continue;
                    } else if (!parts[0].match(/^DB/i)) {
                        adapter.log.error('Invalid format of address: ' + main.ac.dbs[i].Address);
                        adapter.log.error('Expected format is: "DB2 4" or "DB2 4.1"');
                        main.ac.dbs.splice(i, 1);
                        continue;
                    }

                    main.ac.dbs[i].db     = parts[0].trim().toUpperCase();
                    main.ac.dbs[i].dbId   = parseInt(main.ac.dbs[i].db.substring(2), 10);
                    main.ac.dbs[i].offset = parts[1].replace(/\+/g, '');
                    main.ac.dbs[i].id     = 'DBs.' + main.ac.dbs[i].db + '.' + ((main.ac.dbs[i].Name.replace(/[.\s]+/g, '_')) || main.ac.dbs[i].offset.replace(/[.\s]+/g, '_'));

                    parts = main.ac.dbs[i].offset.split('.');
                    main.ac.dbs[i].offsetByte = parseInt(parts[0], 10);
                    if (main.ac.dbs[i].Type === 'BOOL') {
                        main.ac.dbs[i].offsetBit  = parseInt(parts[1] || 0, 10);
                    } else {
                        main.ac.dbs[i].offsetBit = 0;
                        main.ac.dbs[i].offset    = main.ac.dbs[i].offsetByte;
                    }

                    if (!main.db_size[main.ac.dbs[i].db]) {
                        main.db_size[main.ac.dbs[i].db] = {
                            lsb:  0xFFFF,
                            msb:  0,
                            dbId: main.ac.dbs[i].dbId,
                            db:   main.ac.dbs[i].db
                        };
                    }

                    main.ac.dbs[i].len = 1;
                    if (main.ac.dbs[i].Type === 'WORD' || main.ac.dbs[i].Type === 'INT' || main.ac.dbs[i].Type === 'S5TIME') {
                        main.ac.dbs[i].len = 2;
                    } else
                    if (main.ac.dbs[i].Type === 'DWORD' || main.ac.dbs[i].Type === 'DINT' || main.ac.dbs[i].Type === 'REAL') {
                        main.ac.dbs[i].len = 4;
                    } else
                    if (main.ac.dbs[i].Type === 'S7TIME') {
                        main.ac.dbs[i].len = 8;
                    } else
                    if (main.ac.dbs[i].Type === 'ARRAY' || main.ac.dbs[i].Type === 'STRING' || main.ac.dbs[i].Type === 'S7STRING') {
                        main.ac.dbs[i].len = parseInt(main.ac.dbs[i].Length, 10);
                    }

                    // find size of DB
                    if (main.ac.dbs[i].offsetByte + main.ac.dbs[i].len > main.db_size[main.ac.dbs[i].db].msb) {
                        main.db_size[main.ac.dbs[i].db].msb = main.ac.dbs[i].offsetByte + main.ac.dbs[i].len;
                    }
                    if (main.ac.dbs[i].offsetByte < main.db_size[main.ac.dbs[i].db].lsb) {
                        main.db_size[main.ac.dbs[i].db].lsb = main.ac.dbs[i].offsetByte;
                    }
                }
            }

            // ------------------ create devices -------------
            if (main.ac.inputs.length > 0) {
                adapter.setObject('Inputs', {
                    type: 'device',
                    common: {
                        name: 'Inputs'
                    },
                    native: {}
                });
            }

            if (main.ac.outputs.length > 0) {
                adapter.setObject('Outputs', {
                    type: 'device',
                    common: {
                        name: 'Outputs'
                    },
                    native: {}
                });
            }

            if (main.ac.markers.length > 0) {
                adapter.setObject('Markers', {
                    type: 'device',
                    common: {
                        name: 'Markers'
                    },
                    native: {}
                });
            }

            if (main.ac.dbs.length > 0) {
                adapter.setObject('DBs', {
                    type: 'device',
                    common: {
                        name: 'DBs'
                    },
                    native: {}
                });
            }

            // ------------- create states and objects ----------------------------
            var channels = [];
            for (i = 0; main.ac.inputs.length > i; i++) {
                if (channels.indexOf('Inputs.' + main.ac.inputs[i].offsetByte) === -1) {
                    channels.push('Inputs.' + main.ac.inputs[i].offsetByte);
                    adapter.setObject('Inputs.' + main.ac.inputs[i].offsetByte, {
                        type: 'channel',
                        common: {
                            name: main.ac.inputs[i].offsetByte
                        },
                        native: {}
                    });
                }

                createExtendObject(main.ac.inputs[i].id, {
                    type: 'state',
                    common: {
                        name:    main.ac.inputs[i].Description,
                        role:    main.ac.inputs[i].Role,
                        type:    convertS7type[main.ac.inputs[i].Type],
                        unit:    main.ac.inputs[i].Unit || ((main.ac.inputs[i].Type === 'S5TIME') ? 's' : main.ac.inputs[i].Unit),
                        read:    true,
                        write:   main.ac.inputs[i].RW
                    },
                    native: {
                        cat:       'input',
                        type:      main.ac.inputs[i].Type,
                        address:   main.ac.inputs[i].offsetByte,
                        offsetBit: main.ac.inputs[i].offsetBit,
                        rw:        main.ac.inputs[i].RW,
                        wp:        main.ac.inputs[i].WP,
                        len:       main.ac.inputs[i].Length
                    }
                });

                syncEnums('rooms', adapter.namespace + '.' + main.ac.inputs[i].id, main.ac.inputs[i].Room);

                main.new_objects.push(adapter.namespace + '.' + main.ac.inputs[i].id);
            }
            channels = [];
            for (i = 0; main.ac.outputs.length > i; i++) {
                if (channels.indexOf('Outputs.' + main.ac.outputs[i].offsetByte) === -1) {
                    channels.push('Outputs.' + main.ac.outputs[i].offsetByte);
                    adapter.setObject('Outputs.' + main.ac.outputs[i].offsetByte, {
                        type: 'channel',
                        common: {
                            name: main.ac.outputs[i].offsetByte
                        },
                        native: {}
                    });
                }

                createExtendObject(main.ac.outputs[i].id, {
                    type: 'state',
                    common: {
                        name:    main.ac.outputs[i].Description,
                        role:    main.ac.outputs[i].Role,
                        type:    convertS7type[main.ac.outputs[i].Type],
                        unit:    main.ac.outputs[i].Unit || ((main.ac.outputs[i].Type === 'S5TIME') ? 's' : main.ac.outputs[i].Unit),
                        read:    true,
                        write:   main.ac.outputs[i].RW
                    },
                    native: {
                        cat:       'output',
                        type:      main.ac.outputs[i].Type,
                        address:   main.ac.outputs[i].offsetByte,
                        offsetBit: main.ac.outputs[i].offsetBit,
                        rw:        main.ac.outputs[i].RW,
                        wp:        main.ac.outputs[i].WP,
                        len:       main.ac.outputs[i].Length
                    }
                });
                syncEnums('rooms', adapter.namespace + '.' + main.ac.outputs[i].id, main.ac.outputs[i].Room);
                main.new_objects.push(adapter.namespace + '.' + main.ac.outputs[i].id);
            }

            channels = [];
            for (i = 0; main.ac.markers.length > i; i++) {
                if (channels.indexOf('Markers.' + main.ac.markers[i].offsetByte) === -1) {
                    channels.push('Markers.' + main.ac.markers[i].offsetByte);

                    adapter.setObject('Markers.' + main.ac.markers[i].offsetByte, {
                        type: 'channel',
                        common: {
                            name: main.ac.markers[i].offsetByte
                        },
                        native: {}
                    });
                }

                createExtendObject(main.ac.markers[i].id, {
                    type: 'state',
                    common: {
                        name:    main.ac.markers[i].Description,
                        role:    main.ac.markers[i].Role,
                        type:    convertS7type[main.ac.markers[i].Type],
                        unit:    main.ac.markers[i].Unit || ((main.ac.markers[i].Type === 'S5TIME') ? 's' : main.ac.markers[i].Unit),
                        read:    true,
                        write:   main.ac.markers[i].RW
                    },
                    native: {
                        cat:       'marker',
                        type:      main.ac.markers[i].Type,
                        address:   main.ac.markers[i].offsetByte,
                        offsetBit: main.ac.markers[i].offsetBit,
                        rw:        main.ac.markers[i].RW,
                        wp:        main.ac.markers[i].WP,
                        len:       main.ac.markers[i].Length
                    }
                });

                syncEnums('rooms', adapter.namespace + '.' + main.ac.markers[i].id, main.ac.markers[i].Room);

                main.new_objects.push(adapter.namespace + '.' + main.ac.markers[i].id);
            }


            for (i = 0; main.db_size.length > i; i++) {
                if (main.db_size[i].lsb === 0xFFFF) main.db_size[i].lsb = 0;

                adapter.setObject('DBs.' + main.db_size[i].db, {
                    type: 'channel',
                    common: {
                        name: 'DBs'
                    },
                    native: {}
                });
            }

            for (i = 0; main.ac.dbs.length > i; i++) {
                createExtendObject(main.ac.dbs[i].id, {
                    type: 'state',
                    common: {
                        name:    main.ac.dbs[i].Description,
                        role:    main.ac.dbs[i].Role,
                        type:    convertS7type[main.ac.dbs[i].Type],
                        unit:    main.ac.dbs[i].Unit || ((main.ac.dbs[i].Type === 'S5TIME') ? 's' : main.ac.dbs[i].Unit),
                        read:    true,
                        write:   main.ac.dbs[i].RW
                    },
                    native: {
                        cat:       'db',
                        type:      main.ac.dbs[i].Type,
                        db:        main.ac.dbs[i].db,
                        dbId:      main.ac.dbs[i].dbId,
                        address:   main.ac.dbs[i].offsetByte,
                        offsetBit: main.ac.dbs[i].offsetBit,
                        rw:        main.ac.dbs[i].RW,
                        wp:        main.ac.dbs[i].WP,
                        len:       main.ac.dbs[i].Length
                    }
                });
                syncEnums('rooms', adapter.namespace + '.' + main.ac.dbs[i].id, main.ac.dbs[i].Room);
                main.new_objects.push(adapter.namespace + '.' + main.ac.dbs[i].id);
            }


            // ----------- remember poll values --------------------------
            for (i = 0; main.ac.inputs.length > i; i++) {
                if (main.ac.inputs[i].poll) {
                    main.inputs.push(main.ac.inputs[i]);
                }
            }

            for (i = 0; main.ac.outputs.length > i; i++) {
                if (main.ac.outputs[i].poll) {
                    main.outputs.push(main.ac.outputs[i]);
                }
            }

            for (i = 0; main.ac.markers.length > i; i++) {
                if (main.ac.markers[i].poll) {
                    main.markers.push(main.ac.markers[i]);
                }
            }


            // store all DBs that must be polled
            for (i = 0; main.ac.dbs.length > i; i++) {
                if (main.ac.dbs[i].poll) {
                    main.dbs.push(main.ac.dbs[i]);
                }
            }

            adapter.setObject('info', {
                type: 'device',
                common: {
                    name: 'info',
                    enabled: false

                },
                native: {}
            });

            createExtendObject('info.poll_time', {
                type: 'state',
                common: {
                    name: 'Poll time',
                    type: 'number',
                    role: 'value',
                    unit: 'ms'
                },
                native: {}
            });
            main.new_objects.push(adapter.namespace + '.info.poll_time');

            createExtendObject('info.connection', {
                type: 'state',
                common: {
                    name: 'Connection status',
                    role: 'indicator.connection',
                    type: 'boolean'
                },
                native: {}
            });
            main.new_objects.push(adapter.namespace + '.info.connection');

            createExtendObject('info.pdu', {
                type: 'state',
                common: {
                    name: 'PDU size',
                    role: 'value',
                    type: 'number'
                },
                native: {}
            });
            main.new_objects.push(adapter.namespace + '.info.pdu');

            adapter.setState('info.connection', false, true);

            for (var key in main.db_size) {
                if (main.db_size.hasOwnProperty(key)) {
                    main._db_size.push(main.db_size[key]);
                }
            }

            // clear unused states
            var l = main.old_objects.length;

            function clear() {
                for (var id in main.old_objects) {
                    if (main.new_objects.indexOf(id) === -1) {
                        adapter.delObject(id, function (/* err */) {

                        });
                    }
                }

                main.old_objects = [];
                main.new_objects = [];
                adapter.subscribeStates('*');
                main.start();
            }

            clear();
        });
    },

    start: function () {

        if (!s7client) return;
        if (main.acp.localTSAP && main.acp.remoteTSAP) {
            adapter.log.info('Connect in LOGO! mode to ' + main.acp.localTSAP + ' / ' + main.acp.remoteTSAP);
            s7client.SetConnectionParams(main.acp.ip, main.acp.localTSAP, main.acp.remoteTSAP); // C++
            s7client.Connect(function (err) {

                if (err) {
                    adapter.log.error('Connection failed. Code #' + err + (sysErrors[err] ? '(' + sysErrors[err] + ')' : ''));
                    adapter.setState('info.connection', false, true);
                    return setTimeout(main.start, main.acp.recon);
                }
                adapter.log.info('Successfully connected in LOGO! mode');

                connected = true;
                adapter.setState('info.connection', true, true);
                adapter.setState('info.pdu', s7client.PDULength(), true);

                main.poll();
            });
        } else {
            adapter.log.info('Connect in S7 mode to ' + main.acp.rack + ' / ' + main.acp.slot);
            s7client.ConnectTo(main.acp.ip, main.acp.rack, main.acp.slot, function (err) {

                if (err) {
                    adapter.log.error('Connection failed. Code #' + err + (sysErrors[err] ? '(' + sysErrors[err] + ')' : ''));
                    adapter.setState('info.connection', false, true);
                    return setTimeout(main.start, main.acp.recon);
                }
                adapter.log.info('Successfully connected in S7 mode');

                connected = true;
                adapter.setState('info.connection', true, true);
                adapter.setState('info.pdu', s7client.PDULength(), true);

                main.poll();
            });
        }
    },

    write: function (id, buff, type, offsetByte, offsetBit, len) {
        var val   = 0;

        if (type === 'BOOL') {
            val = !!((buff[offsetByte] >> offsetBit) & 1);

            if (ackObjects[id] === undefined || ackObjects[id].val !== val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type === 'BYTE') {
            val = buff[offsetByte];
            if (ackObjects[id] === undefined || ackObjects[id].val !== val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type === 'WORD') {
            val = buff.readUInt16BE(offsetByte);
            if (ackObjects[id] === undefined || ackObjects[id].val !== val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type === 'DWORD') {
            val = buff.readUInt32BE(offsetByte);
            if (ackObjects[id] === undefined || ackObjects[id].val !== val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type === 'INT') {
            val = buff.readInt16BE(offsetByte);
            if (ackObjects[id] === undefined || ackObjects[id].val !== val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type === 'DINT') {
            val = buff.readInt32BE(offsetByte);
            if (ackObjects[id] === undefined || ackObjects[id].val !== val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type === 'STRING') {
            if (iconvFrom || iconvToL) {
                if (len > 255) len = 255;
                var str1 = Buffer.allocUnsafe(len);
                buff.copy(str1, 0, offsetByte, offsetByte + len);
                if (iconvFrom) {
                    val = iconvFrom.convert(str1);
                } else {
                    val = iconvToL.decode(str1, encoding);
                }
            } else {
                val = buff.toString('ascii', offsetByte, offsetByte + len);
            }
            if (ackObjects[id] === undefined || ackObjects[id].val !== val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type === 'S7STRING') {
            var max = buff[offsetByte];
            len = buff[offsetByte + 1];
            if (max > 512) max = 512;
            if (len > max) len = max;
            if (iconvFrom || iconvToL) {
                var str2 = Buffer.allocUnsafe(len);
                buff.copy(str2, 0, offsetByte + 2, offsetByte + 2 + len);

                if (iconvFrom) {
                    val = iconvFrom.convert(str2);
                } else {
                    val = iconvToL.decode(str2, encoding);
                }
            } else {
                val = buff.toString('ascii', offsetByte + 2, offsetByte + 2 + len);
            }
            if (ackObjects[id] === undefined || ackObjects[id].val !== val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type === 'ARRAY') {
            var result = [];
            for (var i = 0; i < len; i++) {
                result.push(buff[offsetByte + i]);
            }
            val = JSON.stringify(result);
            if (ackObjects[id] === undefined || ackObjects[id].val !== val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type === 'REAL') {
            val = buff.readFloatBE(offsetByte);
            var _val = parseFloat(Math.round(val * main.round) / main.round);

            if (ackObjects[id] === undefined || ackObjects[id].val !== _val) {
                ackObjects[id] = {val: _val};
                adapter.setState(id, _val, true);
            }
        } else if (type === 'S5TIME') {
            // Bin : xxxx 3333 | 2222 1111

            // xxxx = Faktor 0 = 10 ms 1 = 100 ms 2 = 1s 3 = 10s

            // 3333 3 Stelle vom BCD Code ( 0 - 9 )
            // 2222 2 Stelle vom BCD Code ( 0 - 9 )
            // 1111 1 Stelle vom BCD Code ( 0 - 9 )

            // Factor
            // 00 = 10   ms
            // 01 = 100  ms
            // 10 = 1000 ms = 1 s
            // 11 = 10   s

            val = buff.readUInt16BE(offsetByte);

            var factor = (val >> 12) & 0x3;
            if (factor === 0) {
                factor = 0.01;
            } else if (factor === 1) {
                factor = 0.1;
            } else if (factor === 2) {
                factor = 1;
            } else if (factor === 3) {
                factor = 10;
            }

            val = ((val >> 8) & 0xF) * 100 + ((val >> 4) & 0xF) * 10 + (val & 0xF);

            if (ackObjects[id] === undefined || ackObjects[id].val !== val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val * factor, true);
            }
        } else if (type === 'S7TIME') {
            // 0x15100822 0x42301231 = 2015.10.08 22:42:30.123 Monday
            var d = new Date();
            var y = buff[offsetByte + 0];
            // 21 = 0x15 => 2015
            y = ((y >> 4) & 0xF) * 10 + (y & 0xF);
            if (y >= 90) {
                y += 1900;
            } else {
                y += 2000;
            }
            d.setUTCFullYear(y);

            // month
            y = buff[offsetByte + 1];
            // 21 = 0x15 => 2015
            y = ((y >> 4) & 0xF) * 10 + (y & 0xF);
            d.setUTCMonth(y - 1);

            // day
            y = buff[offsetByte + 2];
            // 21 = 0x15 => 2015
            y = ((y >> 4) & 0xF) * 10 + (y & 0xF);
            d.setUTCDate(y);

            // hour
            y = buff[offsetByte + 3];
            // 21 = 0x15 => 2015
            y = ((y >> 4) & 0xF) * 10 + (y & 0xF);
            d.setUTCHours(y);

            // minutes
            y = buff[offsetByte + 4];
            // 21 = 0x15 => 2015
            y = ((y >> 4) & 0xF) * 10 + (y & 0xF);
            d.setUTCMinutes(y);

            // seconds
            y = buff[offsetByte + 5];
            // 21 = 0x15 => 2015
            y = ((y >> 4) & 0xF) * 10 + (y & 0xF);
            d.setUTCSeconds(y);

            // milliseconds
            y = buff[offsetByte + 6];
            // 21 = 0x15 => 2015
            y = (((y >> 4) & 0xF) * 10 + (y & 0xF)) * 10 + ((buff[offsetByte + 7] >> 4) & 0xF);
            d.setUTCMilliseconds(y);

            if (main.acp.timeFormat === 'utc') {
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
            } else if (main.acp.timeFormat === 'summer') {
                d.setMinutes(d.getMinutes() - main.acp.timeOffset + isDST(d));
            } else if (main.acp.timeFormat === 'offset') {
                d.setMinutes(d.getMinutes() - main.acp.timeOffset);
            }

            if (ackObjects[id] === undefined || ackObjects[id].val !== d.getTime()) {
                ackObjects[id] = {val: d.getTime()};
                adapter.setState(id, ackObjects[id].val, true);
            }
        }
    },

    poll: function () {
        var start_t = (new Date()).valueOf();
        async.parallel({
                input: function (callback) {
                    if (main.input_msb) {
                        s7client.EBRead(main.input_lsb, main.input_msb - main.input_lsb, function (err, res) {
                            if (err) {
                                adapter.log.warn('EBRead error[' + main.input_lsb + ' - ' + main.input_msb + ']: code: 0x' + parseInt(err, 10).toString(16) + (errorCodes[err] ? ' (' + errorCodes[err] + ')' : ''));
                                callback(err);
                            } else {
                                for (var n = 0; main.inputs.length > n; n++) {
                                    try {
                                        main.write(
                                            main.inputs[n].id,       // ID of the object
                                            res,                     // buffer
                                            main.inputs[n].Type,     // type
                                            main.inputs[n].offsetByte - main.input_lsb,  // offset in the buffer
                                            main.inputs[n].offsetBit, // bit offset
                                            main.inputs[n].Length    // length for string, array
                                        );
                                    } catch (err) {
                                        adapter.log.error('Writing Input. Code #' + err);
                                    }
                                }
                                callback(null);
                            }
                        });
                    } else {
                        callback(null, null);
                    }
                },
                output: function (callback) {
                    if (main.output_msb) {
                        s7client.ABRead(main.output_lsb, main.output_msb - main.output_lsb, function (err, res) {
                            if (err) {
                                adapter.log.warn('ABRead error[' + main.output_lsb + ' - ' + main.output_msb + ']: code: 0x' + parseInt(err, 10).toString(16) + (errorCodes[err] ? ' (' + errorCodes[err] + ')' : ''));
                                callback(err);
                            } else {
                                for (var n = 0; main.outputs.length > n; n++) {
                                    try {
                                        main.write(
                                            main.outputs[n].id,
                                            res,
                                            main.outputs[n].Type,
                                            main.outputs[n].offsetByte - main.output_lsb,
                                            main.outputs[n].offsetBit,
                                            main.outputs[n].Length    // length for string, array
                                        );
                                    } catch (err) {
                                        adapter.log.error('Writing Output. Code #' + err);
                                    }
                                }
                                callback(null);
                            }
                        });
                    } else {
                        callback(null);
                    }
                },
                marker: function (callback) {
                    if (main.marker_msb) {
                        s7client.MBRead(main.marker_lsb, main.marker_msb - main.marker_lsb, function (err, res) {
                            if (err) {
                                adapter.log.warn('MBRead error[' + main.marker_lsb + ' - ' + main.marker_msb + ']: code: 0x' + parseInt(err, 10).toString(16) + (errorCodes[err] ? ' (' + errorCodes[err] + ')' : ''));
                                callback(err);
                            } else {
                                for (var n = 0; main.markers.length > n; n++) {
                                    try {
                                        main.write(
                                            main.markers[n].id,
                                            res,
                                            main.markers[n].Type,
                                            main.markers[n].offsetByte - main.marker_lsb,
                                            main.markers[n].offsetBit,
                                            main.markers[n].Length    // length for string, array
                                        );
                                    } catch (err) {
                                        adapter.log.error('Writing Merker. Code #' + err);
                                    }
                                }
                                callback(null);
                            }
                        });

                    } else {
                        callback(null);
                    }
                },
                dbs: function (callback) {
                    var buf = {};

                    async.each(main._db_size, function (db, callback) {
                        s7client.DBRead(db.dbId, db.lsb, db.msb - db.lsb, function (err, res) {
                            if (err) {
                                adapter.log.warn('DBRead error[DB ' + db.dbId + ':' + db.lsb + ' - ' + db.msb + ']: code: 0x' + parseInt(err, 10).toString(16) + (errorCodes[err] ? ' (' + errorCodes[err] + ')' : ''));
                                callback(err);
                            } else {
                                buf[db.db] = res;
                                callback(null, res);
                            }
                        });
                    }, function (err, res) {
                        if (err) {
                            callback(err);
                        } else {
                            for (var n = 0; main.dbs.length > n; n++) {
                                try {
                                    var db     = main.dbs[n];
                                    var offset = db.offsetByte - main.db_size[db.db].lsb;
                                    main.write(
                                        db.id,
                                        buf[db.db],
                                        db.Type,
                                        offset,
                                        db.offsetBit,
                                        db.Length    // length for string, array
                                    );
                                } catch (err) {
                                    adapter.log.error('Writing DB. Code #' + err);
                                    var info = {
                                        dbID:           db.id,
                                        db:             db.db,
                                        dbType:         db.Type,
                                        dbOffsetByte:   db.offsetByte,
                                        dbOffsetBit:    db.offsetBit,
                                        dbLength:       db.Length,
                                        dbLsb:          main.db_size[db.db].lsb,
                                        n:              n,
                                        bufLength:      buf[db.db].length
                                    };
                                    adapter.log.error('Writing DB: ' + JSON.stringify(info));
                                }
                            }
                            callback(null);
                        }
                    });
                }
            },

            function (err) {
                if (err) {
                    main.error_count++;

                    adapter.log.warn('Poll error count: ' + main.error_count + ' code: 0x' + parseInt(err, 10).toString(16) + (errorCodes[err] ? ' (' + errorCodes[err] + ')' : ''));
                    adapter.setState('info.connection', false, true);

                    if (main.error_count < 6 && s7client.Connected()) {
                        setTimeout(main.poll, main.acp.poll);

                    } else {
                        connected = false;
                        adapter.log.error('try reconnection');
                        adapter.setState('info.connection', false, true);
                        setTimeout(main.start, main.acp.recon);
                    }

                } else {

                    adapter.setState('info.poll_time', (new Date()).valueOf() - start_t, true);
                    if (main.error_count > 0) {
                        adapter.setState('info.connection', true, true);
                        main.error_count = 0;
                    }
                    nextPoll = setTimeout(main.poll, main.acp.poll);
                }
            }
        );
    }
};

function sortByAddress(a, b) {
    var ad = parseFloat(a.Address);
    var bd = parseFloat(b.Address);
    return ((ad < bd) ? -1 : ((ad > bd) ? 1 : 0));
}
