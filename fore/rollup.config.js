import { terser } from 'rollup-plugin-terser';
import autoExternal from 'rollup-plugin-auto-external';

const inputFile = 'index.js';
const outputFile = `dist/fore`;

const buildConfig = (format, extension) => ({
    input: inputFile,
    output: {
        file: `${outputFile}.${format}.${extension ?? 'js'}`,
        format,
        plugins: [terser()]
    },
    plugins: [autoExternal()],
});

export default [
    // ES6 bundle
    buildConfig('es'),
    // ES5|CJS bundle
    buildConfig('cjs', "cjs"),
];