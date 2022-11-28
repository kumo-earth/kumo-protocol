import React, { useEffect, useState } from "react";
import { Card, Paragraph, Text } from "theme-ui";
import { Decimal, KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { InfoIcon } from "../InfoIcon";
import { useKumo } from "../../hooks/KumoContext";
import { Badge } from "../Badge";
import { fetchKumoPrice } from "./context/fetchKumoPrice";
import { useParams } from "react-router-dom";

const selector = ({ vaults, remainingStabilityPoolKUMOReward }: KumoStoreState) => ({
  vaults,
  remainingStabilityPoolKUMOReward
});

export const Yield: React.FC = () => {
  const {
    kumo: {
      connection: { addresses }
    }
  } = useKumo();
  const { vaults, remainingStabilityPoolKUMOReward } = useKumoSelector(selector);
  const { collateralType } = useParams<{ collateralType: string }>();
  const vault = vaults.find(vault => vault.asset === collateralType);
  const kusdInStabilityPool = vault?.kusdInStabilityPool && vault?.kusdInStabilityPool;

  const [kumoPrice, setKumoPrice] = useState<Decimal | undefined>(undefined);
  const hasZeroValue = remainingStabilityPoolKUMOReward.isZero || kusdInStabilityPool.isZero;
  const kumoTokenAddress = addresses["kumoToken"];

  useEffect(() => {
    (async () => {
      try {
        const { kumoPriceUSD } = await fetchKumoPrice(kumoTokenAddress);
        setKumoPrice(kumoPriceUSD);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [kumoTokenAddress]);

  if (hasZeroValue || kumoPrice === undefined) return null;

  const yearlyHalvingSchedule = 0.5; // 50% see KUMO distribution schedule for more info
  const remainingKumoOneYear = remainingStabilityPoolKUMOReward.mul(yearlyHalvingSchedule);
  const remainingKumoOneYearInUSD = remainingKumoOneYear.mul(kumoPrice);
  const aprPercentage = remainingKumoOneYearInUSD.div(kusdInStabilityPool).mul(100);
  const remainingKumoInUSD = remainingStabilityPoolKUMOReward.mul(kumoPrice);

  if (aprPercentage.isZero) return null;

  return (
    <Badge>
      <Text>KUMO APR {aprPercentage.toString(2)}%</Text>
      <InfoIcon
        tooltip={
          <Card variant="tooltip" sx={{ width: ["220px", "518px"] }}>
            <Paragraph>
              An <Text sx={{ fontWeight: "bold" }}>estimate</Text> of the KUMO return on the KUSD
              deposited to the Stability Pool over the next year, not including your ETH gains from
              liquidations.
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace", mt: 2 }}>
              (($KUMO_REWARDS * YEARLY_DISTRIBUTION%) / DEPOSITED_KUSD) * 100 ={" "}
              <Text sx={{ fontWeight: "bold" }}> APR</Text>
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace" }}>
              ($
              {remainingKumoInUSD.shorten()} * 50% / ${kusdInStabilityPool.shorten()}) * 100 =
              <Text sx={{ fontWeight: "bold" }}> {aprPercentage.toString(2)}%</Text>
            </Paragraph>
          </Card>
        }
      ></InfoIcon>
    </Badge>
  );
};
