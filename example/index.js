require("dotenv").config({ path: '../.env' });
const { Foresight, MetricType } = require("fore");

const foresight = new Foresight({ apiToken: process.env.API_TOKEN });

const runSample = async () => {
    try {
        const evalsetId = "hr-test-evalset-1";
        const experimentId = "hr-test-experiment-1"
        const experimentId2 = "hr-test-experiment-2"

        {
            const savedEvalset = await foresight.createSimpleEvalset({
                evalsetId,
                queries: ["query1", "query2"],
                referenceAnswers: ["answer1", "answer2"]
            })
            console.log("runSample:createSimpleEvalset:", savedEvalset)

            const existingEvalset = await foresight.getEvalset({ evalsetId: savedEvalset.evalset_id })
            console.log("runSample:getEvalset:", existingEvalset)

            const savedEvalrun = await foresight.createEvalrun({
                runConfig: {
                    evalsetId: existingEvalset.evalset_id,
                    experimentId,
                    metrics: [MetricType.GROUNDEDNESS]
                }
            })
            console.log("runSample:createEvalrun:", savedEvalrun)

            const existingEvalrun = await foresight.getEvalrunQueries({ experimentId: savedEvalrun.experiment_id })
            console.log("runSample:getEvalrunQueries:", existingEvalrun)
        }

        {
            const status = await foresight.generateAnswersAndRunEval({
                generateFn: (query) => {
                    // Do the LLM processing with your model...
                    // Here is some demo code:

                    return {
                        generatedResponse: query.includes("hardest") ? "Malbolge" : "Python",
                        contexts: [
                            "Malbolge is the hardest language",
                            "Python is the easiest language",
                        ],
                    };
                },
                runConfig: {
                    evalsetId,
                    experimentId: experimentId2,
                    metrics: [MetricType.GROUNDEDNESS, MetricType.SIMILARITY],
                }
            })
            console.log("runSample:generateAnswersAndRunEval:", status)
        }

        {
            foresight.log({
                query: "What is the easiest programming language?",
                response: "Python",
                contexts: ["Python rated the easiest programming language"],
            });

            const status = await foresight.flush();
            console.log("runSample:flush:", status)
        }

        {
            const details = await foresight.getEvalrunDetails({ experimentId })
            //toDSV() || toCSV() || toTSV() || toPSV() || toText() || toJSON() || toDict() || toArray() || toCollection()
            console.log("runSample:getEvalrunDetails:", details?.toCollection())
        }
    } catch (error) {
        console.error("runSample:error:", error.message)
    }
}

runSample();