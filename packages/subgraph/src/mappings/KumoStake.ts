import { StakeChanged, StakingGainsWithdrawn } from "../../generated/KUMOStaking/KUMOStaking";

import { updateStake, withdrawStakeGains } from "../entities/KumoStake";

export function handleStakeChanged(event: StakeChanged): void {
  updateStake(event, event.params.staker, event.params.newStake);
}

export function handleStakeGainsWithdrawn(event: StakingGainsWithdrawn): void {
  withdrawStakeGains(event, event.params.staker, event.params.KUSDGain, event.params.ETHGain);
}
