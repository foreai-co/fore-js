# The fore client package

The foresight library within fore SDK allows you to easily evaluate the
performance of your LLM system based on a variety of metrics.

You can sign-up as a beta tester at https://foreai.co.

## Quick start

1.  Install the package using `npm`:

    ```bash
    npm install fore
    ```

2.  - Get started with the following lines:

    ```javascript
    const { Foresight } = require("fore");

    const foresight = new Foresight({ apiToken: "<YOUR_API_TOKEN>" });

    await foresight.log({
      query: "What is the easiest programming language?",
      response: "Python",
      contexts: ["Python rated the easiest programming language"],
    });

    // You can add more such queries using foresight.log
    // ....

    await foresight.flush();
    ```

    - Or alternatively to curate your evalsets and run regular evals against them do:

    ```javascript
    const { Foresight, MetricType } = require("fore");

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

    await foresight.generateAnswersAndRunEval({
      generateFn: myGenerateGn,
      runConfig,
    });
    ```

## Metrics

### Groundedness

Depends on:

- LLM's generated response;
- Context used for generating the answer.

The metric answers the question: **Is the response based on the context and
nothing else?**

This metric estimates the fraction of facts in the generated response that can
be found in the provided context.

Example:

- **Context**: _The front door code has been changed from 1234 to 7945 due to
  security reasons._
- **Q**: _What is the current front door code?_
- **A1**: _7945._ `[groundedness score = 0.9]`
- **A2**: _0000._ `[groundedness score = 0.0]`
- **A3**: _1234._ `[groundedness score = 0.04]`

### Similarity

Depends on:

- LLM's generated response;
- A reference response to compare the generated response with.

The metric answers the question: **Is the generated response semantically equivalent
to the reference response?**

Example:

- **Question**: _Is Python an easy programming language to learn?_
- **Reference response**: _Python is an easy programming language to learn_
- **Response 1**: _It is easy to be proficient in python_ `[similarity score = 0.72]`
- **Response 2**: _Python is widely recognized for its simplicity._ `[similarity score = 0.59]`
- **Response 3**: _Python is not an easy programming language to learn_ `[similarity score = 0.0]`

### Relevance (coming soon)

Depends on:

- LLM's generated response;
- User query/question.

The metric answers the question: **Does the response answer the question and
only the question?**

This metric checks that the answer given by the LLM is trying to answer the
given question precisely and does not include irrelevant information.

Example:

- **Q**: _At which temperature does oxygen boil?_
- **A1**: _Oxygen boils at -183 °C._ `[relevance score = 1.0]`
- **A2**: _Oxygen boils at -183 °C and freezes at -219 °C._ `[relevance score = 0.5]`

### Completeness (coming soon)

Depends on:

- LLM's generated response;
- User query/question.

The metric answers the question: **Are all aspects of the question answered?**

Example:

- **Q**: _At which temperature does oxygen boil and freeze?_
- **A1**: _Oxygen boils at -183 °C._ `[completeness score = 0.5]`
- **A2**: _Oxygen boils at -183 °C and freezes at -219 °C._ `[completeness score = 1.0]`
