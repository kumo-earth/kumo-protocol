const SortedTroves = artifacts.require("./SortedTroves.sol");
const TroveManager = artifacts.require("./TroveManager.sol");
const TroveRedemptor = artifacts.require("./TroveRedemptor.sol");
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol");
const KUSDToken = artifacts.require("./KUSDToken.sol");
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol");
const GasPool = artifacts.require("./GasPool.sol");
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol");
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol");
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol");
const HintHelpers = artifacts.require("./HintHelpers.sol");
const StabilityPoolFactory = artifacts.require("./StabilityPoolFactory.sol");

const KUMOStaking = artifacts.require("./KUMOStaking.sol");
const KUMOToken = artifacts.require("./KUMOToken.sol");
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol");
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol");

const KumoParameters = artifacts.require("./KumoParameters.sol");

const Unipool = artifacts.require("./Unipool.sol");

const KUMOTokenTester = artifacts.require("./KUMOTokenTester.sol");
const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol");
const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol");
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol");
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol");
const KumoMathTester = artifacts.require("./KumoMathTester.sol");
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol");
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol");
const KUSDTokenTester = artifacts.require("./KUSDTokenTester.sol");
const ERC20Test = artifacts.require("./ERC20Test.sol");

// Proxy scripts
const BorrowerOperationsScript = artifacts.require("BorrowerOperationsScript");
const BorrowerWrappersScript = artifacts.require("BorrowerWrappersScript");
const TroveManagerScript = artifacts.require("TroveManagerScript");
const StabilityPoolScript = artifacts.require("StabilityPoolScript");
const TokenScript = artifacts.require("TokenScript");
const KUMOStakingScript = artifacts.require("KUMOStakingScript");
const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  TroveManagerProxy,
  StabilityPoolProxy,
  SortedTrovesProxy,
  TokenProxy,
  KUMOStakingProxy
} = require("../utils/proxyHelpers.js");

/* "Kumo core" consists of all contracts in the core Kumo system.

KUMO contracts consist of only those contracts related to the KUMO Token:

-the KUMO token
-the Lockup factory and lockup contracts
-the KUMOStaking contract
-the CommunityIssuance contract
*/

const ZERO_ADDRESS = "0x" + "0".repeat(40);
const maxBytes32 = "0x" + "f".repeat(64);

let Asset1Address;
let Asset2Address;

