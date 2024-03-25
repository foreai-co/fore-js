'use strict';

import humps from 'humps'

export const MetricType = {
    GROUNDEDNESS: "GROUNDEDNESS",
    SIMILARITY: "SIMILARITY",
}

export const camelizeKeys = (obj) => {
    // Custom function to process keys while preserving the capitalization of specific keys
    const customProcessKeys = (key, convert, options) => {
        // Preserve the capitalization of specific keys
        if (key === key.toUpperCase()) {
            return key;
        }
        // For other keys, use the default camelizing behavior
        return convert(key, options);
    };

    // Use humps.camelizeKeys with the custom camelizing function
    return humps.camelizeKeys(obj, customProcessKeys);
};