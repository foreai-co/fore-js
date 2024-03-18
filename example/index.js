import Foresight from "../index.js";
const apiToken = "your-api-token";
const foresightClient = new Foresight(apiToken);

// Example usage of createSimpleEvalset
const evalsetId = "your-evalset-id";
const queries = ["query1", "query2"];
const referenceAnswers = ["answer1", "answer2"];

foresightClient.createSimpleEvalset(evalsetId, queries, referenceAnswers)
    .then(response => console.log(response))
    .catch(error => console.error(error));