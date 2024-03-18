import { DataFrame } from 'pandas-js';

function convertToPandasDataFrame(data) {
    const df = new DataFrame(data);
    return df;
}

export default convertToPandasDataFrame;