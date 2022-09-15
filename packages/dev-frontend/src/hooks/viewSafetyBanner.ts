import { useState, useEffect } from "react";

const  getSessionStorageOrDefault = (key: string, defaultValue: boolean) => {
  const stored = sessionStorage.getItem(key);
  if (!stored) {
    return defaultValue;
  }
  return JSON.parse(stored);
}

export const useViewSafetyBanner = () => {
  const [changeInProgress, setChangeInProgress] = useState(300);
  const [isDomainSafetyCheck, setIsDomainSafetyCheck] = useState(
    getSessionStorageOrDefault("safetyCheck", false)
  );
  useEffect(() => {
    sessionStorage.setItem("safetyCheck", JSON.stringify(isDomainSafetyCheck));
  }, [isDomainSafetyCheck]);

  useEffect(() => {
    const interval = setInterval(() => {
      setChangeInProgress(changeInProgress - 1);
      if (changeInProgress <= 0) {
        setIsDomainSafetyCheck(true);
      }
    }, 10);
    return () => clearInterval(interval);
  }, [changeInProgress]);

  return { isDomainSafetyCheck, changeInProgress };
};
