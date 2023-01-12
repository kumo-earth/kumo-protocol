const { MAX_UINT256 } = require("@openzeppelin/test-helpers/src/constants.js")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")

const SortedTroves = artifacts.require("SortedTroves")
const SortedTrovesTester = artifacts.require("SortedTrovesTester")
const TroveManagerTester = artifacts.require("TroveManagerTester")
const KUSDToken = artifacts.require("KUSDToken")

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const mv = testHelpers.MoneyValues
const TroveData = testHelpers.TroveData

contract('SortedTroves', async accounts => {

  const assertSortedListIsOrdered = async (contracts, asset) => {
    const price = await contracts.priceFeedTestnet.getPrice()

    let trove = await contracts.sortedTroves.getLast(asset)
    while (trove !== (await contracts.sortedTroves.getFirst(asset))) {

      // Get the adjacent upper trove ("prev" moves up the list, from lower ICR -> higher ICR)
      const prevTrove = await contracts.sortedTroves.getPrev(asset, trove)

      const troveICR = await contracts.troveManager.getCurrentICR(asset, trove, price)
      const prevTroveICR = await contracts.troveManager.getCurrentICR(asset, prevTrove, price)

      assert.isTrue(prevTroveICR.gte(troveICR))

      const troveNICR = await contracts.troveManager.getNominalICR(asset, trove)
      const prevTroveNICR = await contracts.troveManager.getNominalICR(asset, prevTrove)

      assert.isTrue(prevTroveNICR.gte(troveNICR))

      // climb the list
      trove = prevTrove
    }
  }

  const [
    owner,
    alice, bob, carol, dennis, erin, flyn, graham, harriet, ida,
    defaulter_1, defaulter_2, defaulter_3, defaulter_4,
    A, B, C, D, E, F, G, H, I, J, whale] = accounts;

  let priceFeed
  let sortedTroves
  let troveManager
  let borrowerOperations
  let kusdToken
  let KUMOContracts
  let erc20Asset1


  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let contracts

  const getOpenTroveKUSDAmount = async (totalDebt) => th.getOpenTroveKUSDAmount(contracts, totalDebt)
  const openTrove = async (params) => th.openTrove(contracts, params)

  describe('SortedTroves', () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployKumoCore()
      contracts.troveManager = await TroveManagerTester.new()
      contracts.kusdToken = await KUSDToken.new(
        contracts.troveManager.address,
        contracts.stabilityPoolFactory.address,
        contracts.borrowerOperations.address
      )
      KUMOContracts = await deploymentHelper.deployKUMOContracts(bountyAddress, lpRewardsAddress, multisig)
      erc20Asset1 = await deploymentHelper.deployERC20Asset()
      assetAddress1 = erc20Asset1.address

      priceFeed = contracts.priceFeedTestnet
      sortedTroves = contracts.sortedTroves
      troveManager = contracts.troveManager
      borrowerOperations = contracts.borrowerOperations
      kusdToken = contracts.kusdToken

      await deploymentHelper.connectKUMOContracts(KUMOContracts)
      await deploymentHelper.connectCoreContracts(contracts, KUMOContracts)
      await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, contracts)

      // Add asset to the system
      await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress1)

      // Mint token to each acccount
    await deploymentHelper.mintMockAssets(erc20Asset1, accounts, 25)
    })

    it('contains(): returns true for addresses that have opened troves', async () => {
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // Confirm trove statuses became active
      assert.equal((await troveManager.Troves(alice, assetAddress1))[TroveData.status], '1')
      assert.equal((await troveManager.Troves(bob, assetAddress1))[TroveData.status], '1')
      assert.equal((await troveManager.Troves(carol, assetAddress1))[TroveData.status], '1')

      // Check sorted list contains troves
      assert.isTrue(await sortedTroves.contains(assetAddress1, alice))
      assert.isTrue(await sortedTroves.contains(assetAddress1, bob))
      assert.isTrue(await sortedTroves.contains(assetAddress1, carol))
    })

    it('contains(): returns false for addresses that have not opened troves', async () => {
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // Confirm troves have non-existent status
      assert.equal((await troveManager.Troves(dennis, assetAddress1))[TroveData.status], '0')
      assert.equal((await troveManager.Troves(erin, assetAddress1))[TroveData.status], '0')

      // Check sorted list do not contain troves
      assert.isFalse(await sortedTroves.contains(assetAddress1, dennis))
      assert.isFalse(await sortedTroves.contains(assetAddress1, erin))
    })

    it('contains(): returns false for addresses that opened and then closed a trove', async () => {
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(1000, 18)), extraKUSDAmount: toBN(dec(3000, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // to compensate borrowing fees
      await kusdToken.transfer(alice, dec(1000, 18), { from: whale })
      await kusdToken.transfer(bob, dec(1000, 18), { from: whale })
      await kusdToken.transfer(carol, dec(1000, 18), { from: whale })

      // A, B, C close troves
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })
      await borrowerOperations.closeTrove(assetAddress1, { from: bob })
      await borrowerOperations.closeTrove(assetAddress1, { from: carol })

      // Confirm trove statuses became closed
      assert.equal((await troveManager.Troves(alice, assetAddress1))[TroveData.status], '2')
      assert.equal((await troveManager.Troves(bob, assetAddress1))[TroveData.status], '2')
      assert.equal((await troveManager.Troves(carol, assetAddress1))[TroveData.status], '2')

      // Check sorted list does not contain troves
      assert.isFalse(await sortedTroves.contains(assetAddress1, alice))
      assert.isFalse(await sortedTroves.contains(assetAddress1, bob))
      assert.isFalse(await sortedTroves.contains(assetAddress1, carol))
    })

    // true for addresses that opened -> closed -> opened a trove
    it('contains(): returns true for addresses that opened, closed and then re-opened a trove', async () => {
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(1000, 18)), extraKUSDAmount: toBN(dec(3000, 18)), extraParams: { from: whale } })

      await openTrove({ asset: assetAddress1, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(20, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2000, 18)), extraParams: { from: carol } })

      // to compensate borrowing fees
      await kusdToken.transfer(alice, dec(1000, 18), { from: whale })
      await kusdToken.transfer(bob, dec(1000, 18), { from: whale })
      await kusdToken.transfer(carol, dec(1000, 18), { from: whale })

      // A, B, C close troves
      await borrowerOperations.closeTrove(assetAddress1, { from: alice })
      await borrowerOperations.closeTrove(assetAddress1, { from: bob })
      await borrowerOperations.closeTrove(assetAddress1, { from: carol })

      // Confirm trove statuses became closed
      assert.equal((await troveManager.Troves(alice, assetAddress1))[TroveData.status], '2')
      assert.equal((await troveManager.Troves(bob, assetAddress1))[TroveData.status], '2')
      assert.equal((await troveManager.Troves(carol, assetAddress1))[TroveData.status], '2')

      await openTrove({ asset: assetAddress1, ICR: toBN(dec(1000, 16)), extraParams: { from: alice } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2000, 18)), extraParams: { from: bob } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(3000, 18)), extraParams: { from: carol } })

      // Confirm trove statuses became open again
      assert.equal((await troveManager.Troves(alice, assetAddress1))[TroveData.status], '1')
      assert.equal((await troveManager.Troves(bob, assetAddress1))[TroveData.status], '1')
      assert.equal((await troveManager.Troves(carol, assetAddress1))[TroveData.status], '1')

      // Check sorted list does  contain troves
      assert.isTrue(await sortedTroves.contains(assetAddress1, alice))
      assert.isTrue(await sortedTroves.contains(assetAddress1, bob))
      assert.isTrue(await sortedTroves.contains(assetAddress1, carol))
    })

    // false when list size is 0
    it('contains(): returns false when there are no troves in the system', async () => {
      assert.isFalse(await sortedTroves.contains(assetAddress1, alice))
      assert.isFalse(await sortedTroves.contains(assetAddress1, bob))
      assert.isFalse(await sortedTroves.contains(assetAddress1, carol))
    })

    // true when list size is 1 and the trove the only one in system
    it('contains(): true when list size is 1 and the trove the only one in system', async () => {
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })

      assert.isTrue(await sortedTroves.contains(assetAddress1, alice))
    })

    // false when list size is 1 and trove is not in the system
    it('contains(): false when list size is 1 and trove is not in the system', async () => {
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(150, 16)), extraParams: { from: alice } })

      assert.isFalse(await sortedTroves.contains(assetAddress1, bob))
    })

    // --- getMaxSize ---

    it("getMaxSize(): Returns the maximum list size", async () => {
      const max = await sortedTroves.getMaxSize(assetAddress1)
      assert.equal(web3.utils.toHex(max), th.maxBytes32)
    })

    // --- findInsertPosition ---

    it("Finds the correct insert position given two addresses that loosely bound the correct position", async () => {
      await priceFeed.setPrice(assetAddress1, dec(100, 18))

      // NICR sorted in descending order
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(500, 18)), extraParams: { from: whale } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(10, 18)), extraParams: { from: A } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(5, 18)), extraParams: { from: B } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(250, 16)), extraParams: { from: C } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(166, 16)), extraParams: { from: D } })
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(125, 16)), extraParams: { from: E } })

      // Expect a trove with NICR 300% to be inserted between B and C
      const targetNICR = dec(3, 18)

      // Pass addresses that loosely bound the right postiion
      const hints = await sortedTroves.findInsertPosition(assetAddress1, targetNICR, A, E)

      // Expect the exact correct insert hints have been returned
      assert.equal(hints[0], B)
      assert.equal(hints[1], C)

      // The price doesn’t affect the hints
      await priceFeed.setPrice(assetAddress1, dec(500, 18))
      const hints2 = await sortedTroves.findInsertPosition(assetAddress1, targetNICR, A, E)

      // Expect the exact correct insert hints have been returned
      assert.equal(hints2[0], B)
      assert.equal(hints2[1], C)
    })

    //--- Ordering --- 
    // infinte ICR (zero collateral) is not possible anymore, therefore, skipping
    it.skip("stays ordered after troves with 'infinite' ICR receive a redistribution", async () => {

      // make several troves with 0 debt and collateral, in random order
      await borrowerOperations.openTrove(th._100pct, 0, whale, whale, { from: whale, value: dec(50, 'ether') })
      await borrowerOperations.openTrove(th._100pct, 0, A, A, { from: A, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(th._100pct, 0, B, B, { from: B, value: dec(37, 'ether') })
      await borrowerOperations.openTrove(th._100pct, 0, C, C, { from: C, value: dec(5, 'ether') })
      await borrowerOperations.openTrove(th._100pct, 0, D, D, { from: D, value: dec(4, 'ether') })
      await borrowerOperations.openTrove(th._100pct, 0, E, E, { from: E, value: dec(19, 'ether') })

      // Make some troves with non-zero debt, in random order
      await borrowerOperations.openTrove(th._100pct, dec(5, 19), F, F, { from: F, value: dec(1, 'ether') })
      await borrowerOperations.openTrove(th._100pct, dec(3, 18), G, G, { from: G, value: dec(37, 'ether') })
      await borrowerOperations.openTrove(th._100pct, dec(2, 20), H, H, { from: H, value: dec(5, 'ether') })
      await borrowerOperations.openTrove(th._100pct, dec(17, 18), I, I, { from: I, value: dec(4, 'ether') })
      await borrowerOperations.openTrove(th._100pct, dec(5, 21), J, J, { from: J, value: dec(1345, 'ether') })

      const price_1 = await priceFeed.getPrice(assetAddress1)

      // Check troves are ordered
      await assertSortedListIsOrdered(contracts)

      await borrowerOperations.openTrove(th._100pct, dec(100, 18), defaulter_1, defaulter_1, { from: defaulter_1, value: dec(1, 'ether') })
      assert.isTrue(await sortedTroves.contains(assetAddress1, defaulter_1))

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(100, 18))
      const price_2 = await priceFeed.getPrice(assetAddress1)

      // Liquidate a trove
      await troveManager.liquidate(defaulter_1)
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1))

      // Check troves are ordered
      await assertSortedListIsOrdered(contracts)
    })
  })

  describe('SortedTroves with mock dependencies', () => {
    let sortedTrovesTester

    beforeEach(async () => {
      sortedTroves = await SortedTroves.new()
      sortedTrovesTester = await SortedTrovesTester.new()

      await sortedTrovesTester.setSortedTroves(sortedTroves.address)
    })


    context('when params are properly set', () => {
      beforeEach('set params', async () => {
        await sortedTroves.setParams(sortedTrovesTester.address, sortedTrovesTester.address)
        await sortedTroves.addNewAsset(assetAddress1)
      })

      // Not needed because max_size is hardcoded in smart contract
      // it('insert(): fails if list is full', async () => {
      //   await sortedTrovesTester.insert(assetAddress1, alice, 1, alice, alice)
      //   await sortedTrovesTester.insert(assetAddress1, bob, 1, alice, alice)
      //   await th.assertRevert(sortedTrovesTester.insert(assetAddress1, carol, 1, alice, alice), 'SortedTroves: List is full')
      // })


      it('insert(): fails if id is zero', async () => {
        await th.assertRevert(sortedTrovesTester.insert(assetAddress1, th.ZERO_ADDRESS, 1, alice, alice), 'SortedTroves: Id cannot be zero')
      })

      it('insert(): fails if NICR is zero', async () => {
        await th.assertRevert(sortedTrovesTester.insert(assetAddress1, alice, 0, alice, alice), 'SortedTroves: NICR must be positive')
      })

      it('remove(): fails if id is not in the list', async () => {
        await th.assertRevert(sortedTrovesTester.remove(assetAddress1, alice), 'SortedTroves: List does not contain the id')
      })

      it('reInsert(): fails if list doesn’t contain the node', async () => {
        await th.assertRevert(sortedTrovesTester.reInsert(assetAddress1, alice, 1, alice, alice), 'SortedTroves: List does not contain the id')
      })

      it('reInsert(): fails if new NICR is zero', async () => {
        await sortedTrovesTester.insert(assetAddress1, alice, 1, alice, alice)
        assert.isTrue(await sortedTroves.contains(assetAddress1, alice), 'list should contain element')
        await th.assertRevert(sortedTrovesTester.reInsert(assetAddress1, alice, 0, alice, alice), 'SortedTroves: NICR must be positive')
        assert.isTrue(await sortedTroves.contains(assetAddress1, alice), 'list should contain element')
      })

      it('findInsertPosition(): No prevId for hint - ascend list starting from nextId, result is after the tail', async () => {
        await sortedTrovesTester.insert(assetAddress1, alice, 1, alice, alice)
        const pos = await sortedTroves.findInsertPosition(assetAddress1, 1, th.ZERO_ADDRESS, alice)
        assert.equal(pos[0], alice, 'prevId result should be nextId param')
        assert.equal(pos[1], th.ZERO_ADDRESS, 'nextId result should be zero')
      })
    })
  })
})
