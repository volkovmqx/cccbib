const SUBTITLE_CHOICES_KEY = 'subtitle_choices';
const MAX_ITEMS = 100;

const readChoices = (): [string, string][] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SUBTITLE_CHOICES_KEY) || 'null');
    return Array.isArray(parsed) ? parsed.filter((item) => Array.isArray(item) && item[0] && item[1]) : [];
  } catch (error) {
    return [];
  }
};

export function getSavedSubtitleLanguage(eventGuid?: string) {
  if (!eventGuid) return null;
  const saved = readChoices().find(([guid]) => guid === eventGuid);
  return saved ? saved[1] : null;
}

export function saveSubtitleLanguage(eventGuid: string | undefined, language: string) {
  if (!eventGuid || !language) return;
  try {
    const choices = readChoices().filter(([guid]) => guid !== eventGuid);
    choices.push([eventGuid, language]);
    localStorage.setItem(SUBTITLE_CHOICES_KEY, JSON.stringify(choices.slice(-MAX_ITEMS)));
  } catch (error) {
    console.error('Error saving subtitle choice:', error);
  }
}
