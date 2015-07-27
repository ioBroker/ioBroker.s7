/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";


//if(process.platform.indexOf("win") != -1){
//    snap7 = require(__dirname + '/lib/node-snap7')
//}else{

//}

var utils = require(__dirname + '/lib/utils');
var adapter = utils.adapter('s7');
var async = require('async');
var snap7 = require('node-snap7');
var s7client = new snap7.S7Client();
var connected = false;

var nextPoll;
var acp;
var ackObjects = {};

process.on('SIGINT', function () {
    if (adapter && adapter.setState) {
        adapter.setState("info.connection", false, true);
        adapter.setState("info.pdu", "", true);
        adapter.setState("info.poll_time", "", true);
    }
    if (nextPoll)
        clearTimeout(nextPoll);
});

adapter.on('ready', function () {
    adapter.setState("info.connection", false, true);
    main.main();
});

var pulseList = {};
var sendBuffer ={};

adapter.on('stateChange', function (id, state) {


    if (state && !state.ack && id ) {

        adapter.getObject(id, function (err, data) {
            if(err){
                console.log(err)
            }else{

                var type = data.native.type;

                if (data.native.rw != false) {

                    if (data.native.wp == false) {
                        _write(id);
                        setTimeout(function () {
                            adapter.setState(id, ackObjects[id.replace(adapter.namespace + ".", "")].val, true);
                        }, main.acp.poll * 1.5)
                    } else {
                        if (pulseList[id] == undefined && pulseList[id] != "_reset") {

                            pulseList[id] = ackObjects[id.replace(adapter.namespace + ".", "")].val;

                            setTimeout(function () {

                                adapter.setState(id, pulseList[id], false);
                                pulseList[id] = "_reset";
                            }, adapter.config.params.pulsetime);
                            _write(id);
                        } else {
                            _write(id);
                            pulseList[id] = undefined;
                            setTimeout(function () {
                                adapter.setState(id, ackObjects[id.replace(adapter.namespace + ".", "")].val, true);
                            }, main.acp.poll * 1.5)
                        }
                    }
                }
            }



            function _write(id) {

                if (id){
                    sendBuffer[id] ={
                        type: type,
                        state: state,
                        native: data.native
                    }
                }
                if(Object.keys(sendBuffer).length == 1){
                    send()
                }

            }
        })
    }
});

