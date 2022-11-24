const LockupContract = artifacts.require("./LockupContract.sol")
const LockupContractFactory = artifacts.require("./LockupContractFactory.sol")
const deploymentHelper = require("../../utils/deploymentHelpers.js")

const { TestHelper: th, TimeValues: timeValues } = require("../../utils/testHelpers.js")
const { dec, toBN, assertRevert, ZERO_ADDRESS } = th

contract('During the initial lockup period', async accounts => {
  const [
    liquityAG,
    teamMember_1,
    teamMember_2,
    teamMember_3,
    investor_1,
    investor_2,
    investor_3,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000)

  const SECONDS_IN_ONE_MONTH = timeValues.SECONDS_IN_ONE_MONTH
  const SECONDS_IN_364_DAYS = timeValues.SECONDS_IN_ONE_DAY * 364

  let KUMOContracts
  let coreContracts

  // LCs for team members on vesting schedules
  let LC_T1
  let LC_T2
  let LC_T3

  // LCs for investors
  let LC_I1
  let LC_I2
  let LC_I3

  // 1e24 = 1 million tokens with 18 decimal digits
  const teamMemberInitialEntitlement_1 = dec(1, 24)
  const teamMemberInitialEntitlement_2 = dec(2, 24)
  const teamMemberInitialEntitlement_3 = dec(3, 24)
  const investorInitialEntitlement_1 = dec(4, 24)
  const investorInitialEntitlement_2 = dec(5, 24)
  const investorInitialEntitlement_3 = dec(6, 24)

  const KUMOEntitlement_A = dec(1, 24)
  const KUMOEntitlement_B = dec(2, 24)
  const KUMOEntitlement_C = dec(3, 24)
  const KUMOEntitlement_D = dec(4, 24)
  const KUMOEntitlement_E = dec(5, 24)

  let oneYearFromSystemDeployment
  let twoYearsFromSystemDeployment

  beforeEach(async () => {
    // Deploy all contracts from the first account
    coreContracts = await deploymentHelper.deployKumoCore()
    KUMOContracts = await deploymentHelper.deployKUMOTesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)

    kumoStaking = KUMOContracts.kumoStaking
    kumoToken = KUMOContracts.kumoToken
    communityIssuance = KUMOContracts.communityIssuance
    lockupContractFactory = KUMOContracts.lockupContractFactory

    await deploymentHelper.connectKUMOContracts(KUMOContracts)
    await deploymentHelper.connectCoreContracts(coreContracts, KUMOContracts)
    await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, coreContracts)

    oneYearFromSystemDeployment = await th.getTimeFromSystemDeployment(kumoToken, web3, timeValues.SECONDS_IN_ONE_YEAR)
    const secondsInTwoYears = toBN(timeValues.SECONDS_IN_ONE_YEAR).mul(toBN('2'))
    twoYearsFromSystemDeployment = await th.getTimeFromSystemDeployment(kumoToken, web3, secondsInTwoYears)

    // Deploy 3 LCs for team members on vesting schedules
    const deployedLCtx_T1 = await lockupContractFactory.deployLockupContract(teamMember_1, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T2 = await lockupContractFactory.deployLockupContract(teamMember_2, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_T3 = await lockupContractFactory.deployLockupContract(teamMember_3, oneYearFromSystemDeployment, { from: liquityAG })

    // Deploy 3 LCs for investors
    const deployedLCtx_I1 = await lockupContractFactory.deployLockupContract(investor_1, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I2 = await lockupContractFactory.deployLockupContract(investor_2, oneYearFromSystemDeployment, { from: liquityAG })
    const deployedLCtx_I3 = await lockupContractFactory.deployLockupContract(investor_3, oneYearFromSystemDeployment, { from: liquityAG })

    // LCs for team members on vesting schedules
    LC_T1 = await th.getLCFromDeploymentTx(deployedLCtx_T1)
    LC_T2 = await th.getLCFromDeploymentTx(deployedLCtx_T2)
    LC_T3 = await th.getLCFromDeploymentTx(deployedLCtx_T3)

    // LCs for investors
    LC_I1 = await th.getLCFromDeploymentTx(deployedLCtx_I1)
    LC_I2 = await th.getLCFromDeploymentTx(deployedLCtx_I2)
    LC_I3 = await th.getLCFromDeploymentTx(deployedLCtx_I3)

    // Multisig transfers initial KUMO entitlements to LCs
    await kumoToken.transfer(LC_T1.address, teamMemberInitialEntitlement_1, { from: multisig })
    await kumoToken.transfer(LC_T2.address, teamMemberInitialEntitlement_2, { from: multisig })
    await kumoToken.transfer(LC_T3.address, teamMemberInitialEntitlement_3, { from: multisig })

    await kumoToken.transfer(LC_I1.address, investorInitialEntitlement_1, { from: multisig })
    await kumoToken.transfer(LC_I2.address, investorInitialEntitlement_2, { from: multisig })
    await kumoToken.transfer(LC_I3.address, investorInitialEntitlement_3, { from: multisig })

    // Fast forward time 364 days, so that still less than 1 year since launch has passed
    await th.fastForwardTime(SECONDS_IN_364_DAYS, web3.currentProvider)
  })

  describe('KUMO transfer during first year after KUMO deployment', async accounts => {
    // --- Kumo AG transfer restriction, 1st year ---
    it("Kumo multisig can not transfer KUMO to a LC that was deployed directly", async () => {
      // Kumo multisig deploys LC_A
      const LC_A = await LockupContract.new(kumoToken.address, A, oneYearFromSystemDeployment, { from: multisig })

      // Account F deploys LC_B
      const LC_B = await LockupContract.new(kumoToken.address, B, oneYearFromSystemDeployment, { from: F })

      // KUMO deployer deploys LC_C
      const LC_C = await LockupContract.new(kumoToken.address, A, oneYearFromSystemDeployment, { from: liquityAG })

      // Kumo multisig attempts KUMO transfer to LC_A
      try {
        const KUMOtransferTx_A = await kumoToken.transfer(LC_A.address, dec(1, 18), { from: multisig })
        assert.isFalse(KUMOtransferTx_A.receipt.status)
      } catch (error) {
        assert.include(error.message, "KUMOToken: recipient must be a LockupContract registered in the Factory")
      }

      // Kumo multisig attempts KUMO transfer to LC_B
      try {
        const KUMOtransferTx_B = await kumoToken.transfer(LC_B.address, dec(1, 18), { from: multisig })
        assert.isFalse(KUMOtransferTx_B.receipt.status)
      } catch (error) {
        assert.include(error.message, "KUMOToken: recipient must be a LockupContract registered in the Factory")
      }

      try {
        const KUMOtransferTx_C = await kumoToken.transfer(LC_C.address, dec(1, 18), { from: multisig })
        assert.isFalse(KUMOtransferTx_C.receipt.status)
      } catch (error) {
        assert.include(error.message, "KUMOToken: recipient must be a LockupContract registered in the Factory")
      }
    })

    it("Kumo multisig can not transfer to an EOA or Kumo system contracts", async () => {
      // Multisig attempts KUMO transfer to EOAs
      const KUMOtransferTxPromise_1 = kumoToken.transfer(A, dec(1, 18), { from: multisig })
      const KUMOtransferTxPromise_2 = kumoToken.transfer(B, dec(1, 18), { from: multisig })
      await assertRevert(KUMOtransferTxPromise_1)
      await assertRevert(KUMOtransferTxPromise_2)

      // Multisig attempts KUMO transfer to core Kumo contracts
      for (const contract of Object.keys(coreContracts)) {
        const KUMOtransferTxPromise = kumoToken.transfer(coreContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(KUMOtransferTxPromise, "KUMOToken: recipient must be a LockupContract registered in the Factory")
      }

      // Multisig attempts KUMO transfer to KUMO contracts (excluding LCs)
      for (const contract of Object.keys(KUMOContracts)) {
        const KUMOtransferTxPromise = kumoToken.transfer(KUMOContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(KUMOtransferTxPromise, "KUMOToken: recipient must be a LockupContract registered in the Factory")
      }
    })

    // --- Kumo AG approval restriction, 1st year ---
    it("Kumo multisig can not approve any EOA or Kumo system contract to spend their KUMO", async () => {
      // Multisig attempts to approve EOAs to spend KUMO
      const KUMOApproveTxPromise_1 = kumoToken.approve(A, dec(1, 18), { from: multisig })
      const KUMOApproveTxPromise_2 = kumoToken.approve(B, dec(1, 18), { from: multisig })
      await assertRevert(KUMOApproveTxPromise_1, "KUMOToken: caller must not be the multisig")
      await assertRevert(KUMOApproveTxPromise_2, "KUMOToken: caller must not be the multisig")

      // Multisig attempts to approve Kumo contracts to spend KUMO
      for (const contract of Object.keys(coreContracts)) {
        const KUMOApproveTxPromise = kumoToken.approve(coreContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(KUMOApproveTxPromise, "KUMOToken: caller must not be the multisig")
      }

      // Multisig attempts to approve KUMO contracts to spend KUMO (excluding LCs)
      for (const contract of Object.keys(KUMOContracts)) {
        const KUMOApproveTxPromise = kumoToken.approve(KUMOContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(KUMOApproveTxPromise, "KUMOToken: caller must not be the multisig")
      }
    })

    // --- Kumo AG increaseAllowance restriction, 1st year ---
    it("Kumo multisig can not increaseAllowance for any EOA or Kumo contract", async () => {
      // Multisig attempts to approve EOAs to spend KUMO
      const KUMOIncreaseAllowanceTxPromise_1 = kumoToken.increaseAllowance(A, dec(1, 18), { from: multisig })
      const KUMOIncreaseAllowanceTxPromise_2 = kumoToken.increaseAllowance(B, dec(1, 18), { from: multisig })
      await assertRevert(KUMOIncreaseAllowanceTxPromise_1, "KUMOToken: caller must not be the multisig")
      await assertRevert(KUMOIncreaseAllowanceTxPromise_2, "KUMOToken: caller must not be the multisig")

      // Multisig attempts to approve Kumo contracts to spend KUMO
      for (const contract of Object.keys(coreContracts)) {
        const KUMOIncreaseAllowanceTxPromise = kumoToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(KUMOIncreaseAllowanceTxPromise, "KUMOToken: caller must not be the multisig")
      }

      // Multisig attempts to approve KUMO contracts to spend KUMO (excluding LCs)
      for (const contract of Object.keys(KUMOContracts)) {
        const KUMOIncreaseAllowanceTxPromise = kumoToken.increaseAllowance(KUMOContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(KUMOIncreaseAllowanceTxPromise, "KUMOToken: caller must not be the multisig")
      }
    })

    // --- Kumo AG decreaseAllowance restriction, 1st year ---
    it("Kumo multisig can not decreaseAllowance for any EOA or Kumo contract", async () => {
      // Multisig attempts to decreaseAllowance on EOAs 
      const KUMODecreaseAllowanceTxPromise_1 = kumoToken.decreaseAllowance(A, dec(1, 18), { from: multisig })
      const KUMODecreaseAllowanceTxPromise_2 = kumoToken.decreaseAllowance(B, dec(1, 18), { from: multisig })
      await assertRevert(KUMODecreaseAllowanceTxPromise_1, "KUMOToken: caller must not be the multisig")
      await assertRevert(KUMODecreaseAllowanceTxPromise_2, "KUMOToken: caller must not be the multisig")

      // Multisig attempts to decrease allowance on Kumo contracts
      for (const contract of Object.keys(coreContracts)) {
        const KUMODecreaseAllowanceTxPromise = kumoToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(KUMODecreaseAllowanceTxPromise, "KUMOToken: caller must not be the multisig")
      }

      // Multisig attempts to decrease allowance on KUMO contracts (excluding LCs)
      for (const contract of Object.keys(KUMOContracts)) {
        const KUMODecreaseAllowanceTxPromise = kumoToken.decreaseAllowance(KUMOContracts[contract].address, dec(1, 18), { from: multisig })
        await assertRevert(KUMODecreaseAllowanceTxPromise, "KUMOToken: caller must not be the multisig")
      }
    })

    // --- Kumo multisig transferFrom restriction, 1st year ---
    it("Kumo multisig can not be the sender in a transferFrom() call", async () => {
      // EOAs attempt to use multisig as sender in a transferFrom()
      const KUMOtransferFromTxPromise_1 = kumoToken.transferFrom(multisig, A, dec(1, 18), { from: A })
      const KUMOtransferFromTxPromise_2 = kumoToken.transferFrom(multisig, C, dec(1, 18), { from: B })
      await assertRevert(KUMOtransferFromTxPromise_1, "KUMOToken: sender must not be the multisig")
      await assertRevert(KUMOtransferFromTxPromise_2, "KUMOToken: sender must not be the multisig")
    })

    //  --- staking, 1st year ---
    it("Kumo multisig can not stake their KUMO in the staking contract", async () => {
      const KUMOStakingTxPromise_1 = kumoStaking.stake(dec(1, 18), { from: multisig })
      await assertRevert(KUMOStakingTxPromise_1, "KUMOToken: sender must not be the multisig")
    })

    // --- Anyone else ---

    it("Anyone (other than Kumo multisig) can transfer KUMO to LCs deployed by anyone through the Factory", async () => {
      // Start D, E, F with some KUMO
      await kumoToken.unprotectedMint(D, dec(1, 24))
      await kumoToken.unprotectedMint(E, dec(2, 24))
      await kumoToken.unprotectedMint(F, dec(3, 24))

      // H, I, and Kumo AG deploy lockup contracts with A, B, C as beneficiaries, respectively
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: H })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: I })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, oneYearFromSystemDeployment, { from: multisig })

      // Grab contract addresses from deployment tx events
      const LCAddress_A = await th.getLCAddressFromDeploymentTx(deployedLCtx_A)
      const LCAddress_B = await th.getLCAddressFromDeploymentTx(deployedLCtx_B)
      const LCAddress_C = await th.getLCAddressFromDeploymentTx(deployedLCtx_C)

      // Check balances of LCs are 0
      assert.equal(await kumoToken.balanceOf(LCAddress_A), '0')
      assert.equal(await kumoToken.balanceOf(LCAddress_B), '0')
      assert.equal(await kumoToken.balanceOf(LCAddress_C), '0')

      // D, E, F transfer KUMO to LCs
      await kumoToken.transfer(LCAddress_A, dec(1, 24), { from: D })
      await kumoToken.transfer(LCAddress_B, dec(2, 24), { from: E })
      await kumoToken.transfer(LCAddress_C, dec(3, 24), { from: F })

      // Check balances of LCs has increased
      assert.equal(await kumoToken.balanceOf(LCAddress_A), dec(1, 24))
      assert.equal(await kumoToken.balanceOf(LCAddress_B), dec(2, 24))
      assert.equal(await kumoToken.balanceOf(LCAddress_C), dec(3, 24))
    })

    it("Anyone (other than Kumo multisig) can transfer KUMO to LCs deployed by anyone directly", async () => {
      // Start D, E, F with some KUMO
      await kumoToken.unprotectedMint(D, dec(1, 24))
      await kumoToken.unprotectedMint(E, dec(2, 24))
      await kumoToken.unprotectedMint(F, dec(3, 24))

      // H, I, LiqAG deploy lockup contracts with A, B, C as beneficiaries, respectively
      const LC_A = await LockupContract.new(kumoToken.address, A, oneYearFromSystemDeployment, { from: H })
      const LC_B = await LockupContract.new(kumoToken.address, B, oneYearFromSystemDeployment, { from: I })
      const LC_C = await LockupContract.new(kumoToken.address, C, oneYearFromSystemDeployment, { from: multisig })

      // Check balances of LCs are 0
      assert.equal(await kumoToken.balanceOf(LC_A.address), '0')
      assert.equal(await kumoToken.balanceOf(LC_B.address), '0')
      assert.equal(await kumoToken.balanceOf(LC_C.address), '0')

      // D, E, F transfer KUMO to LCs
      await kumoToken.transfer(LC_A.address, dec(1, 24), { from: D })
      await kumoToken.transfer(LC_B.address, dec(2, 24), { from: E })
      await kumoToken.transfer(LC_C.address, dec(3, 24), { from: F })

      // Check balances of LCs has increased
      assert.equal(await kumoToken.balanceOf(LC_A.address), dec(1, 24))
      assert.equal(await kumoToken.balanceOf(LC_B.address), dec(2, 24))
      assert.equal(await kumoToken.balanceOf(LC_C.address), dec(3, 24))
    })

    it("Anyone (other than liquity multisig) can transfer to an EOA", async () => {
      // Start D, E, F with some KUMO
      await kumoToken.unprotectedMint(D, dec(1, 24))
      await kumoToken.unprotectedMint(E, dec(2, 24))
      await kumoToken.unprotectedMint(F, dec(3, 24))

      // KUMO holders transfer to other transfer to EOAs
      const KUMOtransferTx_1 = await kumoToken.transfer(A, dec(1, 18), { from: D })
      const KUMOtransferTx_2 = await kumoToken.transfer(B, dec(1, 18), { from: E })
      const KUMOtransferTx_3 = await kumoToken.transfer(multisig, dec(1, 18), { from: F })

      assert.isTrue(KUMOtransferTx_1.receipt.status)
      assert.isTrue(KUMOtransferTx_2.receipt.status)
      assert.isTrue(KUMOtransferTx_3.receipt.status)
    })

    it("Anyone (other than liquity multisig) can approve any EOA or to spend their KUMO", async () => {
      // EOAs approve EOAs to spend KUMO
      const KUMOapproveTx_1 = await kumoToken.approve(A, dec(1, 18), { from: F })
      const KUMOapproveTx_2 = await kumoToken.approve(B, dec(1, 18), { from: G })
      await assert.isTrue(KUMOapproveTx_1.receipt.status)
      await assert.isTrue(KUMOapproveTx_2.receipt.status)
    })

    it("Anyone (other than liquity multisig) can increaseAllowance for any EOA or Kumo contract", async () => {
      // Anyone can increaseAllowance of EOAs to spend KUMO
      const KUMOIncreaseAllowanceTx_1 = await kumoToken.increaseAllowance(A, dec(1, 18), { from: F })
      const KUMOIncreaseAllowanceTx_2 = await kumoToken.increaseAllowance(B, dec(1, 18), { from: G })
      await assert.isTrue(KUMOIncreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(KUMOIncreaseAllowanceTx_2.receipt.status)

      // Increase allowance of core Kumo contracts
      for (const contract of Object.keys(coreContracts)) {
        const KUMOIncreaseAllowanceTx = await kumoToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(KUMOIncreaseAllowanceTx.receipt.status)
      }

      // Increase allowance of KUMO contracts
      for (const contract of Object.keys(KUMOContracts)) {
        const KUMOIncreaseAllowanceTx = await kumoToken.increaseAllowance(KUMOContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(KUMOIncreaseAllowanceTx.receipt.status)
      }
    })

    it("Anyone (other than liquity multisig) can decreaseAllowance for any EOA or Kumo contract", async () => {
      //First, increase allowance of A, B and coreContracts and KUMO contracts
      const KUMOIncreaseAllowanceTx_1 = await kumoToken.increaseAllowance(A, dec(1, 18), { from: F })
      const KUMOIncreaseAllowanceTx_2 = await kumoToken.increaseAllowance(B, dec(1, 18), { from: G })
      await assert.isTrue(KUMOIncreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(KUMOIncreaseAllowanceTx_2.receipt.status)

      for (const contract of Object.keys(coreContracts)) {
        const KUMOtransferTx = await kumoToken.increaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(KUMOtransferTx.receipt.status)
      }

      for (const contract of Object.keys(KUMOContracts)) {
        const KUMOtransferTx = await kumoToken.increaseAllowance(KUMOContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(KUMOtransferTx.receipt.status)
      }

      // Decrease allowance of A, B
      const KUMODecreaseAllowanceTx_1 = await kumoToken.decreaseAllowance(A, dec(1, 18), { from: F })
      const KUMODecreaseAllowanceTx_2 = await kumoToken.decreaseAllowance(B, dec(1, 18), { from: G })
      await assert.isTrue(KUMODecreaseAllowanceTx_1.receipt.status)
      await assert.isTrue(KUMODecreaseAllowanceTx_2.receipt.status)

      // Decrease allowance of core contracts
      for (const contract of Object.keys(coreContracts)) {
        const KUMODecreaseAllowanceTx = await kumoToken.decreaseAllowance(coreContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(KUMODecreaseAllowanceTx.receipt.status)
      }

      // Decrease allowance of KUMO contracts
      for (const contract of Object.keys(KUMOContracts)) {
        const KUMODecreaseAllowanceTx = await kumoToken.decreaseAllowance(KUMOContracts[contract].address, dec(1, 18), { from: F })
        await assert.isTrue(KUMODecreaseAllowanceTx.receipt.status)
      }
    })

    it("Anyone (other than liquity multisig) can be the sender in a transferFrom() call", async () => {
      // Fund A, B
      await kumoToken.unprotectedMint(A, dec(1, 18))
      await kumoToken.unprotectedMint(B, dec(1, 18))

      // A, B approve F, G
      await kumoToken.approve(F, dec(1, 18), { from: A })
      await kumoToken.approve(G, dec(1, 18), { from: B })

      const KUMOtransferFromTx_1 = await kumoToken.transferFrom(A, F, dec(1, 18), { from: F })
      const KUMOtransferFromTx_2 = await kumoToken.transferFrom(B, C, dec(1, 18), { from: G })
      await assert.isTrue(KUMOtransferFromTx_1.receipt.status)
      await assert.isTrue(KUMOtransferFromTx_2.receipt.status)
    })

    it("Anyone (other than liquity AG) can stake their KUMO in the staking contract", async () => {
      // Fund F
      await kumoToken.unprotectedMint(F, dec(1, 18))

      const KUMOStakingTx_1 = await kumoStaking.stake(dec(1, 18), { from: F })
      await assert.isTrue(KUMOStakingTx_1.receipt.status)
    })

  })
  // --- LCF ---

  describe('Lockup Contract Factory negative tests', async accounts => {
    it("deployLockupContract(): reverts when KUMO token address is not set", async () => {
      // Fund F
      await kumoToken.unprotectedMint(F, dec(20, 24))

      // deploy new LCF
      const LCFNew = await LockupContractFactory.new()

      // Check KUMOToken address not registered
      const registeredKUMOTokenAddr = await LCFNew.kumoTokenAddress()
      assert.equal(registeredKUMOTokenAddr, ZERO_ADDRESS)

      const tx = LCFNew.deployLockupContract(A, oneYearFromSystemDeployment, { from: F })
      await assertRevert(tx)
    })
  })

  // --- LCs ---
  describe('Transferring KUMO to LCs', async accounts => {
    it("Kumo multisig can transfer KUMO (vesting) to lockup contracts they deployed", async () => {
      const initialKUMOBalanceOfLC_T1 = await kumoToken.balanceOf(LC_T1.address)
      const initialKUMOBalanceOfLC_T2 = await kumoToken.balanceOf(LC_T2.address)
      const initialKUMOBalanceOfLC_T3 = await kumoToken.balanceOf(LC_T3.address)

      // Check initial LC balances == entitlements
      assert.equal(initialKUMOBalanceOfLC_T1, teamMemberInitialEntitlement_1)
      assert.equal(initialKUMOBalanceOfLC_T2, teamMemberInitialEntitlement_2)
      assert.equal(initialKUMOBalanceOfLC_T3, teamMemberInitialEntitlement_3)

      // One month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Kumo multisig transfers vesting amount
      await kumoToken.transfer(LC_T1.address, dec(1, 24), { from: multisig })
      await kumoToken.transfer(LC_T2.address, dec(1, 24), { from: multisig })
      await kumoToken.transfer(LC_T3.address, dec(1, 24), { from: multisig })

      // Get new LC KUMO balances
      const KUMOBalanceOfLC_T1_1 = await kumoToken.balanceOf(LC_T1.address)
      const KUMOBalanceOfLC_T2_1 = await kumoToken.balanceOf(LC_T2.address)
      const KUMOBalanceOfLC_T3_1 = await kumoToken.balanceOf(LC_T3.address)

      // // Check team member LC balances have increased 
      assert.isTrue(KUMOBalanceOfLC_T1_1.eq(th.toBN(initialKUMOBalanceOfLC_T1).add(th.toBN(dec(1, 24)))))
      assert.isTrue(KUMOBalanceOfLC_T2_1.eq(th.toBN(initialKUMOBalanceOfLC_T2).add(th.toBN(dec(1, 24)))))
      assert.isTrue(KUMOBalanceOfLC_T3_1.eq(th.toBN(initialKUMOBalanceOfLC_T3).add(th.toBN(dec(1, 24)))))

      // Another month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Kumo multisig transfers vesting amount
      await kumoToken.transfer(LC_T1.address, dec(1, 24), { from: multisig })
      await kumoToken.transfer(LC_T2.address, dec(1, 24), { from: multisig })
      await kumoToken.transfer(LC_T3.address, dec(1, 24), { from: multisig })

      // Get new LC KUMO balances
      const KUMOBalanceOfLC_T1_2 = await kumoToken.balanceOf(LC_T1.address)
      const KUMOBalanceOfLC_T2_2 = await kumoToken.balanceOf(LC_T2.address)
      const KUMOBalanceOfLC_T3_2 = await kumoToken.balanceOf(LC_T3.address)

      // Check team member LC balances have increased again
      assert.isTrue(KUMOBalanceOfLC_T1_2.eq(KUMOBalanceOfLC_T1_1.add(th.toBN(dec(1, 24)))))
      assert.isTrue(KUMOBalanceOfLC_T2_2.eq(KUMOBalanceOfLC_T2_1.add(th.toBN(dec(1, 24)))))
      assert.isTrue(KUMOBalanceOfLC_T3_2.eq(KUMOBalanceOfLC_T3_1.add(th.toBN(dec(1, 24)))))
    })

    it("Kumo multisig can transfer KUMO to lockup contracts deployed by anyone", async () => {
      // A, B, C each deploy a lockup contract with themself as beneficiary
      const deployedLCtx_A = await lockupContractFactory.deployLockupContract(A, twoYearsFromSystemDeployment, { from: A })
      const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, twoYearsFromSystemDeployment, { from: B })
      const deployedLCtx_C = await lockupContractFactory.deployLockupContract(C, twoYearsFromSystemDeployment, { from: C })

      // LCs for team members on vesting schedules
      const LC_A = await th.getLCFromDeploymentTx(deployedLCtx_A)
      const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)
      const LC_C = await th.getLCFromDeploymentTx(deployedLCtx_C)

      // Check balances of LCs are 0
      assert.equal(await kumoToken.balanceOf(LC_A.address), '0')
      assert.equal(await kumoToken.balanceOf(LC_B.address), '0')
      assert.equal(await kumoToken.balanceOf(LC_C.address), '0')

      // One month passes
      await th.fastForwardTime(SECONDS_IN_ONE_MONTH, web3.currentProvider)

      // Kumo multisig transfers KUMO to LCs deployed by other accounts
      await kumoToken.transfer(LC_A.address, dec(1, 24), { from: multisig })
      await kumoToken.transfer(LC_B.address, dec(2, 24), { from: multisig })
      await kumoToken.transfer(LC_C.address, dec(3, 24), { from: multisig })

      // Check balances of LCs have increased
      assert.equal(await kumoToken.balanceOf(LC_A.address), dec(1, 24))
      assert.equal(await kumoToken.balanceOf(LC_B.address), dec(2, 24))
      assert.equal(await kumoToken.balanceOf(LC_C.address), dec(3, 24))
    })
  })

  describe('Deploying new LCs', async accounts => {
    it("KUMO Deployer can deploy LCs through the Factory", async () => {
      // KUMO deployer deploys LCs
      const LCDeploymentTx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_B = await lockupContractFactory.deployLockupContract(B, twoYearsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_C = await lockupContractFactory.deployLockupContract(C, '9595995999999900000023423234', { from: liquityAG })

      assert.isTrue(LCDeploymentTx_A.receipt.status)
      assert.isTrue(LCDeploymentTx_B.receipt.status)
      assert.isTrue(LCDeploymentTx_C.receipt.status)
    })

    it("Kumo multisig can deploy LCs through the Factory", async () => {
      // KUMO deployer deploys LCs
      const LCDeploymentTx_A = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: multisig })
      const LCDeploymentTx_B = await lockupContractFactory.deployLockupContract(B, twoYearsFromSystemDeployment, { from: multisig })
      const LCDeploymentTx_C = await lockupContractFactory.deployLockupContract(C, '9595995999999900000023423234', { from: multisig })

      assert.isTrue(LCDeploymentTx_A.receipt.status)
      assert.isTrue(LCDeploymentTx_B.receipt.status)
      assert.isTrue(LCDeploymentTx_C.receipt.status)
    })

    it("Anyone can deploy LCs through the Factory", async () => {
      // Various EOAs deploy LCs
      const LCDeploymentTx_1 = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: teamMember_1 })
      const LCDeploymentTx_2 = await lockupContractFactory.deployLockupContract(C, twoYearsFromSystemDeployment, { from: investor_2 })
      const LCDeploymentTx_3 = await lockupContractFactory.deployLockupContract(liquityAG, '9595995999999900000023423234', { from: A })
      const LCDeploymentTx_4 = await lockupContractFactory.deployLockupContract(D, twoYearsFromSystemDeployment, { from: B })

      assert.isTrue(LCDeploymentTx_1.receipt.status)
      assert.isTrue(LCDeploymentTx_2.receipt.status)
      assert.isTrue(LCDeploymentTx_3.receipt.status)
      assert.isTrue(LCDeploymentTx_4.receipt.status)
    })

    it("KUMO Deployer can deploy LCs directly", async () => {
      // KUMO deployer deploys LCs
      const LC_A = await LockupContract.new(kumoToken.address, A, oneYearFromSystemDeployment, { from: liquityAG })
      const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

      const LC_B = await LockupContract.new(kumoToken.address, B, twoYearsFromSystemDeployment, { from: liquityAG })
      const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

      const LC_C = await LockupContract.new(kumoToken.address, C, twoYearsFromSystemDeployment, { from: liquityAG })
      const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(LC_A_txReceipt.status)
      assert.isTrue(LC_B_txReceipt.status)
      assert.isTrue(LC_C_txReceipt.status)
    })

    it("Kumo multisig can deploy LCs directly", async () => {
      // KUMO deployer deploys LCs
      const LC_A = await LockupContract.new(kumoToken.address, A, oneYearFromSystemDeployment, { from: multisig })
      const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

      const LC_B = await LockupContract.new(kumoToken.address, B, twoYearsFromSystemDeployment, { from: multisig })
      const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

      const LC_C = await LockupContract.new(kumoToken.address, C, twoYearsFromSystemDeployment, { from: multisig })
      const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(LC_A_txReceipt.status)
      assert.isTrue(LC_B_txReceipt.status)
      assert.isTrue(LC_C_txReceipt.status)
    })

    it("Anyone can deploy LCs directly", async () => {
      // Various EOAs deploy LCs
      const LC_A = await LockupContract.new(kumoToken.address, A, oneYearFromSystemDeployment, { from: D })
      const LC_A_txReceipt = await web3.eth.getTransactionReceipt(LC_A.transactionHash)

      const LC_B = await LockupContract.new(kumoToken.address, B, twoYearsFromSystemDeployment, { from: E })
      const LC_B_txReceipt = await web3.eth.getTransactionReceipt(LC_B.transactionHash)

      const LC_C = await LockupContract.new(kumoToken.address, C, twoYearsFromSystemDeployment, { from: F })
      const LC_C_txReceipt = await web3.eth.getTransactionReceipt(LC_C.transactionHash)

      // Check deployment succeeded
      assert.isTrue(LC_A_txReceipt.status)
      assert.isTrue(LC_B_txReceipt.status)
      assert.isTrue(LC_C_txReceipt.status)
    })

    it("Anyone can deploy LCs with unlockTime = one year from deployment, directly and through factory", async () => {
      // Deploy directly
      const LC_1 = await LockupContract.new(kumoToken.address, A, oneYearFromSystemDeployment, { from: D })
      const LCTxReceipt_1 = await web3.eth.getTransactionReceipt(LC_1.transactionHash)

      const LC_2 = await LockupContract.new(kumoToken.address, B, oneYearFromSystemDeployment, { from: liquityAG })
      const LCTxReceipt_2 = await web3.eth.getTransactionReceipt(LC_2.transactionHash)

      const LC_3 = await LockupContract.new(kumoToken.address, C, oneYearFromSystemDeployment, { from: multisig })
      const LCTxReceipt_3 = await web3.eth.getTransactionReceipt(LC_2.transactionHash)

      // Deploy through factory
      const LCDeploymentTx_4 = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: E })
      const LCDeploymentTx_5 = await lockupContractFactory.deployLockupContract(C, twoYearsFromSystemDeployment, { from: liquityAG })
      const LCDeploymentTx_6 = await lockupContractFactory.deployLockupContract(D, twoYearsFromSystemDeployment, { from: multisig })

      // Check deployments succeeded
      assert.isTrue(LCTxReceipt_1.status)
      assert.isTrue(LCTxReceipt_2.status)
      assert.isTrue(LCTxReceipt_3.status)
      assert.isTrue(LCDeploymentTx_4.receipt.status)
      assert.isTrue(LCDeploymentTx_5.receipt.status)
      assert.isTrue(LCDeploymentTx_6.receipt.status)
    })

    it("Anyone can deploy LCs with unlockTime > one year from deployment, directly and through factory", async () => {
      const justOverOneYear = oneYearFromSystemDeployment.add(toBN('1'))
      const _17YearsFromDeployment = oneYearFromSystemDeployment.add(toBN(timeValues.SECONDS_IN_ONE_YEAR).mul(toBN('2')))
      
      // Deploy directly
      const LC_1 = await LockupContract.new(kumoToken.address, A, twoYearsFromSystemDeployment, { from: D })
      const LCTxReceipt_1 = await web3.eth.getTransactionReceipt(LC_1.transactionHash)

      const LC_2 = await LockupContract.new(kumoToken.address, B, justOverOneYear, { from: multisig })
      const LCTxReceipt_2 = await web3.eth.getTransactionReceipt(LC_2.transactionHash)

      const LC_3 = await LockupContract.new(kumoToken.address, E, _17YearsFromDeployment, { from: E })
      const LCTxReceipt_3 = await web3.eth.getTransactionReceipt(LC_3.transactionHash)

      // Deploy through factory
      const LCDeploymentTx_4 = await lockupContractFactory.deployLockupContract(A, oneYearFromSystemDeployment, { from: E })
      const LCDeploymentTx_5 = await lockupContractFactory.deployLockupContract(C, twoYearsFromSystemDeployment, { from: multisig })
      const LCDeploymentTx_6 = await lockupContractFactory.deployLockupContract(D, twoYearsFromSystemDeployment, { from: teamMember_2 })

      // Check deployments succeeded
      assert.isTrue(LCTxReceipt_1.status)
      assert.isTrue(LCTxReceipt_2.status)
      assert.isTrue(LCTxReceipt_3.status)
      assert.isTrue(LCDeploymentTx_4.receipt.status)
      assert.isTrue(LCDeploymentTx_5.receipt.status)
      assert.isTrue(LCDeploymentTx_6.receipt.status)
    })

    it("No one can deploy LCs with unlockTime < one year from deployment, directly or through factory", async () => {
      const justUnderOneYear = oneYearFromSystemDeployment.sub(toBN('1'))
     
      // Attempt to deploy directly
      const directDeploymentTxPromise_1 = LockupContract.new(kumoToken.address, A, justUnderOneYear, { from: D })
      const directDeploymentTxPromise_2 = LockupContract.new(kumoToken.address, B, '43200', { from: multisig })
      const directDeploymentTxPromise_3 =  LockupContract.new(kumoToken.address, E, '354534', { from: E })
  
      // Attempt to deploy through factory
      const factoryDploymentTxPromise_1 = lockupContractFactory.deployLockupContract(A, justUnderOneYear, { from: E })
      const factoryDploymentTxPromise_2 = lockupContractFactory.deployLockupContract(C, '43200', { from: multisig })
      const factoryDploymentTxPromise_3 = lockupContractFactory.deployLockupContract(D, '354534', { from: teamMember_2 })

      // Check deployments reverted
      await assertRevert(directDeploymentTxPromise_1, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(directDeploymentTxPromise_2, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(directDeploymentTxPromise_3, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(factoryDploymentTxPromise_1, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(factoryDploymentTxPromise_2, "LockupContract: unlock time must be at least one year after system deployment")
      await assertRevert(factoryDploymentTxPromise_3, "LockupContract: unlock time must be at least one year after system deployment")
    })


    describe('Withdrawal Attempts on LCs before unlockTime has passed ', async accounts => {
      it("Kumo multisig can't withdraw from a funded LC they deployed for another beneficiary through the Factory before the unlockTime", async () => {

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_T1.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        // Kumo multisig attempts withdrawal from LC they deployed through the Factory
        try {
          const withdrawalAttempt = await LC_T1.withdrawKUMO({ from: multisig })
          assert.isFalse(withdrawalAttempt.receipt.status)
        } catch (error) {
          assert.include(error.message, "LockupContract: caller is not the beneficiary")
        }
      })

      it("Kumo multisig can't withdraw from a funded LC that someone else deployed before the unlockTime", async () => {
        // Account D deploys a new LC via the Factory
        const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: D })
        const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

        //KUMO multisig fund the newly deployed LCs
        await kumoToken.transfer(LC_B.address, dec(2, 18), { from: multisig })

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_B.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        // Kumo multisig attempts withdrawal from LCs
        try {
          const withdrawalAttempt_B = await LC_B.withdrawKUMO({ from: multisig })
          assert.isFalse(withdrawalAttempt_B.receipt.status)
        } catch (error) {
          assert.include(error.message, "LockupContract: caller is not the beneficiary")
        }
      })

      it("Beneficiary can't withdraw from their funded LC before the unlockTime", async () => {
        // Account D deploys a new LC via the Factory
        const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: D })
        const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

        // Kumo multisig funds contracts
        await kumoToken.transfer(LC_B.address, dec(2, 18), { from: multisig })

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_B.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        /* Beneficiaries of all LCS - team, investor, and newly created LCs - 
        attempt to withdraw from their respective funded contracts */
        const LCs = [
          LC_T1,
          LC_T2,
          LC_T3,
          LC_I1,
          LC_I2,
          LC_T3,
          LC_B
        ]

        for (LC of LCs) {
          try {
            const beneficiary = await LC.beneficiary()
            const withdrawalAttempt = await LC.withdrawKUMO({ from: beneficiary })
            assert.isFalse(withdrawalAttempt.receipt.status)
          } catch (error) {
            assert.include(error.message, "LockupContract: The lockup duration must have passed")
          }
        }
      })

      it("No one can withdraw from a beneficiary's funded LC before the unlockTime", async () => {
        // Account D deploys a new LC via the Factory
        const deployedLCtx_B = await lockupContractFactory.deployLockupContract(B, oneYearFromSystemDeployment, { from: D })
        const LC_B = await th.getLCFromDeploymentTx(deployedLCtx_B)

        // Kumo multisig funds contract
        await kumoToken.transfer(LC_B.address, dec(2, 18), { from: multisig })

        // Check currentTime < unlockTime
        const currentTime = toBN(await th.getLatestBlockTimestamp(web3))
        const unlockTime = await LC_B.unlockTime()
        assert.isTrue(currentTime.lt(unlockTime))

        const variousEOAs = [teamMember_2, liquityAG, multisig, investor_1, A, C, D, E]

        // Several EOAs attempt to withdraw from LC deployed by D
        for (account of variousEOAs) {
          try {
            const withdrawalAttempt = await LC_B.withdrawKUMO({ from: account })
            assert.isFalse(withdrawalAttempt.receipt.status)
          } catch (error) {
            assert.include(error.message, "LockupContract: caller is not the beneficiary")
          }
        }

        // Several EOAs attempt to withdraw from LC_T1 deployed by KUMO deployer
        for (account of variousEOAs) {
          try {
            const withdrawalAttempt = await LC_T1.withdrawKUMO({ from: account })
            assert.isFalse(withdrawalAttempt.receipt.status)
          } catch (error) {
            assert.include(error.message, "LockupContract: caller is not the beneficiary")
          }
        }
      })
    })
  })
})