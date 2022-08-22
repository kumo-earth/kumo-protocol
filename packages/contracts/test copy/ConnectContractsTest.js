const deploymentHelper = require("../utils/deploymentHelpers.js")

contract('Deployment script - Sets correct contract addresses dependencies after deployment', async accounts => {
  const [owner] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
  let priceFeed
  let kusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let functionCaller
  let borrowerOperations
  let kumoStaking
  let kumoToken
  let communityIssuance
  let lockupContractFactory
  let kumoParameters

  before(async () => {
    const coreContracts = await deploymentHelper.deployKumoCore()
    const KUMOContracts = await deploymentHelper.deployKUMOContracts(bountyAddress, lpRewardsAddress, multisig)

    priceFeed = coreContracts.priceFeedTestnet
    kusdToken = coreContracts.kusdToken
    sortedTroves = coreContracts.sortedTroves
    troveManager = coreContracts.troveManager
    activePool = coreContracts.activePool
    stabilityPool = coreContracts.stabilityPool
    defaultPool = coreContracts.defaultPool
    functionCaller = coreContracts.functionCaller
    borrowerOperations = coreContracts.borrowerOperations
    kumoParameters = coreContracts.kumoParameters

    kumoStaking = KUMOContracts.kumoStaking
    kumoToken = KUMOContracts.kumoToken
    communityIssuance = KUMOContracts.communityIssuance
    lockupContractFactory = KUMOContracts.lockupContractFactory

    await deploymentHelper.connectKUMOContracts(KUMOContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, KUMOContracts)
    await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, coreContracts)
  })

  it('Check if correct Addresses in Vault Parameters', async () => {
    assert.equal(priceFeed.address, await kumoParameters.priceFeed())
    assert.equal(activePool.address, await kumoParameters.activePool())
    assert.equal(defaultPool.address, await kumoParameters.defaultPool())
  })

  it('Sets the correct KUSDToken address in TroveManager', async () => {
    const kusdTokenAddress = kusdToken.address

    const recordedClvTokenAddress = await troveManager.kusdToken()

    assert.equal(kusdTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct SortedTroves address in TroveManager', async () => {
    const sortedTrovesAddress = sortedTroves.address

    const recordedSortedTrovesAddress = await troveManager.sortedTroves()

    assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress)
  })

  it('Sets the correct BorrowerOperations address in TroveManager', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await troveManager.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // StabilityPool in TroveM
  it('Sets the correct StabilityPool address in TroveManager', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddresss = await troveManager.stabilityPool()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddresss)
  })

  // KUMO Staking in TroveM
  it('Sets the correct KUMOStaking address in TroveManager', async () => {
    const kumoStakingAddress = kumoStaking.address

    const recordedKUMOStakingAddress = await troveManager.kumoStaking()
    assert.equal(kumoStakingAddress, recordedKUMOStakingAddress)
  })

  // Active Pool

  it('Sets the correct StabilityPool address in ActivePool', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await activePool.stabilityPoolAddress()

    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })

  it('Sets the correct DefaultPool address in ActivePool', async () => {
    const defaultPoolAddress = defaultPool.address

    const recordedDefaultPoolAddress = await activePool.defaultPoolAddress()

    assert.equal(defaultPoolAddress, recordedDefaultPoolAddress)
  })

  it('Sets the correct BorrowerOperations address in ActivePool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await activePool.borrowerOperationsAddress()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct TroveManager address in ActivePool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await activePool.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Stability Pool
  it('Sets the correct BorrowerOperations address in StabilityPool', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await stabilityPool.borrowerOperations()

    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct KUSDToken address in StabilityPool', async () => {
    const kusdTokenAddress = kusdToken.address

    const recordedClvTokenAddress = await stabilityPool.kusdToken()

    assert.equal(kusdTokenAddress, recordedClvTokenAddress)
  })

  it('Sets the correct TroveManager address in StabilityPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await stabilityPool.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Default Pool

  it('Sets the correct TroveManager address in DefaultPool', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await defaultPool.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  it('Sets the correct ActivePool address in DefaultPool', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await defaultPool.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  it('Sets the correct TroveManager address in SortedTroves', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await sortedTroves.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  it('Sets the correct BorrowerOperations address in SortedTroves', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await sortedTroves.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  //--- BorrowerOperations ---

  it('Sets the correct KumoParameters address in BorrowerOperations', async () => {
    assert.equal(kumoParameters.address, await borrowerOperations.kumoParams())
  })
  
  // TroveManager in BO
  it('Sets the correct TroveManager address in BorrowerOperations', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await borrowerOperations.troveManager()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // setSortedTroves in BO
  it('Sets the correct SortedTroves address in BorrowerOperations', async () => {
    const sortedTrovesAddress = sortedTroves.address

    const recordedSortedTrovesAddress = await borrowerOperations.sortedTroves()
    assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress)
  })

  // setActivePool in BO
  // ActivePool is set in KumoParameters
  // it('Sets the correct ActivePool address in BorrowerOperations', async () => {
  //   const activePoolAddress = activePool.address

  //   const recordedActivePoolAddress = await borrowerOperations.activePool()
  //   assert.equal(activePoolAddress, recordedActivePoolAddress)
  // })

  // KUMO Staking in BO
  it('Sets the correct KUMOStaking address in BorrowerOperations', async () => {
    const kumoStakingAddress = kumoStaking.address

    const recordedKUMOStakingAddress = await borrowerOperations.kumoStakingAddress()
    assert.equal(kumoStakingAddress, recordedKUMOStakingAddress)
  })


  // --- KUMO Staking ---

  // Sets KUMOToken in KUMOStaking
  it('Sets the correct KUMOToken address in KUMOStaking', async () => {
    const kumoTokenAddress = kumoToken.address

    const recordedKUMOTokenAddress = await kumoStaking.kumoToken()
    assert.equal(kumoTokenAddress, recordedKUMOTokenAddress)
  })

  // Sets ActivePool in KUMOStaking
  it('Sets the correct ActivePool address in KUMOStaking', async () => {
    const activePoolAddress = activePool.address

    const recordedActivePoolAddress = await kumoStaking.activePoolAddress()
    assert.equal(activePoolAddress, recordedActivePoolAddress)
  })

  // Sets KUSDToken in KUMOStaking
  it('Sets the correct ActivePool address in KUMOStaking', async () => {
    const kusdTokenAddress = kusdToken.address

    const recordedKUSDTokenAddress = await kumoStaking.kusdToken()
    assert.equal(kusdTokenAddress, recordedKUSDTokenAddress)
  })

  // Sets TroveManager in KUMOStaking
  it('Sets the correct ActivePool address in KUMOStaking', async () => {
    const troveManagerAddress = troveManager.address

    const recordedTroveManagerAddress = await kumoStaking.troveManagerAddress()
    assert.equal(troveManagerAddress, recordedTroveManagerAddress)
  })

  // Sets BorrowerOperations in KUMOStaking
  it('Sets the correct BorrowerOperations address in KUMOStaking', async () => {
    const borrowerOperationsAddress = borrowerOperations.address

    const recordedBorrowerOperationsAddress = await kumoStaking.borrowerOperationsAddress()
    assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress)
  })

  // ---  KUMOToken ---

  // Sets CI in KUMOToken
  it('Sets the correct CommunityIssuance address in KUMOToken', async () => {
    const communityIssuanceAddress = communityIssuance.address

    const recordedcommunityIssuanceAddress = await kumoToken.communityIssuanceAddress()
    assert.equal(communityIssuanceAddress, recordedcommunityIssuanceAddress)
  })

  // Sets KUMOStaking in KUMOToken
  it('Sets the correct KUMOStaking address in KUMOToken', async () => {
    const kumoStakingAddress = kumoStaking.address

    const recordedKUMOStakingAddress =  await kumoToken.kumoStakingAddress()
    assert.equal(kumoStakingAddress, recordedKUMOStakingAddress)
  })

  // Sets LCF in KUMOToken
  it('Sets the correct LockupContractFactory address in KUMOToken', async () => {
    const LCFAddress = lockupContractFactory.address

    const recordedLCFAddress =  await kumoToken.lockupContractFactory()
    assert.equal(LCFAddress, recordedLCFAddress)
  })

  // --- LCF  ---

  // Sets KUMOToken in LockupContractFactory
  it('Sets the correct KUMOToken address in LockupContractFactory', async () => {
    const kumoTokenAddress = kumoToken.address

    const recordedKUMOTokenAddress = await lockupContractFactory.kumoTokenAddress()
    assert.equal(kumoTokenAddress, recordedKUMOTokenAddress)
  })

  // --- CI ---

  // Sets KUMOToken in CommunityIssuance
  it('Sets the correct KUMOToken address in CommunityIssuance', async () => {
    const kumoTokenAddress = kumoToken.address

    const recordedKUMOTokenAddress = await communityIssuance.kumoToken()
    assert.equal(kumoTokenAddress, recordedKUMOTokenAddress)
  })

  it('Sets the correct StabilityPool address in CommunityIssuance', async () => {
    const stabilityPoolAddress = stabilityPool.address

    const recordedStabilityPoolAddress = await communityIssuance.stabilityPoolAddress()
    assert.equal(stabilityPoolAddress, recordedStabilityPoolAddress)
  })
})
