var fs = require("fs");
var Future = require('fibers/future'), wait = Future.wait;

var readdir = Future.wrap(fs.readdir);
var stat = Future.wrap(fs.stat);

Fiber(function() {

    try {
        var files = readdir('potato').wait();
    } catch (e) {
        console.log(e);
    }

    console.log(files);
    
}).run();
