import { useState, useEffect } from "react";
import { useParams, useRouteMatch, useLocation } from "react-router-dom";
import { startCase } from 'lodash'

type UserView = {
  collateralType: string;
  stakingType: string;
};

const useUserViewParam = (): string => {
  const [userViewParam, setUserViewParam] = useState("");
  const collateralTypeRoute = useRouteMatch<UserView>("/dashboard/:collateralType");
  const stakingTypeRoute = useRouteMatch<UserView>("/staking/:stakingType");

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
