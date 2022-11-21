const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const th = testHelpers.TestHelper
const dec = th.dec

const randAmountInWei = th.randAmountInWei
//const randAmountInGwei = th.randAmountInGwei

const ZERO_ADDRESS = th.ZERO_ADDRESS

contract('TroveManager', async accounts => {
  
  const bountyAddress = accounts[998]
  const lpRewardsAddress = accounts[999]

  let contracts 
  let priceFeed
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let hardhatTester
  let erc20
  let assetAddress1
  
  beforeEach(async () => {
    contracts = await deploymentHelper.deployKumoCore()
    const KUMOContracts = await deploymentHelper.deployKUMOContracts(bountyAddress, lpRewardsAddress)

    hardhatTester = await deploymentHelper.deployTesterContractsHardhat()
    erc20 = hardhatTester.erc20Asset1
    assetAddress1 = erc20.address
    
    kusdToken = contracts.kusdToken
    priceFeed = contracts.priceFeedTestnet
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = await deploymentHelper.getStabilityPoolByAsset(contracts, assetAddress1)
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
  
    kumoStaking = KUMOContracts.kumoStaking
    kumoToken = KUMOContracts.kumoToken
    communityIssuance = KUMOContracts.communityIssuance
    lockupContractFactory = KUMOContracts.lockupContractFactory

    await deploymentHelper.connectKUMOContracts(KUMOContracts)
    await deploymentHelper.connectCoreContracts(contracts, KUMOContracts)
    await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, contracts)
  })

  // --- Check accumulation from repeatedly applying rewards ---

  it("11 accounts with random coll. 1 liquidation. 10 accounts do Trove operations (apply rewards)", async () => {
    await borrowerOperations.openTrove(0, 0, accounts[99], { from: accounts[99], value: dec(100, 'ether') })
    await borrowerOperations.openTrove(0, dec(170, 18), accounts[0], { from: accounts[0], value: dec(1, 'ether') })

    await th.openTrove_allAccounts_randomETH(1, 2, accounts.slice(1, 10), contracts, dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 10)) {
      borrowerOperations.addColl(account, account, { from: account, value: 1 })
    }

    await borrowerOperations.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })
    
    // check DefaultPool
    const ETH_DefaultPool = await defaultPool.getETH()
    const KUSDDebt_DefaultPool = await defaultPool.getKUSDDebt()
    console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
    console.log(`KUSDDebt left in Default Pool is: ${KUSDDebt_DefaultPool}`)
  })

  /* ABDK64, no error correction:
    ETH left in Default Pool is: 34
    KUSDDebt left in Default Pool is: 98

    DeciMath, no error correction:
    ETH left in Default Pool is: 7
    KUSDDebt left in Default Pool is: 37

    Pure division, no correction for rewards:
    ETH left in Default Pool is: 52
    KUSDDebt left in Default Pool is: 96
  */

  it("101 accounts with random coll. 1 liquidation. 100 accounts do a Trove operation (apply rewards)", async () => {
    await borrowerOperations.openTrove(0, 0, accounts[999], { from: accounts[999], value: dec(1000, 'ether') })
    await borrowerOperations.openTrove(0, dec(170, 18), accounts[0], { from: accounts[0], value: dec(1, 'ether') })

    await th.openTrove_allAccounts_randomETH(1, 2, accounts.slice(1, 100), contracts, dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 100)) {
      borrowerOperations.addColl(account, account, { from: account, value: 1 })
    }
   
    await borrowerOperations.addColl(accounts[999], accounts[999], { from: accounts[999], value: 1 })
    // check DefaultPool
    const ETH_DefaultPool = await defaultPool.getETH()
    const KUSDDebt_DefaultPool = await defaultPool.getKUSDDebt()
    console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
    console.log(`KUSDDebt left in Default Pool is: ${KUSDDebt_DefaultPool}`)
  })

  /* ABDK64, no error correction:
    ETH left in Default Pool is: 908
    KUSDDebt left in Default Pool is: 108

    DeciMath, no error correction:
    --Subtraction Overflow

    Pure division, no correction for rewards:
    ETH left in Default Pool is: 167
    KUSDDebt left in Default Pool is: 653
  */

  it("11 accounts. 1 liquidation. 10 accounts do Trove operations (apply rewards)", async () => {
    await borrowerOperations.openTrove(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })

    await th.openTrove_allAccounts(accounts.slice(0, 10), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 10)) {
      borrowerOperations.addColl(account, account, { from: account, value: 1 })
    }

    await borrowerOperations.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })
    // check DefaultPool
    const ETH_DefaultPool = await defaultPool.getETH()
    const KUSDDebt_DefaultPool = await defaultPool.getKUSDDebt()
    console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
    console.log(`KUSDDebt left in Default Pool is: ${KUSDDebt_DefaultPool}`)
  })
  
  /* ABDK64, no error correction:
    ETH left in Default Pool is: 64
    KUSDDebt left in Default Pool is: 75 
    
    DeciMath, no error correction:
    --Subtraction Overflow

    Pure division, no correction:
    ETH left in Default Pool is: 64
    KUSDDebt left in Default Pool is: 75
  */

  it("101 accounts. 1 liquidation. 100 accounts do Trove operations (apply rewards)", async () => {
    await borrowerOperations.openTrove(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })

    await th.openTrove_allAccounts(accounts.slice(0, 99), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 99)) {
      borrowerOperations.addColl(account, account, { from: account, value: 1 })
    }
    await borrowerOperations.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })

    // check DefaultPool
    const ETH_DefaultPool = await defaultPool.getETH()
    const KUSDDebt_DefaultPool = await defaultPool.getKUSDDebt()
    console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
    console.log(`KUSDDebt left in Default Pool is: ${KUSDDebt_DefaultPool}`)
  })
  
  /* ABDK64, no error correction:
    ETH left in Default Pool is: 100
    KUSDDebt left in Default Pool is: 180 
    
    DeciMath, no error correction:
    --Subtraction Overflow

    Pure division, no correction:
    ETH left in Default Pool is: 100
    KUSDDebt left in Default Pool is: 180
  */

  it("1001 accounts. 1 liquidation. 1000 accounts do Trove operations (apply rewards)", async () => {
    await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })

    await th.openTrove_allAccounts(accounts.slice(0, 999), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 999)) {
      borrowerOperations.addColl(account, account, { from: account, value: 1 })
    }
    await borrowerOperations.addColl(accounts[999], accounts[999], { from: accounts[999], value: 1 })

    // check DefaultPool
    const ETH_DefaultPool = await defaultPool.getETH()
    const KUSDDebt_DefaultPool = await defaultPool.getKUSDDebt()
    console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
    console.log(`KUSDDebt left in Default Pool is: ${KUSDDebt_DefaultPool}:`)
  })

  /*
    ABDK64, no error correction:
    ETH left in Default Pool is: 1000
    KUSDDebt left in Default Pool is: 180: 
    
    DeciMath, no error correction:
    -- overflow

    Pure division, no correction:
    ETH left in Default Pool is: 1000
    KUSDDebt left in Default Pool is: 180:
  */

  // --- Error accumulation from repeated Liquidations  - pure distribution, empty SP  ---

  //  50 Troves added 
  //  1 whale, supports TCR
  //  price drops
  //  loop: Troves are liquidated. Coll and debt difference between (activePool - defaultPool) is

  it("11 accounts. 10 liquidations. Check (ActivePool - DefaultPool) differences", async () => {
    await borrowerOperations.openTrove(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })

    await th.openTrove_allAccounts(accounts.slice(0, 11), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    // Grab total active coll and debt before liquidations
    let totalETHPoolDifference = web3.utils.toBN(0)
    let totalKUSDDebtPoolDifference = web3.utils.toBN(0)

    for (account of accounts.slice(1, 11)) {
      const activePoolETH = await activePool.getETH()
      const activePoolKUSDDebt = await activePool.getKUSD()

      await troveManager.liquidate(account)

      const defaultPoolETH = await defaultPool.getETH()
      const defaultPoolKUSDDebt = await defaultPool.getKUSDDebt()

      totalETHPoolDifference.add(activePoolETH.sub(defaultPoolETH))
      totalKUSDDebtPoolDifference.add(activePoolKUSDDebt.sub(defaultPoolKUSDDebt))
    }
    
    console.log(`Accumulated ETH difference between Default and Active Pools is: ${totalETHPoolDifference}`)
    console.log(`Accumulated KUSDDebt difference between Active and Default Pools is: ${totalKUSDDebtPoolDifference}`)
  })
  
  /* ABDK64, no error correction
    Accumulated ETH difference between Default and Active Pools is: 0
    Accumulated KUSDDebt difference between Active and Default Pools is: 0
    
    DeciMath, no error correction:
    Accumulated ETH difference between Default and Active Pools is: 0
    Accumulated KUSDDebt difference between Active and Default Pools is: 0
    
    Pure division with correction:
    Accumulated ETH difference between Default and Active Pools is: 0
    Accumulated KUSDDebt difference between Active and Default Pools is: 0
  */

  it("11 accounts. 10 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
    await borrowerOperations.openTrove(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })

    await th.openTrove_allAccounts(accounts.slice(0, 11), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 11)) {
      await troveManager.liquidate(account)
    }

    const L_ETH = await troveManager.L_ETH()
    const L_KUSDDebt = await troveManager.L_KUSDDebt()

    const totalColl = await activePool.getETH()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalETHRewards = (totalColl.mul(L_ETH)).div(_1e18_BN)
    const totalKUSDRewards = (totalColl.mul(L_KUSDDebt)).div(_1e18_BN)

    const defaultPoolETH = await defaultPool.getETH()
    const defaultPoolKUSDDebt = await defaultPool.getKUSDDebt()

    const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards)
    const KUSDDebtRewardDifference = defaultPoolKUSDDebt.sub(totalKUSDRewards)

    console.log(`ETH difference between total pending rewards and DefaultPool: ${ETHRewardDifference} `)
    console.log(`KUSDDebt difference between total pending rewards and DefaultPool: ${KUSDDebtRewardDifference} `)
  })

  /* ABDK64, no error correction:
    ETH difference between total pending rewards and DefaultPool: 700
    KUSDDebt difference between total pending rewards and DefaultPool: 800

    ABDK64 WITH correction:
    ETH difference between total pending rewards and DefaultPool: 300
    KUSDDebt difference between total pending rewards and DefaultPool: 400
    
    DeciMath, no error correction:
    ETH difference between total pending rewards and DefaultPool: -100
    KUSDDebt difference between total pending rewards and DefaultPool: -200

    Pure division with correction: 
    ETH difference between total pending rewards and DefaultPool: 0
    KUSDDebt difference between total pending rewards and DefaultPool: 0
  */

  it("101 accounts. 100 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
    await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })

    await th.openTrove_allAccounts(accounts.slice(0, 101), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 101)) {
      await troveManager.liquidate(account)
    }

    const L_ETH = await troveManager.L_ETH()
    const L_KUSDDebt = await troveManager.L_KUSDDebt()

    const totalColl = await activePool.getETH()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalETHRewards = (totalColl.mul(L_ETH)).div(_1e18_BN)
    const totalKUSDRewards = (totalColl.mul(L_KUSDDebt)).div(_1e18_BN)

    const defaultPoolETH = await defaultPool.getETH()
    const defaultPoolKUSDDebt = await defaultPool.getKUSDDebt()

    const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards)
    const KUSDDebtRewardDifference = defaultPoolKUSDDebt.sub(totalKUSDRewards)

    console.log(`ETH difference between total pending rewards and DefaultPool: ${ETHRewardDifference} `)
    console.log(`KUSDDebt difference between total pending rewards and DefaultPool: ${KUSDDebtRewardDifference} `)
  })
  
  /* ABDK64, no error correction:
    ETH difference between total pending rewards and DefaultPool: 51000
    KUSDDebt difference between total pending rewards and DefaultPool: 55000
    
    ABDK64 WITH correction:
    ETH difference between total pending rewards and DefaultPool: 31000
    KUSDDebt difference between total pending rewards and DefaultPool: 31000

    DeciMath, no error correction:
    ETH difference between total pending rewards and DefaultPool: 2000
    KUSDDebt difference between total pending rewards and DefaultPool: -2000
    
    Pure division with correction:
    ETH difference between total pending rewards and DefaultPool: 0
    KUSDDebt difference between total pending rewards and DefaultPool: 0
  */

 it("11 accounts with random ETH and proportional KUSD (180:1). 10 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
  await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })

  await th.openTrove_allAccounts_randomETH_ProportionalKUSD(1, 2, accounts.slice(0, 11), contracts, 180)

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 11)) {
      await troveManager.liquidate(account)

    }
    const L_ETH = await troveManager.L_ETH()
    const L_KUSDDebt = await troveManager.L_KUSDDebt()

    const totalColl = await activePool.getETH()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalETHRewards = (totalColl.mul(L_ETH)).div(_1e18_BN)
    const totalKUSDRewards = (totalColl.mul(L_KUSDDebt)).div(_1e18_BN)

    const defaultPoolETH = await defaultPool.getETH()
    const defaultPoolKUSDDebt = await defaultPool.getKUSDDebt()

    const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards)
    const KUSDDebtRewardDifference = defaultPoolKUSDDebt.sub(totalKUSDRewards)

    console.log(`ETH difference between total pending rewards and DefaultPool: ${ETHRewardDifference} `)
    console.log(`KUSDDebt difference between total pending rewards and DefaultPool: ${KUSDDebtRewardDifference} `)
  })

  /* ABDK64, no error correction:
    ETH difference between total pending rewards and DefaultPool: 4500
    KUSDDebt difference between total pending rewards and DefaultPool: 8000

    ABDK64 WITH correction:
    ETH difference between total pending rewards and DefaultPool: 300
    KUSDDebt difference between total pending rewards and DefaultPool: 300
      
    DeciMath, no error correction:
    ETH difference between total pending rewards and DefaultPool: 0
    KUSDDebt difference between total pending rewards and DefaultPool: -200

    Pure division with correction:
    ETH difference between total pending rewards and DefaultPool: 100
    KUSDDebt difference between total pending rewards and DefaultPool: 100
  */

  it("101 accounts with random ETH and proportional KUSD (180:1). 100 liquidations. Check 1) (DefaultPool - totalDistributionRewards) difference, and 2) ", async () => {
    await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })

    await th.openTrove_allAccounts_randomETH_ProportionalKUSD(1, 2, accounts.slice(0, 101), contracts, 180)

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    for (account of accounts.slice(1, 101)) {
      await troveManager.liquidate(account)
    }

    // check (DefaultPool  - totalRewards)
    const L_ETH = await troveManager.L_ETH()
    const L_KUSDDebt = await troveManager.L_KUSDDebt()

    const totalColl = await activePool.getETH()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalETHRewards = (totalColl.mul(L_ETH)).div(_1e18_BN)
    const totalKUSDRewards = (totalColl.mul(L_KUSDDebt)).div(_1e18_BN)

    const defaultPoolETH = await defaultPool.getETH()
    const defaultPoolKUSDDebt = await defaultPool.getKUSDDebt()

    const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards)
    const KUSDDebtRewardDifference = defaultPoolKUSDDebt.sub(totalKUSDRewards)

    console.log(`ETH difference between total pending rewards and DefaultPool: ${ETHRewardDifference} `)
    console.log(`KUSDDebt difference between total pending rewards and DefaultPool: ${KUSDDebtRewardDifference} `)
  })

  /* ABDK64, no error correction:
    ETH difference between total pending rewards and DefaultPool: 53900
    KUSDDebt difference between total pending rewards and DefaultPool: 61000

    ABDK64 WITH correction:
    ETH difference between total pending rewards and DefaultPool: 31300
    KUSDDebt difference between total pending rewards and DefaultPool: 30000
    
    DeciMath, no error correction:
    ETH difference between total pending rewards and DefaultPool: -4300
    KUSDDebt difference between total pending rewards and DefaultPool: -8000
  
    Pure division with correction:
    ETH difference between total pending rewards and DefaultPool: 400
    KUSDDebt difference between total pending rewards and DefaultPool: 1000
  */

  // --- Error accumulation from repeated Liquidations - SP Pool, partial offsets  ---

  it("11 accounts. 10 liquidations, partial offsets. Check (DefaultPool - totalRewards) differences", async () => {
   // Acct 99 opens trove with 100 KUSD
    await borrowerOperations.openTrove(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })
    await borrowerOperations.withdrawKUSD(0, dec(100, 18), accounts[99], {from: accounts[99]})
    
    await th.openTrove_allAccounts(accounts.slice(0, 11), contracts, dec(1, 'ether'), dec(170, 18))

    await priceFeed.setPrice(dec(100, 18))
    await troveManager.liquidate(accounts[0])

    // On loop: Account[99] adds 10 KUSD to pool -> a trove gets liquidated and partially offset against SP, emptying the SP
    for (account of accounts.slice(1, 11)) {
      await stabilityPool.provideToSP(dec(10, 18), ZERO_ADDRESS, {from: account[99]})
      await troveManager.liquidate(account)
    }
    // check (DefaultPool - totalRewards from distribution)
    const L_ETH = await troveManager.L_ETH()
    const L_KUSDDebt = await troveManager.L_KUSDDebt()

    const totalColl = await activePool.getETH()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalETHRewards_Distribution = (totalColl.mul(L_ETH)).div(_1e18_BN)
    const totalKUSDRewards_Distribution = (totalColl.mul(L_KUSDDebt)).div(_1e18_BN)

    const defaultPoolETH = await defaultPool.getETH()
    const defaultPoolKUSDDebt = await defaultPool.getKUSDDebt()

    const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards_Distribution)
    const KUSDDebtRewardDifference = defaultPoolKUSDDebt.sub(totalKUSDRewards_Distribution)

    console.log(`ETH difference between total pending distribution rewards and DefaultPool: ${ETHRewardDifference} `)
    console.log(`KUSDDebt difference between total pending distribution rewards and DefaultPool: ${KUSDDebtRewardDifference} `)
  })

  /* ABDK64, no error correction
    ETH difference between total pending distribution rewards and DefaultPool: 550
    KUSDDebt difference between total pending distribution rewards and DefaultPool: 600
    
    DeciMath, no error correction:
    ETH difference between total pending distribution rewards and DefaultPool: 150
    KUSDDebt difference between total pending distribution rewards and DefaultPool: -200
    
    Pure division with error correction:
    ETH difference between total pending distribution rewards and DefaultPool: 50
    KUSDDebt difference between total pending distribution rewards and DefaultPool: 0
  */

  it("101 accounts. 100 liquidations, partial offsets. Check (DefaultPool - totalRewards) differences", async () => {
    // Acct 99 opens trove with 100 KUSD
     await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })
     await borrowerOperations.withdrawKUSD(0, dec(100, 18), accounts[999], {from: accounts[999]})
     
     await th.openTrove_allAccounts(accounts.slice(0, 101), contracts, dec(1, 'ether'), dec(170, 18))
 
     await priceFeed.setPrice(dec(100, 18))
     await troveManager.liquidate(accounts[0])
 
     // On loop: Account[99] adds 10 KUSD to pool -> a trove gets liquidated and partially offset against SP, emptying the SP
     for (account of accounts.slice(1, 101)) {
       await stabilityPool.provideToSP(dec(10, 18),ZERO_ADDRESS, {from: account[99]})
       await troveManager.liquidate(account)
     }
     // check (DefaultPool - totalRewards from distribution)
     const L_ETH = await troveManager.L_ETH()
     const L_KUSDDebt = await troveManager.L_KUSDDebt()
 
     const totalColl = await activePool.getETH()
 
     const _1e18_BN = web3.utils.toBN(dec(1, 18))
     const totalETHRewards_Distribution = (totalColl.mul(L_ETH)).div(_1e18_BN)
     const totalKUSDRewards_Distribution = (totalColl.mul(L_KUSDDebt)).div(_1e18_BN)
 
     const defaultPoolETH = await defaultPool.getETH()
     const defaultPoolKUSDDebt = await defaultPool.getKUSDDebt()
 
     const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards_Distribution)
     const KUSDDebtRewardDifference = defaultPoolKUSDDebt.sub(totalKUSDRewards_Distribution)
 
     console.log(`ETH difference between total pending distribution rewards and DefaultPool: ${ETHRewardDifference} `)
     console.log(`KUSDDebt difference between total pending distribution rewards and DefaultPool: ${KUSDDebtRewardDifference} `)
   })

  /* ABDK64, no error correction
    ETH difference between total pending distribution rewards and DefaultPool: 7600 
    KUSDDebt difference between total pending distribution rewards and DefaultPool: 8900
    
    DeciMath, no error correction:
    ETH difference between total pending distribution rewards and DefaultPool: -700
    KUSDDebt difference between total pending distribution rewards and DefaultPool: 200
    
    Pure division with error correction:
    ETH difference between total pending distribution rewards and DefaultPool: 0
    KUSDDebt difference between total pending distribution rewards and DefaultPool: 0
  */

  // --- Error accumulation from SP withdrawals ---

  it("11 accounts. 10 Borrowers add to SP. 1 liquidation, 10 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens trove with 100 KUSD
     await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })
     await borrowerOperations.withdrawKUSD(0, dec(100, 18), accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a trove
     await borrowerOperations.openTrove(0, dec(100, 18), accounts[0],{from: accounts[0], value: dec(1, 'ether')})

     // 9 Accounts open troves and provide to SP
     await th.openTrove_allAccounts(accounts.slice(1, 11), contracts, dec(1, 'ether'), dec(100, 18))
     await th.provideToSP_allAccounts(accounts.slice(1,11), stabilityPool, dec(50, 18))
     
     await priceFeed.setPrice(dec(100, 18))
     await troveManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     for (account of accounts.slice(2, 11)) {
       await stabilityPool.withdrawFromSP(dec(50, 18), {from: account})
     }

    /* Sometimes, the error causes the last KUSD withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = dec(100, 18)
    await stabilityPool.provideToSP(whaleSPDeposit,ZERO_ADDRESS, {from: accounts[999]} )
    
    await stabilityPool.withdrawFromSP(dec(50, 18), {from: accounts[1]} )
    const SP_ETH = await stabilityPool.getETH()
    const SP_KUSD = await stabilityPool.getTotalKUSDDeposits()  

    const SP_KUSD_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_KUSD)

     // check Stability Pool
    console.log(`Surplus ETH left in in Stability Pool is ${SP_ETH}`)
    console.log(`KUSD insufficiency in Stability Pool is ${SP_KUSD_Insufficiency}`)
   })

   /* ABDK64, no error correction
      Sometimes subtraction overflows on last withdrawal from SP - error leaves insufficient KUSD in Pool.
      Noticed when reward shares are recurring fractions.

      Error in ETH gain accumulates in the Pool.
      Surplus ETH left in in Stability Pool is 530
      KUSD insufficiency in Stability Pool is 530
      
      DeciMath, no error correction:
      Surplus ETH left in in Stability Pool is 0
      KUSD insufficiency in Stability Pool is 0

      Pure division with error correction:
      Surplus ETH left in in Stability Pool is 0
      KUSD insufficiency in Stability Pool is 0
    */

   it("101 accounts. 100 Borrowers add to SP. 1 liquidation, 100 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens trove with 100 KUSD
     await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })
     await borrowerOperations.withdrawKUSD(0, dec(100, 18), accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a trove
     await borrowerOperations.openTrove(0, dec(100, 18), accounts[0],{from: accounts[0], value: dec(1, 'ether')})

     // 10 Accounts open troves and provide to SP
     await th.openTrove_allAccounts(accounts.slice(1, 101), contracts, dec(1, 'ether'), dec(100, 18))
     await th.provideToSP_allAccounts(accounts.slice(1,101), stabilityPool, dec(50, 18))
     
     await priceFeed.setPrice(dec(100, 18))
     await troveManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     for (account of accounts.slice(2, 101)) {
       await stabilityPool.withdrawFromSP(dec(50, 18), {from: account})
     }

    /* Sometimes, the error causes the last KUSD withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = dec(100, 18)
    await stabilityPool.provideToSP(whaleSPDeposit,ZERO_ADDRESS, {from: accounts[999]} )
    
    await stabilityPool.withdrawFromSP(dec(50, 18), {from: accounts[1]} )
    const SP_ETH = await stabilityPool.getETH()
    const SP_KUSD = await stabilityPool.getTotalKUSDDeposits()  

    const SP_KUSD_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_KUSD)

     // check Stability Pool
    console.log(`Surplus ETH left in in Stability Pool is ${SP_ETH}`)
    console.log(`KUSD insufficiency in Stability Pool is ${SP_KUSD_Insufficiency}`)
   })

   /* ABDK64, no error correction
    Surplus ETH left in in Stability Pool is 5300
    KUSD insufficiency in Stability Pool is 5300
      
    DeciMath, no error correction:
    Surplus ETH left in in Stability Pool is 0
    KUSD insufficiency in Stability Pool is 0

    Pure division with error correction:
    Surplus ETH left in in Stability Pool is 0
    KUSD insufficiency in Stability Pool is 0
   */

   it("11 accounts. 10 Borrowers add to SP, random KUSD amounts. 1 liquidation, 10 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens trove with 100 KUSD
     await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })
     await borrowerOperations.withdrawKUSD(0, dec(100, 18), accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a trove
     await borrowerOperations.openTrove(0, dec(100, 18), accounts[0],{from: accounts[0], value: dec(1, 'ether')})

     // 10 Accounts open troves and provide to SP
     await th.openTrove_allAccounts(accounts.slice(1, 11), contracts, dec(1, 'ether'), dec(100, 18))
     await th.th.provideToSP_allAccounts_randomAmount(10, 90, accounts.slice(2,11), stabilityPool)

     const account1SPDeposit = dec(50, 18)
     await stabilityPool.provideToSP(account1SPDeposit, ZERO_ADDRESS, {from: accounts[1]} )
     
     await priceFeed.setPrice(dec(100, 18))
     await troveManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     
     for (account of accounts.slice(2, 11)) {
       await stabilityPool.withdrawFromSP(dec(100, 18), {from: account})
     }

    /* Sometimes, the error causes the last KUSD withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = dec(100, 18)
    await stabilityPool.provideToSP(whaleSPDeposit, ZERO_ADDRESS, {from: accounts[999]} )
    
    await stabilityPool.withdrawFromSP(account1SPDeposit, {from: accounts[1]} )
    const SP_ETH = await stabilityPool.getETH()
    const SP_KUSD = await stabilityPool.getTotalKUSDDeposits()  

    const SP_KUSD_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_KUSD)

     // check Stability Pool
    console.log(`Surplus ETH left in in Stability Pool is ${SP_ETH}`)
    console.log(`KUSD insufficiency in Stability Pool is ${SP_KUSD_Insufficiency}`)
   })

   /* ABDK64, no error correction
      Sometimes subtraction overflows on last withdrawal from SP - error leaves insufficient KUSD in Pool.
      Noticed when reward shares are recurring fractions.

      Error in ETH gain accumulates in the Pool.
      Surplus ETH left in in Stability Pool is 84
      KUSD insufficiency in Stability Pool is 442

      DeciMath, no error correction:
      -- Subtraction Overflow

      Pure division with no error correction:
      Surplus ETH left in in Stability Pool is 366
      KUSD insufficiency in Stability Pool is 67

      Pure division with error correction:
      Surplus ETH left in in Stability Pool is 446
      KUSD insufficiency in Stability Pool is 507
    */

   it("101 accounts. 100 Borrowers add to SP, random KUSD amounts. 1 liquidation, 100 Borrowers withdraw all their SP funds", async () => {
    // Acct 99 opens trove with 100 KUSD
     await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(100, 'ether') })
     await borrowerOperations.withdrawKUSD(0, dec(100, 18), accounts[999], {from: accounts[999]})
     
     // Account 0 (to be liquidated) opens a trove
     await borrowerOperations.openTrove(0, dec(100, 18), accounts[0],{from: accounts[0], value: dec(1, 'ether')})

     // 100 Accounts open troves and provide to SP
     await th.openTrove_allAccounts(accounts.slice(1, 101), contracts, dec(1, 'ether'), dec(100, 18))
     await th.th.provideToSP_allAccounts_randomAmount(10, 90, accounts.slice(2,101), stabilityPool)

     const account1SPDeposit = dec(50, 18)
     await stabilityPool.provideToSP(account1SPDeposit,ZERO_ADDRESS, {from: accounts[1]} )
     
     await priceFeed.setPrice(dec(100, 18))
     await troveManager.liquidate(accounts[0])
 
     // All but one depositors withdraw their deposit
     for (account of accounts.slice(2, 101)) {
       await stabilityPool.withdrawFromSP(dec(100, 18), {from: account})
     }

    /* Sometimes, the error causes the last KUSD withdrawal from SP to underflow and fail. 
    So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
    const whaleSPDeposit = dec(100, 18)
    await stabilityPool.provideToSP(whaleSPDeposit,ZERO_ADDRESS, {from: accounts[999]} )
    
    await stabilityPool.withdrawFromSP(account1SPDeposit, {from: accounts[1]} )

    const SP_ETH = await stabilityPool.getETH()
    const SP_KUSD = await stabilityPool.getTotalKUSDDeposits()  

    const SP_KUSD_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_KUSD)

     // check Stability Pool
    console.log(`Surplus ETH left in in Stability Pool is ${SP_ETH}`)
    console.log(`KUSD insufficiency in Stability Pool is ${SP_KUSD_Insufficiency}`)
   })

   /* ABDK64, no error correction
    Surplus ETH left in in Stability Pool is 3321
    KUSD insufficiency in Stability Pool is 1112

    DeciMath, no error correction:
    Surplus ETH left in in Stability Pool is 1373
    KUSD insufficiency in Stability Pool is -13

    Pure division with no error correction:
    Surplus ETH left in in Stability Pool is 4087
    KUSD insufficiency in Stability Pool is 1960

    Pure division with error correction:
    Surplus ETH left in in Stability Pool is 3072
    KUSD insufficiency in Stability Pool is 452
  */ 

 it("501 accounts. 500 Borrowers add to SP, random KUSD amounts. 1 liquidation, 500 Borrowers withdraw all their SP funds", async () => {
  // Acct 99 opens trove with 100 KUSD
   await borrowerOperations.openTrove(0, 0, accounts[999], { from: accounts[999], value: dec(100, 'ether') })
   await borrowerOperations.withdrawKUSD(0, dec(100, 18), accounts[999], {from: accounts[999]})
   
   // Account 0 (to be liquidated) opens a trove
   await borrowerOperations.openTrove(0, dec(100, 18), accounts[0],{from: accounts[0], value: dec(1, 'ether')})

   // 500 Accounts open troves and provide to SP
   await th.openTrove_allAccounts(accounts.slice(1, 501), contracts, dec(1, 'ether'), dec(100, 18))
   await th.th.provideToSP_allAccounts_randomAmount(10, 90, accounts.slice(2,501), stabilityPool)

   const account1SPDeposit = dec(50, 18)
   await stabilityPool.provideToSP(account1SPDeposit, ZERO_ADDRESS, {from: accounts[1]} )
   
   await priceFeed.setPrice(dec(100, 18))
   await troveManager.liquidate(accounts[0])

   // All but one depositors withdraw their deposit
   for (account of accounts.slice(2, 501)) {
     await stabilityPool.withdrawFromSP(dec(100, 18), {from: account})
   }

  /* Sometimes, the error causes the last KUSD withdrawal from SP to underflow and fail. 
  So provideToSP from the whale, so that the last 'rewarded' depositor, account[1] can withdraw */
  const whaleSPDeposit = dec(100, 18)
  await stabilityPool.provideToSP(whaleSPDeposit,ZERO_ADDRESS, {from: accounts[999]} )
  
  await stabilityPool.withdrawFromSP(account1SPDeposit, {from: accounts[1]} )

  const SP_ETH = await stabilityPool.getETH()
  const SP_KUSD = await stabilityPool.getTotalKUSDDeposits()  

  const SP_KUSD_Insufficiency = web3.utils.toBN(whaleSPDeposit).sub(SP_KUSD)

   // check Stability Pool
  console.log(`Surplus ETH left in in Stability Pool is ${SP_ETH}`)
  console.log(`KUSD insufficiency in Stability Pool is ${SP_KUSD_Insufficiency}`)
 })

  /* ABDK64, no error correction:
    DeciMath, no error correction:
    Surplus ETH left in in Stability Pool is 2691
    KUSD insufficiency in Stability Pool is -8445

    Pure division, no correction:
    Surplus ETH left in in Stability Pool is 18708
    KUSD insufficiency in Stability Pool is 25427

    Pure division with error correction:
    Surplus ETH left in in Stability Pool is 1573
    KUSD insufficiency in Stability Pool is 6037
  */ 

 it("10 accounts. 10x liquidate -> addColl. Check stake and totalStakes (On-chain data vs off-chain simulation)", async () => {
  await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })
  await th.openTrove_allAccounts(accounts.slice(1, 11), contracts, dec(1, 'ether'), dec(170, 18))

  await priceFeed.setPrice(dec(100, 18))
 
  // Starting values for parallel off-chain computation
  let offchainTotalStakes = await troveManager.totalStakes()
  let offchainTotalColl = await activePool.getETH()
  let offchainStake = web3.utils.toBN(0)
  let stakeDifference = web3.utils.toBN(0)
  let totalStakesDifference = web3.utils.toBN(0)

  // Loop over account range, alternately liquidating a Trove and opening a new trove
  for (i = 1; i < 10; i++) {
    const stakeOfTroveToLiquidate = (await troveManager.Troves(accounts[i]))[2]
    
    const newEntrantColl = web3.utils.toBN(dec(2, 18))
    
    /* Off-chain computation of new stake.  
    Remove the old stake from total, calculate the new stake, add new stake to total. */
    offchainTotalStakes = offchainTotalStakes.sub(stakeOfTroveToLiquidate)
    offchainTotalColl = offchainTotalColl
    // New trove opening creates a new stake, then adds 
    offchainStake = (newEntrantColl.mul(offchainTotalStakes)).div(offchainTotalColl)
    offchainTotalStakes = offchainTotalStakes.add(offchainStake)
    offchainTotalColl = offchainTotalColl.add(newEntrantColl)
   
    // Liquidate Trove 'i', and open trove from account '999 - i'
    await troveManager.liquidate(accounts[i], {from: accounts[0]})
    await borrowerOperations.addColl(accounts[999 - i], accounts[999 - i], {from: accounts[999 - i], value: newEntrantColl })
  
    // Grab new stake and totalStakes on-chain
    const newStake = (await troveManager.Troves(accounts[999 - i]))[2] 
    const totalStakes = await troveManager.totalStakes()
    
    stakeDifference = offchainStake.sub(newStake)
    totalStakesDifference = offchainTotalStakes.sub(totalStakes)
  }

  console.log(`Final difference in the last stake made, between on-chain and actual: ${stakeDifference}`)
  console.log(`Final difference in the last totalStakes value, between on-chain and actual: ${totalStakesDifference}`)
})

