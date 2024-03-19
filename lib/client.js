import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { convertToPandasDataFrame, MetricType } from './utils';

const GATEWAY_URL = "https://foresight-gateway.foreai.co";
const UI_URL = "https://foresight.foreai.co";
const MAX_ENTRIES_BEFORE_FLUSH = 10;

/** The main client class for the foresight API. 
 * @param {string} apiToken - The API token to use for requests.
 * @param {string} apiUrl - The URL of the API to use for requests.
 * @param {string} uiUrl - The URL of the UI to use for requests.
 * @param {number} maxEntriesBeforeAutoFlush - The number of log entries to accumulate before flushing.
 * @param {string} logLevel - The log level to use for the client.
 * @returns {Foresight} - A new Foresight client.
 * @throws {Error} - An error from the API request.
 * */
class Foresight {
    constructor({ apiToken, apiUrl = GATEWAY_URL, uiUrl = UI_URL, maxEntriesBeforeAutoFlush = MAX_ENTRIES_BEFORE_FLUSH, logLevel = 'info' }) {
        this.apiToken = apiToken;
        this.apiUrl = apiUrl;
        this.uiUrl = uiUrl;
        this.maxEntriesBeforeAutoFlush = maxEntriesBeforeAutoFlush;

        this.timeoutSeconds = 60;
        this.logEntries = [];
        this.logging = console;
        this.logging.info("Foresight client initialized");
    }

    /** Makes an HTTP request to the API.
     * @param {string} method - The HTTP method to use.
     * @param {string} endpoint - The API endpoint to call.
     * @param {object?} params - The query parameters to include in the request.
     * @param {object} inputJson - The JSON payload to include in the request.
     * @returns {Promise<object>} - The response data from the API.
     * @throws {Error} - An error from the API request.
     * */
    async _makeRequest({ method, endpoint, params = null, inputJson = null }) {
        try {
            const response = await axios({
                method,
                url: `${this.apiUrl}${endpoint}`,
                headers: { Authorization: `Bearer ${this.apiToken}` },
                params,
                data: inputJson,
                timeout: this.timeoutSeconds * 1000
            });

            if (response.status !== 200) {
                this.logging.error(response.data);
            }

            return response.data;
        } catch (error) {
            this.logging.error(error);
            throw error;
        }
    }

    /** Creates a simple evalset from a list of queries and references.
     * @param {string} evalsetId - String identifier of the evaluation set.
     * @param {string[]} queries - A list of queries.
     * @param {string[]} referenceAnswers - Optional list of references/ground truth.
     * @returns {Promise<any>} - an EvalsetMetadata object or raises an HTTPError on failure.
     * @throws {Error} - An error from the API request.
     * */
    async createSimpleEvalset({ evalsetId, queries, referenceAnswers = null }) {
        if (evalsetId == null || queries == null) {
            throw new Error("evalsetId and queries are required.");
        }

        if (referenceAnswers && queries.length !== referenceAnswers.length) {
            throw new Error("Number of queries and references must match.");
        }

        const entries = queries.map((query, index) => ({
            query,
            reference_answer: referenceAnswers ? referenceAnswers[index] : null,
            entry_id: uuidv4()
        }));

        const evalset = {
            evalset_id: evalsetId,
            evalset_entries: entries
        };

        try {
            return await this._makeRequest({ method: "post", endpoint: "/api/eval/set", inputJson: evalset });
        } catch (error) {
            throw error;
        }
    }

    /** Gets the evaluation set with metadata.
     * @param {string} evalsetId - String identifier of the evaluation set.
     * @returns {Promise<any>} - an Evalset object or raises an HTTPError on failure.
     * @throws {Error} - An error from the API request.
     * */
    async getEvalset({ evalsetId }) {
        try {
            return await this._makeRequest({ method: "get", endpoint: "/api/eval/set", params: { evalset_id: evalsetId } });
        } catch (error) {
            throw error;
        }
    }

    /** Gets the queries associated with an eval run.
     * @param {string} experimentId - String identifier of the evaluation run.
     * @returns {Promise<any>} - a object with (entry_id, query) pairs, or raises an HTTPError on failure.
     * @throws {Error} - An error from the API request. 
     * */
    async getEvalrunQueries({ experimentId }) {
        try {
            return await this._makeRequest({ method: "get", endpoint: "/api/eval/run/queries", params: { experiment_id: experimentId } });
        } catch (error) {
            throw error;
        }
    }

    /** Creates an evaluation run.
     * @param {object} runConfig - The configuration for running the eval.
     *   @param {string} runConfig.evalsetId - The identifier for the evalset to use for the evaluation.
     *   @param {string} runConfig.experimentId - The identifier for the evaluation run.
     *   @param {MetricType[]} runConfig.metrics - The metrics to be computed for the evaluation.
     * @returns {Promise<any>} - the HTTP response on success or raises an HTTPError on failure.
     * @throws {Error} - An error from the API request.
     * */
    async createEvalrun({ runConfig }) {
        try {
            const response = await this._makeRequest({
                method: "post", endpoint: "/api/eval/run", inputJson: {
                    evalset_id: runConfig.evalsetId,
                    experiment_id: runConfig.experimentId,
                    metrics: runConfig.metrics,
                }
            });

            if (response.status === 200) this.logging.info(`Eval run with experiment_id ${runConfig.experimentId} created.`);
            return response;
        } catch (error) {
            throw error;
        }
    }

