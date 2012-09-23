// common.js
//
// Common utilities for activitypump scripts
//
// Copyright 2011, 2012 StatusNet Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var http = require("http"),
    fs = require("fs"),
    path = require("path"),
    Step = require("step"),
    urlparse = require("url").parse,
    querystring = require("querystring"),
    url = require("url"),
    OAuth = require("oauth").OAuth,
    _ = require("underscore");

var newOAuth = function(serverURL, cred) {
    var oa, parts;

    parts = urlparse(serverURL);

    oa = new OAuth("http://"+parts.host+"/oauth/request_token",
                   "http://"+parts.host+"/oauth/access_token",
                   cred.client_id,
                   cred.client_secret,
                   "1.0",
                   null,
                   "HMAC-SHA1",
                   null, // nonce size; use default
                   {"User-Agent": "activitypump-scripts/0.1.0"});

    return oa;
};

var jsonHandler = function(callback) {
    return function(err, data, response) {
        var obj;
        if (err) {
            callback(err, null, null);
        } else {
            try {
                obj = JSON.parse(data);
                callback(null, obj, response);
            } catch (e) {
                callback(e, null, null);
            }
        }
    };
};

var postJSON = function(serverUrl, cred, payload, callback) {

    var oa, toSend;

    oa = newOAuth(serverUrl, cred);
    
    toSend = JSON.stringify(payload);

    oa.post(serverUrl, cred.token, cred.token_secret, toSend, "application/json", jsonHandler(callback));
};

var postReport = function(payload) {
    return function(err, res, body) {
        if (err) {
            if (_(payload).has("id")) {
                console.log("Error posting payload " + payload.id);
            } else {
                console.log("Error posting payload");
            }
            console.error(err);
        } else {
            if (_(payload).has("id")) {
                console.log("Results of posting " + payload.id + ": " + body);
            } else {
                console.log("Results of posting: " + body);
            }
        }
    };
};

var postArgs = function(serverUrl, args, callback) {

    var requestBody = querystring.stringify(args);

    var parts = url.parse(serverUrl);

    // An object of options to indicate where to post to
    var options = {
        host: parts.hostname,
        port: parts.port,
        path: parts.path,
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": requestBody.length,
            "User-Agent": "activitypump/0.1.0dev"
        }
    };

    // Set up the request

    var req = http.request(options, function(res) {
        var body = "";
        var err = null;
        res.setEncoding("utf8");
        res.on("data", function(chunk) {
            body = body + chunk;
        });
        res.on("error", function(err) {
            callback(err, null, null);
        });
        res.on("end", function() {
            callback(err, res, body);
        });
    });

    // post the data
    req.write(requestBody);
    req.end();
};

var clientCred = function(host, callback) {

    Step(
        function() {
            var credFile = path.join(process.env.HOME, ".pump.d", host + ".json");
            fs.readFile(credFile, this);
        },
        function(err, data) {
            var cred;
            if (err) throw err;
            cred = JSON.parse(data);
            this(null, cred);
        },
        callback
    );
};

var setClientCred = function(host, cred, callback) {

    var dirName = path.join(process.env.HOME, ".pump.d"),
        fname = path.join(dirName, host + ".json");

    Step(
        function() {
            fs.stat(dirName, this);
        },
        function(err, stat) {
            if (err) {
                if (err.code == 'ENOENT') {
                    fs.mkdir(dirName, 0700, this);
                } else {
                    throw err;
                }
            } else if (!stat.isDirectory()) {
                throw new Error(dirName + " is not a directory");
            } else {
                this(null);
            }
        },
        function(err) {
            if (err) throw err;
            fs.writeFile(fname, JSON.stringify(cred), this);
        },
        function(err) {
            if (err) throw err;
            fs.chmod(fname, 0600, this);
        },
        callback
    );
};

exports.postJSON = postJSON;
exports.postReport = postReport;
exports.postArgs = postArgs;
exports.setClientCred = setClientCred;
exports.clientCred = clientCred;
