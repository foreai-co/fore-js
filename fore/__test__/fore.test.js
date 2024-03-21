import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals'

import { Foresight, MetricType } from '../index.js';

// Mock data
const mockApiToken = 'VERY_SECRET_TOKEN';
const mockApiUrl = 'http://foresight:8010';
const mockTimeout = 1;
const mockMaxEntriesBeforeAutoFlush = 2;

const mockEvalsetId = 'mock-evalset-id';
const mockQueries = ['query1', 'query2', 'query3'];
const mockReferenceAnswers = ['answer1', 'answer2', 'answer3'];
const mockExperimentId = 'mock-experiment-id';
const mockMetrics = ['metric1', 'metric2'];
const mockGenerateFn = jest.fn();

const mockDetails = {
    entries: [
        {
            input: { query: 'query1', reference_answer: 'answer1' },
            output: { generated_response: 'response1', source_docids: [], contexts: [] },
            metric_values: { metric1: 0.5, metric2: 0.8 }
        },
        {
            input: { query: 'query2', reference_answer: 'answer2' },
            output: { generated_response: 'response2', source_docids: [], contexts: [] },
            metric_values: { metric1: 0.7, metric2: 0.6 }
        }
    ]
};

// Mock Axios
const axiosInstance = axios.create({ baseURL: mockApiUrl });
const mockAxios = new MockAdapter(axiosInstance);

// Mock console.log
global.console = {
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
};

describe('Foresight Test', () => {
    let foresight;

    beforeEach(() => {
        foresight = new Foresight({ axiosInstance, apiToken: mockApiToken, apiUrl: mockApiUrl, maxEntriesBeforeAutoFlush: mockMaxEntriesBeforeAutoFlush });
        foresight.timeoutSeconds = mockTimeout;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createSimpleEvalset', () => {
        it('should create a simple evalset', async () => {
            const mockResponse = { evalset_id: mockEvalsetId, num_entries: 3 };
            mockAxios.onPost(`/api/eval/set`).reply(200, mockResponse);

            const response = await foresight.createSimpleEvalset({ evalsetId: mockEvalsetId, queries: mockQueries, referenceAnswers: mockReferenceAnswers });

            expect(response).toEqual(mockResponse);
            expect(console.info).toHaveBeenCalledWith(`Eval set with evalsetId ${mockEvalsetId} created.`);
        });
    });

    describe('getEvalset', () => {
        it('should get the evaluation set with metadata', async () => {
            const mockResponse = { evalset_id: mockEvalsetId, entries: [] };
            mockAxios.onGet('/api/eval/set').reply(200, mockResponse);

            const response = await foresight.getEvalset({ evalsetId: mockEvalsetId });

            expect(response).toEqual(mockResponse);
        });
    });

    describe('getEvalrunQueries', () => {
        it('should get the queries associated with an eval run', async () => {
            const mockResponse = { 'entry_id_1': 'query1', 'entry_id_2': 'query2' };
            mockAxios.onGet('/api/eval/run/queries').reply(200, mockResponse);

            const response = await foresight.getEvalrunQueries({ experimentId: mockExperimentId });

            expect(response).toEqual(mockResponse);
        });
    });

    describe('createEvalrun', () => {
        it('should create an evaluation run', async () => {
            const mockResponse = { experiment_id: mockExperimentId };
            mockAxios.onPost('/api/eval/run').reply(200, mockResponse);

            const response = await foresight.createEvalrun({ runConfig: { evalsetId: mockEvalsetId, experimentId: mockExperimentId, metrics: mockMetrics } });

            expect(response).toEqual({ experiment_id: mockExperimentId });
            expect(console.info).toHaveBeenCalledWith(`Eval run with experimentId ${mockExperimentId} created.`);
        });
    });

    // describe('generateAnswersAndRunEval', () => {
    //     it('should generate answers and run an eval', async () => {
    //         mockAxios.onAny().reply(200);

    //         const response = await foresight.generateAnswersAndRunEval({
    //             generateFn: mockGenerateFn,
    //             runConfig: { evalsetId: mockEvalsetId, experimentId: mockExperimentId, metrics: mockMetrics }
    //         });

    //         expect(response).toBeUndefined();
    //         expect(console.info).toHaveBeenCalledWith(`Eval run successful. Visit ${foresight.uiUrl} to view results.`);
    //     });
    // });

    // describe('flush', () => {
    //     it('should flush log entries', async () => {
    //         mockAxios.onAny().reply(200);

    //         foresight.log({ query: 'test query', response: 'test response', contexts: [] });
    //         await foresight.flush();

    //         expect(console.log).toHaveBeenCalledWith(`Log entries flushed successfully. Visit ${foresight.uiUrl} to view results.`);
    //         expect(foresight.logEntries).toEqual([]);
    //     });

    //     it('should handle no log entries to flush', async () => {
    //         await foresight.flush();
    //         expect(console.info).toHaveBeenCalledWith('No log entries to flush.');
    //     });
    // });

    // describe('log', () => {
    //     it('should add log entries', () => {
    //         foresight.log({ query: 'test query', response: 'test response', contexts: [] });
    //         expect(foresight.logEntries.length).toBe(1);
    //     });

    //     it('should auto flush when log entries exceed maxEntriesBeforeAutoFlush', async () => {
    //         mockAxios.onAny().reply(200);

    //         for (let i = 0; i < 11; i++) {
    //             foresight.log({ query: `test query ${i}`, response: `test response ${i}`, contexts: [] });
    //         }

    //         expect(console.log).toHaveBeenCalledWith(`Log entries flushed successfully. Visit ${foresight.uiUrl}to view results.`);
    //         expect(foresight.logEntries).toEqual([]);
    //     });

    //     it('should handle errors when adding log entries', () => {
    //         const errorMessage = 'Error adding log entry';
    //         jest.spyOn(console, 'error').mockImplementation(() => { });

    //         foresight.log({ query: 'test query', response: 'test response', contexts: [] });
    //         expect(console.error).not.toHaveBeenCalled();

    //         jest.spyOn(foresight, 'flush').mockRejectedValue(new Error(errorMessage));

    //         foresight.log({ query: 'test query', response: 'test response', contexts: [] });
    //         expect(console.error).toHaveBeenCalledWith(`log:error: ${errorMessage}`);
    //     });
    // });

    // describe('getEvalrunDetails', () => {
    //     it('should get evaluation run details', async () => {
    //         mockAxios.onGet('/api/eval/run/details').reply(200, mockDetails);

    //         const response = await foresight.getEvalrunDetails({ experimentId: mockExperimentId });

    //         expect(response).toEqual(mockDetails);
    //     });

    //     it('should get evaluation run details and convert to DataFrame', async () => {
    //         jest.mock('./utils.js', () => ({
    //             convertToPandasDataFrame: jest.fn().mockResolvedValue('DataFrame')
    //         }));

    //         mockAxios.onGet('/api/eval/run/details').reply(200, mockDetails);

    //         const response = await foresight.getEvalrunDetails({ experimentId: mockExperimentId, convertToDataframe: true });

    //         expect(response).toBe('DataFrame');
    //     });

    //     it('should handle errors when getting evaluation run details', async () => {
    //         mockAxios.onGet('/api/eval/run/details').reply(404);

    //         try {
    //             await foresight.getEvalrunDetails({ experimentId: mockExperimentId });
    //         } catch (error) {
    //             expect(error.message).toBe('Request failed with status code 404');
    //             expect(console.error).toHaveBeenCalled();
    //         }
    //     });
    // });
});

