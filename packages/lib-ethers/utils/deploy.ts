import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction, ContractFactory, Overrides, Contract } from "@ethersproject/contracts";
import { Wallet } from "@ethersproject/wallet";

import { Decimal } from "@kumodao/lib-base";

import { BigNumber } from "@ethersproject/bignumber";

import {
  _KumoContractAddresses,
  _KumoContracts,
  _KumoDeploymentJSON,
  _connectToContracts
} from "../src/contracts";

import { createUniswapV2Pair } from "./UniswapV2Factory";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { HardhatEthersHelpers } from "@nomiclabs/hardhat-ethers/types";

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

const deployDiamondAndGetBlockNumber = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  getContractAt: (name: string, address: string, signer: Signer) => Promise<Contract>,
  contractName: string,
  ...args: unknown[]
): Promise<[address: string, blockNumber: number]> => {
  log(`Deploying ${contractName} ...`);
  const diamond = await (await getContractFactory(contractName, deployer)).deploy(...args);

  log(`Waiting for transaction ${diamond.deployTransaction.hash} ...`);
  const receipt = await diamond.deployTransaction.wait();

  log({
    contractAddress: diamond.address,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toNumber()
  });

  const troveManagerFacet = await (await getContractFactory("TroveManagerFacet", deployer)).deploy();
  const troveRedemptorFacet = await (
    await getContractFactory("TroveRedemptorFacet", deployer)
  ).deploy();

  const facets = [troveManagerFacet, troveRedemptorFacet];

  const diamondInit = await (await getContractFactory("DiamondInit", deployer)).deploy();

  const functionCall = diamondInit.interface.encodeFunctionData("init");

  const diamondCut = [];

  for (const deployedFacet of facets) {
    diamondCut.push([deployedFacet.address, 0, getSelectors(deployedFacet)]); // FacetCut.Add is 0
  }

  const diamondCutFacet = await getContractAt("TroveManager", diamond.address, deployer);
  const tx = await diamondCutFacet.diamondCut(diamondCut, diamondInit.address, functionCall, {
    gasLimit: 5000000
  });

  tx.wait();

  const tx2 = await diamondCutFacet.facets();

  return [diamond.address, receipt.blockNumber];
};

const getSelectors = (contract : Contract): string[] => {
  const signatures = Object.keys(contract.interface.functions);
  const selectors = signatures.reduce((acc : string[], val) => {
    if (val !== "init(bytes)") {
      acc.push(contract.interface.getSighash(val));
    }
    return acc;
  }, []);
  return selectors;
}

const deployContract: (
  ...p: Parameters<typeof deployContractAndGetBlockNumber>
) => Promise<string> = (...p) => deployContractAndGetBlockNumber(...p).then(([a]) => a);

const deployDiamond: (
  ...p: Parameters<typeof deployDiamondAndGetBlockNumber>
) => Promise<string> = (...p) => deployDiamondAndGetBlockNumber(...p).then(([a]) => a);

