import { JsonFragment, LogDescription } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";

import {
  Contract,
  ContractInterface,
  ContractFunction,
  Overrides,
  CallOverrides,
  PopulatedTransaction,
  ContractTransaction
} from "@ethersproject/contracts";

import activePoolAbi from "../abi/ActivePool.json";
import borrowerOperationsAbi from "../abi/BorrowerOperations.json";
import troveManagerAbi from "../abi/TroveManager.json";
import kusdTokenAbi from "../abi/KUSDToken.json";
import collSurplusPoolAbi from "../abi/CollSurplusPool.json";
import defaultPoolAbi from "../abi/DefaultPool.json";
import hintHelpersAbi from "../abi/HintHelpers.json";
import kumoParametersAbi from "../abi/KumoParameters.json";
import multiTroveGetterAbi from "../abi/MultiTroveGetter.json";
import priceFeedAbi from "../abi/PriceFeed.json";
import priceFeedTestnetAbi from "../abi/PriceFeedTestnet.json";
import sortedTrovesAbi from "../abi/SortedTroves.json";
import stabilityPoolAbi from "../abi/StabilityPool.json";
import stabilityPoolFactoryAbi from "../abi/StabilityPoolFactory.json";
import gasPoolAbi from "../abi/GasPool.json";
import iERC20Abi from "../abi/IERC20.json";
import erc20TestAbi from "../abi/ERC20Test.json";
import kumoFaucetAbi from "../abi/KumoFaucet.json";

import {
  ActivePool,
  BorrowerOperations,
  TroveManager,
  KUSDToken,
  CollSurplusPool,
  DefaultPool,
  HintHelpers,
  MultiTroveGetter,
  PriceFeed,
  PriceFeedTestnet,
  SortedTroves,
  StabilityPool,
  StabilityPoolFactory,
  GasPool,
  IERC20,
  KumoParameters,
  ERC20Test, 
  KumoFaucet
} from "../types";

import { EthersProvider, EthersSigner } from "./types";

export interface _TypedLogDescription<T> extends Omit<LogDescription, "args"> {
  args: T;
}

type BucketOfFunctions = Record<string, (...args: unknown[]) => never>;

// Removes unsafe index signatures from an Ethers contract type
export type _TypeSafeContract<T> = Pick<
  T,
  {
    [P in keyof T]: BucketOfFunctions extends T[P] ? never : P;
  } extends {
    [_ in keyof T]: infer U;
  }
  ? U
  : never
>;

type EstimatedContractFunction<R = unknown, A extends unknown[] = unknown[], O = Overrides> = (
  overrides: O,
  adjustGas: (gas: BigNumber) => BigNumber,
  ...args: A
) => Promise<R>;

type CallOverridesArg = [overrides?: CallOverrides];

type TypedContract<T extends Contract, U, V> = _TypeSafeContract<T> &
  U &
  {
    [P in keyof V]: V[P] extends (...args: infer A) => unknown
    ? (...args: A) => Promise<ContractTransaction>
    : never;
  } & {
    readonly callStatic: {
      [P in keyof V]: V[P] extends (...args: [...infer A, never]) => infer R
      ? (...args: [...A, ...CallOverridesArg]) => R
      : never;
    };

    readonly estimateGas: {
      [P in keyof V]: V[P] extends (...args: infer A) => unknown
      ? (...args: A) => Promise<BigNumber>
      : never;
    };

    readonly populateTransaction: {
      [P in keyof V]: V[P] extends (...args: infer A) => unknown
      ? (...args: A) => Promise<PopulatedTransaction>
      : never;
    };

    readonly estimateAndPopulate: {
      [P in keyof V]: V[P] extends (...args: [...infer A, infer O | undefined]) => unknown
      ? EstimatedContractFunction<PopulatedTransaction, A, O>
      : never;
    };
  };

const buildEstimatedFunctions = <T>(
  estimateFunctions: Record<string, ContractFunction<BigNumber>>,
  functions: Record<string, ContractFunction<T>>
): Record<string, EstimatedContractFunction<T>> =>
  Object.fromEntries(
    Object.keys(estimateFunctions).map(functionName => [
      functionName,
      async (overrides, adjustEstimate, ...args) => {
        if (overrides.gasLimit === undefined) {
          const estimatedGas = await estimateFunctions[functionName](...args, overrides);

          overrides = {
            ...overrides,
            gasLimit: adjustEstimate(estimatedGas)
          };
        }

        return functions[functionName](...args, overrides);
      }
    ])
  );

