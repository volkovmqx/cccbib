import React from 'react';
import { Home } from '../components/Home';

import { AppShell, Stack, ActionIcon } from '@mantine/core';
import { IconHeart, IconInfoCircle, IconSearch, IconSettings } from '@tabler/icons-react';

export default function App() {

  return (
    <AppShell
      navbar={{ width: 200, breakpoint: 'sm' }}
    >
     
      <AppShell.Navbar p="md">
        <Stack justify="center" gap={0}>
          <ActionIcon variant="subtle" color="gray" className='actionButton' disabled={true}>
            <IconSearch style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" className='actionButton' disabled={true}>
            <IconHeart style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" className='actionButton' disabled={true}>
            <IconSettings style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="gray" className='actionButton' disabled={true}>
            <IconInfoCircle style={{ width: '70%', height: '70%' }} stroke={1.5} />
          </ActionIcon>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main pos={"relative"}> <Home /></AppShell.Main>
    </AppShell>
  );
}