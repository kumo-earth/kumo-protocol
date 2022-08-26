const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js")
const { BNConverter } = require("../utils/BNConverter.js")
const testHelpers = require("../utils/testHelpers.js")

const KUMOStakingTester = artifacts.require('KUMOStakingTester')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const NonPayable = artifacts.require("./NonPayable.sol")

const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const dec = th.dec
const assertRevert = th.assertRevert

const toBN = th.toBN
const ZERO = th.toBN('0')

const GAS_PRICE = 10000000

/* NOTE: These tests do not test for specific ETH and KUSD gain values. They only test that the 
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake. 
 *
 * Specific ETH/KUSD gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the TroveManager, which are still TBD based on economic
 * modelling.
 * 
 */ 

contract('KUMOStaking revenue share tests', async accounts => {

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)
  
  const [owner, A, B, C, D, E, F, G, whale] = accounts;

  let priceFeed
  let kusdToken
  let sortedTroves
  let troveManager
  let activePool
  let stabilityPool
  let defaultPool
  let borrowerOperations
  let kumoStaking
  let kumoToken

  let contracts

  const openTrove = async (params) => th.openTrove(contracts, params)

  beforeEach(async () => {
    contracts = await deploymentHelper.deployKumoCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts = await deploymentHelper.deployKUSDTokenTester(contracts)
    const KUMOContracts = await deploymentHelper.deployKUMOTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)
    
    await deploymentHelper.connectKUMOContracts(KUMOContracts)
    await deploymentHelper.connectCoreContracts(contracts, KUMOContracts)
    await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, contracts)

    nonPayable = await NonPayable.new() 
    priceFeed = contracts.priceFeedTestnet
    kusdToken = contracts.kusdToken
    sortedTroves = contracts.sortedTroves
    troveManager = contracts.troveManager
    activePool = contracts.activePool
    stabilityPool = contracts.stabilityPool
    defaultPool = contracts.defaultPool
    borrowerOperations = contracts.borrowerOperations
    hintHelpers = contracts.hintHelpers

    kumoToken = KUMOContracts.kumoToken
    kumoStaking = KUMOContracts.kumoStaking
  })

  it('stake(): reverts if amount is zero', async () => {
    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), {from: multisig})

    // console.log(`A kumo bal: ${await kumoToken.balanceOf(A)}`)

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), {from: A})
    await assertRevert(kumoStaking.stake(0, {from: A}), "KUMOStaking: Amount must be non-zero")
  })

  it("ETH fee per KUMO staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), {from: multisig, gasPrice: GAS_PRICE})

    // console.log(`A kumo bal: ${await kumoToken.balanceOf(A)}`)

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), {from: A})
    await kumoStaking.stake(dec(100, 18), {from: A})

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await kumoStaking.F_ETH()
    assert.equal(F_ETH_Before, '0')

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), GAS_PRICE)
    
    const B_BalAfterRedemption = await kusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check ETH fee per unit staked has increased by correct amount
    const F_ETH_After = await kumoStaking.F_ETH()

    // Expect fee per unit staked = fee/100, since there is 100 KUSD totalStaked
    const expected_F_ETH_After = emittedETHFee.div(toBN('100')) 

    assert.isTrue(expected_F_ETH_After.eq(F_ETH_After))
  })

  it("ETH fee per KUMO staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale} })
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A} })
    await openTrove({ extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B} })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C} })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D} })

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), {from: multisig, gasPrice: GAS_PRICE})

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await kumoStaking.F_ETH()
    assert.equal(F_ETH_Before, '0')

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), GAS_PRICE)
    
    const B_BalAfterRedemption = await kusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3])
    assert.isTrue(emittedETHFee.gt(toBN('0')))

    // Check ETH fee per unit staked has not increased 
    const F_ETH_After = await kumoStaking.F_ETH()
    assert.equal(F_ETH_After, '0')
  })

  it("KUSD fee per KUMO staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({ extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), {from: A})
    await kumoStaking.stake(dec(100, 18), {from: A})

    // Check KUSD fee per unit staked is zero
    const F_KUSD_Before = await kumoStaking.F_ETH()
    assert.equal(F_KUSD_Before, '0')

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice= GAS_PRICE)
    
    const B_BalAfterRedemption = await kusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawKUSD(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(tx))
    assert.isTrue(emittedKUSDFee.gt(toBN('0')))
    
    // Check KUSD fee per unit staked has increased by correct amount
    const F_KUSD_After = await kumoStaking.F_KUSD()

    // Expect fee per unit staked = fee/100, since there is 100 KUSD totalStaked
    const expected_F_KUSD_After = emittedKUSDFee.div(toBN('100')) 

    assert.isTrue(expected_F_KUSD_After.eq(F_KUSD_After))
  })

  it("KUSD fee per KUMO staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({ extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), {from: multisig})

    // Check KUSD fee per unit staked is zero
    const F_KUSD_Before = await kumoStaking.F_ETH()
    assert.equal(F_KUSD_Before, '0')

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B)
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await kusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate()
    assert.isTrue(baseRate.gt(toBN('0')))

    // D draws debt
    const tx = await borrowerOperations.withdrawKUSD(th._100pct, dec(27, 18), D, D, {from: D})
    
    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(tx))
    assert.isTrue(emittedKUSDFee.gt(toBN('0')))
    
    // Check KUSD fee per unit staked did not increase, is still zero
    const F_KUSD_After = await kumoStaking.F_KUSD()
    assert.equal(F_KUSD_After, '0')
  })

  it("KUMO Staking: A single staker earns all ETH and KUMO fees that occur", async () => {
    await openTrove({ extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), {from: A})
    await kumoStaking.stake(dec(100, 18), {from: A})

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await kusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await kusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await kusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawKUSD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_1 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedKUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawKUSD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_2 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedKUSDFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)
    const expectedTotalKUSDGain = emittedKUSDFee_1.add(emittedKUSDFee_2)

    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_KUSDBalance_Before = toBN(await kusdToken.balanceOf(A))

    // A un-stakes
    const GAS_Used = th.gasUsed(await kumoStaking.unstake(dec(100, 18), {from: A, gasPrice: GAS_PRICE }))

    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_KUSDBalance_After = toBN(await kusdToken.balanceOf(A))


    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before).add(toBN(GAS_Used * GAS_PRICE))
    const A_KUSDGain = A_KUSDBalance_After.sub(A_KUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalKUSDGain, A_KUSDGain), 1000)
  })

  it("stake(): Top-up sends out all accumulated ETH and KUSD gains to the staker", async () => { 
    await openTrove({ extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), {from: A})
    await kumoStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await kusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await kusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await kusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawKUSD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_1 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedKUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawKUSD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_2 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedKUSDFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)
    const expectedTotalKUSDGain = emittedKUSDFee_1.add(emittedKUSDFee_2)

    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_KUSDBalance_Before = toBN(await kusdToken.balanceOf(A))

    // A tops up
    const GAS_Used = th.gasUsed(await kumoStaking.stake(dec(50, 18), {from: A, gasPrice: GAS_PRICE }))

    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_KUSDBalance_After = toBN(await kusdToken.balanceOf(A))

    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before).add(toBN(GAS_Used * GAS_PRICE))
    const A_KUSDGain = A_KUSDBalance_After.sub(A_KUSDBalance_Before)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedTotalKUSDGain, A_KUSDGain), 1000)
  })

  it("getPendingETHGain(): Returns the staker's correct pending ETH gain", async () => { 
    await openTrove({ extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), {from: A})
    await kumoStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await kusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await kusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await kusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    const expectedTotalETHGain = emittedETHFee_1.add(emittedETHFee_2)

    const A_ETHGain = await kumoStaking.getPendingETHGain(A)

    assert.isAtMost(th.getDifference(expectedTotalETHGain, A_ETHGain), 1000)
  })

  it("getPendingKUSDGain(): Returns the staker's correct pending KUSD gain", async () => { 
    await openTrove({ extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), {from: multisig})

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), {from: A})
    await kumoStaking.stake(dec(50, 18), {from: A})

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B)
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const B_BalAfterRedemption = await kusdToken.balanceOf(B)
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption))

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

    const C_BalBeforeREdemption = await kusdToken.balanceOf(C)
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(100, 18), gasPrice = GAS_PRICE)
    
    const C_BalAfterRedemption = await kusdToken.balanceOf(C)
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption))
 
     // check ETH fee 2 emitted in event is non-zero
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawKUSD(th._100pct, dec(104, 18), D, D, {from: D})
    
    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_1 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedKUSDFee_1.gt(toBN('0')))

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawKUSD(th._100pct, dec(17, 18), B, B, {from: B})
    
    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_2 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedKUSDFee_2.gt(toBN('0')))

    const expectedTotalKUSDGain = emittedKUSDFee_1.add(emittedKUSDFee_2)
    const A_KUSDGain = await kumoStaking.getPendingKUSDGain(A)

    assert.isAtMost(th.getDifference(expectedTotalKUSDGain, A_KUSDGain), 1000)
  })

  // // - multi depositors, several rewards
  it("KUMO Staking: Multiple stakers earn the correct share of all ETH and KUMO fees, based on their stake size", async () => {
    await openTrove({ extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: F } })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: G } })

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A, B, C
    await kumoToken.transfer(A, dec(100, 18), {from: multisig})
    await kumoToken.transfer(B, dec(200, 18), {from: multisig})
    await kumoToken.transfer(C, dec(300, 18), {from: multisig})

    // A, B, C make stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), {from: A})
    await kumoToken.approve(kumoStaking.address, dec(200, 18), {from: B})
    await kumoToken.approve(kumoStaking.address, dec(300, 18), {from: C})
    await kumoStaking.stake(dec(100, 18), {from: A})
    await kumoStaking.stake(dec(200, 18), {from: B})
    await kumoStaking.stake(dec(300, 18), {from: C})

    // Confirm staking contract holds 600 KUMO
    // console.log(`kumo staking KUMO bal: ${await kumoToken.balanceOf(kumoStaking.address)}`)
    assert.equal(await kumoToken.balanceOf(kumoStaking.address), dec(600, 18))
    assert.equal(await kumoStaking.totalKUMOStaked(), dec(600, 18))

    // F redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(F, contracts, dec(45, 18), gasPrice = GAS_PRICE)
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3])
    assert.isTrue(emittedETHFee_1.gt(toBN('0')))

     // G redeems
     const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(G, contracts, dec(197, 18), gasPrice = GAS_PRICE)
     const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3])
     assert.isTrue(emittedETHFee_2.gt(toBN('0')))

    // F draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawKUSD(th._100pct, dec(104, 18), F, F, {from: F})
    const emittedKUSDFee_1 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_1))
    assert.isTrue(emittedKUSDFee_1.gt(toBN('0')))

    // G draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawKUSD(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedKUSDFee_2 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_2))
    assert.isTrue(emittedKUSDFee_2.gt(toBN('0')))

    // D obtains KUMO from owner and makes a stake
    await kumoToken.transfer(D, dec(50, 18), {from: multisig})
    await kumoToken.approve(kumoStaking.address, dec(50, 18), {from: D})
    await kumoStaking.stake(dec(50, 18), {from: D})

    // Confirm staking contract holds 650 KUMO
    assert.equal(await kumoToken.balanceOf(kumoStaking.address), dec(650, 18))
    assert.equal(await kumoStaking.totalKUMOStaked(), dec(650, 18))

     // G redeems
     const redemptionTx_3 = await th.redeemCollateralAndGetTxObject(C, contracts, dec(197, 18), gasPrice = GAS_PRICE)
     const emittedETHFee_3 = toBN((await th.getEmittedRedemptionValues(redemptionTx_3))[3])
     assert.isTrue(emittedETHFee_3.gt(toBN('0')))

     // G draws debt
    const borrowingTx_3 = await borrowerOperations.withdrawKUSD(th._100pct, dec(17, 18), G, G, {from: G})
    const emittedKUSDFee_3 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_3))
    assert.isTrue(emittedKUSDFee_3.gt(toBN('0')))
     
    /*  
    Expected rewards:

    A_ETH: (100* ETHFee_1)/600 + (100* ETHFee_2)/600 + (100*ETH_Fee_3)/650
    B_ETH: (200* ETHFee_1)/600 + (200* ETHFee_2)/600 + (200*ETH_Fee_3)/650
    C_ETH: (300* ETHFee_1)/600 + (300* ETHFee_2)/600 + (300*ETH_Fee_3)/650
    D_ETH:                                             (100*ETH_Fee_3)/650

    A_KUSD: (100*KUSDFee_1 )/600 + (100* KUSDFee_2)/600 + (100*KUSDFee_3)/650
    B_KUSD: (200* KUSDFee_1)/600 + (200* KUSDFee_2)/600 + (200*KUSDFee_3)/650
    C_KUSD: (300* KUSDFee_1)/600 + (300* KUSDFee_2)/600 + (300*KUSDFee_3)/650
    D_KUSD:                                               (100*KUSDFee_3)/650
    */

    // Expected ETH gains
    const expectedETHGain_A = toBN('100').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_B = toBN('200').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_C = toBN('300').mul(emittedETHFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedETHFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedETHFee_3).div( toBN('650')))

    const expectedETHGain_D = toBN('50').mul(emittedETHFee_3).div( toBN('650'))

    // Expected KUSD gains:
    const expectedKUSDGain_A = toBN('100').mul(emittedKUSDFee_1).div( toBN('600'))
                            .add(toBN('100').mul(emittedKUSDFee_2).div( toBN('600')))
                            .add(toBN('100').mul(emittedKUSDFee_3).div( toBN('650')))

    const expectedKUSDGain_B = toBN('200').mul(emittedKUSDFee_1).div( toBN('600'))
                            .add(toBN('200').mul(emittedKUSDFee_2).div( toBN('600')))
                            .add(toBN('200').mul(emittedKUSDFee_3).div( toBN('650')))

    const expectedKUSDGain_C = toBN('300').mul(emittedKUSDFee_1).div( toBN('600'))
                            .add(toBN('300').mul(emittedKUSDFee_2).div( toBN('600')))
                            .add(toBN('300').mul(emittedKUSDFee_3).div( toBN('650')))
    
    const expectedKUSDGain_D = toBN('50').mul(emittedKUSDFee_3).div( toBN('650'))


    const A_ETHBalance_Before = toBN(await web3.eth.getBalance(A))
    const A_KUSDBalance_Before = toBN(await kusdToken.balanceOf(A))
    const B_ETHBalance_Before = toBN(await web3.eth.getBalance(B))
    const B_KUSDBalance_Before = toBN(await kusdToken.balanceOf(B))
    const C_ETHBalance_Before = toBN(await web3.eth.getBalance(C))
    const C_KUSDBalance_Before = toBN(await kusdToken.balanceOf(C))
    const D_ETHBalance_Before = toBN(await web3.eth.getBalance(D))
    const D_KUSDBalance_Before = toBN(await kusdToken.balanceOf(D))

    // A-D un-stake
    const A_GAS_Used = th.gasUsed(await kumoStaking.unstake(dec(100, 18), {from: A, gasPrice: GAS_PRICE }))
    const B_GAS_Used = th.gasUsed(await kumoStaking.unstake(dec(200, 18), {from: B, gasPrice: GAS_PRICE }))
    const C_GAS_Used = th.gasUsed(await kumoStaking.unstake(dec(400, 18), {from: C, gasPrice: GAS_PRICE }))
    const D_GAS_Used = th.gasUsed(await kumoStaking.unstake(dec(50, 18), {from: D, gasPrice: GAS_PRICE }))

    // Confirm all depositors could withdraw

    //Confirm pool Size is now 0
    assert.equal((await kumoToken.balanceOf(kumoStaking.address)), '0')
    assert.equal((await kumoStaking.totalKUMOStaked()), '0')

    // Get A-D ETH and KUSD balances
    const A_ETHBalance_After = toBN(await web3.eth.getBalance(A))
    const A_KUSDBalance_After = toBN(await kusdToken.balanceOf(A))
    const B_ETHBalance_After = toBN(await web3.eth.getBalance(B))
    const B_KUSDBalance_After = toBN(await kusdToken.balanceOf(B))
    const C_ETHBalance_After = toBN(await web3.eth.getBalance(C))
    const C_KUSDBalance_After = toBN(await kusdToken.balanceOf(C))
    const D_ETHBalance_After = toBN(await web3.eth.getBalance(D))
    const D_KUSDBalance_After = toBN(await kusdToken.balanceOf(D))

    // Get ETH and KUSD gains
    const A_ETHGain = A_ETHBalance_After.sub(A_ETHBalance_Before).add(toBN(A_GAS_Used * GAS_PRICE))
    const A_KUSDGain = A_KUSDBalance_After.sub(A_KUSDBalance_Before)
    const B_ETHGain = B_ETHBalance_After.sub(B_ETHBalance_Before).add(toBN(B_GAS_Used * GAS_PRICE))
    const B_KUSDGain = B_KUSDBalance_After.sub(B_KUSDBalance_Before)
    const C_ETHGain = C_ETHBalance_After.sub(C_ETHBalance_Before).add(toBN(C_GAS_Used * GAS_PRICE))
    const C_KUSDGain = C_KUSDBalance_After.sub(C_KUSDBalance_Before)
    const D_ETHGain = D_ETHBalance_After.sub(D_ETHBalance_Before).add(toBN(D_GAS_Used * GAS_PRICE))
    const D_KUSDGain = D_KUSDBalance_After.sub(D_KUSDBalance_Before)

    // Check gains match expected amounts
    assert.isAtMost(th.getDifference(expectedETHGain_A, A_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedKUSDGain_A, A_KUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_B, B_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedKUSDGain_B, B_KUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_C, C_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedKUSDGain_C, C_KUSDGain), 1000)
    assert.isAtMost(th.getDifference(expectedETHGain_D, D_ETHGain), 1000)
    assert.isAtMost(th.getDifference(expectedKUSDGain_D, D_KUSDGain), 1000)
  })
 
  it("unstake(): reverts if caller has ETH gains and can't receive ETH",  async () => {
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })  
    await openTrove({ extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
    await openTrove({ extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
    await openTrove({ extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
    await openTrove({ extraKUSDAmount: toBN(dec(50000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)

    // multisig transfers KUMO to staker A and the non-payable proxy
    await kumoToken.transfer(A, dec(100, 18), {from: multisig})
    await kumoToken.transfer(nonPayable.address, dec(100, 18), {from: multisig})

    //  A makes stake
    const A_stakeTx = await kumoStaking.stake(dec(100, 18), {from: A})
    assert.isTrue(A_stakeTx.receipt.status)

    //  A tells proxy to make a stake
    const proxystakeTxData = await th.getTransactionData('stake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 KUMO
    await nonPayable.forward(kumoStaking.address, proxystakeTxData, {from: A})


    // B makes a redemption, creating ETH gain for proxy
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(B, contracts, dec(45, 18), gasPrice = GAS_PRICE)
    
    const proxy_ETHGain = await kumoStaking.getPendingETHGain(nonPayable.address)
    assert.isTrue(proxy_ETHGain.gt(toBN('0')))

    // Expect this tx to revert: stake() tries to send nonPayable proxy's accumulated ETH gain (albeit 0),
    //  A tells proxy to unstake
    const proxyUnStakeTxData = await th.getTransactionData('unstake(uint256)', ['0x56bc75e2d63100000'])  // proxy stakes 100 KUMO
    const proxyUnstakeTxPromise = nonPayable.forward(kumoStaking.address, proxyUnStakeTxData, {from: A})
   
    // but nonPayable proxy can not accept ETH - therefore stake() reverts.
    await assertRevert(proxyUnstakeTxPromise)
  })

  it("receive(): reverts when it receives ETH from an address that is not the Active Pool",  async () => { 
    const ethSendTxPromise1 = web3.eth.sendTransaction({to: kumoStaking.address, from: A, value: dec(1, 'ether')})
    const ethSendTxPromise2 = web3.eth.sendTransaction({to: kumoStaking.address, from: owner, value: dec(1, 'ether')})

    await assertRevert(ethSendTxPromise1)
    await assertRevert(ethSendTxPromise2)
  })

  it("unstake(): reverts if user has no stake",  async () => {  
    const unstakeTxPromise1 = kumoStaking.unstake(1, {from: A})
    const unstakeTxPromise2 = kumoStaking.unstake(1, {from: owner})

    await assertRevert(unstakeTxPromise1)
    await assertRevert(unstakeTxPromise2)
  })

  it('Test requireCallerIsTroveManager', async () => {
    const kumoStakingTester = await KUMOStakingTester.new()
    await assertRevert(kumoStakingTester.requireCallerIsTroveManager(), 'KUMOStaking: caller is not TroveM')
  })
})
