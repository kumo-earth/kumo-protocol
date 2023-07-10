import { useState, useEffect } from "react";

const getSessionStorageOrDefault = (key: string, defaultValue: boolean) => {
  const stored = sessionStorage.getItem(key);
  if (!stored) {
    return defaultValue;
  }
  return JSON.parse(stored);
};

export const useViewBanner = (visibility: number, viewId: string) => {
  const [changeInProgress, setChangeInProgress] = useState(visibility);
  const [isViewBannerCheck, setIsViewBannerCheck] = useState(
    getSessionStorageOrDefault(viewId, false)
  );
  useEffect(() => {
    sessionStorage.setItem(viewId, JSON.stringify(isViewBannerCheck));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewBannerCheck]);

  useEffect(() => {
    if (!isViewBannerCheck) {
      const interval = setInterval(() => {
        if (changeInProgress > 0) {
          setChangeInProgress(changeInProgress - 1);
        }
        if (changeInProgress === 0) {
          setIsViewBannerCheck(true);
        }
      }, 10);
      return () => clearInterval(interval);
    }
  }, [changeInProgress, isViewBannerCheck]);

  return { isViewBannerCheck, changeInProgress };
};
