'use strict';

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { camelizeKeys } from 'humps';
import { convertToPandasDataFrame, MetricType } from './utils.js';

const GATEWAY_URL = "https://foresight-gatewayservice-dev.azurewebsites.net"; //"https://foresight-gateway.foreai.co";
const UI_URL = "https://icy-sand.foreai.co"; //"https://foresight.foreai.co";
const MAX_ENTRIES_BEFORE_FLUSH = 10;

/** The main client class for the foresight API.
 * @class Foresight
 */
class Foresight {
    /** 
     * @param {object} params - The parameters object.
     *  @param {string} params.apiToken - The API token to use for requests.
     *  @param {string?} params.apiUrl - The URL of the API to use for requests.
     *  @param {string?} params.uiUrl - The URL of the UI to use for requests.
     *  @param {number?} params.maxEntriesBeforeAutoFlush - The number of log entries to accumulate before flushing.
     * @returns {Foresight} - A new Foresight client.
     * @throws {Error} - An error from the API request.
     * */
    constructor({ apiToken, apiUrl = GATEWAY_URL, uiUrl = UI_URL, maxEntriesBeforeAutoFlush = MAX_ENTRIES_BEFORE_FLUSH, logLevel = 'info', axiosInstance }) {
        this.apiToken = apiToken;
        this.apiUrl = apiUrl;
        this.uiUrl = uiUrl;
        this.maxEntriesBeforeAutoFlush = maxEntriesBeforeAutoFlush;

        this.axiosInstance = axiosInstance || axios.create();
        this.timeoutSeconds = 60;
        this.logEntries = [];
        this.logging = console;
        this.logging.info("Foresight client initialized");

        this.axiosInstance.interceptors.response.use((response) => {
            if (response.data) {
                try {
                    response.data = camelizeKeys(response.data);
                } catch (_) { }
            }

            return response;
        });
    }

    /** Makes an HTTP request to the API.
     * @param {object} input - The parameters object.
     *  @param {string} input.method - The HTTP method to use.
     *  @param {string} input.endpoint - The API endpoint to call.
     *  @param {object|null} [input.params=null] - The query parameters to include in the request.
     *  @param {object|null} [input.inputJson=null] - The JSON payload to include in the request.
     * @returns {Promise<object>} - The response data from the API.
     * @throws {Error} - An error from the API request.
     * */
    async _makeRequest({ method, endpoint, params = null, inputJson = null }) {
        try {
            const response = await this.axiosInstance.request({
                method,
                url: `${this.apiUrl}${endpoint}`,
                headers: { Authorization: `Bearer ${this.apiToken}` },
                params,
                data: inputJson,
                timeout: this.timeoutSeconds * 1000,
            });

            return response.data;
        } catch (error) {
            if (error.response) this.logging.error("api:error:", `${error.response.status} : ${error.response.statusText}`);
            throw error;
        }
    }

    /** Creates a simple evalset from a list of queries and references.
     * @param {object} params - The parameters object.
     *  @param {string} params.evalsetId - String identifier of the evaluation set.
     *  @param {string[]} params.queries - A list of queries.
     *  @param {string[]?} params.referenceAnswers - Optional list of references/ground truth.
     * @returns {Promise<{
     *  evalsetId: string, 
     *  numEntries: int
     * }>} - an EvalsetMetadata object or raises an HTTPError on failure.
     * @throws {Error} - An error from the API request.
     * */
    async createSimpleEvalset({ evalsetId, queries, referenceAnswers = null }) {
        try {
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

            const response = await this._makeRequest({ method: "post", endpoint: "/api/eval/set", inputJson: evalset });
            this.logging.info(`Eval set with evalsetId ${evalsetId} created.`);
            return response;
        } catch (error) {
            const errorResponse = error.message;
            this.logging.error("createSimpleEvalset:error:", errorResponse);
            throw new Error(errorResponse);
        }
    }

    /** Gets the evaluation set with metadata.
     * @param {object} params - The parameters object.
     *  @param {string} params.evalsetId - String identifier of the evaluation set.
     * @returns {Promise<{
     *  evalsetId: string, 
     *  entries: [{
     *      creationTime: string, 
     *      entryId: string, 
     *      query: string, 
     *      referenceAnswer: string 
     *  }]
     * }>} - an Evalset object or raises an HTTPError on failure.
     * @throws {Error} - An error from the API request.
     * */
    async getEvalset({ evalsetId }) {
        try {
            return await this._makeRequest({ method: "get", endpoint: "/api/eval/set", params: { evalset_id: evalsetId } });
        } catch (error) {
            const errorResponse = error.message;
            this.logging.error("getEvalset:error:", errorResponse);
            throw new Error(errorResponse);
        }
    }

    /** Gets the queries associated with an eval run.
     * @param {object} params - The parameters object.
     *  @param {string} params.experimentId - String identifier of the evaluation run.
     * @returns {Promise<{[entryId: string]: string}>} - An object with (entryId, query) pairs, or raises an HTTPError on failure.
     * @throws {Error} - An error from the API request. 
     * */
    async getEvalrunQueries({ experimentId }) {
        try {
            return await this._makeRequest({ method: "get", endpoint: "/api/eval/run/queries", params: { experiment_id: experimentId } });
        } catch (error) {
            const errorResponse = error.message;
            this.logging.error("getEvalrunQueries:error:", errorResponse);
            throw new Error(errorResponse);
        }
    }

