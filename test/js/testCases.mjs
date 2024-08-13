// Function signatures follow Node conventions.
// i.e., parameters: (callback, arg0, arg1, ... etc ...)
// When done, functions must invoke 'callback', passing (errorInfo, result)
// where errorInfo should be null/undefined if there was no error.

export function getFixedString(callback) {
    callback(null, 'test result');
}

export function getFixedStringWithDelay(callback) {
    setTimeout(() => callback(null, 'delayed test result'), 100);
}

export function raiseError(callback) {
    callback('This is an error from Node');
}

export function echoSimpleParameters(callback, param0, param1) {
    callback(null, `Param0: ${param0}; Param1: ${param1}`);
}

export function echoComplexParameters(callback, ...otherArgs) {
    callback(null, `Received: ${JSON.stringify(otherArgs)}`);
}

export function getComplexObject(callback) {
    callback(null, { stringProp: 'Hi from Node', intProp: 456, boolProp: true });
}
