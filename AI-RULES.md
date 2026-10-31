# AI Development Rules and Project Checklists (React + Tailwind + Django)

## 1) General AI Behavior (before writing any code)

- [ ] Before writing code, inspect the current project structure (folders, existing components, hooks, services, models, tailwind.config, global CSS).
- [ ] Never write duplicate code; first check whether a similar component/hook/service already exists.
- [ ] If an existing component can be used directly, use it.
- [ ] If it cannot be used as-is but can be extended with a small change (props, variant, composition), extend it instead of creating a new component.
- [ ] Only if no existing option works, create a new component — and place it in the correct Atomic Design layer.
- [ ] For every change to existing code, provide a clear diff explanation: what, where, why.
- [ ] If you spot code smells, duplication, complex logic, poor naming, or clean-code violations, refactor and explain why.
- [ ] Never leave code without types/interfaces (in TypeScript) or a short doc comment.
- [ ] Output must be human-readable: meaningful naming, short functions, comments only where needed, no cryptic shortcuts.
- [ ] Keep related logic together and prefer clear names, straightforward control flow, and maintainable structure over compact, dense code.
- [ ] Every new feature or fix must come with tests (see the Testing Checklist).

---

## 2) React Checklist — Structure & Architecture

### Atomic Design
- [ ] Follow the folder structure strictly:
  - atoms/       -> button, icon, input, typography, badge, spinner
  - molecules/   -> combinations of atoms (e.g., FormField = Label + Input + Error)
  - organisms/   -> independent page sections (Header, ProductCard, LoginForm)
  - templates/   -> page layout without real data
  - pages/       -> connects template to data and routing
- [ ] Each component is responsible only for its own layer; atoms must not depend on server data.
- [ ] Shared/reusable components live in a common components/ directory, not inside a specific feature.

### Component-based
- [ ] Each component has a single responsibility (SRP).
- [ ] Use composition instead of deep prop drilling.
- [ ] Extract shared logic into custom hooks (useAuth, useFetch, usePagination).
- [ ] Keep local state as close to the consumer as possible; global state only for truly global data.
- [ ] Define props with explicit interfaces and no `any`.
- [ ] Use controlled/uncontrolled components correctly and consistently.
- [ ] Components should be pure and testable; side effects belong in hooks or services.

### Reusing Existing Components
- [ ] Before building any new UI, review the list of existing components.
- [ ] If a new variant is needed, use the same component with a new prop (or a Tailwind variant map).
- [ ] If an existing component needs extension, extend it backward-compatibly so existing consumers don't break.
- [ ] Only when no option exists, create a new component and place it in the correct Atomic Design layer.

### Readability & Clean Code
- [ ] Naming: components PascalCase, hooks useXxx, functions camelCase, constants UPPER_SNAKE_CASE.
- [ ] Each file has one main responsibility; split overly large files.
- [ ] Keep functions small and low-risk; reduce nested conditionals (early return).
- [ ] Avoid magic numbers/strings; define them in constants (including Tailwind class maps).
- [ ] Comments explain why, not what.
- [ ] Remove dead code, unused imports, console.log, and abandoned TODOs.
- [ ] Handle error and loading states for every async operation.
- [ ] Keep className strings readable: use a `cn()`/`clsx` + `tailwind-merge` helper for conditional classes instead of string concatenation.
- [ ] Extract long/repeated class strings into component variants (CVA or a variant map), not inline everywhere.

---

## 3) Tailwind Checklist

### Configuration & Design Tokens
- [ ] Use the project's `tailwind.config` as the single source of truth for colors, spacing, fonts, breakpoints, and shadows.
- [ ] Do not hardcode hex colors or arbitrary values when a design token exists; prefer `bg-primary` over `bg-[#123456]`.
- [ ] Use `theme.extend` for project-specific tokens instead of scattering arbitrary values.
- [ ] Keep the content/purge paths correct so unused classes are removed in production.
- [ ] Prefer design tokens (spacing scale, radius scale) over arbitrary values like `w-[437px]`.
- [ ] Use CSS variables for theming (dark mode, brand colors) and reference them in Tailwind.

