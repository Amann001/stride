import { router } from 'expo-router';
import { Alert, Share, type ShareContent } from 'react-native';

// Small fixes so the web app behaves like the phone apps. Imported once, by the root layout.

// Back: on the web you can refresh a page or open a link straight to a screen, so there may be
// no earlier screen to go back to. Then "back" (after Save, Cancel, Done...) goes Home instead
// of doing nothing and leaving you stuck.
const back = router.back;
router.back = () => (router.canGoBack() ? back() : router.replace('/'));

// Share: phones and some browsers have a share sheet (navigator.share). Where a browser has
// none (most desktop browsers), the text is copied instead, so the Share button always works.
Share.share = async (content: ShareContent) => {
  const text = 'message' in content && content.message ? content.message : '';
  const url = 'url' in content && content.url ? content.url : undefined;
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: content.title, text, url });
      return { action: Share.sharedAction };
    } catch (err) {
      // Closing the share sheet isn't an error.
      if (err instanceof Error && err.name === 'AbortError') return { action: Share.dismissedAction };
    }
  }
  try {
    await navigator.clipboard.writeText([text, url].filter(Boolean).join(' '));
    Alert.alert('Copied', 'Paste it into a message to share it.');
    return { action: Share.sharedAction };
  } catch {
    Alert.alert('Couldn’t share', 'Your browser doesn’t allow sharing or copying here.');
    return { action: Share.dismissedAction };
  }
};
