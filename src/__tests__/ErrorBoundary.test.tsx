import React from 'react';
import renderer from 'react-test-renderer';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Text } from 'react-native';

const ProblemChild = () => {
  throw new Error('Explosive component crash');
};

describe('ErrorBoundary Component Tests', () => {
  it('renders children when there is no error', () => {
    let tree: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <ErrorBoundary>
          <Text>Normal App Content</Text>
        </ErrorBoundary>
      );
    });

    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Normal App Content');
  });

  it('renders Neumorphic fallback UI when child throws error', () => {
    // Suppress console.error in this specific test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    let tree: renderer.ReactTestRenderer;
    renderer.act(() => {
      tree = renderer.create(
        <ErrorBoundary fallbackMessage="Custom error message">
          <ProblemChild />
        </ErrorBoundary>
      );
    });

    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Đã xảy ra sự cố');
    expect(json).toContain('Custom error message');
    expect(json).toContain('Thử lại');

    spy.mockRestore();
  });
});
