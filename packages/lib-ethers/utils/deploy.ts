import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction, ContractFactory, Overrides } from "@ethersproject/contracts";
import { Wallet } from "@ethersproject/wallet";

import { Decimal } from "@kumodao/lib-base";

import { BigNumber, BigNumberish } from "@ethersproject/bignumber";


import {
  _KumoContractAddresses,
  _KumoContracts,
  _KumoDeploymentJSON,
  _connectToContracts
} from "../src/contracts";

import { createUniswapV2Pair } from "./UniswapV2Factory";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

let silent = true;

export const log = (...args: unknown[]): void => {
  if (!silent) {
    console.log(...args);
  }
};

export const setSilent = (s: boolean): void => {
  silent = s;
};

const deployContractAndGetBlockNumber = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  contractName: string,
  ...args: unknown[]
): Promise<[address: string, blockNumber: number]> => {
  log(`Deploying ${contractName} ...`);
  const contract = await (await getContractFactory(contractName, deployer)).deploy(...args);

  log(`Waiting for transaction ${contract.deployTransaction.hash} ...`);
  const receipt = await contract.deployTransaction.wait();

  log({
    contractAddress: contract.address,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toNumber()
  });

  log();

  return [contract.address, receipt.blockNumber];
};

const deployContract: (
  ...p: Parameters<typeof deployContractAndGetBlockNumber>
) => Promise<string> = (...p) => deployContractAndGetBlockNumber(...p).then(([a]) => a);

const deployContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  priceFeedIsTestnet = true,
  overrides?: Overrides
): Promise<[addresses: Omit<_KumoContractAddresses, "uniToken">, startBlock: number]> => {
  const [activePoolAddress, startBlock] = await deployContractAndGetBlockNumber(
    deployer,
    getContractFactory,
    "ActivePool",
    { ...overrides }
  );

  const addresses = {
    activePool: activePoolAddress,
    borrowerOperations: await deployContract(deployer, getContractFactory, "BorrowerOperations", {
      ...overrides
    }),
    troveManager: await deployContract(deployer, getContractFactory, "TroveManager", {
      ...overrides
    }),
    collSurplusPool: await deployContract(deployer, getContractFactory, "CollSurplusPool", {
      ...overrides
    }),
    communityIssuance: await deployContract(deployer, getContractFactory, "CommunityIssuance", {
      ...overrides
    }),
    defaultPool: await deployContract(deployer, getContractFactory, "DefaultPool", { ...overrides }),
    hintHelpers: await deployContract(deployer, getContractFactory, "HintHelpers", { ...overrides }),
    lockupContractFactory: await deployContract(
      deployer,
      getContractFactory,
      "LockupContractFactory",
      { ...overrides }
    ),
    kumoStaking: await deployContract(deployer, getContractFactory, "KUMOStaking", { ...overrides }),
    kumoParameters: await deployContract(deployer, getContractFactory, "KumoParameters", {
      ...overrides
    }),

    priceFeed: await deployContract(
      deployer,
      getContractFactory,
      priceFeedIsTestnet ? "PriceFeedTestnet" : "PriceFeed",
      { ...overrides }
    ),
    sortedTroves: await deployContract(deployer, getContractFactory, "SortedTroves", {
      ...overrides
    }),
    stabilityPoolAsset1: await deployContract(deployer, getContractFactory, "StabilityPool", {
      ...overrides
    }),
    stabilityPoolAsset2: await deployContract(deployer, getContractFactory, "StabilityPool", {
      ...overrides
    }),
    stabilityPoolFactory: await deployContract(deployer, getContractFactory, "StabilityPoolFactory", {
      ...overrides
    }),
    gasPool: await deployContract(deployer, getContractFactory, "GasPool", {
      ...overrides
    }),
    unipool: await deployContract(deployer, getContractFactory, "Unipool", { ...overrides }),


    mockAsset1: await deployContract(deployer, getContractFactory, "ERC20Test", { ...overrides }),
    mockAsset2: await deployContract(deployer, getContractFactory, "ERC20Test", { ...overrides })



  };

  return [
    {
      ...addresses,
      kusdToken: await deployContract(
        deployer,
        getContractFactory,
        "KUSDToken",
        addresses.troveManager,
        addresses.stabilityPoolFactory,
        addresses.borrowerOperations,
        { ...overrides }
      ),

      kumoToken: await deployContract(
        deployer,
        getContractFactory,
        "KUMOToken",
        addresses.communityIssuance,
        addresses.kumoStaking,
        addresses.lockupContractFactory,
        Wallet.createRandom().address, // _bountyAddress (TODO: parameterize this)
        addresses.unipool, // _lpRewardsAddress
        Wallet.createRandom().address, // _multisigAddress (TODO: parameterize this)
        { ...overrides }
      ),

      multiTroveGetter: await deployContract(
        deployer,
        getContractFactory,
        "MultiTroveGetter",
        addresses.troveManager,
        addresses.sortedTroves,
        { ...overrides }
      )
    },

    startBlock
  ];
};

