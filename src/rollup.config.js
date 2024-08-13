//import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'TypeScript/HttpNodeInstanceEntryPoint.ts',
    output: {
        file: 'Content/Node/entrypoint-http.mjs',
        format: 'esm',
    },
    plugins: [typescript(), commonjs()],
};