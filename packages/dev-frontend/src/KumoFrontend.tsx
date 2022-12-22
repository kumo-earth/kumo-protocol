import React from "react";
import { Flex, Container } from "theme-ui";
import { BrowserRouter as Router, Switch, Route, Redirect } from "react-router-dom";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Difference, Trove } from "@kumodao/lib-base";
import { KumoStoreProvider } from "@kumodao/lib-react";

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
import UserView from "./components/UserView";
import { Portfolio } from "./pages/Portfolio";
import { Stats } from "./pages/stats";
import { LiquidityStaking } from "./pages/LiquidityStaking";

type KumoFrontendProps = {
  loader?: React.ReactNode;
};
export const KumoFrontend: React.FC<KumoFrontendProps> = ({ loader }) => {
  const { account } = useWeb3React();
  const { provider, kumo } = useKumo();
  const { view } = useWalletView();
  const { view: switchNetworkView } = useSwitchNetworkView();

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

  const { state } = kumo?.store;

  console.log("blockedPolledStore1", kumo?.store);
  return (
    <KumoStoreProvider {...{ loader }} store={kumo.store}>
      <Router>
        <DashboardProvider>
          <TroveViewProvider>
            <StabilityViewProvider>
              <StakingViewProvider>
                <FarmViewProvider>
                  <DomainSafetyBanner />
                  <Flex variant="layout.app" sx={{ backgroundImage: `url(${appBackground})` }}>
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
                        <UserView />
                        <UserAccount />
                        {/* <SystemStatsPopup /> */}
                      </Header>

                      <Container variant="main">
                        {view === "OPEN" && <WalletModal />}
                        {switchNetworkView === "OPEN" && <SwitchNetworkModal />}{" "}
                        <Switch>
                          <Redirect from="/" to="/dashboard" exact />
                          <Redirect from="/stats" to="/stats/protocol" exact />

                          <Route path="/dashboard" exact>
                            <PageSwitcher />
                          </Route>
                          <Route path="/dashboard/:collateralType" exact>
                            <Collateral />
                          </Route>
                          <Route path="/portfolio" exact>
                            <Portfolio />
                          </Route>
                          <Route path="/staking" exact>
                            <StabilityPoolStaking />
                          </Route>
                          <Route path="/staking/liquidity" exact>
                            <LiquidityStaking />
                          </Route>
                          <Route path="/staking/:stakingType" exact>
                            <StakingType />
                          </Route>
                          <Route path="/staking/:stakingType/:modalType" exact>
                            <StakingType />
                          </Route>
                          <Route path="/stats/:statsType" exact>
                            <Stats />
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
