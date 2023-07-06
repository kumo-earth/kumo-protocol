import React from "react";
import { Flex, Container, Box, Text } from "theme-ui";
import { BrowserRouter as Router, Switch, Route, Redirect } from "react-router-dom";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Difference, Trove } from "@kumodao/lib-base";
import { KumoStoreProvider } from "@kumodao/lib-react";

import { useKumo } from "./hooks/KumoContext";
import { TransactionMonitor } from "./components/Transaction";
import { UserAccount } from "./components/UserAccount";
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
import { Collateral } from "./pages/Collateral";
import { StabilityPoolStaking } from "./pages/StabilityPoolStaking";
import { StakingType } from "./pages/StakingType";
import { DashboardProvider } from "./hooks/DashboardContext";
import { useWeb3React } from "@web3-react/core";
import { Banner } from "./components/Banner";
import appBackground from "./asset/images/appBackground.svg";
import UserView from "./components/UserView";
import { Portfolio } from "./pages/Portfolio";
import { Stats } from "./pages/stats";
import { LiquidityStaking } from "./pages/LiquidityStaking";
import { SystemStatsPopup } from "./components/SystemStatsPopup";
import Faucet from "./pages/Faucet";

type KumoFrontendProps = {
  loader?: React.ReactNode;
};
export const KumoFrontend: React.FC<KumoFrontendProps> = ({ loader }) => {
  const { account } = useWeb3React();
  const { provider, kumo } = useKumo();
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
                  <Banner bannerHeading="Information" visibility={1000} viewId="testToken">
                    <Text sx={{ fontWeight: 500 }}> This is the KUMO test version. Please connect and then request test tokens at the faucet. For feedback and questions, reach out to <Text sx={{ fontWeight: "bold" }}>contact@kumo.earth</Text>.</Text>
                  </Banner>
                  {/* {
                    account && <Banner bannerHeading="Faucet links for test MATICS" visibility={1000} viewId="matics">
                      <Link to={{ pathname: "https://mumbaifaucet.com/" }} target="_blank" sx={{ p: 0, pt: 2, pb: 1, textTransform: "lowercase" }}>https://mumbaifaucet.com/</Link>
                      <Link to={{ pathname: "https://faucet.polygon.technology/" }} target="_blank" sx={{ p: 0, pb: 2, textTransform: "lowercase"  }}>https://faucet.polygon.technology/</Link>
                    </Banner>
                  } */}
                  <Flex variant="layout.app" sx={{ backgroundImage: `url(${appBackground})` }}>
                    <Sidebar />
                    <Flex
                      sx={{
                        flexDirection: "column",
                        p: 0,
                        flexGrow: 1,
                        height: "100%",
                        width: ["100vw", "calc(100vw - 20vw)"]
                      }}
                    >
                      <Header>
                        <UserView />
                        <Box sx={{ display: ["none", "flex"] }}><UserAccount /></Box>
                        <SystemStatsPopup />
                      </Header>

                      <Container variant="main">
                        <Switch>
                          <Redirect from="/" to="/dashboard" exact />
                          <Route path="/dashboard" exact >
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
                          <Route path="/staking/:stakingType/:collateralType" exact>
                            <StakingType />
                          </Route>
                          <Redirect from="/stats" to="/stats/protocol" exact />
                          <Route path="/stats/:statsType" exact >
                            <Stats />
                          </Route>
                          <Route path="/farm" exact>
                            <Farm />
                          </Route>
                          <Route path="/risky-troves" exact>
                            <RiskyTrovesPage />
                          </Route>
                          <Route path="/redemption" exact>
                            <RedemptionPage />
                          </Route>
                          <Route path="/faucet" exact>
                            <Faucet />
                          </Route>
                          <Route path="*">
                            <Redirect from="*" to="/dashboard" exact />
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
