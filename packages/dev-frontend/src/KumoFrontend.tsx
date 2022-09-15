import React from "react";
import { Flex, Container } from "theme-ui";
import { HashRouter as Router, Switch, Route } from "react-router-dom";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Difference, Trove } from "@kumodao/lib-base";
import { KumoStoreProvider } from "@kumodao/lib-react";

import { useViewSafetyBanner } from "./hooks/viewSafetyBanner";
import { useKumo } from "./hooks/KumoContext";
import { useWalletView } from "./components/WalletConnect/context/WalletViewContext";
import { useSwitchNetworkView } from "./components/SwitchNetwork/context/SwitchNetworkViewContext";
import { TransactionMonitor } from "./components/Transaction";
import { UserAccount } from "./components/UserAccount";
import { SystemStatsPopup } from "./components/SystemStatsPopup";
import { Header } from "./components/Header";

import { PageSwitcher } from "./pages/PageSwitcher";
import { Farm } from "./pages/Farm";
import { RiskyTrovesPage } from "./pages/RiskyTrovesPage";
import { RedemptionPage } from "./pages/RedemptionPage";

import { TroveViewProvider } from "./components/Trove/context/TroveViewProvider";
import { StabilityViewProvider } from "./components/Stability/context/StabilityViewProvider";
import { StakingViewProvider } from "./components/Staking/context/StakingViewProvider";
import { FarmViewProvider } from "./components/Farm/context/FarmViewProvider";
import { Sidebar } from "./components/Sidebar/Siderbar";
import { WalletModal } from "./components/WalletConnect/WalletModal";
import { Collateral } from "./pages/Collateral";
import { StabilityPoolStaking } from "./pages/StabilityPoolStaking";
import { StakingType } from "./pages/StakingType";
import { DashboardProvider } from "./hooks/DashboardContext";
import { useWeb3React } from "@web3-react/core";
import { SwitchNetworkModal } from "./components/SwitchNetwork/SwitchNetwork";
import { DomainSafetyBanner } from "./components/DomainSafetyBanner";

import appBackground from "./asset/images/appBackground.svg";

type KumoFrontendProps = {
  loader?: React.ReactNode;
};
export const KumoFrontend: React.FC<KumoFrontendProps> = ({ loader }) => {
  const { account } = useWeb3React();
  const { provider, kumo } = useKumo();
  const { view } = useWalletView();
  const { view: switchNetworkView } = useSwitchNetworkView();
  const { isDomainSafetyCheck, changeInProgress } = useViewSafetyBanner();

  // For console tinkering ;-)
  Object.assign(window, {
    account,
    provider,
    kumo,
    Trove,
    Decimal,
    Difference,
    Wallet
  });

  return (
    <KumoStoreProvider {...{ loader }} store={kumo.store}>
      <Router>
        <DashboardProvider>
          <TroveViewProvider>
            <StabilityViewProvider>
              <StakingViewProvider>
                <FarmViewProvider>
                  {!isDomainSafetyCheck && <DomainSafetyBanner changeInProgress={changeInProgress} />}

                  <Flex
                    sx={{
                      flexWrap: "wrap",
                      height: "100vh",
                      overflow: "hidden",
                      backgroundImage: `url(${appBackground})`,
                      backgroundSize: "cover",
                      backgroundRepeat: "no-repeat",
                      flexDirection: "column"
                    }}
                  >
                    <Sidebar />
                    <Flex
                      sx={{
                        flexDirection: "column",
                        p: 0,
                        flexGrow: 1,
                        height: "100%",
                        width: "calc(100vw - 20vw)"
                      }}
                    >
                      <Header>
                        <UserAccount />
                        <SystemStatsPopup />
                      </Header>

                      <Container variant="main">
                        {view === "OPEN" && <WalletModal />}
                        {switchNetworkView === "OPEN" && <SwitchNetworkModal />}{" "}
                        <Switch>
                          <Route path="/" exact>
                            <PageSwitcher />
                          </Route>
                          <Route path="/dashboard/:collateralType" exact>
                            <Collateral />
                          </Route>
                          <Route path="/staking" exact>
                            <StabilityPoolStaking />
                          </Route>
                          <Route path="/staking/:stakingType" exact>
                            <StakingType />
                          </Route>
                          <Route path="/staking/:stakingType/:modalType" exact>
                            <StakingType />
                          </Route>
                          <Route path="/farm">
                            <Farm />
                          </Route>
                          <Route path="/risky-troves">
                            <RiskyTrovesPage />
                          </Route>
                          <Route path="/redemption">
                            <RedemptionPage />
                          </Route>
                        </Switch>
                      </Container>
                    </Flex>
                  </Flex>
                </FarmViewProvider>
              </StakingViewProvider>
            </StabilityViewProvider>
          </TroveViewProvider>
        </DashboardProvider>
      </Router>
      <TransactionMonitor />
    </KumoStoreProvider>
  );
};
