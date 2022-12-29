import React from "react";
import { useParams } from "react-router-dom";
import { Card, Heading, Link, Box } from "theme-ui";
import { AddressZero } from "@ethersproject/constants";
import { Decimal, Percent, KumoStoreState, Vault } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { useDashboard } from "../hooks/DashboardContext";
import { useKumo } from "../hooks/KumoContext";
import { COIN, GT } from "../strings";
import { Statistic } from "./Statistic";
import { Icon } from "../components/Icon";


const selectBalances = ({ vaults, kusdBalance, kumoBalance }: KumoStoreState) => ({
  vaults,
  kusdBalance,
  kumoBalance
});

const Balances: React.FC = () => {
  const { vaults, kusdBalance, kumoBalance } = useKumoSelector(selectBalances);
  const { totalTroveCollDebt } = useDashboard();
  const { collateralType } = useParams<{ collateralType: string }>();
  const vault = vaults.find(vault => vault.asset === collateralType) || new Vault();
  const { accountBalance } = vault;

  return (
    <Box sx={{ px: 5, mt: 5 }}>
      <Heading as="h3" sx={{ my: 3 }}>My Portfolio</Heading>
      <Statistic name={"MY TOTAL COLLATERAL"}>{`$ ${totalTroveCollDebt.totalTroveColl.prettify(0)}`}</Statistic>
      <Statistic name={"MY MINTED KUSD"}>{`$ ${totalTroveCollDebt.totalTroveDebt.prettify(0)}`}</Statistic>
      <Statistic name={"MY TOTAL CARBON TOKENS"}>{`${totalTroveCollDebt.troveTotalCarbonCredits.prettify(0)}`}</Statistic>
    </Box>
  );
};

const GitHubCommit: React.FC<{ children?: string }> = ({ children }) =>
  children?.match(/[0-9a-f]{40}/) ? (
    <Link href={`https://github.com/kumo/dev/commit/${children}`}>{children.substr(0, 7)}</Link>
  ) : (
    <>unknown</>
  );

type SystemStatsProps = {
  variant?: string;
  showBalances?: boolean;
  onClose: (event: React.MouseEvent<HTMLElement>) => void;
};

