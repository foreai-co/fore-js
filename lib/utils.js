import { DataFrame } from 'pandas-js';

// Converts a dictionary to a pandas DataFrame.
export function convertToPandasDataFrame(data) {
    return new DataFrame(data);
}

export const MetricType = {
    GROUNDEDNESS: GROUNDEDNESS,
    SIMILARITY: SIMILARITY,
}