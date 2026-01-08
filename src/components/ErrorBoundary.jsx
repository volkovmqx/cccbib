import React from 'react';
import { Center, Text, Stack, Button } from '@mantine/core';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Optionally clear cache and reload
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Center h="100vh" style={{ backgroundColor: '#000' }}>
          <Stack spacing="md" align="center" style={{ maxWidth: '600px', padding: '20px' }}>
            <Text size="xl" weight={700} color="#AAF40D">
              Something went wrong
            </Text>
            <Text size="md" color="#909296" align="center">
              The application encountered an unexpected error. Please try reloading the page.
            </Text>
            {this.state.error && (
              <Text size="sm" color="#666" style={{ fontFamily: 'monospace' }}>
                {this.state.error.toString()}
              </Text>
            )}
            <Button
              onClick={this.handleReset}
              style={{
                backgroundColor: '#AAF40D',
                color: '#000',
                fontWeight: 'bold',
                marginTop: '20px'
              }}
            >
              Reload Application
            </Button>
          </Stack>
        </Center>
      );
    }

    return this.props.children;
  }
}
