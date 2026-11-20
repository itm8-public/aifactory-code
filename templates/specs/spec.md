# Feature specification: __FEATURE__

- Feature: `__ID__`
- Created: __DATE__
- Input: "__INPUT__"

<!--
  What and why, never how: no frameworks, tables, endpoints or file names here; the plan has those.
  Mark every guess with [NEEDS CLARIFICATION: <question>] (at most three, the ones that change
  scope, data or users). /aifactory-code:plan will not start while one is open: answer it, or a
  person accepts a stated assumption under "Assumptions".
-->

## User scenarios and testing

<!-- Stories in priority order. Each one is a slice that can be built, tested and shown on its own. -->

### User story 1: <title> (priority: P1)

<Who wants what, and why, in plain language.>

**Why this priority**: <the value, and why it comes first>

**Independent test**: <how to show this story works without the others>

**Acceptance scenarios**:

1. **Given** <starting state>, **when** <action>, **then** <outcome>
2. **Given** <starting state>, **when** <action>, **then** <outcome>

### User story 2: <title> (priority: P2)

<Who wants what, and why.>

**Why this priority**: <value>

**Independent test**: <how>

**Acceptance scenarios**:

1. **Given** <starting state>, **when** <action>, **then** <outcome>

### Edge cases

- What happens when <boundary condition>?
- How does the feature behave when <error, empty list, no access>?

## Requirements

### Functional requirements

- **FR-001**: The system MUST <capability>
- **FR-002**: Users MUST be able to <interaction>
- **FR-003**: The system MUST <behaviour> [NEEDS CLARIFICATION: <question>]

### Key entities

- **<Entity>**: <what it represents and its key attributes, without types or tables>

## Data and zone (AI Factory)

<!-- Answer each line. A "stop" answer means stop and ask a person before the plan (AGENTS.md, "Stop and ask"). -->

- **Data the feature stores or shows**: <what, and where it comes from>
- **Personal data**: [NEEDS CLARIFICATION: does the feature store or show names, e-mail addresses or other personal data? Yes means the Red zone: stop]
- **Users**: <internal only, or also guests from outside the organisation>
- **AI**: <none; answers questions; proposes actions a person approves. Deciding about people: stop>
- **New outside services or data processors**: <none, or name them: stop and ask>
- **Stop-and-ask items raised**: <none, or the item and who was asked>

## Success criteria

<!-- Measurable and free of technology: a person can check them without reading the code. -->

- **SC-001**: <measurable outcome, for example "a user finds an item in under 10 seconds">
- **SC-002**: <measurable outcome>

## Assumptions

- <a default chosen where the input said nothing, accepted by a person>
