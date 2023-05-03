// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./Facets/ITroveManagerFacet.sol";
import "./Facets/ITroveRedemptorFacet.sol";

interface ITroveManagerDiamond is ITroveManagerFacet, ITroveRedemptorFacet {}
