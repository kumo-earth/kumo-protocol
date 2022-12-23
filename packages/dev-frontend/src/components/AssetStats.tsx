import React from "react";
import { Card, Heading, Link, Box, Text, Flex, Progress, Divider } from "theme-ui";
import { Decimal, KumoStoreState, Trove } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

import { useKumo } from "../hooks/KumoContext";
import { toUpper } from "lodash";
import { InfoIcon } from "./InfoIcon";

// const selectBalances = ({ accountBalance, kusdBalance, kumoBalance }: KumoStoreState) => ({
//   accountBalance,
//   kusdBalance,
//   kumoBalance
// });

const Balances: React.FC = () => {
  // const { accountBalance, kusdBalance, kumoBalance } = useKumoSelector(selectBalances);

  return (
    <Box sx={{ mb: 3 }}>
      <Heading>My Account Balances</Heading>
      {/* <Statistic name="ETH"> {accountBalance.prettify(4)}</Statistic>
      <Statistic name={COIN}> {kusdBalance.prettify()}</Statistic>
      <Statistic name={GT}>{kumoBalance.prettify()}</Statistic> */}
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
  total: Trove;
  totalCollateralRatioPct: string;
  kusdMintedCap: Decimal;
  minNetDebt: Decimal;
  collateralType: string;
  variant?: string;
  showBalances?: boolean;
};

const select = ({
  // numberOfTroves,
  // price,
  // total,
  // kusdInStabilityPool,
  // borrowingRate,
  // redemptionRate,
  totalStakedKUMO,
  frontend
}: KumoStoreState) => ({
  // numberOfTroves,
  // price,
  // total,
  // kusdInStabilityPool,
  // borrowingRate,
  // redemptionRate,
  totalStakedKUMO,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const AssetStats: React.FC<SystemStatsProps> = ({
  total,
  totalCollateralRatioPct,
  kusdMintedCap,
  minNetDebt,
  collateralType,
  variant = "info",
  showBalances
}) => {
  const {
    kumo: {
      connection: { version: contractsVersion, deploymentDate, frontendTag }
    }
  } = useKumo();

  const {
    // numberOfTroves,
    // price,
    // kusdInStabilityPool,
    // total,
    // borrowingRate,
    totalStakedKUMO,
    kickbackRate
  } = useKumoSelector(select);

  // const kusdInStabilityPoolPct =
  //   total.debt.nonZero && new Percent(kusdInStabilityPool.div(total.debt));
  // const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  // const borrowingFeePct = new Percent(borrowingRate);
  // const kickbackRatePct = frontendTag === AddressZero ? "100" : kickbackRate?.mul(100).prettify();

  return (
    <Card variant="base" sx={{ py: 4, px: 5 }}>
      <Flex sx={{ flexDirection: "column", justifyContent: "space-between", mb: 1}}>
        <Text as="p" variant="normalBold">
          TOTAL COLLATERAL RATIO{" "}
          <InfoIcon
            tooltip={
              <Card variant="tooltip" sx={{ width: "220px" }}>
                {`The Total Collateral Ratio or TCR is the ratio of the Dollar value of the entire
                system collateral at the current ${toUpper(
                  collateralType
                )}:USD price, to the entire system debt.`}
              </Card>
            }
          />
        </Text>
        <Text as="p" variant="xlarge" sx={{ mt: 1 }}>
          {totalCollateralRatioPct}
        </Text>
      </Flex>
      <Flex sx={{ justifyContent: "space-between", mt: 4 }}>
        <Text as="p" variant="medium">
          TOTAL MINTED
        </Text>
        <Text as="p" variant="medium">
          {total?.debt.prettify(0)} {"KUSD"}
        </Text>
      </Flex>
      <Box sx={{ my: 2 }}>
        <Progress
          max={kusdMintedCap.toString()}
          value={total?.debt.toString()}
          sx={{ height: "12px", backgroundColor: "#F0CFDC" }}
        ></Progress>
      </Box>
      <Flex sx={{ justifyContent: "space-between" }}>
        <Text as="p" variant="medium">
          MINT CAP
        </Text>
        <Text as="p" variant="medium">
          {kusdMintedCap?.shorten().toLowerCase()}
        </Text>
      </Flex>
      <Divider sx={{ my: 3, color: "#E6E6E6" }} />
      <Box sx={{ my: 2 }}>
        <Flex sx={{ justifyContent: "space-between", mb: 2 }}>
          <Text as="p" variant="small">
            MIN. NET DEBT
          </Text>
          <Text as="p" variant="small">
            ${minNetDebt.toString()}
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mb: 2 }}>
          <Text as="p" variant="small">
            MIN. COLLATERAL RATIO
          </Text>
          <Text as="p" variant="small">
            110%
          </Text>
        </Flex>
      </Box>
    </Card>
  );
};
