import React, { useState } from 'react';
import { Home } from '../components/Home';
import { Sidebar } from '../components/Sidebar';

import { AppShell } from '@mantine/core';

export default function App() {
  const [sidebarFocused, setSidebarFocused] = useState(false);
  const [selectedItem, setSelectedItem] = useState('recent');
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);

  return (
    <AppShell
      navbar={
        !isPlayerFullscreen && (
          <Sidebar
            selectedItem={selectedItem}
            onSelectItem={(item) => {
              setSelectedItem(item);
              setSidebarFocused(false);
            }}
            focused={sidebarFocused}
          />
        )
      }
      padding={0}
      styles={{
        main: {
          marginLeft: isPlayerFullscreen ? 0 : 'var(--sidebar-width)',
          width: isPlayerFullscreen ? '100vw' : 'calc(100% - var(--sidebar-width))',
          paddingLeft: 0,
        }
      }}
    >
      <Home
        selectedItem={selectedItem}
        onFocusSidebar={() => setSidebarFocused(true)}
        onSelectItem={(item) => setSelectedItem(item)}
        sidebarFocused={sidebarFocused}
        isPlayerFullscreen={isPlayerFullscreen}
        setIsPlayerFullscreen={setIsPlayerFullscreen}
      />
    </AppShell>
  );
}