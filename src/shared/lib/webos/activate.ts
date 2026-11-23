export function activateApp() {
  const system = window.webOSSystem || window.PalmSystem;
  if (system && system.activate) system.activate();
}
