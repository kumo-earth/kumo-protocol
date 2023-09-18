import { Block, BlockTag } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";

import { Decimal } from "@kumodao/lib-base";

import devOrNull from "../deployments/dev.json";
import mainnet from "../deployments/mainnet.json";
import mumbai from "../deployments/mumbai.json";

import { numberify, panic } from "./_utils";
import { EthersProvider, EthersSigner } from "./types";

import {
  _connectToContracts,
  _KumoContractAddresses,
  _KumoContracts,
  _KumoDeploymentJSON
} from "./contracts";

import { _connectToMulticall, _Multicall } from "./_Multicall";

const dev = devOrNull as _KumoDeploymentJSON | null;


const deployments: {
  [chainId: number]: _KumoDeploymentJSON | undefined;
} = {
  [mainnet.chainId]: mainnet,
  [mumbai.chainId]: mumbai,

  ...(dev !== null ? { [dev.chainId]: dev } : {})
};

declare const brand: unique symbol;

const branded = <T>(t: Omit<T, typeof brand>): T => t as T;

/**
 * Information about a connection to the Kumo protocol.
 *
 * @remarks
 * Provided for debugging / informational purposes.
 *
 * Exposed through {@link ReadableEthersKumo.connection} and {@link EthersKumo.connection}.
 *
 * @public
 */
export interface EthersKumoConnection extends EthersKumoConnectionOptionalParams {
  /** Ethers `Provider` used for connecting to the network. */
  readonly provider: EthersProvider;

  /** Ethers `Signer` used for sending transactions. */
  readonly signer?: EthersSigner;

  /** Chain ID of the connected network. */
  readonly chainId: number;

  /** Version of the Kumo contracts (Git commit hash). */
  readonly version: string;

  /** Date when the Kumo contracts were deployed. */
  readonly deploymentDate: Date;

  /** Number of block in which the first Kumo contract was deployed. */
  readonly startBlock: number;

  /** Time period (in seconds) after `deploymentDate` during which redemptions are disabled. */
  readonly bootstrapPeriod: number;

  /** Total amount of KUMO allocated for rewarding stability depositors. */
  readonly totalStabilityPoolKUMOReward: Decimal;

  /** Amount of KUMO collectively rewarded to stakers of the liquidity mining pool per second. */
  readonly liquidityMiningKUMORewardRate: Decimal;

  /** A mapping of Kumo contracts' names to their addresses. */
  readonly addresses: Record<string, string>;

  /** @internal */
  readonly _priceFeedIsTestnet: boolean;

  /** @internal */
  readonly _isDev: boolean;

  /** @internal */
  readonly [brand]: unique symbol;
}

/** @internal */
export interface _InternalEthersKumoConnection extends EthersKumoConnection {
  readonly addresses: _KumoContractAddresses;
  readonly _contracts: _KumoContracts;
  readonly _multicall?: _Multicall;
}

const connectionFrom = (
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  _contracts: _KumoContracts,
  _multicall: _Multicall | undefined,
  {
    deploymentDate,
    totalStabilityPoolKUMOReward,
    liquidityMiningKUMORewardRate,
    ...deployment
  }: _KumoDeploymentJSON,
  optionalParams?: EthersKumoConnectionOptionalParams
): _InternalEthersKumoConnection => {
  if (
    optionalParams &&
    optionalParams.useStore !== undefined &&
    !validStoreOptions.includes(optionalParams.useStore)
  ) {
    throw new Error(`Invalid useStore value ${optionalParams.useStore}`);
  }

  return branded({
    provider,
    signer,
    _contracts,
    _multicall,
    deploymentDate: new Date(deploymentDate),
    totalStabilityPoolKUMOReward: Decimal.from(totalStabilityPoolKUMOReward),
    liquidityMiningKUMORewardRate: Decimal.from(liquidityMiningKUMORewardRate),
    ...deployment,
    ...optionalParams
  });
};

/** @internal */
export const _getContracts = (connection: EthersKumoConnection): _KumoContracts =>
  (connection as _InternalEthersKumoConnection)._contracts;

export const _getStabilityPoolByAsset = (assetName: string, connection: EthersKumoConnection) => {
  const { stabilityPoolAsset1, stabilityPoolAsset2 } = _getContracts(connection);
  if (assetName === 'nbc') {
    return stabilityPoolAsset1
  } else if (assetName === 'csc') {
    return stabilityPoolAsset2
  } else {
    throw new Error("Can't get the required Stability Pool");
  }

}


const getMulticall = (connection: EthersKumoConnection): _Multicall | undefined =>
  (connection as _InternalEthersKumoConnection)._multicall;

const getTimestampFromBlock = ({ timestamp }: Block) => timestamp;

/** @internal */
export const _getBlockTimestamp = (
  connection: EthersKumoConnection,
  blockTag: BlockTag = "latest"
): Promise<number> =>
  // Get the timestamp via a contract call whenever possible, to make it batchable with other calls
  getMulticall(connection)?.getCurrentBlockTimestamp({ blockTag }).then(numberify) ??
  _getProvider(connection).getBlock(blockTag).then(getTimestampFromBlock);

/** @internal */
export const _requireSigner = (connection: EthersKumoConnection): EthersSigner =>
  connection.signer ?? panic(new Error("Must be connected through a Signer"));

/** @internal */
export const _getProvider = (connection: EthersKumoConnection): EthersProvider =>
  connection.provider;