export const deployTellorCaller = (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  tellorAddress: string,
  overrides?: Overrides
): Promise<string> =>
  deployContract(deployer, getContractFactory, "TellorCaller", tellorAddress, { ...overrides });

const connectContracts = async (
  {
    activePool,
    borrowerOperations,
    troveManager,
    kusdToken,
    collSurplusPool,
    communityIssuance,
    defaultPool,
    kumoToken,
    hintHelpers,
    lockupContractFactory,
    kumoStaking,
    priceFeed,
    sortedTroves,
    stabilityPoolFactory,
    gasPool,
    unipool,
    uniToken,
    kumoParameters,
    troveRedemptor
  }: _KumoContracts,
  deployer: Signer,
  overrides?: Overrides
) => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  const txCount = await deployer.provider.getTransactionCount(deployer.getAddress());

  const connections: ((nonce: number) => Promise<ContractTransaction>)[] = [
    nonce =>
      sortedTroves.setParams(troveManager.address, borrowerOperations.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      troveManager.setAddresses(
        borrowerOperations.address,
        // activePool.address,
        // defaultPool.address,
        stabilityPoolFactory.address,
        gasPool.address,
        collSurplusPool.address,
        // priceFeed.address,
        kusdToken.address,
        sortedTroves.address,
        kumoToken.address,
        kumoStaking.address,
        kumoParameters.address,
        troveRedemptor.address,
        { ...overrides, nonce }
      ),

    nonce =>
      troveRedemptor.setAddresses(
        troveManager.address,
        sortedTroves.address,
        stabilityPoolFactory.address,
        kusdToken.address,
        collSurplusPool.address,
        kumoParameters.address,
        { ...overrides, nonce }
      ),

    nonce =>
      borrowerOperations.setAddresses(
        troveManager.address,
        // activePool.address,
        // defaultPool.address,
        stabilityPoolFactory.address,
        gasPool.address,
        collSurplusPool.address,
        // priceFeed.address,
        sortedTroves.address,
        kusdToken.address,
        kumoStaking.address,
        kumoParameters.address,
        { ...overrides, nonce }
      ),

    // nonce =>
    //   stabilityPool.setAddresses(
    //     borrowerOperations.address,
    //     troveManager.address,
    //     activePool.address,
    //     kusdToken.address,
    //     sortedTroves.address,
    //     priceFeed.address,
    //     communityIssuance.address,
    //     { ...overrides, nonce }
    //   ),

    nonce =>
      activePool.setAddresses(
        borrowerOperations.address,
        troveManager.address,
        stabilityPoolFactory.address,
        defaultPool.address,
        collSurplusPool.address,
        kumoStaking.address,
        troveRedemptor.address,
        { ...overrides, nonce }
      ),

    nonce =>
      defaultPool.setAddresses(troveManager.address, activePool.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      collSurplusPool.setAddresses(
        borrowerOperations.address,
        troveManager.address,
        activePool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      hintHelpers.setAddresses(sortedTroves.address, troveManager.address, kumoParameters.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      kumoStaking.setAddresses(
        kumoToken.address,
        kusdToken.address,
        troveManager.address,
        borrowerOperations.address,
        activePool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      lockupContractFactory.setKUMOTokenAddress(kumoToken.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      communityIssuance.setAddresses(kumoToken.address, stabilityPoolFactory.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      unipool.setParams(kumoToken.address, uniToken.address, 2 * 30 * 24 * 60 * 60, {
        ...overrides,
        nonce
      }),

    nonce =>
      kumoParameters.setAddresses(activePool.address, defaultPool.address, priceFeed.address, {
        ...overrides,
        nonce
      })
  ];

  let delay = 0;
  const delayIncrement = 1000;

  const promisedConnections = connections.map((connect, i) => {
    delay += delayIncrement;
    return new Promise(resolve => setTimeout(resolve, delay)).then(() => {
      return connect(txCount + i);
    });
  });

  let results = await Promise.all(promisedConnections);

  let i = 0;
  await Promise.all(results.map(tx => tx.wait().then(() => log(`Connected ${++i}`))));
};

const deployMockUniToken = (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  overrides?: Overrides
) =>
  deployContract(
    deployer,
    getContractFactory,
    "ERC20Mock",
    "Mock Uniswap V2",
    "UNI-V2",
    Wallet.createRandom().address, // initialAccount
    0, // initialBalance
    { ...overrides }
  );



const addMockAssetsToSystem = async (
  {
    troveManager,
    sortedTroves,
    stabilityPoolFactory,
    kumoParameters,
    borrowerOperations,
    communityIssuance,
    kusdToken,
    stabilityPoolAsset1,
    stabilityPoolAsset2,
    mockAsset1,
    mockAsset2,
    troveRedemptor
  }: _KumoContracts,
  deployer: Signer,
  overrides?: Overrides
) => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  // Add first mock asset

  await stabilityPoolAsset1.setAddresses(
    mockAsset1.address,
    borrowerOperations.address,
    troveManager.address,
    kusdToken.address,
    sortedTroves.address,
    communityIssuance.address,
    kumoParameters.address,
    troveRedemptor.address,
  ),

    await stabilityPoolFactory.createNewStabilityPool(mockAsset1.address, stabilityPoolAsset1.address)

  await kumoParameters.setAsDefault(mockAsset1.address)
  await troveManager.addNewAsset(mockAsset1.address)
  await sortedTroves.addNewAsset(mockAsset1.address)

  // Add second mock asset
  await stabilityPoolAsset2.setAddresses(
    mockAsset2.address,
    borrowerOperations.address,
    troveManager.address,
    kusdToken.address,
    sortedTroves.address,
    communityIssuance.address,
    kumoParameters.address,
    troveRedemptor.address,
  ),

    await stabilityPoolFactory.createNewStabilityPool(mockAsset2.address, stabilityPoolAsset2.address)

  await kumoParameters.setAsDefault(mockAsset2.address)
  await troveManager.addNewAsset(mockAsset2.address)
  await sortedTroves.addNewAsset(mockAsset2.address)


}


// Mint token to each acccount
const mintMockAssets = async (signers: SignerWithAddress[], { mockAsset1, mockAsset2 }: _KumoContracts) => {
  for (let i = 0; i < signers.length; ++i) {
    await mockAsset1.mint((await signers[i].getAddress()), BigNumber.from("100000000000000000000"))
    await mockAsset2.mint((await signers[i].getAddress()), BigNumber.from("100000000000000000000"))
  }
};




export const deployAndSetupContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  _priceFeedIsTestnet = true,
  _isDev = true,
  signers: SignerWithAddress[],
  wethAddress?: string,
  overrides?: Overrides
): Promise<_KumoDeploymentJSON> => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  log("Deploying contracts...");
  log();

  const deployment: _KumoDeploymentJSON = {
    chainId: await deployer.getChainId(),
    version: "unknown",
    deploymentDate: new Date().getTime(),
    bootstrapPeriod: 0,
    totalStabilityPoolKUMOReward: "0",
    liquidityMiningKUMORewardRate: "0",
    _priceFeedIsTestnet,
    _uniTokenIsMock: !wethAddress,
    _isDev,

    ...(await deployContracts(deployer, getContractFactory, _priceFeedIsTestnet, overrides).then(
      async ([addresses, startBlock]) => ({
        startBlock,

        addresses: {
          ...addresses,

          uniToken: await (wethAddress
            ? createUniswapV2Pair(deployer, wethAddress, addresses.kusdToken, overrides)
            : deployMockUniToken(deployer, getContractFactory, overrides))


        }
      })
    ))
  };

  const contracts = _connectToContracts(deployer, deployment);

  log("Connecting contracts...");
  await connectContracts(contracts, deployer, overrides);

  log("Add Assets to the system...")
  await addMockAssetsToSystem(contracts, deployer);

  log("Mint MockAsset tokens...")
  await mintMockAssets(signers, contracts);


  const kumoTokenDeploymentTime = await contracts.kumoToken.getDeploymentStartTime();
  // const bootstrapPeriod = await contracts.troveManager.BOOTSTRAP_PERIOD();
  const bootstrapPeriod = await contracts.kumoParameters.REDEMPTION_BLOCK_DAY();
  const totalStabilityPoolKUMOReward = await contracts.communityIssuance.KUMOSupplyCap();
  const liquidityMiningKUMORewardRate = await contracts.unipool.rewardRate();

  return {
    ...deployment,
    deploymentDate: kumoTokenDeploymentTime.toNumber() * 1000,
    bootstrapPeriod: bootstrapPeriod.toNumber(),
    totalStabilityPoolKUMOReward: `${Decimal.fromBigNumberString(
      totalStabilityPoolKUMOReward.toHexString()
    )}`,
    liquidityMiningKUMORewardRate: `${Decimal.fromBigNumberString(
      liquidityMiningKUMORewardRate.toHexString()
    )}`
  };
};
