/**
 * The app also runs inside the Android "mini screen" (QuickAddActivity), a translucent window over
 * the home screen opened by the widgets. That window starts on /quick; the page is then transparent
 * and only the quick-add sheet is drawn.
 */
export const QUICK_MODE = typeof window !== 'undefined' && window.location.pathname.startsWith('/quick');