### Class Usage
- [ ] Follow a consistent class order (layout -> box model -> typography -> color -> state -> responsive) or use the project's Prettier Tailwind plugin to sort automatically.
- [ ] Avoid deeply nested or contradictory utilities; use `tailwind-merge` to resolve conflicts.
- [ ] Do not mix Tailwind with ad-hoc inline styles unless there is a documented reason (e.g., dynamic values from data).
- [ ] Extract repeated utility clusters into a component, a `@apply` layer, or a variant — never copy-paste the same 10 classes across files.
- [ ] Prefer composing components over long className strings; if a className exceeds a reasonable length, refactor.
- [ ] Use `group` and `peer` for parent/child state styling instead of JS where possible.
- [ ] Use `@layer components` / `@layer utilities` for genuinely shared custom classes; avoid `@apply` abuse.

### Responsive with Tailwind
- [ ] Design mobile-first: base classes for mobile, then `sm: md: lg: xl: 2xl:` for larger screens.
- [ ] Use only the project's defined breakpoints; do not invent new ones ad hoc.
- [ ] Build every page and component for mobile, tablet, laptop, and desktop screen sizes.
- [ ] Prefer responsive layout utilities and flexible sizing (`flex`, `grid`, `gap`, `container`, `%`, `minmax()`, `clamp()`, and intrinsic sizing) over fixed widths or heights.
- [ ] Reflow, wrap, stack, collapse, or scroll content when space is limited; do not allow controls, text, tables, media, or dialogs to overflow the viewport.
- [ ] Avoid hiding critical content with `hidden` on mobile without an accessible alternative.
- [ ] Preserve content hierarchy and essential functionality at every screen size.
- [ ] Reuse responsive behavior in existing atoms, molecules, organisms, and templates instead of adding page-specific workarounds.
- [ ] Keep touch targets accessible and controls usable on touch devices; do not rely on hover as the only way to reveal an essential action.
- [ ] Ensure images, videos, embedded content, and other media scale within their containers while preserving their aspect ratio.
- [ ] Test at 320px, 768px, 1024px, and 1440px at minimum, including left-to-right and right-to-left layouts when supported.

### Dark Mode & Theming
- [ ] Use Tailwind's `dark:` variant consistently (class or media strategy — match the project).
- [ ] Ensure contrast ratios meet WCAG AA in both light and dark themes.
- [ ] Do not hardcode light-only colors; define semantic tokens (`bg-surface`, `text-muted`) that adapt to theme.

### Accessibility with Tailwind
- [ ] Always include visible `focus-visible:` styles on interactive elements.
- [ ] Use `sr-only` for screen-reader-only text where needed.
- [ ] Do not remove outlines without providing an accessible replacement.
- [ ] Use `motion-safe:`/`motion-reduce:` for animations.

---

## 4) Refactoring Checklist

- [ ] Before any change, describe the current state and name the problem.
- [ ] Apply changes in small, incremental steps so previous behavior is preserved.
- [ ] After refactoring, the component's public output/behavior must not change (refactor != feature).
- [ ] Move duplicated code into shared components/hooks/utilities.
- [ ] Move complex conditional logic into helper functions with meaningful names.
- [ ] Consolidate repeated Tailwind class clusters into variants or shared components.
- [ ] Remove unnecessary dependencies.
- [ ] Ensure existing tests still pass after refactoring.
- [ ] At the end, provide a summary of "what was refactored and why."

---

## 5) Django Checklist (Backend)

### Structure & Architecture
- [ ] Keep the project modular: apps/ per domain, core/ for shared concerns.
- [ ] Put business logic in services or selectors, not in views or models.
- [ ] Keep views thin; use serializers/forms for validation.
- [ ] Use select_related and prefetch_related to avoid N+1 queries.
- [ ] Define models with proper Meta, __str__, indexes, and constraints.
- [ ] Keep migrations small, named, and reversible.

### Code Quality & Readability
- [ ] Use meaningful names for models, fields, and functions following Django conventions.
- [ ] Read environment settings from env (no secrets in code).
- [ ] Use settings/base.py plus settings/local.py/production.py.
- [ ] Handle errors properly with APIException or standard responses.
- [ ] Use structured logging without sensitive information.
- [ ] Collect duplicated code into shared utilities/managers/services.
- [ ] Give every endpoint short documentation (docstring/OpenAPI).

### Security & Correctness
- [ ] Explicitly check authentication and permissions on every endpoint.
- [ ] Use CSRF, CORS, and throttling as required by the project.
- [ ] Always validate input; never trust raw input.
- [ ] Use raw queries only when necessary and always parameterized.
- [ ] Write tests for models, services, and sensitive endpoints.
- [ ] Set DEBUG=False in production and configure ALLOWED_HOSTS correctly.

