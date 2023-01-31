const StabilityPool = artifacts.require("./StabilityPool.sol");
const ActivePool = artifacts.require("./ActivePool.sol");
const DefaultPool = artifacts.require("./DefaultPool.sol");
const NonPayable = artifacts.require("./NonPayable.sol");
const CollSurplusPool = artifacts.require("./CollSurplusPool.sol");
const ERC20Test = artifacts.require("./ERC20Test.sol");
const StabilityPoolFactory = artifacts.require("./StabilityPoolFactory.sol");
// const KumoParameters = artifacts.require("./KumoParameters.sol")
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const testHelpers = require("../utils/testHelpers.js");

const th = testHelpers.TestHelper;
const dec = th.dec;

const _minus_1_Ether = web3.utils.toWei("-1", "ether");

contract("StabilityPool", async accounts => {
  /* mock* are EOA’s, temporarily used to call protected functions.
  TODO: Replace with mock contracts, and later complete transactions from EOA
  */
  let stabilityPool;

  const [owner, alice] = accounts;

  beforeEach(async () => {
    stabilityPool = await StabilityPool.new();
    const mockActivePoolAddress = (await NonPayable.new()).address;
    const dumbContractAddress = (await NonPayable.new()).address;

    await stabilityPool.setAddresses(
      dumbContractAddress,
      dumbContractAddress,
      dumbContractAddress,
      dumbContractAddress,
      dumbContractAddress,
      dumbContractAddress,
      dumbContractAddress,
      dumbContractAddress
    );
  });

  it("getAssetBalance(): gets the recorded Asset balance", async () => {
    const recordedAssetBalance = await stabilityPool.getAssetBalance();
    assert.equal(recordedAssetBalance, 0);
  });

  it("getTotalKUSDDeposits(): gets the recorded KUSD balance", async () => {
    const recordedETHBalance = await stabilityPool.getTotalKUSDDeposits();
    assert.equal(recordedETHBalance, 0);
  });
});

