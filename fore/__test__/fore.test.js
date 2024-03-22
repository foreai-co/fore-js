import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { jest } from '@jest/globals'

import { Foresight } from '../index.js';//index.js//dist/fore.es.js

// Mock data
const mockApiToken = 'VERY_SECRET_TOKEN';
const mockApiUrl = 'http://foresight:8010';
const mockTimeout = 1;
const mockMaxEntriesBeforeAutoFlush = 2;

const mockEvalsetId = 'mock-evalset-id';
const mockQueries = ['query1', 'query2', 'query3'];
const mockReferenceAnswers = ['answer1', 'answer2', 'answer3'];
const mockEvalsetResponse = { evalsetId: mockEvalsetId, numEntries: 3 };

const mockExperimentId = 'mock-experiment-id';
const mockMetrics = ['metric1', 'metric2'];
const mockGenerateFn = jest.fn();

const mockDetails = {
    experimentId: mockExperimentId,
    entries: [
        {
            input: { query: 'query1', referenceAnswer: 'answer1' },
            output: { generatedResponse: 'response1', sourceDocids: [], contexts: [] },
            metricValues: { metric1: 0.5, metric2: 0.8 }
        },
        {
            input: { query: 'query2', referenceAnswer: 'answer2' },
            output: { generatedResponse: 'response2', sourceDocids: [], contexts: [] },
            metricValues: { metric1: 0.7, metric2: 0.6 }
        }
    ]
};

// Mock console.log
global.console = {
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
};

describe('Foresight Test', () => {
    let mockAxios;
    let foresight;

    beforeEach(() => {
        // Mock Axios
        const axiosInstance = axios.create({ baseURL: mockApiUrl });
        mockAxios = new MockAdapter(axiosInstance);
        foresight = new Foresight({ axiosInstance, apiToken: mockApiToken, apiUrl: mockApiUrl, maxEntriesBeforeAutoFlush: mockMaxEntriesBeforeAutoFlush });
        foresight.timeoutSeconds = mockTimeout;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createSimpleEvalset', () => {
        it('should create a simple evalset', async () => {
            mockAxios.onPost(`/api/eval/set`).reply(200, mockEvalsetResponse);

            const response = await foresight.createSimpleEvalset({ evalsetId: mockEvalsetId, queries: mockQueries });

            expect(response).toEqual(mockEvalsetResponse);
        });
    });

    describe('createSimpleEvalsetWithReferences', () => {
        it('should create a simple evalset with references', async () => {
            mockAxios.onPost(`/api/eval/set`).reply(200, mockEvalsetResponse);

            const response = await foresight.createSimpleEvalset({ evalsetId: mockEvalsetId, queries: mockQueries, referenceAnswers: mockReferenceAnswers });

            expect(response).toEqual(mockEvalsetResponse);
        });
    });

    describe('createSimpleEvalsetWithNotEnoughReferences', () => {
        it('should create a simple evalset with not enough references', async () => {
            const response = foresight.createSimpleEvalset({ evalsetId: mockEvalsetId, queries: mockQueries, referenceAnswers: mockReferenceAnswers.slice(0, 1) });

            await expect(response).rejects.toThrowError("Number of queries and references must match.");
        });
    });

    describe('getEvalset', () => {
        it('should get the evaluation set with metadata', async () => {
            const mockResponse = { evalsetId: mockEvalsetId, entries: [] };
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
            const mockResponse = "success";
            mockAxios.onPost('/api/eval/run').reply(200, mockResponse);

            const response = await foresight.createEvalrun({ runConfig: { evalsetId: mockEvalsetId, experimentId: mockExperimentId, metrics: mockMetrics } });

            expect(response).toEqual(mockResponse);
        });
    });

    describe('generateAnswersAndRunEval', () => {
        it('should generate answers and run an eval', async () => {
            const mockResponse = "success";
            mockAxios.onAny().reply(200, mockResponse);

            const response = await foresight.generateAnswersAndRunEval({
                generateFn: (query) => {
                    return {
                        generatedResponse: query.includes("hardest") ? "Malbolge" : "Python",
                        contexts: [
                            "Malbolge is the hardest language",
                            "Python is the easiest language",
                        ],
                    };
                },
                runConfig: { evalsetId: mockEvalsetId, experimentId: mockExperimentId, metrics: mockMetrics }
            });

            expect(response).toEqual(mockResponse);
        });
    });

    describe('log', () => {
        it('should add log entries', async () => {
            await foresight.log({ query: 'test query', response: 'test response', contexts: [] });
            expect(foresight.logEntries.length).toBe(1);
        });

        it('should auto flush when log entries exceed maxEntriesBeforeAutoFlush', async () => {
            mockAxios.onAny().reply(200);

            for (let i = 0; i < mockMaxEntriesBeforeAutoFlush; i++) {
                await foresight.log({ query: `test query ${i}`, response: `test response ${i}`, contexts: [] });
            }

            expect(foresight.logEntries.length).toBe(0);
        });
    });

    describe('flush', () => {
        it('should flush log entries', async () => {
            mockAxios.onAny().reply(200);

            await foresight.log({ query: 'test query', response: 'test response', contexts: [] });
            await foresight.flush();

            expect(foresight.logEntries.length).toBe(0);
        });

        it('should handle no log entries to flush', async () => {
            await foresight.flush();
            expect(console.info).toHaveBeenCalledWith('No log entries to flush.');
        });
    });

    describe('getEvalrunDetails', () => {
        it('should get evaluation run details', async () => {
            mockAxios.onGet('/api/eval/run/details').reply(200, mockDetails);

            const response = await foresight.getEvalrunDetails({ experimentId: mockExperimentId, convertToDataframe: false });

            expect(response).toEqual(mockDetails);
        });
    });
});

