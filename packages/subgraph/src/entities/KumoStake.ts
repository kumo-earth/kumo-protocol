import { ethereum, Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { KumoStakeChange, KumoStake } from "../../generated/schema";

import { decimalize, DECIMAL_ZERO, BIGINT_ZERO } from "../utils/bignumbers";

import {
  decreaseNumberOfActiveKUMOStakes,
  increaseNumberOfActiveKUMOStakes,
  increaseTotalNumberOfKUMOStakes
} from "./Global";

import { getUser } from "./User";
import { beginChange, initChange, finishChange } from "./Change";
import { updateSystemStateByKumoStakeChange } from "./SystemState";

function startKUMOStakeChange(event: ethereum.Event): KumoStakeChange {
  let sequenceNumber = beginChange();
  let stakeChange = new KumoStakeChange(sequenceNumber.toString());
  stakeChange.issuanceGain = DECIMAL_ZERO;
  stakeChange.redemptionGain = DECIMAL_ZERO;
  initChange(stakeChange, event, sequenceNumber);
  return stakeChange;
}

function finishKUMOStakeChange(stakeChange: KumoStakeChange): void {
  finishChange(stakeChange);
  stakeChange.save();
}

function getUserStake(address: Address): KumoStake | null {
  let user = getUser(address);

  if (user.stake == null) {
    return null;
  }

  return KumoStake.load(user.stake);
}

function createStake(address: Address): KumoStake {
  let user = getUser(address);
  let stake = new KumoStake(address.toHexString());

  stake.owner = user.id;
  stake.amount = DECIMAL_ZERO;

  user.stake = stake.id;
  user.save();

  return stake;
}

function getOperationType(stake: KumoStake | null, nextStakeAmount: BigDecimal): string {
  let isCreating = stake.amount == DECIMAL_ZERO && nextStakeAmount > DECIMAL_ZERO;
  if (isCreating) {
    return "stakeCreated";
  }

  let isIncreasing = nextStakeAmount > stake.amount;
  if (isIncreasing) {
    return "stakeIncreased";
  }

  let isRemoving = nextStakeAmount == DECIMAL_ZERO;
  if (isRemoving) {
    return "stakeRemoved";
  }

  return "stakeDecreased";
}

export function updateStake(event: ethereum.Event, address: Address, newStake: BigInt): void {
  let stake = getUserStake(address);
  let isUserFirstStake = stake == null;

  if (stake == null) {
    stake = createStake(address);
  }

  let nextStakeAmount = decimalize(newStake);

  let stakeChange = startKUMOStakeChange(event);
  stakeChange.stake = stake.id;
  stakeChange.stakeOperation = getOperationType(stake, nextStakeAmount);
  stakeChange.stakedAmountBefore = stake.amount;
  stakeChange.stakedAmountChange = nextStakeAmount.minus(stake.amount);
  stakeChange.stakedAmountAfter = nextStakeAmount;

  stake.amount = nextStakeAmount;

  if (stakeChange.stakeOperation == "stakeCreated") {
    if (isUserFirstStake) {
      increaseTotalNumberOfKUMOStakes();
    } else {
      increaseNumberOfActiveKUMOStakes();
    }
  } else if (stakeChange.stakeOperation == "stakeRemoved") {
    decreaseNumberOfActiveKUMOStakes();
  }

  updateSystemStateByKumoStakeChange(stakeChange);
  finishKUMOStakeChange(stakeChange);

  stake.save();
}

export function withdrawStakeGains(
  event: ethereum.Event,
  address: Address,
  KUSDGain: BigInt,
  ETHGain: BigInt
): void {
  if (KUSDGain == BIGINT_ZERO && ETHGain == BIGINT_ZERO) {
    return;
  }

  let stake = getUserStake(address) || createStake(address);
  let stakeChange: KumoStakeChange = startKUMOStakeChange(event);
  stakeChange.stake = stake.id;
  stakeChange.stakeOperation = "gainsWithdrawn";
  stakeChange.issuanceGain = decimalize(KUSDGain);
  stakeChange.redemptionGain = decimalize(ETHGain);
  stakeChange.stakedAmountBefore = stake.amount;
  stakeChange.stakedAmountChange = DECIMAL_ZERO;
  stakeChange.stakedAmountAfter = stake.amount;

  updateSystemStateByKumoStakeChange(stakeChange);
  finishKUMOStakeChange(stakeChange);

  stake.save();
}