/* ABDK64, no error correction:
  Final difference in the last stake made, between on-chain and actual: 0
  Final difference in the last totalStakes value, between on-chain and actual: 0

  Final difference in the last stake made, between on-chain and actual: 0
  Final difference in the last totalStakes value, between on-chain and actual: -7

  Pure integer division, no correction:
  Final difference in the last stake made, between on-chain and actual: 0
  Final difference in the last totalStakes value, between on-chain and actual: 0
*/

 it("10 accounts. 10x liquidate -> addColl. Random coll. Check stake and totalStakes (On-chain data vs off-chain simulation)", async () => {
  await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })
  await th.openTrove_allAccounts(accounts.slice(1, 11), contracts, dec(1, 'ether'), dec(170, 18))

  await priceFeed.setPrice(dec(100, 18))
 
  // Starting values for parallel off-chain computation
  let offchainTotalStakes = await troveManager.totalStakes()
  let offchainTotalColl = await activePool.getETH()
  let offchainStake = web3.utils.toBN(0)
  let stakeDifference = web3.utils.toBN(0)
  let totalStakesDifference = web3.utils.toBN(0)

  // Loop over account range, alternately liquidating a Trove and opening a new trove
  for (i = 1; i < 10; i++) {
    const stakeOfTroveToLiquidate = (await troveManager.Troves(accounts[i]))[2]
    
    const newEntrantColl = web3.utils.toBN(randAmountInWei(1, 100))
    
    /* Off-chain computation of new stake.  
    Remove the old stake from total, calculate the new stake, add new stake to total. */
    offchainTotalStakes = offchainTotalStakes.sub(stakeOfTroveToLiquidate)
    offchainTotalColl = offchainTotalColl
    // New trove opening creates a new stake, then adds 
    offchainStake = (newEntrantColl.mul(offchainTotalStakes)).div(offchainTotalColl)
    offchainTotalStakes = offchainTotalStakes.add(offchainStake)
    offchainTotalColl = offchainTotalColl.add(newEntrantColl)
   
    // Liquidate Trove 'i', and open trove from account '999 - i'
    await troveManager.liquidate(accounts[i], {from: accounts[0]})
    await borrowerOperations.addColl(accounts[999 - i], accounts[999 - i], {from: accounts[999 - i], value: newEntrantColl })
  
    // Grab new stake and totalStakes on-chain
    const newStake = (await troveManager.Troves(accounts[999 - i]))[2] 
    const totalStakes = await troveManager.totalStakes()
    
    stakeDifference = offchainStake.sub(newStake)
    totalStakesDifference = offchainTotalStakes.sub(totalStakes)
  }

  console.log(`Final difference in the last stake made, between on-chain and actual: ${stakeDifference}`)
  console.log(`Final difference in the last totalStakes value, between on-chain and actual: ${totalStakesDifference}`)
})