### Frontend Integration
- [ ] Design APIs with a consistent response shape (e.g., {data, message, errors}).
- [ ] Keep field naming consistent with the frontend (camelCase or snake_case — pick one and stick to it).
- [ ] Return errors with status codes and user-displayable messages.
- [ ] Make pagination, filtering, and ordering standard and documented.
- [ ] Enable CORS only for allowed domains.
- [ ] Keep API base URL and environment config in frontend env files, not hardcoded.

---

## 6) Testing Checklist (Frontend + Backend)

### General Testing Rules
- [ ] Every new feature or bug fix must include tests; no untested logic is considered done.
- [ ] Tests must be deterministic, isolated, and independent of execution order.
- [ ] Follow the testing pyramid: many unit tests, some integration tests, few end-to-end tests.
- [ ] Test behavior and public contracts, not implementation details.
- [ ] Use descriptive test names: "should <expected behavior> when <condition>".
- [ ] Follow Arrange–Act–Assert structure in each test.
- [ ] No real network, real time, or real randomness in unit tests; mock or fake them.
- [ ] Keep test data minimal and readable; use factories/builders instead of huge fixtures.
- [ ] Tests must not depend on other tests or shared mutable state.
- [ ] Run the full test suite after changes and report the result.

### React / Frontend Testing
- [ ] Use React Testing Library for component tests; query by role, label, or text (not by class or test id unless necessary).
- [ ] Test user-visible behavior: rendering, interactions, conditional UI, error and loading states.
- [ ] Mock API calls (MSW or jest mocks) — never hit a real backend in tests.
- [ ] Test custom hooks separately with renderHook where logic is non-trivial.
- [ ] Cover edge cases: empty state, long text, missing props, error responses, slow responses.
- [ ] Add responsive-related assertions where layout logic matters (e.g., conditional render by breakpoint, or role changes on mobile).
- [ ] Do not assert on Tailwind class names directly; assert on roles, text, and accessible state instead.
- [ ] Where visual regressions matter, consider visual tests (e.g., Playwright screenshots) for key components.
- [ ] Ensure accessibility assertions where relevant (roles, labels, focus).
- [ ] Keep snapshot tests minimal; prefer explicit assertions over snapshots.
- [ ] Aim for meaningful coverage, not a coverage number; critical paths must be covered.
- [ ] Add E2E tests (Playwright/Cypress) for key user flows only: auth, checkout, main CRUD.

### Django / Backend Testing
- [ ] Use pytest-django (or Django TestCase) consistently across the project.
- [ ] Test models: validation, constraints, __str__, custom managers.
- [ ] Test services/selectors directly as the main unit of business logic.
- [ ] Test every endpoint: success, validation error, permission denied, not found, and auth required.
- [ ] Test permissions and authentication explicitly for each protected endpoint.
- [ ] Use factories (factory_boy) instead of large fixtures.
- [ ] Use pytest.mark.django_db and keep database state isolated per test.
- [ ] Assert query counts with django_assert_num_queries for critical paths to catch N+1.
- [ ] Mock external services (email, payment, third-party APIs); never call them in tests.
- [ ] Test pagination, filtering, and ordering behavior on list endpoints.
- [ ] Keep migrations tested implicitly by running the suite on a fresh test database.

### CI & Quality Gates
- [ ] Tests run automatically in CI on every push/PR.
- [ ] A PR is not mergeable if tests fail or lint/type checks fail.
- [ ] Enforce linting and formatting (ESLint + Prettier with tailwindcss plugin for React, Ruff/Flake8 + Black for Django).
- [ ] Enforce type checks (TypeScript strict mode, mypy where applicable).
- [ ] Report coverage on critical modules; block merges on uncovered critical paths.
- [ ] Fail fast: run lint and unit tests before slower integration/E2E tests.

---

## 7) Definition of Done Checklist

- [ ] Code is component-based, responsive, readable, and follows Atomic Design.
- [ ] Tailwind usage follows project tokens, mobile-first breakpoints, consistent class ordering, and no duplicated class clusters.
- [ ] Dark mode and accessibility (focus states, contrast, sr-only) are handled.
- [ ] Existing components are reused or extended backward-compatibly.
- [ ] Duplicated/smelly code has been refactored and the reason is stated.
- [ ] Types, error/loading states, and a11y are handled.
- [ ] Django backend follows service/selector structure, security, and documentation standards.
- [ ] Unit, integration, and (where relevant) E2E tests are written and passing.
- [ ] Lint, format, and type checks pass.
- [ ] A summary of changes + list of modified files + reason for each change is provided.
- [ ] Test results and coverage summary are reported.
