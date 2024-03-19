import Foresight, { MetricType } from "../index.js";

const apiToken = "b56b556505be436fb483a77ddfed27b2";
const foresight = new Foresight({ apiToken });

// Example usage of createSimpleEvalset
const evalsetId = "hr-test-evalset-1";
const queries = ["query1", "query2"];
const referenceAnswers = ["answer1", "answer2"];

foresight.createSimpleEvalset({ evalsetId, queries, referenceAnswers })
    .then(response => console.log("response", response))
    .catch(error => console.error("error", error));