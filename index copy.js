import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const GATEWAY_URL = "https://foresight-gateway.foreai.co";
const UI_URL = "https://foresight.foreai.co";
const MAX_ENTRIES_BEFORE_FLUSH = 10;

class Foresight {
    constructor(apiToken, apiUrl = GATEWAY_URL, uiUrl = UI_URL, maxEntriesBeforeAutoFlush = MAX_ENTRIES_BEFORE_FLUSH) {
        this.apiToken = apiToken;
        this.apiUrl = apiUrl;
        this.uiUrl = uiUrl;
        this.maxEntriesBeforeAutoFlush = maxEntriesBeforeAutoFlush;
        this.timeoutSeconds = 60;
        this.logEntries = [];
        console.log("Foresight client initialized");
    }

    async _makeRequest(method, endpoint, params = null, inputJson = null) {
        try {
            const response = await axios({
                method: method,
                url: `${this.apiUrl}${endpoint}`,
                headers: {
                    Authorization: `Bearer ${this.apiToken}`
                },
                params: params,
                data: inputJson,
                timeout: this.timeoutSeconds * 1000
            });

            if (response.status !== 200) {
                console.error(response.data);
            }

            return response.data;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async createSimpleEvalset(evalsetId, queries, referenceAnswers = null) {
        if (referenceAnswers && queries.length !== referenceAnswers.length) {
            throw new Error("Number of queries and references must match.");
        }

        const entries = queries.map((query, index) => ({
            query: query,
            reference_answer: referenceAnswers ? referenceAnswers[index] : null,
            entry_id: uuidv4()
        }));

        const evalset = {
            evalset_id: evalsetId,
            evalset_entries: entries
        };

        try {
            const response = await this.makeRequest("post", "/api/eval/set", null, evalset);
            return response;
        } catch (error) {
            throw error;
        }
    }

    async getEvalset(evalsetId) {
        try {
            const response = await this.makeRequest("get", "/api/eval/set", { evalset_id: evalsetId });
            return response;
        } catch (error) {
            throw error;
        }
    }

    async getEvalrunQueries(experimentId) {
        try {
            const response = await this.makeRequest("get", "/api/eval/run/queries", { experiment_id: experimentId });
            return response;
        } catch (error) {
            throw error;
        }
    }

    async createEvalrun(runConfig) {
        try {
            const response = await this.makeRequest("post", "/api/eval/run", null, runConfig);
            console.log(`Eval run with experiment_id ${runConfig.experiment_id} created.`);
            return response;
        } catch (error) {
            throw error;
        }
    }

    async generateAnswersAndRunEval(generateFn, runConfig) {
        try {
            await this.createEvalrun(runConfig);
            const experimentId = runConfig.experiment_id;
            const queries = await this.getEvalrunQueries(experimentId);
            const outputs = {};

            for (const [entryId, query] of Object.entries(queries)) {
                const inferenceOutput = generateFn(query);
                outputs[entryId] = inferenceOutput;
            }

            const uploadRequest = {
                experiment_id: experimentId,
                entry_id_to_inference_output: outputs
            };

            const response = await this.makeRequest("put", "/api/eval/run/entries", null, uploadRequest);
            console.log("Eval run successful. Visit %s to view results.", this.uiUrl);
            return response;
        } catch (error) {
            throw error;
        }
    }

    async flush() {
        if (this.logEntries.length === 0) {
            console.log("No log entries to flush.");
            return;
        }

        const logRequest = { log_entries: this.logEntries };

        try {
            const response = await this.makeRequest("put", "/api/eval/log", null, logRequest);
            console.log("Log entries flushed successfully. Visit %s to view results.", this.uiUrl);
            this.logEntries = [];
            return response;
        } catch (error) {
            throw error;
        }
    }

    log(query, response, contexts) {
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
            this.flush();
        }
    }

    async get_evalrun_details(experiment_id, sort_by = "input.query", limit = 100, convert_to_dataframe = true) {
        try {
            const params = { experiment_id: experiment_id };
            if (limit !== null && sort_by !== null) {
                params["sort_field_name"] = sort_by;
                params["limit"] = limit.toString();
            }
            const response = await this.__make_request("get", "/api/eval/run/details", params);
            const details = response.data;
            if (convert_to_dataframe) {
                if (typeof require !== 'undefined') {
                    const pandas = require('pandas');
                    return this.__convert_evalrun_details_to_dataframe(details);
                } else {
                    this.logger.warning("pandas is not installed. Returning an EvalRunDetails object instead.");
                    return details;
                }
            }
            return details;
        } catch (error) {
            throw error;
        }
    }

    __convert_evalrun_details_to_dataframe(details) {
        // Function to convert details to DataFrame (not implemented)
        throw new Error("Conversion to DataFrame is not implemented.");
    }
}

export default Foresight;
