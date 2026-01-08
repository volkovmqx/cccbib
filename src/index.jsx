// Polyfills are loaded via webpack config, no need to import here

// Suppress ResizeObserver errors (common browser warning that doesn't affect functionality)
const resizeObserverErrorHandler = (e) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
    const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
    if (resizeObserverErr) {
      resizeObserverErr.setAttribute('style', 'display: none');
    }
    if (resizeObserverErrDiv) {
      resizeObserverErrDiv.setAttribute('style', 'display: none');
    }
  }
};
window.addEventListener('error', resizeObserverErrorHandler);

import React from 'react';
import { MantineProvider } from '@mantine/core';
import { createRoot } from 'react-dom/client';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        conferencesRecent: {
          keyArgs: [],
          fieldName: 'id',
          merge(existing, incoming, { args: { offset = 0 }, readField}) {
            const merged = existing ? existing.slice(0) : [];
            // Use Set for O(1) lookups instead of O(n) includes
            const foundIds = new Set(merged.map((node) => readField('id', node)));
            const newNodes = incoming.filter((node) => !foundIds.has(readField('id', node)));
            // Add new data at the correct offset
            for (let i = 0; i < newNodes.length; ++i) {
              merged[offset + i] = newNodes[i];
            }
            return merged;
          },
        },
      },
    },
  },
});

const client = new ApolloClient({
  uri: 'https://media.ccc.de/graphql',
  cache: cache,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

// Clear Apollo cache asynchronously to not block startup
const SCHEMA_VERSION = '2';
const storedVersion = localStorage.getItem('apollo_schema_version');
if (storedVersion !== SCHEMA_VERSION) {
  // Don't block startup - clear cache in background
  Promise.resolve().then(() => {
    return client.clearStore();
  }).then(() => {
    localStorage.setItem('apollo_schema_version', SCHEMA_VERSION);
  });
}

import App from './App';

const container = document.getElementById('app');
const root = createRoot(container);
root.render(
    <MantineProvider defaultColorScheme="dark">
      <ApolloProvider client={client}>
        <App />
      </ApolloProvider>
    </MantineProvider>
);