# The fore client package

The foresight library within fore SDK allows you to easily evaluate the
performance of your LLM system based on a variety of metrics.

You can try out foresight for free at https://foresight.foreai.co.

## Quick start

1.  Install the package using `npm`:

    ```bash
    npm install fore-ai
    ```

2.  -   Get started with the following lines:

    ```javascript
    const { Foresight } = require("fore-ai");

    const foresight = new Foresight({ apiToken: "<YOUR_API_TOKEN>" });

    await foresight.log({
    	query: "What is the easiest programming language?",
    	response: "Python",
    	contexts: ["Python rated the easiest programming language"],
    	tag: "my_awesome_experiment",
    });

    // You can add more such queries using foresight.log
    // ....

    await foresight.flush();
    ```

    -   Or alternatively to curate your evalsets and run regular evals against them do:

    ```javascript
    const { Foresight, MetricType } = require("fore-ai");

    const foresight = new Foresight({ apiToken: "<YOUR_API_TOKEN>" });

    const evalset = await foresight.createSimpleEvalset({
    	evalsetId: "programming-languages",
    	queries: [
    		"hardest programming language?",
    		"easiest programming language?",
    	],
    	referenceAnswers: ["Malbolge", "Python"],
    });

    const runConfig = {
    	evalsetId: "programming-languages",
    	experimentId: "my-smart-llm",
    	metrics: [MetricType.GROUNDEDNESS, MetricType.REFERENCE_FACT_RECALL],
    };

    const myGenerateGn = (query) => {
    	// Do the LLM processing with your model...
    	// Here is some demo code:

    	return {
    		generatedResponse: query.includes("hardest")
    			? "Malbolge"
    			: "Python",
    		contexts: [
    			"Malbolge is the hardest language",
    			"Python is the easiest language",
    		],
    	};
    };

    await foresight.generateAnswersAndRunEval({
    	generateFn: myGenerateGn,
    	runConfig,
    });
    ```

## Metrics

### Groundedness

Depends on:

-   LLM's generated response;
-   Context used for generating the answer.

The metric answers the question: **Is the response based on the context and
nothing else?**

This metric estimates the fraction of facts in the generated response that can
be found in the provided context.

Example:

-   **Context**: _The front door code has been changed from 1234 to 7945 due to
    security reasons._
-   **Q**: _What is the current front door code?_
-   **A1**: _7945._ `[groundedness score = 0.9]`
-   **A2**: _0000._ `[groundedness score = 0.0]`
-   **A3**: _1234._ `[groundedness score = 0.04]`

### Reference Fact Recall

Depends on:
- A user query;
- An LLM's generated response to be evaluated;
- A reference response to compare the generated response with.

The metric answers the question: **How many facts from the reference answer does
the candidate answer mention?**

This metric checks that the answer given by the LLM is mentioning all the facts
listed in the reference answer. Additional information is not penalised.

Example:
- **Question**: *Give me a checklist to prepare for my hiking trip to the mountains.*
- **Reference response**: *You should bring your a water bottle, hiking shoes and sunscreen.* 
- **Candidate answer 1**: *Here is a list of items to bring: 1) hiking shoes; 2) a water bottle.* `[reference fact recall score = 0.67]`
- **Candidate answer 2**: *Here is a list of items to bring: 1) backpack with food; 2) hiking shoes; 3) a water bottle.*`[reference fact recall score = 0.67]`
- **Candidate answer 3**: *Here is a list of items to bring: 1) backpack with food; 2) hiking shoes; 3) a water bottle; 4) sunscreen.*`[reference fact recall score = 1.0]`
