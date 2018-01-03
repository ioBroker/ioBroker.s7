var snap7   = require('node-snap7');
var iconvTo;
var iconvToL;
try {
    var Iconv   = require('iconv').Iconv;
    iconvTo = new Iconv('UTF-8', 'ISO-8859-1');
} catch (e) {
    iconvToL = require('iconv-lite');
}

function Server() {
    this.s7server = new snap7.S7Server();

    // Set up event listener
    this.s7server.on('event', function(event) {
        console.log(this.s7server.EventText(event));
    }.bind(this));

    // Create a new Buffer and register it to the server as DB1
    var db1 = new Buffer(1000);
    for (var i = 0; i < db1.length; i++) {
        db1[i] = i;
    }
    /*var str;
    if (iconvTo) {
        str = iconvTo.convert('My üäöstring');
    } else {
        str = iconvToL.encode('My üäöstring', 'iso-8859-1');
    }
    db1[4] = 32;
    db1[5] = str.byteLength;
    str.copy(db1, 6);

    var db2 = new Buffer(65535);
    for (var j = 0; j < db2.length; j++) {
        db2[j] = j;
    }*/

    this.start = function (bind) {
        this.s7server.RegisterArea(this.s7server.srvAreaDB, 1, db1);
        this.s7server.RegisterArea(this.s7server.srvAreaDB, 2, db2);
        // Start the server
        this.s7server.StartTo(bind || '127.0.0.1');
    }.bind(this);

    this.stop = function () {
        this.s7server.Stop();
        this.s7server.UnregisterArea(this.s7server.srvAreaDB, 1);
        this.s7server.UnregisterArea(this.s7server.srvAreaDB, 2);
    }.bind(this);

    return this;
}
if (module && module.parent) {
    module.exports = Server;
} else {
    var server = new Server();
    server.start();
}


