import { useState, useEffect } from "react";
import { useMatch, useLocation } from "react-router-dom";
import { startCase } from 'lodash'

const useUserViewParam = (): string => {
  const [userViewParam, setUserViewParam] = useState("");
  const collateralTypeRoute = useMatch("/dashboard/:collateralType");
  const stakingTypeRoute = useMatch("/staking/:stakingType");

  const location = useLocation();

  useEffect(() => {
    setUserViewParam(startCase(location.pathname.slice(1)));
    if (collateralTypeRoute) {
      const { params } = collateralTypeRoute;
      if (params?.collateralType) {
        setUserViewParam(`${params?.collateralType} Vault`);
      }
    } else if (stakingTypeRoute) {
      const { params } = stakingTypeRoute;
      if (params?.stakingType) {
        setUserViewParam(startCase(`${params?.stakingType} Pool Staking`));
      }
    }
  }, [location.pathname, collateralTypeRoute, stakingTypeRoute]);

  return userViewParam;
};
export default useUserViewParam;
