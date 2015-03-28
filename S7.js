/**
 *
 * example adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "example",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js Example Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@example.com>"
 *          ]
 *          "desc":         "Example adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42
 *      }
 *  }
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.example.0
var adapter = utils.adapter('S7');


/*// is called when adapter shuts down - callback has to be called under any circumstances!
 adapter.on('unload', function (callback) {
 try {
 adapter.log.info('cleaned everything up...');
 callback();
 } catch (e) {
 callback();
 }
 });

 // todo
 adapter.on('discover', function (callback) {

 });

 // todo
 adapter.on('install', function (callback) {

 });

 // todo
 adapter.on('uninstall', function (callback) {

 });

 // is called if a subscribed object changes
 adapter.on('objectChange', function (id, obj) {
 adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
 });

 // is called if a subscribed state changes
 adapter.on('stateChange', function (id, state) {
 adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

 // you can use the ack flag to detect if state is desired or acknowledged
 if (!state.ack) {
 adapter.log.info('ack is not set!');
 }
 });

 // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
 adapter.on('message', function (obj) {
 if (typeof obj == "object" && obj.message) {
 if (obj.command == "send") {
 // e.g. send email or pushover or whatever
 console.log("send command");

 // Send response in callback if required
 if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
 }
 }
 });*/

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

function bin8(n) {
    return ("000000000" + n.toString(2)).substr(-8)
}