function send(){

    var id = Object.keys(sendBuffer)[0];

    var type = sendBuffer[id].type;
    var state = sendBuffer[id].state;
    var data = {
        "native" : sendBuffer[id].native
        };

    var buf;

    if (type == "BOOL") {
        if (state.val == true || state.val == 1) {
            buf = new Buffer([0x01])
        } else {
            buf = new Buffer([0x00])
        }

    } else if (type == "BYTE") {
        buf = new Buffer(1);
        buf[0] = parseInt(state.val, 2);

    } else if (type == "WORD") {
        var sdata = (state.val).toString();
        buf = new Buffer(2);
        buf[0] = parseInt(sdata.substr(0, 8), 2);
        buf[1] = parseInt(sdata.substr(8, 16), 2);

    } else if (type == "DWORD") {
        var sdata = (state.val).toString();
        buf = new Buffer(4);
        buf[0] = parseInt(sdata.substr(0, 8), 2);
        buf[1] = parseInt(sdata.substr(8, 16), 2);
        buf[2] = parseInt(sdata.substr(16, 24), 2);
        buf[3] = parseInt(sdata.substr(24, 32), 2);

    } else if (type == "INT") {
        buf = new Buffer(2);
        buf.writeInt16BE(state.val, 0, 2);

    } else if (type == "DINT") {
         buf = new Buffer(4);
        buf.writeInt32BE(state.val, 0, 4);

    } else if (type == "REAL") {
        buf = new Buffer(4);
        buf.writeFloatBE(state.val, 0);

    }

    if (data.native.cat == "db") {

        if (type == "BOOL") {
            var addr = parseInt(data.native.adress) * 8 + parseInt(data.native.adress.split(".")[1]);
            s7client.WriteArea(s7client.S7AreaDB, parseInt(data.native.db.replace("DB", "")), addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err)
            });
        } else if (type == "BYTE") {
            s7client.DBWrite(parseInt(data.native.db.replace("DB", "")), parseInt(data.native.adress), 1, buf, function (err) {
                next(err)
            });
        } else if (type == "INT" || type == "WORD") {
            s7client.DBWrite(parseInt(data.native.db.replace("DB", "")), parseInt(data.native.adress), 2, buf, function (err) {
                next(err)
            });
        } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
            s7client.DBWrite(parseInt(data.native.db.replace("DB", "")), parseInt(data.native.adress), 4, buf, function (err) {
                next(err)
            });
        }
    }
    if (data.native.cat == "input") {

        if (type == "BOOL") {
            var addr = parseInt(data.native.adress) * 8 + parseInt(data.native.adress.split(".")[1]);
            s7client.WriteArea(s7client.S7AreaPE, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err)
            });
        } else if (type == "BYTE") {
            s7client.EBWrite(parseInt(data.native.adress), parseInt(data.native.adress), 1, buf, function (err) {
                next(err)
            });
        } else if (type == "INT" || type == "WORD") {
            s7client.EBWrite(parseInt(data.native.adress), parseInt(data.native.adress), 2, buf, function (err) {
                next(err)
            });
        } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
            s7client.EBWrite(parseInt(data.native.adress), parseInt(data.native.adress), 4, buf, function (err) {
                next(err)
            });
        }
    }
    if (data.native.cat == "output") {

        if (type == "BOOL") {
            var addr = parseInt(data.native.adress) * 8 + parseInt(data.native.adress.split(".")[1]);
            s7client.WriteArea(s7client.S7AreaPA, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err)
            });
        } else if (type == "BYTE") {
            s7client.ABWrite(parseInt(data.native.adress), parseInt(data.native.adress), 1, buf, function (err) {
                next(err)
            });
        } else if (type == "INT" || type == "WORD") {
            s7client.ABWrite(parseInt(data.native.adress), parseInt(data.native.adress), 2, buf, function (err) {
                next(err)
            });
        } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
            s7client.ABWrite(parseInt(data.native.adress), parseInt(data.native.adress), 4, buf, function (err) {
                next(err)
            });
        }
    }
    if (data.native.cat == "merker") {

        if (type == "BOOL") {
            var addr = parseInt(data.native.adress) * 8 + parseInt(data.native.adress.split(".")[1]);

            s7client.WriteArea(s7client.S7AreaMK, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                next(err)
            });
        } else if (type == "BYTE") {
            s7client.MBWrite(parseInt(data.native.adress), 1, buf, function (err) {
                next(err)
            });
        } else if (type == "INT" || type == "WORD") {
            s7client.MBWrite(parseInt(data.native.adress), 2, buf, function (err) {
                next(err)
            });
        } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
            s7client.MBWrite(parseInt(data.native.adress), 4, buf, function (err) {
                next(err)
            });
        }
    }

    function next(err) {
        if (err){
            adapter.log.error('DB write error. Code #' + err);
        }
        delete (sendBuffer[id])
        if(Object.keys(sendBuffer).length != 0){
            send()
        }
    }

}

