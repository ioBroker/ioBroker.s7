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
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

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
    var s7client = new snap7.S7Client();
    var ac = adapter.config;
    var acp = adapter.config.params;
var i;

    var inputs = [];

    if(acp["inputs-pool"]){
        inputs = ac.inputs;
    }else{
        for(i=0; ac.inputs.length > i; i++){
            var x = ac.inputs[i];
            if(ac.inputs[i].Pool == "Yes"){
                inputs.push(this)
            }
        }
    }


    function SortByAdress(a, b) {
        var ad = parseFloat(a.Adress);
        var bd = parseFloat(b.Adress);
        return ((ad < bd) ? -1 : ((ad > bd) ? 1 : 0));
    }

    inputs.sort(SortByAdress);




        adapter.setObject("Inputs", {
            type: 'group',
            common: {
                name: "Inputs",
                enabled: false
            },
            native: {}
        });

        for(i=0; inputs.length > i; i++){
            adapter.setObject("Inputs."+(ac.inputs[i].Adress).replace(/\./g,"_")+' - '+(ac.inputs[i].Name).replace(/\./g,"_"), {
                type: 'state',
                common: {
                    name: ac.inputs[i].Description,
                    role: ac.inputs[i].Type,
                    enabled: false
                },
                native: {
                    adress: ac.inputs[i].Adress,
                    rw: ac.inputs[i].Adress,
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

    adapter.setObject("info.input_pool", {
        type: 'state',
        common: {
            name: "info",
            enabled: false
        },
        native: {}
    });


    s7client.ConnectTo('192.168.12.10', 0, 2, function(err) {

        if(err){
            return console.log(' >> Connection failed. Code #' + err + ' - ' + s7client.ErrorText(err));
        }

        function pool() {
            s7client.EBRead(4, 9, function (err, res) {
                if (err)
                    return console.log(' >> ABRead failed. Code #' + err + ' - ' + s7client.ErrorText(err));


                var arrayBuffer = new Uint8Array(res).buffer;

                adapter.setState("info.input_pool", arrayBuffer[0].toString(2));
                console.log(arrayBuffer)


            });
            setTimeout(pool, 1000)
        }

        pool();


    });


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


}
