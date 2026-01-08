import { useWindowEvent } from '@mantine/hooks';

export function useListNavigation({
  itemCount,
  selectedIndex,
  setSelectedIndex,
  onClose,
  onSelect,
  onFocusSidebar,
  sidebarFocused,
  disabled = false,
}) {
  useWindowEvent('keydown', (e) => {
    if (disabled || sidebarFocused || itemCount === 0) return;

    switch (e.key) {
      case 'Escape':
      case 'Backspace':
        e.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % itemCount);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + itemCount) % itemCount);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        onFocusSidebar();
        break;
      case 'Enter':
        e.preventDefault();
        onSelect(selectedIndex);
        break;
      default:
        // Handle webOS back button
        if (e.keyCode === 461) {
          e.preventDefault();
          onClose();
        }
    }
  });
}

export default useListNavigation;
