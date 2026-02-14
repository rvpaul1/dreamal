---
name: refactor
description: Refactor code to improve structure and readability. Use when the user asks to refactor, clean up, or reorganize code.
---

Refactor the specified code (or the file/component referenced by $ARGUMENTS) following these principles:

## Abstractions

- Extract logic into clean, reusable blocks when there is a reasonable abstraction boundary
- Each abstraction should have a single, clear responsibility
- Don't create abstractions for one-off operations — three similar lines is better than a premature helper

## Ordering by Abstraction Level

Group code by abstraction level within each file. For React components, follow this order:

1. Standard React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, etc.)
2. Custom hooks
3. Derived state and local logic
4. Event handlers
5. TSX return

## Component Decomposition

- When TSX becomes large or complex, break it into sub-components at logical boundaries
- Each sub-component should represent a coherent piece of UI
- Prefer colocating small, single-use sub-components in the same file
- Extract to a separate file when the component is reused or large enough to warrant it

## What NOT to Do

- Do not add comments, docstrings, or type annotations to code you didn't change
- Do not add error handling or validation for scenarios that can't happen
- Do not change behavior — refactoring is structural, not functional
- Do not rename things just for style unless the current name is misleading
