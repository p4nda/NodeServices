import { createServer } from 'http';
import { resolve } from 'path';
import { createRequire } from 'module';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function __generator(thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

function parseArgs(args) {
    // Very simplistic parsing which is sufficient for the cases needed. We don't want to bring in any external
    // dependencies (such as an args-parsing library) to this file.
    var result = {};
    var currentKey = null;
    args.forEach(function (arg) {
        if (arg.indexOf('--') === 0) {
            var argName = arg.substring(2);
            result[argName] = undefined;
            currentKey = argName;
        }
        else if (currentKey) {
            result[currentKey] = arg;
            currentKey = null;
        }
    });
    return result;
}

/*
In general, we want the Node child processes to be terminated as soon as the parent .NET processes exit,
because we have no further use for them. If the .NET process shuts down gracefully, it will run its
finalizers, one of which (in OutOfProcessNodeInstance.cs) will kill its associated Node process immediately.

But if the .NET process is terminated forcefully (e.g., on Linux/OSX with 'kill -9'), then it won't have
any opportunity to shut down its child processes, and by default they will keep running. In this case, it's
up to the child process to detect this has happened and terminate itself.

There are many possible approaches to detecting when a parent process has exited, most of which behave
differently between Windows and Linux/OS X:

 - On Windows, the parent process can mark its child as being a 'job' that should auto-terminate when
   the parent does (http://stackoverflow.com/a/4657392). Not cross-platform.
 - The child Node process can get a callback when the parent disconnects (process.on('disconnect', ...)).
   But despite http://stackoverflow.com/a/16487966, no callback fires in any case I've tested (Windows / OS X).
 - The child Node process can get a callback when its stdin/stdout are disconnected, as described at
   http://stackoverflow.com/a/15693934. This works well on OS X, but calling stdout.resume() on Windows
   causes the process to terminate prematurely.
 - I don't know why, but on Windows, it's enough to invoke process.stdin.resume(). For some reason this causes
   the child Node process to exit as soon as the parent one does, but I don't see this documented anywhere.
 - You can poll to see if the parent process, or your stdin/stdout connection to it, is gone
   - You can directly pass a parent process PID to the child, and then have the child poll to see if it's
     still running (e.g., using process.kill(pid, 0), which doesn't kill it but just tests whether it exists,
     as per https://nodejs.org/api/process.html#process_process_kill_pid_signal)
   - Or, on each poll, you can try writing to process.stdout. If the parent has died, then this will throw.
     However I don't see this documented anywhere. It would be nice if you could just poll for whether or not
     process.stdout is still connected (without actually writing to it) but I haven't found any property whose
     value changes until you actually try to write to it.

Of these, the only cross-platform approach that is actually documented as a valid strategy is simply polling
to check whether the parent PID is still running. So that's what we do here.
*/
var pollIntervalMs = 1000;
function exitWhenParentExits(parentPid, ignoreSigint) {
    setInterval(function () {
        if (!processExists(parentPid)) {
            // Can't log anything at this point, because out stdout was connected to the parent,
            // but the parent is gone.
            process.exit();
        }
    }, pollIntervalMs);
    {
        // Pressing ctrl+c in the terminal sends a SIGINT to all processes in the foreground process tree.
        // By default, the Node process would then exit before the .NET process, because ASP.NET implements
        // a delayed shutdown to allow ongoing requests to complete.
        //
        // This is problematic, because if Node exits first, the CopyToAsync code in ConditionalProxyMiddleware
        // will experience a read fault, and logs a huge load of errors. Fortunately, since the Node process is
        // already set up to shut itself down if it detects the .NET process is terminated, all we have to do is
        // ignore the SIGINT. The Node process will then terminate automatically after the .NET process does.
        //
        // A better solution would be to have WebpackDevMiddleware listen for SIGINT and gracefully close any
        // ongoing EventSource connections before letting the Node process exit, independently of the .NET
        // process exiting. However, doing this well in general is very nontrivial (see all the discussion at
        // https://github.com/nodejs/node/issues/2642).
        process.on('SIGINT', function () {
            console.log('Received SIGINT. Waiting for .NET process to exit...');
        });
    }
}
function processExists(pid) {
    try {
        // Sending signal 0 - on all platforms - tests whether the process exists. As long as it doesn't
        // throw, that means it does exist.
        process.kill(pid, 0);
        return true;
    }
    catch (ex) {
        // If the reason for the error is that we don't have permission to ask about this process,
        // report that as a separate problem.
        if (ex.code === 'EPERM') {
            throw new Error("Attempted to check whether process ".concat(pid, " was running, but got a permissions error."));
        }
        return false;
    }
}

var require = createRequire(import.meta.url);
var server = createServer(function (req, res) {
    readRequestBodyAsJson(req, function (bodyJson) { return __awaiter(void 0, void 0, void 0, function () {
        var hasSentResult, callback, resolvedPath, isESM, invokedModule, _a, func, synchronousException_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    hasSentResult = false;
                    callback = function (errorValue, successValue) {
                        if (!hasSentResult) {
                            hasSentResult = true;
                            if (errorValue) {
                                respondWithError(res, errorValue);
                            }
                            else if (typeof successValue !== 'string') {
                                // Arbitrary object/number/etc - JSON-serialize it
                                var successValueJson = void 0;
                                try {
                                    successValueJson = JSON.stringify(successValue);
                                }
                                catch (ex) {
                                    // JSON serialization error - pass it back to .NET
                                    respondWithError(res, ex);
                                    return;
                                }
                                res.setHeader('Content-Type', 'application/json');
                                res.end(successValueJson);
                            }
                            else {
                                // String - can bypass JSON-serialization altogether
                                res.setHeader('Content-Type', 'text/plain');
                                res.end(successValue);
                            }
                        }
                    };
                    // Support streamed responses
                    Object.defineProperty(callback, 'stream', {
                        enumerable: true,
                        get: function () {
                            if (!hasSentResult) {
                                hasSentResult = true;
                                res.setHeader('Content-Type', 'application/octet-stream');
                            }
                            return res;
                        }
                    });
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 5, , 6]);
                    resolvedPath = resolve(process.cwd(), bodyJson.moduleName);
                    isESM = resolvedPath.endsWith('.mjs');
                    if (!isESM) return [3 /*break*/, 3];
                    return [4 /*yield*/, import(resolvedPath)]; // Use dynamic import to load the ES module
                case 2:
                    _a = _b.sent(); // Use dynamic import to load the ES module
                    return [3 /*break*/, 4];
                case 3:
                    _a = require(resolvedPath);
                    _b.label = 4;
                case 4:
                    invokedModule = _a;
                    func = bodyJson.exportedFunctionName
                        ? invokedModule[bodyJson.exportedFunctionName]
                        : isESM || invokedModule.default === "null" ? invokedModule.default : invokedModule;
                    if (!func) {
                        throw new Error("The module \"".concat(resolvedPath, "\" has no export named \"").concat(bodyJson.exportedFunctionName, "\""));
                    }
                    func.apply(null, [callback].concat(bodyJson.args));
                    return [3 /*break*/, 6];
                case 5:
                    synchronousException_1 = _b.sent();
                    callback(synchronousException_1, null);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); });
});
var parsedArgs = parseArgs(process.argv);
var requestedPortOrZero = parsedArgs.port || 0; // 0 means 'let the OS decide'
server.listen(requestedPortOrZero, 'localhost', function () {
    var addressInfo = server.address();
    // Signal to HttpNodeHost which loopback IP address (IPv4 or IPv6) and port it should make its HTTP connections on
    console.log('[Microsoft.AspNetCore.NodeServices.HttpNodeHost:Listening on {' + addressInfo.address + '} port ' + addressInfo.port + '\]');
    // Signal to the NodeServices base class that we're ready to accept invocations
    console.log('[Microsoft.AspNetCore.NodeServices:Listening]');
});
exitWhenParentExits(parseInt(parsedArgs.parentPid));
function readRequestBodyAsJson(request, callback) {
    var requestBodyAsString = '';
    request.on('data', function (chunk) { requestBodyAsString += chunk; });
    request.on('end', function () { callback(JSON.parse(requestBodyAsString)); });
}
function respondWithError(res, errorValue) {
    res.statusCode = 500;
    res.end(JSON.stringify({
        errorMessage: errorValue.message || errorValue,
        errorDetails: errorValue.stack || null
    }));
}
