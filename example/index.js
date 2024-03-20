const { Foresight, MetricType } = require("fore");

const apiToken = "api-token";
const foresight = new Foresight({ apiToken });

const runSample = async () => {
    try {
        const evalsetId = "hr-test-evalset-1";
        const queries = ["query1", "query2"];
        const referenceAnswers = ["answer1", "answer2"];

        const savedEvalset = await foresight.createSimpleEvalset({ evalsetId, queries, referenceAnswers })
        console.log("runSample:createSimpleEvalset:", savedEvalset)

        const existingEvalset = await foresight.getEvalset({ evalsetId: savedEvalset.evalset_id })
        console.log("runSample:getEvalset:", existingEvalset)

        const experimentId = "hr-test-experiment-1";
        const savedEvalrun = await foresight.createEvalrun({ evalsetId: existingEvalset.id, experimentId, metrics: [MetricType.GROUNDEDNESS] })
        console.log("runSample:createEvalrun:", savedEvalrun)

        const existingEvalrun = await foresight.getEvalrunQueries({ evalsetId: savedEvalrun.id })
        console.log("runSample:getEvalrunQueries:", existingEvalrun)

        {
            const runConfig = {
                evalsetId: "hr-test-evalset-2",
                experimentId: "hr-test-experiment-2",
                metrics: [MetricType.GROUNDEDNESS, MetricType.SIMILARITY],
            };

            const myGenerateGn = (query) => {
                // Do the LLM processing with your model...
                // Here is some demo code:

                return {
                    generatedResponse: query.includes("hardest") ? "Malbolge" : "Python",
                    contexts: [
                        "Malbolge is the hardest language",
                        "Python is the easiest language",
                    ],
                };
            };

            const results = await foresight.generateAnswersAndRunEval({ generateFn: myGenerateGn, runConfig })
            console.log("runSample:generateAnswersAndRunEval:", results)
        }

        {
            foresight.log({
                query: "What is the easiest programming language?",
                response: "Python",
                contexts: ["Python rated the easiest programming language"],
            });

            const results = await foresight.flush();
            console.log("runSample:flush:", results)
        }

        {
            const details = await foresight.getEvalrunDetails({ experimentId })
            console.log("runSample:getEvalrunDetails:", details)
        }
    } catch (error) {
        console.error("runSample:error:", error.message)
    }
}

runSample();