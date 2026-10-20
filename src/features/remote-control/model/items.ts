import type { CommandItem, RemoteCommand } from './types';

const MAX_ITEMS = 50;

const number = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function commandItems(command: RemoteCommand) {
  const items: CommandItem[] = [];
  const add = (input: unknown) => {
    let entry = input as { link?: unknown; position?: unknown; percent?: unknown } | string | null;
    if (typeof entry === 'string') entry = { link: entry };
    // Keep invalid entries so progress-set can reject the entire replacement.
    items.push({
      link: entry && typeof entry.link === 'string' ? entry.link : null,
      position: number(entry && entry.position),
      percent: number(entry && entry.percent),
    });
  };
  if (Array.isArray(command.items)) command.items.forEach(add);
  if (Array.isArray(command.links)) command.links.forEach(add);
  if (command.link !== undefined) add({ link: command.link, position: command.position, percent: command.percent });
  return items.slice(0, MAX_ITEMS);
}
