/*

   node-maildir demo file
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
var maildir = require("./main.js").maildir;
var path = "/home/ditesh/Maildir"; // This is slightly sloppy - be sure to specify your Maildir/ here

var box = new maildir(path);

box.on("error", function(err) {

    console.log("Some error occured: " + util.inspect(err));
    console.log("Quitting");
    process.exit(1);

});

box.on("init", function(status, err) {

    console.log("zef");

    if (status) {

        count = box.count();
        console.log("Successfully read maildir ("+count+" messages. Getting messages (if any).");

        if (count > 0) box.get(0);

    } else {

        console.log("Unable to read maildir because " + util.inspect(err));
        console.log("Quitting");

    }

});

box.on("get", function(status, msgnumber, data) {

    if (status === true) {

        console.log("Successfully got msg " + msgnumber);

        if (msgnumber + 1 < count) box.get(msgnumber+1);
        else box.delete(0);    // Uncomment this to delete all messages

    } else {

        console.log("Unable to get message "+msgnumber);
        console.log("Closing fd and quitting");
        fs.close(fd);
        process.exit(1);

    }
});

box.on("delete", function(status, msgnumber) {

    if (status === true) {

        console.log("Deleted message number " + msgnumber);
        console.log("Writing mboxrd to disk (this closes fd)");
        box.write(filename);

    } else {

        console.log("Unable to delete message number "+msgnumber);
        console.log("Closing fd and quitting");
        fs.close(fd);
        process.exit(1);

    }
});

