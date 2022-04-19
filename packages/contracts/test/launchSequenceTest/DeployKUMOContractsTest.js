const deploymentHelper = require("../../utils/deploymentHelpers.js")
const testHelpers = require("../../utils/testHelpers.js")
const CommunityIssuance = artifacts.require("./CommunityIssuance.sol")


const th = testHelpers.TestHelper
const timeValues = testHelpers.TimeValues
const assertRevert = th.assertRevert
const toBN = th.toBN
const dec = th.dec

contract('Deploying the KUMO contracts: LCF, CI, KUMOStaking, and KUMOToken ', async accounts => {
  const [liquityAG, A, B] = accounts;
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  let KUMOContracts

  const oneMillion = toBN(1000000)
  const digits = toBN(1e18)
  const thirtyTwo = toBN(32)
  const expectedCISupplyCap = thirtyTwo.mul(oneMillion).mul(digits)

  beforeEach(async () => {
    // Deploy all contracts from the first account
    KUMOContracts = await deploymentHelper.deployKUMOContracts(bountyAddress, lpRewardsAddress, multisig)
    await deploymentHelper.connectKUMOContracts(KUMOContracts)

    kumoStaking = KUMOContracts.kumoStaking
    kumoToken = KUMOContracts.kumoToken
    communityIssuance = KUMOContracts.communityIssuance
    lockupContractFactory = KUMOContracts.lockupContractFactory

    //KUMO Staking and CommunityIssuance have not yet had their setters called, so are not yet
    // connected to the rest of the system
  })


  describe('CommunityIssuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('KUMOStaking deployment', async accounts => {
    it("Stores the deployer's address", async () => {
      const storedDeployerAddress = await kumoStaking.owner()

      assert.equal(liquityAG, storedDeployerAddress)
    })
  })

  describe('KUMOToken deployment', async accounts => {
    it("Stores the multisig's address", async () => {
      const storedMultisigAddress = await kumoToken.multisigAddress()

      assert.equal(multisig, storedMultisigAddress)
    })

    it("Stores the CommunityIssuance address", async () => {
      const storedCIAddress = await kumoToken.communityIssuanceAddress()

      assert.equal(communityIssuance.address, storedCIAddress)
    })

    it("Stores the LockupContractFactory address", async () => {
      const storedLCFAddress = await kumoToken.lockupContractFactory()

      assert.equal(lockupContractFactory.address, storedLCFAddress)
    })

    it("Mints the correct KUMO amount to the multisig's address: (64.66 million)", async () => {
      const multisigKUMOEntitlement = await kumoToken.balanceOf(multisig)

     const twentyThreeSixes = "6".repeat(23)
      const expectedMultisigEntitlement = "64".concat(twentyThreeSixes).concat("7")
      assert.equal(multisigKUMOEntitlement, expectedMultisigEntitlement)
    })

    it("Mints the correct KUMO amount to the CommunityIssuance contract address: 32 million", async () => {
      const communityKUMOEntitlement = await kumoToken.balanceOf(communityIssuance.address)
      // 32 million as 18-digit decimal
      const _32Million = dec(32, 24)

      assert.equal(communityKUMOEntitlement, _32Million)
    })

    it("Mints the correct KUMO amount to the bountyAddress EOA: 2 million", async () => {
      const bountyAddressBal = await kumoToken.balanceOf(bountyAddress)
      // 2 million as 18-digit decimal
      const _2Million = dec(2, 24)

      assert.equal(bountyAddressBal, _2Million)
    })

    it("Mints the correct KUMO amount to the lpRewardsAddress EOA: 1.33 million", async () => {
      const lpRewardsAddressBal = await kumoToken.balanceOf(lpRewardsAddress)
      // 1.3 million as 18-digit decimal
      const _1pt33Million = "1".concat("3".repeat(24))

      assert.equal(lpRewardsAddressBal, _1pt33Million)
    })
  })

  describe('Community Issuance deployment', async accounts => {
    it("Stores the deployer's address", async () => {

      const storedDeployerAddress = await communityIssuance.owner()

      assert.equal(storedDeployerAddress, liquityAG)
    })

    it("Has a supply cap of 32 million", async () => {
      const supplyCap = await communityIssuance.KUMOSupplyCap()

      assert.isTrue(expectedCISupplyCap.eq(supplyCap))
    })

    it("Kumo AG can set addresses if CI's KUMO balance is equal or greater than 32 million ", async () => {
      const KUMOBalance = await kumoToken.balanceOf(communityIssuance.address)
      assert.isTrue(KUMOBalance.eq(expectedCISupplyCap))

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployKumoCore()

      const tx = await communityIssuance.setAddresses(
        kumoToken.address,
        coreContracts.stabilityPool.address,
        { from: liquityAG }
      );
      assert.isTrue(tx.receipt.status)
    })

    it("Kumo AG can't set addresses if CI's KUMO balance is < 32 million ", async () => {
      const newCI = await CommunityIssuance.new()

      const KUMOBalance = await kumoToken.balanceOf(newCI.address)
      assert.equal(KUMOBalance, '0')

      // Deploy core contracts, just to get the Stability Pool address
      const coreContracts = await deploymentHelper.deployKumoCore()

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider)
      await kumoToken.transfer(newCI.address, '31999999999999999999999999', {from: multisig}) // 1e-18 less than CI expects (32 million)

      try {
        const tx = await newCI.setAddresses(
          kumoToken.address,
          coreContracts.stabilityPool.address,
          { from: liquityAG }
        );
        // Check it gives the expected error message for a failed Solidity 'assert'
      } catch (err) {
        assert.include(err.message, 'VM Exception')
      }
    })
  })

  describe('Connecting KUMOToken to LCF, CI and KUMOStaking', async accounts => {
    it('sets the correct KUMOToken address in KUMOStaking', async () => {
      // Deploy core contracts and set the KUMOToken address in the CI and KUMOStaking
      const coreContracts = await deploymentHelper.deployKumoCore()
      await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, coreContracts)

      const kumoTokenAddress = kumoToken.address

      const recordedKUMOTokenAddress = await kumoStaking.kumoToken()
      assert.equal(kumoTokenAddress, recordedKUMOTokenAddress)
    })

    it('sets the correct KUMOToken address in LockupContractFactory', async () => {
      const kumoTokenAddress = kumoToken.address

      const recordedKUMOTokenAddress = await lockupContractFactory.kumoTokenAddress()
      assert.equal(kumoTokenAddress, recordedKUMOTokenAddress)
    })

    it('sets the correct KUMOToken address in CommunityIssuance', async () => {
      // Deploy core contracts and set the KUMOToken address in the CI and KUMOStaking
      const coreContracts = await deploymentHelper.deployKumoCore()
      await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, coreContracts)

      const kumoTokenAddress = kumoToken.address

      const recordedKUMOTokenAddress = await communityIssuance.kumoToken()
      assert.equal(kumoTokenAddress, recordedKUMOTokenAddress)
    })
  })
})
