export interface PageProps {
  onClose: () => void;
  onFocusSidebar: () => void;
  sidebarFocused: boolean;
}
export interface PlaybackPageProps extends PageProps {
  setIsPlayerFullscreen: (value: boolean) => void;
}
