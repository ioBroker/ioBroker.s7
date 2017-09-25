/* jshint -W097 */// jshint strict:false
/*jslint node: true */
var expect = require('chai').expect;
var setup  = require(__dirname + '/lib/setup');

var objects = null;
var states  = null;
var onStateChanged = null;
var onObjectChanged = null;
var sendToID = 1;
var Server = require(__dirname + '/lib/s7Server.js');
var server;

var adapterShortName = setup.adapterName.substring(setup.adapterName.indexOf('.') + 1);
var runningMode = require(__dirname + '/../io-package.json').common.mode;

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    console.log('Try check #' + counter);
    if (counter > 30) {
        if (cb) cb('Cannot check connection');
        return;
    }

    states.getState('system.adapter.' + adapterShortName + '.0.alive', function (err, state) {
        if (err) console.error(err);
        if (state && state.val) {
            if (cb) cb();
        } else {
            setTimeout(function () {
                checkConnectionOfAdapter(cb, counter + 1);
            }, 1000);
        }
    });
}

function checkValueOfState(id, value, cb, counter) {
    counter = counter || 0;
    if (counter > 20) {
        if (cb) cb('Cannot check value Of State ' + id);
        return;
    }

    states.getState(id, function (err, state) {
        if (err) console.error(err);
        if (value === null && !state) {
            if (cb) cb();
        } else
        if (state && (value === undefined || state.val === value)) {
            if (cb) cb();
        } else {
            setTimeout(function () {
                checkValueOfState(id, value, cb, counter + 1);
            }, 500);
        }
    });
}

function sendTo(target, command, message, callback) {
    onStateChanged = function (id, state) {
        if (id === 'messagebox.system.adapter.test.0') {
            callback(state.message);
        }
    };

    states.pushMessage('system.adapter.' + target, {
        command:    command,
        message:    message,
        from:       'system.adapter.test.0',
        callback: {
            message: message,
            id:      sendToID++,
            ack:     false,
            time:    (new Date()).getTime()
        }
    });
}

describe('Test ' + adapterShortName + ' adapter', function() {
    before('Test ' + adapterShortName + ' adapter: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm

        setup.setupController(function () {
            var config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled  = true;
            config.common.loglevel = 'debug';
            config.native.params = {
                "ip": "127.0.0.1",
                "rack": "0",
                "slot": "2",
                "localTSAP": null,
                "remoteTSAP": null,
                "round": "2",
                "poll": "1000",
                "recon": "60000",
                "pulsetime": "1000"
            };
            config.native.dbs = [
                {
                    "Address": "DB1 10",
                    "Name": "",
                    "Description": "",
                    "Type": "WORD",
                    "Length": "",
                    "Unit": "",
                    "Role": "value",
                    "Room": "",
                    "poll": true,
                    "RW": false,
                    "WP": false
                },
                {
                    "Address": "DB1 12",
                    "Name": "",
                    "Description": "",
                    "Type": "WORD",
                    "Length": "",
                    "Unit": "",
                    "Role": "",
                    "Room": "",
                    "poll": true,
                    "RW": false,
                    "WP": false
                },
                {
                    "Address": "DB1 14.0",
                    "Name": "",
                    "Description": "",
                    "Type": "BOOL",
                    "Length": "",
                    "Unit": "",
                    "Role": "state",
                    "Room": "",
                    "poll": true,
                    "RW": false,
                    "WP": false
                },
                {
                    "Address": "DB1 14.1",
                    "Name": "",
                    "Description": "",
                    "Type": "BOOL",
                    "Length": "",
                    "Unit": "",
                    "Role": "",
                    "Room": "",
                    "poll": true,
                    "RW": false,
                    "WP": false
                }
            ];


            //config.native.dbtype   = 'sqlite';

            setup.setAdapterConfig(config.common, config.native);
            if (/^win/.test(process.platform) || /^darwin/.test(process.platform)) {
                server = new Server();
                server.start();
            }

            setup.startController(true, function(id, obj) {}, function (id, state) {
                    if (onStateChanged) onStateChanged(id, state);
                },
                function (_objects, _states) {
                    objects = _objects;
                    states  = _states;
                    _done();
                });
        });
    });

    it('Test ' + adapterShortName + ' instance object: it must exists', function (done) {
        objects.getObject('system.adapter.' + adapterShortName + '.0', function (err, obj) {
            expect(err).to.be.null;
            expect(obj).to.be.an('object');
            expect(obj).not.to.be.null;
            done();
        });
    });

    it('Test ' + adapterShortName + ' adapter: Check if adapter started', function (done) {
        this.timeout(60000);
        checkConnectionOfAdapter(function (res) {
            if (res) console.log(res);
            if (runningMode === 'daemon') {
                expect(res).not.to.be.equal('Cannot check connection');
            } else {
                //??
            }
            done();
        });
    });

    it('Test ' + adapterShortName + ' adapter: Read words', function (done) {
        this.timeout(10000);
        // Linux required sudo for ports < 1000. S7 Server runs on TCP 102
        if (server) {
            setTimeout(function () {
                states.getState(adapterShortName + '.0.DBs.DB1.10', function (err, state) { //s7.0.DBs.DB1.10
                    expect(state.val).to.be.equal(0x0A0B);
                    states.getState(adapterShortName + '.0.DBs.DB1.12', function (err, state) { //s7.0.DBs.DB1.10
                        expect(state.val).to.be.equal(0x0C0D);

                        states.getState(adapterShortName + '.0.DBs.DB1.14_0', function (err, state) { //s7.0.DBs.DB1.10
                            expect(state.val).to.be.equal(false);

                            states.getState(adapterShortName + '.0.DBs.DB1.14_1', function (err, state) { //s7.0.DBs.DB1.10
                                expect(state.val).to.be.equal(true);
                                done();
                            });
                        });
                    });
                });
            }, 1000);
        } else {
            done();
        }
    });

/**/

/*
    PUT YOUR OWN TESTS HERE USING
    it('Testname', function ( done) {
        ...
    });

    You can also use "sendTo" method to send messages to the started adapter
*/

    after('Test ' + adapterShortName + ' adapter: Stop js-controller', function (done) {
        this.timeout(10000);
        server.stop();
        server = null;
        setup.stopController(function (normalTerminated) {
            console.log('Adapter normal terminated: ' + normalTerminated);
            done();
        });
    });
});