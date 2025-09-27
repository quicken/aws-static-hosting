/**
 * Adds two numbers together
 * @param a - First number
 * @param b - Second number
 * @returns Sum of a and b
 * @example
 * // Returns 5
 * add(2, 3)
 */
export const add = (a: number, b: number): number => {
  return a + b;
};

/**
 * Formats a service name for display
 * @param serviceName - Raw service name
 * @returns Formatted service name
 * @example
 * // Returns "Hello World Service"
 * formatServiceName("hello-world")
 */
export const formatServiceName = (serviceName: string): string => {
  return serviceName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') + ' Service';
};
