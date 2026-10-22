# Important prompts used to build the calculator app

## Planning the stories

The first thing I did here was to convert the requirements given in the email to markdown format to create the `requirements.md` file. Then, I used the following prompt to plan the stories to complete the work:

- I would like to build a calculator application using the requirements listed in the @docs/requirements.md file. The first thing I want you to do is to break down the work required into individual stories. For both the client and the server layers, there should be a scaffolding story to set up the frameworks and packages required for both layers to work. Then, we should have stories to add individual calculator operations. For example, if we want to add an addition feature, we can have the code required to accomplish this in the frontend and backend as part of the same story since they're very closely related. This will ensure that the code is easier to review for future math operations. Each of these stories should have unit tests as part of the acceptance criteria. The operations that are marked as "optional" in the requirements are in scope so include them as part of the work. Same thing applies for the Dockerfile.

## Implementing stories

S1 (Story #1):
Given that S1 had enough context in the ACs and it was scaffolding only, I just gave Claude the following prompt:
- Implement the S1 feature in @docs/stories.md

S2 (Story #2):
Given that S2 had enough context in the ACs and it was scaffolding only, I just gave Claude the following prompt:
- Implement the S2 feature in @docs/stories.md

