// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract KumoFaucet is ERC20, Ownable {
    uint256 public withdrawalAmount = 50000 * (10 ** 18);

    mapping(address => IERC20) mockAssets;
    mapping(address => mapping(address => bool)) isTransferred;

    event Withdrawal(address indexed to, uint256 indexed amount);
    event Deposit(address indexed from, uint256 indexed amount);

    constructor(address _nbcAddress, address _cscAddress) payable ERC20("KumoFaucet", "KMF") {
        mockAssets[_nbcAddress] = IERC20(_nbcAddress);
        mockAssets[_cscAddress] = IERC20(_cscAddress);
    }

    function requestTokens(address _tokenAddress) public returns (bool) {
        require(msg.sender != address(0), "Request must not originate from a zero account");
        require(
            mockAssets[_tokenAddress].balanceOf(address(this)) >= withdrawalAmount,
            "Insufficient balance in faucet for withdrawal request"
        );
        require(
            isTransferred[_tokenAddress][msg.sender] != true,
            "Funds are already transferred - contact on email."
        );

        isTransferred[_tokenAddress][msg.sender] = true;
        mockAssets[_tokenAddress].transfer(msg.sender, withdrawalAmount);
        emit Transfer(_tokenAddress, msg.sender, withdrawalAmount);
        return true;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function transferTestTokens(address _tokenAddress, address to, uint256 amount) public onlyOwner returns (bool) {
        require(msg.sender != address(0), "Request must not originate from a zero account");
        require(
            mockAssets[_tokenAddress].balanceOf(address(this)) >= amount,
            "Insufficient balance in faucet for withdrawal request"
        );

        mockAssets[_tokenAddress].transfer(to, amount);
        emit Transfer(_tokenAddress, to, amount);
        return true;
    }

    function getTestTokensTransferState(
        address _tokenAddress,
        address _userAddress
    ) public view returns (bool) {
        require(_userAddress != address(0), "Request must not originate from a zero account");
        return isTransferred[_tokenAddress][_userAddress];
    }

    function getBalance(address _tokenAddress) external view returns (uint256) {
        return mockAssets[_tokenAddress].balanceOf(address(this));
    }

    function setWithdrawalAmount(uint256 amount) public onlyOwner {
        withdrawalAmount = amount * (10 ** 18);
    }

    function withdraw(address _tokenAddress) external onlyOwner {
        emit Withdrawal(msg.sender, mockAssets[_tokenAddress].balanceOf(address(this)));
        mockAssets[_tokenAddress].transfer(
            msg.sender,
            mockAssets[_tokenAddress].balanceOf(address(this))
        );
    }
}

