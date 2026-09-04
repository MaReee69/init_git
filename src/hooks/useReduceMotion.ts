import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * OSの「視差効果を減らす/Reduce Motion」設定を購読する。
 * 有効時は近未来的な変形・粒子アニメーションを静的表現に縮退させるために使う。
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduceMotion(value);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
