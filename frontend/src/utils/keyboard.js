import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

let keyboardListeners = [];

export const setupKeyboardListeners = () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  Keyboard.setResizeMode({ mode: 'native' }).catch(() => {});

  const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
    document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight || 0}px`);
    document.body.classList.add('keyboard-visible');
  });

  const hideListener = Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.style.setProperty('--keyboard-height', '0px');
    document.body.classList.remove('keyboard-visible');
  });

  // Reset keyboard state when app returns to foreground (fixes gray area
  // when switching from another app that had the keyboard open)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      Keyboard.hide().catch(() => {});
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.body.classList.remove('keyboard-visible');
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  keyboardListeners.push(showListener, hideListener);

  return () => {
    keyboardListeners.forEach(listener => listener.remove());
    keyboardListeners = [];
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};
