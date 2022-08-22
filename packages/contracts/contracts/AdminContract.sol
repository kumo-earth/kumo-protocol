pragma solidity ^0.8.10;

import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

import "./Dependencies/CheckContract.sol";

import "./Interfaces/IStabilityPoolManager.sol";
import "./Interfaces/IKumoParameters.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/ICommunityIssuance.sol";

contract AdminContract is ProxyAdmin {
	string public constant NAME = "AdminContract";

	bytes32 public constant STABILITY_POOL_NAME_BYTES =
		0xf704b47f65a99b2219b7213612db4be4a436cdf50624f4baca1373ef0de0aac7;
	bool public isInitialized;

	IKumoParameters private kumoParameters;
	IStabilityPoolManager private stabilityPoolManager;
	ICommunityIssuance private communityIssuance;

	address borrowerOperationsAddress;
	address troveManagerAddress;
	address kumoTokenAddress;
	address sortedTrovesAddress;



	function setAddresses(
		address _paramaters,
		address _stabilityPoolManager,
		address _borrowerOperationsAddress,
		address _troveManagerAddress,
		address _kumoTokenAddress,
		address _sortedTrovesAddress,
		address _communityIssuanceAddress
	) external onlyOwner {
		require(!isInitialized);
		CheckContract(_paramaters);
		CheckContract(_stabilityPoolManager);
		CheckContract(_borrowerOperationsAddress);
		CheckContract(_troveManagerAddress);
		CheckContract(_kumoTokenAddress);
		CheckContract(_sortedTrovesAddress);
		CheckContract(_communityIssuanceAddress);
		isInitialized = true;

		borrowerOperationsAddress = _borrowerOperationsAddress;
		troveManagerAddress = _troveManagerAddress;
		kumoTokenAddress = _kumoTokenAddress;
		sortedTrovesAddress = _sortedTrovesAddress;
		communityIssuance = ICommunityIssuance(_communityIssuanceAddress);

		kumoParameters = IKumoParameters(_paramaters);
		stabilityPoolManager = IStabilityPoolManager(_stabilityPoolManager);
	}

	//Needs to approve Community Issuance to use this fonction.
	function addNewCollateral(
		address _asset,
		address _stabilityPoolImplementation,
		address _chainlinkOracle,
		address _chainlinkIndex,
		uint256 assignedToken,
		uint256 _tokenPerWeekDistributed,
		uint256 redemptionLockInDay
	) external onlyOwner {
		require(
			stabilityPoolManager.unsafeGetAssetStabilityPool(_asset) == address(0),
			"This collateral already exists"
		);
		require(
			IStabilityPool(_stabilityPoolImplementation).getNameBytes() == STABILITY_POOL_NAME_BYTES,
			"Invalid Stability pool"
		);
		//address pool = new stabilityPoolManager();

		TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
			_stabilityPoolImplementation,
			address(this),
			abi.encodeWithSignature(
				"setAddresses(address,address,address,address,address,address,address)",	
				_asset,
				borrowerOperationsAddress,
				troveManagerAddress,
				kumoTokenAddress,
				sortedTrovesAddress,
				address(communityIssuance),
				address(kumoParameters)
			)
		);

	    address proxyAddress = address(proxy);
		stabilityPoolManager.addStabilityPool(_asset, proxyAddress);
		// communityIssuance.addFundToStabilityPoolFrom(proxyAddress, assignedToken, msg.sender);
		// communityIssuance.setWeeklyKumoDistribution(proxyAddress, _tokenPerWeekDistributed);
	}
}
