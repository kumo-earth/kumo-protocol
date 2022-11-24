const testHelpers = require("../utils/testHelpers.js")
const DefaultPool = artifacts.require("./DefaultPool.sol")
const NonPayable = artifacts.require('NonPayable.sol')
const ERC20Test = artifacts.require("./ERC20Test.sol")

const th = testHelpers.TestHelper
const dec = th.dec

contract('DefaultPool', async accounts => {
  let defaultPool
  let nonPayable
  let mockActivePool
  let mockTroveManager
  let erc20Test

  let [owner] = accounts

  beforeEach('Deploy contracts', async () => {
    defaultPool = await DefaultPool.new()
    nonPayable = await NonPayable.new()
    mockTroveManager = await NonPayable.new()
    mockActivePool = await NonPayable.new()
    erc20Test = await ERC20Test.new()
    await erc20Test.mint(owner, await web3.eth.getBalance(owner))
    await defaultPool.setAddresses(mockTroveManager.address, mockActivePool.address)
  })

  it('sendAssetToActivePool(): fails if receiver cannot receive ERC20 Asset', async () => {
    const amount = dec(1, 'ether')

    // start pool with `amount`
    //await web3.eth.sendTransaction({ to: defaultPool.address, from: owner, value: amount })
    // const tx = await mockActivePool.forward(defaultPool.address, '0x', { from: owner, value: amount })
    // assert.isTrue(tx.receipt.status)

    await erc20Test.transfer(defaultPool.address, amount)
    const recieveERC20Asset1 = th.getTransactionData('receivedERC20(address,uint256)', [erc20Test.address, web3.utils.toHex(amount)])
    const tx = await mockActivePool.forward(defaultPool.address, recieveERC20Asset1, { from: owner })
    assert.isTrue(tx.receipt.status)

    // try to send ether from pool to non-payable
    //await th.assertRevert(defaultPool.sendETHToActivePool(amount, { from: owner }), 'DefaultPool: sending ETH failed')
    // const sendETHData = th.getTransactionData('sendETHToActivePool(uint256)', [web3.utils.toHex(amount)])
    // await th.assertRevert(mockTroveManager.forward(defaultPool.address, sendETHData, { from: owner }), 'DefaultPool: sending ETH failed')
    const sendAssetData = th.getTransactionData('sendAssetToActivePool(address,uint256)', [erc20Test.address, web3.utils.toHex(amount)])
    const tx2 = await mockTroveManager.forward(defaultPool.address, sendAssetData, { from: owner })
    th.assertRevert(tx2.receipt.status)
  })
})

contract('Reset chain state', async accounts => { })
