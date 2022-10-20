const SortedTroves = artifacts.require("./SortedTroves.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeedTestnet = artifacts.require("./PriceFeedTestnet.sol")
const KUSDToken = artifacts.require("./KUSDToken.sol")
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol")
const GasPool = artifacts.require("./GasPool.sol")
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol")
const FunctionCaller = artifacts.require("./TestContracts/FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")
const HintHelpers = artifacts.require("./HintHelpers.sol")

const KUMOStaking = artifacts.require("./KUMOStaking.sol")
const KUMOToken = artifacts.require("./KUMOToken.sol")
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")

const Unipool =  artifacts.require("./Unipool.sol")

const KUMOTokenTester = artifacts.require("./KUMOTokenTester.sol")
const CommunityIssuanceTester = artifacts.require("./CommunityIssuanceTester.sol")
const StabilityPoolTester = artifacts.require("./StabilityPoolTester.sol")
const ActivePoolTester = artifacts.require("./ActivePoolTester.sol")
const DefaultPoolTester = artifacts.require("./DefaultPoolTester.sol")
const KumoMathTester = artifacts.require("./KumoMathTester.sol")
const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const KUSDTokenTester = artifacts.require("./KUSDTokenTester.sol")

// Proxy scripts
const BorrowerOperationsScript = artifacts.require('BorrowerOperationsScript')
const BorrowerWrappersScript = artifacts.require('BorrowerWrappersScript')
const TroveManagerScript = artifacts.require('TroveManagerScript')
const StabilityPoolScript = artifacts.require('StabilityPoolScript')
const TokenScript = artifacts.require('TokenScript')
const KUMOStakingScript = artifacts.require('KUMOStakingScript')
const {
  buildUserProxies,
  BorrowerOperationsProxy,
  BorrowerWrappersProxy,
  TroveManagerProxy,
  StabilityPoolProxy,
  SortedTrovesProxy,
  TokenProxy,
  KUMOStakingProxy
} = require('../utils/proxyHelpers.js')

/* "Kumo core" consists of all contracts in the core Kumo system.

KUMO contracts consist of only those contracts related to the KUMO Token:

-the KUMO token
-the Lockup factory and lockup contracts
-the KUMOStaking contract
-the CommunityIssuance contract 
*/

const ZERO_ADDRESS = '0x' + '0'.repeat(40)
const maxBytes32 = '0x' + 'f'.repeat(64)

class DeploymentHelper {

  static async deployKumoCore() {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployKumoCoreHardhat()
    } else if (frameworkPath.includes("truffle")) {
      return this.deployKumoCoreTruffle()
    }
  }

  static async deployKUMOContracts(bountyAddress, lpRewardsAddress, multisigAddress) {
    const cmdLineArgs = process.argv
    const frameworkPath = cmdLineArgs[1]
    // console.log(`Framework used:  ${frameworkPath}`)

    if (frameworkPath.includes("hardhat")) {
      return this.deployKUMOContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress)
    } else if (frameworkPath.includes("truffle")) {
      return this.deployKUMOContractsTruffle(bountyAddress, lpRewardsAddress, multisigAddress)
    }
  }

  static async deployKumoCoreHardhat() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await this.deployAndInitContract(SortedTroves)
    const troveManager = await TroveManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await this.deployAndInitContract(StabilityPool)
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await this.deployAndInitContract(BorrowerOperations)
    const hintHelpers = await HintHelpers.new()
    const kusdToken = await KUSDToken.new(
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    KUSDToken.setAsDeployed(kusdToken)
    DefaultPool.setAsDeployed(defaultPool)
    PriceFeedTestnet.setAsDeployed(priceFeedTestnet)
    SortedTroves.setAsDeployed(sortedTroves)
    TroveManager.setAsDeployed(troveManager)
    ActivePool.setAsDeployed(activePool)
    StabilityPool.setAsDeployed(stabilityPool)
    GasPool.setAsDeployed(gasPool)
    CollSurplusPool.setAsDeployed(collSurplusPool)
    FunctionCaller.setAsDeployed(functionCaller)
    BorrowerOperations.setAsDeployed(borrowerOperations)
    HintHelpers.setAsDeployed(hintHelpers)

    const coreContracts = {
      priceFeedTestnet,
      kusdToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deployTesterContractsHardhat() {
    const testerContracts = {}

    // Contract without testers (yet)
    testerContracts.priceFeedTestnet = await PriceFeedTestnet.new()
    testerContracts.sortedTroves = await SortedTroves.new()
    // Actual tester contracts
    testerContracts.communityIssuance = await CommunityIssuanceTester.new()
    testerContracts.activePool = await ActivePoolTester.new()
    testerContracts.defaultPool = await DefaultPoolTester.new()
    testerContracts.stabilityPool = await StabilityPoolTester.new()
    testerContracts.gasPool = await GasPool.new()
    testerContracts.collSurplusPool = await CollSurplusPool.new()
    testerContracts.math = await KumoMathTester.new()
    testerContracts.borrowerOperations = await BorrowerOperationsTester.new()
    testerContracts.troveManager = await TroveManagerTester.new()
    testerContracts.functionCaller = await FunctionCaller.new()
    testerContracts.hintHelpers = await HintHelpers.new()
    testerContracts.kusdToken =  await KUSDTokenTester.new(
      testerContracts.troveManager.address,
      testerContracts.stabilityPool.address,
      testerContracts.borrowerOperations.address
    )
    return testerContracts
  }

  static async deployKUMOContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress) {
    const kumoStaking = await KUMOStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    KUMOStaking.setAsDeployed(kumoStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuance.setAsDeployed(communityIssuance)

    // Deploy KUMO Token, passing Community Issuance and Factory addresses to the constructor 
    const kumoToken = await KUMOToken.new(
      communityIssuance.address, 
      kumoStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    )
    KUMOToken.setAsDeployed(kumoToken)

    const KUMOContracts = {
      kumoStaking,
      lockupContractFactory,
      communityIssuance,
      kumoToken
    }
    return KUMOContracts
  }

  static async deployKUMOTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisigAddress) {
    const kumoStaking = await KUMOStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuanceTester.new()

    KUMOStaking.setAsDeployed(kumoStaking)
    LockupContractFactory.setAsDeployed(lockupContractFactory)
    CommunityIssuanceTester.setAsDeployed(communityIssuance)

    // Deploy KUMO Token, passing Community Issuance and Factory addresses to the constructor 
    const kumoToken = await KUMOTokenTester.new(
      communityIssuance.address, 
      kumoStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress,
      multisigAddress
    )
    KUMOTokenTester.setAsDeployed(kumoToken)

    const KUMOContracts = {
      kumoStaking,
      lockupContractFactory,
      communityIssuance,
      kumoToken
    }
    return KUMOContracts
  }

  static async deployKumoCoreTruffle() {
    const priceFeedTestnet = await PriceFeedTestnet.new()
    const sortedTroves = await SortedTroves.new()
    const troveManager = await TroveManager.new()
    const activePool = await ActivePool.new()
    const stabilityPool = await StabilityPool.new()
    const gasPool = await GasPool.new()
    const defaultPool = await DefaultPool.new()
    const collSurplusPool = await CollSurplusPool.new()
    const functionCaller = await FunctionCaller.new()
    const borrowerOperations = await BorrowerOperations.new()
    const hintHelpers = await HintHelpers.new()
    const kusdToken = await KUSDToken.new(
      troveManager.address,
      stabilityPool.address,
      borrowerOperations.address
    )
    const coreContracts = {
      priceFeedTestnet,
      kusdToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      gasPool,
      defaultPool,
      collSurplusPool,
      functionCaller,
      borrowerOperations,
      hintHelpers
    }
    return coreContracts
  }

  static async deployKUMOContractsTruffle(bountyAddress, lpRewardsAddress, multisigAddress) {
    const kumoStaking = await kumoStaking.new()
    const lockupContractFactory = await LockupContractFactory.new()
    const communityIssuance = await CommunityIssuance.new()

    /* Deploy KUMO Token, passing Community Issuance,  KUMOStaking, and Factory addresses 
    to the constructor  */
    const kumoToken = await KUMOToken.new(
      communityIssuance.address, 
      kumoStaking.address,
      lockupContractFactory.address,
      bountyAddress,
      lpRewardsAddress, 
      multisigAddress
    )

    const KUMOContracts = {
      kumoStaking,
      lockupContractFactory,
      communityIssuance,
      kumoToken
    }
    return KUMOContracts
  }

  static async deployKUSDToken(contracts) {
    contracts.kusdToken = await KUSDToken.new(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployKUSDTokenTester(contracts) {
    contracts.kusdToken = await KUSDTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    return contracts
  }

  static async deployProxyScripts(contracts, KUMOContracts, owner, users) {
    const proxies = await buildUserProxies(users)

    const borrowerWrappersScript = await BorrowerWrappersScript.new(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      KUMOContracts.kumoStaking.address
    )
    contracts.borrowerWrappers = new BorrowerWrappersProxy(owner, proxies, borrowerWrappersScript.address)

    const borrowerOperationsScript = await BorrowerOperationsScript.new(contracts.borrowerOperations.address)
    contracts.borrowerOperations = new BorrowerOperationsProxy(owner, proxies, borrowerOperationsScript.address, contracts.borrowerOperations)

    const troveManagerScript = await TroveManagerScript.new(contracts.troveManager.address)
    contracts.troveManager = new TroveManagerProxy(owner, proxies, troveManagerScript.address, contracts.troveManager)

    const stabilityPoolScript = await StabilityPoolScript.new(contracts.stabilityPool.address)
    contracts.stabilityPool = new StabilityPoolProxy(owner, proxies, stabilityPoolScript.address, contracts.stabilityPool)

    contracts.sortedTroves = new SortedTrovesProxy(owner, proxies, contracts.sortedTroves)

    const kusdTokenScript = await TokenScript.new(contracts.kusdToken.address)
    contracts.kusdToken = new TokenProxy(owner, proxies, kusdTokenScript.address, contracts.kusdToken)

    const kumoTokenScript = await TokenScript.new(KUMOContracts.kumoToken.address)
    KUMOContracts.kumoToken = new TokenProxy(owner, proxies, kumoTokenScript.address, KUMOContracts.kumoToken)

    const kumoStakingScript = await KUMOStakingScript.new(KUMOContracts.kumoStaking.address)
    KUMOContracts.kumoStaking = new KUMOStakingProxy(owner, proxies, kumoStakingScript.address, KUMOContracts.kumoStaking)
  }

  // Connect contracts to their dependencies
  static async connectCoreContracts(contracts, KUMOContracts) {

    // set TroveManager addr in SortedTroves
    await contracts.sortedTroves.setParams(
      maxBytes32,
      contracts.troveManager.address,
      contracts.borrowerOperations.address
    )

    // set contract addresses in the FunctionCaller 
    await contracts.functionCaller.setTroveManagerAddress(contracts.troveManager.address)
    await contracts.functionCaller.setSortedTrovesAddress(contracts.sortedTroves.address)

    // set contracts in the Trove Manager
    await contracts.troveManager.setAddresses(
      contracts.borrowerOperations.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.kusdToken.address,
      contracts.sortedTroves.address,
      KUMOContracts.kumoToken.address,
      KUMOContracts.kumoStaking.address
    )

    // set contracts in BorrowerOperations 
    await contracts.borrowerOperations.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.defaultPool.address,
      contracts.stabilityPool.address,
      contracts.gasPool.address,
      contracts.collSurplusPool.address,
      contracts.priceFeedTestnet.address,
      contracts.sortedTroves.address,
      contracts.kusdToken.address,
      KUMOContracts.kumoStaking.address
    )

    // set contracts in the Pools
    await contracts.stabilityPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
      contracts.kusdToken.address,
      contracts.sortedTroves.address,
      contracts.priceFeedTestnet.address,
      KUMOContracts.communityIssuance.address
    )

    await contracts.activePool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.stabilityPool.address,
      contracts.defaultPool.address
    )

    await contracts.defaultPool.setAddresses(
      contracts.troveManager.address,
      contracts.activePool.address,
    )

    await contracts.collSurplusPool.setAddresses(
      contracts.borrowerOperations.address,
      contracts.troveManager.address,
      contracts.activePool.address,
    )

    // set contracts in HintHelpers
    await contracts.hintHelpers.setAddresses(
      contracts.sortedTroves.address,
      contracts.troveManager.address
    )
  }

  static async connectKUMOContracts(KUMOContracts) {
    // Set KUMOToken address in LCF
    await KUMOContracts.lockupContractFactory.setKUMOTokenAddress(KUMOContracts.kumoToken.address)
  }

  static async connectKUMOContractsToCore(KUMOContracts, coreContracts) {
    await KUMOContracts.kumoStaking.setAddresses(
      KUMOContracts.kumoToken.address,
      coreContracts.kusdToken.address,
      coreContracts.troveManager.address, 
      coreContracts.borrowerOperations.address,
      coreContracts.activePool.address
    )
  
    await KUMOContracts.communityIssuance.setAddresses(
      KUMOContracts.kumoToken.address,
      coreContracts.stabilityPool.address
    )
  }

  static async connectUnipool(uniPool, KUMOContracts, uniswapPairAddr, duration) {
    await uniPool.setParams(KUMOContracts.kumoToken.address, uniswapPairAddr, duration)
  }

  static async deployAndInitContract(truffleFactory) {
    const contract = await truffleFactory.new();
    await contract.initialize();

    return contract;
  }
}
module.exports = DeploymentHelper