export class _KumoContract extends Contract {
  readonly estimateAndPopulate: Record<string, EstimatedContractFunction<PopulatedTransaction>>;

  constructor(
    addressOrName: string,
    contractInterface: ContractInterface,
    signerOrProvider?: EthersSigner | EthersProvider
  ) {
    super(addressOrName, contractInterface, signerOrProvider);

    // this.estimateAndCall = buildEstimatedFunctions(this.estimateGas, this);
    this.estimateAndPopulate = buildEstimatedFunctions(this.estimateGas, this.populateTransaction);
  }

  extractEvents(logs: Log[], name: string): _TypedLogDescription<unknown>[] {
    return logs
      .filter(log => log.address === this.address)
      .map(log => this.interface.parseLog(log))
      .filter(e => e.name === name);
  }
}

interface ArbitraryProps {
  [key: string]: any;
}

/** @internal */
export type _TypedKumoContract<T = unknown, U = unknown> = TypedContract<_KumoContract, T, U> & { [key: string]: any };

/** @internal */
export interface _KumoContracts extends ArbitraryProps {
  activePool: ActivePool;
  borrowerOperations: BorrowerOperations;
  troveManager: TroveManager;
  kusdToken: KUSDToken;
  collSurplusPool: CollSurplusPool;
  defaultPool: DefaultPool;
  hintHelpers: HintHelpers;
  kumoParameters: KumoParameters;
  multiTroveGetter: MultiTroveGetter;
  priceFeed: PriceFeed | PriceFeedTestnet;
  sortedTroves: SortedTroves;
  stabilityPoolAsset1: StabilityPool;
  stabilityPoolAsset2: StabilityPool;
  stabilityPoolFactory: StabilityPoolFactory;
  gasPool: GasPool;
  mockAsset1: ERC20Test;
  mockAsset2: ERC20Test;
  kumoFaucet: KumoFaucet;
}

/** @internal */
export const _priceFeedIsTestnet = (
  priceFeed: PriceFeed | PriceFeedTestnet
): priceFeed is PriceFeedTestnet => "setPrice" in priceFeed;

type KumoContractsKey = keyof _KumoContracts;

/** @internal */
export type _KumoContractAddresses = Record<KumoContractsKey, string>;

type KumoContractAbis = Record<KumoContractsKey, JsonFragment[]>;

const getAbi = (priceFeedIsTestnet: boolean): KumoContractAbis => ({
  activePool: activePoolAbi,
  borrowerOperations: borrowerOperationsAbi,
  troveManager: troveManagerAbi,
  kusdToken: kusdTokenAbi,
  defaultPool: defaultPoolAbi,
  hintHelpers: hintHelpersAbi,
  kumoParameters: kumoParametersAbi,
  multiTroveGetter: multiTroveGetterAbi,
  priceFeed: priceFeedIsTestnet ? priceFeedTestnetAbi : priceFeedAbi,
  sortedTroves: sortedTrovesAbi,
  stabilityPoolAsset1: stabilityPoolAbi,
  stabilityPoolAsset2: stabilityPoolAbi,
  stabilityPoolFactory: stabilityPoolFactoryAbi,
  gasPool: gasPoolAbi,
  collSurplusPool: collSurplusPoolAbi,
  mockAsset1: erc20TestAbi,
  mockAsset2: erc20TestAbi,
  kumoFaucet: kumoFaucetAbi,
});

const mapKumoContracts = <T, U>(
  contracts: Record<KumoContractsKey, T>,
  f: (t: T, key: KumoContractsKey) => U
) =>
  Object.fromEntries(
    Object.entries(contracts).map(([key, t]) => [key, f(t, key as KumoContractsKey)])
  ) as Record<KumoContractsKey, U>;

/** @internal */
export interface _KumoDeploymentJSON {
  readonly chainId: number;
  readonly addresses: _KumoContractAddresses;
  readonly version: string;
  readonly deploymentDate: number;
  readonly startBlock: number;
  readonly bootstrapPeriod: number;
  readonly _priceFeedIsTestnet: boolean;
  readonly _isDev: boolean;
}

/** @internal */
export const _connectToContracts = (
  signerOrProvider: EthersSigner | EthersProvider,
  { addresses, _priceFeedIsTestnet }: _KumoDeploymentJSON
): _KumoContracts => {
  const abi = getAbi(_priceFeedIsTestnet);

  return mapKumoContracts(
    addresses,
    (address, key) =>
      new _KumoContract(address, abi[key], signerOrProvider) as _TypedKumoContract
  ) as _KumoContracts;
};
