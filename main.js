/*

   node-maildir library
   Copyright (C) 2011 Ditesh Shashikant Gathani <ditesh@gathani.org>

   Permission is hereby granted, free of charge, to any person obtaining a copy of
   this software and associated documentation files (the "Software"), to deal in
   the Software without restriction, including without limitation the rights to
   use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
   of the Software, and to permit persons to whom the Software is furnished to do
   so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.

*/

var fs = require("fs");
var util = require("util");
var fibers = require("fibers");
var events = require("events"); 
var unixlib = require("unixlib");

// We use futures to write slightly-saner code
var Future = require('fibers/future'), wait = Future.wait;
var stat = Future.wrap(fs.stat);
var rename = Future.wrap(fs.rename);
var readdir = Future.wrap(fs.readdir);
var unlink = Future.wrap(fs.unlink);

this.maildir = function(path, options) {

    if (options === undefined) options = {};

    // Private members follow
    var self = this;
    options.init = false;
    options.bufsize = (options.bufsize === undefined) ? 4096: options.bufsize; // Read/write buffer size
    options.tmppath = (options.tmppath === undefined) ? "/tmp": options.tmppath; // Temp buffer size

    var debug = options.debug || false;

    // This structure is the original data structure
    // Note that messages always ordered chronologically
    var omessages = {
        count: 0,
        size: 0,
        sizes: [],
        deleted:  {},
        filenames:  [],
    };

    // This structure can be manipulated (thru message deletion)
    // Note that messages always ordered chronologically
    var messages = {
        count: 0,
        size: 0,
        sizes: [],
        deleted: {},
        filenames: [],
    };

    // Priviledged methods follow
    this.count = function() {
        return messages.count;
    };

    this.get = function(msgnumber) {

        var self = this;

        if (options.init === false) {

            self.emit("error", "Specified maildir has not been fully parsed yet or there was an error parsing it (trap 'init' event for more details)");
            return false;

        }


        if (msgnumber > omessages.count || messages.deleted[msgnumber] !== undefined) { 

            self.emit("get", false, msgnumber);
            return false;

        } else {

            var buffer = new Buffer(messages.sizes[msgnumber]);
            fs.open(messages.filenames[msgnumber], "r", function(err, fd) {

                if (err) self.emit("get", err, msgnumber);
                else {

                        // I could use Futures here, but meh
                        fs.read(fd, buffer, 0, messages.sizes[msgnumber], 0, function(err, bytesRead, buffer) {
                            self.emit("get", true, msgnumber, buffer.toString());
                        });

                }
            });
        }
    };

    this.reset = function() {

        var self = this;

        if (options.init === false) {

            self.emit("error", "Specified mboxrd has not been fully parsed yet or there was an error parsing it (trap 'init' event for more details)");
            return false;

        }

        messages = omessages;
        self.emit("reset", true);

    };

    this.delete = function(msgnumber) {

        var self = this;

        if (options.init === false) {

            self.emit("error", "Specified maildir has not been fully parsed yet or there was an error parsing it (trap 'init' event for more details)");
            return false;

        }

        if (msgnumber > omessages.count || messages.deleted[msgnumber] !== undefined) { 

            self.emit("delete", false, msgnumber);
            return false;

        }

        var messagesize = messages.sizes[msgnumber]
        delete messages.sizes[msgnumber];
        messages.size -= messagesize;

        // We take advantage of implicity JS hashing to avoid O(n) lookups
        messages.deleted[msgnumber] = 1;
        self.emit("delete", true, msgnumber);

    };

    // Note that this closes fd
    this.write = function(filename) {

        for (var msgnumber in messages.deleted) {

            if (messages.deleted.hasOwnProperty(msgnumber)) {

                var filename = messages.filenames[msgnumber];

                try {
                    unlink(filename).wait();
                } catch(e) {
                    self.emit("write", err);
                    break;
                }
            }
        }
    };

    // Constructor code follows
    Fiber(function() {

        try {

            var curdir = false;
            var newdir = false;
            var files = readdir(path).wait();

            for (file in files) {

                if (files.hasOwnProperty(file)) {

                    if (stat(path + "/" + files[file]).wait().isDirectory() === true) {

                        if (files[file] === "cur") curdir = true;
                        else newdir = true;

                    }
                }
            }

            if (curdir === false && newdir === false) self.emit("init", false, "Cannot find cur/ and new/. Are you sure this is a Maildir?");
            else {

                // Move all files in new/ to cur/
                var newfiles = readdir(path + "/new").wait();

                for (file in newfiles) {

                    if (newfiles.hasOwnProperty(file)) {

                        var filename = path + "/new/" + newfiles[file];

                        if (stat(filename).wait().isFile() === true) {

                                // As per maildir spec at http://cr.yp.to/proto/maildir.html
                                var newfilename = path + "/cur/" + newfiles[file] + ":2,";
                                rename(filename, newfilename).wait();

                        }
                    }
                }

                var curfiles = readdir(path + "/cur").wait();
                var msgs = [];

                for (file in curfiles) {
                    if (curfiles.hasOwnProperty(file)) {

                        var info = stat(path + "/cur/" + curfiles[file]).wait()

                        if (info.isFile() === true) msgs.push({path: path + "/cur/" + curfiles[file], info: info});;

                    }
                }

                msgs.sort(function(a, b) { return a.info.ctime.getTime()-b.info.ctime.getTime() });

                for (msg in msgs) {

                    if (msgs.hasOwnProperty(msg)) {

                        omessages.count += 1;
                        omessages.size += msgs[msg].info.size;
                        omessages.sizes.push(msgs[msg].info.size);
                        omessages.filenames.push(msgs[msg].path);

                    }
                }

                messages = omessages;
                options.init = true;

                self.emit("init", true);

            }
        } catch(err) {
            self.emit("init", false, err);
        }

    }).run();
};

util.inherits(this.maildir, events.EventEmitter);
