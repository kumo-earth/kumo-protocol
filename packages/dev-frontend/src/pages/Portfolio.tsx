import { KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { useWeb3React } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import { useState, useEffect } from "react";
import { Divider, Flex, Alert } from "theme-ui";
import { DashboadContent } from "../components/DashboardContent";
import { DashboadHeaderItem } from "../components/DashboardHeaderItem";
import { PortfolioTrove } from "../components/Trove/PortfolioTrove";
import { useDashboard } from "../hooks/DashboardContext";
import { UserViewAlert } from "../components/UserViewAlert";

const select = ({ vaults }: KumoStoreState) => ({
  vaults
});

export const Portfolio: React.FC = () => {
  const { account } = useWeb3React<Web3Provider>();
  const [isView, setIsView] = useState(true);
  const [isAnyOpenTrove, setIsAnyTrove] = useState(false);
  const { totalTroveCollDebt } = useDashboard();
  const { vaults } = useKumoSelector(select);

  useEffect(() => {
    if (vaults?.length > 0) {
      const status = vaults.some(vault => vault?.trove?.status === "open");
      if (status) {
        setIsAnyTrove(true);
      }
    }
  }, [vaults]);

  return (
    <Flex sx={{ flexDirection: "column" }}>
      {!account && isView  && <UserViewAlert onClose={() => setIsView(false)} />} 
      <Flex sx={{ height: "max-content", px: 5, pb: 4 }}>
        <DashboadHeaderItem
          title={"MY TOTAL COLLATERAL"}
          value={`$ ${totalTroveCollDebt.totalTroveColl.prettify(0)}`}
        />
        <DashboadHeaderItem
          title={"MY MINTED KUSD"}
          value={`$ ${totalTroveCollDebt.totalTroveDebt.prettify(0)}`}
        />
        <DashboadHeaderItem
          title={"MY TOTAL CARBON TOKENS"}
          value={`${totalTroveCollDebt.troveTotalCarbonCredits.prettify(0)}`}
        />
      </Flex>
      <Divider sx={{ color: "muted" }} />
      <DashboadContent>
        {isAnyOpenTrove
          ? vaults.map(vault => {
              return vault?.trove.status === "open" && <PortfolioTrove vault={vault} />;
            })
          : "You Don't Have Any Vault Opened, Please go to Dashboard Page"}
      </DashboadContent>
    </Flex>
  );
};
