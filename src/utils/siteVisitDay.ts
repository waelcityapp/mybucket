const cairoDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function siteVisitDay(now = new Date()): string {
  return cairoDate.format(now);
}
