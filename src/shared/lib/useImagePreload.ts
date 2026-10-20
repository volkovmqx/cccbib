import { useEffect, useRef } from 'react';

// Preloads images for smoother carousel navigation
export function useImagePreload(images: (string | undefined)[], currentIndex: number, preloadCount = 2) {
  const preloadedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!images || images.length === 0) return;

    const toPreload: (string | undefined)[] = [];

    // Preload images before and after current index
    for (let i = 1; i <= preloadCount; i++) {
      const prevIndex = currentIndex - i;
      const nextIndex = currentIndex + i;

      if (prevIndex >= 0 && images[prevIndex]) {
        toPreload.push(images[prevIndex]);
      }
      if (nextIndex < images.length && images[nextIndex]) {
        toPreload.push(images[nextIndex]);
      }
    }

    toPreload.forEach(url => {
      if (url && !preloadedRef.current.has(url)) {
        const img = new Image();
        img.src = url;
        preloadedRef.current.add(url);
      }
    });
  }, [images, currentIndex, preloadCount]);
}

// Preloads a batch of images (for next conference row)
export function preloadImages(urls: (string | undefined)[]) {
  if (!urls || urls.length === 0) return;

  urls.forEach(url => {
    if (url) {
      const img = new Image();
      img.src = url;
    }
  });
}