const select = ({
  vaults,

  totalStakedKUMO,
  frontend
}: KumoStoreState) => ({
  vaults,
  totalStakedKUMO,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const SystemStats: React.FC<SystemStatsProps> = ({ variant = "info", showBalances, onClose }) => {
  const {
    kumo: {
      connection: { version: contractsVersion, deploymentDate, frontendTag }
    }
  } = useKumo();

  const { totalCollDebt } = useDashboard();

  const { vaults, totalStakedKUMO, kickbackRate } = useKumoSelector(select);

  const { collateralType } = useParams<{ collateralType: string }>();
  const vault = vaults.find(vault => vault.asset === collateralType) || new Vault;
  const { numberOfTroves, price, total, borrowingRate, kusdInStabilityPool } = vault;

  const kusdInStabilityPoolPct =
    total.debt.nonZero && new Percent(kusdInStabilityPool.div(total.debt));
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  const borrowingFeePct = new Percent(borrowingRate);
  const kickbackRatePct = frontendTag === AddressZero ? "100" : kickbackRate?.mul(100).prettify();

  return (
    <Card variant="systemStatsCard">
      <Heading as={"h2"}>Statistics
        <span
          style={{ marginLeft: "auto", cursor: "pointer" }}
          onClick={e => onClose(e)}
        >
          <Icon name="window-close" size={"1x"} color="#da357a" />
        </span>
      </Heading>
      <Box sx={{ px: 5, mt: 3 }}>
        <Heading as="h3" sx={{ my: 3 }}>
          KUMO Protocol
        </Heading>

        <Statistic name={"TOTAL COLLATERAL"}>{`$${totalCollDebt.totalColl.prettify(0)}`}</Statistic>
        <Statistic name={"TOTAL MINTED KUSD"}>{`$${totalCollDebt.totalDebt.prettify(0)}`}</Statistic>
        <Statistic name={"TOTAL CARBON CREDITS"}>{totalCollDebt.totalCarbonCredits.prettify(0)}</Statistic>

        {/* <Statistic
          name="Borrowing Fee"
          tooltip="The Borrowing Fee is a one-off fee charged as a percentage of the borrowed amount (in KUSD) and is part of a Vault's debt. The fee varies between 0.5% and 5% depending on KUSD redemption volumes."
        >
          {borrowingFeePct.toString(2)}
        </Statistic>

        <Statistic
          name="TVL"
          tooltip="The Total Value Locked (TVL) is the total value of Ether locked as collateral in the system, given in ETH and USD."
        >
          {total.collateral.shorten()} <Text sx={{ fontSize: 1 }}>&nbsp;ETH</Text>
          <Text sx={{ fontSize: 1 }}>
            &nbsp;(${Decimal.from(total.collateral.mul(price)).shorten()})
          </Text>
        </Statistic>
        <Statistic name="Vaults" tooltip="The total number of active Vaults in the system.">
          {Decimal.from(numberOfTroves).prettify(0)}
        </Statistic>
        <Statistic name="KUSD supply" tooltip="The total KUSD minted by the kumo Protocol.">
          {total.debt.shorten()}
        </Statistic>
        {kusdInStabilityPoolPct && (
          <Statistic
            name="KUSD in Stability Pool"
            tooltip="The total KUSD currently held in the Stability Pool, expressed as an amount and a fraction of the KUSD supply.
        "
          >
            {kusdInStabilityPool.shorten()}
            <Text sx={{ fontSize: 1 }}>&nbsp;({kusdInStabilityPoolPct.toString(1)})</Text>
          </Statistic>
        )}
        <Statistic
          name="Staked KUMO"
          tooltip="The total amount of KUMO that is staked for earning fee revenue."
        >
          {totalStakedKUMO.shorten()}
        </Statistic>
        <Statistic
          name="Total Collateral Ratio"
          tooltip="The ratio of the Dollar value of the entire system collateral at the current ETH:USD price, to the entire system debt."
        >
          {totalCollateralRatioPct.prettify()}
        </Statistic>
        <Statistic
          name="Recovery Mode"
          tooltip="Recovery Mode is activated when the Total Collateral Ratio (TCR) falls below 150%. When active, your Vault can be liquidated if its collateral ratio is below the TCR. The maximum collateral you can lose from liquidation is capped at 110% of your Vault's debt. Operations are also restricted that would negatively impact the TCR."
        >
          {total.collateralRatioIsBelowCritical(price) ? <Box color="danger">Yes</Box> : "No"}
        </Statistic> */}
      </Box>
      {showBalances && <Balances />}
      { }

      {/* <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Frontend
      </Heading>
      {kickbackRatePct && (
        <Statistic
          name="Kickback Rate"
          tooltip="A rate between 0 and 100% set by the Frontend Operator that determines the fraction of KUMO that will be paid out as a kickback to the Stability Providers using the frontend."
        >
          {kickbackRatePct}%
        </Statistic>
      )} */}

      {/* <Box sx={{ mt: 3, opacity: 0.66 }}>
        <Box sx={{ fontSize: 0 }}>
          Contracts version: <GitHubCommit>{contractsVersion}</GitHubCommit>
        </Box>
        <Box sx={{ fontSize: 0 }}>Deployed: {deploymentDate.toLocaleString()}</Box>
        <Box sx={{ fontSize: 0 }}>
          Frontend version:{" "}
          {process.env.NODE_ENV === "development" ? (
            "development"
          ) : (
            <GitHubCommit>{process.env.REACT_APP_VERSION}</GitHubCommit>
          )}
        </Box>
      </Box> */}
    </Card>
  );
};
