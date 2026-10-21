# AI Development Rules

## Code readability

- Write human-readable code.
- Prefer clear names, straightforward control flow, and maintainable structure over overly compact implementations.
- Keep related logic together and add comments only when they clarify non-obvious behavior.

## React component reuse

- Use an existing React component whenever it can support the requirement.
- If an existing component is close to the required behavior, extend or improve it and then reuse it.
- Create a new React component only when an existing component cannot support the requirement and cannot reasonably be extended.

## Atomic design

- Follow atomic design rules for React components.
- Organize components by responsibility and composition:
  - **Atoms:** Small, reusable UI elements such as buttons, inputs, labels, and icons.
  - **Molecules:** Small groups of atoms that work together as a focused UI unit.
  - **Organisms:** Larger, reusable sections composed of atoms and molecules.
  - **Templates:** Page-level layout structures that define content placement.
  - **Pages:** Route-specific screens that provide real content to templates.
- Place new components in the appropriate atomic-design directory.
- Prefer composition and reuse instead of duplicating markup or styles.
