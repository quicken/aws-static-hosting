import { describe, it, expect } from 'vitest';
import { add, formatServiceName } from '../src/lib/utils';

describe('utils', () => {
  describe('add', () => {
    it('should add two numbers correctly', () => {
      expect(add(2, 3)).toBe(5);
      expect(add(-1, 1)).toBe(0);
      expect(add(0, 0)).toBe(0);
    });
  });

  describe('formatServiceName', () => {
    it('should format service name correctly', () => {
      expect(formatServiceName('hello-world')).toBe('Hello World Service');
      expect(formatServiceName('api')).toBe('Api Service');
      expect(formatServiceName('user-management-system')).toBe('User Management System Service');
    });
  });
});
