// Truffle migration script for deployment to Ganache

const SortedTroves = artifacts.require("./SortedTroves.sol")
const ActivePool = artifacts.require("./ActivePool.sol")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const StabilityPool = artifacts.require("./StabilityPool.sol")
const TroveManager = artifacts.require("./TroveManager.sol")
const PriceFeed = artifacts.require("./PriceFeed.sol")
const KUSDToken = artifacts.require("./KUSDToken.sol")
const FunctionCaller = artifacts.require("./FunctionCaller.sol")
const BorrowerOperations = artifacts.require("./BorrowerOperations.sol")

const deploymentHelpers = require("../utils/truffleDeploymentHelpers.js")

const getAddresses = deploymentHelpers.getAddresses
const connectContracts = deploymentHelpers.connectContracts

module.exports = function(deployer) {
  deployer.deploy(BorrowerOperations)
  deployer.deploy(PriceFeed)
  deployer.deploy(SortedTroves)
  deployer.deploy(TroveManager)
  deployer.deploy(ActivePool)
  deployer.deploy(StabilityPool)
  deployer.deploy(DefaultPool)
  deployer.deploy(KUSDToken)
  deployer.deploy(FunctionCaller)

  deployer.then(async () => {
    const borrowerOperations = await BorrowerOperations.deployed()
    const priceFeed = await PriceFeed.deployed()
    const sortedTroves = await SortedTroves.deployed()
    const troveManager = await TroveManager.deployed()
    const activePool = await ActivePool.deployed()
    const stabilityPool = await StabilityPool.deployed()
    const defaultPool = await DefaultPool.deployed()
    const kusdToken = await KUSDToken.deployed()
    const functionCaller = await FunctionCaller.deployed()

    const liquityContracts = {
      borrowerOperations,
      priceFeed,
      kusdToken,
      sortedTroves,
      troveManager,
      activePool,
      stabilityPool,
      defaultPool,
      functionCaller
    }

    // Grab contract addresses
    const liquityAddresses = getAddresses(liquityContracts)
    console.log('deploy_contracts.js - Deployed contract addresses: \n')
    console.log(liquityAddresses)
    console.log('\n')

    // Connect contracts to each other
    await connectContracts(liquityContracts, liquityAddresses)
  })
}