    /** Creates an evaluation run.
     * @param {object} runConfig - The configuration for running the eval.
     *   @param {string} runConfig.evalsetId - The identifier for the evalset to use for the evaluation.
     *   @param {string} runConfig.experimentId - The identifier for the evaluation run.
     *   @param {MetricType[]} runConfig.metrics - The metrics to be computed for the evaluation.
     * @returns {Promise<string>} - the HTTP response on success or raises an HTTPError on failure.
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

            this.logging.info(`Eval run with experimentId ${runConfig.experimentId} created.`);
            return response;
        } catch (error) {
            const errorResponse = error.message;
            this.logging.error("createEvalrun:error:", errorResponse);
            throw new Error(errorResponse);
        }
    }

    /** Creates an eval run entry, generates answers and runs the eval.
     * This method calls the generate_fn on each query in the evalset, triggers 
     * the metric computation and caches all results in a new eval run.
     * @param {object} params - The parameters object.
     *  @param {function} params.generateFn - A function that takes a query and returns an InferenceOutput.
     *  @param {object} params.runConfig - The configuration for running the eval.
     *   @param {string} params.runConfig.evalsetId - The identifier for the evalset to use for the evaluation.
     *   @param {string} params.runConfig.experimentId - The identifier for the evaluation run.
     *   @param {MetricType[]} params.runConfig.metrics - The metrics to be computed for the evaluation.
     * @returns {Promise<string>} - the HTTP response on success or raises an HTTPError on failure.
     * @throws {Error} - An error from the API request.
     * */
    async generateAnswersAndRunEval({ generateFn, runConfig }) {
        try {
            await this.createEvalrun({ runConfig });
            const experimentId = runConfig.experimentId;
            const queries = await this.getEvalrunQueries({ experimentId });
            const outputs = {};

            for (const [entryId, query] of Object.entries(queries)) {
                const { generatedResponse, contexts } = generateFn(query);

                outputs[entryId] = {
                    generated_response: generatedResponse,
                    contexts,
                };
            }

            const uploadRequest = {
                experiment_id: experimentId,
                entry_id_to_inference_output: outputs
            };

            const response = await this._makeRequest({ method: "put", endpoint: "/api/eval/run/entries", inputJson: uploadRequest });
            this.logging.info("Eval run successful. Visit %s to view results.", this.uiUrl);
            return response;
        } catch (error) {
            const errorResponse = error.message;
            this.logging.error("generateAnswersAndRunEval:error:", errorResponse);
            throw new Error(errorResponse);
        }
    }

    /** Flush the log entries and run evals on them.
     * Currently only Groundedness evals are run on the log entries.
     * @returns {Promise<string>} - The HTTP response on success or raises an HTTPError on failure.
     */
    async flush() {
        try {
            if (this.logEntries.length === 0) {
                this.logging.info("No log entries to flush.");
                return;
            }

            const logRequest = { log_entries: this.logEntries };

            const response = await this._makeRequest({ method: "put", endpoint: "/api/eval/log", inputJson: logRequest });
            this.logging.log("Log entries flushed successfully. Visit %s to view results.", this.uiUrl);

            // Clear log entries after flushing
            this.logEntries = [];
            return response;
        } catch (error) {
            const errorResponse = error.message;
            this.logging.error("flush:error:", errorResponse);
            throw new Error(errorResponse);
        }
    }

    /** Add log entries for evaluation. This only adds the entries
     * in memory, but does not send any requests to foresight service.
     * To send the request, flush needs to be called.
     * If the number of entries is greater than `maxEntriesBeforeAutoFlush`, then flushes the log entries as
     * well.
     * @param {object} params - The parameters object.
     *  @param {string} params.query - The query for evaluation.
     *  @param {string} params.response - The response from your AI system.
     *  @param {string[]} params.contexts - List of contexts relevant to the query.
     */
    async log({ query, response, contexts }) {
        try {
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
                await this.flush();
            }
        } catch (error) {
            const errorResponse = error.message;
            this.logging.error("log:error:", errorResponse);
            throw new Error(errorResponse);
        }
    }

    /** Converts an EvalRunDetails object to a DataFrame.
     * @param {object} details - The EvalRunDetails object to convert.
     */
    async _convertEvalRunDetailsToDataFrame(details) {
        try {
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

            return convertToPandasDataFrame(camelizeKeys(df));
        } catch (error) {
            throw error;
        }
    }

    /** Gets the details of an evaluation run.
     * @param {object} params - The parameters object.
     *  @param {string} params.experimentId - String identifier of the evaluation run.
     *  @param {string?} params.sortBy - The field to sort by.
     *  @param {number?} params.limit - The maximum number of entries to return.
     *  @param {boolean?} params.convertToDataframe - If True, returns a DataFrame instead of a 
     * EvalRunDetails object. Requires pandas to be installed.
     * @returns {Promise<any>} - an EvalRunDetails object or raises an HTTPError on failure. 
     * If pandas is installed and convertToDataframe is set to True, 
     * the results are converted to a DataFrame.
     * @throws {Error} - An error from the API request.
     */
    async getEvalrunDetails({ experimentId, sortBy = "input.query", limit = 100, convertToDataframe = true }) {
        try {
            const params = { experiment_id: experimentId };

            if (limit !== null && sortBy !== null) {
                params.sort_field_name = sortBy;
                params.limit = limit.toString();
            }

            const response = await this._makeRequest({ method: "get", endpoint: "/api/eval/run/details", params });

            if (convertToDataframe) {
                // Build a DataFrame from the response.
                return await this._convertEvalRunDetailsToDataFrame(response);
            }

            return response;
        } catch (error) {
            const errorResponse = error.message;
            this.logging.error("getEvalrunDetails:error:", errorResponse);
            throw new Error(errorResponse);
        }
    }
}

export default Foresight;
