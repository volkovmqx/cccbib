import 'core-js/stable';

import React from 'react';
import '@mantine/core/styles.css';


import { MantineProvider, createTheme } from '@mantine/core';
import { createRoot } from 'react-dom/client';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';

const theme = createTheme();

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        conferencesRecent: {
          keyArgs: [],
          fieldName: 'id',
          merge(existing, incoming, { args: { offset = 0 }, readField}) {
            // Slicing is necessary because the existing data is
            // immutable, and frozen in development.
            const merged = existing ? existing.slice(0) : [];
            // check if the id is already in the cache
            const foundIds = merged.map((node) => readField('id', node));
            const incomingIds = incoming.map((node) => readField('id', node));
            const newIds = incomingIds.filter((id) => !foundIds.includes(id));
            // add only the new data to the merged array
            const newNodes = incoming.filter((node) => newIds.includes(readField('id', node)));
            // add the new data to the end of the merged array
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
});

import App from './App';


const container = document.getElementById('app');
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(
    <MantineProvider defaultColorScheme="dark" theme={theme}>
      <ApolloProvider client={client}>
        <App />
      </ApolloProvider>
    </MantineProvider>
);