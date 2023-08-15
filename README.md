# KUMO Protocol

[![Test contracts](https://github.com/kumodao/borrowprot/actions/workflows/test-contracts.yml/badge.svg)](https://github.com/kumodao/borrowprot/actions/workflows/test-contracts.yml) [![Release SDK & UI](https://github.com/kumodao/borrowprot/actions/workflows/release.yml/badge.svg)](https://github.com/kumodao/borrowprot/actions/workflows/release.yml) [![codecov](https://img.shields.io/codecov/c/gh/kumodao/kumo-protocol?label=codecov&logo=codecov)](https://app.codecov.io/gh/kumodao/kumo-protocol) [![Discord](https://img.shields.io/discord/931098119234551868?label=join%20chat&logo=discord&logoColor=white)](https://discord.gg/EfMyuxMmeN)


## Contributions
---
Kumo is an open-source project and we are excited about everyone wanting to contribute to Kumo's codebase. 
But before you start, please have a look at our [Coding Standards](docs/coding-standards.md).

## FAQ:

---

Q: How to change the mint cap for KUSD?

A: Call `KumoParameters.setKUSDMintCap(address _asset, uint256 _newCap)` as an owner of the contract

---

Q: How can we know the remainder of unminted KUSD?

A: Call `KUSDMintRemainder(address _asset)`

---

Inspired by the great work of [Liquity](https://github.com/liquity/dev/) ([License](https://github.com/liquity/dev/blob/main/LICENSE))
