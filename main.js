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
        adapter.setState("info.state", "stopped", true);
        adapter.setState("info.pdu", "", true);
        adapter.setState("info.poll_time", "", true);

    }
    if (nextPoll)
        clearTimeout(nextPoll);
});

adapter.on('ready', function () {
    adapter.setState("info.state", "starting", true);
    main();
});

var pulseList = {};
adapter.on('stateChange', function (id, state) {

    if (!state.ack) {
        adapter.getObject(id, function (err, data) {
            var type = data.native.type;
            var addr;
            var buf;

            if (data.native.rw) {

                if (!data.native.wp) {
                    _write();
                    setTimeout(function () {
                        adapter.setState(id, ackObjects[id.replace(adapter.namespace + '.', '')].val, true);
                    }, acp.poll * 1.5);
                } else {
                    if (pulseList[id] === undefined/* || pulseList[id] != "_reset"*/) {

                        pulseList[id] = ackObjects[id.replace(adapter.namespace + '.', '')].val;

                        setTimeout(function () {
                            adapter.setState(id, pulseList[id], false);
                            pulseList[id] = "_reset";
                        }, adapter.config.params.pulsetime);
                        
                        _write();
                    } else {
                        _write();
                        pulseList[id] = undefined;
                        setTimeout(function () {
                            adapter.setState(id, ackObjects[id.replace(adapter.namespace + '.', '')].val, true);
                        }, acp.poll * 1.5);
                    }
                }
            }

            function _write() {
                if (type == 'BOOL') {
                    if (state.val === true || state.val === 'true' || state.val == 1) {
                        buf = new Buffer([0x01]);
                    } else {
                        buf = new Buffer([0x00]);
                    }

                } else if (type == "BYTE") {
                    buf = new Buffer(1);
                    buf[0] = parseInt(state.val, 2);

                } else if (type == "WORD") {
                    var sdata1 = (state.val).toString();
                    buf = new Buffer(2);
                    buf[0] = parseInt(sdata1.substr(0, 8), 2);
                    buf[1] = parseInt(sdata1.substr(8, 16), 2);

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
                        addr = parseInt(data.native.address) * 8 + parseInt(data.native.address.split(".")[1]);
                        s7client.WriteArea(s7client.S7AreaDB, parseInt(data.native.db.replace("DB", "")), addr, 1, s7client.S7WLBit, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "BYTE") {
                        s7client.DBWrite(parseInt(data.native.db.replace("DB", "")), parseInt(data.native.address), 1, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "INT" || type == "WORD") {
                        s7client.DBWrite(parseInt(data.native.db.replace("DB", "")), parseInt(data.native.address), 2, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
                        s7client.DBWrite(parseInt(data.native.db.replace("DB", "")), parseInt(data.native.address), 4, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    }
                }
                if (data.native.cat == "input") {

                    if (type == "BOOL") {
                        addr = parseInt(data.native.address) * 8 + parseInt(data.native.address.split(".")[1]);
                        s7client.WriteArea(s7client.S7AreaPE, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "BYTE") {
                        s7client.EBWrite(parseInt(data.native.address), parseInt(data.native.address), 1, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "INT" || type == "WORD") {
                        s7client.EBWrite(parseInt(data.native.address), parseInt(data.native.address), 2, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
                        s7client.EBWrite(parseInt(data.native.address), parseInt(data.native.address), 4, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    }
                }
                if (data.native.cat == "output") {

                    if (type == "BOOL") {
                        addr = parseInt(data.native.address) * 8 + parseInt(data.native.address.split(".")[1]);
                        s7client.WriteArea(s7client.S7AreaPA, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "BYTE") {
                        s7client.ABWrite(parseInt(data.native.address), parseInt(data.native.address), 1, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "INT" || type == "WORD") {
                        s7client.ABWrite(parseInt(data.native.address), parseInt(data.native.address), 2, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
                        s7client.ABWrite(parseInt(data.native.address), parseInt(data.native.address), 4, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    }
                }
                if (data.native.cat == "marker") {

                    if (type == "BOOL") {
                        addr = parseInt(data.native.address) * 8 + parseInt(data.native.address.split(".")[1]);

                        s7client.WriteArea(s7client.S7AreaMK, 0, addr, 1, s7client.S7WLBit, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                            console.log("finish");
                        });
                    } else if (type == "BYTE") {
                        s7client.MBWrite(parseInt(data.native.address), 1, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "INT" || type == "WORD") {
                        s7client.MBWrite(parseInt(data.native.address), 2, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    } else if (type == "REAL" || type == "DINT" || type == "DWORD") {
                        s7client.MBWrite(parseInt(data.native.address), 4, buf, function (err) {
                            if (err) adapter.log.error('DB write error. Code #' + err);
                        });
                    }
                }
            }
        });
    }
});

function bin8(n) {
    return ("000000000" + n.toString(2)).substr(-8);
}

function main() {
    var old_objects = [];
    var new_objects = [];

    var ac = adapter.config;
    acp = adapter.config.params;

    var round = 2;
    var inputs = [];
    var input_lsb;
    var input_msb;
    var input_size;

    var outputs = [];
    var output_lsb;
    var output_msb;
    var output_size;

    var markers = [];
    var marker_lsb;
    var marker_msb;
    var marker_size;

    var dbs = [];

    var db_size = {};


    if (parseInt(acp.round).toString() != 'NaN' && acp.round !== '' && acp.round !== undefined && acp.round !== null) {
        round = parseInt(acp.round);
    } else {
        round = 2;
    }

    round = Math.pow(10, round);

    adapter.getStates("*", function (err, list) {

        var n = 0;
        var db;

        for (var key in list) {
            old_objects.push(key);
        }


            for (i = 0; ac.inputs.length > i; i++) {
                if (ac.inputs[i].poll) {
                    inputs.push(ac.inputs[i]);
                }
            }



            for (i = 0; ac.outputs.length > i; i++) {
                if (ac.outputs[i].poll) {
                    outputs.push(ac.outputs[i]);
                }
            }

            for (i = 0; ac.markers.length > i; i++) {
                if (ac.markers[i].poll) {
                    markers.push(ac.markers[i]);
                }
            }


            for (i = 0; ac.dbs.length > i; i++) {
                if (ac.dbs[i].poll) {
                    dbs.push(ac.dbs[i]);
                }
            }


        function SortByAddress(a, b) {
            var ad = parseFloat(a.Address);
            var bd = parseFloat(b.Address);
            return ((ad < bd) ? -1 : ((ad > bd) ? 1 : 0));
        }

        inputs.sort(SortByAddress);
        outputs.sort(SortByAddress);
        markers.sort(SortByAddress);
        dbs.sort(SortByAddress);

        if (inputs.length > 0) {
            input_lsb = parseInt(inputs[0].Address.split(".")[0]);
            input_msb = parseInt(inputs[inputs.length - 1].Address.split(".")[0]);
            input_size = input_msb - input_lsb + 1;
        }
        if (outputs.length > 0) {
            output_lsb = parseInt(outputs[0].Address.split(".")[0]);
            output_msb = parseInt(outputs[outputs.length - 1].Address.split(".")[0]);
            output_size = output_msb - output_lsb + 1;
        }
        if (markers.length > 0) {
            marker_lsb = parseInt(markers[0].Address.split(".")[0]);
            marker_msb = parseInt(markers[markers.length - 1].Address.split(".")[0]);
            marker_size = marker_msb - marker_lsb + 1;
        }

        if (dbs.length > 0) {

            for (i = 0; dbs.length > i; i++) {
                db_size[dbs[i].Address.split(" ")[0]] = {
                    msb: 0,
                    db: dbs[i].Address.split(" ")[0]
                };
            }

            for (i = 0; dbs.length > i; i++) {
                db = dbs[i].Address.split(" ")[0];
                var addr = parseFloat(dbs[i].Address.split(" ")[1].replace("+", ""));

                var len = 1;
                if (dbs[i].Type == "WORD" || dbs[i].Type == "INT") {
                    len = 2;
                }
                if (dbs[i].Type == "DWORD" || dbs[i].Type == "DINT" || dbs[i].Type == "REAL") {
                    len = 4;
                }

                addr = addr + len;

                if (addr > db_size[db].msb) {
                    db_size[db].msb = addr;
                }
            }
        }

        if (inputs.length > 0) {
            adapter.setObject("Inputs", {
                type: 'device',
                common: {
                    name: "Inputs"
                },
                native: {}
            });
        }

        if (outputs.length > 0) {
            adapter.setObject("Outputs", {
                type: 'device',
                common: {
                    name: "Outputs"
                },
                native: {}
            });
        }

        if (markers.length > 0) {
            adapter.setObject("Markers", {
                type: 'device',
                common: {
                    name: "Markers"
                },
                native: {}
            });
        }

        if (dbs.length > 0) {
            adapter.setObject("DBs", {
                type: 'device',
                common: {
                    name: "DBs"
                },
                native: {}
            });
        }

        var ch;

        for (i = 0; inputs.length > i; i++) {
            ch = (ac.inputs[i].Address).split(".")[0];

            adapter.setObject("Inputs." + ch, {
                type: 'channel',
                common: {
                    name: ch
                },
                native: {}
            });

            adapter.setObject("Inputs." + ch + "." + ac.inputs[i].Name.replace(".", "_").replace(" ", "_"), {
                type: 'state',
                common: {
                    name: ac.inputs[i].Description,
                    role: ac.inputs[i].Type,
                    type: ac.inputs[i].Type,
                    unit: ac.inputs[i].Unit,
                    enabled: false
                },
                native: {
                    cat: "input",
                    type: ac.inputs[i].Type,
                    address: ac.inputs[i].Address,
                    rw: ac.inputs[i].RW,
                    wp: ac.inputs[i].Wp
                }
            });

            new_objects.push(adapter.namespace + ".Inputs." + ch + "." + ac.inputs[i].Name.replace(".", "_").replace(" ", "_"));
        }

        for (i = 0; outputs.length > i; i++) {
            ch = (ac.outputs[i].Address).split(".")[0];
            //var bit= (ac.outputs[i].Address).split(".")[1] || 0;

            adapter.setObject("Outputs." + ch, {
                type: 'channel',
                common: {
                    name: ch
                },
                native: {}
            });
            adapter.setObject("Outputs." + ch + "." + ac.outputs[i].Name.replace(".", "_").replace(" ", "_"), {
                type: 'state',
                common: {
                    name:   ac.outputs[i].Description,
                    role:   ac.outputs[i].Type,
                    type:   ac.outputs[i].Type,
                    unit:   ac.outputs[i].Unit,
                    enabled: false
                },
                native: {
                    cat:     "output",
                    type:    ac.outputs[i].Type,
                    address: ac.outputs[i].Address,
                    rw:      ac.outputs[i].RW,
                    wp:      ac.outputs[i].WP
                }
            });
            new_objects.push(adapter.namespace + ".Outputs." + ch + "." + ac.outputs[i].Name.replace(".", "_").replace(" ", "_"));
        }

        for (i = 0; markers.length > i; i++) {
            ch = (ac.markers[i].Address).split(".")[0];
            //var bit= (ac.markers[i].Address).split(".")[1]  || 0;

            adapter.setObject("Markers." + ch, {
                type: 'channel',
                common: {
                    name: ch
                },
                native: {}
            });
            adapter.setObject("Markers." + ch + "." + ac.markers[i].Name.replace(".", "_").replace(" ", "_"), {
                type: 'state',
                common: {
                    name: ac.markers[i].Description,
                    role: ac.markers[i].Type,
                    type: ac.markers[i].Type,
                    unit: ac.markers[i].Unit,
                    enabled: false
                },
                native: {
                    cat: "marker",
                    type: ac.markers[i].Type,
                    address: ac.markers[i].Address,
                    rw: ac.markers[i].RW,
                    wp: ac.markers[i].WP
                }
            });
            new_objects.push(adapter.namespace + ".Markers." + ch + "." + ac.markers[i].Name.replace(".", "_").replace(" ", "_"));
        }

        console.log(db_size);

        for (i = 0; db_size.length > i; i++) {
            adapter.setObject("DBs." + db_size[i].db, {
                type: 'channel',
                common: {
                    name: "DBs"
                },
                native: {}
            });
        }

        for (i = 0; dbs.length > i; i++) {
            db = dbs[i].Address.split(" ")[0];
            adapter.setObject("DBs." + db + "." + dbs[i].Name.replace(".", "_").replace(" ", "_"), {
                type: 'state',
                common: {
                    name: dbs[i].Description,
                    role: dbs[i].Type,
                    type: dbs[i].Type,
                    unit: dbs[i].Unit,
                    enabled: false
                },
                native: {
                    cat: "db",
                    type:   dbs[i].Type,
                    db:     dbs[i].Address.split(" +")[0],
                    address: dbs[i].Address.split(" +")[1],
                    rw: dbs[i].RW,
                    wp: dbs[i].WP
                }
            });
            new_objects.push(adapter.namespace + ".DBs." + db + "." + ac.dbs[i].Name.replace(".", "_").replace(" ", "_"));
        }


        adapter.setObject("info", {
            type: 'device',
            common: {
                name: 'info',
                enabled: false

            },
            native: {}
        });

        adapter.setObject('info.poll_time', {
            type: 'state',
            common: {
                name: 'Poll time',
                type: 'number',
                role: '',
                unit: 'ms'
            },
            native: {}
        });
        new_objects.push(adapter.namespace + ".info.poll_time");

        adapter.setObject("info.connected", {
            type: 'state',
            common: {
                name: "Connection status (true or false)",
                role: "",
                type: "boolean"
            },
            native: {}
        });
        new_objects.push(adapter.namespace + ".info.connected");

        adapter.setObject("info.state", {
            type: 'state',
            common: {
                name: "Connection status",
                role: "",
                type: "boolean"
            },
            native: {}
        });
        new_objects.push(adapter.namespace + ".info.state");

        adapter.setObject("info.pdu", {
            type: 'state',
            common: {
                name: "PDU size",
                role: "",
                type: "number"
            },
            native: {}
        });
        new_objects.push(adapter.namespace + ".info.pdu");
        adapter.setState("info.state", "not connected", true);
        adapter.setState("info.connected", false, true);


        var _db_size = [];


        for (var _key in db_size) {
            _db_size.push(db_size[_key]);
        }

        //clear unused states
        var i = 0;
        var l = old_objects.length;

        function clear() {
            if (i < l) {
                if (new_objects.indexOf(old_objects[i]) == -1) {
                    adapter.delObject(old_objects[i], function () {
                        i++;
                        clear();
                    });
                } else {
                    i++;
                    clear();
                }
            } else {
                old_objects = [];
                new_objects = [];
                adapter.subscribeStates('*');
                start();
            }
        }

        clear();


        function start() {
            s7client.ConnectTo(acp.ip, parseInt(acp.rack), parseInt(acp.slot), function (err) {
                var error_count = 0;
                if (err) {
                    adapter.log.error('Connection failed. Code #' + err);
                    adapter.setState("info.state", "connection error trying reconnect", true);
                    return setTimeout(start, (parseInt(acp.recon) || 60000));
                }

                connected = true;
                adapter.setState("info.state", "connected", true);
                adapter.setState("info.pdu", s7client.PDULength(), true);
                adapter.setState("info.connected", true, true);


                function poll() {
                    var start_t = (new Date()).valueOf();
                    async.parallel({
                            input: function (callback) {
                                if (input_msb) {
                                    s7client.EBRead(input_lsb, (input_msb - input_lsb + 30), function (err, res) {
                                        //s7client.EBRead(input_lsb, 380, function (err, res) {
                                        if (err) {
                                            callback(err);
                                        } else {

                                            for (n = 0; inputs.length > n; n++) {
                                                var id = "Inputs." + inputs[n].Address.split(".")[0] + "." + inputs[n].Name.replace(".", "_").replace(" ", "_");

                                                var addr = inputs[n].Address;
                                                var byte_addr = parseInt(addr.split(".")[0]) - input_lsb;
                                                var bit_addr = parseInt(addr.split(".")[1]);
                                                try {
                                                    write(id, res, inputs[n].Type, byte_addr, bit_addr);
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
                                if (output_msb) {
                                    s7client.ABRead(output_lsb, output_msb - output_lsb + 1, function (err, res) {
                                        if (err) {
                                            callback(err);
                                        } else {
                                            for (n = 0; outputs.length > n; n++) {
                                                var id = "Outputs." + outputs[n].Address.split(".")[0] + "." + outputs[n].Name.replace(".", "_").replace(" ", "_");

                                                var addr = outputs[n].Address;
                                                var byte_addr = parseInt(addr.split(".")[0]) - output_lsb;
                                                var bit_addr = parseInt(addr.split(".")[1]);
                                                try {
                                                    write(id, res, outputs[n].Type, byte_addr, bit_addr);
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
                                if (marker_msb) {
                                    s7client.MBRead(marker_lsb, marker_msb - marker_lsb + 4, function (err, res) {
                                        if (err) {
                                            callback(err);
                                        } else {
                                            for (n = 0; markers.length > n; n++) {

                                                var id = "Markers." + markers[n].Address.split(".")[0] + "." + markers[n].Name.replace(".", "_").replace(" ", "_");

                                                var addr      = markers[n].Address;
                                                var byte_addr = parseInt(addr.split(".")[0]) - marker_lsb;
                                                var bit_addr  = parseInt(addr.split(".")[1]);

                                                try {
                                                    write(id, res, markers[n].Type, byte_addr, bit_addr);
                                                } catch (err) {
                                                    adapter.log.error('Writing Marker. Code #' + err);
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

                                async.each(_db_size, function (db, callback) {
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
                                        callback(err);
                                    } else {
                                        for (n = 0; dbs.length > n; n++) {

                                            var addr = dbs[n].Address.split(" +")[1];
                                            var db = dbs[n].Address.split(" +")[0];

                                            var id = "DBs." + db + "." + dbs[n].Name.replace(".", "_").replace(" ", "_");
                                            var buff = buf[db];
                                            var byte_addr = parseInt(addr.split(".")[0]);
                                            var bit_addr = parseInt(addr.split(".")[1]);
                                            try {
                                                write(id, buff, dbs[n].Type, byte_addr, bit_addr);
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
                                error_count++;

                                adapter.log.warn('Poll error count : ' + error_count + " code: " + err);
                                adapter.setState("info.state", 'Poll error count : ' + error_count, true);

                                if (error_count < 6 && s7client.Connected()) {
                                    setTimeout(poll, parseInt(acp.poll));

                                } else {
                                    connected = false;
                                    adapter.log.error('try reconnection');
                                    adapter.setState("info.state", 'try reconnection', true);
                                    adapter.setState("info.connected", false, true);
                                    setTimeout(start, (parseInt(acp.recon) || 60000));
                                }

                            } else {

                                adapter.setState("info.poll_time", (new Date()).valueOf() - start_t, true);
                                if (error_count > 0) {
                                    adapter.setState("info.state", "connected", true);
                                    adapter.setState("info.connected", true, true);
                                    error_count = 0;
                                }

                                nextPoll = setTimeout(poll, parseInt(acp.poll));
                            }
                        }
                    );
                }

                poll();
            });
        }


        function write(id, buff, type, byte_addr, bit_addr) {
            var val = 0;
            var byte0 = "";
            var byte1 = "";
            var byte2 = "";
            var byte3 = "";

            if (type == "BOOL") {
                val = bin8(buff[byte_addr]).substring(7 - bit_addr, 7 - bit_addr + 1);
                if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                    ackObjects[id] = {"val": val};
                    adapter.setState(id, val, true);
                }
            } else if (type == "BYTE") {
                val = bin8(buff[byte_addr]);
                if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                    ackObjects[id] = {"val": val};
                    adapter.setState(id, val, true);
                }
            } else if (type == "WORD") {
                byte1 = bin8(buff[byte_addr]);
                byte0 = bin8(buff[byte_addr + 1]);

                val = byte1 + byte0;
                if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                    ackObjects[id] = {"val": val};
                    adapter.setState(id, val, true);
                }
            } else if (type == "DWORD") {
                byte3 = bin8(buff[byte_addr]);
                byte2 = bin8(buff[byte_addr + 1]);
                byte1 = bin8(buff[byte_addr + 2]);
                byte0 = bin8(buff[byte_addr + 3]);
                val = byte3 + byte2 + byte1 + byte0;
                if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                    ackObjects[id] = {"val": val};
                    adapter.setState(id, val, true);
                }
            } else if (type == "INT") {
                val = buff.readInt16BE(byte_addr);
                if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                    ackObjects[id] = {"val": val};
                    adapter.setState(id, val, true);
                }
            } else if (type == "DINT") {
                val = buff.readInt32BE(byte_addr);
                if (ackObjects[id] === undefined || ackObjects[id].val != val) {
                    ackObjects[id] = {"val": val};
                    adapter.setState(id, val, true);
                }
            } else if (type == "REAL") {
                val = buff.readFloatBE(byte_addr);
                var _val = parseFloat(Math.round(val * round) / round);

                if (ackObjects[id] === undefined || ackObjects[id].val != _val) {

                    ackObjects[id] = {"val": _val};
                    adapter.setState(id, _val, true);
                }
            }
        }


        //}
    });
}
