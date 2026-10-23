// Turns a bottom sheet's panel into a whole-screen page: spread it last in the
// panel's style. Room at the top for the round back button; scrolls inside.
export const FULL_PAGE = {
  top: 0, bottom: 0, height: '100%', maxHeight: 'none', width: '100%', maxWidth: 430, margin: '0 auto',
  borderRadius: 0, overflowY: 'auto', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
  paddingTop: 'calc(60px + env(safe-area-inset-top))', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
};
