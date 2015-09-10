/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";


//if(process.platform.indexOf("win") != -1){
//    snap7 = require(__dirname + '/lib/node-snap7')
//}else{

//}

var utils     = require(__dirname + '/lib/utils');
var adapter   = utils.adapter('s7');
var async     = require('async');
var snap7     = require('node-snap7');
var s7client  = snap7 ? new snap7.S7Client() : null;
var connected = false;

var nextPoll;
var ackObjects = {};

process.on('SIGINT', function () {
    if (adapter && adapter.setState) {
        adapter.setState("info.connection", false, true);
        adapter.setState("info.pdu",        "",    true);
        adapter.setState("info.poll_time",  "",    true);
    }
    if (nextPoll)  {
        clearTimeout(nextPoll);
    }
});

adapter.on('ready', function () {
    adapter.setState("info.connection", false, true);
    main.main();
});

var pulseList  = {};
var sendBuffer = {};
var objects    = {};
var infoRegExp = new RegExp(adapter.namespace.replace('.', '\\.') + '\\.info\\.');

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

    if (Object.keys(sendBuffer).length == 1) {
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

                pulseList[id] = ackObjects[id.substring(adapter.namespace.length + 1)].val;

                setTimeout(function () {
                    writeHelper(id, {val: pulseList[id]});

                    setTimeout(function () {
                        adapter.setState(id, ackObjects[id.substring(adapter.namespace.length + 1)].val, true);
                    }, main.acp.poll * 1.5);

                }, adapter.config.params.pulsetime);

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

    var buf;
    var sdata;

    if (type == "BOOL") {
        if (val === true || val === 1 || val === "true" || val === "1") {
            buf = new Buffer([1]);
        } else {
            buf = new Buffer([0]);
        }

    } else if (type == "BYTE") {
        buf = new Buffer(1);
        buf[0] = parseInt(val, 10) & 0xFF;

    } else if (type == "WORD") {
        val = parseInt(val, 10);
        buf = new Buffer(2);
        buf.writeUInt16BE(parseInt(val, 10), 0, 2);

    } else if (type == "DWORD") {
        buf = new Buffer(4);
        buf.writeUInt32BE(parseInt(val, 10), 0, 4);

    } else if (type == "INT") {
        buf = new Buffer(2);
        buf.writeInt16BE(parseInt(val, 10), 0, 2);

    } else if (type == "DINT") {
        buf = new Buffer(4);
        buf.writeInt32BE(parseInt(val, 10), 0, 4);

    } else if (type == "REAL") {
        buf = new Buffer(4);
        buf.writeFloatBE(parseFloat(val), 0);
    }

    var addr;

    if (data.native.cat == "db") {

        if (type == "BOOL") {
            addr = data.native.address * 8 + data.native.offsetBit;
            s7client.WriteArea(s7client.S7AreaDB, data.native.dbId, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err);
            });
        } else if (type == "BYTE") {
            s7client.DBWrite(data.native.dbId, data.native.address, 1, buf, function (err) {
                next(err);
            });
        } else if (type == "INT" || type == "WORD") {
            s7client.DBWrite(data.native.dbId, data.native.address, 2, buf, function (err) {
                next(err);
            });
        } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
            s7client.DBWrite(data.native.dbId, data.native.address, 4, buf, function (err) {
                next(err);
            });
        }
    }

    if (data.native.cat == "input") {
        if (type == "BOOL") {
            addr = data.native.address * 8 + data.native.offsetBit;
            s7client.WriteArea(s7client.S7AreaPE, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err);
            });
        } else if (type == "BYTE") {
            s7client.EBWrite(data.native.address, data.native.address, 1, buf, function (err) {
                next(err);
            });
        } else if (type == "INT" || type == "WORD") {
            s7client.EBWrite(data.native.address, data.native.address, 2, buf, function (err) {
                next(err);
            });
        } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
            s7client.EBWrite(data.native.address, data.native.address, 4, buf, function (err) {
                next(err);
            });
        }
    }
    if (data.native.cat == "output") {

        if (type == "BOOL") {
            addr = data.native.address * 8 + data.native.offsetBit;
            s7client.WriteArea(s7client.S7AreaPA, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err);
            });
        } else if (type == "BYTE") {
            s7client.ABWrite(data.native.address, data.native.address, 1, buf, function (err) {
                next(err);
            });
        } else if (type == "INT" || type == "WORD") {
            s7client.ABWrite(data.native.address, data.native.address, 2, buf, function (err) {
                next(err);
            });
        } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
            s7client.ABWrite(data.native.address, data.native.address, 4, buf, function (err) {
                next(err);
            });
        }
    }
    if (data.native.cat == "marker") {

        if (type == "BOOL") {
            addr = data.native.address * 8 + data.native.offsetBit;
            s7client.WriteArea(s7client.S7AreaMK, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err);
            });
        } else if (type == "BYTE") {
            s7client.MBWrite(data.native.address, 1, buf, function (err) {
                next(err);
            });
        } else if (type == "INT" || type == "WORD") {
            s7client.MBWrite(data.native.address, 2, buf, function (err) {
                next(err);
            });
        } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
            s7client.MBWrite(data.native.address, 4, buf, function (err) {
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

var main = {
    old_objects: [],
    new_objects: [],
    round:       2,

    inputs:      [],
    input_lsb:   "",
    input_msb:   "",
    input_size:  "",

    outputs:     [],
    output_lsb:  "",
    output_msb:  "",
    output_size: "",

    markers:     [],
    marker_lsb:  "",
    marker_msb:  "",
    marker_size: "",

    dbs:         [],
    db_size:     {},
    _db_size:    [],

    history:     "",
    unit:        "",
    error_count: 0,

    main: function () {

        main.ac        = adapter.config;
        main.acp       = adapter.config.params;
        main.acp.poll  = parseInt(main.acp.poll,  10) || 1000; // default is 1 second
        main.acp.rack  = parseInt(main.acp.rack,  10) || 0;
        main.acp.slot  = parseInt(main.acp.slot,  10) || 2;
        main.acp.recon = parseInt(main.acp.recon, 10) || 60000;

        if (main.acp.round) {
            main.round = parseInt(main.acp.round) || 2;
        } else {
            main.round = 2;
        }

        main.round = Math.pow(10, main.round);

        adapter.getForeignObjects(adapter.namespace + ".*", function (err, list) {

            main.old_objects = list;

            main.ac.inputs.sort(SortByaddress);
            main.ac.outputs.sort(SortByaddress);
            main.ac.markers.sort(SortByaddress);
            main.ac.dbs.sort(SortByaddress);

            var parts;
            var i;

            if (main.ac.inputs.length > 0) {
                for (i = main.ac.inputs.length - 1; i >= 0; i--) {
                    main.ac.inputs[i].Address = main.ac.inputs[i].Address.replace('+', '');
                    parts = main.ac.inputs[i].Address.split('.');
                    main.ac.inputs[i].offsetByte = parseInt(parts[0], 10);
                    main.ac.inputs[i].offsetBit  = parseInt(parts[1] || 0, 10);
                    main.ac.inputs[i].id = "Inputs." + main.ac.inputs[i].offsetByte + "." + (main.ac.inputs[i].Name.replace(".", "_").replace(" ", "_") || main.ac.inputs[i].offsetBit);

                    main.ac.inputs[i].len = 1;
                    if (main.ac.inputs[i].Type == "WORD"  || main.ac.inputs[i].Type == "INT"  || main.ac.inputs[i].Type == "S5TIME") {
                        main.ac.inputs[i].len = 2;
                    }
                    if (main.ac.inputs[i].Type == "DWORD" || main.ac.inputs[i].Type == "DINT" || main.ac.inputs[i].Type == "REAL") {
                        main.ac.inputs[i].len = 4;
                    }
                }
                main.input_lsb  = main.ac.inputs[i].offsetByte;
                main.input_msb  = main.ac.inputs[main.ac.inputs.length - 1].offsetByte + main.ac.inputs[main.ac.inputs.length - 1].len;
                main.input_size = main.input_msb - main.input_lsb;
            }

            if (main.ac.outputs.length > 0) {
                for (i = main.ac.outputs.length - 1; i >= 0; i--) {
                    main.ac.outputs[i].Address = main.ac.outputs[i].Address.replace('+', '');
                    parts = main.ac.outputs[i].Address.split('.');
                    main.ac.outputs[i].offsetByte = parseInt(parts[0], 10);
                    main.ac.outputs[i].offsetBit  = parseInt(parts[1] || 0, 10);
                    main.ac.outputs[i].id = "Outputs." + main.ac.outputs[i].offsetByte + "." + (main.ac.outputs[i].Name.replace(".", "_").replace(" ", "_") || main.ac.outputs[i].offsetBit);

                    main.ac.outputs[i].len = 1;
                    if (main.ac.outputs[i].Type == "WORD"  || main.ac.outputs[i].Type == "INT"  || main.ac.outputs[i].Type == "S5TIME") {
                        main.ac.outputs[i].len = 2;
                    }
                    if (main.ac.outputs[i].Type == "DWORD" || main.ac.outputs[i].Type == "DINT" || main.ac.outputs[i].Type == "REAL") {
                        main.ac.outputs[i].len = 4;
                    }
                }
                main.output_lsb  = main.ac.outputs[0].offsetByte;
                main.output_msb  = main.ac.outputs[main.ac.outputs.length - 1].offsetByte + main.ac.outputs[main.ac.outputs.length - 1].len;
                main.output_size = main.output_msb - main.output_lsb;
            }

            if (main.ac.markers.length > 0) {
                for (i = main.ac.markers.length - 1; i >= 0; i--) {
                    main.ac.markers[i].Address = main.ac.markers[i].Address.replace('+', '');
                    parts = main.ac.markers[i].Address.split('.');
                    main.ac.markers[i].offsetByte = parseInt(parts[0], 10);
                    main.ac.markers[i].offsetBit  = parseInt(parts[1] || 0, 10);
                    main.ac.markers[i].id = "Markers." + main.ac.markers[i].offsetByte + "." + (main.ac.markers[i].Name.replace(".", "_").replace(" ", "_") || main.ac.markers[i].offsetBit);

                    main.ac.markers[i].len = 1;
                    if (main.ac.markers[i].Type == "WORD"  || main.ac.markers[i].Type == "INT"  || main.ac.markers[i].Type == "S5TIME") {
                        main.ac.markers[i].len = 2;
                    }
                    if (main.ac.markers[i].Type == "DWORD" || main.ac.markers[i].Type == "DINT" || main.ac.markers[i].Type == "REAL") {
                        main.ac.markers[i].len = 4;
                    }
                }
                main.marker_lsb  = main.ac.markers[0].offsetByte;
                main.marker_msb  = main.ac.markers[main.ac.markers.length - 1].offsetByte + main.ac.markers[main.ac.markers.length - 1].len;
                main.marker_size = main.marker_msb - main.marker_lsb;
            }

            if (main.ac.dbs.length > 0) {
                for (i = main.ac.dbs.length - 1; i >= 0; i--) {
                    parts = main.ac.dbs[i].Address.split(' ');
                    if (parts.length != 2) {
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
                    main.ac.dbs[i].offset = parts[1].replace('+', '');
                    main.ac.dbs[i].id     = "DBs." + main.ac.dbs[i].db + "." + ((main.ac.dbs[i].Name.replace(".", "_").replace(" ", "_")) || main.ac.dbs[i].offset.replace(".", "_"));

                    parts = main.ac.dbs[i].offset.split('.');
                    main.ac.dbs[i].offsetByte = parseInt(parts[0], 10);

                    if (main.ac.dbs[i].Type == 'BOOL') {
                        main.ac.dbs[i].offsetBit = parseInt(parts[1] || 0, 10);
                    } else {
                        main.ac.dbs[i].offsetBit = 0;
                        main.ac.dbs[i].offset    = main.ac.dbs[i].offsetByte;
                    }

                    if (!main.db_size[main.ac.dbs[i].db]) {
                        main.db_size[main.ac.dbs[i].db] = {
                            msb:  0,
                            db:   main.ac.dbs[i].db,
                            dbId: main.ac.dbs[i].dbId
                        };
                    }

                    main.ac.dbs[i].len = 1;
                    if (main.ac.dbs[i].Type == "WORD" || main.ac.dbs[i].Type == "INT" || main.ac.dbs[i].Type == "S5TIME") {
                        main.ac.dbs[i].len = 2;
                    } else
                    if (main.ac.dbs[i].Type == "DWORD" || main.ac.dbs[i].Type == "DINT" || main.ac.dbs[i].Type == "REAL") {
                        main.ac.dbs[i].len = 4;
                    }

                    // find size of DB
                    if (main.ac.dbs[i].offsetByte + main.ac.dbs[i].len > main.db_size[main.ac.dbs[i].db].msb) {
                        main.db_size[main.ac.dbs[i].db].msb = main.ac.dbs[i].offsetByte + main.ac.dbs[i].len;
                    }
                }
            }

            // ------------------ create devices -------------
            if (main.ac.inputs.length > 0) {
                adapter.setObject("Inputs", {
                    type: 'device',
                    common: {
                        name: "Inputs"
                    },
                    native: {}
                });
            }

            if (main.ac.outputs.length > 0) {
                adapter.setObject("Outputs", {
                    type: 'device',
                    common: {
                        name: "Outputs"
                    },
                    native: {}
                });
            }

            if (main.ac.markers.length > 0) {
                adapter.setObject("Markers", {
                    type: 'device',
                    common: {
                        name: "Markers"
                    },
                    native: {}
                });
            }

            if (main.ac.dbs.length > 0) {
                adapter.setObject("DBs", {
                    type: 'device',
                    common: {
                        name: "DBs"
                    },
                    native: {}
                });
            }

            // ------------- create states and objects ----------------------------
            var channels = [];
            for (i = 0; main.ac.inputs.length > i; i++) {
                if (channels.indexOf("Inputs." + main.ac.inputs[i].offsetByte) == -1) {
                    channels.push("Inputs." + main.ac.inputs[i].offsetByte);
                    adapter.setObject("Inputs." + main.ac.inputs[i].offsetByte, {
                        type: 'channel',
                        common: {
                            name: main.ac.inputs[i].offsetByte
                        },
                        native: {}
                    });
                }

                if (main.old_objects[adapter.namespace + "." + main.ac.inputs[i].id]) {
                    main.history = main.old_objects[adapter.namespace + "." + main.ac.inputs[i].id].common.history || {
                            "enabled":     false,
                            "changesOnly": true,
                            "minLength":   480,
                            "maxLength":   960,
                            "retention":   604800,
                            "debounce":    10000
                        };
                } else {
                    main.history = {
                        "enabled": false,
                        "changesOnly": true,
                        "minLength": 480,
                        "maxLength": 960,
                        "retention": 604800,
                        "debounce": 10000
                    };
                }

                adapter.setObject(main.ac.inputs[i].id, {
                    type: 'state',
                    common: {
                        name:    main.ac.inputs[i].Description,
                        role:    main.ac.inputs[i].Type,
                        type:    (main.ac.inputs[i].Type == "BOOL")   ? "boolean" : main.ac.inputs[i].Type,
                        unit:    (main.ac.inputs[i].Type == "S5TIME") ? "s"       : main.ac.inputs[i].Unit,
                        history: main.history
                    },
                    native: {
                        cat:       "input",
                        type:      main.ac.inputs[i].Type,
                        address:   main.ac.inputs[i].offsetByte,
                        offsetBit: main.ac.inputs[i].offsetBit,
                        rw:        main.ac.inputs[i].RW,
                        wp:        main.ac.inputs[i].WP
                    }
                });

                main.new_objects.push(adapter.namespace + "." + main.ac.inputs[i].id);
            }
            channels = [];
            for (i = 0; main.ac.outputs.length > i; i++) {
                if (channels.indexOf("Outputs." + main.ac.inputs[i].offsetByte) == -1) {
                    channels.push("Outputs." + main.ac.inputs[i].offsetByte);
                    adapter.setObject("Outputs." + main.ac.outputs[i].offsetByte, {
                        type: 'channel',
                        common: {
                            name: main.ac.outputs[i].offsetByte
                        },
                        native: {}
                    });
                }

                if (main.old_objects[adapter.namespace + "." + main.ac.outputs[i].id]) {
                    main.history = main.old_objects[adapter.namespace + "." + main.ac.outputs[i].id].common.history || {
                            "enabled":     false,
                            "changesOnly": true,
                            "minLength":   480,
                            "maxLength":   960,
                            "retention":   604800,
                            "debounce":    10000
                        };
                } else {
                    main.history = {
                        "enabled":     false,
                        "changesOnly": true,
                        "minLength":   480,
                        "maxLength":   960,
                        "retention":   604800,
                        "debounce":    10000
                    };
                }
                adapter.setObject(main.ac.outputs[i].id, {
                    type: 'state',
                    common: {
                        name:    main.ac.outputs[i].Description,
                        role:    main.ac.outputs[i].Type, //todo
                        type:    (main.ac.outputs[i].Type == "BOOL") ? "boolean" : main.ac.outputs[i].Type,
                        unit:    (main.ac.outputs[i].Type == "S5TIME") ? "s" : main.ac.outputs[i].Unit,
                        history: main.history
                    },
                    native: {
                        cat:       "output",
                        type:      main.ac.outputs[i].Type,
                        address:   main.ac.outputs[i].offsetByte,
                        offsetBit: main.ac.outputs[i].offsetBit,
                        rw:        main.ac.outputs[i].RW,
                        wp:        main.ac.outputs[i].WP
                    }
                });
                main.new_objects.push(adapter.namespace + "." + main.ac.outputs[i].id);
            }

            channels = [];
            for (i = 0; main.ac.markers.length > i; i++) {
                if (channels.indexOf("Markers." + main.ac.inputs[i].offsetByte) == -1) {
                    channels.push("Markers." + main.ac.inputs[i].offsetByte);

                    adapter.setObject("Markers." + main.ac.markers[i].offsetByte, {
                        type: 'channel',
                        common: {
                            name: main.ac.markers[i].offsetByte
                        },
                        native: {}
                    });
                }

                if (main.old_objects[adapter.namespace + "." + main.ac.markers[i].id]) {
                    main.history = main.old_objects[adapter.namespace + "." + main.ac.markers[i].id].common.history || {
                            "enabled":     false,
                            "changesOnly": true,
                            "minLength":   480,
                            "maxLength":   960,
                            "retention":   604800,
                            "debounce":    10000
                        };
                } else {
                    main.history = {
                        "enabled":     false,
                        "changesOnly": true,
                        "minLength":   480,
                        "maxLength":   960,
                        "retention":   604800,
                        "debounce":    10000
                    };
                }
                adapter.setObject(main.ac.markers[i].id, {
                    type: 'state',
                    common: {
                        name:    main.ac.markers[i].Description,
                        role:    main.ac.markers[i].Type,//todo
                        type:    (main.ac.markers[i].Type == "BOOL")   ? "boolean" : main.ac.markers[i].Type,
                        unit:    (main.ac.markers[i].Type == "S5TIME") ? "s" : main.ac.markers[i].Unit,
                        history: main.history
                    },
                    native: {
                        cat:       "marker",
                        type:      main.ac.markers[i].Type,
                        address:   main.ac.markers[i].offsetByte,
                        offsetBit: main.ac.markers[i].offsetBit,
                        rw:        main.ac.markers[i].RW,
                        wp:        main.ac.markers[i].WP
                    }
                });
                main.new_objects.push(adapter.namespace + "." + main.ac.markers[i].id);
            }


            for (i = 0; main.db_size.length > i; i++) {
                adapter.setObject("DBs." + main.db_size[i].db, {
                    type: 'channel',
                    common: {
                        name: "DBs"
                    },
                    native: {}
                });
            }

            for (i = 0; main.ac.dbs.length > i; i++) {
                if (main.old_objects[adapter.namespace + "." + main.ac.dbs[i].id]) {
                    main.history = main.old_objects[adapter.namespace + "." + main.ac.dbs[i].id].common.history || {
                            "enabled":     false,
                            "changesOnly": true,
                            "minLength":   480,
                            "maxLength":   960,
                            "retention":   604800,
                            "debounce":    10000
                        };
                } else {
                    main.history = {
                        "enabled":     false,
                        "changesOnly": true,
                        "minLength":   480,
                        "maxLength":   960,
                        "retention":   604800,
                        "debounce":    10000
                    };
                }

                adapter.setObject(main.ac.dbs[i].id, {
                    type: 'state',
                    common: {
                        name:    main.ac.dbs[i].Description,
                        role:    main.ac.dbs[i].Type,//todo
                        type:    (main.ac.dbs[i].Type == "BOOL")   ? "boolean" : main.ac.dbs[i].Type,
                        unit:    (main.ac.dbs[i].Type == "S5TIME") ? "s"       : main.ac.dbs[i].Unit,
                        history: main.history
                    },
                    native: {
                        cat:       "db",
                        type:      main.ac.dbs[i].Type,
                        db:        main.ac.dbs[i].db,
                        dbId:      main.ac.dbs[i].dbId,
                        address:   main.ac.dbs[i].offsetByte,
                        offsetBit: main.ac.dbs[i].offsetBit,
                        rw:        main.ac.dbs[i].RW,
                        wp:        main.ac.dbs[i].WP
                    }
                });
                main.new_objects.push(adapter.namespace + "." + main.ac.dbs[i].id);
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


            for (i = 0; main.ac.dbs.length > i; i++) {
                if (main.ac.dbs[i].poll) {
                    main.dbs.push(main.ac.dbs[i]);
                }
            }

            adapter.setObject("info", {
                type: 'device',
                common: {
                    name: "info",
                    enabled: false

                },
                native: {}
            });

            adapter.setObject("info.poll_time", {
                type: 'state',
                common: {
                    name: "Poll time",
                    type: "number",
                    role: "",
                    unit: "ms"
                },
                native: {}
            });
            main.new_objects.push(adapter.namespace + ".info.poll_time");

            adapter.setObject("info.connection", {
                type: 'state',
                common: {
                    name: "Connection status",
                    role: "",
                    type: "string"
                },
                native: {}
            });
            main.new_objects.push(adapter.namespace + ".info.connection");

            adapter.setObject("info.pdu", {
                type: 'state',
                common: {
                    name: "PDU size",
                    role: "",
                    type: "number"
                },
                native: {}
            });
            main.new_objects.push(adapter.namespace + ".info.pdu");

            adapter.setState("info.connection", false, true);

            for (var key in main.db_size) {
                main._db_size.push(main.db_size[key]);
            }

            //clear unused states
            var l = main.old_objects.length;

            function clear() {
                for (var id in main.old_objects) {
                    if (main.new_objects.indexOf(id) == -1) {
                        adapter.delObject(id, function () {

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

        s7client.ConnectTo(main.acp.ip, main.acp.rack, main.acp.slot, function (err) {

            if (err) {
                adapter.log.error('Connection failed. Code #' + err);
                adapter.setState("info.connection", false, true);
                return setTimeout(main.start, main.acp.recon);
            }

            connected = true;
            adapter.setState("info.connection", true, true);
            adapter.setState("info.pdu", s7client.PDULength(), true);

            main.poll();
        });
    },

    write: function (id, buff, type, offsetByte, offsetBit) {
        var val   = 0;
        var byte0 = "";
        var byte1 = "";
        var byte2 = "";
        var byte3 = "";

        if (type == "BOOL") {
            val = ((buff[offsetByte] >> (7 - offsetBit)) & 1) ? true : false;

            if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type == "BYTE") {
            val = buff[offsetByte];
            if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type == "WORD") {
            val = buff.readUInt16BE(offsetByte);
            if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type == "DWORD") {
            val = buff.readUInt32BE(offsetByte);
            if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type == "INT") {
            val = buff.readInt16BE(offsetByte);
            if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type == "DINT") {
            val = buff.readInt32BE(offsetByte);
            if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                ackObjects[id] = {val: val};
                adapter.setState(id, val, true);
            }
        } else if (type == "REAL") {
            val = buff.readFloatBE(offsetByte);
            var _val = parseFloat(Math.round(val * main.round) / main.round);

            if (ackObjects[id] === undefined || ackObjects[id].val != _val) {
                ackObjects[id] = {val: _val};
                adapter.setState(id, _val, true);
            }
        } else if (type == "S5TIME") {
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
            if (factor == 0) {
                factor = 0.01;
            } else if (factor == 1) {
                factor = 0.1;
            } else if (factor == 2) {
                factor = 1;
            } else if (factor == 3) {
                factor = 10;
            }

            val = ((val >> 8) & 0xF) * 100 + ((val >> 4) & 0xF) * 10 + (val & 0xF);

            adapter.setState(id, val * factor, true);
        } else if (type == "S7TIME") {
            // 0x15100822 0x42301231 = 2015.10.08 22:42:30.123 Monday
            // todo

            adapter.setState(id, 0, true);
        }
    },

    poll: function () {
        var start_t = (new Date()).valueOf();
        async.parallel({
                input: function (callback) {
                    if (main.input_msb) {
                        s7client.EBRead(main.input_lsb, main.input_msb - main.input_lsb, function (err, res) {
                            if (err) {
                                callback(err);
                            } else {
                                for (var n = 0; main.inputs.length > n; n++) {
                                    try {
                                        main.write(
                                            main.inputs[n].id,       // ID of the object
                                            res,                     // buffer
                                            main.inputs[n].Type,     // type
                                            main.inputs[n].offsetByte - main.input_lsb,  // offset in the buffer
                                            main.inputs[n].offsetBit // bit offset
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
                                callback(err);
                            } else {
                                for (var n = 0; main.outputs.length > n; n++) {
                                    try {
                                        main.write(
                                            main.outputs[n].id,
                                            res,
                                            main.outputs[n].Type,
                                            main.outputs[n].offsetByte - main.output_lsb,  main.outputs[n].offsetBit);
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
                                callback(err);
                            } else {
                                for (var n = 0; main.markers.length > n; n++) {
                                    try {
                                        main.write(
                                            main.markers[n].id,
                                            res,
                                            main.markers[n].Type,
                                            main.markers[n].offsetByte - main.marker_lsb,
                                            main.markers[n].offsetBit
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
                        // Why not db.lsb ?
                        s7client.DBRead(db.dbId, 0, db.msb, function (err, res) {
                            if (err) {
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
                                    main.write(
                                        main.dbs[n].id,
                                        buf[main.dbs[n].db],
                                        main.dbs[n].Type,
                                        main.dbs[n].offsetByte,
                                        main.dbs[n].offsetBit
                                    );
                                } catch (err) {
                                    adapter.log.error('Writing DB. Code #' + err);
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

                    adapter.log.warn('Poll error count : ' + main.error_count + " code: " + err);
                    adapter.setState("info.connection", false, true);

                    if (main.error_count < 6 && s7client.Connected()) {
                        setTimeout(main.poll, main.acp.poll);

                    } else {
                        connected = false;
                        adapter.log.error('try reconnection');
                        adapter.setState("info.connection", false, true);
                        setTimeout(main.start, main.acp.recon);
                    }

                } else {

                    adapter.setState("info.poll_time", (new Date()).valueOf() - start_t, true);
                    if (main.error_count > 0) {
                        adapter.setState("info.connection", true, true);
                        main.error_count = 0;
                    }
                    nextPoll = setTimeout(main.poll, main.acp.poll);
                }
            }
        );
    }
};

function SortByaddress(a, b) {
    var ad = parseFloat(a.Address);
    var bd = parseFloat(b.Address);
    return ((ad < bd) ? -1 : ((ad > bd) ? 1 : 0));
}