    /** Creates an eval run entry, generates answers and runs the eval.
     * This method calls the generate_fn on each query in the evalset, triggers 
     * the metric computation and caches all results in a new eval run.
     * @param {function} generateFn - A function that takes a query and returns an InferenceOutput.
     * @param {object} runConfig - The configuration for running the eval.
     *   @param {string} runConfig.evalsetId - The identifier for the evalset to use for the evaluation.
     *   @param {string} runConfig.experimentId - The identifier for the evaluation run.
     *   @param {MetricType[]} runConfig.metrics - The metrics to be computed for the evaluation.
     * @returns {Promise<any>} - the HTTP response on success or raises an HTTPError on failure.
     * @throws {Error} - An error from the API request.
     * */
    async generateAnswersAndRunEval({ generateFn, runConfig }) {
        try {
            await this.createEvalrun({ runConfig });
            const experimentId = runConfig.experimentId;
            const queries = await this.getEvalrunQueries({ experimentId });
            const outputs = {};

            for (const [entry_id, query] of Object.entries(queries)) {
                const inferenceOutput = generateFn(query);
                outputs[entry_id] = inferenceOutput;
            }

            const uploadRequest = {
                experiment_id: experimentId,
                entry_id_to_inference_output: outputs
            };

            const response = await this._makeRequest({ method: "put", endpoint: "/api/eval/run/entries", inputJson: uploadRequest });
            if (response.status === 200) this.logging.info("Eval run successful. Visit %s to view results.", this.uiUrl);
            return response;
        } catch (error) {
            throw error;
        }
    }

    /** Flush the log entries and run evals on them.
     * Currently only Groundedness evals are run on the log entries.
     * @returns {Promise<any>} - The HTTP response on success or raises an HTTPError on failure.
     */
    async flush() {
        if (this.logEntries.length === 0) {
            this.logging.info("No log entries to flush.");
            return;
        }

        const logRequest = { log_entries: this.logEntries };

        try {
            const response = await this._makeRequest({ method: "put", endpoint: "/api/eval/log", inputJson: logRequest });
            if (response.status === 200) this.logging.log("Log entries flushed successfully. Visit %s to view results.", this.uiUrl);
            // Clear log entries after flushing
            this.logEntries = [];
            return response;
        } catch (error) {
            throw error;
        }
    }

    /** Add log entries for evaluation. This only adds the entries
     * in memory, but does not send any requests to foresight service.
     * To send the request, flush needs to be called.
     * If the number of entries is greater than `maxEntriesBeforeAutoFlush`, then flushes the log entries as
     * well.
     * @param {string} query - The query for evaluation.
     * @param {string} response - The response from your AI system.
     * @param {string[]} contexts - List of contexts relevant to the query.
     */
    log({ query, response, contexts }) {
        const inferenceOutput = {
            generated_response: response,
            contexts: contexts
        };

        const logEntry = {
            query: query,
            inference_output: inferenceOutput
        };

        this.logEntries.push(logEntry);

        if (this.logEntries.length >= this.maxEntriesBeforeAutoFlush) {
            // Auto flush if the number of entries is greater than a
            // certain threshold.
            this.flush();
        }
    }

    /** Converts an EvalRunDetails object to a DataFrame.
     * @param {object} details - The EvalRunDetails object to convert.
     */
    async _convertEvalRunDetailsToDataFrame(details) {
        const df = {
            query: [],
            reference_answer: [],
            generated_answer: [],
            source_docids: [],
            contexts: [],
        };

        // TODO: use this line when we implement all metrics.
        // const evalMetrics = Object.keys(MetricType);
        const evalMetrics = [MetricType.GROUNDEDNESS, MetricType.SIMILARITY];

        for (const m of evalMetrics) {
            df[m.toLowerCase()] = [];
        }

        for (const entry of details.entries) {
            df.query.push(entry.input.query);
            df.reference_answer.push(entry.input.reference_answer);
            df.generated_answer.push(entry.output.generated_response);
            df.source_docids.push(entry.output.source_docids);
            df.contexts.push(entry.output.contexts);
            // TODO: once we implement batching / parallel processing,
            // make an update here to handle the case of entries with not
            // yet computed metrics.
            for (const m of evalMetrics) {
                if (m in entry.metric_values) {
                    df[m.toLowerCase()].push(entry.metric_values[m]);
                } else {
                    df[m.toLowerCase()].push(null);
                }
            }
        }

        return convertToPandasDataFrame(df);
    }

    /** Gets the details of an evaluation run.
     * @param {string} experimentId - String identifier of the evaluation run.
     * @param {string} sortBy - The field to sort by.
     * @param {number} limit - The maximum number of entries to return.
     * @param {boolean} convertToDataframe - If True, returns a DataFrame instead of a 
     * EvalRunDetails object. Requires pandas to be installed.
     * @returns {Promise<any>} - an EvalRunDetails object or raises an HTTPError on failure. 
     * If pandas is installed and convertToDataframe is set to True, 
     * the results are converted to a DataFrame.
     * @throws {Error} - An error from the API request.
     */
    async getEvalrunDetails({ experimentId, sortBy = "input.query", limit = 100, convertToDataframe = true }) {
        const params = { experiment_id: experimentId };

        if (limit !== null && sortBy !== null) {
            params.sort_field_name = sortBy;
            params.limit = limit.toString();
        }

        try {
            const response = await this._makeRequest({ method: "get", endpoint: "/api/eval/run/details", params });
            const details = response;

            if (convertToDataframe) {
                // Build a DataFrame from the response.
                return await this._convertToPandasDataFrame(details);
            }

            return details;
        } catch (error) {
            throw error;
        }
    }
}

export default Foresight;