/* ABDK64, no error correction:
  Final difference in the last stake made, between on-chain and actual: 2
  Final difference in the last totalStakes value, between on-chain and actual: 7

  DeciMath, no error correction:
  Final difference in the last stake made, between on-chain and actual: 8
  Final difference in the last totalStakes value, between on-chain and actual: -68

  Pure integer division, no correction:
  Final difference in the last stake made, between on-chain and actual: 0
  Final difference in the last totalStakes value, between on-chain and actual: 0
*/

it("100 accounts. 100x liquidate -> addColl. Random coll. Check stake and totalStakes (On-chain data vs off-chain simulation)", async () => {
  await borrowerOperations.openTrove(0, 0, accounts[999], { from: accounts[999], value: dec(1000, 'ether') })
  await th.openTrove_allAccounts(accounts.slice(1, 101), contracts, dec(1, 'ether'), dec(170, 18))

  await priceFeed.setPrice(dec(100, 18))
 
  // Starting values for parallel off-chain computation
  let offchainTotalStakes = await troveManager.totalStakes()
  let offchainTotalColl = await activePool.getETH()
  let offchainStake = web3.utils.toBN(0)
  let stakeDifference = web3.utils.toBN(0)
  let totalStakesDifference = web3.utils.toBN(0)

  // Loop over account range, alternately liquidating a Trove and opening a new trove
  for (i = 1; i < 100; i++) {
    const stakeOfTroveToLiquidate = (await troveManager.Troves(accounts[i]))[2]
    
    const newEntrantColl = web3.utils.toBN(randAmountInWei(12, 73422))
    
    /* Off-chain computation of new stake.  
    Remove the old stake from total, calculate the new stake, add new stake to total. */
    offchainTotalStakes = offchainTotalStakes.sub(stakeOfTroveToLiquidate)
    offchainTotalColl = offchainTotalColl
    // New trove opening creates a new stake, then adds 
    offchainStake = (newEntrantColl.mul(offchainTotalStakes)).div(offchainTotalColl)
    offchainTotalStakes = offchainTotalStakes.add(offchainStake)
    offchainTotalColl = offchainTotalColl.add(newEntrantColl)
   
    // Liquidate Trove 'i', and open trove from account '999 - i'
    await troveManager.liquidate(accounts[i], {from: accounts[0]})
    await borrowerOperations.addColl(accounts[999 - i], accounts[999 - i], {from: accounts[999 - i], value: newEntrantColl })
  
    // Grab new stake and totalStakes on-chain
    const newStake = (await troveManager.Troves(accounts[999 - i]))[2] 
    const totalStakes = await troveManager.totalStakes()
    
    stakeDifference = offchainStake.sub(newStake)
    totalStakesDifference = offchainTotalStakes.sub(totalStakes)
  }

  console.log(`Final difference in the last stake made, between on-chain and actual: ${stakeDifference}`)
  console.log(`Final difference in the last totalStakes value, between on-chain and actual: ${totalStakesDifference}`)
})

