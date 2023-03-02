import React from "react";
import { Card, Box, Text, Flex, Progress, Divider } from "theme-ui";
import { Decimal, KumoStoreState, Trove } from "@kumodao/lib-base";

import { toUpper } from "lodash";
import { InfoIcon } from "./InfoIcon";

type SystemStatsProps = {
  total: Trove;
  totalCollateralRatioPct: string;
  kusdMintedCap: Decimal;
  minNetDebt: Decimal;
  collateralType: string;
  variant?: string;
  showBalances?: boolean;
};

export const AssetStats: React.FC<SystemStatsProps> = ({
  total,
  totalCollateralRatioPct,
  kusdMintedCap,
  minNetDebt,
  collateralType,
}) => {

  return (
    <Card variant="base" sx={{ py: 4, px: 5 }}>
      <Flex sx={{ flexDirection: "column", justifyContent: "space-between", mb: 1 }}>
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
