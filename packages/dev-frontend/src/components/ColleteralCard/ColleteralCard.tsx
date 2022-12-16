import { Decimal, Trove, UserTrove } from "@kumodao/lib-base";
import React from "react";
import { useHistory } from "react-router-dom";
import { Flex, Progress, Box, Card, Text, Heading } from "theme-ui";

import { useTroveView } from "../Trove/context/TroveViewContext";
import { toUpper } from "lodash";
import { InfoIcon } from "../InfoIcon";

type CollateralCardProps = {
  collateralType?: string;
  totalCollateralRatioPct: string;
  total: Trove;
  kusdInStabilityPool: Decimal;
  borrowingRate: Decimal;
  kusdMintedCap: Decimal;
};

export const CollateralCard: React.FC<CollateralCardProps> = ({
  collateralType,
  totalCollateralRatioPct,
  total,
  kusdInStabilityPool,
  borrowingRate,
  kusdMintedCap
}) => {
  const { dispatchEvent, view } = useTroveView();
  const history = useHistory();

  const handleClick = () => {
    if (view === "ADJUSTING") {
      dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED");
    }
    history.push(`/dashboard/${collateralType}`);
  };
  return (
    <Card variant="collateralCard" sx={{ mb: 5 }} onClick={() => handleClick()}>
      {/* {!account && (
        <Flex
          sx={{
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            mt: 30
          }}
          onClick={e => e.stopPropagation()}
        >
          <Box sx={{ fontWeight: 600 }}>Please Connect the Wallet to Proceed</Box>
        </Flex>
      )} */}
      <Heading as="h2">{toUpper(collateralType)} Vault</Heading>

      <Box sx={{ px: 4, mt: 5 }}>
        <Text as="p" variant="normalBold">
          TOTAL COLLATERAL RATIO{" "}
          <InfoIcon
            tooltip={
              <Card variant="tooltip" sx={{ width: "220px" }}>
                {`The Total Collateral Ratio or TCR is the ratio of the Dollar value of the entire
                system collateral at the current ${toUpper(collateralType)}:USD price, to the entire system debt.`}
              </Card>
            }
          />
        </Text>

        <Text as="p" variant="xlarge" sx={{ mt: 1 }}>
          {totalCollateralRatioPct}
        </Text>
        <Flex sx={{ justifyContent: "space-between", mt: 6 }}>
          <Text as="p" variant="normalBold">
            MINTED KUSD
          </Text>
          <Text as="p" variant="normalBold">
            {total?.debt.prettify(0)}
          </Text>
        </Flex>
        <Box sx={{ my: 2 }}>
          <Progress
            max={kusdMintedCap.toString()}
            value={total?.debt.toString()}
            sx={{ height: "12px", backgroundColor: "#F0CFDC" }}
          ></Progress>
        </Box>
        <Flex sx={{ justifyContent: "space-between", mb: 3 }}>
          <Text as="p" variant="normalBold">
            MINT CAP
          </Text>
          <Text as="p" variant="normalBold">
            {kusdMintedCap.shorten().toString().toLowerCase()}
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mb: 1 }}>
          <Text as="p" variant="normalBold">
            KUSD in Stability Pool
          </Text>
          <Text as="p" variant="normalBold">
            {kusdInStabilityPool.prettify(0)}
          </Text>
        </Flex>
        <Flex sx={{ justifyContent: "space-between", mb: 4 }}>
          <Text as="p" variant="normalBold">
            Borrowing Rate
          </Text>
          <Text as="p" variant="normalBold">
            {`${borrowingRate.mul(100).prettify(2)}%`}
          </Text>
        </Flex>
      </Box>
    </Card>
  );
};