contract("ActivePool", async accounts => {
  let activePool, mockBorrowerOperations, erc20Test;

  const [owner, alice] = accounts;
  beforeEach(async () => {
    erc20Test = await ERC20Test.new();
    await erc20Test.mint(owner, await web3.eth.getBalance(owner));
    activePool = await ActivePool.new();
    mockBorrowerOperations = await NonPayable.new();
    stabilityPoolFactory = await StabilityPoolFactory.new();
    const dumbContractAddress = (await NonPayable.new()).address;

    await stabilityPoolFactory.createNewStabilityPool(erc20Test.address, dumbContractAddress);

    await activePool.setAddresses(
      mockBorrowerOperations.address,
      dumbContractAddress,
      stabilityPoolFactory.address,
      dumbContractAddress,
      dumbContractAddress,
      dumbContractAddress,
      dumbContractAddress
    );
  });

  it("getAssetBalance(): gets the recorded Asset balance", async () => {
    const recordedAssetBalance = await activePool.getAssetBalance(ZERO_ADDRESS);
    assert.equal(recordedAssetBalance, 0);
  });

  it("getKUSDDebt(): gets the recorded KUSD balance", async () => {
    const recordedETHBalance = await activePool.getKUSDDebt(ZERO_ADDRESS);
    assert.equal(recordedETHBalance, 0);
  });

  it("increaseKUSD(): increases the recorded KUSD balance by the correct amount", async () => {
    const recordedKUSD_balanceBefore = await activePool.getKUSDDebt(ZERO_ADDRESS);
    assert.equal(recordedKUSD_balanceBefore, 0);

    // await activePool.increaseKUSDDebt(100, { from: mockBorrowerOperationsAddress })
    const increaseKUSDDebtData = th.getTransactionData("increaseKUSDDebt(address,uint256)", [
      ZERO_ADDRESS,
      "0x64"
    ]);
    const tx = await mockBorrowerOperations.forward(activePool.address, increaseKUSDDebtData);
    assert.isTrue(tx.receipt.status);
    const recordedKUSD_balanceAfter = await activePool.getKUSDDebt(ZERO_ADDRESS);
    assert.equal(recordedKUSD_balanceAfter, 100);
  });
  // Decrease
  it("decreaseKUSD(): decreases the recorded KUSD balance by the correct amount", async () => {
    // start the pool on 100 wei
    //await activePool.increaseKUSDDebt(100, { from: mockBorrowerOperationsAddress })
    const increaseKUSDDebtData = th.getTransactionData("increaseKUSDDebt(address,uint256)", [
      ZERO_ADDRESS,
      "0x64"
    ]);
    const tx1 = await mockBorrowerOperations.forward(activePool.address, increaseKUSDDebtData);
    assert.isTrue(tx1.receipt.status);

    const recordedKUSD_balanceBefore = await activePool.getKUSDDebt(ZERO_ADDRESS);
    assert.equal(recordedKUSD_balanceBefore, 100);

    //await activePool.decreaseKUSDDebt(100, { from: mockBorrowerOperationsAddress })
    const decreaseKUSDDebtData = th.getTransactionData("decreaseKUSDDebt(address,uint256)", [
      ZERO_ADDRESS,
      "0x64"
    ]);
    const tx2 = await mockBorrowerOperations.forward(activePool.address, decreaseKUSDDebtData);
    assert.isTrue(tx2.receipt.status);
    const recordedKUSD_balanceAfter = await activePool.getKUSDDebt(ZERO_ADDRESS);
    assert.equal(recordedKUSD_balanceAfter, 0);
  });

  // send raw ether
  it("sendAsset(): decreases the recorded Asset balance by the correct amount", async () => {
    // setup: give pool 2 ether
    const activePool_initialBalance = web3.utils.toBN(await web3.eth.getBalance(activePool.address));
    assert.equal(activePool_initialBalance, 0);
    // start pool with 2 ether
    await erc20Test.transfer(activePool.address, dec(2, "ether"));
    const recieveERC20Asset = th.getTransactionData("receivedERC20(address,uint256)", [
      erc20Test.address,
      web3.utils.toHex(dec(2, "ether"))
    ]);
    const tx1 = await mockBorrowerOperations.forward(activePool.address, recieveERC20Asset);

    assert.isTrue(tx1.receipt.status);

    const activePool_BalanceBeforeTx_ERC20 = web3.utils.toBN(
      await erc20Test.balanceOf(activePool.address)
    );
    const activePool_BalanceBeforeTx_AssetBalance = await activePool.getAssetBalance(
      erc20Test.address
    );
    const alice_Balance_BeforeTx = web3.utils.toBN(await erc20Test.balanceOf(alice));

    assert.equal(activePool_BalanceBeforeTx_ERC20, dec(2, "ether"));
    assert.equal(activePool_BalanceBeforeTx_AssetBalance, dec(2, "ether"));

    // send ether from pool to alice
    //await activePool.sendETH(alice, dec(1, 'ether'), { from: mockBorrowerOperationsAddress })
    const sendAssetData = th.getTransactionData("sendAsset(address,address,uint256)", [
      erc20Test.address,
      alice,
      web3.utils.toHex(dec(1, "ether"))
    ]);
    const tx2 = await mockBorrowerOperations.forward(activePool.address, sendAssetData, {
      from: owner
    });
    assert.isTrue(tx2.receipt.status);

    const activePool_BalanceAfterTx_ERC20 = web3.utils.toBN(
      await erc20Test.balanceOf(activePool.address)
    );
    const activePool_BalanceAfterTx_AssetBalance = await activePool.getAssetBalance(
      erc20Test.address
    );
    const alice_Balance_AfterTx = web3.utils.toBN(await erc20Test.balanceOf(alice));

    const alice_BalanceChange = alice_Balance_AfterTx.sub(alice_Balance_BeforeTx);
    const pool_BalanceChange_ERC20 = activePool_BalanceAfterTx_ERC20.sub(
      activePool_BalanceBeforeTx_ERC20
    );
    const pool_BalanceChange_AssetBalance = activePool_BalanceAfterTx_AssetBalance.sub(
      activePool_BalanceBeforeTx_AssetBalance
    );
    assert.equal(alice_BalanceChange, dec(1, "ether"));
    assert.equal(pool_BalanceChange_ERC20, _minus_1_Ether);
    assert.equal(pool_BalanceChange_AssetBalance, _minus_1_Ether);
  });
});