function main() {

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // adapter.config:
    //adapter.log.info('config test1: ' + adapter.config.test1);
    //adapter.log.info('config test1: ' + adapter.config.test2);


    /**
     *
     *      For every state in the system there has to be also an object of type state
     *
     *      Here a simple example for a boolean variable named "testVariable"
     *
     *      Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
     *
     */

    //adapter.setObject('testVariable', {
    //    type: 'state',
    //    common: {
    //        type: 'boolean'
    //    }
    //});

    // in this example all states changes inside the adapters namespace are subscribed
    //adapter.subscribeStates('*');

    //console.log(adapter.config);
    var snap7 = require('node-snap7');
    var async = require('async');

    var s7client = new snap7.S7Client();
    var ac = adapter.config;
    var acp = adapter.config.params;
    var BitArray = require('node-bitarray');
    var ieee754 = require('ieee754')
    var i;

    var inputs = [];
    var input_lsb;
    var input_msb;
    var input_size;

    var outputs = [];
    var output_lsb;
    var output_msb;
    var output_size;

    var merkers = [];
    var merker_lsb;
    var merker_msb;
    var merker_size;

    var dbs = [];

    var db_size = {};

    var old_objects = [];
    var ack_objects = {};

    adapter.getStates("*", function (err, list) {


        var n = 0;

        function clean(n) {
            for (var key in list) {
                old_objects.push(key)
            }
            var n = 0;
            adapter.delObject(old_objects[n], function () {
                var nn = n + 1;
                if (nn > old_objects.length - 1) {
                    start()
                } else {
                    clean(nn)
                }
            })
        }

        if (old_objects.length > 0) {
            clean(n)
        } else {
            start()
        }
        //clean(n)
        function start() {
            if (acp["inputs-poll"]) {
                inputs = ac.inputs;
            } else {
                for (i = 0; ac.inputs.length > i; i++) {
                    if (ac.inputs[i].poll == "Yes") {
                        inputs.push(this)
                    }
                }
            }

            if (acp["outputs-poll"]) {
                outputs = ac.outputs;
            } else {
                for (i = 0; ac.outputs.length > i; i++) {
                    if (ac.outputs[i].poll == "Yes") {
                        outputs.push(this)
                    }
                }
            }

            if (acp["merkers-poll"]) {
                merkers = ac.merkers;
            } else {
                for (i = 0; ac.merkers.length > i; i++) {
                    if (ac.merkers[i].poll == "Yes") {
                        merkers.push(this)
                    }
                }
            }

            if (acp["dbs-poll"]) {
                dbs = ac.dbs;
            } else {
                for (i = 0; ac.dbs.length > i; i++) {
                    if (ac.dbs[i].poll == "Yes") {
                        dbs.push(this)
                    }
                }
            }


            function SortByAdress(a, b) {
                var ad = parseFloat(a.Adress);
                var bd = parseFloat(b.Adress);
                return ((ad < bd) ? -1 : ((ad > bd) ? 1 : 0));
            }

            inputs.sort(SortByAdress);
            outputs.sort(SortByAdress);
            merkers.sort(SortByAdress);
            dbs.sort(SortByAdress);

            if (inputs.length > 0) {
                input_lsb = parseInt(inputs[0].Adress.split(".")[0]);
                input_msb = parseInt(inputs[inputs.length - 1].Adress.split(".")[0]);
                input_size = input_msb - input_lsb + 1;
            }
            if (outputs.length > 0) {
                output_lsb = parseInt(outputs[0].Adress.split(".")[0]);
                output_msb = parseInt(outputs[outputs.length - 1].Adress.split(".")[0]);
                output_size = output_msb - output_lsb + 1;
            }
            if (merkers.length > 0) {
                merker_lsb = parseInt(merkers[0].Adress.split(".")[0]);
                merker_msb = parseInt(merkers[merkers.length - 1].Adress.split(".")[0]);
                merker_size = merker_msb - merker_lsb + 1;
            }

            if (dbs.length > 0) {

                for (i = 0; dbs.length > i; i++) {
                    db_size[dbs[i].Adress.split(" ")[0]] = {
                        msb: 0,
                        db: dbs[i].Adress.split(" ")[0]
                    }

                }

                for (i = 0; dbs.length > i; i++) {
                    var db = dbs[i].Adress.split(" ")[0];
                    var addr = parseFloat(dbs[i].Adress.split(" ")[1].replace("+", ""));

                    var len = 1;
                    if (dbs[i].Type == "WORD" || dbs[i].Type == "INT") {
                        len = 2
                    }
                    if (dbs[i].Type == "DWORD" || dbs[i].Type == "DINT" || dbs[i].Type == "REAL") {
                        len = 4
                    }

                    addr = addr + len;

                    if (addr > db_size[db].msb) {
                        db_size[db].msb = addr;
                    }

                }

            }

            adapter.setObject("Inputs", {
                type: 'device',
                common: {
                    name: "Inputs"
                },
                native: {}
            });

            adapter.setObject("Outputs", {
                type: 'device',
                common: {
                    name: "Outputs"
                },
                native: {}
            });

            adapter.setObject("Merkers", {
                type: 'device',
                common: {
                    name: "Merkers"
                },
                native: {}
            });

            adapter.setObject("DBs", {
                type: 'device',
                common: {
                    name: "DBs"
                },
                native: {}
            });

            for (i = 0; inputs.length > i; i++) {

                var ch = (ac.inputs[i].Adress).split(".")[0];
                //var bit= (ac.inputs[i].Adress).split(".")[1] || 0;

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
                        enabled: false
                    },
                    native: {
                        adress: ac.inputs[i].Adress,
                        rw: ac.inputs[i].Adress
                    }
                });
            }

            for (i = 0; outputs.length > i; i++) {
                var ch = (ac.outputs[i].Adress).split(".")[0];
                //var bit= (ac.outputs[i].Adress).split(".")[1] || 0;

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
                        name: ac.outputs[i].Description,
                        role: ac.outputs[i].Type,
                        enabled: false
                    },
                    native: {
                        adress: ac.outputs[i].Adress,
                        rw: ac.outputs[i].Adress,
                    }
                });
            }

            for (i = 0; merkers.length > i; i++) {
                var ch = (ac.merkers[i].Adress).split(".")[0];
                //var bit= (ac.merkers[i].Adress).split(".")[1]  || 0;

                adapter.setObject("Merkers." + ch, {
                    type: 'channel',
                    common: {
                        name: ch
                    },
                    native: {}
                });
                adapter.setObject("Merkers." + ch + "." + ac.merkers[i].Name.replace(".", "_").replace(" ", "_"), {
                    type: 'state',
                    common: {
                        name: ac.merkers[i].Description,
                        role: ac.merkers[i].Type,
                        enabled: false
                    },
                    native: {
                        adress: ac.merkers[i].Adress,
                        rw: ac.merkers[i].Adress,
                    }
                });
            }

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
                var db = dbs[i].Adress.split(" ")[0];
                adapter.setObject("DBs." + db + "." + ac.dbs[i].Name.replace(".", "_").replace(" ", "_"), {
                    type: 'state',
                    common: {
                        name: ac.dbs[i].Description,
                        role: ac.dbs[i].Type,
                        enabled: false
                    },
                    native: {
                        adress: ac.dbs[i].Adress,
                        rw: ac.dbs[i].Adress,
                    }
                });
            }


            adapter.setObject("info", {
                type: '',
                common: {
                    name: "info",
                    enabled: false
                },
                native: {}
            });
            adapter.setObject("info.poll_time", {
                type: 'state',
                common: {
                    name: "info",
                    role:"",
                },
                native: {}
            });

            adapter.setObject("info.input_poll", {
                type: 'state',
                common: {
                    name: "info",
                    role:"",
                },
                native: {}
            });
            adapter.setObject("info.output_poll", {
                type: 'state',
                common: {
                    name: "info",
                    role:"",
                },
                native: {}
            });
            adapter.setObject("info.merker_poll", {
                type: 'state',
                common: {
                    name: "info",
                    role:"",
                },
                native: {}
            });
            adapter.setObject("info.dbs_poll", {
                type: 'state',
                common: {
                    name: "info",
                    role:"",
                },
                native: {}
            })

            var _db_size = [];


            for (var key in db_size) {
                _db_size.push(db_size[key])
            }


            function start() {
                s7client.ConnectTo(acp.ip, parseInt(acp.rack), parseInt(acp.slot), function (err) {
                    var error_count = 0;
                    if (err) {
                        console.log(' >> Connection failed. Code #' + err + ' - ' + s7client.ErrorText(err));
                        return setTimeout(start, 10000)
                    }

                    function poll() {
                        var start_t = (new Date).valueOf();
                        console.log("start poll")


                        async.parallel({
                                input: function (callback) {
                                    if (input_lsb && input_msb) {
                                        s7client.EBRead(input_lsb, (input_msb - input_lsb + 1), function (err, res) {
                                            //s7client.EBRead(input_lsb, 380, function (err, res) {
                                            if (err) {
                                                callback(err);
                                            } else {

                                                for (n = 0; inputs.length > n; n++) {
                                                    var id = "Inputs." + inputs[n].Adress.split(".")[0] + "." + inputs[n].Name.replace(".", "_").replace(" ", "_");

                                                    var addr = inputs[n].Adress
                                                    var byte_addr = parseInt(addr.split(".")[0]) - input_lsb;
                                                    var bit_addr = parseInt(addr.split(".")[1]);

                                                    write(id, res, inputs[n].Type, byte_addr, bit_addr)
                                                }
                                                callback(null);
                                            }
                                        });
                                    } else {
                                        callback(null, null);
                                    }
                                },
                                output: function (callback) {
                                    if (output_lsb && output_msb) {
                                        s7client.ABRead(output_lsb, output_msb - output_lsb + 1, function (err, res) {
                                            if (err) {
                                                callback(err);
                                            } else {
                                                for (n = 0; outputs.length > n; n++) {
                                                    var id = "Outputs." + outputs[n].Adress.split(".")[0] + "." + outputs[n].Name.replace(".", "_").replace(" ", "_");

                                                    var addr = outputs[n].Adress
                                                    var byte_addr = parseInt(addr.split(".")[0]) - output_lsb;
                                                    var bit_addr = parseInt(addr.split(".")[1]);

                                                    write(id, res, outputs[n].Type, byte_addr, bit_addr)
                                                }
                                                callback(null);
                                            }
                                        });
                                    } else {
                                        callback(null);
                                    }
                                },
                                merker: function (callback) {
                                    if (merker_lsb && merker_msb) {
                                        s7client.MBRead(merker_lsb, merker_msb - merker_lsb + 1, function (err, res) {
                                            if (err) {
                                                callback(err);
                                            } else {
                                                for (n = 0; merkers.length > n; n++) {
                                                    var id = "Merkers." + merkers[n].Adress.split(".")[0] + "." + merkers[n].Name.replace(".", "_").replace(" ", "_");

                                                    var addr = merkers[n].Adress
                                                    var byte_addr = parseInt(addr.split(".")[0]) - merker_lsb;
                                                    var bit_addr = parseInt(addr.split(".")[1]);

                                                    write(id, res, merkers[n].Type, byte_addr, bit_addr)
                                                }
                                                callback(null);
                                            }
                                        });

                                    } else {
                                        callback(null);
                                    }
                                },
                                dbs: function (callback) {
                                    var buf = {}

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
                                            callback(err)
                                        } else {
                                            for (n = 0; dbs.length > n; n++) {

                                                var addr = dbs[n].Adress.split(" +")[1]
                                                var db = dbs[n].Adress.split(" +")[0];

                                                var id = "DBs." + db + "." + dbs[n].Name.replace(".", "_").replace(" ", "_");
                                                var buff = buf[db]
                                                var byte_addr = parseInt(addr.split(".")[0]);
                                                var bit_addr = parseInt(addr.split(".")[1]);

                                                write(id, buff, dbs[n].Type, byte_addr, bit_addr)
                                            }
                                            callback(null)
                                        }

                                    })

                                }
                            },

                            function (err) {
                                if (err) {
                                    console.log(err)
                                    error_count++;
                                    if (error_count > 6) {
                                        setTimeout(start, parseInt(acp.poll))
                                    } else {
                                        setTimeout(poll, parseInt(acp.poll))
                                    }

                                } else {

                                    console.log("end poll: " + ((new Date).valueOf() - start_t).toString())
                                    adapter.setState("info.poll_time", (new Date).valueOf() - start_t);
                                    error_count = 0;
                                    setTimeout(poll, parseInt(acp.poll))
                                }
                            }
                        );
                    }

                    poll();
                });
            };

            function write(id, buff, type, byte_addr, bit_addr) {
                var val = 0;
                var byte0 = "";
                var byte1 = "";
                var byte2 = "";
                var byte3 = "";

                if (type == "BOOL") {
                    val = bin8(buff[byte_addr]).substring(7 - bit_addr, 7 - bit_addr + 1);
                    if (ack_objects[id] == undefined || ack_objects[id].val != val) {
                        ack_objects[id] = {"val": val}
                        adapter.setState(id, val, true);
                    }
                } else if (type == "BYTE") {
                    val = bin8(buff[byte_addr]);
                    if (ack_objects[id] == undefined || ack_objects[id].val != val) {
                        ack_objects[id] = {"val": val}
                        adapter.setState(id, val, true);
                    }
                } else if (type == "WORD") {
                    byte1 = bin8(buff[byte_addr]);
                    byte0 = bin8(buff[byte_addr + 1]);

                    val = byte1 + byte0;
                    if (ack_objects[id] == undefined || ack_objects[id].val != val) {
                        ack_objects[id] = {"val": val}
                        adapter.setState(id, val, true);
                    }
                } else if (type == "DWORD") {
                    byte3 = bin8(buff[byte_addr]);
                    byte2 = bin8(buff[byte_addr + 1]);
                    byte1 = bin8(buff[byte_addr + 2]);
                    byte0 = bin8(buff[byte_addr + 3]);
                    val = byte3 + byte2 + byte1 + byte0;
                    if (ack_objects[id] == undefined || ack_objects[id].val != val) {
                        ack_objects[id] = {"val": val}
                        adapter.setState(id, val, true);
                    }
                } else if (type == "INT") {
                    val = buff.readInt16BE(byte_addr);
                    if (ack_objects[id] == undefined || ack_objects[id].val != val) {
                        ack_objects[id] = {"val": val}
                        adapter.setState(id, val, true);
                    }
                } else if (type == "DINT") {
                    val = buff.readInt32BE(byte_addr);
                    if (ack_objects[id] == undefined || ack_objects[id].val != val) {
                        ack_objects[id] = {"val": val}
                        adapter.setState(id, val, true);
                    }
                } else if (type == "REAL") {
                    val = buff.readFloatBE(byte_addr);
                    if (ack_objects[id] == undefined || ack_objects[id].val != val) {
                        ack_objects[id] = {"val": val}
                        adapter.setState(id, val, true);
                    }
                }
            }

            start();

            /**
             *   setState examples
             *
             *   you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
             *
             */

            /*
             // the variable testVariable is set to true
             adapter.setState('testVariable', true);

             // same thing, but the value is flagged "ack"
             // ack should be always set to true if the value is received from or acknowledged from the target system
             adapter.setState('testVariable', {val: true, ack: true});

             // same thing, but the state is deleted after 30s (getState will return null afterwards)
             adapter.setState('testVariable', {val: true, ack: true, expire: 30});



             // examples for the checkPassword/checkGroup functions
             adapter.checkPassword('admin', 'iobroker', function (res) {
             console.log('check user admin pw ioboker: ' + res);
             });

             adapter.checkGroup('admin', 'admin', function (res) {
             console.log('check group user admin group admin: ' + res);
             });

             */
        };
    });
}