/* ABDK64, no error correction:
  Final difference in the last stake made, between on-chain and actual: 1
  Final difference in the last totalStakes value, between on-chain and actual: 321

  DeciMath, no error correction:
  Final difference in the last stake made, between on-chain and actual: -20
  Final difference in the last totalStakes value, between on-chain and actual: -138

  Pure integer division, no correction:
  Final difference in the last stake made, between on-chain and actual: 0
  Final difference in the last totalStakes value, between on-chain and actual: 0
*/

// --- Applied rewards, large coll and debt ---

it("11 accounts with random large coll, magnitude ~1e8 ether. 1 liquidation. 10 accounts do Trove operations (apply rewards)", async () => {
  await borrowerOperations.openTrove(0, 0,  accounts[99], { from: accounts[99], value: dec(100, 'ether') })
  await borrowerOperations.openTrove(0, dec(170, 18), accounts[0], { from: accounts[0], value: dec(1, 'ether') })

  // Troves open with 100-200 million ether
  await th.openTrove_allAccounts_randomETH(100000000, 200000000, accounts.slice(1, 10), contracts, dec(170, 18))

  await priceFeed.setPrice(dec(100, 18))

  await troveManager.liquidate(accounts[0])

  for (account of accounts.slice(1, 10)) {
    // apply rewards
    borrowerOperations.addColl(account, account, { from: account, value: 1 })
  }

  await borrowerOperations.addColl(accounts[99], accounts[99], { from: accounts[99], value: 1 })
  // check DefaultPool
  const ETH_DefaultPool = await defaultPool.getETH()
  const KUSDDebt_DefaultPool = await defaultPool.getKUSDDebt()
  console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
  console.log(`KUSDDebt left in Default Pool is: ${KUSDDebt_DefaultPool}`)
})