class DeploymentHelper {
  static async deployKumoCore() {
    const cmdLineArgs = process.argv;
    const frameworkPath = cmdLineArgs[1];
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployKumoCoreHardhat();
    } else if (frameworkPath.includes("truffle")) {
      return this.deployKumoCoreTruffle();
    }
  }

  static async deployKUMOContracts(bountyAddress, lpRewardsAddress, multisigAddress) {
    const cmdLineArgs = process.argv;
    const frameworkPath = cmdLineArgs[1];
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployKUMOContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress);
    } else if (frameworkPath.includes("truffle")) {
      return this.deployKUMOContractsTruffle(bountyAddress, lpRewardsAddress, multisigAddress);
    }
  }

  static async deployKumoCoreHardhat() {
    const priceFeedTestnet = await PriceFeedTestnet.new();
    const sortedTroves = await SortedTroves.new();
    const troveManager = await TroveManager.new();
    const troveRedemptor = await TroveRedemptor.new();
    const activePool = await ActivePool.new();
    // const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new();
    const defaultPool = await DefaultPool.new();
    const collSurplusPool = await CollSurplusPool.new();
    const functionCaller = await FunctionCaller.new();
    const borrowerOperations = await BorrowerOperations.new();
    const hintHelpers = await HintHelpers.new();
    const kumoParameters = await KumoParameters.new();
    const stabilityPoolFactory = await StabilityPoolFactory.new();
    const kusdToken = await KUSDToken.new(
      troveManager.address,
      stabilityPoolFactory.address,
      borrowerOperations.address
    );

    KUSDToken.setAsDeployed(kusdToken);
    DefaultPool.setAsDeployed(defaultPool);
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet);
    SortedTroves.setAsDeployed(sortedTroves);
    TroveManager.setAsDeployed(troveManager);
    ActivePool.setAsDeployed(activePool);
    // StabilityPool.setAsDeployed(stabilityPool)
    GasPool.setAsDeployed(gasPool);
    CollSurplusPool.setAsDeployed(collSurplusPool);
    FunctionCaller.setAsDeployed(functionCaller);
    BorrowerOperations.setAsDeployed(borrowerOperations);
    HintHelpers.setAsDeployed(hintHelpers);
    KumoParameters.setAsDeployed(kumoParameters);
    StabilityPoolFactory.setAsDeployed(stabilityPoolFactory);

    const coreContracts = {
      priceFeedTestnet,
      kusdToken,
      sortedTroves,
      troveManager,
      troveRedemptor,
      activePool,
      // stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers,
      kumoParameters,
      stabilityPoolFactory
    };
    return coreContracts;
  }

  static async deployTesterContractsHardhat() {
    const testerContracts = {};

    // Contract without testers (yet)
    testerContracts.priceFeedTestnet = await PriceFeedTestnet.new();
    testerContracts.sortedTroves = await SortedTroves.new();
    // Actual tester contracts
    testerContracts.communityIssuance = await CommunityIssuanceTester.new();
    testerContracts.activePool = await ActivePoolTester.new();
    testerContracts.defaultPool = await DefaultPoolTester.new();
    testerContracts.stabilityPool = await StabilityPoolTester.new();
    testerContracts.gasPool = await GasPool.new();
    testerContracts.collSurplusPool = await CollSurplusPool.new();
    testerContracts.math = await KumoMathTester.new();
    testerContracts.borrowerOperations = await BorrowerOperationsTester.new();
    testerContracts.troveManager = await TroveManagerTester.new();
    testerContracts.functionCaller = await FunctionCaller.new();
    testerContracts.hintHelpers = await HintHelpers.new();
    testerContracts.kumoParameters = await KumoParameters.new();
    testerContracts.erc20Asset1 = await ERC20Test.new();
    Asset1Address = testerContracts.erc20Asset1.address;
    testerContracts.erc20Asset2 = await ERC20Test.new();
    Asset2Address = testerContracts.erc20Asset2.address;
    testerContracts.stabilityPoolFactory = await StabilityPoolFactory.new();

    // await testerContracts.erc20.setDecimals(18);
    // ERC20Test.setAsDeployed(testerContracts.erc20);
    testerContracts.kusdToken = await KUSDTokenTester.new(
      testerContracts.troveManager.address,
      testerContracts.stabilityPoolFactory.address,
      testerContracts.borrowerOperations.address
    );
    return testerContracts;
  }

  static async deployKUMOContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress) {
    const kumoStaking = await KUMOStaking.new();
    const lockupContractFactory = await LockupContractFactory.new();
    const communityIssuance = await CommunityIssuance.new();

    KUMOStaking.setAsDeployed(kumoStaking);
    LockupContractFactory.setAsDeployed(lockupContractFactory);
    CommunityIssuance.setAsDeployed(communityIssuance);

    // Deploy KUMO Token, passing Community Issuance and Factory addresses to the constructor
    const kumoToken = await KUMOToken.new(
      communityIssuance.address,
      kumoStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    );
    KUMOToken.setAsDeployed(kumoToken);

    const KUMOContracts = {
      kumoStaking,
      lockupContractFactory,
      communityIssuance,
      kumoToken
    };
    return KUMOContracts;
  }

  static async deployKUMOTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress) {
    const kumoStaking = await KUMOStaking.new();
    const lockupContractFactory = await LockupContractFactory.new();
    const communityIssuance = await CommunityIssuanceTester.new();

    KUMOStaking.setAsDeployed(kumoStaking);
    LockupContractFactory.setAsDeployed(lockupContractFactory);
    CommunityIssuanceTester.setAsDeployed(communityIssuance);

    // Deploy KUMO Token, passing Community Issuance and Factory addresses to the constructor
    const kumoToken = await KUMOTokenTester.new(
      communityIssuance.address,
      kumoStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    );
    KUMOTokenTester.setAsDeployed(kumoToken);

    const KUMOContracts = {
      kumoStaking,
      lockupContractFactory,
      communityIssuance,
      kumoToken
    };
    return KUMOContracts;
  }

  // static async deployKumoCoreTruffle() {
  //   const priceFeedTestnet = await PriceFeedTestnet.new()
  //   const sortedTroves = await SortedTroves.new()
  //   const troveManager = await TroveManager.new()
  //   const activePool = await ActivePool.new()
  //   const stabilityPool = await StabilityPool.new()
  //   const gasPool = await GasPool.new()
  //   const defaultPool = await DefaultPool.new()
  //   const collSurplusPool = await CollSurplusPool.new()
  //   const functionCaller = await FunctionCaller.new()
  //   const borrowerOperations = await BorrowerOperations.new()
  //   const hintHelpers = await HintHelpers.new()
  //   const kusdToken = await KUSDToken.new(
  //     troveManager.address,
  //     stabilityPoolFactory.address,
  //     borrowerOperations.address
  //   )
  //   const coreContracts = {
  //     priceFeedTestnet,
  //     kusdToken,
  //     sortedTroves,
  //     troveManager,
  //     activePool,
  //     stabilityPool,
  //     gasPool,
  //     defaultPool,
  //     collSurplusPool,
  //     functionCaller,
  //     borrowerOperations,
  //     hintHelpers
  //   }
  //   return coreContracts
  // }

  // static async deployKUMOContractsTruffle(bountyAddress, lpRewardsAddress, multisigAddress) {
  //   const kumoStaking = await kumoStaking.new()
  //   const lockupContractFactory = await LockupContractFactory.new()
  //   const communityIssuance = await CommunityIssuance.new()

  //   /* Deploy KUMO Token, passing Community Issuance,  KUMOStaking, and Factory addresses
  //   to the constructor  */
  //   const kumoToken = await KUMOToken.new(
  //     communityIssuance.address,
  //     kumoStaking.address,
  //     lockupContractFactory.address,
  //     bountyAddress,
  //     lpRewardsAddress,
  //     multisigAddress
  //   )

  //   const KUMOContracts = {
  //     kumoStaking,
  //     lockupContractFactory,
  //     communityIssuance,
  //     kumoToken
  //   }
  //   return KUMOContracts
  // }

  static async deployKUSDToken(contracts) {
    contracts.kusdToken = await KUSDToken.new(
      contracts.troveManager.address,
      contracts.stabilityPoolFactory.address,
      contracts.borrowerOperations.address
    );
    return contracts;
  }

  static async deployKUSDTokenTester(contracts) {
    contracts.kusdToken = await KUSDTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPoolFactory.address,
      contracts.borrowerOperations.address
    );
    return contracts;
  }

  static async deployProxyScripts(contracts, KUMOContracts, owner, users) {
    const proxies = await buildUserProxies(users);

    const borrowerWrappersScript = await BorrowerWrappersScript.new(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      KUMOContracts.kumoStaking.address
    );
    contracts.borrowerWrappers = new BorrowerWrappersProxy(
      owner,
      proxies,
      borrowerWrappersScript.address
    );

    const borrowerOperationsScript = await BorrowerOperationsScript.new(
      contracts.borrowerOperations.address
    );
    contracts.borrowerOperations = new BorrowerOperationsProxy(
      owner,
      proxies,
      borrowerOperationsScript.address,
      contracts.borrowerOperations
    );

    const troveManagerScript = await TroveManagerScript.new(contracts.troveManager.address);
    contracts.troveManager = new TroveManagerProxy(
      owner,
      proxies,
      troveManagerScript.address,
      contracts.troveManager
    );

    const stabilityPoolScript = await StabilityPoolScript.new(
      contracts.stabilityPoolFactory.address
    );
    contracts.stabilityPool = new StabilityPoolProxy(
      owner,
      proxies,
      stabilityPoolScript.address,
      contracts.stabilityPool
    );

    contracts.sortedTroves = new SortedTrovesProxy(owner, proxies, contracts.sortedTroves);

    const kusdTokenScript = await TokenScript.new(contracts.kusdToken.address);
    contracts.kusdToken = new TokenProxy(
      owner,
      proxies,
      kusdTokenScript.address,
      contracts.kusdToken
    );

    const kumoTokenScript = await TokenScript.new(KUMOContracts.kumoToken.address);
    KUMOContracts.kumoToken = new TokenProxy(
      owner,
      proxies,
      kumoTokenScript.address,
      KUMOContracts.kumoToken
    );

    const kumoStakingScript = await KUMOStakingScript.new(KUMOContracts.kumoStaking.address);
    KUMOContracts.kumoStaking = new KUMOStakingProxy(
      owner,
      proxies,
      kumoStakingScript.address,
      KUMOContracts.kumoStaking
    );
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, KUMOContracts) {
    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      contracts.troveManager.address,
      contracts.borrowerOperations.address
    );

    // set contract addresses in the FunctionCaller
    await contracts.functionCaller.setTroveManagerAddress(contracts.troveManager.address);
    await contracts.functionCaller.setSortedTrovesAddress(contracts.sortedTroves.address);

    await contracts.kumoParameters.setAddresses(
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.priceFeedTestnet.address
    );

    // set contracts in the Trove Manager
    await contracts.troveManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.stabilityPoolFactory.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.kusdToken.address,
      contracts.sortedTroves.address,
      KUMOContracts.kumoToken.address,
      KUMOContracts.kumoStaking.address,
      contracts.kumoParameters.address,
      contracts.troveRedemptor.address
    );

    await contracts.troveRedemptor.setAddresses(
      contracts.troveManager.address,
      contracts.sortedTroves.address,
      contracts.stabilityPoolFactory.address,
      contracts.kusdToken.address,
      contracts.collSurplusPool.address,
      contracts.kumoParameters.address
    );

    // set contracts in BorrowerOperations
    await contracts.borrowerOperations.setAddresses(
      contracts.troveManager.address,
      contracts.stabilityPoolFactory.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.sortedTroves.address,
      contracts.kusdToken.address,
      KUMOContracts.kumoStaking.address,
      contracts.kumoParameters.address
    );

    // // set contracts in the Pools
    // await contracts.stabilityPool.setAddresses(
    //   Asset1Address,
    //   contracts.borrowerOperations.address,
    //   contracts.troveManager.address,
    //   contracts.kusdToken.address,
    //   contracts.sortedTroves.address,
    //   KUMOContracts.communityIssuance.address,
    //   contracts.kumoParameters.address
    // )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPoolFactory.address,
      contracts.defaultPool.address,
      contracts.collSurplusPool.address,
      KUMOContracts.kumoStaking.address
    );

    await contracts.defaultPool.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address
    );

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address
    );

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.sortedTroves.address,
      contracts.troveManager.address,
      contracts.kumoParameters.address
    );
  }

  static async connectKUMOContracts(KUMOContracts) {
    // Set KUMOToken address in LCF
    await KUMOContracts.lockupContractFactory.setKUMOTokenAddress(KUMOContracts.kumoToken.address);
  }

  static async connectKUMOContractsToCore(KUMOContracts, coreContracts) {
    // const treasurySig = await KUMOContracts.kumoToken.treasury();
    await KUMOContracts.kumoStaking.setAddresses(
      KUMOContracts.kumoToken.address,
      coreContracts.kusdToken.address,
      coreContracts.troveManager.address,
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address
      // treasurySig
    );

    await KUMOContracts.communityIssuance.setAddresses(
      KUMOContracts.kumoToken.address,
      coreContracts.stabilityPoolFactory.address
    );
  }

  static async connectUnipool(uniPool, KUMOContracts, uniswapPairAddr, duration) {
    await uniPool.setParams(KUMOContracts.kumoToken.address, uniswapPairAddr, duration);
  }

  static async mintMockAssets(erc20Asset, accounts, numberOfAccounts) {
    for (let index = 0; index < numberOfAccounts; index++) {
      await erc20Asset.mint(accounts[index], await web3.eth.getBalance(accounts[index]));
    }
  }

  static async addNewAssetToSystem(contracts, KUMOContracts, asset) {
    // Deoloy new stability pool contract
    const stabilityPool = await StabilityPool.new();

    // Set address in stability pool
    await stabilityPool.setAddresses(
      asset,
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.kusdToken.address,
      contracts.sortedTroves.address,
      KUMOContracts.communityIssuance.address,
      contracts.kumoParameters.address,
      contracts.troveRedemptor.address
    );

    // Add Stability Pool to the Stability Pool Factory
    contracts.stabilityPoolFactory.createNewStabilityPool(asset, stabilityPool.address);

    // Set initial values for the asset
    await contracts.kumoParameters.setAsDefault(asset);
    await contracts.troveManager.addNewAsset(asset);
    await contracts.sortedTroves.addNewAsset(asset);
  }

  static async getStabilityPoolByAsset(contracts, address) {
    const stabilityPoolAddress = await contracts.stabilityPoolFactory.getStabilityPoolByAsset(
      address
    );
    return await StabilityPool.at(stabilityPoolAddress);
  }

  static async deployERC20Asset() {
    return await ERC20Test.new();
  }
}

module.exports = DeploymentHelper;
