const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const TroveManagerTester = artifacts.require("TroveManagerTester")
const KUSDTokenTester = artifacts.require("./KUSDTokenTester")

const th = testHelpers.TestHelper

const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const timeValues = testHelpers.TimeValues

const assertRevert = th.assertRevert

/* NOTE: Some of the borrowing tests do not test for specific KUSD fee values. They only test that the
 * fees are non-zero when they should occur, and that they decay over time.
 *
 * Specific KUSD fee values will depend on the final fee schedule used, and the final choice for
 *  the parameter MINUTE_DECAY_FACTOR in the TroveManager, which is still TBD based on economic
 * modelling.
 * 
 */

contract('BorrowerOperations', async accounts => {

  const [
    owner, alice, bob, carol, dennis, whale,
    A, B, C, D, E, F, G, H,
    // defaulter_1, defaulter_2,
    frontEnd_1, frontEnd_2, frontEnd_3] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  // const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

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
  let erc20
  let hardhatTester

  let contracts

  const getOpenTroveKUSDAmount = async (totalDebt, asset) => th.getOpenTroveKUSDAmount(contracts, totalDebt, asset)
  const getNetBorrowingAmount = async (debtWithFee, asset) => th.getNetBorrowingAmount(contracts, debtWithFee, asset)
  const getActualDebtFromComposite = async (compositeDebt) => th.getActualDebtFromComposite(compositeDebt, contracts, asset)
  const openTrove = async (params) => th.openTrove(contracts, params)
  const getTroveEntireColl = async (trove, asset) => th.getTroveEntireColl(contracts, trove, asset)
  const getTroveEntireDebt = async (trove, asset) => th.getTroveEntireDebt(contracts, trove, asset)
  const getTroveStake = async (trove, asset) => th.getTroveStake(contracts, trove, asset)

  let KUSD_GAS_COMPENSATION
  let MIN_NET_DEBT
  let BORROWING_FEE_FLOOR
  let kumoParams
  let assetAddress1

  before(async () => {

  })

  const testCorpus = ({ withProxy = false }) => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployKumoCore()
      contracts.borrowerOperations = await BorrowerOperationsTester.new()
      contracts.troveManager = await TroveManagerTester.new()
      contracts = await deploymentHelper.deployKUSDTokenTester(contracts)
      const KUMOContracts = await deploymentHelper.deployKUMOTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)
      hardhatTester = await deploymentHelper.deployTesterContractsHardhat()

      await deploymentHelper.connectKUMOContracts(KUMOContracts)
      await deploymentHelper.connectCoreContracts(contracts, KUMOContracts)
      await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, contracts)

      if (withProxy) {
        const users = [alice, bob, carol, dennis, whale, A, B, C, D, E]
        await deploymentHelper.deployProxyScripts(contracts, KUMOContracts, owner, users)
      }

      priceFeed = contracts.priceFeedTestnet
      kusdToken = contracts.kusdToken
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      activePool = contracts.activePool
      stabilityPool = contracts.stabilityPool
      defaultPool = contracts.defaultPool
      borrowerOperations = contracts.borrowerOperations
      hintHelpers = contracts.hintHelpers
      kumoParams = contracts.kumoParameters
      erc20 = hardhatTester.erc20
      assetAddress1 = erc20.address

      await kumoParams.sanitizeParameters(assetAddress1);
      await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress1)

      kumoStaking = KUMOContracts.kumoStaking
      kumoToken = KUMOContracts.kumoToken
      communityIssuance = KUMOContracts.communityIssuance
      lockupContractFactory = KUMOContracts.lockupContractFactory

      KUSD_GAS_COMPENSATION = await kumoParams.KUSD_GAS_COMPENSATION(assetAddress1)
      MIN_NET_DEBT = await kumoParams.MIN_NET_DEBT(assetAddress1)
      BORROWING_FEE_FLOOR = await kumoParams.BORROWING_FEE_FLOOR(assetAddress1)

      // Mint token to each acccount
      let index = 0;
      for (const acc of accounts) {
        // await vstaToken.approve(vstaStaking.address, await erc20Asset1.balanceOf(acc), { from: acc })
        await erc20.mint(acc, await web3.eth.getBalance(acc))
        index++;

        if (index >= 20)
          break;
        }

        // for (account of accounts.slice(0, 10)) {
        //   await th.openTrove(contracts, { asset: assetAddress1, extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
        // }
    })

    it("addColl(): reverts when top-up would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()
      
      assert.isFalse(await troveManager.checkRecoveryMode(assetAddress1, price))
      assert.isTrue((await troveManager.getCurrentICR(assetAddress1, alice, price)).lt(toBN(dec(110, 16))))

      const collTopUp = 1  // 1 wei top up

     await assertRevert(borrowerOperations.addColl(assetAddress1, dec(1, 'ether'), alice, alice, { from: alice, value: collTopUp }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("addColl(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const { collateral: aliceColl } = await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const activePool_ETH_Before = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_Before = toBN(await erc20.balanceOf(activePool.address))

      assert.isTrue(activePool_ETH_Before.eq(aliceColl))
      assert.isTrue(activePool_RawEther_Before.eq(aliceColl))

      await borrowerOperations.addColl(assetAddress1, dec(1, 'ether'), alice, alice, { from: alice, value: dec(1, 'ether') })

      const activePool_ETH_After = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_After = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(aliceColl.add(toBN(dec(1, 'ether')))))
    })

    it("addColl(), active Trove: adds the correct collateral amount to the Trove", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const alice_Trove_Before = await troveManager.Troves(alice, assetAddress1)
      const coll_before = alice_Trove_Before[2]
      const status_Before = alice_Trove_Before[4]

      // check status before
      assert.equal(status_Before, 1)

      // Alice adds second collateral
      await borrowerOperations.addColl(assetAddress1, dec(1, 'ether'), alice, alice, { from: alice, value: dec(1, 'ether') })

      const alice_Trove_After = await troveManager.Troves(alice, assetAddress1)
      const coll_After = alice_Trove_After[2]
      const status_After = alice_Trove_After[4]

      // check coll increases by correct amount,and status remains active
      assert.isTrue(coll_After.eq(coll_before.add(toBN(dec(1, 'ether')))))
      assert.equal(status_After, 1)
    })

    it("addColl(), active Trove: Trove is in sortedList before and after", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check Alice is in list before
      const aliceTroveInList_Before = await sortedTroves.contains(assetAddress1, alice)
      const listIsEmpty_Before = await sortedTroves.isEmpty(assetAddress1)
      assert.equal(aliceTroveInList_Before, true)
      assert.equal(listIsEmpty_Before, false)

      await borrowerOperations.addColl(assetAddress1, dec(1, 'ether'), alice, alice, { from: alice, value: dec(1, 'ether') })

      // check Alice is still in list after
      const aliceTroveInList_After = await sortedTroves.contains(assetAddress1, alice)
      const listIsEmpty_After = await sortedTroves.isEmpty(assetAddress1)
      assert.equal(aliceTroveInList_After, true)
      assert.equal(listIsEmpty_After, false)
    })

    it("addColl(), active Trove: updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 1 ether
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const alice_Trove_Before = await troveManager.Troves(alice, assetAddress1)
      const alice_Stake_Before = alice_Trove_Before[3]
      const totalStakes_Before = (await troveManager.totalStakes(assetAddress1))

      assert.isTrue(totalStakes_Before.eq(alice_Stake_Before))

      // Alice tops up Trove collateral with 2 ether
      await borrowerOperations.addColl(assetAddress1, dec(2, 'ether'), alice, alice, { from: alice })

      // Check stake and total stakes get updated
      const alice_Trove_After = await troveManager.Troves(alice, assetAddress1)
      const alice_Stake_After = alice_Trove_After[3]
      const totalStakes_After = (await troveManager.totalStakes(assetAddress1))

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.add(toBN(dec(2, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.add(toBN(dec(2, 'ether')))))
    })

    it("addColl(), active Trove: applies pending rewards and updates user's L_ETH, L_KUSDDebt snapshots", async () => {
      // --- SETUP ---

      const { collateral: aliceCollBefore, totalDebt: aliceDebtBefore } = await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const { collateral: bobCollBefore, totalDebt: bobDebtBefore } = await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // --- TEST ---

      // price drops to 1ETH:100KUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // Liquidate Carol's Trove,
      await troveManager.liquidate(assetAddress1, carol, { from: owner });

      assert.isFalse(await sortedTroves.contains(assetAddress1, carol))

      const L_ETH = await troveManager.L_ASSETS(assetAddress1)
      const L_KUSDDebt = await troveManager.L_KUSDDebts(assetAddress1)

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice, assetAddress1)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_KUSDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob, assetAddress1)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_KUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_KUSDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_KUSDDebtRewardSnapshot_Before, 0)

      const alicePendingETHReward = await troveManager.getPendingReward(assetAddress1, alice)
      const bobPendingETHReward = await troveManager.getPendingReward(assetAddress1, bob)
      const alicePendingKUSDDebtReward = await troveManager.getPendingKUSDDebtReward(assetAddress1, alice)
      const bobPendingKUSDDebtReward = await troveManager.getPendingKUSDDebtReward(assetAddress1, bob)
      for (reward of [alicePendingETHReward, bobPendingETHReward, alicePendingKUSDDebtReward, bobPendingKUSDDebtReward]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      // Alice and Bob top up their Troves
      const aliceTopUp = toBN(dec(5, 'ether'))
      const bobTopUp = toBN(dec(1, 'ether'))

      await borrowerOperations.addColl(assetAddress1, aliceTopUp, alice, alice, { from: alice})
      await borrowerOperations.addColl(assetAddress1, bobTopUp, bob, bob, { from: bob })

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
      const aliceNewColl = await getTroveEntireColl(alice, assetAddress1)
      const aliceNewDebt = await getTroveEntireDebt(alice, assetAddress1)
      const bobNewColl = await getTroveEntireColl(bob, assetAddress1)
      const bobNewDebt = await getTroveEntireDebt(bob, assetAddress1)

      assert.isTrue(aliceNewColl.eq(aliceCollBefore.add(alicePendingETHReward).add(aliceTopUp)))
      assert.isTrue(aliceNewDebt.eq(aliceDebtBefore.add(alicePendingKUSDDebtReward)))
      assert.isTrue(bobNewColl.eq(bobCollBefore.add(bobPendingETHReward).add(bobTopUp)))
      assert.isTrue(bobNewDebt.eq(bobDebtBefore.add(bobPendingKUSDDebtReward)))

      /* Check that both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and L_KUSDDebt */
      const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(alice, assetAddress1)
      const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
      const alice_KUSDDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

      const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bob, assetAddress1)
      const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
      const bob_KUSDDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(alice_KUSDDebtRewardSnapshot_After, L_KUSDDebt), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(bob_KUSDDebtRewardSnapshot_After, L_KUSDDebt), 100)
    })

    // it("addColl(), active Trove: adds the right corrected stake after liquidations have occured", async () => {
    //  // TODO - check stake updates for addColl/withdrawColl/adustTrove ---

    //   // --- SETUP ---
    //   // A,B,C add 15/5/5 ETH, withdraw 100/100/900 KUSD
    //   await borrowerOperations.openTrove(assetAddress1, 0, th._100pct, dec(100, 18), alice, alice, { from: alice, value: dec(15, 'ether') })
    //   await borrowerOperations.openTrove(assetAddress1, 0, th._100pct, dec(100, 18), bob, bob, { from: bob, value: dec(4, 'ether') })
    //   await borrowerOperations.openTrove(assetAddress1, 0, th._100pct, dec(900, 18), carol, carol, { from: carol, value: dec(5, 'ether') })

    //   await borrowerOperations.openTrove(assetAddress1, 0, th._100pct, 0, dennis, dennis, { from: dennis, value: dec(1, 'ether') })
    //   // --- TEST ---

    //   // price drops to 1ETH:100KUSD, reducing Carol's ICR below MCR
    //   await priceFeed.setPrice('100000000000000000000');

    //   // close Carol's Trove, liquidating her 5 ether and 900KUSD.
    //   await troveManager.liquidate(assetAddress1, assetAddress1, carol, { from: owner });

    //   // dennis tops up his trove by 1 ETH
    //   await borrowerOperations.addColl(assetAddress1, dennis, dennis, { from: dennis, value: dec(1, 'ether') })

    //   /* Check that Dennis's recorded stake is the right corrected stake, less than his collateral. A corrected 
    //   stake is given by the formula: 

    //   s = totalStakesSnapshot / totalCollateralSnapshot 

    //   where snapshots are the values immediately after the last liquidation.  After Carol's liquidation, 
    //   the ETH from her Trove has now become the totalPendingETHReward. So:

    //   totalStakes = (alice_Stake + bob_Stake + dennis_orig_stake ) = (15 + 4 + 1) =  20 ETH.
    //   totalCollateral = (alice_Collateral + bob_Collateral + dennis_orig_coll + totalPendingETHReward) = (15 + 4 + 1 + 5)  = 25 ETH.

    //   Therefore, as Dennis adds 1 ether collateral, his corrected stake should be:  s = 2 * (20 / 25 ) = 1.6 ETH */
    //   const dennis_Trove = await troveManager.Troves(dennis)

    //   const dennis_Stake = dennis_Trove[2]
    //   console.log(dennis_Stake.toString())

    //   assert.isAtMost(th.getDifference(dennis_Stake), 100)
    // })

    it("addColl(), reverts if trove is non-existent or closed", async () => {
      // A, B open troves
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Carol attempts to add collateral to her non-existent trove
      try {
        const txCarol = await borrowerOperations.addColl(assetAddress1,  dec(1, 'ether'), carol, carol, { from: carol, value: dec(1, 'ether') })
        assert.isFalse(txCarol.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "Trove does not exist or is closed")
      }

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Bob gets liquidated
      await troveManager.liquidate(assetAddress1, bob)

      assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

      // Bob attempts to add collateral to his closed trove
      try {
        const txBob = await borrowerOperations.addColl(assetAddress1, dec(1, 'ether'), bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (error) {
        assert.include(error.message, "revert")
        assert.include(error.message, "Trove does not exist or is closed")
      }
    })

    it('addColl(): can add collateral in Recovery Mode', async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore = await getTroveEntireColl(alice, assetAddress1)
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      const collTopUp = toBN(dec(1, 'ether'))
      await borrowerOperations.addColl(assetAddress1, collTopUp, alice, alice, { from: alice, value: collTopUp })

      // Check Alice's collateral
      const aliceCollAfter = (await troveManager.Troves(alice, assetAddress1))[2]
      assert.isTrue(aliceCollAfter.eq(aliceCollBefore.add(collTopUp)))
    })

    // --- withdrawColl() ---

    it("withdrawColl(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(assetAddress1, price))
      assert.isTrue((await troveManager.getCurrentICR(assetAddress1, alice, price)).lt(toBN(dec(110, 16))))

      const collWithdrawal = 1  // 1 wei withdrawal

     await assertRevert(borrowerOperations.withdrawColl(assetAddress1, 1, alice, alice, { from: alice }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    // reverts when calling address does not have active trove  
    it("withdrawColl(): reverts when calling address does not have active trove", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws some coll
      const txBob = await borrowerOperations.withdrawColl(assetAddress1, dec(100, 'finney'), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to withdraw
      try {
        const txCarol = await borrowerOperations.withdrawColl(assetAddress1, dec(1, 'ether'), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawColl(assetAddress1, 1000, alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      //Check withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawColl(assetAddress1, 1000, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when requested ETH withdrawal is > the trove's collateral", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolColl = await getTroveEntireColl(carol)
      const bobColl = await getTroveEntireColl(bob)

      const carolCollAsset = await getTroveEntireColl(carol, erc20.address)
      const bobCollAsset = await getTroveEntireColl(bob, erc20.address)
      // Carol withdraws exactly all her collateral
      await assertRevert(
        borrowerOperations.withdrawColl(assetAddress1, carolColl, carol, carol, { from: carol }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )

      // Bob attempts to withdraw 1 wei more than his collateral
      try {
        const txBob = await borrowerOperations.withdrawColl(assetAddress1, bobCollAsset.add(toBN(1)), bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts when withdrawal would bring the user's ICR < MCR", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(11, 17)), extraParams: { from: bob } }) // 110% ICR

      // Bob attempts to withdraws 1 wei, Which would leave him with < 110% ICR.

      try {
        const txBob = await borrowerOperations.withdrawColl(assetAddress1, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawColl(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---

      // A and B open troves at 150% ICR
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(15, 17)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const TCR = (await th.getTCR(contracts, assetAddress1)).toString()
      assert.equal(TCR, '1500000000000000000')

      // --- TEST ---

      // price drops to 1ETH:150KUSD, reducing TCR below 150%
      await priceFeed.setPrice('150000000000000000000');

      //Alice tries to withdraw collateral during Recovery Mode
      try {
        const txData = await borrowerOperations.withdrawColl(assetAddress1, '1', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("withdrawColl(): doesn’t allow a user to completely withdraw all collateral from their Trove (due to gas compensation)", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceColl = (await troveManager.getEntireDebtAndColl(alice, assetAddress1))[1]

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(alice,assetAddress1)
      const status_Before = alice_Trove_Before[4]
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(assetAddress1, alice))

      // Alice attempts to withdraw all collateral
      await assertRevert(
        borrowerOperations.withdrawColl(assetAddress1, aliceColl, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
    })

    it("withdrawColl(): leaves the Trove active when the user withdraws less than all the collateral", async () => {
      // Open Trove 
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(alice, assetAddress1)
      const status_Before = alice_Trove_Before[4]
      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(assetAddress1, alice))

      // Withdraw some collateral
      await borrowerOperations.withdrawColl(assetAddress1, dec(100, 'finney'), alice, alice, { from: alice })

      // Check Trove is still active
      const alice_Trove_After = await troveManager.Troves(alice, assetAddress1)
      const status_After = alice_Trove_After[4]
      assert.equal(status_After, 1)
      assert.isTrue(await sortedTroves.contains(assetAddress1, alice))
    })

    it("withdrawColl(): reduces the Trove's collateral by the correct amount", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore = await getTroveEntireColl(alice, assetAddress1)

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl(assetAddress1, dec(1, 'ether'), alice, alice, { from: alice })

      // Check 1 ether remaining
      const alice_Trove_After = await troveManager.Troves(alice, assetAddress1)
      const aliceCollAfter = await getTroveEntireColl(alice, assetAddress1)

      assert.isTrue(aliceCollAfter.eq(aliceCollBefore.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollBefore = await getTroveEntireColl(alice, assetAddress1)

      // check before
      const activePool_ETH_before = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_before = toBN(await erc20.balanceOf(activePool.address))

      await borrowerOperations.withdrawColl(assetAddress1, dec(1, 'ether'), alice, alice, { from: alice })

      // check after
      const activePool_ETH_After = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_After = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_before.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_RawEther_before.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): updates the stake and updates the total stakes", async () => {
      //  Alice creates initial Trove with 2 ether
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: toBN(dec(5, 'ether')) } })
      const aliceColl = await getTroveEntireColl(alice, assetAddress1)
      assert.isTrue(aliceColl.gt(toBN('0')))

      const alice_Trove_Before = await troveManager.Troves(alice, assetAddress1)
      const alice_Stake_Before = alice_Trove_Before[2]
      const totalStakes_Before = (await troveManager.totalStakes(assetAddress1))

      assert.isTrue(alice_Stake_Before.eq(aliceColl))
      assert.isTrue(totalStakes_Before.eq(aliceColl))

      // Alice withdraws 1 ether
      await borrowerOperations.withdrawColl(assetAddress1, dec(1, 'ether'), alice, alice, { from: alice })

      // Check stake and total stakes get updated
      const alice_Trove_After = await troveManager.Troves(alice, assetAddress1)
      const alice_Stake_After = alice_Trove_After[2]
      const totalStakes_After = (await troveManager.totalStakes(assetAddress1))

      assert.isTrue(alice_Stake_After.eq(alice_Stake_Before.sub(toBN(dec(1, 'ether')))))
      assert.isTrue(totalStakes_After.eq(totalStakes_Before.sub(toBN(dec(1, 'ether')))))
    })

    it("withdrawColl(): sends the correct amount of ETH to the user", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice, value: dec(2, 'ether') } })

      const alice_ETHBalance_Before = toBN(web3.utils.toBN(await erc20.balanceOf(alice)))
      await borrowerOperations.withdrawColl(assetAddress1, dec(1, 'ether'), alice, alice, { from: alice, gasPrice: 0 })

      const alice_ETHBalance_After = toBN(web3.utils.toBN(await erc20.balanceOf(alice)))
      const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

      assert.isTrue(balanceDiff.eq(toBN(dec(1, 'ether'))))
    })

    it("withdrawColl(): applies pending rewards and updates user's L_ETH, L_KUSDDebt snapshots", async () => {
      // --- SETUP ---
      // Alice adds 15 ether, Bob adds 5 ether, Carol adds 1 ether
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(3, 18)), extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(3, 18)), extraParams: { from: bob, value: toBN(dec(100, 'ether')) } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2, 18)), extraParams: { from: carol, value: toBN(dec(10, 'ether')) } })

      const aliceCollBefore = await getTroveEntireColl(alice, assetAddress1)
      const aliceDebtBefore = await getTroveEntireDebt(alice, assetAddress1)
      const bobCollBefore = await getTroveEntireColl(bob, assetAddress1)
      const bobDebtBefore = await getTroveEntireDebt(bob, assetAddress1)

      // --- TEST ---

      // price drops to 1ETH:100KUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice('100000000000000000000');

      // close Carol's Trove, liquidating her 1 ether and 180KUSD.
      await troveManager.liquidate(assetAddress1, carol, { from: owner });

      const L_ETH = await troveManager.L_ASSETS(assetAddress1)
      const L_KUSDDebt = await troveManager.L_KUSDDebts(assetAddress1)

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(assetAddress1, alice)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_KUSDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(assetAddress1, bob)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_KUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_KUSDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_KUSDDebtRewardSnapshot_Before, 0)

      // Check A and B have pending rewards
      const pendingCollReward_A = await troveManager.getPendingReward(assetAddress1, alice)
      const pendingDebtReward_A = await troveManager.getPendingKUSDDebtReward(assetAddress1, alice)
      const pendingCollReward_B = await troveManager.getPendingReward(assetAddress1, bob)
      const pendingDebtReward_B = await troveManager.getPendingKUSDDebtReward(assetAddress1, bob)
      for (reward of [pendingCollReward_A, pendingDebtReward_A, pendingCollReward_B, pendingDebtReward_B]) {
        assert.isTrue(reward.gt(toBN('0')))
      }

      // Alice and Bob withdraw from their Troves
      const aliceCollWithdrawal = toBN(dec(5, 'ether'))
      const bobCollWithdrawal = toBN(dec(1, 'ether'))

      await borrowerOperations.withdrawColl(assetAddress1, aliceCollWithdrawal, alice, alice, { from: alice })
      await borrowerOperations.withdrawColl(assetAddress1, bobCollWithdrawal, bob, bob, { from: bob })

      // Check that both alice and Bob have had pending rewards applied in addition to their top-ups. 
      const aliceCollAfter = await getTroveEntireColl(alice, assetAddress1)
      const aliceDebtAfter = await getTroveEntireDebt(alice, assetAddress1)
      const bobCollAfter = await getTroveEntireColl(bob, assetAddress1)
      const bobDebtAfter = await getTroveEntireDebt(bob, assetAddress1)

      // Check rewards have been applied to troves
      th.assertIsApproximatelyEqual(aliceCollAfter, aliceCollBefore.add(pendingCollReward_A).sub(aliceCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(pendingDebtReward_A), 10000)
      th.assertIsApproximatelyEqual(bobCollAfter, bobCollBefore.add(pendingCollReward_B).sub(bobCollWithdrawal), 10000)
      th.assertIsApproximatelyEqual(bobDebtAfter, bobDebtBefore.add(pendingDebtReward_B), 10000)

      /* After top up, both Alice and Bob's snapshots of the rewards-per-unit-staked metrics should be updated
       to the latest values of L_ETH and L_KUSDDebt */
      const alice_rewardSnapshot_After = await troveManager.rewardSnapshots(alice, assetAddress1)
      const alice_ETHrewardSnapshot_After = alice_rewardSnapshot_After[0]
      const alice_KUSDDebtRewardSnapshot_After = alice_rewardSnapshot_After[1]

      const bob_rewardSnapshot_After = await troveManager.rewardSnapshots(bob, assetAddress1)
      const bob_ETHrewardSnapshot_After = bob_rewardSnapshot_After[0]
      const bob_KUSDDebtRewardSnapshot_After = bob_rewardSnapshot_After[1]

      assert.isAtMost(th.getDifference(alice_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(alice_KUSDDebtRewardSnapshot_After, L_KUSDDebt), 100)
      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot_After, L_ETH), 100)
      assert.isAtMost(th.getDifference(bob_KUSDDebtRewardSnapshot_After, L_KUSDDebt), 100)
    })

    // --- withdrawKUSD() ---

    it("withdrawKUSD(): reverts when withdrawal would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(assetAddress1, price))
      assert.isTrue((await troveManager.getCurrentICR(assetAddress1, alice, price)).lt(toBN(dec(110, 16))))

      const KUSDwithdrawal = 1  // withdraw 1 wei KUSD

     await assertRevert(borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, KUSDwithdrawal, alice, alice, { from: alice }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("withdrawKUSD(): decays a non-zero base rate", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const A_KUSDBal = await kusdToken.balanceOf(A)

      // Artificially set base rate to 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws KUSD
      await borrowerOperations.withdrawKUSD(assetAddress1,  th._100pct, dec(1, 18), A, A, { from: D })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E withdraws KUSD
      await borrowerOperations.withdrawKUSD(assetAddress1,  th._100pct, dec(1, 18), A, A, { from: E })

      const baseRate_3 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("withdrawKUSD(): reverts if max fee > 100%", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await assertRevert(borrowerOperations.withdrawKUSD(assetAddress1, dec(2, 18), dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawKUSD(assetAddress1, '1000000000000000001', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("withdrawKUSD(): reverts if max fee < 0.5% in Normal mode", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      await assertRevert(borrowerOperations.withdrawKUSD(assetAddress1, 0, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawKUSD(assetAddress1, 1, dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.withdrawKUSD(assetAddress1, '4999999999999999', dec(1, 18), A, A, { from: A }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("withdrawKUSD(): reverts if fee exceeds max fee percentage", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const totalSupply = await kusdToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      let baseRate = await troveManager.baseRate(assetAddress1) // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // 100%: 1e18,  10%: 1e17,  1%: 1e16,  0.1%: 1e15
      // 5%: 5e16
      // 0.5%: 5e15
      // actual: 0.5%, 5e15


      // KUSDFee:                  15000000558793542
      // absolute _fee:            15000000558793542
      // actual feePercentage:      5000000186264514
      // user's _maxFeePercentage: 49999999999999999

      const lessThan5pct = '49999999999999999'
      await assertRevert(borrowerOperations.withdrawKUSD(assetAddress1, lessThan5pct, dec(3, 18), A, A, { from: A }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate(assetAddress1) // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 1%
      await assertRevert(borrowerOperations.withdrawKUSD(assetAddress1, dec(1, 16), dec(1, 18), A, A, { from: B }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate(assetAddress1)  // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 3.754%
      await assertRevert(borrowerOperations.withdrawKUSD(assetAddress1, dec(3754, 13), dec(1, 18), A, A, { from: C }), "Fee exceeded provided maximum")

      baseRate = await troveManager.baseRate(assetAddress1)  // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))
      // Attempt with maxFee 0.5%%
      await assertRevert(borrowerOperations.withdrawKUSD(assetAddress1, dec(5, 15), dec(1, 18), A, A, { from: D }), "Fee exceeded provided maximum")
    })

    it("withdrawKUSD(): succeeds when fee is less than max fee percentage", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(60, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(70, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(80, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(180, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const totalSupply = await kusdToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      let baseRate = await troveManager.baseRate(assetAddress1) // expect 5% base rate
      assert.isTrue(baseRate.eq(toBN(dec(5, 16))))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      const tx1 = await borrowerOperations.withdrawKUSD(assetAddress1, moreThan5pct, dec(1, 18), A, A, { from: A })
      assert.isTrue(tx1.receipt.status)

      baseRate = await troveManager.baseRate(assetAddress1) // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee = 5%
      const tx2 = await borrowerOperations.withdrawKUSD(assetAddress1, dec(5, 16), dec(1, 18), A, A, { from: B })
      assert.isTrue(tx2.receipt.status)

      baseRate = await troveManager.baseRate(assetAddress1) // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee 10%
      const tx3 = await borrowerOperations.withdrawKUSD(assetAddress1, dec(1, 17), dec(1, 18), A, A, { from: C })
      assert.isTrue(tx3.receipt.status)

      baseRate = await troveManager.baseRate(assetAddress1) // expect 5% base rate
      assert.equal(baseRate, dec(5, 16))

      // Attempt with maxFee 37.659%
      const tx4 = await borrowerOperations.withdrawKUSD(assetAddress1, dec(37659, 13), dec(1, 18), A, A, { from: D })
      assert.isTrue(tx4.receipt.status)

      // Attempt with maxFee 100%
      const tx5 = await borrowerOperations.withdrawKUSD(assetAddress1, dec(1, 18), dec(1, 18), A, A, { from: E })
      assert.isTrue(tx5.receipt.status)
    })

    it("withdrawKUSD(): doesn't change base rate if it is already zero", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws KUSD
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(37, 18), A, A, { from: D })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(12, 18), A, A, { from: E })

      const baseRate_3 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_3, '0')
    })

    it("withdrawKUSD(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime(assetAddress1)

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(1, 18), C, C, { from: C })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime(assetAddress1)

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(1, 18), C, C, { from: C })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime(assetAddress1)

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })


    it("withdrawKUSD(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers a fee, before decay interval has passed
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(1, 18), C, C, { from: C })

      // 30 seconds pass
      th.fastForwardTime(30, web3.currentProvider)

      // Borrower C triggers another fee
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(1, 18), C, C, { from: C })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("withdrawKUSD(): borrowing at non-zero base rate sends KUSD fee to KUMO staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 KUMO
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
      await kumoStaking.stake(dec(1, 18), { from: multisig })

      // Check KUMO KUSD balance before == 0
      const kumoStaking_KUSDBalance_Before = await kusdToken.balanceOf(kumoStaking.address)
      assert.equal(kumoStaking_KUSDBalance_Before, '0')

      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws KUSD
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(37, 18), C, C, { from: D })

      // Check KUMO KUSD balance after has increased
      const kumoStaking_KUSDBalance_After = await kusdToken.balanceOf(kumoStaking.address)
      assert.isTrue(kumoStaking_KUSDBalance_After.gt(kumoStaking_KUSDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("withdrawKUSD(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 KUMO
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
        await kumoStaking.stake(dec(1, 18), { from: multisig })

        await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        const D_debtBefore = await getTroveEntireDebt(D, assetAddress1)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(assetAddress1, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(assetAddress1)

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate(assetAddress1)
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        // D withdraws KUSD
        const withdrawal_D = toBN(dec(37, 18))
        const withdrawalTx = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, toBN(dec(37, 18)), D, D, { from: D })

        const emittedFee = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(withdrawalTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        const newDebt = (await troveManager.Troves(D,assetAddress1))[0]

        // Check debt on Trove struct equals initial debt + withdrawal + emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_debtBefore.add(withdrawal_D).add(emittedFee), 10000)
      })
    }

    it("withdrawKUSD(): Borrowing at non-zero base rate increases the KUMO staking contract KUSD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 KUMO
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
      await kumoStaking.stake(dec(1, 18), { from: multisig })

      // Check KUMO contract KUSD fees-per-unit-staked is zero
      const F_KUSD_Before = await kumoStaking.F_KUSD()
      assert.equal(F_KUSD_Before, '0')

      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D withdraws KUSD
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, toBN(dec(37, 18)), D, D, { from: D })

      // Check KUMO contract KUSD fees-per-unit-staked has increased
      const F_KUSD_After = await kumoStaking.F_KUSD()
      assert.isTrue(F_KUSD_After.gt(F_KUSD_Before))
    })

    it("withdrawKUSD(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 KUMO
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
      await kumoStaking.stake(dec(1, 18), { from: multisig })

      // Check KUMO Staking contract balance before == 0
      const kumoStaking_KUSDBalance_Before = await kusdToken.balanceOf(kumoStaking.address)
      assert.equal(kumoStaking_KUSDBalance_Before, '0')

      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const D_KUSDBalanceBefore = await kusdToken.balanceOf(D)

      // D withdraws KUSD
      const D_KUSDRequest = toBN(dec(37, 18))
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, D_KUSDRequest, D, D, { from: D })

      // Check KUMO staking KUSD balance has increased
      const kumoStaking_KUSDBalance_After = await kusdToken.balanceOf(kumoStaking.address)
      assert.isTrue(kumoStaking_KUSDBalance_After.gt(kumoStaking_KUSDBalance_Before))

      // Check D's KUSD balance now equals their initial balance plus request KUSD
      const D_KUSDBalanceAfter = await kusdToken.balanceOf(D)
      assert.isTrue(D_KUSDBalanceAfter.eq(D_KUSDBalanceBefore.add(D_KUSDRequest)))
    })

    it("withdrawKUSD(): Borrowing at zero base rate changes KUSD fees-per-unit-staked", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_1, '0')

      // A artificially receives KUMO, then stakes it
      await kumoToken.unprotectedMint(A, dec(100, 18))
      await kumoStaking.stake(dec(100, 18), { from: A })

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check KUMO KUSD balance before == 0
      const F_KUSD_Before = await kumoStaking.F_KUSD()
      assert.equal(F_KUSD_Before, '0')

      // D withdraws KUSD
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(37, 18), D, D, { from: D })

      // Check KUMO KUSD balance after > 0
      const F_KUSD_After = await kumoStaking.F_KUSD()
      assert.isTrue(F_KUSD_After.gt('0'))
    })

    it("withdrawKUSD(): Borrowing at zero base rate sends debt request to user", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const D_KUSDBalanceBefore = await kusdToken.balanceOf(D)

      // D withdraws KUSD
      const D_KUSDRequest = toBN(dec(37, 18))
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(37, 18), D, D, { from: D })

      // Check D's KUSD balance now equals their requested KUSD
      const D_KUSDBalanceAfter = await kusdToken.balanceOf(D)

      // Check D's trove debt == D's KUSD balance + liquidation reserve
      assert.isTrue(D_KUSDBalanceAfter.eq(D_KUSDBalanceBefore.add(D_KUSDRequest)))
    })

    it("withdrawKUSD(): reverts when calling address does not have active trove", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws KUSD
      const txBob = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(100, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to withdraw KUSD
      try {
        const txCarol = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(100, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawKUSD(): reverts when requested withdrawal amount is zero KUSD", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Bob successfully withdraws 1e-18 KUSD
      const txBob = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, 1, bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Alice attempts to withdraw 0 KUSD
      try {
        const txAlice = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, 0, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawKUSD(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      // Withdrawal possible when recoveryMode == false
      const txAlice = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(100, 18), alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice('50000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      //Check KUSD withdrawal impossible when recoveryMode == true
      try {
        const txBob = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawKUSD(): reverts when withdrawal would bring the trove's ICR < MCR", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(11, 17)), extraParams: { from: bob } })

      // Bob tries to withdraw KUSD that would bring his ICR < MCR
      try {
        const txBob = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, 1, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawKUSD(): reverts when a withdrawal would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      // Alice and Bob creates troves with 150% ICR.  System TCR = 150%.
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      var TCR = (await th.getTCR(contracts, assetAddress1)).toString()
      assert.equal(TCR, '1500000000000000000')

      // Bob attempts to withdraw 1 KUSD.
      // System TCR would be: ((3+3) * 100 ) / (200+201) = 600/401 = 149.62%, i.e. below CCR of 150%.
      try {
        const txBob = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(1, 18), bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("withdrawKUSD(): reverts if system is in Recovery Mode", async () => {
      // --- SETUP ---
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      // --- TEST ---

      // price drops to 1ETH:150KUSD, reducing TCR below 150%
      await priceFeed.setPrice('150000000000000000000');
      assert.isTrue((await th.getTCR(contracts, assetAddress1)).lt(toBN(dec(15, 17))))

      try {
        const txData = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, '200', alice, alice, { from: alice })
        assert.isFalse(txData.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("withdrawKUSD(): increases the Trove's KUSD debt by the correct amount", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check before
      const aliceDebtBefore = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))

      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, await getNetBorrowingAmount(100, assetAddress1), alice, alice, { from: alice })

      // check after
      const aliceDebtAfter = await getTroveEntireDebt(alice, assetAddress1)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.add(toBN(100)))
    })

    it("withdrawKUSD(): increases KUSD debt in ActivePool by correct amount", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: alice, value: toBN(dec(100, 'ether')) } })

      const aliceDebtBefore = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(aliceDebtBefore.gt(toBN(0)))

      // check before
      const activePool_KUSD_Before = await activePool.getKUSDDebt(assetAddress1)
      assert.isTrue(activePool_KUSD_Before.eq(aliceDebtBefore))

      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, await getNetBorrowingAmount(dec(10000, 18), assetAddress1), alice, alice, { from: alice })

      // check after
      const activePool_KUSD_After = await activePool.getKUSDDebt(assetAddress1)
      th.assertIsApproximatelyEqual(activePool_KUSD_After, activePool_KUSD_Before.add(toBN(dec(10000, 18))))
    })

    it("withdrawKUSD(): increases user KUSDToken balance by correct amount", async () => {
      await openTrove({ asset: assetAddress1, assetSent: toBN(dec(100, 'ether')), extraParams: { from: alice } })

      // check before
      const alice_KUSDTokenBalance_Before = await kusdToken.balanceOf(alice)
      assert.isTrue(alice_KUSDTokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(10000, 18), alice, alice, { from: alice })

      // check after
      const alice_KUSDTokenBalance_After = await kusdToken.balanceOf(alice)
      assert.isTrue(alice_KUSDTokenBalance_After.eq(alice_KUSDTokenBalance_Before.add(toBN(dec(10000, 18)))))
    })

    // --- repayKUSD() ---
    it("repayKUSD(): reverts when repayment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(assetAddress1, price))
      assert.isTrue((await troveManager.getCurrentICR(assetAddress1, alice, price)).lt(toBN(dec(110, 16))))

      const KUSDRepayment = 1  // 1 wei repayment

     await assertRevert(borrowerOperations.repayKUSD(assetAddress1, KUSDRepayment, alice, alice, { from: alice }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("repayKUSD(): Succeeds when it would leave trove with net debt >= minimum net debt", async () => {
      // Make the KUSD request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei
      await borrowerOperations.openTrove(assetAddress1, dec(100, 30), th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2')), assetAddress1), A, A, { from: A})

      const repayTxA = await borrowerOperations.repayKUSD(assetAddress1, 1, A, A, { from: A })
      assert.isTrue(repayTxA.receipt.status)

      await borrowerOperations.openTrove(assetAddress1, dec(100, 30) , th._100pct, dec(20, 25), B, B, { from: B})

      const repayTxB = await borrowerOperations.repayKUSD(assetAddress1, dec(19, 25), B, B, { from: B })
      assert.isTrue(repayTxB.receipt.status)
    })

    it("repayKUSD(): reverts when it would leave trove with net debt < minimum net debt", async () => {
      // Make the KUSD request 2 wei above min net debt to correct for floor division, and make net debt = min net debt + 1 wei
      await borrowerOperations.openTrove(assetAddress1, dec(100, 30), th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN('2')), assetAddress1), A, A, { from: A})

      const repayTxAPromise = borrowerOperations.repayKUSD(assetAddress1, 2, A, A, { from: A })
      await assertRevert(repayTxAPromise, "BorrowerOps: Trove's net debt must be greater than minimum")
    })

    it("adjustTrove(): Reverts if repaid amount is greater than current debt", async () => {
      const { totalDebt } = await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      const repayAmount = totalDebt.add(toBN(1))
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: repayAmount, ICR: toBN(dec(150, 16)), extraParams: { from: bob } })

      await kusdToken.transfer(alice, repayAmount, { from: bob })

      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, repayAmount, false, alice, alice, { from: alice }),
                         "BorrowerOps: Trove's net debt must be greater than minimum")
    })

    it("repayKUSD(): reverts when calling address does not have active trove", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      // Bob successfully repays some KUSD
      const txBob = await borrowerOperations.repayKUSD(assetAddress1, dec(10, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Carol with no active trove attempts to repayKUSD
      try {
        const txCarol = await borrowerOperations.repayKUSD(assetAddress1, dec(10, 18), carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("repayKUSD(): reverts when attempted repayment is > the debt of the trove", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebt = await getTroveEntireDebt(alice, assetAddress1)

      // Bob successfully repays some KUSD
      const txBob = await borrowerOperations.repayKUSD(assetAddress1, dec(10, 18), bob, bob, { from: bob })
      assert.isTrue(txBob.receipt.status)

      // Alice attempts to repay more than her debt
      try {
        const txAlice = await borrowerOperations.repayKUSD(assetAddress1, aliceDebt.add(toBN(dec(1, 18))), alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    //repayKUSD: reduces KUSD debt in Trove
    it("repayKUSD(): reduces the Trove's KUSD debt by the correct amount", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      await borrowerOperations.repayKUSD(assetAddress1, aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      const aliceDebtAfter = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(aliceDebtAfter.gt(toBN('0')))

      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)))  // check 9/10 debt remaining
    })

    it("repayKUSD(): decreases KUSD debt in ActivePool by correct amount", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      // Check before
      const activePool_KUSD_Before = await activePool.getKUSDDebt(assetAddress1)
      assert.isTrue(activePool_KUSD_Before.gt(toBN('0')))

      await borrowerOperations.repayKUSD(assetAddress1, aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      // check after
      const activePool_KUSD_After = await activePool.getKUSDDebt(assetAddress1)
      th.assertIsApproximatelyEqual(activePool_KUSD_After, activePool_KUSD_Before.sub(aliceDebtBefore.div(toBN(10))))
    })

    it("repayKUSD(): decreases user KUSDToken balance by correct amount", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      // check before
      const alice_KUSDTokenBalance_Before = await kusdToken.balanceOf(alice)
      assert.isTrue(alice_KUSDTokenBalance_Before.gt(toBN('0')))

      await borrowerOperations.repayKUSD(assetAddress1, aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })  // Repays 1/10 her debt

      // check after
      const alice_KUSDTokenBalance_After = await kusdToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_KUSDTokenBalance_After, alice_KUSDTokenBalance_Before.sub(aliceDebtBefore.div(toBN(10))))
    })

    it('repayKUSD(): can repay debt in Recovery Mode', async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const aliceDebtBefore = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      await priceFeed.setPrice('105000000000000000000')

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      const tx = await borrowerOperations.repayKUSD(assetAddress1, aliceDebtBefore.div(toBN(10)), alice, alice, { from: alice })
      assert.isTrue(tx.receipt.status)

      // Check Alice's debt: 110 (initial) - 50 (repaid)
      const aliceDebtAfter = await getTroveEntireDebt(alice, assetAddress1)
      th.assertIsApproximatelyEqual(aliceDebtAfter, aliceDebtBefore.mul(toBN(9)).div(toBN(10)))
    })

    it("repayKUSD(): Reverts if borrower has insufficient KUSD balance to cover his debt repayment", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      const bobBalBefore = await kusdToken.balanceOf(B)
      assert.isTrue(bobBalBefore.gt(toBN('0')))

      // Bob transfers all but 5 of his KUSD to Carol
      await kusdToken.transfer(C, bobBalBefore.sub((toBN(dec(5, 18)))), { from: B })

      //Confirm B's KUSD balance has decreased to 5 KUSD
      const bobBalAfter = await kusdToken.balanceOf(B)

      assert.isTrue(bobBalAfter.eq(toBN(dec(5, 18))))
      
      // Bob tries to repay 6 KUSD
      const repayKUSDPromise_B = borrowerOperations.repayKUSD(assetAddress1, toBN(dec(6, 18)), B, B, { from: B })

      await assertRevert(repayKUSDPromise_B, "Caller doesnt have enough KUSD to make repayment")
    })

    // --- adjustTrove() ---

    it("adjustTrove(): reverts when adjustment would leave trove with ICR < MCR", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))
      const price = await priceFeed.getPrice()

      assert.isFalse(await troveManager.checkRecoveryMode(assetAddress1, price))
      assert.isTrue((await troveManager.getCurrentICR(assetAddress1, alice, price)).lt(toBN(dec(110, 16))))

      const KUSDRepayment = 1  // 1 wei repayment
      const collTopUp = 1

     await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, KUSDRepayment, false, alice, alice, { from: alice, value: collTopUp }), 
      "BorrowerOps: An operation that would result in ICR < MCR is not permitted")
    })

    it("adjustTrove(): reverts if max fee < 0.5% in Normal mode", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })

      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, 0, 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, 1, 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, '4999999999999999', 0, dec(1, 18), true, A, A, { from: A, value: dec(2, 16) }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("adjustTrove(): allows max fee < 0.5% in Recovery mode", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })

      await priceFeed.setPrice(dec(120, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      await borrowerOperations.adjustTrove(assetAddress1, dec(300, 18), 0, 0, dec(1, 9), true, A, A, { from: A })
      await priceFeed.setPrice(dec(1, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))
      await borrowerOperations.adjustTrove(assetAddress1, dec(30000, 18), 1, 0, dec(1, 9), true, A, A, { from: A })
      await priceFeed.setPrice(dec(1, 16))
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))
      await borrowerOperations.adjustTrove(assetAddress1, dec(3000000, 18), '4999999999999999', 0, dec(1, 9), true, A, A, { from: A })
    })

    it("adjustTrove(): decays a non-zero base rate", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts trove
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(37, 15), true, E, E, { from: D })

      const baseRate_3 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("adjustTrove(): doesn't decay a non-zero base rate when user issues 0 debt", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // D opens trove 
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove with 0 debt
      await borrowerOperations.adjustTrove(assetAddress1, dec(1, 'ether'), th._100pct, 0, 0, false, D, D, { from: D  })

      // Check baseRate has not decreased 
      const baseRate_2 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_2.eq(baseRate_1))
    })

    it("adjustTrove(): doesn't change base rate if it is already zero", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E adjusts trove
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(37, 15), true, E, E, { from: D })

      const baseRate_3 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_3, '0')
    })

    it("adjustTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime(assetAddress1)

      // 10 seconds pass
      th.fastForwardTime(10, web3.currentProvider)

      // Borrower C triggers a fee
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime(assetAddress1)

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 60 seconds passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(60))

      // Borrower C triggers a fee
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime(assetAddress1)

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })

    it("adjustTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // Borrower C triggers a fee, before decay interval of 1 minute has passed
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Borrower C triggers another fee
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(1, 18), true, C, C, { from: C })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("adjustTrove(): borrowing at non-zero base rate sends KUSD fee to KUMO staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 KUMO
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
      await kumoStaking.stake(dec(1, 18), { from: multisig })

      // Check KUMO KUSD balance before == 0
      const kumoStaking_KUSDBalance_Before = await kusdToken.balanceOf(kumoStaking.address)
      assert.equal(kumoStaking_KUSDBalance_Before, '0')

      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check KUMO KUSD balance after has increased
      const kumoStaking_KUSDBalance_After = await kusdToken.balanceOf(kumoStaking.address)
      assert.isTrue(kumoStaking_KUSDBalance_After.gt(kumoStaking_KUSDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("adjustTrove(): borrowing at non-zero base records the (drawn debt + fee) on the Trove struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 KUMO
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
        await kumoStaking.stake(dec(1, 18), { from: multisig })

        await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })
        const D_debtBefore = await getTroveEntireDebt(D, assetAddress1)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(assetAddress1, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(assetAddress1)

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate(assetAddress1)
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const withdrawal_D = toBN(dec(37, 18))

        // D withdraws KUSD
        const adjustmentTx = await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, withdrawal_D, true, D, D, { from: D })

        const emittedFee = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(adjustmentTx))
        assert.isTrue(emittedFee.gt(toBN('0')))

        const D_newDebt = (await troveManager.Troves(D, assetAddress1))[0]
    
        // Check debt on Trove struct equals initila debt plus drawn debt plus emitted fee
        assert.isTrue(D_newDebt.eq(D_debtBefore.add(withdrawal_D).add(emittedFee)))
      })
    }

    it("adjustTrove(): Borrowing at non-zero base rate increases the KUMO staking contract KUSD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 KUMO
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
      await kumoStaking.stake(dec(1, 18), { from: multisig })

      // Check KUMO contract KUSD fees-per-unit-staked is zero
      const F_KUSD_Before = await kumoStaking.F_KUSD()
      assert.equal(F_KUSD_Before, '0')

      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check KUMO contract KUSD fees-per-unit-staked has increased
      const F_KUSD_After = await kumoStaking.F_KUSD()
      assert.isTrue(F_KUSD_After.gt(F_KUSD_Before))
    })

    it("adjustTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 KUMO
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
      await kumoStaking.stake(dec(1, 18), { from: multisig })

      // Check KUMO Staking contract balance before == 0
      const kumoStaking_KUSDBalance_Before = await kusdToken.balanceOf(kumoStaking.address)
      assert.equal(kumoStaking_KUSDBalance_Before, '0')

      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const D_KUSDBalanceBefore = await kusdToken.balanceOf(D)

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D adjusts trove
      const KUSDRequest_D = toBN(dec(40, 18))
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, KUSDRequest_D, true, D, D, { from: D })

      // Check KUMO staking KUSD balance has increased
      const kumoStaking_KUSDBalance_After = await kusdToken.balanceOf(kumoStaking.address)
      assert.isTrue(kumoStaking_KUSDBalance_After.gt(kumoStaking_KUSDBalance_Before))

      // Check D's KUSD balance has increased by their requested KUSD
      const D_KUSDBalanceAfter = await kusdToken.balanceOf(D)
      assert.isTrue(D_KUSDBalanceAfter.eq(D_KUSDBalanceBefore.add(KUSDRequest_D)))
    })

    it("adjustTrove(): Borrowing at zero base rate changes KUSD balance of KUMO staking contract", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(50, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check staking KUSD balance before > 0
      const kumoStaking_KUSDBalance_Before = await kusdToken.balanceOf(kumoStaking.address)
      assert.isTrue(kumoStaking_KUSDBalance_Before.gt(toBN('0')))

      // D adjusts trove
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check staking KUSD balance after > staking balance before
      const kumoStaking_KUSDBalance_After = await kusdToken.balanceOf(kumoStaking.address)
      assert.isTrue(kumoStaking_KUSDBalance_After.gt(kumoStaking_KUSDBalance_Before))
    })

    it("adjustTrove(): Borrowing at zero base rate changes KUMO staking contract KUSD fees-per-unit-staked", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // A artificially receives KUMO, then stakes it
      await kumoToken.unprotectedMint(A, dec(100, 18))
      await kumoStaking.stake(dec(100, 18), { from: A })

      // Check staking KUSD balance before == 0
      const F_KUSD_Before = await kumoStaking.F_KUSD()
      assert.isTrue(F_KUSD_Before.eq(toBN('0')))

      // D adjusts trove
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(37, 18), true, D, D, { from: D })

      // Check staking KUSD balance increases
      const F_KUSD_After = await kumoStaking.F_KUSD()
      assert.isTrue(F_KUSD_After.gt(F_KUSD_Before))
    })

    it("adjustTrove(): Borrowing at zero base rate sends total requested KUSD to the user", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale, value: toBN(dec(100, 'ether')) } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const D_KUSDBalBefore = await kusdToken.balanceOf(D)
      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      const DUSDBalanceBefore = await kusdToken.balanceOf(D)

      // D adjusts trove
      const KUSDRequest_D = toBN(dec(40, 18))
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, KUSDRequest_D, true, D, D, { from: D })

      // Check D's KUSD balance increased by their requested KUSD
      const KUSDBalanceAfter = await kusdToken.balanceOf(D)
      assert.isTrue(KUSDBalanceAfter.eq(D_KUSDBalBefore.add(KUSDRequest_D)))
    })

    it("adjustTrove(): reverts when calling address has no active trove", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Alice coll and debt increase(+1 ETH, +50KUSD)
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      try {
        const txCarol = await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(50, 18), true, carol, carol, { from: carol, value: dec(1, 'ether') })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts in Recovery Mode when the adjustment would reduce the TCR", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      const txAlice = await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })
      assert.isTrue(txAlice.receipt.status)

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      try { // collateral withdrawal should also fail
        const txAlice = await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, dec(1, 'ether'), 0, false, alice, alice, { from: alice })
        assert.isFalse(txAlice.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase should fail
        const txBob = await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(50, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      try { // debt increase that's also a collateral increase should also fail, if ICR will be worse off
        const txBob = await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(111, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): collateral withdrawal reverts in Recovery Mode", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      // Alice attempts an adjustment that repays half her debt BUT withdraws 1 wei collateral, and fails
      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 1, dec(5000, 18), false, alice, alice, { from: alice }),
        "BorrowerOps: Collateral withdrawal not permitted Recovery Mode")
    })

    it("adjustTrove(): debt increase that would leave ICR < 150% reverts in Recovery Mode", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await kumoParams.CCR(assetAddress1)

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      const ICR_A = await troveManager.getCurrentICR(assetAddress1, alice, price)

      const aliceDebt = await getTroveEntireDebt(alice, assetAddress1)
      const aliceColl = await getTroveEntireColl(alice, assetAddress1)
      const debtIncrease = toBN(dec(50, 18))
      const collIncrease = toBN(dec(1, 'ether'))

      // Check the new ICR would be an improvement, but less than the CCR (150%)
      const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)

      assert.isTrue(newICR.gt(ICR_A) && newICR.lt(CCR))

      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice, value: collIncrease }),
        "BorrowerOps: Operation must leave trove with ICR >= CCR")
    })

    it("adjustTrove(): debt increase that would reduce the ICR reverts in Recovery Mode", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await kumoParams.CCR(assetAddress1)

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      await priceFeed.setPrice(dec(105, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      //--- Alice with ICR > 150% tries to reduce her ICR ---

      const ICR_A = await troveManager.getCurrentICR(assetAddress1, alice, price)

      // Check Alice's initial ICR is above 150%
      assert.isTrue(ICR_A.gt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice, assetAddress1)
      const aliceColl = await getTroveEntireColl(alice, assetAddress1)
      const aliceDebtIncrease = toBN(dec(150, 18))
      const aliceCollIncrease = toBN(dec(1, 'ether'))

      const newICR_A = await troveManager.computeICR(aliceColl.add(aliceCollIncrease), aliceDebt.add(aliceDebtIncrease), price)

      // Check Alice's new ICR would reduce but still be greater than 150%
      assert.isTrue(newICR_A.lt(ICR_A) && newICR_A.gt(CCR))

      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, aliceDebtIncrease, true, alice, alice, { from: alice, value: aliceCollIncrease }),
        "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode")

      //--- Bob with ICR < 150% tries to reduce his ICR ---

      const ICR_B = await troveManager.getCurrentICR(assetAddress1, bob, price)

      // Check Bob's initial ICR is below 150%
      assert.isTrue(ICR_B.lt(CCR))

      const bobDebt = await getTroveEntireDebt(bob)
      const bobColl = await getTroveEntireColl(bob)
      const bobDebtIncrease = toBN(dec(450, 18))
      const bobCollIncrease = toBN(dec(1, 'ether'))

      const newICR_B = await troveManager.computeICR(bobColl.add(bobCollIncrease), bobDebt.add(bobDebtIncrease), price)

      // Check Bob's new ICR would reduce 
      assert.isTrue(newICR_B.lt(ICR_B))

      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, bobDebtIncrease, true, bob, bob, { from: bob, value: bobCollIncrease }),
        " BorrowerOps: Operation must leave trove with ICR >= CCR")
    })

    it("adjustTrove(): A trove with ICR < CCR in Recovery Mode can adjust their trove to ICR > CCR", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await kumoParams.CCR(assetAddress1)

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      await priceFeed.setPrice(dec(100, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      const ICR_A = await troveManager.getCurrentICR(assetAddress1, alice, price)
      // Check initial ICR is below 150%
      assert.isTrue(ICR_A.lt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice, assetAddress1)
      const aliceColl = await getTroveEntireColl(alice, assetAddress1)
      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)

      // Check new ICR would be > 150%
      assert.isTrue(newICR.gt(CCR))

      const tx = await borrowerOperations.adjustTrove(assetAddress1, collIncrease, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice })
      assert.isTrue(tx.receipt.status)

      const actualNewICR = await troveManager.getCurrentICR(assetAddress1, alice, price)
      assert.isTrue(actualNewICR.gt(CCR))
    })

    it("adjustTrove(): A trove with ICR > CCR in Recovery Mode can improve their ICR", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      const CCR = await kumoParams.CCR(assetAddress1)

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      await priceFeed.setPrice(dec(105, 18)) // trigger drop in ETH price
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      const initialICR = await troveManager.getCurrentICR(assetAddress1, alice, price)
      // Check initial ICR is above 150%
      assert.isTrue(initialICR.gt(CCR))

      const aliceDebt = await getTroveEntireDebt(alice, assetAddress1)
      const aliceColl = await getTroveEntireColl(alice, assetAddress1)
      const debtIncrease = toBN(dec(5000, 18))
      const collIncrease = toBN(dec(150, 'ether'))

      const newICR = await troveManager.computeICR(aliceColl.add(collIncrease), aliceDebt.add(debtIncrease), price)

      // Check new ICR would be > old ICR
      assert.isTrue(newICR.gt(initialICR))

      const tx = await borrowerOperations.adjustTrove(assetAddress1, collIncrease, th._100pct, 0, debtIncrease, true, alice, alice, { from: alice })
      assert.isTrue(tx.receipt.status)

      const actualNewICR = await troveManager.getCurrentICR(assetAddress1, alice, price)
      assert.isTrue(actualNewICR.gt(initialICR))
    })

    it("adjustTrove(): debt increase in Recovery Mode charges no fee", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(200000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      await priceFeed.setPrice(dec(120, 18)) // trigger drop in ETH price

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      // B stakes KUMO
      await kumoToken.unprotectedMint(bob, dec(100, 18))
      await kumoStaking.stake(dec(100, 18), { from: bob })

      const kumoStakingKUSDBalanceBefore = await kusdToken.balanceOf(kumoStaking.address)
      assert.isTrue(kumoStakingKUSDBalanceBefore.gt(toBN('0')))

      const txAlice = await borrowerOperations.adjustTrove(assetAddress1, dec(100, 'ether'), th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice })
      assert.isTrue(txAlice.receipt.status)

      // Check emitted fee = 0
      const emittedFee = toBN(await th.getEventArgByName(txAlice, 'KUSDBorrowingFeePaid', '_KUSDFee'))
      assert.isTrue(emittedFee.eq(toBN('0')))

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      // Check no fee was sent to staking contract
      const kumoStakingKUSDBalanceAfter = await kusdToken.balanceOf(kumoStaking.address)
      assert.equal(kumoStakingKUSDBalanceAfter.toString(), kumoStakingKUSDBalanceBefore.toString())
    })

    it("adjustTrove(): reverts when change would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))

      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      // Check TCR and Recovery Mode
      const TCR = (await th.getTCR(contracts, assetAddress1)).toString()
      assert.equal(TCR, '1500000000000000000')
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      // Bob attempts an operation that would bring the TCR below the CCR
      try {
        const txBob = await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(1, 18), true, bob, bob, { from: bob })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts when KUSD repaid is > debt of the trove", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const bobOpenTx = (await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: bob } })).tx

      const bobDebt = await getTroveEntireDebt(bob, assetAddress1)
      assert.isTrue(bobDebt.gt(toBN('0')))

      const bobFee = toBN(await th.getEventArgByIndex(bobOpenTx, 'KUSDBorrowingFeePaid', 2))
      assert.isTrue(bobFee.gt(toBN('0')))

      // Alice transfers KUSD to bob to compensate borrowing fees
      await kusdToken.transfer(bob, bobFee, { from: alice })

      const remainingDebt = (await troveManager.getTroveDebt(assetAddress1, bob)).sub(KUSD_GAS_COMPENSATION)

      // Bob attempts an adjustment that would repay 1 wei more than his debt
      await assertRevert(
        borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, remainingDebt.add(toBN(1)), false, bob, bob, { from: bob, value: dec(1, 'ether') }),
        "revert"
      )
    })

    it("adjustTrove(): reverts when attempted ETH withdrawal is >= the trove's collateral", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolColl = await getTroveEntireColl(carol)

      // Carol attempts an adjustment that would withdraw 1 wei more than her ETH
      try {
        const txCarol = await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, carolColl.add(toBN(1)), 0, true, carol, carol, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): reverts when change would cause the ICR of the trove to fall below the MCR", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(100, 18)), extraParams: { from: whale } })

      await priceFeed.setPrice(dec(100, 18))

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(11, 17)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(11, 17)), extraParams: { from: bob } })

      // Bob attempts to increase debt by 100 KUSD and 1 ether, i.e. a change that constitutes a 100% ratio of coll:debt.
      // Since his ICR prior is 110%, this change would reduce his ICR below MCR.
      try {
        const txBob = await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(100, 18), true, bob, bob, { from: bob, value: dec(1, 'ether') })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("adjustTrove(): With 0 coll change, doesnt change borrower's coll or ActivePool coll", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceCollBefore = await getTroveEntireColl(alice, assetAddress1)
      const activePoolCollBefore = await activePool.getAssetBalance(assetAddress1)

      assert.isTrue(aliceCollBefore.gt(toBN('0')))
      assert.isTrue(aliceCollBefore.eq(activePoolCollBefore))

      // Alice adjusts trove. No coll change, and a debt increase (+50KUSD)
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice, value: 0 })

      const aliceCollAfter = await getTroveEntireColl(alice, assetAddress1)
      const activePoolCollAfter = await activePool.getAssetBalance(assetAddress1)

      assert.isTrue(aliceCollAfter.eq(activePoolCollAfter))
      assert.isTrue(activePoolCollAfter.eq(activePoolCollAfter))
    })

    it("adjustTrove(): With 0 debt change, doesnt change borrower's debt or ActivePool debt", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebtBefore = await getTroveEntireDebt(alice, assetAddress1)
      const activePoolDebtBefore = await activePool.getKUSDDebt(assetAddress1)

      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(aliceDebtBefore.eq(activePoolDebtBefore))

      // Alice adjusts trove. Coll change, no debt change
      await borrowerOperations.adjustTrove(assetAddress1, dec(1, 'ether'), th._100pct, 0, 0, false, alice, alice, { from: alice })

      const aliceDebtAfter = await getTroveEntireDebt(alice, assetAddress1)
      const activePoolDebtAfter = await activePool.getKUSDDebt(assetAddress1)

      assert.isTrue(aliceDebtAfter.eq(aliceDebtBefore))
      assert.isTrue(activePoolDebtAfter.eq(activePoolDebtBefore))
    })

    it("adjustTrove(): updates borrower's debt and coll with an increase in both", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice, assetAddress1)
      const collBefore = await getTroveEntireColl(alice, assetAddress1)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts trove. Coll and debt increase(+1 ETH, +50KUSD)
      await borrowerOperations.adjustTrove(assetAddress1, dec(1, 'ether'), th._100pct, 0, await getNetBorrowingAmount(dec(50, 18), assetAddress1), true, alice, alice, { from: alice })

      const debtAfter = await getTroveEntireDebt(alice, assetAddress1)
      const collAfter = await getTroveEntireColl(alice, assetAddress1)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.add(toBN(dec(1, 18))), 10000)
    })

    it("adjustTrove(): updates borrower's debt and coll with a decrease in both", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice, assetAddress1)
      const collBefore = await getTroveEntireColl(alice, assetAddress1)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts trove coll and debt decrease (-0.5 ETH, -50KUSD)
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

      const debtAfter = await getTroveEntireDebt(alice, assetAddress1)
      const collAfter = await getTroveEntireColl(alice, assetAddress1)

      assert.isTrue(debtAfter.eq(debtBefore.sub(toBN(dec(50, 18)))))
      assert.isTrue(collAfter.eq(collBefore.sub(toBN(dec(5, 17)))))
    })

    it("adjustTrove(): updates borrower's  debt and coll with coll increase, debt decrease", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice, assetAddress1)
      const collBefore = await getTroveEntireColl(alice, assetAddress1)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt decrease (+0.5 ETH, -50KUSD)
      await borrowerOperations.adjustTrove(assetAddress1, dec(500, 'finney') , th._100pct, 0, dec(50, 18), false, alice, alice, { from: alice })

      const debtAfter = await getTroveEntireDebt(alice, assetAddress1)
      const collAfter = await getTroveEntireColl(alice, assetAddress1)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.sub(toBN(dec(50, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.add(toBN(dec(5, 17))), 10000)
    })

    it("adjustTrove(): updates borrower's debt and coll with coll decrease, debt increase", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const debtBefore = await getTroveEntireDebt(alice, assetAddress1)
      const collBefore = await getTroveEntireColl(alice, assetAddress1)
      assert.isTrue(debtBefore.gt(toBN('0')))
      assert.isTrue(collBefore.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt increase (0.1 ETH, 10KUSD)
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, dec(1, 17), await getNetBorrowingAmount(dec(1, 18), assetAddress1), true, alice, alice, { from: alice })

      const debtAfter = await getTroveEntireDebt(alice, assetAddress1)
      const collAfter = await getTroveEntireColl(alice, assetAddress1)

      th.assertIsApproximatelyEqual(debtAfter, debtBefore.add(toBN(dec(1, 18))), 10000)
      th.assertIsApproximatelyEqual(collAfter, collBefore.sub(toBN(dec(1, 17))), 10000)
    })

    it("adjustTrove(): updates borrower's stake and totalStakes with a coll increase", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const stakeBefore = await troveManager.getTroveStake(assetAddress1, alice)
      const totalStakesBefore = await troveManager.totalStakes(assetAddress1);
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      // Alice adjusts trove - coll and debt increase (+1 ETH, +50 KUSD)
      await borrowerOperations.adjustTrove(assetAddress1, dec(1, 'ether'), th._100pct, 0, dec(50, 18), true, alice, alice, { from: alice })

      const stakeAfter = await troveManager.getTroveStake(assetAddress1, alice)
      const totalStakesAfter = await troveManager.totalStakes(assetAddress1);

      assert.isTrue(stakeAfter.eq(stakeBefore.add(toBN(dec(1, 18)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.add(toBN(dec(1, 18)))))
    })

    it("adjustTrove(): updates borrower's stake and totalStakes with a coll decrease", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const stakeBefore = await troveManager.getTroveStake(assetAddress1, alice)
      const totalStakesBefore = await troveManager.totalStakes(assetAddress1);
      assert.isTrue(stakeBefore.gt(toBN('0')))
      assert.isTrue(totalStakesBefore.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, dec(500, 'finney'), dec(50, 18), false, alice, alice, { from: alice })

      const stakeAfter = await troveManager.getTroveStake(assetAddress1, alice)
      const totalStakesAfter = await troveManager.totalStakes(assetAddress1);

      assert.isTrue(stakeAfter.eq(stakeBefore.sub(toBN(dec(5, 17)))))
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(toBN(dec(5, 17)))))
    })

    it("adjustTrove(): changes KUSDToken balance by the requested decrease", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const alice_KUSDTokenBalance_Before = await kusdToken.balanceOf(alice)
      assert.isTrue(alice_KUSDTokenBalance_Before.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

      // check after
      const alice_KUSDTokenBalance_After = await kusdToken.balanceOf(alice)
      assert.isTrue(alice_KUSDTokenBalance_After.eq(alice_KUSDTokenBalance_Before.sub(toBN(dec(10, 18)))))
    })

    it("adjustTrove(): changes KUSDToken balance by the requested increase", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const alice_KUSDTokenBalance_Before = await kusdToken.balanceOf(alice)
      assert.isTrue(alice_KUSDTokenBalance_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(100, 18), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      // check after
      const alice_KUSDTokenBalance_After = await kusdToken.balanceOf(alice)
      assert.isTrue(alice_KUSDTokenBalance_After.eq(alice_KUSDTokenBalance_Before.add(toBN(dec(100, 18)))))
    })

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the requested decrease", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_ETH_Before = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_Before = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      // Alice adjusts trove - coll decrease and debt decrease
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, dec(100, 'finney'), dec(10, 18), false, alice, alice, { from: alice })

      const activePool_ETH_After = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_After = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_ETH_Before.sub(toBN(dec(1, 17)))))
    })

    it("adjustTrove(): Changes the activePool ETH and raw ether balance by the amount of ETH sent", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_ETH_Before = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_Before = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_Before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await borrowerOperations.adjustTrove(assetAddress1, dec(1, 'ether'), th._100pct, 0, dec(100, 18), true, alice, alice, { from: alice })

      const activePool_ETH_After = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_After = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))))
      assert.isTrue(activePool_RawEther_After.eq(activePool_ETH_Before.add(toBN(dec(1, 18)))))
    })

    it("adjustTrove(): Changes the KUSD debt in ActivePool by requested decrease", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_KUSDDebt_Before = await activePool.getKUSDDebt(assetAddress1)
      assert.isTrue(activePool_KUSDDebt_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt decrease
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, dec(30, 18), false, alice, alice, { from: alice, value: dec(1, 'ether') })

      const activePool_KUSDDebt_After = await activePool.getKUSDDebt(assetAddress1)
      assert.isTrue(activePool_KUSDDebt_After.eq(activePool_KUSDDebt_Before.sub(toBN(dec(30, 18)))))
    })

    it("adjustTrove(): Changes the KUSD debt in ActivePool by requested increase", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const activePool_KUSDDebt_Before = await activePool.getKUSDDebt(assetAddress1)
      assert.isTrue(activePool_KUSDDebt_Before.gt(toBN('0')))

      // Alice adjusts trove - coll increase and debt increase
      await borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, await getNetBorrowingAmount(dec(100, 18), assetAddress1), true, alice, alice, { from: alice, value: dec(1, 'ether') })

      const activePool_KUSDDebt_After = await activePool.getKUSDDebt(assetAddress1)
    
      th.assertIsApproximatelyEqual(activePool_KUSDDebt_After, activePool_KUSDDebt_Before.add(toBN(dec(100, 18))))
    })

    it("adjustTrove(): new coll = 0 and new debt = 0 is not allowed, as gas compensation still counts toward ICR", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const aliceColl = await getTroveEntireColl(alice, assetAddress1)
      const aliceDebt = await getTroveEntireColl(alice, assetAddress1)
      const status_Before = await troveManager.getTroveStatus(assetAddress1, alice)
      const isInSortedList_Before = await sortedTroves.contains(assetAddress1, alice)

      assert.equal(status_Before, 1)  // 1: Active
      assert.isTrue(isInSortedList_Before)

      await assertRevert(
        borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, aliceColl, aliceDebt, true, alice, alice, { from: alice }),
        'BorrowerOps: An operation that would result in ICR < MCR is not permitted'
      )
    })

    it("adjustTrove(): Reverts if requested debt increase and amount is zero", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, 0, true, alice, alice, { from: alice }),
        'BorrowerOps: Debt increase requires non-zero debtChange')
    })

    it("adjustTrove(): Reverts if requested coll withdrawal and ether is sent", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, dec(3, 'ether'), th._100pct, dec(1, 'ether'), dec(100, 18), true, alice, alice, { from: alice }), 'BorrowerOperations: Cannot withdraw and add coll')
    })

    it("adjustTrove(): Reverts if it’s zero adjustment", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, 0, false, alice, alice, { from: alice }),
                         'BorrowerOps: There must be either a collateral change or a debt change')
    })

    it("adjustTrove(): Reverts if requested coll withdrawal is greater than trove's collateral", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })

      const aliceColl = await getTroveEntireColl(alice, assetAddress1)

      // Requested coll withdrawal > coll in the trove
      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, aliceColl.add(toBN(1)), 0, false, alice, alice, { from: alice }))
      await assertRevert(borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, aliceColl.add(toBN(dec(37, 'ether'))), 0, false, bob, bob, { from: bob }))
    })

    it("adjustTrove(): Reverts if borrower has insufficient KUSD balance to cover his debt repayment", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: B } })
      const bobDebt = await getTroveEntireDebt(B, assetAddress1)

      // Bob transfers some KUSD to carol
      await kusdToken.transfer(C, dec(10, 18), { from: B })

      //Confirm B's KUSD balance is less than 50 KUSD
      const B_KUSDBal = await kusdToken.balanceOf(B)
      assert.isTrue(B_KUSDBal.lt(bobDebt))

      const repayKUSDPromise_B = borrowerOperations.adjustTrove(assetAddress1, 0, th._100pct, 0, bobDebt, false, B, B, { from: B })

      // B attempts to repay all his debt
      await assertRevert(repayKUSDPromise_B, "revert")
    })

    // --- Internal _adjustTrove() ---

    if (!withProxy) { // no need to test this with proxies
      it("Internal _adjustTrove(): reverts when op is a withdrawal and _borrower param is not the msg.sender", async () => {
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

        const txPromise_A = borrowerOperations.callInternalAdjustLoan(assetAddress1, 0,  alice, dec(1, 18), dec(1, 18), true, alice, alice, { from: bob })
        await assertRevert(txPromise_A, "BorrowerOps: Caller must be the borrower for a withdrawal")
        const txPromise_B = borrowerOperations.callInternalAdjustLoan(assetAddress1, 0, bob, dec(1, 18), dec(1, 18), true, alice, alice, { from: owner })
        await assertRevert(txPromise_B, "BorrowerOps: Caller must be the borrower for a withdrawal")
        const txPromise_C = borrowerOperations.callInternalAdjustLoan(assetAddress1, 0, carol, dec(1, 18), dec(1, 18), true, alice, alice, { from: bob })
        await assertRevert(txPromise_C, "BorrowerOps: Caller must be the borrower for a withdrawal")
      })
    }

    // --- closeTrove() ---

    it("closeTrove(): reverts when it would lower the TCR below CCR", async () => {
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(300, 16)), extraParams:{ from: alice } })
      await openTrove({ asset: assetAddress1,  ICR: toBN(dec(120, 16)), extraKUSDAmount: toBN(dec(300, 18)), extraParams:{ from: bob } })

      const price = await priceFeed.getPrice()
      
      // to compensate borrowing fees
      await kusdToken.transfer(alice, dec(300, 18), { from: bob })

      assert.isFalse(await troveManager.checkRecoveryMode(assetAddress1, price))
    
      await assertRevert(
        borrowerOperations.closeTrove(assetAddress1, { from: alice }),
        "BorrowerOps: An operation that would result in TCR < CCR is not permitted"
      )
    })

    it("closeTrove(): reverts when calling address does not have active trove", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: bob } })

      // Carol with no active trove attempts to close her trove
      try {
        const txCarol = await borrowerOperations.closeTrove(assetAddress1, { from: carol })
        assert.isFalse(txCarol.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("closeTrove(): reverts when system is in Recovery Mode", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Alice transfers her KUSD to Bob and Carol so they can cover fees
      const aliceBal = await kusdToken.balanceOf(alice)
      await kusdToken.transfer(bob, aliceBal.div(toBN(2)), { from: alice })
      await kusdToken.transfer(carol, aliceBal.div(toBN(2)), { from: alice })

      // check Recovery Mode 
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      // Bob successfully closes his trove
      const txBob = await borrowerOperations.closeTrove(assetAddress1, { from: bob })
      assert.isTrue(txBob.receipt.status)

      await priceFeed.setPrice(dec(100, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      // Carol attempts to close her trove during Recovery Mode
      await assertRevert(borrowerOperations.closeTrove(assetAddress1, { from: carol }), "BorrowerOps: Operation not permitted during Recovery Mode")
    })

    it("closeTrove(): reverts when trove is the only one in the system", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(100000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Artificially mint to Alice so she has enough to close her trove
      await kusdToken.unprotectedMint(alice, dec(100000, 18))

      // Check she has more KUSD than her trove debt
      const aliceBal = await kusdToken.balanceOf(alice)
      const aliceDebt = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(aliceBal.gt(aliceDebt))

      // check Recovery Mode
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      // Alice attempts to close her trove
      await assertRevert(borrowerOperations.closeTrove(assetAddress1,{ from: alice }), "TroveManager: Only one trove in the system")
    })

    it("closeTrove(): reduces a Trove's collateral to zero", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceCollBefore = await getTroveEntireColl(alice, assetAddress1)
      const dennisKUSD = await kusdToken.balanceOf(dennis)
      assert.isTrue(aliceCollBefore.gt(toBN('0')))
      assert.isTrue(dennisKUSD.gt(toBN('0')))

      // To compensate borrowing fees
      await kusdToken.transfer(alice, dennisKUSD.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })

      const aliceCollAfter = await getTroveEntireColl(alice, assetAddress1)
      assert.equal(aliceCollAfter, '0')
    })

    it("closeTrove(): reduces a Trove's debt to zero", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebtBefore = await getTroveEntireColl(alice, assetAddress1)
      const dennisKUSD = await kusdToken.balanceOf(dennis)
      assert.isTrue(aliceDebtBefore.gt(toBN('0')))
      assert.isTrue(dennisKUSD.gt(toBN('0')))

      // To compensate borrowing fees
      await kusdToken.transfer(alice, dennisKUSD.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })

      const aliceCollAfter = await getTroveEntireColl(alice, assetAddress1)
      assert.equal(aliceCollAfter, '0')
    })

    it("closeTrove(): sets Trove's stake to zero", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceStakeBefore = await getTroveStake(alice, assetAddress1)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))

      const dennisKUSD = await kusdToken.balanceOf(dennis)
      assert.isTrue(aliceStakeBefore.gt(toBN('0')))
      assert.isTrue(dennisKUSD.gt(toBN('0')))

      // To compensate borrowing fees
      await kusdToken.transfer(alice, dennisKUSD.div(toBN(2)), { from: dennis })

      // Alice attempts to close trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })

      const stakeAfter = ((await troveManager.Troves(alice, assetAddress1))[2]).toString()
      assert.equal(stakeAfter, '0')
      // check withdrawal was successful
    })

    it("closeTrove(): zero's the troves reward snapshots", async () => {
      // Dennis opens trove and transfers tokens to alice
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Price drops
      await priceFeed.setPrice(dec(100, 18))

      // Liquidate Bob
      await troveManager.liquidate(assetAddress1, bob)
      assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

      // Price bounces back
      await priceFeed.setPrice(dec(200, 18))

      // Alice and Carol open troves
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Price drops ...again
      await priceFeed.setPrice(dec(100, 18))

      // Get Alice's pending reward snapshots 
      const L_ETH_A_Snapshot = (await troveManager.rewardSnapshots(alice, assetAddress1))[0]
      const L_KUSDDebt_A_Snapshot = (await troveManager.rewardSnapshots(alice, assetAddress1))[1]
      assert.isTrue(L_ETH_A_Snapshot.gt(toBN('0')))
      assert.isTrue(L_KUSDDebt_A_Snapshot.gt(toBN('0')))

      // Liquidate Carol
      await troveManager.liquidate(assetAddress1, carol)
      assert.isFalse(await sortedTroves.contains(assetAddress1, carol))

      // Get Alice's pending reward snapshots after Carol's liquidation. Check above 0
      const L_ETH_Snapshot_A_AfterLiquidation = (await troveManager.rewardSnapshots(alice, assetAddress1))[0]
      const L_KUSDDebt_Snapshot_A_AfterLiquidation = (await troveManager.rewardSnapshots(alice, assetAddress1))[1]

      assert.isTrue(L_ETH_Snapshot_A_AfterLiquidation.gt(toBN('0')))
      assert.isTrue(L_KUSDDebt_Snapshot_A_AfterLiquidation.gt(toBN('0')))

      // to compensate borrowing fees
      await kusdToken.transfer(alice, await kusdToken.balanceOf(dennis), { from: dennis })

      await priceFeed.setPrice(dec(200, 18))

      // Alice closes trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })

      // Check Alice's pending reward snapshots are zero
      const L_ETH_Snapshot_A_afterAliceCloses = (await troveManager.rewardSnapshots(assetAddress1, alice))[0]
      const L_KUSDDebt_Snapshot_A_afterAliceCloses = (await troveManager.rewardSnapshots(assetAddress1, alice))[1]

      assert.equal(L_ETH_Snapshot_A_afterAliceCloses, '0')
      assert.equal(L_KUSDDebt_Snapshot_A_afterAliceCloses, '0')
    })

    it("closeTrove(): sets trove's status to closed and removes it from sorted troves list", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Trove is active
      const alice_Trove_Before = await troveManager.Troves(alice, assetAddress1)
      const status_Before = alice_Trove_Before[4]

      assert.equal(status_Before, 1)
      assert.isTrue(await sortedTroves.contains(assetAddress1, alice))

      // to compensate borrowing fees
      await kusdToken.transfer(alice, await kusdToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })

      const alice_Trove_After = await troveManager.Troves(alice, assetAddress1)
      const status_After = alice_Trove_After[4]

      assert.equal(status_After, 2)
      assert.isFalse(await sortedTroves.contains(assetAddress1, alice))
    })

    it("closeTrove(): reduces ActivePool ETH and raw ether by correct amount", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const dennisColl = await getTroveEntireColl(dennis, assetAddress1)
      const aliceColl = await getTroveEntireColl(alice, assetAddress1)
      assert.isTrue(dennisColl.gt('0'))
      assert.isTrue(aliceColl.gt('0'))

      // Check active Pool ETH before
      const activePool_ETH_before = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_before = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_before.eq(aliceColl.add(dennisColl)))
      assert.isTrue(activePool_ETH_before.gt(toBN('0')))
      assert.isTrue(activePool_RawEther_before.eq(activePool_ETH_before))

      // to compensate borrowing fees
      await kusdToken.transfer(alice, await kusdToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })

      // Check after
      const activePool_ETH_After = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_After = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(dennisColl))
      assert.isTrue(activePool_RawEther_After.eq(dennisColl))
    })

    it("closeTrove(): reduces ActivePool debt by correct amount", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const dennisDebt = await getTroveEntireDebt(dennis, assetAddress1)
      const aliceDebt = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(dennisDebt.gt('0'))
      assert.isTrue(aliceDebt.gt('0'))

      // Check before
      const activePool_Debt_before = await activePool.getKUSDDebt(assetAddress1)
      assert.isTrue(activePool_Debt_before.eq(aliceDebt.add(dennisDebt)))
      assert.isTrue(activePool_Debt_before.gt(toBN('0')))

      // to compensate borrowing fees
      await kusdToken.transfer(alice, await kusdToken.balanceOf(dennis), { from: dennis })

      // Close the trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })

      // Check after
      const activePool_Debt_After = (await activePool.getKUSDDebt(assetAddress1)).toString()
      th.assertIsApproximatelyEqual(activePool_Debt_After, dennisDebt)
    })

    it("closeTrove(): updates the the total stakes", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Get individual stakes
      const aliceStakeBefore = await getTroveStake(alice, assetAddress1)
      const bobStakeBefore = await getTroveStake(bob, assetAddress1)
      const dennisStakeBefore = await getTroveStake(dennis, assetAddress1)
      assert.isTrue(aliceStakeBefore.gt('0'))
      assert.isTrue(bobStakeBefore.gt('0'))
      assert.isTrue(dennisStakeBefore.gt('0'))

      const totalStakesBefore = await troveManager.totalStakes(assetAddress1)

      assert.isTrue(totalStakesBefore.eq(aliceStakeBefore.add(bobStakeBefore).add(dennisStakeBefore)))

      // to compensate borrowing fees
      await kusdToken.transfer(alice, await kusdToken.balanceOf(dennis), { from: dennis })

      // Alice closes trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })

      // Check stake and total stakes get updated
      const aliceStakeAfter = await getTroveStake(alice)
      const totalStakesAfter = await troveManager.totalStakes(assetAddress1)

      assert.equal(aliceStakeAfter, 0)
      assert.isTrue(totalStakesAfter.eq(totalStakesBefore.sub(aliceStakeBefore)))
    })

    if (!withProxy) { // TODO: wrap web3.eth.getBalance to be able to go through proxies
      it("closeTrove(): sends the correct amount of ETH to the user", async () => {
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

        const aliceColl = await getTroveEntireColl(alice, assetAddress1)
        assert.isTrue(aliceColl.gt(toBN('0')))

        const alice_ETHBalance_Before = web3.utils.toBN(await erc20.balanceOf(alice))

        // to compensate borrowing fees
        await kusdToken.transfer(alice, await kusdToken.balanceOf(dennis), { from: dennis })

        await borrowerOperations.closeTrove(assetAddress1, { from: alice, gasPrice: 0 })

        const alice_ETHBalance_After = web3.utils.toBN(await erc20.balanceOf(alice))
        const balanceDiff = alice_ETHBalance_After.sub(alice_ETHBalance_Before)

        assert.isTrue(balanceDiff.eq(aliceColl))
      })
    }

    it("closeTrove(): subtracts the debt of the closed Trove from the Borrower's KUSDToken balance", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: dennis } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      const aliceDebt = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(aliceDebt.gt(toBN('0')))

      // to compensate borrowing fees
      await kusdToken.transfer(alice, await kusdToken.balanceOf(dennis), { from: dennis })

      const alice_KUSDBalance_Before = await kusdToken.balanceOf(alice)
      assert.isTrue(alice_KUSDBalance_Before.gt(toBN('0')))

      // close trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })

      // check alice KUSD balance after
      const alice_KUSDBalance_After = await kusdToken.balanceOf(alice)
      th.assertIsApproximatelyEqual(alice_KUSDBalance_After, alice_KUSDBalance_Before.sub(aliceDebt.sub(KUSD_GAS_COMPENSATION)))
    })

    it("closeTrove(): applies pending rewards", async () => {
      // --- SETUP ---
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(1000000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      const whaleDebt = await getTroveEntireDebt(whale, assetAddress1)
      const whaleColl = await getTroveEntireColl(whale, assetAddress1)

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      const carolDebt = await getTroveEntireDebt(carol, assetAddress1)
      const carolColl = await getTroveEntireColl(carol, assetAddress1)

      // Whale transfers to A and B to cover their fees
      await kusdToken.transfer(alice, dec(10000, 18), { from: whale })
      await kusdToken.transfer(bob, dec(10000, 18), { from: whale })

      // --- TEST ---

      // price drops to 1ETH:100KUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));
      const price = await priceFeed.getPrice()

      // liquidate Carol's Trove, Alice and Bob earn rewards.
      const liquidationTx = await troveManager.liquidate(assetAddress1, carol, { from: owner });
      const [liquidatedDebt_C, liquidatedColl_C] = await th.getEmittedLiquidationValues(liquidationTx)

      // Dennis opens a new Trove 
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // check Alice and Bob's reward snapshots are zero before they alter their Troves
      const alice_rewardSnapshot_Before = await troveManager.rewardSnapshots(alice, assetAddress1)
      const alice_ETHrewardSnapshot_Before = alice_rewardSnapshot_Before[0]
      const alice_KUSDDebtRewardSnapshot_Before = alice_rewardSnapshot_Before[1]

      const bob_rewardSnapshot_Before = await troveManager.rewardSnapshots(bob, assetAddress1)
      const bob_ETHrewardSnapshot_Before = bob_rewardSnapshot_Before[0]
      const bob_KUSDDebtRewardSnapshot_Before = bob_rewardSnapshot_Before[1]

      assert.equal(alice_ETHrewardSnapshot_Before, 0)
      assert.equal(alice_KUSDDebtRewardSnapshot_Before, 0)
      assert.equal(bob_ETHrewardSnapshot_Before, 0)
      assert.equal(bob_KUSDDebtRewardSnapshot_Before, 0)

      const defaultPool_ETH = await defaultPool.getAssetBalance(assetAddress1)
      const defaultPool_KUSDDebt = await activePool.getKUSDDebt(assetAddress1)

      // Carol's liquidated coll (1 ETH) and drawn debt should have entered the Default Pool
      assert.isAtMost(th.getDifference(defaultPool_ETH, liquidatedColl_C), 100)
      assert.isAtMost(th.getDifference(defaultPool_KUSDDebt, liquidatedDebt_C), 100)

      const pendingCollReward_A = await troveManager.getPendingETHReward(alice)
      const pendingDebtReward_A = await troveManager.getPendingKUSDDebtReward(alice)
      assert.isTrue(pendingCollReward_A.gt('0'))
      assert.isTrue(pendingDebtReward_A.gt('0'))

      // Close Alice's trove. Alice's pending rewards should be removed from the DefaultPool when she close.
      await borrowerOperations.closeTrove({ from: alice })

      const defaultPool_ETH_afterAliceCloses = await defaultPool.getAssetBalance(assetAddress1)
      const defaultPool_KUSDDebt_afterAliceCloses = await activePool.getKUSDDebt(assetAddress1)

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterAliceCloses,
        defaultPool_ETH.sub(pendingCollReward_A)), 1000)
      assert.isAtMost(th.getDifference(defaultPool_KUSDDebt_afterAliceCloses,
        defaultPool_KUSDDebt.sub(pendingDebtReward_A)), 1000)

      // whale adjusts trove, pulling their rewards out of DefaultPool
      await adjustTrove(assetAddress1, 0, th._100pct, 0, dec(1, 18), true, whale, whale, { from: whale })

      // Close Bob's trove. Expect DefaultPool coll and debt to drop to 0, since closing pulls his rewards out.
      await borrowerOperations.closeTrove({ from: bob })

      const defaultPool_ETH_afterBobCloses = await defaultPool.getAssetBalance(assetAddress1)
      const defaultPool_KUSDDebt_afterBobCloses = await activePool.getKUSDDebt(assetAddress1)

      assert.isAtMost(th.getDifference(defaultPool_ETH_afterBobCloses, 0), 100000)
      assert.isAtMost(th.getDifference(defaultPool_KUSDDebt_afterBobCloses, 0), 100000)
    })

    it("closeTrove(): reverts if borrower has insufficient KUSD balance to repay his entire debt", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      //Confirm Bob's KUSD balance is less than his trove debt
      const B_KUSDBal = await kusdToken.balanceOf(B)
      const B_troveDebt = await getTroveEntireDebt(B, assetAddress1)

      assert.isTrue(B_KUSDBal.lt(B_troveDebt))

      const closeTrovePromise_B = borrowerOperations.closeTrove(assetAddress1, { from: B })

      // Check closing trove reverts
      await assertRevert(closeTrovePromise_B, "BorrowerOps: Caller doesnt have enough KUSD to make repayment")
    })

    // --- openTrove() ---

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openTrove(): emits a TroveUpdated event with the correct collateral and debt", async () => {
        const txA = (await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(15000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })).tx
        const txB = (await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })).tx
        const txC = (await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })).tx

        const A_Coll = await getTroveEntireColl(A, assetAddress1)
        const B_Coll = await getTroveEntireColl(B, assetAddress1)
        const C_Coll = await getTroveEntireColl(C, assetAddress1)
        const A_Debt = await getTroveEntireDebt(A, assetAddress1)
        const B_Debt = await getTroveEntireDebt(B, assetAddress1)
        const C_Debt = await getTroveEntireDebt(C, assetAddress1)

        const A_emittedDebt = toBN(th.getEventArgByName(txA, "TroveUpdated", "_debt"))
        const A_emittedColl = toBN(th.getEventArgByName(txA, "TroveUpdated", "_coll"))
        const B_emittedDebt = toBN(th.getEventArgByName(txB, "TroveUpdated", "_debt"))
        const B_emittedColl = toBN(th.getEventArgByName(txB, "TroveUpdated", "_coll"))
        const C_emittedDebt = toBN(th.getEventArgByName(txC, "TroveUpdated", "_debt"))
        const C_emittedColl = toBN(th.getEventArgByName(txC, "TroveUpdated", "_coll"))

        // Check emitted debt values are correct
        assert.isTrue(A_Debt.eq(A_emittedDebt))
        assert.isTrue(B_Debt.eq(B_emittedDebt))
        assert.isTrue(C_Debt.eq(C_emittedDebt))

        // Check emitted coll values are correct
        assert.isTrue(A_Coll.eq(A_emittedColl))
        assert.isTrue(B_Coll.eq(B_emittedColl))
        assert.isTrue(C_Coll.eq(C_emittedColl))

        const baseRateBefore = await troveManager.baseRate(assetAddress1)

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(assetAddress1, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(assetAddress1)

        assert.isTrue((await troveManager.baseRate(assetAddress1)).gt(baseRateBefore))

        const txD = (await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })).tx
        const txE = (await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(3000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })).tx
        const D_Coll = await getTroveEntireColl(D, assetAddress1)
        const E_Coll = await getTroveEntireColl(E, assetAddress1)
        const D_Debt = await getTroveEntireDebt(D, assetAddress1)
        const E_Debt = await getTroveEntireDebt(E, assetAddress1)

        const D_emittedDebt = toBN(th.getEventArgByName(txD, "TroveUpdated", "_debt"))
        const D_emittedColl = toBN(th.getEventArgByName(txD, "TroveUpdated", "_coll"))

        const E_emittedDebt = toBN(th.getEventArgByName(txE, "TroveUpdated", "_debt"))
        const E_emittedColl = toBN(th.getEventArgByName(txE, "TroveUpdated", "_coll"))

        // Check emitted debt values are correct
        assert.isTrue(D_Debt.eq(D_emittedDebt))
        assert.isTrue(E_Debt.eq(E_emittedDebt))

        // Check emitted coll values are correct
        assert.isTrue(D_Coll.eq(D_emittedColl))
        assert.isTrue(E_Coll.eq(E_emittedColl))
      })
    }

    it("openTrove(): Opens a trove with net debt >= minimum net debt", async () => {
      // Add 1 wei to correct for rounding error in helper function
      const txA = await borrowerOperations.openTrove(assetAddress1, dec(100, 30), th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(1)), assetAddress1), A, A, { from: A })
      assert.isTrue(txA.receipt.status)
      assert.isTrue(await sortedTroves.contains(assetAddress1, A))

      const txC = await borrowerOperations.openTrove(assetAddress1, dec(100, 30), th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.add(toBN(dec(47789898, 22))), assetAddress1), A, A, { from: C})
      assert.isTrue(txC.receipt.status)
      assert.isTrue(await sortedTroves.contains(assetAddress1, C))
    })

    it("openTrove(): reverts if net debt < minimum net debt", async () => {
      const txAPromise = borrowerOperations.openTrove(assetAddress1, 0, th._100pct, 0, A, A, { from: A, value: dec(100, 30) })
      await assertRevert(txAPromise, "revert")

      const txBPromise = borrowerOperations.openTrove(assetAddress1, 0, th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT.sub(toBN(1)), assetAddress1), B, B, { from: B, value: dec(100, 30) })
      await assertRevert(txBPromise, "revert")

      const txCPromise = borrowerOperations.openTrove(assetAddress1, 0, th._100pct, MIN_NET_DEBT.sub(toBN(dec(173, 18))), C, C, { from: C, value: dec(100, 30) })
      await assertRevert(txCPromise, "revert")
    })

    it("openTrove(): decays a non-zero base rate", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate has decreased
      const baseRate_2 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_2.lt(baseRate_1))

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const baseRate_3 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_3.lt(baseRate_2))
    })

    it("openTrove(): doesn't change base rate if it is already zero", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check baseRate is still 0
      const baseRate_2 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_2, '0')

      // 1 hour passes
      th.fastForwardTime(3600, web3.currentProvider)

      // E opens trove 
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(12, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const baseRate_3 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_3, '0')
    })

    it("openTrove(): lastFeeOpTime doesn't update if less time than decay interval has passed since the last fee operation", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      const lastFeeOpTime_1 = await troveManager.lastFeeOperationTime(assetAddress1)

      // Borrower D triggers a fee
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      const lastFeeOpTime_2 = await troveManager.lastFeeOperationTime(assetAddress1)

      // Check that the last fee operation time did not update, as borrower D's debt issuance occured
      // since before minimum interval had passed 
      assert.isTrue(lastFeeOpTime_2.eq(lastFeeOpTime_1))

      // 1 minute passes
      th.fastForwardTime(60, web3.currentProvider)

      // Check that now, at least one minute has passed since lastFeeOpTime_1
      const timeNow = await th.getLatestBlockTimestamp(web3)
      assert.isTrue(toBN(timeNow).sub(lastFeeOpTime_1).gte(3600))

      // Borrower E triggers a fee
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      const lastFeeOpTime_3 = await troveManager.lastFeeOperationTime(assetAddress1)

      // Check that the last fee operation time DID update, as borrower's debt issuance occured
      // after minimum interval had passed 
      assert.isTrue(lastFeeOpTime_3.gt(lastFeeOpTime_1))
    })

    it("openTrove(): reverts if max fee > 100%", async () => {
      await assertRevert(borrowerOperations.openTrove(assetAddress1, 0, dec(2, 18), dec(10000, 18), A, A, { from: A, value: dec(1000, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(assetAddress1, 0, '1000000000000000001', dec(20000, 18), B, B, { from: B, value: dec(1000, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("openTrove(): reverts if max fee < 0.5% in Normal mode", async () => {
      await assertRevert(borrowerOperations.openTrove(assetAddress1, 0, 0, dec(195000, 18), A, A, { from: A, value: dec(1200, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(assetAddress1, 0, 1, dec(195000, 18), A, A, { from: A, value: dec(1000, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
      await assertRevert(borrowerOperations.openTrove(assetAddress1, 0, '4999999999999999', dec(195000, 18), B, B, { from: B, value: dec(1200, 'ether') }), "Max fee percentage must be between 0.5% and 100%")
    })

    it("openTrove(): allows max fee < 0.5% in Recovery Mode", async () => {
      await borrowerOperations.openTrove(assetAddress1, dec(2000, 'ether'), th._100pct, dec(195000, 18), A, A, { from: A })

      await priceFeed.setPrice(dec(100, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      await borrowerOperations.openTrove(assetAddress1, dec(3100, 'ether') , 0, dec(19500, 18), B, B, { from: B})
      await priceFeed.setPrice(dec(50, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))
      await borrowerOperations.openTrove(assetAddress1, dec(3100, 'ether') , 1, dec(19500, 18), C, C, { from: C})
      await priceFeed.setPrice(dec(25, 18))
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))
      await borrowerOperations.openTrove(assetAddress1, dec(3100, 'ether') , '4999999999999999', dec(19500, 18), D, D, { from: D })
    })

    it("openTrove(): reverts if fee exceeds max fee percentage", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      const totalSupply = await kusdToken.totalSupply()

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      //       actual fee percentage: 0.005000000186264514
      // user's max fee percentage:  0.0049999999999999999
      let borrowingRate = await troveManager.getBorrowingRate(assetAddress1) // expect max(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate, dec(5, 16))

      const lessThan5pct = '49999999999999999'
      await assertRevert(borrowerOperations.openTrove(assetAddress1, 0, lessThan5pct, dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate(assetAddress1) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 1%
      await assertRevert(borrowerOperations.openTrove(assetAddress1, 0, dec(1, 16), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate(assetAddress1) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 3.754%
      await assertRevert(borrowerOperations.openTrove(assetAddress1, 0, dec(3754, 13), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")

      borrowingRate = await troveManager.getBorrowingRate(assetAddress1) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))
      // Attempt with maxFee 1e-16%
      await assertRevert(borrowerOperations.openTrove(assetAddress1, 0, dec(5, 15), dec(30000, 18), A, A, { from: D, value: dec(1000, 'ether') }), "Fee exceeded provided maximum")
    })

    it("openTrove(): succeeds when fee is less than max fee percentage", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      let borrowingRate = await troveManager.getBorrowingRate(assetAddress1) // expect min(0.5 + 5%, 5%) rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee > 5%
      const moreThan5pct = '50000000000000001'
      const tx1 = await borrowerOperations.openTrove(assetAddress1, dec(100, 'ether') , moreThan5pct, dec(10000, 18), A, A, { from: D})
      assert.isTrue(tx1.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate(assetAddress1) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee = 5%
      const tx2 = await borrowerOperations.openTrove(assetAddress1, dec(100, 'ether') , dec(5, 16), dec(10000, 18), A, A, { from: H})
      assert.isTrue(tx2.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate(assetAddress1) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee 10%
      const tx3 = await borrowerOperations.openTrove(assetAddress1, dec(100, 'ether') , dec(1, 17), dec(10000, 18), A, A, { from: E })
      assert.isTrue(tx3.receipt.status)

      borrowingRate = await troveManager.getBorrowingRate(assetAddress1) // expect 5% rate
      assert.equal(borrowingRate, dec(5, 16))

      // Attempt with maxFee 37.659%
      const tx4 = await borrowerOperations.openTrove(assetAddress1, dec(100, 'ether'), dec(37659, 13), dec(10000, 18), A, A, { from: F })
      assert.isTrue(tx4.receipt.status)

      // Attempt with maxFee 100%
      const tx5 = await borrowerOperations.openTrove(assetAddress1, dec(100, 'ether') , dec(1, 18), dec(10000, 18), A, A, { from: G })
      assert.isTrue(tx5.receipt.status)
    })

    it("openTrove(): borrower can't grief the baseRate and stop it decaying by issuing debt at higher frequency than the decay granularity", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 59 minutes pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Assume Borrower also owns accounts D and E
      // Borrower triggers a fee, before decay interval has passed
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // 1 minute pass
      th.fastForwardTime(3540, web3.currentProvider)

      // Borrower triggers another fee
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(1, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: E } })

      // Check base rate has decreased even though Borrower tried to stop it decaying
      const baseRate_2 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_2.lt(baseRate_1))
    })

    it("openTrove(): borrowing at non-zero base rate sends KUSD fee to KUMO staking contract", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 KUMO
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
      await kumoStaking.stake(dec(1, 18), { from: multisig })

      // Check KUMO KUSD balance before == 0
      const kumoStaking_KUSDBalance_Before = await kusdToken.balanceOf(kumoStaking.address)
      assert.equal(kumoStaking_KUSDBalance_Before, '0')

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check KUMO KUSD balance after has increased
      const kumoStaking_KUSDBalance_After = await kusdToken.balanceOf(kumoStaking.address)
      assert.isTrue(kumoStaking_KUSDBalance_After.gt(kumoStaking_KUSDBalance_Before))
    })

    if (!withProxy) { // TODO: use rawLogs instead of logs
      it("openTrove(): borrowing at non-zero base records the (drawn debt + fee  + liq. reserve) on the Trove struct", async () => {
        // time fast-forwards 1 year, and multisig stakes 1 KUMO
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
        await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
        await kumoStaking.stake(dec(1, 18), { from: multisig })

        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
        await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

        // Artificially make baseRate 5%
        await troveManager.setBaseRate(assetAddress1, dec(5, 16))
        await troveManager.setLastFeeOpTimeToNow(assetAddress1)

        // Check baseRate is now non-zero
        const baseRate_1 = await troveManager.baseRate(assetAddress1)
        assert.isTrue(baseRate_1.gt(toBN('0')))

        // 2 hours pass
        th.fastForwardTime(7200, web3.currentProvider)

        const D_KUSDRequest = toBN(dec(20000, 18))

        // D withdraws KUSD
        const openTroveTx = await borrowerOperations.openTrove(assetAddress1, dec(200, 'ether'), th._100pct, D_KUSDRequest, assetAddress1, assetAddress1, { from: D })

        const emittedFee = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(openTroveTx))
        assert.isTrue(toBN(emittedFee).gt(toBN('0')))

        const newDebt = (await troveManager.Troves(D, assetAddress1))[0]

        // Check debt on Trove struct equals drawn debt plus emitted fee
        th.assertIsApproximatelyEqual(newDebt, D_KUSDRequest.add(emittedFee).add(KUSD_GAS_COMPENSATION), 100000)
      })
    }

    it("openTrove(): Borrowing at non-zero base rate increases the KUMO staking contract KUSD fees-per-unit-staked", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 KUMO
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
      await kumoStaking.stake(dec(1, 18), { from: multisig })

      // Check KUMO contract KUSD fees-per-unit-staked is zero
      const F_KUSD_Before = await kumoStaking.F_KUSD()
      assert.equal(F_KUSD_Before, '0')

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is now non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check KUMO contract KUSD fees-per-unit-staked has increased
      const F_KUSD_After = await kumoStaking.F_KUSD()
      assert.isTrue(F_KUSD_After.gt(F_KUSD_Before))
    })

    it("openTrove(): Borrowing at non-zero base rate sends requested amount to the user", async () => {
      // time fast-forwards 1 year, and multisig stakes 1 KUMO
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig })
      await kumoStaking.stake(dec(1, 18), { from: multisig })

      // Check KUMO Staking contract balance before == 0
      const kumoStaking_KUSDBalance_Before = await kusdToken.balanceOf(kumoStaking.address)
      assert.equal(kumoStaking_KUSDBalance_Before, '0')

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(30000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(40000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Artificially make baseRate 5%
      await troveManager.setBaseRate(assetAddress1, dec(5, 16))
      await troveManager.setLastFeeOpTimeToNow(assetAddress1)

      // Check baseRate is non-zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.isTrue(baseRate_1.gt(toBN('0')))

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // D opens trove 
      const KUSDRequest_D = toBN(dec(40000, 18))
      await borrowerOperations.openTrove(assetAddress1, dec(500, 'ether'), th._100pct, KUSDRequest_D, D, D, { from: D })

      // Check KUMO staking KUSD balance has increased
      const kumoStaking_KUSDBalance_After = await kusdToken.balanceOf(kumoStaking.address)
      assert.isTrue(kumoStaking_KUSDBalance_After.gt(kumoStaking_KUSDBalance_Before))

      // Check D's KUSD balance now equals their requested KUSD
      const KUSDBalance_D = await kusdToken.balanceOf(D)
      assert.isTrue(KUSDRequest_D.eq(KUSDBalance_D))
    })

    it("openTrove(): Borrowing at zero base rate changes the KUMO staking contract KUSD fees-per-unit-staked", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: C } })

      // Check baseRate is zero
      const baseRate_1 = await troveManager.baseRate(assetAddress1)
      assert.equal(baseRate_1, '0')

      // 2 hours pass
      th.fastForwardTime(7200, web3.currentProvider)

      // Check KUSD reward per KUMO staked == 0
      const F_KUSD_Before = await kumoStaking.F_KUSD()
      assert.equal(F_KUSD_Before, '0')

      // A stakes KUMO
      await kumoToken.unprotectedMint(A, dec(100, 18))
      await kumoStaking.stake(dec(100, 18), { from: A })

      // D opens trove 
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(37, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: D } })

      // Check KUSD reward per KUMO staked > 0
      const F_KUSD_After = await kumoStaking.F_KUSD()
      assert.isTrue(F_KUSD_After.gt(toBN('0')))
    })

    it("openTrove(): Borrowing at zero base rate charges minimum fee", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: B } })

      const KUSDRequest = toBN(dec(10000, 18))
      const txC = await borrowerOperations.openTrove(assetAddress1, dec(100, 'ether'), th._100pct, KUSDRequest, assetAddress1, assetAddress1, { from: C })
      const _KUSDFee = toBN(th.getEventArgByName(txC, "KUSDBorrowingFeePaid", "_KUSDFee"))

      const expectedFee = BORROWING_FEE_FLOOR.mul(toBN(KUSDRequest)).div(toBN(dec(1, 18)))
      assert.isTrue(_KUSDFee.eq(expectedFee))
    })

    it("openTrove(): reverts when system is in Recovery Mode and ICR < CCR", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      // Bob tries to open a trove with 149% ICR during Recovery Mode
      try {
        const txBob = await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: alice } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts when trove ICR < MCR", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1))

      // Bob attempts to open a 109% ICR trove in Normal Mode
      try {
        const txBob = (await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })).tx
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }

      // price drops, and Recovery Mode kicks in
      await priceFeed.setPrice(dec(105, 18))

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      // Bob attempts to open a 109% ICR trove in Recovery Mode
      try {
        const txBob = await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(109, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts when opening the trove would cause the TCR of the system to fall below the CCR", async () => {
      await priceFeed.setPrice(dec(100, 18))

      // Alice creates trove with 150% ICR.  System TCR = 150%.
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const TCR = await th.getTCR(contracts, assetAddress1)
      assert.equal(TCR, dec(150, 16))

      // Bob attempts to open a trove with ICR = 149% 
      // System TCR would fall below 150%
      try {
        const txBob = await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(149, 16)), extraParams: { from: bob } })
        assert.isFalse(txBob.receipt.status)
      } catch (err) {
        assert.include(err.message, "revert")
      }
    })

    it("openTrove(): reverts if trove is already active", async () => {
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(10, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      try {
        const txB_1 = await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(3, 18)), extraParams: { from: bob } })

        assert.isFalse(txB_1.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }

      try {
        const txB_2 = await openTrove({ asset: assetAddress1,  ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

        assert.isFalse(txB_2.receipt.status)
      } catch (err) {
        assert.include(err.message, 'revert')
      }
    })

    it("openTrove(): Can open a trove with ICR >= CCR when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      const TCR = (await th.getTCR(contracts, assetAddress1)).toString()
      assert.equal(TCR, '1500000000000000000')

      // price drops to 1ETH:100KUSD, reducing TCR below 150%
      await priceFeed.setPrice('100000000000000000000');
      const price = await priceFeed.getPrice()

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      // Carol opens at 150% ICR in Recovery Mode
      const txCarol = (await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: carol } })).tx
      assert.isTrue(txCarol.receipt.status)
      assert.isTrue(await sortedTroves.contains(assetAddress1, carol))

      const carol_TroveStatus = await troveManager.getTroveStatus(assetAddress1,  carol)
      assert.equal(carol_TroveStatus, 1)

      const carolICR = await troveManager.getCurrentICR(assetAddress1, carol, price)
      assert.isTrue(carolICR.gt(toBN(dec(150, 16))))
    })

    it("openTrove(): Reverts opening a trove with min debt when system is in Recovery Mode", async () => {
      // --- SETUP ---
      //  Alice and Bob add coll and withdraw such  that the TCR is ~150%
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: bob } })

      const TCR = (await th.getTCR(contracts, assetAddress1)).toString()
      assert.equal(TCR, '1500000000000000000')

      // price drops to 1ETH:100KUSD, reducing TCR below 150%
      await priceFeed.setPrice('100000000000000000000');

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1))

      await assertRevert(borrowerOperations.openTrove(assetAddress1, 0, th._100pct, await getNetBorrowingAmount(MIN_NET_DEBT, assetAddress1), carol, carol, { from: carol, value: dec(1, 'ether') }))
    })

    it("openTrove(): creates a new Trove and assigns the correct collateral and debt amount", async () => {
      const debt_Before = await getTroveEntireDebt(alice, assetAddress1)
      const coll_Before = await getTroveEntireColl(alice, assetAddress1)
      const status_Before = await troveManager.getTroveStatus(assetAddress1, alice)

      // check coll and debt before
      assert.equal(debt_Before, 0)
      assert.equal(coll_Before, 0)

      // check non-existent status
      assert.equal(status_Before, 0)

      const KUSDRequest = MIN_NET_DEBT
      borrowerOperations.openTrove(assetAddress1, dec(100, 'ether') , th._100pct, MIN_NET_DEBT, carol, carol, { from: alice })

      // Get the expected debt based on the KUSD request (adding fee and liq. reserve on top)
      const expectedDebt = KUSDRequest
        .add(await troveManager.getBorrowingFee(assetAddress1, KUSDRequest))
        .add(KUSD_GAS_COMPENSATION)

      
      const coll_After = await getTroveEntireColl(alice, assetAddress1)
      const debt_After = await getTroveEntireDebt(alice, assetAddress1)
      const status_After = await troveManager.getTroveStatus(assetAddress1, alice)

      // check coll and debt after
      assert.isTrue(coll_After.gt('0'))
      assert.isTrue(debt_After.gt('0'))

      assert.isTrue(debt_After.eq(expectedDebt))

      // check active status
      assert.equal(status_After, 1)
    })

    it("openTrove(): adds Trove owner to TroveOwners array", async () => {
      const TroveOwnersCount_Before = (await troveManager.getTroveOwnersCount(assetAddress1)).toString();
      assert.equal(TroveOwnersCount_Before, '0')

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(15, 17)), extraParams: { from: alice } })

      const TroveOwnersCount_After = (await troveManager.getTroveOwnersCount(assetAddress1)).toString();
      assert.equal(TroveOwnersCount_After, '1')
    })

    it("openTrove(): creates a stake and adds it to total stakes", async () => {
      const aliceStakeBefore = await getTroveStake(alice)
      const totalStakesBefore = await troveManager.totalStakes(assetAddress1)

      assert.equal(aliceStakeBefore, '0')
      assert.equal(totalStakesBefore, '0')

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollAfter = await getTroveEntireColl(alice, assetAddress1)
      const aliceStakeAfter = await getTroveStake(alice, assetAddress1)
      assert.isTrue(aliceCollAfter.gt(toBN('0')))
      assert.isTrue(aliceStakeAfter.eq(aliceCollAfter))

      const totalStakesAfter = await troveManager.totalStakes(assetAddress1)

      assert.isTrue(totalStakesAfter.eq(aliceStakeAfter))
    })

    it("openTrove(): inserts Trove to Sorted Troves list", async () => {
      // Check before
      const aliceTroveInList_Before = await sortedTroves.contains(assetAddress1, alice)
      const listIsEmpty_Before = await sortedTroves.isEmpty(assetAddress1)
      assert.equal(aliceTroveInList_Before, false)
      assert.equal(listIsEmpty_Before, true)

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // check after
      const aliceTroveInList_After = await sortedTroves.contains(assetAddress1, alice)
      const listIsEmpty_After = await sortedTroves.isEmpty(assetAddress1)
      assert.equal(aliceTroveInList_After, true)
      assert.equal(listIsEmpty_After, false)
    })

    it("openTrove(): Increases the activePool ETH and raw ether balance by correct amount", async () => {
      const activePool_ETH_Before = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_Before = await erc20.balanceOf(activePool.address)
      assert.equal(activePool_ETH_Before, 0)
      assert.equal(activePool_RawEther_Before, 0)

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceCollAfter = await getTroveEntireColl(alice, assetAddress1)

      const activePool_ETH_After = await activePool.getAssetBalance(assetAddress1)
      const activePool_RawEther_After = toBN(await erc20.balanceOf(activePool.address))
      assert.isTrue(activePool_ETH_After.eq(aliceCollAfter))
      assert.isTrue(activePool_RawEther_After.eq(aliceCollAfter))
    })

    it("openTrove(): records up-to-date initial snapshots of L_ETH and L_KUSDDebt", async () => {
      // --- SETUP ---

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // --- TEST ---

      // price drops to 1ETH:100KUSD, reducing Carol's ICR below MCR
      await priceFeed.setPrice(dec(100, 18));

      // close Carol's Trove, liquidating her 1 ether and 180KUSD.
      const liquidationTx = await troveManager.liquidate(assetAddress1, carol, { from: owner });
      const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

      /* with total stakes = 10 ether, after liquidation, L_ETH should equal 1/10 ether per-ether-staked,
       and L_KUSD should equal 18 KUSD per-ether-staked. */

      const L_ETH = await troveManager.L_ASSETS(assetAddress1)
      const L_KUSD = await troveManager.L_KUSDDebts(assetAddress1)

      assert.isTrue(L_ETH.gt(toBN('0')))
      assert.isTrue(L_KUSD.gt(toBN('0')))

      // Bob opens trove
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: bob } })

      // Check Bob's snapshots of L_ETH and L_KUSD equal the respective current values
      const bob_rewardSnapshot = await troveManager.rewardSnapshots(bob, assetAddress1)
      const bob_ETHrewardSnapshot = bob_rewardSnapshot[0]
      const bob_KUSDDebtRewardSnapshot = bob_rewardSnapshot[1]

      assert.isAtMost(th.getDifference(bob_ETHrewardSnapshot, L_ETH), 1000)
      assert.isAtMost(th.getDifference(bob_KUSDDebtRewardSnapshot, L_KUSD), 1000)
    })

    it("openTrove(): allows a user to open a Trove, then close it, then re-open it", async () => {
      // Open Troves
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: carol } })

      // Check Trove is active
      const alice_Trove_1 = await troveManager.Troves(alice, assetAddress1)
      const status_1 = alice_Trove_1[4]
      assert.equal(status_1, 1)
      assert.isTrue(await sortedTroves.contains(assetAddress1, alice))

      // to compensate borrowing fees
      await kusdToken.transfer(alice, dec(10000, 18), { from: whale })

      // Repay and close Trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })

      // Check Trove is closed
      const alice_Trove_2 = await troveManager.Troves(alice, assetAddress1)
      const status_2 = alice_Trove_2[4]
      assert.equal(status_2, 2)
      assert.isFalse(await sortedTroves.contains(assetAddress1, alice))

      // Re-open Trove
      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(5000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })

      // Check Trove is re-opened
      const alice_Trove_3 = await troveManager.Troves(alice, assetAddress1)
      const status_3 = alice_Trove_3[4]
      assert.equal(status_3, 1)
      assert.isTrue(await sortedTroves.contains(assetAddress1, alice))
    })

    it("openTrove(): increases the Trove's KUSD debt by the correct amount", async () => {
      // check before
      const alice_Trove_Before = await troveManager.Troves(alice, assetAddress1)
      const debt_Before = alice_Trove_Before[1]
      assert.equal(debt_Before, 0)

      await borrowerOperations.openTrove(assetAddress1, dec(100, 'ether'), th._100pct, await getOpenTroveKUSDAmount(dec(10000, 18), assetAddress1), alice, alice, { from: alice })

      // check after
      const alice_Trove_After = await troveManager.Troves(alice, assetAddress1)
      const debt_After = alice_Trove_After[1]
      th.assertIsApproximatelyEqual(debt_After, dec(10000, 18), 10000)
    })

    it("openTrove(): increases KUSD debt in ActivePool by the debt of the trove", async () => {
      const activePool_KUSDDebt_Before = await activePool.getKUSDDebt(assetAddress1)
      assert.equal(activePool_KUSDDebt_Before, 0)

      await openTrove({ asset: assetAddress1,  extraKUSDAmount: toBN(dec(10000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: alice } })
      const aliceDebt = await getTroveEntireDebt(alice, assetAddress1)
      assert.isTrue(aliceDebt.gt(toBN('0')))

      const activePool_KUSDDebt_After = await activePool.getKUSDDebt(assetAddress1)
      assert.isTrue(activePool_KUSDDebt_After.eq(aliceDebt))
    })

    it("openTrove(): increases user KUSDToken balance by correct amount", async () => {
      // check before
      const alice_KUSDTokenBalance_Before = await kusdToken.balanceOf(alice)
      assert.equal(alice_KUSDTokenBalance_Before, 0)

      await borrowerOperations.openTrove(assetAddress1, dec(100, 'ether'), th._100pct, dec(10000, 18), alice, alice, { from: alice })

      // check after
      const alice_KUSDTokenBalance_After = await kusdToken.balanceOf(alice)
      assert.equal(alice_KUSDTokenBalance_After, dec(10000, 18))
    })

    //  --- getNewICRFromTroveChange - (external wrapper in Tester contract calls internal function) ---

    describe("getNewICRFromTroveChange() returns the correct ICR", async () => {


      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.isAtMost(th.getDifference(newICR, '1333333333333333333'), 100)
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = 0
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, false, price)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '4000000000000000000')
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = 0

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, true, price)).toString()
        assert.equal(newICR, '1000000000000000000')
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, false, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, true, price)).toString()
        assert.equal(newICR, '2000000000000000000')
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(1, 'ether')
        const debtChange = dec(50, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, true, debtChange, false, price)).toString()
        assert.equal(newICR, '8000000000000000000')
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        price = await priceFeed.getPrice()
        const initialColl = dec(1, 'ether')
        const initialDebt = dec(100, 18)
        const collChange = dec(5, 17)
        const debtChange = dec(100, 18)

        const newICR = (await borrowerOperations.getNewICRFromTroveChange(initialColl, initialDebt, collChange, false, debtChange, true, price)).toString()
        assert.equal(newICR, '500000000000000000')
      })
    })

    // --- getCompositeDebt ---

    it("getCompositeDebt(): returns debt + gas comp", async () => {
      const res1 = await borrowerOperations.getCompositeDebt(assetAddress1, '0')
      assert.equal(res1, KUSD_GAS_COMPENSATION.toString())

      const res2 = await borrowerOperations.getCompositeDebt(assetAddress1, dec(90, 18))
      th.assertIsApproximatelyEqual(res2, KUSD_GAS_COMPENSATION.add(toBN(dec(90, 18))))

      const res3 = await borrowerOperations.getCompositeDebt(assetAddress1, dec(24423422357345049, 12))
      th.assertIsApproximatelyEqual(res3, KUSD_GAS_COMPENSATION.add(toBN(dec(24423422357345049, 12))))
    })

    //  --- getNewTCRFromTroveChange  - (external wrapper in Tester contract calls internal function) ---

    describe("getNewTCRFromTroveChange() returns the correct TCR", async () => {

      // 0, 0
      it("collChange = 0, debtChange = 0", async () => {
        // --- SETUP --- Create a Kumo instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveKUSDAmount = await getOpenTroveKUSDAmount(troveTotalDebt, assetAddress1)
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(assetAddress1, bob)
        assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = 0
        const newTCR = await borrowerOperations.getNewTCRFromTroveChange(assetAddress1, collChange, true, debtChange, true, price)

        const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // 0, +ve
      it("collChange = 0, debtChange is positive", async () => {
        // --- SETUP --- Create a Kumo instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveKUSDAmount = await getOpenTroveKUSDAmount(troveTotalDebt, assetAddress1)
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, alice, alice, { from: alice })
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(assetAddress1, bob)
        assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = 0
        const debtChange = dec(200, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(assetAddress1, collChange, true, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // 0, -ve
      it("collChange = 0, debtChange is negative", async () => {
        // --- SETUP --- Create a Kumo instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveKUSDAmount = await getOpenTroveKUSDAmount(troveTotalDebt, assetAddress1)
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, alice, alice, { from: alice })
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(assetAddress1, bob)
        assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = 0
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(assetAddress1, collChange, true, debtChange, false, price))

        const expectedTCR = (troveColl.add(liquidatedColl)).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, 0
      it("collChange is positive, debtChange is 0", async () => {
        // --- SETUP --- Create a Kumo instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveKUSDAmount = await getOpenTroveKUSDAmount(troveTotalDebt, assetAddress1)
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, alice, alice, { from: alice })
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, bob, bob, { from: bob})

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(assetAddress1, bob)
        assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()
        // --- TEST ---
        const collChange = dec(2, 'ether')
        const debtChange = 0
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(assetAddress1, collChange, true, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, 0
      it("collChange is negative, debtChange is 0", async () => {
        // --- SETUP --- Create a Kumo instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveKUSDAmount = await getOpenTroveKUSDAmount(troveTotalDebt, assetAddress1)
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, alice, alice, { from: alice })
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(assetAddress1, bob)
        assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = 0
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(assetAddress1, collChange, false, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, -ve
      it("collChange is negative, debtChange is negative", async () => {
        // --- SETUP --- Create a Kumo instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveKUSDAmount = await getOpenTroveKUSDAmount(troveTotalDebt, assetAddress1)
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, alice, alice, { from: alice})
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(assetAddress1, bob)
        assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(assetAddress1, collChange, false, debtChange, false, price))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, +ve 
      it("collChange is positive, debtChange is positive", async () => {
        // --- SETUP --- Create a Kumo instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveKUSDAmount = await getOpenTroveKUSDAmount(troveTotalDebt, assetAddress1)
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, alice, alice, { from: alice })
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(assetAddress1, bob)
        assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(assetAddress1, collChange, true, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).add(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // +ve, -ve
      it("collChange is positive, debtChange is negative", async () => {
        // --- SETUP --- Create a Kumo instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveKUSDAmount = await getOpenTroveKUSDAmount(troveTotalDebt, assetAddress1)
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, alice, alice, { from: alice  })
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, bob, bob, { from: bob })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(assetAddress1, bob)
        assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 'ether')
        const debtChange = dec(100, 18)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(assetAddress1, collChange, true, debtChange, false, price))

        const expectedTCR = (troveColl.add(liquidatedColl).add(toBN(dec(1, 'ether')))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).sub(toBN(dec(100, 18))))

        assert.isTrue(newTCR.eq(expectedTCR))
      })

      // -ve, +ve
      it("collChange is negative, debtChange is positive", async () => {
        // --- SETUP --- Create a Kumo instance with an Active Pool and pending rewards (Default Pool)
        const troveColl = toBN(dec(1000, 'ether'))
        const troveTotalDebt = toBN(dec(100000, 18))
        const troveKUSDAmount = await getOpenTroveKUSDAmount(troveTotalDebt, assetAddress1)
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, alice, alice, { from: alice, value: troveColl })
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, troveKUSDAmount, bob, bob, { from: bob, value: troveColl })

        await priceFeed.setPrice(dec(100, 18))

        const liquidationTx = await troveManager.liquidate(assetAddress1, bob)
        assert.isFalse(await sortedTroves.contains(assetAddress1, bob))

        const [liquidatedDebt, liquidatedColl, gasComp] = th.getEmittedLiquidationValues(liquidationTx)

        await priceFeed.setPrice(dec(200, 18))
        const price = await priceFeed.getPrice()

        // --- TEST ---
        const collChange = dec(1, 18)
        const debtChange = await getNetBorrowingAmount(dec(200, 18), assetAddress1)
        const newTCR = (await borrowerOperations.getNewTCRFromTroveChange(assetAddress1, collChange, false, debtChange, true, price))

        const expectedTCR = (troveColl.add(liquidatedColl).sub(toBN(collChange))).mul(price)
          .div(troveTotalDebt.add(liquidatedDebt).add(toBN(debtChange)))

        assert.isTrue(newTCR.eq(expectedTCR))
      })
    })

    if (!withProxy) {
      it('closeTrove(): fails if owner cannot receive ETH', async () => {
        const nonPayable = await NonPayable.new()
        const troveColl = dec(1000, 18)

        // we need 2 troves to be able to close 1 and have 1 remaining in the system
        await borrowerOperations.openTrove(assetAddress1, troveColl, th._100pct, dec(100000, 18), alice, alice, { from: alice })

        // Alice sends KUSD to NonPayable so its KUSD balance covers its debt
        await kusdToken.transfer(nonPayable.address, dec(10000, 18), {from: alice})

        // open trove from NonPayable proxy contract
        const _100pctHex = '0xde0b6b3a7640000'
        const _1e25Hex = '0xd3c21bcecceda1000000'
        const _10000Ether = '0x21e19e0c9bab2400000'
        const openTroveData = th.getTransactionData('openTrove(address,uint256,uint256,uint256,address,address)', [assetAddress1, _10000Ether, _100pctHex, _1e25Hex, '0x0', '0x0'])

        await nonPayable.forward(borrowerOperations.address, openTroveData)
        assert.equal((await troveManager.getTroveStatus(assetAddress1, nonPayable.address)).toString(), '1', 'NonPayable proxy should have a trove')
        assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1), 'System should not be in Recovery Mode')
        const closeTroveData = th.getTransactionData('closeTrove(address)', [assetAddress1])

        await th.assertRevert(nonPayable.forward(borrowerOperations.address, closeTroveData), 'ActivePool: sending ETH failed')
      })
    }
  }

  describe('Without proxy', async () => {
    testCorpus({ withProxy: false })
  })

  // describe('With proxy', async () => {
  //   testCorpus({ withProxy: true })
  // })
})

contract('Reset chain state', async accounts => { })

/* TODO:
 1) Test SortedList re-ordering by ICR. ICR ratio
 changes with addColl, withdrawColl, withdrawKUSD, repayKUSD, etc. Can split them up and put them with
 individual functions, or give ordering it's own 'describe' block.
 2)In security phase:
 -'Negative' tests for all the above functions.
 */