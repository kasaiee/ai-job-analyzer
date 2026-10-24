# AI Development Rules

## Code readability

- Write human-readable code. dont write a lot of code at one line
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

## Responsive design

- Build every page and component to work across mobile, tablet, laptop, and desktop screen sizes.
- Use a mobile-first approach: start with the smallest practical layout and add enhancements for wider screens with consistent breakpoints.
- Prefer flexible layouts and relative sizing (`flex`, `grid`, `%`, `minmax()`, `clamp()`, and intrinsic sizing) over fixed widths or heights.
- Reflow, wrap, stack, collapse, or scroll content when space is limited. Do not allow controls, text, tables, media, or dialogs to overflow the viewport.
- Preserve content hierarchy and essential functionality at every screen size. Do not hide important content or actions solely to make a layout fit.
- Reuse responsive behavior in existing atoms, molecules, organisms, and templates instead of adding page-specific workarounds.
- Keep touch targets accessible and controls usable on touch devices. Do not rely on hover as the only way to reveal an essential action.
- Ensure images, videos, embedded content, and other media scale within their containers while preserving their aspect ratio.
- Test responsive changes at representative mobile, tablet, and desktop widths, including both left-to-right and right-to-left layouts when supported.
