import { useEffect } from 'react';

const APP_TITLE = 'CCCBib';

// The title of a screen goes after the app name, and leaving the screen brings back the title it replaced
export function usePageTitle(subject?: string | null) {
  useEffect(() => {
    if (!subject) return undefined;
    const previous = document.title;
    document.title = `${APP_TITLE} - ${subject}`;
    return () => { document.title = previous; };
  }, [subject]);
}
