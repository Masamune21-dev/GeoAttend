import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Tinggi papan ketik saat ini dalam dp, 0 bila tersembunyi.
 *
 * Dipakai untuk mengangkat isi Modal/bottom sheet di atas papan ketik. Isi
 * Modal tidak bisa mengandalkan `adjustResize` Android — jendela dialognya
 * sering tidak ikut menyusut, sehingga formnya tertutup papan ketik.
 *
 * iOS memakai event `will…` supaya geraknya seirama animasi papan ketik,
 * Android hanya punya `did…`.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const isIos = Platform.OS === 'ios';
    const show = Keyboard.addListener(isIos ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(isIos ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