/* DeciMath:
  ETH left in Default Pool is: 563902502
  KUSDDebt left in Default Pool is: 308731912

  Pure division, correction:
  ETH left in Default Pool is: 1136050360
  KUSDDebt left in Default Pool is: 997601870

  Pure division, no correction:
  ETH left in Default Pool is: 810899932
  KUSDDebt left in Default Pool is: 535042995
*/

it("101 accounts with random large coll, magnitude ~1e8 ether. 1 liquidation. 500 accounts do a Trove operation (apply rewards)", async () => {
  await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(1000, 'ether') })
  await borrowerOperations.openTrove(0, dec(170, 18), accounts[0], { from: accounts[0], value: dec(1, 'ether') })

   // Troves open with 100-200 million ether
  await th.openTrove_allAccounts_randomETH(100000000, 200000000, accounts.slice(1, 100), contracts, dec(170, 18))

  await priceFeed.setPrice(dec(100, 18))

  await troveManager.liquidate(accounts[0])

  for (account of accounts.slice(1, 100)) {
    // apply rewards
    borrowerOperations.addColl(account, account, { from: account, value: 1 })
  }
 
  await borrowerOperations.addColl(accounts[999], accounts[999], { from: accounts[999], value: 1 })
  // check DefaultPool
  const ETH_DefaultPool = await defaultPool.getETH()
  const KUSDDebt_DefaultPool = await defaultPool.getKUSDDebt()
  console.log(`ETH left in Default Pool is: ${ETH_DefaultPool}`)
  console.log(`KUSDDebt left in Default Pool is: ${KUSDDebt_DefaultPool}`)
})

 /*
  Pure division, no correction:
  ETH left in Default Pool is: 8356761440
  KUSDDebt left in Default Pool is: 14696382412

  Pure division, correction:
  ETH left in Default Pool is: 9281255535
  KUSDDebt left in Default Pool is: 5854012464
  */