// TODO parameterize error message?
/** @internal */
export const _requireAddress = (
  connection: EthersKumoConnection,
  overrides?: { from?: string }
): string =>
  overrides?.from ?? connection.userAddress ?? panic(new Error("A user address is required"));

/** @internal */
export const _usingStore = (
  connection: EthersKumoConnection
): connection is EthersKumoConnection & { useStore: EthersKumoStoreOption } =>
  connection.useStore !== undefined;

/**
 * Thrown when trying to connect to a network where Kumo is not deployed.
 *
 * @remarks
 * Thrown by {@link ReadableEthersKumo.(connect:2)} and {@link EthersKumo.(connect:2)}.
 *
 * @public
 */
export class UnsupportedNetworkError extends Error {
  /** Chain ID of the unsupported network. */
  readonly chainId: number;

  /** @internal */
  constructor(chainId: number) {
    super(`Unsupported network (chainId = ${chainId})`);
    this.name = "UnsupportedNetworkError";
    this.chainId = chainId;
  }
}

const getProviderAndSigner = (
  signerOrProvider: EthersSigner | EthersProvider
): [provider: EthersProvider, signer: EthersSigner | undefined] => {
  const provider: EthersProvider = Signer.isSigner(signerOrProvider)
    ? signerOrProvider.provider ?? panic(new Error("Signer must have a Provider"))
    : signerOrProvider;

  const signer = Signer.isSigner(signerOrProvider) ? signerOrProvider : undefined;

  return [provider, signer];
};

/** @internal */
export const _connectToDeployment = (
  deployment: _KumoDeploymentJSON,
  signerOrProvider: EthersSigner | EthersProvider,
  optionalParams?: EthersKumoConnectionOptionalParams
): EthersKumoConnection =>
  connectionFrom(
    ...getProviderAndSigner(signerOrProvider),
    _connectToContracts(signerOrProvider, deployment),
    undefined,
    deployment,
    optionalParams
  );

/**
 * Possible values for the optional
 * {@link EthersKumoConnectionOptionalParams.useStore | useStore}
 * connection parameter.
 *
 * @remarks
 * Currently, the only supported value is `"blockPolled"`, in which case a
 * {@link BlockPolledKumoStore} will be created.
 *
 * @public
 */
export type EthersKumoStoreOption = "blockPolled";

const validStoreOptions = ["blockPolled"];

/**
 * Optional parameters of {@link ReadableEthersKumo.(connect:2)} and
 * {@link EthersKumo.(connect:2)}.
 *
 * @public
 */
export interface EthersKumoConnectionOptionalParams {
  /**
   * Address whose Trove, Stability Deposit, KUMO Stake and balances will be read by default.
   *
   * @remarks
   * For example {@link EthersKumo.getTrove | getTrove(address?)} will return the Trove owned by
   * `userAddress` when the `address` parameter is omitted.
   *
   * Should be omitted when connecting through a {@link EthersSigner | Signer}. Instead `userAddress`
   * will be automatically determined from the `Signer`.
   */
  readonly userAddress?: string;

  /**
   * Create a {@link @kumodao/lib-base#KumoStore} and expose it as the `store` property.
   *
   * @remarks
   * When set to one of the available {@link EthersKumoStoreOption | options},
   * {@link ReadableEthersKumo.(connect:2) | ReadableEthersKumo.connect()} will return a
   * {@link ReadableEthersKumoWithStore}, while
   * {@link EthersKumo.(connect:2) | EthersKumo.connect()} will return an
   * {@link EthersKumoWithStore}.
   *
   * Note that the store won't start monitoring the blockchain until its
   * {@link @kumodao/lib-base#KumoStore.start | start()} function is called.
   */
  readonly useStore?: EthersKumoStoreOption;
}

/** @internal */
export function _connectByChainId<T>(
  provider: EthersProvider,
  chainId: number,
  optionalParams: EthersKumoConnectionOptionalParams & { useStore: T },
  signer?: EthersSigner | undefined
): EthersKumoConnection & { useStore: T };

/** @internal */
export function _connectByChainId(
  provider: EthersProvider,
  chainId: number,
  optionalParams?: EthersKumoConnectionOptionalParams,
  signer?: EthersSigner | undefined
): EthersKumoConnection;

/** @internal */
export function _connectByChainId(
  provider: EthersProvider,
  chainId: number,
  optionalParams?: EthersKumoConnectionOptionalParams,
  signer?: EthersSigner | undefined
): EthersKumoConnection {
  const deployment: _KumoDeploymentJSON =
    deployments[chainId] ?? panic(new UnsupportedNetworkError(chainId));

  return connectionFrom(
    provider,
    signer,
    _connectToContracts(signer ?? provider, deployment),
    _connectToMulticall(signer ?? provider, chainId),
    deployment,
    optionalParams
  );
}

/** @internal */
export const _connect = async (
  signerOrProvider: EthersSigner | EthersProvider,
  optionalParams?: EthersKumoConnectionOptionalParams
): Promise<EthersKumoConnection> => {
  const [provider, signer] = getProviderAndSigner(signerOrProvider);

  if (signer) {
    if (optionalParams?.userAddress !== undefined) {
      throw new Error("Can't override userAddress when connecting through Signer");
    }

    optionalParams = {
      ...optionalParams,
      userAddress: await signer.getAddress()
    };
  }

  return _connectByChainId(provider, (await provider.getNetwork()).chainId, optionalParams, signer);
};