function bin8(n) {
    return ("000000000" + n.toString(2)).substr(-8)
}
var main = {


    old_objects: [],
    new_objects: [],
    round: 2,
    inputs: [],
    input_lsb: "",
    input_msb: "",
    input_size: "",
    outputs: [],
    output_lsb: "",
    output_msb: "",
    output_size: "",
    merkers: [],
    merker_lsb: "",
    merker_msb: "",
    merker_size: "",
    dbs: [],
    db_size: {},
    _db_size:[],
    history: "",
    unit: "",
    error_count: 0,

    main: function () {

        main.ac = adapter.config;
            main.acp = adapter.config.params;

        if (parseInt(main.acp.round) != "NaN" && main.acp.round != "" && main.acp.round != undefined && main.acp.round != null) {
            main.round = parseInt(main.acp.round);
        } else {
            main.round = 2
        }

        main.round = Math.pow(10, main.round);

        adapter.getForeignObjects(adapter.namespace + "*", function (err, list) {


            main.old_objects = list

            //for (var key in list) {
            //    main.old_objects.push(this)
            //}
            for (i = 0; main.ac.inputs.length > i; i++) {
                if (main.ac.inputs[i].poll == true) {
                    main.inputs.push(main.ac.inputs[i])
                }
            }


            for (i = 0; main.ac.outputs.length > i; i++) {
                if (main.ac.outputs[i].poll == true) {
                    main.outputs.push(main.ac.outputs[i])
                }
            }

            for (i = 0; main.ac.merkers.length > i; i++) {
                if (main.ac.merkers[i].poll == true) {
                    main.merkers.push(main.ac.merkers[i])
                }
            }


            for (i = 0; main.ac.dbs.length > i; i++) {
                if (main.ac.dbs[i].poll == true) {
                    main.dbs.push(main.ac.dbs[i])
                }
            }


            main.inputs.sort(SortByAdress);
            main.outputs.sort(SortByAdress);
            main.merkers.sort(SortByAdress);
            main.dbs.sort(SortByAdress);

            if (main.inputs.length > 0) {
                main.input_lsb = parseInt(main.inputs[0].Adress.split(".")[0]);
                main.input_msb = parseInt(main.inputs[main.inputs.length - 1].Adress.split(".")[0]);
                main.input_size = main.input_msb - main.input_lsb + 1;
            }
            if (main.outputs.length > 0) {
                main.output_lsb = parseInt(main.outputs[0].Adress.split(".")[0]);
                main.output_msb = parseInt(main.outputs[main.outputs.length - 1].Adress.split(".")[0]);
                main.output_size = main.output_msb - main.output_lsb + 1;
            }
            if (main.merkers.length > 0) {
                main.merker_lsb = parseInt(main.merkers[0].Adress.split(".")[0]);
                main.merker_msb = parseInt(main.merkers[main.merkers.length - 1].Adress.split(".")[0]);
                main.merker_size = main.merker_msb - main.merker_lsb + 1;
            }

            if (main.dbs.length > 0) {

                for (i = 0; main.dbs.length > i; i++) {
                    main.db_size[main.dbs[i].Adress.split(" ")[0]] = {
                        msb: 0,
                        db: main.dbs[i].Adress.split(" ")[0]
                    }

                }

                for (i = 0; main.dbs.length > i; i++) {
                    var db = main.dbs[i].Adress.split(" ")[0];
                    var addr = parseFloat(main.dbs[i].Adress.split(" ")[1].replace("+", ""));

                    var len = 1;
                    if (main.dbs[i].Type == "WORD" || main.dbs[i].Type == "INT" || main.dbs[i].Type == "S5TIME") {
                        len = 2
                    }
                    if (main.dbs[i].Type == "DWORD" || main.dbs[i].Type == "DINT" || main.dbs[i].Type == "REAL") {
                        len = 4
                    }

                    addr = addr + len;

                    if (addr > main.db_size[db].msb) {
                        main.db_size[db].msb = addr;
                    }
                }
            }

            if (main.inputs.length > 0) {
                adapter.setObject("Inputs", {
                    type: 'device',
                    common: {
                        name: "Inputs"
                    },
                    native: {}
                });
            }

            if (main.outputs.length > 0) {
                adapter.setObject("Outputs", {
                    type: 'device',
                    common: {
                        name: "Outputs"
                    },
                    native: {}
                });
            }

            if (main.merkers.length > 0) {
                adapter.setObject("Merkers", {
                    type: 'device',
                    common: {
                        name: "Merkers"
                    },
                    native: {}
                });
            }

            if (main.dbs.length > 0) {
                adapter.setObject("DBs", {
                    type: 'device',
                    common: {
                        name: "DBs"
                    },
                    native: {}
                });
            }


            for (i = 0; main.inputs.length > i; i++) {
                var ch = (main.ac.inputs[i].Adress).split(".")[0];
                var id = "Inputs." + ch + "." + main.ac.inputs[i].Name.replace(".", "_").replace(" ", "_");
                adapter.setObject("Inputs." + ch, {
                    type: 'channel',
                    common: {
                        name: ch
                    },
                    native: {}
                });

                if (main.old_objects[adapter.namespace + "." + id]) {
                    main.history = main.old_objects[adapter.namespace + "." + id].common.history || {
                            "enabled": false,
                            "changesOnly": true,
                            "minLength": 480,
                            "maxLength": 960,
                            "retention": 604800,
                            "debounce": 10000
                        }
                } else {
                    main.history = {
                        "enabled": false,
                        "changesOnly": true,
                        "minLength": 480,
                        "maxLength": 960,
                        "retention": 604800,
                        "debounce": 10000
                    }
                }
                adapter.setObject(id, {
                    type: 'state',
                    common: {
                        name: main.ac.inputs[i].Description,
                        role: main.ac.inputs[i].Type,
                        type: main.ac.inputs[i].Type,
                        unit: (main.ac.inputs[i].Type == "S5TIME") ? "s" : main.ac.inputs[i].Unit,
                        enabled: false,
                        history: main.history
                    },
                    native: {
                        cat: "input",
                        type: main.ac.inputs[i].Type,
                        adress: main.ac.inputs[i].Adress,
                        rw: main.ac.inputs[i].RW,
                        wp: main.ac.inputs[i].Wp
                    }
                });

                main.new_objects.push(adapter.namespace + "." + id)
            }

            for (i = 0; main.outputs.length > i; i++) {
                var ch = (main.ac.outputs[i].Adress).split(".")[0];
                var id = "Outputs." + ch + "." + main.ac.outputs[i].Name.replace(".", "_").replace(" ", "_");
                //var bit= (main.ac.outputs[i].Adress).split(".")[1] || 0;

                adapter.setObject("Outputs." + ch, {
                    type: 'channel',
                    common: {
                        name: ch
                    },
                    native: {}
                });

                if (main.old_objects[adapter.namespace + "." + id]) {
                    main.history = main.old_objects[adapter.namespace + "." + id].common.history || {
                            "enabled": false,
                            "changesOnly": true,
                            "minLength": 480,
                            "maxLength": 960,
                            "retention": 604800,
                            "debounce": 10000
                        }
                } else {
                    main.history = {
                        "enabled": false,
                        "changesOnly": true,
                        "minLength": 480,
                        "maxLength": 960,
                        "retention": 604800,
                        "debounce": 10000
                    }
                }
                adapter.setObject(id, {
                    type: 'state',
                    common: {
                        name: main.ac.outputs[i].Description,
                        role: main.ac.outputs[i].Type,
                        type: main.ac.outputs[i].Type,
                        unit: (main.ac.outputs[i].Type == "S5TIME") ? "s" : main.ac.outputs[i].Unit,
                        enabled: false,
                        history: main.history
                    },
                    native: {
                        cat: "output",
                        type: main.ac.outputs[i].Type,
                        adress: main.ac.outputs[i].Adress,
                        rw: main.ac.outputs[i].RW,
                        wp: main.ac.outputs[i].WP
                    }
                });
                main.new_objects.push(adapter.namespace + "." + id)
            }

            for (i = 0; main.merkers.length > i; i++) {
                var ch = (main.ac.merkers[i].Adress).split(".")[0];
                var id = "Merkers." + ch + "." + main.ac.merkers[i].Name.replace(".", "_").replace(" ", "_");
                //var bit= (main.ac.merkers[i].Adress).split(".")[1]  || 0;

                adapter.setObject("Merkers." + ch, {
                    type: 'channel',
                    common: {
                        name: ch
                    },
                    native: {}
                });

                if (main.old_objects[adapter.namespace + "." + id]) {
                    main.history = main.old_objects[adapter.namespace + "." + id].common.history || {
                            "enabled": false,
                            "changesOnly": true,
                            "minLength": 480,
                            "maxLength": 960,
                            "retention": 604800,
                            "debounce": 10000
                        }
                } else {
                    main.history = {
                        "enabled": false,
                        "changesOnly": true,
                        "minLength": 480,
                        "maxLength": 960,
                        "retention": 604800,
                        "debounce": 10000
                    }
                }
                adapter.setObject(id, {
                    type: 'state',
                    common: {
                        name: main.ac.merkers[i].Description,
                        role: main.ac.merkers[i].Type,
                        type: main.ac.merkers[i].Type,
                        unit: (main.ac.merkers[i].Type == "S5TIME") ? "s" : main.ac.merkers[i].Unit,
                        enabled: false,
                        history: main.history
                    },
                    native: {
                        cat: "merker",
                        type: main.ac.merkers[i].Type,
                        adress: main.ac.merkers[i].Adress,
                        rw: main.ac.merkers[i].RW,
                        wp: main.ac.merkers[i].WP
                    }
                });
                main.new_objects.push(adapter.namespace + "." + id);
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

            for (i = 0; main.dbs.length > i; i++) {
                var db = main.dbs[i].Adress.split(" ")[0];
                var id = "DBs." + db + "." + main.dbs[i].Name.replace(".", "_").replace(" ", "_")
                //console.log(main.old_objects[adapter.namespace +"."+ id])

                if (main.old_objects[adapter.namespace + "." + id]) {
                    main.history = main.old_objects[adapter.namespace + "." + id].common.history || {
                            "enabled": false,
                            "changesOnly": true,
                            "minLength": 480,
                            "maxLength": 960,
                            "retention": 604800,
                            "debounce": 10000
                        }
                } else {
                    main.history = {
                        "enabled": false,
                        "changesOnly": true,
                        "minLength": 480,
                        "maxLength": 960,
                        "retention": 604800,
                        "debounce": 10000
                    }
                }

                adapter.setObject("DBs." + db + "." + main.dbs[i].Name.replace(".", "_").replace(" ", "_"), {
                    type: 'state',
                    common: {
                        name: main.dbs[i].Description,
                        role: main.dbs[i].Type,
                        type: main.dbs[i].Type,
                        unit: (main.dbs[i].Type == "S5TIME") ? "s" : main.dbs[i].Unit,
                        enabled: false,
                        history: main.history
                    },
                    native: {
                        cat: "db",
                        type: main.dbs[i].Type,
                        db: main.dbs[i].Adress.split(" +")[0],
                        adress: main.dbs[i].Adress.split(" +")[1],
                        rw: main.dbs[i].RW,
                        wp: main.dbs[i].WP
                    }
                });
                main.new_objects.push(adapter.namespace + "." + id)
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


            var db_size = [];


            for (var key in main.db_size) {
                main._db_size.push(main.db_size[key])
            }

            //clear unused states
            var i = 0;
            var l = main.old_objects.length;

            function clear() {
               for (var id in  main.old_objects) {
                    if (main.new_objects.indexOf(id) == -1) {
                        console.log(id)
                        adapter.delObject(id, function () {

                        })
                    }
                }

                main.old_objects = [];
                main.new_objects = [];
                adapter.subscribeStates('*');
                start();
            }

            clear();

            function start() {
                s7client.ConnectTo(main.acp.ip, parseInt(main.acp.rack), parseInt(main.acp.slot), function (err) {

                    if (err) {
                        adapter.log.error('Connection failed. Code #' + err);
                        adapter.setState("info.connection", false, true);
                        return setTimeout(start, (parseInt(main.acp.recon) || 60000))
                    }

                    connected = true;
                    adapter.setState("info.connection", true, true);
                    adapter.setState("info.pdu", s7client.PDULength(), true);


                    main.poll();
                });
            }


            //}
        });
    },

    write: function (id, buff, type, byte_addr, bit_addr) {
        var val = 0;
        var byte0 = "";
        var byte1 = "";
        var byte2 = "";
        var byte3 = "";

        if (type == "BOOL") {
            val = bin8(buff[byte_addr]).substring(7 - bit_addr, 7 - bit_addr + 1);
            if (ackObjects[id] == undefined || ackObjects[id].val != val) {
                ackObjects[id] = {"val": val};
                adapter.setState(id, val, true);
            }
        } else if (type == "BYTE") {
            val = bin8(buff[byte_addr]);
            if (ackObjects[id] == undefined || ackObjects[id].val != val) {
                ackObjects[id] = {"val": val};
                adapter.setState(id, val, true);
            }
        } else if (type == "WORD") {
            byte1 = bin8(buff[byte_addr]);
            byte0 = bin8(buff[byte_addr + 1]);

            val = byte1 + byte0;
            if (ackObjects[id] == undefined || ackObjects[id].val != val) {
                ackObjects[id] = {"val": val};
                adapter.setState(id, val, true);
            }
        } else if (type == "DWORD") {
            byte3 = bin8(buff[byte_addr]);
            byte2 = bin8(buff[byte_addr + 1]);
            byte1 = bin8(buff[byte_addr + 2]);
            byte0 = bin8(buff[byte_addr + 3]);
            val = byte3 + byte2 + byte1 + byte0;
            if (ackObjects[id] == undefined || ackObjects[id].val != val) {
                ackObjects[id] = {"val": val};
                adapter.setState(id, val, true);
            }
        } else if (type == "INT") {
            val = buff.readInt16BE(byte_addr);
            if (ackObjects[id] == undefined || ackObjects[id].val != val) {
                ackObjects[id] = {"val": val};
                adapter.setState(id, val, true);
            }
        } else if (type == "DINT") {
            val = buff.readInt32BE(byte_addr);
            if (ackObjects[id] == undefined || ackObjects[id].val != val) {
                ackObjects[id] = {"val": val};
                adapter.setState(id, val, true);
            }
        } else if (type == "REAL") {
            val = buff.readFloatBE(byte_addr);
            var _val = parseFloat(Math.round(val * main.round) / main.round);

            if (ackObjects[id] == undefined || ackObjects[id].val != _val) {

                ackObjects[id] = {"val": _val};
                adapter.setState(id, _val, true);
            }
        }
        else if (type == "S5TIME") {

            byte3 = bin8(buff[byte_addr]);
            byte2 = bin8(buff[byte_addr + 1]);
            val = byte3 + byte2;

            var factor = val.substr(2, 2)
            if (factor == "00") {
                factor = 0.01
            } else if (factor == "01") {
                factor = 0.1
            } else if (factor == "10") {
                factor = 1
            } else if (factor == "11") {
                factor = 10
            }

            var num1 = parseInt(val.substr(4, 4), 2).toString()
            var num2 = parseInt(val.substr(8, 4), 2).toString()
            var num3 = parseInt(val.substr(12, 4), 2).toString()

            adapter.setState(id, parseInt(num1 + num2 + num3) * factor, true);
        }
    },

    poll: function () {
        var start_t = (new Date).valueOf();
        async.parallel({
                input: function (callback) {
                    if (main.input_msb) {
                        s7client.EBRead(main.input_lsb, (main.input_msb - main.input_lsb + 30), function (err, res) {
                            //s7client.EBRead(input_lsb, 380, function (err, res) {
                            if (err) {
                                callback(err);
                            } else {

                                for (var n = 0; main.inputs.length > n; n++) {
                                    var id = "Inputs." + main.inputs[n].Adress.split(".")[0] + "." + main.inputs[n].Name.replace(".", "_").replace(" ", "_");

                                    var addr = main.inputs[n].Adress;
                                    var byte_addr = parseInt(addr.split(".")[0]) - main.input_lsb;
                                    var bit_addr = parseInt(addr.split(".")[1]);
                                    try {
                                        main.write(id, res, main.inputs[n].Type, byte_addr, bit_addr)
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
                        s7client.ABRead(main.output_lsb, main.output_msb - main.output_lsb + 1, function (err, res) {
                            if (err) {
                                callback(err);
                            } else {
                                for (var n = 0; main.outputs.length > n; n++) {
                                    var id = "Outputs." + main.outputs[n].Adress.split(".")[0] + "." + main.outputs[n].Name.replace(".", "_").replace(" ", "_");

                                    var addr = main.outputs[n].Adress
                                    var byte_addr = parseInt(addr.split(".")[0]) - main.output_lsb;
                                    var bit_addr = parseInt(addr.split(".")[1]);
                                    try {
                                        main.write(id, res, main.outputs[n].Type, byte_addr, bit_addr)
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
                merker: function (callback) {
                    if (main.merker_msb) {
                        s7client.MBRead(main.merker_lsb, main.merker_msb - main.merker_lsb + 4, function (err, res) {
                            if (err) {
                                callback(err);
                            } else {
                                for (var n = 0; main.merkers.length > n; n++) {

                                    var id = "Merkers." + main.merkers[n].Adress.split(".")[0] + "." + main.merkers[n].Name.replace(".", "_").replace(" ", "_");

                                    var addr = main.merkers[n].Adress;
                                    var byte_addr = parseInt(addr.split(".")[0]) - main.merker_lsb;
                                    var bit_addr = parseInt(addr.split(".")[1]);

                                    try {
                                        main.write(id, res, main.merkers[n].Type, byte_addr, bit_addr)
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
                        var _db = parseInt(db.db.replace("DB", ""));
                        var msb = db.msb;

                        s7client.DBRead(_db, 0, msb, function (err, res) {
                            if (err) {
                                callback(err);
                            } else {

                                buf["DB" + _db] = res;
                                callback(null, res);
                            }
                        });
                    }, function (err, res) {

                        if (err) {
                            callback(err)
                        } else {
                            for (var n = 0; main.dbs.length > n; n++) {

                                var addr = main.dbs[n].Adress.split(" +")[1];
                                var db = main.dbs[n].Adress.split(" +")[0];
                                var id = "DBs." + db + "." + main.dbs[n].Name.replace(".", "_").replace(" ", "_");
                                var buff = buf[db]
                                var byte_addr = parseInt(addr.split(".")[0]);
                                var bit_addr = parseInt(addr.split(".")[1]);
                                try {
                                    main.write(id, buff, main.dbs[n].Type, byte_addr, bit_addr)
                                } catch (err) {
                                    adapter.log.error('Writing DB. Code #' + err);
                                }
                            }
                            callback(null)
                        }
                    })

                }
            },

            function (err) {
                if (err) {
                    main.error_count++;

                    adapter.log.warn('Poll error count : ' + main.error_count + " code: " + err);
                    adapter.setState("info.connection", false, true);

                    if (main.error_count < 6 && s7client.Connected()) {
                        setTimeout(poll, parseInt(main.acp.poll))

                    } else {
                        connected = false;
                        adapter.log.error('try reconnection');
                        adapter.setState("info.connection", false, true);
                        setTimeout(start, (parseInt(main.acp.recon) || 60000));
                    }

                } else {

                    adapter.setState("info.poll_time", (new Date).valueOf() - start_t, true);
                    if (main.error_count > 0) {
                        adapter.setState("info.connection", true, true);
                        main.error_count = 0;
                    }

                    nextPoll = setTimeout(main.poll, parseInt(main.acp.poll))
                }
            }
        );
    }
}

function SortByAdress(a, b) {
    var ad = parseFloat(a.Adress);
    var bd = parseFloat(b.Adress);
    return ((ad < bd) ? -1 : ((ad > bd) ? 1 : 0));
}

