import { useState, useEffect } from "react";

const getSessionStorageOrDefault = (key: string, defaultValue: boolean) => {
  const stored = sessionStorage.getItem(key);
  if (!stored) {
    return defaultValue;
  }
  return JSON.parse(stored);
};

export const useViewBanner = (visibility: number) => {
  const [changeInProgress, setChangeInProgress] = useState(visibility);
  const [isViewBannerCheck, setIsViewBannerCheck] = useState(
    getSessionStorageOrDefault("viewCheck", false)
  );
  useEffect(() => {
    sessionStorage.setItem("viewCheck", JSON.stringify(isViewBannerCheck));
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
