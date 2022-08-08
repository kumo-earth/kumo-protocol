
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";
import { BytesLike } from "@ethersproject/bytes";
import {
  Overrides,
  CallOverrides,
  PayableOverrides,
  EventFilter
} from "@ethersproject/contracts";

import { _TypedKumoContract, _TypedLogDescription } from "../src/contracts";

interface ActivePoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  collStakingManager(_overrides?: CallOverrides): Promise<string>;
  collSurplusPool(_overrides?: CallOverrides): Promise<string>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  defaultPoolAddress(_overrides?: CallOverrides): Promise<string>;
  getAssetBalance(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getAssetStaked(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getKUSDDebt(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  stabilityPoolAddress(_overrides?: CallOverrides): Promise<string>;
  stabilityPoolManager(_overrides?: CallOverrides): Promise<string>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface ActivePoolTransactions {
  decreaseKUSDDebt(_asset: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  forceStake(_asset: string, _overrides?: Overrides): Promise<void>;
  forceUnstake(_asset: string, _overrides?: Overrides): Promise<void>;
  increaseKUSDDebt(_asset: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  receivedERC20(_asset: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  sendAsset(_asset: string, _account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(_borrowerOperationsAddress: string, _troveManagerAddress: string, _stabilityPoolAddress: string, _defaultPoolAddress: string, _overrides?: Overrides): Promise<void>;
  setCollStakingManagerAddress(_collStakingManagerAddress: string, _overrides?: Overrides): Promise<void>;
}

export interface ActivePool
  extends _TypedKumoContract<ActivePoolCalls, ActivePoolTransactions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    ActivePoolAssetBalanceUpdated(_asset?: null, _ETH?: null): EventFilter;
    ActivePoolKUSDDebtUpdated(_asset?: null, _KUSDDebt?: null): EventFilter;
    AssetSent(_to?: null, _asset?: string | null, _amount?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    ETHBalanceUpdated(_newBalance?: null): EventFilter;
    KUSDBalanceUpdated(_newBalance?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "ActivePoolAssetBalanceUpdated"): _TypedLogDescription<{ _asset: string; _ETH: BigNumber }>[];
  extractEvents(logs: Log[], name: "ActivePoolKUSDDebtUpdated"): _TypedLogDescription<{ _asset: string; _KUSDDebt: BigNumber }>[];
  extractEvents(logs: Log[], name: "AssetSent"): _TypedLogDescription<{ _to: string; _asset: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): _TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "ETHBalanceUpdated"): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "KUSDBalanceUpdated"): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): _TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _newTroveManagerAddress: string }>[];
}

interface BorrowerOperationsCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  ETH_REF_ADDRESS(_overrides?: CallOverrides): Promise<string>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  getCompositeDebt(_asset: string, _debt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemColl(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  kumoParams(_overrides?: CallOverrides): Promise<string>;
  kumoStaking(_overrides?: CallOverrides): Promise<string>;
  kumoStakingAddress(_overrides?: CallOverrides): Promise<string>;
  kusdToken(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
}

interface BorrowerOperationsTransactions {
  addColl(_asset: string, _assetSent: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: PayableOverrides): Promise<void>;
  adjustTrove(_asset: string, _assetSent: BigNumberish, _maxFeePercentage: BigNumberish, _collWithdrawal: BigNumberish, _KUSDChange: BigNumberish, _isDebtIncrease: boolean, _upperHint: string, _lowerHint: string, _overrides?: PayableOverrides): Promise<void>;
  claimCollateral(_asset: string, _overrides?: Overrides): Promise<void>;
  closeTrove(_asset: string, _overrides?: Overrides): Promise<void>;
  moveETHGainToTrove(_asset: string, _amountMoved: BigNumberish, _borrower: string, _upperHint: string, _lowerHint: string, _overrides?: PayableOverrides): Promise<void>;
  openTrove(_asset: string, _tokenAmount: BigNumberish, _maxFeePercentage: BigNumberish, _KUSDAmount: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: PayableOverrides): Promise<void>;
  repayKUSD(_asset: string, _KUSDAmount: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<void>;
  setAddresses(_troveManagerAddress: string, _stabilityPoolManagerAddress: string, _gasPoolAddress: string, _collSurplusPoolAddress: string, _sortedTrovesAddress: string, _kusdTokenAddress: string, _kumoStakingAddress: string, _kumoParamsAddress: string, _overrides?: Overrides): Promise<void>;
  setKumoParameters(_kumoParamsAddress: string, _overrides?: Overrides): Promise<void>;
  withdrawColl(_asset: string, _collWithdrawal: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<void>;
  withdrawKUSD(_asset: string, _maxFeePercentage: BigNumberish, _KUSDAmount: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<void>;
}

export interface BorrowerOperations
  extends _TypedKumoContract<BorrowerOperationsCalls, BorrowerOperationsTransactions> {
  readonly filters: {
    ActivePoolAddressChanged(_activePoolAddress?: null): EventFilter;
    CollSurplusPoolAddressChanged(_collSurplusPoolAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_defaultPoolAddress?: null): EventFilter;
    GasPoolAddressChanged(_gasPoolAddress?: null): EventFilter;
    KUMOStakingAddressChanged(_kumoStakingAddress?: null): EventFilter;
    KUSDBorrowingFeePaid(_asset?: string | null, _borrower?: string | null, _KUSDFee?: null): EventFilter;
    KUSDTokenAddressChanged(_kusdTokenAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    SortedTrovesAddressChanged(_sortedTrovesAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_stabilityPoolAddress?: null): EventFilter;
    TroveCreated(_asset?: string | null, _borrower?: string | null, arrayIndex?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
    TroveUpdated(_asset?: string | null, _borrower?: string | null, _debt?: null, _coll?: null, stake?: null, operation?: null): EventFilter;
    VaultParametersBaseChanged(newAddress?: string | null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "CollSurplusPoolAddressChanged"): _TypedLogDescription<{ _collSurplusPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): _TypedLogDescription<{ _defaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "GasPoolAddressChanged"): _TypedLogDescription<{ _gasPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "KUMOStakingAddressChanged"): _TypedLogDescription<{ _kumoStakingAddress: string }>[];
  extractEvents(logs: Log[], name: "KUSDBorrowingFeePaid"): _TypedLogDescription<{ _asset: string; _borrower: string; _KUSDFee: BigNumber }>[];
  extractEvents(logs: Log[], name: "KUSDTokenAddressChanged"): _TypedLogDescription<{ _kusdTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "PriceFeedAddressChanged"): _TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): _TypedLogDescription<{ _sortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): _TypedLogDescription<{ _stabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveCreated"): _TypedLogDescription<{ _asset: string; _borrower: string; arrayIndex: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _newTroveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveUpdated"): _TypedLogDescription<{ _asset: string; _borrower: string; _debt: BigNumber; _coll: BigNumber; stake: BigNumber; operation: number }>[];
  extractEvents(logs: Log[], name: "VaultParametersBaseChanged"): _TypedLogDescription<{ newAddress: string }>[];
}

interface CollSurplusPoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  getAssetBalance(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getCollateral(_asset: string, _account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getETH(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface CollSurplusPoolTransactions {
  accountSurplus(_asset: string, _account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  claimColl(_asset: string, _account: string, _overrides?: Overrides): Promise<void>;
  receivedERC20(_asset: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(_borrowerOperationsAddress: string, _troveManagerAddress: string, _activePoolAddress: string, _overrides?: Overrides): Promise<void>;
}

export interface CollSurplusPool
  extends _TypedKumoContract<CollSurplusPoolCalls, CollSurplusPoolTransactions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    AssetSent(_to?: null, _amount?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    CollBalanceUpdated(_account?: string | null, _newBalance?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "AssetSent"): _TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "CollBalanceUpdated"): _TypedLogDescription<{ _account: string; _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _newTroveManagerAddress: string }>[];
}

interface CommunityIssuanceCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  ISSUANCE_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  KUMOSupplyCap(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  SECONDS_IN_ONE_MINUTE(_overrides?: CallOverrides): Promise<BigNumber>;
  deploymentTime(_overrides?: CallOverrides): Promise<BigNumber>;
  isInitialized(_overrides?: CallOverrides): Promise<boolean>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  kumoToken(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  stabilityPoolAddress(_overrides?: CallOverrides): Promise<string>;
  totalKUMOIssued(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface CommunityIssuanceTransactions {
  issueKUMO(_overrides?: Overrides): Promise<BigNumber>;
  sendKUMO(_account: string, _KUMOamount: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(_kumoTokenAddress: string, _stabilityPoolAddress: string, _overrides?: Overrides): Promise<void>;
}

export interface CommunityIssuance
  extends _TypedKumoContract<CommunityIssuanceCalls, CommunityIssuanceTransactions> {
  readonly filters: {
    KUMOTokenAddressSet(_kumoTokenAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    StabilityPoolAddressSet(_stabilityPoolAddress?: null): EventFilter;
    TotalKUMOIssuedUpdated(_totalKUMOIssued?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "KUMOTokenAddressSet"): _TypedLogDescription<{ _kumoTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressSet"): _TypedLogDescription<{ _stabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TotalKUMOIssuedUpdated"): _TypedLogDescription<{ _totalKUMOIssued: BigNumber }>[];
}

interface DefaultPoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  getAssetBalance(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getKUSDDebt(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface DefaultPoolTransactions {
  decreaseKUSDDebt(_asset: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  increaseKUSDDebt(_asset: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  receivedERC20(_asset: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  sendAssetToActivePool(_asset: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(_troveManagerAddress: string, _activePoolAddress: string, _overrides?: Overrides): Promise<void>;
}

export interface DefaultPool
  extends _TypedKumoContract<DefaultPoolCalls, DefaultPoolTransactions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    AssetSent(_to?: null, _asset?: string | null, _amount?: null): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    DefaultPoolAssetBalanceUpdated(_asset?: null, _balance?: null): EventFilter;
    DefaultPoolKUSDDebtUpdated(_asset?: null, _KUSDDebt?: null): EventFilter;
    ETHBalanceUpdated(_newBalance?: null): EventFilter;
    KUSDBalanceUpdated(_newBalance?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "AssetSent"): _TypedLogDescription<{ _to: string; _asset: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): _TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAssetBalanceUpdated"): _TypedLogDescription<{ _asset: string; _balance: BigNumber }>[];
  extractEvents(logs: Log[], name: "DefaultPoolKUSDDebtUpdated"): _TypedLogDescription<{ _asset: string; _KUSDDebt: BigNumber }>[];
  extractEvents(logs: Log[], name: "ETHBalanceUpdated"): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "KUSDBalanceUpdated"): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): _TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _newTroveManagerAddress: string }>[];
}

interface ERC20MockCalls {
  allowance(owner: string, spender: string, _overrides?: CallOverrides): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  name(_overrides?: CallOverrides): Promise<string>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface ERC20MockTransactions {
  approve(spender: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  approveInternal(owner: string, spender: string, value: BigNumberish, _overrides?: Overrides): Promise<void>;
  burn(account: string, amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  decreaseAllowance(spender: string, subtractedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  increaseAllowance(spender: string, addedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  mint(account: string, amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  transfer(to: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  transferFrom(from: string, to: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  transferInternal(from: string, to: string, value: BigNumberish, _overrides?: Overrides): Promise<void>;
}

export interface ERC20Mock
  extends _TypedKumoContract<ERC20MockCalls, ERC20MockTransactions> {
  readonly filters: {
    Approval(owner?: string | null, spender?: string | null, value?: null): EventFilter;
    Transfer(from?: string | null, to?: string | null, value?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "Approval"): _TypedLogDescription<{ owner: string; spender: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "Transfer"): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
}

interface GasPoolCalls {
}

interface GasPoolTransactions {
}

export interface GasPool
  extends _TypedKumoContract<GasPoolCalls, GasPoolTransactions> {
  readonly filters: {
  };
}

interface HintHelpersCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  ETH_REF_ADDRESS(_overrides?: CallOverrides): Promise<string>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  computeCR(_coll: BigNumberish, _debt: BigNumberish, _price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  computeNominalCR(_coll: BigNumberish, _debt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getApproxHint(_asset: string, _CR: BigNumberish, _numTrials: BigNumberish, _inputRandomSeed: BigNumberish, _overrides?: CallOverrides): Promise<{ hintAddress: string; diff: BigNumber; latestRandomSeed: BigNumber }>;
  getEntireSystemColl(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getRedemptionHints(_asset: string, _KUSDamount: BigNumberish, _price: BigNumberish, _maxIterations: BigNumberish, _overrides?: CallOverrides): Promise<{ firstRedemptionHint: string; partialRedemptionHintNICR: BigNumber; truncatedKUSDamount: BigNumber }>;
  isInitialized(_overrides?: CallOverrides): Promise<boolean>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  kumoParams(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
}

interface HintHelpersTransactions {
  setAddresses(_sortedTrovesAddress: string, _troveManagerAddress: string, _kumoParamsAddress: string, _overrides?: Overrides): Promise<void>;
  setKumoParameters(_kumoParamsAddress: string, _overrides?: Overrides): Promise<void>;
}

export interface HintHelpers
  extends _TypedKumoContract<HintHelpersCalls, HintHelpersTransactions> {
  readonly filters: {
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SortedTrovesAddressChanged(_sortedTrovesAddress?: null): EventFilter;
    TroveManagerAddressChanged(_troveManagerAddress?: null): EventFilter;
    VaultParametersBaseChanged(newAddress?: string | null): EventFilter;
  };
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): _TypedLogDescription<{ _sortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _troveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "VaultParametersBaseChanged"): _TypedLogDescription<{ newAddress: string }>[];
}

interface IERC20Calls {
  allowance(owner: string, spender: string, _overrides?: CallOverrides): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface IERC20Transactions {
  approve(spender: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  transfer(to: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  transferFrom(from: string, to: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
}

export interface IERC20
  extends _TypedKumoContract<IERC20Calls, IERC20Transactions> {
  readonly filters: {
    Approval(owner?: string | null, spender?: string | null, value?: null): EventFilter;
    Transfer(from?: string | null, to?: string | null, value?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "Approval"): _TypedLogDescription<{ owner: string; spender: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "Transfer"): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
}

interface LockupContractFactoryCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  SECONDS_IN_ONE_YEAR(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  isRegisteredLockup(_contractAddress: string, _overrides?: CallOverrides): Promise<boolean>;
  kumoTokenAddress(_overrides?: CallOverrides): Promise<string>;
  lockupContractToDeployer(arg0: string, _overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
}

interface LockupContractFactoryTransactions {
  deployLockupContract(_beneficiary: string, _unlockTime: BigNumberish, _overrides?: Overrides): Promise<void>;
  setKUMOTokenAddress(_kumoTokenAddress: string, _overrides?: Overrides): Promise<void>;
}

export interface LockupContractFactory
  extends _TypedKumoContract<LockupContractFactoryCalls, LockupContractFactoryTransactions> {
  readonly filters: {
    KUMOTokenAddressSet(_kumoTokenAddress?: null): EventFilter;
    LockupContractDeployedThroughFactory(_lockupContractAddress?: null, _beneficiary?: null, _unlockTime?: null, _deployer?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
  };
  extractEvents(logs: Log[], name: "KUMOTokenAddressSet"): _TypedLogDescription<{ _kumoTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "LockupContractDeployedThroughFactory"): _TypedLogDescription<{ _lockupContractAddress: string; _beneficiary: string; _unlockTime: BigNumber; _deployer: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
}

interface KUSDTokenCalls {
  allowance(owner: string, spender: string, _overrides?: CallOverrides): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  domainSeparator(_overrides?: CallOverrides): Promise<string>;
  emergencyStopMintingCollateral(arg0: string, _overrides?: CallOverrides): Promise<boolean>;
  name(_overrides?: CallOverrides): Promise<string>;
  nonces(owner: string, _overrides?: CallOverrides): Promise<BigNumber>;
  permitTypeHash(_overrides?: CallOverrides): Promise<string>;
  stabilityPoolAddress(_overrides?: CallOverrides): Promise<string>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
  version(_overrides?: CallOverrides): Promise<string>;
}

interface KUSDTokenTransactions {
  approve(spender: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  burn(_account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  decreaseAllowance(spender: string, subtractedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  emergencyStopMinting(_asset: string, status: boolean, _overrides?: Overrides): Promise<void>;
  increaseAllowance(spender: string, addedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  mint(_asset: string, _account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  permit(owner: string, spender: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, _overrides?: Overrides): Promise<void>;
  returnFromPool(_poolAddress: string, _receiver: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  sendToPool(_sender: string, _poolAddress: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  transfer(recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  transferFrom(sender: string, recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
}

export interface KUSDToken
  extends _TypedKumoContract<KUSDTokenCalls, KUSDTokenTransactions> {
  readonly filters: {
    Approval(owner?: string | null, spender?: string | null, value?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    EmergencyStopMintingCollateral(_asset?: null, state?: null): EventFilter;
    KUSDTokenBalanceUpdated(_user?: null, _amount?: null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    Transfer(from?: string | null, to?: string | null, value?: null): EventFilter;
    TroveManagerAddressChanged(_troveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "Approval"): _TypedLogDescription<{ owner: string; spender: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "EmergencyStopMintingCollateral"): _TypedLogDescription<{ _asset: string; state: boolean }>[];
  extractEvents(logs: Log[], name: "KUSDTokenBalanceUpdated"): _TypedLogDescription<{ _user: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): _TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "Transfer"): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _troveManagerAddress: string }>[];
}

interface KUMOStakingCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  F_ASSETS(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  F_KUSD(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  getPendingAssetGain(_asset: string, _user: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getPendingKUSDGain(_user: string, _overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  kumoToken(_overrides?: CallOverrides): Promise<string>;
  kusdToken(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  sentToTreasuryTracker(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  snapshots(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  stakes(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalKUMOStaked(_overrides?: CallOverrides): Promise<BigNumber>;
  treasury(_overrides?: CallOverrides): Promise<string>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

interface KUMOStakingTransactions {
  increaseF_Asset(_asset: string, _AssetFee: BigNumberish, _overrides?: Overrides): Promise<void>;
  increaseF_KUSD(_KUSDFee: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(_kumoTokenAddress: string, _kusdTokenAddress: string, _troveManagerAddress: string, _borrowerOperationsAddress: string, _activePoolAddress: string, _overrides?: Overrides): Promise<void>;
  stake(_KUMOamount: BigNumberish, _overrides?: Overrides): Promise<void>;
  unstake(_KUMOamount: BigNumberish, _overrides?: Overrides): Promise<void>;
}

export interface KUMOStaking
  extends _TypedKumoContract<KUMOStakingCalls, KUMOStakingTransactions> {
  readonly filters: {
    ActivePoolAddressSet(_activePoolAddress?: null): EventFilter;
    AssetSent(_asset?: string | null, _account?: null, _amount?: null): EventFilter;
    BorrowerOperationsAddressSet(_borrowerOperationsAddress?: null): EventFilter;
    F_AssetUpdated(_asset?: string | null, _F_ASSET?: null): EventFilter;
    F_KUSDUpdated(_F_KUSD?: null): EventFilter;
    KUMOTokenAddressSet(_kumoTokenAddress?: null): EventFilter;
    KUSDTokenAddressSet(_kusdTokenAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    StakeChanged(staker?: string | null, newStake?: null): EventFilter;
    StakerSnapshotsUpdated(_staker?: null, _F_Asset?: null, _F_KUSD?: null): EventFilter;
    StakingGainsAssetWithdrawn(staker?: string | null, asset?: string | null, AssetGain?: null): EventFilter;
    StakingGainsKUSDWithdrawn(staker?: string | null, VSTGain?: null): EventFilter;
    StakingGainsWithdrawn(staker?: string | null, KUSDGain?: null, ETHGain?: null): EventFilter;
    TotalKUMOStakedUpdated(_totalKUMOStaked?: null): EventFilter;
    TroveManagerAddressSet(_troveManager?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressSet"): _TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "AssetSent"): _TypedLogDescription<{ _asset: string; _account: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressSet"): _TypedLogDescription<{ _borrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "F_AssetUpdated"): _TypedLogDescription<{ _asset: string; _F_ASSET: BigNumber }>[];
  extractEvents(logs: Log[], name: "F_KUSDUpdated"): _TypedLogDescription<{ _F_KUSD: BigNumber }>[];
  extractEvents(logs: Log[], name: "KUMOTokenAddressSet"): _TypedLogDescription<{ _kumoTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "KUSDTokenAddressSet"): _TypedLogDescription<{ _kusdTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "StakeChanged"): _TypedLogDescription<{ staker: string; newStake: BigNumber }>[];
  extractEvents(logs: Log[], name: "StakerSnapshotsUpdated"): _TypedLogDescription<{ _staker: string; _F_Asset: BigNumber; _F_KUSD: BigNumber }>[];
  extractEvents(logs: Log[], name: "StakingGainsAssetWithdrawn"): _TypedLogDescription<{ staker: string; asset: string; AssetGain: BigNumber }>[];
  extractEvents(logs: Log[], name: "StakingGainsKUSDWithdrawn"): _TypedLogDescription<{ staker: string; VSTGain: BigNumber }>[];
  extractEvents(logs: Log[], name: "StakingGainsWithdrawn"): _TypedLogDescription<{ staker: string; KUSDGain: BigNumber; ETHGain: BigNumber }>[];
  extractEvents(logs: Log[], name: "TotalKUMOStakedUpdated"): _TypedLogDescription<{ _totalKUMOStaked: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressSet"): _TypedLogDescription<{ _troveManager: string }>[];
}

interface KUMOTokenCalls {
  ONE_YEAR_IN_SECONDS(_overrides?: CallOverrides): Promise<BigNumber>;
  allowance(owner: string, spender: string, _overrides?: CallOverrides): Promise<BigNumber>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  communityIssuanceAddress(_overrides?: CallOverrides): Promise<string>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  domainSeparator(_overrides?: CallOverrides): Promise<string>;
  getDeploymentStartTime(_overrides?: CallOverrides): Promise<BigNumber>;
  getLpRewardsEntitlement(_overrides?: CallOverrides): Promise<BigNumber>;
  kumoStakingAddress(_overrides?: CallOverrides): Promise<string>;
  lockupContractFactory(_overrides?: CallOverrides): Promise<string>;
  multisigAddress(_overrides?: CallOverrides): Promise<string>;
  name(_overrides?: CallOverrides): Promise<string>;
  nonces(owner: string, _overrides?: CallOverrides): Promise<BigNumber>;
  permitTypeHash(_overrides?: CallOverrides): Promise<string>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
  version(_overrides?: CallOverrides): Promise<string>;
}

interface KUMOTokenTransactions {
  approve(spender: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  decreaseAllowance(spender: string, subtractedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  increaseAllowance(spender: string, addedValue: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  permit(owner: string, spender: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, _overrides?: Overrides): Promise<void>;
  sendToKUMOStaking(_sender: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  transfer(recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
  transferFrom(sender: string, recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<boolean>;
}

export interface KUMOToken
  extends _TypedKumoContract<KUMOTokenCalls, KUMOTokenTransactions> {
  readonly filters: {
    Approval(owner?: string | null, spender?: string | null, value?: null): EventFilter;
    CommunityIssuanceAddressSet(_communityIssuanceAddress?: null): EventFilter;
    KUMOStakingAddressSet(_kumoStakingAddress?: null): EventFilter;
    LockupContractFactoryAddressSet(_lockupContractFactoryAddress?: null): EventFilter;
    Transfer(from?: string | null, to?: string | null, value?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "Approval"): _TypedLogDescription<{ owner: string; spender: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "CommunityIssuanceAddressSet"): _TypedLogDescription<{ _communityIssuanceAddress: string }>[];
  extractEvents(logs: Log[], name: "KUMOStakingAddressSet"): _TypedLogDescription<{ _kumoStakingAddress: string }>[];
  extractEvents(logs: Log[], name: "LockupContractFactoryAddressSet"): _TypedLogDescription<{ _lockupContractFactoryAddress: string }>[];
  extractEvents(logs: Log[], name: "Transfer"): _TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
}

interface MultiTroveGetterCalls {
  getMultipleSortedTroves(_asset: string, _startIdx: BigNumberish, _count: BigNumberish, _overrides?: CallOverrides): Promise<{ owner: string; asset: string; debt: BigNumber; coll: BigNumber; stake: BigNumber; snapshotAsset: BigNumber; snapshotKUSDDebt: BigNumber }[]>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
}

interface MultiTroveGetterTransactions {
}

export interface MultiTroveGetter
  extends _TypedKumoContract<MultiTroveGetterCalls, MultiTroveGetterTransactions> {
  readonly filters: {
  };
}

interface PriceFeedCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  ETHUSD_TELLOR_REQ_ID(_overrides?: CallOverrides): Promise<string>;
  MAX_PRICE_DEVIATION_FROM_PREVIOUS_ROUND(_overrides?: CallOverrides): Promise<BigNumber>;
  MAX_PRICE_DIFFERENCE_BETWEEN_ORACLES(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  TARGET_DIGITS(_overrides?: CallOverrides): Promise<BigNumber>;
  TELLOR_DIGITS(_overrides?: CallOverrides): Promise<BigNumber>;
  TIMEOUT(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  lastGoodPrice(_overrides?: CallOverrides): Promise<BigNumber>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceAggregator(_overrides?: CallOverrides): Promise<string>;
  status(_overrides?: CallOverrides): Promise<number>;
  tellorCaller(_overrides?: CallOverrides): Promise<string>;
}

interface PriceFeedTransactions {
  fetchPrice(_overrides?: Overrides): Promise<BigNumber>;
  setAddresses(_priceAggregatorAddress: string, _tellorCallerAddress: string, _overrides?: Overrides): Promise<void>;
}

export interface PriceFeed
  extends _TypedKumoContract<PriceFeedCalls, PriceFeedTransactions> {
  readonly filters: {
    LastGoodPriceUpdated(_lastGoodPrice?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    PriceFeedStatusChanged(newStatus?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "LastGoodPriceUpdated"): _TypedLogDescription<{ _lastGoodPrice: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "PriceFeedStatusChanged"): _TypedLogDescription<{ newStatus: number }>[];
}

interface PriceFeedTestnetCalls {
  getPrice(_overrides?: CallOverrides): Promise<BigNumber>;
}

interface PriceFeedTestnetTransactions {
  fetchPrice(_overrides?: Overrides): Promise<BigNumber>;
  setPrice(price: BigNumberish, _overrides?: Overrides): Promise<boolean>;
}

export interface PriceFeedTestnet
  extends _TypedKumoContract<PriceFeedTestnetCalls, PriceFeedTestnetTransactions> {
  readonly filters: {
    LastGoodPriceUpdated(_lastGoodPrice?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "LastGoodPriceUpdated"): _TypedLogDescription<{ _lastGoodPrice: BigNumber }>[];
}

interface SortedTrovesCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  contains(_asset: string, _id: string, _overrides?: CallOverrides): Promise<boolean>;
  data(arg0: string, _overrides?: CallOverrides): Promise<{ head: string; tail: string; maxSize: BigNumber; size: BigNumber }>;
  findInsertPosition(_asset: string, _NICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: CallOverrides): Promise<[string, string]>;
  getFirst(_asset: string, _overrides?: CallOverrides): Promise<string>;
  getLast(_asset: string, _overrides?: CallOverrides): Promise<string>;
  getMaxSize(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getNext(_asset: string, _id: string, _overrides?: CallOverrides): Promise<string>;
  getPrev(_asset: string, _id: string, _overrides?: CallOverrides): Promise<string>;
  getSize(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  isEmpty(_asset: string, _overrides?: CallOverrides): Promise<boolean>;
  isFull(_asset: string, _overrides?: CallOverrides): Promise<boolean>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
  validInsertPosition(_asset: string, _NICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: CallOverrides): Promise<boolean>;
}

interface SortedTrovesTransactions {
  insert(_asset: string, _id: string, _NICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: Overrides): Promise<void>;
  reInsert(_asset: string, _id: string, _newNICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: Overrides): Promise<void>;
  remove(_asset: string, _id: string, _overrides?: Overrides): Promise<void>;
  setParams(_size: BigNumberish, _troveManagerAddress: string, _borrowerOperationsAddress: string, _overrides?: Overrides): Promise<void>;
}

export interface SortedTroves
  extends _TypedKumoContract<SortedTrovesCalls, SortedTrovesTransactions> {
  readonly filters: {
    BorrowerOperationsAddressChanged(_borrowerOperationsAddress?: null): EventFilter;
    NodeAdded(_asset?: string | null, _id?: null, _NICR?: null): EventFilter;
    NodeRemoved(_asset?: string | null, _id?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SortedTrovesAddressChanged(_sortedDoublyLLAddress?: null): EventFilter;
    TroveManagerAddressChanged(_troveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _borrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "NodeAdded"): _TypedLogDescription<{ _asset: string; _id: string; _NICR: BigNumber }>[];
  extractEvents(logs: Log[], name: "NodeRemoved"): _TypedLogDescription<{ _asset: string; _id: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): _TypedLogDescription<{ _sortedDoublyLLAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _troveManagerAddress: string }>[];
}

interface StabilityPoolCalls {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  ETH_REF_ADDRESS(_overrides?: CallOverrides): Promise<string>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  P(_overrides?: CallOverrides): Promise<BigNumber>;
  SCALE_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  STABILITY_POOL_NAME_BYTES(_overrides?: CallOverrides): Promise<string>;
  borrowerOperations(_overrides?: CallOverrides): Promise<string>;
  communityIssuance(_overrides?: CallOverrides): Promise<string>;
  currentEpoch(_overrides?: CallOverrides): Promise<BigNumber>;
  currentScale(_overrides?: CallOverrides): Promise<BigNumber>;
  depositSnapshots(arg0: string, _overrides?: CallOverrides): Promise<{ S: BigNumber; P: BigNumber; G: BigNumber; scale: BigNumber; epoch: BigNumber }>;
  deposits(arg0: string, _overrides?: CallOverrides): Promise<{ initialValue: BigNumber; frontEndTag: string }>;
  epochToScaleToG(arg0: BigNumberish, arg1: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  epochToScaleToSum(arg0: BigNumberish, arg1: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  frontEndSnapshots(arg0: string, _overrides?: CallOverrides): Promise<{ S: BigNumber; P: BigNumber; G: BigNumber; scale: BigNumber; epoch: BigNumber }>;
  frontEndStakes(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  frontEnds(arg0: string, _overrides?: CallOverrides): Promise<{ kickbackRate: BigNumber; registered: boolean }>;
  getAssetBalance(_overrides?: CallOverrides): Promise<BigNumber>;
  getAssetType(_overrides?: CallOverrides): Promise<string>;
  getCompoundedFrontEndStake(_frontEnd: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getCompoundedKUSDDeposit(_depositor: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getCompoundedTotalStake(_overrides?: CallOverrides): Promise<BigNumber>;
  getDepositorAssetGain(_depositor: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getDepositorAssetGain1e18(_depositor: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getDepositorKUMOGain(_depositor: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemColl(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getFrontEndKUMOGain(_frontEnd: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getNameBytes(_overrides?: CallOverrides): Promise<string>;
  getTotalKUSDDeposits(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  kumoParams(_overrides?: CallOverrides): Promise<string>;
  kusdToken(_overrides?: CallOverrides): Promise<string>;
  lastETHError_Offset(_overrides?: CallOverrides): Promise<BigNumber>;
  lastKUMOError(_overrides?: CallOverrides): Promise<BigNumber>;
  lastkusdLossError_Offset(_overrides?: CallOverrides): Promise<BigNumber>;
  owner(_overrides?: CallOverrides): Promise<string>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  systemSnapshots(_overrides?: CallOverrides): Promise<{ S: BigNumber; P: BigNumber; G: BigNumber; scale: BigNumber; epoch: BigNumber }>;
  totalStakes(_overrides?: CallOverrides): Promise<BigNumber>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
}

interface StabilityPoolTransactions {
  offset(_debtToOffset: BigNumberish, _collToAdd: BigNumberish, _overrides?: Overrides): Promise<void>;
  provideToSP(_amount: BigNumberish, _frontEndTag: string, _overrides?: Overrides): Promise<void>;
  receivedERC20(_asset: string, _amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  registerFrontEnd(_kickbackRate: BigNumberish, _overrides?: Overrides): Promise<void>;
  setAddresses(_assetAddress: string, _borrowerOperationsAddress: string, _troveManagerAddress: string, _kusdTokenAddress: string, _sortedTrovesAddress: string, _communityIssuanceAddress: string, _kumoParamsAddress: string, _overrides?: Overrides): Promise<void>;
  setKumoParameters(_kumoParamsAddress: string, _overrides?: Overrides): Promise<void>;
  withdrawETHGainToTrove(_upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<void>;
  withdrawFromSP(_amount: BigNumberish, _overrides?: Overrides): Promise<void>;
}

export interface StabilityPool
  extends _TypedKumoContract<StabilityPoolCalls, StabilityPoolTransactions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    AssetGainWithdrawn(_depositor?: string | null, _Asset?: null, _kusdLoss?: null): EventFilter;
    AssetSent(_to?: null, _amount?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    CommunityIssuanceAddressChanged(_newCommunityIssuanceAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    DepositSnapshotUpdated(_depositor?: string | null, _P?: null, _S?: null, _G?: null): EventFilter;
    ETHGainWithdrawn(_depositor?: string | null, _ETH?: null, _kusdLoss?: null): EventFilter;
    EpochUpdated(_currentEpoch?: null): EventFilter;
    FrontEndRegistered(_frontEnd?: string | null, _kickbackRate?: null): EventFilter;
    FrontEndSnapshotUpdated(_frontEnd?: string | null, _P?: null, _G?: null): EventFilter;
    FrontEndStakeChanged(_frontEnd?: string | null, _newFrontEndStake?: null, _depositor?: null): EventFilter;
    FrontEndTagSet(_depositor?: string | null, _frontEnd?: string | null): EventFilter;
    G_Updated(_G?: null, _epoch?: null, _scale?: null): EventFilter;
    KUMOPaidToDepositor(_depositor?: string | null, _KUMO?: null): EventFilter;
    KUMOPaidToFrontEnd(_frontEnd?: string | null, _KUMO?: null): EventFilter;
    KUSDTokenAddressChanged(_newKUSDTokenAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    P_Updated(_P?: null): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    S_Updated(_S?: null, _epoch?: null, _scale?: null): EventFilter;
    ScaleUpdated(_currentScale?: null): EventFilter;
    SortedTrovesAddressChanged(_newSortedTrovesAddress?: null): EventFilter;
    StabilityPoolAssetBalanceUpdated(_newBalance?: null): EventFilter;
    StabilityPoolKUSDBalanceUpdated(_newBalance?: null): EventFilter;
    StakeChanged(_newSystemStake?: null, _depositor?: null): EventFilter;
    SystemSnapshotUpdated(_P?: null, _G?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
    UserDepositChanged(_depositor?: string | null, _newDeposit?: null): EventFilter;
    VaultParametersBaseChanged(newAddress?: string | null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "AssetGainWithdrawn"): _TypedLogDescription<{ _depositor: string; _Asset: BigNumber; _kusdLoss: BigNumber }>[];
  extractEvents(logs: Log[], name: "AssetSent"): _TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "CommunityIssuanceAddressChanged"): _TypedLogDescription<{ _newCommunityIssuanceAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): _TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DepositSnapshotUpdated"): _TypedLogDescription<{ _depositor: string; _P: BigNumber; _S: BigNumber; _G: BigNumber }>[];
  extractEvents(logs: Log[], name: "ETHGainWithdrawn"): _TypedLogDescription<{ _depositor: string; _ETH: BigNumber; _kusdLoss: BigNumber }>[];
  extractEvents(logs: Log[], name: "EpochUpdated"): _TypedLogDescription<{ _currentEpoch: BigNumber }>[];
  extractEvents(logs: Log[], name: "FrontEndRegistered"): _TypedLogDescription<{ _frontEnd: string; _kickbackRate: BigNumber }>[];
  extractEvents(logs: Log[], name: "FrontEndSnapshotUpdated"): _TypedLogDescription<{ _frontEnd: string; _P: BigNumber; _G: BigNumber }>[];
  extractEvents(logs: Log[], name: "FrontEndStakeChanged"): _TypedLogDescription<{ _frontEnd: string; _newFrontEndStake: BigNumber; _depositor: string }>[];
  extractEvents(logs: Log[], name: "FrontEndTagSet"): _TypedLogDescription<{ _depositor: string; _frontEnd: string }>[];
  extractEvents(logs: Log[], name: "G_Updated"): _TypedLogDescription<{ _G: BigNumber; _epoch: BigNumber; _scale: BigNumber }>[];
  extractEvents(logs: Log[], name: "KUMOPaidToDepositor"): _TypedLogDescription<{ _depositor: string; _KUMO: BigNumber }>[];
  extractEvents(logs: Log[], name: "KUMOPaidToFrontEnd"): _TypedLogDescription<{ _frontEnd: string; _KUMO: BigNumber }>[];
  extractEvents(logs: Log[], name: "KUSDTokenAddressChanged"): _TypedLogDescription<{ _newKUSDTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "P_Updated"): _TypedLogDescription<{ _P: BigNumber }>[];
  extractEvents(logs: Log[], name: "PriceFeedAddressChanged"): _TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(logs: Log[], name: "S_Updated"): _TypedLogDescription<{ _S: BigNumber; _epoch: BigNumber; _scale: BigNumber }>[];
  extractEvents(logs: Log[], name: "ScaleUpdated"): _TypedLogDescription<{ _currentScale: BigNumber }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): _TypedLogDescription<{ _newSortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAssetBalanceUpdated"): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "StabilityPoolKUSDBalanceUpdated"): _TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "StakeChanged"): _TypedLogDescription<{ _newSystemStake: BigNumber; _depositor: string }>[];
  extractEvents(logs: Log[], name: "SystemSnapshotUpdated"): _TypedLogDescription<{ _P: BigNumber; _G: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): _TypedLogDescription<{ _newTroveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "UserDepositChanged"): _TypedLogDescription<{ _depositor: string; _newDeposit: BigNumber }>[];
  extractEvents(logs: Log[], name: "VaultParametersBaseChanged"): _TypedLogDescription<{ newAddress: string }>[];
}

interface TroveManagerCalls {
  BETA(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  ETH_REF_ADDRESS(_overrides?: CallOverrides): Promise<string>;
  L_ASSETS(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  L_KUSDDebts(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  MINUTE_DECAY_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  SECONDS_IN_ONE_MINUTE(_overrides?: CallOverrides): Promise<BigNumber>;
  TroveOwners(arg0: string, arg1: BigNumberish, _overrides?: CallOverrides): Promise<string>;
  Troves(arg0: string, arg1: string, _overrides?: CallOverrides): Promise<{ asset: string; debt: BigNumber; coll: BigNumber; stake: BigNumber; status: number; arrayIndex: BigNumber }>;
  baseRate(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  checkRecoveryMode(_asset: string, _price: BigNumberish, _overrides?: CallOverrides): Promise<boolean>;
  getBorrowingFee(_asset: string, _KUSDDebt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getBorrowingFeeWithDecay(_asset: string, _KUSDDebt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getBorrowingRate(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getBorrowingRateWithDecay(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getCurrentICR(_asset: string, _borrower: string, _price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireDebtAndColl(_asset: string, _borrower: string, _overrides?: CallOverrides): Promise<{ debt: BigNumber; coll: BigNumber; pendingKUSDDebtReward: BigNumber; pendingReward: BigNumber }>;
  getEntireSystemColl(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getNominalICR(_asset: string, _borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getPendingKUSDDebtReward(_asset: string, _borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getPendingReward(_asset: string, _borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getRedemptionFeeWithDecay(_asset: string, _assetDraw: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getRedemptionRate(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getRedemptionRateWithDecay(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTCR(_asset: string, _price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveColl(_asset: string, _borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveDebt(_asset: string, _borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveFromTroveOwnersArray(_asset: string, _index: BigNumberish, _overrides?: CallOverrides): Promise<string>;
  getTroveOwnersCount(_asset: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveStake(_asset: string, _borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveStatus(_asset: string, _borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  hasPendingRewards(_asset: string, _borrower: string, _overrides?: CallOverrides): Promise<boolean>;
  isInitialized(_overrides?: CallOverrides): Promise<boolean>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  isRedemptionWhitelisted(_overrides?: CallOverrides): Promise<boolean>;
  kumoParams(_overrides?: CallOverrides): Promise<string>;
  kumoStaking(_overrides?: CallOverrides): Promise<string>;
  kumoToken(_overrides?: CallOverrides): Promise<string>;
  kusdToken(_overrides?: CallOverrides): Promise<string>;
  lastETHError_Redistribution(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  lastFeeOperationTime(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  lastKUSDDebtError_Redistribution(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  owner(_overrides?: CallOverrides): Promise<string>;
  redemptionWhitelist(arg0: string, _overrides?: CallOverrides): Promise<boolean>;
  rewardSnapshots(arg0: string, arg1: string, _overrides?: CallOverrides): Promise<{ asset: BigNumber; KUSDDebt: BigNumber }>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  stabilityPool(_overrides?: CallOverrides): Promise<string>;
  stabilityPoolManager(_overrides?: CallOverrides): Promise<string>;
  totalCollateralSnapshot(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalStakes(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalStakesSnapshot(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
}

interface TroveManagerTransactions {
  addTroveOwnerToArray(_asset: string, _borrower: string, _overrides?: Overrides): Promise<BigNumber>;
  applyPendingRewards(_asset: string, _borrower: string, _overrides?: Overrides): Promise<void>;
  batchLiquidateTroves(_asset: string, _troveArray: string[], _overrides?: Overrides): Promise<void>;
  closeTrove(_asset: string, _borrower: string, _overrides?: Overrides): Promise<void>;
  decayBaseRateFromBorrowing(_asset: string, _overrides?: Overrides): Promise<void>;
  decreaseTroveColl(_asset: string, _borrower: string, _collDecrease: BigNumberish, _overrides?: Overrides): Promise<BigNumber>;
  decreaseTroveDebt(_asset: string, _borrower: string, _debtDecrease: BigNumberish, _overrides?: Overrides): Promise<BigNumber>;
  increaseTroveColl(_asset: string, _borrower: string, _collIncrease: BigNumberish, _overrides?: Overrides): Promise<BigNumber>;
  increaseTroveDebt(_asset: string, _borrower: string, _debtIncrease: BigNumberish, _overrides?: Overrides): Promise<BigNumber>;
  liquidate(_asset: string, _borrower: string, _overrides?: Overrides): Promise<void>;
  liquidateTroves(_asset: string, _n: BigNumberish, _overrides?: Overrides): Promise<void>;
  redeemCollateral(_asset: string, _KUSDamount: BigNumberish, _firstRedemptionHint: string, _upperPartialRedemptionHint: string, _lowerPartialRedemptionHint: string, _partialRedemptionHintNICR: BigNumberish, _maxIterations: BigNumberish, _maxFeePercentage: BigNumberish, _overrides?: Overrides): Promise<void>;
  removeStake(_asset: string, _borrower: string, _overrides?: Overrides): Promise<void>;
  setAddresses(_borrowerOperationsAddress: string, _stabilityPoolManagerAddress: string, _gasPoolAddress: string, _collSurplusPoolAddress: string, _kusdTokenAddress: string, _sortedTrovesAddress: string, _kumoTokenAddress: string, _kumoStakingAddress: string, _kumoParamsAddress: string, _overrides?: Overrides): Promise<void>;
  setKumoParameters(_kumoParamsAddress: string, _overrides?: Overrides): Promise<void>;
  setTroveStatus(_asset: string, _borrower: string, _num: BigNumberish, _overrides?: Overrides): Promise<void>;
  updateStakeAndTotalStakes(_asset: string, _borrower: string, _overrides?: Overrides): Promise<BigNumber>;
  updateTroveRewardSnapshots(_asset: string, _borrower: string, _overrides?: Overrides): Promise<void>;
}

export interface TroveManager
  extends _TypedKumoContract<TroveManagerCalls, TroveManagerTransactions> {
  readonly filters: {
    ActivePoolAddressChanged(_activePoolAddress?: null): EventFilter;
    BaseRateUpdated(_baseRate?: null): EventFilter;
    BaseRateUpdated(_asset?: string | null, _baseRate?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    CollSurplusPoolAddressChanged(_collSurplusPoolAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_defaultPoolAddress?: null): EventFilter;
    GasPoolAddressChanged(_gasPoolAddress?: null): EventFilter;
    KUMOStakingAddressChanged(_kumoStakingAddress?: null): EventFilter;
    KUMOTokenAddressChanged(_kumoTokenAddress?: null): EventFilter;
    KUSDTokenAddressChanged(_newKUSDTokenAddress?: null): EventFilter;
    LTermsUpdated(_L_ETH?: null, _L_KUSDDebt?: null): EventFilter;
    LastFeeOpTimeUpdated(_lastFeeOpTime?: null): EventFilter;
    LastFeeOpTimeUpdated(_asset?: string | null, _lastFeeOpTime?: null): EventFilter;
    Liquidation(_asset?: string | null, _liquidatedDebt?: null, _liquidatedColl?: null, _collGasCompensation?: null, _kusdGasCompensation?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    Redemption(_asset?: string | null, _attemptedKUSDAmount?: null, _actualKUSDAmount?: null, _AssetSent?: null, _AssetFee?: null): EventFilter;
    SortedTrovesAddressChanged(_sortedTrovesAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_stabilityPoolAddress?: null): EventFilter;
    SystemSnapshotsUpdated(_totalStakesSnapshot?: null, _totalCollateralSnapshot?: null): EventFilter;
    SystemSnapshotsUpdated(_asset?: string | null, _totalStakesSnapshot?: null, _totalCollateralSnapshot?: null): EventFilter;
    TotalStakesUpdated(_newTotalStakes?: null): EventFilter;
    TotalStakesUpdated(_asset?: string | null, _newTotalStakes?: null): EventFilter;
    TroveIndexUpdated(_borrower?: null, _newIndex?: null): EventFilter;
    TroveIndexUpdated(_asset?: string | null, _borrower?: null, _newIndex?: null): EventFilter;
    TroveLiquidated(_asset?: string | null, _borrower?: string | null, _debt?: null, _coll?: null, _operation?: null): EventFilter;
    TroveSnapshotsUpdated(_asset?: string | null, _L_ETH?: null, _L_KUSDDebt?: null): EventFilter;
    TroveUpdated(_asset?: string | null, _borrower?: string | null, _debt?: null, _coll?: null, _stake?: null, _operation?: null): EventFilter;
    VaultParametersBaseChanged(newAddress?: string | null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): _TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "BaseRateUpdated"): _TypedLogDescription<{ _baseRate: BigNumber }>[];
  extractEvents(logs: Log[], name: "BaseRateUpdated"): _TypedLogDescription<{ _asset: string; _baseRate: BigNumber }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): _TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "CollSurplusPoolAddressChanged"): _TypedLogDescription<{ _collSurplusPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): _TypedLogDescription<{ _defaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "GasPoolAddressChanged"): _TypedLogDescription<{ _gasPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "KUMOStakingAddressChanged"): _TypedLogDescription<{ _kumoStakingAddress: string }>[];
  extractEvents(logs: Log[], name: "KUMOTokenAddressChanged"): _TypedLogDescription<{ _kumoTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "KUSDTokenAddressChanged"): _TypedLogDescription<{ _newKUSDTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "LTermsUpdated"): _TypedLogDescription<{ _L_ETH: BigNumber; _L_KUSDDebt: BigNumber }>[];
  extractEvents(logs: Log[], name: "LastFeeOpTimeUpdated"): _TypedLogDescription<{ _lastFeeOpTime: BigNumber }>[];
  extractEvents(logs: Log[], name: "LastFeeOpTimeUpdated"): _TypedLogDescription<{ _asset: string; _lastFeeOpTime: BigNumber }>[];
  extractEvents(logs: Log[], name: "Liquidation"): _TypedLogDescription<{ _asset: string; _liquidatedDebt: BigNumber; _liquidatedColl: BigNumber; _collGasCompensation: BigNumber; _kusdGasCompensation: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "PriceFeedAddressChanged"): _TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(logs: Log[], name: "Redemption"): _TypedLogDescription<{ _asset: string; _attemptedKUSDAmount: BigNumber; _actualKUSDAmount: BigNumber; _AssetSent: BigNumber; _AssetFee: BigNumber }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): _TypedLogDescription<{ _sortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): _TypedLogDescription<{ _stabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "SystemSnapshotsUpdated"): _TypedLogDescription<{ _totalStakesSnapshot: BigNumber; _totalCollateralSnapshot: BigNumber }>[];
  extractEvents(logs: Log[], name: "SystemSnapshotsUpdated"): _TypedLogDescription<{ _asset: string; _totalStakesSnapshot: BigNumber; _totalCollateralSnapshot: BigNumber }>[];
  extractEvents(logs: Log[], name: "TotalStakesUpdated"): _TypedLogDescription<{ _newTotalStakes: BigNumber }>[];
  extractEvents(logs: Log[], name: "TotalStakesUpdated"): _TypedLogDescription<{ _asset: string; _newTotalStakes: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveIndexUpdated"): _TypedLogDescription<{ _borrower: string; _newIndex: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveIndexUpdated"): _TypedLogDescription<{ _asset: string; _borrower: string; _newIndex: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveLiquidated"): _TypedLogDescription<{ _asset: string; _borrower: string; _debt: BigNumber; _coll: BigNumber; _operation: number }>[];
  extractEvents(logs: Log[], name: "TroveSnapshotsUpdated"): _TypedLogDescription<{ _asset: string; _L_ETH: BigNumber; _L_KUSDDebt: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveUpdated"): _TypedLogDescription<{ _asset: string; _borrower: string; _debt: BigNumber; _coll: BigNumber; _stake: BigNumber; _operation: number }>[];
  extractEvents(logs: Log[], name: "VaultParametersBaseChanged"): _TypedLogDescription<{ newAddress: string }>[];
}

interface UnipoolCalls {
  NAME(_overrides?: CallOverrides): Promise<string>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  duration(_overrides?: CallOverrides): Promise<BigNumber>;
  earned(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  kumoToken(_overrides?: CallOverrides): Promise<string>;
  lastTimeRewardApplicable(_overrides?: CallOverrides): Promise<BigNumber>;
  lastUpdateTime(_overrides?: CallOverrides): Promise<BigNumber>;
  owner(_overrides?: CallOverrides): Promise<string>;
  periodFinish(_overrides?: CallOverrides): Promise<BigNumber>;
  rewardPerToken(_overrides?: CallOverrides): Promise<BigNumber>;
  rewardPerTokenStored(_overrides?: CallOverrides): Promise<BigNumber>;
  rewardRate(_overrides?: CallOverrides): Promise<BigNumber>;
  rewards(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
  uniToken(_overrides?: CallOverrides): Promise<string>;
  userRewardPerTokenPaid(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
}

interface UnipoolTransactions {
  claimReward(_overrides?: Overrides): Promise<void>;
  setParams(_kumoTokenAddress: string, _uniTokenAddress: string, _duration: BigNumberish, _overrides?: Overrides): Promise<void>;
  stake(amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  withdraw(amount: BigNumberish, _overrides?: Overrides): Promise<void>;
  withdrawAndClaim(_overrides?: Overrides): Promise<void>;
}

export interface Unipool
  extends _TypedKumoContract<UnipoolCalls, UnipoolTransactions> {
  readonly filters: {
    KUMOTokenAddressChanged(_kumoTokenAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    RewardAdded(reward?: null): EventFilter;
    RewardPaid(user?: string | null, reward?: null): EventFilter;
    Staked(user?: string | null, amount?: null): EventFilter;
    UniTokenAddressChanged(_uniTokenAddress?: null): EventFilter;
    Withdrawn(user?: string | null, amount?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "KUMOTokenAddressChanged"): _TypedLogDescription<{ _kumoTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "RewardAdded"): _TypedLogDescription<{ reward: BigNumber }>[];
  extractEvents(logs: Log[], name: "RewardPaid"): _TypedLogDescription<{ user: string; reward: BigNumber }>[];
  extractEvents(logs: Log[], name: "Staked"): _TypedLogDescription<{ user: string; amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "UniTokenAddressChanged"): _TypedLogDescription<{ _uniTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "Withdrawn"): _TypedLogDescription<{ user: string; amount: BigNumber }>[];
}

interface KumoParametersCalls {
  BOOTSTRAP_PERIOD(_overrides?: CallOverrides): Promise<BigNumber>;
  BORROWING_FEE_FLOOR(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  BORROWING_FEE_FLOOR_DEFAULT(_overrides?: CallOverrides): Promise<BigNumber>;
  CCR(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  CCR_DEFAULT(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  KUSD_GAS_COMPENSATION(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  KUSD_GAS_COMPENSATION_DEFAULT(_overrides?: CallOverrides): Promise<BigNumber>;
  MAX_BORROWING_FEE(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  MAX_BORROWING_FEE_DEFAULT(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  MCR_DEFAULT(_overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  MIN_NET_DEBT_DEFAULT(_overrides?: CallOverrides): Promise<BigNumber>;
  NAME(_overrides?: CallOverrides): Promise<string>;
  PERCENT_DIVISOR(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  PERCENT_DIVISOR_DEFAULT(_overrides?: CallOverrides): Promise<BigNumber>;
  REDEMPTION_BLOCK_DAY(_overrides?: CallOverrides): Promise<BigNumber>;
  REDEMPTION_FEE_FLOOR(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  REDEMPTION_FEE_FLOOR_DEFAULT(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  isInitialized(_overrides?: CallOverrides): Promise<boolean>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  redemptionBlock(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
}

interface KumoParametersTransactions {
  removeRedemptionBlock(_asset: string, _overrides?: Overrides): Promise<void>;
  sanitizeParameters(_asset: string, _overrides?: Overrides): Promise<void>;
  setAddresses(_activePool: string, _defaultPool: string, _priceFeed: string, _overrides?: Overrides): Promise<void>;
  setAsDefault(_asset: string, _overrides?: Overrides): Promise<void>;
  setBorrowingFeeFloor(_asset: string, borrowingFeeFloor: BigNumberish, _overrides?: Overrides): Promise<void>;
  setCCR(_asset: string, newCCR: BigNumberish, _overrides?: Overrides): Promise<void>;
  setCollateralParameters(_asset: string, newMCR: BigNumberish, newCCR: BigNumberish, gasCompensation: BigNumberish, minNetDebt: BigNumberish, precentDivisor: BigNumberish, borrowingFeeFloor: BigNumberish, maxBorrowingFee: BigNumberish, redemptionFeeFloor: BigNumberish, _overrides?: Overrides): Promise<void>;
  setKUMOGasCompensation(_asset: string, gasCompensation: BigNumberish, _overrides?: Overrides): Promise<void>;
  setMCR(_asset: string, newMCR: BigNumberish, _overrides?: Overrides): Promise<void>;
  setMaxBorrowingFee(_asset: string, maxBorrowingFee: BigNumberish, _overrides?: Overrides): Promise<void>;
  setMinNetDebt(_asset: string, minNetDebt: BigNumberish, _overrides?: Overrides): Promise<void>;
  setPercentDivisor(_asset: string, precentDivisor: BigNumberish, _overrides?: Overrides): Promise<void>;
  setPriceFeed(_priceFeed: string, _overrides?: Overrides): Promise<void>;
  setRedemptionFeeFloor(_asset: string, redemptionFeeFloor: BigNumberish, _overrides?: Overrides): Promise<void>;
}

export interface KumoParameters
  extends _TypedKumoContract<KumoParametersCalls, KumoParametersTransactions> {
  readonly filters: {
    BorrowingFeeFloorChanged(oldBorrowingFloorFee?: null, newBorrowingFloorFee?: null): EventFilter;
    CCRChanged(oldCCR?: null, newCCR?: null): EventFilter;
    GasCompensationChanged(oldGasComp?: null, newGasComp?: null): EventFilter;
    MCRChanged(oldMCR?: null, newMCR?: null): EventFilter;
    MaxBorrowingFeeChanged(oldMaxBorrowingFee?: null, newMaxBorrowingFee?: null): EventFilter;
    MinNetDebtChanged(oldMinNet?: null, newMinNet?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    PercentDivisorChanged(oldPercentDiv?: null, newPercentDiv?: null): EventFilter;
    PriceFeedChanged(addr?: string | null): EventFilter;
    RedemptionBlockRemoved(_asset?: null): EventFilter;
    RedemptionFeeFloorChanged(oldRedemptionFeeFloor?: null, newRedemptionFeeFloor?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "BorrowingFeeFloorChanged"): _TypedLogDescription<{ oldBorrowingFloorFee: BigNumber; newBorrowingFloorFee: BigNumber }>[];
  extractEvents(logs: Log[], name: "CCRChanged"): _TypedLogDescription<{ oldCCR: BigNumber; newCCR: BigNumber }>[];
  extractEvents(logs: Log[], name: "GasCompensationChanged"): _TypedLogDescription<{ oldGasComp: BigNumber; newGasComp: BigNumber }>[];
  extractEvents(logs: Log[], name: "MCRChanged"): _TypedLogDescription<{ oldMCR: BigNumber; newMCR: BigNumber }>[];
  extractEvents(logs: Log[], name: "MaxBorrowingFeeChanged"): _TypedLogDescription<{ oldMaxBorrowingFee: BigNumber; newMaxBorrowingFee: BigNumber }>[];
  extractEvents(logs: Log[], name: "MinNetDebtChanged"): _TypedLogDescription<{ oldMinNet: BigNumber; newMinNet: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): _TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "PercentDivisorChanged"): _TypedLogDescription<{ oldPercentDiv: BigNumber; newPercentDiv: BigNumber }>[];
  extractEvents(logs: Log[], name: "PriceFeedChanged"): _TypedLogDescription<{ addr: string }>[];
  extractEvents(logs: Log[], name: "RedemptionBlockRemoved"): _TypedLogDescription<{ _asset: string }>[];
  extractEvents(logs: Log[], name: "RedemptionFeeFloorChanged"): _TypedLogDescription<{ oldRedemptionFeeFloor: BigNumber; newRedemptionFeeFloor: BigNumber }>[];
}
