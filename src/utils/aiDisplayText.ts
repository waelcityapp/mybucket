/** Keep provider names out of user-visible copy and upstream messages. */
export function aiDisplayText(text: string, lang: 'ar' | 'en') {
  return text.replace(/(بـ?)?\b(?:gemini|gimine)\b|(?:جيميني|جيمناي)/gi, (_, prefix: string | undefined) =>
    prefix ? 'بالذكاء الاصطناعي' : lang === 'ar' ? 'الذكاء الاصطناعي' : 'AI');
}
