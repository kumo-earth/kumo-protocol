import {
    Decimal
} from "@kumodao/lib-base";

export const STARTING_BALANCE = Decimal.from(1000);

// Extra ETH sent to users to be spent on gas
export const GAS_BUDGET = Decimal.from(0.1); // ETH