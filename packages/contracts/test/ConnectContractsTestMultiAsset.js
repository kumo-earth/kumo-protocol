const deploymentHelper = require("../utils/deploymentHelpers.js");

contract(
  "Deployment script - Sets correct contract addresses dependencies after deployment-MultiAsset",
  async accounts => {
    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

    let priceFeed;
    let kusdToken;
    let sortedTroves;
    let troveManager;
    let activePool;
    let stabilityPool;
    let stabilityPoolFactory;
    let defaultPool;
    let borrowerOperations;
    let kumoStaking;
    let kumoToken;
    let communityIssuance;
    let lockupContractFactory;
    let kumoParameters;
    let assetsData;

    before(async () => {
      const coreContracts = await deploymentHelper.deployKumoCore();
      const KUMOContracts = await deploymentHelper.deployKUMOContracts(
        bountyAddress,
        lpRewardsAddress,
        multisig
      );

      priceFeed = coreContracts.priceFeedTestnet;
      kusdToken = coreContracts.kusdToken;
      sortedTroves = coreContracts.sortedTroves;
      troveManager = coreContracts.troveManager;
      activePool = coreContracts.activePool;
      stabilityPoolFactory = coreContracts.stabilityPoolFactory;
      defaultPool = coreContracts.defaultPool;
      functionCaller = coreContracts.functionCaller;
      borrowerOperations = coreContracts.borrowerOperations;
      kumoParameters = coreContracts.kumoParameters;

      kumoStaking = KUMOContracts.kumoStaking;
      kumoToken = KUMOContracts.kumoToken;
      communityIssuance = KUMOContracts.communityIssuance;
      lockupContractFactory = KUMOContracts.lockupContractFactory;

      await deploymentHelper.connectKUMOContracts(KUMOContracts);
      await deploymentHelper.connectCoreContracts(coreContracts, KUMOContracts);
      await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, coreContracts);

      erc20Asset1 = await deploymentHelper.deployERC20Asset("Carbon Token X", "CTX");
      erc20Asset2 = await deploymentHelper.deployERC20Asset("Carbon Token Y", "CTY");
      assetAddress1 = erc20Asset1.address;
      assetAddress2 = erc20Asset2.address;
      assetsData = [{ name: "ctx", contractAddress: assetAddress1 }, { name: "cty", contractAddress: assetAddress2 }]

      await deploymentHelper.addNewAssetToSystem(coreContracts, KUMOContracts, assetAddress1);

      stabilityPool = await deploymentHelper.getStabilityPoolByAsset(coreContracts, assetAddress1);
    });


    it(`DeploymentScript-MultiAsset`, async () => {
      describe(`DeploymentScript-MultiAsset Outer Describe block to run For Loop`, () => {
        for (const asset of assetsData) {
          it(`Check if correct Addresses in Vault Parameters ${asset.name}`, async () => {
            assert.equal(priceFeed.address, await kumoParameters.priceFeed());
            assert.equal(activePool.address, await kumoParameters.activePool());
            assert.equal(defaultPool.address, await kumoParameters.defaultPool());
          });

          it(`Sets the correct KUSDToken address in TroveManager ${asset.name}`, async () => {
            const kusdTokenAddress = kusdToken.address;

            const recordedClvTokenAddress = await troveManager.kusdToken();

            assert.equal(kusdTokenAddress, recordedClvTokenAddress);
          });

          it(`Sets the correct SortedTroves address in TroveManager ${asset.name}`, async () => {
            const sortedTrovesAddress = sortedTroves.address;

            const recordedSortedTrovesAddress = await troveManager.sortedTroves();

            assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress);
          });

          it(`Sets the correct BorrowerOperations address in TroveManager ${asset.name}`, async () => {
            const borrowerOperationsAddress = borrowerOperations.address;

            const recordedBorrowerOperationsAddress = await troveManager.borrowerOperationsAddress();

            assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
          });

          // StabilityPool in TroveM
          it(`Sets the correct StabilityPoolFactory address in TroveManager ${asset.name}`, async () => {
            const stabilityPoolFactoryAddress = stabilityPoolFactory.address;

            const recordedStabilityPoolFactoryAddresss = await troveManager.stabilityPoolFactory();

            assert.equal(stabilityPoolFactoryAddress, recordedStabilityPoolFactoryAddresss);
          });

          // KUMO Staking in TroveM
          it(`Sets the correct KUMOStaking address in TroveManager ${asset.name}`, async () => {
            const kumoStakingAddress = kumoStaking.address;

            const recordedKUMOStakingAddress = await troveManager.kumoStaking();
            assert.equal(kumoStakingAddress, recordedKUMOStakingAddress);
          });

          // Active Pool

          it(`Sets the correct StabilityPool address in ActivePool ${asset.name}`, async () => {
            const stabilityPoolFactoryAddress = stabilityPoolFactory.address;

            const recordedStabilityPoolFactoryAddress = await activePool.stabilityPoolFactory();

            assert.equal(stabilityPoolFactoryAddress, recordedStabilityPoolFactoryAddress);
          });

          it(`Sets the correct DefaultPool address in ActivePool ${asset.name}`, async () => {
            const defaultPoolAddress = defaultPool.address;

            const recordedDefaultPoolAddress = await activePool.defaultPoolAddress();

            assert.equal(defaultPoolAddress, recordedDefaultPoolAddress);
          });

          it(`Sets the correct BorrowerOperations address in ActivePool ${asset.name}`, async () => {
            const borrowerOperationsAddress = borrowerOperations.address;

            const recordedBorrowerOperationsAddress = await activePool.borrowerOperationsAddress();

            assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
          });

          it(`Sets the correct TroveManager address in ActivePool ${asset.name}`, async () => {
            const troveManagerAddress = troveManager.address;

            const recordedTroveManagerAddress = await activePool.troveManagerAddress();
            assert.equal(troveManagerAddress, recordedTroveManagerAddress);
          });

          // Stability Pool
          it(`Sets the correct BorrowerOperations address in StabilityPool ${asset.name}`, async () => {
            const borrowerOperationsAddress = borrowerOperations.address;

            const recordedBorrowerOperationsAddress = await stabilityPool.borrowerOperations();

            assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
          });

          it(`Sets the correct KUSDToken address in StabilityPool ${asset.name}`, async () => {
            const kusdTokenAddress = kusdToken.address;

            const recordedClvTokenAddress = await stabilityPool.kusdToken();

            assert.equal(kusdTokenAddress, recordedClvTokenAddress);
          });

          it(`Sets the correct KUMOStaking address in ActivePool ${asset.name}`, async () => {
            const kumoStakingAddress = kumoStaking.address;

            const recordedkumoStakingAddress = await activePool.kumoStakingAddress();
            assert.equal(kumoStakingAddress, kumoStakingAddress);
          });

          it(`Sets the correct TroveManager address in StabilityPool ${asset.name}`, async () => {
            const troveManagerAddress = troveManager.address;

            const recordedTroveManagerAddress = await stabilityPool.troveManager();
            assert.equal(troveManagerAddress, recordedTroveManagerAddress);
          });

          // Default Pool

          it(`Sets the correct TroveManager address in DefaultPool ${asset.name}`, async () => {
            const troveManagerAddress = troveManager.address;

            const recordedTroveManagerAddress = await defaultPool.troveManagerAddress();
            assert.equal(troveManagerAddress, recordedTroveManagerAddress);
          });

          it(`Sets the correct ActivePool address in DefaultPool ${asset.name}`, async () => {
            const activePoolAddress = activePool.address;

            const recordedActivePoolAddress = await defaultPool.activePoolAddress();
            assert.equal(activePoolAddress, recordedActivePoolAddress);
          });

          it(`Sets the correct TroveManager address in SortedTroves ${asset.name}`, async () => {
            const borrowerOperationsAddress = borrowerOperations.address;

            const recordedBorrowerOperationsAddress = await sortedTroves.borrowerOperationsAddress();
            assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
          });

          it(`Sets the correct BorrowerOperations address in SortedTroves ${asset.name}`, async () => {
            const troveManagerAddress = troveManager.address;

            const recordedTroveManagerAddress = await sortedTroves.troveManager();
            assert.equal(troveManagerAddress, recordedTroveManagerAddress);
          });

          //--- BorrowerOperations ---

          it(`Sets the correct KumoParameters address in BorrowerOperations ${asset.name}`, async () => {
            assert.equal(kumoParameters.address, await borrowerOperations.kumoParams());
          });

          // TroveManager in BO
          it(`Sets the correct TroveManager address in BorrowerOperations ${asset.name}`, async () => {
            const troveManagerAddress = troveManager.address;

            const recordedTroveManagerAddress = await borrowerOperations.troveManager();
            assert.equal(troveManagerAddress, recordedTroveManagerAddress);
          });

          // setSortedTroves in BO
          it(`Sets the correct SortedTroves address in BorrowerOperations ${asset.name}`, async () => {
            const sortedTrovesAddress = sortedTroves.address;

            const recordedSortedTrovesAddress = await borrowerOperations.sortedTroves();
            assert.equal(sortedTrovesAddress, recordedSortedTrovesAddress);
          });

          // setActivePool in BO
          // ActivePool is set in KumoParameters
          // it('Sets the correct ActivePool address in BorrowerOperations', async () => {
          //   const activePoolAddress = activePool.address

          //   const recordedActivePoolAddress = await borrowerOperations.activePool()
          //   assert.equal(activePoolAddress, recordedActivePoolAddress)
          // })

          // KUMO Staking in BO
          it(`Sets the correct KUMOStaking address in BorrowerOperations ${asset.name}`, async () => {
            const kumoStakingAddress = kumoStaking.address;

            const recordedKUMOStakingAddress = await borrowerOperations.kumoStakingAddress();
            assert.equal(kumoStakingAddress, recordedKUMOStakingAddress);
          });

          // --- KUMO Staking ---

          // Sets KUMOToken in KUMOStaking
          it(`Sets the correct KUMOToken address in KUMOStaking ${asset.name}`, async () => {
            const kumoTokenAddress = kumoToken.address;

            const recordedKUMOTokenAddress = await kumoStaking.kumoToken();
            assert.equal(kumoTokenAddress, recordedKUMOTokenAddress);
          });

          // Sets ActivePool in KUMOStaking
          it(`Sets the correct ActivePool address in KUMOStaking ${asset.name}`, async () => {
            const activePoolAddress = activePool.address;

            const recordedActivePoolAddress = await kumoStaking.activePoolAddress();
            assert.equal(activePoolAddress, recordedActivePoolAddress);
          });

          // Sets KUSDToken in KUMOStaking
          it(`Sets the correct ActivePool address in KUMOStaking ${asset.name}`, async () => {
            const kusdTokenAddress = kusdToken.address;

            const recordedKUSDTokenAddress = await kumoStaking.kusdToken();
            assert.equal(kusdTokenAddress, recordedKUSDTokenAddress);
          });

          // Sets TroveManager in KUMOStaking
          it(`Sets the correct ActivePool address in KUMOStaking ${asset.name}`, async () => {
            const troveManagerAddress = troveManager.address;

            const recordedTroveManagerAddress = await kumoStaking.troveManagerAddress();
            assert.equal(troveManagerAddress, recordedTroveManagerAddress);
          });

          // Sets BorrowerOperations in KUMOStaking
          it(`Sets the correct BorrowerOperations address in KUMOStaking ${asset.name}`, async () => {
            const borrowerOperationsAddress = borrowerOperations.address;

            const recordedBorrowerOperationsAddress = await kumoStaking.borrowerOperationsAddress();
            assert.equal(borrowerOperationsAddress, recordedBorrowerOperationsAddress);
          });

          // ---  KUMOToken ---

          // Sets CI in KUMOToken
          it(`Sets the correct CommunityIssuance address in KUMOToken ${asset.name}`, async () => {
            const communityIssuanceAddress = communityIssuance.address;

            const recordedcommunityIssuanceAddress = await kumoToken.communityIssuanceAddress();
            assert.equal(communityIssuanceAddress, recordedcommunityIssuanceAddress);
          });

          // Sets KUMOStaking in KUMOToken
          it(`Sets the correct KUMOStaking address in KUMOToken ${asset.name}`, async () => {
            const kumoStakingAddress = kumoStaking.address;

            const recordedKUMOStakingAddress = await kumoToken.kumoStakingAddress();
            assert.equal(kumoStakingAddress, recordedKUMOStakingAddress);
          });

          // Sets LCF in KUMOToken
          it(`Sets the correct LockupContractFactory address in KUMOToken ${asset.name}`, async () => {
            const LCFAddress = lockupContractFactory.address;

            const recordedLCFAddress = await kumoToken.lockupContractFactory();
            assert.equal(LCFAddress, recordedLCFAddress);
          });

          // --- LCF  ---

          // Sets KUMOToken in LockupContractFactory
          it(`Sets the correct KUMOToken address in LockupContractFactory ${asset.name}`, async () => {
            const kumoTokenAddress = kumoToken.address;

            const recordedKUMOTokenAddress = await lockupContractFactory.kumoTokenAddress();
            assert.equal(kumoTokenAddress, recordedKUMOTokenAddress);
          });

          // --- CI ---

          // Sets KUMOToken in CommunityIssuance
          it(`Sets the correct KUMOToken address in CommunityIssuance ${asset.name}`, async () => {
            const kumoTokenAddress = kumoToken.address;

            const recordedKUMOTokenAddress = await communityIssuance.kumoToken();
            assert.equal(kumoTokenAddress, recordedKUMOTokenAddress);
          });

          it(`Sets the correct StabilityPool address in CommunityIssuance ${asset.name}`, async () => {
            const stabilityPoolFactoryAddress = stabilityPoolFactory.address;

            const recordedStabilityPoolFactoryAddress = await communityIssuance.stabilityPoolFactory();
            assert.equal(stabilityPoolFactoryAddress, recordedStabilityPoolFactoryAddress);
          });
        }
      })
    })
  }
);
