// Limit dependencies to core Node modules. This means the code in this file has to be very low-level and unattractive,
// but simplifies things for the consumer of this module.
import { parseArgs } from './Util/ArgsUtil';
import { exitWhenParentExits } from './Util/ExitWhenParentExits';
import { createServer, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { resolve } from 'path';

// CommonJS support with ESM
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const server = createServer((req, res) => {
    readRequestBodyAsJson(req, async bodyJson => {
        let hasSentResult = false;
        const callback = (errorValue, successValue) => {
            if (!hasSentResult) {
                hasSentResult = true;
                if (errorValue) {
                    respondWithError(res, errorValue);
                } else if (typeof successValue !== 'string') {
                    // Arbitrary object/number/etc - JSON-serialize it
                    let successValueJson: string;
                    try {
                        successValueJson = JSON.stringify(successValue);
                    } catch (ex) {
                        // JSON serialization error - pass it back to .NET
                        respondWithError(res, ex);
                        return;
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.end(successValueJson);
                } else {
                    // String - can bypass JSON-serialization altogether
                    res.setHeader('Content-Type', 'text/plain');
                    res.end(successValue);
                }
            }
        };

        // Support streamed responses
        Object.defineProperty(callback, 'stream', {
            enumerable: true,
            get: function() {
                if (!hasSentResult) {
                    hasSentResult = true;
                    res.setHeader('Content-Type', 'application/octet-stream');
                }

                return res;
            }
        });

        try {
            const resolvedPath = resolve(process.cwd(), bodyJson.moduleName);
            const isESM = resolvedPath.endsWith('.mjs');
            
            const invokedModule = isESM
                ? await import(resolvedPath) // Use dynamic import to load the ES module
                : require(resolvedPath); // CommonJS (With ESM)
                         
            // Access the exported function if specified, otherwise use the default export
            // Fixed default export condition to support both ESM and CommonJS
            const func = bodyJson.exportedFunctionName
                ? invokedModule[bodyJson.exportedFunctionName]
                : isESM || invokedModule.default === "null" ? invokedModule.default : invokedModule;
            if (!func) {
                throw new Error(`The module "${resolvedPath}" has no export named "${bodyJson.exportedFunctionName}"`);
            }
            
            func.apply(null, [callback].concat(bodyJson.args));
        } catch (synchronousException) {
             callback(synchronousException, null);
        }
    });
});

const parsedArgs = parseArgs(process.argv);
const requestedPortOrZero = parsedArgs.port || 0; // 0 means 'let the OS decide'
server.listen(requestedPortOrZero, 'localhost', function () {
    const addressInfo = server.address() as AddressInfo;

    // Signal to HttpNodeHost which loopback IP address (IPv4 or IPv6) and port it should make its HTTP connections on
    console.log('[Microsoft.AspNetCore.NodeServices.HttpNodeHost:Listening on {' + addressInfo.address + '} port ' + addressInfo.port + '\]');

    // Signal to the NodeServices base class that we're ready to accept invocations
    console.log('[Microsoft.AspNetCore.NodeServices:Listening]');
});

exitWhenParentExits(parseInt(parsedArgs.parentPid), /* ignoreSigint */ true);

function readRequestBodyAsJson(request, callback) {
    let requestBodyAsString = '';
    request.on('data', chunk => { requestBodyAsString += chunk; });
    request.on('end', () => { callback(JSON.parse(requestBodyAsString)); });
}

function respondWithError(res: ServerResponse, errorValue: any) {
    res.statusCode = 500;
    res.end(JSON.stringify({
        errorMessage: errorValue.message || errorValue,
        errorDetails: errorValue.stack || null
    }));
}
