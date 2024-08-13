// https://basarat.gitbook.io/typescript/main-1/defaultisbad
export default function (callback, message) {
    callback(null, `Hello from the default export. You passed: ${message}`);
};