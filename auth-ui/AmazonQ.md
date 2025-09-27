# Amazon Q Project Guidelines

## Project Overview
React 19 + TypeScript + Vite application demonstrating AWS Cognito authentication flows.

## Code Standards

### React 19 Best Practices
- Use React 19 features: `use()` hook, Server Components when applicable
- Prefer function components with hooks over class components
- Use React.memo() for performance optimization when needed
- Implement proper error boundaries
- Use Suspense for data fetching and code splitting

### TypeScript Rules
- Strict mode enabled - no `any` types
- Define interfaces for all props and state
- Use type assertions sparingly, prefer type guards
- Export types from `src/types/` directory
- Use generic types for reusable components

### File Structure
```
src/
├── component/     # React components
├── lib/          # Utility functions and business logic
├── types/        # TypeScript type definitions
└── styles.css    # External stylesheet
__tests__/        # Unit tests (next to src directory)
```

### Styling Rules
- **AWS CloudScape Design System** for all UI components
- Use CloudScape components instead of custom CSS where possible
- Load CloudScape global styles in index.html
- Follow CloudScape design patterns and guidelines
- Custom CSS only for application-specific styling not covered by CloudScape
- Use semantic CloudScape component names and properties

### CSS Best Practices
- Use kebab-case for class names (e.g., `.auth-container`)
- Group related styles together
- Use meaningful, descriptive class names
- Avoid overly specific selectors
- Use CSS Grid/Flexbox for layouts
- Mobile-first responsive design
- Consistent spacing and typography scale

### Testing Requirements
- Create `__tests__/` directory next to `src/` for unit tests
- Test all business logic in `src/lib/`
- Use Vitest for unit testing (add to devDependencies)
- Test file naming: `*.test.ts` or `*.test.tsx`
- Minimum 80% code coverage for business logic

### Documentation Standards
- JSDoc comments required for:
  - All exported functions
  - All React components
  - All TypeScript interfaces
  - Complex business logic

### JSDoc Format
```typescript
/**
 * Brief description of the function/component
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @example
 * // Usage example
 */
```

### Prettier Configuration
- Use project's Prettier settings
- 2-space indentation
- Single quotes for strings
- Trailing commas where valid
- Line length: 80 characters

### Component Guidelines
- One component per file
- Use descriptive component names (PascalCase)
- **File names must be capitalized** (e.g., Dashboard.tsx, AuthTest.tsx)
- Props interface should be named `ComponentNameProps`
- Export components as default exports
- Keep components under 200 lines
- Use className prop for CSS classes, never style prop

### Business Logic
- Place all business logic in `src/lib/`
- Pure functions preferred
- Each function should have unit tests
- Export functions with descriptive names
- Avoid side effects in business logic functions

### Import Organization
1. React imports
2. Third-party libraries
3. Internal components
4. Types
5. Utilities

### Performance Guidelines
- Use `React.memo()` for expensive components
- Implement proper dependency arrays in hooks
- Avoid inline object/function creation in render
- Use `useMemo()` and `useCallback()` judiciously

## Code Generation Rules
- Always include TypeScript types
- Add JSDoc comments to generated code
- Include basic unit tests for business logic
- Follow the established file structure
- Use modern React 19 patterns
- Ensure accessibility compliance (ARIA attributes)
- Use external CSS classes, never inline styles