// --- Liquidations, large coll and debt ---

it("11 accounts with random ETH and proportional KUSD (180:1). 10 liquidations. Check (DefaultPool - totalRewards) differences", async () => {
  await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(1, 27) })

  // Troves open with 100-200 million ether and proportional KUSD Debt
  await th.openTrove_allAccounts_randomETH_ProportionalKUSD(100000000, 200000000, accounts.slice(0, 11), contracts, 180)

  await priceFeed.setPrice(dec(100, 18))

  await troveManager.liquidate(accounts[0])

  for (account of accounts.slice(1, 11)) {
    await troveManager.liquidate(account)
  }

  const L_ETH = await troveManager.L_ETH()
  const L_KUSDDebt = await troveManager.L_KUSDDebt()

  const totalColl = await activePool.getETH()

  const _1e18_BN = web3.utils.toBN(dec(1, 18))
  const totalETHRewards = (totalColl.mul(L_ETH)).div(_1e18_BN)
  const totalKUSDRewards = (totalColl.mul(L_KUSDDebt)).div(_1e18_BN)

  const defaultPoolETH = await defaultPool.getETH()
  const defaultPoolKUSDDebt = await defaultPool.getKUSDDebt()

  const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards)
  const KUSDDebtRewardDifference = defaultPoolKUSDDebt.sub(totalKUSDRewards)

  console.log(`ETH difference between total pending rewards and DefaultPool: ${ETHRewardDifference} `)
  console.log(`KUSDDebt difference between total pending rewards and DefaultPool: ${KUSDDebtRewardDifference} `)
})
 