contract("DefaultPool", async accounts => {
  let defaultPool, mockTroveManager, mockActivePool, erc20Test;

  const [owner, alice] = accounts;
  beforeEach(async () => {
    erc20Test = await ERC20Test.new();
    await erc20Test.mint(owner, await web3.eth.getBalance(owner));
    defaultPool = await DefaultPool.new();
    mockTroveManager = await NonPayable.new();
    mockActivePool = await NonPayable.new();
    await defaultPool.setAddresses(mockTroveManager.address, mockActivePool.address);
  });

  it("getETH(): gets the recorded KUSD balance", async () => {
    const recordedETHBalance = await defaultPool.getAssetBalance(ZERO_ADDRESS);
    assert.equal(recordedETHBalance, 0);
  });

  it("getKUSDDebt(): gets the recorded KUSD balance", async () => {
    const recordedETHBalance = await defaultPool.getKUSDDebt(ZERO_ADDRESS);
    assert.equal(recordedETHBalance, 0);
  });

  it("increaseKUSD(): increases the recorded KUSD balance by the correct amount", async () => {
    const recordedKUSD_balanceBefore = await defaultPool.getKUSDDebt(ZERO_ADDRESS);
    assert.equal(recordedKUSD_balanceBefore, 0);

    // await defaultPool.increaseKUSDDebt(100, { from: mockTroveManagerAddress })
    const increaseKUSDDebtData = th.getTransactionData("increaseKUSDDebt(address,uint256)", [
      ZERO_ADDRESS,
      "0x64"
    ]);
    const tx = await mockTroveManager.forward(defaultPool.address, increaseKUSDDebtData);
    assert.isTrue(tx.receipt.status);

    const recordedKUSD_balanceAfter = await defaultPool.getKUSDDebt(ZERO_ADDRESS);
    assert.equal(recordedKUSD_balanceAfter, 100);
  });

  it("decreaseKUSD(): decreases the recorded KUSD balance by the correct amount", async () => {
    // start the pool on 100 wei
    //await defaultPool.increaseKUSDDebt(100, { from: mockTroveManagerAddress })
    const increaseKUSDDebtData = th.getTransactionData("increaseKUSDDebt(address,uint256)", [
      ZERO_ADDRESS,
      "0x64"
    ]);
    const tx1 = await mockTroveManager.forward(defaultPool.address, increaseKUSDDebtData);
    assert.isTrue(tx1.receipt.status);

    const recordedKUSD_balanceBefore = await defaultPool.getKUSDDebt(ZERO_ADDRESS);
    assert.equal(recordedKUSD_balanceBefore, 100);

    // await defaultPool.decreaseKUSDDebt(100, { from: mockTroveManagerAddress })
    const decreaseKUSDDebtData = th.getTransactionData("decreaseKUSDDebt(address,uint256)", [
      ZERO_ADDRESS,
      "0x64"
    ]);
    const tx2 = await mockTroveManager.forward(defaultPool.address, decreaseKUSDDebtData);
    assert.isTrue(tx2.receipt.status);

    const recordedKUSD_balanceAfter = await defaultPool.getKUSDDebt(ZERO_ADDRESS);
    assert.equal(recordedKUSD_balanceAfter, 0);
  });

  // send raw erc20
  it("sendETHToActivePool(): decreases the recorded ETH balance by the correct amount", async () => {
    // setup: give pool 2 ether
    const defaultPool_initialBalance = web3.utils.toBN(
      await web3.eth.getBalance(defaultPool.address)
    );
    assert.equal(defaultPool_initialBalance, 0);

    // start pool with 2 ether
    await erc20Test.transfer(defaultPool.address, dec(2, "ether"));
    const recieveERC20Asset = th.getTransactionData("receivedERC20(address,uint256)", [
      erc20Test.address,
      web3.utils.toHex(dec(2, "ether"))
    ]);
    const tx1 = await mockActivePool.forward(defaultPool.address, recieveERC20Asset, {
      from: owner
    });
    assert.isTrue(tx1.receipt.status);

    // const defaultPool_BalanceBeforeTx = web3.utils.toBN(await web3.eth.getBalance(defaultPool.address))
    const defaultPool_Balance_BeforeTx_ERC20 = web3.utils.toBN(
      await erc20Test.balanceOf(defaultPool.address)
    );
    const defaultPool_Balance_BeforeTx_AssetBalance = await defaultPool.getAssetBalance(
      erc20Test.address
    );
    const activePool_Balance_BeforeTx = web3.utils.toBN(
      await erc20Test.balanceOf(mockActivePool.address)
    );

    assert.equal(defaultPool_Balance_BeforeTx_ERC20, dec(2, "ether"));
    assert.equal(defaultPool_Balance_BeforeTx_AssetBalance, dec(2, "ether"));

    // send asset from default pool to active pool
    //await defaultPool.sendETHToActivePool(dec(1, 'ether'), { from: mockTroveManagerAddress })
    const sendAssetData = th.getTransactionData("sendAssetToActivePool(address,uint256)", [
      erc20Test.address,
      web3.utils.toHex(dec(1, "ether"))
    ]);
    const tx2 = await mockTroveManager.forward(defaultPool.address, sendAssetData, { from: owner });
    assert.isTrue(tx2.receipt.status);

    const defaultPool_Balance_AfterTx_ERC20 = web3.utils.toBN(
      await erc20Test.balanceOf(defaultPool.address)
    );
    const defaultPool_Balance_AfterTx_AssetBalance = await defaultPool.getAssetBalance(
      erc20Test.address
    );
    const activePool_Balance_AfterTx = web3.utils.toBN(
      await erc20Test.balanceOf(mockActivePool.address)
    );

    const activePool_BalanceChange = activePool_Balance_AfterTx.sub(activePool_Balance_BeforeTx);
    const defaultPool_BalanceChange_ERC20 = defaultPool_Balance_AfterTx_ERC20.sub(
      defaultPool_Balance_BeforeTx_ERC20
    );
    const defaultPool_BalanceChange_AssetBalance = defaultPool_Balance_AfterTx_AssetBalance.sub(
      defaultPool_Balance_BeforeTx_AssetBalance
    );
    assert.equal(activePool_BalanceChange, dec(1, "ether"));
    assert.equal(defaultPool_BalanceChange_ERC20, _minus_1_Ether);
    assert.equal(defaultPool_BalanceChange_AssetBalance, _minus_1_Ether);
  });
});

contract("Reset chain state", async accounts => {});
