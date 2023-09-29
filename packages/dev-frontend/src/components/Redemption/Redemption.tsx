import React from "react";
import { BlockPolledKumoStoreState } from "@kumodao/lib-ethers";
import { useKumoSelector } from "@kumodao/lib-react";

import { useKumo } from "../../hooks/KumoContext";
import { DisabledRedemption } from "./DisabledRedemption";
import { RedemptionManager } from "./RedemptionManager";

const SECONDS_IN_ONE_DAY = 24 * 60 * 60;

const selectBlockTimestamp = ({ blockTimestamp }: BlockPolledKumoStoreState) => blockTimestamp;

export const Redemption: React.FC = () => {
  const {
    kumo: {
      connection: { deploymentDate, bootstrapPeriod }
    }
  } = useKumo();

  const blockTimestamp = useKumoSelector(selectBlockTimestamp);

  const bootstrapPeriodDays = Math.round(bootstrapPeriod / SECONDS_IN_ONE_DAY);
  const deploymentTime = deploymentDate.getTime() / 1000;
  const bootstrapEndTime = deploymentTime + bootstrapPeriod;
  const bootstrapEndDate = new Date(bootstrapEndTime * 1000);
  const redemptionDisabled = blockTimestamp < bootstrapEndTime;

  if (redemptionDisabled) {
    return <DisabledRedemption disabledDays={bootstrapPeriodDays} unlockDate={bootstrapEndDate} />;
  }

  return <RedemptionManager />;
};
