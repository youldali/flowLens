import { useCallback } from 'react';

export type DateFormat =
  | 'short'
  | 'medium'
  | 'long'
  | 'full'
  | 'time'
  | 'dateTime';

export type LocaleFormat = (
  date: Date | number | string,
  format?: DateFormat,
  options?: Intl.DateTimeFormatOptions,
) => string;

const DATE_FORMAT_OPTIONS = {
  short: {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  },
  medium: {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  },
  long: {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  },
  full: {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  },
  time: {
    hour: '2-digit',
    minute: '2-digit',
  },
  dateTime: {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  },
} satisfies Record<DateFormat, Intl.DateTimeFormatOptions>;

export const useDateFormatter = (language: string): LocaleFormat => {
  return useCallback(
    (date, format = 'medium', options) => {
      const dateToFormat = toDate(date);

      if (!dateToFormat) {
        return '';
      }

      return new Intl.DateTimeFormat(language, {
        ...DATE_FORMAT_OPTIONS[format],
        ...options,
      }).format(dateToFormat);
    },
    [language],
  );
};

const toDate = (date: Date | number | string): Date | undefined => {
  const dateToFormat = date instanceof Date ? date : new Date(date);

  return Number.isNaN(dateToFormat.getTime()) ? undefined : dateToFormat;
};
