import axios from 'axios';
import { v4 } from 'uuid';

const GATEWAY_URL = "https://foresight-gateway.foreai.co";
const UI_URL = "https://foresight.foreai.co";
const MAX_ENTRIES_BEFORE_FLUSH = 10;

class Foresight {
    constructor(api_token, api_url = GATEWAY_URL, ui_url = UI_URL, max_entries_before_auto_flush = MAX_ENTRIES_BEFORE_FLUSH, log_level = 'info') {
        this.api_token = api_token;
        this.api_url = api_url;
        this.ui_url = ui_url;
        this.max_entries_before_auto_flush = max_entries_before_auto_flush;
        this.timeout_seconds = 60;
        this.log_entries = [];
        this.logger = console;
        this.logger.level = log_level;
        this.logger.info("Foresight client initialized");
    }

    async __make_request(method, endpoint, params = null, input_json = null) {
        try {
            const response = await axios({
                method: method,
                url: `${this.api_url}${endpoint}`,
                headers: { "Authorization": `Bearer ${this.api_token}` },
                params: params,
                data: input_json,
                timeout: this.timeout_seconds * 1000
            });
            return response;
        } catch (error) {
            throw error;
        }
    }

    async create_simple_evalset(evalset_id, queries, reference_answers = null) {
        try {
            if (reference_answers && queries.length !== reference_answers.length) {
                throw new Error("Number of queries and references must match.");
            }

            let entries = [];
            for (let i = 0; i < queries.length; i++) {
                const query = queries[i];
                const reference_answer = reference_answers ? reference_answers[i] : null;
                entries.push({
                    query: query,
                    reference_answer: reference_answer,
                    entry_id: v4()
                });
            }

            const evalset = {
                evalset_id: evalset_id,
                evalset_entries: entries
            };

            const response = await this.__make_request("post", "/api/eval/set", null, evalset);
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async get_evalset(evalset_id) {
        try {
            const response = await this.__make_request("get", "/api/eval/set", { evalset_id: evalset_id });
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async get_evalrun_queries(experiment_id) {
        try {
            const response = await this.__make_request("get", "/api/eval/run/queries", { experiment_id: experiment_id });
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async create_evalrun(run_config) {
        try {
            const response = await this.__make_request("post", "/api/eval/run", null, run_config);
            if (response.status === 200) {
                this.logger.info(`Eval run with experiment_id ${run_config.experiment_id} created.`);
            }
            return response;
        } catch (error) {
            throw error;
        }
    }

    async generate_answers_and_run_eval(generate_fn, run_config) {
        try {
            await this.create_evalrun(run_config);
            const experiment_id = run_config.experiment_id;
            const queries = await this.get_evalrun_queries(experiment_id);
            const outputs = {};
            for (const [entry_id, query] of Object.entries(queries)) {
                const inference_output = await generate_fn(query);
                outputs[entry_id] = inference_output;
            }
            const response = await this.__make_request("put", "/api/eval/run/entries", null, outputs);
            if (response.status === 200) {
                this.logger.info("Eval run successful. Visit %s to view results.", this.ui_url);
            }
            return response;
        } catch (error) {
            throw error;
        }
    }

    async flush() {
        try {
            if (this.log_entries.length === 0) {
                this.logger.info("No log entries to flush.");
                return;
            }
            const log_request = { log_entries: this.log_entries };
            const response = await this.__make_request("put", "/api/eval/log", null, log_request);
            if (response.status === 200) {
                this.logger.info("Log entries flushed successfully. Visit %s to view results.", this.ui_url);
                this.log_entries = [];
            } else {
                this.logger.error("Flushing log entries failed with response code: %s", response.status);
            }
            return response;
        } catch (error) {
            throw error;
        }
    }

    async log(query, response, contexts = []) {
        try {
            const log_entry = { query: query, inference_output: { generated_response: response, contexts: contexts } };
            this.log_entries.push(log_entry);
            if (this.log_entries.length >= this.max_entries_before_auto_flush) {
                await this.flush();
            }
        } catch (error) {
            throw error;
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