/* 
  Pure division, no error correction:
  ETH difference between total pending rewards and DefaultPool: 9000000000
  KUSDDebt difference between total pending rewards and DefaultPool: 12000000000

  Pure division with correction:
  ETH difference between total pending rewards and DefaultPool: 1000000000
  KUSDDebt difference between total pending rewards and DefaultPool: 1000000000
  */

  it("101 accounts with random ETH and proportional KUSD (180:1). 100 liquidations. Check 1) (DefaultPool - totalDistributionRewards) difference, and 2) ", async () => {
    await borrowerOperations.openTrove(0, 0,  accounts[999], { from: accounts[999], value: dec(1, 28) })

    // Troves open with 100-200 million ether and proportional KUSD Debt
    await th.openTrove_allAccounts_randomETH_ProportionalKUSD(100000000, 200000000, accounts.slice(0, 101), contracts, 180)

    await priceFeed.setPrice(dec(100, 18))

    await troveManager.liquidate(accounts[0])

    // Grab total active coll and debt before liquidations
    for (account of accounts.slice(1, 101)) {
      await troveManager.liquidate(account)
    }

    // check (DefaultPool  - totalRewards)
    const L_ETH = await troveManager.L_ETH()
    const L_KUSDDebt = await troveManager.L_KUSDDebt()

    const totalColl = await activePool.getETH()

    const _1e18_BN = web3.utils.toBN(dec(1, 18))
    const totalETHRewards = (totalColl.mul(L_ETH)).div(_1e18_BN)
    const totalKUSDRewards = (totalColl.mul(L_KUSDDebt)).div(_1e18_BN)

    const defaultPoolETH = await defaultPool.getETH()
    const defaultPoolKUSDDebt = await defaultPool.getKUSDDebt()

    const ETHRewardDifference = defaultPoolETH.sub(totalETHRewards)
    const KUSDDebtRewardDifference = defaultPoolKUSDDebt.sub(totalKUSDRewards)

    console.log(`ETH difference between total pending rewards and DefaultPool: ${ETHRewardDifference} `)
    console.log(`KUSDDebt difference between total pending rewards and DefaultPool: ${KUSDDebtRewardDifference} `)
  })
  /*
    Pure division, no correction:
    ETH difference between total pending rewards and DefaultPool: 910000000000
    KUSDDebt difference between total pending rewards and DefaultPool: 870000000000

    Pure division with correction:
    ETH difference between total pending rewards and DefaultPool: 10000000000
    KUSDDebt difference between total pending rewards and DefaultPool: 10000000000
  */
})

  /* --- TODO:
 
 - Stakes computations. Errors occur in stake = totalColl/totalStakes.  
 
 Two contributions to accumulated error:

 -Truncation in division (-)
 -Previous error baked in to totalStakes, reducing the denominator (+)

 Test to see if error is stable or grows. 

  -----
  Findings with ABDK64 throughout:
  -----

  ABDK64:

  1) Reward applications accumulate ETH and KUSDDebt error in DefaultPool

  2) Liquidations accumulate ETH and KUSDDebt error in DefaultPool

  3) Liquidations with partial offset send slightly too little to StabilityPool, and redistribute slightly too much
  
  4) StabilityPool Withdrawals accumulate ETH error in the StabilityPool

  5) StabilityPool Withdrawals can accumulate kusdLoss in the StabilityPool (i.e. they distribute too much KUSD), and can block
  the final deposit withdrawal

  DeciMath:

  1) Lower error overall - 5-10x

  2) Similar noticable error accumulation

  3) Errors more likely to be negative, and cause subtraction overflows

  */