const deployContracts = async (
  deployer: Signer,
  ethers: HardhatEthersHelpers,
  priceFeedIsTestnet = true,
  overrides?: Overrides
): Promise<[addresses: Omit<_KumoContractAddresses, "uniToken">, startBlock: number]> => {
  const getContractFactory = ethers.getContractFactory;

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
    troveManager: await deployDiamond(deployer, getContractFactory, ethers.getContractAt, "TroveManagerDiamond", {
      ...overrides
    }),
    collSurplusPool: await deployContract(deployer, getContractFactory, "CollSurplusPool", {
      ...overrides
    }),
    defaultPool: await deployContract(deployer, getContractFactory, "DefaultPool", { ...overrides }),
    hintHelpers: await deployContract(deployer, getContractFactory, "HintHelpers", { ...overrides }),
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


    mockAsset1: await deployContract(deployer, getContractFactory, "ERC20Test", "Nature-based Carbon", "NBC",  { ...overrides }),
    mockAsset2: await deployContract(deployer, getContractFactory, "ERC20Test", "Cookstove Carbon", "CSC", { ...overrides })

  };

  return [
    {
      ...addresses,
      kumoFaucet: await deployContract(
        deployer,
        getContractFactory,
        "KumoFaucet",
        addresses.mockAsset1,
        addresses.mockAsset2,
        { ...overrides }
      ),
      kusdToken: await deployContract(
        deployer,
        getContractFactory,
        "KUSDToken",
        addresses.troveManager,
        addresses.stabilityPoolFactory,
        addresses.borrowerOperations,
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
    defaultPool,
    hintHelpers,
    priceFeed,
    sortedTroves,
    stabilityPoolFactory,
    gasPool,
    kumoParameters
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
      kumoParameters.setAddresses(activePool.address, defaultPool.address, gasPool.address,
      priceFeed.address,
      borrowerOperations.address,
      collSurplusPool.address,
      kusdToken.address,
      stabilityPoolFactory.address,
      sortedTroves.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      troveManager.setAddresses(
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
        kumoParameters.address,
        { ...overrides, nonce }
      ),

    nonce =>
      activePool.setAddresses(
        borrowerOperations.address,
        troveManager.address,
        stabilityPoolFactory.address,
        defaultPool.address,
        collSurplusPool.address,
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

const addMockAssetsToSystem = async (
  {
    troveManager,
    sortedTroves,
    stabilityPoolFactory,
    kumoParameters,
    borrowerOperations,
    kusdToken,
    stabilityPoolAsset1,
    stabilityPoolAsset2,
    mockAsset1,
    mockAsset2
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
    kumoParameters.address,
    mockAsset1.address
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
    kumoParameters.address,
    mockAsset2.address
  ),

    await stabilityPoolFactory.createNewStabilityPool(mockAsset2.address, stabilityPoolAsset2.address)

  await kumoParameters.setAsDefault(mockAsset2.address)
  await troveManager.addNewAsset(mockAsset2.address)
  await sortedTroves.addNewAsset(mockAsset2.address)


}


// // Mint token to each acccount / un-comment and only use for prototype server
// const mintMockAssets = async (signers: SignerWithAddress[], { mockAsset1, mockAsset2 }: _KumoContracts) => {
//   // await mockAsset1.mint((await signers[0].getAddress()), BigNumber.from("100000000000000000000000000000000000000"));
//   // await mockAsset2.mint((await signers[0].getAddress()), BigNumber.from("100000000000000000000000000000000000000"));
//   for (let i = 0; i < signers.length; ++i) {
//     if(i < 3) {
//       await mockAsset1.mint((await signers[i].getAddress()), BigNumber.from("100000000000000000000000000000000000000"));
//       await mockAsset2.mint((await signers[i].getAddress()), BigNumber.from("100000000000000000000000000000000000000"));
//     } else {
//       await mockAsset1.mint((await signers[i].getAddress()), BigNumber.from("50000000000000000000000"));
//       await mockAsset2.mint((await signers[i].getAddress()), BigNumber.from("50000000000000000000000"));
//     }
//   }
// };

// Mint token to each acccount
const mintMockAssets = async (signers: SignerWithAddress[], { mockAsset1, mockAsset2 }: _KumoContracts) => {
  for (let i = 0; i < signers.length; ++i) {
    await mockAsset1.mint((await signers[i].getAddress()), BigNumber.from("100000000000000000000"))
    await mockAsset2.mint((await signers[i].getAddress()), BigNumber.from("100000000000000000000"))
  }
};

export const deployAndSetupContracts = async (
  deployer: Signer,
  ethers: HardhatEthersHelpers,
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
    _priceFeedIsTestnet,
    _isDev,

    ...(await deployContracts(deployer, ethers, _priceFeedIsTestnet, overrides).then(
      async ([addresses, startBlock]) => ({
        startBlock,

        addresses: {
          ...addresses
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


  const kumoTokenDeploymentTime = await contracts.kusdToken.getDeploymentStartTime();
  // const bootstrapPeriod = await contracts.troveManager.BOOTSTRAP_PERIOD();
  const bootstrapPeriod = await contracts.kumoParameters.REDEMPTION_BLOCK_DAY();

  // log("Fast forward 15 days...")
  // await networkHelpers.time.increase(60 * 60 * 24 * 15);

  return {
    ...deployment,
    deploymentDate: kumoTokenDeploymentTime.toNumber() * 1000,
    bootstrapPeriod: bootstrapPeriod.toNumber()
  };
};
