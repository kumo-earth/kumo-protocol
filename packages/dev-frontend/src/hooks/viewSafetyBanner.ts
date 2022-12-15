import { useState, useEffect } from "react";

const getSessionStorageOrDefault = (key: string, defaultValue: boolean) => {
  const stored = sessionStorage.getItem(key);
  if (!stored) {
    return defaultValue;
  }
  return JSON.parse(stored);
};

export const useViewSafetyBanner = () => {
  const [changeInProgress, setChangeInProgress] = useState(300);
  const [isDomainSafetyCheck, setIsDomainSafetyCheck] = useState(
    getSessionStorageOrDefault("safetyCheck", false)
  );
  useEffect(() => {
    sessionStorage.setItem("safetyCheck", JSON.stringify(isDomainSafetyCheck));
  }, [isDomainSafetyCheck]);

  useEffect(() => {
    if (!isDomainSafetyCheck) {
      const interval = setInterval(() => {
        if (changeInProgress > 0) {
          setChangeInProgress(changeInProgress - 1);
        }
        if (changeInProgress === 0) {
          setIsDomainSafetyCheck(true);
        }
      }, 10);
      return () => clearInterval(interval);
    }
  }, [changeInProgress, isDomainSafetyCheck]);

  return { isDomainSafetyCheck, changeInProgress };
};
